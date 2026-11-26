// Frame data for the "Node.js performance" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;

// timeline bars: x = X0 + t * scale, one lane label on the left
const X0 = 120;
const timeline = (scale) => (id, y, t0, t1, title, tone = 'ok', o = {}) => ({ id, x: X0 + t0 * scale, y, w: (t1 - t0) * scale, h: 30, title, tone, ...o });
const lane = (y, t) => ({ x: 14, y: y + 20, t });

/* ---------- keep the loop free ---------- */
const lb = timeline(1.0);   // 1 px per ms, 0..500 ms

const blockingFrames = [
  {
    h: 250,
    line: 'JSON.parse(body)   // a 40 MB body',
    result: { text: 'everyone waits 400 ms', tone: 'bad' },
    texts: [lane(44, 'POST /import'), lane(94, 'GET /balance'), lane(144, 'GET /health'), { x: 470, y: 214, t: 'time (ms) →' }],
    cards: [
      lb('p', 44, 0, 400, 'JSON.parse: 400 ms on the one thread', 'bad'),
      lb('w1', 94, 20, 400, 'waiting…', 'none', { dim: true }), lb('r1', 94, 400, 450, '5 ms', 'ok'),
      lb('w2', 144, 40, 450, 'waiting…', 'none', { dim: true }), lb('r2', 144, 450, 500, '1 ms', 'ok'),
    ],
    note: 'All your JavaScript runs on one thread. While one handler parses a huge body, nothing else runs. A 5 ms balance lookup and even a health check wait in line behind it.',
  },
  {
    h: 230,
    line: 'monitorEventLoopDelay().percentile(99)',
    result: { text: 'lag is the health signal', tone: 'warn' },
    texts: [{ x: 14, y: 60, t: 'event loop lag, p99' }, lane(80, 'healthy'), lane(130, 'blocked')],
    cards: [
      { id: 'h', x: X0, y: 80, w: 24, h: 30, title: '', tone: 'ok' },
      { id: 'hl', x: X0 + 34, y: 80, w: 100, h: 30, title: '3 ms', tone: 'none' },
      { id: 'b', x: X0, y: 130, w: 460, h: 30, title: '380 ms: every route slows down', tone: 'bad', badge: 'alert' },
    ],
    note: 'Event loop lag is how late timers run compared with when they were due. When it rises, every route gets slower, not just the guilty one. Export it as a metric, and alert on it.',
  },
  {
    h: 250,
    line: 'fixes for blocking work',
    result: { text: 'the loop stays free', tone: 'ok' },
    cards: [
      box('c', C1, 60, W, 'stream or chunk', ['yield with', 'setImmediate'], 'ok'),
      box('w', C2, 60, W, 'worker pool', ['piscina: CPU off', 'the main thread'], 'ok'),
      box('x', C3, 60, W, 'load shedding', ['503 + Retry-After', 'when lag is high'], 'warn'),
      box('d', C1, 170, 612, 'do less first', ['smaller payloads, pagination, aggregate in SQL'], 'new'),
    ],
    note: 'Stream, or process in chunks and yield between them. Move CPU-heavy work to a worker thread pool. When the loop is already overloaded, answer 503 instead of queueing work that will time out anyway.',
  },
];

/* ---------- parallel I/O ---------- */
const ct = timeline(1.4);   // 0..330 ms

const concurrencyFrames = [
  {
    h: 270,
    line: 'await a; await b; await c;',
    result: { text: '3 × 100 ms = 300 ms', tone: 'bad' },
    texts: [lane(44, 'getRate'), lane(94, 'getLimit'), lane(144, 'getProfile'), { x: 470, y: 240, t: 'time (ms) →' }],
    cards: [ct('a', 44, 0, 100, 'rate 100 ms', 'ok'), ct('b', 94, 100, 200, 'limit 100 ms', 'ok'), ct('c', 144, 200, 300, 'profile 100 ms', 'ok'), { id: 't', x: X0, y: 190, w: 300 * 1.4, h: 22, title: 'total 300 ms', tone: 'bad' }],
    note: 'Each await waits for the previous call to finish. Three independent 100 ms calls take 300 ms in a row. This is the most common reason an async Node endpoint is slow.',
  },
  {
    h: 270,
    line: 'await Promise.all([a, b, c])',
    result: { text: '≈ 100 ms: the waiting overlaps', tone: 'ok' },
    texts: [lane(44, 'getRate'), lane(94, 'getLimit'), lane(144, 'getProfile'), { x: 470, y: 240, t: 'time (ms) →' }],
    cards: [ct('a', 44, 0, 100, 'rate 100 ms', 'ok'), ct('b', 94, 0, 100, 'limit 100 ms', 'ok'), ct('c', 144, 0, 100, 'profile 100 ms', 'ok'), { id: 't', x: X0, y: 190, w: 107 * 1.4, h: 22, title: 'total 107 ms', tone: 'ok' }],
    note: 'Start all three, then wait once. The total is about the slowest call. Keep calls sequential only when one needs the result of another.',
  },
  {
    h: 250,
    line: 'Promise.all(10_000 queries)',
    result: { text: 'pool exhausted: timeouts', tone: 'bad' },
    cards: [
      box('u', C1, 60, W, '10,000 queries', ['all started at once'], 'bad'),
      box('p', C2, 60, W, 'pg.Pool  max 10', ['9,990 waiting'], 'bad', { badge: 'full' }),
      box('db', C3, 60, W, 'database', ['overloaded'], 'warn'),
      box('l', C1, 170, 612, 'mapLimit(items, 10, fn)', ['at most 10 in flight, sized to the pool'], 'ok'),
    ],
    arrows: [{ from: 'u', to: 'p', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'p', to: 'db', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Parallel does not mean unlimited. 10,000 queries at once empty the pool, and the rest wait and time out. Limit how many run at once, based on the scarcest resource.',
  },
  {
    h: 250,
    line: 'for (t of transfers) await findPayee(t.payee_id)',
    result: { text: '101 round trips → 2', tone: 'warn' },
    cards: [
      box('n', C1, 50, 290, 'N+1', ['1 query for the list', '+ 100 queries, one per row'], 'bad'),
      box('b', 336, 50, 290, 'batched', ['1 query for the list', '+ WHERE id = ANY($1)'], 'ok'),
      box('d', C1, 170, 612, 'DataLoader-style batcher', ['collects keys asked for in the same tick: one per request'], 'new'),
    ],
    note: 'N+1 runs one query for the list, then one more per row. Collect the ids and load them in one query, or use a per-request batcher. Round trips, not CPU, usually dominate.',
  },
];

/* ---------- caching layers ---------- */
const LAYERS = [
  ['br', 'browser and CDN', 'Cache-Control, ETag', '0 ms'],
  ['pc', 'process LRU', 'per instance, TTL', '~0.01 ms'],
  ['rd', 'Redis', 'shared by instances', '~1 ms'],
  ['db', 'PostgreSQL', 'source of truth', '~10 ms'],
];
const layers = (st) => LAYERS.map(([id, t, l, ms], i) => ({
  id, x: 14, y: 40 + i * 56, w: 420, h: 44, title: t, lines: [l], tone: st[i] || 'none', badge: ms, dim: !st[i],
}));

const cacheFrames = [
  {
    h: 280,
    line: 'GET /fx-rates/USD-SGD',
    result: { text: 'answer from the nearest layer', tone: 'ok' },
    cards: [...layers(['warn', 'ok']), box('r', 470, 84, 156, 'request', ['miss at the CDN', 'hit in process'], 'new')],
    arrows: [{ from: 'r', to: 'pc', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'Put each answer as close to the caller as it can safely be. The browser and CDN follow HTTP headers. A process cache answers in microseconds, but each instance has its own. Redis is shared, at the cost of a network hop.',
  },
  {
    h: 280,
    line: 'cache-aside: get → miss → load → set',
    result: { text: 'delete the key on write', tone: 'warn' },
    cards: [...layers(['', 'warn', 'warn', 'ok']), box('w', 470, 160, 156, 'on a write', ['update the db', 'DEL the key'], 'warn')],
    arrows: [{ from: 'w', to: 'db', fs: 'l', ts: 'r', tone: 'warn' }],
    note: 'Cache-aside: read the cache, and on a miss load from the database and store it with a TTL. The hard part is invalidation. Delete the key when the data changes. Never cache user data under a shared key.',
  },
  {
    h: 260,
    line: 'hot key expires: 1,000 misses at once',
    result: { text: 'coalesced: one query', tone: 'ok' },
    cards: [
      box('m', C1, 60, W, '1,000 requests', ['all miss together'], 'bad', { badge: 'stampede' }),
      box('f', C2, 60, W, 'in-flight promise', ['first miss loads', 'others await it'], 'ok'),
      box('d', C3, 60, W, 'database', ['1 query'], 'ok'),
      box('j', C1, 180, 612, 'also: TTL jitter, stale-while-revalidate, a Redis lock across instances', [], 'new'),
    ],
    arrows: [{ from: 'm', to: 'f', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'f', to: 'd', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'When a popular key expires, many requests miss at once and all hit the database. That is a cache stampede. Share one in-flight load. Add jitter to TTLs, so many keys do not expire together.',
  },
];

/* ---------- measure first ---------- */
const pb = timeline(0.9);   // ms scale for percentile bars

const measureFrames = [
  {
    h: 250,
    line: 'npx autocannon -c 100 -d 30 /accounts/A',
    result: { text: 'p99 misses the 300 ms goal', tone: 'warn' },
    texts: [lane(44, 'p50'), lane(94, 'p95'), lane(144, 'p99'), { x: 14, y: 200, t: 'goal: p99 under 300 ms' }],
    cards: [pb('p50', 44, 0, 45, '45', 'ok'), pb('p95', 94, 0, 180, '180 ms', 'ok'), pb('p99', 144, 0, 520, '520 ms', 'bad')],
    note: 'Start with a goal and a load test. Read percentiles, not the average. p50 is the typical request, and p99 is what the unluckiest one percent feel. Here p99 misses the target.',
  },
  {
    h: 250,
    line: 'node --cpu-prof app.js   # flame graph',
    result: { text: 'the widest bar is the hot spot', tone: 'warn' },
    cards: [
      { id: 'f0', x: 14, y: 170, w: 612, h: 30, title: 'handler  100%', tone: 'none' },
      { id: 'f1', x: 14, y: 130, w: 250, h: 30, title: 'JSON.stringify  41%', tone: 'bad' },
      { id: 'f2', x: 270, y: 130, w: 180, h: 30, title: 'db.query  29%', tone: 'ok' },
      { id: 'f3', x: 456, y: 130, w: 170, h: 30, title: 'logger  27%', tone: 'warn' },
      { id: 'f4', x: 14, y: 90, w: 150, h: 30, title: 'serialise', tone: 'bad', dim: true },
    ],
    texts: [{ x: 14, y: 62, t: 'width = share of CPU time, height = call stack' }],
    note: 'When the goal is missed, profile instead of guessing. In a flame graph, the widest bars are where time goes. Often it is JSON serialisation, a regex or logging, not your own algorithm.',
  },
  {
    h: 230,
    line: 'one change, same load, measure again',
    result: { text: 'p99 520 → 240 ms: keep it', tone: 'ok' },
    cards: [
      box('f', C1, 70, W, 'fix the widest bar', ['one change only'], 'new'),
      box('m', C2, 70, W, 'measure again', ['same load and machine'], 'ok'),
      box('k', C3, 70, W, 'keep or revert', ['the numbers decide'], 'ok'),
    ],
    arrows: [{ from: 'f', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 'k', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Change one thing at a time, then measure again under the same load. Keep it only if the numbers improved. Without the second measurement, you cannot tell a real gain from noise.',
  },
];

export const NODE_PERF_SCENES = [
  { id: 'blocking', label: 'Keep the loop free', title: 'One slow call delays everyone', stage: BoardStage, frames: blockingFrames },
  { id: 'concurrency', label: 'Parallel I/O', title: 'Fast, but never unbounded', stage: BoardStage, frames: concurrencyFrames },
  { id: 'cache', label: 'Caching layers', title: 'Answer from the nearest layer', stage: BoardStage, frames: cacheFrames },
  { id: 'measure', label: 'Measure first', title: 'Find the real bottleneck', stage: BoardStage, frames: measureFrames },
];
