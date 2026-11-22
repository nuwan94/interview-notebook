---
title: Microservices with Node.js — service design, resilient calls, messaging, outbox, sagas and operations
nav: Node.js microservices
slug: node-microservices
summary: Building microservices in Node.js, when Node fits and when a modular monolith is better, service anatomy with layers and a composition root and Express or Fastify or NestJS, pnpm workspaces and why shared libraries couple services, resilient HTTP calls with deadlines and retries with backoff and jitter and a circuit breaker, gRPC and service discovery through Kubernetes DNS, backend for frontend aggregation with partial results, messaging with Kafka and RabbitMQ and SQS and BullMQ and event envelopes and schema validation, idempotent consumers and dead-letter queues and ordering and backpressure, the transactional outbox with a relay, orchestrated sagas as state machines, data ownership and consistency, contracts and versioning and Pact, service-to-service security with mTLS and token propagation, correlation ids with AsyncLocalStorage and OpenTelemetry, testing and deployment and ownership, compared with Spring Cloud, with banking examples and interview questions.
tags: [Node.js, Microservices, Messaging, Kafka, Outbox, Saga, Resilience, Circuit breaker, Backend, Full stack]
order: 77
topic: Full stack / Node.js
updated: 2026-11-20
subnav: true
---

Microservice questions for Node.js roles check that you can build the *parts* of a distributed system in JavaScript, not only name the patterns. They ask *when Node is a good fit and when to keep a monolith, how a service is structured, how it calls another service when that service is slow or down, how you aggregate several calls for one screen, how events are published reliably and consumed safely, how a multi-service transfer is kept consistent, how services agree on contracts, how they trust each other, and how you follow one request across them.* The architecture itself is in [microservice patterns](lesson:microservice-patterns#why), [communication](lesson:microservice-communication#kinds), [resilience](lesson:microservice-resilience#cascade), [state](lesson:microservice-state#data), [saga](lesson:saga#idea) and [messaging](lesson:messaging#why), which use Java and Spring. This lesson shows the same ideas in Node.js, with code that was run. Examples use a banking transfer. Play the four scenes: service shape, calling services, events and the outbox, and run-secure-observe.

```demo
name: node-micro-walk
```

> **One sentence to remember:** *Split by business capability only when it pays, give each service its own data and a thin versioned contract, make every remote call bounded and every message idempotent, publish events through an outbox in the same transaction as the data, coordinate multi-service work with a persisted saga, and carry a correlation id everywhere.*

## When Node fits, and when it does not {#why}

| Node.js is a good fit for | Think twice for |
| --- | --- |
| I/O-bound services: APIs, gateways, BFFs, aggregators, webhooks | CPU-bound work on the main thread (risk scoring, big batch maths) |
| small, fast-starting services (good for autoscaling and serverless) | very large domains where a strongly typed ecosystem and mature libraries help most |
| teams that share TypeScript with the front end (types and schemas in a contracts package) | libraries that exist only on the JVM (some banking messaging and ISO 20022 tooling) |
| real-time features (WebSockets, server-sent events) | long, stateful, CPU-heavy computations ([performance](lesson:node-performance#cpu)) |

The bigger question is **whether to use microservices at all**. They buy independent deployment, scaling and team ownership, and cost network failure modes, eventual consistency, many pipelines and hard debugging. Do the cheap things first: a **modular monolith** with enforced module boundaries ([modular monolith](lesson:monolith-to-microservices#modular)), then extract the part that has a different scaling profile, release rhythm or team, using the **strangler fig** approach ([strangler](lesson:monolith-to-microservices#strangler)). A common good outcome in a bank is a handful of well-bounded services, not a hundred nano-services. The rule for boundaries: **one business capability, one team, one data owner**.

## Anatomy of a Node service {#anatomy}

Keep every service built the same way, so people can move between them:

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

- **Layers**: routes translate HTTP to a call on a **service** that holds the rules, and the service uses **repositories and clients** passed in from the **composition root** ([design for testability](lesson:node-testing#design)). Rules do not know about Express, and SQL does not leak into routes.
- **Framework**: **Express** is familiar and minimal, **Fastify** is faster with built-in schema validation and logging, **NestJS** gives Spring-like structure (modules, dependency injection, decorators, built-in microservice transports) for large teams. All work. Pick one for the organisation and publish a **service template** (a "golden path") with health endpoints, graceful shutdown, logging, metrics, tracing and the Dockerfile already done, so a new service takes minutes and behaves like the others ([service template](#ops)).
- **Every service** exposes `/health/live` and `/health/ready`, handles SIGTERM gracefully, reads validated configuration from the environment, logs JSON with a correlation id, and exports metrics ([deployment](lesson:node-deployment#process)).
- **Monorepo or polyrepo?** A **pnpm workspace** (`pnpm-workspace.yaml`, packages under `services/` and `packages/`) with Turborepo or Nx gives one place for tooling, atomic cross-service refactors and shared CI caching. Separate repositories give stronger ownership boundaries. Either is fine as long as **each service builds, tests and deploys on its own** and depends only on published or workspace **contracts**.
- **The shared library trap**: a `common` package with models, helpers and clients couples every service to every other, so a change forces all of them to upgrade together and you have a distributed monolith. Share only **small, versioned contract packages** (API schemas, event types, generated clients), and let each service keep its own business code, even if a little is duplicated.

## Calling other services {#sync}

A remote call is not a function call. It can be slow, fail, fail halfway and repeat. Every call needs ([timeouts](lesson:microservice-resilience#timeouts), [retries](lesson:microservice-resilience#retries), [breaker](lesson:microservice-resilience#breaker)):

1. a **deadline** (`AbortSignal.timeout(ms)`) so a hung dependency cannot hold your request forever,
2. **retries only when safe**: idempotent methods (GET, PUT, DELETE) or POST with an idempotency key, only for transient errors (5xx, 429, timeouts, network errors), with **exponential backoff and jitter**, and a small limit,
3. a **circuit breaker** that opens after repeated failures, so calls fail at once instead of piling up, then lets one trial call through to test recovery,
4. **bounded concurrency** to that dependency (a bulkhead, see [concurrency limits](lesson:node-performance#concurrency)).

A small resilient client, run and tested against a local server:

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

I ran six tests against a local `http` server: a GET that returns 503 twice succeeds on the third attempt, a plain POST is **not** retried (one hit) but a POST with an `idempotency-key` is, a 400 is not retried and leaves the breaker closed, a slow call times out, the breaker opens after three failures and then makes **no network call** until the reset time, after which one trial call closes it again, and with `random` fixed the backoff delays are 100, 200 and 400 ms. In production you can use a library instead (`opossum` for breakers, `cockatiel` for retry, timeout and bulkhead policies, `undici` or `got` for HTTP), but you should know what they do. **Add jitter**: without it all clients retry together and create a **retry storm**. Also pass the **remaining deadline** downstream, so a call chain does not spend more time than the user is willing to wait ([timeouts and deadlines](lesson:microservice-resilience#timeouts)).

More points for synchronous calls:

- **Service discovery** on Kubernetes is DNS: call `http://account-service.bank.svc.cluster.local` (or just `http://account-service` in the same namespace), and the Service load-balances across pods ([discovery](lesson:microservice-communication#discovery), [Kubernetes services](lesson:kubernetes#services)). No Eureka is needed.
- **Keep-alive**: reuse connections (Node's `fetch` and `undici` do), so each call does not pay a TCP and TLS handshake.
- **REST, gRPC or GraphQL** ([choices](lesson:microservice-communication#choices)): REST with JSON is the default for public and simple internal APIs. **gRPC** (`@grpc/grpc-js` with `.proto` files and generated types) gives a strict contract, binary efficiency, streaming and built-in deadlines, and suits internal service-to-service calls. **GraphQL** (with federation) suits front-end aggregation.
- **Do not call synchronously in a chain** (A calls B calls C calls D): availability multiplies down and latency adds up. Prefer **events** for work that need not be answered now, and keep synchronous paths short.
- **Timeouts shorter than the caller's**: if the front end waits 3 s, the gateway should time out at 2.5 s, the service at 2 s and its dependency calls at 1 s.

## Gateway and backend for frontend {#gateway}

A **gateway** (Kong, an ingress, an API Gateway) handles TLS, routing, authentication and rate limits for all APIs. A **backend for frontend (BFF)** is a small service owned by a front-end team that shapes calls for one client: one request per screen that fans out to several services ([gateway and BFF](lesson:microservice-communication#gateway)). Node is a natural choice because it is good at parallel I/O. The key rules are a **shared deadline**, **parallel calls**, and **partial results** for non-essential data:

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

In my test, when `offers` threw and `cards` was slower than the 100 ms deadline, the page was returned with `cards: []`, `offers: []` and `degraded: ['cards', 'offers']`, and when `accounts` failed the whole call failed. One trap I hit: `Promise.allSettled` **waits for every call**, so a callee that ignores the abort signal makes the whole aggregation wait for it (my first test took 2 seconds instead of 0.1). `fetch` honours the signal, so pass it into every client call and make sure each one aborts. Keep BFFs **thin**: no business rules, only composition and shaping. Cache slow-changing data ([caching](lesson:node-performance#cache)).

## Messaging {#events}

Asynchronous messaging decouples services in time: the producer does not wait, the consumer may be down for a while, and spikes are absorbed by the broker ([why messaging](lesson:messaging#why)). Choosing a broker:

| Broker | Model | Choose it for | Node libraries |
| --- | --- | --- | --- |
| **Kafka** | partitioned, replicated log, replay, consumer groups | event streams, high volume, ordering per key, replay and audit | `kafkajs`, `@confluentinc/kafka-javascript` |
| **RabbitMQ** | queues and exchanges, routing, acknowledgements | task queues, flexible routing, request-reply | `amqplib` |
| **AWS SQS and SNS** | managed queue and topic | simple managed queues on AWS, no servers | AWS SDK v3 |
| **NATS** | lightweight pub-sub and JetStream | low latency messaging between services | `nats` |
| **BullMQ (Redis)** | job queue inside one system | background jobs, delays, repeatable jobs, rate limits | `bullmq` |

### Messages and events

Distinguish a **command** ("DebitAccount": one receiver, may be rejected) from an **event** ("TransferCompleted": a fact that has already happened, any number of listeners). Use a consistent **envelope**, validated by a schema at both ends:

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

Rules: put **ids, not whole records** when the consumer can fetch details (or include what consumers need so they do not call back), never include secrets, add a **version**, evolve by **adding optional fields** and keep the old event type readable ([message design](lesson:messaging#design), [schema evolution](lesson:microservice-communication#contracts)). With Kafka a **schema registry** (Avro or JSON Schema) enforces compatibility.

### Idempotent consumers

Brokers give **at-least-once** delivery: a message can arrive twice after a retry, a rebalance or a crash before the acknowledgement. "Exactly once" end to end does not exist across systems, so make **processing idempotent** ([idempotency](lesson:microservice-state#idempotency)). The reliable way is to record the message id **in the same transaction** as the business change:

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

In my test a message processed once changed the balance, a redelivery with the same id returned `'duplicate'` and changed nothing, a handler that failed twice with a database timeout succeeded on the third attempt, and a message with bad data (a **permanent** error) was published to the dead-letter queue and its processed marker was **rolled back**, so it can be replayed after a fix. With SQL, `markProcessed` is `INSERT INTO processed_messages (id) VALUES ($1) ON CONFLICT DO NOTHING`, checking that one row was inserted.

More consumer rules:

- **Acknowledge after processing** (commit the Kafka offset, `ack` in RabbitMQ, delete in SQS), never before, or a crash loses the message.
- **Retries and the dead-letter queue**: retry transient errors with backoff (or a delayed retry topic or queue so one bad message does not block the rest), and send **poison messages** to a **dead-letter queue** with the error, alert on it, and provide a way to replay ([reliability](lesson:messaging#reliability)).
- **Ordering**: Kafka orders messages only **within a partition**, so use the **entity id as the key** (`accountId`) and all events for one account stay in order. Several consumers in a **consumer group** split the partitions. Do not depend on global ordering.
- **Concurrency and backpressure**: process messages with a **bounded concurrency** (with `kafkajs`, `partitionsConsumedConcurrently` and `eachBatch`, or a limiter around the handler), and **pause** the consumer when downstream is slow (`consumer.pause`) instead of loading unlimited messages into memory ([streams backpressure](lesson:node-streams#backpressure)).
- **Graceful shutdown**: on SIGTERM stop fetching, finish the messages in progress, commit offsets, then disconnect ([graceful shutdown](lesson:node-runtime#shutdown)).
- **Duplicate side effects**: an email or a payment instruction sent by the handler is not covered by the database transaction, so give the external call an **idempotency key** derived from the message id.

## The transactional outbox {#outbox}

The **dual-write problem**: saving to the database and publishing to the broker are two separate operations. If the process crashes between them, the transfer exists but the event is never sent, and nothing remembers that it was owed. Reversing the order loses the data instead. The fix is the **transactional outbox** ([publishing events](lesson:event-sourcing-cqrs#publishing)):

1. In **one database transaction**, write the business row **and** a row in an `outbox` table describing the event.
2. A separate **relay** reads unpublished rows, publishes them to the broker, and marks them published. (Or a **CDC** tool such as Debezium reads the database log and publishes the outbox table to Kafka, with no polling code.)
3. Because a crash after publishing and before marking sends the event again, delivery is **at least once**, so consumers are idempotent (above).

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

(I tested `relayOnce` against an in-memory fake database, not a real PostgreSQL: it publishes and marks rows, publishes nothing the second time, and when `publish` throws halfway the marks are rolled back so all the rows are retried, which is the at-least-once behaviour.) Run the relay on a short timer or with `LISTEN/NOTIFY`, delete or archive old rows, key events by the aggregate id to keep per-entity order, and send the outbox row id as the event id, which the consumers use to deduplicate. The mirror image for incoming messages is the **inbox** (the processed-messages table above).

## Sagas {#saga}

A business operation that spans services cannot use one database transaction, and two-phase commit is rarely available or wise across independent services. A **saga** is a sequence of **local transactions**, each publishing an event or command for the next, with **compensating actions** that undo earlier steps if a later one fails ([saga idea](lesson:saga#idea), [compensation](lesson:saga#compensation)). **Choreography** lets services react to each other's events (simple, but the flow is hard to see). **Orchestration** uses one coordinator that holds the state and sends commands ([coordination](lesson:saga#coordination)), which is easier to follow and test, and is the usual choice for money flows.

A transfer between two accounts held by different services, as a **persisted state machine**. The orchestrator is a pure function from the current state and a reply to the next state and the commands to send:

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

I tested the happy path (`STARTED` to `DEBITED` to `COMPLETED`, with the right commands), the compensation path (`CreditFailed` leads to `RefundDebit` and ends in `FAILED`), a duplicate reply that is ignored, a late reply after the end that is ignored, and an impossible reply that throws. In a service, each reply handler loads the saga row, calls `handleReply`, saves the new state and writes the commands to the **outbox** in one transaction, with optimistic locking (a version column) so parallel replies cannot corrupt it. Add **timeouts** (a saga stuck in `DEBITED` for too long is escalated), make every command **idempotent** and every compensation safe to repeat, and send the unsolvable cases to **manual review**, which a bank must support. For complex workflows consider a **workflow engine** (Temporal has a TypeScript SDK, or AWS Step Functions) instead of hand-written state machines.

## Data ownership and consistency {#data}

- **One service, one database (or schema), one owner.** Others read the data only through the owner's API or through events ([data ownership](lesson:microservice-state#data)). A shared database is a hidden coupling.
- **Joins across services do not exist.** Use **API composition** (the BFF calls both and merges), or a **read model** built from events (CQRS: a service keeps its own copy of the data it needs, updated by events, accepting that it may lag by a moment).
- **Eventual consistency** is normal: after a transfer, the balance in the reporting service updates a moment later. Design the user interface and the language of the API around it (status `PENDING`, then `POSTED`).
- **Reference data copies** (account holder names, currencies) should be small and updated by events, with the owner staying the source of truth.
- **Idempotency keys** on commands that change money, kept per client and operation, so a retry returns the first result.
- **Transactions are local.** Do not try to simulate distributed ACID. Use the outbox, sagas and compensation.
- **Caches** are per service and must tolerate stale data ([Redis caching](lesson:redis-caching#patterns)).

## Contracts and versioning {#contracts}

Services change independently, so the **contract** between them is the real interface ([contracts](lesson:microservice-communication#contracts)):

- Describe synchronous APIs with **OpenAPI** (or gRPC `.proto`) and asynchronous events with **AsyncAPI** or JSON Schema, kept in a contracts package that both sides use. Generate types and clients from them, so the compiler catches drift. **Validate at runtime too**, since types disappear after compilation (zod, ajv).
- **Backward compatible changes** are safe: add an optional field, add a new endpoint, add a new event type. **Breaking changes** are not: remove or rename a field, change a type or meaning, make an optional field required. For a break, version the API (`/v2`) or the event (`version: 2`), run both, migrate consumers, then retire the old one.
- **Be liberal in what you accept** (the **tolerant reader**): read only the fields you need and ignore unknown ones.
- **Consumer-driven contract tests** (**Pact**): each consumer records what it needs, the provider verifies those contracts in its pipeline, so a breaking change is caught before deployment ([contract tests](lesson:node-testing#contract)).
- **Expand and contract** for data and message changes, as with schema migrations ([database changes during a release](lesson:deployment-strategies#database)).
- Publish **deprecation dates** and monitor which consumers still call old versions.

## Security between services {#security}

- **Do not trust the internal network.** Authenticate every call. **mTLS** (certificates, often through a service mesh such as Istio or Linkerd) proves which service is calling and encrypts the traffic. Or use **signed tokens** from the identity provider with the client credentials flow ([OAuth 2.0](lesson:oauth2#tokens)).
- **Propagate the user identity** separately from the service identity: pass the user's token (or a **token exchange** result with a narrower audience) so the downstream service can authorise on behalf of the user, and not only "some service called me".
- **Authorise in every service**, with ownership checks on each object ([security](lesson:node-security#data)), not only at the gateway.
- **Network policies** restrict which pods may talk to which ones, with default deny. Put secrets in a manager, rotate them, and give each service its own credentials and a least-privilege database user ([secrets](lesson:node-deployment#config)).
- **Validate everything that crosses a boundary**, including messages from the broker and responses from other services.
- **Audit** money movements with the correlation id and the identity chain.

## Observability across services {#observe}

When one transfer touches five services, logs in one place are not enough. You need ([observability](lesson:microservice-patterns#operations)):

- A **correlation id** created at the edge (or taken from the incoming header) and passed on **every outbound HTTP call and message**. Inside a service, **AsyncLocalStorage** carries it through the async code, so every log line includes it without passing it through every function ([context and logging](lesson:node-express-middleware#context)):

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

  I ran two real HTTP servers, A calling B: with the incoming header `req-42`, the logs were `A req-42 received`, `B req-42 handling` and `A req-42 B said b-ok`, so one id followed the request across both. Put the same id in message headers and in the event envelope.
- **Distributed tracing**: **OpenTelemetry** (`@opentelemetry/sdk-node` with auto-instrumentation, started with `node --import ./otel.js app.js`) creates spans for incoming requests, outgoing HTTP calls, database queries and Kafka messages, and propagates the W3C **`traceparent`** header, so a tracing backend (Jaeger, Tempo, X-Ray) shows the whole path and where the time went. Use trace ids in logs.
- **Metrics per service and per dependency**: request rate, errors, p99 duration (RED), event loop lag, consumer lag, outbox backlog, breaker state, dead-letter queue depth, saga stuck counts ([performance](lesson:node-performance#production)).
- **Alert on symptoms** (error rate, latency, consumer lag growing, DLQ not empty) and on business invariants (money in equals money out).

## Testing microservices {#testing}

Keep most tests inside each service and use contracts at the edges ([testing Node services](lesson:node-testing#why)):

- **Unit tests** for the domain with fakes and a fixed clock, including the saga state machine and the idempotent consumer (pure functions and in-memory fakes make these fast).
- **Component tests** of one service with its real database (Testcontainers) and fakes or stubs for other services (MSW, nock, or a contract stub) and a fake broker.
- **Contract tests** (Pact) for each integration, run in both pipelines.
- **Resilience tests**: inject failures and latency in the client tests (as above with a flaky server) and in staging (chaos experiments) to check timeouts, retries, breakers and fallbacks ([testing resilience](lesson:microservice-resilience#testing)).
- A **few end-to-end tests** of critical journeys against an integrated environment, and **synthetic checks** in production. Avoid a large end-to-end suite, which is slow and flaky.

## Deployment and ownership {#ops}

- **One image and one pipeline per service**, built from a service template, deployed independently with rolling or canary releases ([deployment](lesson:node-deployment#kubernetes), [pipeline](lesson:node-deployment#cicd)). Version and tag by commit, and promote the same image through environments.
- **Backward compatibility during rollouts**: old and new versions run together, so use expand and contract and compatible contracts.
- **Scale each service on its own signal**, with at least two or three pods across zones, a PodDisruptionBudget and graceful shutdown. Consumers scale by partitions or queue length (KEDA).
- **Ownership**: a team owns a service end to end, including the pager, dashboards, runbooks, SLOs, and its contract. A catalogue (Backstage) lists owners and dependencies.
- **Platform support**: the service template, shared pipeline, observability stack and a mesh or gateway, so teams do not each solve the same problems ("paved road").
- **Feature flags** to separate deployment from release, and a rollback that is as simple as deploying the previous image.
- **Cost of the architecture**: count the number of services you can really operate. If a small team runs thirty services, reduce them.

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

Choose microservices when parts of the system have different scaling profiles, release rhythms or teams, and boundaries are clear enough to give each service its own data and contract, and when the organisation can operate many services (pipelines, observability, on-call). Keep a modular monolith when the team is small, the domain is still changing, or the boundaries are unclear, because network failures, eventual consistency and distributed debugging are a heavy price. A good path is a modular monolith first, then extract the module that needs independence.

### [basic] Why does each microservice own its database? {#db-per-service-q}

So that services can change their schema and deploy independently. With a shared database, a change by one team can break another without warning, transactions hide coupling, and no team really owns the data. With private databases, other services use the owner's API or consume its events, and joins across services are replaced by API composition or read models, at the cost of eventual consistency.

### [basic] When do you use synchronous calls and when asynchronous messaging? {#sync-async-q}

Use synchronous calls (REST or gRPC) when the caller needs the answer now to continue, such as checking a balance before showing it, and keep those chains short with timeouts and breakers. Use asynchronous messaging for work that need not be answered immediately, for notifying other services of facts (events), for absorbing spikes, and for workflows that can complete later. Messaging decouples availability and timing, but adds eventual consistency, duplicates and the need for idempotency.

### [basic] What must every remote call have, and why? {#remote-call-q}

A timeout (deadline), because a hung dependency would otherwise hold your request and resources indefinitely. Retries only when safe (idempotent operations, transient errors) with exponential backoff and jitter, because uncontrolled retries amplify an outage. A circuit breaker so calls fail fast when a dependency is down, and bounded concurrency so one slow dependency cannot exhaust your pool. Pass a correlation id and the remaining deadline downstream.

### [basic] What is an idempotent consumer and how do you implement it? {#idempotent-q}

A consumer that produces the same result when it receives the same message more than once, which at-least-once delivery makes inevitable. Store the message id in a processed-messages table in the same database transaction as the business change, using a unique constraint (`INSERT ... ON CONFLICT DO NOTHING`). If the insert affects no row, the message is a duplicate and is acknowledged and skipped. External side effects get an idempotency key derived from the message id.

### [intermediate] What is the dual-write problem and how does the outbox solve it? {#outbox-q}

Writing to the database and publishing to the broker are two operations that cannot be made atomic, so a crash between them leaves data without an event (or an event without data). The outbox writes the business row and an event row in one local transaction, and a relay (or CDC such as Debezium) publishes the outbox rows afterwards and marks them. The event can be published twice if the relay crashes after publishing, so delivery is at least once and consumers are idempotent.

### [intermediate] Is exactly-once delivery possible? {#exactly-once-q}

Not end to end across independent systems. Brokers can offer exactly-once within their own boundary (Kafka transactions and idempotent producers between topics), but a consumer that updates a database or calls an external system can still crash between the effect and the acknowledgement. The practical answer is at-least-once delivery plus idempotent processing, which achieves exactly-once effects.

### [intermediate] How do you keep message order in Kafka, and what are the limits? {#ordering-q}

Kafka orders messages only within a partition, so set the message key to the entity id (for example the account id), and all events for that account go to one partition in order, consumed by one consumer of the group at a time. There is no ordering across partitions, so do not depend on global order, design handlers to tolerate out-of-order data across entities (version numbers, timestamps), and keep per-partition processing sequential even if you process partitions concurrently. Retries and a dead-letter topic can break order for the retried message, so decide whether that matters.

### [intermediate] How would you implement a transfer between two accounts held by different services? {#transfer-q}

As an orchestrated saga: a transfer service persists the saga state, sends a debit command (through the outbox) to the source account service, then on success a credit command to the target service, then a notification. If credit fails it sends a compensating refund and ends in a failed state, and cases that cannot be compensated go to manual review. Every command is idempotent through an idempotency key, replies are deduplicated and late replies ignored, steps have timeouts, state changes and outgoing commands are written in one transaction, and the user sees a pending status that becomes posted or failed.

### [intermediate] What is a backend for frontend and how do you write one in Node.js? {#bff-q}

A small service owned by a front-end team that composes calls to several services into the response one screen needs. In Node, call the services in parallel with `Promise.allSettled` under one shared deadline (an `AbortSignal`), fail the request only when an essential call fails, and return a partial result with the failed optional parts marked, so a slow offers service does not break the page. Keep it free of business rules, make sure every client call honours the abort signal, and cache slow-changing data.

### [intermediate] Why is a shared library of models and clients between services a problem? {#shared-lib-q}

It couples the services: any change forces all of them to upgrade together, release cycles lock together, and teams cannot evolve independently, which creates a distributed monolith. Share only small versioned contract packages (API schemas, event types, generated clients), keep business logic inside each service, and accept a little duplication. Consumers should be tolerant readers that ignore fields they do not use.

### [intermediate] How do you evolve an API or an event without breaking consumers? {#evolution-q}

Make only backward compatible changes: add optional fields, new endpoints, new event types, and never remove or rename a field or change its meaning in place. Consumers read only what they need and ignore unknown fields. For a real break, publish a new version (`/v2` or `version: 2`), run both, migrate the consumers, then retire the old one. Use consumer-driven contract tests (Pact) and a schema registry compatibility check so breaks are caught in the pipeline.

### [intermediate] How do you trace one request across several Node.js services? {#tracing-q}

Create a correlation id at the edge (or accept the incoming one), keep it in AsyncLocalStorage inside each service so every log line includes it, and forward it on every outbound HTTP call and message. For distributed tracing use OpenTelemetry with the Node auto-instrumentation, which creates spans for HTTP, database and Kafka operations and propagates the W3C traceparent header, so a backend such as Jaeger shows the full path and timings. Put the trace id in the logs to jump between logs and traces.

### [deep] A consumer keeps failing on one message and the queue is blocked. What do you do? {#poison-q}

That is a poison message. Do not retry forever. Retry transient errors a few times with backoff, but treat deterministic failures (bad data, a schema violation) as permanent, and publish the message with the error details to a dead-letter queue, then acknowledge it so the rest of the partition continues. Alert on the DLQ, investigate, fix the code or the data, and replay the messages (the idempotent consumer makes replays safe). To avoid head-of-line blocking use retry topics or queues with delays, and validate messages against the schema on arrival.

### [deep] Design a notification service that sends an email when a transfer completes, without duplicates or lost messages. {#notification-q}

The transfer service writes a TransferCompleted event to its outbox in the same transaction as the transfer, and a relay publishes it to Kafka keyed by account. The notification service consumes the topic with a consumer group, records the event id in a processed table in the same transaction as its own state, and sends the email with an idempotency key derived from the event id, so a redelivery does not send a second email. Transient provider failures are retried with backoff, permanent ones go to a dead-letter queue, offsets are committed after processing, and metrics track consumer lag, retries and DLQ depth. Delivery is at least once with effectively once results.

### [deep] You are extracting a service from a Node.js monolith. How do you proceed? {#extract-q}

Make the module boundary explicit first (its own folder, its own tables, an interface other modules call), then use the strangler approach: put a routing layer in front, build the new service behind the same contract, move traffic gradually (shadow traffic, then a percentage), and keep the monolith as fallback. Split the data last and carefully: dual-write is avoided by using the outbox or CDC, with the new service becoming the owner and the old tables read-only, then removed. Add the platform pieces first (template, pipeline, health checks, observability), and measure latency and errors during the move.

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

Each attempt runs inside the breaker and has its own deadline from `AbortSignal.timeout`. Only server errors, 429, timeouts and network failures count as breaker failures and are retried, while a 4xx is the caller's mistake and affects neither. A plain POST is never retried, but a POST with an idempotency key is. The delay doubles up to a cap and is multiplied by a random number (full jitter) so clients do not retry in step. When the breaker is open it throws immediately without a network call, and after `resetMs` it lets one trial through, closing on success and reopening on failure. The `sleep`, `random` and `now` parameters make it testable, and my tests covered retry on 503, the POST rule, 4xx handling, the timeout, opening and recovery, and the delays 100, 200 and 400 ms.

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

The marker and the handler's changes commit or roll back together, so a crash can neither lose the change nor apply it twice. A redelivered message hits the unique constraint and returns `'duplicate'`, which the broker integration acknowledges. A thrown error rolls back both the marker and the change, so a retry starts clean. Errors marked `permanent` (bad data) and errors that persist for `maxAttempts` attempts go to the dead-letter queue, with the error and attempt count, and the message is acknowledged. Because the marker was rolled back, the message can be replayed from the DLQ after a fix. In my test the first message was processed, the same id returned `'duplicate'`, a handler that failed twice succeeded on the third attempt, and a poison message was dead-lettered without leaving a processed marker.

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

`Promise.allSettled` never rejects, so every outcome is inspected. The three calls run in parallel, so the total time is the slowest call, bounded by the shared deadline. An essential failure is rethrown, optional failures are replaced by an empty fallback and listed in `degraded`, so the front end can show "offers unavailable" and the monitoring can count degraded responses. The services must pass the `signal` to `fetch` (or their client) so that a slow call really aborts: in my first test a fake service ignored the signal and `allSettled` waited 2 seconds, while with abort-aware fakes the degraded page came back after about 0.1 seconds. All results were verified with `node:test`: everything succeeding, `cards` too slow and `offers` failing (giving `degraded: ['cards', 'offers']`), and `accounts` failing (the whole call rejects).
