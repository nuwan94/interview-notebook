---
title: Messaging with Spring — listeners, acknowledgements, retries, dead letters and the outbox
nav: Messaging with Spring
slug: spring-messaging
summary: How Spring implements message-driven services (Spring Kafka, Spring AMQP and Spring Cloud Stream), listener containers and acknowledgement modes, error handling with retry and dead-letter topics, idempotent consumers, partitions and consumer groups, producers and the transactional outbox, with Java examples and interview questions.
tags: [Spring, Messaging, Kafka, RabbitMQ, Outbox, Idempotency, Dead Letter]
order: 94
topic: Spring / Microservices
updated: 2026-11-26
subnav: true
---

The concepts (brokers, delivery guarantees, idempotency) are in the [messaging lesson](lesson:messaging). This lesson is the Spring side. It answers:

- How do I consume with `@KafkaListener` or `@RabbitListener`?
- When is a message acknowledged?
- How do I retry, and send failures to a dead-letter topic?
- How do I keep consumers idempotent and in order?
- How do I publish reliably with the outbox?

It builds on [Spring transactions](lesson:spring-transactions) (events and commits), [Spring Cloud](lesson:spring-cloud) and the [Saga pattern](lesson:saga). The examples show Kafka and RabbitMQ side by side.

The demo has three scenes: listener acknowledgement and dead letters, the idempotent consumer, and partitions and ordering.

```demo
name: spring-msg-walk
```

> **One sentence to remember:** *Every message can arrive twice, so make every handler idempotent.*

Delivery is at-least-once. So acknowledge after processing, retry a limited number of times, and park poison messages in a dead-letter topic.

## The Spring options {#options}

| Library | For | Style |
| --- | --- | --- |
| **Spring for Apache Kafka** | Kafka | `KafkaTemplate`, `@KafkaListener`, listener containers. |
| **Spring AMQP** | RabbitMQ | `RabbitTemplate`, `@RabbitListener`, exchanges and queues. |
| **Spring Cloud Stream** | Any broker | Functional beans (`Function`, `Consumer`, `Supplier`), bound to destinations by binders. |
| **Spring JMS**, Spring Integration | JMS brokers, enterprise integration patterns | Templates, listener containers, flows. |

Spring Cloud Stream hides the broker: a `Consumer<TransferCompleted>` bean is bound by configuration. But you still need to understand partitions, groups and retries. Spring Kafka or AMQP used directly gives full control.

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

A **listener container** polls for or receives messages. It deserialises them (JSON with type information, or a schema registry). Then it calls your method on a container thread.

`concurrency` sets the number of consumer threads. For Kafka, more threads than partitions do not help.

### Acknowledgement {#ack}

To **acknowledge** a message is to tell the broker it was handled, so it is not delivered again.

| | Kafka | RabbitMQ |
| --- | --- | --- |
| Concept | Commit the **offset** (the position in the partition). | **ack/nack** each message. |
| Default in Spring | `AckMode.BATCH`: after the records of one poll are processed. | `AUTO`: ack on a normal return; reject on an exception (requeue or dead-letter). |
| Manual | `AckMode.MANUAL` + `Acknowledgment` | `AcknowledgeMode.MANUAL` + channel |
| Rule | Acknowledge **after** the work is done. | The same. |

- Acknowledge before processing, and a crash after the ack **loses** the message.
- Acknowledge after processing, and a crash before the ack gives a **duplicate**.

Duplicates are the accepted trade. This is **at-least-once** delivery.

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

- **Retry in place blocks the partition**: the same message is polled again and again. So keep it short. For longer delays, use **non-blocking retry topics** (`@RetryableTopic`: `transfers-retry-1s`, `-retry-10s`, then `.DLT`), so other messages keep flowing.
- **Classify errors.**
  - *Transient* errors (timeout, deadlock, a 503 from a service you call): retry with backoff.
  - *Permanent* errors (malformed, validation, business rejection): do not retry. Send them straight to the DLT.
- **Dead-letter topic or queue (DLT/DLQ):** keeps the failed message. Its headers hold the exception, the stack trace and the original position (topic, partition, offset). Alert on its size. Provide a tool to inspect messages and **replay** them after the fix.
- **Poison pills:** a message that cannot even be deserialised would loop forever. Use `ErrorHandlingDeserializer`, so the failure becomes a handled error instead of a crash loop.
- **RabbitMQ:** configure `spring.rabbitmq.listener.simple.retry.*`, or a dead-letter exchange on the queue. Set `default-requeue-rejected=false` to avoid endless requeue loops.

### Idempotent consumers {#idempotent}

Duplicates come from redelivery after a crash, from retries and from rebalances. So handlers must tolerate them ([idempotent consumers](lesson:messaging#idempotent)):

```java
@Transactional
void on(TransferCompleted e) {
    if (!processed.markIfNew(e.messageId())) return;      // INSERT ... unique (message_id): duplicate returns false
    ledger.apply(e);                                      // same transaction: both commit or neither
}
```

Or make the operation naturally idempotent: set a state, upsert by key, compare versions.

The message needs a stable **id**: an event id or a business key. Combine this with the outbox on the producer side for effectively-once processing.

## Partitions, groups and ordering {#partitions}

![Kafka consumer groups](images/kafka-consumer-groups.png "Each partition is read by one consumer in a group, so groups scale reading and each group gets every message. | Apache Kafka documentation, Apache-2.0 | https://kafka.apache.org/documentation/")

- A Kafka **topic** has partitions. A **consumer group** shares them: each partition is read by exactly one consumer of the group. So the partition count caps parallelism. Consumers beyond it sit idle.
- **Order is guaranteed only within a partition.** Use the entity id (the account id) as the **message key**. Then all events of one account land in one partition, in order. Events with different keys may be processed in any order relative to each other.
- A **rebalance** happens when an instance joins or leaves. It moves partitions, and redelivers from the last committed offset. Use cooperative rebalancing. Keep the processing time per poll below `max.poll.interval.ms`.
- **RabbitMQ:** **competing consumers** on one queue share the messages, with no ordering by key across consumers. When order matters, use a consistent-hash exchange or one queue per group of keys. Set `prefetch`, so one slow consumer does not hoard messages.
- **Slow consumers:** monitor consumer lag (how many messages behind). Scale instances up to the partition count. Keep handlers short, and push heavy work to another queue.

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

Producer settings for safety:

- `acks=all`,
- `enable.idempotence=true` (no duplicates from retries within a session),
- `retries`,
- a sensible `delivery.timeout.ms`.

But the real problem is the **dual write**. Updating the database and sending a message touch two systems, so one can succeed while the other fails.

### Transactional outbox {#outbox}

1. Write the event into an **outbox table, in the same database transaction** as the business change.
2. A separate **relay** reads new rows, publishes them and marks them sent. It can poll, or use change data capture with Debezium.

Delivery is at-least-once, so consumers stay idempotent. Use it instead of `@TransactionalEventListener(AFTER_COMMIT)` when you cannot afford to lose the message ([outbox pattern](lesson:microservice-patterns#outbox), [after commit](lesson:spring-transactions#events)).

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

Kafka also offers **transactions**, set with `transaction-id-prefix`. They give exactly-once within Kafka, for consume-process-produce flows. They do not make an update in an external database atomic with the send.

## Messages as contracts {#contracts}

- **Schema and evolution:** use JSON with tolerant readers, or Avro/Protobuf with a **schema registry** and compatibility rules. Add optional fields. Never reuse a field or change its type. Include `eventId`, `occurredAt`, a type and a version.
- **Events and commands:** an event states a fact (`TransferCompleted`). A command asks for work (`GenerateStatement`). Name and route them to match.
- **Message size:** keep payloads small. For large data, pass an id or a link (the claim-check pattern).
- **Security:** authenticate and authorise producers and consumers (TLS, SASL, ACLs). Avoid sensitive data in messages that many consumers can read.

## Testing {#testing}

Use **Testcontainers** (`KafkaContainer`, `RabbitMQContainer`) with `@ServiceConnection`, or `@EmbeddedKafka` for quick tests. Publish a message and check the effect with **Awaitility**, not sleeps.

Test the failure paths too ([testing Spring apps](lesson:spring-testing#testcontainers)):

- a poison message lands in the DLT,
- a transient failure is retried,
- **delivering the same message twice has one effect**.

Try it in the lab: [Spring Kafka: partitions, offsets, retry and dead letters](lab:spring-kafka-listener).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Delivery | At-least-once: acknowledge after processing, expect duplicates. |
| Listener | `@KafkaListener`, `@RabbitListener`. Container threads. `concurrency`. |
| Ack | Kafka commits the offset, RabbitMQ acks. Manual for control. |
| Errors | Limited retries with backoff, classify, then dead-letter. |
| Non-blocking retry | `@RetryableTopic` retry topics, then the DLT. |
| Poison pill | `ErrorHandlingDeserializer`. |
| Idempotent consumer | A processed-id table with a unique constraint, in the same transaction. |
| Ordering | Per partition. Key = entity id. |
| Parallelism | Capped by the partitions (Kafka). |
| Producer | `acks=all`, idempotence. A dual write needs the outbox. |
| Outbox | The event row is in the business transaction. A relay publishes it. |
| Tests | Testcontainers, Awaitility, duplicate and poison cases. |

## Interview questions {#questions}

### [basic] What are the main ways to do messaging in Spring? {#options-q}

- **Spring for Apache Kafka:** `KafkaTemplate`, `@KafkaListener`.
- **Spring AMQP** for RabbitMQ: `RabbitTemplate`, `@RabbitListener`.
- **Spring JMS**.
- **Spring Integration**, for integration patterns.
- **Spring Cloud Stream:** binds functional `Consumer`/`Function`/`Supplier` beans to destinations through broker-specific binders, so the code does not depend on the broker.

### [basic] When is a Kafka message acknowledged in a Spring listener? {#ack-q}

When the offset is committed.

- By default (`AckMode.BATCH`), the container commits after all records of a poll were processed successfully.
- With `MANUAL`, you call `Acknowledgment.acknowledge()`.

If the listener throws, the offset is not committed, and the error handler decides whether to retry or dead-letter. Acknowledge after processing, for at-least-once delivery.

### [basic] What is a dead-letter topic (or queue)? {#dlt-q}

It is a place where failed messages are parked: those that still fail after the retries, or that are permanently invalid. They are kept with the exception details, so they neither block the main flow nor get lost.

People alert on it, inspect the messages, fix the cause and replay them.

### [basic] Why must consumers be idempotent? {#idempotent-q}

Brokers deliver at-least-once. A crash before the acknowledgement, a retry or a rebalance delivers a message again. Without idempotency, a duplicate could credit an account twice.

Record processed message ids with a unique constraint, in the same transaction as the work. Or make the operation naturally idempotent: an upsert, or setting a state.

### [intermediate] How do you handle failing messages in Spring Kafka? {#failing-q}

- Configure a `DefaultErrorHandler` with a backoff: limited, exponential retries.
- Add a `DeadLetterPublishingRecoverer`, which publishes to a `.DLT` topic.
- Mark exceptions that are not worth retrying (deserialisation, validation), so they skip the retries.
- Use `@RetryableTopic` for non-blocking, delayed retries, so one bad message does not block the partition.
- Use `ErrorHandlingDeserializer` for poison pills.

### [intermediate] What guarantees ordering and how does key choice affect it? {#ordering-q}

Kafka orders messages only within a partition. The partition is chosen by hashing the message key.

Use the entity id (the account id) as the key. Then all of its events go to one partition, in order, and one consumer at a time reads them. Events with different keys have no order relative to each other.

Adding partitions later changes which partition a key maps to.

### [intermediate] What limits consumer parallelism in Kafka? {#parallelism-q}

The number of partitions. In a consumer group, each partition is assigned to one consumer, so extra consumers sit idle.

To go faster:

- add partitions, planning for peak load,
- use `concurrency` threads,
- keep handlers fast,
- move heavy work off the consumer thread (to another topic or a worker pool), keeping order where needed.

### [intermediate] What is a consumer group rebalance and what is its effect? {#rebalance-q}

When consumers join, leave or fail, the group reassigns the partitions among its members.

- Consumption pauses briefly (less with cooperative rebalancing).
- The new owner resumes from the last committed offset. So messages that were processed but not committed are delivered again.

Hence idempotent handlers. Also, the processing for each poll must finish within `max.poll.interval.ms`, or the consumer is considered dead.

### [intermediate] Why can't you just save to the database and then send a message? {#dual-write-q}

They are two separate systems, with no shared transaction.

- The database commit can succeed and the send fail: the state changed, but no event went out.
- Or the message is sent and the commit fails: an event about something that did not happen.

The transactional outbox writes the event in the same database transaction, and a relay publishes it. That gives at-least-once delivery, without losing events.

### [intermediate] How do you make a producer reliable? {#producer-q}

- `acks=all`: wait for the in-sync replicas.
- `enable.idempotence=true`: no duplicates from producer retries.
- Retries, with a delivery timeout.
- Handle a failed send future.
- Choose keys for ordering.
- Use the outbox, to tie the send to your database transaction.

Also monitor failed sends, and use schemas for compatibility.

### [intermediate] What is the difference between event and command messages? {#event-command-q}

An **event** is a fact that already happened (`TransferCompleted`). It is published to anyone interested, and the producer does not care who listens.

A **command** asks a specific service to do something (`GenerateStatement`). It usually goes to one consumer, and an outcome is expected.

Their names, topics and error handling differ to match.

### [deep] Does Kafka's exactly-once semantics solve duplicates for a Spring service? {#exactly-once-q}

Only inside Kafka. With idempotent producers and transactions, a consume-process-produce flow between topics can be atomic.

It does not cover side effects outside Kafka, such as updating a relational database or calling an API. Those can still run twice on redelivery.

So you still need idempotent consumers or an outbox. In practice, "exactly once" means at-least-once plus idempotency.

### [deep] How would you design replay and reprocessing of dead letters? {#replay-q}

- Keep the original payload and metadata in the DLT.
- Provide an admin tool or job to inspect, filter and republish messages, to the original topic or a replay topic, after the fix.
- Make the replay rate-limited and idempotent.
- Audit who replayed what.
- Keep dead letters long enough, and alert on growth so they are not forgotten.

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

Explain these points:

- Retries block the partition, so they are short and limited.
- Validation errors skip the retries.
- The recoverer adds the exception headers.
- A separate listener or tool consumes `transfers.DLT`.

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

Explain these points:

- The marker and the business update commit in one transaction.
- A redelivery hits the unique constraint and is skipped.
- Old markers are cleaned up after the retention window.

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

Explain these points:

- The event and the state change are atomic.
- After a crash, the relay may publish twice, so consumers remove duplicates by id.
- Order per key follows `createdAt`.
- CDC, such as Debezium, can replace the polling.
