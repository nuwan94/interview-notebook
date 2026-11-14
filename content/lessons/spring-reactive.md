---
title: Reactive Spring WebFlux and Java virtual threads — blocking versus non-blocking
nav: WebFlux and virtual threads
slug: spring-reactive
summary: The thread-per-request model and its limits, reactive programming with Project Reactor (Mono, Flux, backpressure) and Spring WebFlux, the rule never to block the event loop, Java 21 virtual threads in Spring Boot 3.2+, and how to choose between them, with Java examples and interview questions.
tags: [Spring, WebFlux, Reactor, Reactive, Virtual Threads, Concurrency]
order: 43
topic: Spring / Web
updated: 2026-11-13
subnav: true
---

"Reactive or blocking, and what about virtual threads?" is a modern senior-level question: *what problem does WebFlux solve, what are `Mono` and `Flux`, why must you never block the event loop, how do virtual threads change the answer, and when would you pick each?* It builds on [Spring MVC](lesson:spring-mvc) (the blocking model), [Java concurrency](lesson:java-concurrency) (threads and executors) and [Spring Cloud](lesson:spring-cloud) (`WebClient`). Play the three scenes: thread per request, the reactive event loop, and virtual threads.

```demo
name: spring-reactive-walk
```

> **One sentence to remember:** *the problem is threads waiting on I/O; WebFlux solves it by never waiting (a few event-loop threads and callbacks), virtual threads solve it by making waiting cheap (blocking code, millions of threads), and for a typical CRUD service virtual threads give most of the benefit with far less complexity.*

## The problem: threads that wait {#problem}

Spring MVC on Tomcat is **thread-per-request**: a pooled platform thread serves a request from start to finish. Most of that time it is **blocked waiting** for a database or HTTP response, yet it cannot serve anyone else and costs about 1 MB of stack and scheduling work. With 200 threads and 500 ms downstream calls the service tops out around 400 requests per second, while the CPU idles. When a dependency slows down, all threads fill with waiters and the service stops responding even though it is doing no work.

Three responses: bigger pools (limited by memory and context switching), **non-blocking reactive code** (WebFlux), or **cheap threads** (virtual threads).

## Reactive programming {#reactive}

### Reactive streams and Reactor {#reactor}

**Reactive Streams** is a standard for asynchronous streams with **backpressure**: a `Publisher` emits items to a `Subscriber`, and the subscriber requests how many it can handle, so a fast producer cannot overwhelm a slow consumer. **Project Reactor** implements it with two types:

| Type | Emits |
| --- | --- |
| `Mono<T>` | 0 or 1 item (a single result or nothing) |
| `Flux<T>` | 0 to N items (a stream) |

Both are **lazy**: nothing happens until something **subscribes**. A pipeline is a description of work built from operators; the framework subscribes for you.

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

Key operators: `map` (transform), `flatMap` (async step returning a publisher), `filter`, `zip` (combine independent results in parallel), `concatMap` (ordered), `onErrorResume`, `retryWhen`, `timeout`, `buffer`, `window`, `publishOn` and `subscribeOn` (choose the scheduler). **Errors are signals** in the stream, not thrown exceptions; there is no try/catch around a pipeline.

### Spring WebFlux {#webflux}

WebFlux is Spring's reactive web stack, running on **Netty** (default; also Undertow or Servlet 3.1+ containers) with **event-loop** threads, roughly one per CPU core, that handle all requests by never blocking.

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

The model needs a **non-blocking stack end to end**: WebClient (not RestTemplate), **R2DBC** or reactive MongoDB/Redis drivers (not JDBC/JPA), reactive Spring Security, reactive messaging. One blocking call inside a handler **stalls an event-loop thread and every request sharing it**; the rule is **never block the event loop**. If you must call blocking code, wrap it with `Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())`. BlockHound can detect blocking calls in tests.

### Costs of the reactive model {#costs}

- A different programming style: operator chains, no ordinary stack traces (debugging uses `checkpoint()` and `Hooks.onOperatorDebug`), context passed through the `Context` instead of ThreadLocals (transactions, security, MDC need reactive-aware support).
- A smaller ecosystem of non-blocking drivers (JDBC and JPA are blocking; R2DBC has fewer features); learning curve and harder testing (`StepVerifier`).
- Benefit is greatest for **high concurrency with lots of waiting**, streaming (SSE, WebSocket), **backpressure** and fan-out/fan-in composition; **little benefit for CPU-bound work**.

## Virtual threads {#virtual}

**Virtual threads** (Java 21, JEP 444) are lightweight threads scheduled by the JVM onto a small pool of **carrier** platform threads. When a virtual thread **blocks on I/O** (socket, JDBC, `sleep`, a lock), the JVM **unmounts** it and the carrier runs another, so waiting costs almost nothing and you can have millions of them. Code stays simple, **blocking and imperative**.

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

- **Do not pool virtual threads;** create one per task (`Executors.newVirtualThreadPerTaskExecutor()`). They are cheap, pooling them defeats the purpose.
- **The real limits move to resources:** the database connection pool (say 20), downstream rate limits and memory. 10,000 virtual threads waiting for 20 connections still wait. Use **semaphores and bulkheads** to bound concurrency per resource.
- **Pinning:** in Java 21 a virtual thread inside a `synchronized` block (or a native frame) that blocks **pins** its carrier thread, reducing scalability. Prefer `ReentrantLock` on hot paths, and update libraries (many fixed; Java 24 removes `synchronized` pinning).
- **ThreadLocals** work but each virtual thread has its own copy: avoid large or heavy per-thread state; **ScopedValue** (preview) is the alternative.
- **CPU-bound work gains nothing:** it is limited by cores either way.
- Familiar tools keep working: JDBC, JPA, `@Transactional`, `RestClient`, normal stack traces and profilers.

## Choosing {#choosing}

![Spring MVC and WebFlux compared](images/spring-mvc-webflux-venn.png "What Spring MVC and WebFlux share and where they differ. | Spring Framework documentation, Apache-2.0 | https://github.com/spring-projects/spring-framework")

| | Blocking MVC + platform threads | Virtual threads (MVC) | WebFlux |
| --- | --- | --- | --- |
| Code style | simple, imperative | simple, imperative | reactive operators |
| Handles many concurrent waits | limited by pool size | yes | yes |
| Libraries | everything (JDBC, JPA) | everything (watch pinning) | non-blocking only (R2DBC, WebClient) |
| Debugging and testing | easy | easy | harder |
| Streaming and backpressure | limited | limited | **native** |
| Memory per request | high | low | low |
| Maturity | highest | new (Java 21) | mature |

Guidance: **start with MVC; turn on virtual threads** for I/O-heavy services on Java 21+; choose **WebFlux** when you need streaming with backpressure (event streams, SSE, WebSockets), an end-to-end reactive pipeline already exists, or you compose many concurrent calls elegantly (gateways such as Spring Cloud Gateway are WebFlux for this reason). Do not mix styles carelessly: calling blocking JPA from WebFlux handlers is the classic mistake.

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Problem | threads blocked on I/O waste memory and cap throughput |
| `Mono` / `Flux` | 0..1 and 0..N items; lazy until subscribed |
| Backpressure | subscriber requests how much it can take |
| WebFlux | Netty event loop, few threads, non-blocking end to end |
| Golden rule | never block the event loop (BlockHound to detect) |
| Blocking call needed | `subscribeOn(Schedulers.boundedElastic())` |
| R2DBC | non-blocking SQL driver; JDBC/JPA are blocking |
| Virtual threads | JVM-managed lightweight threads; blocking is cheap |
| Enable | `spring.threads.virtual.enabled=true` (Boot 3.2+, Java 21) |
| Limits remain | connection pools, downstream capacity: bulkheads |
| Pinning | blocking in `synchronized` pins the carrier (Java 21) |
| Choose | MVC + virtual threads by default; WebFlux for streaming and backpressure |

## Interview questions {#questions}

### [basic] What problem does reactive programming solve? {#problem-q}

Threads blocked waiting on I/O. In the thread-per-request model each request holds a thread while waiting for databases and services, so the thread pool limits concurrency while the CPU idles. Reactive programming uses a few event-loop threads and asynchronous, non-blocking calls with callbacks, so many concurrent requests share few threads.

### [basic] What are Mono and Flux? {#mono-flux-q}

The two Reactor publisher types. `Mono<T>` emits zero or one item (or an error), `Flux<T>` emits zero to many. They are lazy descriptions of asynchronous work: nothing executes until a subscriber subscribes, and Spring WebFlux subscribes when handling the request.

### [basic] What is backpressure? {#backpressure-q}

A mechanism in Reactive Streams where the subscriber tells the publisher how many items it can accept (`request(n)`), so a fast producer cannot overwhelm a slow consumer with unbounded buffering. Operators and strategies (buffer, drop, latest) define behaviour when demand is lower than supply.

### [basic] What are virtual threads? {#virtual-q}

Lightweight threads (Java 21) managed by the JVM instead of the OS. They run on a small pool of carrier threads and are unmounted when they block on I/O, so a blocking style scales to very large numbers of concurrent tasks. In Spring Boot 3.2+ you enable them with `spring.threads.virtual.enabled=true`.

### [intermediate] Why must you never block in WebFlux? {#never-block-q}

The event loop has few threads (about one per core) shared by all requests. A blocking call (JDBC, `Thread.sleep`, a blocking HTTP client) occupies one for its duration, stalling every request scheduled on it and quickly freezing the service. Use non-blocking clients and drivers, or isolate unavoidable blocking calls with `subscribeOn(Schedulers.boundedElastic())`, and detect violations with BlockHound.

### [intermediate] How do virtual threads compare with WebFlux? {#compare-q}

Both let a small number of OS threads support huge concurrency of I/O-bound work. Virtual threads keep ordinary blocking, imperative code and the whole blocking ecosystem (JDBC, JPA, normal stack traces) at much lower complexity. WebFlux gives streaming with backpressure and elegant composition, but requires a non-blocking stack end to end and a reactive style. For typical CRUD services virtual threads are usually the better default.

### [intermediate] Do virtual threads remove the need for a connection pool or bulkheads? {#limits-q}

No. They remove the thread limit, not the resource limits. A database connection pool of 20 still bounds concurrent queries, and downstream services still have capacity limits, so thousands of virtual threads simply wait. You need pool sizing, timeouts, semaphores or bulkheads, and rate limits to protect resources.

### [intermediate] What is pinning with virtual threads? {#pinning-q}

When a virtual thread blocks while inside a `synchronized` block or a native method (Java 21), it cannot be unmounted and holds its carrier thread, reducing the concurrency benefit and risking starvation. Avoid long blocking inside `synchronized`, prefer `ReentrantLock`, update libraries, and diagnose with `-Djdk.tracePinnedThreads`. Java 24 removed most `synchronized` pinning.

### [intermediate] When would you still choose WebFlux? {#choose-q}

For streaming data (server-sent events, WebSockets, long-lived streams) with real backpressure, when the whole path is already non-blocking (reactive drivers, gateways such as Spring Cloud Gateway), for composing many concurrent calls declaratively, and in very high fan-out services where its resource profile and operators fit.

### [intermediate] How do you call blocking code from a reactive pipeline? {#blocking-q}

Wrap it so it does not run on the event loop: `Mono.fromCallable(() -> blockingService.call()).subscribeOn(Schedulers.boundedElastic())`. The bounded elastic scheduler provides threads meant for blocking work. It is a bridge, not a design: heavy reliance on it loses reactive's advantage.

### [deep] How do transactions and security context work in a reactive application? {#context-q}

ThreadLocals do not work because a request hops between threads. Reactor propagates a `Context` along the subscription, and Spring uses it for the security context and reactive transactions (`TransactionalOperator`, `@Transactional` with a `ReactiveTransactionManager` such as R2DBC's). JPA transactions are bound to a thread and are not usable in this model.

### [deep] What are the trade-offs of using ThreadLocal with virtual threads? {#threadlocal-q}

ThreadLocals still work, but with millions of virtual threads each holding its own copy, large or heavy ThreadLocal state multiplies memory. Prefer passing data explicitly or ScopedValue (preview), avoid caching expensive objects per thread (use a pool or shared thread-safe instance), and clear values when done.

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

Explain that nothing blocks, the timeout and fallback are part of the stream, errors flow as signals, and the framework subscribes.

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

Explain that the total latency is the slowest call, not the sum, in both models, and that the virtual-thread version keeps ordinary code.

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

Explain that the callable and scheduler isolate blocking from the event loop, that the elastic pool is bounded so it cannot grow without limit, and why this is a bridge rather than the target design.
