---
title: Reactive Spring WebFlux and Java virtual threads — blocking versus non-blocking
nav: WebFlux and virtual threads
slug: spring-reactive
summary: The thread-per-request model and its limits, reactive programming with Project Reactor (Mono, Flux, backpressure) and Spring WebFlux, the rule never to block the event loop, Java 21 virtual threads in Spring Boot 3.2+, and how to choose between them, with Java examples and interview questions.
tags: [Spring, WebFlux, Reactor, Reactive, Virtual Threads, Concurrency]
order: 86
topic: Spring / Web and security
updated: 2026-11-26
subnav: true
---

"Reactive or blocking, and what about virtual threads?" is a common senior-level question. Expect to explain:

- what problem WebFlux solves,
- what `Mono` and `Flux` are,
- why you must never block the event loop,
- how virtual threads change the answer,
- when you would pick each.

It builds on [Spring MVC](lesson:spring-mvc) (the blocking model), [Java concurrency](lesson:java-concurrency) (threads and executors) and [Spring Cloud](lesson:spring-cloud) (`WebClient`).

The demo has three scenes: thread per request, the reactive event loop, and virtual threads. Each lane is a thread and time runs left to right.

```demo
name: spring-reactive-walk
```

> **One sentence to remember:** *WebFlux never waits, virtual threads make waiting cheap, and virtual threads are usually enough.*

The problem both solve is threads that sit waiting on I/O. WebFlux avoids the wait with a few event-loop threads and callbacks. Virtual threads keep blocking code but make each waiting thread almost free. For a typical CRUD service, virtual threads give most of the benefit with far less complexity.

## The problem: threads that wait {#problem}

Spring MVC on Tomcat uses **thread-per-request**: a thread from a pool serves one request from start to finish.

Most of that time the thread is **blocked, waiting** for a database or an HTTP response. While it waits, it cannot serve anyone else. It also costs about 1 MB of stack, plus scheduling work.

Some numbers: with 200 threads and downstream calls that take 500 ms, the service tops out around 400 requests per second, while the CPU sits idle. When a dependency slows down, every thread fills up with waiting, and the service stops responding even though it is doing no work.

There are three ways out:

- bigger pools, which are limited by memory and context switching,
- **non-blocking reactive code** (WebFlux),
- **cheap threads** (virtual threads).

## Reactive programming {#reactive}

### Reactive streams and Reactor {#reactor}

**Reactive Streams** is a standard for asynchronous streams with **backpressure**. A `Publisher` sends items to a `Subscriber`, and the subscriber says how many it can handle. So a fast producer cannot overwhelm a slow consumer.

**Project Reactor** implements the standard with two types:

| Type | Emits |
| --- | --- |
| `Mono<T>` | 0 or 1 item: a single result, or nothing. |
| `Flux<T>` | 0 to N items: a stream. |

Both are **lazy**: nothing happens until something **subscribes**. A pipeline built from operators is only a description of work. The framework subscribes for you.

```java
Mono<AccountDto> accountWithRate(long id) {
    return accountRepository.findById(id)                                  // Mono<Account>, non-blocking (R2DBC)
        .switchIfEmpty(Mono.error(new AccountNotFoundException(id)))
        .flatMap(a -> rateClient.rate(a.currency())                         // Mono<BigDecimal>: async call, no thread waits
                .timeout(Duration.ofSeconds(2))
                .onErrorReturn(BigDecimal.ONE)                              // fallback
                .map(rate -> new AccountDto(a.id(), a.balance().multiply(rate))));
}
```

Key operators:

- `map` transforms each item.
- `flatMap` runs an asynchronous step that returns another publisher.
- `filter` drops items.
- `zip` combines independent results that run in parallel.
- `concatMap` is like `flatMap`, but keeps the order.
- `onErrorResume`, `retryWhen` and `timeout` handle failure.
- `buffer` and `window` group items.
- `publishOn` and `subscribeOn` choose which scheduler (thread pool) runs the work.

**Errors are signals** that travel down the stream, not thrown exceptions. You cannot put a try/catch around a pipeline.

### Spring WebFlux {#webflux}

WebFlux is Spring's reactive web stack. By default it runs on **Netty** (Undertow and Servlet 3.1+ containers also work). It uses **event-loop** threads, roughly one per CPU core. These few threads handle all requests by never blocking.

```java
@RestController
class AccountController {
    private final AccountService service;

    @GetMapping("/accounts/{id}")
    Mono<AccountDto> get(@PathVariable long id) { return service.accountWithRate(id); }

    @GetMapping(value = "/accounts/{id}/transactions", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    Flux<TxDto> stream(@PathVariable long id) { return service.transactions(id); }          // server-sent events, backpressure aware
}

// or functional endpoints: RouterFunction<ServerResponse> with handler functions
// client: WebClient.create("http://ledger-service").get().uri("/entries").retrieve().bodyToFlux(Entry.class)
```

The model needs a **non-blocking stack from end to end**:

- WebClient, not RestTemplate,
- **R2DBC** or reactive MongoDB and Redis drivers, not JDBC or JPA,
- reactive Spring Security,
- reactive messaging.

One blocking call inside a handler **stalls an event-loop thread, and every request that shares it**. So the rule is: **never block the event loop**.

If you must call blocking code, wrap it with `Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())`. In tests, BlockHound can detect blocking calls.

### Costs of the reactive model {#costs}

- **A different programming style.** You write chains of operators, and you lose ordinary stack traces, so debugging needs `checkpoint()` and `Hooks.onOperatorDebug`. Data travels in the Reactor `Context` instead of ThreadLocals, so transactions, security and the logging MDC need reactive-aware support.
- **A smaller ecosystem.** There are fewer non-blocking drivers. JDBC and JPA are blocking, and R2DBC has fewer features. It takes longer to learn, and testing is harder (`StepVerifier`).
- **The benefit depends on the workload.** It is greatest for **high concurrency with lots of waiting**, for streaming (SSE, WebSocket), for **backpressure**, and for fanning out to many calls and combining the results. It gives **little benefit for CPU-bound work**.

## Virtual threads {#virtual}

**Virtual threads** (Java 21, JEP 444) are lightweight threads. The JVM schedules them onto a small pool of real platform threads, called **carriers**.

When a virtual thread **blocks on I/O** (a socket, JDBC, `sleep`, a lock), the JVM **unmounts** it, and the carrier runs another virtual thread. So waiting costs almost nothing, and you can have millions of virtual threads. Your code stays simple: **blocking and imperative**.

```yaml
spring:
  threads:
    virtual:
      enabled: true          # Boot 3.2+ with Java 21: Tomcat, @Async, @Scheduled and others use virtual threads
```

```java
// a plain blocking controller now scales like a reactive one for I/O waits
@GetMapping("/accounts/{id}")
AccountDto get(@PathVariable long id) {
    Account a = repository.findById(id).orElseThrow();       // blocks the virtual thread only
    BigDecimal rate = rateClient.rate(a.currency());          // so does this
    return new AccountDto(a.id(), a.balance().multiply(rate));
}
```

What to know:

- **Do not pool virtual threads.** Create one per task with `Executors.newVirtualThreadPerTaskExecutor()`. They are cheap, so pooling them defeats the purpose.
- **The real limits move to resources:** the database connection pool (say 20), downstream rate limits, and memory. 10,000 virtual threads waiting for 20 connections still wait. Use **semaphores and bulkheads** to limit concurrency for each resource.
- **Pinning:** in Java 21, a virtual thread that blocks inside a `synchronized` block (or a native frame) **pins** its carrier: it cannot be unmounted, so it holds the carrier. This reduces scalability. Prefer `ReentrantLock` on hot paths, and update your libraries (many are fixed, and Java 24 removes `synchronized` pinning).
- **ThreadLocals still work,** but each virtual thread has its own copy. Avoid large or heavy per-thread state. **ScopedValue** (a preview feature) is the alternative.
- **CPU-bound work gains nothing.** It is limited by the number of cores either way.
- **Familiar tools keep working:** JDBC, JPA, `@Transactional`, `RestClient`, normal stack traces and profilers.

## Choosing {#choosing}

![Spring MVC and WebFlux compared](images/spring-mvc-webflux-venn.png "What Spring MVC and WebFlux share and where they differ. | Spring Framework documentation, Apache-2.0 | https://github.com/spring-projects/spring-framework")

| | Blocking MVC + platform threads | Virtual threads (MVC) | WebFlux |
| --- | --- | --- | --- |
| Code style | Simple and imperative. | Simple and imperative. | Reactive operators. |
| Handles many waits at once | Only up to the pool size. | Yes. | Yes. |
| Libraries | Everything, including JDBC and JPA. | Everything, but watch for pinning. | Non-blocking only, such as R2DBC and WebClient. |
| Debugging and testing | Easy. | Easy. | Harder. |
| Streaming and backpressure | Limited. | Limited. | **Built in.** |
| Memory per request | High. | Low. | Low. |
| Maturity | Highest. | New (Java 21). | Mature. |

Guidance:

- **Start with MVC.**
- **Turn on virtual threads** for I/O-heavy services on Java 21 or later.
- **Choose WebFlux** when you need streaming with backpressure (event streams, SSE, WebSockets), when a reactive pipeline already exists end to end, or when you combine many concurrent calls. Gateways such as Spring Cloud Gateway use WebFlux for this reason.

Do not mix the styles carelessly. Calling blocking JPA from WebFlux handlers is the classic mistake.

Try it in the lab: [Thread-per-request versus the event loop](lab:reactive-event-loop).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Problem | Threads blocked on I/O waste memory and cap throughput. |
| `Mono` / `Flux` | 0 to 1 and 0 to N items. Lazy until subscribed. |
| Backpressure | The subscriber asks for as much as it can take. |
| WebFlux | Netty event loop, few threads, non-blocking end to end. |
| Golden rule | Never block the event loop. BlockHound detects it. |
| Blocking call needed | `subscribeOn(Schedulers.boundedElastic())`. |
| R2DBC | A non-blocking SQL driver. JDBC and JPA are blocking. |
| Virtual threads | Lightweight threads managed by the JVM. Blocking is cheap. |
| Enable | `spring.threads.virtual.enabled=true` (Boot 3.2+, Java 21). |
| Limits remain | Connection pools and downstream capacity. Use bulkheads. |
| Pinning | Blocking inside `synchronized` pins the carrier (Java 21). |
| Choose | MVC with virtual threads by default. WebFlux for streaming and backpressure. |

## Interview questions {#questions}

### [basic] What problem does reactive programming solve? {#problem-q}

It solves threads that are blocked, waiting on I/O.

In the thread-per-request model, each request holds a thread while it waits for databases and services. So the thread pool limits how many requests can run, while the CPU sits idle.

Reactive programming uses a few event-loop threads and non-blocking calls with callbacks. Many requests in progress share those few threads.

### [basic] What are Mono and Flux? {#mono-flux-q}

They are the two publisher types in Reactor:

- `Mono<T>` emits zero or one item (or an error).
- `Flux<T>` emits zero to many items.

Both are lazy descriptions of asynchronous work. Nothing runs until a subscriber subscribes. Spring WebFlux subscribes when it handles the request.

### [basic] What is backpressure? {#backpressure-q}

It is a mechanism in Reactive Streams where the subscriber tells the publisher how many items it can accept (`request(n)`). This stops a fast producer from overwhelming a slow consumer with an endless buffer.

When demand is lower than supply, operators and strategies decide what happens: buffer the extra items, drop them, or keep only the latest.

### [basic] What are virtual threads? {#virtual-q}

They are lightweight threads (Java 21) managed by the JVM instead of the operating system.

They run on a small pool of carrier threads. When one blocks on I/O, it is unmounted, so blocking code can scale to a huge number of tasks at once.

In Spring Boot 3.2 and later you turn them on with `spring.threads.virtual.enabled=true`.

### [intermediate] Why must you never block in WebFlux? {#never-block-q}

The event loop has very few threads, about one per core, and all requests share them.

A blocking call (JDBC, `Thread.sleep`, a blocking HTTP client) holds one of those threads for as long as it takes. Every request scheduled on that thread stalls, and the service soon freezes.

So:

- use non-blocking clients and drivers,
- isolate blocking calls you cannot avoid with `subscribeOn(Schedulers.boundedElastic())`,
- detect mistakes with BlockHound.

### [intermediate] How do virtual threads compare with WebFlux? {#compare-q}

Both let a few OS threads support a huge number of I/O-bound tasks at once.

**Virtual threads** keep ordinary blocking, imperative code. You keep the whole blocking ecosystem (JDBC, JPA, normal stack traces), with much less complexity.

**WebFlux** gives you streaming with backpressure and elegant composition. But it needs a non-blocking stack end to end, and a reactive style.

For typical CRUD services, virtual threads are usually the better default.

### [intermediate] Do virtual threads remove the need for a connection pool or bulkheads? {#limits-q}

No. They remove the thread limit, not the resource limits.

A database connection pool of 20 still allows only 20 queries at once. Downstream services still have limited capacity. So thousands of virtual threads simply wait.

You still need pool sizing, timeouts, semaphores or bulkheads, and rate limits to protect resources.

### [intermediate] What is pinning with virtual threads? {#pinning-q}

In Java 21, a virtual thread that blocks inside a `synchronized` block or a native method cannot be unmounted. It keeps holding its carrier thread. This reduces the concurrency benefit and can starve other virtual threads.

To avoid it:

- do not block for long inside `synchronized`,
- prefer `ReentrantLock`,
- update your libraries,
- diagnose it with `-Djdk.tracePinnedThreads`.

Java 24 removed most `synchronized` pinning.

### [intermediate] When would you still choose WebFlux? {#choose-q}

- For streaming data (server-sent events, WebSockets, long-lived streams) with real backpressure.
- When the whole path is already non-blocking, such as reactive drivers or gateways like Spring Cloud Gateway.
- To combine many concurrent calls declaratively.
- In services with very high fan-out, where its resource use and operators fit well.

### [intermediate] How do you call blocking code from a reactive pipeline? {#blocking-q}

Wrap it so it does not run on the event loop:

`Mono.fromCallable(() -> blockingService.call()).subscribeOn(Schedulers.boundedElastic())`

The bounded elastic scheduler provides threads meant for blocking work.

This is a bridge, not a design. If you rely on it heavily, you lose the advantage of going reactive.

### [deep] How do transactions and security context work in a reactive application? {#context-q}

ThreadLocals do not work, because one request hops between threads.

Instead, Reactor carries a `Context` along the subscription. Spring uses it for the security context and for reactive transactions: `TransactionalOperator`, or `@Transactional` with a `ReactiveTransactionManager` such as the one for R2DBC.

JPA transactions are tied to a thread, so you cannot use them in this model.

### [deep] What are the trade-offs of using ThreadLocal with virtual threads? {#threadlocal-q}

ThreadLocals still work. But with millions of virtual threads, each holding its own copy, large or heavy ThreadLocal state multiplies memory use.

- Prefer passing data explicitly, or ScopedValue (a preview feature).
- Do not cache expensive objects per thread. Use a pool or one shared thread-safe instance instead.
- Clear values when you are done.

### [coding] Convert a blocking lookup to a reactive pipeline with timeout and fallback. {#coding-reactive}

```java
// blocking
AccountView view(long id) {
    Account a = repository.findById(id).orElseThrow();
    BigDecimal rate = rateClient.rate(a.currency());
    return new AccountView(a, rate);
}

// reactive
Mono<AccountView> view(long id) {
    return reactiveRepository.findById(id)
        .switchIfEmpty(Mono.error(new AccountNotFoundException(id)))
        .flatMap(a -> webClient.get().uri("/rates/{c}", a.currency()).retrieve().bodyToMono(BigDecimal.class)
                .timeout(Duration.ofSeconds(1))
                .onErrorReturn(BigDecimal.ONE)
                .map(rate -> new AccountView(a, rate)));
}
```

Explain these points:

- Nothing blocks.
- The timeout and the fallback are part of the stream.
- Errors travel as signals.
- The framework subscribes.

### [coding] Run independent calls in parallel with zip. {#coding-zip}

```java
Mono<Dashboard> dashboard(long customerId) {
    Mono<List<Account>> accounts = accountClient.accounts(customerId).collectList();
    Mono<BigDecimal> fx = rateClient.rate("USD");
    Mono<List<Tx>> recent = txClient.recent(customerId, 10).collectList();

    return Mono.zip(accounts, fx, recent)                          // subscribes to all three at once
               .map(t -> new Dashboard(t.getT1(), t.getT2(), t.getT3()));
}
```

```java
// the same with virtual threads: simple blocking code in structured concurrent tasks
Dashboard dashboard(long id) throws Exception {
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        var accounts = executor.submit(() -> accountClient.accounts(id));
        var fx = executor.submit(() -> rateClient.rate("USD"));
        var recent = executor.submit(() -> txClient.recent(id, 10));
        return new Dashboard(accounts.get(), fx.get(), recent.get());
    }
}
```

Explain these points:

- In both models, the total time is that of the slowest call, not the sum of all three.
- The virtual-thread version keeps ordinary code.

### [coding] Wrap an unavoidable blocking call safely in WebFlux. {#coding-bridge}

```java
@Service
class LegacyBridge {
    Mono<Statement> statement(long id) {
        return Mono.fromCallable(() -> legacyClient.fetchStatement(id))          // blocking SOAP or JDBC call
                   .subscribeOn(Schedulers.boundedElastic())                      // runs off the event loop
                   .timeout(Duration.ofSeconds(5));
    }
}

// test: BlockHound.install() fails the test if a blocking call happens on an event-loop thread
```

Explain these points:

- The callable and the scheduler keep the blocking call off the event loop.
- The elastic pool is bounded, so it cannot grow without limit.
- This is a bridge, not the design you aim for.
