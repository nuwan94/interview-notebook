// Frame data for the "TypeScript" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- types stop at build time ---------- */
const compileFrames = [
  {
    h: 250,
    line: 'payments.ts → payments.js',
    result: { text: 'types are erased', tone: 'ok' },
    cards: [
      box('s', 14, 60, 132, 'payments.ts', ['code with types'], 'new'),
      box('t', 174, 60, 132, 'type checker', ['finds mistakes', 'before running'], 'ok'),
      box('j', 334, 60, 132, 'payments.js', ['types erased'], 'ok'),
      box('r', 494, 60, 132, 'runtime', ['Node.js or browser,', 'no types'], 'none'),
      box('n', 14, 170, 612, 'valid JavaScript is valid TypeScript', ['so you can adopt it one file at a time'], 'none'),
    ],
    arrows: [
      { from: 's', to: 't', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 't', to: 'j', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'j', to: 'r', fs: 'r', ts: 'l', tone: 'ok' },
    ],
    note: 'The compiler checks the types and then removes them. What remains is plain JavaScript. The browser or Node.js never sees a type.',
  },
  {
    h: 250,
    line: 'pay("100")   // amount: number',
    result: { text: 'found in the editor and the build', tone: 'ok' },
    cards: [
      box('w', C1, 70, W, 'wrong call', ['pay("100")'], 'bad'),
      box('t', C2, 70, W, 'type checker', ['string is not', 'a number'], 'warn'),
      box('c', C3, 70, W, 'CI build', ['fails, nothing ships'], 'ok'),
    ],
    arrows: [{ from: 'w', to: 't', fs: 'r', ts: 'l', tone: 'bad' }, { from: 't', to: 'c', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A type error is found in the editor and in the build, not in production.',
  },
  {
    h: 250,
    line: 'const p = (await res.json()) as Payment',
    result: { text: 'a promise, not a check', tone: 'bad' },
    cards: [
      box('a', C1, 70, W, 'API response', ['JSON from the network'], 'warn'),
      box('s', C2, 70, W, 'as Payment', ['not checked at', 'run time'], 'bad'),
      box('e', C3, 70, W, 'runtime error', ['crashes later,', 'far from the cause'], 'bad'),
    ],
    arrows: [{ from: 'a', to: 's', fs: 'r', ts: 'l', tone: 'bad' }, { from: 's', to: 'e', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Types do not exist at run time, so they cannot check data that arrives from outside. A type assertion is only a promise to the compiler.',
  },
  {
    h: 250,
    line: 'Payment.parse(await res.json())',
    result: { text: 'validate at the boundary', tone: 'ok' },
    cards: [
      box('a', C1, 70, W, 'API response', ['unknown data'], 'warn'),
      box('v', C2, 70, W, 'zod schema', ['or a type guard', 'checks the real value'], 'new'),
      box('t', C3, 70, W, 'typed Payment', ['safe inside the app'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 'v', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'v', to: 't', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Check data where it enters. A validator tests the real value and tells the compiler its type. Inside the application, the typed data can then be trusted.',
  },
];

/* ---------- shapes and narrowing ---------- */
const shapeFrames = [
  {
    h: 250,
    line: 'pay({ id, amount, note })',
    result: { text: 'accepted: it has the required shape', tone: 'ok' },
    cards: [
      box('o', C1, 70, W, 'object', ['id, amount, note'], 'ok'),
      box('p', C2, 70, W, 'Payment', ['id, amount'], 'new'),
      box('a', C3, 70, W, 'assignable', ['everything required', 'is there'], 'ok'),
      box('n', C1, 180, 612, 'structural typing: the shape decides, not the name or the class', ['a fresh object literal also gets an excess-property check, which catches typos'], 'none'),
    ],
    arrows: [{ from: 'o', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'p', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A value fits a type if it has the required members. The extra note field does no harm. This differs from Java, where a class must declare that it implements an interface.',
  },
  {
    h: 260,
    line: "type Result = Success | Failure",
    result: { text: 'status tells them apart', tone: 'ok' },
    cards: [
      box('u', C2, 40, W, 'Result', ['Success | Failure'], 'new'),
      box('s', C1, 150, W2, 'Success', ['status: "ok"', 'value'], 'ok'),
      box('f', R2, 150, W2, 'Failure', ['status: "error"', 'message'], 'bad'),
    ],
    arrows: [{ from: 'u', to: 's', fs: 'b', ts: 't', tone: 'ok' }, { from: 'u', to: 'f', fs: 'b', ts: 't', tone: 'bad' }],
    note: 'A union says a value is one of several types. A literal status field on each one makes it a discriminated union, and the status tells the compiler which one it is.',
  },
  {
    h: 250,
    line: 'if (result.status === "ok")',
    result: { text: 'the type narrows inside each branch', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'check status', ['=== "ok"'], 'new'),
      box('n', C2, 40, W, 'true branch', ['result is Success', 'result.value is allowed'], 'ok'),
      box('e', C2, 150, W, 'else branch', ['result is Failure', 'result.message'], 'warn'),
    ],
    arrows: [{ from: 'c', to: 'n', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'c', to: 'e', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Narrowing refines the type inside a branch. typeof, instanceof, in and your own type guards narrow in the same way.',
  },
  {
    h: 250,
    line: 'default: const _x: never = result',
    result: { text: 'a forgotten case fails the build', tone: 'bad' },
    cards: [
      box('s', C1, 70, W, 'switch on status', ['"ok", "error"'], 'ok'),
      box('v', C2, 70, W, 'new variant', ['"refund" is added,', 'no case written'], 'warn'),
      box('n', C3, 70, W, 'never check', ['compile error', 'at the default line'], 'bad'),
    ],
    arrows: [{ from: 's', to: 'v', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'v', to: 'n', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'In the default branch, assign the value to a never variable. If every case is handled, it compiles. A new variant that nobody handled is no longer never, so the build fails.',
  },
];

/* ---------- generics and utility types ---------- */
const genericFrames = [
  {
    h: 250,
    line: 'first<T>(items: T[]): T',
    result: { text: 'T is inferred from the argument', tone: 'ok' },
    cards: [
      box('a', C1, 70, W, 'argument', ['Account[]'], 'none'),
      box('t', C2, 70, W, 'type parameter T', ['inferred: Account'], 'new'),
      box('r', C3, 70, W, 'result', ['Account'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A generic function works for many types and keeps the link between them: a string array gives a string, an Account array gives an Account.',
  },
  {
    h: 250,
    line: 'byId<T extends HasId>(items: T[])',
    result: { text: 'the constraint limits T', tone: 'ok' },
    cards: [
      box('c', C2, 40, W, 'constraint', ['T extends HasId'], 'new'),
      box('a', C1, 150, W2, 'Account', ['has an id: accepted'], 'ok'),
      box('l', R2, 150, W2, 'Label', ['no id: rejected at the call'], 'bad'),
    ],
    arrows: [{ from: 'a', to: 'c', fs: 't', ts: 'b', tone: 'ok' }, { from: 'l', to: 'c', fs: 't', ts: 'b', tone: 'bad' }],
    note: 'T extends HasId accepts any type that has an id. Then the function body can use item.id safely.',
  },
  {
    h: 290,
    line: 'one Account type, four new types',
    result: { text: 'no copy and paste', tone: 'ok' },
    cards: [
      box('a', C2, 40, W, 'Account', ['id, owner, balance'], 'ok'),
      box('p', C1, 150, W2, 'Partial<Account>', ['all optional, for updates'], 'new'),
      box('k', R2, 150, W2, 'Pick<Account, "id">', ['only the id'], 'new'),
      box('o', C1, 220, W2, 'Omit<Account, "balance">', ['a public view'], 'new'),
      box('r', R2, 220, W2, 'Readonly<Account>', ['no changes allowed'], 'new'),
    ],
    arrows: [{ from: 'a', to: 'p', fs: 'b', ts: 't', tone: 'ok' }, { from: 'a', to: 'k', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'Utility types build new types from existing ones. When the Account type changes, the derived types change with it.',
  },
];

/* ---------- strict null checks ---------- */
const strictFrames = [
  {
    h: 250,
    line: 'const account = findAccount(id)',
    result: { text: 'account.balance is a compile error', tone: 'bad' },
    cards: [
      box('f', C1, 70, W, 'findAccount(id)', ['Account | undefined'], 'new'),
      box('u', C2, 70, W, 'account.balance', ['direct use'], 'bad'),
      box('e', C3, 70, W, 'compile error', ['possibly undefined'], 'bad'),
    ],
    arrows: [{ from: 'f', to: 'u', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'u', to: 'e', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'With strict on, null and undefined are not part of every type. A value that may be missing must say so, and be handled before use.',
  },
  {
    h: 250,
    line: 'if (!account) return',
    result: { text: 'below the guard it is an Account', tone: 'ok' },
    cards: [
      box('f', C1, 70, W, 'findAccount(id)', ['Account | undefined'], 'new'),
      box('c', C2, 70, W, 'guard', ['if (!account) return'], 'ok'),
      box('n', C3, 70, W, 'narrowed', ['Account from here on'], 'ok'),
      box('s', C1, 180, 612, 'short forms', ['account?.balance | account?.balance ?? 0 | avoid the ! assertion'], 'none'),
    ],
    arrows: [{ from: 'f', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'c', to: 'n', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Handle the missing case and the type narrows. Optional chaining and ?? are the short forms.',
  },
];

export const TS_SCENES = [
  { id: 'compile', label: 'Types stop at build time', title: 'From TypeScript to JavaScript', stage: BoardStage, frames: compileFrames },
  { id: 'shapes', label: 'Shapes and narrowing', title: 'Types match by structure', stage: BoardStage, frames: shapeFrames },
  { id: 'generics', label: 'Generics and utility types', title: 'Types that take types', stage: BoardStage, frames: genericFrames },
  { id: 'strict', label: 'Strict null checks', title: 'The billion dollar mistake, at compile time', stage: BoardStage, frames: strictFrames },
];
