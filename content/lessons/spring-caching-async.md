---
title: Caching, async and scheduling in Spring — @Cacheable, @Async, @Scheduled and events
nav: Caching, async, scheduling
slug: spring-caching-async
summary: Spring's cache abstraction with Caffeine and Redis (cache-aside, TTL, eviction, stampedes), @Async and executors, @Scheduled and running jobs safely in a cluster with ShedLock, and application events, with Java examples and interview questions.
tags: [Spring, Caching, Redis, Async, Scheduling, Executor]
order: 42
topic: Spring / Production
updated: 2026-11-13
subnav: true
---

Production Spring services lean on three annotations that look trivial and fail in subtle ways: *how does `@Cacheable` work and when is the cache wrong, what is the default thread pool behind `@Async`, why did my scheduled job run three times, and how do you keep a cache consistent?* All three are [proxy-based](lesson:spring-aop), so they share the self-invocation limits. This lesson pairs with [Spring transactions](lesson:spring-transactions) (async and transactions), [messaging](lesson:messaging) and the [distributed scheduler](lesson:distributed-scheduler) design. Play the three scenes: cache-aside, `@Async` with a thread pool, and scheduling in a cluster.

```demo
name: spring-async-walk
```

> **One sentence to remember:** *a cache trades freshness for speed, a thread pool trades latency for throughput, and a scheduler in a cluster needs a lock: each of them needs explicit limits (TTL, queue size, lock time) or it fails in production.*

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

A caching **proxy** checks the cache before calling the method (**cache-aside** pattern). `@Cacheable` skips the method on a hit, `@CachePut` always runs it and stores the result, `@CacheEvict` removes entries (`allEntries = true` clears the cache). Keys default to the method arguments; set `key` with SpEL for multiple arguments. `condition` and `unless` decide whether to cache. Because it is a proxy: **self-invocation is not cached**, and only public methods on beans.

### Local and distributed caches {#providers}

| | Local (Caffeine) | Distributed (Redis) |
| --- | --- | --- |
| Speed | in-process, nanoseconds | network call, around a millisecond |
| Consistency across instances | each instance has its own copy: they can disagree | one shared copy |
| Capacity | JVM heap | cluster memory |
| Failure | disappears with the instance | needs availability, timeouts and a fallback |
| Use | small, hot, tolerant of slight staleness | shared, larger, must agree across instances |

A **two-level** setup (Caffeine in front of Redis, invalidated by pub/sub) combines both at the cost of complexity. Always set a **TTL** and a **maximum size**; an unbounded cache is a memory leak.

### What goes wrong {#cache-problems}

- **Stale data:** nothing tells the cache the source changed. Use TTL, evict or put on writes, and accept bounded staleness; never cache data that must always be exact (balances, permissions) without a clear invalidation story.
- **Cache stampede:** a hot key expires and hundreds of requests hit the database at once. Mitigate with `@Cacheable(sync = true)` (one loader per key), jittered TTLs, refresh-ahead (Caffeine `refreshAfterWrite`) and request coalescing.
- **Cache penetration:** repeated requests for keys that do not exist bypass the cache; cache the "not found" result briefly (negative caching) or use a Bloom filter.
- **Serialisation and size:** values in Redis need a serialiser (JSON preferred over Java serialisation) and version tolerance across deployments; large values hurt.
- **Mutable cached objects:** cache immutable values, or callers modify the shared instance.
- **Key design and multi-tenancy:** include tenant or user in the key where results differ.
- **Cache as a hidden dependency:** if Redis is down the call should fall back to the source (or fail fast with a timeout), not hang.
- **Transactions:** an entry cached inside a transaction that later rolls back is wrong; evict after commit, or use `TransactionAwareCacheManagerProxy`.

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

- `@Async` runs the method on an **executor** (a thread pool). Call it from **another bean** (proxy); self-invocation runs synchronously.
- The return type is `void`, `Future` or `CompletableFuture`. **Exceptions in a `void` method** go to the `AsyncUncaughtExceptionHandler`; with a future the caller sees them.
- **Configure the pool.** Defaults: Spring Boot provides a `ThreadPoolTaskExecutor` named `applicationTaskExecutor` (core 8, **unbounded queue**), so overload becomes memory pressure. Use explicit, bounded, **named** pools per purpose (so slow email cannot starve payment work, a **bulkhead**).
- **Context does not propagate:** the transaction, security context, MDC (log correlation) and request attributes belong to the calling thread. Wrap the executor with `DelegatingSecurityContextExecutor` or a `TaskDecorator` to copy the MDC and security context.
- **Not durable:** if the JVM stops, queued tasks are lost. Work that must not be lost goes to a message queue or an [outbox](lesson:microservice-patterns#outbox), not `@Async`.
- With Java 21 `spring.threads.virtual.enabled=true` makes task executors use virtual threads, lifting the pool-size limit for blocking tasks ([reactive and virtual threads](lesson:spring-reactive)).

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
| `fixedRate` | every N ms from the start of the previous run (can overlap if slow, in async mode) |
| `fixedDelay` | N ms after the previous run **finishes** |
| `initialDelay` | wait before the first run |
| `cron` | cron expression (seconds first in Spring), set a `zone` |

- **Single thread by default:** `@Scheduled` methods share one scheduler thread, so a long job delays others. Set `spring.task.scheduling.pool.size` or use a dedicated `TaskScheduler`.
- **Every instance runs it.** With three replicas the job runs three times. Use a **distributed lock** (**ShedLock**: a row or Redis key with a lock-until time), a leader election, or a clustered scheduler (Quartz with a JDBC job store). Set `lockAtMostFor` longer than the job and `lockAtLeastFor` to absorb clock skew.
- **Make jobs idempotent and time-bounded:** a crashed run lets another instance retry after the lock expires; process in small batches and record progress.
- **Heavy, retried or audited work:** Spring Batch (chunks, restart, skip) or a workflow engine; see the [distributed scheduler](lesson:distributed-scheduler) lesson for the design.
- **Kubernetes alternative:** a `CronJob` runs one pod per schedule, removing the need for an in-app lock.

## Application events {#events}

In-process pub/sub decouples beans (`ApplicationEventPublisher`, `@EventListener`). Listeners run **synchronously on the publisher's thread and transaction** by default; add `@Async` to a listener to move it off-thread, and `@TransactionalEventListener(AFTER_COMMIT)` to react only after a commit ([after commit](lesson:spring-transactions#events)). Events are not durable and not distributed: use a broker for cross-service events ([messaging with Spring](lesson:spring-messaging)).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| `@Cacheable` | cache-aside through a proxy: skip the method on a hit |
| `@CachePut`, `@CacheEvict` | refresh or remove entries on writes |
| TTL and size | always set both; unbounded caches leak |
| Stampede | `sync = true`, jittered TTL, refresh-ahead |
| Local vs distributed | Caffeine fast but per-instance; Redis shared but a network hop |
| Stale data | bounded by TTL and eviction; do not cache must-be-exact data |
| `@Async` | executor thread; call via another bean; not durable |
| Default pool | unbounded queue: configure bounded, named pools |
| Context propagation | transaction, security, MDC do not follow: use a TaskDecorator |
| `@Scheduled` | runs on every instance: add ShedLock or a CronJob |
| `fixedRate` vs `fixedDelay` | from start vs after finish |
| Events | in-process, synchronous by default, not durable |

## Interview questions {#questions}

### [basic] How does @Cacheable work? {#cacheable-q}

A caching proxy wraps the bean. On a call it builds a key from the arguments and looks in the named cache: on a hit it returns the cached value without calling the method; on a miss it calls the method, stores the result and returns it. It needs `@EnableCaching`, a `CacheManager`, and works only for calls through the proxy.

### [basic] What is the difference between @Cacheable, @CachePut and @CacheEvict? {#annotations-q}

`@Cacheable` skips the method when a value is cached. `@CachePut` always executes the method and updates the cache with the result (to keep entries fresh on writes). `@CacheEvict` removes one entry or all entries, used on delete or update to prevent stale reads.

### [basic] What does @Async do and what must you configure? {#async-q}

It runs the method on a separate thread from a `TaskExecutor` so the caller returns immediately. Enable it with `@EnableAsync`, call it through another bean, and configure a bounded, named thread pool (core, max, queue, rejection policy), an uncaught-exception handler and context propagation. Return `CompletableFuture` when the caller needs the result.

### [basic] What is the difference between fixedRate and fixedDelay? {#rate-delay-q}

`fixedRate` schedules runs at a fixed interval measured from the start of each run, so runs can pile up if one takes longer. `fixedDelay` waits the given time after the previous run completes, so runs never overlap. Use `fixedDelay` for jobs that must not overlap, `cron` for wall-clock times.

### [intermediate] Why does my @Scheduled job run multiple times and how do you fix it? {#cluster-q}

Every application instance runs its own scheduler, so N replicas run it N times. Use a distributed lock such as ShedLock (`@SchedulerLock`), a clustered Quartz store, leader election, or a Kubernetes CronJob. Make the job idempotent and set the lock's `lockAtMostFor` above the job duration so a crash does not block it forever.

### [intermediate] What problems can a cache introduce? {#problems-q}

Stale data, stampedes when hot keys expire together, penetration by non-existent keys, inconsistency between instances with local caches, memory growth without a size limit or TTL, serialisation and version issues in Redis, caching mutable objects, and a hidden dependency when the cache is down. Design TTLs, invalidation, bounds and a fallback deliberately.

### [intermediate] What is a cache stampede and how do you prevent it? {#stampede-q}

When a popular entry expires, many concurrent requests miss and all hit the database at once. Prevent with `@Cacheable(sync = true)` (one thread loads while others wait), random jitter on TTLs, refresh-ahead before expiry, a lock or request coalescing around the loader, and a stale-while-revalidate approach.

### [intermediate] Local cache or Redis? {#local-vs-redis-q}

A local cache (Caffeine) is fastest and needs no infrastructure, but each instance holds its own copy so values can differ and invalidation does not propagate. Redis is shared and consistent across instances and survives restarts, but costs a network call and must be highly available with timeouts and fallbacks. Use local for small, hot, staleness-tolerant data, Redis for shared data, or both layered.

### [intermediate] How do you keep a cache consistent with the database? {#consistency-q}

Accept bounded staleness with a TTL, update or evict on writes (`@CachePut`/`@CacheEvict`) after the transaction commits, publish invalidation events for other instances, and avoid caching data that must always be exact. There is no free perfect consistency: cache-aside is eventually consistent, so choose TTLs from what the business tolerates.

### [intermediate] Why doesn't @Async work when I call the method from the same class? {#self-q}

`@Async` is implemented by a proxy. A call from another method of the same object (`this.sendEmail()`) bypasses the proxy and runs synchronously on the caller's thread. Move the async method to another bean, or inject a reference that goes through the proxy.

### [intermediate] What is the default executor for @Async and why is it risky? {#default-pool-q}

Spring Boot auto-configures an `applicationTaskExecutor` thread pool with an unbounded queue, so a burst of tasks queues without limit and the application slowly runs out of memory instead of rejecting work, and all tasks share one pool. Define explicit bounded executors per workload with a rejection policy and monitor queue size.

### [intermediate] What context is lost when running on another thread? {#context-q}

The transaction and persistence context, the `SecurityContext`, the MDC used for log correlation, and request-scoped data are bound to the calling thread (ThreadLocals). The async task starts without them. Propagate explicitly with a `TaskDecorator` or security-context-aware executors, and pass needed data as parameters, not managed entities.

### [deep] Is @Async suitable for work that must not be lost? {#durable-q}

No. Tasks live in an in-memory queue, so a restart or crash drops them, and failures are only logged. For reliable work use a message queue with acknowledgements and retries, or write the intent to an outbox table in the same transaction and let a relay process it ([outbox](lesson:microservice-patterns#outbox)).

### [deep] How do you protect a service from a slow asynchronous task? {#bulkhead-q}

Give it its own bounded executor (a bulkhead) so it cannot starve other work, set a queue limit and a rejection policy (caller-runs or reject and shed load), add timeouts and circuit breakers around the slow dependency, monitor active threads and queue depth through Micrometer, and consider virtual threads for blocking-heavy tasks.

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

Explain that the proxy implements the cache-aside, `sync = true` protects against a stampede, the TTL and maximum size bound staleness and memory, and `recordStats` exposes hit ratio metrics.

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

Explain the bounded queue with abort policy (visible overload), the named pool as a bulkhead, the decorator copying the MDC, and calling `send` from another bean.

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

Explain that the first instance to insert or update the lock row runs the job, `lockAtMostFor` frees the lock if the instance dies, `lockAtLeastFor` stops a fast job being repeated by clock skew, and the job itself is idempotent.
