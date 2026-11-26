---
title: Node.js performance — event loop health, concurrency, caching, profiling, memory and scaling
nav: Node.js performance
slug: node-performance
summary: Making a Node.js service fast and keeping it fast, latency and throughput and percentiles and Little's law, measuring first with autocannon, k6, perf_hooks, CPU profiles and flame graphs, event loop lag and utilization and what blocks the loop, JSON and regex and synchronous pitfalls, chunking and worker threads and piscina, sequential versus parallel awaits, limiting concurrency, N+1 queries and batching, connection pools and keep-alive, indexes and pagination, caching layers with HTTP caching and LRU and Redis and cache-aside and stampede protection, payload size and compression and streaming, memory and garbage collection and leaks and container limits, scaling with processes and cluster, load shedding and timeouts and production metrics, compared with the JVM, with banking examples and interview questions.
tags: [Node.js, Performance, Event loop, Caching, Profiling, Scaling, Memory, Backend, Full stack]
order: 74
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

Performance questions in a Node.js interview test whether you understand *why* Node is fast, and where it breaks. Expect questions like these:

- What does the event loop do, and what blocks it?
- How do you find the bottleneck instead of guessing?
- Why is `await` in a loop slow?
- How many things should run at once?
- Where do you cache, and how do you stop a stampede?
- What causes a memory leak?
- How do you use several CPU cores?
- How does a service protect itself when overloaded?

This lesson builds on the [Node.js runtime](lesson:node-runtime#loop), [promises](lesson:js-promises#patterns), [streams](lesson:node-streams#backpressure) and [Redis caching](lesson:redis-caching#patterns). It uses banking examples. Play the four scenes: keep the loop free, parallel I/O, caching layers, and measure first.

```demo
name: node-perf-walk
```

> **One sentence to remember:** *Measure before you tune, and never block the event loop.*

Overlap I/O, but limit how much runs at once. Cache close to the caller, and protect against stampedes. Stream instead of buffering. Shed load before the service falls over.

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

- **Averages hide pain.** Say 99 requests take 50 ms and one takes 5 s. The average is 100 ms, but some user waits 5 s. Always talk in percentiles.
- **Little's law**: `concurrency = throughput x latency`. A service doing 500 requests a second at 200 ms latency has about 100 requests in flight. If latency doubles under the same load, the work in flight doubles too. Memory grows, and the pool runs out. This is why slow dependencies cause failures that spread.
- **Latency rises sharply near saturation.** A service at 90% use is far slower than at 60%. So plan capacity with headroom.
- **Node is good at I/O-bound work**: many waiting connections, with little CPU per request. It is **bad at CPU-bound work** on the main thread. Most performance problems come from ignoring that.
- **Optimise the bottleneck**, not what looks slow. Making a function 2x faster changes nothing if it takes 1% of the time.

## Keep the event loop free {#loop}

All your JavaScript runs on **one thread**, the event loop (see [the event loop](lesson:node-runtime#loop)). While a callback runs, nothing else runs. No other request, no timer, not even a health check. A **blocking** call is any synchronous work that takes a long time.

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

A quick timing shows the scale. Parsing about 22 MB of JSON takes around 120 ms on a laptop. For that whole time, **that process serves no request**.

### Event loop lag and utilization

The best health signal for a Node service is **event loop lag**: how late timers run compared with when they were due. `perf_hooks` gives you a histogram of it. It also gives you **event loop utilization** (ELU), the share of time the loop was busy:

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

A healthy service shows a lag of a few milliseconds, and an ELU well below 0.7. Rising lag means something blocks the loop. Then **every route** gets slower, not just the guilty one. Alert on it. Also log the route and request id of requests that use the CPU for unusually long.

### Fixes for blocking work

1. **Do less**: smaller payloads, pagination, only the fields you need, and aggregation done in SQL.
2. **Stream** instead of buffering. Parse NDJSON or CSV line by line, and pipe files. See [streams](lesson:node-streams#pipeline).
3. **Chunk and yield**: process the work in slices, and give the loop a turn between slices:

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

   `setImmediate` yields after the I/O callbacks, so other requests are served between chunks. The total time is a little longer, but the service stays responsive.
4. **Move CPU work to a worker thread**, or another process (next section).

### Load shedding {#shedding}

When the loop is overloaded, accepting more work makes it worse. Requests queue, time out in the client, and the client retries.

So a service should **refuse early**, with `503 Service Unavailable` and `Retry-After`. Then the capacity left serves the requests that can still succeed:

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

I ran this idea with a handler that blocked the loop for 400 ms. The next request got a 503 at once, instead of waiting.

Combine it with three more defences (see [resilience](lesson:microservice-resilience#breaker)):

- a **timeout** on every outbound call;
- a **bulkhead**: a separate limit for each dependency;
- a **circuit breaker**.

## Measure before you tune {#measure}

Guessing wastes time. Follow this process:

1. **Define the goal**, and a realistic workload: the mix of routes, the payload sizes, the data volume.
2. **Load test** an environment like production. **autocannon** (Node) and **k6** are common:

   ```bash
   npx autocannon -c 100 -d 30 -p 10 http://localhost:3000/accounts/A   # 100 connections, 30 s, pipelining 10
   ```

   Read p50, p95, p99, requests per second, and errors. Run the load generator on a separate machine. Warm the service up first, because V8 optimises hot code only after some calls.
3. **Find the bottleneck** with a profile, not a guess:

   ```bash
   node --cpu-prof app.js              # writes a .cpuprofile file when the process exits
   node --inspect app.js               # Chrome DevTools: Performance and Memory tabs
   npx clinic flame -- node app.js     # or: npx 0x app.js  (flame graph in the browser)
   ```

   In a **flame graph**, the x axis is the share of time, and the y axis is the call stack. The **widest bars** at the top are where the CPU time goes. Look for `JSON.stringify`, regular expressions, `crypto`, logging and library functions, not only your own code.
4. **Change one thing.** Run the same test again. Keep the change only if the numbers improved.

Other tools:

- `console.time('x')` and `performance.now()` give a quick timing. `performance.mark` and `performance.measure`, with a `PerformanceObserver`, give named spans.
- **Traces** (OpenTelemetry) show where a request spent its time across services: the database, a cache, a downstream call. For many services the time goes on waiting for I/O, not on CPU. Only a trace shows that.
- `--heap-prof` and heap snapshots cover memory. See [memory](#memory).
- `process.hrtime.bigint()` gives precise timing. A micro-benchmark library (`mitata`, `tinybench`) times small functions. But micro-benchmarks mislead easily: dead code gets removed, and the JIT warms up. Trust a load test over a benchmark.

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

I measured 329 ms against 107 ms for three 100 ms calls. Keep calls in sequence only when one needs the result of another. Use `Promise.allSettled` when one failure must not cancel the rest (see [promises](lesson:js-promises#combinators)).

### Limit the concurrency

`Promise.all` over 10,000 items starts 10,000 operations at once. That causes four problems:

- the connection pool is exhausted, since `pg` has 10 connections by default;
- the rest wait, and time out;
- memory grows;
- the downstream service is overloaded.

So run **at most N at a time**:

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

Libraries such as `p-limit`, `p-map` and `async` do the same. Choose the limit from what the **slowest resource** can take, such as the pool size or a partner's rate limit. Do not base it on the number of cores.

### N+1 queries and batching

```javascript
// N+1: one query for the list, then one query per transfer
const transfers = await db.query('SELECT * FROM transfers WHERE account_id = $1', [id]);
for (const t of transfers.rows) t.payee = (await db.query('SELECT * FROM payees WHERE id = $1', [t.payee_id])).rows[0];
```

With 100 rows, that is 101 round trips, each 1 to 5 ms plus pool waits. There are three fixes:

- a **join**;
- fetching all the ids at once, with `WHERE id = ANY($1)`;
- a **batcher**. This is the idea behind **DataLoader**. It collects the keys asked for in the same tick, and loads them together:

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

I ran this. Three lookups made in the same tick produced one call, with `['A', 'B', 'C']`. Create a batcher **per request**, so one user's data is never cached for another.

## I/O: pools, keep-alive and the database {#io}

- **Connection pool.** Opening a database connection costs several round trips: TCP, TLS and authentication. So use a pool, such as `pg.Pool` (default `max: 10`).
  - **Size it** to what the database can handle, not larger.
  - Total connections are `instances x pool size`. That must stay under the database limit. Use PgBouncer if needed.
  - Always release a connection, with `try`/`finally` or `pool.query`.
  - See [the connection pool in Spring Data](lesson:spring-data-jpa#stack) for the same ideas with HikariCP.
- **Keep-alive** for outbound HTTP. Reusing connections avoids a TCP and TLS handshake on every call. Node's global agent and `fetch` (undici) keep connections alive by default in current versions. With older code, or `http.Agent`, set `keepAlive: true` and a `maxSockets`.
- **Timeouts** everywhere:
  - `AbortSignal.timeout(2000)` for `fetch`;
  - `statement_timeout` for queries;
  - a server `keepAliveTimeout` above the load balancer's idle timeout. Otherwise you get occasional 502 errors.
- **DNS** lookups use the thread pool and can be slow. Keep connections open, and consider caching lookups.
- **The database is usually the bottleneck.**
  - Add the right **index**. Read the `EXPLAIN ANALYZE` plan.
  - Select only the columns you need. Avoid `SELECT *`.
  - **Paginate.** Prefer keyset pagination, `WHERE id > $last ORDER BY id LIMIT 50`, over a large `OFFSET`.
  - Aggregate in SQL instead of in JavaScript.
- **Compute once, reuse.** Move regular expressions, `Intl.NumberFormat` and `Intl.DateTimeFormat` instances, and prepared statements out of hot loops.

## Caching {#cache}

Caching trades **freshness** for speed. Put each answer as close to the caller as it can safely be:

| Layer | Where | Good for | Caveat |
| --- | --- | --- | --- |
| **browser and CDN** | `Cache-Control`, `ETag` | static assets, public data, API responses that may be stale | cannot cache user-specific data in a shared cache |
| **reverse proxy** | nginx, API gateway | public GETs, rate limits | same |
| **process memory** | LRU with TTL in the service | tiny hot data: config, FX rates, feature flags | per instance, lost on restart, grows memory |
| **Redis** | shared by instances | sessions, rate limits, computed results | network hop, needs invalidation and care |
| **database** | the source of truth | everything | the slowest and the most expensive to scale |

Try it in the lab: [A rush hour for the FX rates endpoint](lab:request-path) steps through a payday spike that swamps the database and shows what cache-aside changes.

### HTTP caching

For a read endpoint that may be a little stale, let the client and the CDN do the work:

- `Cache-Control: public, max-age=60` for public data, or `private, max-age=30` for user data;
- **validators**, such as `ETag`.

Express creates a weak `ETag` for `res.json`. It answers `If-None-Match` with `304 Not Modified` automatically. That saves sending the body, but your handler still runs. So for expensive handlers, combine it with a server-side cache.

Never cache responses with personal or account data in a shared cache. Send `Cache-Control: no-store` for those.

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

I tested it with 50 requests for the same key at the same time. The loader ran **once**, and all 50 got the value. This is the in-flight promise idea from [promises](lesson:js-promises#patterns).

Three more properties:

- Failures are not cached.
- Entries expire.
- When the cache is full, the least recently used entry is evicted.

### Cache-aside, invalidation and stampedes

**Cache-aside**, also called lazy loading, works like this. Read the cache. On a miss, read the database, and store the result with a TTL. On a write, update the database and **delete** the cache key. Deleting is safer than updating.

The hard part is **invalidation**:

- Choose a TTL the business accepts, for each kind of data.
- Never cache data under a key that leaves out the user or tenant.
- Remember that a per-instance cache keeps stale data in the other instances.

A **cache stampede**, or thundering herd, happens when a hot key expires. Thousands of requests miss together, and all go to the database. Defences:

- **coalesce** concurrent loads, as above, within one instance;
- a **lock** in Redis (`SET key value NX PX 5000`), to do the same across instances;
- **jitter** in the TTLs, so keys do not expire together;
- **refresh ahead**, or **stale-while-revalidate**: serve the old value while one request refreshes it;
- a short **negative cache** for "not found".

See [Redis caching](lesson:redis-caching#patterns).

## CPU-bound work and using more cores {#cpu}

One process uses one core for JavaScript. Here are the choices, simplest first (see [using more than one core](lesson:node-runtime#scaling)):

1. **More instances**, as processes or containers, behind a load balancer. This is the usual choice with Kubernetes: one process per container, and scale the pods. Size the CPU request to one core.
2. **`cluster`**, or a process manager such as PM2, runs one worker per core on one machine. `os.availableParallelism()` gives the count.
3. **Worker threads**, for CPU-heavy tasks inside a service: hashing, PDF or image work, parsing, encryption. Use a **pool**, not one thread per request:

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

4. **A queue and a separate worker service**, for long or retryable jobs such as statements and reports. The API answers `202 Accepted`. The client then polls, or receives a notification.
5. **Do it elsewhere.** Let the database aggregate. Or let a specialised service do the heavy part: an image resizer, a native addon, or WebAssembly.

Some built-in work already uses the **libuv thread pool**, which has 4 threads by default (`UV_THREADPOOL_SIZE`). That covers file system calls, DNS lookups, `crypto.scrypt` and `zlib`. If many of these run at once, the pool becomes the bottleneck. The symptom is slow I/O while the event loop stays calm.

## Payload size, compression and streaming {#payload}

- **Smaller responses are faster.** Return only the fields needed, paginate lists, and avoid deep nesting.
- **Compression.** gzip or brotli shrinks JSON by 70 to 90%. Do it at the **reverse proxy or CDN** if you can. Compressing in Node costs CPU; zlib uses the thread pool, but it still competes. Do not compress tiny bodies, or files that are already compressed.
- **Stream large responses**, such as file downloads and exports, with `pipeline`. Do not read them into memory. See [streams](lesson:node-streams#usecases).
- **Serialisation.** `JSON.stringify` of a large object blocks the loop. **Fastify** serialises with a precompiled schema (`fast-json-stringify`), which is faster for large responses. Avoid serialising twice.
- **HTTP/2 or HTTP/3** at the proxy cuts connection overhead for many small requests. A **CDN** serves static files close to users, so Node never serves them at all.
- **Cheap logging.** `pino` writes JSON quickly. Avoid logging big objects, and avoid debug-level logging in hot paths in production.

## Memory and garbage collection {#memory}

V8 splits the heap into two parts:

- the **young generation**: small, collected often and cheaply. Most objects die here.
- the **old generation**: the objects that survive. It is collected less often, with longer pauses.

Memory outside the heap, such as Buffers and native memory, is counted separately, in `rss` and `external`.

```javascript
process.memoryUsage();   // { rss, heapTotal, heapUsed, external, arrayBuffers }
```

- **Heap limit.** Set it with `--max-old-space-size=<MB>`. Modern Node reads the container (cgroup) limits. Still, set the heap to about 70 to 75% of the container memory, so Buffers and native memory fit. Otherwise Kubernetes kills the pod (`OOMKilled`) before Node throws a heap error.
- **Leaks.** The used heap keeps growing, even after garbage collection. Common causes:
  - an unbounded `Map` or array used as a cache;
  - event listeners added per request and never removed;
  - closures that keep large objects alive;
  - timers and intervals never cleared;
  - global state;
  - promises that never settle.

  To find a leak, take **two heap snapshots** some time apart, with DevTools or `v8.writeHeapSnapshot()`. Compare what grew, then follow the retainers. Fix it with a bounded cache (LRU), and `WeakMap` or `WeakRef` for caches keyed by objects. Warnings from `emitter.setMaxListeners` are a hint.
- **Do not buffer.** Reading a 500 MB file with `readFile`, or collecting a whole request body, uses 500 MB per request. Stream it instead.
- **Large allocations in hot paths** add garbage collection work. Examples are many short-lived objects, copying large arrays with spread, and `Buffer.concat` in a loop. Reuse buffers. Use `Buffer.allocUnsafe` only when you overwrite every byte. Prefer streaming parsers.
- **Garbage collection pauses** hurt latency. A growing old generation means longer major collections. Watch them with `perf_hooks` GC entries or `--trace-gc`. Fix the allocation rate or the leak before you tune flags.

## Startup, framework and code-level choices {#framework}

- **Startup time** matters for serverless and autoscaling. Import only what you need, and use lazy `import()` for rarely used modules. Avoid huge dependency trees. Bundle if it helps, and use `node --run` or a compile cache. Loading code dominates the cold start of a function.
- **Framework.** Fastify and plain `http` are measurably faster than Express for simple routes. They have schema-based serialisation and a quicker router. But in most services, the database is the limit, not the framework. Choose for the ecosystem and the team, and measure.
- **Middleware cost.** Every middleware runs for every request. Keep the chain short. Mount expensive middleware only on the routes that need it. Do not parse bodies you will not use. See [middleware performance](lesson:node-express-middleware#performance).
- **V8 habits** that help without making the code obscure:
  - create objects with the same shape: the same properties, in the same order;
  - do not change an object's shape later, or use `delete`;
  - keep each array holding one type;
  - avoid `arguments`;
  - prefer `Map` for frequent additions and removals.

  Write clear code first. Apply these only where a profile points at a hot path.
- **Avoid premature optimisation.** A clear O(n) loop over 50 items beats a clever structure. Optimise what the profile and the percentiles show.

## Production: metrics, backpressure and capacity {#production}

What to watch. The **RED** method covers requests, and **USE** covers resources:

| Signal | Metric |
| --- | --- |
| **R**ate | requests per second per route |
| **E**rrors | 4xx and 5xx share, timeouts |
| **D**uration | p50, p95, p99 latency per route (a histogram, not an average) |
| utilisation | CPU, event loop utilisation, heap used, pool in use |
| saturation | event loop lag, pool wait queue, request queue, open handles |
| dependencies | latency and errors of each downstream call, cache hit ratio |

Export them with `prom-client` (Prometheus). Build dashboards and alerts on **p99, error rate and event loop lag**. Trace with OpenTelemetry. See [Spring observability](lesson:spring-observability#metrics) for the Java equivalent.

Protecting the service:

- **Timeouts and cancellation** on every call, so a slow dependency cannot hold resources forever.
- **Limit the queue.** Bound the number of requests in flight, and reject the rest early ([load shedding](#shedding)). Apply backpressure to streams.
- **Rate limit** each client, and **bulkhead** each dependency. Then one slow partner cannot take down the whole service.
- **Graceful shutdown** and readiness probes, so scaling and deploys do not drop requests ([graceful shutdown](lesson:node-runtime#shutdown)).
- **Capacity test.** Find the throughput at which p99 breaks the SLO, and run at about 60 to 70% of it. Autoscale on a signal that predicts trouble, such as CPU, event loop utilisation or queue length. Do not autoscale on memory alone.

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

Node runs JavaScript on one thread. It hands I/O to the operating system and the libuv thread pool. So one thread can keep thousands of connections waiting, at almost no cost.

But while your callback runs, nothing else on that thread runs. So many cheap requests that mostly wait for a database are ideal. A request that does a second of CPU work blocks every other request in that process.

CPU-heavy work belongs in a worker thread, another process, or another service.

### [basic] What is the difference between latency and throughput, and why use percentiles? {#latency-q}

Latency is the time for one request. Throughput is how many requests are handled per second. They are linked: when a resource saturates, latency rises sharply while throughput stops growing.

Percentiles describe the spread. p50 is the typical request. p99 is what the slowest one percent see.

The average hides the tail, where a few very slow requests ruin the experience. In a system that calls many services, the tail dominates.

### [basic] Why is `await` inside a loop often slow, and when is it correct? {#await-loop-q}

Each `await` waits for the previous call to finish. So three independent 100 ms calls take 300 ms, instead of about 100 ms with `Promise.all`.

It is correct in three cases:

- the calls depend on each other, because the next one needs the previous result;
- the order matters;
- you want to limit the load.

For many items, use a concurrency limit, rather than starting everything at once.

### [basic] What is the N+1 query problem and how do you fix it? {#n-plus-one-q}

One query loads a list, then one more query runs for every row. So 100 rows cost 101 round trips. Each round trip adds latency, and uses a pool connection.

Fix it in one of three ways:

- a join;
- loading all related rows in one query, with `WHERE id = ANY($1)`;
- a batcher such as DataLoader, which collects the keys asked for in the same tick and loads them together. Create it per request, so data is not shared between users.

### [basic] What does the HTTP cache headers pair `Cache-Control` and `ETag` do? {#http-cache-q}

`Cache-Control` tells browsers, CDNs and proxies whether they may reuse a response, and for how long. Its values include `max-age`, `public`, `private` and `no-store`.

`ETag` is a validator. The client sends it back in `If-None-Match`. If the resource has not changed, the server answers `304 Not Modified`, with no body.

Together they remove repeated downloads. Responses with personal or account data must not be stored in shared caches.

### [intermediate] What is event loop lag, how do you measure it and what does it tell you? {#lag-q}

It is how late the event loop runs scheduled work, compared with when it was due.

Measure it with `perf_hooks.monitorEventLoopDelay`, which gives a histogram; read its p99. Add `performance.eventLoopUtilization`, the share of time the loop is busy. Export both as metrics.

A lag of a few milliseconds is healthy. Rising lag means some callback holds the thread: big JSON, a sync call, a CPU loop, or ReDoS. It hurts every route. So alert on it, and use a CPU profile to find the culprit.

### [intermediate] How do you find the cause of a slow Node.js endpoint? {#find-q}

1. Reproduce it under a realistic load with autocannon or k6, and look at p95 and p99.
2. Check whether the time goes on CPU or on waiting. Look at event loop lag and CPU use, and at a trace for time spent in the database and downstream calls.
3. For CPU, capture a profile (`--cpu-prof`, clinic flame, `0x`), and find the widest bars in the flame graph.
4. For waiting, look for slow queries with `EXPLAIN ANALYZE`, N+1 patterns, pool wait time and missing timeouts.
5. Change one thing, measure again, and keep it only if the numbers improve.

### [intermediate] Why limit concurrency instead of using `Promise.all` on everything, and how? {#limit-q}

`Promise.all` over thousands of items starts every operation at once. The connection pool is exhausted, later operations wait and time out, memory grows, and a downstream service is overloaded.

Use a limiter instead: `p-limit`, `mapLimit` or a semaphore. Base the limit on the scarcest resource, such as the pool size or a partner's rate limit.

Results are still collected in order. Handle errors with `allSettled`, or per item.

### [intermediate] How do you handle CPU-intensive work in a Node.js service? {#cpu-q}

Keep it off the event loop. The options:

- If it is small, break it into chunks, and yield with `setImmediate`.
- For repeated CPU work, such as hashing, parsing or PDF generation, use a worker thread pool (piscina).
- For general scaling, run more processes: cluster, or more pods.
- For long jobs, push them to a queue and a separate worker service, and return `202 Accepted`.

Also check whether the database can do the aggregation. And stream, instead of building huge structures in memory.

### [intermediate] Describe cache-aside and the problems that come with it. {#cache-aside-q}

The application reads the cache. On a miss, it loads from the database and stores the result with a TTL. On a write, it updates the database and deletes the key.

The problems:

- stale data between a write and the expiry or invalidation;
- per-instance caches holding different data;
- keys that leave out the user or tenant, and so leak data;
- unbounded memory, without a maximum size;
- a race where an old value is written back after the delete;
- the stampede, when a hot key expires.

Choose a TTL for each kind of data, and bound the cache with LRU.

### [intermediate] What is a cache stampede and how do you prevent it? {#stampede-q}

When a popular key expires, many requests miss at the same time. They all query the database, which may collapse.

Prevent it with:

- coalescing: the first miss starts the load, and the others await the same promise;
- a distributed lock, to do the same across instances;
- TTL jitter, so keys do not expire together;
- refresh-ahead or stale-while-revalidate, which serve the old value while one request refreshes it;
- a short negative cache for missing keys.

### [intermediate] How do you size a database connection pool for a Node.js service? {#pool-q}

Start from the database. Divide its maximum connections by the number of service instances, keeping some spare for admin and migrations. That is the upper bound for each instance.

A small pool, 10 to 20, is usually enough. A database does not run more queries in parallel than it has cores and disks. A bigger pool just moves the queue into the database.

Watch the pool wait time and the active count. Use PgBouncer when there are many instances. Set a connection timeout and a `statement_timeout`.

### [deep] How would you find and fix a memory leak in a Node.js service? {#leak-q}

First, confirm it. The used heap rises even after garbage collection, and the pod ends with `OOMKilled` or a heap error.

Then find it. Take heap snapshots some time apart, with DevTools, `v8.writeHeapSnapshot` or `--heap-prof`. Compare them by constructor, and follow the retainers of the objects that grew.

Typical culprits:

- an unbounded Map or array used as a cache;
- listeners added per request and never removed;
- closures holding big objects;
- timers never cleared;
- global state.

Fix it with bounded caches (LRU and TTL), removing listeners, `WeakMap`, and streaming instead of buffering. Then check under load that the heap stays flat. Set `--max-old-space-size` to about 70 to 75% of the container limit.

### [deep] A service shows rising p99 latency under load but low CPU. What do you check? {#low-cpu-q}

Low CPU with high latency means the service is waiting. Check:

- the connection pool: its wait queue and active connections;
- slow or N+1 queries, and missing indexes;
- downstream calls without timeouts, or a slow partner;
- the libuv thread pool: many `crypto`, `zlib`, DNS or file calls sharing 4 threads;
- lock contention in the database;
- keep-alive and socket limits (`maxSockets`);
- event loop lag, in case many short blocking calls add up.

Use traces to see where each request waits. Apply timeouts, bulkheads and load shedding, so one slow dependency cannot hold the whole service.

### [deep] How does a Node.js service protect itself under overload? {#overload-q}

By refusing extra work early, instead of queueing it.

Measure event loop lag and the requests in flight. When they pass a threshold, return `503` with `Retry-After`, except for health checks.

Add the other defences too:

- timeouts on all outbound calls;
- a bulkhead per dependency;
- a circuit breaker;
- rate limits per client;
- bounded queues, and backpressure on streams.

Scale out on a signal that predicts trouble, such as event loop utilisation or queue length. Keep capacity headroom, about 60 to 70% of the tested limit. Shut down gracefully, so deployments do not add errors.

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

Explain these points:

- It starts `limit` workers. Each keeps taking the next index until the list is empty.
- So there are never more than `limit` calls in flight, and a slow item does not hold up the others.
- Each result is written to its own index, so the order matches the input.
- A rejection makes `Promise.all` reject at once. But the other workers keep taking items until the list is empty. To stop them sooner, set a flag in a `catch` that the loop checks.
- I tested it with 7 items and a limit of 3. The output order was correct, and the peak concurrency was 3.

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

Explain these points:

- A `Map` remembers insertion order. Deleting and re-inserting a key on each hit keeps the least recently used key first.
- Eviction removes `keys().next()`, the oldest key.
- The in-flight map stores the **promise** itself. So concurrent callers share one load, and one result or one error.
- The entry is removed in `finally`, so a failed load can be retried.
- The jitter spreads out expiry times. The injectable clock makes the TTL testable.
- In my test, 50 concurrent calls ran the loader once. A failed load was not cached, and the oldest entry was evicted at the size limit.

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

Explain these points:

- The histogram samples how late the loop wakes up.
- Reading the p99 once a second, then resetting, makes the value reflect the recent past. So when the blocking work ends, the service recovers within a second or two.
- The middleware sits first in the chain, so rejected requests cost almost nothing.
- `Retry-After` tells well-behaved clients and gateways when to try again.
- In a test where a handler blocked the loop for 400 ms, the next request got a 503 at once, instead of waiting in the queue.
- Choose the threshold from your SLO. Keep a separate readiness check for the load balancer, so it can stop sending traffic to an instance that stays overloaded.
