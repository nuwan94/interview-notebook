---
title: TypeScript — types, narrowing, generics and utility types
nav: TypeScript
slug: ts-essentials
summary: TypeScript for React and Node.js interviews, how the compiler works and what types do not do at run time, basic and special types (any, unknown, never, tuples, literals, enums and unions), interface against type, structural typing, unions, intersections and discriminated unions, narrowing and type guards with exhaustive checks, functions and overloads, generics with constraints, utility types, mapped, conditional and template literal types, classes, modules and declaration files, tsconfig strict options, validating data at the boundary, compared with Java, with examples and interview questions.
tags: [TypeScript, Types, Generics, Narrowing, Utility types, tsconfig, Full stack]
order: 63
topic: Full stack / JavaScript and TypeScript
updated: 2026-11-26
subnav: true
---

React and Node.js teams use TypeScript by default, so interviews ask about it directly. Expect questions like these:

- What does TypeScript add to JavaScript, and what can it not do?
- What is the difference between `any` and `unknown`, and between `interface` and `type`?
- How do narrowing and discriminated unions work?
- What are generics and utility types for?
- What does `strict` turn on?
- How do you type data that comes from the network?

This lesson assumes [JavaScript essentials](lesson:js-essentials#types) and [async JavaScript](lesson:js-async#promises). It compares with Java throughout ([generics](lesson:java-generics#generic-types)). Play the four scenes: build-time types, shapes and narrowing, generics and utility types, and strict null checks.

```demo
name: ts-walk
```

> **One sentence to remember:** *TypeScript checks your code at build time, then erases every type.*

So it prevents mistakes inside the program. But it cannot trust data that arrives at run time, so validate that data at the boundary.

## What TypeScript is {#what}

TypeScript is a **superset of JavaScript** with a **static type system**. The compiler does two separate jobs. The compiler is `tsc`, or a bundler such as Vite, esbuild or SWC that strips types.

1. It **type checks** the code and reports errors.
2. It **emits plain JavaScript**, with all types **erased**.

- **Types exist only at build time.** There is no run-time type information. There is no `instanceof` for interfaces, no reflection on types, and no automatic validation of JSON. This is the biggest difference from Java.
- **Valid JavaScript is valid TypeScript.** So you can adopt it gradually: rename a file to `.ts`, and tighten over time (`allowJs`, `checkJs`).
- **Type errors do not stop the emit** by default (`noEmitOnError` changes that). But CI runs `tsc --noEmit` and fails the build.
- **Type inference** means you write fewer annotations. `const total = 5` is a `number`, and a function's return type is inferred. **Annotate** function parameters, exported APIs, and places where inference is too wide.
- **Structural, not nominal.** The **shape** of a type decides compatibility, not its name (next sections).
- **Not erased:** `enum`, `namespace` and parameter properties produce JavaScript. Most other syntax disappears. Recent Node.js versions can run `.ts` files by stripping types (erasable syntax only). But projects still type check with `tsc`.

## Basic and special types {#basics}

```typescript
const id: string = 'P-100';
const amount: number = 25.5;
const active: boolean = true;
const tags: string[] = ['gold'];                    // or Array<string>
const pair: [string, number] = ['SGD', 100];        // tuple: fixed length and types
const big: bigint = 123n;
let anything: any;                                   // opts out of checking: avoid
let input: unknown;                                  // anything, but must be checked before use
function fail(msg: string): never { throw new Error(msg); }   // never returns
function log(msg: string): void { console.log(msg); }          // returns nothing useful
```

- **`any` against `unknown`.**
  - `any` switches checking off, and it **spreads**: a value derived from an `any` is `any`.
  - `unknown` is the **type-safe** top type. You may assign anything to it, but you must narrow it (`typeof`, a type guard, a validator) before using it.
  - Use `unknown` for parsed JSON, caught errors and generic inputs. **Ban `any`** with lint rules.
- **`never`** is the empty type. It is the type of a function that always throws, or of a value that cannot exist, such as what is left after narrowing everything. It is used for **exhaustive checks**.
- **`null` and `undefined`** are separate types under `strictNullChecks` (see [strict mode](#strict)).
- **Literal types.** `'ok'`, `404` and `true` are types. `type Currency = 'SGD' | 'USD' | 'EUR'` limits a value to those strings, and gives autocomplete.
- **`as const`** freezes a literal to its narrowest type. `const roles = ['admin', 'user'] as const` is `readonly ['admin', 'user']`, and `typeof roles[number]` is `'admin' | 'user'`.
- **`satisfies`** (TS 4.9) checks a value against a type **without widening** it. `const config = { port: 80 } satisfies Config` keeps `port` as a `number` literal, and still validates the shape.
- **Type assertions.** `value as Account` tells the compiler to trust you. It **does not check or convert** anything. Use it rarely, and never on external data. `value!` (the non-null assertion) is the same kind of promise about `null`.
- **Enums.** `enum Status { Active, Closed }` generates run-time code, and numeric enums accept any number. Prefer a **union of string literals** (`'active' | 'closed'`) or an `as const` object. They erase cleanly and are easier to serialise.

## Objects, interface and type {#objects}

```typescript
interface Account {
  readonly id: string;           // cannot be reassigned
  owner: string;
  nickname?: string;             // optional: string | undefined
}

type Money = { amount: number; currency: Currency };
type Result = { status: 'ok'; value: Money } | { status: 'error'; message: string };   // a union
type AccountWithLimit = Account & { limit: number };                                  // an intersection
```

| | `interface` | `type` |
| --- | --- | --- |
| object shapes | yes | yes |
| `extends` / intersection | `extends` (clear errors) | `&` |
| declaration merging (same name twice) | **yes** (used to augment libraries) | no |
| unions, tuples, primitives, mapped and conditional types | no | **yes** |
| classes can `implements` it | yes | yes (object types) |

A common rule: **`interface` for object shapes that others may extend, `type` for everything else**. That covers unions, utilities and function types. Both are acceptable, so be consistent. Both are erased.

- **Structural typing (the second scene).** A value is assignable if it has the required members. `{ id, amount, note }` fits `{ id, amount }`. A fresh **object literal** gets an extra check for **excess properties**, which catches typos. But a variable with the extra property is accepted.
- **`readonly`** is checked at compile time only. It does not freeze the object.
- **Index signatures.** `{ [key: string]: number }` and `Record<string, number>` describe dictionaries. With `noUncheckedIndexedAccess`, a lookup is `number | undefined`, which is honest.
- **Compare with Java.** Java types are **nominal**: a class must declare `implements`. TypeScript's are **structural**: it just has to fit. That is closer to duck typing. It also means unrelated types with the same shape are interchangeable.

## Unions, narrowing and discriminated unions {#narrowing}

A **union** `A | B` is a value of either type. You may only use what both have, until you **narrow**. Narrowing refines the type inside a branch:

```typescript
function format(value: string | number | Date | null) {
  if (value === null) return 'n/a';                 // equality
  if (typeof value === 'string') return value;      // typeof
  if (typeof value === 'number') return value.toFixed(2);
  return value.toISOString();                       // only Date is left
}
// also: instanceof, the in operator ('error' in result), truthiness, Array.isArray
```

A **discriminated union** gives every variant a literal field (the **discriminant**). Checking it narrows the whole object:

```typescript
type Result =
  | { status: 'ok'; value: number }
  | { status: 'error'; message: string };

function show(r: Result) {
  switch (r.status) {
    case 'ok': return r.value;            // r is the ok variant here
    case 'error': return r.message;       // and the error variant here
    default: { const _exhaustive: never = r; return _exhaustive; }   // fails to compile if a variant is added
  }
}
```

- **Exhaustiveness.** Assigning the leftover value to `never` makes the compiler flag any variant you forgot. That is the main reason to model states as discriminated unions, instead of many optional flags (`isLoading`, `error?`, `data?`).
- **User-defined type guards.** `function isMoney(x: unknown): x is Money { ... }` returns a boolean, and tells the compiler the type when it is true. **Assertion functions** `asserts x is Money` throw instead.
- **`in` and optional properties** narrow. But `typeof null === 'object'`, so check `null` first.
- **Compare with Java.** A discriminated union plays the role of a **sealed interface with records**, and a pattern-matching `switch`.

## Functions and generics {#generics}

```typescript
function first<T>(items: T[]): T | undefined { return items[0]; }   // T inferred from the argument
const a = first(['x', 'y']);           // string | undefined

interface HasId { id: string }
function byId<T extends HasId>(items: T[]): Map<string, T> {          // a constraint
  return new Map(items.map((item) => [item.id, item]));
}

function getProp<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; }   // keyof and indexed access
getProp({ id: 'A', balance: 10 }, 'balance');   // number
```

- **Generics** keep a relationship between types, such as input and output, or key and value. The third scene shows inference and constraints.
- **The building blocks of type-safe helpers:**
  - constraints `T extends X`;
  - defaults `<T = string>`;
  - **`keyof T`**, the union of a type's keys;
  - **indexed access** `T[K]`.
- **Functions.** Optional `x?: number`, defaults, rest `...args: string[]`, **overloads** (several call signatures, one implementation), `this` parameters, and function types `(a: number) => string`.
- **Return types.** Infer them for local functions. **Annotate exported ones**, so a change inside does not silently change the public type. `ReturnType<typeof fn>` extracts it.
- **Callbacks and `void`.** A callback typed `() => void` may return something. It is ignored.
- **Compare with Java generics.**
  - Both are erased at run time, so neither can do `new T()` or check `instanceof List<String>`.
  - TypeScript infers more.
  - It has **no wildcards** (use constraints and `readonly` arrays instead) and **no raw types**.
  - Its generics are **structural**. So `Box<Dog>` is assignable to `Box<Animal>` if the shape allows. Arrays are covariant here, which is a known unsoundness.

## Utility, mapped and conditional types {#utility}

**Utility types** come with the language. They build new types from existing ones:

| Type | Result |
| --- | --- |
| `Partial<T>` / `Required<T>` | all properties optional / required (update payloads) |
| `Readonly<T>` | all properties readonly |
| `Pick<T, 'a' \| 'b'>` / `Omit<T, 'a'>` | keep / remove properties (public views, DTOs) |
| `Record<K, V>` | an object with keys `K` and values `V` |
| `Exclude<U, X>` / `Extract<U, X>` / `NonNullable<T>` | filter a union |
| `ReturnType<F>` / `Parameters<F>` | a function's return type / parameter tuple |
| `Awaited<T>` | the type after awaiting a promise |

You build your own with **mapped**, **conditional** and **template literal** types:

```typescript
type Optional<T> = { [K in keyof T]?: T[K] };                       // mapped: iterate the keys
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };   // key remapping, template literal
type ElementOf<T> = T extends (infer U)[] ? U : never;              // conditional with infer
type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };   // recursive

type Event = 'click' | 'submit';
type Handler = `on${Capitalize<Event>}`;                            // 'onClick' | 'onSubmit'
```

- **Distributive conditional types** apply to each member of a union. `ToArray<string | number>` becomes `string[] | number[]`.
- **`typeof`** in a type position gets the type of a value (`type Config = typeof defaultConfig`). **`keyof typeof obj`** gives its keys.
- Keep type-level code **small and readable**. If a type needs a comment longer than the code, simplify the design. Libraries (React, Redux Toolkit, zod) use these features, so your application code does not have to.

## Classes {#classes}

```typescript
abstract class Account {
  #pin = 1234;                                   // real run-time private (ECMAScript)
  constructor(public readonly id: string, protected balance = 0) {}   // parameter properties
  abstract fee(): number;
  deposit(amount: number): void { this.balance += amount; }
}
class Savings extends Account implements Auditable {
  fee() { return 0; }
}
```

- **Access modifiers.** `public`, `protected` and `private` are **compile-time only**. Anyone can read a `private` field in JavaScript. `#field` is **truly private** at run time.
- **Parameter properties.** `constructor(public id: string)` declares and assigns a field in one step.
- `abstract`, `implements`, `readonly`, `override` and `static` work as in Java. But **classes are also structural**: any object with the same members satisfies the type.
- In **React and Node.js code**, plain functions, objects and types are used far more than class hierarchies.

## Modules, declaration files and tooling {#modules}

- **Modules.** `import` and `export` work as in ES modules. `import type { Account } from './types'` (or `import { type Account }`) imports only a type. It is **erased**, which avoids circular imports and keeps bundles small. `verbatimModuleSyntax` enforces it.
- **Declaration files `.d.ts`** describe the types of JavaScript code. Libraries ship their own, or you install **`@types/node`** or **`@types/react`** from DefinitelyTyped. `declare module '*.svg'` types non-code imports. **Declaration merging** augments a library, for example adding a field to Express's `Request`.
- **`tsconfig.json`** controls the compiler:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",       // or "NodeNext" for Node.js ESM
    "strict": true,                      // turns on the strict family (below)
    "noUncheckedIndexedAccess": true,    // array and record lookups may be undefined
    "exactOptionalPropertyTypes": true,  // an optional property cannot be set to undefined by accident
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,             // each file can be compiled alone (needed by Vite, esbuild, SWC)
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "noEmit": true                       // the bundler emits, tsc only checks
  },
  "include": ["src"]
}
```

- **Tools.** `tsc --noEmit` in CI. **ESLint with typescript-eslint** (`no-explicit-any`, `no-floating-promises`, `no-unsafe-*`). Prettier, and type-aware editors. **Project references** and incremental builds speed up large repositories.

## Strict mode and null safety {#strict}

`"strict": true` turns on a family of checks. The most important is **`strictNullChecks`** (the fourth scene). `null` and `undefined` are **not** members of every type. So a value that may be missing must say so (`Account | undefined`), and be handled before use.

- **`noImplicitAny`.** An untyped parameter is an error, not a silent `any`.
- **Other strict flags.**
  - `strictFunctionTypes` and `strictBindCallApply`.
  - `strictPropertyInitialization`: class fields must be set in the constructor.
  - `useUnknownInCatchVariables`: `catch (e)` is `unknown`, so narrow it with `e instanceof Error`.
- **Handling nullable values.** Use an `if` guard, optional chaining `a?.b`, a nullish default `a ?? 0`, or an early return. Avoid `!`.
- **Always start new code with `strict` on.** Turning it on later in a large codebase is possible, one flag at a time.

## Types and the real world {#runtime}

The compiler cannot see what happens at run time (the first scene). So **external data must be validated**. That includes JSON from an HTTP response, `localStorage`, environment variables, message queues and form input.

```typescript
import { z } from 'zod';

const Payment = z.object({
  id: z.string(),
  amount: z.number().positive(),
  currency: z.enum(['SGD', 'USD', 'EUR']),
});
type Payment = z.infer<typeof Payment>;            // the type comes from the schema: one source of truth

const payment = Payment.parse(await res.json());   // throws a ZodError if the shape is wrong
```

- **A schema library** (zod, valibot, io-ts) validates at run time and **derives the TypeScript type**. So the type and the check cannot drift apart. For small cases, write a **type guard** by hand.
- **`as` on a response** is a lie to the compiler. **`JSON.parse` returns `any`**, so assign it to `unknown`.
- **Share types between front end and back end.** Use a monorepo package, or generate them from an OpenAPI or GraphQL schema. Keep a runtime check on the receiving side.
- **Typing React and Node.js.** Props and state use interfaces or types. Hooks use generics (`useState<Account | null>(null)`). Event types look like `React.ChangeEvent<HTMLInputElement>`. Express handlers use `Request` and `Response`. The next lessons show them.

## For a Java developer {#java}

| Java | TypeScript |
| --- | --- |
| nominal types, `implements` is required | **structural** types, the shape decides |
| types exist at run time (`instanceof`, reflection) | types are **erased**, no run-time type information |
| `null` can be anywhere (without annotations) | `strictNullChecks` makes `T \| undefined` explicit |
| `enum` is a class | prefer string-literal unions, `enum` generates code |
| sealed interfaces and records with pattern matching | discriminated unions with `switch` and `never` checks |
| generics with wildcards, erased | generics with constraints, `keyof`, conditional types, erased |
| `Optional<T>` | `T \| undefined` and `?.` |
| compile errors stop the build | errors report but emit anyway unless `noEmitOnError` |
| Jackson validates and binds JSON to a class | `JSON.parse` gives `any`, validate with zod |
| Maven, JDK | npm or pnpm, `tsc`, a bundler |

Try it in the lab: [TypeScript: checked at compile time, gone at run time](lab:ts-types-erased).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| compile | types checked, then erased, none at run time |
| `any` / `unknown` | `any` disables checking, `unknown` forces narrowing, use `unknown` |
| `interface` / `type` | interface for extendable shapes, type for unions and computed types |
| structural | shape decides compatibility, excess property check on fresh literals |
| union | narrow with `typeof`, `instanceof`, `in`, equality, type guards |
| discriminated union | literal tag field plus `switch`, `never` for exhaustiveness |
| generics | `<T extends X>`, `keyof T`, `T[K]`, inference from arguments |
| utility | `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`, `Awaited` |
| assertions | `as` and `!` are unchecked promises, use sparingly |
| strict | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| boundary | validate external data with zod or a type guard, derive the type |

## Interview questions {#questions}

### [basic] What is TypeScript and how does it differ from JavaScript? {#what-q}

TypeScript is a superset of JavaScript that adds a static type system. The compiler checks types, then emits plain JavaScript with all types removed. So the browser or Node.js runs ordinary JavaScript.

It catches mistakes before the code runs: wrong argument types, missing properties, and unhandled `undefined`. It also gives better editor support and refactoring, and documents intent.

It adds no run-time behaviour. So it cannot validate data that arrives from outside.

### [basic] What is the difference between `any`, `unknown` and `never`? {#any-unknown-never-q}

- `any` turns off type checking for a value, and spreads to anything derived from it. So it hides bugs.
- `unknown` accepts any value, but you must narrow it before you can use it, with `typeof`, a type guard or a validator. It is the safe choice for external data and caught errors.
- `never` is the type with no values. It is the return type of a function that never returns. It is also what remains after all union members have been handled, which is used for exhaustive checks.

### [basic] What is the difference between `interface` and `type`? {#interface-type-q}

Both describe object shapes. Both can be extended (`extends` for interfaces, `&` for types), and implemented by classes.

Interfaces support declaration merging: two declarations with one name combine. That is how libraries are augmented.

Types can also name unions, tuples, primitives, and mapped or conditional types. Interfaces cannot.

A common convention: interfaces for extendable object shapes, and types for everything else. Both are erased at compile time.

### [basic] What is structural typing? {#structural-q}

Compatibility depends on the shape of a type, not on its name or declaration. If an object has all the members a type requires, with compatible types, it can be used as that type. It does not matter that it was never declared to implement it.

That differs from Java's nominal typing. A fresh object literal is also checked for extra properties, to catch typos.

### [basic] How do you narrow a union type? {#narrowing-q}

Use checks the compiler understands:

- `typeof`, `instanceof` and the `in` operator;
- equality and truthiness checks, and `Array.isArray`;
- a discriminant field in a discriminated union;
- user-defined type guard functions `x is T`.

Inside the guarded branch, the type is refined. So after `if (typeof v === 'string')`, you can call string methods on `v`.

### [basic] What does the `strict` flag do? {#strict-q}

It enables a set of strict checks together. The most important are:

- `strictNullChecks`: null and undefined are separate types, and must be handled;
- `noImplicitAny`;
- `strictFunctionTypes`;
- `strictPropertyInitialization`;
- `useUnknownInCatchVariables`.

New projects should always enable it. Extra flags such as `noUncheckedIndexedAccess` make array and record lookups possibly undefined.

### [intermediate] What is a discriminated union and why is it useful? {#discriminated-q}

It is a union whose members share a field with a literal type, the discriminant. An example is `status: 'ok' | 'error'`. Checking that field narrows the whole object to one member, so you can access that member's own properties safely.

It models states precisely. The alternative is several optional fields that can be inconsistent (`isLoading`, `data?`, `error?`).

With a `never` check in the default branch, the compiler reports any variant you forget when a new one is added.

### [intermediate] How do you make sure a `switch` handles every case? {#exhaustive-q}

Switch over a discriminated union. In the default branch, assign the value to a variable of type `never`: `const _x: never = value`.

- If all cases are handled, the value has type `never`, and it compiles.
- If a new variant is added and not handled, the value has that variant's type. That is not assignable to `never`, so the build fails at that line.

A helper `assertNever(x: never): never` that throws also gives a run-time safeguard.

### [intermediate] What are generics and what do constraints do? {#generics-q}

Generics let a function or type work with many types, while keeping the relationship between them. For example, `first<T>(items: T[]): T | undefined` returns the element type of its input. The type argument is usually inferred.

A constraint `T extends HasId` limits what T may be, so the body can rely on those members. `K extends keyof T` ties a key parameter to an object type, so `obj[key]` is typed correctly.

Like Java generics, they are erased at run time.

### [intermediate] Name some utility types and when you would use them. {#utility-q}

- `Partial<T>`: update payloads, where every field is optional.
- `Pick` and `Omit`: build a public view or a DTO from an entity.
- `Readonly<T>`: immutable data.
- `Record<K, V>`: dictionaries.
- `ReturnType` and `Parameters`: reuse a function's types.
- `Awaited<T>`: what a promise resolves to.
- `Exclude`, `Extract` and `NonNullable`: filter unions.

They avoid copy-pasting types. A change to the source type flows to the derived ones.

### [intermediate] Why is `as` dangerous, and what do you use instead for API data? {#assertion-q}

A type assertion tells the compiler to trust you, and checks nothing at run time. If the server returns a different shape, the program fails later, far from the cause.

For external data, parse it as `unknown` and validate it. Write a type guard, or define a zod (or similar) schema. A schema validates at run time and derives the TypeScript type from the same definition.

Use assertions only where you know something the compiler cannot, such as after a check it cannot follow.

### [intermediate] Should you use `enum` in TypeScript? {#enum-q}

Usually not. Enums generate run-time code, numeric enums accept any number, and they behave differently from the rest of the type system.

A union of string literals (`'active' | 'closed'`) or an `as const` object gives the same safety and autocomplete, with no generated code. It also serialises naturally in JSON.

Use an enum only to match an existing API, or when you need a run-time object that is also a type. Even then, prefer `const` objects.

### [intermediate] What is the difference between `private` and `#private`? {#private-q}

`private` is a TypeScript modifier. It is checked only at compile time, and disappears in the emitted JavaScript. So the field is still reachable at run time, through bracket access or from plain JavaScript.

`#field` is the ECMAScript private field. The engine enforces it at run time, so nothing outside the class can read it.

Use `#` when you need real encapsulation.

### [deep] How does `unknown` help with `catch` clauses and parsed JSON? {#catch-q}

With `useUnknownInCatchVariables` (part of `strict`), the variable in `catch (e)` is `unknown`, because anything can be thrown in JavaScript. You narrow it, for example `if (e instanceof Error) log(e.message)`. You do not assume it has a message.

`JSON.parse` returns `any`. So assign the result to `unknown`, and validate it before use.

This forces the checks that `any` would let you skip.

### [deep] How would you type a function that picks some properties from an object? {#pick-q}

Use generics with `keyof`: `function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>`.

- `K` is inferred as a union of the literal key names passed. It is constrained to real keys of `T`, so a misspelt key is a compile error.
- The return type `Pick<T, K>` is exactly the object with those properties, so the caller gets full type information.
- The implementation builds the object in a loop. It needs one assertion at the end, because the compiler cannot prove that an incrementally built object has the right type.

### [deep] What are mapped and conditional types? Give an example of each. {#mapped-conditional-q}

A **mapped type** builds an object type by iterating over keys: `type Optional<T> = { [K in keyof T]?: T[K] }`. That is how `Partial` works. You can add or remove modifiers like `readonly` and `?`, and remap keys with `as`.

A **conditional type** chooses a type with a test: `type ElementOf<T> = T extends (infer U)[] ? U : never`. It extracts an array's element type. Conditional types distribute over unions, so `ElementOf<string[] | number[]>` is `string | number`.

They let libraries derive types from other types.

### [deep] How would you share types between a React front end and a Node.js back end safely? {#share-q}

Put the shared types or schemas in one package of a monorepo. Or generate them from an OpenAPI or GraphQL schema, or from the back end's routes (tRPC style). Then both sides compile against the same definitions.

Types vanish at run time, so still validate at the boundary. The server validates incoming requests with a schema. The client validates or trusts the responses, according to the risk.

Version the contract, and keep changes backward compatible, as with any API ([API design](lesson:rest-api-design)).

### [coding] Model a payment lifecycle as a discriminated union with an exhaustive reducer. {#coding-union}

```typescript
type Payment =
  | { status: 'pending'; id: string; amount: number }
  | { status: 'settled'; id: string; amount: number; settledAt: Date }
  | { status: 'failed'; id: string; amount: number; reason: string };

type Event =
  | { type: 'settle'; at: Date }
  | { type: 'fail'; reason: string };

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

function reduce(payment: Payment, event: Event): Payment {
  switch (event.type) {
    case 'settle':
      if (payment.status !== 'pending') throw new Error(`cannot settle a ${payment.status} payment`);
      return { ...payment, status: 'settled', settledAt: event.at };     // payment is the pending variant here
    case 'fail':
      if (payment.status !== 'pending') throw new Error(`cannot fail a ${payment.status} payment`);
      return { status: 'failed', id: payment.id, amount: payment.amount, reason: event.reason };
    default:
      return assertNever(event);                                          // a new event type breaks the build here
  }
}

function describe(p: Payment): string {
  switch (p.status) {
    case 'pending': return `${p.id} is pending`;
    case 'settled': return `${p.id} settled at ${p.settledAt.toISOString()}`;   // settledAt exists only here
    case 'failed': return `${p.id} failed: ${p.reason}`;
    default: return assertNever(p);
  }
}
```

Explain these points:

- Each state carries **only the fields that exist in that state**. `settledAt` cannot be read on a pending payment, so impossible states cannot be represented.
- The `status` tag is the **discriminant**. It narrows `payment` inside each branch.
- `assertNever(event: never)` makes the compiler fail if a new `Event` or `Payment` variant is added without a case. It also throws at run time, as a second safety net.
- The reducer returns **new objects** instead of changing the old ones, as React and Redux require.
- Invalid transitions are rejected explicitly. The types alone cannot express that.

### [coding] Write type-safe generic helpers: `groupBy`, `pick` and a typed event emitter. {#coding-generics}

```typescript
export function groupBy<T, K extends PropertyKey>(items: readonly T[], key: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    (result[k] ??= []).push(item);
  }
  return result;
}

export function pick<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

type Listener<P> = (payload: P) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private listeners: { [E in keyof Events]?: Listener<Events[E]>[] } = {};

  on<E extends keyof Events>(event: E, listener: Listener<Events[E]>): () => void {
    (this.listeners[event] ??= []).push(listener);
    return () => { this.listeners[event] = this.listeners[event]?.filter((l) => l !== listener); };   // unsubscribe
  }

  emit<E extends keyof Events>(event: E, payload: Events[E]): void {
    this.listeners[event]?.forEach((l) => l(payload));
  }
}

// usage: everything is checked
const byCurrency = groupBy([{ id: 1, currency: 'SGD' }, { id: 2, currency: 'USD' }], (p) => p.currency);
const summary = pick({ id: 'A1', owner: 'Asha', balance: 10 }, 'id', 'owner');      // { id: string; owner: string }

const bus = new Emitter<{ settled: { id: string; amount: number }; failed: { id: string; reason: string } }>();
const off = bus.on('settled', (p) => console.log(p.amount));      // p is typed from the event name
bus.emit('failed', { id: 'P1', reason: 'limit' });                // a wrong payload is a compile error
```

Explain these points:

- `groupBy` infers the **key type `K`** from the callback. So the result is `Record<'SGD' | 'USD' ..., T[]>`.
- `pick` constrains `K extends keyof T`, so a misspelt key fails. The return type is exactly `Pick<T, K>`.
- The emitter's generic parameter maps **event names to payload types**. So `on` and `emit` give the listener and the payload the right types from the name alone. `Events[E]` is an **indexed access type**.
- `??=` creates the array on first use.
- The unsubscribe function is returned, as in React effects.
- The single `as` assertions mark the places where the compiler cannot see that an incrementally built object matches. They are kept inside the helper, so callers never need one.

### [coding] Write `DeepReadonly`, a `Getters` mapped type with template literal keys, and a type guard for unknown data. {#coding-types}

```typescript
type DeepReadonly<T> =
  T extends (infer U)[] ? ReadonlyArray<DeepReadonly<U>> :
  T extends Function ? T :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Account { id: string; owner: string; balance: number }

type ReadOnlyAccount = DeepReadonly<{ account: Account; tags: string[] }>;
// account.balance and tags[0] cannot be assigned

type AccountGetters = Getters<Account>;
// { getId: () => string; getOwner: () => string; getBalance: () => number }

// a type guard for data from outside: the compiler learns the type when it returns true
function isAccount(value: unknown): value is Account {
  return (
    typeof value === 'object' && value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).owner === 'string' &&
    typeof (value as Record<string, unknown>).balance === 'number'
  );
}

const raw: unknown = JSON.parse('{"id":"A1","owner":"Asha","balance":10}');
if (isAccount(raw)) {
  console.log(raw.balance.toFixed(2));     // raw is an Account here
}
```

Explain these points:

- `DeepReadonly` is a **recursive conditional type**. Arrays map to `ReadonlyArray`. Functions are left alone. Objects get every property `readonly`, and are recursed into. Primitives are returned as they are.
- `Getters` is a **mapped type with key remapping** (`as`) and a **template literal type**. So `balance` becomes `getBalance`.
- `value is Account` is a **user-defined type guard**. The `unknown` input forces the checks. The narrow `as Record<string, unknown>` stays inside the guard.
- For anything larger than this, a schema library (zod) writes the guard for you, and derives the type from the same definition.
