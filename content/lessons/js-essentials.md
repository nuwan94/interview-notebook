---
title: JavaScript essentials — scope, closures, this, prototypes and values
nav: JavaScript essentials
slug: js-essentials
summary: The JavaScript core that React and Node.js interviews assume, types and coercion, var let const with hoisting and the temporal dead zone, functions and arrow functions, scope and closures, how this is decided, prototypes and classes, value and reference with shallow and deep copies, destructuring and spread, arrays and iteration, Map and Set, modules, and the common coding questions (debounce, memoize, deep clone), explained for a Java developer, with examples and interview questions.
tags: [JavaScript, ES2023, Closures, this, Prototype, Scope, Hoisting, Modules, Full stack]
order: 60
topic: Full stack / JavaScript and TypeScript
updated: 2026-11-26
subnav: true
---

JavaScript interviews are less about syntax and more about a few mechanisms that behave differently from Java:

- scope and closures
- how `this` is decided
- the prototypes behind `class`
- value against reference
- coercion and equality
- modules

Get these right, and React hooks, Node.js callbacks and TypeScript all become easier. This lesson is for a developer who already knows Java, so it compares as it goes. The event loop, promises and `async`/`await` have their own lesson next. Play the four scenes: scope and closures, `this`, prototypes, and values and references.

```demo
name: js-walk
```

> **One sentence to remember:** *A function remembers where it was written, and `this` depends on how it is called.*

That is the first half. The second half: objects inherit through prototype links, and objects are passed by reference, so copy on purpose.

## Types, equality and coercion {#types}

JavaScript is **dynamically typed**. Variables have no type, but values do. There are seven **primitive** types and one **object** type:

| Kind | Types | Notes |
| --- | --- | --- |
| primitives | `number`, `string`, `boolean`, `null`, `undefined`, `symbol`, `bigint` | immutable, compared by value |
| object | objects, arrays, functions, dates, maps, sets | held by reference, mutable |

- **One number type.** `number` is a 64-bit float, like Java's `double`. So `0.1 + 0.2 === 0.30000000000000004`. For money, use **integer minor units** (cents) or a decimal library. For integers beyond `Number.MAX_SAFE_INTEGER` (2^53 - 1), use `BigInt` (`123n`).
- **`null` and `undefined`.** `undefined` means "no value was given": a missing property, an unset variable, a function without `return`. `null` means "deliberately empty". `typeof null` is `"object"`. That is an old bug that stays.
- **`==` and `===`.** `==` converts the types first (`"5" == 5` is true, and `null == undefined` is true). `===` compares without conversion. **Use `===`.** The one useful exception is `x == null`, which tests for both `null` and `undefined`.
- **Truthy and falsy.** The falsy values are `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN`. Everything else is truthy, **including `"0"`, `"false"`, `[]` and `{}`**.
- **`NaN`** is not equal to itself. Test it with `Number.isNaN(x)`, not the global `isNaN`, which converts first.
- **`typeof`** gives `"number"`, `"string"`, `"boolean"`, `"undefined"`, `"symbol"`, `"bigint"`, `"function"` and `"object"`. Arrays and `null` also give `"object"`. Use `Array.isArray(x)` for arrays.
- **Coercion puzzles.** `"5" + 3` is `"53"`, because `+` joins text if either side is a string. But `"5" - 3` is `2`. And `[] + {}` is `"[object Object]"`. These are popular questions. The answer is always the same: the engine converts to a primitive, then applies the rule. There is nothing to memorise.
- **Operators worth knowing.**
  - **Optional chaining** `user?.address?.city` stops at `null` or `undefined`.
  - **Nullish coalescing** `a ?? b` falls back only for `null` or `undefined`. Unlike `a || b`, it keeps `0` and `""`.
  - `??=`, `||=` and `&&=` assign conditionally.

## Variables: var, let, const and hoisting {#variables}

| | `var` | `let` | `const` |
| --- | --- | --- | --- |
| scope | **function** | **block** | **block** |
| reassign | yes | yes | no (the binding, not the object) |
| redeclare | yes | no | no |
| hoisting | yes, initialised to `undefined` | yes, but in the **temporal dead zone** | the same as `let` |

- **Hoisting.** The engine processes declarations before the code runs. So you can call a function declared later in the same scope.
  - A `var` is visible from the top of its function, with the value `undefined` until it is assigned.
  - A `let` or `const` exists from the top of its block, but **cannot be used before its declaration**. That gap is the **temporal dead zone (TDZ)**. Touching the variable there throws a `ReferenceError`.
- **`const` is not immutability.** `const accounts = []; accounts.push(a)` is fine. The binding cannot change, but the array can. Use `Object.freeze` (shallow) for a read-only object.
- **Default to `const`.** Use `let` when you must reassign, and avoid `var`. The loop trap in the first scene (`var` shares one variable across iterations) is the reason.
- **Globals.** In sloppy mode, assigning to a variable without declaring it makes a global. **Strict mode** turns that into an error, and makes `this` `undefined` in a plain function call. You get strict mode with `"use strict"`, and automatically in ES modules and classes.

## Functions {#functions}

Functions are **first-class values**. You can store them in variables, pass them as arguments, and return them. That is the basis for callbacks, closures and React hooks.

```javascript
function add(a, b) { return a + b; }            // declaration: hoisted with its body
const sub = function (a, b) { return a - b; };  // expression: not usable before this line
const mul = (a, b) => a * b;                    // arrow: short, no own this, arguments or new
const fee = (amount, rate = 0.02) => amount * rate;      // default parameter
const total = (...amounts) => amounts.reduce((s, a) => s + a, 0);   // rest parameter
Math.max(...[3, 9, 4]);                          // spread an array into arguments
```

- **Arrow functions** have no `this` and no `arguments`, and cannot be used with `new`. They are ideal for callbacks and array methods. They are a poor choice for object methods or constructors.
- **Parameters** are passed by value. But for objects the value is a reference, so a function can change an object you pass in. That is the same as in Java.
- **Missing arguments** are `undefined`, and extra ones are ignored. There is **no overloading**: one name, one function.
- **Higher-order functions** take or return functions: `map`, `filter`, `setTimeout`, a debounce wrapper. Compare with Java's lambdas and functional interfaces ([functional Java](lesson:java-functional)).
- **IIFE** (immediately invoked function expression) `(() => { ... })()` creates a private scope. Modules and blocks mostly replace it now.

## Scope and closures {#closures}

The first scene shows it. **Scope is lexical**: a function sees the variables of the scopes **where it was written**, from the innermost outward. That is the **scope chain**.

```javascript
function makeCounter() {
  let count = 0;                  // private to this call
  return () => ++count;           // the returned function closes over count
}
const a = makeCounter();
const b = makeCounter();
a(); a();                          // 2
b();                               // 1, a separate count
```

- A **closure** is a function together with the scope it was created in. The engine keeps those variables alive as long as the function is reachable.
- **Uses:**
  - private state (module pattern, factories);
  - callbacks that remember data (`setTimeout`, event handlers);
  - partial application and currying, memoization, `once`, debounce and throttle;
  - React **hooks**: a component function's variables captured by an effect.
- **Pitfalls:**
  - the **loop with `var`**: every callback sees the final value. Fix it with `let` or a function scope;
  - **stale closures** in React effects and timers: a callback captured an old value;
  - **memory leaks**: a long-lived closure holds on to a large object.
- **Java comparison.** An inner class or lambda can capture only effectively final variables, so it captures a value. A JavaScript closure captures the **variable itself** (a live binding), which is why it can change it.

## this {#this}

`this` is set **when the function is called**, not where it is written (the second scene). The rules, in order of priority:

1. **`new Fn()`**: `this` is the new object.
2. **Explicit**: `fn.call(obj, a)`, `fn.apply(obj, [a])`, or a function made by `fn.bind(obj)`.
3. **Method call**: `obj.method()` makes `this` the object before the dot.
4. **Plain call**: `fn()` gives `undefined` in strict mode (and in modules and classes), or the global object in sloppy mode.
5. **Arrow function**: no `this` of its own. It uses the `this` of the enclosing scope, and `call` or `bind` cannot change it.

```javascript
class Account {
  balance = 100;
  deposit(amount) { this.balance += amount; }
  depositLater = (amount) => { this.balance += amount; };   // arrow field: this is always the instance
}
const acc = new Account();
const f = acc.deposit;
f(50);                              // TypeError: this is undefined (detached method)
setTimeout(acc.deposit, 0);         // the same problem, as a callback
setTimeout(() => acc.deposit(50), 0);       // fine: called as a method
setTimeout(acc.deposit.bind(acc, 50), 0);   // fine: bound
```

This is the famous **"lost `this`"** bug in React class components (`onClick={this.handle}`). It is one reason function components with hooks replaced them.

## Objects, prototypes and classes {#prototypes}

An object is a bag of key-value pairs. Every object has an internal link to a **prototype** object. A property read walks that **prototype chain** until it finds the key, or reaches `null` (the third scene).

```javascript
const base = { greet() { return `hello ${this.name}`; } };
const user = Object.create(base);        // prototype is base
user.name = 'Asha';
user.greet();                            // found on base, this is user
Object.getPrototypeOf(user) === base;    // true
Object.hasOwn(user, 'greet');            // false: inherited, not own
```

- **`class`** is syntax over prototypes. Methods go on `Class.prototype`, `extends` links two prototypes, and `super` calls up the chain. A class is still a function: `typeof Account` is `"function"`.
- **Class features:** `constructor`, `static` members, getters and setters, **private fields `#balance`** (real privacy, unlike a naming convention), and `static` blocks.
- **No class hoisting**, unlike functions. A class is in the TDZ before its declaration.
- **`instanceof`** walks the prototype chain. `Object.keys` lists own enumerable keys. `for...in` also lists inherited ones, which is rarely what you want.
- **Composition over inheritance** is the usual JavaScript advice, with plain objects, factory functions and mixins. It is the same advice as in Java.
- **Object helpers:** `Object.keys/values/entries`, `Object.fromEntries`, `Object.assign`, `Object.freeze`, property descriptors with `Object.defineProperty`, and computed keys `{ [key]: value }`.

## Values, references and copies {#references}

The last scene summarises it. **Primitives are copied. Objects are shared by reference.** And `===` on objects compares references.

```javascript
const a = { name: 'Asha', address: { city: 'Singapore' } };
const shallow = { ...a };                 // new top-level object, shared address
shallow.address.city = 'Sydney';          // a.address.city is now 'Sydney' too
const deep = structuredClone(a);          // fully separate (dates, maps, sets, cycles)
```

- **Shallow copies:** spread (`{ ...obj }`, `[...arr]`), `Object.assign`, `slice`, `Array.from`.
- **Deep copies:**
  - `structuredClone` is built in. It cannot copy functions, or the methods of class instances.
  - A library also works.
  - `JSON.parse(JSON.stringify(x))` works for plain data. It loses `undefined` and functions, turns dates into strings, loses `Map` and `Set`, and fails on cycles.
- **Immutable updates.** Instead of changing an object, build a new one: `{ ...state, count: state.count + 1 }`, `[...list, item]`, `list.filter(...)`. React and Redux depend on this, because they detect change by comparing references.
- **Equality of objects.** `{} === {}` is false, because they are two different objects. To compare content, write a function or use a library.
- **Newer non-mutating array methods.** `toSorted`, `toReversed`, `toSpliced` and `with` return copies. `sort`, `reverse` and `splice` change the array itself.

## Destructuring, spread and rest {#destructuring}

```javascript
const { id, owner: { name }, balance = 0 } = account;        // objects, nested, default
const [first, , third, ...others] = list;                     // arrays, skip, rest
const [x, y] = [y, x];                                        // swap
function open({ owner, currency = 'SGD' } = {}) { ... }       // destructured parameter with a default
const merged = { ...defaults, ...overrides };                 // later keys win
```

Destructuring pulls values out by name (objects) or by position (arrays). Spread expands an iterable or an object into another one. Rest collects the remainder.

## Arrays, iteration, Map and Set {#collections}

- **Array methods that return new arrays:** `map`, `filter`, `slice`, `concat`, `flat`, `flatMap`, `toSorted`. `reduce` folds to one value. `find`, `findIndex`, `some`, `every`, `includes` and `at(-1)` read.
- **The `sort` pitfall.** The default sort **converts to strings** (`[10, 9, 1].sort()` gives `[1, 10, 9]`) and sorts **in place**. Pass a comparator: `(a, b) => a - b`.
- **Loops.**
  - `for...of` iterates **values** of any iterable: arrays, strings, maps, sets.
  - `for...in` iterates **keys**, including inherited ones. Avoid it on arrays.
  - `forEach` cannot `break`, and does not work with `await` the way you expect.
- **`Map` and `Set`.**
  - `Map` accepts any key type and keeps insertion order. Use it instead of an object for dictionaries with changing keys.
  - `Set` stores unique values. ES2025 adds `union`, `intersection` and `difference`.
  - `WeakMap` and `WeakSet` hold their keys weakly, so they do not stop garbage collection. They suit caches keyed by objects.
  - Compare with Java's `HashMap` and `HashSet` ([collections](lesson:java-collections)).
- **Iterators and generators.** Anything with `[Symbol.iterator]` works with `for...of` and spread. `function*` with `yield` makes lazy sequences. Compare with Java streams ([streams](lesson:java-streams)), but these work step by step as you pull values.
- **`Object.groupBy(list, fn)`** groups into an object, and `Map.groupBy` into a map.

## Modules {#modules}

| | **ES modules (ESM)** | **CommonJS (CJS)** |
| --- | --- | --- |
| syntax | `import x from './x.js'`, `export` | `require('./x')`, `module.exports` |
| loading | static, resolved before running, **tree-shakeable** | dynamic, at run time |
| `this` at top level | `undefined` | `module.exports` |
| strict mode | always | opt in |
| where | browsers, bundlers, modern Node.js (`"type": "module"`) | older Node.js code |

- **Named and default exports.** `export const x`, `export default f`. Prefer **named exports**, which are easy to find and refactor. Keep default for one main thing, such as a React component.
- **Live bindings.** An imported name shows later changes made in the exporting module. It is not a copy.
- **Dynamic `import()`** returns a promise and loads code on demand. It is the basis for **code splitting** and lazy loading.
- **Each module has its own scope**, so a top-level variable is not a global. Circular imports work, but can see values that are not initialised yet.
- **Compare with Java.** Modules are closer to packages and the Java module system, but there is no classpath. A bundler (Vite, webpack) combines and trims the code for the browser.

## Errors, JSON and dates {#errors}

- **Errors.** `throw new Error('message')`. You can throw anything, but throw `Error` objects so you get a stack trace. Use `try/catch/finally`, subclass `Error` for your own types, and attach the cause: `new Error('failed', { cause: err })`. There are no checked exceptions.
- **JSON.**
  - `JSON.stringify(value)` skips `undefined` and functions, calls `toJSON`, and throws on cycles.
  - `JSON.parse(text)` throws on bad input, so wrap it.
  - Parsing never gives you class instances or dates, only plain data.
- **Dates.** `Date` is mutable, counts months from 0 to 11, and mixes local time and UTC. So use ISO strings (`toISOString`), keep times in UTC, and consider a library or the newer **Temporal** API for calculations.
- **Optional catch binding.** Write `catch { ... }` when you do not need the error.

## Common coding questions {#coding-questions}

Interviewers like short function-writing tasks that test closures and `this`:

- **debounce and throttle**
- **memoize**
- **curry** and **once**
- **deep clone**
- **flatten an array** and **group by**
- **implement `bind`, `map` or `Promise.all`**
- **an event emitter**

Three of them are in the coding questions below. State the edge cases (arguments, `this`, cleanup, cycles), as you would in Java.

## For a Java developer {#java}

| Java | JavaScript |
| --- | --- |
| static types, compile-time checks | dynamic types, errors at run time (TypeScript adds static checks) |
| `int`, `long`, `double`, `BigDecimal` | one `number` (double), `BigInt`, libraries for decimals |
| classes are the unit | functions and objects first, `class` is sugar over prototypes |
| lambdas capture effectively final values | closures capture live variables |
| `this` is the current instance | `this` depends on the call |
| checked and unchecked exceptions | any value can be thrown, no checked exceptions |
| threads, `synchronized` | one thread plus an event loop and async code (next lesson) |
| Maven, Gradle, JARs | npm, pnpm, `package.json`, ES modules |
| `equals`, `hashCode` | `===` compares references for objects |

Try it in the lab: [Closures: the var loop bug and a lost this](lab:js-closure-loop).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| types | 7 primitives plus object, one `number` type (double), `typeof null` is object |
| equality | use `===`, falsy: false 0 "" null undefined NaN, `??` for null or undefined only |
| variables | `const` by default, `let` if reassigned, `var` avoided, TDZ for let and const |
| hoisting | declarations are processed first, functions fully, `var` as undefined |
| closure | function plus its lexical scope, captures variables not values |
| `this` | new, call/apply/bind, method call, plain call, arrow (lexical) |
| prototypes | property lookup walks the chain, `class` is sugar, `#private` fields |
| copies | primitives by value, objects by reference, spread is shallow, `structuredClone` deep |
| arrays | `sort` needs a comparator, `toSorted` does not mutate, `for...of` over values |
| modules | ESM static and tree-shakeable, CJS dynamic, prefer named exports |

## Interview questions {#questions}

### [basic] What is the difference between `==` and `===`? {#equality-q}

`===` compares value and type, with no conversion. So `"5" === 5` is false.

`==` converts the operands to a common type first. So `"5" == 5` is true, and `null == undefined` is true, but `null == 0` is false.

The rules of `==` are hard to remember and cause bugs. So use `===`. The one common exception is `x == null`, which checks for null or undefined together.

### [basic] What is the difference between `var`, `let` and `const`? {#var-let-const-q}

`var` is function-scoped, can be redeclared, and is hoisted as `undefined`.

`let` and `const` are block-scoped and cannot be redeclared. They sit in a temporal dead zone from the start of the block until their declaration, so using them early throws a ReferenceError.

`const` forbids reassigning the binding, but the object it holds can still change. Use `const` by default, `let` when needed, and not `var`.

### [basic] What is hoisting? {#hoisting-q}

The engine registers declarations before the code runs, so they are usable earlier in their scope.

- A function declaration is hoisted with its body, so you can call it before it appears.
- A `var` is hoisted, but holds `undefined` until its line runs.
- `let`, `const` and `class` are hoisted too, but stay in the temporal dead zone. Using them before the declaration throws.
- Function expressions and arrow functions follow the rule of the variable that holds them.

### [basic] What are the falsy values in JavaScript? {#falsy-q}

`false`, `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN`.

Everything else is truthy. That includes the strings `"0"` and `"false"`, an empty array and an empty object.

Be careful with `||` for defaults. It also replaces a valid `0` or empty string. Use `??` when only null and undefined should fall back.

### [basic] What is a closure? {#closure-q}

A closure is a function bundled with the lexical scope where it was created. It can still read and change those variables after the outer function has returned.

For example, `makeCounter` returns a function that increments a private `count`. Each call to `makeCounter` gets its own count.

Closures give you private state, factories, and callbacks that remember context. They are behind debounce, memoize and React hooks.

### [basic] What does `this` refer to in JavaScript? {#this-q}

It depends on how the function is called:

- `new`: the new object.
- `call`, `apply` and `bind`: the object you give.
- a method call: the object before the dot.
- a plain call: `undefined` in strict mode, or the global object.
- an arrow function: the surrounding `this`, because it has none of its own.

A method passed as a callback loses its object. To fix that, bind it, wrap it in an arrow function, or use an arrow class field.

### [basic] How do arrow functions differ from normal functions? {#arrow-q}

An arrow function has:

- a shorter syntax;
- no own `this`, so it uses the enclosing one;
- no `arguments` object;
- no use as a constructor with `new`;
- no prototype property.

That makes arrows good for callbacks and array methods. They are wrong for object methods and constructors, where you want a `this` that depends on the call.

### [intermediate] Why do all callbacks print 3 in a loop with `var` and how do you fix it? {#loop-q}

`var i` is one variable for the whole function. The callbacks run later, after the loop has finished with `i` equal to 3. So all of them read that same variable.

With `let i`, each iteration creates a new binding that the callback closes over. So they print 0, 1 and 2.

Before `let` existed, the fix was an IIFE that passed `i` in as a parameter.

### [intermediate] How does prototypal inheritance work? {#prototype-q}

Each object has an internal prototype link to another object. When a property is not found on the object, the engine follows the link. It tries the prototype, then that prototype's prototype, to the end of the chain at `null`.

Methods shared by many instances live on the prototype, so they exist once.

`class` and `extends` are syntax over this. Methods go on `Class.prototype`, and `extends` links the two prototypes.

Writing a property always writes on the object itself, and shadows an inherited one.

### [intermediate] What is the difference between shallow and deep copy, and how do you make each? {#copy-q}

A shallow copy duplicates only the top-level object. Nested objects and arrays are still shared with the original, so a change inside them shows in both. Spread, `Object.assign`, `slice` and `Array.from` make shallow copies.

A deep copy duplicates everything. Use `structuredClone`, which handles dates, maps, sets and circular references, but not functions. Or use a library.

`JSON.parse(JSON.stringify(x))` also works for plain data. But it drops `undefined` and functions, and turns dates into strings.

### [intermediate] What does `call`, `apply` and `bind` do? {#bind-q}

All three set `this` explicitly.

- `call(thisArg, a, b)` runs the function now, with the arguments listed.
- `apply(thisArg, [a, b])` runs it now, with an array of arguments.
- `bind(thisArg, a)` returns a new function with `this` (and optionally leading arguments) fixed, to be called later.

A bound function cannot be rebound. `bind` is what makes a method safe to pass as a callback.

### [intermediate] What is the difference between `for...in` and `for...of`? {#for-in-q}

`for...of` iterates the values of any iterable: arrays, strings, maps, sets and generators.

`for...in` iterates the enumerable string keys of an object, including inherited ones. On arrays it gives index strings, and can include added properties.

Use `for...of` for arrays and iterables. For plain objects, use `Object.keys`, `Object.entries`, or `for...in` with `Object.hasOwn`.

### [intermediate] Why does `[10, 9, 1].sort()` return `[1, 10, 9]`? {#sort-q}

The default comparison converts the elements to strings, and compares them in code-unit order. So `"10"` comes before `"9"`. It also sorts in place and returns the same array.

Pass a comparator such as `(a, b) => a - b` for numbers. Use `toSorted` to get a sorted copy without changing the original.

### [intermediate] What is the difference between ES modules and CommonJS? {#modules-q}

ES modules use `import` and `export`. They are analysed statically before the code runs, so bundlers can tree-shake unused exports. They are always strict, and export live bindings.

CommonJS uses `require` and `module.exports`. It loads synchronously at run time, and exports a value copy.

Browsers and modern Node.js (with `"type": "module"`) support ES modules. A lot of older Node.js code is CommonJS. Dynamic `import()` loads a module lazily and returns a promise.

### [intermediate] What is the difference between `null` and `undefined`, and how do `??` and `?.` help? {#null-q}

`undefined` means a value was never given: a missing property, an unset variable, no return. `null` is an explicit "no value".

`a ?? b` returns `b` only when `a` is null or undefined. So `0` and `""` stay valid, unlike with `||`.

`user?.address?.city` returns `undefined` instead of throwing when something along the path is null or undefined. It also works for calls and indexes: `fn?.()` and `list?.[0]`.

### [deep] Why does `const` not make an object immutable, and how would you make one? {#const-q}

`const` fixes the binding. You cannot assign the variable again, but the object it refers to can still change.

To block changes, use `Object.freeze`. It makes the top level read-only, silently in sloppy mode and with an error in strict mode. Nested objects stay mutable unless you freeze them recursively.

In application code, the more common approach is to never change objects. Create new ones with spread, `map` and `filter`. React and Redux require this.

### [deep] Explain a stale closure and how it shows up in practice. {#stale-q}

A closure captures variables, but a callback created in one run of a function sees the values of that run.

If it stays alive, it keeps using the old values, such as an old `count`, while a newer run has moved on. This happens in `setInterval`, in event listeners, and in React effects that never update.

To fix it:

- recreate the callback when its inputs change (dependency arrays in React effects);
- read the latest value through a ref;
- use a functional state update;
- clean up timers and listeners.

### [deep] How would you explain how `new` works? {#new-q}

`new Fn(args)` does three things:

1. It creates a fresh empty object whose prototype is `Fn.prototype`.
2. It calls `Fn` with `this` set to that object.
3. It returns the object, unless the constructor explicitly returns another object.

You can write it as a function: create with `Object.create(Fn.prototype)`, call with `Fn.apply(obj, args)`, and return the result if it is an object, otherwise `obj`.

A class constructor does the same, but cannot be called without `new`.

### [coding] Implement `debounce` and `throttle`. {#coding-debounce}

```javascript
function debounce(fn, waitMs) {
  let timer;                                   // private state in the closure
  return function debounced(...args) {
    clearTimeout(timer);                        // a new call restarts the wait
    timer = setTimeout(() => fn.apply(this, args), waitMs);
  };
}

function throttle(fn, intervalMs) {
  let last = 0;
  let timer;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = intervalMs - (now - last);
    if (remaining <= 0) {                       // enough time has passed: run now
      clearTimeout(timer);
      timer = undefined;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {                        // otherwise schedule one trailing call
      timer = setTimeout(() => {
        last = Date.now();
        timer = undefined;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

// usage: search as the user types, scroll handlers
const search = debounce((text) => console.log('search', text), 300);
```

Explain these points:

- Both return a new function that **closes over** private state (`timer`, `last`).
- **debounce** runs only after calls have stopped for the wait time. Use it for typing in a search box.
- **throttle** runs at most once per interval. Use it for scroll and resize handlers.
- A regular `function` is returned, so `this` is passed through with `apply`. The arrow function inside keeps that `this`.
- Edge cases to mention: leading and trailing options, a `cancel` method, and clearing the timer when a React component unmounts.

### [coding] Implement `memoize` for a function of several arguments. {#coding-memoize}

```javascript
function memoize(fn, { maxSize = 500, key = (...args) => JSON.stringify(args) } = {}) {
  const cache = new Map();                      // Map keeps insertion order, so the oldest entry is first

  return function memoized(...args) {
    const k = key(...args);
    if (cache.has(k)) {
      const value = cache.get(k);
      cache.delete(k);                          // refresh: move to the end (least recently used)
      cache.set(k, value);
      return value;
    }
    const value = fn.apply(this, args);
    cache.set(k, value);
    if (cache.size > maxSize) {
      cache.delete(cache.keys().next().value);  // evict the least recently used entry
    }
    return value;
  };
}

const slowFee = (amount, currency) => { /* expensive lookup */ return amount * 0.02; };
const fee = memoize(slowFee);
fee(100, 'SGD');   // computed
fee(100, 'SGD');   // from the cache
```

Explain these points:

- The **closure** keeps the cache private for each memoized function.
- The key is built from the arguments. `JSON.stringify` works for plain values. For objects, pass a custom `key`, or use nested `Map`s.
- A `Map` is used instead of an object, because keys can be any string, and it keeps insertion order. That makes a simple **LRU** (least recently used) eviction possible. The size limit stops the cache growing forever.
- Memoization is only valid for **pure** functions: the same input always gives the same output, with no side effects.
- For promises, cache the promise itself, and remove it on failure.
- In React, the equivalents are `useMemo` and `React.memo`.

### [coding] Implement a deep clone that handles nested objects, arrays, dates, maps, sets and circular references. {#coding-clone}

```javascript
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;   // primitives and functions are returned as they are
  if (seen.has(value)) return seen.get(value);                     // a circular reference: reuse the copy

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);

  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);
    value.forEach((v, k) => copy.set(deepClone(k, seen), deepClone(v, seen)));
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    value.forEach((v) => copy.add(deepClone(v, seen)));
    return copy;
  }

  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);                                           // register before recursing
  for (const key of Reflect.ownKeys(value)) {                      // string and symbol keys
    copy[key] = deepClone(value[key], seen);
  }
  return copy;
}

const account = { id: 1, opened: new Date(), tags: new Set(['gold']), owner: { name: 'Asha' } };
account.self = account;                                            // a cycle
const copy = deepClone(account);
copy.owner.name = 'Ben';       // account.owner.name is still 'Asha'
```

Explain these points:

- Primitives, and functions (which are shared), are returned at once.
- A **`WeakMap` of already copied objects** handles **circular references** and shared references. The copy is registered before its children are copied.
- Dates, regular expressions, maps and sets need their own cases, because copying their properties would not copy their contents.
- Plain objects keep their **prototype** through `Object.create(Object.getPrototypeOf(value))`.
- `Reflect.ownKeys` includes symbol keys.
- In real code, use the built-in **`structuredClone(value)`**. It does all this, except functions and class prototypes. Say so first, before writing your own.
