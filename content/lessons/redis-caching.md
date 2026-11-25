---
title: Caching with Redis — patterns, eviction, invalidation and failure modes
nav: Caching with Redis
slug: redis-caching
summary: Why and how to cache with Redis: cache-aside, read-through, write-through and write-behind, Redis data structures and use cases, TTL and eviction policies, invalidation and staleness, stampede, avalanche and penetration, single-thread model, persistence, replication, Sentinel and Cluster, Spring integration, with Java examples and interview questions.
tags: [Redis, Caching, Eviction, TTL, Cache-aside, Cluster, Spring]
order: 26
topic: Databases / Consistency and caching
updated: 2026-11-24
subnav: true
---

Many interview questions start with "Our balance page was slow, so we added Redis". Then the interviewer asks:

- Which caching pattern did you use?
- What happens when the cache and the database disagree?
- What happens when a popular key expires?
- What do you do when Redis is down?
- How does Redis decide what to throw away when memory is full?

This lesson covers the caching patterns, how Redis itself works, and the ways a cache can fail.

Related lessons: [Spring caching](lesson:spring-caching-async) (the annotations), [SQL vs NoSQL](lesson:sql-vs-nosql) and [ACID vs BASE](lesson:acid-base) (a cache is eventually consistent), and [messaging](lesson:messaging) and the [saga](lesson:saga) outbox idea (clearing caches across services).

The animation has five scenes: the four patterns, expiry and eviction, invalidation, failure modes, and replication and cluster.

```demo
name: redis-walk
```

> **One sentence to remember:** *A cache is a fast, throw-away copy, so give every key a TTL and never decide anything important from it.*

## Why cache, and what to cache {#why}

A **cache** keeps the result of slow work close to the caller, so the next request can skip the work.

A cache helps when the data has three properties:

- It is **read much more often than it changes**.
- It is **slow or expensive to compute or fetch**.
- It is fine if it is **a little out of date** (slightly stale).

| Good candidates | Poor candidates |
| --- | --- |
| Reference data, such as exchange rates, branch lists and a product catalogue. | An account balance used to approve a payment. |
| Results of heavy queries and totals. | Data that changes on every request. |
| Session and token data. | Requests that rarely repeat, so the cache is rarely hit (a low hit ratio). |
| Rate-limit counters and idempotency keys. | Large objects that are read only once. |
| Permission lookups, with a short TTL. | Anything that must always be exactly up to date (strongly consistent). |

Two numbers decide whether a cache is worth it:

- The **hit ratio**: hits divided by (hits plus misses). A **hit** means the value was in the cache. A **miss** means it was not.
- The **cost of a miss**: how slow the work is when the cache cannot help.

A hit ratio of 60 percent sounds good, but it still means 40 percent of the traffic reaches the database.

## Caching patterns {#patterns}

A **TTL** (time to live) is how long a key may stay in the cache before Redis removes it.

| Pattern | Who talks to the database | Reading | Writing | Trade-off |
| --- | --- | --- | --- | --- |
| **Cache-aside** (lazy loading) | The application. | Check the cache. On a miss, load from the database and store the result. | Write the database, then delete the key. | It is simple and the usual default. The first read is slow, and there is a short time when the cache can be out of date. |
| **Read-through** | The cache layer. | The cache loads the value itself on a miss. | The same as cache-aside. | The application only talks to the cache. You must give the cache a loader. |
| **Write-through** | The cache layer, in the same call. | Always fresh. | Write the cache and the database together. | Writes are slower, and you cache data that nobody may read. |
| **Write-behind** (write-back) | A background job. | Fast. | Write the cache now, and copy to the database later in batches. | Writes are very fast, but **data is lost if the cache dies before the copy**. |
| **Refresh-ahead** | A background job. | Popular keys never expire. | Reload a key before its TTL ends. | It avoids stampedes, but wastes work on keys that are no longer used. |

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

Spring's `@Cacheable` is cache-aside, run for you by a [proxy](lesson:spring-aop). To your code it looks like read-through.

Write-behind suits counters, view counts and analytics. It does not suit money.

## Redis data structures and what they are for {#structures}

Redis is more than a key-value cache. It is an in-memory server for **data structures**: lists, sets, hashes and more. Pick the structure that matches how you read and write the data.

| Structure | Typical use | Key commands |
| --- | --- | --- |
| **String** | Cached JSON, counters, flags and locks. | `SET k v EX 60`, `GET`, `INCR`, `SET k v NX PX 30000` |
| **Hash** | An object with fields, when you update only some fields. | `HSET`, `HGET`, `HGETALL` |
| **List** | A simple queue, or the most recent items. | `LPUSH`, `RPOP`, `BRPOP` |
| **Set** | Unique members, tags and set maths (union, intersection). | `SADD`, `SISMEMBER`, `SINTER` |
| **Sorted set** | Leaderboards, items ordered by time, and rate-limit windows. | `ZADD`, `ZRANGE`, `ZRANGEBYSCORE` |
| **Bitmap / HyperLogLog** | Daily "was active" flags, and approximate counts of unique items. | `SETBIT`, `PFADD`, `PFCOUNT` |
| **Stream** | A log you only add to, read by consumer groups. | `XADD`, `XREADGROUP` |
| **Pub/Sub** | Fire-and-forget broadcast. Messages are not stored. | `PUBLISH`, `SUBSCRIBE` |

Common recipes:

- **Rate limiter.** Run `INCR rate:user42:12:01`, and call `EXPIRE` after the first increment. For a sliding window, use a sorted set.
- **Session store.** Keep one hash per session, with a TTL that is renewed each time the session is used.
- **Distributed lock.** Take it with `SET lock:job1 token NX PX 30000`. Release it with a script that deletes the key only if the token still matches.
- **Idempotency key.** Run `SET idem:abc 1 NX EX 86400`. If the key already exists, the request is a duplicate.

## TTL, expiry and eviction {#eviction}

Redis removes keys for two different reasons, and people often mix them up.

- **Expiry** removes a key because its **TTL has ended**. Redis does this in two ways:
  - **Lazily**: when a client touches an expired key, Redis deletes it.
  - **Actively**: a background task checks random keys that have a TTL.

  So an expired key may stay in memory for a short time before it is cleaned up.
- **Eviction** removes a key that is **still valid**, because memory has reached the limit set by `maxmemory`. The `maxmemory-policy` setting decides which key goes.

| Policy | Meaning |
| --- | --- |
| `noeviction` (default) | Refuse writes with an out-of-memory error. Reads still work. |
| `allkeys-lru` | Evict the least recently used key, from all keys. This is the usual choice for a cache. |
| `allkeys-lfu` | Evict the least frequently used key. This is better when a few keys are very popular. |
| `volatile-lru`, `volatile-lfu`, `volatile-ttl` | Look only at keys that have a TTL. `volatile-ttl` evicts the key that will expire soonest. |
| `allkeys-random`, `volatile-random` | Evict a random key. |

**LRU** means "least recently used". **LFU** means "least frequently used".

In Redis, LRU and LFU are **approximate**. Redis looks at a small sample of keys (`maxmemory-samples`, default 5) and evicts the best one from that sample. This saves memory and CPU.

Be careful when one Redis holds both cache data and data that must not disappear, such as sessions and locks. An `allkeys-*` policy can delete the important data. Either use a `volatile-*` policy and give a TTL only to cache keys, or run separate Redis instances.

```
# redis.conf for a pure cache
maxmemory 2gb
maxmemory-policy allkeys-lfu
```

What to watch:

- `INFO stats` shows `keyspace_hits` and `keyspace_misses`, which give the hit ratio.
- `evicted_keys` in the same output. If it keeps rising, the data you use often (the working set) does not fit in memory.
- `expired_keys`, the number of keys removed by TTL.
- `INFO memory` shows `used_memory` and `mem_fragmentation_ratio`.

## Invalidation and staleness {#invalidation}

> "There are only two hard things in computer science: cache invalidation and naming things."

**Invalidation** means removing or replacing a cached value because the source has changed. The cached copy becomes wrong (**stale**) the moment the source changes.

Your options, from the simplest:

1. **TTL only.** Accept that a value can be stale for up to the TTL. It is simple, and you should always add a TTL as a safety net.
2. **Delete on write.** Update the database, then `DEL` the key. The next read loads the fresh value. This is better than updating the cached value directly, because two writers at the same time could leave the older value in the cache.
3. **Event-driven.** After the commit, the writing service publishes an event (through an outbox, [Kafka](lesson:messaging) or change data capture). The services that own caches then delete or refresh their keys.
4. **Versioned keys.** Put a version number in the key, such as `account:42:v7`. A new version makes the old key unreachable, and it expires by itself later.
5. **Write-through.** Update the cache and the database together, and accept the slower writes.

Even delete on write has a **race**:

1. Reader A misses the cache and reads the old value from the database.
2. Writer B updates the database and deletes the key.
3. Reader A stores its old value in the cache.

Now the cache is wrong until the TTL ends. This is rare. The usual answer is a **short TTL** plus the delete, or a second delete a little later. If even this is not acceptable, do not cache that data, or read the source of truth before you act on it.

> **Banking rule of thumb:** cache descriptions, rates and reference data freely. For balances and limits, either do not cache them, or cache them for display only and read the database again inside the [transaction](lesson:spring-transactions) that makes the decision.

## Failure modes {#failures}

| Problem | What happens | Typical defences |
| --- | --- | --- |
| **Cache stampede** (also called thundering herd or dog-piling) | A popular key expires, and many requests try to rebuild it at the same time. | Let only one request rebuild it, with a lock (`sync = true`, `SET NX`). Refresh it ahead of time. Serve the old value while one request refreshes. |
| **Cache avalanche** | Many keys expire at the same moment, or Redis restarts empty. | Add random jitter to TTLs. Warm up the cache. Put rate limiting and a circuit breaker in front of the database. Keep replicas. |
| **Cache penetration** | Requests for keys that do not exist always miss, so they always reach the database. | Cache a short-lived "not found" marker. Validate the input. Use a Bloom filter of valid ids. |
| **Hot key** | One key gets so much traffic that it overloads one node. | Put a local in-process cache in front. Store copies of the key under several names. |
| **Big key** | One huge value or collection blocks Redis's single thread. | Split it. Delete it with `UNLINK` (deletes in the background) instead of `DEL`. Avoid collections that grow without limit. |
| **Redis outage** | Calls to Redis time out. | Use a short timeout and a circuit breaker. Fall back to the database or to stale data. Never block the request thread for seconds. |

**Jitter** is a small random amount added to each TTL, so keys do not all expire at once.

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

A **Bloom filter** is a small data structure that answers "could this id be in the set?". When it says no, the answer is always right. When it says yes, it is wrong a small part of the time. So ids that were never created are rejected without touching Redis or the database.

## How Redis works and how it scales {#internals}

**Commands run on a single thread.** Redis runs commands one at a time on one main thread. Newer versions use extra threads, but only for network input and output.

- The good part: every command is **atomic** (it runs completely, with nothing in between) without any locks, and latency stays low.
- The bad part: one slow command blocks every other client. So avoid `KEYS *` (use `SCAN`, which walks the keys in small steps). Also avoid `SMEMBERS` or `HGETALL` on huge collections, and long Lua scripts.

**Atomicity and batching.**

- A single command is atomic. `INCR` is a safe counter without a lock.
- **Pipelining** sends many commands without waiting for each reply. This saves network round trips, but it is not atomic.
- `MULTI`/`EXEC` queues commands and runs them together, with no other client's commands in between. There is **no rollback**: if one command fails while running, the others are not undone. `WATCH` adds optimistic locking.
- **Lua scripts** run atomically on the server. They are the right tool for check-and-set logic, such as releasing a lock only if you still own it.

**Persistence.** A pure cache can run without persistence and rebuild itself from the database. Otherwise, choose one of these:

| Option | How | Trade-off |
| --- | --- | --- |
| **RDB** | Take a snapshot of all data at regular times. | The file is compact and restarts are fast, but you can lose minutes of writes. |
| **AOF** | Add every write to a log file (`fsync` every second, or after every write). | It is more durable, but the file is larger and must be rewritten in the background. |
| **Both** | RDB for a fast restart and AOF for durability. | This is common for sessions and queues. |

**Replication and Sentinel.** A **primary** node copies its writes to **replicas**. The copy is **asynchronous**: the primary does not wait for the replicas. Replicas serve reads and stand by to take over. **Sentinel** watches the primary. When it fails, Sentinel picks a new primary and tells clients where it is. Because the copy is asynchronous, a failover can lose the last few writes that were already confirmed to clients.

**Redis Cluster** splits the data across nodes when one node is not enough. This is called **sharding**.

- The keys are divided into **16,384 hash slots**. A key's slot is `CRC16(key) mod 16384`.
- Each slot is served by one primary, which has its own replicas.
- Clients learn which node owns which slot and go straight to the right node. When the map changes, Redis answers with a `MOVED` redirect.
- Commands with several keys, and Lua scripts, must use keys in **one slot**. **Hash tags** arrange this: only the part in braces is hashed, so `{user42}:cart` and `{user42}:profile` are in the same slot.

**Security.** Never expose Redis to the internet.

- Bind it to a private network.
- Turn on `AUTH` and **ACLs** (access control lists): one user per application, allowed only the commands it needs.
- Use TLS.
- Block dangerous commands such as `FLUSHALL` and `CONFIG` for applications.

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

- **Lettuce** is the default client. It is non-blocking, and its connections are thread-safe. **Jedis** uses a pool of blocking connections.
- Store values as **JSON** or another explicit format, not with Java serialization. JSON is readable and smaller, and it does not break when a class changes. Do not cache JPA entities with lazy associations. Cache DTOs (plain data objects) instead.
- Set **command and connect timeouts**, for example 100 to 300 ms, so a slow Redis does not hold request threads. Add a `CacheErrorHandler` that logs the error and falls through to the database. Then a cache failure does not become a failed request.
- `StringRedisTemplate` is the low-level API for counters, locks and sets. **Redisson** adds distributed locks, semaphores and rate limiters.
- A `SET NX PX` lock on a single node is fine for efficiency, to avoid doing the same work twice. For correctness when things fail, there is a known debate about the Redlock algorithm. You need a **fencing token** or a database constraint as the final guard (see the [distributed scheduler](lesson:distributed-scheduler) lesson). A fencing token is a number that grows with each new lock, so the resource can reject an old lock holder.
- Prefix keys with the service and a version, such as `payments:v2:account:42`. Then a deployment that changes the data format does not read the old format.

Try it in the lab: [Cache-aside with Redis, and the stampede](lab:redis-cache-stampede).

## Cheat sheet {#cheatsheet}

| Need | Do |
| --- | --- |
| Default pattern | Cache-aside, a TTL on every key, and a delete after the database write. |
| Data that must be exact | Do not cache it, or read the database again inside the transaction. |
| Settings for a pure cache | Set `maxmemory`, and use `allkeys-lru` or `allkeys-lfu`. |
| Sessions or locks in the same Redis | Use a `volatile-*` policy or a separate instance. |
| A popular key expires | Use `sync = true` or a lock, and refresh ahead. |
| Many keys expire together | Add TTL jitter and warm up the cache. |
| Keys that do not exist | Cache a "not found" marker with a short TTL, or use a Bloom filter. |
| Redis is down | Use a short timeout, a circuit breaker and a database fallback. |
| List keys | Use `SCAN`, never `KEYS *`. |
| Atomic check-and-set | Use a Lua script. |
| More read capacity | Add replicas. |
| More data than one node holds | Use Redis Cluster, with hash tags for related keys. |
| Key names | Use `service:version:entity:id`. |

## Interview questions {#questions}

### [basic] What is Redis and why is it fast? {#what-is-redis}

Redis is an in-memory data structure server. It is used as a cache, a session store, a message broker and a counter service.

It is fast for four reasons:

1. The data lives in RAM.
2. The data structures are simple and efficient.
3. Commands run on a single thread, so there is no locking.
4. The network protocol is lightweight.

Most commands take microseconds, so the network round trip usually costs more than the command itself.

### [basic] What is cache-aside? {#cache-aside-q}

A pattern where the application manages the cache itself:

- To read, check the cache. On a miss, read the database and store the result in the cache.
- To write, update the database and then delete the key.

It is the most common pattern for three reasons. It is simple. If the cache fails, the results are still correct. And only data that someone asked for is cached. The costs are a slow first read and a short time when the cache can be out of date.

### [basic] What is the difference between read-through, write-through and write-behind? {#patterns-q}

- **Read-through:** the cache loads the value from the database on a miss.
- **Write-through:** each write goes to the cache and the database together. Reads are always fresh, but writes are slower.
- **Write-behind:** each write goes to the cache, and a background job copies it to the database later. It is fast, but writes the cache accepted are lost if the cache fails before the copy.

Cache-aside is different from all three: the application, not the cache, does the loading.

### [basic] What is a TTL and why should every cached key have one? {#ttl-q}

A TTL (time to live) is how long a key lives. After that, Redis removes it.

Every key needs one for three reasons:

1. It limits how stale a value can get.
2. It limits how much memory the cache uses.
3. It fixes mistakes by itself, such as a missed invalidation.

A key without a TTL stays until it is evicted or deleted. That is how caches slowly fill up with data nobody needs.

### [basic] What data structures does Redis support? {#structures-q}

Strings, hashes, lists, sets, sorted sets, bitmaps, HyperLogLogs, streams and geospatial indexes. It also has pub/sub.

Choose by how you use the data:

- Strings for cached JSON and counters.
- Hashes for objects.
- Sorted sets for leaderboards or sliding windows.
- Sets for "is this a member?" checks.
- Streams for a log with consumer groups.

### [basic] What is the difference between expiry and eviction? {#expiry-vs-eviction}

- **Expiry** removes a key because its TTL ended. It is about **time**.
- **Eviction** removes a valid key because memory reached `maxmemory`. It is about **space**. The `maxmemory-policy` setting chooses the key.

The default policy, `noeviction`, does not evict anything. It rejects writes when memory is full.

### [basic] How does Redis expire keys? {#how-expire}

In two ways:

1. **Lazily.** When a client reads an expired key, Redis deletes it and answers as if it did not exist.
2. **Actively.** A background task checks a sample of keys with a TTL several times per second and deletes the expired ones. If many are expired, it repeats straight away.

So a key can stay in memory a little after its TTL, but Redis never returns it.

### [basic] What is the default maxmemory policy and what does it do? {#noeviction-q}

The default is `noeviction`. When memory is full, write commands fail with an out-of-memory error, and reads keep working.

That is safe when Redis is your data store. It is wrong for a cache. For a cache you want `allkeys-lru` or `allkeys-lfu`, so the cache stays writable by throwing away keys nobody uses.

### [intermediate] LRU or LFU: which eviction policy would you choose? {#lru-lfu-q}

It depends on how the keys are used.

- **LRU** evicts the key that was not used for the longest time. It suits workloads where a recently used key is likely to be used again.
- **LFU** evicts the key that is used least often. It suits workloads with a stable set of popular keys. It also protects them when something reads a lot of cold data once.

In Redis both are approximate, because Redis samples a few keys instead of keeping an exact order. If it matters, measure the hit ratio with each.

### [intermediate] What is a cache stampede and how do you prevent it? {#stampede-q}

When a popular key expires, many requests miss at the same time. They all load the same data from the database, which can overload it.

Defences:

1. Let only one request rebuild the value, with a lock or `sync = true`. The others wait or use the old value. This is called single-flight or request coalescing.
2. Refresh popular keys before they expire.
3. Add jitter to the TTL.
4. Rate limit the code that loads from the database.

### [intermediate] What is a cache avalanche? {#avalanche-q}

The database suddenly gets the full load, for one of two reasons:

- Many keys expire at the same moment, because they were loaded together with the same TTL.
- The cache is empty after a restart.

Defences: add random jitter to TTLs, warm up the cache before it takes traffic, keep replicas so the cache stays available, and protect the database with a circuit breaker and limits.

### [intermediate] What is cache penetration and how do you prevent it? {#penetration-q}

Requests for data that does not exist never find anything in the cache, because there is nothing to store. Examples are random ids or a scanning attack. So every such request reaches the database.

Defences:

1. Cache a short-lived "not found" marker (a null marker).
2. Check that the id has a valid format.
3. Rate limit.
4. Put a **Bloom filter** of existing ids in front, so ids that cannot exist are rejected early.

The null marker needs a short TTL, so a record that is created later appears quickly.

### [intermediate] How do you keep the cache consistent with the database? {#consistency-q}

You usually cannot make it perfectly consistent, so you limit how wrong it can be:

1. Update the database first, then delete the key.
2. Add a TTL as a safety net.
3. With several services, publish an event after the commit (through an outbox or change data capture), and let it trigger the invalidation.
4. For data that must be exact, skip the cache, or read the source of truth again inside the transaction.

Treat the cache as eventually consistent, as in [BASE](lesson:acid-base).

### [intermediate] Why delete the cache entry after a write instead of updating it? {#delete-vs-update}

Because two writers can get in each other's way. Each one computes and stores its new value, and the writer with the older value may store last. Then the wrong value stays in the cache.

Deleting is better for three reasons:

1. Deleting twice has the same effect as deleting once (it is idempotent).
2. The next read rebuilds the value from the source of truth.
3. You do not cache values that nobody reads.

Deleting **before** the database write is worse. A reader can load the old value again in the gap between the delete and the write.

### [intermediate] Describe a race that leaves stale data even with delete-on-write. {#race-q}

1. Reader A misses and reads the old value from the database.
2. Writer B updates the database and deletes the key.
3. Reader A writes its old value into the cache.

Nothing deletes it again, so the old value stays until the TTL ends.

Ways to reduce it:

- A short TTL.
- Versioned values: store a value only if its version is newer.
- A second delete a little later.
- A lock around the read, for critical keys.

### [intermediate] Local cache (Caffeine) or Redis? {#local-vs-redis}

It depends on whether the copies must agree.

- **A local cache** is faster, because there is no network, and it is the simplest. But each instance has its own copy. The copies drift apart, and an invalidation on one instance does not reach the others.
- **Redis** is shared, so all instances see one value, and the data survives an application restart. The cost is a network call and one more component to run.

A common mix is a small local cache with a very short TTL in front of Redis, for the most popular keys.

### [intermediate] Is Redis single-threaded and what does that mean for you? {#single-thread-q}

**Yes, for running commands.** Network input and output can use extra threads.

What this means:

1. Each command is atomic and needs no locks.
2. One slow command blocks all clients. So avoid `KEYS`, very large collections returned in one call, and long scripts.
3. Use `SCAN`, split big values, and use pipelining to save round trips.
4. To use more CPU, you add shards (Cluster), not threads.

### [intermediate] What is the difference between KEYS and SCAN? {#scan-q}

- `KEYS pattern` walks every key in one blocking call. On a large database it freezes Redis.
- `SCAN` walks the keys in small batches with a cursor, without blocking. The cost: it may return a key more than once, and it does not give a snapshot of one moment in time.

In production, use `SCAN`, or keep your own index in a set.

### [intermediate] What are RDB and AOF? {#persistence-q}

Two ways Redis saves data to disk.

- **RDB** is a regular snapshot of all the data. It is compact and quick to restore, but changes since the last snapshot are lost in a crash.
- **AOF** logs every write and replays the log on restart. With `fsync` every second you lose at most about one second. The cost is a bigger file and a slower restart.

A cache can run with neither. Sessions or queues often use AOF, or both.

### [intermediate] How do replication and Sentinel work, and what can go wrong? {#replication-q}

How it works:

1. A primary sends its writes to replicas, without waiting for them (asynchronously). Replicas can serve reads.
2. Sentinel processes watch the primary. When enough of them agree that it is down (a quorum), they promote a replica and tell clients the new address.

What can go wrong:

- Writes the old primary confirmed, but had not yet copied, are lost after the failover.
- A network split can briefly leave two primaries. The `min-replicas-to-write` setting limits the damage.

### [intermediate] How does Redis Cluster distribute data? {#cluster-q}

By hash slots:

1. The keys are split into 16,384 hash slots. A key's slot is `CRC16(key) mod 16384`.
2. Each slot belongs to one primary, which has replicas for failover.
3. Clients keep a copy of the slot map. When it changes, Redis redirects them with `MOVED`.
4. Operations on several keys must stay in one slot. You arrange that with hash tags, such as `{user42}:cart`.

Cluster gives you more capacity and availability. It does not give you transactions across slots.

### [intermediate] How would you implement a rate limiter with Redis? {#rate-limiter-q}

- **Fixed window:** run `INCR rate:{user}:{minute}`. When the count is 1, set `EXPIRE`. Reject the request when the count is above the limit.
- **Sliding window:** keep a sorted set of request times per user. Remove old entries with `ZREMRANGEBYSCORE`, and count the rest with `ZCARD`.

Run the steps in a Lua script, so the check and the update are atomic across all instances. Also decide what happens if Redis is down: allow requests (fail open) or reject them (fail closed).

### [deep] How would you implement a distributed lock with Redis and is it safe? {#lock-q}

How to build it:

1. Take the lock with `SET lock:name token NX PX ttl`. The token is unique to you, `NX` means "only if the key does not exist", and `PX` sets an expiry.
2. Release it with a Lua script that deletes the key only if the token still matches.

**It is good for efficiency, but not safe for correctness on its own.** The holder can pause for longer than the TTL, for example during garbage collection or a network delay. Then a second client takes the lock, and both act.

For correctness, add a **fencing token** that the protected resource checks, or use a database constraint. The Redlock algorithm, which uses several Redis nodes, is debated for exactly this reason.

### [deep] What happens to your service when Redis goes down? {#outage-q}

It should get slower or less fresh, but keep working. Prepare for it:

1. Use short connect and command timeouts, so threads are not held.
2. Use a circuit breaker, so you stop calling a failing Redis.
3. Add a `CacheErrorHandler` that treats errors as misses.
4. Limit how much load can fall through to the database, with rate limiting or load shedding.

Decide per use case: serve stale data, fall back to the database, or fail fast. Features that need Redis to be correct, such as locks, rate limits and sessions, need an explicit choice: allow requests (fail open) or reject them (fail closed).

### [deep] How do you size and monitor a Redis cache? {#monitoring-q}

To size it:

1. Estimate the working set: the number of keys times the average size, plus overhead.
2. Set `maxmemory` below the host's memory. Leave room for fragmentation, for copy-on-write during snapshots, and for client buffers.
3. Pick an eviction policy.

To monitor it, watch:

- The hit ratio and `evicted_keys`.
- `used_memory` compared with `maxmemory`, and memory fragmentation.
- Latency (`LATENCY` and the slow log).
- Connected clients and replication lag.

If evictions rise while the hit ratio falls, the cache is too small or it caches the wrong data.

### [deep] How do you handle a hot key or a big key? {#hot-big-key-q}

- A **hot key** sends most of the traffic to one node. Put a short-lived local cache in front of it. Or spread the load: keep several copies under different suffixes and read a random one.
- A **big key**, such as a huge string or a list or hash with millions of entries, blocks the single thread when it is read or deleted. Split it into smaller keys, read it in pages with `SSCAN` or `HSCAN`, and delete it with `UNLINK`, which frees the memory in the background.

### [deep] When would you not use a cache? {#not-cache-q}

In four cases:

1. The data must be exactly right at the moment of a decision, such as balances, limits or stock counts for an order.
2. The hit ratio would be low.
3. The data changes on almost every read.
4. The database is already fast enough, and one more component adds more risk than it removes.

A cache also brings new problems: stampedes, stale data and outages to handle. So measure first, and check the query, the indexes and the connection pool before you reach for Redis.

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

Points to explain:

- The key prefix includes a version (`v1`), so a new data format gets new keys.
- The jitter spreads out expiry times.
- The short-lived null marker stops penetration.
- The key is deleted after the database write.
- A balance used for a payment decision should be read from the database instead.

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

Points to explain:

- A plain `DEL` is wrong. If your TTL already expired and another client took the lock, `DEL` would delete **their** lock.
- The script makes the check and the delete one atomic step.
- For correctness you still need a fencing token or a database guard.

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

Points to explain:

- `INCR` is atomic.
- The key includes the minute, so each window has its own counter.
- The TTL cleans up old counters.
- There is a small gap between `INCR` and `EXPIRE`. Doing both in a Lua script closes it.
- A fixed window allows a burst at the edge between two windows. For a sliding limit, use a sorted set or a token bucket.
