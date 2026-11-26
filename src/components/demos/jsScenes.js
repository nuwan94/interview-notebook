// Frame data for the "JavaScript essentials" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- scope and closures ---------- */
const closureFrames = [
  {
    h: 260,
    line: 'count++ inside increment',
    result: { text: 'looked up the scope chain', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 620, h: 220, title: 'global scope: bankName', tone: 'none' }],
    cards: [
      box('m', 24, 76, 380, 'makeCounter scope', ['let count = 0'], 'ok'),
      box('i', 60, 160, 300, 'increment', ['count++', 'no count here'], 'new'),
      box('x', 446, 100, W, 'lookup order', ['1 own scope', '2 makeCounter', '3 global'], 'none'),
    ],
    arrows: [{ from: 'i', to: 'm', fs: 't', ts: 'b', tone: 'ok' }],
    note: 'Scope is lexical: it depends on where the code is written. increment has no count, so the engine looks in the scope around it, then the next one out, up to the global scope. That is the scope chain.',
  },
  {
    h: 250,
    line: 'const next = makeCounter()',
    result: { text: 'count survives the return', tone: 'ok' },
    cards: [
      box('c', C1, 60, W, 'makeCounter call', ['returned', 'and is finished'], 'none'),
      box('i', C2, 60, W, 'increment', ['carries its scope'], 'new'),
      box('m', C3, 60, W, 'scope', ['count = 0', 'kept alive'], 'ok'),
      box('t', C1, 170, 612, 'closure = a function plus the scope it was created in', ['the engine keeps those variables while the function is reachable'], 'new'),
    ],
    arrows: [{ from: 'c', to: 'i', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'makeCounter returns increment and ends. Normally its variables would be gone. But increment still uses that scope, so the engine keeps it. A function together with its scope is a closure.',
  },
  {
    h: 250,
    line: 'counterA(); counterA(); counterB()',
    result: { text: 'each counter has its own count', tone: 'ok' },
    cards: [
      box('a', C1, 50, W2, 'counterA', ['called twice'], 'ok'),
      box('b', R2, 50, W2, 'counterB', ['called once'], 'ok'),
      box('x', C1, 150, W2, 'scope A', ['count = 2'], 'ok'),
      box('y', R2, 150, W2, 'scope B', ['count = 1'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 'x', fs: 'b', ts: 't', tone: 'ok' }, { from: 'b', to: 'y', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'Every call to makeCounter creates a new scope. Nothing outside can reach count except through the returned function. That is how JavaScript keeps private state.',
  },
  {
    h: 260,
    line: 'for (var i...) vs for (let i...)',
    result: { text: 'var shares one i; let makes one per round', tone: 'warn' },
    cards: [
      box('v', C1, 50, W2, 'var i', ['one variable for the', 'whole function'], 'bad'),
      box('l', R2, 50, W2, 'let i', ['a new binding for', 'every iteration'], 'ok'),
      box('cv', C1, 160, W2, 'callbacks run later', ['print 3, 3, 3'], 'bad'),
      box('cl', R2, 160, W2, 'callbacks run later', ['print 0, 1, 2'], 'ok'),
    ],
    arrows: [{ from: 'v', to: 'cv', fs: 'b', ts: 't', tone: 'bad' }, { from: 'l', to: 'cl', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'The classic trap. By the time the callbacks run, the loop has ended with i equal to 3. With var they all read the same i. With let, each one closes over its own copy.',
  },
];

/* ---------- this ---------- */
const thisFrames = [
  {
    h: 240,
    line: 'account.deposit(50)',
    result: { text: 'this = the object before the dot', tone: 'ok' },
    cards: [
      box('s', C1, 60, W, 'call site', ['account.deposit(50)'], 'none'),
      box('t', C2, 60, W, 'this', ['set by the call'], 'new'),
      box('o', C3, 60, W, 'account', ['balance: 100'], 'ok'),
    ],
    arrows: [{ from: 's', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 'o', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'this is not fixed where a function is written. It is set when the function is called. In account.deposit(50), the object before the dot becomes this.',
  },
  {
    h: 240,
    line: 'const f = account.deposit; f(50)',
    result: { text: 'TypeError: this is undefined', tone: 'bad' },
    cards: [
      box('f', C1, 60, W, 'detached call', ['f(50)', 'nothing before the dot'], 'warn'),
      box('t', C2, 60, W, 'this', ['undefined', '(strict mode)'], 'bad'),
      box('e', C3, 60, W, 'this.balance', ['TypeError'], 'bad'),
    ],
    arrows: [{ from: 'f', to: 't', fs: 'r', ts: 'l', tone: 'bad' }, { from: 't', to: 'e', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Take the method out and call it alone, or pass it as a callback, and there is no object before the dot. this is undefined in strict mode, or the global object otherwise.',
  },
  {
    h: 260,
    line: 'who sets this?',
    result: { text: 'you can set it yourself', tone: 'ok' },
    cards: [
      box('c', C1, 50, W2, 'call / apply', ['run now with the this you give'], 'ok'),
      box('b', R2, 50, W2, 'bind', ['returns a copy with this fixed'], 'ok'),
      box('n', C1, 150, W2, 'new', ['creates an object, this = it'], 'ok'),
      box('m', R2, 150, W2, 'obj.method()', ['this = obj'], 'new'),
    ],
    note: 'Priority from the top: new, then call, apply and bind, then a method call, then a plain call. An arrow function sits outside this list, because it has no this of its own.',
  },
  {
    h: 250,
    line: 'items.forEach(() => this.total += 1)',
    result: { text: 'arrow uses the method\'s this', tone: 'ok' },
    cards: [
      box('m', C1, 50, 612, 'method: this = account', ['called as account.addAll()'], 'ok'),
      box('a', C1, 150, W2, 'arrow callback', ['no own this', 'uses the one outside'], 'new'),
      box('p', R2, 150, W2, 'plain function callback', ['gets its own this', 'undefined: broken'], 'bad'),
    ],
    arrows: [{ from: 'm', to: 'a', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'An arrow function uses the this of the place where it was written, and nothing can change that. So arrows suit callbacks inside methods, and do not suit object methods.',
  },
];

/* ---------- prototypes ---------- */
const protoFrames = [
  {
    h: 240,
    line: 'the prototype chain',
    result: { text: 'ends at null', tone: 'ok' },
    cards: [
      box('a', C1, 60, W, 'account', ['own: balance'], 'ok'),
      box('p', C2, 60, W, 'Account.prototype', ['deposit', 'withdraw'], 'ok'),
      box('o', C3, 60, W, 'Object.prototype', ['toString'], 'none'),
      box('n', C3, 160, W, 'null', ['end of the chain'], 'none'),
    ],
    arrows: [
      { from: 'a', to: 'p', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'p', to: 'o', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'o', to: 'n', fs: 'b', ts: 't', tone: 'none' },
    ],
    note: 'Every object has a hidden link to another object, its prototype. A property read looks on the object, then its prototype, then that one\'s prototype, until null.',
  },
  {
    h: 250,
    line: 'account.deposit(50)',
    result: { text: 'found on the prototype', tone: 'ok' },
    cards: [
      box('l', C1, 60, W, 'look up deposit', ['start here'], 'warn'),
      box('a', C2, 60, W, 'account', ['no deposit', 'on this object'], 'none'),
      box('p', C3, 60, W, 'Account.prototype', ['deposit found'], 'ok'),
      box('w', C1, 170, 612, 'writing is different', ['account.x = 1 always writes on the object itself, and shadows an inherited x'], 'warn'),
    ],
    arrows: [{ from: 'l', to: 'a', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'a', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'deposit is not an own property, so the lookup walks up and finds it on Account.prototype. All accounts share that one function.',
  },
  {
    h: 250,
    line: 'class Account { deposit() {} }',
    result: { text: 'class is syntax over prototypes', tone: 'ok' },
    cards: [
      box('c', C1, 60, W, 'class Account', ['constructor', 'methods'], 'new'),
      box('p', C2, 60, W, 'Account.prototype', ['methods are put here'], 'ok'),
      box('n', C3, 60, W, 'new Account()', ['its prototype link', 'points to Account.prototype'], 'ok'),
    ],
    arrows: [{ from: 'c', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'n', to: 'p', fs: 'b', ts: 'b', tone: 'ok' }],
    note: 'The methods in a class body are put on Class.prototype. new Class() makes an object whose prototype link points there. A class is still a function.',
  },
  {
    h: 250,
    line: 'class Savings extends Account',
    result: { text: 'two prototypes linked', tone: 'ok' },
    cards: [
      box('s', C1, 60, W, 'Savings.prototype', ['addInterest'], 'ok'),
      box('a', C2, 60, W, 'Account.prototype', ['deposit'], 'ok'),
      box('i', C3, 60, W, 'instanceof', ['walks the same chain', 'yes or no'], 'new'),
      box('u', C1, 170, 612, 'super.deposit(...)', ['calls up the chain; a savings object finds its own methods first'], 'new'),
    ],
    arrows: [{ from: 's', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i', to: 'a', fs: 'l', ts: 'r', tone: 'new' }],
    note: 'extends links two prototypes. A savings object finds its own methods first, then the inherited ones. instanceof walks the same chain.',
  },
];

/* ---------- values and references ---------- */
const valueFrames = [
  {
    h: 240,
    line: 'let b = a; b = 6',
    result: { text: 'primitives are copied', tone: 'ok' },
    cards: [
      box('a', C1, 60, W2, 'a', ['5'], 'ok'),
      box('b', R2, 60, W2, 'b', ['copy of 5, then 6'], 'ok'),
      box('n', C1, 160, 612, 'also immutable', ['a string method returns a new string; it never changes the old one'], 'none'),
    ],
    arrows: [{ from: 'a', to: 'b', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Numbers, strings, booleans, null, undefined, symbols and bigints are copied by value. Changing b leaves a alone.',
  },
  {
    h: 250,
    line: 'let b = a   (objects)',
    result: { text: 'both point to one object', tone: 'warn' },
    cards: [
      box('a', C1, 50, W, 'a', ['reference'], 'new'),
      box('b', C1, 150, W, 'b', ['same reference'], 'new'),
      box('o', 300, 100, 300, 'account object', ['one object', 'balance: 100'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 'o', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'b', to: 'o', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Objects, arrays and functions are held by reference. let b = a copies the reference, not the object. A change through either name shows through both. === compares references.',
  },
  {
    h: 260,
    line: 'const copy = { ...original }',
    result: { text: 'shallow: nested object shared', tone: 'bad' },
    cards: [
      box('o', C1, 50, W2, 'original', ['name', 'address'], 'ok'),
      box('c', R2, 50, W2, 'shallow copy', ['new top-level object'], 'warn'),
      box('n', 175, 160, 290, 'address object', ['shared by both', 'copy.address.city = "x"', 'changes the original too'], 'bad'),
    ],
    arrows: [{ from: 'o', to: 'n', fs: 'b', ts: 't', tone: 'bad' }, { from: 'c', to: 'n', fs: 'b', ts: 't', tone: 'bad' }],
    note: 'Spread and Object.assign copy only the top level. Nested objects are still shared. This is a common source of bugs in React state updates.',
  },
  {
    h: 250,
    line: 'structuredClone(original)',
    result: { text: 'deep copy: nothing shared', tone: 'ok' },
    cards: [
      box('o', C1, 60, W, 'original', ['address inside'], 'ok'),
      box('s', C2, 60, W, 'structuredClone', ['dates, maps, sets,', 'cycles'], 'new'),
      box('c', C3, 60, W, 'deep copy', ['its own address'], 'ok'),
      box('x', C1, 170, 612, 'limits', ['cannot copy functions or class methods', 'JSON.parse(JSON.stringify(x)) drops undefined, functions, dates'], 'warn'),
    ],
    arrows: [{ from: 'o', to: 's', fs: 'r', ts: 'l', tone: 'ok' }, { from: 's', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'structuredClone makes a full copy, so nothing is shared. It handles dates, maps, sets and circular references, but not functions.',
  },
];

export const JS_SCENES = [
  { id: 'closure', label: 'Scope and closures', title: 'A function remembers where it was made', stage: BoardStage, frames: closureFrames },
  { id: 'this', label: 'The value of this', title: 'this depends on how a function is called', stage: BoardStage, frames: thisFrames },
  { id: 'prototype', label: 'Prototypes', title: 'Objects inherit from other objects', stage: BoardStage, frames: protoFrames },
  { id: 'values', label: 'Values and references', title: 'Copy, share and clone', stage: BoardStage, frames: valueFrames },
];
