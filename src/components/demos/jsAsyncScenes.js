// Frame data for the "Asynchronous JavaScript" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- the event loop ---------- */
const loopFrames = [
  {
    h: 270,
    line: 'setTimeout(cb, 1000)',
    result: { text: 'the thread is never blocked', tone: 'ok' },
    cards: [
      box('s', C1, 50, W, 'call stack', ['one function at a time', 'runs to the end'], 'ok'),
      box('w', C3, 50, W, 'web APIs', ['timers, fetch, events', 'wait outside the thread'], 'new'),
      box('q', C3, 170, W, 'task queue', ['finished callbacks', 'wait here'], 'none'),
      box('e', C1, 170, W, 'event loop', ['moves a callback to the', 'stack when it is empty'], 'ok'),
    ],
    arrows: [
      { from: 's', to: 'w', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'w', to: 'q', fs: 'b', ts: 't', tone: 'ok' },
      { from: 'q', to: 'e', fs: 'l', ts: 'r', tone: 'ok' },
      { from: 'e', to: 's', fs: 't', ts: 'b', tone: 'ok' },
    ],
    note: 'JavaScript runs your code on one thread. Slow things such as timers, network requests and file reads are handed to the environment, so the thread does not wait. When they finish, their callback is queued.',
  },
  {
    h: 270,
    line: 'promise.then(cb)',
    result: { text: 'microtasks run before the next task', tone: 'ok' },
    cards: [
      box('s', C1, 50, W, 'call stack', ['task finished,', 'stack is empty'], 'ok'),
      box('m', C2, 50, W, 'microtask queue', ['then, catch, await,', 'queueMicrotask'], 'new'),
      box('q', C3, 50, W, 'task queue', ['timers, events,', 'I/O callbacks'], 'none'),
      box('e', C1, 170, 612, 'event loop', ['run every microtask, even new ones | then take ONE task | repeat'], 'ok'),
    ],
    arrows: [{ from: 's', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 'q', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Promise callbacks go to a second queue, the microtask queue. After each task, the event loop runs all the microtasks before it takes the next task.',
  },
  {
    h: 270,
    line: 'A  setTimeout(B, 0)  Promise.then(C)  D',
    result: { text: 'output: A D C B', tone: 'ok' },
    cards: [
      box('a', 14, 80, 132, '1 A', ['synchronous', 'runs first'], 'ok'),
      box('d', 174, 80, 132, '2 D', ['synchronous', 'runs second'], 'ok'),
      box('c', 334, 80, 132, '3 C', ['promise cb,', 'a microtask'], 'new'),
      box('t', 494, 80, 132, '4 B', ['timer callback', 'a task, even', 'at 0 ms'], 'warn'),
    ],
    arrows: [
      { from: 'a', to: 'd', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'd', to: 'c', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'c', to: 't', fs: 'r', ts: 'l', tone: 'warn' },
    ],
    note: 'The order is fixed: all synchronous code, then all microtasks, then the next task. That is why the zero-delay timer prints last.',
  },
  {
    h: 270,
    line: 'while (Date.now() < end) {}   // 3 s',
    result: { text: 'no click, timer or render can run', tone: 'bad' },
    cards: [
      box('l', C1, 50, W, 'long loop', ['3 seconds on', 'the call stack'], 'bad'),
      box('e', C2, 50, W, 'event loop', ['cannot take a task'], 'bad'),
      box('c', C3, 50, W, 'click handler', ['waits: the page', 'is frozen'], 'bad'),
      box('w', C1, 170, 612, 'fix: Web Worker, or split the work into small pieces', ['heavy work runs on another thread; the main thread stays responsive'], 'ok'),
    ],
    arrows: [{ from: 'l', to: 'e', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'e', to: 'c', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Nothing can interrupt a running function. A long loop keeps the stack busy, so the page freezes. Move heavy work to a worker, or split it into small pieces.',
  },
];

/* ---------- promises ---------- */
const promiseFrames = [
  {
    h: 270,
    line: 'new Promise((resolve, reject) => ...)',
    result: { text: 'settles once, never changes', tone: 'ok' },
    cards: [
      box('p', C1, 110, W, 'pending', ['no result yet'], 'warn'),
      box('f', C2, 50, W, 'fulfilled', ['has a value'], 'ok'),
      box('r', C2, 170, W, 'rejected', ['has an error'], 'bad'),
      box('t', C3, 50, W, 'then(handler)', ['gets the value'], 'ok'),
      box('c', C3, 170, W, 'catch(handler)', ['gets the error'], 'ok'),
    ],
    arrows: [
      { from: 'p', to: 'f', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'p', to: 'r', fs: 'r', ts: 'l', tone: 'bad' },
      { from: 'f', to: 't', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'r', to: 'c', fs: 'r', ts: 'l', tone: 'ok' },
    ],
    note: 'A promise stands for a value that is not ready yet. It starts pending, then settles once, as fulfilled or rejected. Handlers added with then and catch run as microtasks.',
  },
  {
    h: 250,
    line: 'fetch(url).then(json).then(use).catch(fail)',
    result: { text: 'each then returns a new promise', tone: 'ok' },
    cards: [
      box('f', 14, 70, 132, 'fetch(url)', ['returns a promise'], 'new'),
      box('j', 174, 70, 132, 'then(json)', ['returns another', 'promise'], 'ok'),
      box('u', 334, 70, 132, 'then(use)', ['gets the parsed', 'body'], 'ok'),
      box('c', 494, 70, 132, 'catch(fail)', ['any failure above', 'lands here'], 'warn'),
      box('n', 14, 170, 612, 'an error skips ahead', ['a throw or rejection in any step jumps to the nearest catch'], 'none'),
    ],
    arrows: [
      { from: 'f', to: 'j', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'j', to: 'u', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'u', to: 'c', fs: 'r', ts: 'l', tone: 'warn' },
    ],
    note: 'A handler\'s return value becomes the value of the next step, and a returned promise is awaited first. An error thrown anywhere skips ahead to the nearest catch.',
  },
  {
    h: 270,
    line: 'start three requests together',
    result: { text: 'pick the helper that fits', tone: 'ok' },
    cards: [
      box('a', C1, 50, W2, 'Promise.all', ['all succeed, or', 'fails on the first failure'], 'ok'),
      box('s', R2, 50, W2, 'Promise.allSettled', ['every outcome,', 'never fails'], 'ok'),
      box('x', C1, 160, W2, 'Promise.race', ['the first to settle', 'good for timeouts'], 'warn'),
      box('y', R2, 160, W2, 'Promise.any', ['the first success,', 'AggregateError if all fail'], 'ok'),
    ],
    note: 'None of these cancels the other promises. When one fails or loses, the rest keep running, unless you pass them an AbortSignal.',
  },
  {
    h: 250,
    line: 'a rejected promise with no catch',
    result: { text: 'Node.js ends the process', tone: 'bad' },
    cards: [
      box('r', C1, 60, W, 'rejected promise', ['nobody added', 'a catch'], 'bad'),
      box('u', C2, 60, W, 'unhandledrejection', ['browser: logs an error', 'Node: raises the event'], 'bad'),
      box('p', C3, 60, W, 'process exit', ['Node.js 15 and later'], 'bad'),
      box('f', C1, 170, 612, 'fix', ['return or await every promise, add .catch, and keep a global handler as a safety net'], 'ok'),
    ],
    arrows: [{ from: 'r', to: 'u', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'u', to: 'p', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'An unhandled rejection is usually a floating promise: an async function called without await or catch. The lint rule no-floating-promises finds them.',
  },
];

/* ---------- async and await ---------- */
const awaitFrames = [
  {
    h: 270,
    line: 'const data = await load()',
    result: { text: 'pauses the function, not the thread', tone: 'ok' },
    cards: [
      box('f', C1, 50, W, 'async function', ['runs until the', 'first await'], 'ok'),
      box('a', C2, 50, W, 'await', ['pauses this', 'function only'], 'new'),
      box('c', C3, 50, W, 'caller code', ['keeps running'], 'ok'),
      box('m', C2, 170, W, 'microtask queue', ['resumes the function', 'when the promise settles'], 'new'),
    ],
    arrows: [
      { from: 'f', to: 'a', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'a', to: 'c', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'a', to: 'm', fs: 'b', ts: 't', tone: 'ok' },
    ],
    note: 'An async function always returns a promise. At await, only that function pauses and control returns to the caller. When the promise settles, the rest runs again as a microtask.',
  },
  {
    h: 250,
    line: 'three independent 1-second calls',
    result: { text: 'sequential 3 s, parallel 1 s', tone: 'warn' },
    cards: [
      box('s', C1, 50, W2, 'await a; await b; await c', ['1 s + 1 s + 1 s = 3 s'], 'bad'),
      box('p', R2, 50, W2, 'await Promise.all([a, b, c])', ['start all, wait once = 1 s'], 'ok'),
      box('n', C1, 160, 612, 'only run in parallel what does not depend on each other', ['if b needs the result of a, it must wait for a'], 'none'),
    ],
    note: 'Each await waits for the one before it. For independent calls, start them all first, then await them together.',
  },
  {
    h: 260,
    line: 'items.forEach(async (x) => await save(x))',
    result: { text: 'forEach does not wait', tone: 'bad' },
    cards: [
      box('t', C1, 50, 612, 'try { await ... } catch { ... }', ['a rejected promise is handled like an exception'], 'ok'),
      box('f', C1, 150, W2, 'forEach with await', ['ignores the returned promises', 'code after it runs too early'], 'bad'),
      box('o', R2, 150, W2, 'for...of with await', ['one at a time, in order', 'or map + Promise.all'], 'ok'),
    ],
    note: 'forEach ignores the promises its callback returns, so the loop does not wait. Use for...of for one at a time, or map with Promise.all for all at once.',
  },
  {
    h: 250,
    line: 'fetch(url, { signal })',
    result: { text: 'cancel by signal; a promise cannot cancel itself', tone: 'ok' },
    cards: [
      box('a', C1, 50, W, 'AbortController', ['signal + abort()'], 'new'),
      box('f', C2, 50, W, 'fetch request', ['rejects with', 'AbortError'], 'warn'),
      box('t', C3, 50, W, 'AbortSignal.timeout', ['fires after 5000 ms'], 'ok'),
      box('n', C1, 170, 612, 'Promise.race with a timer only stops waiting', ['the work keeps running; the signal really stops it'], 'warn'),
    ],
    arrows: [{ from: 'a', to: 'f', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 'f', fs: 'l', ts: 'r', tone: 'warn' }],
    note: 'A promise cannot be cancelled by itself. Pass an AbortSignal. fetch rejects with an AbortError when it fires. AbortSignal.timeout is the simplest request timeout.',
  },
];

/* ---------- threads and workers ---------- */
const threadFrames = [
  {
    h: 270,
    line: 'fs.readFile, dns.lookup, crypto.pbkdf2',
    result: { text: 'your code stays on one thread', tone: 'ok' },
    cards: [
      box('j', C1, 100, W, 'JavaScript thread', ['runs your code'], 'ok'),
      box('l', C3, 40, W, 'libuv thread pool', ['4 threads by default', 'file system, DNS,', 'crypto, zlib'], 'new'),
      box('o', C3, 180, W, 'operating system', ['network sockets,', 'no thread per request'], 'ok'),
    ],
    arrows: [
      { from: 'j', to: 'l', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'j', to: 'o', fs: 'r', ts: 'l', tone: 'ok' },
    ],
    note: 'Network I/O is handled by the operating system without blocking. File system, DNS and crypto calls go to the libuv thread pool. When they finish, a callback is queued for the JavaScript thread.',
  },
  {
    h: 250,
    line: 'new Worker("hash.js")',
    result: { text: 'heavy work moves off the main thread', tone: 'ok' },
    cards: [
      box('m', C1, 60, W, 'main thread', ['stays responsive'], 'ok'),
      box('p', C2, 60, W, 'postMessage', ['the data is copied', '(or transferred)'], 'new'),
      box('w', C3, 60, W, 'worker thread', ['own stack and', 'event loop'], 'ok'),
      box('r', C1, 170, 612, 'the result comes back as a message', ['no shared variables; a Web Worker has no DOM access'], 'none'),
    ],
    arrows: [{ from: 'm', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'p', to: 'w', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'CPU-heavy work, such as hashing a large file or parsing a huge document, blocks the one thread. Put it in a worker: a Web Worker in the browser, or a worker thread in Node.js.',
  },
];

export const JS_ASYNC_SCENES = [
  { id: 'loop', label: 'The event loop', title: 'One thread, many waiting callbacks', stage: BoardStage, frames: loopFrames },
  { id: 'promise', label: 'Promises', title: 'A value that arrives later', stage: BoardStage, frames: promiseFrames },
  { id: 'await', label: 'async and await', title: 'Promises that read like normal code', stage: BoardStage, frames: awaitFrames },
  { id: 'threads', label: 'Threads and workers', title: 'One JavaScript thread, other threads behind it', stage: BoardStage, frames: threadFrames },
];
