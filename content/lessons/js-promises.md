---
title: Promises in depth — settling, chaining, error flow, ordering and patterns
nav: Promises in depth
slug: js-promises
summary: JavaScript promises in depth, the executor and the three states, settling once, resolving with a thenable and the resolution procedure, how then, catch and finally create new promises, return values and thrown errors in a chain, error recovery, then with two arguments versus catch, the microtask ordering puzzles including the extra ticks for a returned promise and await, creating promises with new Promise, Promise.resolve, withResolvers and Promise.try, promisifying callbacks and events, timeouts with cleanup, sharing an in-flight promise, sequential and limited concurrency, unhandled rejection tracking, common anti-patterns, TypeScript types, and a minimal promise implementation, compared with Java CompletableFuture, with examples and interview questions.
tags: [JavaScript, Promises, Async, Microtasks, Error handling, Node.js, Full stack]
order: 62
topic: Full stack / JavaScript and TypeScript
updated: 2026-11-18
subnav: true
---

[Async JavaScript](lesson:js-async#promises) introduced promises and `async`/`await`. This lesson goes underneath, because interviews do: *what exactly does `then` return, what happens when a handler returns a promise or throws, what is the difference between `then(a, b)` and `then(a).catch(b)`, in what order do these logs print, how do you turn a callback API into a promise, how do you share one request between callers, and can you write a Promise yourself?* Examples are JavaScript with banking calls. Play the four scenes: settling, chaining and errors, execution order, and patterns.

```demo
name: promise-walk
```

> **One sentence to remember:** *A promise settles once, `then` always returns a new promise that follows its handler's result, errors skip to the next `catch`, and handlers run as microtasks after the current code.*

## What a promise is {#what}

A **promise** is an object that stands for the eventual result of an asynchronous operation. It has three states (the first scene):

| State | Meaning | Can change? |
| --- | --- | --- |
| **pending** | the work is not finished | yes, once |
| **fulfilled** | finished with a **value** | no, final |
| **rejected** | failed with a **reason** (normally an `Error`) | no, final |

**Settled** means fulfilled or rejected. A promise is a **one-time, read-only box for a result**: you cannot change it after it settles, you can read it any number of times, and handlers attached after settling still receive the stored result. This is different from a callback, which you hand over and hope is called exactly once.

A promise is **eager**: the work starts when the promise is created, not when you call `then`. Creating a promise and never reading it does not stop the work, and a forgotten failure is an unhandled rejection. This differs from a lazy function (`() => fetch(...)`) or an RxJS observable, which start when called or subscribed.

## The executor {#executor}

```javascript
const p = new Promise((resolve, reject) => {
  console.log('executor runs now');            // synchronously, before new Promise returns
  setTimeout(() => resolve(42), 100);
});
console.log('after');
// executor runs now
// after
```

- The **executor** runs **immediately and synchronously**. Only the **handlers** (`then`, `catch`, `finally`) are asynchronous.
- `resolve(value)` and `reject(reason)` settle the promise. **Only the first call counts.** Later calls are ignored, so a promise cannot settle twice.
- If the executor **throws**, the promise is **rejected** with that error (if it has not already settled). But a throw in a **later callback** (inside `setTimeout`, an event handler) is *not* caught, because the executor has already returned. Call `reject` there instead.

```javascript
new Promise((resolve, reject) => {
  throw new Error('sync');                     // rejects the promise
});

new Promise((resolve, reject) => {
  setTimeout(() => { throw new Error('later'); }, 0);   // NOT caught: uncaught exception
});

new Promise((resolve, reject) => {
  setTimeout(() => reject(new Error('later')), 0);      // correct
});
```

## Resolving with a promise {#resolution}

`resolve(x)` does **not** always fulfil with `x`. The **promise resolution procedure** decides (the first scene, last frame):

1. If `x` is the **same promise**, reject with a `TypeError` (a cycle).
2. If `x` is a **promise or any thenable** (an object with a `then` method), the outer promise **adopts its state**: it is locked in, and it settles the way `x` settles, with the same value or reason.
3. Otherwise fulfil with `x`.

```javascript
const inner = new Promise((res) => setTimeout(() => res(7), 100));
const outer = new Promise((res) => res(inner));      // outer is locked in to inner
outer.then((v) => console.log(v));                   // 7, not a promise
```

This is why a promise **can never contain another promise as a value**, and why `then` flattens. `Promise.resolve(x)` returns `x` itself if it is a native promise, otherwise a promise resolved with `x`. Any object with a `then` method is treated as a promise, which allows libraries to interoperate (and is a reason not to give a plain object a `then` property).

## then, catch and finally {#chaining}

`then(onFulfilled, onRejected)` **never changes the promise it is called on**. It returns a **new promise**, and what that promise becomes depends on the handler that ran (the second scene):

| The handler... | The new promise |
| --- | --- |
| returns a value | **fulfils** with that value |
| returns a promise or thenable | **follows** it (waits, then fulfils or rejects like it) |
| returns nothing | fulfils with `undefined` |
| throws | **rejects** with the thrown value |
| is missing (not a function) | **passes the result through** unchanged |

```javascript
fetchAccount(id)                                   // promise A
  .then((a) => a.balance)                          // B: fulfils with a number
  .then((balance) => convert(balance, 'USD'))      // C: returns a promise, so C waits for it
  .then((usd) => console.log(usd))                 // D
  .catch((err) => console.error(err));             // E: any rejection or throw above
```

**Catch and recovery.** `catch(fn)` is exactly `then(undefined, fn)`. A rejection **skips** every `then` that has no rejection handler and lands in the next `catch`. If the `catch` handler **returns normally**, the chain is **fulfilled again**, so the error is recovered. To keep failing, **re-throw**:

```javascript
getRates()
  .catch((err) => {
    log(err);
    return cachedRates;                // recovered: the chain continues with a fallback value
  })
  .then((rates) => convert(rates));    // runs with either live or cached rates

getRates()
  .catch((err) => {
    log(err);
    throw err;                         // still failing, the next catch sees it
  });
```

**`finally(fn)`** runs on **both** outcomes, receives **no argument**, and **does not change the result**: the value or the error passes through unchanged. Use it for cleanup. If `fn` throws or returns a rejected promise, that error replaces the result. If `fn` returns a promise, the chain waits for it.

```javascript
setLoading(true);
await load().finally(() => setLoading(false));     // spinner always stops, the result is untouched
```

**`then(a, b)` versus `then(a).catch(b)`.** The two-argument form's `b` handles only a rejection of the **previous** promise, not an error thrown by `a`. With `.then(a).catch(b)` the catch also sees errors from `a`:

```javascript
Promise.resolve()
  .then(() => { throw new Error('boom'); }, () => console.log('never'))   // b does not see boom
  .catch(() => console.log('caught later'));                              // caught here
```

Use `then(a).catch(b)` unless you specifically want to handle only the source's failure.

**The missing `return` bug.** If a handler starts async work and does not return its promise, the chain does **not wait**: the next step runs at once with `undefined`, and any error from the forgotten work has nowhere to go.

```javascript
// Bug: the save is not awaited, the next step runs too early, its error is unhandled
getUser().then((u) => { saveAudit(u); }).then(() => console.log('saved?'));

// Fix: return it
getUser().then((u) => saveAudit(u)).then(() => console.log('saved'));
```

## Execution order {#ordering}

A handler is queued as a **microtask** when its promise settles (or immediately, if it already has). Microtasks run when the call stack is empty, **all of them, in order, before the next timer** ([the event loop](lesson:js-async#event-loop)). The third scene shows three classic puzzles.

**1. Two chains run in lockstep.** Each `then` is queued only when the previous one finishes:

```javascript
Promise.resolve().then(() => console.log('A1')).then(() => console.log('A2')).then(() => console.log('A3'));
Promise.resolve().then(() => console.log('B1')).then(() => console.log('B2'));
// A1, B1, A2, B2, A3
```

**2. Returning a promise costs extra ticks.** The engine must call `then` on the returned promise to adopt it, which takes extra microtask turns (about two more than returning a plain value):

```javascript
Promise.resolve()
  .then(() => { console.log(0); return Promise.resolve(4); })
  .then((r) => console.log(r));

Promise.resolve()
  .then(() => console.log(1))
  .then(() => console.log(2))
  .then(() => console.log(3))
  .then(() => console.log(5))
  .then(() => console.log(6));
// 0, 1, 2, 3, 4, 5, 6
```

Never write code that depends on this, but know why the output is not `0, 1, 4, 2, 3, 5, 6`.

**3. `await`.** Code before the first `await` is synchronous, and the rest is a microtask:

```javascript
async function f() {
  console.log('f1');
  await null;                // yields: the rest runs as a microtask
  console.log('f2');
}
console.log('s1');
f();
console.log('s2');
// s1, f1, s2, f2
```

`await v` behaves like `Promise.resolve(v).then(rest)` for a native promise, so awaiting an already resolved promise takes one tick. Timers (`setTimeout`) are tasks and always run after all pending microtasks.

## Creating promises {#creating}

| Tool | Use |
| --- | --- |
| `new Promise((resolve, reject) => ...)` | wrap an API that uses callbacks or events |
| `Promise.resolve(x)`, `Promise.reject(e)` | an already settled promise, or normalise "value or promise" |
| `Promise.withResolvers()` | `{ promise, resolve, reject }` to settle from outside (ES2024) |
| `Promise.try(fn)` | run `fn`, turning a sync throw or a return value into a promise (newer runtimes) |
| `async function` | a function that always returns a promise |

```javascript
// Wrap a callback API once
function readFileP(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => (err ? reject(err) : resolve(data)));
  });
}
// Node already has this: import { readFile } from 'node:fs/promises', or util.promisify

// Wait for an event once
function once(emitter, name) {
  return new Promise((resolve, reject) => {
    const onOk = (v) => { emitter.off('error', onErr); resolve(v); };
    const onErr = (e) => { emitter.off(name, onOk); reject(e); };
    emitter.once(name, onOk);
    emitter.once('error', onErr);
  });
}   // Node: import { once } from 'node:events'

// Settle from outside, for example to wait for a user decision
const { promise: confirmed, resolve: confirm } = Promise.withResolvers();
dialog.onAccept = () => confirm(true);
await confirmed;

// A delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
```

**Promise.try** wraps a function that might throw synchronously **or** return a promise, so one `.catch` handles both: `Promise.try(() => parse(input)).then(save).catch(report)`.

## Combinators {#combinators}

`Promise.all`, `allSettled`, `race` and `any` take an iterable of promises (or values) and return one promise. See the [table and rules](lesson:js-async#combinators). Points worth repeating:

- **`all` fails fast** on the first rejection but does **not cancel** the other work, and the other rejections are silently ignored (they are handled by `all`).
- **`allSettled`** never rejects: use it when partial success is fine and you want every outcome.
- **`race`** settles with the first outcome, success **or** failure. **`any`** waits for the first **success** and rejects with an `AggregateError` only if all fail.
- Pass promises that are **already started**. `Promise.all(ids.map(load))` starts all loads at once, which can overload a server, so limit concurrency for large arrays.

## Patterns {#patterns}

**Timeout with cleanup.** `Promise.race` against a timer, and clear the timer so it does not keep the process alive. Racing does not cancel the slow work, so abort it too (the fourth scene):

```javascript
function withTimeout(promise, ms, controller) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();                                  // stop the real work
      reject(new Error(`timed out after ${ms} ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const ctrl = new AbortController();
const rates = await withTimeout(fetch('/api/rates', { signal: ctrl.signal }), 3000, ctrl);
// simpler today: fetch(url, { signal: AbortSignal.timeout(3000) })
```

**Share an in-flight promise.** Cache the **promise**, not the value, so concurrent callers share one request. Remove it on failure so the next call can retry:

```javascript
const inflight = new Map();

function getRates(currency) {
  if (inflight.has(currency)) return inflight.get(currency);     // second caller joins the first request
  const p = fetch(`/api/rates/${currency}`)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  inflight.set(currency, p);
  p.then(
    () => setTimeout(() => inflight.delete(currency), 5_000),    // success: keep for a short TTL
    () => inflight.delete(currency),                              // failure: allow a retry at once
  );
  return p;
}
```

**Run in sequence.** Each step waits for the previous one:

```javascript
// reduce form (shows the chain)
const results = await ids.reduce(
  (chain, id) => chain.then(async (acc) => [...acc, await post(id)]),
  Promise.resolve([]),
);
// readable form
const out = [];
for (const id of ids) out.push(await post(id));
```

**Limit concurrency.** Run N at a time (see the [pool exercise](lesson:js-async#coding-pool)), or use a library such as `p-limit`.

**Retry with backoff, cancellation, and polling** are in [async JavaScript](lesson:js-async#cancellation).

**Async iteration.** `for await (const page of pages())` consumes an async iterable (an object with `Symbol.asyncIterator`, or an `async function*`) one awaited value at a time, ideal for paginated APIs and streams.

```javascript
async function* allTransactions(accountId) {
  let cursor;
  do {
    const page = await getPage(accountId, cursor);
    yield* page.items;
    cursor = page.next;
  } while (cursor);
}
for await (const tx of allTransactions('A-1')) process(tx);
```

## Unhandled rejections {#unhandled}

A rejected promise with no handler by the time the microtask queue empties is an **unhandled rejection**. The browser fires `unhandledrejection` (and `rejectionhandled` if a handler is added later). **Node.js** emits `unhandledRejection` and, since version 15, **terminates the process** with a non-zero exit code by default.

```javascript
const p = Promise.reject(new Error('lost'));    // no handler: unhandled rejection
setTimeout(() => p.catch(() => {}), 0);          // too late
```

Prevent it: **return or `await` every promise**, end chains with `.catch`, never start async work without handling its result (a **floating promise**, which the lint rule `@typescript-eslint/no-floating-promises` flags), and register a global handler only to **log and fail**, not to hide errors. The usual trap is a promise you created and then forgot, or one that `Promise.all` was not given. (`Promise.all` and `Promise.race` attach handlers to every input, so a later rejection of a losing input is not reported as unhandled.)

## Anti-patterns {#antipatterns}

| Anti-pattern | Problem | Fix |
| --- | --- | --- |
| **explicit construction**: `new Promise((res, rej) => api().then(res).catch(rej))` | wraps something that is already a promise | return `api()` directly |
| **nested then** (a pyramid) | callback hell again, errors hard to follow | return inner promises and flatten, or use `await` |
| **missing `return`** in a handler | the chain does not wait, errors are lost | return the promise |
| **`async` in the executor**: `new Promise(async (res) => ...)` | a throw inside is lost | do not make the executor async |
| **`forEach` with `await`** | the loop does not wait | `for...of`, or `Promise.all(items.map(...))` |
| **`await` in a loop for independent calls** | needlessly serial | start all, then `await Promise.all` |
| **swallowing errors**: `.catch(() => {})` | failures disappear | log, or re-throw, or return a deliberate fallback |
| **`try/catch` around a non-awaited promise** | the catch never sees the rejection | `await` it inside the `try` |
| **mixing callbacks and promises** | double handling, unclear flow | promisify once at the edge |
| **a promise as a boolean**: `if (isValid())` when `isValid` is async | always truthy | `if (await isValid())` |

## Promises and TypeScript {#types}

```typescript
async function loadAccount(id: string): Promise<Account> { /* ... */ }

type Result = Awaited<ReturnType<typeof loadAccount>>;      // Account: unwraps nested promises

const results: PromiseSettledResult<Account>[] = await Promise.allSettled(ids.map(loadAccount));
for (const r of results) {
  if (r.status === 'fulfilled') use(r.value);                // narrowed: has value
  else log(r.reason);                                        // narrowed: has reason (unknown)
}

const [a, b] = await Promise.all([loadAccount('1'), getRates()]);   // tuple types are preserved
```

An `async` function's return type is always `Promise<T>`. A `catch` value is `unknown` under strict settings, so narrow it (`err instanceof Error`). See [TypeScript generics](lesson:ts-essentials#generics).

## Writing a Promise yourself {#implementation}

A common interview exercise. The essentials: state, a handler list, **async** handler calls, a new promise from every `then`, and the resolution procedure (see the coding question below). The point is to see why handlers are microtasks, why `then` returns a new promise and why a settled promise never changes.

## For a Java developer {#java}

| Java `CompletableFuture` | JavaScript `Promise` |
| --- | --- |
| `supplyAsync(() -> x)` | `new Promise(...)` or an `async` function (eager in both) |
| `thenApply(f)` | `then(f)` returning a value |
| `thenCompose(f)` | `then(f)` returning a promise (flattened automatically) |
| `exceptionally(f)` | `catch(f)` |
| `handle((v, e) -> ...)` | `then(onOk, onErr)` |
| `whenComplete(f)` | `finally(f)` (which receives no argument) |
| `allOf(...)`, `anyOf(...)` | `Promise.all`, `Promise.race` and `Promise.any` |
| `join()` or `get()` blocks a thread | `await` pauses only the async function |
| `cancel(true)` | no cancel: use `AbortController` |
| a thread pool runs the stages | one thread, microtasks |
| `CompletionException` wrapping | the rejection reason itself |
| a stage may run on a different thread | always the same thread |

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| states | pending, then fulfilled or rejected once, final |
| executor | runs synchronously, `resolve` and `reject` work once |
| resolve(promise) | adopts the inner promise's state, no promise-in-promise |
| `then` | returns a **new** promise: value, adopted promise, or rejection if it throws |
| missing handler | result passes through |
| `catch` | `then(undefined, fn)`, returning normally recovers |
| `finally` | both outcomes, no argument, result unchanged |
| `then(a, b)` | `b` does not see errors thrown by `a` |
| ordering | handlers are microtasks: after sync code, before timers, in lockstep across chains |
| returned promise | extra ticks |
| create | `new Promise`, `withResolvers`, `async` function, promisify |
| timeout | `race` plus `clearTimeout` plus abort |
| share | cache the promise, not the value |
| unhandled | Node 15+ exits, return or await every promise |
| anti-patterns | explicit construction, missing return, `forEach` with `await`, async executor |

## Interview questions {#questions}

### [basic] Does the function passed to `new Promise` run synchronously or asynchronously? {#executor-q}

Synchronously and immediately, before `new Promise` returns. Only the handlers added with `then`, `catch` and `finally` are asynchronous (microtasks). A synchronous throw in the executor rejects the promise, but a throw in a later callback such as a `setTimeout` is not caught, so call `reject` there.

### [basic] What does `then` return? {#then-returns-q}

A new promise, always. It does not modify the promise it was called on. The new promise fulfils with the handler's return value, follows it if the handler returns a promise, and rejects if the handler throws. If the relevant handler is missing, the result passes through unchanged. This is what makes chaining and flattening work.

### [basic] What is the difference between `catch` and `finally`? {#catch-finally-q}

`catch(fn)` handles a rejection and, if it returns normally, **recovers** the chain, so later `then` handlers run with its return value. `finally(fn)` runs on both outcomes, receives no argument, and **does not change** the value or error that passes through (unless `fn` itself throws). Use `catch` to handle errors and `finally` for cleanup such as hiding a spinner.

### [basic] What happens if you forget to return the promise inside a `then` handler? {#missing-return-q}

The outer chain does not wait for that work. The next `then` runs immediately with `undefined`, so ordering is wrong, and if the forgotten promise rejects, nothing handles it, producing an unhandled rejection. Always `return` the inner promise (or use `await`).

### [basic] Can a promise change after it has settled? {#immutable-q}

No. It settles exactly once and the value or reason is fixed. Later calls to `resolve` or `reject` are ignored, and handlers added afterwards still receive the same stored result, on a later microtask. That is the guarantee callbacks cannot give.

### [intermediate] What is the difference between `.then(a, b)` and `.then(a).catch(b)`? {#two-args-q}

In `.then(a, b)`, `b` handles only a rejection of the **source** promise. If `a` throws, `b` is not called, and the rejection goes to the next handler. In `.then(a).catch(b)`, the `catch` is attached to the promise that `then(a)` returns, so it handles a rejection of the source **and** an error thrown inside `a`. The second form is usually what you want.

### [intermediate] What happens when you resolve a promise with another promise? {#resolve-promise-q}

The outer promise adopts the inner one. By the promise resolution procedure, `resolve(x)` with a thenable `x` calls `x.then` and the outer promise settles however `x` settles, so a promise never holds another promise as its value. Resolving a promise with itself rejects with a `TypeError`. Any object with a `then` method is treated as a promise.

### [intermediate] What is the output? Two promise chains, one returning a promise from a handler. {#order-puzzle-q}

```javascript
Promise.resolve().then(() => { console.log(0); return Promise.resolve(4); }).then((r) => console.log(r));
Promise.resolve().then(() => console.log(1)).then(() => console.log(2)).then(() => console.log(3)).then(() => console.log(5)).then(() => console.log(6));
```

The output is `0 1 2 3 4 5 6`. Each `then` is a microtask queued when the previous one finishes, so the chains alternate. But the first chain returns a promise from its handler, and adopting it takes about two extra microtask ticks (one to call `then` on it, one to propagate), so `4` appears after `3` instead of after `1`. The point is that returning a promise is slower than returning a value, and that code should never depend on this order.

### [intermediate] Why is this a bug, and how do you fix it? `new Promise(async (resolve) => { const r = await fetch(url); resolve(await r.json()); })` {#async-executor-q}

An `async` executor returns a promise that nobody handles. If `fetch` or `json` rejects, the executor's own promise rejects, not the outer one, so the outer promise stays pending forever and the error becomes an unhandled rejection. It is also an instance of the explicit construction anti-pattern, because `fetch` already returns a promise. Fix: `const r = await fetch(url); return r.json();` in an `async` function, with no `new Promise` at all.

### [intermediate] How do you turn a callback API or an event into a promise? {#promisify-q}

Wrap it once in `new Promise((resolve, reject) => ...)`: call `resolve(value)` in the success path and `reject(error)` in the error path, and remove any listeners you added when the promise settles. In Node.js, `util.promisify` converts error-first callbacks, `node:fs/promises` gives promise versions of fs, and `events.once(emitter, 'name')` waits for an event. A promise can settle only once, so wrapping a repeating event needs an async iterator instead.

### [intermediate] How do you share one request among several callers asking at the same time? {#inflight-q}

Cache the **promise** (keyed by the request), not the resolved value. The first caller creates the promise and stores it, the others receive the same promise, so one request goes out and everyone gets the result. Remove the entry when the promise settles (immediately on failure so a retry is possible, or after a short TTL on success). This also avoids a cache stampede on expiry.

### [intermediate] Does `Promise.race` cancel the losing promise? How do you implement a timeout correctly? {#timeout-q}

No. `race` only settles with the first outcome; the other operation keeps running. A correct timeout races the work against a timer promise, clears the timer in `finally` (otherwise the pending timer keeps a Node process alive), and aborts the work with an `AbortController` so the request actually stops. For `fetch`, `AbortSignal.timeout(ms)` does it directly. See [cancellation](lesson:js-async#cancellation).

### [deep] Why do two promise chains interleave, and why does a handler returning a promise delay the chain? {#interleave-q}

A handler runs as a microtask queued when its promise settles, and the next `then` in a chain is queued only when the previous handler finishes, so two chains each add one microtask per step and the queue alternates between them. When a handler returns a promise, the spec queues a job that calls `then` on that promise, and when it settles another job resolves the outer promise, so the next step is queued two ticks later than if a plain value had been returned. `await` on a native promise avoids that extra cost in modern engines.

### [deep] How are unhandled rejections detected, and what do browsers and Node.js do? {#detect-q}

The engine tracks rejected promises that have no handler. After the microtask queue drains, any still unhandled are reported: the browser fires `unhandledrejection` on `window` (and `rejectionhandled` if a handler is attached later), and Node.js emits `process.on('unhandledRejection')`, which since version 15 terminates the process with a non-zero exit code unless a handler is registered. The safe practice is to handle every rejection, and to use a global handler only to log and exit.

### [deep] When would you prefer `Promise.allSettled` or `Promise.any` over `Promise.all`? {#choose-q}

`allSettled` when partial success is acceptable and you need each outcome, such as sending notifications to many customers and reporting which failed. `any` when you need only the first success from redundant sources, such as several mirrors or replicas, and want to ignore failures unless all fail (it then rejects with an `AggregateError`). `all` only when every result is required and one failure should abort the whole operation, remembering it does not cancel the others.

### [coding] Implement a minimal `MyPromise` with `then`, `catch`, `finally`, thenable adoption and asynchronous handlers. {#coding-mypromise}

```javascript
class MyPromise {
  #state = 'pending';
  #value;
  #handlers = [];

  constructor(executor) {
    let done = false;                                       // resolve or reject only work once

    const settle = (state, value) => {
      this.#state = state;
      this.#value = value;
      for (const h of this.#handlers) this.#schedule(h);
      this.#handlers = [];
    };

    const adopt = (x) => {                                  // the resolution procedure
      if (x === this) return settle('rejected', new TypeError('Chaining cycle'));
      if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
        let then;
        try { then = x.then; } catch (e) { return settle('rejected', e); }
        if (typeof then === 'function') {
          let called = false;
          queueMicrotask(() => {                            // thenables are adopted asynchronously
            try {
              then.call(
                x,
                (v) => { if (!called) { called = true; adopt(v); } },
                (r) => { if (!called) { called = true; settle('rejected', r); } },
              );
            } catch (e) {
              if (!called) { called = true; settle('rejected', e); }
            }
          });
          return;
        }
      }
      settle('fulfilled', x);
    };

    const resolve = (x) => { if (!done) { done = true; adopt(x); } };
    const reject = (r) => { if (!done) { done = true; settle('rejected', r); } };

    try { executor(resolve, reject); } catch (e) { reject(e); }   // sync throw rejects
  }

  #schedule(h) {
    queueMicrotask(() => {                                  // handlers are never synchronous
      const callback = this.#state === 'fulfilled' ? h.onFulfilled : h.onRejected;
      if (typeof callback !== 'function') {                 // no handler: pass the result through
        return this.#state === 'fulfilled' ? h.resolve(this.#value) : h.reject(this.#value);
      }
      try {
        h.resolve(callback(this.#value));                   // may return a promise: adopted
      } catch (e) {
        h.reject(e);
      }
    });
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {            // always a NEW promise
      const h = { onFulfilled, onRejected, resolve, reject };
      if (this.#state === 'pending') this.#handlers.push(h);
      else this.#schedule(h);                               // already settled: still async
    });
  }

  catch(onRejected) { return this.then(undefined, onRejected); }

  finally(fn) {                                             // runs always, keeps the result
    return this.then(
      (v) => MyPromise.resolve(fn()).then(() => v),
      (r) => MyPromise.resolve(fn()).then(() => { throw r; }),
    );
  }

  static resolve(v) { return v instanceof MyPromise ? v : new MyPromise((res) => res(v)); }
  static reject(r) { return new MyPromise((_, rej) => rej(r)); }
}

// usage
new MyPromise((res) => setTimeout(() => res(21), 10))
  .then((v) => v * 2)
  .then((v) => { throw new Error(`got ${v}`); })
  .catch((e) => e.message)
  .finally(() => console.log('cleanup'))
  .then(console.log);                                       // cleanup, then "got 42"
```

The pieces map to the rules: one-time settling (`done`), executor errors reject, handlers are always scheduled as microtasks, every `then` returns a new promise that follows its handler's result through `resolve`, a missing handler passes the result along, and a thenable result is adopted. It leaves out unhandled-rejection tracking and some edge cases of the Promises/A+ specification.

### [coding] Write `promisify`, and a `withTimeout` that cleans its timer and aborts the underlying work. {#coding-timeout}

```javascript
// Converts an error-first callback function into one that returns a promise
function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, result) => (err ? reject(err) : resolve(result)));
    });
  };
}

const readFileP = promisify(fs.readFile);
const text = await readFileP('./rates.json', 'utf8');

// Run work(signal) with a time limit. The work receives a signal and should stop when aborted.
async function withTimeout(work, ms) {
  const controller = new AbortController();
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new Error(`timed out after ${ms} ms`));   // stop the real work
      reject(controller.signal.reason);
    }, ms);
  });

  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);                                         // never leave a timer pending
  }
}

try {
  const res = await withTimeout((signal) => fetch('/api/rates', { signal }), 3000);
  console.log(await res.json());
} catch (err) {
  console.error(err.message);                                    // "timed out after 3000 ms" or a network error
}
```

`promisify` resolves or rejects exactly once, and `this` is preserved. `withTimeout` races the work and a timer, aborts the work when time runs out (so the connection really closes), and clears the timer in `finally`, so a successful call does not keep the Node.js process alive for the whole timeout.

### [coding] Write a cache that deduplicates concurrent calls for the same key, removes failed entries, and expires successful ones after a TTL. {#coding-dedupe}

```javascript
function dedupe(load, { ttlMs = 5000 } = {}) {
  const cache = new Map();                                      // key -> { promise, expires }

  return function get(key) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;    // join the in-flight or cached promise

    const entry = { promise: null, expires: Infinity };         // in flight: never expires by time
    entry.promise = load(key).then(
      (value) => {
        entry.expires = Date.now() + ttlMs;                      // cache a successful result for a while
        return value;
      },
      (err) => {
        if (cache.get(key) === entry) cache.delete(key);         // a failure is not cached: retry next time
        throw err;                                               // callers still see the error
      },
    );
    cache.set(key, entry);
    return entry.promise;
  };
}

const getRates = dedupe((currency) => fetch(`/api/rates/${currency}`).then((r) => r.json()), { ttlMs: 10_000 });

// ten callers at once: one network request
const [a, b, c] = await Promise.all([getRates('SGD'), getRates('SGD'), getRates('USD')]);
```

All concurrent callers for a key share one promise, so only one request is sent. A rejected promise is removed so the next call retries, and each caller still gets the rejection. A fulfilled promise is reused until its TTL passes. The check `cache.get(key) === entry` avoids deleting a newer entry that replaced this one. A production version would also bound the map size (an LRU) and remove expired entries.
