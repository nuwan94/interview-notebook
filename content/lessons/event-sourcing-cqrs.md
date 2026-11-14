---
title: Event sourcing and CQRS — commands, events, projections and eventual consistency
nav: Event sourcing and CQRS
slug: event-sourcing-cqrs
summary: How event sourcing and CQRS work and when to use them: commands, events and aggregates, the event store with optimistic concurrency and snapshots, projections and read models, eventual consistency, event versioning and upcasting, corrections and privacy, publishing events, testing and Axon, with Java examples and interview questions.
tags: [Microservices, Event sourcing, CQRS, Events, Projections, Axon, Consistency]
order: 32
topic: Microservices / State and coordination
updated: 2026-11-14
subnav: true
---

Event sourcing and CQRS come up whenever an interviewer asks about audit trails, ledgers or scaling reads: *what is the difference between a command and an event, how do you handle two writers on one account, how do you rebuild a read model, what do you do when an event changes shape, and when would you not use any of this?* This lesson goes deeper than the overview in [state management](lesson:microservice-state). It connects to the [saga pattern](lesson:saga) (processes that span services), [messaging](lesson:messaging) (how events travel), [microservice patterns](lesson:microservice-patterns) (database per service and the outbox), and [distributed systems](lesson:distributed-systems) (consistency). Play the five scenes: commands and events, the event store, read models, eventual consistency, and changing events.

```demo
name: event-sourcing-walk
```

> **One sentence to remember:** *store what happened as immutable events, derive the current state and every read model from them, and accept that the read side is eventually consistent; use it where history and audit matter, not for ordinary CRUD.*

## The idea in one example {#idea}

A normal account table stores `balance = 80`. Each update overwrites the last, and the reason for the number is gone. With **event sourcing** you store the changes instead:

| Version | Event | Balance after |
| --- | --- | --- |
| 1 | `AccountOpened` | 0 |
| 2 | `MoneyDeposited 100` | 100 |
| 3 | `MoneyWithdrawn 20` | 80 |

The balance is not stored; it is **computed by replaying the events**. The list of events is the source of truth. Because nothing is overwritten you can answer "what was the balance last Tuesday?", prove how it got here, and feed the same events to other systems. A bank ledger works this way already: you never erase a transaction, you add a correcting one.

**CQRS** (Command Query Responsibility Segregation) is a separate idea that fits well with it: use one model to **handle commands** (writes with business rules) and other models to **answer queries** (reads shaped for screens). The two can use different code, different tables and even different databases.

You can use either one without the other. Event sourcing without CQRS makes queries hard, because you can only read by replaying a stream, so in practice they are paired.

## Commands, events and aggregates {#commands}

| | Command | Event |
| --- | --- | --- |
| Meaning | a request to do something | a fact that already happened |
| Name | imperative: `WithdrawMoney` | past tense: `MoneyWithdrawn` |
| Can be refused | yes (rules, validation) | no, it is history |
| Stored | no | yes, forever |
| Receivers | exactly one handler | any number of listeners |

An **aggregate** (from domain-driven design) is the object that owns the rules for one business entity, such as an account, and is the unit of consistency: one command changes one aggregate in one transaction. The flow for each command is:

1. **Load** the aggregate by replaying its events (from a snapshot if there is one).
2. **Check the rules** against the current state; reject the command if they fail.
3. **Produce one or more events** and append them to the event store.
4. **Publish** the events so projections and other services can react.

The aggregate's `apply` method that changes state from an event must **never fail and never decide anything**. All decisions happen before the event is created, so replaying old events is always safe.

## The event store {#store}

An event store keeps **one ordered stream per aggregate**, append-only. It can be a plain relational table, an event database such as EventStoreDB, or an Axon Server; a Kafka topic can carry events but is not a good store for per-aggregate loading and concurrency checks.

```sql
CREATE TABLE event (
  stream_id   VARCHAR(64)  NOT NULL,   -- the aggregate, e.g. account-42
  version     INT          NOT NULL,   -- 1, 2, 3 ...
  type        VARCHAR(100) NOT NULL,
  payload     JSONB        NOT NULL,
  occurred_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, version)     -- the unique key is the concurrency check
);
```

**Optimistic concurrency.** Two requests may load the same aggregate at version 3 and both try to append version 4. The primary key lets only one succeed; the other gets a conflict, reloads, runs the rules again and retries. No locks are held while the command is being decided.

**Snapshots.** Long streams are slow to replay, so every N events the aggregate's state is saved with its version. Loading means "latest snapshot, then the events after it". A snapshot is only a cache: it can be deleted and rebuilt from the events.

## Projections and read models {#projections}

A **projection** (or projector, event handler) listens to events and maintains a **read model**: a table, document or index shaped for one question. One stream can feed many read models, each in a suitable store (a relational table for statements, Elasticsearch for search, Redis for a mobile balance).

Rules for good projections:

- **Idempotent.** Delivery is at least once, so applying an event twice must be harmless. Store the last processed position (a **checkpoint**) in the same transaction as the update, and skip events you have already applied.
- **Ordered per aggregate.** Process the events of one stream in order; different streams can run in parallel.
- **Rebuildable.** A bug or a new question is solved by dropping the read model and replaying all events from the start. This is one of the biggest benefits, and the reason events must be kept.
- **Own data only.** A projection reads events, not other services' databases.

## Eventual consistency {#consistency}

The read model is updated **after** the event is stored, so a screen that reads straight after a write may see old data for a short time. Ways to deal with it:

- **Return the version** with the command result and let the query wait until the read model has reached it.
- **Optimistic UI:** show the expected result from the command response, marked pending, and confirm it when the read model catches up.
- **Read from the write side** for decisions that must be exact (approving a payment, checking a limit): load the aggregate, never use a view that may lag.
- **Design the user experience for it:** "Your deposit is being processed" is honest and fine for most screens.

This is the same trade-off as in [ACID vs BASE](lesson:acid-base): the write side keeps strong consistency inside an aggregate, and the system as a whole is eventually consistent.

## Publishing events and processes across services {#publishing}

Other services need the events too. Publishing must not disagree with storing:

- If the event store is also the source of the stream (EventStoreDB, Axon Server), subscribers read from it directly.
- If the events are in your own database, use the **transactional outbox**: write the event and an outbox row in one transaction, and a relay publishes outbox rows to Kafka or RabbitMQ. This is the same pattern used with [sagas](lesson:saga).

A **saga** can be driven by events: each service reacts to an event and emits the next one (choreography), or an orchestrator listens for events and sends commands. Events from the event store become the glue, but keep a clear line between **internal events** (the aggregate's own detailed history) and **integration events** (stable, public messages for other services) so you can change internals without breaking consumers.

## Changing events over time {#evolution}

Events live forever, so their design needs care.

- **Never edit or delete an event.** Fix a mistake with a **new compensating event** (for example `WithdrawalReversed`). The history keeps both, which is what auditors expect.
- **Versioning.** Give each event a type and a version. Make changes backward compatible when you can (add optional fields). When you cannot, write an **upcaster** that converts an old version to the current shape as events are read, so handlers only know the newest version.
- **Naming.** Name events after business facts (`LoanApproved`), not table changes (`LoanStatusUpdated`). Fact-based events survive refactoring.
- **Personal data.** An immutable log clashes with the right to erase. Keep personal data out of events (store a reference and keep the data in a deletable table), or encrypt it with a key per customer and delete the key (**crypto-shredding**).

## Event sourcing in Java and Spring {#spring}

A hand-written aggregate is small (see the coding questions). Many teams use the **Axon Framework**, which gives annotations for aggregates, command and event handlers, an event store (Axon Server or a database), snapshots and projections, and works with Spring Boot.

```java
@Aggregate
class Account {
    @AggregateIdentifier private String id;
    private BigDecimal balance = BigDecimal.ZERO;

    protected Account() {}                                    // required for replay

    @CommandHandler
    Account(OpenAccount cmd) {                               // creates the aggregate
        AggregateLifecycle.apply(new AccountOpened(cmd.accountId()));
    }

    @CommandHandler
    void handle(WithdrawMoney cmd) {                          // decision: may be refused
        if (balance.compareTo(cmd.amount()) < 0) throw new IllegalStateException("insufficient funds");
        AggregateLifecycle.apply(new MoneyWithdrawn(id, cmd.amount()));
    }

    @EventSourcingHandler
    void on(AccountOpened e) { this.id = e.accountId(); }     // state change only: never fails

    @EventSourcingHandler
    void on(MoneyWithdrawn e) { this.balance = balance.subtract(e.amount()); }
}

@Component
class BalanceProjection {
    private final BalanceRepository balances;

    @EventHandler
    void on(MoneyWithdrawn e) {                               // updates the read model
        balances.findById(e.accountId()).ifPresent(b -> b.subtract(e.amount()));
    }

    @QueryHandler
    BalanceView find(GetBalance q) { return balances.view(q.accountId()); }
}
```

**Testing** is a strength: aggregates are tested as *given events, when a command, then expected events*, with no database. Axon's `AggregateTestFixture` does this: `fixture.given(new AccountOpened("42"), new MoneyDeposited("42", 100)).when(new WithdrawMoney("42", 150)).expectException(IllegalStateException.class)`.

## When to use it and when not to {#when}

| Good fit | Poor fit |
| --- | --- |
| ledgers, payments, trading: audit and history are the product | simple CRUD admin screens |
| need to rebuild past state or fix a projection by replay | a team new to the pattern with a short deadline |
| many different read shapes from the same facts | strong immediate consistency needed everywhere |
| events already drive other services | data that is mostly personal and must be erased on request |

Costs to name in an interview: eventual consistency, more components to run, event versioning, a steeper learning curve, harder ad-hoc queries (you need read models), and privacy handling. A sensible path is to start with CQRS-style separate reads (or just an outbox and an audit table) and adopt full event sourcing only for the aggregates that need it.

## Cheat sheet {#cheatsheet}

| Term | One line |
| --- | --- |
| Command | request to change something; can be refused |
| Event | immutable fact in the past tense; stored forever |
| Aggregate | owns the rules and is the consistency boundary |
| Event store | append-only stream per aggregate, unique `(stream, version)` |
| Expected version | optimistic concurrency check on append |
| Snapshot | cached state at a version; only an optimisation |
| Projection | event listener that builds a read model; idempotent and rebuildable |
| Checkpoint | last event position a projection has processed |
| Upcaster | converts old event versions to the current shape on read |
| Compensating event | how you correct history without editing it |
| Eventual consistency | the read side lags the write side by a short time |
| Crypto-shredding | delete a key so encrypted personal data becomes unreadable |

## Interview questions {#questions}

### [basic] What is event sourcing? {#event-sourcing-q}

Storing every change to an entity as an immutable event in an append-only log, instead of storing only the current state. The current state is computed by replaying the events. You get a full history and audit trail, can rebuild state at any point in time, and can feed other systems from the same events.

### [basic] What is the difference between a command and an event? {#command-vs-event-q}

A command is a request to do something, in the imperative (`WithdrawMoney`), and it can be rejected. An event is a fact that has already happened, in the past tense (`MoneyWithdrawn`), and it can never be rejected or changed. Commands have one handler; events can have many listeners.

### [basic] What is CQRS? {#cqrs-q}

Command Query Responsibility Segregation: separate models for changing data (commands, with business rules) and reading data (queries, shaped for screens). Each side can be designed, stored and scaled on its own. It is a separate idea from event sourcing, though they are often combined.

### [basic] Do you always need event sourcing with CQRS, or the other way around? {#independent-q}

No. CQRS can be used with an ordinary database: write to normal tables and keep a separate read model fed by changes. Event sourcing can exist without CQRS, but then reading anything other than "one aggregate by id" means replaying events, so read models are almost always added.

### [intermediate] What is an aggregate? {#aggregate-q}

A cluster of objects treated as one unit with a single root that enforces the business rules, such as an account. It is the consistency boundary: a command changes one aggregate in one transaction, and in event sourcing each aggregate has its own event stream. Keep aggregates small, and refer to other aggregates by id, not by object.

### [intermediate] How does the event store prevent two writers from corrupting one aggregate? {#concurrency-q}

With optimistic concurrency. Each event in a stream has a version, and the store has a unique key on (stream id, version). A writer appends with the version it expects next. If another writer got there first, the unique key rejects the second append, which then reloads the stream, reruns the rules and retries. No locks are held during the decision.

### [intermediate] What is a snapshot and is it required? {#snapshot-q}

A saved copy of an aggregate's state at some version, so loading means snapshot plus the events after it instead of the whole history. It is an optimisation, not a source of truth, so it is not required and can be deleted and rebuilt. Add it only when replaying a stream becomes measurably slow.

### [intermediate] What is a projection and how do you make it reliable? {#projection-q}

A listener that turns events into a read model. Make it idempotent, because delivery is at least once: save the last processed position (checkpoint) in the same transaction as the update and skip events already applied. Process one stream's events in order, and design it so the read model can be dropped and rebuilt by replaying all events.

### [intermediate] How do you rebuild a read model? {#rebuild-q}

Create the new read model (or empty the old one), reset its checkpoint to the start, and replay all events through the projector, usually while the old model still serves traffic. When it catches up to the live position, switch reads to it. This is how bugs are fixed and new views added, and it is the main reason events are kept forever.

### [intermediate] What is eventual consistency here and how do you handle it in the UI? {#eventual-q}

After a command the event is stored immediately but the read model is updated a moment later, so a read straight after may show old data. Options: return the new version in the command result and let the query wait for it; show the result optimistically as pending; or tell the user it is processing. Do not use the read model for decisions that need exact data; use the aggregate.

### [intermediate] How do you correct a wrong event? {#correction-q}

You never edit or delete it, because other consumers may already have acted on it. Append a compensating event that corrects it, such as `WithdrawalReversed` followed by the right `MoneyWithdrawn`. The history then shows what happened and what was fixed, which is what auditors want, and projections handle the new events like any other.

### [intermediate] How do you publish events to other services reliably? {#publish-q}

The database change and the message must not disagree. Use the transactional outbox: write the event and an outbox row in the same transaction, and a separate relay publishes outbox rows to Kafka or RabbitMQ, at least once, with consumers made idempotent. If the event store itself provides subscriptions (EventStoreDB, Axon Server), consumers read from it directly.

### [intermediate] What is the difference between internal and integration events? {#integration-q}

Internal events are the fine-grained history of one aggregate and may change as the model changes. Integration events are stable, deliberately designed messages for other services. Publishing internal events directly couples consumers to your internals, so many teams translate them into integration events at the boundary.

### [deep] How do you handle a change in an event's structure? {#versioning-q}

Events are immutable, so old ones stay in the old shape. Give each event a type and version, prefer backward-compatible changes (add optional fields), and for incompatible ones write an upcaster that converts old versions to the current shape when events are read, so handlers only see the newest version. Another option is to write new event types and keep handling both.

### [deep] How do you reconcile an immutable log with the right to be forgotten? {#gdpr-q}

Keep personal data out of events where possible: store a reference (customer id) and keep the data in a normal table that can be deleted. When data must be in events, encrypt it with a key per customer and delete the key on request (crypto-shredding), which leaves the events present but the personal data unreadable. Decide this before the first event is stored, because it is hard to add later.

### [deep] Why is Kafka not an ideal event store for event sourcing? {#kafka-q}

Kafka is excellent for distributing events, but an event store must load all events of one aggregate quickly and reject concurrent appends. Kafka topics are partitioned by key, not indexed per aggregate, and there is no built-in "append if the expected version matches" check. Use a database table, EventStoreDB or Axon Server as the store, and Kafka to publish events to other services.

### [deep] When would you advise against event sourcing? {#against-q}

For simple CRUD where history does not matter, when the team has no experience and the deadline is tight, when strongly consistent reads are needed everywhere, or when data is largely personal and must be erased. Event sourcing adds eventual consistency, event versioning, more infrastructure and ad-hoc query difficulty. A cheaper step is an audit table or CQRS with an ordinary database, and event sourcing only for the few aggregates where history is the product.

### [coding] Write an event-sourced account aggregate in plain Java. {#coding-aggregate}

```java
sealed interface AccountEvent permits AccountOpened, MoneyDeposited, MoneyWithdrawn {}
record AccountOpened(String accountId) implements AccountEvent {}
record MoneyDeposited(BigDecimal amount) implements AccountEvent {}
record MoneyWithdrawn(BigDecimal amount) implements AccountEvent {}

class Account {
    private String id;
    private BigDecimal balance = BigDecimal.ZERO;
    private int version;                                        // number of events applied
    private final List<AccountEvent> uncommitted = new ArrayList<>();

    static Account replay(List<AccountEvent> history) {
        Account account = new Account();
        history.forEach(account::apply);                        // state = fold of the events
        return account;
    }

    void withdraw(BigDecimal amount) {                          // command: decide first
        if (amount.signum() <= 0) throw new IllegalArgumentException("amount must be positive");
        if (balance.compareTo(amount) < 0) throw new IllegalStateException("insufficient funds");
        AccountEvent event = new MoneyWithdrawn(amount);
        apply(event);
        uncommitted.add(event);
    }

    private void apply(AccountEvent event) {                    // never fails, never decides
        switch (event) {
            case AccountOpened e -> id = e.accountId();
            case MoneyDeposited e -> balance = balance.add(e.amount());
            case MoneyWithdrawn e -> balance = balance.subtract(e.amount());
        }
        version++;
    }

    int version() { return version; }
    List<AccountEvent> uncommitted() { return uncommitted; }
}
```

Explain that commands check rules and produce events, `apply` only changes state so replay is safe, the current balance is the fold of the history, and the caller appends `uncommitted()` to the store with the expected version.

### [coding] Append events with an expected-version check. {#coding-append}

```java
@Repository
class JdbcEventStore {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    @Transactional
    void append(String streamId, int expectedVersion, List<AccountEvent> events) {
        int version = expectedVersion;
        for (AccountEvent event : events) {
            version++;
            try {
                jdbc.update("INSERT INTO event (stream_id, version, type, payload) VALUES (?, ?, ?, ?::jsonb)",
                    streamId, version, event.getClass().getSimpleName(), toJson(event));
            } catch (DuplicateKeyException e) {                  // someone appended this version first
                throw new ConcurrentModificationException("stream " + streamId + " changed, retry");
            }
        }
    }

    List<StoredEvent> load(String streamId) {
        return jdbc.query("SELECT version, type, payload FROM event WHERE stream_id = ? ORDER BY version",
            (rs, i) -> new StoredEvent(rs.getInt("version"), rs.getString("type"), rs.getString("payload")), streamId);
    }

    private String toJson(Object o) {
        try { return mapper.writeValueAsString(o); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
}
```

Explain that the primary key on `(stream_id, version)` is the concurrency check, that a duplicate key means another writer won so the caller reloads and retries, and that all events of one command go in one transaction. In real code the event type and payload mapping would use a registry, not `getSimpleName`.

### [coding] Write an idempotent projection with a checkpoint. {#coding-projection}

```java
@Component
class BalanceProjector {
    private final JdbcTemplate jdbc;

    @Transactional
    public void handle(long position, String accountId, AccountEvent event) {
        Long last = jdbc.queryForObject("SELECT COALESCE(MAX(position), 0) FROM projection_checkpoint WHERE name = 'balance'", Long.class);
        if (position <= last) return;                            // already applied: skip the duplicate

        switch (event) {
            case MoneyDeposited e -> jdbc.update("UPDATE balance_view SET balance = balance + ? WHERE account_id = ?", e.amount(), accountId);
            case MoneyWithdrawn e -> jdbc.update("UPDATE balance_view SET balance = balance - ? WHERE account_id = ?", e.amount(), accountId);
            case AccountOpened e -> jdbc.update("INSERT INTO balance_view (account_id, balance) VALUES (?, 0)", accountId);
        }
        jdbc.update("INSERT INTO projection_checkpoint (name, position) VALUES ('balance', ?)", position);   // same transaction
    }
}
```

Explain that the checkpoint and the view update commit together so a crash cannot apply an event without recording it, that a repeated position is skipped (idempotent), and that rebuilding means truncating `balance_view` and the checkpoint and replaying from position 1.
