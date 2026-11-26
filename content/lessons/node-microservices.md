---
title: Microservices with Node.js — service design, resilient calls, messaging, outbox, sagas and operations
nav: Node.js microservices
slug: node-microservices
summary: Building microservices in Node.js, when Node fits and when a modular monolith is better, service anatomy with layers and a composition root and Express or Fastify or NestJS, pnpm workspaces and why shared libraries couple services, resilient HTTP calls with deadlines and retries with backoff and jitter and a circuit breaker, gRPC and service discovery through Kubernetes DNS, backend for frontend aggregation with partial results, messaging with Kafka and RabbitMQ and SQS and BullMQ and event envelopes and schema validation, idempotent consumers and dead-letter queues and ordering and backpressure, the transactional outbox with a relay, orchestrated sagas as state machines, data ownership and consistency, contracts and versioning and Pact, service-to-service security with mTLS and token propagation, correlation ids with AsyncLocalStorage and OpenTelemetry, testing and deployment and ownership, compared with Spring Cloud, with banking examples and interview questions.
tags: [Node.js, Microservices, Messaging, Kafka, Outbox, Saga, Resilience, Circuit breaker, Backend, Full stack]
order: 77
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

Microservice questions for Node.js roles check that you can build the *parts* of a distributed system in JavaScript, not only name the patterns. Expect questions like these:

- When is Node a good fit, and when should you keep a monolith?
- How is a service structured?
- How does it call another service that is slow or down?
- How do you combine several calls for one screen?
- How are events published reliably, and consumed safely?
- How is a transfer across several services kept consistent?
- How do services agree on contracts, and trust each other?
- How do you follow one request across them?

The architecture itself is in [microservice patterns](lesson:microservice-patterns#why), [communication](lesson:microservice-communication#kinds), [resilience](lesson:microservice-resilience#cascade), [state](lesson:microservice-state#data), [saga](lesson:saga#idea) and [messaging](lesson:messaging#why). Those lessons use Java and Spring. This lesson shows the same ideas in Node.js, with code that was run. The examples use a banking transfer. Play the four scenes: service shape, calling services, events and the outbox, and run-secure-observe.

```demo
name: node-micro-walk
```

> **One sentence to remember:** *Bound every remote call, make every message idempotent, and publish events through an outbox.*

Split by business capability only when it pays. Give each service its own data and a thin, versioned contract. Coordinate work across services with a saga whose state is saved. Carry a correlation id everywhere, so you can follow a request.

## When Node fits, and when it does not {#why}

| Node.js is a good fit for | Think twice for |
| --- | --- |
| I/O-bound services: APIs, gateways, BFFs, aggregators, webhooks | CPU-bound work on the main thread (risk scoring, big batch maths) |
| small, fast-starting services (good for autoscaling and serverless) | very large domains where a strongly typed ecosystem and mature libraries help most |
| teams that share TypeScript with the front end (types and schemas in a contracts package) | libraries that exist only on the JVM (some banking messaging and ISO 20022 tooling) |
| real-time features (WebSockets, server-sent events) | long, stateful, CPU-heavy computations ([performance](lesson:node-performance#cpu)) |

The bigger question is **whether to use microservices at all**.

- **What they give you:** independent deployment, independent scaling, and clear team ownership.
- **What they cost:** network failures, eventual consistency (data agrees only after a delay), many pipelines, and hard debugging.

Do the cheap things first. Start with a **modular monolith**: one deployable app, with module boundaries that are enforced ([modular monolith](lesson:monolith-to-microservices#modular)). Then extract a part that has a different scaling need, release rhythm or team. Do it step by step with the **strangler fig** approach: new code grows around the old until the old part can be removed ([strangler](lesson:monolith-to-microservices#strangler)).

A good outcome in a bank is often a handful of well-bounded services, not a hundred tiny ones. The rule for a boundary: **one business capability, one team, one data owner**.

## Anatomy of a Node service {#anatomy}

Build every service the same way, so people can move between them:

```
transfer-service/
  src/
    main.ts              composition root: load config, create dependencies, start, handle signals
    config.ts            validated environment (fail fast)
    http/                routes, validation, error mapping      (thin: no business rules)
    domain/              business rules, pure functions and services (no HTTP, no SQL)
    data/                repositories (SQL), outbox
    messaging/           producers, consumers, event schemas
    clients/             typed clients for other services (timeouts, retries, breaker)
  test/
  Dockerfile  package.json  pnpm-lock.yaml
```

- **Layers.** A route turns HTTP into a call on a **service**, which holds the business rules. The service uses **repositories and clients**. These are created in one place, the **composition root**, and passed in ([design for testability](lesson:node-testing#design)). The rules know nothing about Express, and SQL stays out of the routes.
- **Framework.** All three main choices work:
  - **Express** is familiar and minimal.
  - **Fastify** is faster, with schema validation and logging built in.
  - **NestJS** gives Spring-like structure for large teams: modules, dependency injection, decorators, and built-in microservice transports.

  Pick one for the organisation. Publish a **service template** (a "golden path") with health endpoints, graceful shutdown, logging, metrics, tracing and the Dockerfile already done. A new service then takes minutes, and behaves like the others ([service template](#ops)).
- **Every service** exposes `/health/live` and `/health/ready`, and handles SIGTERM gracefully. It reads validated configuration from the environment, logs JSON with a correlation id, and exports metrics ([deployment](lesson:node-deployment#process)).
- **Monorepo or polyrepo?**
  - A **pnpm workspace** (`pnpm-workspace.yaml`, with packages under `services/` and `packages/`), plus Turborepo or Nx, gives one place for tooling, refactors across services in one change, and shared CI caching.
  - Separate repositories give stronger ownership boundaries.

  Either is fine, as long as **each service builds, tests and deploys on its own**, and depends only on published or workspace **contracts**.
- **The shared library trap.** A `common` package with models, helpers and clients couples every service to every other. A change forces all of them to upgrade together, and you end up with a distributed monolith. Share only **small, versioned contract packages**: API schemas, event types and generated clients. Each service keeps its own business code, even if a little is duplicated.

## Calling other services {#sync}

A remote call is not a function call. It can be slow, fail, fail halfway, or happen twice. Every call needs four things ([timeouts](lesson:microservice-resilience#timeouts), [retries](lesson:microservice-resilience#retries), [breaker](lesson:microservice-resilience#breaker)):

1. A **deadline** (`AbortSignal.timeout(ms)`). Then a hung dependency cannot hold your request forever.
2. **Retries only when safe.**
   - Only for idempotent methods (GET, PUT, DELETE), or a POST with an idempotency key. *Idempotent* means doing it twice has the same effect as doing it once.
   - Only for temporary errors: 5xx, 429, timeouts and network errors.
   - With **exponential backoff and jitter** (growing, randomised waits), and a small limit.
3. A **circuit breaker**. After repeated failures it opens, and calls fail at once instead of piling up. Later it lets one trial call through, to test whether the dependency has recovered.
4. **Bounded concurrency** to that dependency: a cap on calls in flight, called a bulkhead (see [concurrency limits](lesson:node-performance#concurrency)).

Here is a small resilient client. I ran and tested it against a local server:

```javascript
export class CircuitOpenError extends Error {
  constructor() { super('circuit open'); this.name = 'CircuitOpenError'; }
}
export class HttpError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.name = 'HttpError'; this.status = status; }
}

export function createBreaker({ failureThreshold = 5, resetMs = 10_000, now = () => Date.now() } = {}) {
  let state = 'closed', failures = 0, openedAt = 0, trialInFlight = false;
  return {
    get state() { return state; },
    async exec(fn) {
      if (state === 'open') {
        if (now() - openedAt < resetMs) throw new CircuitOpenError();     // fail fast, no call is made
        state = 'half-open';
      }
      if (state === 'half-open') {
        if (trialInFlight) throw new CircuitOpenError();                   // only one trial call at a time
        trialInFlight = true;
      }
      try {
        const result = await fn();
        failures = 0; state = 'closed';
        return result;
      } catch (err) {
        failures += 1;
        if (state === 'half-open' || failures >= failureThreshold) { state = 'open'; openedAt = now(); }
        throw err;
      } finally {
        trialInFlight = false;
      }
    },
  };
}

const retryable = (err) => err instanceof HttpError
  ? err.status >= 500 || err.status === 429
  : err.name === 'TimeoutError' || err.name === 'TypeError';             // timeouts and network failures

export async function callJson(url, {
  method = 'GET', body, headers = {}, timeoutMs = 1000, retries = 2, baseDelayMs = 100, maxDelayMs = 2000,
  breaker, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random,
} = {}) {
  const safeToRetry = ['GET', 'PUT', 'DELETE'].includes(method) || 'idempotency-key' in headers;   // never retry a plain POST
  const attempts = safeToRetry ? retries + 1 : 1;

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await breaker.exec(async () => {
        const r = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),                         // a deadline on every call
        });
        if (r.status >= 500 || r.status === 429) throw new HttpError(r.status);   // counts as a failure for the breaker
        return r;
      });
      if (!res.ok) throw new HttpError(res.status);                       // 4xx: the caller's fault, no retry, breaker unaffected
      return await res.json();
    } catch (err) {
      if (err instanceof CircuitOpenError || !retryable(err) || attempt >= attempts) throw err;
      const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(random() * cap);                                        // exponential backoff with full jitter
    }
  }
}
```

I ran six tests against a local `http` server:

- A GET that returns 503 twice succeeds on the third attempt.
- A plain POST is **not** retried (one hit). A POST with an `idempotency-key` is retried.
- A 400 is not retried, and leaves the breaker closed.
- A slow call times out.
- The breaker opens after three failures. It then makes **no network call** until the reset time. After that, one trial call closes it again.
- With `random` fixed, the backoff delays are 100, 200 and 400 ms.

In production you can use libraries instead: `opossum` for breakers, `cockatiel` for retry, timeout and bulkhead policies, and `undici` or `got` for HTTP. But you should know what they do.

**Add jitter.** Without it, all clients retry at the same moment and create a **retry storm**. Also pass the **remaining deadline** downstream, so a chain of calls does not take longer than the user is willing to wait ([timeouts and deadlines](lesson:microservice-resilience#timeouts)).

More points for synchronous calls:

- **Service discovery** on Kubernetes is just DNS. Call `http://account-service.bank.svc.cluster.local`, or just `http://account-service` in the same namespace. The Service spreads calls across the pods ([discovery](lesson:microservice-communication#discovery), [Kubernetes services](lesson:kubernetes#services)). No Eureka is needed.
- **Keep-alive.** Reuse connections, as Node's `fetch` and `undici` do. Then each call does not pay for a new TCP and TLS handshake.
- **REST, gRPC or GraphQL** ([choices](lesson:microservice-communication#choices)):
  - REST with JSON is the default for public and simple internal APIs.
  - **gRPC** (`@grpc/grpc-js`, with `.proto` files and generated types) gives a strict contract, a compact binary format, streaming and built-in deadlines. It suits internal calls between services.
  - **GraphQL** (with federation) suits combining data for front ends.
- **Avoid long synchronous chains** (A calls B calls C calls D). Every link can fail, so availability drops, and the delays add up. Use **events** for work that does not need an answer now, and keep synchronous paths short.
- **Each timeout is shorter than its caller's.** If the front end waits 3 s, the gateway times out at 2.5 s, the service at 2 s, and its dependency calls at 1 s.

## Gateway and backend for frontend {#gateway}

A **gateway** (Kong, an ingress, an API Gateway) handles TLS, routing, authentication and rate limits for all APIs.

A **backend for frontend (BFF)** is a small service, owned by a front-end team, that shapes calls for one client. The screen makes one request, and the BFF fans it out to several services ([gateway and BFF](lesson:microservice-communication#gateway)). Node is a natural choice, because it is good at parallel I/O.

The key rules are a **shared deadline**, **parallel calls**, and **partial results** for data the page can live without:

```javascript
export async function loadDashboard(userId, { accounts, cards, offers }, { timeoutMs = 800 } = {}) {
  const signal = AbortSignal.timeout(timeoutMs);                         // one deadline shared by all calls
  const [acc, crd, off] = await Promise.allSettled([
    accounts.list(userId, { signal }),
    cards.list(userId, { signal }),
    offers.forUser(userId, { signal }),
  ]);

  if (acc.status === 'rejected') throw acc.reason;                       // accounts are essential: fail the page
  const degraded = [];
  const optional = (name, result, fallback) => {
    if (result.status === 'fulfilled') return result.value;
    degraded.push(name);                                                 // optional parts: show the page without them
    return fallback;
  };
  return { accounts: acc.value, cards: optional('cards', crd, []), offers: optional('offers', off, []), degraded };
}
```

My test results:

- `offers` threw, and `cards` was slower than the 100 ms deadline. The page came back with `cards: []`, `offers: []` and `degraded: ['cards', 'offers']`.
- When `accounts` failed, the whole call failed.

One trap I hit: `Promise.allSettled` **waits for every call**. So a callee that ignores the abort signal makes the whole page wait for it. My first test took 2 seconds instead of 0.1. `fetch` honours the signal, so pass it into every client call, and make sure each one aborts.

Keep BFFs **thin**: no business rules, only combining and shaping data. Cache data that changes slowly ([caching](lesson:node-performance#cache)).

## Messaging {#events}

Asynchronous messaging decouples services in time. The producer does not wait. The consumer may be down for a while. The broker absorbs spikes ([why messaging](lesson:messaging#why)). Choosing a broker:

| Broker | Model | Choose it for | Node libraries |
| --- | --- | --- | --- |
| **Kafka** | partitioned, replicated log, replay, consumer groups | event streams, high volume, ordering per key, replay and audit | `kafkajs`, `@confluentinc/kafka-javascript` |
| **RabbitMQ** | queues and exchanges, routing, acknowledgements | task queues, flexible routing, request-reply | `amqplib` |
| **AWS SQS and SNS** | managed queue and topic | simple managed queues on AWS, no servers | AWS SDK v3 |
| **NATS** | lightweight pub-sub and JetStream | low latency messaging between services | `nats` |
| **BullMQ (Redis)** | job queue inside one system | background jobs, delays, repeatable jobs, rate limits | `bullmq` |

### Messages and events

There are two kinds of message:

- A **command**, such as "DebitAccount", asks for something. It has one receiver, which may reject it.
- An **event**, such as "TransferCompleted", states a fact that has already happened. Any number of services may listen.

Wrap every message in the same **envelope**, and validate it with a schema at both ends:

```javascript
// contracts/events.ts: shared as a small versioned package
import { z } from 'zod';

export const TransferCompleted = z.object({
  id: z.string().uuid(),                  // unique message id: used for deduplication
  type: z.literal('TransferCompleted'),
  version: z.literal(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string(),
  data: z.object({ transferId: z.string(), from: z.string(), to: z.string(), amount: z.number().int().positive(), currency: z.string().length(3) }),
});
```

Rules ([message design](lesson:messaging#design), [schema evolution](lesson:microservice-communication#contracts)):

- Send **ids, not whole records**, when the consumer can fetch the details. Or include what consumers need, so they do not have to call back.
- Never include secrets.
- Add a **version**.
- Evolve by **adding optional fields**, and keep the old event type readable.

With Kafka, a **schema registry** (Avro or JSON Schema) enforces compatibility.

### Idempotent consumers

Brokers deliver **at least once**. A message can arrive twice after a retry, a rebalance, or a crash before the acknowledgement. "Exactly once" from end to end does not exist across systems. So make **processing idempotent** ([idempotency](lesson:microservice-state#idempotency)).

The reliable way is to record the message id **in the same transaction** as the business change:

```javascript
// An idempotent consumer: the "already processed" marker and the business change commit together
export function createConsumer({ store, handler, maxAttempts = 3, publishDlq, backoff = async () => {} }) {
  return async function onMessage(msg) {                    // msg: { id, type, payload }
    for (let attempt = 1; ; attempt++) {
      try {
        return await store.transaction(async (tx) => {
          if (!(await tx.markProcessed(msg.id))) return 'duplicate';     // INSERT ... ON CONFLICT DO NOTHING affected 0 rows
          await handler(msg, tx);                                         // business change in the same transaction
          return 'processed';
        });                                                               // a throw rolls both back
      } catch (err) {
        if (err.permanent || attempt >= maxAttempts) {
          await publishDlq({ ...msg, error: err.message, attempts: attempt });   // park it for people, then acknowledge
          return 'dead-lettered';
        }
        await backoff(attempt);                                           // transient failure: try again
      }
    }
  };
}
```

My test results:

- A message processed once changed the balance.
- A redelivery with the same id returned `'duplicate'`, and changed nothing.
- A handler that failed twice with a database timeout succeeded on the third attempt.
- A message with bad data (a **permanent** error) went to the dead-letter queue. Its processed marker was **rolled back**, so it can be replayed after a fix.

With SQL, `markProcessed` is `INSERT INTO processed_messages (id) VALUES ($1) ON CONFLICT DO NOTHING`, and it checks that one row was inserted.

More consumer rules:

- **Acknowledge after processing**, never before: commit the Kafka offset, `ack` in RabbitMQ, or delete in SQS. Acknowledging first means a crash loses the message.
- **Retries and the dead-letter queue.** Retry temporary errors with backoff, or use a delayed retry topic or queue, so one bad message does not block the rest. Send **poison messages**, which can never succeed, to a **dead-letter queue** with the error. Alert on it, and provide a way to replay ([reliability](lesson:messaging#reliability)).
- **Ordering.** Kafka keeps order only **within a partition**. So use the **entity id as the key** (`accountId`), and all events for one account stay in order. Several consumers in a **consumer group** share the partitions. Do not depend on a global order.
- **Concurrency and backpressure.** Process messages with **bounded concurrency**: in `kafkajs`, `partitionsConsumedConcurrently` and `eachBatch`, or a limiter around the handler. When downstream is slow, **pause** the consumer (`consumer.pause`), instead of loading unlimited messages into memory ([streams backpressure](lesson:node-streams#backpressure)).
- **Graceful shutdown.** On SIGTERM, stop fetching, finish the messages in progress, commit offsets, then disconnect ([graceful shutdown](lesson:node-runtime#shutdown)).
- **Duplicate side effects.** An email or payment instruction sent by the handler is outside the database transaction. So give that external call an **idempotency key** made from the message id.

## The transactional outbox {#outbox}

The **dual-write problem**: saving to the database and publishing to the broker are two separate operations. If the process crashes between them, the transfer exists, but the event is never sent. Nothing remembers that it was owed. Reversing the order loses the data instead.

The fix is the **transactional outbox** ([publishing events](lesson:event-sourcing-cqrs#publishing)):

1. In **one database transaction**, write the business row **and** a row in an `outbox` table that describes the event.
2. A separate **relay** reads unpublished rows, publishes them to the broker, and marks them published. Or a **CDC** (change data capture) tool, such as Debezium, reads the database log and publishes the outbox table to Kafka, with no polling code.
3. A crash after publishing, but before marking, sends the event again. So delivery is **at least once**, and consumers must be idempotent (above).

```javascript
// In the use case: one transaction for the data and the event
await db.transaction(async (tx) => {
  await tx.query('INSERT INTO transfers (id, from_acct, to_acct, amount, status) VALUES ($1,$2,$3,$4,$5)', [id, from, to, amount, 'POSTED']);
  await tx.query('INSERT INTO outbox (topic, key, payload) VALUES ($1,$2,$3)', ['transfers', from, JSON.stringify(event)]);
});

// The relay
export async function relayOnce({ db, publish, batchSize = 100 }) {
  return db.transaction(async (tx) => {
    const rows = await tx.query(
      `SELECT id, topic, key, payload FROM outbox
        WHERE published_at IS NULL ORDER BY id LIMIT $1
        FOR UPDATE SKIP LOCKED`,                                          // several relays can run without taking the same rows
      [batchSize],
    );
    for (const row of rows) {
      await publish(row.topic, { key: row.key, value: row.payload, headers: { 'event-id': String(row.id) } });
      await tx.query('UPDATE outbox SET published_at = now() WHERE id = $1', [row.id]);
    }
    return rows.length;
  });
}
```

I tested `relayOnce` against an in-memory fake database, not a real PostgreSQL:

- It publishes and marks rows.
- The second run publishes nothing.
- When `publish` throws halfway, the marks are rolled back, so all the rows are retried. That is the at-least-once behaviour.

In practice:

- Run the relay on a short timer, or with `LISTEN/NOTIFY`.
- Delete or archive old rows.
- Key events by the aggregate id, to keep order per entity.
- Send the outbox row id as the event id. Consumers use it to remove duplicates.

The mirror image for incoming messages is the **inbox**: the processed-messages table above.

## Sagas {#saga}

A business operation across several services cannot use one database transaction. Two-phase commit is rarely available, or wise, across independent services.

A **saga** is a sequence of **local transactions**. Each one publishes an event or command for the next. If a later step fails, **compensating actions** undo the earlier steps ([saga idea](lesson:saga#idea), [compensation](lesson:saga#compensation)). There are two styles ([coordination](lesson:saga#coordination)):

- **Choreography**: services react to each other's events. It is simple, but the flow is hard to see.
- **Orchestration**: one coordinator holds the state and sends commands. It is easier to follow and test, and it is the usual choice for money flows.

Here is a transfer between two accounts held by different services, as a **state machine whose state is saved**. The orchestrator is a pure function. It takes the current state and a reply, and returns the next state and the commands to send:

```javascript
const TABLE = {
  STARTED:      { DebitOk: ['DEBITED', 'CreditAccount'],        DebitFailed: ['FAILED'] },
  DEBITED:      { CreditOk: ['COMPLETED', 'SendNotification'],  CreditFailed: ['COMPENSATING', 'RefundDebit'] },
  COMPENSATING: { RefundOk: ['FAILED'],                         RefundFailed: ['MANUAL_REVIEW'] },
};
const FINAL = new Set(['COMPLETED', 'FAILED', 'MANUAL_REVIEW']);

export function startSaga(id, request) {
  return { saga: { id, state: 'STARTED', request, seen: [] }, commands: [{ type: 'DebitAccount', sagaId: id }] };
}

export function handleReply(saga, reply) {
  if (reply.id && saga.seen.includes(reply.id)) return { saga, commands: [] };        // duplicate reply: ignore
  if (FINAL.has(saga.state)) return { saga, commands: [] };                           // late reply after the end: ignore
  const rule = TABLE[saga.state]?.[reply.type];
  if (!rule) throw new Error(`unexpected ${reply.type} in ${saga.state}`);            // a bug or a corrupt message: stop and look
  const [state, command] = rule;
  return {
    saga: { ...saga, state, seen: [...saga.seen, reply.id].filter(Boolean) },
    commands: command ? [{ type: command, sagaId: saga.id }] : [],
  };
}
```

I tested:

- the happy path: `STARTED` to `DEBITED` to `COMPLETED`, with the right commands;
- the compensation path: `CreditFailed` leads to `RefundDebit`, and ends in `FAILED`;
- a duplicate reply, which is ignored;
- a late reply after the end, which is ignored;
- an impossible reply, which throws.

In a real service, each reply handler does this in one transaction: load the saga row, call `handleReply`, save the new state, and write the commands to the **outbox**. Use optimistic locking (a version column), so parallel replies cannot corrupt the row.

Also:

- Add **timeouts**: a saga stuck in `DEBITED` for too long is escalated.
- Make every command **idempotent**, and every compensation safe to repeat.
- Send unsolvable cases to **manual review**, which a bank must support.
- For complex workflows, consider a **workflow engine** instead of hand-written state machines: Temporal has a TypeScript SDK, or use AWS Step Functions.

## Data ownership and consistency {#data}

- **One service, one database (or schema), one owner.** Other services read the data only through the owner's API, or through its events ([data ownership](lesson:microservice-state#data)). A shared database is a hidden coupling.
- **Joins across services do not exist.** Use **API composition**: the BFF calls both services and merges the results. Or use a **read model** built from events (CQRS): a service keeps its own copy of the data it needs, updated by events, and accepts that it may lag a moment.
- **Eventual consistency is normal.** After a transfer, the balance in the reporting service updates a moment later. Design the user interface and the API around it, for example with status `PENDING`, then `POSTED`.
- **Copies of reference data**, such as account holder names and currencies, stay small and are updated by events. The owner remains the source of truth.
- **Idempotency keys** go on every command that moves money, kept per client and operation. A retry then returns the first result.
- **Transactions are local.** Do not try to fake distributed ACID transactions. Use the outbox, sagas and compensation.
- **Caches** are per service, and must tolerate stale data ([Redis caching](lesson:redis-caching#patterns)).

## Contracts and versioning {#contracts}

Services change independently, so the **contract** between them is the real interface ([contracts](lesson:microservice-communication#contracts)):

- **Describe the contracts.** Use **OpenAPI** (or gRPC `.proto`) for synchronous APIs, and **AsyncAPI** or JSON Schema for events. Keep them in a contracts package that both sides use. Generate types and clients from them, so the compiler catches drift. **Validate at runtime too** (zod, ajv), because types disappear after compilation.
- **Know which changes are safe.**
  - **Backward compatible**, so safe: add an optional field, a new endpoint, or a new event type.
  - **Breaking**: remove or rename a field, change a type or meaning, or make an optional field required.

  For a break, version the API (`/v2`) or the event (`version: 2`). Run both, move the consumers over, then retire the old one.
- **Be liberal in what you accept**. This is the **tolerant reader**: read only the fields you need, and ignore unknown ones.
- **Consumer-driven contract tests** (**Pact**). Each consumer records what it needs. The provider checks those contracts in its own pipeline, so a breaking change is caught before deployment ([contract tests](lesson:node-testing#contract)).
- **Expand and contract** for data and message changes, as with schema migrations: add the new form, move everyone over, then remove the old ([database changes during a release](lesson:deployment-strategies#database)).
- Publish **deprecation dates**, and monitor which consumers still call old versions.

## Security between services {#security}

- **Do not trust the internal network.** Authenticate every call.
  - **mTLS** (mutual TLS, both sides present certificates), often through a service mesh such as Istio or Linkerd, proves which service is calling, and encrypts the traffic.
  - Or use **signed tokens** from the identity provider, with the client credentials flow ([OAuth 2.0](lesson:oauth2#tokens)).
- **Pass the user's identity along**, separately from the service's identity. Forward the user's token, or the result of a **token exchange** with a narrower audience. Then the downstream service can authorise on behalf of the user, not just know that "some service called me".
- **Authorise in every service**, with ownership checks on each object ([security](lesson:node-security#data)), not only at the gateway.
- **Network policies** restrict which pods may talk to which, with deny by default. Keep secrets in a manager and rotate them. Give each service its own credentials and a least-privilege database user ([secrets](lesson:node-deployment#config)).
- **Validate everything that crosses a boundary**, including messages from the broker and responses from other services.
- **Audit** money movements, with the correlation id and the chain of identities.

## Observability across services {#observe}

When one transfer touches five services, logs in one place are not enough. You need these ([observability](lesson:microservice-patterns#operations)):

- A **correlation id**, created at the edge or taken from the incoming header. Pass it on **every outbound HTTP call and message**. Inside a service, **AsyncLocalStorage** carries it through the async code. Every log line then includes it, without passing it through every function ([context and logging](lesson:node-express-middleware#context)):

```javascript
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();
const log = (service, msg) => console.log(JSON.stringify({ service, correlationId: als.getStore()?.correlationId, msg }));

// middleware: take the id from the header or create one, and run the rest of the request inside the context
const withContext = (handler) => (req, res) =>
  als.run({ correlationId: req.headers['x-correlation-id'] ?? crypto.randomUUID() }, () => handler(req, res));

// an outbound call: always forward it
await fetch(urlB, { headers: { 'x-correlation-id': als.getStore().correlationId } });
```

  I ran two real HTTP servers, with A calling B, and the incoming header `req-42`. The logs were `A req-42 received`, `B req-42 handling` and `A req-42 B said b-ok`. One id followed the request across both. Put the same id in message headers, and in the event envelope.
- **Distributed tracing.** **OpenTelemetry** (`@opentelemetry/sdk-node` with auto-instrumentation, started with `node --import ./otel.js app.js`) creates spans for incoming requests, outgoing HTTP calls, database queries and Kafka messages. It passes on the W3C **`traceparent`** header. A tracing backend (Jaeger, Tempo, X-Ray) then shows the whole path, and where the time went. Put trace ids in the logs.
- **Metrics per service and per dependency**: request rate, errors and p99 duration (RED), event loop lag, consumer lag, outbox backlog, breaker state, dead-letter queue depth, and the number of stuck sagas ([performance](lesson:node-performance#production)).
- **Alert on symptoms**: error rate, latency, growing consumer lag, a dead-letter queue that is not empty. Also alert on business rules, such as money in equals money out.

## Testing microservices {#testing}

Keep most tests inside each service, and use contracts at the edges ([testing Node services](lesson:node-testing#why)):

- **Unit tests** for the domain, with fakes and a fixed clock. Include the saga state machine and the idempotent consumer. Pure functions and in-memory fakes make these fast.
- **Component tests** of one service with its real database (Testcontainers), stubs for other services (MSW, nock, or a contract stub), and a fake broker.
- **Contract tests** (Pact) for each integration, run in both pipelines.
- **Resilience tests.** Inject failures and delays: in the client tests, as with the flaky server above, and in staging, with chaos experiments. They check timeouts, retries, breakers and fallbacks ([testing resilience](lesson:microservice-resilience#testing)).
- **A few end-to-end tests** of critical journeys against an integrated environment, plus **synthetic checks** in production. Avoid a large end-to-end suite, which is slow and flaky.

## Deployment and ownership {#ops}

- **One image and one pipeline per service**, built from a service template. Each service deploys on its own, with rolling or canary releases ([deployment](lesson:node-deployment#kubernetes), [pipeline](lesson:node-deployment#cicd)). Tag images by commit, and promote the same image through the environments.
- **Backward compatibility during rollouts.** Old and new versions run side by side, so use expand and contract, and compatible contracts.
- **Scale each service on its own signal.** Run at least two or three pods across zones, with a PodDisruptionBudget and graceful shutdown. Consumers scale by partitions or queue length (KEDA).
- **Ownership.** One team owns a service end to end: the pager, dashboards, runbooks, SLOs and its contract. A catalogue such as Backstage lists owners and dependencies.
- **Platform support.** Provide the service template, a shared pipeline, the observability stack, and a mesh or gateway. Then teams do not each solve the same problems (the "paved road").
- **Feature flags** separate deployment from release. A rollback is as simple as deploying the previous image.
- **The cost of the architecture.** Count how many services you can really operate. If a small team runs thirty services, reduce them.

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| microservices from day one for a small team | a modular monolith first, extract when needed |
| a shared `common` library with models and clients | small versioned contract packages only |
| several services using one database | database per service, access through APIs and events |
| remote calls with no timeout | `AbortSignal.timeout` on every call, deadlines shorter than the caller's |
| retrying everything, with no backoff or jitter | retry idempotent calls only, exponential backoff with jitter, a retry limit |
| retrying a POST without an idempotency key | add the key, or do not retry |
| no circuit breaker or bulkhead | a breaker and bounded concurrency per dependency |
| long synchronous call chains | events for work that need not be answered now, shorten the chain |
| save, then publish (dual write) | the transactional outbox or CDC |
| non-idempotent consumers | record the message id in the same transaction |
| acknowledging before processing | acknowledge after, with retries and a dead-letter queue |
| relying on global message ordering | key by entity id, order within a partition |
| unbounded consumer concurrency, no backpressure | limits, `pause` and `resume` |
| distributed transactions simulated with retries | a saga with compensations and manual review |
| renaming or removing fields in one release | additive changes, versions, expand and contract |
| trusting calls because they are inside the network | mTLS or tokens, authorise in every service |
| no correlation id or trace propagation | AsyncLocalStorage, headers, OpenTelemetry |
| `Promise.allSettled` over calls that ignore the abort signal | pass the signal into every call |
| many tiny services and nobody who owns them | fewer, well-bounded services with clear owners |

## For a Java developer {#java}

| Spring Cloud and the JVM | Node.js |
| --- | --- |
| Eureka, Consul discovery | Kubernetes DNS and Services |
| Feign, `RestClient`, `WebClient` | `fetch`, `undici`, generated OpenAPI clients, `got` |
| Resilience4j (`@CircuitBreaker`, `@Retry`, `@Bulkhead`, `@TimeLimiter`) | `opossum`, `cockatiel`, `p-limit`, `AbortSignal.timeout` |
| Spring Cloud Gateway | Kong, an ingress, or a small Express or Fastify gateway, a BFF in Node |
| Spring Cloud Config, Vault | ConfigMaps, environment variables, a secret manager |
| Spring Cloud Stream, Spring Kafka (`@KafkaListener`) | `kafkajs`, `amqplib`, AWS SDK, NestJS microservices transports |
| `@Transactional` and the transactional outbox with Spring | explicit transactions with `pg`, an outbox table and a relay, Debezium |
| Spring State Machine, Axon, Camunda | a hand-written state machine, Temporal, Step Functions |
| Sleuth and Micrometer Tracing | OpenTelemetry for Node, `AsyncLocalStorage` for context |
| `MDC` logging context | `AsyncLocalStorage` plus a pino child logger |
| Spring Cloud Contract, Pact JVM | Pact JS |
| one JVM with many threads handling a slow call | one event loop, so a slow synchronous call blocks the whole process |
| thread pools as bulkheads | concurrency limiters per dependency |
| Spring Boot starter and parent POM as the paved road | a service template repository and shared CI configuration |

Try it in the lab: [A Node service calling another service safely](lab:node-service-calls).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| when | modular monolith first, split by capability, one team, one data owner |
| Node fit | I/O-bound services, BFFs, gateways, fast start. Keep CPU work off the loop |
| anatomy | thin routes, a domain layer, repositories and clients, composition root, health, graceful shutdown |
| shared code | contract packages only, never a common business library |
| calls | deadline, retry only when safe with backoff and jitter, breaker, bulkhead, keep-alive |
| discovery | Kubernetes DNS and Services |
| BFF | parallel calls, shared deadline, `allSettled`, partial results, pass the abort signal |
| messaging | commands versus events, envelope with id, version and correlation id, validate with a schema |
| consumers | idempotent (message id in the same transaction), ack after processing, retries, DLQ, key by entity |
| outbox | business row and outbox row in one transaction, a relay with `SKIP LOCKED`, at-least-once |
| saga | orchestrated persisted state machine, idempotent commands, compensations, timeouts, manual review |
| data | database per service, composition or read models, eventual consistency, idempotency keys |
| contracts | OpenAPI and AsyncAPI, additive changes, tolerant reader, Pact, expand and contract |
| security | mTLS or tokens, propagate identity, authorise everywhere, network policies |
| observability | correlation id with AsyncLocalStorage, OpenTelemetry traceparent, RED metrics, consumer lag, DLQ depth |
| testing | unit with fakes, component with Testcontainers, contracts, few end-to-end |
| operations | one image and pipeline per service, service template, ownership and on-call |

## Interview questions {#questions}

### [basic] When would you choose microservices, and when would you keep a modular monolith? {#when-q}

Keep a modular monolith by default, and extract a service only when a part clearly needs independence.

Choose microservices when:

- parts of the system have different scaling needs, release rhythms or teams;
- the boundaries are clear enough to give each service its own data and contract;
- the organisation can operate many services: pipelines, observability and on-call.

Keep a modular monolith when the team is small, the domain is still changing, or the boundaries are unclear. Network failures, eventual consistency and distributed debugging are a heavy price. A good path: a modular monolith first, then extract the module that needs independence.

### [basic] Why does each microservice own its database? {#db-per-service-q}

So that each service can change its schema and deploy on its own.

With a shared database, one team's change can break another without warning. Transactions hide the coupling, and no team really owns the data.

With private databases, other services use the owner's API or consume its events. Joins across services are replaced by API composition or read models. The cost is eventual consistency.

### [basic] When do you use synchronous calls and when asynchronous messaging? {#sync-async-q}

Use a synchronous call (REST or gRPC) when the caller needs the answer now to continue. An example is checking a balance before showing it. Keep those chains short, with timeouts and breakers.

Use asynchronous messaging for:

- work that does not need an immediate answer;
- telling other services about facts (events);
- absorbing spikes;
- workflows that can complete later.

Messaging decouples availability and timing. But it adds eventual consistency, duplicate messages, and the need for idempotency.

### [basic] What must every remote call have, and why? {#remote-call-q}

Every remote call needs:

- **A timeout (deadline).** Otherwise a hung dependency holds your request and resources indefinitely.
- **Retries only when safe**: idempotent operations and temporary errors, with exponential backoff and jitter. Uncontrolled retries make an outage worse.
- **A circuit breaker**, so calls fail fast when a dependency is down.
- **Bounded concurrency**, so one slow dependency cannot use up all your capacity.

Also pass a correlation id and the remaining deadline downstream.

### [basic] What is an idempotent consumer and how do you implement it? {#idempotent-q}

It is a consumer that gives the same result when the same message arrives more than once. At-least-once delivery makes that unavoidable.

To implement it, store the message id in a processed-messages table, in the same database transaction as the business change. Use a unique constraint (`INSERT ... ON CONFLICT DO NOTHING`). If the insert affects no row, the message is a duplicate: acknowledge it and skip it.

External side effects, such as emails, get an idempotency key made from the message id.

### [intermediate] What is the dual-write problem and how does the outbox solve it? {#outbox-q}

Writing to the database and publishing to the broker are two operations that cannot be made atomic. A crash between them leaves data without an event, or an event without data.

The outbox writes the business row and an event row in one local transaction. A relay, or a CDC tool such as Debezium, then publishes the outbox rows and marks them.

If the relay crashes after publishing, the event goes out twice. So delivery is at least once, and consumers must be idempotent.

### [intermediate] Is exactly-once delivery possible? {#exactly-once-q}

Not from end to end across independent systems.

A broker can offer exactly-once inside its own boundary, such as Kafka transactions and idempotent producers between topics. But a consumer that updates a database or calls another system can still crash between the effect and the acknowledgement.

The practical answer: at-least-once delivery plus idempotent processing. Together they give exactly-once *effects*.

### [intermediate] How do you keep message order in Kafka, and what are the limits? {#ordering-q}

Kafka keeps order only within a partition. So set the message key to the entity id, such as the account id. All events for that account then go to one partition, in order, and one consumer in the group reads them at a time.

The limits:

- There is no order across partitions, so do not depend on a global order.
- Handlers should tolerate out-of-order data across entities, using version numbers or timestamps.
- Keep processing within a partition sequential, even if you process partitions in parallel.
- Retries and a dead-letter topic can break the order for the retried message. Decide whether that matters.

### [intermediate] How would you implement a transfer between two accounts held by different services? {#transfer-q}

As an orchestrated saga:

1. A transfer service saves the saga state, and sends a debit command (through the outbox) to the source account service.
2. On success, it sends a credit command to the target service, then a notification.
3. If the credit fails, it sends a compensating refund, and ends in a failed state.
4. Cases that cannot be compensated go to manual review.

Supporting rules:

- every command is idempotent, through an idempotency key;
- duplicate replies are dropped, and late replies ignored;
- every step has a timeout;
- state changes and outgoing commands are written in one transaction;
- the user sees a pending status, which becomes posted or failed.

### [intermediate] What is a backend for frontend and how do you write one in Node.js? {#bff-q}

A BFF is a small service, owned by a front-end team. It combines calls to several services into the response one screen needs.

In Node:

- call the services in parallel with `Promise.allSettled`, under one shared deadline (an `AbortSignal`);
- fail the request only when an essential call fails;
- return a partial result with the failed optional parts marked. Then a slow offers service does not break the page.

Keep it free of business rules. Make sure every client call honours the abort signal. Cache data that changes slowly.

### [intermediate] Why is a shared library of models and clients between services a problem? {#shared-lib-q}

It couples the services. Any change forces all of them to upgrade together, so their releases lock together. Teams can no longer change independently, and you get a distributed monolith.

Share only small, versioned contract packages: API schemas, event types and generated clients. Keep business logic inside each service, and accept a little duplication. Consumers should be tolerant readers that ignore fields they do not use.

### [intermediate] How do you evolve an API or an event without breaking consumers? {#evolution-q}

Make only backward compatible changes: add optional fields, new endpoints or new event types. Never remove or rename a field, or change its meaning in place. Consumers read only what they need, and ignore unknown fields.

For a real break, publish a new version (`/v2` or `version: 2`). Run both, move the consumers, then retire the old one.

Use consumer-driven contract tests (Pact), and a schema registry compatibility check, so breaks are caught in the pipeline.

### [intermediate] How do you trace one request across several Node.js services? {#tracing-q}

Use a correlation id for logs, and OpenTelemetry for traces.

- Create the correlation id at the edge, or accept the incoming one.
- Keep it in AsyncLocalStorage inside each service, so every log line includes it.
- Forward it on every outbound HTTP call and message.

For distributed tracing, OpenTelemetry's Node auto-instrumentation creates spans for HTTP, database and Kafka operations. It passes on the W3C traceparent header, so a backend such as Jaeger shows the full path and the timings. Put the trace id in the logs, to jump between logs and traces.

### [deep] A consumer keeps failing on one message and the queue is blocked. What do you do? {#poison-q}

That is a poison message. Do not retry it forever.

1. Retry temporary errors a few times, with backoff.
2. Treat failures that will always repeat, such as bad data or a schema violation, as permanent.
3. Publish the message, with the error details, to a dead-letter queue. Then acknowledge it, so the rest of the partition continues.
4. Alert on the dead-letter queue. Investigate, fix the code or the data, and replay the messages. The idempotent consumer makes replays safe.

To avoid one message blocking the others, use retry topics or queues with delays. Validate messages against the schema when they arrive.

### [deep] Design a notification service that sends an email when a transfer completes, without duplicates or lost messages. {#notification-q}

Combine an outbox on the producer side with an idempotent consumer:

- **Producer.** The transfer service writes a TransferCompleted event to its outbox, in the same transaction as the transfer. A relay publishes it to Kafka, keyed by account.
- **Consumer.** The notification service reads the topic in a consumer group. It records the event id in a processed table, in the same transaction as its own state.
- **Email.** It sends the email with an idempotency key made from the event id, so a redelivery does not send a second email.
- **Failures.** Temporary provider failures are retried with backoff. Permanent ones go to a dead-letter queue. Offsets are committed after processing.
- **Monitoring.** Metrics track consumer lag, retries and dead-letter queue depth.

Delivery is at least once, with effectively-once results.

### [deep] You are extracting a service from a Node.js monolith. How do you proceed? {#extract-q}

1. **Make the module boundary explicit first**: its own folder, its own tables, and an interface the other modules call.
2. **Add the platform pieces**: the template, pipeline, health checks and observability.
3. **Use the strangler approach.** Put a routing layer in front. Build the new service behind the same contract. Move traffic gradually, first as shadow traffic, then by percentage. Keep the monolith as a fallback.
4. **Split the data last, and carefully.** Avoid dual writes by using the outbox or CDC. The new service becomes the owner, and the old tables become read-only, then are removed.

Measure latency and errors throughout the move.

### [coding] Implement `callJson(url, options)`: a timeout on every call, retries with exponential backoff and jitter only for safe requests, and a circuit breaker that opens after repeated failures and recovers through a half-open trial. {#coding-client}

```javascript
export class CircuitOpenError extends Error {
  constructor() { super('circuit open'); this.name = 'CircuitOpenError'; }
}
export class HttpError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.name = 'HttpError'; this.status = status; }
}

export function createBreaker({ failureThreshold = 5, resetMs = 10_000, now = () => Date.now() } = {}) {
  let state = 'closed', failures = 0, openedAt = 0, trialInFlight = false;
  return {
    get state() { return state; },
    async exec(fn) {
      if (state === 'open') {
        if (now() - openedAt < resetMs) throw new CircuitOpenError();
        state = 'half-open';
      }
      if (state === 'half-open') {
        if (trialInFlight) throw new CircuitOpenError();
        trialInFlight = true;
      }
      try {
        const result = await fn();
        failures = 0; state = 'closed';
        return result;
      } catch (err) {
        failures += 1;
        if (state === 'half-open' || failures >= failureThreshold) { state = 'open'; openedAt = now(); }
        throw err;
      } finally {
        trialInFlight = false;
      }
    },
  };
}

const retryable = (err) => err instanceof HttpError
  ? err.status >= 500 || err.status === 429
  : err.name === 'TimeoutError' || err.name === 'TypeError';

export async function callJson(url, {
  method = 'GET', body, headers = {}, timeoutMs = 1000, retries = 2, baseDelayMs = 100, maxDelayMs = 2000,
  breaker, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random,
} = {}) {
  const safeToRetry = ['GET', 'PUT', 'DELETE'].includes(method) || 'idempotency-key' in headers;
  const attempts = safeToRetry ? retries + 1 : 1;

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await breaker.exec(async () => {
        const r = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (r.status >= 500 || r.status === 429) throw new HttpError(r.status);
        return r;
      });
      if (!res.ok) throw new HttpError(res.status);
      return await res.json();
    } catch (err) {
      if (err instanceof CircuitOpenError || !retryable(err) || attempt >= attempts) throw err;
      const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(random() * cap);
    }
  }
}
```

Explain these points:

- Each attempt runs inside the breaker, with its own deadline from `AbortSignal.timeout`.
- Only server errors, 429, timeouts and network failures count as breaker failures, and only they are retried. A 4xx is the caller's mistake, and affects neither.
- A plain POST is never retried. A POST with an idempotency key is.
- The delay doubles up to a cap, and is multiplied by a random number (full jitter), so clients do not retry in step.
- When the breaker is open, it throws at once, without a network call. After `resetMs` it lets one trial through: it closes on success, and reopens on failure.
- The `sleep`, `random` and `now` parameters make it testable.
- My tests covered retry on 503, the POST rule, 4xx handling, the timeout, opening and recovery, and the delays 100, 200 and 400 ms.

### [coding] Write an idempotent message consumer: skip duplicates by message id in the same transaction as the business change, retry transient failures, and send permanent failures to a dead-letter queue. {#coding-consumer}

```javascript
export function createConsumer({ store, handler, maxAttempts = 3, publishDlq, backoff = async () => {} }) {
  return async function onMessage(msg) {                    // msg: { id, type, payload }
    for (let attempt = 1; ; attempt++) {
      try {
        return await store.transaction(async (tx) => {
          if (!(await tx.markProcessed(msg.id))) return 'duplicate';     // unique constraint: already handled
          await handler(msg, tx);                                         // the business change, same transaction
          return 'processed';
        });
      } catch (err) {
        if (err.permanent || attempt >= maxAttempts) {
          await publishDlq({ ...msg, error: err.message, attempts: attempt });
          return 'dead-lettered';                                         // then acknowledge so the queue moves on
        }
        await backoff(attempt);
      }
    }
  };
}

// SQL behind markProcessed:
//   INSERT INTO processed_messages (id) VALUES ($1) ON CONFLICT DO NOTHING   -- rowCount 1 = new, 0 = duplicate
```

Explain these points:

- The marker and the handler's changes commit or roll back together. So a crash can neither lose the change nor apply it twice.
- A redelivered message hits the unique constraint and returns `'duplicate'`, which the broker integration acknowledges.
- A thrown error rolls back both the marker and the change, so a retry starts clean.
- Errors marked `permanent` (bad data), and errors that last for `maxAttempts` attempts, go to the dead-letter queue with the error and the attempt count. Then the message is acknowledged.
- Because the marker was rolled back, the message can be replayed from the dead-letter queue after a fix.
- In my test, the first message was processed, and the same id returned `'duplicate'`. A handler that failed twice succeeded on the third attempt. A poison message was dead-lettered without leaving a processed marker.

### [coding] Write `loadDashboard(userId, services)` for a BFF: call accounts, cards and offers in parallel under one deadline, fail only if accounts fail, and return `degraded` names for the optional ones that failed or were too slow. {#coding-bff}

```javascript
export async function loadDashboard(userId, { accounts, cards, offers }, { timeoutMs = 800 } = {}) {
  const signal = AbortSignal.timeout(timeoutMs);                    // one deadline shared by all calls
  const [acc, crd, off] = await Promise.allSettled([
    accounts.list(userId, { signal }),
    cards.list(userId, { signal }),
    offers.forUser(userId, { signal }),
  ]);

  if (acc.status === 'rejected') throw acc.reason;                  // essential: fail the page

  const degraded = [];
  const optional = (name, result, fallback) => {
    if (result.status === 'fulfilled') return result.value;
    degraded.push(name);                                            // optional: show the page without it
    return fallback;
  };

  return {
    accounts: acc.value,
    cards: optional('cards', crd, []),
    offers: optional('offers', off, []),
    degraded,
  };
}
```

Explain these points:

- `Promise.allSettled` never rejects, so every outcome is inspected.
- The three calls run in parallel. The total time is the slowest call, bounded by the shared deadline.
- An essential failure is thrown again. Optional failures are replaced by an empty fallback, and listed in `degraded`. The front end can then show "offers unavailable", and monitoring can count degraded responses.
- The services must pass the `signal` to `fetch`, or to their client, so a slow call really aborts. In my first test, a fake service ignored the signal, and `allSettled` waited 2 seconds. With abort-aware fakes, the degraded page came back after about 0.1 seconds.
- All results were checked with `node:test`: everything succeeding; `cards` too slow and `offers` failing, giving `degraded: ['cards', 'offers']`; and `accounts` failing, where the whole call rejects.
