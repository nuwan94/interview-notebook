// Frame data for the "Promises in depth" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- states and settling ---------- */
const stateFrames = [
  {
    h: 240,
    line: 'new Promise(executor)',
    result: { text: 'the executor runs now, synchronously', tone: 'ok' },
    cards: [
      box('n', C1, 60, W, 'new Promise', ['executor(resolve, reject)', 'runs before it returns'], 'new'),
      box('p', C2, 60, W, 'pending', ['no value yet'], 'warn'),
      box('h', C3, 60, W, 'handlers', ['then, catch, finally', 'are asynchronous'], 'ok'),
      box('t', C1, 170, 612, 'a throw inside the executor rejects the promise', ['a throw in a later callback (setTimeout) is NOT caught: call reject there'], 'warn'),
    ],
    arrows: [{ from: 'n', to: 'p', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'The executor runs at once and gets resolve and reject. Calling one of them settles the promise. Only the handlers are asynchronous.',
  },
  {
    h: 260,
    line: 'resolve(42); reject(err)',
    result: { text: 'first call wins, result is final', tone: 'ok' },
    cards: [
      box('p', C1, 70, W, 'pending', ['waiting'], 'warn'),
      box('f', C3, 36, W, 'fulfilled', ['value = 42', 'final'], 'ok'),
      box('r', C3, 110, W, 'rejected', ['reason = Error', 'final'], 'bad'),
      box('i', C1, 200, 612, 'a second resolve or reject call', ['is ignored: the first one wins'], 'none'),
    ],
    arrows: [
      { from: 'p', to: 'f', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'p', to: 'r', fs: 'r', ts: 'l', tone: 'bad' },
    ],
    note: 'A promise settles exactly once. A second resolve or reject is ignored. Handlers added later still receive the stored result.',
  },
  {
    h: 250,
    line: 'resolve(innerPromise)',
    result: { text: 'outer follows inner, no nesting', tone: 'ok' },
    cards: [
      box('o', C1, 70, W, 'outer promise', ['resolve(inner)', 'locked in'], 'new'),
      box('i', C2, 70, W, 'inner promise', ['pending, then 7'], 'warn'),
      box('v', C3, 70, W, 'outer settles', ['with 7, a plain', 'value'], 'ok'),
      box('x', C1, 180, 612, 'a promise never holds another promise as its value', ['any object with a then method is treated like a promise (a thenable)'], 'none'),
    ],
    arrows: [{ from: 'o', to: 'i', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'i', to: 'v', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'resolve(x) does not always fulfil with x. If x is a promise or thenable, the outer promise adopts its state. Resolving a promise with itself rejects with a TypeError.',
  },
];

/* ---------- chaining and errors ---------- */
const chainFrames = [
  {
    h: 250,
    line: 'fetchAccount().then(a => a.balance)',
    result: { text: 'then returns a NEW promise', tone: 'ok' },
    cards: [
      box('a', C1, 70, W, 'promise A', ['fetchAccount()'], 'none'),
      box('t', C2, 70, W, 'then(a => a.balance)', ['does not change A'], 'new'),
      box('b', C3, 70, W, 'promise B', ['value = balance'], 'ok'),
      box('n', C1, 180, 612, 'what the handler returns decides B', ['a value: fulfils | a promise: follows it | nothing: undefined | a throw: rejects'], 'none'),
    ],
    arrows: [{ from: 'a', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 'b', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'then never changes the promise it is called on. The handler\'s result becomes the value of the new promise, so a chain passes a value from step to step.',
  },
  {
    h: 250,
    line: '.then(u => { saveAudit(u); })',
    result: { text: 'missing return: the chain does not wait', tone: 'bad' },
    cards: [
      box('r', C1, 50, W2, 'return saveAudit(u)', ['the chain waits for it'], 'ok'),
      box('m', R2, 50, W2, 'saveAudit(u)  (no return)', ['next step runs at once', 'with undefined'], 'bad'),
      box('f', R2, 160, W2, 'floating work', ['its errors have nowhere', 'to go'], 'bad'),
    ],
    arrows: [{ from: 'm', to: 'f', fs: 'b', ts: 't', tone: 'bad' }],
    note: 'A handler that starts async work but does not return it breaks the chain. The next step runs too early, and a failure becomes an unhandled rejection. This is the most common promise bug.',
  },
  {
    h: 250,
    line: 'step 2 throws',
    result: { text: 'skips to the next catch', tone: 'warn' },
    cards: [
      box('t', C1, 70, W, 'step 2 throws', ['Error: timeout'], 'bad'),
      box('s', C2, 70, W, 'skipped thens', ['not run'], 'none'),
      box('c', C3, 70, W, 'catch(handler)', ['gets the reason'], 'new'),
      box('r', C1, 180, 612, 'returns normally: recovered, the chain is fulfilled again', ['throw again to keep failing'], 'ok'),
    ],
    arrows: [{ from: 't', to: 's', fs: 'r', ts: 'l', tone: 'none' }, { from: 's', to: 'c', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A thrown error, or a rejected promise, skips every then until the next catch. If the catch handler returns normally, the error is recovered.',
  },
  {
    h: 250,
    line: 'load().finally(() => spinner.hide())',
    result: { text: 'cleanup, result unchanged', tone: 'ok' },
    cards: [
      box('p', C1, 70, W, 'fulfilled', ['or rejected'], 'ok'),
      box('f', C2, 70, W, 'finally(cleanup)', ['no argument', 'cannot change the result'], 'new'),
      box('r', C3, 70, W, 'same result', ['value or error', 'passes on'], 'ok'),
      box('x', C1, 180, 612, 'if finally itself throws', ['that error replaces the result'], 'warn'),
    ],
    arrows: [{ from: 'p', to: 'f', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'f', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'finally runs on both outcomes. Use it for cleanup, such as hiding a spinner or releasing a lock.',
  },
];

/* ---------- execution order ---------- */
const orderFrames = [
  {
    h: 250,
    line: 'log 1; setTimeout(2); then(3); log 4',
    result: { text: 'output: 1 4 3 2', tone: 'ok' },
    cards: [
      box('s', 14, 80, 132, 'sync code', ['logs 1 and 4'], 'ok'),
      box('m', 174, 80, 132, 'microtasks', ['promise handler', 'logs 3'], 'new'),
      box('t', 334, 80, 132, 'task queue', ['setTimeout', 'logs 2'], 'warn'),
      box('n', 494, 80, 132, 'rule', ['handlers are never', 'synchronous'], 'none'),
    ],
    arrows: [{ from: 's', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 't', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A handler is queued as a microtask, even on an already settled promise. It runs after the current code, but before any timer.',
  },
  {
    h: 250,
    line: 'two chains started together',
    result: { text: 'A1, B1, A2, B2, A3', tone: 'ok' },
    cards: [
      box('a1', 14, 50, 132, 'A1', ['queued first'], 'ok'),
      box('a2', 174, 50, 132, 'A2', ['queued after A1'], 'new'),
      box('a3', 334, 50, 132, 'A3', ['queued after A2'], 'new'),
      box('b1', 14, 150, 132, 'B1', ['queued second'], 'ok'),
      box('b2', 174, 150, 132, 'B2', ['queued after B1'], 'new'),
    ],
    arrows: [
      { from: 'a1', to: 'a2', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'a2', to: 'a3', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'b1', to: 'b2', fs: 'r', ts: 'l', tone: 'ok' },
    ],
    note: 'Each then in a chain is queued only after the previous one finishes. So two chains take turns, one step each. The microtask queue is drained in order.',
  },
  {
    h: 250,
    line: 'return Promise.resolve(4)',
    result: { text: 'a returned promise costs extra ticks', tone: 'warn' },
    cards: [
      box('p', C1, 60, W, 'return a plain value', ['settles at once'], 'ok'),
      box('q', C2, 60, W, 'return a promise', ['two extra ticks to', 'adopt it'], 'warn'),
      box('o', C3, 60, W, 'other chain', ['finishes first:', '4 prints after 3'], 'bad'),
      box('x', C1, 180, 612, 'never rely on this order', ['but know it, because interview puzzles test it'], 'none'),
    ],
    arrows: [{ from: 'q', to: 'o', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'The engine must call then on the returned promise to adopt its state. That takes extra microtask turns, so this chain falls behind one that returns a plain value.',
  },
];

/* ---------- useful patterns ---------- */
const patternFrames = [
  {
    h: 250,
    line: 'promisify(fs.readFile)',
    result: { text: 'wrap once, use everywhere', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'callback API', ['fs.readFile(path, cb)'], 'none'),
      box('w', C2, 70, W, 'promise wrapper', ['resolve on success,', 'reject on error'], 'new'),
      box('u', C3, 70, W, 'await readFile(path)', ['clean call site'], 'ok'),
      box('n', C1, 180, 612, 'Node.js already has these', ['util.promisify, node:fs/promises, events.once'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'w', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'w', to: 'u', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Wrap a callback API once with new Promise. Keep the wrapper tiny, and use the promise everywhere else.',
  },
  {
    h: 250,
    line: 'Promise.race([work, timer])',
    result: { text: 'first to settle wins', tone: 'warn' },
    cards: [
      box('w', C1, 60, W, 'the request', ['may be slow'], 'ok'),
      box('t', C1, 160, W, 'timer', ['rejects after 3 s'], 'warn'),
      box('r', C2, 110, W, 'Promise.race', ['first one wins'], 'new'),
      box('n', C3, 110, W, 'afterwards', ['clearTimeout, and', 'abort the loser'], 'warn'),
    ],
    arrows: [
      { from: 'w', to: 'r', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 't', to: 'r', fs: 'r', ts: 'l', tone: 'warn' },
      { from: 'r', to: 'n', fs: 'r', ts: 'l', tone: 'warn' },
    ],
    note: 'A timeout is a race between the work and a timer. Clear the timer when the work wins. Racing does not cancel the loser, so also abort it with a signal.',
  },
  {
    h: 250,
    line: 'getRates("SGD") x 10 at once',
    result: { text: 'one request goes out', tone: 'ok' },
    cards: [
      box('a', C1, 50, W, 'caller 1', ['getRates()'], 'none'),
      box('b', C1, 150, W, 'caller 2', ['getRates()'], 'none'),
      box('m', C2, 100, W, 'promise cache', ['one in-flight', 'promise per key'], 'new'),
      box('r', C3, 100, W, 'one request', ['all callers get', 'the same promise'], 'ok'),
    ],
    arrows: [
      { from: 'a', to: 'm', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'b', to: 'm', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'm', to: 'r', fs: 'r', ts: 'l', tone: 'ok' },
    ],
    note: 'Cache the promise, not the value. Remove the entry on failure so a retry can happen, and after a short time on success.',
  },
];

export const PROMISE_SCENES = [
  { id: 'states', label: 'States and settling', title: 'Pending, then settled once', stage: BoardStage, frames: stateFrames },
  { id: 'chain', label: 'Chaining and errors', title: 'Every then returns a new promise', stage: BoardStage, frames: chainFrames },
  { id: 'order', label: 'Execution order', title: 'Microtasks decide the output order', stage: BoardStage, frames: orderFrames },
  { id: 'patterns', label: 'Useful patterns', title: 'Wrap, race and share', stage: BoardStage, frames: patternFrames },
];
