---
title: State management in microservices — stateless services, sessions, idempotency and event sourcing
nav: State management
slug: microservice-state
summary: Where state lives in a microservice system and how to manage it: stateless vs stateful services, sticky sessions, externalised sessions and tokens, data ownership, idempotency keys and safe retries, optimistic locking, event sourcing and CQRS, and stateful workloads in Kubernetes, with Java examples and interview questions.
tags: [Microservices, State, Stateless, Sessions, Idempotency, Event sourcing, CQRS, Kubernetes]
order: 33
topic: Microservices / State and coordination
updated: 2026-11-14
subnav: true
---

"Is your service stateless?" is a favourite microservices question, and it leads quickly to harder ones: *where do the sessions live, what happens when an instance dies, how do you stop a retried payment being charged twice, and where does the data go when a pod is rescheduled?* This lesson answers them. It builds on [microservice patterns](lesson:microservice-patterns) (database per service), [JWT](lesson:jwt) and [Spring Security](lesson:spring-security) (tokens instead of sessions), [Redis caching](lesson:redis-caching) (shared fast state), [the saga pattern](lesson:saga) and [messaging](lesson:messaging) (state that spans services), and [Kubernetes](lesson:kubernetes) (where the instances run). Play the five scenes: staying stateless, where each kind of state lives, idempotent retries, event sourcing with CQRS, and stateful workloads on Kubernetes.

```demo
name: microservice-state-walk
```

> **One sentence to remember:** *keep services stateless so any instance can handle any request, give each piece of state one owner and one home (database, shared store, token or event log), and make every operation safe to retry.*

## What state is, and why it matters {#what}

**State** is anything a service remembers between two requests: a login session, a shopping cart, an account balance, the step a money transfer has reached. A system can work with state in two ways, and the choice decides how easily it scales and recovers.

| | Stateless service | Stateful service |
| --- | --- | --- |
| Remembers between requests | nothing: everything it needs comes with the request or from a store | data in its own memory or disk |
| Any instance can serve any request | yes | no, only the instance that holds the state |
| Scale out and replace instances | add or kill instances freely | needs data placement, replication and recovery |
| Typical example | a payment API behind a load balancer | a database, a message broker, a cache node |

State does not disappear in a stateless design. It moves to a place built for it, so the services in front can be simple and disposable.

## Stateless and stateful services {#stateless}

A stateless service can be scaled by adding instances behind a load balancer, restarted at any time, and deployed with rolling updates, because no instance is special. This is one of the [twelve-factor](lesson:microservice-patterns) ideas: processes are stateless and share nothing, and anything that must persist goes into a backing service.

**Local state is the trap.** An in-memory session, a file written to the container disk, a counter in a static field, or a local cache all break when the service has two instances: requests land on an instance that does not know the data. They also vanish when the instance restarts.

**Sticky sessions** make the load balancer send a customer to the same instance every time (by cookie or IP). It hides the problem rather than fixing it: sessions are still lost when the instance dies or is replaced in a deployment, load can become uneven, and autoscaling gets harder. Use it only as a short-term step.

Three ways to make a service stateless:

1. **Externalise the state** to a shared store (Redis for sessions, the database for business data).
2. **Move the state to the client** in a signed token (a [JWT](lesson:jwt)); the service verifies it on each call.
3. **Make the state derivable**: rebuild it from a database or an event log when needed.

## Where each kind of state lives {#where}

| Kind of state | Example | Natural home | If it is lost |
| --- | --- | --- | --- |
| Request state | parsed request body, local variables | memory, for the length of the request | nothing, the request is retried |
| Session state | who is logged in, a wizard step | shared store such as Redis, or a token | the user logs in again |
| Cached state | exchange rates, product lookups | cache (Redis, local), with a TTL | the cache refills |
| Business data | accounts, balances, payments | the service's own database | a serious incident: needs backups |
| Workflow state | transfer 91 is at step 2 of 3 | database table or workflow engine | the process cannot continue safely |
| Event history | payment completed, card blocked | event log (Kafka) or event store | other services miss changes |

Two rules keep this tidy. **Every piece of state has exactly one owner**, the service responsible for it, and other services read it through that service's API or through events, never straight from its database. And **a cache or session store must never be the only copy** of something that matters.

## Sessions and tokens {#sessions}

Two common ways to keep a service stateless while users stay logged in:

| | Server-side session in a shared store | Token held by the client (JWT) |
| --- | --- | --- |
| What the client sends | a session id cookie | a signed token in the `Authorization` header |
| Where the data is | Redis (or a database), looked up each request | inside the token (claims) |
| Revoke at once | easy: delete the session | hard: wait for expiry, or keep a deny list |
| Cost per request | a network call to the store | a signature check, no call |
| Size and exposure | tiny cookie, data stays on the server | larger header, claims are readable by the client |

Banks often keep sessions short and server-side for the web channel (easy to revoke, nothing sensitive in the browser) and use short-lived tokens between services. In Spring, **Spring Session** moves the HTTP session into Redis with a dependency and a few properties, and the rest of the code keeps using `HttpSession`:

```properties
# build.gradle / pom.xml: spring-session-data-redis
spring.session.timeout=30m
spring.data.redis.host=redis.internal
```

## Data ownership and consistency {#data}

In a microservice system each service owns its data ([database per service](lesson:microservice-patterns)), so there is no single transaction across services. That makes consistency a state-management problem:

- **Inside one service**, use the database transaction ([ACID](lesson:acid-base), [Spring transactions](lesson:spring-transactions)).
- **Across services**, use a [saga](lesson:saga) with compensating actions, and publish events through the **outbox** pattern so the database change and the message cannot disagree.
- **Concurrent updates to the same record** need a guard. **Optimistic locking** adds a `version` column: an update succeeds only if the version is unchanged, otherwise the second writer gets a conflict and retries. In JPA that is one `@Version` field.

```java
@Entity
class Account {
    @Id Long id;
    BigDecimal balance;
    @Version long version;   // the update fails with OptimisticLockException if someone else changed the row
}
```

- **Copies of data** held by other services (a read model, a cache) are eventually consistent. Decide how stale each one may be, and never base a payment approval on a copy.

## Idempotency: making retries safe {#idempotency}

Networks lose responses, clients time out and brokers deliver messages at least once, so **every call may arrive more than once**. An operation is **idempotent** if doing it twice has the same effect as doing it once. `GET`, `PUT` and `DELETE` are idempotent by definition; `POST /payments` is not, so you make it so.

The standard technique is an **idempotency key**:

1. The client generates a unique key for the intent (a UUID) and sends it on every attempt, including retries (`Idempotency-Key` header).
2. The service stores the key with the result in a table with a **unique constraint**, in the same transaction as the business change.
3. A repeat with the same key returns the stored result and does not run the change again.
4. A repeat with the same key but a different body is rejected (a client bug).

The same idea protects **message consumers**: store the id of each processed message in the same transaction as its effect, and skip duplicates.

## Event sourcing and CQRS {#events}

**Event sourcing** stores the **sequence of changes** instead of the current value. An account is `Opened`, `Deposited 100`, `Withdrawn 20`; the balance (80) is computed by replaying them. The events are append-only and never edited, so you get a full audit trail, the ability to rebuild state at any past moment, and a natural stream to publish. **Snapshots** keep replay fast.

**CQRS** (Command Query Responsibility Segregation) separates the **write model** (commands that enforce rules and produce events) from one or more **read models** (tables shaped for screens, built by projecting the events). Reads and writes can then use different stores and scale separately.

They are often used together but are independent ideas. The costs are real: read models are **eventually consistent**, events need **versioning** as their shape changes, corrections are made with new compensating events rather than edits, and there is more to operate. Choose them where history and audit are central (ledgers, trading, claims), not for every CRUD service.

## Stateful workloads in Kubernetes {#kubernetes}

In [Kubernetes](lesson:kubernetes) pods are disposable: they are killed and rescheduled freely, and their own filesystem goes with them. So:

- **Stateless services** run as a `Deployment` of identical pods. Keep configuration in `ConfigMap`s and `Secret`s, not in files baked into the pod.
- **Data that must survive** a pod uses a **PersistentVolumeClaim**, which binds to a **PersistentVolume** that outlives the pod.
- **Databases and brokers** that need stable identity use a **StatefulSet**: pods get stable names (`db-0`, `db-1`) and each keeps its own volume, and they start and stop in order.
- Running stateful systems yourself means owning backups, failover and upgrades. Many teams use a **managed** database or Redis and keep only stateless services in the cluster; an **operator** can automate the work when you do run them.

## Cheat sheet {#cheatsheet}

| Problem | Reach for |
| --- | --- |
| Session lost when an instance dies | shared session store (Spring Session + Redis) or tokens |
| Need to scale out freely | stateless services, external state |
| Request retried, charged twice | idempotency key + unique constraint |
| Duplicate message delivered | idempotent consumer, processed-id table |
| Two writers update one row | optimistic locking (`@Version`) |
| Change in a DB and a message must agree | transactional outbox |
| Process spans several services | saga, state kept in a table |
| Need full history and audit | event sourcing (+ snapshots) |
| Fast read screens from complex data | CQRS read model |
| Database inside Kubernetes | StatefulSet + PersistentVolumeClaim, or a managed service |

## Interview questions {#questions}

### [basic] What does it mean for a service to be stateless? {#stateless-q}

It does not keep anything between requests in its own memory or disk. Everything it needs comes with the request (a token, parameters) or is read from a shared store such as a database or Redis. Any instance can then serve any request, so you can add, remove and restart instances freely. Stateless does not mean the system has no state; the state lives in a store built for it.

### [basic] Why are stateless services easier to scale? {#scale-q}

Because instances are interchangeable. A load balancer can send each request anywhere, autoscaling can add instances without moving data, a crashed instance loses nothing, and rolling deployments replace instances one at a time. A stateful service needs data placement, replication and recovery for every instance.

### [basic] What are sticky sessions and what is wrong with them? {#sticky-q}

The load balancer routes a customer to the same instance every time, so that instance can keep the session in memory. Problems: the session is lost when that instance restarts, crashes or is replaced in a deployment, load can become uneven, and scaling in is awkward. Prefer a shared session store or tokens, and use stickiness only as a stopgap.

### [basic] How do you keep sessions when you run several instances? {#session-q}

Externalise them. Either store the session in Redis or a database that all instances share (Spring Session does this with the `HttpSession` API unchanged), or avoid a server session and give the client a signed token (a JWT) that each service verifies. Set a TTL so abandoned sessions disappear.

### [basic] Where should each kind of state live in a microservice system? {#where-q}

Request state in memory for the length of the request; session state in a shared store or a token; cached data in a cache with a TTL; business data in the owning service's own database; workflow state in a table or workflow engine; and changes other services need to know about in an event log such as Kafka. Each piece has one owner, and no cache or session store is the only copy of important data.

### [intermediate] Session in Redis or a JWT: how do you choose? {#session-vs-jwt-q}

A server-side session is easy to revoke and keeps data off the client, but costs a store lookup per request and a shared store to run. A JWT needs no lookup and works across services, but is hard to revoke before it expires and puts claims in the client's hands. A common compromise is short-lived access tokens plus a refresh token held server-side, so revocation happens at refresh time.

### [intermediate] Can a service that uses a database be stateless? {#db-stateless-q}

Yes. Stateless means the service instance holds no state of its own between requests. It reads and writes through a database or other store, and the state belongs to that store. What you avoid is state that is only in one instance's memory or disk.

### [intermediate] What is idempotency and why does it matter in microservices? {#idempotent-q}

An operation is idempotent when repeating it has the same effect as doing it once. It matters because networks fail, clients retry after timeouts and brokers deliver messages at least once, so a service will see duplicates. Without idempotency a retried payment charges twice. `GET`, `PUT` and `DELETE` are idempotent by design; `POST` needs an idempotency key or a natural unique business key.

### [intermediate] How do you implement an idempotency key? {#idempotency-key-q}

The client sends a unique key with each attempt. The service inserts the key (with a hash of the request) into a table with a unique constraint in the same transaction as the business change, and stores the response. A repeat with the same key returns the stored response; a repeat with a different body is rejected; a concurrent duplicate loses the insert race and waits or gets a conflict. Keys expire after a retention period, such as 24 hours.

### [intermediate] How do you make a message consumer idempotent? {#consumer-q}

Brokers such as Kafka and RabbitMQ deliver at least once, so the same message can arrive twice. Record the id of each processed message in the same database transaction as its effect, with a unique constraint, and skip it when the id is already there. Alternatively make the effect naturally idempotent, for example `SET status = 'PAID'` rather than `balance = balance - 50`.

### [intermediate] What is optimistic locking and when do you use it? {#optimistic-q}

A `version` column that is checked on update: `UPDATE ... WHERE id = ? AND version = ?`. If someone else changed the row first, no row matches and the update fails, so the caller reloads and retries instead of overwriting. Use it when conflicts are rare, which avoids holding database locks. With many conflicts on the same row, pessimistic locking or a redesign is better. In JPA, add `@Version` to the entity.

### [intermediate] How do you keep data consistent when each service owns its own database? {#consistency-q}

Use a local ACID transaction inside each service, and a saga across services: a sequence of local steps with compensating actions for failures. Publish events through a transactional outbox so the database change and the message are atomic. Accept that copies in other services are eventually consistent, and design the user experience and the checks around that, for example by reading the source of truth before approving a payment.

### [intermediate] What is event sourcing? {#event-sourcing-q}

Instead of storing the current state, you store every change as an immutable event in an append-only log, and compute the current state by replaying the events (with snapshots for speed). You get a complete audit trail, can rebuild past states and can feed other services from the same events. Costs: harder queries (so it is paired with read models), event versioning, and eventual consistency between the log and its views.

### [intermediate] What is CQRS and how does it relate to event sourcing? {#cqrs-q}

CQRS separates the model that handles commands (writes, rules) from the models that answer queries (reads). Read models are built by projecting events or changes into tables shaped for each screen. It is often used with event sourcing, because the event stream feeds the read models, but each can be used without the other. The trade-off is eventual consistency and more moving parts.

### [intermediate] How do you run a database or other stateful system on Kubernetes? {#stateful-k8s-q}

Use a StatefulSet, which gives pods stable names and one PersistentVolumeClaim each, so a rescheduled pod returns with the same identity and data. Add backups, a readiness probe, anti-affinity across nodes and, ideally, an operator that handles failover and upgrades. Many teams prefer a managed database outside the cluster, because running stateful systems well is a lot of work.

### [deep] A pod holding data is rescheduled to another node. What happens to the data? {#reschedule-q}

With only the container filesystem, the data is lost. With a PersistentVolume, it survives, but the volume has to be attachable from the new node: network-attached storage (a cloud disk or network volume) can move, while a local volume ties the pod to its node. StatefulSets also keep the same pod name and claim, so the replacement reattaches to the same volume. Replication to other pods covers node loss.

### [deep] How do you handle a payment retried after a timeout when you do not know if it succeeded? {#timeout-q}

The client retries with the same idempotency key. If the first attempt completed, the service returns the stored result. If it did not, the service processes it now. The service should not guess: it stores the outcome of each key, and for calls to downstream systems it uses their own idempotency keys or a status query before acting again. Unknown outcomes can also be settled afterwards by reconciliation against the other side.

### [deep] How does event sourcing handle a change in the event structure? {#event-version-q}

Events are immutable and stay in the log forever, so you never rewrite old ones. Give each event a type and a version, and add **upcasters** that convert old versions to the current shape when they are read, or write new event types alongside the old. Make changes backward compatible (add optional fields rather than removing them). Mistakes are corrected with new compensating events, not edits.

### [deep] When would you not make a service stateless? {#not-stateless-q}

When the state is large, latency-sensitive or expensive to move: databases, brokers, in-memory data grids, and stream processors with local state. These are stateful on purpose and need replication, stable identity and careful recovery. The rest of the architecture stays stateless around them. For local caches inside a stateless service, accept that each instance has its own copy and keep the TTL short.

### [coding] Make a payment endpoint idempotent with an idempotency key. {#coding-idempotency}

```java
@Entity
@Table(name = "idempotency_key")
class IdempotencyRecord {
    @Id String key;                 // unique: the primary key is the constraint
    String requestHash;
    @Lob String responseJson;
    Instant createdAt = Instant.now();
}

@Service
class PaymentService {
    private final IdempotencyRepository keys;
    private final LedgerRepository ledger;
    private final ObjectMapper mapper;

    @Transactional
    public PaymentResult pay(String key, PaymentRequest request) throws JsonProcessingException {
        String hash = Integer.toHexString(request.hashCode());
        Optional<IdempotencyRecord> seen = keys.findById(key);
        if (seen.isPresent()) {
            if (!seen.get().requestHash.equals(hash)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "key reused with a different request");
            }
            return mapper.readValue(seen.get().responseJson, PaymentResult.class);   // repeat: same answer, no new debit
        }
        PaymentResult result = ledger.debit(request.accountId(), request.amount());  // same transaction as the key
        IdempotencyRecord record = new IdempotencyRecord();
        record.key = key;
        record.requestHash = hash;
        record.responseJson = mapper.writeValueAsString(result);
        keys.saveAndFlush(record);       // a concurrent duplicate fails here with DataIntegrityViolationException
        return result;
    }
}
```

Explain that the key row and the debit commit together, that the primary key is the unique constraint, that a repeat returns the saved response, that a different body with the same key is a client error, and that a concurrent duplicate is rejected by the constraint (map it to `409 Conflict` or a retry). Add a cleanup job for old keys.

### [coding] Move the HTTP session into Redis with Spring Session. {#coding-session}

```java
// dependency: spring-boot-starter-web, spring-session-data-redis, spring-boot-starter-data-redis
// application.properties
//   spring.session.timeout=30m
//   spring.data.redis.host=redis.internal

@RestController
class CartController {
    @PostMapping("/cart/items")
    void add(@RequestBody Item item, HttpSession session) {
        @SuppressWarnings("unchecked")
        List<Item> cart = (List<Item>) session.getAttribute("cart");
        if (cart == null) cart = new ArrayList<>();
        cart.add(item);
        session.setAttribute("cart", cart);     // stored in Redis, visible to every instance
    }
}
```

Explain that the controller code is unchanged, that Spring Session replaces the container's session store with Redis, that any instance can serve the next request, that the stored objects must be serialisable, and that the session expires after the timeout. If the session holds sensitive data, protect Redis with TLS and authentication.

### [coding] Rebuild an account balance from events. {#coding-events}

```java
sealed interface AccountEvent permits Opened, Deposited, Withdrawn {}
record Opened(String accountId) implements AccountEvent {}
record Deposited(BigDecimal amount) implements AccountEvent {}
record Withdrawn(BigDecimal amount) implements AccountEvent {}

class Account {
    private BigDecimal balance = BigDecimal.ZERO;
    private final List<AccountEvent> newEvents = new ArrayList<>();

    static Account replay(List<AccountEvent> history) {
        Account account = new Account();
        history.forEach(account::apply);            // state is the fold of the events
        return account;
    }

    void withdraw(BigDecimal amount) {
        if (balance.compareTo(amount) < 0) throw new IllegalStateException("insufficient funds");
        AccountEvent event = new Withdrawn(amount);
        apply(event);
        newEvents.add(event);                       // appended to the event store by the caller
    }

    private void apply(AccountEvent event) {
        switch (event) {
            case Opened e -> balance = BigDecimal.ZERO;
            case Deposited e -> balance = balance.add(e.amount());
            case Withdrawn e -> balance = balance.subtract(e.amount());
        }
    }
}
```

Explain that the command checks the rule and produces an event, that `apply` only changes state and never fails (so replay is safe), that the current balance is the fold of the history, and that the caller appends `newEvents` to the store with an expected version so two writers cannot both succeed.
