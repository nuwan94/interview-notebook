---
title: Node.js runtime — V8, libuv, event loop, modules, streams, workers and graceful shutdown
nav: Node.js runtime
slug: node-runtime
summary: The Node.js runtime for backend interviews, V8 and libuv and the thread pool, why Node suits I/O and not CPU work, CommonJS and ES modules, the event loop phases with process.nextTick, setImmediate and microtasks, EventEmitter, buffers and streams with backpressure and pipeline, the fs, path and http modules, process, environment variables and exit codes, error handling and unhandled rejections, worker_threads, cluster and child processes, graceful shutdown on SIGTERM, package.json and npm and pnpm, the built-in test runner, security basics and debugging memory and CPU, compared with Java, with banking examples and interview questions.
tags: [Node.js, V8, libuv, Event loop, Streams, Modules, Workers, Backend, Full stack]
order: 68
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

Node.js interviews start from one question: *how can a single-threaded server handle thousands of connections?* Then they dig deeper:

- What does the event loop do in each phase?
- What runs on the thread pool?
- Why does one CPU-heavy request hurt everyone?
- How do streams and backpressure work?
- What is the difference between CommonJS and ES modules?
- How do you use all the cores?
- How do you shut down cleanly?
- How do you find a memory leak?

This lesson builds on [async JavaScript](lesson:js-async#event-loop) and [JavaScript essentials](lesson:js-essentials#modules). The examples are TypeScript-style JavaScript with banking services.

The demo has four scenes: what Node is, the event loop phases, streams and backpressure, and scaling and shutdown.

```demo
name: node-walk
```

> **One sentence to remember:** *Node runs your JavaScript on one thread, so never keep that thread busy.*

Node hands I/O to libuv, so it serves many waiting requests cheaply. But anything that keeps the main thread busy, or forgets to stream, stops every request.

## What Node.js is {#what}

**Node.js** is a JavaScript **runtime**: a program that runs JavaScript outside the browser. It is built from:

- **V8**: Google's engine that compiles JavaScript to machine code (just-in-time, with optimising tiers).
- **libuv**: a C library with the **event loop**, async network I/O, timers, a **thread pool** and file system access that works on every OS.
- **Node's core modules and C++ bindings**: `fs`, `http`, `net`, `crypto`, `stream`, `worker_threads`, `child_process`, and so on.

It does not include the browser APIs (`document`, `window`). Newer Node versions do provide web-standard APIs such as `fetch`, `AbortController`, `URL`, `TextEncoder`, `structuredClone` and `crypto.subtle`.

Node uses **non-blocking I/O** and an **event-driven** model. You start an operation and give a callback (or await a promise). The result arrives later (the first scene).

- It is a good fit for **I/O-bound** services: APIs, gateways and backends-for-frontend that mostly wait for databases and other services, real-time features (WebSockets), and build tools.
- It is a weak fit for **CPU-bound** work on the main thread: image processing, heavy encryption, big calculations. Move that work to a worker.

**Release lines:** even-numbered versions become **LTS** (long-term support). Run an active LTS in production. Pin it in `.nvmrc` or `engines`, and switch versions with `nvm`, `fnm` or Volta.

## The runtime and the thread pool {#runtime}

- Your JavaScript runs on **one main thread**, with one call stack. Only one callback runs at a time, so there is no data race on your variables.
- **Network I/O** (sockets, HTTP) uses the operating system's readiness APIs (`epoll`, `kqueue`, `IOCP`). So one thread can watch tens of thousands of connections.
- Some operations have no such OS API: **file system, DNS lookups (`dns.lookup`), `crypto` (pbkdf2, scrypt, randomBytes), and `zlib`**. They run on the **libuv thread pool**. It has **4 threads by default**, changed with `UV_THREADPOOL_SIZE` (up to 1024). A fifth concurrent `fs` call waits in a queue.
- Some work runs on the **main thread** and **blocks every request** until it ends: parsing a very large JSON, a regular expression with catastrophic backtracking, a synchronous `fs.readFileSync` in a request path, or a long `for` loop.

```js
// Blocks the event loop: every other request waits for 2 seconds
app.get('/report', (req, res) => {
  const result = buildHugeReportSync();         // CPU work on the main thread
  res.json(result);
});
```

**Rule: never block the event loop.**

- Avoid `*Sync` functions after startup.
- Keep each callback short.
- Stream big data.
- Push CPU work to a worker thread or another service.

## Modules {#modules}

Two module systems exist, and interviews love the differences.

| | CommonJS (CJS) | ES modules (ESM) |
| --- | --- | --- |
| syntax | `const x = require('x')`, `module.exports = ...` | `import x from 'x'`, `export default ...` |
| loading | Synchronous, at run time. | Static analysis, asynchronous. |
| `this` at top level | `module.exports` | `undefined` |
| `__dirname`, `__filename` | Available. | Use `import.meta.dirname` and `import.meta.filename` (Node 20.11+). |
| top-level `await` | No. | Yes. |
| tree shaking | Hard. | Easy. |
| selected by | `.cjs`, or `.js` without `"type": "module"` | `.mjs`, or `.js` with `"type": "module"` in `package.json` |

```js
// ESM
import { readFile } from 'node:fs/promises';
import express from 'express';
export const handler = async () => (await readFile('./data.json', 'utf8'));
```

- Use the **`node:` prefix** for built-in modules (`node:fs`). It makes the source explicit.
- ESM can import CJS. Importing ESM from CJS needs dynamic `import()`. Newer Node versions also support `require` of ESM in many cases.
- **Caching:** a module runs once, and its exports object is cached. So a module-level variable is a **singleton per process**. This is how a database pool is shared.
- **Circular dependencies** return a partly filled export object in CJS. Avoid them.
- `package.json` fields: `name`, `version`, `type`, `main`, `exports` (what other packages can import), `scripts`, `engines`, `dependencies`, `devDependencies`.

## The event loop {#loop}

Recap of the model from [async JavaScript](lesson:js-async#event-loop): one call stack, some queues, and a loop that moves callbacks onto the stack when it is empty.

Node's loop runs in **phases**, in this order, again and again (the second scene):

1. **timers**: callbacks of due `setTimeout` and `setInterval`.
2. **pending callbacks**: some deferred system callbacks, for example certain TCP errors.
3. **idle, prepare**: internal.
4. **poll**: gets new I/O events and runs their callbacks (sockets, files). If nothing is ready and no timer is due, it **waits** here.
5. **check**: `setImmediate` callbacks.
6. **close callbacks**: `socket.on('close')` and similar.

**Between every callback** (after each one, in newer Node versions), Node drains two queues: **first `process.nextTick`, then the promise microtasks** (`.then`, `await`). So a promise callback runs before the next timer, and `nextTick` runs before promises.

```js
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
console.log('sync');
// sync, nextTick, promise, then timeout and immediate (their order is not guaranteed here)
```

- From the **main module**, the order of `setTimeout(0)` and `setImmediate` depends on how fast the process started. It is not guaranteed. **Inside an I/O callback**, `setImmediate` always runs first, because check comes right after poll.
- A **recursive `process.nextTick`**, or an endless chain of microtasks, starves the loop: it never moves on. Use `setImmediate` to give way.
- `setTimeout(fn, 100)` means "no sooner than 100 ms", not exactly 100 ms. A busy main thread delays it.

## EventEmitter {#events}

Many Node objects (streams, servers, sockets) are **`EventEmitter`s**: objects with `on`, `once`, `off` and `emit`. It is the Observer pattern.

```js
import { EventEmitter } from 'node:events';

class TransferService extends EventEmitter {
  send(from, to, amount) {
    // ... do the work ...
    this.emit('transfer', { from, to, amount });
  }
}

const svc = new TransferService();
svc.on('transfer', (t) => console.log('audit', t));
svc.on('error', (err) => console.error(err));   // an 'error' event with no listener throws and may crash the process
svc.send('A-1', 'A-2', 100);
```

- Listeners run **synchronously**, in the order they were added, when `emit` is called.
- Always add an `'error'` listener on emitters that can fail (streams, sockets). With no listener, an emitted `error` is thrown.
- Remove listeners you add to long-lived emitters, or you leak memory. Node warns after 10 listeners for one event.

## Buffers and streams {#streams}

A **`Buffer`** is a fixed-size chunk of raw bytes, outside the JavaScript heap. It holds binary data: files, sockets, encodings (`Buffer.from('é', 'utf8')`, `buf.toString('base64')`). It is a subclass of `Uint8Array`.

A **stream** processes data **in chunks** over time, instead of all at once. There are four kinds:

- **Readable**: a file, an HTTP request.
- **Writable**: a file, an HTTP response.
- **Duplex**: both, such as a socket.
- **Transform**: a Duplex that changes the data, such as gzip.

Why use them? `fs.readFile` loads the whole file into memory. With a 2 GB export and ten requests at once, you need 20 GB. A stream keeps memory flat (the third scene).

```js
import { createReadStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

app.get('/statements/:id.csv.gz', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Encoding', 'gzip');
  try {
    await pipeline(
      createReadStream(`./exports/${safeId(req.params.id)}.csv`),   // readable
      createGzip(),                                                   // transform
      res,                                                            // writable
    );
  } catch (err) {
    if (!res.headersSent) res.status(500).end();                      // client left or file missing
  }
});
```

**Backpressure** handles a destination that is slower than the source, such as a slow client:

1. The writable's buffer fills up.
2. `writable.write()` then returns `false`.
3. The source must **pause until the `'drain'` event**.

`pipe`, and especially **`stream.pipeline`**, do this for you. `pipeline` also **destroys all the streams on error**, and waits for completion. Chaining `.pipe()` calls by hand leaks resources on errors, so prefer `pipeline`.

- **Object mode** streams pass JavaScript objects instead of bytes, for example rows parsed from a CSV.
- Streams are **async iterable**: `for await (const chunk of readable) { ... }`.
- Web streams (`ReadableStream`) are the browser-standard version, also available in Node. `fetch` response bodies are web streams.

## fs, path and http {#core}

```js
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(import.meta.dirname, 'data', 'accounts.json');
const accounts = JSON.parse(await readFile(file, 'utf8'));
await writeFile(file, JSON.stringify(accounts, null, 2));
```

- Use the **promise API** (`node:fs/promises`), and build paths with `path.join` / `path.resolve`, never by joining strings. The `*Sync` versions are fine at startup only.
- **Path traversal:** never join a name from the user straight into a path. Resolve it, and check it stays inside the allowed directory (`path.resolve(base, name).startsWith(base + path.sep)`). Or look the file up by id, as `safeId` does above.
- The **`http`** module is the server underneath Express and Fastify:

```js
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'UP' }));
    return;
  }
  res.writeHead(404).end();
});
server.listen(3000, () => console.log('listening on 3000'));
```

Real services use a framework for routing, parsing and middleware. Express is the next lesson.

- **Keep-alive** reuses TCP connections.
- An outgoing HTTP client should use a shared **agent** with keep-alive, so each call does not open a new connection.
- Node 18+ has a built-in `fetch`.

## process, configuration and exit codes {#process}

`process` is a global object. It describes the current process and lets you control it.

| Property | Use |
| --- | --- |
| `process.env` | Environment variables (strings). The usual place for config and secrets. |
| `process.argv` | Command-line arguments. |
| `process.cwd()` | The current working directory. |
| `process.exit(code)` | Exit now. `0` is success, non-zero is failure. Skips pending async work. |
| `process.exitCode = 1` | Set the code, and let the process end naturally. |
| `process.on('SIGTERM', fn)` | React to a signal. |
| `process.memoryUsage()`, `process.hrtime.bigint()`, `process.uptime()` | Diagnostics. |

Configuration follows the **twelve-factor** rule: config lives in **environment variables**, is validated at startup, and is never committed.

- Validate it with a schema (zod, envalid). Fail fast with a clear message if something is missing.
- Node 20.6+ can load a file with `node --env-file=.env`.
- Keep `.env` out of Git, and use the platform's secret store in production.

```js
import { z } from 'zod';
const env = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
}).parse(process.env);       // throws at startup if invalid
```

## Error handling {#errors}

- **Where errors show up:**
  - synchronous code: `try` and `catch`,
  - promises and `async`: `await` inside `try`, or `.catch`,
  - callbacks: the error-first convention `(err, data)`,
  - emitters: the `'error'` event.
- **Two kinds of error:**
  - *Operational* errors are expected: the database is down, the input is invalid, the network times out. Handle them, and return a proper response.
  - *Programmer* errors are bugs: `undefined is not a function`. Log them and **restart the process**, because its state may be corrupt.
- **`uncaughtException`** (a thrown error nothing caught) and **`unhandledRejection`** (a rejected promise nobody handled) end the process by default, since Node 15. You may log in a handler, but then you must **exit**, and let the supervisor (Kubernetes, systemd, PM2) restart it. Do not keep running after an uncaught exception.
- Use `Error` subclasses with a `cause`: `throw new Error('transfer failed', { cause: err })`.
- An error thrown inside an `async` function becomes a rejected promise. An error thrown in a `setTimeout` callback or an event handler is **not** caught by an outer `try` (see [async errors](lesson:js-async#promises)).

## Using more than one core {#scaling}

One process runs JavaScript on one core. The options (the fourth scene):

| Option | What it is | Use for |
| --- | --- | --- |
| **Several processes** behind a load balancer or container orchestrator | Independent instances that share nothing. | Normal horizontal scaling. Best practice in Kubernetes: one process per container. |
| **`cluster`** | A primary process forks workers that share one server port. | Using all cores on one machine without a separate balancer. |
| **`worker_threads`** | Extra threads, each with its own V8 and event loop, talking by messages or `SharedArrayBuffer`. | CPU-heavy work inside a service: hashing, parsing, image resizing. |
| **`child_process`** (`spawn`, `fork`, `execFile`) | Another OS process, possibly another program. | Running a CLI tool, or an isolated script. |
| **A message queue and a separate worker service** | Heavy jobs are decoupled from requests. | Long or retryable background work. |

```js
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

if (isMainThread) {
  const hash = (data) => new Promise((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: data });
    w.once('message', resolve);
    w.once('error', reject);
  });
  console.log(await hash('statement-2026-11.pdf'));    // the main thread stays free
} else {
  parentPort.postMessage(slowHash(workerData));         // runs on the worker thread
}
```

Starting a thread per request is costly. Use a **worker pool** (for example `piscina`) for repeated work. Workers do not share ordinary objects: messages are copied, and each worker has its own memory.

## Graceful shutdown {#shutdown}

Orchestrators stop a service with **SIGTERM**. After a grace period (30 s in Kubernetes), they send **SIGKILL**, which cannot be caught. A service that ignores SIGTERM loses in-flight requests, and may leave work half done.

```js
const server = app.listen(PORT);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, draining`);

  server.close(async () => {                 // stop accepting new connections, wait for current ones
    try {
      await pool.end();                      // close database connections
      await queue.close();                   // flush producers, stop consumers
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 25_000).unref();   // safety net before the platform kills us
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Also:

- make `/health/ready` return failure once shutdown starts, so the load balancer stops sending traffic,
- close idle keep-alive connections (`server.closeIdleConnections()`).

## Tooling {#tooling}

- **Package managers:** npm, **pnpm** (fast, strict, with a shared store; used in this repo), Yarn. The lockfile (`package-lock.json`, `pnpm-lock.yaml`) pins exact versions. Commit it, and install with `npm ci` or `pnpm install --frozen-lockfile` in CI.
- **Scripts:** `npm run build`, `test`, `start`. `dependencies` ship with the app. `devDependencies` are for building and testing. `npx` or `pnpm dlx` runs a package without installing it.
- **TypeScript on Node:** compile with `tsc` or a build tool, or run with `tsx` during development. Recent Node versions can run simple `.ts` files directly, with type stripping (`node file.ts`).
- **Built-in tools:** `node --watch` restarts on change, `node --test` runs the built-in test runner (`node:test` and `node:assert`), and `node --env-file` loads a config file.
- **Linting and formatting:** ESLint and Prettier.
- **Logging:** a structured logger such as **pino**, which writes JSON lines, with a request id. Never `console.log` secrets.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('interest is calculated per day', () => {
  assert.equal(dailyInterest(36500, 0.05), 5);
});
```

## Security basics {#security}

- **Dependencies are the biggest risk.** Run `npm audit` or `pnpm audit`, and automate updates (Dependabot, Renovate). Pin versions with a lockfile, and review new packages. Beware **typosquatting** (fake packages with similar names) and malicious install scripts.
- **Validate all input** at the edge (zod, ajv). Escape output. Use parameterised queries, never SQL built from strings.
- **Prototype pollution:** merging untrusted JSON into objects with a deep `merge` can set `__proto__`, which changes every object. Validate input, and use `Object.create(null)` or a `Map` for dictionaries.
- **ReDoS:** a regular expression with nested quantifiers can run for exponentially long on crafted input, and freeze the loop. Avoid such patterns, or use a linear-time engine.
- **Never `eval`** or `new Function` on user input. Avoid `child_process.exec` with user text (command injection). Use `execFile` with an argument array.
- **Secrets** come from the environment or a secret manager. Do not log them, or put them in the repo.
- Use **helmet** headers, set limits on request size and time, rate-limit, and run as a non-root user in the container. See [JWT](lesson:jwt#what) and [OAuth 2.0](lesson:oauth2#tokens) for tokens.

## Debugging and memory {#debug}

- **`node --inspect`** (or `--inspect-brk`) opens the V8 inspector. Attach Chrome DevTools or VS Code for breakpoints, **CPU profiles** and **heap snapshots**.
- **Event loop lag** is the best health signal for a Node service. Measure it with `perf_hooks.monitorEventLoopDelay()`. Rising lag means something blocks the main thread.
- **Memory leaks:** the heap keeps growing across garbage collections.
  - Common causes: an unbounded cache or `Map`, listeners added and never removed, closures holding large objects, global arrays, timers never cleared.
  - Take two heap snapshots a while apart, and compare them.
  - `process.memoryUsage().heapUsed` and `--max-old-space-size` (the heap limit) are the first tools.
- **Flame graphs:** `node --prof`, `clinic.js` or `0x` show where CPU time goes.
- Logs with request ids, and **OpenTelemetry** traces, tie a slow request to its cause.

## For a Java developer {#java}

| Java and Spring | Node.js |
| --- | --- |
| JVM | V8 plus the Node runtime |
| A thread per request (Tomcat) | One main thread and an event loop |
| Virtual threads or Reactor (WebFlux) | The native model: non-blocking I/O with async and await |
| `ExecutorService` and thread pool | libuv thread pool (fixed, 4), worker threads, cluster |
| `synchronized`, data races | No shared mutable state between callbacks, so no data races on the main thread |
| `CompletableFuture` | `Promise` |
| `InputStream` and `OutputStream`, Reactive Streams | Streams with backpressure |
| JAR modules, classpath | CommonJS and ES modules, `node_modules` |
| Maven and Gradle | npm or pnpm and `package.json` |
| `@Value` and `application.yml` | `process.env`, validated at start |
| `Runtime.addShutdownHook` | `process.on('SIGTERM')` |
| `Thread.sleep` blocks one thread | Blocking the loop blocks everyone |
| JFR and heap dumps | `--inspect`, heap snapshots, `clinic` |
| Actuator health | A `/health` route, `pino` logs, OpenTelemetry |

Try it in the lab: [Node.js: one JS thread, libuv and the thread pool](lab:node-libuv-threadpool).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| Node | V8 plus libuv plus core modules. One main thread. |
| Good at | I/O-bound work, many concurrent connections. |
| Weak at | CPU-bound work on the main thread. |
| Thread pool | 4 threads: fs, dns.lookup, crypto, zlib. Network I/O uses OS readiness. |
| Never | Block the event loop (`*Sync` in a request, big loops, huge JSON). |
| Event loop | Timers, pending, poll, check, close. `nextTick`, then promises, between callbacks. |
| `setImmediate` | Runs in check. First inside an I/O callback. |
| Modules | CJS `require`, ESM `import`, `type: module`, the `node:` prefix. |
| EventEmitter | Listeners are synchronous. Always handle `error`. |
| Streams | Chunks, constant memory, backpressure. Prefer `pipeline`. |
| Errors | Operational or programmer. Exit on uncaught; the supervisor restarts. |
| Scale | Processes, cluster; worker_threads for CPU; a queue for long jobs. |
| Shutdown | SIGTERM, `server.close`, drain, close the pool, exit, safety timeout. |
| Config | Environment variables, validated at startup. |
| Security | Audit dependencies, validate input, no `eval`, prototype pollution, ReDoS. |
| Debug | `--inspect`, heap snapshots, event loop lag. |

## Interview questions {#questions}

### [basic] What is Node.js and what is it built on? {#what-q}

Node.js is a JavaScript runtime: it runs JavaScript outside the browser. It combines:

- the **V8** engine, which compiles and runs JavaScript,
- **libuv**, which provides the event loop, async I/O, timers and a thread pool,
- core modules (`fs`, `http`, `stream`, `crypto` and others), exposed through C++ bindings.

It is not a language or a framework, and it has no DOM.

### [basic] How can single-threaded Node.js handle thousands of concurrent connections? {#concurrency-q}

Your JavaScript runs on one thread, but it never waits for I/O.

1. Network operations go to the operating system's readiness mechanism, through libuv. File and DNS work goes to a small thread pool.
2. When a result is ready, a callback is queued.
3. The event loop runs the callback when the stack is empty.

While requests wait for databases and other services, they cost only some memory. So one thread can serve many of them.

It breaks down when a callback does long CPU work, because that blocks the loop for everyone.

### [basic] What is the event loop? {#loop-q}

It is the loop that takes callbacks from queues and runs them on the call stack, one at a time, when the stack is empty.

Node's loop has phases: timers, pending callbacks, poll (I/O), check (`setImmediate`) and close callbacks. After each callback, Node drains `process.nextTick` first, then the promise microtasks. See [the event loop](lesson:js-async#event-loop) for the general model.

### [basic] What is the difference between CommonJS and ES modules? {#modules-q}

- **CommonJS** uses `require` and `module.exports`. It loads modules synchronously at run time, and has `__dirname`.
- **ES modules** use `import` and `export`. They can be analysed statically (better tree shaking), load asynchronously, support top-level `await`, and use `import.meta` instead of `__dirname`.

A file is ESM if it has the `.mjs` extension, or if `package.json` has `"type": "module"`. Both kinds are cached, so a module-level object is a singleton per process.

### [basic] What are streams and why use them? {#streams-q}

Streams process data in chunks over time. They come as Readable, Writable, Duplex or Transform objects.

- They keep memory use constant for large data: a big file, an export, an upload.
- The first bytes reach the client before the rest is read.

`readFile`, by contrast, loads everything into memory first. Connect streams with `stream.pipeline`.

### [basic] What is the difference between `process.nextTick`, `setImmediate` and `setTimeout(fn, 0)`? {#timers-q}

- `process.nextTick` runs right after the current operation, before promise microtasks and before the loop continues. It is the earliest, and can starve the loop if used recursively.
- `setImmediate` runs in the **check** phase, after the poll phase.
- `setTimeout(fn, 0)` runs in the **timers** phase of a later loop, after at least 1 ms.

Inside an I/O callback, `setImmediate` always comes first. From the main module, the order of the last two is not guaranteed.

### [intermediate] What runs on the libuv thread pool and what does not? {#pool-q}

**On the pool** (4 threads by default, `UV_THREADPOOL_SIZE`): file system operations, `dns.lookup`, and CPU-bound native work in `crypto` (pbkdf2, scrypt, randomBytes) and `zlib`.

**Not on the pool:** network sockets and HTTP, which use OS readiness APIs on the main thread, and your own JavaScript.

In practice: five slow `crypto.pbkdf2` calls queue behind four threads. And a slow file system can slow DNS lookups, because they share the pool.

### [intermediate] Why is blocking the event loop so harmful, and how do you avoid it? {#block-q}

All requests share the one main thread. A callback that runs for 500 ms delays every other request by 500 ms. That includes health checks, so the orchestrator may restart a healthy instance.

Avoid it:

- no `*Sync` APIs in request paths,
- stream large data,
- limit body sizes,
- avoid regular expressions with catastrophic backtracking,
- split long loops into chunks with `setImmediate`,
- move CPU-heavy work to `worker_threads`, a pool such as piscina, or another service.

Monitor event loop delay to detect it.

### [intermediate] How do you use all CPU cores with Node.js? {#cluster-q}

Run several processes:

- with the `cluster` module: a primary forks workers that share one port, or,
- more commonly today, one process per container, with an orchestrator or load balancer scaling the number of instances.

For CPU-heavy tasks inside a service, use `worker_threads`, so the main loop stays free.

Processes share nothing. So session state and caches must live in a shared store, such as Redis.

### [intermediate] What is backpressure in streams? {#backpressure-q}

When a producer is faster than a consumer, data piles up in memory.

A writable stream has a buffer limit (`highWaterMark`). When the buffer is full, `write()` returns `false`. That tells the source to pause until the `'drain'` event.

`pipe` and `stream.pipeline` do this automatically, so memory stays bounded even with a slow client. Ignoring the return value of `write()` is a common cause of memory growth.

### [intermediate] How should errors be handled in a Node.js service? {#errors-q}

- **Expected (operational) errors:** handle them where they happen. Catch them in `async` code with `try` and `catch`, return the right status and a useful message, and log with context.
- **Programmer errors**, `uncaughtException` and `unhandledRejection`: treat them as fatal. Log, then exit, and let the supervisor restart a clean process.

Also:

- always handle `'error'` on emitters,
- use error-first callbacks consistently,
- wrap causes with `new Error(msg, { cause })`,
- add one central error-handling layer (in Express, an error middleware).

### [intermediate] How do you shut a Node.js service down gracefully? {#shutdown-q}

1. Listen for SIGTERM and SIGINT.
2. On the signal, mark the instance as not ready.
3. Call `server.close()`, so no new connections are accepted while current requests finish.
4. Close the database pool, queue connections and other resources.
5. Exit with code 0.

Add a safety timer, shorter than the platform's grace period, that exits with a non-zero code. Close idle keep-alive connections.

Without this, a rolling deployment drops in-flight requests.

### [intermediate] What is the difference between `cluster`, `worker_threads` and `child_process`? {#workers-q}

- **`cluster`** forks several copies of the same Node app that share a server port. It uses more cores for handling requests.
- **`worker_threads`** runs JavaScript on extra threads in the same process. Each has its own event loop and heap, and they talk by message passing or `SharedArrayBuffer`. It offloads CPU work.
- **`child_process`** starts a separate OS process, possibly a different program such as a CLI tool. It talks through pipes or IPC.

### [deep] How do you find and fix a memory leak in a Node.js service? {#leak-q}

1. **Confirm it:** heap used keeps rising after garbage collections, while the load is steady.
2. **Reproduce it** with a load test. Run the service with `--inspect`.
3. Take a heap snapshot, drive traffic, then take another.
4. Compare the retained objects in DevTools. Look at what grows, and at its retainer path.

Typical causes:

- an unbounded cache or `Map`,
- event listeners or timers never removed,
- closures holding large data,
- global arrays,
- per-request data stored in module scope.

Fix it: bound caches (an LRU with a size or time limit), remove listeners, clear timers, and use `WeakMap` for metadata keyed by objects. Then check with a second run.

### [deep] How would you design a Node.js API to be safe against a slow or malicious client? {#harden-q}

- Limit body size and request time.
- Set `server.headersTimeout`, `requestTimeout` and keep-alive timeouts.
- Use rate limiting, and concurrency limits per client.
- Validate all input with a schema.
- Use streams for uploads, with size limits.
- Put it behind a reverse proxy or API gateway that absorbs slow-connection attacks.
- Use `helmet` headers.
- Avoid ReDoS regular expressions and prototype-polluting merges.
- Run as a non-root user, and keep the dependencies audited.

### [deep] Compare the Node.js and Spring Boot concurrency models. When would you choose each? {#compare-q}

**Spring MVC** uses a thread per request, with blocking I/O. The code is simple, work runs in parallel across cores, and capacity is limited by the thread pool. Virtual threads in Java 21 raise that limit.

**Node** uses one thread and non-blocking I/O. Concurrent waiting is very cheap, and one language covers front end and back end. But CPU work, and mistakes that block the loop, hurt everyone. Parallelism needs processes or workers.

- Choose **Node** for I/O-heavy gateways, backends for frontends, real-time features, and teams that share TypeScript with the front end.
- Choose **Spring Boot** for CPU-heavy or complex transactional domains, a rich enterprise ecosystem, and strong typing and tooling across a large team.

### [coding] Write a Node.js function that streams a large CSV of transactions, filters rows for one account, and writes the result to an HTTP response without loading the file into memory. {#coding-stream}

```js
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Keeps only the header and the rows whose first column matches the account id
function accountFilter(accountId) {
  let first = true;
  return new Transform({
    transform(chunk, _enc, cb) {
      const line = chunk.toString();
      if (first || line.startsWith(`${accountId},`)) this.push(line + '\n');
      first = false;
      cb();
    },
  });
}

export async function exportTransactions(req, res) {
  const { accountId } = req.params;
  res.setHeader('Content-Type', 'text/csv');

  const lines = createInterface({ input: createReadStream('./transactions.csv') });

  try {
    await pipeline(
      async function* () { for await (const line of lines) yield line; },   // one line per chunk
      accountFilter(accountId),
      res,                                                                    // backpressure handled
    );
  } catch (err) {
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);                                                    // abort a half-sent response
  }
}
```

Explain these points:

- Memory stays flat, whatever the file size.
- `pipeline` applies backpressure from a slow client back to the file read.
- It destroys everything if the client disconnects or an error occurs.
- A real parser should use a CSV library, because lines can contain quoted line breaks.

### [coding] Write a small HTTP server with a health endpoint and graceful shutdown that drains requests and closes a database pool. {#coding-shutdown}

```js
import { createServer } from 'node:http';
import { pool } from './db.js';

let ready = true;

const server = createServer(async (req, res) => {
  if (req.url === '/health/ready') {
    res.writeHead(ready ? 200 : 503).end(ready ? 'UP' : 'DOWN');   // load balancer stops sending traffic
    return;
  }
  try {
    const { rows } = await pool.query('SELECT 1');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: rows.length === 1 }));
  } catch (err) {
    console.error(err);
    res.writeHead(500).end();
  }
});

server.listen(3000);

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  ready = false;                                    // fail readiness first
  console.log(`${signal}: draining`);

  setTimeout(() => {                                // give the load balancer time to notice
    server.close(async () => {                      // waits for in-flight requests
      try {
        await pool.end();
        process.exit(0);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    });
    server.closeIdleConnections();                  // do not wait on idle keep-alive sockets
  }, 5_000);

  setTimeout(() => process.exit(1), 25_000).unref(); // hard stop before the platform's SIGKILL
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Explain these points:

- Readiness fails first, so no new traffic arrives.
- `server.close` lets in-flight requests finish.
- The pool is closed.
- A hard timer guarantees the exit before the platform kills the process.

### [coding] Offload a CPU-heavy task to a worker thread with a simple reusable pool, and show how the main thread stays responsive. {#coding-worker}

```js
// pool.js
import { Worker } from 'node:worker_threads';
import os from 'node:os';

export class WorkerPool {
  #workers = [];
  #idle = [];
  #queue = [];

  constructor(file, size = os.availableParallelism()) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(file);
      w.on('message', (result) => this.#done(w, result));
      w.on('error', (err) => this.#done(w, undefined, err));
      this.#workers.push(w);
      this.#idle.push(w);
    }
  }

  run(data) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ data, resolve, reject });
      this.#next();
    });
  }

  #next() {
    if (!this.#idle.length || !this.#queue.length) return;
    const worker = this.#idle.pop();
    const job = this.#queue.shift();
    worker.job = job;
    worker.postMessage(job.data);
  }

  #done(worker, result, err) {
    const { resolve, reject } = worker.job;
    worker.job = null;
    this.#idle.push(worker);
    err ? reject(err) : resolve(result);
    this.#next();
  }

  close() { return Promise.all(this.#workers.map((w) => w.terminate())); }
}

// hash-worker.js
import { parentPort } from 'node:worker_threads';
import { pbkdf2Sync } from 'node:crypto';
parentPort.on('message', ({ password, salt }) => {
  parentPort.postMessage(pbkdf2Sync(password, salt, 600_000, 32, 'sha256').toString('hex'));
});

// usage in a route: the event loop stays free while a worker hashes
const pool = new WorkerPool(new URL('./hash-worker.js', import.meta.url));
app.post('/hash', async (req, res) => res.json({ hash: await pool.run(req.body) }));
```

Explain these points:

- A fixed number of workers (one per core) takes jobs from a queue, so there is no thread per request.
- The main thread only passes messages.
- A production pool (`piscina`) adds timeouts, cancellation and backpressure.
