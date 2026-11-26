---
title: React core — components, JSX, props, state and rendering
nav: React core
slug: react-core
summary: The React fundamentals every interview starts with, declarative UI and the component tree, JSX rules, function components, props and children, composition, state with useState and why it is a snapshot, immutable updates, lifting state up, how rendering and reconciliation work with the render and commit phases, lists and keys, events and controlled forms, refs, purity and StrictMode, what is new in React 19, typing components with TypeScript, and the common bugs, with examples and interview questions.
tags: [React, JSX, Components, Props, State, Rendering, Keys, React 19, TypeScript, Full stack]
order: 64
topic: Full stack / React
updated: 2026-11-26
subnav: true
---

React is the front-end half of most full-stack interviews. The questions are rarely about syntax. Expect questions like these:

- What is a component?
- How do props and state differ?
- Why must state not be mutated?
- What happens between a `setState` call and the screen?
- What is a key for?
- What is a controlled input?
- Why does a component re-render?

This lesson builds on [JavaScript essentials](lesson:js-essentials#closures). Closures and references cause most React bugs. It also uses [TypeScript](lesson:ts-essentials#basics), and the examples are TypeScript (`.tsx`). Hooks beyond `useState` (effects, memoization, context, reducers) are in the next lesson. Play the four scenes: render and commit, props and state, lists and keys, and state as a snapshot.

```demo
name: react-walk
```

> **One sentence to remember:** *A component is a pure function from props and state to a description of the UI.*

A state change triggers a new render. React compares the new description with the old one, and updates only the difference in the DOM. So never mutate state, and give list items stable keys.

## What React is {#what}

React is a **library for building user interfaces** from **components**. It is not a full framework. Routing, data fetching and build tooling come from other libraries, or from a framework built on React (Next.js, React Router in framework mode, Remix).

- **Declarative.** You describe **what the UI should look like for the current data**, and React works out how to change the page. You do not write `document.getElementById(...).textContent = ...` step by step. That would be imperative.
- **Component-based.** The UI is a tree of small, reusable functions that return UI.
- **Unidirectional data flow.** Data goes **down** the tree as props. Events go **up** as function calls.
- **Virtual DOM (the idea).** React keeps a lightweight description of the UI in memory. It compares the new one with the previous one (**reconciliation**), and applies only the **minimal changes** to the real DOM. Real DOM updates are the expensive part.
- **React 19** (current) is the version these notes assume. It has:
  - function components with hooks (class components still work but are not used in new code);
  - **Actions**, `use`, and `ref` as a normal prop;
  - an optional **React Compiler** that memoizes automatically.
- **Where it runs.** In the browser (client-side rendering with `createRoot`), on the server (**server-side rendering**, and **React Server Components** in frameworks like Next.js), or on mobile (React Native).
- **Compared with Java and Spring.** Spring MVC with Thymeleaf renders HTML **on the server, per request**. React renders **in the browser** from JSON returned by an API. So the Spring service becomes a REST API ([REST design](lesson:rest-api-design)).

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);   // mounts the component tree
```

## JSX {#jsx}

**JSX** is syntax that looks like HTML inside JavaScript. A build step (Vite with esbuild or SWC, or Babel) turns it into function calls (`jsx(...)`) that create **element objects**. JSX is not a string and not the DOM. It is a description.

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

- **One root element** per return. Wrap siblings in a parent, or in a **fragment** `<>...</>`.
- **Expressions, not statements.** Inside `{}` you can put values, calls, ternaries, `&&` and `map`. You cannot put `if` or `for`. Use them before the `return`.
- **Attribute names** are camelCase: `onClick`, `tabIndex`, `className`, `htmlFor`. Strings use quotes. Everything else uses braces.
- **Escaping.** Text in `{}` is escaped, which protects against XSS. `dangerouslySetInnerHTML` bypasses it, and must only receive sanitised HTML ([security](lesson:authn-authz#attacks)).
- **Capitalised names are components** (`<Greeting />`). Lowercase names are DOM elements (`<section>`).
- **Conditional rendering.** Use `cond && <X />`, `cond ? <A /> : <B />`, or an early `return null`. **Pitfall:** `{count && <X />}` renders the number `0` when `count` is 0. Use `count > 0 &&`.
- **Lists.** `items.map((item) => <Row key={item.id} item={item} />)` (see [keys](#keys)).

## Components and props {#components}

A **component** is a function that takes **props** and returns JSX (or `null`). Its name starts with a capital letter. Components are the unit of reuse.

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

- **Props are read-only.** A component must never change its props, neither the object nor the values inside. To change something, the parent passes a function.
- **Destructuring and defaults** in the parameter list are the norm. Spread `{...props}` forwards props to a child element. Use it sparingly.
- **`children`** is a prop. It lets a component wrap arbitrary content. That is how layouts, cards and modals are built: **composition over inheritance**. React has no component inheritance.
- **Callback props** (`onClick`, `onChange`, `onSave`) are how a child notifies its parent. Name them `onXxx`, and the parent's handlers `handleXxx`.
- **Typing.** Describe props with an `interface` or `type`. Use `React.ReactNode` for children, and `React.ComponentProps<'button'>` to inherit a DOM element's props. Avoid `React.FC`, which adds nothing today.
- **Component identity.** **Never define a component inside another component.** It is a new function every render, so React sees a different type and **remounts** it, losing its state.
- **Compared with Java.** A component is like a stateless function, or a view model with state. Props are its parameters. There are no getters, no inheritance, and no lifecycle methods to override in function components.

## State {#state}

**State** is data a component remembers between renders. When it changes, the component renders again. A plain local variable is **reset every render**, and changing it does not update the screen.

```tsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);              // [current value, setter], initial value 0
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}
```

- **`useState(initial)`** returns the current value and a setter. The initial value is used **only on the first render**. For an expensive initial value, pass a function: `useState(() => readFromStorage())`.
- **State is private to each component instance.** Two `<Counter />` elements have separate state. State lives in React, attached to the **position in the tree**, not in the function's variables.
- **State is a snapshot** (the fourth scene). During one render, `count` has one fixed value. Calling `setCount(count + 1)` three times in a handler gives `+1`, because each call uses the same snapshot. Use the **updater form** `setCount((c) => c + 1)` when the new value depends on the previous one.
- **Updates are batched** (React 18 and later, everywhere, including promises and timeouts). The new value is visible on the **next render**, not on the next line.
- **Never mutate state.** React decides to re-render by comparing the new value with the old one **by reference** (`Object.is`). `items.push(x)` keeps the same array, so React may skip the update. Create new values:

```tsx
setItems([...items, newItem]);                                  // add
setItems(items.filter((i) => i.id !== id));                     // remove
setItems(items.map((i) => (i.id === id ? { ...i, done: true } : i)));   // update one
setUser({ ...user, address: { ...user.address, city: 'Singapore' } });  // nested object
```

  This is the [shallow copy](lesson:js-essentials#references) rule from JavaScript. For deeply nested state, use **Immer** (`produce`) or flatten the state.
- **Do not copy props into state** (`useState(props.price)`). It does not update when the prop changes. **Derive values during render** instead: `const total = items.reduce(...)`. Store the minimum, and compute the rest.
- **Group related state** into one object, or use `useReducer` (next lesson) when updates are complex. Avoid contradictory state (`isLoading` and `isError` and `data`). Model it as one `status` value.
- **Lifting state up** (second scene). When two components need the same data, move the state to their **closest common parent**. Pass the value down, and the setter as a callback.

## Rendering and reconciliation {#rendering}

The first scene shows the pipeline. A render has **three steps**:

1. **Trigger.** The initial `createRoot().render()`, or a **state update** in a component (or its parent re-rendering).
2. **Render.** React **calls your component functions** to compute the new element tree. This step must be **pure**. It may be **paused, repeated or thrown away** (concurrent rendering).
3. **Commit.** React applies the **minimal changes** to the DOM, then the browser paints. `useLayoutEffect` runs before the paint, and `useEffect` runs after it.

- **When does a component re-render?**
  - when **its own state changes**;
  - when **its parent re-renders**, even if its props are the same, unless it is wrapped in `memo`;
  - when a **context** it reads changes.

  A re-render means calling the function again. It does **not** necessarily change the DOM. Re-rendering is cheap. Unnecessary DOM changes are what React avoids.
- **Reconciliation rules (the diff).** React compares trees level by level.
  - **Different element type** at a position (`<div>` to `<span>`, or `<A>` to `<B>`): the old subtree is **unmounted** (state lost) and a new one is **mounted**.
  - **Same type** at the same position: the DOM node or component instance is **kept and updated**, with its state.
  - **Lists** are matched by **key**.
- **Purity.** Given the same props and state, a component must return the same JSX. It must not change anything outside itself while rendering: no mutating variables, no network calls, no `Math.random()` or `Date.now()` in the output. **Side effects belong in event handlers or effects.**
- **`StrictMode`** is on in development by default in templates. It renders components **twice** and re-runs effects once extra, to expose impurity and missing cleanup. It does nothing in production.
- **Performance.** Measure first (React DevTools Profiler). The usual fixes are moving state down, splitting components, stable keys, `memo`, `useMemo`, `useCallback`, virtualised long lists, and the React Compiler. The next lesson covers them.

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

- **A key identifies an item between renders.** So React can reorder, insert and remove the right DOM nodes, and keep each item's **state** (the third scene).
- **Use a stable id from the data**, such as a database id. **Do not use the array index** if the list can be reordered, filtered or inserted into. The state then sticks to the position and shows on the wrong item. An index is acceptable for a static list that never changes.
- **Never generate keys during render** (`key={Math.random()}`). Every render gets new keys, so every item is remounted.
- Keys are **not passed as props** (`props.key` is not available). They only need to be unique **among siblings**.
- **A key resets state.** `<ProfileForm key={userId} />` makes React discard the old form and create a fresh one whenever the user changes. It is an alternative to resetting state in an effect.

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

- **Handlers are functions you pass**, not calls. Write `onClick={handle}` or `onClick={() => handle(id)}`. Never write `onClick={handle(id)}`, which calls it during render.
- **Synthetic events** wrap the browser event with the same interface (`e.target`, `e.preventDefault()`, `e.stopPropagation()`). React attaches listeners at the root (event delegation). The types are `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent`, `React.FormEvent` and `React.KeyboardEvent`.
- **Controlled inputs.** The **React state is the single source of truth**. The input's `value` comes from state, and `onChange` updates it. It is easy to validate, format and reset, but it renders on every keystroke.
- **Uncontrolled inputs.** The **DOM holds the value**. You read it with a ref, or with `FormData` when submitting, and set a starting value with `defaultValue`. It is simpler and faster for large forms and file inputs. React 19 form **Actions** (`<form action={fn}>`) work with uncontrolled fields.
- **Validation** on the client is for usability only. **Always validate again on the server** ([authentication](lesson:authn-authz#attacks)).
- **Forms with many fields.** A library (React Hook Form, with zod for the schema) keeps them uncontrolled and fast.

## Refs and the DOM {#refs}

`useRef` gives a **mutable box** `{ current }`. It **survives renders, and does not trigger a render when changed**. It has two uses:

- **DOM access.** `const inputRef = useRef<HTMLInputElement>(null)`, then `<input ref={inputRef} />`, then `inputRef.current?.focus()`. Use it for focus, scroll position, measuring, and third-party widgets.
- **Instance values.** A timer id, the previous value, or a flag that must not cause a render.
- In **React 19**, a function component receives `ref` as an ordinary prop, so `forwardRef` is no longer needed.
- **Do not read or write `ref.current` during render.** Do it in handlers and effects.

## What is new in React 19 {#react19}

- **Actions.** Async functions used in transitions and forms. `<form action={fn}>` calls the function with the `FormData`, and React tracks the pending state.
  - **`useActionState`** gives the result and the pending flag.
  - **`useFormStatus`** lets a child button know the form is submitting.
  - **`useOptimistic`** shows an expected result at once, and rolls it back on failure.
- **`use`** reads a promise or a context during render. A promise suspends the component until it resolves, inside `<Suspense>`.
- **`ref` as a prop**, ref callbacks with cleanup, and **`<Context>` as a provider** (no `.Provider`).
- **Document metadata.** `<title>` and `<meta>` can be rendered inside components.
- **Server Components and Server Actions** (in frameworks such as Next.js). These components run only on the server and send results to the client, to cut the JavaScript sent to the browser.
- **React Compiler** (a build-time plugin). It adds memoization automatically. So manual `useMemo`, `useCallback` and `memo` are needed much less, when components follow the rules of React (pure, no mutation).

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

**Rules of Hooks.** Call hooks only at the **top level** of a component or a custom hook: never in conditions, loops or nested functions. Call them only from React functions. The order of hook calls must be the same every render, because React identifies state by call order. The `eslint-plugin-react-hooks` rules enforce it.

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

Try it in the lab: [How React turns a state change into a screen change](lab:react-render-commit).

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

React is a JavaScript library for building user interfaces out of components.

It lets you describe what the UI should look like for the current state. It updates the DOM efficiently when the state changes, so you do not manipulate the DOM by hand.

It gives you a component model for reuse, one-way data flow that makes behaviour predictable, and an ecosystem for routing, data and state.

It is a library, so structure beyond rendering comes from other tools or a framework such as Next.js.

### [basic] What is JSX? {#jsx-q}

JSX is a syntax extension that lets you write markup inside JavaScript. A compiler turns each tag into a function call that creates a plain object describing the element. So JSX is not HTML and not a string.

The rules:

- one root element, or a fragment;
- `className` and `htmlFor`;
- camelCase attributes and closed tags;
- JavaScript expressions in braces.

Text in braces is escaped, which protects against injection.

### [basic] What is the difference between props and state? {#props-state-q}

Props are inputs passed from a parent to a component. They are read-only for that component.

State is data owned and changed by the component itself. It is remembered between renders, and changing it triggers a re-render.

A parent's state becomes its child's props. If something can be computed from props or other state, it should not be state at all.

### [basic] What is the virtual DOM and why does React use it? {#vdom-q}

The virtual DOM is a lightweight in-memory description of the UI, as a tree of element objects.

On each render, React builds the new tree and compares it with the previous one (reconciliation). It then applies only the differences to the real DOM, which is the expensive part. So you can write declaratively, without paying for rebuilding the whole page.

It is not magic. Render work still happens, so performance depends on how much you render.

### [basic] Why do list items need keys? {#keys-q}

Keys let React identify each item between renders. When items are added, removed or reordered, it then updates the right DOM nodes and keeps each item's state.

A key must be unique among siblings and stable, normally an id from the data.

Using the index breaks when the list changes: state stays attached to a position, and ends up on the wrong item. Random keys remount everything on every render.

### [basic] What is the difference between controlled and uncontrolled components? {#controlled-q}

A controlled input gets its value from React state, and updates it in `onChange`. So the state is the single source of truth. That makes validation, formatting and resetting easy.

An uncontrolled input keeps its value in the DOM. You read it through a ref or `FormData`, and use `defaultValue` for the starting value.

Controlled is the default for most fields. Uncontrolled suits large forms, file inputs, and form libraries that avoid re-rendering on every keystroke.

### [intermediate] Why must you not mutate state directly? {#mutation-q}

React detects a change by comparing the new value with the old one by reference. If you mutate an array or object and pass the same reference to the setter, React sees no change and may skip the render. The screen is then stale.

Mutation also breaks features that rely on previous values: memoization, effect dependencies, and time travel in Redux. And it changes data that other code may still hold.

Create a new array or object with spread, `map` or `filter`. Or use Immer.

### [intermediate] Why does `setCount(count + 1)` called three times add only one? {#snapshot-q}

State is a snapshot for each render. All three calls in the same handler read the same `count`, for example 0. Each queues "set to 1", so the result is 1.

With the updater form `setCount((c) => c + 1)`, each queued update receives the result of the previous one. So the result is 3.

The new value is also not available on the next line. It is only in the next render.

### [intermediate] When does a component re-render? {#rerender-q}

A component re-renders when:

- its own state changes;
- its parent re-renders, even with unchanged props, unless it is wrapped in `memo` and the props are equal;
- a context value it consumes changes.

A re-render only calls the function again. React then diffs the result, and touches the DOM only where something changed. Setting state to the same value (by `Object.is`) usually bails out.

### [intermediate] What happens between calling `setState` and the UI updating? {#pipeline-q}

1. React schedules a render, and batches updates made in the same event.
2. In the render phase, it calls the component functions with the new state to produce a new element tree. This must be pure.
3. In reconciliation, it diffs the new tree against the previous one.
4. In the commit phase, it applies the minimal changes to the DOM and runs layout effects.
5. The browser paints.
6. Passive effects (`useEffect`) run.

Rendering can be paused or restarted in concurrent mode. That is why render must have no side effects.

### [intermediate] What does React do when the element type or the key at a position changes? {#reconcile-q}

If the type changes (`<div>` to `<section>`, or one component to another), React unmounts the old subtree, destroying its state and DOM, and mounts a new one.

If the type is the same, it keeps the instance or DOM node, and updates its props.

For lists, it matches by key. A changed key means unmount and mount. That is why changing a key is a way to reset a component's state.

It is also why you must not define a component inside another component.

### [intermediate] What is "lifting state up"? {#lifting-q}

When two or more components need the same data, you move the state to their closest common parent. You pass the value down as props, with a callback prop so the children can request changes. This keeps one source of truth, and keeps siblings in sync.

If it means passing props through many layers, use composition (pass the child as `children`) or context. Keep state as low in the tree as possible.

### [intermediate] What are the Rules of Hooks and why do they exist? {#hooks-rules-q}

Call hooks only at the top level of a component or custom hook. Never call them inside conditions, loops or nested functions. Call them only from React functions.

React stores state by the order of hook calls in each render. So the order must be identical every time. A conditional hook shifts the order and mixes up the state.

The `react-hooks` ESLint rules enforce this.

### [intermediate] What is `StrictMode` and why does my component render twice in development? {#strict-q}

`StrictMode` is a development-only wrapper. It calls component functions twice, and re-runs effects once extra, to expose impure rendering and missing effect cleanup. It does nothing in production builds.

If double rendering breaks something, a render has a side effect, such as mutating a variable outside the component. Fix that, rather than hiding it.

### [deep] How would you explain composition and why React favours it over inheritance? {#composition-q}

You customise components by passing other components or elements as props or `children`. You do not extend a base component.

- A `Card` renders `{children}`.
- A `Layout` takes `header` and `sidebar` props.
- A specialised `DangerButton` renders a `Button` with a preset prop.

This keeps components small. It avoids deep hierarchies and hidden shared state. It works with function components, and is type-friendly. Behaviour reuse comes from custom hooks, not from superclasses.

### [deep] A text input inside a list loses what the user typed, or shows it on the wrong row. What are the likely causes? {#input-bug-q}

Either the keys are wrong, or the component is being remounted.

- Index keys make state stick to the position when items are inserted or reordered. So the text appears on another row.
- Random or changing keys, or a component defined inside another component, make React see a new element each render. It remounts it, which drops its state and focus.

Use stable id keys, and define components at module level. Check the Profiler or a mount log to confirm remounts.

### [deep] When would you use state, a ref, or a derived value? {#state-ref-derived-q}

- **State**, for data that affects what is rendered, and must trigger a render when it changes.
- **A ref**, for a value that must persist between renders but must not cause a render. Examples: a timer id, a DOM node, the previous value.
- **A derived value**, computed during render from props and state, for anything that can be calculated, such as a filtered list or a total. Storing it would duplicate the source of truth, and it could go out of sync.

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

Explain these points:

- The text field is a **controlled input**.
- Every update creates **new arrays and objects**: `[...prev, x]`, `map` with a spread copy, and `filter`.
- Updates use the **updater form** `prev => ...`, so rapid updates never lose data.
- Ids are created **once, when the item is added**, not during render. They are used as **keys**, so reordering or removing keeps each row's state.
- `remaining` is **derived during render** instead of being stored.
- Handlers are passed as functions, and `onSubmit` calls `preventDefault`.
- The buttons have accessible labels, and `type="button"` so they do not submit the form.

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

Explain these points:

- All fields are **controlled**. They share one `handleChange`, which uses the input's `name` and a **computed property key**.
- The errors and `isValid` are **derived** from the values on each render, not stored in state. So they cannot go out of sync.
- The **status** is one value (`idle | sending | error`) instead of separate booleans. That prevents impossible combinations.
- The submit button is disabled while sending, and the handler also guards against double submission.
- Errors show only after a field is touched. They use `role="alert"` and `aria-invalid` for accessibility.
- The `Number(...)` conversion happens at the edge. The real validation must still be repeated on the server.

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

Explain these points:

- `filter` and `inStockOnly` are **state owned by `ProductsPage`**, the closest common parent of the search box and the list.
- They are passed down as **props**. The setter is passed as an `onChange` **callback**. Data goes down, and events go up.
- `visible` is **derived during render** from the props and state. There is no duplicate state to keep in sync.
- `SearchBox` and `ProductList` are **pure presentational components** with typed props. They are easy to test and reuse.
- `Card` shows **composition** with `children`.
- The list uses the product **id as the key**.
- If `products` is large, the next steps are `useMemo`, debouncing the filter, and virtualising the list. Do that only after measuring.
