---
title: JavaScript essentials — scope, closures, this, prototypes and values
nav: JavaScript essentials
slug: js-essentials
summary: The JavaScript core that React and Node.js interviews assume, types and coercion, var let const with hoisting and the temporal dead zone, functions and arrow functions, scope and closures, how this is decided, prototypes and classes, value and reference with shallow and deep copies, destructuring and spread, arrays and iteration, Map and Set, modules, and the common coding questions (debounce, memoize, deep clone), explained for a Java developer, with examples and interview questions.
tags: [JavaScript, ES2023, Closures, this, Prototype, Scope, Hoisting, Modules, Full stack]
order: 60
topic: Full stack / JavaScript and TypeScript
updated: 2026-11-17
subnav: true
---

JavaScript interviews are not about syntax, they are about a handful of mechanisms that behave differently from Java: *scope and closures, how `this` is decided, prototypes behind `class`, value against reference, coercion and equality, and modules.* Get these right and React hooks, Node.js callbacks and TypeScript all become easier. This lesson is for a developer who already knows Java, so it compares as it goes. The event loop, promises and `async`/`await` get their own lesson next. Play the four scenes: scope and closures, `this`, prototypes, and values and references.

```demo
name: js-walk
```

> **One sentence to remember:** *A function remembers the scope where it was written (closure), `this` is decided by how it is called, objects inherit through prototype links, and objects are passed by reference, so copy on purpose.*

## Types, equality and coercion {#types}

JavaScript is **dynamically typed**: variables have no type, values do. There are seven **primitive** types and one **object** type:

| Kind | Types | Notes |
| --- | --- | --- |
| primitives | `number`, `string`, `boolean`, `null`, `undefined`, `symbol`, `bigint` | immutable, compared by value |
| object | objects, arrays, functions, dates, maps, sets | held by reference, mutable |

- **One number type:** `number` is a 64-bit float (like Java's `double`), so `0.1 + 0.2 === 0.30000000000000004`. For money use **integer minor units** (cents) or a decimal library, and `BigInt` (`123n`) for integers beyond `Number.MAX_SAFE_INTEGER` (2^53 - 1).
- **`null` and `undefined`:** `undefined` means "no value was given" (a missing property, an unset variable, a function without `return`), `null` means "deliberately empty". `typeof null` is `"object"`, an old bug that stays.
- **`==` and `===`:** `==` converts types first (`"5" == 5` is true, `null == undefined` is true), `===` compares without conversion. **Use `===`** (the one useful exception is `x == null`, which tests for both `null` and `undefined`).
- **Truthy and falsy:** the falsy values are `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN`. Everything else is truthy, **including `"0"`, `"false"`, `[]` and `{}`**.
- **`NaN`** is not equal to itself. Test it with `Number.isNaN(x)` (not the global `isNaN`, which converts first).
- **`typeof`** gives `"number"`, `"string"`, `"boolean"`, `"undefined"`, `"symbol"`, `"bigint"`, `"function"` and `"object"` (also for arrays and `null`). Use `Array.isArray(x)` for arrays.
- **Coercion puzzles:** `"5" + 3` is `"53"` (`+` concatenates if either side is a string) but `"5" - 3` is `2`. `[] + {}` is `"[object Object]"`. These are popular questions, and the answer is always "the engine converts to a primitive, then applies the rule", not a trick to memorise.
- **Operators worth knowing:** **optional chaining** `user?.address?.city` stops at `null`/`undefined`, **nullish coalescing** `a ?? b` falls back only for `null`/`undefined` (unlike `a || b`, which also replaces `0` and `""`), and `??=`, `||=`, `&&=` assign conditionally.

## Variables: var, let, const and hoisting {#variables}

| | `var` | `let` | `const` |
| --- | --- | --- | --- |
| scope | **function** | **block** | **block** |
| reassign | yes | yes | no (the binding, not the object) |
| redeclare | yes | no | no |
| hoisting | yes, initialised to `undefined` | yes, but in the **temporal dead zone** | the same as `let` |

- **Hoisting:** declarations are processed before the code runs, so you can call a function declared later in the scope. A `var` is visible from the top of its function (value `undefined` until assigned). A `let` or `const` exists from the top of its block but **cannot be used before its declaration**: that gap is the **temporal dead zone (TDZ)**, and touching the variable throws a `ReferenceError`.
- **`const` is not immutability:** `const accounts = []; accounts.push(a)` is fine, because the binding cannot change but the array can. Use `Object.freeze` (shallow) for a read-only object.
- **Default to `const`**, use `let` when you must reassign, and avoid `var`. The loop trap in the first scene (`var` shares one variable across iterations) is the reason.
- **Globals:** a variable assigned without a declaration becomes a global in sloppy mode. **Strict mode** (`"use strict"`, and automatically in ES modules and classes) turns that into an error and makes `this` `undefined` in a plain function call.

## Functions {#functions}

Functions are **first-class values**: you can store them in variables, pass them as arguments and return them, which is the basis for callbacks, closures and React hooks.

```javascript
function add(a, b) { return a + b; }            // declaration: hoisted with its body
const sub = function (a, b) { return a - b; };  // expression: not usable before this line
const mul = (a, b) => a * b;                    // arrow: short, no own this, arguments or new
const fee = (amount, rate = 0.02) => amount * rate;      // default parameter
const total = (...amounts) => amounts.reduce((s, a) => s + a, 0);   // rest parameter
Math.max(...[3, 9, 4]);                          // spread an array into arguments
```

- **Arrow functions** have no `this`, no `arguments` and cannot be used with `new`. They are ideal for callbacks and array methods, and a poor choice for object methods or constructors.
- **Parameters** are passed by value, but for objects the value is a reference, so a function can change an object you pass (the same as Java).
- **Missing arguments** are `undefined`, extra ones are ignored. There is **no overloading**: one name, one function.
- **Higher-order functions** take or return functions (`map`, `filter`, `setTimeout`, a debounce wrapper). Compare with Java's lambdas and functional interfaces ([functional Java](lesson:java-functional)).
- **IIFE** (immediately invoked function expression) `(() => { ... })()` creates a private scope, mostly replaced by modules and blocks.

## Scope and closures {#closures}

The first scene shows it. **Scope is lexical**: a function sees the variables of the scopes **where it was written**, from the innermost outward (the **scope chain**).

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
- **Uses:** private state (module pattern, factories), callbacks that remember data (`setTimeout`, event handlers), partial application and currying, memoization, `once`, debounce and throttle, and React **hooks** (a component function's variables captured by an effect).
- **Pitfalls:** the **loop with `var`** (every callback sees the final value, fix with `let` or a function scope), **stale closures** in React effects and timers (a callback captured an old value), and **memory leaks** when a long-lived closure holds a large object.
- **Java comparison:** an inner class or lambda can capture only effectively final variables, so it captures a value. A JavaScript closure captures the **variable itself** (a live binding), which is why it can change it.

## this {#this}

`this` is set **when the function is called**, not where it is written (the second scene). The rules, in order of priority:

1. **`new Fn()`**: `this` is the new object.
2. **Explicit**: `fn.call(obj, a)`, `fn.apply(obj, [a])`, or a function made by `fn.bind(obj)`.
3. **Method call**: `obj.method()` makes `this` the object before the dot.
4. **Plain call**: `fn()` gives `undefined` in strict mode (and in modules and classes), or the global object in sloppy mode.
5. **Arrow function**: no `this` of its own, it uses the `this` of the enclosing scope, and `call`/`bind` cannot change it.

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

This is exactly the **"lost `this`"** bug in React class components (`onClick={this.handle}`), which is one reason function components with hooks replaced them.

## Objects, prototypes and classes {#prototypes}

An object is a bag of key-value pairs. Every object has an internal link to a **prototype** object, and a property read walks that **prototype chain** until it finds the key or reaches `null` (the third scene).

```javascript
const base = { greet() { return `hello ${this.name}`; } };
const user = Object.create(base);        // prototype is base
user.name = 'Asha';
user.greet();                            // found on base, this is user
Object.getPrototypeOf(user) === base;    // true
Object.hasOwn(user, 'greet');            // false: inherited, not own
```

- **`class`** is syntax over prototypes. Methods go on `Class.prototype`, `extends` links two prototypes, and `super` calls up the chain. A class is still a function, and `typeof Account` is `"function"`.
- **Class features:** `constructor`, `static` members, getters and setters, **private fields `#balance`** (real privacy, unlike a naming convention), and `static` blocks.
- **No class hoisting** the way functions have: a class is in the TDZ before its declaration.
- **`instanceof`** walks the prototype chain. `Object.keys` lists own enumerable keys, while `for...in` also lists inherited ones (rarely what you want).
- **Composition over inheritance** is the common JavaScript advice, with plain objects, factory functions and mixins, just as in Java.
- **Object helpers:** `Object.keys/values/entries`, `Object.fromEntries`, `Object.assign`, `Object.freeze`, property descriptors with `Object.defineProperty`, and computed keys `{ [key]: value }`.

## Values, references and copies {#references}

The last scene summarises it: **primitives are copied, objects are shared by reference**, and `===` on objects compares references.

```javascript
const a = { name: 'Asha', address: { city: 'Singapore' } };
const shallow = { ...a };                 // new top-level object, shared address
shallow.address.city = 'Sydney';          // a.address.city is now 'Sydney' too
const deep = structuredClone(a);          // fully separate (dates, maps, sets, cycles)
```

- **Shallow copies:** spread (`{ ...obj }`, `[...arr]`), `Object.assign`, `slice`, `Array.from`.
- **Deep copy:** `structuredClone` (built in, cannot copy functions or class instances' methods), or a library, or `JSON.parse(JSON.stringify(x))`, which loses `undefined`, functions, dates (they become strings), `Map`, `Set` and fails on cycles.
- **Immutable updates:** instead of mutating, build a new object: `{ ...state, count: state.count + 1 }`, `[...list, item]`, `list.filter(...)`. React and Redux depend on this, because they detect change by comparing references.
- **Equality of objects:** `{} === {}` is false, two different objects. To compare content write a function or use a library.
- **Newer non-mutating array methods:** `toSorted`, `toReversed`, `toSpliced`, `with` return copies, unlike `sort`, `reverse`, `splice` (which change the array and return it).

## Destructuring, spread and rest {#destructuring}

```javascript
const { id, owner: { name }, balance = 0 } = account;        // objects, nested, default
const [first, , third, ...others] = list;                     // arrays, skip, rest
const [x, y] = [y, x];                                        // swap
function open({ owner, currency = 'SGD' } = {}) { ... }       // destructured parameter with a default
const merged = { ...defaults, ...overrides };                 // later keys win
```

Destructuring pulls values out by name (objects) or position (arrays). Spread expands an iterable or object into another, and rest collects the remainder.

## Arrays, iteration, Map and Set {#collections}

- **Array methods that return new arrays:** `map`, `filter`, `slice`, `concat`, `flat`, `flatMap`, `toSorted`. `reduce` folds to one value. `find`, `findIndex`, `some`, `every`, `includes`, `at(-1)` read.
- **`sort` pitfall:** the default sort **converts to strings** (`[10, 9, 1].sort()` gives `[1, 10, 9]`) and sorts **in place**. Pass a comparator: `(a, b) => a - b`.
- **Loops:** `for...of` iterates **values** of any iterable (arrays, strings, maps, sets), `for...in` iterates **keys** including inherited ones (avoid it on arrays), `forEach` cannot `break` or work with `await` the way you expect.
- **`Map` and `Set`:** `Map` has any key type and keeps insertion order (use it instead of an object for dictionaries with changing keys), `Set` stores unique values, and ES2025 adds `union`, `intersection` and `difference`. `WeakMap` and `WeakSet` hold keys weakly (they do not stop garbage collection), good for caches keyed by objects. Compare with Java's `HashMap` and `HashSet` ([collections](lesson:java-collections)).
- **Iterators and generators:** anything with `[Symbol.iterator]` works with `for...of` and spread, and `function*` with `yield` makes lazy sequences. Compare with Java streams ([streams](lesson:java-streams)), but these evaluate step by step as you pull values.
- **`Object.groupBy(list, fn)`** groups into an object, and `Map.groupBy` into a map.

## Modules {#modules}

| | **ES modules (ESM)** | **CommonJS (CJS)** |
| --- | --- | --- |
| syntax | `import x from './x.js'`, `export` | `require('./x')`, `module.exports` |
| loading | static, resolved before running, **tree-shakeable** | dynamic, at run time |
| `this` at top level | `undefined` | `module.exports` |
| strict mode | always | opt in |
| where | browsers, bundlers, modern Node.js (`"type": "module"`) | older Node.js code |

- **Named and default exports:** `export const x`, `export default f`. Prefer **named exports**, which are easy to find and refactor, and keep default for a single main thing (a React component).
- **Live bindings:** an imported name reflects later changes in the exporting module, it is not a copy.
- **Dynamic `import()`** returns a promise and loads code on demand, the basis for **code splitting** and lazy loading.
- **Each module has its own scope**, so a top-level variable is not a global. Circular imports work but can see uninitialised values.
- **Compare with Java:** modules are closer to packages and the Java module system, but there is no classpath, and a bundler (Vite, webpack) combines and trims the code for the browser.

## Errors, JSON and dates {#errors}

- **Errors:** `throw new Error('message')` (you can throw anything, but throw `Error` objects for the stack trace), `try/catch/finally`, subclass `Error` for your own types, and attach the cause: `new Error('failed', { cause: err })`. There are no checked exceptions.
- **JSON:** `JSON.stringify(value)` (skips `undefined` and functions, calls `toJSON`, throws on cycles) and `JSON.parse(text)` (throws on bad input, so wrap it). Parsing never gives you class instances or dates, only plain data.
- **Dates:** `Date` is mutable, treats months as 0 to 11 and mixes local and UTC, so use ISO strings (`toISOString`), keep times in UTC, and consider a library or the newer **Temporal** API for calculations.
- **Optional catch binding** `catch { ... }` when you do not need the error.

## Common coding questions {#coding-questions}

Interviewers like short function-writing tasks that test closures and `this`: **debounce and throttle**, **memoize**, **curry**, **once**, **deep clone**, **flatten an array**, **group by**, **implement `bind`, `map` or `Promise.all`**, **event emitter**. Three of them are in the coding questions below. State the edge cases (arguments, `this`, cleanup, cycles), as you would in Java.

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

`===` compares value and type with no conversion, so `"5" === 5` is false. `==` converts the operands to a common type first, so `"5" == 5` is true, and `null == undefined` is true but `null == 0` is false. The rules of `==` are hard to remember and cause bugs, so use `===`, with `x == null` as the one common exception to check for null or undefined together.

### [basic] What is the difference between `var`, `let` and `const`? {#var-let-const-q}

`var` is function-scoped, can be redeclared and is hoisted as `undefined`. `let` and `const` are block-scoped, cannot be redeclared, and exist in a temporal dead zone from the start of the block until their declaration, so using them early throws a ReferenceError. `const` forbids reassigning the binding but the object it holds can still change. Use `const` by default, `let` when needed, and not `var`.

### [basic] What is hoisting? {#hoisting-q}

Declarations are registered before the code runs, so they are usable earlier in their scope. A function declaration is hoisted with its body, so you can call it before it appears. A `var` is hoisted but holds `undefined` until its line runs. `let`, `const` and `class` are hoisted too but stay in the temporal dead zone, so using them before the declaration throws. Function expressions and arrow functions follow the rule of the variable that holds them.

### [basic] What are the falsy values in JavaScript? {#falsy-q}

`false`, `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN`. Everything else is truthy, including the strings `"0"` and `"false"`, an empty array and an empty object. Be careful with `||` for defaults, since it also replaces a valid `0` or empty string, so use `??` when only null and undefined should fall back.

### [basic] What is a closure? {#closure-q}

A function bundled with the lexical scope in which it was created, so it can still read and change those variables after the outer function has returned. For example `makeCounter` returns a function that increments a private `count`, and each call to `makeCounter` gets its own count. Closures give private state, factories and callbacks that remember context, and they are behind debounce, memoize and React hooks.

### [basic] What does `this` refer to in JavaScript? {#this-q}

It is decided by how the function is called: the new object for `new`, the given object for `call`, `apply` and `bind`, the object before the dot for a method call, `undefined` (strict mode) or the global object for a plain call, and the surrounding `this` for an arrow function, which has none of its own. A method passed as a callback loses its object, which is why you bind it, wrap it in an arrow function, or use an arrow class field.

### [basic] How do arrow functions differ from normal functions? {#arrow-q}

They have a shorter syntax, no own `this` (they use the enclosing one), no `arguments` object, cannot be used as constructors with `new`, and have no prototype property. That makes them good for callbacks and array methods and wrong for object methods and constructors, where you want a `this` that depends on the call.

### [intermediate] Why do all callbacks print 3 in a loop with `var` and how do you fix it? {#loop-q}

`var i` is one variable for the whole function, and the callbacks run later, after the loop has finished with `i` equal to 3, so all of them read that same variable. With `let i` each iteration creates a new binding that the callback closes over, so they print 0, 1 and 2. Before `let` the fix was an IIFE that passed `i` in as a parameter.

### [intermediate] How does prototypal inheritance work? {#prototype-q}

Each object has an internal prototype link to another object. When a property is read and not found on the object, the engine follows the link and tries the prototype, then its prototype, to the end of the chain at `null`. Methods shared by many instances live on the prototype, so they exist once. `class` and `extends` are syntax over this: methods go on `Class.prototype`, and `extends` links the two prototypes. Writing a property always writes on the object itself and shadows an inherited one.

### [intermediate] What is the difference between shallow and deep copy, and how do you make each? {#copy-q}

A shallow copy duplicates only the top-level object, so nested objects and arrays are still shared with the original and a change inside them shows in both. Spread, `Object.assign`, `slice` and `Array.from` make shallow copies. A deep copy duplicates everything: use `structuredClone`, which handles dates, maps, sets and circular references but not functions, or a library. `JSON.parse(JSON.stringify(x))` also works for plain data but drops `undefined`, functions and turns dates into strings.

### [intermediate] What does `call`, `apply` and `bind` do? {#bind-q}

All three set `this` explicitly. `call(thisArg, a, b)` runs the function now with arguments listed, `apply(thisArg, [a, b])` runs it now with an array of arguments, and `bind(thisArg, a)` returns a new function with `this` (and optionally leading arguments) fixed, to be called later. A bound function cannot be rebound, and `bind` is what makes a method safe to pass as a callback.

### [intermediate] What is the difference between `for...in` and `for...of`? {#for-in-q}

`for...of` iterates the values of any iterable (arrays, strings, maps, sets, generators). `for...in` iterates the enumerable string keys of an object, including inherited ones, so on arrays it gives index strings and can include added properties. Use `for...of` for arrays and iterables, and `Object.keys`, `Object.entries` or `for...in` with `Object.hasOwn` for plain objects.

### [intermediate] Why does `[10, 9, 1].sort()` return `[1, 10, 9]`? {#sort-q}

The default comparison converts elements to strings and compares them in code-unit order, so `"10"` comes before `"9"`. It also sorts in place and returns the same array. Pass a comparator such as `(a, b) => a - b` for numbers, and use `toSorted` to get a sorted copy without changing the original.

### [intermediate] What is the difference between ES modules and CommonJS? {#modules-q}

ES modules use `import` and `export`, are analysed statically before the code runs (so bundlers can tree-shake unused exports), are always strict, and export live bindings. CommonJS uses `require` and `module.exports`, loads synchronously at run time and exports a value copy. Browsers and modern Node.js (with `"type": "module"`) support ES modules, and a lot of older Node.js code is CommonJS. Dynamic `import()` loads a module lazily and returns a promise.

### [intermediate] What is the difference between `null` and `undefined`, and how do `??` and `?.` help? {#null-q}

`undefined` means a value was never given (missing property, unset variable, no return), and `null` is an explicit "no value". `a ?? b` returns `b` only when `a` is null or undefined, so `0` and `""` stay valid, unlike `||`. `user?.address?.city` returns `undefined` instead of throwing when something along the path is null or undefined, and it also works for calls and indexes (`fn?.()`, `list?.[0]`).

### [deep] Why does `const` not make an object immutable, and how would you make one? {#const-q}

`const` fixes the binding, so you cannot assign the variable again, but the object it refers to can still change. To block changes use `Object.freeze`, which makes the top level read-only (silently in sloppy mode, with an error in strict mode), but nested objects stay mutable unless you freeze them recursively. In application code the more common approach is to never mutate: create new objects with spread, `map` and `filter`, which is what React and Redux require.

### [deep] Explain a stale closure and how it shows up in practice. {#stale-q}

A closure captures variables, but a callback created in one run of a function sees the values of that run. If it stays alive, for example in `setInterval`, an event listener or a React effect that never updates, it keeps using the old values (such as an old `count`) while the variable in a newer run has moved on. Fix it by recreating the callback when its inputs change (dependency arrays in React effects), reading the latest value through a ref, or using a functional state update, and by cleaning up timers and listeners.

### [deep] How would you explain how `new` works? {#new-q}

`new Fn(args)` creates a fresh empty object whose prototype is `Fn.prototype`, calls `Fn` with `this` set to that object, and returns the object unless the constructor explicitly returns another object. You can write it as a function: create with `Object.create(Fn.prototype)`, call with `Fn.apply(obj, args)`, and return the result if it is an object, otherwise `obj`. A class constructor does the same but cannot be called without `new`.

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

Explain: both return a new function that **closes over** private state (`timer`, `last`); **debounce** runs only after calls have stopped for the wait time (typing in a search box), **throttle** runs at most once per interval (scroll and resize handlers); a regular `function` is returned so `this` is passed through with `apply`, and the arrow function inside keeps that `this`; and edge cases to mention are leading and trailing options, a `cancel` method, and clearing the timer when a React component unmounts.

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

Explain: the **closure** keeps the cache private for each memoized function; the key is built from the arguments (`JSON.stringify` works for plain values, pass a custom `key` for objects or use nested `Map`s); a `Map` is used instead of an object because keys can be any string and it keeps insertion order, which makes a simple **LRU** eviction possible with a size limit so the cache cannot grow forever; and memoization is only valid for **pure** functions (the same input always gives the same output with no side effects). For promises, cache the promise itself and remove it on failure. In React the equivalents are `useMemo` and `React.memo`.

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

Explain: primitives (and functions, which are shared) return at once; a **`WeakMap` of already copied objects** handles **circular references** and shared references, because the copy is registered before its children are copied; dates, regular expressions, maps and sets need their own cases because copying their properties would not copy their contents; plain objects keep their **prototype** with `Object.create(Object.getPrototypeOf(value))`; and `Reflect.ownKeys` includes symbol keys. In real code use the built-in **`structuredClone(value)`**, which does all this (except functions and class prototypes), and say so first before writing your own.
