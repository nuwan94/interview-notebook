// Frame data for the "Asynchronous JavaScript" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JS_ASYNC_SCENES = [
  {
    id: 'loop',
    label: 'The event loop',
    title: 'One thread, many waiting callbacks',
    frames: [
      {
        note: 'JavaScript runs your code on one thread. The call stack runs one function at a time to the end. Slow things, such as timers, network requests and file reads, are handed to the environment (the browser or Node.js) so the thread is not blocked while it waits.',
        boxes: [b('s', 'Call stack', ['runs one thing at a time'], 'ok'), b('w', 'Web APIs', ['timers, fetch, events'], 'new'), b('q', 'Task queue', ['finished callbacks wait'], 'none'), b('e', 'Event loop', ['feeds the stack'], 'ok')],
        deps: [d('Call stack', 'Web APIs', 'setTimeout, fetch', 'ok'), d('Web APIs', 'Task queue', 'when finished', 'ok'), d('Task queue', 'Event loop', 'next callback', 'ok'), d('Event loop', 'Call stack', 'only when it is empty', 'ok')],
      },
      {
        note: 'Promise callbacks do not go to the task queue. They go to a second one, the microtask queue. After every task, and after the stack empties, the event loop runs all the microtasks, even new ones they add, before it takes the next task.',
        boxes: [b('s', 'Call stack', ['task finished'], 'ok'), b('m', 'Microtask queue', ['promise callbacks'], 'new'), b('q', 'Task queue', ['timers, events'], 'none'), b('e', 'Event loop', ['drains microtasks first'], 'ok')],
        deps: [d('Call stack', 'Microtask queue', 'then, await, queueMicrotask', 'ok'), d('Event loop', 'Microtask queue', 'runs all of them', 'ok'), d('Event loop', 'Task queue', 'then one task', 'warn')],
      },
      {
        note: 'So the order is: all synchronous code, then all microtasks, then the next task. The code logs A, schedules a timer for B with zero delay, schedules a promise callback C, and logs D. The output is A, D, C, B.',
        boxes: [b('a', 'A: sync log', ['runs first'], 'ok'), b('d', 'D: sync log', ['runs second'], 'ok'), b('c', 'C: promise callback', ['microtask, third'], 'new'), b('t', 'B: timer callback', ['task, last'], 'warn')],
        deps: [d('A: sync log', 'D: sync log', 'then', 'ok'), d('D: sync log', 'C: promise callback', 'then', 'ok'), d('C: promise callback', 'B: timer callback', 'then', 'warn')],
      },
      {
        note: 'Nothing can interrupt a running function. A loop that takes three seconds keeps the stack busy, so no click, no timer and no render can run. The page freezes. Move heavy work to a Web Worker, or split it into small pieces.',
        boxes: [b('l', 'Long loop', ['3 seconds on the stack'], 'bad'), b('e', 'Event loop', ['cannot take a task'], 'bad'), b('c', 'Click handler', ['waits, the UI is frozen'], 'bad'), b('w', 'Web Worker', ['heavy work moves here'], 'ok')],
        deps: [d('Long loop', 'Event loop', 'blocks', 'bad'), d('Event loop', 'Click handler', 'delayed', 'bad'), d('Long loop', 'Web Worker', 'moved to', 'ok')],
      },
    ],
  },
  {
    id: 'promise',
    label: 'Promises',
    title: 'A value that arrives later',
    frames: [
      {
        note: 'A promise stands for a value that is not ready yet. It starts pending, and settles once: either fulfilled with a value or rejected with an error. After that it never changes. Handlers added with then and catch run as microtasks.',
        boxes: [b('p', 'Pending promise', ['no result yet'], 'warn'), b('f', 'Fulfilled', ['has a value'], 'ok'), b('r', 'Rejected', ['has an error'], 'bad'), b('t', 'then handler', ['gets the value'], 'ok'), b('c', 'catch handler', ['gets the error'], 'ok')],
        deps: [d('Pending promise', 'Fulfilled', 'resolve(value)', 'ok'), d('Pending promise', 'Rejected', 'reject(error)', 'bad'), d('Fulfilled', 'then handler', 'runs', 'ok'), d('Rejected', 'catch handler', 'runs', 'ok')],
      },
      {
        note: 'then returns a new promise, so calls chain. Whatever a handler returns becomes the value of the next step, and a returned promise is awaited first. An error thrown anywhere skips ahead to the nearest catch, so one catch at the end covers the chain.',
        boxes: [b('f', 'fetch(url)', ['returns a promise'], 'new'), b('j', 'then: response.json()', ['returns another promise'], 'ok'), b('u', 'then: use the data', ['runs with the parsed body'], 'ok'), b('c', 'catch: handle errors', ['any failure above'], 'warn')],
        deps: [d('fetch(url)', 'then: response.json()', 'chains', 'ok'), d('then: response.json()', 'then: use the data', 'chains', 'ok'), d('then: use the data', 'catch: handle errors', 'on error skip to', 'warn')],
      },
      {
        note: 'To run several promises at once there are four helpers. all waits for every one and fails on the first failure. allSettled waits for every one and reports each outcome. race takes the first to settle. any takes the first success.',
        boxes: [b('r', 'Three requests', ['started together'], 'none'), b('a', 'Promise.all', ['all succeed, or first failure'], 'ok'), b('s', 'Promise.allSettled', ['every outcome, never fails'], 'ok'), b('x', 'Promise.race', ['first to settle'], 'warn'), b('y', 'Promise.any', ['first success'], 'ok')],
        deps: [d('Three requests', 'Promise.all', 'combined by', 'ok'), d('Three requests', 'Promise.allSettled', 'combined by', 'ok'), d('Three requests', 'Promise.race', 'combined by', 'warn'), d('Three requests', 'Promise.any', 'combined by', 'ok')],
      },
      {
        note: 'A rejected promise with no catch is an unhandled rejection. In the browser it logs an error. In Node.js, since version 15, it ends the process. Always return or await a promise so someone handles its failure, and add a global handler as a safety net.',
        boxes: [b('r', 'Rejected promise', ['nobody added a catch'], 'bad'), b('u', 'unhandledrejection', ['browser event or Node warning'], 'bad'), b('p', 'Process exit', ['Node.js ends the process'], 'bad')],
        deps: [d('Rejected promise', 'unhandledrejection', 'raises', 'bad'), d('unhandledrejection', 'Process exit', 'in Node.js', 'bad')],
      },
    ],
  },
  {
    id: 'await',
    label: 'async and await',
    title: 'Promises that read like normal code',
    frames: [
      {
        note: 'An async function always returns a promise. When it reaches await it pauses that function only, not the thread, and hands control back to the caller. When the awaited promise settles, the rest of the function runs again as a microtask.',
        boxes: [b('f', 'async function', ['runs until the first await'], 'ok'), b('a', 'await', ['pauses this function only'], 'new'), b('c', 'Caller code', ['keeps running'], 'ok'), b('m', 'Microtask queue', ['resumes the function'], 'new')],
        deps: [d('async function', 'await', 'reaches', 'ok'), d('await', 'Caller code', 'gives control back', 'ok'), d('await', 'Microtask queue', 'resumes later through', 'ok')],
      },
      {
        note: 'Awaiting one call after another runs them in sequence, so three one-second calls take three seconds. If they do not depend on each other, start them all first and await them together with Promise.all, which takes one second.',
        boxes: [b('s', 'Sequential awaits', ['1s + 1s + 1s = 3s'], 'bad'), b('i', 'Independent calls', ['do not need each other'], 'none'), b('p', 'Promise.all', ['start all, wait once: 1s'], 'ok')],
        deps: [d('Independent calls', 'Sequential awaits', 'one after another', 'bad'), d('Independent calls', 'Promise.all', 'together', 'ok')],
      },
      {
        note: 'Wrap awaited calls in try and catch to handle a rejection like an exception. Inside forEach an await does not make the loop wait, because forEach ignores the promises its callback returns. Use for...of for one at a time, or map with Promise.all.',
        boxes: [b('t', 'try / catch', ['catches awaited rejections'], 'ok'), b('f', 'forEach with await', ['does not wait'], 'bad'), b('o', 'for...of with await', ['waits for each one'], 'ok')],
        deps: [d('forEach with await', 'try / catch', 'errors escape it', 'bad'), d('for...of with await', 'try / catch', 'errors are caught', 'ok')],
      },
      {
        note: 'A promise cannot be cancelled by itself. To stop work, pass an AbortSignal. fetch accepts one and rejects with an AbortError when it fires. AbortSignal.timeout makes a signal that fires after a delay, which is the simplest request timeout.',
        boxes: [b('a', 'AbortController', ['signal and abort()'], 'new'), b('f', 'fetch request', ['rejects with AbortError'], 'warn'), b('t', 'Timeout signal', ['AbortSignal.timeout(5000)'], 'ok')],
        deps: [d('AbortController', 'fetch request', 'signal', 'ok'), d('Timeout signal', 'fetch request', 'aborts after 5 s', 'warn')],
      },
    ],
  },
  {
    id: 'threads',
    label: 'Threads and workers',
    title: 'One JavaScript thread, other threads behind it',
    frames: [
      {
        note: 'In Node.js your code still runs on one thread. Network I/O is handled by the operating system without blocking. File system, DNS lookups and crypto go to the libuv thread pool, four threads by default. When they finish, a callback is queued for the JavaScript thread.',
        boxes: [b('j', 'JavaScript thread', ['runs your code'], 'ok'), b('l', 'libuv thread pool', ['file system, crypto, DNS'], 'new'), b('o', 'Operating system', ['network sockets'], 'ok')],
        deps: [d('JavaScript thread', 'libuv thread pool', 'hands off work', 'ok'), d('JavaScript thread', 'Operating system', 'async I/O', 'ok'), d('libuv thread pool', 'JavaScript thread', 'queues a callback', 'ok')],
      },
      {
        note: 'CPU-heavy work, such as hashing a large file or parsing a huge document, blocks the one thread. Put it in a worker: a Web Worker in the browser or a worker thread in Node.js. A worker has its own stack and event loop, and talks to the main thread by messages.',
        boxes: [b('m', 'Main thread', ['stays responsive'], 'ok'), b('p', 'postMessage', ['copies the data'], 'new'), b('w', 'Worker thread', ['CPU-heavy work'], 'ok')],
        deps: [d('Main thread', 'postMessage', 'sends a job', 'ok'), d('postMessage', 'Worker thread', 'delivers', 'ok'), d('Worker thread', 'Main thread', 'sends the result back', 'ok')],
      },
    ],
  },
];
