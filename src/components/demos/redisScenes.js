// Frame data for the Redis caching walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const REDIS_SCENES = [
  {
    id: 'patterns',
    label: 'Caching patterns',
    title: 'Four ways to put a cache between your service and the database',
    frames: [
      {
        note: 'Cache-aside (lazy loading) is the default. The application checks Redis first. On a hit it returns the cached value. On a miss it reads the database, stores the result in Redis with a TTL, and returns it. The application owns the logic, and Redis holds only what has been asked for.',
        boxes: [b('a', 'Application', ['get(account:42)'], 'new'), b('r', 'Redis cache', ['1. GET account:42', 'miss, then SET with TTL'], 'warn', 'miss'), b('d', 'Database', ['2. SELECT * FROM account', 'source of truth'], 'ok')],
        deps: [d('Application', 'Redis cache', '1. check', 'warn'), d('Application', 'Database', '2. load on miss', 'ok')],
      },
      {
        note: 'Read-through puts that logic in the cache layer: the application asks only the cache, and the cache itself loads from the database on a miss. Spring Cache with @Cacheable looks like read-through to your code, although underneath it is cache-aside run by a proxy.',
        boxes: [b('a', 'Application', ['cache.get(account:42)'], 'new'), b('r', 'Cache provider', ['loads from the database on a miss', 'caller never sees the miss'], 'ok', 'read-through'), b('d', 'Database', ['loaded by the cache'], 'ok')],
        deps: [d('Application', 'Cache provider', 'one call', 'ok'), d('Cache provider', 'Database', 'on miss', 'ok')],
      },
      {
        note: 'Write-through writes to the cache and the database together, synchronously, before returning. Reads are then always fresh, but every write pays for two stores and you cache data that may never be read.',
        boxes: [b('a', 'Application', ['save(account)'], 'new'), b('r', 'Redis cache', ['updated first'], 'ok', 'write-through'), b('d', 'Database', ['updated in the same call'], 'ok')],
        deps: [d('Application', 'Redis cache', 'write', 'ok'), d('Redis cache', 'Database', 'write', 'ok')],
      },
      {
        note: 'Write-behind (write-back) writes to the cache and returns at once, and a background job flushes to the database later. Writes are very fast and can be batched, but if Redis fails before the flush, accepted writes are lost. Never use it for money without a durable log.',
        boxes: [b('a', 'Application', ['save(counter)'], 'new'), b('r', 'Redis cache', ['accepts the write', 'returns immediately'], 'ok', 'fast'), b('q', 'Background flush', ['batches writes later'], 'warn', 'async'), b('d', 'Database', ['eventually updated', 'data loss risk'], 'warn')],
        deps: [d('Application', 'Redis cache', 'write', 'ok'), d('Redis cache', 'Background flush', 'queued', 'warn'), d('Background flush', 'Database', 'later', 'warn')],
      },
    ],
  },
  {
    id: 'eviction',
    label: 'Expiry and eviction',
    title: 'Keys leave Redis for two different reasons: their TTL ends, or memory runs out',
    frames: [
      {
        note: 'A TTL gives a key a lifetime: SET balance:42 100 EX 60. When it ends the key is expired. Redis removes expired keys in two ways: lazily when a client touches the key, and by a background sampler that checks random keys with a TTL about ten times a second.',
        boxes: [b('k', 'Key balance:42', ['value 100', 'TTL 60 s'], 'new'), b('l', 'Lazy expiry', ['checked on access', 'expired: deleted, returns nil'], 'ok'), b('s', 'Active expiry', ['samples keys with a TTL', 'frees memory in the background'], 'ok')],
        deps: [d('Key balance:42', 'Lazy expiry', 'on read', 'ok'), d('Key balance:42', 'Active expiry', 'sampled', 'ok')],
      },
      {
        note: 'Eviction is different: it happens when used memory reaches maxmemory. Redis must then either refuse writes or remove keys that are still valid. Which keys go depends on maxmemory-policy. The default, noeviction, makes writes fail with an out-of-memory error.',
        boxes: [b('m', 'Redis memory', ['used 2.0 GB of maxmemory 2.0 GB'], 'bad', 'full'), b('n', 'noeviction (default)', ['writes return OOM errors', 'reads still work'], 'warn'), b('e', 'An eviction policy', ['makes room by removing keys'], 'ok')],
        deps: [d('Redis memory', 'noeviction (default)', 'policy', 'warn'), d('Redis memory', 'An eviction policy', 'or', 'ok')],
      },
      {
        note: 'For a cache you normally use allkeys-lru (evict the least recently used key) or allkeys-lfu (the least frequently used key, better when a few keys are very hot). The volatile-* policies only consider keys that have a TTL. LRU and LFU in Redis are approximate: it samples a few keys and evicts the best candidate.',
        boxes: [b('a', 'allkeys-lru', ['least recently used', 'good general cache default'], 'ok'), b('f', 'allkeys-lfu', ['least frequently used', 'keeps hot keys'], 'ok'), b('v', 'volatile-lru / volatile-ttl', ['only keys that have a TTL'], 'warn'), b('r', 'allkeys-random', ['random victim'], 'none')],
        deps: [],
      },
      {
        note: 'Keep an eye on the numbers: evicted_keys rising means the cache is too small for its working set, a falling hit ratio (keyspace_hits against keyspace_misses) means it is not helping, and used_memory near maxmemory means you are one traffic spike away from trouble.',
        boxes: [b('h', 'Hit ratio', ['hits / (hits + misses)', 'target above 90 percent'], 'ok'), b('e', 'evicted_keys', ['rising: cache too small'], 'warn'), b('u', 'used_memory', ['vs maxmemory'], 'warn')],
        deps: [],
      },
    ],
  },
  {
    id: 'invalidation',
    label: 'Invalidation and staleness',
    title: 'The hard part of caching is knowing when a cached value is no longer true',
    frames: [
      {
        note: 'After a write the cached copy is stale. The usual fix is to update the database and then delete the cache key, so the next read reloads fresh data. Deleting is safer than updating the cache in place, because computing the new value twice from two writers can leave the wrong one stored.',
        boxes: [b('a', 'Application', ['update balance'], 'new'), b('d', 'Database', ['1. UPDATE balance'], 'ok'), b('r', 'Redis cache', ['2. DEL account:42', 'next read reloads'], 'ok', 'invalidate')],
        deps: [d('Application', 'Database', '1. write', 'ok'), d('Application', 'Redis cache', '2. delete', 'ok')],
      },
      {
        note: 'Even that has a race. Reader A misses and reads the old value from the database. Writer B updates the database and deletes the key. Reader A then stores its old value in the cache. The cache is now stale until the TTL expires. It is rare, but real.',
        boxes: [b('a', 'Reader A', ['miss, reads OLD value 100'], 'warn'), b('b', 'Writer B', ['writes 150, deletes key'], 'ok'), b('r', 'Redis cache', ['A stores OLD 100 after the delete', 'stale until TTL'], 'bad', 'stale')],
        deps: [d('Reader A', 'Redis cache', 'late SET', 'bad'), d('Writer B', 'Redis cache', 'DEL', 'ok')],
      },
      {
        note: 'Always set a TTL as a safety net, so any mistake heals itself. For data that must be correct, such as balances, do not cache it, or cache with a very short TTL and read the authoritative value from the database before acting on it.',
        boxes: [b('t', 'TTL on every key', ['stale data expires on its own'], 'ok', 'safety net'), b('n', 'Balance for a payment', ['read from the database', 'never decide on a cached value'], 'ok'), b('p', 'Product description', ['cache for minutes or hours'], 'ok')],
        deps: [],
      },
      {
        note: 'With several services, one service writes and others cache. Publish an event after the commit (through an outbox, Kafka or change data capture) and let the caching services delete or refresh their keys. Versioned keys such as account:42:v7 avoid deletes entirely: a new version simply makes the old key unused.',
        boxes: [b('w', 'Writer service', ['commits, publishes AccountUpdated'], 'new'), b('k', 'Kafka', ['event stream'], 'ok'), b('c', 'Cache owner', ['deletes account:42'], 'ok'), b('v', 'Versioned key', ['account:42:v7', 'old versions age out'], 'ok')],
        deps: [d('Writer service', 'Kafka', 'event', 'ok'), d('Kafka', 'Cache owner', 'consume', 'ok')],
      },
    ],
  },
  {
    id: 'failures',
    label: 'Stampede and penetration',
    title: 'Three ways a cache fails under load, and how each is prevented',
    frames: [
      {
        note: 'Cache stampede (thundering herd): a very hot key expires and hundreds of requests miss at the same moment. They all hit the database together and may bring it down. Prevent it with a lock so only one request rebuilds the value, with sync = true in @Cacheable, or by refreshing hot keys before they expire.',
        boxes: [b('k', 'Hot key expires', ['1000 requests miss together'], 'bad', 'stampede'), b('d', 'Database', ['1000 identical queries', 'overload'], 'bad'), b('l', 'Single-flight lock', ['one request rebuilds', 'others wait or use the old value'], 'ok', 'fix')],
        deps: [d('Hot key expires', 'Database', 'all miss', 'bad'), d('Single-flight lock', 'Database', 'only one', 'ok')],
      },
      {
        note: 'Cache avalanche: many keys expire at the same time, because they were all loaded with the same TTL, or Redis restarted empty. The database receives the whole load at once. Add random jitter to TTLs (60 s plus or minus 10 s), warm the cache before traffic, and protect the database with rate limits and circuit breakers.',
        boxes: [b('a', 'Same TTL for 100,000 keys', ['all expire at 12:00:00'], 'bad', 'avalanche'), b('b', 'TTL with jitter', ['expiry spread over time'], 'ok', 'fix'), b('c', 'Cache warm-up', ['preload hot keys'], 'ok')],
        deps: [],
      },
      {
        note: 'Cache penetration: requests for keys that do not exist (a random account number, an attack) never find anything to cache, so every one reaches the database. Cache the empty result for a short time, validate input, and put a Bloom filter in front that says "this id definitely does not exist".',
        boxes: [b('x', 'GET account:999999', ['no such account', 'miss every time'], 'bad', 'penetration'), b('n', 'Cache a null marker', ['short TTL, e.g. 60 s'], 'ok'), b('f', 'Bloom filter', ['rejects ids that cannot exist'], 'ok')],
        deps: [d('GET account:999999', 'Cache a null marker', 'stop repeats', 'ok')],
      },
      {
        note: 'Redis itself can be unavailable. Decide the behaviour in advance: fall back to the database with a circuit breaker and rate limit, serve stale data if that is acceptable, or fail fast. A cache outage must not become a full outage.',
        boxes: [b('r', 'Redis down', ['timeouts or connection errors'], 'bad'), b('c', 'Circuit breaker', ['stop calling Redis for a while'], 'ok'), b('d', 'Fallback to database', ['with rate limiting'], 'ok'), b('t', 'Short Redis timeout', ['100 ms, not 30 s'], 'ok')],
        deps: [d('Redis down', 'Circuit breaker', 'trips', 'bad'), d('Circuit breaker', 'Fallback to database', 'routes', 'ok')],
      },
    ],
  },
  {
    id: 'topology',
    label: 'Replication and cluster',
    title: 'One Redis node is fast but a single point of failure: replicate it, or shard it',
    frames: [
      {
        note: 'Redis executes commands on one main thread, so each command is atomic with no locking, and it can serve hundreds of thousands of simple operations per second. Slow commands (KEYS *, huge values, big sorted-set operations) block every other client.',
        boxes: [b('c1', 'Client A', ['GET account:1'], 'new'), b('c2', 'Client B', ['KEYS *'], 'bad', 'blocks'), b('r', 'Redis event loop', ['one command at a time', 'atomic'], 'ok')],
        deps: [d('Client A', 'Redis event loop', 'fast', 'ok'), d('Client B', 'Redis event loop', 'slow command', 'bad')],
      },
      {
        note: 'Replication copies data from a primary to replicas asynchronously. Replicas serve reads and take over if the primary dies. Redis Sentinel watches the primary, and when it fails, promotes a replica and tells clients. Because replication is asynchronous, a failover can lose the last few writes.',
        boxes: [b('p', 'Primary', ['writes'], 'ok'), b('r1', 'Replica 1', ['copy, serves reads'], 'ok'), b('r2', 'Replica 2', ['copy'], 'ok'), b('s', 'Sentinel', ['monitors, promotes a replica'], 'new')],
        deps: [d('Primary', 'Replica 1', 'async copy', 'ok'), d('Primary', 'Replica 2', 'async copy', 'ok'), d('Sentinel', 'Primary', 'watches', 'ok')],
      },
      {
        note: 'Redis Cluster shards data when one node cannot hold it all. The key space is split into 16,384 hash slots (slot = CRC16(key) mod 16384), each owned by a primary with replicas. Multi-key commands must stay in one slot, which you control with hash tags such as {user42}:cart.',
        boxes: [b('a', 'Primary A', ['slots 0 - 5460'], 'ok'), b('b', 'Primary B', ['slots 5461 - 10922'], 'ok'), b('c', 'Primary C', ['slots 10923 - 16383'], 'ok'), b('k', 'Client', ['hash(key) picks the node'], 'new')],
        deps: [d('Client', 'Primary A', 'slot 120', 'ok'), d('Client', 'Primary B', 'slot 7000', 'ok'), d('Client', 'Primary C', 'slot 15000', 'ok')],
      },
      {
        note: 'A cache can lose its data, but sessions, rate limits and locks often cannot. Persistence helps: RDB takes periodic snapshots (compact, fast restart, can lose minutes), AOF logs every write (more durable, larger). Many caches run with persistence off and rebuild from the database.',
        boxes: [b('r', 'RDB snapshot', ['point-in-time file', 'may lose minutes'], 'warn'), b('a', 'AOF log', ['every write appended', 'fsync every second'], 'ok'), b('n', 'No persistence', ['pure cache', 'rebuild from database'], 'ok')],
        deps: [],
      },
    ],
  },
];
