// Frame data for the "Node.js performance" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const NODE_PERF_SCENES = [
  {
    id: 'blocking',
    label: 'Keep the loop free',
    title: 'One slow call delays everyone',
    frames: [
      {
        note: 'Node runs your JavaScript on one thread. While a handler parses a 40 MB JSON body, hashes with a synchronous function or runs a huge loop, the event loop cannot serve anyone else. Every other request waits in line, even a cheap health check.',
        boxes: [b('s', 'Slow handler', ['JSON.parse of 40 MB'], 'bad'), b('e', 'Event loop', ['one thread'], 'warn'), b('o', 'Other requests', ['wait in line'], 'bad')],
        deps: [d('Slow handler', 'Event loop', 'blocks', 'bad'), d('Event loop', 'Other requests', 'delays', 'bad')],
      },
      {
        note: 'Measure the delay itself. Event loop lag is how late a timer fires compared with when it was due. When it rises, p99 latency rises for every route, so lag is the best single health signal for a Node service. Alert on it, and log which route ran at the time.',
        boxes: [b('l', 'Event loop lag', ['monitorEventLoopDelay'], 'new'), b('p', 'p99 latency', ['rises on every route'], 'bad'), b('a', 'Lag alert', ['over 100 ms for a minute'], 'warn')],
        deps: [d('Event loop lag', 'p99 latency', 'predicts', 'bad'), d('Event loop lag', 'Lag alert', 'feeds', 'warn')],
      },
      {
        note: 'Fixes: stream or process in small chunks and yield with setImmediate, move CPU-heavy work to a worker thread, and use asynchronous APIs. When the loop is already overloaded, shed load by answering 503 with Retry-After instead of queueing work that will time out anyway.',
        boxes: [b('c', 'Stream or chunk', ['yield between pieces'], 'ok'), b('w', 'Worker thread', ['CPU off the main thread'], 'ok'), b('x', 'Load shedding', ['503 when lag is high'], 'warn')],
        deps: [d('Stream or chunk', 'Worker thread', 'or', 'ok'), d('Worker thread', 'Load shedding', 'and', 'warn')],
      },
    ],
  },
  {
    id: 'concurrency',
    label: 'Parallel I/O',
    title: 'Fast, but never unbounded',
    frames: [
      {
        note: 'Three independent calls of 100 ms take 300 ms when awaited one after another, and about 100 ms with Promise.all, because the waiting overlaps. Awaiting in a loop is the most common reason an async Node endpoint is slow. Only keep it sequential when one call needs the result of the previous one.',
        boxes: [b('a', 'Sequential awaits', ['3 x 100 ms'], 'bad'), b('p', 'Promise.all', ['all at once'], 'ok'), b('t', 'Total time', ['sum versus slowest'], 'new')],
        deps: [d('Sequential awaits', 'Total time', 'sum', 'bad'), d('Promise.all', 'Total time', 'slowest only', 'ok')],
      },
      {
        note: 'Parallel does not mean unlimited. Starting 10,000 queries at once empties the connection pool, the later ones wait and time out, and the database is overloaded. Limit the concurrency (10 or 20 at a time, in line with the pool size) with a small semaphore or a library such as p-limit.',
        boxes: [b('u', 'Unbounded fan-out', ['10,000 queries at once'], 'bad'), b('x', 'Pool exhausted', ['waits, timeouts'], 'bad'), b('l', 'Limited concurrency', ['10 at a time'], 'ok')],
        deps: [d('Unbounded fan-out', 'Pool exhausted', 'causes', 'bad')],
      },
      {
        note: 'The N+1 problem: one query for the list and one more query for every row. With 100 transfers that is 101 round trips. Collect the ids and fetch them in one query (WHERE id = ANY($1)), or let a batching helper such as DataLoader do it per request. Round trips, not CPU, usually dominate.',
        boxes: [b('n', 'N+1 queries', ['1 + 100 lookups'], 'bad'), b('b', 'Batch the ids', ['one query for all'], 'new'), b('r', 'One round trip', ['much lower latency'], 'ok')],
        deps: [d('N+1 queries', 'Batch the ids', 'fix with', 'warn'), d('Batch the ids', 'One round trip', 'gives', 'ok')],
      },
    ],
  },
  {
    id: 'cache',
    label: 'Caching layers',
    title: 'Answer from the nearest layer',
    frames: [
      {
        note: 'Put each answer as close to the caller as it can safely be. The browser and CDN follow Cache-Control and ETag. An in-process LRU cache with a TTL answers in microseconds but is per instance. Redis is shared by every instance and survives restarts, at the cost of a network hop.',
        boxes: [b('b', 'Browser and CDN', ['Cache-Control, ETag'], 'ok'), b('p', 'Process cache', ['LRU with TTL'], 'new'), b('r', 'Redis', ['shared by all instances'], 'ok')],
        deps: [d('Browser and CDN', 'Process cache', 'miss', 'warn'), d('Process cache', 'Redis', 'miss', 'warn')],
      },
      {
        note: 'Cache-aside: read the cache, on a miss load from the database and store the result with a TTL. The hard part is invalidation. Choose a TTL the business can accept, delete or update the key when the data changes, and never cache data that is user-specific under a shared key.',
        boxes: [b('c', 'Cache-aside', ['read, miss, load, store'], 'new'), b('d', 'Database', ['source of truth'], 'ok'), b('i', 'Invalidation', ['TTL and delete on write'], 'warn')],
        deps: [d('Cache-aside', 'Database', 'on a miss', 'ok'), d('Database', 'Invalidation', 'changes', 'warn')],
      },
      {
        note: 'When a popular key expires, thousands of requests can miss at the same moment and all hit the database: a cache stampede. Coalesce them so the first miss starts the load and the others await the same in-flight promise. Adding jitter to TTLs also stops many keys expiring together.',
        boxes: [b('s', 'Cache stampede', ['1,000 misses at once'], 'bad'), b('c', 'Coalesce requests', ['share one in-flight load'], 'ok'), b('p', 'Database protected', ['one query only'], 'ok')],
        deps: [d('Cache stampede', 'Coalesce requests', 'fix with', 'warn'), d('Coalesce requests', 'Database protected', 'gives', 'ok')],
      },
    ],
  },
  {
    id: 'measure',
    label: 'Measure first',
    title: 'Find the real bottleneck',
    frames: [
      {
        note: 'Start with a goal and a load test. Run autocannon or k6 against a realistic environment and read percentiles, not the average: p50 is the typical request, p99 is what your unluckiest one percent feel. Compare the result with a latency target, for example p99 under 300 ms at 500 requests per second.',
        boxes: [b('l', 'Load test', ['autocannon, k6'], 'new'), b('p', 'Percentiles', ['p50, p95, p99'], 'ok'), b('g', 'Latency goal', ['p99 under 300 ms'], 'ok')],
        deps: [d('Load test', 'Percentiles', 'reports', 'ok'), d('Percentiles', 'Latency goal', 'compared with', 'ok')],
      },
      {
        note: 'When the goal is missed, profile instead of guessing. Run with --cpu-prof, or use clinic flame or 0x, and open the flame graph. The widest bars are where the time goes. Often the culprit is not your algorithm but JSON serialisation, a regex, logging or a library call.',
        boxes: [b('c', 'CPU profile', ['--cpu-prof, clinic'], 'new'), b('f', 'Flame graph', ['widest bar is hottest'], 'ok'), b('h', 'Hot function', ['JSON.stringify, 40%'], 'warn')],
        deps: [d('CPU profile', 'Flame graph', 'drawn as', 'ok'), d('Flame graph', 'Hot function', 'shows', 'warn')],
      },
      {
        note: 'Change one thing at a time, then measure again under the same load. Keep the change only if the numbers improved and the code is still clear. Without the second measurement you cannot tell a real gain from noise, and premature optimisation makes code harder to read for nothing.',
        boxes: [b('f', 'Fix the widest bar', ['one change only'], 'new'), b('m', 'Measure again', ['same load, same machine'], 'ok'), b('k', 'Keep or revert', ['numbers decide'], 'warn')],
        deps: [d('Fix the widest bar', 'Measure again', 'then', 'ok'), d('Measure again', 'Keep or revert', 'then', 'warn')],
      },
    ],
  },
];
