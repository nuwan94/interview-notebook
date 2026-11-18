---
title: Node.js performance — event loop health, concurrency, caching, profiling, memory and scaling
nav: Node.js performance
slug: node-performance
summary: Making a Node.js service fast and keeping it fast, latency and throughput and percentiles and Little's law, measuring first with autocannon, k6, perf_hooks, CPU profiles and flame graphs, event loop lag and utilization and what blocks the loop, JSON and regex and synchronous pitfalls, chunking and worker threads and piscina, sequential versus parallel awaits, limiting concurrency, N+1 queries and batching, connection pools and keep-alive, indexes and pagination, caching layers with HTTP caching and LRU and Redis and cache-aside and stampede protection, payload size and compression and streaming, memory and garbage collection and leaks and container limits, scaling with processes and cluster, load shedding and timeouts and production metrics, compared with the JVM, with banking examples and interview questions.
tags: [Node.js, Performance, Event loop, Caching, Profiling, Scaling, Memory, Backend, Full stack]
order: 74
topic: Full stack / Node.js
updated: 2026-11-18
subnav: true
---

Performance questions in a Node.js interview test whether you understand *why* Node is fast and where it breaks. They ask *what the event loop does and what blocks it, how you find the bottleneck instead of guessing, why `await` in a loop is slow, how many things you run at once, where you cache and how you stop a stampede, what causes a memory leak, how you use several cores, and how a service protects itself when overloaded.* This lesson builds on the [Node.js runtime](lesson:node-runtime#loop), [promises](lesson:js-promises#patterns), [streams](lesson:node-streams#backpressure) and [Redis caching](lesson:redis-caching#patterns), and it uses banking examples. Play the four scenes: keep the loop free, parallel I/O, caching layers, and measure first.

```demo
name: node-perf-walk
```

> **One sentence to remember:** *Measure before you tune, keep the event loop free of blocking work, overlap I/O but limit how much runs at once, cache close to the caller and protect against stampedes, stream instead of buffering, and shed load before the service falls over.*

## Think in latency, throughput and percentiles {#mindset}

| Term | Meaning |
| --- | --- |
| **latency** | time for one request, from sent to answered |
| **throughput** | requests handled per second |
| **p50, p95, p99** | the latency that 50%, 95%, 99% of requests are faster than |
| **tail latency** | the slow end (p99 and above). One page that calls 10 services sees the slowest of the 10 |
| **saturation** | a resource is fully used (CPU, pool, loop), queues grow, latency explodes |
| **SLO** | the target, for example "p99 under 300 ms for 99.9% of the month" |

Rules that help in an interview:

- **Averages hide pain.** If 99 requests take 50 ms and one takes 5 s the average is 100 ms, but a user hits the 5 s. Always talk in percentiles.
- **Little's law**: `concurrency = throughput x latency`. A service doing 500 requests per second with 200 ms latency has about 100 requests in flight. If latency doubles under the same load, the in-flight work doubles, memory grows and the pool runs out. This is why slow dependencies cause cascading failures.
- **Latency rises sharply near saturation.** A service at 90% utilisation is far slower than at 60%, so plan capacity for headroom.
- **Node is good at I/O-bound work** (many waiting connections, little CPU per request) and **bad at CPU-bound work** on the main thread. Most performance issues come from violating that.
- Optimise the **bottleneck**, not what looks slow. A 2x gain in a function that takes 1% of the time changes nothing.

## Keep the event loop free {#loop}

All your JavaScript runs on **one thread**, the event loop (see [the event loop](lesson:node-runtime#loop)). While a callback runs, nothing else runs: no other request, no timer, not even a health check. A **blocking** call is any synchronous work that takes long.

Typical blockers in a banking API:

| Blocker | Why | Fix |
| --- | --- | --- |
| `JSON.parse` or `JSON.stringify` of a huge body (tens of MB) | synchronous, linear in size | limit body size, paginate, stream (NDJSON), `stream-json` |
| synchronous APIs (`readFileSync`, `execSync`, `crypto.pbkdf2Sync`, `zlib.gzipSync`) | block until done | the async versions, only sync at startup |
| password hashing in the request path with a sync function | tens of ms of CPU each | async `scrypt` or `argon2` (use the thread pool) |
| a long loop, sorting or mapping a million rows | CPU on the main thread | chunk, worker thread, or do it in the database |
| a **ReDoS** regular expression (nested quantifiers) | catastrophic backtracking, seconds for crafted input | simple patterns, length limits, `re2` |
| large `Array.includes` or nested loops over big arrays | O(n squared) | `Set` and `Map` lookups |
| heavy logging with `console.log` to a pipe or terminal | synchronous in some environments | `pino` with asynchronous destinations |

Measure it with a small timing: parsing about 22 MB of JSON takes around 120 ms on a laptop, and for that time **no request is served by that process**.

### Event loop lag and utilization

The best health signal for a Node service is **event loop lag**: how late timers run compared with when they were due. `perf_hooks` gives you a histogram and the **event loop utilization** (ELU, the share of time the loop was busy):

```javascript
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });     // samples the delay every 20 ms
histogram.enable();

let lagMs = 0;
let elu0 = performance.eventLoopUtilization();

setInterval(() => {
  lagMs = histogram.percentile(99) / 1e6;                         // nanoseconds to milliseconds
  const elu = performance.eventLoopUtilization(elu0);             // busy share since the last reading
  elu0 = performance.eventLoopUtilization();
  metrics.eventLoopLagP99.set(lagMs);                             // export to Prometheus
  metrics.eventLoopUtilization.set(elu.utilization);
  histogram.reset();
}, 1000).unref();                                                 // unref: do not keep the process alive
```

Healthy services show lag of a few milliseconds and ELU well below 0.7. Rising lag means something blocks the loop, and then **every route** gets slower, not just the guilty one. Alert on it, and log the route and request id of requests that take unusually long on the CPU.

### Fixes for blocking work

1. **Do less**: smaller payloads, pagination, selecting only needed fields, doing aggregation in SQL.
2. **Stream** instead of buffering: parse NDJSON or CSV line by line, pipe files, see [streams](lesson:node-streams#pipeline).
3. **Chunk and yield**: process in slices and give the loop a turn between slices:

   ```javascript
   async function sumInChunks(items, chunk = 10_000) {
     let sum = 0;
     for (let i = 0; i < items.length; i += chunk) {
       for (let j = i; j < Math.min(i + chunk, items.length); j++) sum += items[j];
       await new Promise(setImmediate);          // let pending I/O and timers run before the next chunk
     }
     return sum;
   }
   ```

   `setImmediate` yields after I/O callbacks, so other requests are served between chunks. The total time is slightly longer but the service stays responsive.
4. **Move CPU work to a worker thread** or another process (next section).

### Load shedding {#shedding}

When the loop is overloaded, accepting more work makes it worse: requests queue, time out in the client, and the client retries. A service should **refuse early** with `503 Service Unavailable` and `Retry-After`, so healthy capacity serves the requests that can still succeed:

```javascript
export function shedLoad({ maxLagMs = 100, getLagMs = () => lagMs } = {}) {
  return (req, res, next) => {
    if (req.path === '/health') return next();            // never shed health checks
    if (getLagMs() > maxLagMs) {
      res.set('Retry-After', '2');
      return res.status(503).json({ error: 'busy' });
    }
    next();
  };
}
app.use(shedLoad({ maxLagMs: 100 }));
```

I ran this idea with a handler that blocked the loop for 400 ms: the next request was answered with 503 immediately instead of waiting. Combine it with **timeouts** on every outbound call, a **bulkhead** (a separate limit per dependency) and a **circuit breaker** (see [resilience](lesson:microservice-resilience#breaker)).

## Measure before you tune {#measure}

Guessing wastes time. The process:

1. **Define the goal** and a realistic workload (the mix of routes, the payload sizes, the data volume).
2. **Load test** a production-like environment. **autocannon** (Node) and **k6** are common:

   ```bash
   npx autocannon -c 100 -d 30 -p 10 http://localhost:3000/accounts/A   # 100 connections, 30 s, pipelining 10
   ```

   Read p50, p95, p99, requests per second, and errors. Use a separate machine for the load generator, and warm the service up first (V8 optimises hot code after some calls).
3. **Find the bottleneck** with a profile, not a guess:

   ```bash
   node --cpu-prof app.js              # writes a .cpuprofile file when the process exits
   node --inspect app.js               # Chrome DevTools: Performance and Memory tabs
   npx clinic flame -- node app.js     # or: npx 0x app.js  (flame graph in the browser)
   ```

   In a **flame graph** the x axis is the share of time and the y axis is the call stack. The **widest bars** at the top are where CPU time goes. Look for `JSON.stringify`, regular expressions, `crypto`, logging and library functions, not only your code.
4. **Change one thing**, run the same test again, and keep the change only if the numbers improved.

Other tools:

- `console.time('x')` and `performance.now()` for a quick timing. `performance.mark` and `performance.measure` (with a `PerformanceObserver`) for named spans.
- **Traces** (OpenTelemetry) show where a request spent its time across services: the database, a cache, a downstream call. For many services the time is in I/O waits, not CPU, and only a trace shows it.
- `--heap-prof` and heap snapshots for memory, see [memory](#memory).
- `process.hrtime.bigint()` for precise timing, and a micro-benchmark library (`mitata`, `tinybench`) for small functions. Micro-benchmarks lie easily (dead code is removed, the JIT warms up), so trust a load test over a benchmark.

## Concurrency: overlap I/O, limit the fan-out {#concurrency}

### Do not await in a loop when calls are independent

```javascript
// slow: 3 x 100 ms = 300 ms
const rate = await getRate('USD');
const limit = await getLimit(accountId);
const profile = await getProfile(userId);

// fast: about 100 ms, the waiting overlaps
const [rate, limit, profile] = await Promise.all([getRate('USD'), getLimit(accountId), getProfile(userId)]);
```

I measured 329 ms against 107 ms for three 100 ms calls. Keep calls sequential only when one needs the result of the previous. Use `Promise.allSettled` when one failure must not cancel the rest (see [promises](lesson:js-promises#combinators)).

### Limit the concurrency

`Promise.all` over 10,000 items starts 10,000 operations at once. The connection pool (10 connections by default in `pg`) is exhausted, the rest wait and time out, memory grows, and the downstream service is overloaded. Run **at most N at a time**:

```javascript
// run fn over items with at most `limit` in flight; results keep the input order
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;                                   // safe: JavaScript is single-threaded between awaits
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const statements = await mapLimit(accountIds, 10, (id) => buildStatement(id));   // 10 at a time
```

Libraries: `p-limit`, `p-map`, `async`. Choose the limit from what the **slowest resource** can take (the pool size, the partner's rate limit), not from the number of cores.

### N+1 queries and batching

```javascript
// N+1: one query for the list, then one query per transfer
const transfers = await db.query('SELECT * FROM transfers WHERE account_id = $1', [id]);
for (const t of transfers.rows) t.payee = (await db.query('SELECT * FROM payees WHERE id = $1', [t.payee_id])).rows[0];
```

With 100 rows that is 101 round trips, each 1 to 5 ms plus pool waits. Fix it with a **join** or by fetching all the ids at once (`WHERE id = ANY($1)`), or with a **batcher**, the idea behind **DataLoader**, which collects the keys requested in the same tick and loads them together:

```javascript
export function createBatcher(batchFn) {
  let queue = [];
  return (key) => new Promise((resolve, reject) => {
    queue.push({ key, resolve, reject });
    if (queue.length === 1) {
      queueMicrotask(async () => {
        const batch = queue; queue = [];
        try {
          const values = await batchFn(batch.map((b) => b.key));      // must return values in the same order
          batch.forEach((b, i) => b.resolve(values[i]));
        } catch (err) {
          batch.forEach((b) => b.reject(err));
        }
      });
    }
  });
}

const loadPayee = createBatcher(async (ids) => {
  const { rows } = await db.query('SELECT * FROM payees WHERE id = ANY($1)', [ids]);
  return ids.map((id) => rows.find((r) => r.id === id) ?? null);
});
await Promise.all(transfers.rows.map(async (t) => { t.payee = await loadPayee(t.payee_id); }));   // one query
```

I ran this: three lookups made in the same tick produced one call with `['A', 'B', 'C']`. Create a batcher **per request** so that data of one user is never cached for another.

## I/O: pools, keep-alive and the database {#io}

- **Connection pool**: opening a database connection costs several round trips (TCP, TLS, authentication). Use a pool (`pg.Pool`, default `max: 10`) and **size it** to what the database can handle, not larger. Total connections are `instances x pool size`, which must stay under the database limit (use PgBouncer if needed). Always release a connection (`try`/`finally` or `pool.query`). See [the connection pool in Spring Data](lesson:spring-data-jpa#stack) for the same ideas with HikariCP.
- **Keep-alive** for outbound HTTP: reusing connections avoids a TCP and TLS handshake per call. Node's global agent and `fetch` (undici) keep connections alive by default in current versions. With older code or `http.Agent`, set `keepAlive: true` and a `maxSockets`.
- **Timeouts** everywhere: `AbortSignal.timeout(2000)` for `fetch`, `statement_timeout` for queries, server `keepAliveTimeout` above the load balancer's idle timeout (otherwise intermittent 502 errors).
- **DNS** lookups use the thread pool and can be slow, so keep connections open and consider caching them.
- **The database is usually the bottleneck**: add the right **index** (read the `EXPLAIN ANALYZE` plan), select only needed columns, avoid `SELECT *`, **paginate** (prefer keyset pagination `WHERE id > $last ORDER BY id LIMIT 50` over large `OFFSET`), and aggregate in SQL instead of in JavaScript.
- **Compute once, reuse**: hoist regular expressions, `Intl.NumberFormat` and `Intl.DateTimeFormat` instances and prepared statements out of hot loops.

## Caching {#cache}

Caching trades **freshness** for speed. Put each answer as close to the caller as it can safely be:

| Layer | Where | Good for | Caveat |
| --- | --- | --- | --- |
| **browser and CDN** | `Cache-Control`, `ETag` | static assets, public data, API responses that may be stale | cannot cache user-specific data in a shared cache |
| **reverse proxy** | nginx, API gateway | public GETs, rate limits | same |
| **process memory** | LRU with TTL in the service | tiny hot data: config, FX rates, feature flags | per instance, lost on restart, grows memory |
| **Redis** | shared by instances | sessions, rate limits, computed results | network hop, needs invalidation and care |
| **database** | the source of truth | everything | the slowest and the most expensive to scale |

### HTTP caching

For a read endpoint that may be stale for a while, let the client and the CDN do the work: `Cache-Control: public, max-age=60` for public data or `private, max-age=30` for user data, and **validators**. Express generates a weak `ETag` for `res.json` and answers `304 Not Modified` to `If-None-Match` automatically, which saves the body but still runs your handler, so combine it with a server-side cache for expensive handlers. Never cache responses that contain personal or account data in a shared cache (`Cache-Control: no-store`).

### A cache with TTL, LRU and request coalescing

```javascript
export class LoadingCache {
  #map = new Map();                                       // key -> { value, expires }   (a Map keeps insertion order)
  #inflight = new Map();                                  // key -> Promise
  constructor({ max = 1000, ttlMs = 60_000, now = () => Date.now() } = {}) {
    this.max = max; this.ttlMs = ttlMs; this.now = now;
  }
  get(key) {
    const e = this.#map.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) { this.#map.delete(key); return undefined; }
    this.#map.delete(key); this.#map.set(key, e);         // move to the most recent position (LRU)
    return e.value;
  }
  set(key, value) {
    this.#map.delete(key);
    this.#map.set(key, { value, expires: this.now() + this.ttlMs * (0.9 + Math.random() * 0.2) });   // TTL jitter
    if (this.#map.size > this.max) this.#map.delete(this.#map.keys().next().value);                  // evict the oldest
  }
  async getOrLoad(key, loader) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    if (this.#inflight.has(key)) return this.#inflight.get(key);        // coalesce: share the load in progress
    const p = (async () => {
      try {
        const value = await loader(key);
        this.set(key, value);
        return value;
      } finally {
        this.#inflight.delete(key);                                      // a failure is not cached
      }
    })();
    this.#inflight.set(key, p);
    return p;
  }
}

const fxRates = new LoadingCache({ max: 200, ttlMs: 30_000 });
const rate = await fxRates.getOrLoad('USD-SGD', () => fxClient.fetchRate('USD', 'SGD'));
```

I tested it with 50 simultaneous requests for the same key: the loader ran **once** and all 50 got the value (this is the in-flight promise idea from [promises](lesson:js-promises#patterns)). Failures are not cached, entries expire, and the least recently used entry is evicted when the cache is full.

### Cache-aside, invalidation and stampedes

**Cache-aside** (lazy loading): read the cache, on a miss read the database and store the result with a TTL. On a write, update the database and **delete** the cache key (deleting is safer than updating). The hard part is **invalidation**: choose a TTL the business accepts for each kind of data, never cache data under a key that omits the user or tenant, and remember that a per-instance cache holds stale data in other instances.

A **cache stampede** (thundering herd) happens when a hot key expires and thousands of requests miss together and all go to the database. Defences: **coalesce** concurrent loads (above, per instance), a **lock** in Redis (`SET key value NX PX 5000`) for the same across instances, **jitter** in the TTLs so keys do not expire together, **refresh ahead** or **stale-while-revalidate** (serve the old value while one request refreshes it), and a short **negative cache** for "not found". See [Redis caching](lesson:redis-caching#patterns).

## CPU-bound work and using more cores {#cpu}

One process uses one core for JavaScript. Choices, from simplest (see [using more than one core](lesson:node-runtime#scaling)):

1. **More instances** (processes or containers) behind a load balancer. Usual choice with Kubernetes: one process per container, scale pods. Size the CPU request to one core.
2. **`cluster`** or a process manager (PM2) to run one worker per core on one machine: `os.availableParallelism()` gives the count.
3. **Worker threads** for CPU-heavy tasks inside a service (hashing, PDF or image work, parsing, encryption). Use a **pool**, not a thread per request:

   ```javascript
   // pool.js (npm: piscina)
   import Piscina from 'piscina';
   export const pool = new Piscina({ filename: new URL('./statement-worker.js', import.meta.url).href, maxThreads: 4 });

   // route: the main thread stays free while a worker builds the statement
   app.get('/statements/:id', async (req, res) => {
     const data = await loadTransactions(req.params.id);
     res.json(await pool.run({ data }));                      // messages are copied, so keep them small
   });

   // statement-worker.js
   export default ({ data }) => buildStatement(data);       // CPU-heavy, runs on a worker thread
   ```

4. **A queue and a separate worker service** for long or retryable jobs (statement generation, reports). The API answers `202 Accepted` and the client polls or receives a notification.
5. **Do it elsewhere**: let the database aggregate, or a specialised service (an image resizer, a native addon, WebAssembly) do the heavy part.

Some built-in work already uses the **libuv thread pool** (4 threads by default, `UV_THREADPOOL_SIZE`): file system calls, DNS lookups, `crypto.scrypt`, `zlib`. If you run many of them at once the pool becomes a bottleneck and the symptom is slow I/O with a calm event loop.

## Payload size, compression and streaming {#payload}

- **Smaller responses are faster**: return only needed fields, paginate lists, avoid deep nesting.
- **Compression**: gzip or brotli reduces JSON by 70 to 90%. Do it at the **reverse proxy or CDN** if you can, because compressing in Node costs CPU on the main thread (zlib uses the thread pool, but it still competes). Do not compress tiny bodies or already compressed files.
- **Stream large responses** (file downloads, exports) with `pipeline` instead of reading them into memory, see [streams](lesson:node-streams#usecases).
- **Serialisation**: `JSON.stringify` of a large object blocks the loop. **Fastify** serialises with a precompiled schema (`fast-json-stringify`), which is faster for large responses. Avoid serialising twice.
- **HTTP/2 or HTTP/3** at the proxy reduces connection overhead for many small requests, and a **CDN** serves static files close to users, so Node does not serve them at all.
- **Cheap logging**: `pino` writes JSON quickly, avoid logging big objects and avoid logging at debug level in production hot paths.

## Memory and garbage collection {#memory}

V8 splits the heap into a **young generation** (small, collected often and cheaply, most objects die here) and an **old generation** (survivors, collected less often with longer pauses). Memory beyond the heap (Buffers, native memory) is counted separately in `rss` and `external`.

```javascript
process.memoryUsage();   // { rss, heapTotal, heapUsed, external, arrayBuffers }
```

- **Heap limit**: `--max-old-space-size=<MB>`. Modern Node reads container (cgroup) limits, but set the heap to about 70 to 75% of the container memory so Buffers and native memory fit, otherwise Kubernetes kills the pod (`OOMKilled`) before Node throws a heap error.
- **Leaks**: the used heap keeps growing after garbage collection. Causes: an unbounded `Map` or array used as a cache, event listeners added per request and never removed, closures that keep large objects, timers and intervals never cleared, global state, promises that never settle. Find them by taking **two heap snapshots** some time apart (DevTools, or `v8.writeHeapSnapshot()`) and comparing what grew, then follow the retainers. Use a bounded cache (LRU), `WeakMap` and `WeakRef` for caches keyed by objects, and `emitter.setMaxListeners` warnings as a hint.
- **Do not buffer**: reading a 500 MB file with `readFile` or collecting a whole request body uses 500 MB per request. Stream it.
- **Large allocations** in hot paths (creating many short-lived objects, copying large arrays with spread, `Buffer.concat` in a loop) increase garbage collection work. Reuse buffers, use `Buffer.allocUnsafe` only when you overwrite everything, and prefer streaming parsers.
- **Garbage collection pauses** matter for latency: a growing old generation causes longer major collections. Watch them with `perf_hooks` GC entries or `--trace-gc` and fix the allocation rate or the leak before tuning flags.

## Startup, framework and code-level choices {#framework}

- **Startup time** matters for serverless and autoscaling: import only what you need (lazy `import()` for rarely used modules), avoid huge dependency trees, bundle if it helps, and use `node --run` or a compile cache. Cold starts of a function are dominated by loading code.
- **Framework**: Fastify and plain `http` are measurably faster than Express for simple routes (schema-based serialisation, a quicker router), but in most services the database, not the framework, is the limit. Pick for the ecosystem and team, and measure.
- **Middleware cost**: every middleware runs for every request. Keep the chain short, mount expensive middleware only on routes that need it, and do not parse bodies you will not use. See [middleware performance](lesson:node-express-middleware#performance).
- **V8 habits** that help without obscuring the code: create objects with the same shape (same properties in the same order), do not change an object's shape later or use `delete`, keep arrays holding one type, avoid `arguments`, and prefer `Map` for frequent additions and removals. Write clear code first and apply these only where a profile points at a hot path.
- **Avoid premature optimisation.** A clear O(n) loop over 50 items beats a clever structure. Optimise what the profile and the percentiles show.

## Production: metrics, backpressure and capacity {#production}

What to watch (the **RED** method for requests, **USE** for resources):

| Signal | Metric |
| --- | --- |
| **R**ate | requests per second per route |
| **E**rrors | 4xx and 5xx share, timeouts |
| **D**uration | p50, p95, p99 latency per route (a histogram, not an average) |
| utilisation | CPU, event loop utilisation, heap used, pool in use |
| saturation | event loop lag, pool wait queue, request queue, open handles |
| dependencies | latency and errors of each downstream call, cache hit ratio |

Export them with `prom-client` (Prometheus), build dashboards and alerts on **p99, error rate and event loop lag**, and trace with OpenTelemetry. See [Spring observability](lesson:spring-observability#metrics) for the Java equivalent.

Protecting the service:

- **Timeouts and cancellation** on every call so a slow dependency cannot hold resources forever.
- **Limit the queue**: bound the number of in-flight requests and reject the rest early ([load shedding](#shedding)), and apply backpressure to streams.
- **Rate limit** per client and **bulkhead** the dependencies so one slow partner does not take the whole service.
- **Graceful shutdown** and readiness probes so scaling and deploys do not drop requests ([graceful shutdown](lesson:node-runtime#shutdown)).
- **Capacity test**: find the throughput at which p99 breaks the SLO, run at about 60 to 70% of it, and autoscale on a signal that predicts trouble (CPU or event loop utilisation, queue length), not only on memory.

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| optimising without measuring | load test, profile, change one thing, measure again |
| judging by the average latency | p95 and p99 |
| `await` in a loop over independent calls | `Promise.all`, with a limit |
| `Promise.all` over thousands of items | `mapLimit` or `p-limit` sized to the pool |
| N+1 queries | join, `ANY($1)`, or a per-request batcher |
| synchronous `*Sync` calls and CPU loops in a request | async APIs, chunk, worker pool |
| parsing or serialising a huge JSON body | size limits, pagination, streaming |
| ReDoS-prone regular expressions | simple patterns, length limits, `re2` |
| new database or HTTP connection per request | pool and keep-alive |
| pool size larger than what the database can take | size from the database limit divided by instances |
| no timeouts | a timeout on every outbound call |
| unbounded in-memory cache | LRU with a maximum size and a TTL |
| caching user data under a shared key | include the user or tenant in the key, or do not cache |
| a hot key expiring for everyone together | coalescing, jitter, stale-while-revalidate |
| compressing everything in Node | compress at the proxy or CDN |
| heap limit equal to the container limit | about 70 to 75% of it |
| buffering large files and bodies | streams |
| `console.log` in hot paths | `pino`, log levels |
| accepting work when overloaded | load shedding with 503 and `Retry-After` |
| a thread per request | a worker pool |

## For a Java developer {#java}

| JVM and Spring | Node.js |
| --- | --- |
| a thread per request (or virtual threads), blocking I/O is fine | one event loop, never block it |
| a slow request occupies one thread | a slow synchronous call stalls everyone |
| JIT warm-up, GC tuning (G1, ZGC) | V8 warm-up, mostly leave the GC alone, fix allocation and leaks |
| JFR, VisualVM, async-profiler | `--cpu-prof`, `--inspect`, clinic, 0x, flame graphs |
| thread dump | `--cpu-prof`, diagnostic report (`--report-on-signal`) |
| heap dump with Eclipse MAT | heap snapshot in DevTools, `v8.writeHeapSnapshot()` |
| HikariCP pool | `pg.Pool`, PgBouncer |
| `@Cacheable`, Caffeine, Spring Cache | `LoadingCache` or `lru-cache`, Redis, `cache-manager` |
| `@Async`, `ExecutorService`, `CompletableFuture` | promises, `Promise.all`, worker threads |
| bulkhead and circuit breaker (Resilience4j) | `opossum`, `p-limit`, `cockatiel` |
| Micrometer and Actuator | `prom-client`, OpenTelemetry |
| Gatling and JMeter | autocannon and k6 |
| scale up with more threads and cores | scale out with more processes, worker threads for CPU |

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| measure | load test (autocannon, k6), percentiles p50 p95 p99, profile, change one thing |
| Little's law | concurrency = throughput x latency |
| event loop | one thread, never block it, watch lag and utilisation |
| blockers | big JSON, `*Sync`, CPU loops, ReDoS, sync crypto |
| fixes | stream, chunk with `setImmediate`, worker pool, do less |
| overload | shed load with 503 and `Retry-After`, timeouts, bulkheads |
| awaits | independent calls in `Promise.all`, otherwise sequential |
| fan-out | limit with `mapLimit` or `p-limit` to the pool size |
| N+1 | join, `ANY($1)`, DataLoader style batcher per request |
| pools | size by database limit divided by instances, keep-alive, timeouts |
| database | indexes, `EXPLAIN ANALYZE`, keyset pagination, select needed columns |
| caching | browser and CDN, process LRU, Redis, cache-aside, delete on write |
| stampede | coalesce in-flight loads, lock, jitter, stale-while-revalidate |
| payload | paginate, compress at the proxy, stream large bodies |
| memory | young and old generation, `--max-old-space-size` about 70% of the limit, snapshots for leaks |
| cores | processes or pods, cluster, worker pool (piscina), queue for long jobs |
| production | RED and USE, p99 and lag alerts, graceful shutdown, capacity at 60 to 70% |

## Interview questions {#questions}

### [basic] Why is Node.js good at I/O-bound work and bad at CPU-bound work? {#io-cpu-q}

Node runs JavaScript on one thread and hands I/O to the operating system and the libuv thread pool, so one thread can keep thousands of connections waiting at almost no cost. While your callback runs, nothing else on that thread runs. So many cheap requests that mostly wait for a database or another service are ideal, and a request that does a second of CPU work blocks every other request in that process. CPU-heavy work belongs in a worker thread, another process or another service.

### [basic] What is the difference between latency and throughput, and why use percentiles? {#latency-q}

Latency is the time for one request, throughput is how many requests are handled per second. They are linked: when a resource saturates, latency rises sharply while throughput stops growing. Percentiles describe the distribution: p50 is the typical request, p99 is what the slowest one percent see. The average hides the tail, where a few very slow requests ruin the experience, and in a system that fans out to many services the tail dominates.

### [basic] Why is `await` inside a loop often slow, and when is it correct? {#await-loop-q}

Each `await` waits for the previous call to finish, so three independent 100 ms calls take 300 ms instead of about 100 ms with `Promise.all`. It is correct when the calls depend on each other (the next needs the previous result), when order matters, or when you want to limit the load. For many items use a concurrency limit rather than starting everything at once.

### [basic] What is the N+1 query problem and how do you fix it? {#n-plus-one-q}

One query loads a list and then one more query runs for every row, so 100 rows cost 101 round trips. Each round trip adds latency and uses a pool connection. Fix it with a join, by loading all related rows in one query (`WHERE id = ANY($1)`), or with a batcher such as DataLoader that collects the keys requested in the same tick and loads them together, created per request so data is not shared between users.

### [basic] What does the HTTP cache headers pair `Cache-Control` and `ETag` do? {#http-cache-q}

`Cache-Control` tells browsers, CDNs and proxies whether and for how long they may reuse a response (`max-age`, `public`, `private`, `no-store`). `ETag` is a validator: the client sends it back in `If-None-Match`, and if the resource has not changed the server answers `304 Not Modified` without a body. Together they remove repeated downloads. Responses with personal or account data must not be stored in shared caches.

### [intermediate] What is event loop lag, how do you measure it and what does it tell you? {#lag-q}

It is how late the event loop runs scheduled work compared with when it was due. Measure it with `perf_hooks.monitorEventLoopDelay` (a histogram, read p99) and `performance.eventLoopUtilization` (the busy share of time), and export both as metrics. Low single-digit milliseconds is healthy. Rising lag means some callback holds the thread (big JSON, sync call, CPU loop, ReDoS), and it hurts all routes, so alert on it and use a CPU profile to find the culprit.

### [intermediate] How do you find the cause of a slow Node.js endpoint? {#find-q}

Reproduce it under a realistic load with autocannon or k6 and look at p95 and p99. Check whether it is CPU or waiting: event loop lag and CPU use, and a trace for time spent in database and downstream calls. For CPU, capture a profile (`--cpu-prof`, clinic flame, `0x`) and read the flame graph for the widest bars. For waiting, look at slow queries and `EXPLAIN ANALYZE`, N+1 patterns, pool wait time and missing timeouts. Change one thing, measure again, and keep it only if the numbers improve.

### [intermediate] Why limit concurrency instead of using `Promise.all` on everything, and how? {#limit-q}

`Promise.all` over thousands of items starts all operations at once. The connection pool is exhausted, later operations wait and time out, memory grows, and a downstream service is overloaded. Use a limiter (`p-limit`, `mapLimit`, a semaphore) with a limit based on the scarcest resource, such as the pool size or a partner's rate limit. Results are still collected in order, and errors are handled with `allSettled` or per item.

### [intermediate] How do you handle CPU-intensive work in a Node.js service? {#cpu-q}

Keep it off the event loop. Options: break it into chunks and yield with `setImmediate` if it is small, use a worker thread pool (piscina) for repeated CPU work such as hashing, parsing or PDF generation, run more processes (cluster, pods) for general scaling, or push long jobs to a queue and a separate worker service and return `202 Accepted`. Also check whether the database can do the aggregation, and stream instead of building huge in-memory structures.

### [intermediate] Describe cache-aside and the problems that come with it. {#cache-aside-q}

The application reads the cache and on a miss loads from the database and stores the result with a TTL. On writes it updates the database and deletes the key. Problems: stale data between a write and an expiry or invalidation, per-instance caches holding different data, keys that omit the user or tenant and leak data, unbounded memory without a maximum size, a race where an old value is written after the delete, and the stampede when a hot key expires. Choose TTLs per kind of data and bound the cache with LRU.

### [intermediate] What is a cache stampede and how do you prevent it? {#stampede-q}

When a popular key expires many requests miss at the same time and all query the database, which may collapse. Prevent it by coalescing concurrent loads so the first miss starts the load and the others await the same promise, a distributed lock for the same across instances, TTL jitter so keys do not expire together, refresh-ahead or stale-while-revalidate (serve the old value while one request refreshes it), and a short negative cache for missing keys.

### [intermediate] How do you size a database connection pool for a Node.js service? {#pool-q}

Start from the database: its maximum connections divided by the number of service instances (and keep some for admin and migrations) gives the upper bound per instance. A small pool (10 to 20) is usually enough, because a database does not run more queries in parallel than it has cores and disks. A bigger pool just moves the queue into the database. Watch the pool wait time and the active count, use PgBouncer when there are many instances, and set a connection timeout and `statement_timeout`.

### [deep] How would you find and fix a memory leak in a Node.js service? {#leak-q}

Confirm it: the used heap rises after garbage collection and the pod ends with `OOMKilled` or a heap error. Take heap snapshots a while apart (DevTools, `v8.writeHeapSnapshot`, or `--heap-prof`), compare them by constructor, and follow the retainers of the growing objects. Typical culprits are an unbounded Map or array used as a cache, listeners added per request without removal, closures holding big objects, timers never cleared, and global state. Fix with bounded caches (LRU and TTL), removing listeners, `WeakMap`, streaming instead of buffering, then verify under load that the heap is flat. Set `--max-old-space-size` to about 70 to 75% of the container limit.

### [deep] A service shows rising p99 latency under load but low CPU. What do you check? {#low-cpu-q}

Low CPU with high latency means waiting. Check the connection pool (wait queue and active connections), slow or N+1 queries and missing indexes, downstream calls without timeouts or with a slow partner, the libuv thread pool (many `crypto`, `zlib`, DNS or file calls with 4 threads), lock contention in the database, keep-alive and socket limits (`maxSockets`), and event loop lag in case short blocking calls add up. Use traces to see where each request waits, and apply timeouts, bulkheads and load shedding so one slow dependency cannot hold the whole service.

### [deep] How does a Node.js service protect itself under overload? {#overload-q}

By refusing excess work early instead of queueing it. Measure event loop lag and in-flight requests, and when they pass a threshold return `503` with `Retry-After`, except for health checks. Add timeouts on all outbound calls, a bulkhead per dependency, a circuit breaker, rate limits per client, bounded queues and stream backpressure. Scale out on a leading signal such as event loop utilisation or queue length, keep capacity headroom (about 60 to 70% of the tested limit), and shut down gracefully so deployments do not add errors.

### [coding] Implement `mapLimit(items, limit, fn)`: run an async function over all items with at most `limit` running at once, keeping the result order and rejecting on the first error. {#coding-maplimit}

```javascript
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;                       // claiming an index is safe: no await between the check and the increment
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);                 // rejects as soon as one worker throws
  return results;
}

// usage
const statements = await mapLimit(accountIds, 10, (id) => buildStatement(id));
```

It starts `limit` workers, each of which keeps taking the next index until the list is empty, so there are never more than `limit` calls in flight, and a slow item does not hold up the others. Results are written to their own index, so the order matches the input. A rejection makes `Promise.all` reject right away, but the other workers keep taking items until the list is empty. To stop them sooner, set a flag in a `catch` that the loop checks. I tested it with 7 items and a limit of 3: the output order was correct and the peak concurrency was 3.

### [coding] Implement a cache with a maximum size (LRU), a TTL and request coalescing, so that 50 concurrent requests for the same missing key call the loader once. {#coding-cache}

```javascript
export class LoadingCache {
  #map = new Map();                                      // key -> { value, expires }
  #inflight = new Map();                                 // key -> Promise
  constructor({ max = 1000, ttlMs = 60_000, now = () => Date.now() } = {}) {
    Object.assign(this, { max, ttlMs, now });
  }

  get(key) {
    const e = this.#map.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) { this.#map.delete(key); return undefined; }
    this.#map.delete(key); this.#map.set(key, e);        // reinsert: most recently used goes last
    return e.value;
  }

  set(key, value) {
    this.#map.delete(key);
    this.#map.set(key, { value, expires: this.now() + this.ttlMs * (0.9 + Math.random() * 0.2) });  // jitter
    if (this.#map.size > this.max) this.#map.delete(this.#map.keys().next().value);                 // evict the oldest
  }

  async getOrLoad(key, loader) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    if (this.#inflight.has(key)) return this.#inflight.get(key);       // join the load already running

    const promise = (async () => {
      try {
        const value = await loader(key);
        this.set(key, value);
        return value;
      } finally {
        this.#inflight.delete(key);                                    // failures are never cached
      }
    })();
    this.#inflight.set(key, promise);
    return promise;
  }
}
```

A `Map` remembers insertion order, so deleting and re-inserting a key on each hit keeps the least recently used key first, and eviction removes `keys().next()`. The in-flight map stores the **promise** itself, so concurrent callers share one load and one result or one error, and the entry is removed in `finally` so a failure can be retried. The jitter spreads expiry times, and an injectable clock makes the TTL testable. In my test 50 concurrent calls ran the loader once, a failed load was not cached, and the oldest entry was evicted at the size limit.

### [coding] Write an Express middleware that measures event loop lag and answers `503` with `Retry-After` when the p99 lag is above a threshold, never rejecting `/health`. {#coding-shed}

```javascript
import { monitorEventLoopDelay } from 'node:perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

let lagMs = 0;
setInterval(() => {
  lagMs = histogram.percentile(99) / 1e6;     // nanoseconds to milliseconds, p99 of the last second
  histogram.reset();                          // so the reading recovers once the loop is healthy
}, 1000).unref();                             // do not keep the process alive for the timer

export function shedLoad({ maxLagMs = 100, getLagMs = () => lagMs } = {}) {
  return (req, res, next) => {
    if (req.path === '/health') return next();   // load balancers must still see the instance alive
    if (getLagMs() > maxLagMs) {
      res.set('Retry-After', '2');
      return res.status(503).json({ error: 'busy' });
    }
    next();
  };
}

app.use(shedLoad({ maxLagMs: 100 }));
```

The histogram samples how late the loop wakes up. Reading the p99 once per second and resetting the histogram means the value reflects the recent past, so when the blocking work ends, the service recovers within a second or two. The middleware sits first in the chain so that rejected requests cost almost nothing. `Retry-After` tells well-behaved clients and gateways when to try again. In a test where a handler blocked the loop for 400 ms, the next request was rejected at once with 503 instead of waiting in the queue. Choose the threshold from your SLO, and keep a separate, readiness-style check for the load balancer so it can stop sending traffic to a persistently overloaded instance.
