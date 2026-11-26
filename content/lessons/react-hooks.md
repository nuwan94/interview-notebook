---
title: React hooks — useEffect, memoization, useReducer, context and custom hooks
nav: React hooks
slug: react-hooks
summary: React hooks beyond useState, useEffect with dependencies, cleanup, races and StrictMode, why you might not need an effect, useRef and useLayoutEffect, useMemo, useCallback and memo with referential equality and the React Compiler, useReducer, useContext and how to avoid re-render storms, custom hooks, useTransition, useDeferredValue, useId and useSyncExternalStore, data fetching with TanStack Query, Suspense and error boundaries, stale closures and common mistakes, with examples and interview questions.
tags: [React, Hooks, useEffect, useMemo, useCallback, useReducer, Context, Custom hooks, Performance, Full stack]
order: 65
topic: Full stack / React
updated: 2026-11-26
subnav: true
---

Hooks are where most React interview questions go deep. Expect questions like these:

- What is `useEffect` for, and what does its dependency array mean?
- Why does an effect need a cleanup?
- How do you avoid a race when fetching?
- What do `useMemo` and `useCallback` really do?
- When does a component re-render, and how does context change that?
- When do you use `useReducer`?
- How do you write a custom hook?
- What is a stale closure?

This lesson builds on [React core](lesson:react-core#state), [closures](lesson:js-essentials#closures) and [async code](lesson:js-async#cancellation). Every hook bug is one of those. The examples are TypeScript. Play the four scenes: `useEffect`, memoization, reducer and context, and custom hooks.

```demo
name: react-hooks-walk
```

> **One sentence to remember:** *Render is pure, and effects clean up after themselves.*

In more detail: memoization only helps when references matter. Shared state goes in a reducer or context. Shared logic goes in a custom hook.

## What hooks are {#hooks}

A **hook** is a function that lets a function component use React features: state, effects, context and refs. Their names start with `use`. The rules recap ([Rules of Hooks](lesson:react-core#bugs)): call them **at the top level**, in the **same order** every render, and only in components or other hooks.

| Hook | Purpose |
| --- | --- |
| `useState`, `useReducer` | state that triggers a render |
| `useEffect`, `useLayoutEffect` | synchronise with something outside React |
| `useRef`, `useImperativeHandle` | a mutable box that does not render, DOM access |
| `useMemo`, `useCallback` | keep a value or function between renders |
| `useContext`, `use` | read a context (or a promise) |
| `useTransition`, `useDeferredValue` | keep the UI responsive during slow updates |
| `useId`, `useSyncExternalStore`, `useDebugValue` | accessibility ids, external stores, DevTools labels |
| `useActionState`, `useFormStatus`, `useOptimistic` | form Actions in React 19 |

**Why hooks.** Class components spread related logic across `componentDidMount`, `componentDidUpdate` and `componentWillUnmount`. Sharing logic needed render props or higher-order components. Hooks group code by **concern**, and let you reuse it with **custom hooks**. Class components still work, but new code uses hooks.

## useEffect {#effect}

An **effect** runs code **after the component has rendered and the DOM is updated** (the first scene). It is for **synchronising the component with something outside React**: a subscription, a timer, a network request, a browser API, or a non-React widget.

```tsx
useEffect(() => {
  const connection = createConnection(roomId);     // setup
  connection.connect();
  return () => connection.disconnect();            // cleanup: runs before the next run and on unmount
}, [roomId]);                                      // dependencies: run again when roomId changes
```

- **Dependency array.**
  - `[a, b]` runs after the first render, and whenever `a` or `b` changed (compared with `Object.is`).
  - **`[]`** runs only on mount, with the cleanup on unmount.
  - **No array** runs after **every** render.
  - Include **every reactive value** the effect reads: props, state, and values derived from them. The `exhaustive-deps` lint rule checks this. **Do not silence it.** A missing dependency means a **stale closure**.
- **Cleanup.** Return a function that undoes the setup: unsubscribe, clear the timer, abort the request. React runs it **before re-running** the effect, and **on unmount**.
- **Timing.** Effects run **after paint**, so they do not block rendering. `useLayoutEffect` runs **before the paint**. Use it for measuring the DOM and changing it without a flicker. It blocks painting, so use it rarely.
- **StrictMode** (development) mounts, cleans up and mounts again, to check that setup and cleanup are a matching pair (the fourth frame). It only runs in development.
- **Effects are not for everything.** React's guidance is **"You might not need an effect"**:
  - **Derived data.** Compute it during render (`const total = items.reduce(...)`), not in an effect that calls `setState`.
  - **Reacting to a user action.** Put the code in the **event handler**, which knows what happened. Do not use an effect that watches state.
  - **Resetting state when a prop changes.** Use a **`key`** ([keys](lesson:react-core#keys)).
  - **Sharing logic or state between components.** Lift state up, or use a custom hook.
  - **Fetching data.** Use a data library or a framework loader, or an effect with cleanup (below).
- **`useEffectEvent`** (stable from React 19.2) lets an effect call a function that always sees the **latest** props and state, without becoming a dependency. An example is logging the latest value inside an effect that should not re-run when it changes.

### Fetching in an effect without a race {#fetching}

The second and third frames show the problem. Responses can arrive out of order, and an old response can overwrite a new one. Clean up by **aborting** the old request:

```tsx
useEffect(() => {
  const controller = new AbortController();
  setStatus('loading');
  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
    .then((user) => { setUser(user); setStatus('ready'); })
    .catch((err) => { if (err.name !== 'AbortError') setStatus('error'); });   // an abort is not an error
  return () => controller.abort();                                             // cleanup cancels the old request
}, [userId]);
```

An **ignore flag** also works when the API cannot be aborted: `let ignore = false; ... if (!ignore) setUser(...); return () => { ignore = true; }`.

In real applications, prefer **TanStack Query**, SWR, RTK Query or a framework data layer. They add caching, de-duplication, retries and refetching, so you do not rewrite them ([fetch pitfalls](lesson:js-async#fetch)).

## useRef and useLayoutEffect {#ref}

`useRef` is a mutable `{ current }` that persists across renders and **does not trigger a render** ([refs](lesson:react-core#refs)). Use it for DOM nodes, timer ids, the previous value, or a flag. Reading or writing `ref.current` belongs in **handlers and effects**, not in render.

A ref is also the escape hatch for a stale closure. Store the latest callback in a ref, and read it from a long-lived effect.

## Memoization: useMemo, useCallback, memo {#memo}

React re-renders a component when its **state changes**, its **parent re-renders**, or a **context changes**. A re-render is usually cheap. So memoization is an optimisation, not a default.

- **`useMemo(() => compute(a, b), [a, b])`** caches a **value** until a dependency changes. Use it for an **expensive calculation**, or to keep an **object or array reference stable**.
- **`useCallback(fn, deps)`** caches a **function**. It is `useMemo(() => fn, deps)`. Use it when the function is a prop of a `memo` child, or a dependency of an effect.
- **`memo(Component)`** skips re-rendering when the props are **shallowly equal**.
- **Referential equality is the point** (the second scene). `{}`, `[]` and `() => {}` are **new objects every render**, so `memo` sees a changed prop. `useMemo` and `useCallback` give the same reference while the dependencies are unchanged.

```tsx
const Row = memo(function Row({ payment, onSelect }: { payment: Payment; onSelect: (id: string) => void }) {
  return <li onClick={() => onSelect(payment.id)}>{payment.payee}</li>;
});

function PaymentList({ payments }: { payments: Payment[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const onSelect = useCallback((id: string) => setSelected(id), []);               // stable: Row can skip
  const total = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);   // only when payments changes
  return (<><p>{total}</p><ul>{payments.map((p) => <Row key={p.id} payment={p} onSelect={onSelect} />)}</ul></>);
}
```

- **Do not memoize everything.** Memoization costs code, memory and comparisons. A missing dependency causes a **stale value**. Measure with the **React DevTools Profiler**, and fix real problems.
- **Better fixes first:**
  - **move state down** to the component that needs it;
  - **pass `children`**, so unchanged parts are not re-created;
  - split a slow component;
  - **virtualise** long lists (react-window, TanStack Virtual);
  - debounce input.
- **React Compiler** (a build-time plugin) adds memoization automatically for components that follow the rules of React. So manual `useMemo`, `useCallback` and `memo` are mostly unnecessary in new code. But you still see them in existing code and in interviews.

## useReducer {#reducer}

`useReducer(reducer, initialState)` returns `[state, dispatch]`. Components **dispatch actions**, which describe what happened. A **pure reducer** computes the next state (the third scene).

```tsx
type Action = { type: 'add'; item: Item } | { type: 'remove'; id: string } | { type: 'clear' };

function reducer(state: Item[], action: Action): Item[] {
  switch (action.type) {
    case 'add': return [...state, action.item];
    case 'remove': return state.filter((i) => i.id !== action.id);
    case 'clear': return [];
  }
}

const [items, dispatch] = useReducer(reducer, []);
dispatch({ type: 'add', item });
```

- **When to use it.** Use it for many related transitions, for state that depends on the previous state, or for logic you want to **test as a plain function**. The reducer needs no React. For one value, `useState` is simpler.
- **`dispatch` is stable.** It is the same function every render, so it is safe to pass down or use in effect dependencies.
- The reducer **must be pure** and **must not mutate** its arguments. With TypeScript, a **discriminated union** of actions makes the `switch` exhaustive ([narrowing](lesson:ts-essentials#narrowing)). This is the same idea as Redux, which is covered in the next lesson.

## useContext {#context}

**Context** lets a component pass a value to **all descendants**, without threading props through every level. That threading is called **prop drilling**.

```tsx
const ThemeContext = createContext<'light' | 'dark'>('light');            // a default for components without a provider

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  return (
    <ThemeContext value={theme}>                                          {/* React 19: the context is the provider */}
      <Page />
    </ThemeContext>
  );
}

function Button() {
  const theme = useContext(ThemeContext);                                 // or use(ThemeContext) in React 19
  return <button className={theme}>OK</button>;
}
```

- **Every consumer re-renders when the provider's value changes** (the second frame). That happens even if it uses a part that did not change, and `memo` does not stop it.
- **Avoid a re-render storm:**
  - **Memoise the value** (`useMemo`), so it is not a new object every render.
  - **Split contexts.** Use one for the **state**, which changes often, and one for the **dispatch** or actions, which are stable. Then components that only trigger changes do not re-render (the third frame).
  - **Keep the state close** to where it is used. Put only truly global data in context: the current user, theme, locale, feature flags.
- **Context is not a state manager.** It transports a value, and the state still lives in `useState` or `useReducer`. For frequently changing global state, use a store (Redux Toolkit, Zustand) with selectors, covered next.
- **Providers go at the top.** Nested providers override outer ones for their subtree.

## Custom hooks {#custom}

A **custom hook** is a function whose name starts with `use` and that calls other hooks. It **shares logic**, not state. Every call has **its own state** (the second frame of the last scene).

```tsx
function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);                    // a new value cancels the pending update
  }, [value, delayMs]);
  return debounced;
}

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : initial;    // lazy initial state: read once
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}
```

- **Typical custom hooks:** `useFetch` or `useQuery`, `useDebounce`, `useLocalStorage`, `useMediaQuery`, `useOnClickOutside`, `useForm`, `usePrevious`, `useInterval`.
- **Naming matters.** The `use` prefix lets React and the linter apply the Rules of Hooks.
- **What to return.** Return a tuple (`as const`) for two or three values. Return an object for more, so callers can rename.
- **Testing.** Test with `renderHook` from React Testing Library. Keep the logic in plain functions where possible.
- **Hook, component or utility?** If it uses hooks, it is a hook. If it returns JSX, it is a component. If it is a pure calculation, it is a plain function.

## Other hooks worth knowing {#other}

- **`useTransition`** marks a state update as **non-urgent**. Urgent updates, such as typing, stay responsive while a heavy re-render happens in the background. It also gives `isPending`.
- **`useDeferredValue`** gives a lagging copy of a value, for the same purpose. An example is a big filtered list that follows the input.
- **`useId`** creates stable unique ids for `htmlFor` and `aria-*`, which match between server and client rendering.
- **`useSyncExternalStore`** subscribes to an external store (Redux, or browser APIs such as `navigator.onLine`) in a way that is safe with concurrent rendering. Libraries use it.
- **`useImperativeHandle`** exposes a small imperative API from a component through a ref. It is rarely needed.
- **`use`** (React 19) reads a promise or a context during render, and can be called conditionally. `<Suspense>` shows a fallback while the promise is pending.
- **`useOptimistic`, `useActionState`, `useFormStatus`** are for forms and optimistic updates ([React 19](lesson:react-core#react19)).

## Suspense and error boundaries {#suspense}

- **`<Suspense fallback={<Spinner />}>`** shows a fallback while a child is waiting. The child may be lazy-loaded code with `React.lazy`, or data read with `use` or a library that supports it. It enables **code splitting** and streaming server rendering.
- **Error boundaries** catch errors thrown **during rendering** of their children, and show a fallback UI instead of a blank page. They are class components, or use `react-error-boundary`. They do **not** catch errors in event handlers, async code or effects. Handle those yourself, so combine boundaries with `try/catch` and error state.

## Stale closures and common mistakes {#mistakes}

A component function runs again on every render. Each run's handlers and effects **close over that render's values** ([closures](lesson:js-essentials#closures)). A callback that lives longer than one render sees **old** values:

```tsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);   // count is stuck at the value of the first render
  return () => clearInterval(id);
}, []);                                                       // the lint rule warns about the missing dependency

useEffect(() => {
  const id = setInterval(() => setCount((c) => c + 1), 1000);  // fix: the updater form needs no dependency
  return () => clearInterval(id);
}, []);
```

| Mistake | Effect | Fix |
| --- | --- | --- |
| missing dependency, or silencing the lint rule | stale values, subtle bugs | include it, or restructure (updater form, ref, `useEffectEvent`) |
| object or function created in render as a dependency | the effect runs every render | move it inside the effect, or memoise it |
| `setState` in an effect to derive a value | extra render, flicker, loops | compute during render |
| no cleanup | leaks, duplicate subscriptions, races | return a cleanup, abort requests |
| `async` function passed directly to `useEffect` | it returns a promise, not a cleanup | define an async function inside and call it |
| effect with `[]` that reads props or state | stale closure | add dependencies |
| memoising everything | extra code, no gain, stale values | measure first |
| big context with many consumers | re-render storm | split contexts, memoise the value, use a store |
| fetching in an effect for server data | no caching, races, duplicates | use TanStack Query or a framework loader |

## For a Java developer {#java}

| Java and Spring | React hooks |
| --- | --- |
| `@PostConstruct` and `@PreDestroy` | `useEffect` setup and cleanup |
| an observer or listener you register and remove | an effect with a cleanup |
| a service injected into a class | a custom hook or context |
| `ThreadLocal` or a request-scoped bean | context for a subtree |
| caching with `@Cacheable` | `useMemo`, or TanStack Query for server data |
| a state machine or event sourcing | `useReducer` with actions |
| `Future.cancel` | `AbortController` in the cleanup |
| a thread-safe immutable value | a stable reference kept with `useMemo` |

Try it in the lab: [useEffect: dependencies, cleanup and stale values](lab:react-effect-deps).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| `useEffect` | after paint, for the outside world, deps array, cleanup before re-run and on unmount |
| deps | `[a]` on change, `[]` once, none every render, include everything the effect reads |
| not an effect | derived data, event reactions, resetting state (use a key) |
| race | abort or ignore the old request in the cleanup |
| StrictMode | mount, cleanup, mount again in development |
| `useMemo` / `useCallback` | keep a value or function reference, only matters with `memo` or effect deps |
| `memo` | skips render for shallowly equal props |
| `useReducer` | pure reducer plus actions, stable `dispatch`, good for many transitions |
| context | all consumers re-render on change, split state and dispatch, memoise the value |
| custom hook | `use` prefix, shares logic not state |
| stale closure | long-lived callbacks see old values, use the updater form, a ref or `useEffectEvent` |
| server data | TanStack Query or a framework loader, not a hand-written effect |

## Interview questions {#questions}

### [basic] What is `useEffect` and when does it run? {#effect-q}

`useEffect` is a hook for running side effects that synchronise a component with something outside React. Examples: a subscription, a timer, a network request or a browser API.

It runs after the component has rendered and the DOM is updated, normally after the paint. The dependency array controls when:

- with no array, after every render;
- with `[]`, only once;
- otherwise, when a listed value changed.

It can return a cleanup function. React runs it before the next run, and when the component unmounts.

### [basic] What does the dependency array do and what happens if you leave out a dependency? {#deps-q}

React compares each listed value with its value from the previous render, using `Object.is`. It re-runs the effect only if one changed.

If you leave out a value the effect uses, the effect keeps a closure over an old value. That is a stale closure. The effect then works with out-of-date data, which causes subtle bugs.

Include every reactive value the effect reads. Fix the cause (updater form, moving the function inside, a ref, or `useEffectEvent`) instead of suppressing the lint rule.

### [basic] Why does an effect need a cleanup function? {#cleanup-q}

So that what the effect set up is undone: unsubscribe, clear the timer, close the connection, abort the request.

React runs the cleanup before the effect runs again, and when the component unmounts.

Without it you get memory leaks, duplicate subscriptions, and races where an old request updates state after a new one.

StrictMode in development mounts, cleans up and mounts again, to reveal missing cleanups.

### [basic] What is the difference between `useMemo` and `useCallback`? {#memo-q}

`useMemo` caches the result of a calculation, a value, until its dependencies change. `useCallback` caches a function instance. `useCallback(fn, deps)` is the same as `useMemo(() => fn, deps)`.

Both exist to keep a reference stable between renders. That matters when the value is a prop of a `memo` child, or a dependency of an effect, or when the calculation is expensive.

They are optimisations to apply after measuring. They are not defaults.

### [basic] When would you use `useReducer` instead of `useState`? {#reducer-q}

Use `useReducer`:

- when state has several related fields, or many kinds of transitions;
- when the next state depends on the previous one in complex ways;
- when you want the update logic in one pure, testable function.

Components dispatch descriptive actions, and the reducer computes the next state. `dispatch` is stable, so it is easy to pass down.

For a single independent value, `useState` is simpler.

### [basic] What is a custom hook? {#custom-q}

A custom hook is a function whose name starts with `use` and that calls other hooks. It shares stateful logic between components, such as `useFetch`, `useDebounce` or `useLocalStorage`.

It shares the logic, not the state: each call has its own state.

The `use` prefix lets React and the linter enforce the Rules of Hooks.

### [intermediate] How do you fetch data in `useEffect` safely? {#fetch-q}

1. Start the request inside the effect, with an `AbortController`, and pass its signal to `fetch`.
2. Return a cleanup that aborts it. When the dependency changes or the component unmounts, the old request is cancelled and cannot overwrite newer state.
3. Ignore the resulting `AbortError`.
4. Check `res.ok`, track loading and error state, and include every input of the request in the dependencies.

For anything beyond a simple case, use TanStack Query or a framework loader. They add caching, de-duplication and retries.

### [intermediate] What are the cases where you do not need an effect? {#no-effect-q}

- Deriving data from props or state. Compute it during render.
- Responding to a user action. That belongs in the event handler.
- Resetting state when a prop changes. Use a `key`.
- Updating state from other state in a chain of effects. That causes extra renders and loops.
- Sharing logic. Use a custom hook.
- Subscribing to an external store. Use `useSyncExternalStore`.

Effects are for synchronising with the outside world.

### [intermediate] Why does `memo` not help when I pass an inline function or object prop? {#memo-ref-q}

`memo` compares props shallowly, by reference. An inline function, array or object literal is a new reference on every render of the parent. So the props always look changed, and the child re-renders.

Keep the references stable with `useCallback` and `useMemo`. Or define constants outside the component. Or let the React Compiler do it.

Only memoize when profiling shows a real cost.

### [intermediate] A component re-renders although its props did not change. Why? {#rerender-q}

Possible reasons:

- Its parent re-rendered. Children re-render with their parent unless they are wrapped in `memo`.
- It reads a context whose value changed.
- Its own state changed.

Equal props do not stop a re-render unless `memo` is used.

To find the cause, use the Profiler's "why did this render". Then move state down, pass children, or memoise.

### [intermediate] Why does everything re-render when a context value changes, and how do you reduce it? {#context-q}

Every component that calls `useContext` for that context re-renders when the provider's value changes by reference. That happens even if it only uses a part of the value, and `memo` does not prevent it.

To reduce it:

- memoise the value with `useMemo`;
- split the context into a state context and a stable dispatch context, or several smaller contexts;
- keep state local where possible;
- use a store with selectors (Redux Toolkit, Zustand) for frequently changing global state.

### [intermediate] What is the stale closure problem with `setInterval` in an effect? {#stale-q}

An effect created with `[]` captures the state and props of the first render. So a callback in `setInterval(() => setCount(count + 1))` always sees the initial `count`, and the counter sticks.

To fix it:

- use the updater form `setCount(c => c + 1)`, which needs no dependency;
- or list the dependency, and restart the interval;
- or read the latest value from a ref;
- or use `useEffectEvent`.

### [intermediate] What is the difference between `useEffect` and `useLayoutEffect`? {#layout-q}

`useEffect` runs after the browser has painted, so it does not delay what the user sees.

`useLayoutEffect` runs synchronously after the DOM updates, but before the paint. So you can measure layout and change it without a visible flicker. The cost is that it blocks painting.

Use `useEffect` by default. Use `useLayoutEffect` only for measurements and DOM adjustments. Neither runs during server rendering.

### [deep] How do `useTransition` and `useDeferredValue` help with slow renders? {#transition-q}

They use concurrent rendering to keep the UI responsive.

- `useTransition` wraps a state update in `startTransition`, marking it non-urgent. React can interrupt it for urgent updates such as typing, and `isPending` shows meanwhile.
- `useDeferredValue` returns a copy of a value that lags behind. An expensive list that depends on it re-renders in the background, while the input stays fast.

They do not make the work cheaper. They schedule it. A slow component may still need memoisation or virtualisation.

### [deep] How would you design state management for a large React application? {#state-design-q}

- Keep state as local as possible with `useState` and `useReducer`. Lift it only when siblings share it. Derive what can be computed.
- Treat server data as a separate cache, managed by TanStack Query or RTK Query (loading, caching, invalidation). Do not copy it into global state.
- Put truly shared client state in context, for rarely changing values. Examples: the current user, UI preferences, a cross-page workflow. For frequently changing values, use a store (Redux Toolkit or Zustand) with selectors.
- Keep URL state in the router, and form state in a form library.
- Avoid putting everything in one global object.

### [deep] What changes with the React Compiler? {#compiler-q}

It is a build-time plugin. It analyses components and hooks, and inserts memoization automatically. So values and functions keep stable references, and unchanged parts skip rendering, without you writing `useMemo`, `useCallback` or `memo`.

It relies on the rules of React: pure render, no mutation of props or state, hooks at the top level. Code that breaks the rules is skipped, or can behave wrongly.

Manual memoization is still valid and appears in older code. And you still reach for effects, keys, state placement and virtualisation to solve performance problems.

### [coding] Write a `useFetch<T>` hook with loading, error, abort and no races. {#coding-usefetch}

```tsx
import { useEffect, useState } from 'react';

type State<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T };

export function useFetch<T>(url: string | null): State<T> {
  const [state, setState] = useState<State<T>>({ status: 'loading' });

  useEffect(() => {
    if (url === null) return;                              // nothing to load yet
    const controller = new AbortController();
    setState({ status: 'loading' });

    (async () => {                                          // an async function inside, not passed to useEffect
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;               // validate with a schema for untrusted data
        setState({ status: 'ready', data });
      } catch (err) {
        if (controller.signal.aborted) return;              // a cancelled request is not an error
        setState({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) });
      }
    })();

    return () => controller.abort();                        // cleanup: a new url or an unmount cancels the old request
  }, [url]);

  return state;
}

// usage
function UserCard({ userId }: { userId: string }) {
  const state = useFetch<{ name: string }>(`/api/users/${userId}`);
  if (state.status === 'loading') return <p>Loading...</p>;
  if (state.status === 'error') return <p role="alert">{state.error.message}</p>;
  return <p>{state.data.name}</p>;                          // data exists only in the ready state
}
```

Explain these points:

- The state is a **discriminated union**. So `data` exists only when `status` is `'ready'`, and the component cannot read it too early.
- The effect depends on `url`. Changing it **aborts the old request in the cleanup** and starts a new one. That prevents a slow old response from overwriting a new one (the race).
- An `AbortError` is ignored, because it is expected.
- The async work is in an **inner async function**, because `useEffect` must return a cleanup function, not a promise.
- `res.ok` is checked, because `fetch` does not reject on HTTP errors.
- For real applications, **TanStack Query** adds caching, de-duplication, retries and refetching on top of this idea.

### [coding] Write a `useDebounce` hook and use it for a search box that queries only after the user pauses typing. {#coding-debounce}

```tsx
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);   // schedule the update
    return () => clearTimeout(id);                                // a newer value cancels the pending one
  }, [value, delayMs]);

  return debounced;
}

export function AccountSearch() {
  const [text, setText] = useState('');
  const query = useDebounce(text.trim(), 300);                    // changes 300 ms after the last keystroke
  const state = useFetch<{ id: string; name: string }[]>(query ? `/api/accounts?search=${encodeURIComponent(query)}` : null);

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search accounts" />   {/* instant */}
      {query && state.status === 'loading' && <p>Searching...</p>}
      {state.status === 'error' && <p role="alert">Search failed</p>}
      {state.status === 'ready' && (
        <ul>{state.data.map((a) => <li key={a.id}>{a.name}</li>)}</ul>
      )}
    </div>
  );
}
```

Explain these points:

- The input stays **controlled and instant**, because it uses the raw `text` state. The request uses the **debounced** value. So one request is sent after the user stops typing, instead of one per keystroke.
- The effect's **cleanup clears the timer**, so only the last value wins.
- `useDebounce` is generic and reusable, and works for any value.
- The search reuses `useFetch`, whose **abort on cleanup** drops the responses for earlier queries.
- The query is passed through `encodeURIComponent`.
- `useDeferredValue` is the built-in alternative for deferring rendering work. But it does not reduce the number of network requests, which is why debouncing is used here.

### [coding] Build a typed shopping-cart store with `useReducer` and context, split into state and dispatch contexts. {#coding-cart}

```tsx
import { createContext, useContext, useMemo, useReducer, type ReactNode, type Dispatch } from 'react';

interface CartItem { id: string; name: string; price: number; qty: number }

type Action =
  | { type: 'add'; item: Omit<CartItem, 'qty'> }
  | { type: 'setQty'; id: string; qty: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

function reducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find((i) => i.id === action.item.id);
      return existing
        ? state.map((i) => (i.id === existing.id ? { ...i, qty: i.qty + 1 } : i))     // new object, no mutation
        : [...state, { ...action.item, qty: 1 }];
    }
    case 'setQty':
      return action.qty <= 0
        ? state.filter((i) => i.id !== action.id)
        : state.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i));
    case 'remove':
      return state.filter((i) => i.id !== action.id);
    case 'clear':
      return [];
    default: {
      const _exhaustive: never = action;                                                // a new action must be handled
      return _exhaustive;
    }
  }
}

const CartStateContext = createContext<CartItem[] | null>(null);
const CartDispatchContext = createContext<Dispatch<Action> | null>(null);              // dispatch never changes

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  return (
    <CartDispatchContext value={dispatch}>
      <CartStateContext value={items}>{children}</CartStateContext>
    </CartDispatchContext>
  );
}

export function useCartItems() {
  const items = useContext(CartStateContext);
  if (!items) throw new Error('useCartItems must be used inside CartProvider');       // a clear error for a missing provider
  return items;
}

export function useCartDispatch() {
  const dispatch = useContext(CartDispatchContext);
  if (!dispatch) throw new Error('useCartDispatch must be used inside CartProvider');
  return dispatch;
}

export function useCartTotal() {
  const items = useCartItems();
  return useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items]);  // derived, recomputed when items change
}

// a component that only adds items does not re-render when the cart changes
export function AddButton({ product }: { product: Omit<CartItem, 'qty'> }) {
  const dispatch = useCartDispatch();
  return <button onClick={() => dispatch({ type: 'add', item: product })}>Add</button>;
}
```

Explain these points:

- The reducer is a **pure function** over a **discriminated union** of actions. So it can be tested without React, and the `never` check forces every new action to be handled.
- Updates create **new arrays and objects**.
- **Two contexts** separate the state (changes often) from `dispatch` (stable). So `AddButton`, which only reads `dispatch`, **does not re-render** when the cart changes.
- The custom hooks give a **typed, null-checked** way to read each context. They fail with a clear message outside the provider.
- The total is **derived with `useMemo`** and not stored.
- React 19 lets the context be used directly as the provider.
- For a cart that many distant components read in small parts, a store with selectors (Zustand or Redux Toolkit) avoids re-rendering all consumers.
