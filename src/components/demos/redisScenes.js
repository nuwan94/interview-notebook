// Frame data for the Redis caching walk-through.
// The patterns, failures and topology scenes use the box-and-arrow player, because parts calling each other is
// the real mechanism there. Expiry and eviction is about memory, so it uses RedisMemStage (a memory gauge and the
// keys). Invalidation is about the order of events in time, so it uses RedisSeqStage (a sequence diagram).
// box.tone: ok | bad | warn | new | none.
import { RedisMemStage } from './RedisMemStage.jsx';
import { RedisSeqStage } from './RedisSeqStage.jsx';

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

// a key card for RedisMemStage
const k = (id, name, value, meta, state = 'live', tag) => ({ id, name, value, meta, state, tag });
// a step for RedisSeqStage
const s = (id, from, to, text, chip, tone) => ({ id, from, to, text, chip, tone });

// keys in a full Redis, used by the eviction frames
const fullKeys = (last, gone) => [
  k('rate', 'rate:EUR-USD', '1.08', ['last used 1 s ago', 'read 9,000 times']),
  k('branch', 'branch:MAN', '"Manchester"', ['last used 3 h ago', 'read 400 times']),
  k('promo', 'promo:summer', '"5% cashback"', ['last used 2 min ago', 'read 2 times']),
  k('acc', 'account:42', '{"name":"Ana"}', ['last used 5 s ago', 'read 1,200 times']),
  last,
].map((x) => (x.id === gone ? { ...x, state: 'evicted', tag: 'evicted' } : x));
const written = k('new', 'fx:GBP-USD', '1.27', ['just written'], 'new', 'new');

const seqCols = [
  { id: 'a', title: 'Reader A', tone: 'new' },
  { id: 'r', title: 'Redis', tone: 'warn' },
  { id: 'db', title: 'Database', tone: 'ok' },
  { id: 'w', title: 'Writer B', tone: 'new' },
];
const race = [
  s('r1', 'a', 'r', 'GET account:42', 'miss', 'warn'),
  s('r2', 'a', 'db', 'SELECT balance', '100', 'new'),
  s('r3', 'w', 'db', 'UPDATE balance = 150', '150', 'ok'),
  s('r4', 'w', 'r', 'DEL account:42', 'empty', 'ok'),
  s('r5', 'a', 'r', 'SET old value 100', '100 stale', 'bad'),
];

export const REDIS_SCENES = [
  {
    id: 'patterns',
    label: 'Caching patterns',
    title: 'Four ways to put a cache between your service and the database',
    frames: [
      {
        note: 'Cache-aside is the default pattern. The application asks Redis first. On a hit, it uses the cached value. On a miss, it reads the database, stores the result in Redis with a TTL, and returns it. Redis only holds what someone has asked for.',
        boxes: [b('a', 'Application', ['get(account:42)'], 'new'), b('r', 'Redis cache', ['1. GET account:42', 'miss, then SET with TTL'], 'warn', 'miss'), b('d', 'Database', ['2. SELECT * FROM account', 'source of truth'], 'ok')],
        deps: [d('Application', 'Redis cache', '1. check', 'warn'), d('Application', 'Database', '2. load on miss', 'ok')],
      },
      {
        note: 'Read-through moves that logic into the cache layer. The application only asks the cache, and the cache loads from the database on a miss. Spring\'s @Cacheable looks like read-through to your code. Underneath, a proxy runs cache-aside for you.',
        boxes: [b('a', 'Application', ['cache.get(account:42)'], 'new'), b('r', 'Cache provider', ['loads from the database on a miss', 'caller never sees the miss'], 'ok', 'read-through'), b('d', 'Database', ['loaded by the cache'], 'ok')],
        deps: [d('Application', 'Cache provider', 'one call', 'ok'), d('Cache provider', 'Database', 'on miss', 'ok')],
      },
      {
        note: 'Write-through writes to the cache and the database in the same call, before it returns. Reads are then always fresh. The cost is that every write goes to two stores, and you cache data that nobody may read.',
        boxes: [b('a', 'Application', ['save(account)'], 'new'), b('r', 'Redis cache', ['updated first'], 'ok', 'write-through'), b('d', 'Database', ['updated in the same call'], 'ok')],
        deps: [d('Application', 'Redis cache', 'write', 'ok'), d('Redis cache', 'Database', 'write', 'ok')],
      },
      {
        note: 'Write-behind writes to the cache and returns at once. A background job copies the writes to the database later, in batches. Writes are very fast. But if Redis fails before the copy, the accepted writes are lost. So never use it for money without a durable log.',
        boxes: [b('a', 'Application', ['save(counter)'], 'new'), b('r', 'Redis cache', ['accepts the write', 'returns immediately'], 'ok', 'fast'), b('q', 'Background flush', ['batches writes later'], 'warn', 'async'), b('d', 'Database', ['eventually updated', 'data loss risk'], 'warn')],
        deps: [d('Application', 'Redis cache', 'write', 'ok'), d('Redis cache', 'Background flush', 'queued', 'warn'), d('Background flush', 'Database', 'later', 'warn')],
      },
    ],
  },
  {
    id: 'eviction',
    label: 'Expiry and eviction',
    title: 'Keys leave Redis for two reasons: their TTL ends, or memory is full',
    stage: RedisMemStage, // drawn as memory: a gauge against maxmemory and the keys as cards
    frames: [
      {
        line: 'SET balance:42 100 EX 60',
        result: { text: 'stored for 60 s', tone: 'ok' },
        used: 0.9, max: 2, usedText: '0.9 GB used of 2 GB', policy: 'allkeys-lru',
        focus: ['bal'],
        keys: [
          k('bal', 'balance:42', '100', ['TTL 60 s'], 'new', 'new'),
          k('sess', 'session:7', '{"user":"ana"}', ['TTL 2 s']),
          k('rate', 'rate:EUR-USD', '1.08', ['TTL 10 min']),
        ],
        note: 'A TTL gives a key a lifetime. EX 60 means the key may live for 60 seconds. When the TTL ends, the key has expired. Memory is half used, so nothing else needs to leave.',
      },
      {
        line: 'GET balance:42   (61 s later)',
        result: { text: '(nil): expired', tone: 'warn' },
        used: 0.8, max: 2, usedText: '0.8 GB used of 2 GB', policy: 'allkeys-lru',
        focus: ['bal', 'sess'],
        keys: [
          k('bal', 'balance:42', '100', ['TTL ended', 'deleted when read'], 'expired', 'lazy expiry'),
          k('sess', 'session:7', '{"user":"ana"}', ['TTL ended', 'found by the sampler'], 'expired', 'active expiry'),
          k('rate', 'rate:EUR-USD', '1.08', ['TTL 9 min left']),
        ],
        note: 'Redis removes expired keys in two ways. Lazy expiry: when a client reads an expired key, Redis deletes it and answers nil. Active expiry: a background task checks random keys with a TTL about ten times a second and deletes the expired ones.',
      },
      {
        line: 'SET fx:GBP-USD 1.27',
        result: { text: 'OOM error: write refused', tone: 'bad' },
        used: 2, max: 2, usedText: '2.0 GB used of 2 GB: full', policy: 'noeviction',
        focus: ['new'],
        keys: fullKeys(k('new', 'fx:GBP-USD', '1.27', ['not stored'], 'rejected', 'rejected')),
        note: 'Eviction is different from expiry. It happens when used memory reaches maxmemory. The maxmemory-policy setting decides what happens next. The default, noeviction, refuses new writes with an out-of-memory (OOM) error. Reads still work.',
      },
      {
        line: 'SET fx:GBP-USD 1.27',
        result: { text: 'OK: branch:MAN evicted', tone: 'ok' },
        used: 2, max: 2, usedText: '2.0 GB used of 2 GB: full', policy: 'allkeys-lru',
        focus: ['branch', 'new'],
        keys: fullKeys(written, 'branch'),
        note: 'With allkeys-lru, Redis makes room by evicting the least recently used key. branch:MAN was last used 3 hours ago, so it goes, even though it was still valid. This is the usual choice for a cache. Redis checks a small sample of keys (5 by default), so LRU is approximate.',
      },
      {
        line: 'SET fx:GBP-USD 1.27',
        result: { text: 'OK: promo:summer evicted', tone: 'ok' },
        used: 2, max: 2, usedText: '2.0 GB used of 2 GB: full', policy: 'allkeys-lfu',
        focus: ['promo', 'new'],
        keys: fullKeys(written, 'promo'),
        note: 'With allkeys-lfu, Redis evicts the least frequently used key. promo:summer was used recently but read only twice, so it goes. LFU protects a stable set of popular keys. The volatile-* policies look only at keys that have a TTL, and allkeys-random picks any key.',
      },
      {
        line: 'INFO stats',
        result: { text: 'hit ratio 94 percent', tone: 'ok' },
        used: 1.9, max: 2, usedText: '1.9 GB used of 2 GB', policy: 'allkeys-lfu',
        keys: fullKeys(k('new', 'fx:GBP-USD', '1.27', ['last used 1 s ago', 'read 300 times'])),
        stats: [
          { label: 'keyspace_hits', value: '940,000', tone: 'ok' },
          { label: 'keyspace_misses', value: '60,000', tone: 'none' },
          { label: 'evicted_keys', value: 'rising', tone: 'warn' },
        ],
        note: 'Watch three numbers. The hit ratio is hits divided by hits plus misses. If evicted_keys keeps rising, the data you use often does not fit in memory. If used_memory stays near maxmemory, one traffic spike can cause trouble.',
      },
    ],
  },
  {
    id: 'invalidation',
    label: 'Invalidation and staleness',
    title: 'The hard part of caching is knowing when a cached value is no longer true',
    stage: RedisSeqStage, // drawn as a sequence diagram: time runs down, one row per call
    frames: [
      {
        line: 'repository.save(account); redis.delete("account:42");',
        result: { text: 'cache and database agree: 150', tone: 'ok' },
        cols: seqCols,
        steps: [
          s('n1', 'w', 'db', 'UPDATE balance = 150', '150', 'ok'),
          s('n2', 'w', 'r', 'DEL account:42', 'empty', 'ok'),
          s('n3', 'a', 'r', 'GET account:42', 'miss', 'warn'),
          s('n4', 'a', 'db', 'SELECT balance', '150', 'new'),
          s('n5', 'a', 'r', 'SET 150, TTL 10 min', '150', 'ok'),
        ],
        note: 'After a write, the cached copy is out of date. The usual fix: update the database first, then delete the key. The next read misses and loads the fresh value. Deleting is safer than writing the new value into the cache, because two writers could leave the older value there.',
      },
      {
        line: 'Reader A and Writer B run at the same time',
        result: { text: 'cache 100, database 150: stale', tone: 'bad' },
        cols: seqCols,
        steps: race,
        note: 'Even delete on write has a race. Reader A misses and reads the old value, 100. Writer B updates the database to 150 and deletes the key. Then Reader A stores its old value. Nothing deletes it again, so the cache is wrong. It is rare, but it is real.',
      },
      {
        line: 'SET account:42 ... EX 600   (always with a TTL)',
        result: { text: 'healed when the TTL ends', tone: 'ok' },
        cols: seqCols,
        steps: [
          ...race,
          s('t1', 'r', 'r', 'TTL ends', 'expired', 'warn'),
          s('t2', 'a', 'r', 'GET miss, reload', '150', 'ok'),
        ],
        note: 'The TTL is the safety net. When it ends, the stale key expires, and the next read loads 150. For data that must be exact, such as a balance used to approve a payment, do not trust the cache: read the database inside the transaction.',
      },
      {
        line: 'outbox row → Kafka → DEL account:42',
        result: { text: 'other services invalidate too', tone: 'ok' },
        cols: [
          { id: 'w', title: 'Writer service', tone: 'new' },
          { id: 'db', title: 'Database', tone: 'ok' },
          { id: 'k', title: 'Kafka', tone: 'warn' },
          { id: 'c', title: 'Cache owner', tone: 'new' },
          { id: 'r', title: 'Redis', tone: 'warn' },
        ],
        steps: [
          s('e1', 'w', 'db', 'UPDATE + outbox row', '150', 'ok'),
          s('e2', 'db', 'k', 'AccountUpdated', 'event', 'new'),
          s('e3', 'k', 'c', 'consume', 'received', 'new'),
          s('e4', 'c', 'r', 'DEL account:42', 'empty', 'ok'),
        ],
        note: 'When one service writes and others cache, the writer publishes an event after the commit, through an outbox, Kafka or change data capture. Each service that caches the data deletes or refreshes its key. Versioned keys, such as account:42:v7, avoid deletes: a new version makes the old key unused.',
      },
    ],
  },
  {
    id: 'failures',
    label: 'Stampede and penetration',
    title: 'Three ways a cache fails under load, and how to prevent each one',
    frames: [
      {
        note: 'Cache stampede: a very popular key expires, and hundreds of requests miss at the same moment. They all query the database together and can bring it down. The fix is to let only one request rebuild the value, with a lock or sync = true in @Cacheable, or to refresh popular keys before they expire.',
        boxes: [b('k', 'Hot key expires', ['1000 requests miss together'], 'bad', 'stampede'), b('d', 'Database', ['1000 identical queries', 'overload'], 'bad'), b('l', 'Single-flight lock', ['one request rebuilds', 'others wait or use the old value'], 'ok', 'fix')],
        deps: [d('Hot key expires', 'Database', 'all miss', 'bad'), d('Single-flight lock', 'Database', 'only one', 'ok')],
      },
      {
        note: 'Cache avalanche: many keys expire at the same time, because they were loaded with the same TTL, or Redis restarted empty. The database gets the whole load at once. Add random jitter to each TTL, for example 60 s plus or minus 10 s, warm up the cache before traffic, and protect the database with rate limits and circuit breakers.',
        boxes: [b('a', 'Same TTL for 100,000 keys', ['all expire at 12:00:00'], 'bad', 'avalanche'), b('d', 'Database', ['whole load at once'], 'bad'), b('b', 'TTL with jitter', ['expiry spread over time'], 'ok', 'fix'), b('c', 'Cache warm-up', ['preload hot keys'], 'ok')],
        deps: [d('Same TTL for 100,000 keys', 'Database', 'all miss', 'bad')],
      },
      {
        note: 'Cache penetration: requests for keys that do not exist, such as a random account number or an attack, never find anything to cache. So every one reaches the database. Cache the empty result for a short time, validate the input, and put a Bloom filter in front that rejects ids that cannot exist.',
        boxes: [b('x', 'GET account:999999', ['no such account', 'miss every time'], 'bad', 'penetration'), b('n', 'Cache a null marker', ['short TTL, e.g. 60 s'], 'ok'), b('f', 'Bloom filter', ['rejects ids that cannot exist'], 'ok')],
        deps: [d('GET account:999999', 'Cache a null marker', 'stop repeats', 'ok')],
      },
      {
        note: 'Redis itself can go down. Decide in advance what happens: fall back to the database behind a circuit breaker and a rate limit, serve stale data if that is acceptable, or fail fast. A cache outage must not become a full outage.',
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
        note: 'Redis runs commands one at a time on one main thread. So each command is atomic without locks, and Redis can handle hundreds of thousands of simple commands per second. But a slow command, such as KEYS * or a huge value, blocks every other client.',
        boxes: [b('c1', 'Client A', ['GET account:1'], 'new'), b('c2', 'Client B', ['KEYS *'], 'bad', 'blocks'), b('r', 'Redis event loop', ['one command at a time', 'atomic'], 'ok')],
        deps: [d('Client A', 'Redis event loop', 'fast', 'ok'), d('Client B', 'Redis event loop', 'slow command', 'bad')],
      },
      {
        note: 'Replication copies data from a primary to replicas, without waiting for them. Replicas serve reads and take over if the primary dies. Sentinel watches the primary. When it fails, Sentinel promotes a replica and tells the clients. Because the copy does not wait, a failover can lose the last few writes.',
        boxes: [b('p', 'Primary', ['writes'], 'ok'), b('r1', 'Replica 1', ['copy, serves reads'], 'ok'), b('r2', 'Replica 2', ['copy'], 'ok'), b('s', 'Sentinel', ['monitors, promotes a replica'], 'new')],
        deps: [d('Primary', 'Replica 1', 'async copy', 'ok'), d('Primary', 'Replica 2', 'async copy', 'ok'), d('Sentinel', 'Primary', 'watches', 'ok')],
      },
      {
        note: 'Redis Cluster splits the data when one node cannot hold it all. The keys are divided into 16,384 hash slots, and a key\'s slot is CRC16(key) mod 16384. Each primary owns a range of slots. Commands on several keys must stay in one slot, which hash tags such as {user42}:cart arrange.',
        boxes: [b('a', 'Primary A', ['slots 0 - 5460'], 'ok'), b('b', 'Primary B', ['slots 5461 - 10922'], 'ok'), b('c', 'Primary C', ['slots 10923 - 16383'], 'ok'), b('k', 'Client', ['hash(key) picks the node'], 'new')],
        deps: [d('Client', 'Primary A', 'slot 120', 'ok'), d('Client', 'Primary B', 'slot 7000', 'ok'), d('Client', 'Primary C', 'slot 15000', 'ok')],
      },
      {
        note: 'A cache can lose its data, but sessions, rate limits and locks often cannot. RDB takes a snapshot at regular times: the file is compact, but you can lose minutes of writes. AOF logs every write: it is more durable, but larger. Many caches turn persistence off and rebuild from the database.',
        boxes: [b('r', 'RDB snapshot', ['point-in-time file', 'may lose minutes'], 'warn'), b('a', 'AOF log', ['every write appended', 'fsync every second'], 'ok'), b('n', 'No persistence', ['pure cache', 'rebuild from database'], 'ok')],
        deps: [],
      },
    ],
  },
];
