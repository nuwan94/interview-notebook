// Frame data for the "TypeScript" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const TS_SCENES = [
  {
    id: 'compile',
    label: 'Types stop at build time',
    title: 'From TypeScript to JavaScript',
    frames: [
      {
        note: 'TypeScript is JavaScript with a type system on top. The compiler checks the types and then removes them, and what remains is plain JavaScript. The browser or Node.js runs that JavaScript and never sees a type.',
        boxes: [b('s', 'payments.ts', ['code with types'], 'new'), b('t', 'Type checker', ['finds mistakes before running'], 'ok'), b('j', 'payments.js', ['types erased'], 'ok'), b('r', 'Runtime', ['Node.js or browser, no types'], 'none')],
        deps: [d('payments.ts', 'Type checker', 'compile', 'ok'), d('Type checker', 'payments.js', 'emits', 'ok'), d('payments.js', 'Runtime', 'runs', 'ok')],
      },
      {
        note: 'A type error is found in the editor and in the build, not in production. The call pay("100") passes a string where a number is declared, so the checker reports it and the continuous integration build fails before the code ships.',
        boxes: [b('w', 'Wrong call', ['pay("100")'], 'bad'), b('t', 'Type checker', ['string is not a number'], 'warn'), b('c', 'CI build', ['fails, nothing ships'], 'ok')],
        deps: [d('Wrong call', 'Type checker', 'checked', 'bad'), d('Type checker', 'CI build', 'reports the error', 'warn')],
      },
      {
        note: 'But types do not exist at run time, so they cannot check data that arrives from outside. Saying the response is a Payment with an assertion is a promise, not a check. If the server sends something else, the program fails later, far from the cause.',
        boxes: [b('a', 'API response', ['JSON from the network'], 'warn'), b('s', 'Type assertion', ['as Payment, not checked'], 'bad'), b('e', 'Runtime error', ['crashes later'], 'bad')],
        deps: [d('API response', 'Type assertion', 'trusted blindly', 'bad'), d('Type assertion', 'Runtime error', 'wrong shape fails', 'bad')],
      },
      {
        note: 'Check data at the boundary. A runtime validator such as zod, or a type guard you write, tests the real value and tells the compiler its type. Inside the application the typed data can then be trusted.',
        boxes: [b('a', 'API response', ['unknown data'], 'warn'), b('v', 'Runtime validator', ['zod or a type guard'], 'new'), b('t', 'Typed data', ['safe inside the app'], 'ok')],
        deps: [d('API response', 'Runtime validator', 'checked', 'ok'), d('Runtime validator', 'Typed data', 'returns a Payment', 'ok')],
      },
    ],
  },
  {
    id: 'shapes',
    label: 'Shapes and narrowing',
    title: 'Types match by structure',
    frames: [
      {
        note: 'TypeScript uses structural typing: a value fits a type if it has the required members, whatever its name or class. An object with id, amount and an extra note is accepted where a Payment with id and amount is needed.',
        boxes: [b('p', 'Payment type', ['id, amount'], 'new'), b('o', 'Object literal', ['id, amount, note'], 'ok'), b('a', 'Assignable', ['has everything required'], 'ok')],
        deps: [d('Object literal', 'Payment type', 'compared by shape', 'ok'), d('Payment type', 'Assignable', 'accepted', 'ok')],
      },
      {
        note: 'A union type says a value is one of several types. A Result is either a Success or a Failure. Giving each a literal status field makes it a discriminated union, and the status tells the compiler which one it is.',
        boxes: [b('u', 'Union type', ['Success | Failure'], 'new'), b('d', 'Discriminant', ['status: "ok" or "error"'], 'ok'), b('s', 'Success', ['status "ok", value'], 'ok'), b('f', 'Failure', ['status "error", message'], 'bad')],
        deps: [d('Union type', 'Success', 'either', 'ok'), d('Union type', 'Failure', 'or', 'bad'), d('Discriminant', 'Union type', 'tells them apart', 'ok')],
      },
      {
        note: 'Narrowing: after if (result.status === "ok") the compiler knows result is a Success inside the block, so result.value is allowed, and in the else branch it is a Failure. typeof, instanceof, in and your own type guards narrow in the same way.',
        boxes: [b('c', 'Check status', ['if status is "ok"'], 'new'), b('n', 'Narrowed type', ['Success inside the block'], 'ok'), b('e', 'Else branch', ['Failure here'], 'warn')],
        deps: [d('Check status', 'Narrowed type', 'true branch', 'ok'), d('Check status', 'Else branch', 'false branch', 'warn')],
      },
      {
        note: 'Exhaustive checks use never. In a switch over status, the default branch assigns the value to a never variable. When someone adds a Refund variant and forgets a case, the value is no longer never and the build fails at that line.',
        boxes: [b('s', 'switch on status', ['ok, error'], 'ok'), b('v', 'New variant', ['refund is added'], 'warn'), b('n', 'never check', ['compile error: case missing'], 'bad')],
        deps: [d('New variant', 'switch on status', 'not handled', 'warn'), d('switch on status', 'never check', 'default branch fails', 'bad')],
      },
    ],
  },
  {
    id: 'generics',
    label: 'Generics and utility types',
    title: 'Types that take types',
    frames: [
      {
        note: 'A generic function works for many types and keeps the link between them. first<T>(items: T[]): T returns the same type it receives: a string for a string array, an Account for an Account array. T is inferred from the argument.',
        boxes: [b('a', 'Argument', ['Account[]'], 'none'), b('t', 'Type parameter T', ['inferred: Account'], 'new'), b('r', 'Result type', ['Account'], 'ok')],
        deps: [d('Argument', 'Type parameter T', 'infers', 'ok'), d('Type parameter T', 'Result type', 'flows into', 'ok')],
      },
      {
        note: 'A constraint limits what T may be. T extends HasId accepts any type that has an id, and then the function can use item.id safely. A type without an id is rejected where the function is called.',
        boxes: [b('c', 'Constraint', ['T extends HasId'], 'new'), b('a', 'Account', ['has id, accepted'], 'ok'), b('l', 'Label', ['no id, rejected'], 'bad')],
        deps: [d('Account', 'Constraint', 'satisfies', 'ok'), d('Label', 'Constraint', 'does not satisfy', 'bad')],
      },
      {
        note: 'Utility types build new types from existing ones, so you do not repeat yourself. From one Account type: Partial makes every field optional for an update, Pick keeps chosen fields, Omit removes some for a public view, Readonly forbids changes.',
        boxes: [b('a', 'Account', ['id, owner, balance'], 'ok'), b('p', 'Partial<Account>', ['all optional, for updates'], 'new'), b('k', 'Pick<Account, id>', ['only the id'], 'new'), b('o', 'Omit<Account, balance>', ['public view'], 'new'), b('r', 'Readonly<Account>', ['no changes'], 'new')],
        deps: [d('Account', 'Partial<Account>', 'Partial', 'ok'), d('Account', 'Pick<Account, id>', 'Pick', 'ok'), d('Account', 'Omit<Account, balance>', 'Omit', 'ok'), d('Account', 'Readonly<Account>', 'Readonly', 'ok')],
      },
    ],
  },
  {
    id: 'strict',
    label: 'Strict null checks',
    title: 'The billion dollar mistake, at compile time',
    frames: [
      {
        note: 'With strict on, null and undefined are not part of every type. A function that may not find an account returns Account | undefined, and the compiler refuses account.balance until you have dealt with the missing case.',
        boxes: [b('f', 'findAccount(id)', ['Account or undefined'], 'new'), b('u', 'Direct use', ['account.balance'], 'bad'), b('e', 'Compile error', ['possibly undefined'], 'bad')],
        deps: [d('findAccount(id)', 'Direct use', 'returns maybe nothing', 'warn'), d('Direct use', 'Compile error', 'rejected', 'bad')],
      },
      {
        note: 'Handle the case and the type narrows. After if (!account) return, the rest of the function knows account is an Account. Optional chaining account?.balance and a default with ?? are the short forms.',
        boxes: [b('f', 'findAccount(id)', ['Account or undefined'], 'new'), b('c', 'Guard', ['if (!account) return'], 'ok'), b('n', 'Narrowed type', ['Account below the guard'], 'ok')],
        deps: [d('findAccount(id)', 'Guard', 'checked', 'ok'), d('Guard', 'Narrowed type', 'narrows to', 'ok')],
      },
    ],
  },
];
