// Frame data for the "JavaScript essentials" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JS_SCENES = [
  {
    id: 'closure',
    label: 'Scope and closures',
    title: 'A function remembers where it was made',
    frames: [
      {
        note: 'Scope in JavaScript is lexical: it is decided by where the code is written. The inner function increment uses count, which it does not have. The engine looks in the scope around it, then the next one out, up to the global scope. This is the scope chain.',
        boxes: [b('i', 'increment function', ['count++ looks up count'], 'new'), b('m', 'makeCounter scope', ['count = 0'], 'ok'), b('g', 'Global scope', ['bankName'], 'none')],
        deps: [d('increment function', 'makeCounter scope', 'looks here first', 'ok'), d('makeCounter scope', 'Global scope', 'then the outer scope', 'ok')],
      },
      {
        note: 'makeCounter returns increment and finishes. Normally its variables would be gone. But increment still refers to that scope, so the engine keeps it alive. A function together with the scope it was created in is a closure.',
        boxes: [b('c', 'makeCounter call', ['returns and is done'], 'none'), b('i', 'increment function', ['carries its scope'], 'new'), b('m', 'makeCounter scope', ['count survives'], 'ok')],
        deps: [d('makeCounter call', 'increment function', 'returns', 'ok'), d('increment function', 'makeCounter scope', 'keeps it alive', 'ok')],
      },
      {
        note: 'Every call to makeCounter creates a new scope, so each counter has its own private count. Nothing outside can reach count except through the returned function. Closures are how JavaScript gives private state, factories and callbacks that remember.',
        boxes: [b('a', 'counterA', ['called twice'], 'ok'), b('x', 'Scope A', ['count = 2'], 'ok'), b('y', 'Scope B', ['count = 0'], 'ok'), b('b', 'counterB', ['not called yet'], 'none')],
        deps: [d('counterA', 'Scope A', 'closes over', 'ok'), d('counterB', 'Scope B', 'closes over', 'ok')],
      },
      {
        note: 'The classic trap: with var in a loop there is one shared variable for the whole function, so every callback sees its final value, 3. With let each iteration gets a new binding, so the callbacks print 0, 1 and 2.',
        boxes: [b('v', 'var i', ['one shared variable'], 'bad'), b('c', 'Callbacks with var', ['all print 3'], 'bad'), b('l', 'let i', ['new binding per iteration'], 'ok'), b('d', 'Callbacks with let', ['print 0, 1, 2'], 'ok')],
        deps: [d('var i', 'Callbacks with var', 'shared', 'bad'), d('let i', 'Callbacks with let', 'separate', 'ok')],
      },
    ],
  },
  {
    id: 'this',
    label: 'The value of this',
    title: 'this depends on how a function is called',
    frames: [
      {
        note: 'In JavaScript this is not fixed where a function is written. It is set when the function is called. In account.deposit(50), the object before the dot becomes this, so the method can use this.balance.',
        boxes: [b('s', 'Call site', ['account.deposit(50)'], 'none'), b('t', 'this', ['set by the call'], 'new'), b('o', 'account object', ['balance: 100'], 'ok')],
        deps: [d('Call site', 'this', 'object before the dot', 'ok'), d('this', 'account object', 'points to', 'ok')],
      },
      {
        note: 'Take the method out and call it alone, for example const f = account.deposit; f(50) or pass it as a callback. There is no object before the dot, so this is undefined in strict mode, or the global object otherwise, and this.balance fails.',
        boxes: [b('f', 'Detached function', ['f(50)'], 'warn'), b('t', 'this', ['undefined in strict mode'], 'bad'), b('e', 'TypeError', ['cannot read balance'], 'bad')],
        deps: [d('Detached function', 'this', 'no object before the dot', 'bad'), d('this', 'TypeError', 'fails on use', 'bad')],
      },
      {
        note: 'You can set this yourself. call and apply run the function now with the this you give. bind returns a new function with this fixed for good. new creates a fresh object and makes it this.',
        boxes: [b('c', 'call and apply', ['run now with this'], 'ok'), b('b', 'bind', ['returns a fixed copy'], 'ok'), b('n', 'new', ['creates the object'], 'ok'), b('t', 'this', ['set explicitly'], 'new')],
        deps: [d('call and apply', 'this', 'sets', 'ok'), d('bind', 'this', 'fixes', 'ok'), d('new', 'this', 'creates', 'ok')],
      },
      {
        note: 'An arrow function has no this of its own. It uses the this of the place where it was written, and nothing can change that. That is why arrows are the right choice for callbacks inside methods, and the wrong choice for object methods.',
        boxes: [b('a', 'Arrow function', ['no own this'], 'new'), b('e', 'Enclosing scope', ['its this is used'], 'ok'), b('m', 'Method', ['this = account'], 'ok')],
        deps: [d('Arrow function', 'Enclosing scope', 'uses its this', 'ok'), d('Enclosing scope', 'Method', 'created inside', 'ok')],
      },
    ],
  },
  {
    id: 'prototype',
    label: 'Prototypes',
    title: 'Objects inherit from other objects',
    frames: [
      {
        note: 'Every object has a hidden link to another object, its prototype. When you read a property the engine looks on the object, then on its prototype, then on that one, and so on. The chain ends at null.',
        boxes: [b('a', 'account object', ['own: balance'], 'ok'), b('p', 'Account.prototype', ['deposit, withdraw'], 'ok'), b('o', 'Object.prototype', ['toString'], 'none')],
        deps: [d('account object', 'Account.prototype', 'prototype link', 'ok'), d('Account.prototype', 'Object.prototype', 'prototype link', 'ok')],
      },
      {
        note: 'account.deposit is not an own property, so the lookup walks up and finds deposit on Account.prototype. All accounts share that one function. Writing a property always writes on the object itself, and shadows the inherited one.',
        boxes: [b('l', 'Lookup deposit', ['not on the object'], 'warn'), b('a', 'account object', ['no deposit here'], 'none'), b('p', 'Account.prototype', ['found deposit'], 'ok')],
        deps: [d('Lookup deposit', 'account object', 'checks first', 'warn'), d('Lookup deposit', 'Account.prototype', 'found here', 'ok')],
      },
      {
        note: 'The class keyword is syntax over this mechanism. The methods you write in the class body are put on Class.prototype, and new Class() creates an object whose prototype link points there. A class is still a function.',
        boxes: [b('c', 'class Account', ['constructor, methods'], 'new'), b('p', 'Account.prototype', ['methods live here'], 'ok'), b('n', 'new Account()', ['linked to the prototype'], 'ok')],
        deps: [d('class Account', 'Account.prototype', 'puts methods on', 'ok'), d('new Account()', 'Account.prototype', 'prototype link', 'ok')],
      },
      {
        note: 'extends connects two prototypes. Savings.prototype links to Account.prototype, so a savings object finds its own methods first and then the inherited ones. super calls up the chain, and instanceof walks the same chain to answer yes or no.',
        boxes: [b('s', 'Savings.prototype', ['addInterest'], 'ok'), b('a', 'Account.prototype', ['deposit'], 'ok'), b('i', 'instanceof', ['walks the chain'], 'new')],
        deps: [d('Savings.prototype', 'Account.prototype', 'extends', 'ok'), d('instanceof', 'Savings.prototype', 'checks the chain', 'ok')],
      },
    ],
  },
  {
    id: 'values',
    label: 'Values and references',
    title: 'Copy, share and clone',
    frames: [
      {
        note: 'Primitives (numbers, strings, booleans, null, undefined, symbols, bigints) are copied by value. After let b = a, changing b leaves a alone. They are also immutable: a string method returns a new string.',
        boxes: [b('a', 'Variable a', ['5'], 'ok'), b('b', 'Variable b', ['copy of 5, then 6'], 'ok')],
        deps: [d('Variable a', 'Variable b', 'let b = a copies the value', 'ok')],
      },
      {
        note: 'Objects, arrays and functions are held by reference. let b = a copies the reference, not the object, so both variables point to one object. A change through either is seen through both. Comparing two objects with === compares the references.',
        boxes: [b('a', 'Variable a', ['reference'], 'new'), b('b', 'Variable b', ['same reference'], 'new'), b('o', 'Account object', ['one object, balance 100'], 'ok')],
        deps: [d('Variable a', 'Account object', 'points to', 'ok'), d('Variable b', 'Account object', 'points to', 'ok')],
      },
      {
        note: 'Spread and Object.assign make a shallow copy: a new top-level object, but nested objects are still shared. Changing copy.address.city changes the original too. This is a frequent source of bugs in React state updates.',
        boxes: [b('o', 'Original', ['name, address'], 'ok'), b('c', 'Shallow copy', ['new object, same address'], 'warn'), b('n', 'Nested address', ['shared by both'], 'bad')],
        deps: [d('Original', 'Nested address', 'points to', 'bad'), d('Shallow copy', 'Nested address', 'points to', 'bad')],
      },
      {
        note: 'structuredClone makes a deep copy, so nothing is shared, and it handles dates, maps, sets and circular references. It cannot copy functions or class methods. JSON.stringify and parse is a lossy alternative that drops undefined, functions and dates.',
        boxes: [b('o', 'Original', ['address inside'], 'ok'), b('s', 'structuredClone', ['deep copy'], 'new'), b('c', 'Deep copy', ['own address object'], 'ok')],
        deps: [d('Original', 'structuredClone', 'input', 'ok'), d('structuredClone', 'Deep copy', 'returns', 'ok')],
      },
    ],
  },
];
