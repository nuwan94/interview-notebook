---
title: Caching with Redis — patterns, eviction, invalidation and failure modes
nav: Caching with Redis
slug: redis-caching
summary: Why and how to cache with Redis: cache-aside, read-through, write-through and write-behind, Redis data structures and use cases, TTL and eviction policies, invalidation and staleness, stampede, avalanche and penetration, single-thread model, persistence, replication, Sentinel and Cluster, Spring integration, with Java examples and interview questions.
tags: [Redis, Caching, Eviction, TTL, Cache-aside, Cluster, Spring]
order: 21
topic: Databases / Consistency and caching
updated: 2026-11-13
subnav: true
---

"Our balance page is slow, so we added Redis" is the start of many interview questions. Interviewers then ask *which caching pattern did you use, what happens when the cache and the database disagree, what happens when a hot key expires, what do you do when Redis is down, and how does Redis decide what to throw away?* This lesson covers the patterns, Redis itself, and the failure modes. It builds on [Spring caching](lesson:spring-caching-async) (the annotations), relates to [SQL vs NoSQL](lesson:sql-vs-nosql) and [ACID vs BASE](lesson:acid-base) (a cache is eventually consistent), and uses [messaging](lesson:messaging) and the [saga](lesson:saga) outbox idea for invalidation across services. Play the five scenes: the four patterns, expiry and eviction, invalidation, failure modes, and replication and cluster.

```demo
name: redis-walk
```

> **One sentence to remember:** *a cache is a fast, disposable copy of data: put the database first for correctness, give every key a TTL, decide in advance what happens on a miss, a stampede and an outage, and never let a cached value make a decision that must be exactly right.*

## Why cache, and what to cache {#why}

A cache stores the result of expensive work close to the caller so that the next request skips the work. It helps when data is **read much more often than it changes**, is **expensive to compute or fetch**, and **tolerates being slightly stale**.

| Good candidates | Poor candidates |
| --- | --- |
| reference data: exchange rates, branch lists, product catalogue | an account balance used to approve a payment |
| results of heavy queries and aggregations | data that changes on every request |
| session and token data | rarely repeated requests (low hit ratio) |
| rate-limit counters, idempotency keys | large objects read once |
| authorisation lookups with a short TTL | anything that must be strongly consistent |

Two numbers decide whether a cache is worth it: the **hit ratio** (hits divided by hits plus misses) and the **cost of a miss**. A cache with a 60 percent hit ratio still means 40 percent of traffic reaches the database.

## Caching patterns {#patterns}

| Pattern | Who talks to the database | Read path | Write path | Trade-off |
| --- | --- | --- | --- | --- |
| **Cache-aside** (lazy loading) | the application | check cache, on a miss load and store | write the database, delete the key | simple and the default; first read is slow; stale window |
| **Read-through** | the cache layer | the cache loads on a miss | as above | the application only knows the cache; needs a loader |
| **Write-through** | the cache layer, synchronously | always fresh | write cache and database together | slower writes; caches data nobody reads |
| **Write-behind** (write-back) | a background flusher | fast | write the cache, flush later in batches | very fast writes; **data loss if the cache dies before the flush** |
| **Refresh-ahead** | a background refresher | hot keys never expire | reload before the TTL ends | avoids stampedes; wasted work for keys that go cold |

```java
// cache-aside with Redis (the pattern behind most @Cacheable use)
public Account find(String id) {
    String key = "account:" + id;
    String json = redis.opsForValue().get(key);
    if (json != null) return mapper.readValue(json, Account.class);       // hit

    Account account = repository.findById(id).orElseThrow();              // miss: load
    redis.opsForValue().set(key, mapper.writeValueAsString(account), Duration.ofMinutes(10)); // always with a TTL
    return account;
}

public void update(Account account) {
    repository.save(account);                       // 1. database first
    redis.delete("account:" + account.id());        // 2. then invalidate
}
```

Spring's `@Cacheable` is cache-aside implemented by a [proxy](lesson:spring-aop); to your code it looks like read-through. Write-behind fits counters, view counts and analytics, and does not fit money.

## Redis data structures and what they are for {#structures}

Redis is an in-memory data structure server, not just a key-value cache. The structure you choose decides how well it fits.

| Structure | Typical use | Key commands |
| --- | --- | --- |
| **String** | cached JSON, counters, flags, locks | `SET k v EX 60`, `GET`, `INCR`, `SET k v NX PX 30000` |
| **Hash** | an object with fields, partial updates | `HSET`, `HGET`, `HGETALL` |
| **List** | simple queue, recent items | `LPUSH`, `RPOP`, `BRPOP` |
| **Set** | unique members, tags, set maths | `SADD`, `SISMEMBER`, `SINTER` |
| **Sorted set** | leaderboards, time-ordered indexes, rate-limit windows | `ZADD`, `ZRANGE`, `ZRANGEBYSCORE` |
| **Bitmap / HyperLogLog** | daily active flags, approximate unique counts | `SETBIT`, `PFADD`, `PFCOUNT` |
| **Stream** | append-only log with consumer groups | `XADD`, `XREADGROUP` |
| **Pub/Sub** | fire-and-forget broadcast (messages are not stored) | `PUBLISH`, `SUBSCRIBE` |

Common recipes:

- **Rate limiter**: `INCR rate:user42:12:01` then `EXPIRE` on the first increment (or a sorted set for a sliding window).
- **Session store**: a hash per session with a TTL refreshed on use.
- **Distributed lock**: `SET lock:job1 token NX PX 30000`, released with a script that deletes only if the token still matches.
- **Idempotency key**: `SET idem:abc 1 NX EX 86400`; if it already exists, the request is a duplicate.

## TTL, expiry and eviction {#eviction}

Two different mechanisms remove keys, and they are often confused:

- **Expiry** removes a key because its **TTL ended**. Redis does it lazily (when a client touches an expired key) and actively (a background sampler checks random keys that have a TTL). Expired keys may sit in memory briefly before they are reclaimed.
- **Eviction** removes a key that is **still valid** because the memory limit `maxmemory` was reached. The `maxmemory-policy` setting decides which key goes.

| Policy | Meaning |
| --- | --- |
| `noeviction` (default) | refuse writes with an out-of-memory error; reads still work |
| `allkeys-lru` | evict the least recently used key from all keys; the usual cache choice |
| `allkeys-lfu` | evict the least frequently used key; better when a few keys are very hot |
| `volatile-lru`, `volatile-lfu`, `volatile-ttl` | consider only keys that have a TTL (`volatile-ttl` evicts the nearest expiry) |
| `allkeys-random`, `volatile-random` | random victim |

LRU and LFU in Redis are **approximate**: Redis samples a few keys (`maxmemory-samples`, default 5) and evicts the best candidate, which saves memory and CPU. If the same Redis holds both a cache and data that must not disappear (sessions, locks), `allkeys-*` policies can delete the important data; use a `volatile-*` policy and give only cache keys a TTL, or run separate instances.

```
# redis.conf for a pure cache
maxmemory 2gb
maxmemory-policy allkeys-lfu
```

Watch `INFO stats`: `keyspace_hits` and `keyspace_misses` (hit ratio), `evicted_keys` (rising means the working set does not fit), `expired_keys`, and `INFO memory` (`used_memory`, `mem_fragmentation_ratio`).

## Invalidation and staleness {#invalidation}

> "There are only two hard things in computer science: cache invalidation and naming things."

The cached copy becomes wrong the moment the source changes. Your options, from simplest:

1. **TTL only**: accept staleness up to the TTL. Simple, and always add it as a safety net.
2. **Delete on write**: update the database, then `DEL` the key; the next read reloads. Preferred over updating the cache in place because two concurrent writers could leave the older value in the cache.
3. **Event-driven**: the writing service publishes an event after commit (through an outbox, [Kafka](lesson:messaging) or change data capture) and cache owners delete or refresh keys.
4. **Versioned keys**: include a version in the key (`account:42:v7`); a new version makes the old key unreachable and it ages out.
5. **Write-through**: update both together, accepting the cost.

Even delete-on-write has a **race**: reader A misses and reads the old value, writer B updates the database and deletes the key, then reader A stores its stale value. The cache is wrong until the TTL ends. It is rare, so the usual answer is a **short TTL** plus a delete, or a delayed second delete. If it is unacceptable, do not cache that data, or read the authoritative source before acting on it.

> **Banking rule of thumb:** cache descriptions, rates and reference data freely. For balances and limits, either do not cache, or cache for display only and re-read the database inside the [transaction](lesson:spring-transactions) that makes the decision.

## Failure modes {#failures}

| Problem | What happens | Typical defences |
| --- | --- | --- |
| **Cache stampede** (thundering herd, dog-piling) | a hot key expires and many requests rebuild it at once | single-flight lock (`sync = true`, `SET NX`), refresh-ahead, serve stale while one request refreshes |
| **Cache avalanche** | many keys expire together, or Redis restarts empty | TTL jitter, warm-up, rate limiting and circuit breaker in front of the database, replicas |
| **Cache penetration** | requests for keys that do not exist always miss and hit the database | cache a short-lived null marker, validate input, Bloom filter of valid ids |
| **Hot key** | one key gets so much traffic it overloads a node | local in-process cache in front, replicate the key under several names |
| **Big key** | a huge value or collection blocks the single thread | split it, use `UNLINK` (async delete) instead of `DEL`, avoid unbounded collections |
| **Redis outage** | calls time out | short timeout, circuit breaker, fallback to the database or to stale data, never block the request thread for seconds |

```java
// stampede protection: one request rebuilds, the rest wait or fall back
Boolean got = redis.opsForValue().setIfAbsent("lock:rate:" + pair, token, Duration.ofSeconds(5));
if (Boolean.TRUE.equals(got)) {
    try { value = loadAndCache(pair); } finally { releaseIfOwner("lock:rate:" + pair, token); }
} else {
    value = waitForCacheOrServeStale(pair);
}

// avalanche protection: spread expiry
Duration ttl = Duration.ofSeconds(600 + ThreadLocalRandom.current().nextInt(-60, 60));
```

A **Bloom filter** answers "is this id possibly in the set?" with no false negatives and a small false-positive rate, so ids that were never created are rejected without touching Redis or the database.

## How Redis works and how it scales {#internals}

**Single-threaded command execution.** Redis runs commands one at a time on one main thread (newer versions use extra I/O threads for network work only). That makes every command **atomic** without locks and keeps latency low, but one slow command blocks everybody: avoid `KEYS *` (use `SCAN`, which iterates in small steps), huge `SMEMBERS`/`HGETALL` on large collections, and long Lua scripts.

**Atomicity and batching.**

- A single command is atomic. `INCR` is safe for counters without a lock.
- **Pipelining** sends many commands without waiting for each reply, which saves round trips (not atomic).
- `MULTI`/`EXEC` queues commands and runs them together without interleaving, but there is **no rollback**: a command that fails at run time does not undo the others. `WATCH` adds optimistic locking.
- **Lua scripts** run atomically on the server and are the right way to do check-and-set logic, such as releasing a lock only if you still own it.

**Persistence.** A pure cache can run without it and rebuild from the database. Otherwise:

| Option | How | Trade-off |
| --- | --- | --- |
| **RDB** | periodic point-in-time snapshot | compact, fast restart; can lose minutes of writes |
| **AOF** | append every write to a log (`fsync` every second or always) | more durable; larger file, rewritten in the background |
| **Both** | RDB for fast restart, AOF for durability | common for sessions and queues |

**Replication and Sentinel.** A primary copies its writes **asynchronously** to replicas. Replicas serve reads and provide a standby. **Sentinel** monitors the primary, elects a new one when it fails and tells clients where it is. Because replication is asynchronous, a failover can lose the last few acknowledged writes.

**Redis Cluster** shards data when one node is not enough: the key space is divided into **16,384 hash slots** (`CRC16(key) mod 16384`), each served by a primary with replicas. Clients learn the slot map and go straight to the right node, following `MOVED` redirects when it changes. Multi-key commands and Lua scripts must touch keys in **one slot**; **hash tags** do this: only the part in braces is hashed, so `{user42}:cart` and `{user42}:profile` share a slot.

**Security.** Never expose Redis to the internet. Bind to a private network, enable `AUTH` and **ACLs** (a user per application with only the commands it needs), use TLS, and disable dangerous commands such as `FLUSHALL` and `CONFIG` for applications.

## Redis with Spring {#spring}

```java
@Configuration
@EnableCaching
class RedisCacheConfig {
    @Bean
    RedisCacheManager cacheManager(RedisConnectionFactory cf) {
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .disableCachingNullValues()
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()));   // readable JSON, not Java serialization
        return RedisCacheManager.builder(cf)
            .cacheDefaults(base)
            .withCacheConfiguration("rates", base.entryTtl(Duration.ofSeconds(60)))
            .build();
    }
}

@Service
class BranchService {
    @Cacheable(cacheNames = "branches", key = "#code", sync = true)
    Branch find(String code) { return repository.findByCode(code).orElseThrow(); }

    @CacheEvict(cacheNames = "branches", key = "#branch.code")
    Branch update(Branch branch) { return repository.save(branch); }
}
```

- **Lettuce** is the default client (non-blocking, thread-safe connections); Jedis uses a pool of blocking connections.
- Use **JSON** or another explicit format rather than Java serialization: it is readable, smaller and does not break when a class changes. Do not cache JPA entities with lazy associations; cache DTOs.
- Set **command and connect timeouts** (for example 100 to 300 ms) so a slow Redis does not hold request threads. Add a `CacheErrorHandler` that logs and falls through to the database, so a cache failure is not a request failure.
- `StringRedisTemplate` is the low-level API for counters, locks and sets. **Redisson** adds distributed locks, semaphores and rate limiters. A single-node `SET NX PX` lock is fine for efficiency (avoid duplicate work); for correctness under failures the Redlock debate applies, and you need a **fencing token** or a database constraint as the final guard (see the [distributed scheduler](lesson:distributed-scheduler) lesson).
- Prefix keys by service and version (`payments:v2:account:42`) so deployments with a changed format do not read each other's data.

## Cheat sheet {#cheatsheet}

| Need | Do |
| --- | --- |
| default pattern | cache-aside, TTL on every key, delete after the database write |
| data that must be exact | do not cache it, or re-read the database in the transaction |
| pure cache config | `maxmemory` set, `allkeys-lru` or `allkeys-lfu` |
| sessions or locks in the same Redis | `volatile-*` policy or a separate instance |
| hot key expiry | `sync = true` or a lock, refresh-ahead |
| mass expiry | TTL jitter, warm-up |
| nonexistent keys | null marker with short TTL, Bloom filter |
| Redis down | short timeout, circuit breaker, database fallback |
| scan keys | `SCAN`, never `KEYS *` |
| atomic check-and-set | Lua script |
| scaling reads | replicas |
| scaling data size | Redis Cluster, hash tags for related keys |
| key naming | `service:version:entity:id` |

## Interview questions {#questions}

### [basic] What is Redis and why is it fast? {#what-is-redis}

An in-memory data structure server used as a cache, session store, message broker and counter service. It is fast because data lives in RAM, the data structures are simple and efficient, commands run on a single thread with no locking, and the protocol is lightweight. Most commands run in microseconds, so network round trips usually dominate.

### [basic] What is cache-aside? {#cache-aside-q}

The application manages the cache: read from the cache, on a miss read the database and store the result, and on a write update the database and delete the key. It is the most common pattern because it is simple, the cache can fail without breaking correctness, and only requested data is cached. The cost is a slow first read and a window of staleness.

### [basic] What is the difference between read-through, write-through and write-behind? {#patterns-q}

Read-through: the cache loads from the database on a miss. Write-through: writes go to the cache and the database together, so reads are fresh but writes are slower. Write-behind: the write goes to the cache and a background job flushes to the database later; fast, but data accepted by the cache can be lost if it fails before the flush. Cache-aside differs in that the application, not the cache, performs the loading.

### [basic] What is a TTL and why should every cached key have one? {#ttl-q}

A time to live is the lifetime of a key, after which Redis removes it. It bounds how stale a value can be and how much memory the cache can hold, and it heals mistakes such as a missed invalidation. A key without a TTL stays until evicted or deleted, which is how caches slowly fill with data nobody needs.

### [basic] What data structures does Redis support? {#structures-q}

Strings, hashes, lists, sets, sorted sets, bitmaps, HyperLogLogs, streams and geospatial indexes, plus pub/sub. Choose by access pattern: strings for cached JSON and counters, hashes for objects, sorted sets for leaderboards or sliding windows, sets for membership, streams for a log with consumer groups.

### [basic] What is the difference between expiry and eviction? {#expiry-vs-eviction}

Expiry removes a key whose TTL ended. Eviction removes a valid key because memory reached `maxmemory`, chosen by `maxmemory-policy`. Expiry is about time and eviction is about space. The default policy `noeviction` does not evict at all and rejects writes when full.

### [basic] How does Redis expire keys? {#how-expire}

Lazily, when a client accesses an expired key it is deleted and treated as missing; and actively, by a background task that samples keys with a TTL several times per second and deletes expired ones, repeating when many are expired. A key can therefore stay in memory a little after its TTL passed, but it is never returned.

### [basic] What is the default maxmemory policy and what does it do? {#noeviction-q}

`noeviction`: when memory is full, write commands fail with an out-of-memory error while reads keep working. That is safe for data stores but wrong for a cache, where you want an `allkeys-lru` or `allkeys-lfu` policy so the cache stays writable by discarding cold keys.

### [intermediate] LRU or LFU: which eviction policy would you choose? {#lru-lfu-q}

LRU evicts the key not used for the longest time, which suits workloads where recent use predicts future use. LFU evicts the key used least often, which suits workloads with a stable set of hot keys and protects them from a one-time scan of cold data. Both are approximate in Redis because it samples a few keys instead of keeping an exact ordering. Measure the hit ratio under both if it matters.

### [intermediate] What is a cache stampede and how do you prevent it? {#stampede-q}

When a popular key expires, many concurrent requests miss together and all load the same data from the database, which can overload it. Defences: let only one request rebuild (a lock or `sync = true`) while others wait or use the stale value, refresh hot keys before they expire, add TTL jitter, and rate limit the loader. The same idea is called single-flight or request coalescing.

### [intermediate] What is a cache avalanche? {#avalanche-q}

A large number of keys expiring at the same moment (loaded together with the same TTL) or the cache becoming empty after a restart, so the database receives the full load at once. Add random jitter to TTLs, warm the cache before taking traffic, keep replicas for availability, and protect the database with a circuit breaker and limits.

### [intermediate] What is cache penetration and how do you prevent it? {#penetration-q}

Requests for data that does not exist (random ids, scanning attacks) never hit the cache because there is nothing to store, so each goes to the database. Cache a short-lived null marker, validate the id format, rate limit, and put a **Bloom filter** of existing ids in front so impossible ids are rejected early. Remember the null marker needs a short TTL so a newly created record appears quickly.

### [intermediate] How do you keep the cache consistent with the database? {#consistency-q}

You usually cannot make it perfectly consistent, so you bound the inconsistency. Update the database first and then delete the key, add a TTL as a safety net, and for several services publish an event after commit (outbox or change data capture) that triggers invalidation. For data that must be exact, skip the cache or re-read the source of truth inside the transaction. Treat the cache as eventually consistent, as in [BASE](lesson:acid-base).

### [intermediate] Why delete the cache entry after a write instead of updating it? {#delete-vs-update}

Computing and storing the new value can interleave badly between two writers: the writer with the older value may store last and leave the wrong value cached. Deleting is idempotent and lets the next read rebuild from the source of truth. It also avoids caching values that are never read. Deleting before the database write is worse, because a reader can reload the old value in between.

### [intermediate] Describe a race that leaves stale data even with delete-on-write. {#race-q}

Reader A misses and reads the old value from the database. Writer B updates the database and deletes the key. Reader A then writes its old value into the cache. Nothing deletes it again, so it stays until the TTL. Mitigations are a short TTL, versioned values (store only if the version is newer), a delayed second delete, or reading with a lock for critical keys.

### [intermediate] Local cache (Caffeine) or Redis? {#local-vs-redis}

A local cache is faster (no network) and simplest, but each instance has its own copy, so they diverge and invalidation does not reach them. Redis is shared, so all instances see one value and it survives an application restart, at the cost of a network hop and an extra component to run. A common combination is a small local cache with a very short TTL in front of Redis for hot keys.

### [intermediate] Is Redis single-threaded and what does that mean for you? {#single-thread-q}

Command execution is single-threaded (I/O can use extra threads), so commands are atomic and need no locks, but a slow command blocks all clients. Avoid `KEYS`, very large collections returned in one call and long scripts; use `SCAN`, split big values and use pipelining to reduce round trips. To use more CPU you add shards (Cluster), not threads.

### [intermediate] What is the difference between KEYS and SCAN? {#scan-q}

`KEYS pattern` walks the whole key space in one blocking call, so on a large database it freezes Redis. `SCAN` iterates with a cursor in small batches without blocking, at the cost that it may return a key more than once and does not give a point-in-time snapshot. Use `SCAN` (or maintain an index set) in production.

### [intermediate] What are RDB and AOF? {#persistence-q}

RDB is a periodic snapshot of the dataset: compact and quick to restore, but changes since the last snapshot are lost on a crash. AOF logs every write operation and replays it on restart; with `fsync` every second you lose at most about a second, at the cost of a bigger file and slower restart. A cache can run with neither; sessions or queues often use AOF or both.

### [intermediate] How do replication and Sentinel work, and what can go wrong? {#replication-q}

A primary streams its writes asynchronously to replicas that can serve reads. Sentinel processes monitor the primary, agree it is down by quorum, promote a replica and tell clients the new address. Because replication is asynchronous, writes acknowledged by the old primary but not yet copied are lost after failover, and a network partition can briefly leave two primaries; `min-replicas-to-write` limits the damage.

### [intermediate] How does Redis Cluster distribute data? {#cluster-q}

The key space is split into 16,384 hash slots; a key's slot is `CRC16(key) mod 16384`, and each slot belongs to one primary (with replicas for failover). Clients cache the slot map and are redirected with `MOVED` when it changes. Multi-key operations must stay in one slot, which you arrange with hash tags like `{user42}:cart`. Cluster gives capacity and availability, not cross-slot transactions.

### [intermediate] How would you implement a rate limiter with Redis? {#rate-limiter-q}

For a fixed window: `INCR rate:{user}:{minute}`, set `EXPIRE` when the count is 1, and reject above the limit. For a sliding window: a sorted set of request timestamps per user, removing old entries with `ZREMRANGEBYSCORE` and counting with `ZCARD`. Run the steps in a Lua script so check and update are atomic across instances, and decide whether to fail open or closed if Redis is down.

### [deep] How would you implement a distributed lock with Redis and is it safe? {#lock-q}

Acquire with `SET lock:name token NX PX ttl` (a unique token, only if absent, with an expiry) and release with a Lua script that deletes the key only if the token still matches. It is good for efficiency (avoiding duplicate work). It is not safe for correctness by itself: if the holder pauses past the TTL (garbage collection, network), a second client acquires the lock and both act. For correctness add a **fencing token** checked by the resource, or use a database constraint; the Redlock algorithm across several nodes is debated for exactly this reason.

### [deep] What happens to your service when Redis goes down? {#outage-q}

It should degrade, not fail. Use short connect and command timeouts so threads are not held, a circuit breaker so you stop calling a failing Redis, a `CacheErrorHandler` that treats errors as misses, and a limit on how much load can fall through to the database (rate limit or load shed). Decide per use case: stale data, database fallback, or fail fast. Features that rely on Redis for correctness (locks, rate limits, sessions) need an explicit fail-open or fail-closed decision.

### [deep] How do you size and monitor a Redis cache? {#monitoring-q}

Estimate the working set (keys times average size plus overhead), set `maxmemory` below the host memory leaving room for fragmentation, copy-on-write during snapshots and client buffers, and pick an eviction policy. Monitor hit ratio, `evicted_keys`, `used_memory` against `maxmemory`, memory fragmentation, latency (`LATENCY`, slow log), connected clients and replication lag. Rising evictions with a falling hit ratio means the cache is too small or caching the wrong data.

### [deep] How do you handle a hot key or a big key? {#hot-big-key-q}

A **hot key** concentrates traffic on one node: put a short-lived local cache in front, or spread the load by keeping several copies under different suffixes and reading a random one. A **big key** (a huge string, or a list or hash with millions of entries) blocks the single thread when read or deleted: split it into smaller keys, page with `SSCAN`/`HSCAN`, and delete with `UNLINK`, which frees memory in the background.

### [deep] When would you not use a cache? {#not-cache-q}

When the data must be strongly consistent at the moment of decision (balances, limits, inventory counts for an order), when the hit ratio would be low, when the data changes on nearly every read, or when the database is fast enough and the extra component adds more risk than it removes. A cache also adds failure modes (stampede, stale data, outage handling), so measure first with the query, index and connection pool before reaching for Redis.

### [coding] Implement cache-aside with a TTL, jitter and a null marker. {#coding-cache-aside}

```java
@Service
class AccountCache {
    private static final String NULL = "__NULL__";
    private final StringRedisTemplate redis;
    private final AccountRepository repository;
    private final ObjectMapper mapper;

    Optional<Account> find(String id) throws JsonProcessingException {
        String key = "payments:v1:account:" + id;
        String cached = redis.opsForValue().get(key);
        if (cached != null) {
            return NULL.equals(cached) ? Optional.empty() : Optional.of(mapper.readValue(cached, Account.class));
        }
        Optional<Account> loaded = repository.findById(id);
        Duration ttl = loaded.isPresent()
            ? Duration.ofSeconds(600 + ThreadLocalRandom.current().nextInt(-60, 60))   // jitter avoids mass expiry
            : Duration.ofSeconds(60);                                                  // short TTL for "not found"
        redis.opsForValue().set(key, loaded.isPresent() ? mapper.writeValueAsString(loaded.get()) : NULL, ttl);
        return loaded;
    }

    @Transactional
    void update(Account account) {
        repository.save(account);
        redis.delete("payments:v1:account:" + account.id());   // invalidate after the database write
    }
}
```

Explain the key prefix with a version, the jitter, the short-lived null marker against penetration, delete after the write, and that a balance used for a payment decision should be read from the database instead.

### [coding] Release a Redis lock only if you still own it. {#coding-lock}

```java
private static final DefaultRedisScript<Long> RELEASE = new DefaultRedisScript<>("""
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    else
        return 0
    end
    """, Long.class);

boolean tryLock(String name, String token, Duration ttl) {
    return Boolean.TRUE.equals(redis.opsForValue().setIfAbsent("lock:" + name, token, ttl));   // SET NX PX
}

void unlock(String name, String token) {
    redis.execute(RELEASE, List.of("lock:" + name), token);   // atomic check-and-delete
}
```

Explain why a plain `DEL` is wrong (it could delete another client's lock after your TTL expired), why the script makes the check and delete atomic, and that for correctness you still need a fencing token or a database guard.

### [coding] Write a fixed-window rate limiter with INCR and EXPIRE. {#coding-rate-limit}

```java
boolean allow(String userId, int limitPerMinute) {
    String key = "rate:" + userId + ":" + (System.currentTimeMillis() / 60_000);
    Long count = redis.opsForValue().increment(key);          // atomic, safe across instances
    if (count != null && count == 1) {
        redis.expire(key, Duration.ofSeconds(70));            // window plus a little slack
    }
    return count != null && count <= limitPerMinute;
}
```

Explain that `INCR` is atomic, the key includes the minute so each window is separate, the TTL cleans up, and the small gap between `INCR` and `EXPIRE` is closed by doing both in a Lua script. A fixed window allows a burst at the boundary, so use a sorted set or token bucket for a sliding limit.
