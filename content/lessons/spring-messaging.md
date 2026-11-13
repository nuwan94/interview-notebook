---
title: Messaging with Spring — listeners, acknowledgements, retries, dead letters and the outbox
nav: Messaging with Spring
slug: spring-messaging
summary: How Spring implements message-driven services (Spring Kafka, Spring AMQP and Spring Cloud Stream), listener containers and acknowledgement modes, error handling with retry and dead-letter topics, idempotent consumers, partitions and consumer groups, producers and the transactional outbox, with Java examples and interview questions.
tags: [Spring, Messaging, Kafka, RabbitMQ, Outbox, Idempotency, Dead Letter]
order: 34
topic: Spring / Microservices
updated: 2026-11-13
subnav: true
---

The concepts of brokers, delivery guarantees and idempotency are in the [messaging lesson](lesson:messaging); this lesson is the Spring side: *how do I consume with `@KafkaListener` or `@RabbitListener`, when is a message acknowledged, how do I retry and dead-letter, how do I keep consumers idempotent and ordered, and how do I publish reliably with the outbox?* It builds on [Spring transactions](lesson:spring-transactions) (events and commits), [Spring Cloud](lesson:spring-cloud) and the [Saga pattern](lesson:saga). Examples use Kafka and RabbitMQ side by side. Play the three scenes: listener acknowledgement and dead letters, the idempotent consumer, and partitions and ordering.

```demo
name: spring-msg-walk
```

> **One sentence to remember:** *delivery is at-least-once, so acknowledge after processing, retry with a bound, park poison messages in a dead-letter topic, and make every handler idempotent.*

## The Spring options {#options}

| Library | For | Style |
| --- | --- | --- |
| **Spring for Apache Kafka** | Kafka | `KafkaTemplate`, `@KafkaListener`, listener containers |
| **Spring AMQP** | RabbitMQ | `RabbitTemplate`, `@RabbitListener`, exchanges and queues |
| **Spring Cloud Stream** | broker-agnostic | functional beans (`Function`, `Consumer`, `Supplier`) bound to destinations by binders |
| **Spring JMS**, Spring Integration | JMS brokers, enterprise integration patterns | templates, listener containers, flows |

Spring Cloud Stream hides the broker (a `Consumer<TransferCompleted>` bean bound by configuration) but still needs you to understand partitions, groups and retries; direct Spring Kafka or AMQP gives full control.

## Consuming {#consuming}

### Listeners {#listeners}

```java
@Component
class TransferEvents {

    @KafkaListener(topics = "transfers", groupId = "ledger-service", concurrency = "3")
    void on(TransferCompleted event, Acknowledgment ack) {
        ledger.apply(event);                 // business work (idempotent!)
        ack.acknowledge();                   // commit the offset only after success (AckMode.MANUAL)
    }

    @RabbitListener(queues = "statements.requested")
    void on(StatementRequested request) {    // default: acknowledged automatically on normal return, rejected on exception
        statements.generate(request);
    }
}
```

A **listener container** polls or receives messages, deserialises them (JSON with type information or a schema registry), and calls your method on a container thread. `concurrency` sets the number of consumer threads (for Kafka, at most the number of partitions).

### Acknowledgement {#ack}

| | Kafka | RabbitMQ |
| --- | --- | --- |
| Concept | commit the **offset** (position) | **ack/nack** each message |
| Default in Spring | `AckMode.BATCH`: after the records of a poll are processed | `AUTO`: ack on normal return, reject (and requeue or dead-letter) on exception |
| Manual | `AckMode.MANUAL` + `Acknowledgment` | `AcknowledgeMode.MANUAL` + channel |
| Rule | acknowledge **after** the work is done | same |

Acknowledging before processing risks **losing** messages (crash after ack); acknowledging after risks **duplicates** (crash before ack) which is the accepted trade: **at-least-once**.

### Errors, retries and dead letters {#errors}

```java
@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template);                       // sends to "<topic>.DLT" with exception headers
    var backoff = new ExponentialBackOffWithMaxRetries(3);
    backoff.setInitialInterval(1_000);
    backoff.setMultiplier(2.0);
    var handler = new DefaultErrorHandler(recoverer, backoff);
    handler.addNotRetryableExceptions(DeserializationException.class, ValidationException.class);    // retrying will not help
    return handler;
}
```

- **Retry in place** blocks the partition (the same message is re-polled) so keep it short; for longer delays use **non-blocking retry topics** (`@RetryableTopic`: `transfers-retry-1s`, `-retry-10s`, then `.DLT`) so other messages keep flowing.
- **Classify errors:** *transient* (timeout, deadlock, downstream 503): retry with backoff. *Permanent* (malformed, validation, business rejection): do not retry, send straight to the DLT.
- **Dead-letter topic or queue (DLT/DLQ):** keeps the failed message plus exception, stack trace and original coordinates (topic, partition, offset) in headers; alert on its size, provide a tool to inspect and **replay** after the fix.
- **Poison pills:** a message that cannot even be deserialised would loop forever; use `ErrorHandlingDeserializer` so the failure becomes a handled error instead of a crash loop.
- **RabbitMQ:** configure `spring.rabbitmq.listener.simple.retry.*` or a dead-letter exchange on the queue, and set `default-requeue-rejected=false` to avoid infinite requeue loops.

### Idempotent consumers {#idempotent}

Duplicates come from redelivery after a crash, retries and rebalances, so handlers must tolerate them ([idempotent consumers](lesson:messaging#idempotent)):

```java
@Transactional
void on(TransferCompleted e) {
    if (!processed.markIfNew(e.messageId())) return;      // INSERT ... unique (message_id): duplicate returns false
    ledger.apply(e);                                      // same transaction: both commit or neither
}
```

Or make the operation naturally idempotent (set a state, upsert by key, compare versions). The message needs a stable **id** (event id or business key). Combine with the outbox on the producer side for effectively-once processing.

## Partitions, groups and ordering {#partitions}

- A Kafka **topic** has partitions; a **consumer group** shares them so each partition is read by exactly one consumer of the group. Parallelism is capped by the partition count, and adding consumers beyond it leaves them idle.
- **Ordering is guaranteed only within a partition.** Use the entity id (account id) as the **message key** so all events of one account land in one partition, in order. Different keys may be processed in any relative order.
- A **rebalance** (instance joins or leaves) moves partitions and redelivers from the last committed offset; use cooperative rebalancing, and keep processing time per poll below `max.poll.interval.ms`.
- RabbitMQ: **competing consumers** on one queue share messages (no key ordering across consumers); use a consistent-hash exchange or one queue per key group when order matters, and set `prefetch` so one slow consumer does not hoard messages.
- **Slow consumers:** monitor consumer lag (messages behind), scale instances up to the partition count, and keep handlers short; push heavy work to another queue.

## Producing reliably {#producing}

```java
@Service
class TransferEventsPublisher {
    private final KafkaTemplate<String, TransferCompleted> kafka;

    void publish(TransferCompleted e) {
        kafka.send("transfers", e.accountId(), e)                                      // key = account id: ordering per account
             .whenComplete((result, ex) -> { if (ex != null) log.error("publish failed {}", e.messageId(), ex); });
    }
}
```

Producer settings for safety: `acks=all`, `enable.idempotence=true` (no duplicates from retries within a session), `retries`, a sensible `delivery.timeout.ms`. But the real problem is the **dual write**: updating the database and sending a message are two systems, so one can succeed and the other fail.

### Transactional outbox {#outbox}

Write the event into an **outbox table in the same database transaction** as the business change; a separate **relay** reads new rows and publishes them, marking them sent (polling, or change data capture with Debezium). Delivery is at-least-once, so consumers stay idempotent. It replaces `@TransactionalEventListener(AFTER_COMMIT)` when you cannot afford to lose the message ([outbox pattern](lesson:microservice-patterns#outbox), [after commit](lesson:spring-transactions#events)).

```java
@Transactional
public void complete(Transfer t) {
    transfers.save(t.markCompleted());
    outbox.save(OutboxEvent.of("transfers", t.accountId(), new TransferCompleted(t.id(), t.amount())));     // same transaction
}

@Scheduled(fixedDelay = 500)
@SchedulerLock(name = "outboxRelay", lockAtMostFor = "PT1M")
void relay() {
    outbox.findUnsent(100).forEach(e -> { kafka.send(e.topic(), e.key(), e.payload()).join(); outbox.markSent(e); });
}
```

Kafka also offers **transactions** (exactly-once within Kafka: consume-process-produce) with `transaction-id-prefix`; it does not make an external database update atomic with the send.

## Messages as contracts {#contracts}

- **Schema and evolution:** JSON with tolerant readers, or Avro/Protobuf with a **schema registry** and compatibility rules; add optional fields, never reuse or retype a field. Include `eventId`, `occurredAt`, a type and a version.
- **Events versus commands:** an event states a fact (`TransferCompleted`), a command asks for work (`GenerateStatement`); name and route accordingly.
- **Message size:** keep payloads small; pass an id or a link to large data (the claim-check pattern).
- **Security:** authenticate and authorise producers and consumers (TLS, SASL, ACLs), and avoid sensitive data in messages that many consumers can read.

## Testing {#testing}

Use **Testcontainers** (`KafkaContainer`, `RabbitMQContainer`) with `@ServiceConnection`, or `@EmbeddedKafka` for quick tests; publish a message and assert the effect with **Awaitility** (no sleeps). Test the failure paths: a poison message lands in the DLT, a transient failure is retried, and **delivering the same message twice has one effect** ([testing Spring apps](lesson:spring-testing#testcontainers)).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Delivery | at-least-once: acknowledge after processing, expect duplicates |
| Listener | `@KafkaListener`, `@RabbitListener`; container threads; `concurrency` |
| Ack | Kafka offset commit, RabbitMQ ack; manual for control |
| Errors | bounded retry with backoff, classify, then dead-letter |
| Non-blocking retry | `@RetryableTopic` retry topics, then DLT |
| Poison pill | `ErrorHandlingDeserializer` |
| Idempotent consumer | processed-id table with unique constraint, same transaction |
| Ordering | per partition; key = entity id |
| Parallelism | capped by partitions (Kafka) |
| Producer | `acks=all`, idempotence; dual write needs the outbox |
| Outbox | event row in the business transaction; relay publishes |
| Tests | Testcontainers, Awaitility, duplicate and poison cases |

## Interview questions {#questions}

### [basic] What are the main ways to do messaging in Spring? {#options-q}

Spring for Apache Kafka (`KafkaTemplate`, `@KafkaListener`), Spring AMQP for RabbitMQ (`RabbitTemplate`, `@RabbitListener`), Spring JMS, Spring Integration for integration patterns, and Spring Cloud Stream, which binds functional `Consumer`/`Function`/`Supplier` beans to destinations through broker-specific binders so code is broker-agnostic.

### [basic] When is a Kafka message acknowledged in a Spring listener? {#ack-q}

By committing the offset. By default (`AckMode.BATCH`) the container commits after all records of a poll were processed successfully; with `MANUAL` you call `Acknowledgment.acknowledge()`. If the listener throws, the offset is not committed and the error handler decides about retry or dead-lettering. Acknowledge after processing for at-least-once delivery.

### [basic] What is a dead-letter topic (or queue)? {#dlt-q}

A destination where messages that could not be processed after retries (or are permanently invalid) are parked with the exception details, so they do not block the main flow or get lost. Operators alert on it, inspect messages, fix the cause and replay them.

### [basic] Why must consumers be idempotent? {#idempotent-q}

Brokers deliver at-least-once: crashes before acknowledgement, retries and rebalances redeliver messages. Without idempotency a duplicate could credit an account twice. Record processed message ids with a unique constraint in the same transaction as the work, or make the operation naturally idempotent (upsert, state set).

### [intermediate] How do you handle failing messages in Spring Kafka? {#failing-q}

Configure a `DefaultErrorHandler` with a backoff (bounded retries, exponential) and a `DeadLetterPublishingRecoverer` that publishes to a `.DLT` topic. Mark non-retryable exceptions (deserialisation, validation) to skip retries. Use `@RetryableTopic` for non-blocking delayed retries so one bad message does not block the partition. Use `ErrorHandlingDeserializer` for poison pills.

### [intermediate] What guarantees ordering and how does key choice affect it? {#ordering-q}

Kafka orders messages only within a partition, and the partition is chosen by hashing the message key. Using the entity id (account id) as key sends all of its events to one partition in order and consumed by one consumer at a time. Events with different keys have no relative order. Increasing partitions later changes the key mapping.

### [intermediate] What limits consumer parallelism in Kafka? {#parallelism-q}

The number of partitions: within a consumer group each partition is assigned to one consumer, so more consumers than partitions sit idle. Increase partitions (planning for peak), use `concurrency` threads, keep handlers fast, and move heavy work off the consumer thread (to another topic or worker pool) while preserving ordering where needed.

### [intermediate] What is a consumer group rebalance and what is its effect? {#rebalance-q}

When consumers join, leave or fail, partitions are reassigned among the group. Consumption pauses briefly (less with cooperative rebalancing) and the new owner resumes from the last committed offset, so messages processed but not committed are redelivered. Hence idempotent handlers, and processing per poll must finish within `max.poll.interval.ms` or the consumer is considered dead.

### [intermediate] Why can't you just save to the database and then send a message? {#dual-write-q}

Those are two separate systems with no shared transaction: the database commit can succeed and the send fail (state changed, no event), or the message is sent and the commit fails (event about something that did not happen). The transactional outbox writes the event in the same database transaction and a relay publishes it, giving at-least-once delivery without losing events.

### [intermediate] How do you make a producer reliable? {#producer-q}

`acks=all` (wait for in-sync replicas), `enable.idempotence=true` to avoid duplicates from producer retries, retries with a delivery timeout, handle the send future's failure, choose keys for ordering, and use the outbox to tie the send to your database transaction. Monitor failed sends and use schemas for compatibility.

### [intermediate] What is the difference between event and command messages? {#event-command-q}

An event is a fact that already happened (`TransferCompleted`), published to any interested consumers, and the producer does not care who listens. A command is a request for a specific service to do something (`GenerateStatement`), usually to one consumer with an expected outcome. Names, topics and error handling differ accordingly.

### [deep] Does Kafka's exactly-once semantics solve duplicates for a Spring service? {#exactly-once-q}

Only inside Kafka: with idempotent producers and transactions, a consume-process-produce flow between topics can be atomic. It does not cover side effects outside Kafka such as updating a relational database or calling an API, which can still run twice on redelivery. So you still need idempotent consumers or an outbox; "exactly once" in practice means at-least-once plus idempotency.

### [deep] How would you design replay and reprocessing of dead letters? {#replay-q}

Keep the original payload and metadata in the DLT, expose an admin tool or job to inspect, filter and republish messages to the original topic (or a replay topic) after the fix, rate-limited and idempotent, with audit of who replayed what. Keep dead letters long enough, and alert on growth so they are not forgotten.

### [coding] Configure a Kafka listener with retries and a dead-letter topic. {#coding-dlt}

```java
@Configuration
class KafkaErrorConfig {
    @Bean
    DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
        var recoverer = new DeadLetterPublishingRecoverer(template);
        var handler = new DefaultErrorHandler(recoverer, new FixedBackOff(1_000L, 3));      // 3 retries, 1 s apart
        handler.addNotRetryableExceptions(ValidationException.class, DeserializationException.class);
        return handler;
    }
}

@Component
class LedgerListener {
    @KafkaListener(topics = "transfers", groupId = "ledger")
    void on(TransferCompleted e) { ledger.apply(e); }       // throwing triggers the retries, then <topic>.DLT
}
```

Explain that retries block the partition so they are short and bounded, validation errors skip retries, the recoverer adds the exception headers, and a separate listener or tool consumes `transfers.DLT`.

### [coding] Write an idempotent consumer with a processed-message table. {#coding-idempotent}

```java
@Component
class LedgerListener {
    private final ProcessedMessages processed;      // table processed_message(id PRIMARY KEY)
    private final Ledger ledger;

    @KafkaListener(topics = "transfers", groupId = "ledger")
    @Transactional
    void on(TransferCompleted e) {
        try {
            processed.insert(e.messageId());                  // unique violation on a duplicate
        } catch (DuplicateKeyException dup) {
            return;                                           // already handled: acknowledge and skip
        }
        ledger.apply(e);                                      // rolls back the insert too if it fails
    }
}
```

Explain that the marker and the business update commit in one transaction, a redelivery hits the unique constraint and is skipped, and old markers are cleaned after the retention window.

### [coding] Implement a transactional outbox with a polling relay. {#coding-outbox}

```java
@Entity class OutboxEvent {
    @Id UUID id; String topic; String key; @Column(columnDefinition = "jsonb") String payload; Instant createdAt; Instant sentAt;
}

@Service
class TransferService {
    @Transactional
    public void complete(long id) {
        Transfer t = transfers.findById(id).orElseThrow().complete();
        outbox.save(OutboxEvent.of("transfers", String.valueOf(t.accountId()), json(new TransferCompleted(t.id(), t.amount()))));
    }
}

@Component
class OutboxRelay {
    @Scheduled(fixedDelay = 500) @SchedulerLock(name = "outbox", lockAtMostFor = "PT1M")
    @Transactional
    void run() {
        for (OutboxEvent e : outbox.findTop100BySentAtIsNullOrderByCreatedAt()) {
            kafka.send(e.topic, e.key, e.payload).join();      // at-least-once: a crash here resends
            e.markSent(Instant.now());
        }
    }
}
```

Explain that the event and the state change are atomic, the relay may publish twice after a crash (so consumers deduplicate by id), ordering per key follows `createdAt`, and CDC such as Debezium can replace the polling.
