---
title: Asynchronous JavaScript — event loop, promises and async/await
nav: Async JavaScript
slug: js-async
summary: How JavaScript runs asynchronous code on one thread, the call stack, task and microtask queues and the event loop with the exact execution order, timers, callbacks and callback hell, promises and chaining, Promise.all, allSettled, race and any, async and await with sequential and parallel patterns and error handling, fetch pitfalls, cancellation and timeouts with AbortController, retries and concurrency limits, unhandled rejections, workers and the Node.js thread pool, compared with Java threads and CompletableFuture, with examples and interview questions.
tags: [JavaScript, Async, Event loop, Promises, async await, fetch, Node.js, Full stack]
order: 61
topic: Full stack / JavaScript and TypeScript
updated: 2026-11-18
subnav: true
---

Asynchronous code is the most common JavaScript interview topic, and the most common source of real bugs. Interviewers ask *how a single-threaded language handles many things at once, what the event loop does, in what order timers, promises and synchronous code run, what a promise is, how `async` and `await` work underneath, how to run calls in parallel, how to handle errors, cancel and time out, and what blocks the thread.* This lesson builds on [JavaScript essentials](lesson:js-essentials#closures), because callbacks are closures. It compares with Java as it goes ([threads](lesson:java-concurrency#threads), [futures](lesson:java-concurrency#futures)). Play the four scenes: the event loop, promises, `async`/`await`, and threads and workers.

```demo
name: js-async-walk
```

> **One sentence to remember:** *JavaScript runs one function at a time on one thread, finished work queues callbacks, and the event loop runs all synchronous code first, then every promise callback (microtask), then the next timer or event (task), so never block the thread and always handle a rejected promise.*

## Why asynchronous {#why}

Most of what a program waits for (a network call, a file, a timer, a user click) takes far longer than running code. If the thread waited, nothing else could run: in a browser the page would freeze, and in a Node.js server one slow request would stall all the others. So JavaScript does not wait. It **starts** the operation, **registers a callback** and moves on, and the callback runs later.

- **Concurrency, not parallelism:** many operations are *in progress* at once, but your JavaScript code runs **one piece at a time**, so there are no data races between your functions and no locks. The price: a long-running function blocks everything.
- **Java comparison:** Java handles waiting with threads (one blocked thread per request, or a pool, or virtual threads). JavaScript uses one thread with an event loop, similar to what [reactive Spring](lesson:spring-reactive#reactor) and Netty do.

## The event loop {#event-loop}

The first scene shows the parts:

- **Call stack:** the functions currently running. One function runs to completion before anything else can start (**run to completion**).
- **Web APIs** (browser) or **C++ APIs and libuv** (Node.js): where timers, network requests and events actually wait. They are not JavaScript, and they run outside your thread.
- **Task queue** (also called the macrotask or callback queue): finished callbacks (a timer fired, a click happened, a response arrived) wait here.
- **Microtask queue:** promise callbacks (`then`, `catch`, `finally`), the continuation after an `await`, and `queueMicrotask`.
- **Event loop:** when the call stack is empty it first **runs every microtask until the queue is empty** (including microtasks added meanwhile), then (in a browser, maybe renders), then takes **one task** from the task queue, and repeats.

The consequence is a fixed order. Given:

```javascript
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');
// A D C B
```

1. All **synchronous** code (`A`, then `D`).
2. All **microtasks** (`C`).
3. The next **task** (the timer, `B`).

Details worth knowing:

- **`setTimeout(fn, 0)` is not immediate.** It means "as a task, after at least this delay", and browsers clamp nested timers to about 4 ms. Timers are **not exact**: the callback runs when the stack is free.
- **A promise executor runs synchronously.** The function passed to `new Promise(...)` runs at once. Only the `then` callbacks are asynchronous (always, even if the promise is already settled).
- **Microtask starvation:** a microtask that keeps adding microtasks stops the event loop from ever reaching the next task, so rendering and timers are starved. Do not loop with `then`.
- **Blocking:** a long synchronous loop (parsing a big file, a heavy calculation, `JSON.parse` of a huge string) keeps the stack busy, so **no click, timer or render can run** and the page freezes. Fix by **splitting** work into chunks (yielding with `setTimeout` or `scheduler.yield()`), moving it to a **worker**, or doing it on the server.
- **Node.js** adds its own phases (timers, poll, check for `setImmediate`, and so on), and `process.nextTick` callbacks run **before** promise microtasks. The ordering of `setTimeout(0)` against `setImmediate` can vary in the main module, but inside an I/O callback `setImmediate` always runs first. The Node runtime lesson covers it.
- **Compared with Java:** a Java thread can be preempted at any point, which is why it needs locks. JavaScript code cannot be interrupted, so a read-modify-write in one function is safe, but **between** two `await`s other code runs, so state can change.

## Callbacks {#callbacks}

The original style: pass a function to be called later.

```javascript
readFile('a.txt', (err, data) => {
  if (err) return handle(err);          // Node style: the error is the first argument
  parse(data, (err, doc) => {
    if (err) return handle(err);
    save(doc, (err) => { /* ... */ });  // nesting grows: callback hell
  });
});
```

Problems: **deeply nested code** (callback hell), **error handling** repeated at every level, **no easy way to run things in parallel** or wait for all, and **inversion of control** (you trust the library to call you exactly once). Promises were designed to fix these. `util.promisify` (Node.js) converts an error-first callback function to one that returns a promise.

## Promises {#promises}

A **promise** is an object for a value that will exist later (the second scene). It is **pending**, then **settled** once, as **fulfilled** (with a value) or **rejected** (with an error), and never changes again.

```javascript
const p = new Promise((resolve, reject) => {
  setTimeout(() => resolve(42), 1000);     // call resolve or reject, once
});

p.then((value) => value + 1)               // returns a new promise
 .then((next) => console.log(next))        // 43
 .catch((err) => console.error(err))       // any rejection or thrown error above
 .finally(() => console.log('done'));      // runs either way, receives nothing
```

- **`then` returns a new promise.** The value a handler returns becomes the next value, and if it returns a promise, the chain **waits for it** (this flattens nesting). A **thrown error** becomes a rejection that skips to the next `catch`.
- **`catch(fn)`** is `then(undefined, fn)`. After a catch that returns normally, the chain is **fulfilled** again. Re-throw to keep failing.
- **Always return the promise** inside a handler or function, or the chain will not wait for it (a classic bug: a missing `return`).
- **Creating settled promises:** `Promise.resolve(x)`, `Promise.reject(err)`, and `Promise.withResolvers()` (ES2024) returns `{ promise, resolve, reject }` for resolving from outside.
- **Handlers are always asynchronous**, even on an already settled promise, which gives predictable ordering.
- **Thenables:** any object with a `then` method is treated like a promise.

### Combinators {#combinators}

| Helper | Fulfills when | Rejects when | Use for |
| --- | --- | --- | --- |
| `Promise.all([...])` | **all** fulfill (array of values, in order) | **the first** rejects (fail fast) | independent calls that are all needed |
| `Promise.allSettled([...])` | **all** settle (`{status, value or reason}` each) | never | report every result, partial success |
| `Promise.race([...])` | the **first to settle** fulfills | the first to settle rejects | timeouts |
| `Promise.any([...])` | the **first to fulfill** | **all** reject (`AggregateError`) | the first successful mirror or replica |

`Promise.all` does **not cancel** the others when one fails, they keep running, so cancel them yourself with an `AbortSignal`.

### Unhandled rejections {#unhandled}

A rejected promise without a handler is an **unhandled rejection**: the browser fires `unhandledrejection` and logs an error, and **Node.js (since version 15) terminates the process** by default. Prevent it by returning or awaiting every promise, adding `.catch`, and registering `process.on('unhandledRejection', ...)` or `window.addEventListener('unhandledrejection', ...)` as a safety net that logs and fails. **Floating promises** (calling an async function without `await` or `.catch`) are the usual cause, and the ESLint rule `@typescript-eslint/no-floating-promises` catches them.

## async and await {#async-await}

`async`/`await` is syntax over promises that reads like synchronous code (the third scene).

```javascript
async function loadAccount(id) {
  try {
    const res = await fetch(`/api/accounts/${id}`);   // pauses this function, not the thread
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();                           // the returned value is wrapped in a promise
  } catch (err) {
    console.error('failed', err);
    throw err;                                         // let the caller decide
  }
}
```

- **An `async` function always returns a promise.** A returned value is wrapped, a thrown error becomes a rejection.
- **`await` pauses only the async function.** The rest of the function is scheduled as a microtask when the promise settles, and the caller continues in the meantime. Awaiting a non-promise just yields once.
- **Errors:** `try/catch` catches the rejection of an awaited promise. Use `return await` (not just `return`) inside `try` if you want the catch to see a rejection of the returned promise.
- **Top-level `await`** works in ES modules, so a module can wait for setup.
- **Sequential or parallel?** Each `await` waits for the previous one. For independent calls **start them first and await together**:

```javascript
const a = await getBalance(id);            // 1 s
const b = await getLimits(id);             // 1 s more: 2 s in total

const [balance, limits] = await Promise.all([getBalance(id), getLimits(id)]);   // 1 s in total
```

- **Loops:** `forEach` ignores the promises its callback returns, so `await` inside it **does not wait** and the code after the loop runs too early. Use `for...of` with `await` to run one at a time, or `await Promise.all(items.map(async (x) => ...))` to run all at once. For a large list use a concurrency limit (below).
- **`for await...of`** iterates an **async iterable** (a stream, paginated results, `readline`) one awaited value at a time.
- **No `await` = floating promise**, and the error is lost or crashes the process.

## fetch and the browser {#fetch}

```javascript
const res = await fetch('/api/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payment),
  signal: AbortSignal.timeout(5000),         // fails with TimeoutError after 5 seconds
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);   // fetch does NOT reject on 404 or 500
const data = await res.json();
```

- **`fetch` rejects only on network failure** (or an abort). An HTTP **404 or 500 resolves normally**, so check `res.ok` or `res.status`.
- **The body is read once** (`res.json()`, `res.text()`, `res.blob()`), and each call returns a promise.
- **No timeout by default**, so add one with `AbortSignal.timeout`.
- **CORS, cookies and credentials** are separate topics: `credentials: 'include'` sends cookies cross-origin, and the server must allow it ([authentication](lesson:authn-authz#cookie-flags)).
- **Axios** and similar libraries throw on non-2xx responses, which is the main behavioural difference.

## Cancellation, timeouts and retries {#cancellation}

A promise **cannot be cancelled** once created. Cancellation is cooperative, through an **`AbortSignal`** (the fourth frame of the third scene):

```javascript
const controller = new AbortController();
fetch(url, { signal: controller.signal }).catch((e) => { if (e.name !== 'AbortError') throw e; });
controller.abort();                           // the request is cancelled and the promise rejects
const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]);   // either one
```

- **Timeouts:** `AbortSignal.timeout(ms)`, or `Promise.race([work, timeoutPromise])` (which does **not** stop the work).
- **Retries:** retry only **idempotent** operations or those with an idempotency key, on **transient** errors (network failure, 429, 502, 503, 504), with **exponential backoff and jitter** and a maximum, as on the server side ([retries](lesson:microservice-resilience#retries)).
- **Concurrency limits:** firing 10,000 requests at once overloads the server, the browser and the socket pool. Run them through a **pool** of N at a time (see the coding question).
- **Race conditions in UIs:** a slow earlier request can finish after a newer one and overwrite its result (type-ahead search). Cancel the previous request, or ignore a response that is not the latest (a request counter). React effects need the same cleanup.

## Workers and threads {#workers}

- **Browser:** a **Web Worker** runs a script on another thread with its own stack and event loop. It communicates with `postMessage` (data is copied with the structured clone algorithm, or **transferred** for buffers, or shared with `SharedArrayBuffer` and `Atomics`). It has no DOM access. Use it for heavy parsing, image work and cryptography.
- **Node.js:** **`worker_threads`** does the same for CPU-bound code. The **`cluster`** module (or several processes behind a load balancer) uses all cores for a server. Node's own I/O is asynchronous: network I/O uses the operating system's readiness APIs, and the **libuv thread pool** (4 threads by default, `UV_THREADPOOL_SIZE`) runs file system, DNS lookups, `crypto.pbkdf2`, `zlib` and similar calls (the fourth scene).
- **Rule:** I/O-bound work (many waiting requests) suits the event loop. **CPU-bound work** (hashing, large JSON, image processing) must move to a worker or another service, or one request blocks all.

## Compared with Java {#java}

| Java | JavaScript |
| --- | --- |
| a thread per request, pools, virtual threads | one thread and an event loop, callbacks and promises |
| `Future`, `CompletableFuture` | `Promise` (`thenApply` is `then`, `allOf` is `Promise.all`, `exceptionally` is `catch`) |
| blocking calls are normal | blocking the thread is the main sin |
| data races, `synchronized`, locks | no races between functions, but state can change **between awaits** |
| `ExecutorService` limits parallel work | write or import a pool (`p-limit`) |
| `Thread.interrupt`, `Future.cancel` | `AbortController` and `AbortSignal` |
| reactive streams (Reactor) | async iterators, streams, RxJS |
| virtual threads make blocking code cheap | `async`/`await` makes waiting code read as blocking code |

Try it in the lab: [The event loop: why Promise runs before setTimeout](lab:js-event-loop).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| model | one thread, run to completion, finished work queues callbacks |
| order | synchronous code, then all microtasks, then one task, repeat |
| microtasks | `then`, `catch`, `finally`, `await` continuations, `queueMicrotask` |
| tasks | timers, events, I/O callbacks, `setImmediate` (Node) |
| promise | pending then fulfilled or rejected once, `then` returns a new promise |
| combinators | `all` fail fast, `allSettled` every result, `race` first settled, `any` first success |
| await | pauses the function not the thread, `Promise.all` for parallel, not in `forEach` |
| fetch | no rejection on 404 and 500, check `res.ok`, add a timeout |
| cancel | `AbortController`, `AbortSignal.timeout`, promises cannot be cancelled |
| errors | `try/catch` with await, never leave a floating promise, Node exits on unhandled rejection |
| blocking | long sync work freezes everything, use workers or chunks |

## Interview questions {#questions}

### [basic] Is JavaScript single-threaded, and how does it handle asynchronous work? {#single-thread-q}

Your JavaScript code runs on one thread, one function at a time to completion. Waiting operations (timers, network, file I/O) are handled by the environment outside that thread, in the browser's Web APIs or Node's libuv and the operating system. When one finishes, its callback is put in a queue, and the event loop runs it when the call stack is empty. So many operations are in progress at once, but your code never runs in parallel with itself.

### [basic] What is the event loop? {#event-loop-q}

The mechanism that keeps taking work from the queues and running it on the call stack. When the stack is empty it runs all the microtasks (promise callbacks), then takes the next task (a timer, an event or an I/O callback), runs it to completion, and repeats. It is what lets a single thread respond to many events without blocking, as long as no function runs for long.

### [basic] What is the output, and why? `console.log(1); setTimeout(() => console.log(2), 0); Promise.resolve().then(() => console.log(3)); console.log(4);` {#order-q}

`1 4 3 2`. The two `console.log` calls are synchronous and run first (1, 4). The promise callback is a microtask and runs as soon as the stack is empty (3), before any task. The timer callback is a task and runs last (2), even with a zero delay. The rule is: synchronous code, then microtasks, then the next task.

### [basic] What is a promise and what are its states? {#promise-q}

An object that represents the eventual result of an asynchronous operation. It is pending at first and then settles once, either fulfilled with a value or rejected with an error, and it never changes again. You attach handlers with `then`, `catch` and `finally`, which run asynchronously as microtasks and return new promises, so they can be chained.

### [basic] What do `async` and `await` do? {#async-await-q}

`async` makes a function return a promise, wrapping a returned value or turning a thrown error into a rejection. `await` pauses that function until the awaited promise settles, then resumes with its value or throws its error, while the rest of the program keeps running, because only the function is paused and not the thread. It is syntax over promises that lets you use `try/catch` and ordinary control flow.

### [basic] What is callback hell and how do you avoid it? {#callback-hell-q}

Deeply nested callbacks, each depending on the previous result, with error handling repeated at every level, which is hard to read and to change. Avoid it with promises (chain with `then` and handle errors once), better with `async`/`await`, by splitting steps into named functions, and by running independent work in parallel with `Promise.all`.

### [basic] How do you run several independent async calls in parallel? {#parallel-q}

Start them all without awaiting, then wait for them together: `const [a, b] = await Promise.all([getA(), getB()])`. Awaiting one after another makes them sequential and the total time is the sum. Use `Promise.allSettled` if you want every result even when some fail, and limit the number running at once for large lists.

### [intermediate] What is the difference between a microtask and a task? {#microtask-q}

Tasks (macrotasks) are timers, DOM events, I/O callbacks and `setImmediate`, and the loop takes one per turn. Microtasks are promise reactions, the continuation after `await` and `queueMicrotask` callbacks, and the loop runs all of them, including ones added while draining, before it takes the next task or renders. So promise callbacks always run before a pending `setTimeout(0)`, and an endless chain of microtasks can starve the page.

### [intermediate] What is the difference between `Promise.all`, `allSettled`, `race` and `any`? {#combinators-q}

`all` fulfills with an array of all values, or rejects as soon as one rejects. `allSettled` always fulfills, with an array describing each outcome as fulfilled or rejected. `race` settles like the first promise to settle, whether it fulfills or rejects, so it is used for timeouts. `any` fulfills with the first fulfilled value and rejects with an `AggregateError` only if all reject. None of them cancels the other promises.

### [intermediate] Why does `await` inside `forEach` not work as expected, and what do you use instead? {#foreach-q}

`forEach` calls the callback for each item and ignores what it returns, so the promises returned by an async callback are never awaited, and the code after the loop runs before the work is done (and failures become unhandled rejections). Use `for...of` with `await` for sequential processing, or `await Promise.all(items.map(async (item) => ...))` for parallel processing, with a concurrency limit for large lists.

### [intermediate] Does `fetch` reject when the server returns 404 or 500? {#fetch-q}

No. `fetch` rejects only when the request cannot complete (network failure, DNS, CORS failure) or is aborted. An HTTP error status still resolves with a response whose `ok` is false, so you must check `res.ok` or `res.status` and throw yourself. Libraries such as Axios throw for non-2xx statuses by default. Also fetch has no default timeout, so add `AbortSignal.timeout`.

### [intermediate] How do you cancel an asynchronous operation or add a timeout? {#cancel-q}

A promise cannot be cancelled, so the operation must support cancellation. Create an `AbortController`, pass its `signal` to `fetch` (or any API that accepts one), and call `abort()`, which makes the operation reject with an `AbortError`. `AbortSignal.timeout(ms)` makes a signal that aborts by itself, and `AbortSignal.any` combines several. `Promise.race` with a timer only stops waiting, it does not stop the work, so prefer the signal.

### [intermediate] What happens with an unhandled promise rejection? {#unhandled-q}

A rejected promise with no handler raises an `unhandledrejection` event in the browser and logs an error. In Node.js since version 15 the default is to throw, which terminates the process, so a missing `catch` can crash a server. Return or await every promise, add `.catch`, enable the floating-promises lint rule, and register a global handler to log and fail safely.

### [intermediate] A search box shows results for an old query after the user typed more. Why, and how do you fix it? {#race-condition-q}

Responses can arrive out of order: a slow earlier request finishes after a newer one and overwrites its result. Fix it by cancelling the previous request with an `AbortController` when a new one starts, or by remembering the latest request number and ignoring a response that is not from the latest one, and by debouncing the input to send fewer requests. In React do this in the effect cleanup.

### [intermediate] How does `async`/`await` compare with Java's `CompletableFuture` and virtual threads? {#java-q}

A promise is similar to a `CompletableFuture`: `then` maps to `thenApply` and `thenCompose`, `catch` to `exceptionally`, `Promise.all` to `allOf`. But JavaScript has one thread and an event loop, so there are no data races between functions and blocking the thread is harmful, while Java runs tasks on multiple threads and needs locks. Virtual threads let Java write simple blocking code that scales, and `async`/`await` gives JavaScript code that reads as blocking while it is actually suspended.

### [deep] What are the main differences between the browser and Node.js event loops? {#node-loop-q}

Both use a call stack, a task queue and a microtask queue. The browser also schedules rendering between tasks and has Web APIs, with tasks from timers, events and messages. Node.js uses libuv with phases (timers, pending callbacks, poll for I/O, check for `setImmediate`, close callbacks), a `process.nextTick` queue that runs before promise microtasks, and a thread pool for file system, DNS and crypto work. The order of `setTimeout(0)` and `setImmediate` in the main module is not guaranteed, but inside an I/O callback `setImmediate` runs first.

### [deep] A Node.js API becomes slow for every user when one endpoint is called. What do you look for? {#blocking-q}

A synchronous or CPU-heavy operation blocking the event loop: a large `JSON.parse` or `JSON.stringify`, a regular expression with catastrophic backtracking, synchronous file system or crypto calls (`readFileSync`, `pbkdf2Sync`), a big loop or a sort over a huge array. Confirm with event loop delay metrics (`monitorEventLoopDelay`) and a CPU profile. Fix by making the work asynchronous, streaming or chunking it, moving it to a worker thread or another service, or limiting input sizes. Slow I/O alone does not block the loop, but unbounded concurrent requests can exhaust memory or the connection pool.

### [deep] What is a stale closure in async code and how do you avoid it? {#stale-async-q}

A callback created in one run keeps the values of that run. If it executes later, after an `await` or timer, it may use a value that has since changed or is out of date, for example a React state variable captured by an effect or an interval, or a response used after the component unmounted. Avoid it by recreating the callback when its inputs change, reading the latest value through a ref or a functional update, cancelling or ignoring stale work in a cleanup, and not relying on shared variables across an `await`.

### [coding] Implement `Promise.all`. {#coding-all}

```javascript
function promiseAll(items) {
  return new Promise((resolve, reject) => {
    const input = Array.from(items);               // accept any iterable
    const results = new Array(input.length);
    let remaining = input.length;

    if (remaining === 0) {
      resolve(results);                            // an empty input fulfills at once
      return;
    }

    input.forEach((item, index) => {
      Promise.resolve(item).then(                  // plain values and thenables are accepted too
        (value) => {
          results[index] = value;                  // keep the original order
          if (--remaining === 0) resolve(results);
        },
        reject                                     // the first rejection rejects the whole promise
      );
    });
  });
}

// usage
promiseAll([1, Promise.resolve(2), new Promise((r) => setTimeout(() => r(3), 100))]).then(console.log);   // [1, 2, 3]
```

Explain: it returns a **new promise** whose result array keeps the **input order**, not the completion order; each item goes through `Promise.resolve`, so plain values and thenables work; a counter detects when the last one fulfills; the **first rejection** calls `reject`, and later settlements are ignored because a promise settles once; an empty input must resolve immediately; and it does **not cancel** the other promises. `allSettled` is the same with a handler for both outcomes that stores `{ status, value }` or `{ status, reason }` and never rejects.

### [coding] Write `retry` with exponential backoff, jitter, a per-attempt timeout and cancellation. {#coding-retry}

```javascript
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });

const isTransient = (err) =>
  err.name === 'TypeError' ||                       // fetch network failure
  err.name === 'TimeoutError' ||
  [429, 502, 503, 504].includes(err.status);

async function retry(task, { retries = 3, baseMs = 200, maxMs = 5000, timeoutMs = 3000, signal } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const attemptSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])   // caller cancel or per-attempt timeout
        : AbortSignal.timeout(timeoutMs);
      return await task(attemptSignal);              // await here so the catch sees a rejection
    } catch (err) {
      if (signal?.aborted || attempt >= retries || !isTransient(err)) throw err;
      const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
      const delay = Math.random() * backoff;          // full jitter spreads the retries of many clients
      await sleep(delay, signal);
    }
  }
}

// usage: only for idempotent calls
const account = await retry(async (signal) => {
  const res = await fetch('/api/accounts/42', { signal });
  if (!res.ok) throw Object.assign(new Error('HTTP error'), { status: res.status });
  return res.json();
}, { retries: 4 });
```

Explain: the loop retries **only transient errors** (network failure, timeout, 429 and 5xx gateway errors), never a 400 or 404; the delay grows exponentially (`200, 400, 800 ms`) up to a maximum and has **full jitter**, so many clients do not retry at the same instant (a retry storm); each attempt has its own **timeout** through `AbortSignal.timeout`, combined with the caller's signal using `AbortSignal.any`; `return await` keeps the failure inside the `try`; the wait itself can be **cancelled**; and it must only wrap **idempotent** operations or calls carrying an idempotency key, because a timeout does not tell you whether the server processed the request.

### [coding] Write a function that runs an array of async tasks with at most N in progress at a time and returns the results in order. {#coding-pool}

```javascript
async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;                                     // shared index, safe because JS runs one function at a time

  async function runner() {
    while (true) {
      const index = next++;                         // take the next item
      if (index >= items.length) return;            // nothing left
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(runners);                       // fails fast: the first error rejects the whole call
  return results;
}

// usage: download 1,000 statements, 5 at a time
const files = await mapWithLimit(statementIds, 5, (id) => fetch(`/api/statements/${id}`).then((r) => r.json()));
```

Explain: it starts `limit` **runners**, and each loops taking the next index until the list is empty, so at most N workers are in flight and a free runner starts the next item at once (a better use of time than processing in batches of N, where one slow item holds up the batch); results are stored **by index**, so the order is kept; the shared counter needs no lock because `next++` runs without interruption (the check and the increment are in one synchronous step); `Promise.all` makes the first failure reject (use `allSettled` inside the worker to collect errors instead, or pass an `AbortSignal` to stop the remaining work); and the same idea is available as the `p-limit` and `p-map` libraries.
