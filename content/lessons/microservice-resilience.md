---
title: Resilience in microservices — timeouts, retries, circuit breakers, bulkheads and load shedding
nav: Resilience
slug: microservice-resilience
summary: How to design services that survive failure: why failures cascade, timeouts and deadlines, retries with backoff, jitter and budgets, circuit breakers, bulkheads, rate limiting, load shedding and backpressure, graceful degradation, health checks and Kubernetes probes, chaos testing, and Resilience4j in Spring Boot, with Java examples and interview questions.
tags: [Microservices, Resilience, Circuit breaker, Retry, Bulkhead, Timeout, Resilience4j, Load shedding]
order: 28
topic: Microservices / Communication
updated: 2026-11-14
subnav: true
---

"What happens when the card service is slow?" is the question behind most resilience interviews. The answer is not "add a circuit breaker" but a set of linked ideas: *every call has a timeout, retries are limited and safe, a breaker stops hammering a sick service, bulkheads keep one dependency from using everything, overload is refused early, and the user gets a reduced answer instead of an error.* This lesson explains each, how they fit together, and how to configure them. It goes beyond the overview in [microservice patterns](lesson:microservice-patterns) and the library tour in [Spring Cloud](lesson:spring-cloud). It relates to [communication](lesson:microservice-communication) (the calls being protected), [messaging](lesson:messaging) (buffering and backpressure), [observability](lesson:spring-observability) (seeing failures), [Kubernetes](lesson:kubernetes) (probes and autoscaling) and [idempotency in state management](lesson:microservice-state) (what makes retries safe). Play the five scenes: timeouts and retries, the circuit breaker, bulkheads, load shedding, and graceful degradation.

```demo
name: resilience-walk
```

> **One sentence to remember:** *assume every remote call can be slow, fail or fail halfway: bound its time, retry only what is safe and only a little, stop calling what keeps failing, isolate dependencies from each other, refuse work you cannot handle, and degrade instead of dying.*

## Why failures cascade {#cascade}

In a monolith a method call either returns or throws. Over a network a call can also be **slow**, **lost**, or **succeed without the caller finding out**. Slow is the most dangerous: a failing service fails fast and is easy to handle, but a slow one holds threads and connections in every caller, which become slow in turn. The slowness travels up the call chain (a **cascading failure**) until the whole system stops, often triggered by a minor, non-critical dependency.

The maths is unforgiving. If a request needs five services that are each 99.9 percent available, the request succeeds only about 99.5 percent of the time. And **retries multiply load** on a service that is already struggling.

So resilience patterns have two aims: **fail fast** (do not hold resources waiting for something that will not answer) and **contain** (stop one failure from spreading).

## Timeouts and deadlines {#timeouts}

The first rule: **no remote call without a timeout.** Defaults are often infinite or very long. Set both:

- **connect timeout:** how long to wait to establish a connection (short: 1 second);
- **read (response) timeout:** how long to wait for the answer (based on the real latency, for example the 99th percentile times two).

Work out a **timeout budget**. If the user will wait 3 seconds and the call chain is gateway → payment → card, then the card timeout must be shorter than the payment timeout, which must be shorter than the gateway's. If the inner timeout is longer, the outer caller gives up while the inner work continues, wasting resources. Some systems propagate a **deadline** (the absolute time by which the answer is useful) in a header, and each service uses the time that remains.

```java
@Bean
RestClient cardClient(RestClient.Builder builder) {
    var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(1)).build());
    factory.setReadTimeout(Duration.ofSeconds(2));           // never wait forever
    return builder.baseUrl("http://card-service").requestFactory(factory).build();
}
```

## Retries {#retries}

Many failures are **transient**: a dropped connection, a brief overload, a failover. A retry often succeeds. But retries are dangerous when done carelessly:

- Retry only **idempotent** operations (or those with an idempotency key); a retried `POST /payments` can charge twice.
- Retry only **retryable errors**: timeouts, connection errors, `503`, `429`. Never retry `400`, `401`, `404`: they will fail again.
- Use **exponential backoff** (100 ms, 200 ms, 400 ms) with **jitter** (random variation), so a thousand clients do not retry in step.
- **Cap** attempts (two or three) and total time.
- Retry at **one layer**. If three layers each retry three times, one request can become 27 calls, a **retry storm** that finishes off a recovering service. Use a **retry budget** (for example extra calls at most 10 percent of normal traffic).

A related technique is the **hedged request**: if no answer comes in the typical time, send a second request to another instance and use the first reply. It cuts tail latency, at the cost of extra load, and is for idempotent reads only.

## Circuit breaker {#breaker}

A circuit breaker wraps calls to a dependency and tracks outcomes over a sliding window. It has three states:

| State | Behaviour |
| --- | --- |
| **Closed** | calls pass through; failures are counted |
| **Open** | calls fail immediately (or use a fallback) for a wait time; the dependency is left alone |
| **Half-open** | after the wait a few trial calls are allowed; success closes the breaker, failure opens it again |

It trips when the **failure rate** (for example 50 percent) or the **slow-call rate** exceeds a threshold, with a **minimum number of calls** so that two failures out of three do not open it. Decide what counts as a failure: timeouts and server errors, yes; business errors such as "insufficient funds", no.

Benefits: callers get instant answers instead of timeouts, threads are freed, and the sick service gets quiet to recover. A breaker per dependency (not one global one) is the usual design. Always pair it with a sensible **fallback**.

## Bulkheads {#bulkhead}

Named after the watertight walls in a ship, a bulkhead limits how much of your resources one dependency can use, so that a slow dependency cannot starve the rest. Two forms:

- **Thread-pool bulkhead:** each dependency has its own pool and queue; calls run on those threads.
- **Semaphore bulkhead:** a limit on **concurrent calls** to the dependency; extra calls are rejected at once. Cheaper, and the choice with virtual threads or reactive code.

Bulkheads also apply to **connection pools** per downstream host, **per-tenant or per-client** limits, and separate deployments for critical and non-critical traffic (for example batch work on its own instances).

## Rate limiting, load shedding and backpressure {#load}

These protect a service from too much work:

- **Rate limiting** caps requests per client or per API key (token bucket or sliding window), so one noisy caller cannot use everyone's capacity. Return `429 Too Many Requests` with a `Retry-After` header.
- **Load shedding** refuses excess work when the service itself is overloaded, keeping queues short so the accepted requests are fast. Shed by **priority**: keep payments, drop reports first.
- **Backpressure** pushes the pressure back to the producer: bounded queues, a reactive stream that requests only what it can handle, a consumer that reads at its own pace, a broker such as Kafka that buffers a spike.
- **Autoscaling** adds capacity, but takes minutes; shedding and queues cover the gap.

An **unbounded queue** is a hidden outage: it hides overload until memory runs out and every request is too old to matter. Bound queues and reject.

## Graceful degradation and fallbacks {#degrade}

When a dependency fails, return **less** rather than nothing. Separate **essential** data from **optional**: if the offers service fails, show the account summary without offers. Fallback options: a cached (stale) value, a default, an empty list, queueing the request for later with a "pending" message, or a simpler feature. Agree them with the business, and never choose an unsafe fallback: approving a payment because the fraud service is down is not graceful, it is a vulnerability.

## Health, probes and self-healing {#health}

In [Kubernetes](lesson:kubernetes), probes tell the platform what to do with an instance:

| Probe | Question | Effect when it fails |
| --- | --- | --- |
| **Liveness** | is the process stuck or dead? | the container is restarted |
| **Readiness** | can it take traffic now? | removed from load balancing until ready |
| **Startup** | has it finished starting? | holds off the other probes |

Keep liveness checks **cheap and local** (do not include the database: a database outage would restart every instance and make things worse). Readiness may include critical dependencies. Add a **graceful shutdown** (stop accepting traffic, finish in-flight work), and use **pod disruption budgets** and several replicas across zones so a node loss does not become an outage.

## Testing resilience {#testing}

Resilience that is never tested does not work. Test in layers: unit tests of fallbacks, integration tests with a fault-injecting proxy (Toxiproxy, WireMock delays and faults, Testcontainers), **load tests** that go past capacity to see how the service degrades, and **chaos experiments** (kill instances, add latency, drop a dependency) in a controlled way, first in test environments. Define **SLOs** (service level objectives, for example 99.9 percent of payments under 500 ms) and watch the **error budget**: they decide how much risk you can take.

## Resilience4j in Spring Boot {#resilience4j}

Resilience4j provides circuit breaker, retry, rate limiter, bulkhead and time limiter, as annotations or by composition, with Spring Boot configuration and Micrometer metrics.

```yaml
resilience4j:
  circuitbreaker:
    instances:
      cardService:
        sliding-window-size: 20
        minimum-number-of-calls: 10
        failure-rate-threshold: 50
        slow-call-duration-threshold: 2s
        slow-call-rate-threshold: 80
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 3
        ignore-exceptions:
          - com.bank.cards.InsufficientFundsException     # business error, not a failure
  retry:
    instances:
      cardService:
        max-attempts: 3
        wait-duration: 200ms
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
        enable-randomized-wait: true                       # jitter
        retry-exceptions:
          - java.io.IOException
          - org.springframework.web.client.ResourceAccessException
  bulkhead:
    instances:
      cardService:
        max-concurrent-calls: 10
        max-wait-duration: 0ms                             # reject at once when full
```

```java
@Service
class CardClient {
    private final RestClient client;

    @Retry(name = "cardService")                          // outermost
    @CircuitBreaker(name = "cardService", fallbackMethod = "fallback")
    @Bulkhead(name = "cardService")                       // innermost: limits concurrent calls
    CardLimits limits(String cardId) {
        return client.get().uri("/cards/{id}/limits", cardId).retrieve().body(CardLimits.class);
    }

    CardLimits fallback(String cardId, Throwable t) {
        return CardLimits.conservativeDefaults();          // safe default, not "unlimited"
    }
}
```

The default aspect order is Retry, then CircuitBreaker, then RateLimiter, then TimeLimiter, then Bulkhead (outermost to innermost), so each retry attempt goes through the breaker and every attempt counts as a call. Expose the breaker state through Actuator and metrics so you can alert on it.

## Cheat sheet {#cheatsheet}

| Problem | Pattern |
| --- | --- |
| Call hangs | connect and read timeouts, a timeout budget |
| Brief failure | retry with backoff, jitter and a cap, only if idempotent |
| Dependency keeps failing | circuit breaker with a fallback |
| One slow dependency starves everything | bulkhead per dependency |
| One noisy client | rate limit per client, `429` |
| Service overloaded | load shedding by priority, bounded queues |
| Producer faster than consumer | backpressure, broker buffering |
| Optional part failed | graceful degradation, safe fallback |
| Instance stuck or not ready | liveness and readiness probes |
| Not sure it works | fault injection, load and chaos tests, SLOs |

## Interview questions {#questions}

### [basic] What is a cascading failure and how do you prevent it? {#cascading-q}

One slow or failing service makes its callers slow, because they hold threads and connections waiting, and the slowness spreads up the chain until the whole system is down. Prevent it with timeouts, circuit breakers that fail fast, bulkheads that limit resources per dependency, load shedding, and fallbacks so a non-critical failure does not fail the whole request.

### [basic] Why must every remote call have a timeout? {#timeout-q}

Without one a call can wait forever, holding a thread and a connection, so a slow dependency can exhaust the caller's resources. Set a connect timeout and a read timeout based on real latency, and make inner timeouts shorter than outer ones so the whole chain fits in the time the user will wait.

### [basic] What is a circuit breaker and what are its states? {#breaker-q}

A wrapper that tracks the outcome of calls to a dependency. Closed: calls pass and failures are counted. Open: when the failure rate passes a threshold, calls fail immediately or use a fallback for a wait time. Half-open: a few trial calls test whether the dependency has recovered; success closes the breaker, failure reopens it.

### [basic] When is it safe to retry a request? {#retry-safe-q}

When the operation is idempotent (or carries an idempotency key) and the error is transient: a timeout, a connection error, `503` or `429`. Do not retry client errors such as `400` or `404`, and do not retry non-idempotent calls blindly, because a retried payment can be charged twice.

### [intermediate] Why do you add jitter to retries? {#jitter-q}

If many clients fail together and retry on the same schedule, they all hit the service again at the same moment, causing waves of load (a thundering herd). Jitter adds a random amount to the backoff so the retries spread out over time and the recovering service is not hit all at once.

### [intermediate] What is a retry storm and how do you avoid it? {#storm-q}

When several layers each retry failed calls, the number of calls multiplies: three layers with three attempts each make 27 calls for one request, against a service that is already struggling. Retry at one layer, cap attempts, use backoff and jitter, add a retry budget, and let the circuit breaker stop retries when a dependency is clearly down.

### [intermediate] What is the bulkhead pattern? {#bulkhead-q}

Limiting the resources any one dependency can use, so a slow one cannot starve the others. Use a separate thread pool, or a cap on concurrent calls, per dependency (and separate connection pools). When the limit is reached, extra calls are rejected quickly instead of waiting. The name comes from the sealed compartments in a ship.

### [intermediate] How do you choose a timeout value? {#timeout-value-q}

Start from the latency you measure, for example the 99th percentile of the dependency, with some margin, and from the time the end user will wait. Work backwards through the call chain so each inner timeout is shorter than the outer one. Too short causes false failures and extra retries; too long ties up resources. Review it with real metrics.

### [intermediate] What is the difference between rate limiting and load shedding? {#rate-vs-shed-q}

Rate limiting enforces a fair quota per client or key, regardless of the current load, to stop one caller from dominating. Load shedding is a reaction to the service's own overload: it refuses some requests, ideally the least important, so the rest stay fast. Both usually respond with `429` or `503` and a `Retry-After` header.

### [intermediate] What is backpressure? {#backpressure-q}

A way for a slow consumer to tell a fast producer to slow down, instead of buffering without limit. Examples: bounded queues that block or reject, reactive streams where the subscriber requests a number of items, and consumers that pull from Kafka at their own pace. It keeps memory bounded and makes overload visible.

### [intermediate] What is graceful degradation and how do you choose a fallback? {#degradation-q}

Returning a reduced but useful result when a dependency fails: leave out optional data, use a cached or default value, or queue the action. Decide with the business which parts are essential and which are optional, and make sure the fallback is safe: for example fall back to conservative limits, never to skipping a fraud check.

### [intermediate] What is the difference between liveness and readiness probes? {#probes-q}

Liveness answers "is the process alive or stuck?" and a failure makes Kubernetes restart the container. Readiness answers "can it handle traffic now?" and a failure removes the pod from the load balancer without restarting it. Keep liveness local and cheap; do not check the database in it, or a database outage restarts every instance.

### [deep] A downstream service is slow but not failing. What do you do? {#slow-q}

Slow is worse than down. Make sure timeouts are set so threads are freed, count slow calls (not only errors) in the circuit breaker so it opens, isolate the dependency with a bulkhead so it cannot take all your threads, return a fallback, and alert on the latency. Do not retry aggressively, because retries add load to a service that is already slow.

### [deep] Where should the circuit breaker sit relative to retry? {#order-q}

Retry wraps the circuit breaker: each attempt passes through the breaker, so failed attempts are counted and, once the breaker opens, further attempts fail immediately instead of hammering the dependency. In Resilience4j the default order is Retry, CircuitBreaker, RateLimiter, TimeLimiter, Bulkhead from the outside in. Configure the retry to not retry on the "circuit open" exception.

### [deep] How do you test that your service is resilient? {#testing-q}

Inject faults: delays, errors and dropped connections with WireMock, Toxiproxy or Testcontainers; run load tests beyond capacity and watch how the service degrades; and run chaos experiments, such as killing instances or adding latency, starting in test and moving to controlled production tests. Check that timeouts, breakers, fallbacks and alerts really behave, and track SLOs and error budgets.

### [deep] Why can a circuit breaker make things worse if configured badly? {#breaker-wrong-q}

If it counts business errors such as "insufficient funds" as failures, it opens for healthy dependencies. If the window or minimum number of calls is too small, a few errors open it. If the wait is too short it flaps between open and closed. If one global breaker covers many dependencies, one failure blocks all of them. Use a breaker per dependency, count only real failures and slow calls, and tune it with real data.

### [coding] Configure a retry with backoff and jitter in code, and make it safe. {#coding-retry}

```java
RetryConfig config = RetryConfig.custom()
    .maxAttempts(3)
    .intervalFunction(IntervalFunction.ofExponentialRandomBackoff(
        Duration.ofMillis(200),   // initial interval
        2.0,                      // multiplier: 200, 400, 800 ms
        0.5))                     // randomisation factor: the jitter
    .retryOnException(e -> e instanceof IOException || e instanceof HttpServerErrorException.ServiceUnavailable)
    .ignoreExceptions(CallNotPermittedException.class)   // do not retry when the breaker is open
    .build();

Retry retry = Retry.of("cardService", config);

CardLimits limits = Retry.decorateSupplier(retry, () -> cardClient.limits(cardId)).get();
```

Explain that the backoff grows exponentially with random jitter, that only transient errors are retried, that a call-not-permitted error from an open breaker is not retried, and that the call itself must be idempotent (a `GET` here, or a `POST` with an idempotency key).

### [coding] Limit concurrent calls to one dependency with a bulkhead and fall back. {#coding-bulkhead}

```java
BulkheadConfig config = BulkheadConfig.custom()
    .maxConcurrentCalls(10)                    // at most 10 card calls at once
    .maxWaitDuration(Duration.ZERO)            // do not queue: reject immediately when full
    .build();
Bulkhead bulkhead = Bulkhead.of("cardService", config);

Supplier<CardLimits> guarded = Bulkhead.decorateSupplier(bulkhead, () -> cardClient.limits(cardId));

CardLimits limits;
try {
    limits = guarded.get();
} catch (BulkheadFullException e) {
    limits = CardLimits.conservativeDefaults();   // degrade: safe defaults, other work continues
}
```

Explain that the semaphore bulkhead caps concurrent calls so the card service can never use more than ten threads, that rejection is immediate so callers are not stuck, and that the fallback is conservative rather than permissive.

### [coding] Shed load by priority with a simple servlet filter. {#coding-shed}

```java
@Component
class LoadSheddingFilter extends OncePerRequestFilter {
    private final Semaphore permits = new Semaphore(200);        // max concurrent requests
    private static final int RESERVED_FOR_CRITICAL = 50;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        boolean critical = req.getRequestURI().startsWith("/payments");
        // non-critical requests may only use the permits above the reserved amount
        boolean admitted = critical ? permits.tryAcquire() : (permits.availablePermits() > RESERVED_FOR_CRITICAL && permits.tryAcquire());
        if (!admitted) {
            res.setStatus(429);
            res.setHeader("Retry-After", "2");
            return;                                              // refuse early, cheaply
        }
        try {
            chain.doFilter(req, res);
        } finally {
            permits.release();
        }
    }
}
```

Explain that a bounded number of concurrent requests keeps queues short, that part of the capacity is reserved for payments so reports are refused first, that rejected callers get `429` and a `Retry-After` header, and that in production this is usually done at the gateway or with a library, with metrics on how many requests were shed.
