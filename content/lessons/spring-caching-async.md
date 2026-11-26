---
title: Caching, async and scheduling in Spring — @Cacheable, @Async, @Scheduled and events
nav: Caching, async, scheduling
slug: spring-caching-async
summary: Spring's cache abstraction with Caffeine and Redis (cache-aside, TTL, eviction, stampedes), @Async and executors, @Scheduled and running jobs safely in a cluster with ShedLock, and application events, with Java examples and interview questions.
tags: [Spring, Caching, Redis, Async, Scheduling, Executor]
order: 91
topic: Spring / Production and quality
updated: 2026-11-26
subnav: true
---

Production Spring services rely on three annotations that look simple but fail in subtle ways. Expect:

- How does `@Cacheable` work, and when is the cache wrong?
- What thread pool runs `@Async` by default?
- Why did my scheduled job run three times?
- How do you keep a cache consistent?

All three are [proxy-based](lesson:spring-aop), so they share the self-invocation limits. This lesson pairs with [Spring transactions](lesson:spring-transactions) (async and transactions), [messaging](lesson:messaging) and the [distributed scheduler](lesson:distributed-scheduler) design.

The demo has three scenes: cache-aside, `@Async` with a thread pool, and scheduling in a cluster.

```demo
name: spring-async-walk
```

> **One sentence to remember:** *Caches, thread pools and schedulers all need explicit limits, or they fail in production.*

Each one trades something away. A cache trades freshness for speed, so it needs a TTL. A thread pool trades latency for throughput, so it needs a bounded queue. A scheduler in a cluster needs a lock, with a lock time.

## Caching {#caching}

### The cache abstraction {#abstraction}

```java
@Configuration
@EnableCaching
class CacheConfig {
    @Bean
    CacheManager cacheManager() {
        CaffeineCacheManager m = new CaffeineCacheManager("rates");
        m.setCaffeine(Caffeine.newBuilder().maximumSize(10_000).expireAfterWrite(Duration.ofMinutes(1)));
        return m;
    }
}

@Service
class RateService {

    @Cacheable(cacheNames = "rates", key = "#pair", unless = "#result == null")
    public BigDecimal rate(String pair) { return repository.load(pair); }              // runs only on a miss

    @CachePut(cacheNames = "rates", key = "#pair")
    public BigDecimal update(String pair, BigDecimal value) { ...; return value; }     // always runs, refreshes the entry

    @CacheEvict(cacheNames = "rates", key = "#pair")
    public void delete(String pair) { ... }                                            // removes the entry
}
```

A caching **proxy** checks the cache before calling the method. This is the **cache-aside** pattern.

- `@Cacheable` skips the method when the value is cached (a *hit*).
- `@CachePut` always runs the method and stores the result.
- `@CacheEvict` removes entries. `allEntries = true` clears the whole cache.

The key is built from the method arguments by default. With several arguments, set `key` with a SpEL expression. `condition` and `unless` decide whether a result is cached.

Because it is a proxy, **self-invocation is not cached**, and it only works on public methods of beans.

### Local and distributed caches {#providers}

| | Local (Caffeine) | Distributed (Redis) |
| --- | --- | --- |
| Speed | In the same process: nanoseconds. | A network call: around a millisecond. |
| Agreement between instances | Each instance has its own copy, so they can disagree. | One shared copy. |
| Capacity | The JVM heap. | The cluster's memory. |
| Failure | Disappears with the instance. | Must stay available, with timeouts and a fallback. |
| Use | Small, hot data that tolerates being slightly stale. | Shared, larger data that all instances must agree on. |

A **two-level** setup puts Caffeine in front of Redis, and invalidates it through pub/sub. It combines both, at the cost of complexity.

Always set a **TTL** and a **maximum size**. A cache without limits is a memory leak.

### What goes wrong {#cache-problems}

- **Stale data:** nothing tells the cache that the source changed. Use a TTL, evict or put on writes, and accept that data can be stale for a bounded time. Never cache data that must always be exact (balances, permissions) without a clear plan for invalidation.
- **Cache stampede:** a hot key expires, and hundreds of requests hit the database at once. Reduce it with `@Cacheable(sync = true)` (one loader per key), random jitter on TTLs, refresh-ahead (Caffeine's `refreshAfterWrite`) and request coalescing.
- **Cache penetration:** repeated requests for keys that do not exist always miss the cache. Cache the "not found" result briefly (*negative caching*), or use a Bloom filter.
- **Serialisation and size:** values in Redis need a serialiser (prefer JSON to Java serialisation) that tolerates version changes across deployments. Large values hurt performance.
- **Mutable cached objects:** cache immutable values. Otherwise callers change the shared instance.
- **Key design and multi-tenancy:** include the tenant or user in the key when results differ per tenant or user.
- **The cache as a hidden dependency:** if Redis is down, the call should fall back to the source (or fail fast with a timeout), not hang.
- **Transactions:** an entry cached inside a transaction that later rolls back is wrong. Evict after the commit, or use `TransactionAwareCacheManagerProxy`.

## Async {#async}

```java
@Configuration
@EnableAsync
class AsyncConfig implements AsyncConfigurer {

    @Bean(name = "notificationExecutor")
    ThreadPoolTaskExecutor notificationExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(4);
        ex.setMaxPoolSize(8);
        ex.setQueueCapacity(100);                                   // bounded: overload shows up as rejections, not memory growth
        ex.setThreadNamePrefix("notify-");
        ex.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());   // slows the caller down: simple backpressure
        return ex;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) -> log.error("Async failure in {}", method, ex);
    }
}

@Service
class Notifier {
    @Async("notificationExecutor")
    public CompletableFuture<Void> send(Email email) {                  // returns immediately to the caller
        mailClient.send(email);
        return CompletableFuture.completedFuture(null);
    }
}
```

- `@Async` runs the method on an **executor** (a thread pool). Call it from **another bean**, so the call goes through the proxy. Self-invocation runs synchronously.
- The return type is `void`, `Future` or `CompletableFuture`. **Exceptions in a `void` method** go to the `AsyncUncaughtExceptionHandler`. With a future, the caller sees them.
- **Configure the pool.** Spring Boot provides a `ThreadPoolTaskExecutor` named `applicationTaskExecutor`, with 8 core threads and an **unbounded queue**. So overload turns into memory pressure. Use explicit, bounded, **named** pools for each purpose. Then slow email cannot starve payment work: this is a **bulkhead**.
- **Context does not follow the task.** The transaction, the security context, the MDC (log correlation) and request attributes belong to the calling thread. Wrap the executor with `DelegatingSecurityContextExecutor`, or use a `TaskDecorator` to copy the MDC and security context.
- **Not durable:** if the JVM stops, queued tasks are lost. Work that must not be lost goes to a message queue or an [outbox](lesson:microservice-patterns#outbox), not `@Async`.
- With Java 21, `spring.threads.virtual.enabled=true` makes task executors use virtual threads. That removes the pool-size limit for blocking tasks ([reactive and virtual threads](lesson:spring-reactive)).

## Scheduling {#scheduling}

```java
@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
class SchedulingConfig {}

@Component
class StatementJob {

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Singapore")
    @SchedulerLock(name = "dailyStatements", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    void generate() { statements.generateForAll(); }
}
```

| Option | Meaning |
| --- | --- |
| `fixedRate` | Every N ms, counted from the start of the previous run. Runs can overlap if one is slow (in async mode). |
| `fixedDelay` | N ms after the previous run **finishes**. |
| `initialDelay` | How long to wait before the first run. |
| `cron` | A cron expression. In Spring the seconds come first. Set a `zone`. |

- **One thread by default.** All `@Scheduled` methods share one scheduler thread, so a long job delays the others. Set `spring.task.scheduling.pool.size`, or use a dedicated `TaskScheduler`.
- **Every instance runs it.** With three replicas, the job runs three times. Use:
  - a **distributed lock**, such as **ShedLock** (a row or Redis key with a lock-until time),
  - a leader election,
  - or a clustered scheduler (Quartz with a JDBC job store).

  Set `lockAtMostFor` longer than the job takes, and `lockAtLeastFor` to absorb clock differences between machines.
- **Make jobs idempotent and time-bounded.** If a run crashes, another instance retries after the lock expires. Process in small batches and record progress.
- **Heavy, retried or audited work:** use Spring Batch (chunks, restart, skip) or a workflow engine. See the [distributed scheduler](lesson:distributed-scheduler) lesson for the design.
- **Kubernetes alternative:** a `CronJob` runs one pod per schedule, so you need no lock in the app.

## Application events {#events}

Events let beans talk without knowing each other: in-process publish and subscribe, with `ApplicationEventPublisher` and `@EventListener`.

- By default, listeners run **synchronously, on the publisher's thread and in its transaction**.
- Add `@Async` to a listener to run it on another thread.
- Use `@TransactionalEventListener(AFTER_COMMIT)` to react only after a commit ([after commit](lesson:spring-transactions#events)).

Events are not durable and not distributed. For events between services, use a broker ([messaging with Spring](lesson:spring-messaging)).

Try it in the lab: [@Cacheable and @Async: what the proxy does](lab:spring-cacheable-async).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| `@Cacheable` | Cache-aside through a proxy. Skips the method on a hit. |
| `@CachePut`, `@CacheEvict` | Refresh or remove entries when data is written. |
| TTL and size | Always set both. Caches without limits leak. |
| Stampede | `sync = true`, jittered TTLs, refresh-ahead. |
| Local vs distributed | Caffeine is fast but per instance. Redis is shared but a network hop. |
| Stale data | Bounded by the TTL and eviction. Do not cache data that must be exact. |
| `@Async` | Runs on an executor thread. Call it through another bean. Not durable. |
| Default pool | An unbounded queue. Configure bounded, named pools. |
| Context propagation | Transaction, security and MDC do not follow. Use a TaskDecorator. |
| `@Scheduled` | Runs on every instance. Add ShedLock, or use a CronJob. |
| `fixedRate` vs `fixedDelay` | From the start of a run, or after it finishes. |
| Events | In-process, synchronous by default, not durable. |

## Interview questions {#questions}

### [basic] How does @Cacheable work? {#cacheable-q}

A caching proxy wraps the bean. On each call, it builds a key from the arguments and looks in the named cache:

- On a **hit**, it returns the cached value without calling the method.
- On a **miss**, it calls the method, stores the result and returns it.

It needs `@EnableCaching` and a `CacheManager`, and it only works for calls through the proxy.

### [basic] What is the difference between @Cacheable, @CachePut and @CacheEvict? {#annotations-q}

- `@Cacheable` skips the method when a value is cached.
- `@CachePut` always runs the method and updates the cache with the result. It keeps entries fresh when data is written.
- `@CacheEvict` removes one entry or all of them. Use it on delete or update, to prevent stale reads.

### [basic] What does @Async do and what must you configure? {#async-q}

It runs the method on a separate thread from a `TaskExecutor`, so the caller returns immediately.

To use it safely:

- turn it on with `@EnableAsync`,
- call it through another bean,
- configure a bounded, named thread pool: core size, max size, queue and rejection policy,
- set an uncaught-exception handler,
- propagate the context the task needs.

Return a `CompletableFuture` when the caller needs the result.

### [basic] What is the difference between fixedRate and fixedDelay? {#rate-delay-q}

`fixedRate` starts runs at a fixed interval, measured from the start of each run. So if one run is slow, runs can pile up.

`fixedDelay` waits the given time after the previous run completes. So runs never overlap.

Use `fixedDelay` for jobs that must not overlap, and `cron` for times on the clock.

### [intermediate] Why does my @Scheduled job run multiple times and how do you fix it? {#cluster-q}

Every instance of the application runs its own scheduler, so N replicas run the job N times.

Fix it with a distributed lock such as ShedLock (`@SchedulerLock`), a clustered Quartz store, leader election, or a Kubernetes CronJob.

Make the job idempotent. Set the lock's `lockAtMostFor` above the job's duration, so a crash cannot block the job forever.

### [intermediate] What problems can a cache introduce? {#problems-q}

- stale data,
- stampedes, when hot keys expire together,
- penetration, by keys that do not exist,
- disagreement between instances with local caches,
- memory growth without a size limit or TTL,
- serialisation and version problems in Redis,
- caching mutable objects,
- a hidden dependency when the cache is down.

Design the TTLs, invalidation, limits and fallback on purpose.

### [intermediate] What is a cache stampede and how do you prevent it? {#stampede-q}

When a popular entry expires, many requests miss at the same moment, and they all hit the database at once.

Prevent it with:

- `@Cacheable(sync = true)`: one thread loads while the others wait,
- random jitter on TTLs,
- refreshing entries before they expire,
- a lock or request coalescing around the loader,
- serving the stale value while one request refreshes it (stale-while-revalidate).

### [intermediate] Local cache or Redis? {#local-vs-redis-q}

A **local cache** (Caffeine) is the fastest and needs no infrastructure. But each instance holds its own copy, so values can differ, and invalidation does not reach the other instances.

**Redis** is shared, consistent across instances, and survives restarts. But it costs a network call, and it must be highly available, with timeouts and fallbacks.

Use local for small, hot data that tolerates staleness. Use Redis for shared data. Or layer both.

### [intermediate] How do you keep a cache consistent with the database? {#consistency-q}

- Accept a bounded staleness, set by the TTL.
- Update or evict on writes (`@CachePut`, `@CacheEvict`), after the transaction commits.
- Publish invalidation events to the other instances.
- Do not cache data that must always be exact.

Perfect consistency is not free. Cache-aside is eventually consistent, so choose TTLs from what the business can tolerate.

### [intermediate] Why doesn't @Async work when I call the method from the same class? {#self-q}

`@Async` is implemented by a proxy. A call from another method of the same object (`this.sendEmail()`) skips the proxy, so it runs synchronously on the caller's thread.

Move the async method to another bean, or call it through a reference that goes through the proxy.

### [intermediate] What is the default executor for @Async and why is it risky? {#default-pool-q}

Spring Boot sets up an `applicationTaskExecutor` thread pool with an unbounded queue.

- A burst of tasks queues without limit. The app slowly runs out of memory, instead of rejecting work.
- All tasks share one pool.

Define explicit, bounded executors for each workload, with a rejection policy, and monitor the queue size.

### [intermediate] What context is lost when running on another thread? {#context-q}

These are stored per thread (in ThreadLocals), so the async task starts without them:

- the transaction and persistence context,
- the `SecurityContext`,
- the MDC used for log correlation,
- request-scoped data.

Propagate them explicitly with a `TaskDecorator` or security-aware executors. Pass the data the task needs as parameters, not managed entities.

### [deep] Is @Async suitable for work that must not be lost? {#durable-q}

No. Tasks wait in a queue in memory, so a restart or crash drops them, and failures are only logged.

For reliable work, use a message queue with acknowledgements and retries. Or write the intent to an outbox table in the same transaction, and let a relay process it ([outbox](lesson:microservice-patterns#outbox)).

### [deep] How do you protect a service from a slow asynchronous task? {#bulkhead-q}

- Give the task its own bounded executor (a bulkhead), so it cannot starve other work.
- Set a queue limit and a rejection policy: caller-runs, or reject and shed load.
- Add timeouts and circuit breakers around the slow dependency.
- Monitor active threads and queue depth with Micrometer.
- Consider virtual threads for tasks that block a lot.

### [coding] Cache exchange rates with a TTL and refresh on update. {#coding-cache}

```java
@Configuration @EnableCaching
class CacheConfig {
    @Bean CacheManager cacheManager() {
        CaffeineCacheManager m = new CaffeineCacheManager("rates");
        m.setCaffeine(Caffeine.newBuilder().maximumSize(5_000).expireAfterWrite(Duration.ofSeconds(60)).recordStats());
        return m;
    }
}

@Service
class RateService {
    @Cacheable(cacheNames = "rates", key = "#pair", sync = true)         // one loader per key: no stampede
    public BigDecimal rate(String pair) { return repository.find(pair).orElseThrow(); }

    @CachePut(cacheNames = "rates", key = "#pair")
    @Transactional
    public BigDecimal change(String pair, BigDecimal newRate) { repository.save(pair, newRate); return newRate; }
}
```

Explain these points:

- The proxy implements cache-aside.
- `sync = true` protects against a stampede.
- The TTL and maximum size limit staleness and memory.
- `recordStats` exposes the hit ratio as a metric.

### [coding] Configure a bounded executor and a safe async method. {#coding-async}

```java
@Bean("emailExecutor")
ThreadPoolTaskExecutor emailExecutor() {
    var ex = new ThreadPoolTaskExecutor();
    ex.setCorePoolSize(2); ex.setMaxPoolSize(4); ex.setQueueCapacity(50);
    ex.setThreadNamePrefix("email-");
    ex.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());     // fail fast when saturated
    ex.setTaskDecorator(runnable -> {
        Map<String, String> mdc = MDC.getCopyOfContextMap();                  // keep the correlation id in the logs
        return () -> { try { if (mdc != null) MDC.setContextMap(mdc); runnable.run(); } finally { MDC.clear(); } };
    });
    return ex;
}

@Service
class EmailSender {
    @Async("emailExecutor")
    public CompletableFuture<Void> send(Email e) {
        client.send(e);
        return CompletableFuture.completedFuture(null);
    }
}
```

Explain these points:

- The bounded queue with the abort policy makes overload visible.
- The named pool acts as a bulkhead.
- The decorator copies the MDC into the pool thread.
- `send` must be called from another bean.

### [coding] Run a nightly job once across several instances. {#coding-shedlock}

```java
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT30M")
@Configuration
class SchedulerConfig {
    @Bean LockProvider lockProvider(DataSource ds) { return new JdbcTemplateLockProvider(ds); }       // shedlock table
}

@Component
class StatementJob {
    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Singapore")
    @SchedulerLock(name = "dailyStatements", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    void run() {
        statements.generateBatch(LocalDate.now().minusDays(1));        // idempotent: safe if another instance retries after a crash
    }
}
```

Explain these points:

- The first instance to insert or update the lock row runs the job.
- `lockAtMostFor` frees the lock if that instance dies.
- `lockAtLeastFor` stops a fast job from running twice because of clock differences.
- The job itself is idempotent.
