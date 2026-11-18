---
title: React core — components, JSX, props, state and rendering
nav: React core
slug: react-core
summary: The React fundamentals every interview starts with, declarative UI and the component tree, JSX rules, function components, props and children, composition, state with useState and why it is a snapshot, immutable updates, lifting state up, how rendering and reconciliation work with the render and commit phases, lists and keys, events and controlled forms, refs, purity and StrictMode, what is new in React 19, typing components with TypeScript, and the common bugs, with examples and interview questions.
tags: [React, JSX, Components, Props, State, Rendering, Keys, React 19, TypeScript, Full stack]
order: 63
topic: Full stack / React
updated: 2026-11-18
subnav: true
---

React is the front-end half of most full-stack interviews. The questions are rarely about syntax. They are *what a component is, how props and state differ, why state must not be mutated, what happens between a `setState` call and the screen, what a key is for, what a controlled input is, and why a component re-renders.* This lesson builds on [JavaScript essentials](lesson:js-essentials#closures) (closures and references are the cause of most React bugs) and [TypeScript](lesson:ts-essentials#basics), and the examples are TypeScript (`.tsx`). Hooks beyond `useState` (effects, memoization, context, reducers) are in the next lesson. Play the four scenes: render and commit, props and state, lists and keys, and state as a snapshot.

```demo
name: react-walk
```

> **One sentence to remember:** *A React component is a pure function from props and state to a description of the UI, state changes trigger a new render, React compares the new description with the old one and updates only the difference in the DOM, so never mutate state and give list items stable keys.*

## What React is {#what}

React is a **library for building user interfaces** from **components**. It is not a full framework: routing, data fetching and build tooling come from other libraries or from a framework built on React (Next.js, React Router in framework mode, Remix).

- **Declarative:** you describe **what the UI should look like for the current data**, and React works out how to change the page. You do not write `document.getElementById(...).textContent = ...` step by step (imperative).
- **Component-based:** the UI is a tree of small, reusable functions that return UI.
- **Unidirectional data flow:** data goes **down** the tree as props, and events go **up** as function calls.
- **Virtual DOM (the idea):** React keeps a lightweight description of the UI in memory, compares the new one with the previous one (**reconciliation**) and applies only the **minimal changes** to the real DOM. Real DOM updates are the expensive part.
- **React 19** (current) is the version these notes assume: function components with hooks (class components still work but are not used in new code), **Actions**, `use`, `ref` as a normal prop, and an optional **React Compiler** that memoizes automatically.
- **Where it runs:** in the browser (client-side rendering with `createRoot`), on the server (**server-side rendering**, **React Server Components** in frameworks like Next.js), or on mobile (React Native).
- **Compared with Java and Spring:** Spring MVC with Thymeleaf renders HTML **on the server per request**. React renders **in the browser** from JSON returned by an API, so the Spring service becomes a REST API ([REST design](lesson:rest-api-design)).

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);   // mounts the component tree
```

## JSX {#jsx}

**JSX** is syntax that looks like HTML inside JavaScript. A build step (Vite with esbuild or SWC, Babel) turns it into function calls (`jsx(...)`) that create **element objects**. JSX is not a string and not the DOM: it is a description.

```tsx
function Greeting({ name, unread }: { name: string; unread: number }) {
  return (
    <section className="greeting">                 {/* className, not class */}
      <h1>Hello, {name.toUpperCase()}</h1>          {/* any JavaScript expression in braces */}
      {unread > 0 && <p>{unread} new messages</p>}  {/* conditional rendering */}
      <label htmlFor="q">Search</label>             {/* htmlFor, not for */}
      <input id="q" style={{ width: 200 }} />       {/* style takes an object, tags must be closed */}
    </section>
  );
}
```

- **One root element** per return: wrap siblings in a parent or a **fragment** `<>...</>`.
- **Expressions, not statements:** inside `{}` you can put values, calls, ternaries, `&&`, `map`, but not `if` or `for`. Use them before the `return`.
- **Attribute names** are camelCase (`onClick`, `tabIndex`, `className`, `htmlFor`). Strings use quotes, everything else uses braces.
- **Escaping:** text in `{}` is escaped, which protects against XSS. `dangerouslySetInnerHTML` bypasses it and must only receive sanitised HTML ([security](lesson:authn-authz#attacks)).
- **Capitalised names are components** (`<Greeting />`), lowercase names are DOM elements (`<section>`).
- **Conditional rendering:** `cond && <X />`, `cond ? <A /> : <B />`, or an early `return null`. **Pitfall:** `{count && <X />}` renders the number `0` when `count` is 0, so use `count > 0 &&`.
- **Lists:** `items.map((item) => <Row key={item.id} item={item} />)` (see [keys](#keys)).

## Components and props {#components}

A **component** is a function that takes **props** and returns JSX (or `null`). Names start with a capital letter. Components are the unit of reuse.

```tsx
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
  onClick: () => void;                 // a callback prop: how the child talks to the parent
  children?: React.ReactNode;          // content between the tags
}

function Button({ label, variant = 'primary', disabled = false, onClick, children }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} disabled={disabled} onClick={onClick}>
      {children ?? label}
    </button>
  );
}

<Button label="Pay" onClick={() => pay(amount)} />
```

- **Props are read-only.** A component must never change its props (the object or the values inside). To change something the parent passes a function.
- **Destructuring and defaults** in the parameter list are the norm. Spread `{...props}` forwards props to a child element (use sparingly).
- **`children`** is a prop. It lets a component wrap arbitrary content, which is how layouts, cards and modals are built: **composition over inheritance**. React has no component inheritance.
- **Callback props** (`onClick`, `onChange`, `onSave`) are how a child notifies its parent. Name them `onXxx`, and the parent's handlers `handleXxx`.
- **Typing:** describe props with an `interface` or `type`. Use `React.ReactNode` for children, `React.ComponentProps<'button'>` to inherit a DOM element's props, and avoid `React.FC` (it adds nothing today).
- **Component identity:** **never define a component inside another component**, because it is a new function every render, so React sees a different type and **remounts** it, losing its state.
- **Compared with Java:** a component is like a stateless function (or a view model with state), props are its parameters, and there are no getters, no inheritance and no lifecycle methods to override in function components.

## State {#state}

**State** is data a component remembers between renders and that, when changed, makes the component render again. A plain local variable is **reset every render** and changing it does not update the screen.

```tsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);              // [current value, setter], initial value 0
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}
```

- **`useState(initial)`** returns the current value and a setter. The initial value is used **only on the first render**. For an expensive initial value pass a function: `useState(() => readFromStorage())`.
- **State is private to each component instance.** Two `<Counter />` elements have separate state. State lives in React, attached to the **position in the tree**, not in the function's variables.
- **State is a snapshot** (the fourth scene): during one render, `count` has one fixed value. Calling `setCount(count + 1)` three times in a handler gives `+1`, because each call uses the same snapshot. Use the **updater form** `setCount((c) => c + 1)` when the new value depends on the previous one.
- **Updates are batched** (React 18 and later, everywhere, including promises and timeouts), and the new value is visible on the **next render**, not on the next line.
- **Never mutate state.** React decides to re-render by comparing the new value with the old one **by reference** (`Object.is`). `items.push(x)` keeps the same array, so React may skip the update. Create new values:

```tsx
setItems([...items, newItem]);                                  // add
setItems(items.filter((i) => i.id !== id));                     // remove
setItems(items.map((i) => (i.id === id ? { ...i, done: true } : i)));   // update one
setUser({ ...user, address: { ...user.address, city: 'Singapore' } });  // nested object
```

  This is the [shallow copy](lesson:js-essentials#references) rule from JavaScript. For deeply nested state use **Immer** (`produce`) or flatten the state.
- **Do not copy props into state** (`useState(props.price)`), because it does not update when the prop changes. **Derive values during render** instead: `const total = items.reduce(...)`. Store the minimum, compute the rest.
- **Group related state** into one object or use `useReducer` (next lesson) when updates are complex. Avoid contradictory state (`isLoading` and `isError` and `data`), and model it as one `status` value.
- **Lifting state up** (second scene): when two components need the same data, move the state to their **closest common parent**, and pass the value and the setter (as a callback) down.

## Rendering and reconciliation {#rendering}

The first scene shows the pipeline. A render has **two phases**:

1. **Trigger:** the initial `createRoot().render()`, or a **state update** in a component (or its parent re-rendering).
2. **Render:** React **calls your component functions** to compute the new element tree. This phase must be **pure** and may be **paused, repeated or thrown away** (concurrent rendering).
3. **Commit:** React applies the **minimal changes** to the DOM, then the browser paints. `useLayoutEffect` runs before the paint, `useEffect` runs after it.

- **When does a component re-render?** When **its own state changes**, when **its parent re-renders** (even if its props are the same, unless wrapped in `memo`), or when a **context** it reads changes. A re-render means calling the function again, **not** necessarily changing the DOM. Re-rendering is cheap, and unnecessary DOM changes are what React avoids.
- **Reconciliation rules (the diff):** React compares trees level by level.
  - **Different element type** at a position (`<div>` to `<span>`, or `<A>` to `<B>`): the old subtree is **unmounted** (state lost) and a new one **mounted**.
  - **Same type** at the same position: the DOM node or component instance is **kept and updated**, with its state.
  - **Lists** are matched by **key**.
- **Purity:** given the same props and state, a component must return the same JSX, and must not change anything outside itself while rendering (no mutating variables, no network calls, no `Math.random()` or `Date.now()` in the output). **Side effects belong in event handlers or effects.**
- **`StrictMode`** (on in development by default in templates) renders components **twice** and re-runs effects once extra, to expose impurity and missing cleanup. It does nothing in production.
- **Performance:** measure first (React DevTools Profiler). The usual fixes are moving state down, splitting components, stable keys, `memo`, `useMemo`, `useCallback`, virtualised long lists, and the React Compiler. The next lesson covers them.

## Lists and keys {#keys}

```tsx
function PaymentList({ payments }: { payments: Payment[] }) {
  return (
    <ul>
      {payments.map((p) => (
        <li key={p.id}>{p.payee}: {p.amount}</li>   // key: a stable id, unique among siblings
      ))}
    </ul>
  );
}
```

- **A key identifies an item between renders**, so React can reorder, insert and remove the right DOM nodes and keep each item's **state** (the third scene).
- **Use a stable id from the data** (database id). **Do not use the array index** if the list can be reordered, filtered or inserted into, because the state then sticks to the position and shows on the wrong item. An index is acceptable for a static list that never changes.
- **Never generate keys during render** (`key={Math.random()}`): every render gets new keys, so every item is remounted.
- Keys are **not passed as props** (`props.key` is not available), and they only need to be unique **among siblings**.
- **A key resets state:** `<ProfileForm key={userId} />` makes React discard the old form and create a fresh one whenever the user changes, an alternative to resetting state in an effect.

## Events and forms {#events}

```tsx
function Transfer() {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();                                  // stop the browser's own form submission
    if (Number(amount) <= 0) return setError('Enter an amount above zero');
    setError(null);
    send(Number(amount));
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={amount}                                    // the input shows the state: a controlled input
        onChange={(e) => setAmount(e.target.value)}       // and the state follows the input
        inputMode="decimal"
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={!amount}>Send</button>
    </form>
  );
}
```

- **Handlers are functions you pass**, not calls: `onClick={handle}` or `onClick={() => handle(id)}`, never `onClick={handle(id)}` (that calls it during render).
- **Synthetic events** wrap the browser event with the same interface (`e.target`, `e.preventDefault()`, `e.stopPropagation()`), and React attaches listeners at the root (event delegation). Types: `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent`, `React.FormEvent`, `React.KeyboardEvent`.
- **Controlled inputs:** the **React state is the single source of truth**, the input's `value` comes from state and `onChange` updates it. Easy to validate, format and reset, but it renders on every keystroke.
- **Uncontrolled inputs:** the **DOM holds the value**. You read it with a ref or with `FormData` when submitting, and set a starting value with `defaultValue`. Simpler and faster for large forms and file inputs. React 19 form **Actions** (`<form action={fn}>`) work with uncontrolled fields.
- **Validation** on the client is for usability only. **Always validate again on the server** ([authentication](lesson:authn-authz#attacks)).
- **Forms with many fields:** a library (React Hook Form, with zod for the schema) keeps them uncontrolled and fast.

## Refs and the DOM {#refs}

`useRef` gives a **mutable box** `{ current }` that **survives renders and does not trigger a render when changed**. Two uses:

- **DOM access:** `const inputRef = useRef<HTMLInputElement>(null)`, `<input ref={inputRef} />`, then `inputRef.current?.focus()`. Use it for focus, scroll position, measuring and third-party widgets.
- **Instance values:** a timer id, the previous value, a flag that must not cause a render.
- In **React 19** a function component receives `ref` as an ordinary prop, so `forwardRef` is no longer needed.
- **Do not read or write `ref.current` during render.** Do it in handlers and effects.

## What is new in React 19 {#react19}

- **Actions:** async functions used in transitions and forms. `<form action={fn}>` calls it with the `FormData`, and React tracks the pending state. **`useActionState`** gives the result and pending flag, **`useFormStatus`** lets a child button know the form is submitting, and **`useOptimistic`** shows an expected result at once and rolls it back on failure.
- **`use`** reads a promise or a context during render (a promise suspends the component until it resolves, inside `<Suspense>`).
- **`ref` as a prop**, ref callbacks with cleanup, and **`<Context>` as a provider** (no `.Provider`).
- **Document metadata:** `<title>` and `<meta>` can be rendered inside components.
- **Server Components and Server Actions** (in frameworks such as Next.js): components that run only on the server and send results to the client, to cut JavaScript sent to the browser.
- **React Compiler** (a build-time plugin): adds memoization automatically, so manual `useMemo`, `useCallback` and `memo` are needed much less when components follow the rules of React (pure, no mutation).

## Rules of React and common bugs {#bugs}

| Mistake | What happens | Fix |
| --- | --- | --- |
| mutating state (`push`, `obj.x = 1`) | no re-render, stale UI, shared references | create new arrays and objects |
| index as key in a changing list | state on the wrong item | stable id key |
| `setCount(count + 1)` several times | only one increment | `setCount((c) => c + 1)` |
| defining a component inside a component | remounts every render, state lost | define at module level |
| calling the handler in JSX (`onClick={f()}`) | runs on every render | pass `() => f()` or `f` |
| copying props to state | state does not follow props | derive during render, or reset with a key |
| side effect in render (fetch, `Date.now()`) | repeats, breaks purity | event handler or effect |
| `{n && <X />}` with `n = 0` | renders `0` | `n > 0 && <X />` |
| hooks in a loop, `if`, or after a return | hooks mismatch, error | call hooks at the top level, in the same order |
| reading state right after `setState` | still the old value | use the new value you computed, or the next render |

**Rules of Hooks:** call hooks only at the **top level** of a component or a custom hook (never in conditions, loops or nested functions), and only from React functions. The order of hook calls must be the same every render, because React identifies state by call order. The `eslint-plugin-react-hooks` rules enforce it.

## For a Java developer {#java}

| Java and Spring | React |
| --- | --- |
| server renders HTML (Thymeleaf, JSP) | browser renders from JSON, an API serves the data |
| mutable objects, setters | immutable updates, new objects |
| a bean or view model per page | components with local state, state lifted up when shared |
| `@Autowired` dependency injection | props, context, hooks |
| inheritance and templates | composition and `children` |
| one request, one thread, then done | long-lived UI state in the browser, events over time |
| compile-time types (Java) | TypeScript props and state, erased at run time |
| Swing or JavaFX listeners | callback props and event handlers |

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| component | pure function of props and state returning JSX, capitalised name |
| props | read-only inputs, `children` and callbacks included |
| state | `useState`, a snapshot per render, update with new values, updater form for previous-based updates |
| render | trigger, render (pure), commit (DOM), effects after paint |
| re-render when | own state changes, parent re-renders, context changes |
| reconciliation | same type and position keeps state, different type remounts, lists by key |
| keys | stable ids among siblings, not index, not random, a changed key resets state |
| controlled input | `value` plus `onChange`, state is the source of truth |
| lifting state | move shared state to the closest common parent |
| refs | mutable box, DOM access, no re-render |
| React 19 | Actions, `use`, `ref` as a prop, Compiler, Server Components |

## Interview questions {#questions}

### [basic] What is React and what problem does it solve? {#what-q}

A JavaScript library for building user interfaces out of components. It lets you describe what the UI should look like for the current state, and it updates the DOM efficiently when the state changes, instead of you manipulating the DOM by hand. It gives a component model for reuse, one-way data flow that makes behaviour predictable, and an ecosystem for routing, data and state. It is a library, so structure beyond rendering comes from other tools or a framework such as Next.js.

### [basic] What is JSX? {#jsx-q}

A syntax extension that lets you write markup inside JavaScript. A compiler turns each tag into a function call that creates a plain object describing the element, so JSX is not HTML and not a string. Rules: one root (or a fragment), `className` and `htmlFor`, camelCase attributes, closed tags, and JavaScript expressions in braces. Text in braces is escaped, which protects against injection.

### [basic] What is the difference between props and state? {#props-state-q}

Props are inputs passed from a parent to a component and are read-only for that component. State is data owned and changed by the component itself, remembered between renders, and changing it triggers a re-render. A parent's state becomes its child's props. If something can be computed from props or other state, it should not be state at all.

### [basic] What is the virtual DOM and why does React use it? {#vdom-q}

A lightweight in-memory description of the UI as a tree of element objects. On each render React builds the new tree, compares it with the previous one (reconciliation), and applies only the differences to the real DOM, which is the expensive part. It lets you write declaratively without paying for rebuilding the whole page, though it is not magic: render work still happens, so performance depends on how much you render.

### [basic] Why do list items need keys? {#keys-q}

Keys let React identify each item between renders, so when items are added, removed or reordered it updates the right DOM nodes and keeps each item's state. A key must be unique among siblings and stable, normally an id from the data. Using the index breaks when the list changes, because state stays attached to a position and ends up on the wrong item, and random keys remount everything on every render.

### [basic] What is the difference between controlled and uncontrolled components? {#controlled-q}

A controlled input gets its value from React state and updates it in onChange, so the state is the single source of truth, which makes validation, formatting and resetting easy. An uncontrolled input keeps its value in the DOM, and you read it through a ref or FormData, with `defaultValue` for the starting value. Controlled is the default for most fields, uncontrolled suits large forms, file inputs and form libraries that avoid re-rendering on every keystroke.

### [intermediate] Why must you not mutate state directly? {#mutation-q}

React detects a change by comparing the new value with the old one by reference. If you mutate an array or object and pass the same reference to the setter, React sees no change and may skip the render, so the screen is stale. Mutation also breaks features that rely on previous values (memoization, effects dependencies, time travel in Redux) and changes data that other code may still hold. Create a new array or object with spread, `map`, `filter`, or use Immer.

### [intermediate] Why does `setCount(count + 1)` called three times add only one? {#snapshot-q}

State is a snapshot for each render. All three calls in the same handler read the same `count`, for example 0, so each queues "set to 1", and the result is 1. With the updater form `setCount((c) => c + 1)` each queued update receives the result of the previous one, so the result is 3. The new value also is not available on the next line, only in the next render.

### [intermediate] When does a component re-render? {#rerender-q}

When its own state changes, when its parent re-renders (even with unchanged props, unless it is wrapped in `memo` and the props are equal), and when a context value it consumes changes. A re-render only calls the function again. React then diffs the result and touches the DOM only where something changed. Setting state to the same value (by `Object.is`) usually bails out.

### [intermediate] What happens between calling `setState` and the UI updating? {#pipeline-q}

React schedules a render and batches updates made in the same event. In the render phase it calls the component functions with the new state to produce a new element tree, which must be pure. In reconciliation it diffs the new tree against the previous one. In the commit phase it applies the minimal changes to the DOM, runs layout effects, the browser paints, and then passive effects (`useEffect`) run. Rendering can be paused or restarted in concurrent mode, which is why render must have no side effects.

### [intermediate] What does React do when the element type or the key at a position changes? {#reconcile-q}

If the type changes (`<div>` to `<section>`, or one component to another) React unmounts the old subtree, destroying its state and DOM, and mounts a new one. If the type is the same it keeps the instance or DOM node and updates its props. For lists it matches by key, and a changed key means unmount and mount, which is why changing a key is a way to reset a component's state. This is also why you must not define a component inside another component.

### [intermediate] What is "lifting state up"? {#lifting-q}

When two or more components need the same data, you move the state to their closest common parent and pass the value down as props, with a callback prop so the children can request changes. This keeps one source of truth and keeps siblings in sync. If it means passing props through many layers, use composition (pass the child as `children`) or context, and keep state as low in the tree as possible.

### [intermediate] What are the Rules of Hooks and why do they exist? {#hooks-rules-q}

Call hooks only at the top level of a component or custom hook, never inside conditions, loops or nested functions, and only from React functions. React stores state by the order of hook calls in each render, so the order must be identical every time, and a conditional hook shifts the order and mixes up the state. The `react-hooks` ESLint rules enforce this.

### [intermediate] What is `StrictMode` and why does my component render twice in development? {#strict-q}

`StrictMode` is a development-only wrapper that double-invokes component functions (and re-runs effects once extra) to expose impure rendering and missing effect cleanup. It does nothing in production builds. If double rendering breaks something, a render has a side effect, such as mutating a variable outside the component, which should be fixed rather than hidden.

### [deep] How would you explain composition and why React favours it over inheritance? {#composition-q}

Components are customised by passing other components or elements as props or `children`, instead of extending a base component. A `Card` renders `{children}`, a `Layout` takes `header` and `sidebar` props, and a specialised `DangerButton` renders a `Button` with a preset prop. It keeps components small, avoids deep hierarchies and hidden shared state, works with function components and is type-friendly. Behaviour reuse comes from custom hooks, not from superclasses.

### [deep] A text input inside a list loses what the user typed, or shows it on the wrong row. What are the likely causes? {#input-bug-q}

Either the keys are wrong or the component is being remounted. Index keys make state stick to the position when items are inserted or reordered, so the text appears on another row. Random or changing keys, or a component defined inside another component, make React see a new element each render and remount it, which drops its state and focus. Use stable id keys, define components at module level, and check the Profiler or a mount log to confirm remounts.

### [deep] When would you use state, a ref, or a derived value? {#state-ref-derived-q}

State for data that affects what is rendered and must trigger a render when it changes. A ref for a value that must persist between renders but must not cause a render (a timer id, a DOM node, the previous value). A derived value, computed during render from props and state, for anything that can be calculated, such as a filtered list or a total, because storing it duplicates the source of truth and can go out of sync.

### [coding] Build a todo list with add, toggle and remove using immutable updates and stable keys. {#coding-todo}

```tsx
import { useState } from 'react';

interface Todo { id: string; text: string; done: boolean }

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState('');

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setTodos((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed, done: false }]);   // new array, id made once
    setText('');
  }

  const toggle = (id: string) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));        // new object for one item

  const remove = (id: string) => setTodos((prev) => prev.filter((t) => t.id !== id));

  const remaining = todos.filter((t) => !t.done).length;                                       // derived, not stored

  return (
    <form onSubmit={add}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing?" />
      <button type="submit" disabled={!text.trim()}>Add</button>

      <ul>
        {todos.map((t) => (
          <li key={t.id}>                                                                       {/* stable key from the data */}
            <label style={{ textDecoration: t.done ? 'line-through' : 'none' }}>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
              {t.text}
            </label>
            <button type="button" onClick={() => remove(t.id)} aria-label={`Remove ${t.text}`}>x</button>
          </li>
        ))}
      </ul>
      <p>{remaining} of {todos.length} remaining</p>
    </form>
  );
}
```

Explain: the text field is a **controlled input**; every update creates **new arrays and objects** (`[...prev, x]`, `map` with a spread copy, `filter`) and uses the **updater form** `prev => ...`, so rapid updates never lose data; ids are created **once when the item is added** (not during render) and used as **keys**, so reordering or removing keeps each row's state; `remaining` is **derived during render** instead of being stored; handlers are passed as functions, `onSubmit` calls `preventDefault`; and the buttons have accessible labels and `type="button"` so they do not submit the form.

### [coding] Write a controlled payment form with validation, a disabled submit while sending and error display, typed with TypeScript. {#coding-form}

```tsx
import { useState } from 'react';

interface FormValues { payee: string; amount: string }
type Errors = Partial<Record<keyof FormValues, string>>;

function validate(v: FormValues): Errors {
  const errors: Errors = {};
  if (!v.payee.trim()) errors.payee = 'Payee is required';
  const amount = Number(v.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Enter an amount above zero';
  return errors;
}

export function PaymentForm({ onSubmit }: { onSubmit: (v: { payee: string; amount: number }) => Promise<void> }) {
  const [values, setValues] = useState<FormValues>({ payee: '', amount: '' });
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');

  const errors = validate(values);                                  // derived on every render
  const isValid = Object.keys(errors).length === 0;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));              // one handler for all fields
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));     // show an error only after the field was visited
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid || status === 'sending') return;
    setStatus('sending');
    try {
      await onSubmit({ payee: values.payee.trim(), amount: Number(values.amount) });
      setValues({ payee: '', amount: '' });
      setTouched({});
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label>Payee
        <input name="payee" value={values.payee} onChange={handleChange} onBlur={handleBlur}
               aria-invalid={!!(touched.payee && errors.payee)} />
      </label>
      {touched.payee && errors.payee && <p role="alert">{errors.payee}</p>}

      <label>Amount
        <input name="amount" inputMode="decimal" value={values.amount} onChange={handleChange} onBlur={handleBlur}
               aria-invalid={!!(touched.amount && errors.amount)} />
      </label>
      {touched.amount && errors.amount && <p role="alert">{errors.amount}</p>}

      <button type="submit" disabled={!isValid || status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Pay'}
      </button>
      {status === 'error' && <p role="alert">The payment failed. Try again.</p>}
    </form>
  );
}
```

Explain: all fields are **controlled** and share one `handleChange` using the input's `name` and a **computed property key**; the errors and `isValid` are **derived** from the values on each render, not stored in state, so they cannot go out of sync; the **status** is one value (`idle | sending | error`) instead of separate booleans, which prevents impossible combinations; the submit button is disabled while sending and the handler also guards against double submission; errors show only after a field is touched, and use `role="alert"` and `aria-invalid` for accessibility; `Number(...)` conversion happens at the edge, and the real validation must still be repeated on the server.

### [coding] Build a filterable product list with the state lifted to the parent and a reusable `Card` using `children`. {#coding-lift}

```tsx
import { useState } from 'react';

interface Product { id: number; name: string; price: number; inStock: boolean }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}                                         {/* composition: the parent decides the content */}
    </section>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search products" />;
}

function ProductList({ products }: { products: Product[] }) {
  if (products.length === 0) return <p>No products found.</p>;
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id} style={{ opacity: p.inStock ? 1 : 0.5 }}>
          {p.name} - {p.price.toFixed(2)}
        </li>
      ))}
    </ul>
  );
}

export function ProductsPage({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('');              // state lives in the common parent
  const [inStockOnly, setInStockOnly] = useState(false);

  const visible = products.filter(                        // derived data, not stored
    (p) => p.name.toLowerCase().includes(filter.toLowerCase()) && (!inStockOnly || p.inStock),
  );

  return (
    <Card title="Products">
      <SearchBox value={filter} onChange={setFilter} />
      <label>
        <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
        In stock only
      </label>
      <ProductList products={visible} />
    </Card>
  );
}
```

Explain: `filter` and `inStockOnly` are **state owned by `ProductsPage`**, the closest common parent of the search box and the list, and are passed down as **props** with the setter passed as an `onChange` **callback** (data down, events up); `visible` is **derived during render** from the props and state, with no duplicate state to keep in sync; `SearchBox` and `ProductList` are **pure presentational components** with typed props, easy to test and reuse; `Card` shows **composition** with `children`; the list uses the product **id as the key**; and if `products` is large, the next steps are `useMemo`, debouncing the filter and virtualising the list, but only after measuring.
