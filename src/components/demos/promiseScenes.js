// Frame data for the "Promises in depth" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const PROMISE_SCENES = [
  {
    id: 'states',
    label: 'States and settling',
    title: 'Pending, then settled once',
    frames: [
      {
        note: 'A promise starts pending. The executor function you pass to new Promise runs at once and synchronously, and it gets resolve and reject functions. Calling one of them settles the promise.',
        boxes: [b('n', 'new Promise(executor)', ['executor runs now'], 'new'), b('p', 'Pending', ['no value yet'], 'warn')],
        deps: [d('new Promise(executor)', 'Pending', 'creates', 'warn')],
      },
      {
        note: 'It settles exactly once: fulfilled with a value, or rejected with a reason. After that it never changes. A second call to resolve or reject is ignored, so the first one wins. Handlers added later still get the stored result.',
        boxes: [b('p', 'Pending', ['waiting'], 'warn'), b('f', 'Fulfilled', ['value = 42, final'], 'ok'), b('r', 'Rejected', ['reason = Error, final'], 'bad')],
        deps: [d('Pending', 'Fulfilled', 'resolve(42)', 'ok'), d('Pending', 'Rejected', 'reject(err)', 'bad')],
      },
      {
        note: 'Resolving with another promise does not fulfil with that promise as a value. The outer promise becomes locked in and follows the inner one: it settles however the inner one settles. A thrown error in the executor rejects the promise.',
        boxes: [b('o', 'Outer promise', ['resolve(inner)'], 'new'), b('i', 'Inner promise', ['pending, then 7'], 'warn'), b('v', 'Outer settles with 7', ['follows the inner'], 'ok')],
        deps: [d('Outer promise', 'Inner promise', 'locked in to', 'warn'), d('Inner promise', 'Outer settles with 7', 'then', 'ok')],
      },
    ],
  },
  {
    id: 'chain',
    label: 'Chaining and errors',
    title: 'Every then returns a new promise',
    frames: [
      {
        note: 'then does not change the promise it is called on. It returns a new promise. Whatever the handler returns becomes the value of that new promise, so a chain passes a value from step to step.',
        boxes: [b('a', 'fetchAccount()', ['promise A'], 'none'), b('t', 'then(a => a.balance)', ['returns promise B'], 'new'), b('v', 'Promise B', ['value = balance'], 'ok')],
        deps: [d('fetchAccount()', 'then(a => a.balance)', 'then', 'ok'), d('then(a => a.balance)', 'Promise B', 'new promise', 'ok')],
      },
      {
        note: 'If a handler returns a promise, the chain waits for it, which flattens nesting. If a handler forgets to return it, the next step runs at once with undefined and the work continues unobserved. A missing return is the most common promise bug.',
        boxes: [b('r', 'Return the promise', ['chain waits'], 'ok'), b('m', 'Missing return', ['next step gets undefined'], 'bad'), b('f', 'Floating work', ['errors are lost'], 'bad')],
        deps: [d('Missing return', 'Floating work', 'causes', 'bad')],
      },
      {
        note: 'A thrown error, or a rejected promise, skips every then until the next catch. The catch handler gets the reason. If it returns normally, the chain is fulfilled again, so the error is recovered. Re-throw to keep failing.',
        boxes: [b('t', 'Step throws', ['Error: timeout'], 'bad'), b('s', 'Skipped thens', ['not run'], 'none'), b('c', 'catch(handler)', ['recovers or re-throws'], 'new')],
        deps: [d('Step throws', 'Skipped thens', 'skips', 'none'), d('Step throws', 'catch(handler)', 'jumps to', 'warn')],
      },
      {
        note: 'finally runs on both outcomes and receives no argument. It does not change the result: the value or the error passes through. Use it for cleanup such as hiding a spinner or releasing a lock. If finally itself throws, that error replaces the result.',
        boxes: [b('p', 'Fulfilled or rejected', ['either outcome'], 'ok'), b('f', 'finally(cleanup)', ['no argument, no change'], 'new'), b('r', 'Same result continues', ['value or error passes on'], 'ok')],
        deps: [d('Fulfilled or rejected', 'finally(cleanup)', 'then', 'ok'), d('finally(cleanup)', 'Same result continues', 'passes through', 'ok')],
      },
    ],
  },
  {
    id: 'order',
    label: 'Execution order',
    title: 'Microtasks decide the output order',
    frames: [
      {
        note: 'Handlers never run synchronously, even for an already settled promise. A handler is queued as a microtask and runs after the current synchronous code finishes, but before any timer. So log 1, then 4, then the promise handler 3, then the timer 2.',
        boxes: [b('s', 'Synchronous code', ['logs 1 and 4'], 'ok'), b('m', 'Microtask queue', ['promise handler logs 3'], 'new'), b('t', 'Task queue', ['setTimeout logs 2'], 'warn')],
        deps: [d('Synchronous code', 'Microtask queue', 'then', 'ok'), d('Microtask queue', 'Task queue', 'then', 'warn')],
      },
      {
        note: 'Two chains run in lockstep. Each then in a chain is queued only after the previous one finishes, so the two chains alternate: A1, B1, A2, B2. The microtask queue is drained completely, in order, before the loop moves on.',
        boxes: [b('a', 'Chain A step 1', ['queued first'], 'ok'), b('b', 'Chain B step 1', ['queued second'], 'ok'), b('c', 'Chain A step 2', ['queued after A1 ends'], 'new')],
        deps: [d('Chain A step 1', 'Chain B step 1', 'then', 'ok'), d('Chain B step 1', 'Chain A step 2', 'then', 'ok')],
      },
      {
        note: 'Returning a promise from a then handler costs extra microtask ticks, because the engine must call then on it to adopt its state. So a chain that returns a promise falls behind a chain that returns a plain value. Never rely on this, but know why puzzles show it.',
        boxes: [b('p', 'Return a plain value', ['settles at once'], 'ok'), b('q', 'Return a promise', ['two extra ticks'], 'warn'), b('o', 'Other chain finishes first', ['output order changes'], 'bad')],
        deps: [d('Return a promise', 'Other chain finishes first', 'is slower', 'bad')],
      },
    ],
  },
  {
    id: 'patterns',
    label: 'Useful patterns',
    title: 'Wrap, race and share',
    frames: [
      {
        note: 'Wrap a callback API once with new Promise, then use it everywhere. Resolve in the success path, reject in the error path, and keep the wrapper tiny. In Node.js, util.promisify does this for error-first callbacks.',
        boxes: [b('c', 'Callback API', ['fs.readFile(path, cb)'], 'none'), b('w', 'Promise wrapper', ['resolve or reject'], 'new'), b('u', 'await readFile(path)', ['clean call site'], 'ok')],
        deps: [d('Callback API', 'Promise wrapper', 'wrapped by', 'ok'), d('Promise wrapper', 'await readFile(path)', 'used with', 'ok')],
      },
      {
        note: 'A timeout is a race between the work and a timer. Promise.race settles with whichever finishes first. Clear the timer when the work wins, or the pending timer keeps the process alive. Racing does not cancel the loser, so also abort it with a signal.',
        boxes: [b('w', 'The request', ['may be slow'], 'ok'), b('t', 'Timer rejects after 3 s', ['clear if work wins'], 'warn'), b('r', 'Promise.race', ['first one wins'], 'new')],
        deps: [d('The request', 'Promise.race', 'competes', 'ok'), d('Timer rejects after 3 s', 'Promise.race', 'competes', 'warn')],
      },
      {
        note: 'Cache the promise, not the value. If ten components ask for the same data at once, the first call stores its in-flight promise and the other nine receive that same promise. One request goes out. Remove the entry on failure so a retry can happen.',
        boxes: [b('a', 'Caller 1', ['getRates()'], 'none'), b('b', 'Caller 2', ['getRates()'], 'none'), b('m', 'Promise cache', ['one shared request'], 'new')],
        deps: [d('Caller 1', 'Promise cache', 'first, starts it', 'ok'), d('Caller 2', 'Promise cache', 'gets the same promise', 'ok')],
      },
    ],
  },
];
