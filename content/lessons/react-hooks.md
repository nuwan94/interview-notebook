---
title: React hooks — useEffect, memoization, useReducer, context and custom hooks
nav: React hooks
slug: react-hooks
summary: React hooks beyond useState, useEffect with dependencies, cleanup, races and StrictMode, why you might not need an effect, useRef and useLayoutEffect, useMemo, useCallback and memo with referential equality and the React Compiler, useReducer, useContext and how to avoid re-render storms, custom hooks, useTransition, useDeferredValue, useId and useSyncExternalStore, data fetching with TanStack Query, Suspense and error boundaries, stale closures and common mistakes, with examples and interview questions.
tags: [React, Hooks, useEffect, useMemo, useCallback, useReducer, Context, Custom hooks, Performance, Full stack]
order: 64
topic: Full stack / React
updated: 2026-11-18
subnav: true
---

Hooks are where most React interview questions go deep. They ask *what `useEffect` is for and what its dependency array means, why an effect needs a cleanup, how to avoid a race when fetching, what `useMemo` and `useCallback` really do, when a component re-renders and how context changes that, when to use `useReducer`, how to write a custom hook, and what a stale closure is.* This lesson builds on [React core](lesson:react-core#state) and on [closures](lesson:js-essentials#closures) and [async code](lesson:js-async#cancellation), because every hook bug is one of those. The examples are TypeScript. Play the four scenes: `useEffect`, memoization, reducer and context, and custom hooks.

```demo
name: react-hooks-walk
```

> **One sentence to remember:** *Render is pure, effects synchronise with the outside world and clean up after themselves, memoization only helps when references matter, shared state goes in a reducer or context, and shared logic goes in a custom hook.*

## What hooks are {#hooks}

A **hook** is a function that lets a function component use React features (state, effects, context, refs). Their names start with `use`. Rules recap ([Rules of Hooks](lesson:react-core#bugs)): call them **at the top level**, in the **same order** every render, only in components or other hooks.

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

**Why hooks:** class components spread related logic across `componentDidMount`, `componentDidUpdate` and `componentWillUnmount`, and sharing logic needed render props or higher-order components. Hooks group code by **concern** and let you reuse it with **custom hooks**. Class components still work but new code uses hooks.

## useEffect {#effect}

An **effect** runs code **after the component has rendered and the DOM is updated** (the first scene). It is for **synchronising the component with something outside React**: a subscription, a timer, a network request, a browser API, a non-React widget.

```tsx
useEffect(() => {
  const connection = createConnection(roomId);     // setup
  connection.connect();
  return () => connection.disconnect();            // cleanup: runs before the next run and on unmount
}, [roomId]);                                      // dependencies: run again when roomId changes
```

- **Dependency array:** `[a, b]` runs after the first render and whenever `a` or `b` changed (compared with `Object.is`). **`[]`** runs only on mount (and cleanup on unmount). **No array** runs after **every** render. Include **every reactive value** the effect reads (props, state, values derived from them), which the `exhaustive-deps` lint rule checks. **Do not silence it:** a missing dependency means a **stale closure**.
- **Cleanup:** return a function that undoes the setup (unsubscribe, clear the timer, abort the request). React runs it **before re-running** the effect and **on unmount**.
- **Timing:** effects run **after paint**, so they do not block rendering. `useLayoutEffect` runs **before the paint**, for measuring the DOM and changing it without a flicker (it blocks painting, so use it rarely).
- **StrictMode** (development) mounts, cleans up and mounts again to check that setup and cleanup are a matching pair (the fourth frame). It only runs in development.
- **Effects are not for everything.** React's guidance is **"You might not need an effect"**:
  - **Derived data:** compute it during render (`const total = items.reduce(...)`), not in an effect that calls `setState`.
  - **Reacting to a user action:** put the code in the **event handler** (it knows what happened), not in an effect watching state.
  - **Resetting state when a prop changes:** use a **`key`** ([keys](lesson:react-core#keys)).
  - **Sharing logic or state between components:** lift state up or use a custom hook.
  - **Fetching data:** use a data library or a framework loader, or an effect with cleanup (below).
- **`useEffectEvent`** (stable from React 19.2) lets an effect call a function that always sees the **latest** props and state without becoming a dependency, for example logging the latest value inside an effect that should not re-run when it changes.

### Fetching in an effect without a race {#fetching}

The second and third frames show the problem: responses can arrive out of order, and an old response can overwrite a new one. Clean up by **aborting** the old request:

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

An **ignore flag** (`let ignore = false; ... if (!ignore) setUser(...); return () => { ignore = true; }`) also works when the API cannot be aborted. In real applications prefer **TanStack Query**, SWR, RTK Query or a framework data layer, which add caching, de-duplication, retries and refetching, so you do not rewrite them ([fetch pitfalls](lesson:js-async#fetch)).

## useRef and useLayoutEffect {#ref}

`useRef` is a mutable `{ current }` that persists across renders and **does not trigger a render** ([refs](lesson:react-core#refs)). Use it for DOM nodes, timer ids, the previous value, or a flag. Reading or writing `ref.current` belongs in **handlers and effects**, not in render. A ref is also the escape hatch for a stale closure: store the latest callback in a ref and read it from a long-lived effect.

## Memoization: useMemo, useCallback, memo {#memo}

React re-renders a component when its **state changes**, its **parent re-renders**, or a **context changes**. A re-render is usually cheap, so memoization is an optimisation, not a default.

- **`useMemo(() => compute(a, b), [a, b])`** caches a **value** until a dependency changes. Use it for an **expensive calculation** or to keep an **object or array reference stable**.
- **`useCallback(fn, deps)`** caches a **function** (it is `useMemo(() => fn, deps)`). Use it when the function is a prop of a `memo` child or a dependency of an effect.
- **`memo(Component)`** skips re-rendering when the props are **shallowly equal**.
- **Referential equality is the point** (the second scene): `{}`, `[]` and `() => {}` are **new objects every render**, so `memo` sees a changed prop. `useMemo` and `useCallback` give the same reference while the dependencies are unchanged.

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

- **Do not memoize everything.** Memoization costs code, memory and comparisons, and a missing dependency causes a **stale value**. Measure with the **React DevTools Profiler** and fix real problems.
- **Better fixes first:** **move state down** to the component that needs it, **pass `children`** so unchanged parts are not re-created, split a slow component, **virtualise** long lists (react-window, TanStack Virtual), and debounce input.
- **React Compiler** (a build-time plugin) adds memoization automatically for components that follow the rules of React, so manual `useMemo`, `useCallback` and `memo` are mostly unnecessary in new code, but you still see them in existing code and in interviews.

## useReducer {#reducer}

`useReducer(reducer, initialState)` returns `[state, dispatch]`. Components **dispatch actions** (descriptions of what happened) and a **pure reducer** computes the next state (the third scene).

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

- **When:** many related transitions, state that depends on the previous state, or logic you want to **test as a plain function** (the reducer needs no React). For one value, `useState` is simpler.
- **`dispatch` is stable** (the same function every render), so it is safe to pass down or use in effect dependencies.
- The reducer **must be pure** and **must not mutate** its arguments. With TypeScript a **discriminated union** of actions makes the `switch` exhaustive ([narrowing](lesson:ts-essentials#narrowing)). This is the same idea as Redux, which is covered in the next lesson.

## useContext {#context}

**Context** lets a component pass a value to **all descendants** without threading props through every level (**prop drilling**).

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

- **Every consumer re-renders when the provider's value changes** (the second frame), even if it uses a part that did not change, and `memo` does not stop that.
- **Avoid a re-render storm:**
  - **Memoise the value** (`useMemo`) so it is not a new object every render.
  - **Split contexts**: one for the **state** (changes often) and one for the **dispatch** or actions (stable), so components that only trigger changes do not re-render (the third frame).
  - **Keep the state close** to where it is used, and put only truly global data in context (current user, theme, locale, feature flags).
- **Context is not a state manager.** It transports a value, and the state still lives in `useState` or `useReducer`. For frequently changing global state use a store (Redux Toolkit, Zustand) with selectors, covered next.
- **Providers go at the top**, and nested providers override outer ones for their subtree.

## Custom hooks {#custom}

A **custom hook** is a function whose name starts with `use` that calls other hooks. It **shares logic**, not state: every call has **its own state** (the second frame of the last scene).

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
- **Naming matters:** the `use` prefix lets React and the linter apply the Rules of Hooks.
- **Return** a tuple (`as const`) for two or three values, or an object for more, so callers can rename.
- **Test** with `renderHook` from React Testing Library, and keep the logic in plain functions where possible.
- **Hook, component or utility?** If it uses hooks, it is a hook. If it returns JSX, it is a component. If it is pure calculation, it is a plain function.

## Other hooks worth knowing {#other}

- **`useTransition`** marks a state update as **non-urgent**, so urgent updates (typing) stay responsive while a heavy re-render happens in the background, and it gives `isPending`. **`useDeferredValue`** gives a lagging copy of a value for the same purpose, for example a big filtered list that follows the input.
- **`useId`** creates stable unique ids for `htmlFor`/`aria-*` that match between server and client rendering.
- **`useSyncExternalStore`** subscribes to an external store (Redux, browser APIs such as `navigator.onLine`) in a way that is safe with concurrent rendering. Libraries use it.
- **`useImperativeHandle`** exposes a small imperative API from a component through a ref (rarely needed).
- **`use`** (React 19) reads a promise or a context during render and can be called conditionally, with `<Suspense>` showing a fallback while the promise is pending.
- **`useOptimistic`, `useActionState`, `useFormStatus`:** forms and optimistic updates ([React 19](lesson:react-core#react19)).

## Suspense and error boundaries {#suspense}

- **`<Suspense fallback={<Spinner />}>`** shows a fallback while a child is waiting (lazy-loaded code with `React.lazy`, or data read with `use` or a library that supports it). It enables **code splitting** and streaming server rendering.
- **Error boundaries** catch errors thrown **during rendering** of their children and show a fallback UI instead of a blank page. They are class components, or use `react-error-boundary`. They do **not** catch errors in event handlers, async code or effects (handle those yourself), so combine them with `try/catch` and error state.

## Stale closures and common mistakes {#mistakes}

A component function runs again on every render, and each run's handlers and effects **close over that render's values** ([closures](lesson:js-essentials#closures)). A callback that lives longer than one render sees **old** values:

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

A hook for running side effects that synchronise a component with something outside React, such as a subscription, a timer, a network request or a browser API. It runs after the component has rendered and the DOM is updated, normally after the paint. The dependency array controls when: after every render with no array, only once with `[]`, and when a listed value changed otherwise. It can return a cleanup function that React runs before the next run and when the component unmounts.

### [basic] What does the dependency array do and what happens if you leave out a dependency? {#deps-q}

React compares each listed value to its value from the previous render with `Object.is` and re-runs the effect only if one changed. If you leave out a value the effect uses, the effect keeps a closure over an old value (a stale closure) and works with out-of-date data, which causes subtle bugs. Include every reactive value the effect reads and fix the cause (updater form, moving the function inside, a ref or `useEffectEvent`) instead of suppressing the lint rule.

### [basic] Why does an effect need a cleanup function? {#cleanup-q}

So that what the effect set up is undone: unsubscribe, clear the timer, close the connection, abort the request. React runs the cleanup before the effect runs again and when the component unmounts. Without it you get memory leaks, duplicate subscriptions and races where an old request updates state after a new one. StrictMode in development mounts, cleans up and mounts again to reveal missing cleanups.

### [basic] What is the difference between `useMemo` and `useCallback`? {#memo-q}

`useMemo` caches the result of a calculation, a value, until its dependencies change. `useCallback` caches a function instance, and `useCallback(fn, deps)` is the same as `useMemo(() => fn, deps)`. Both exist to keep a reference stable between renders, which matters when the value is a prop of a `memo` child or a dependency of an effect, or when the calculation is expensive. They are optimisations to apply after measuring, not defaults.

### [basic] When would you use `useReducer` instead of `useState`? {#reducer-q}

When state has several related fields or many kinds of transitions, when the next state depends on the previous one in complex ways, or when you want the update logic in one pure, testable function. Components dispatch descriptive actions and the reducer computes the next state. `dispatch` is stable, so it is easy to pass down. For a single independent value `useState` is simpler.

### [basic] What is a custom hook? {#custom-q}

A function whose name starts with `use` and that calls other hooks, used to share stateful logic between components, such as `useFetch`, `useDebounce` or `useLocalStorage`. It shares the logic, not the state: each call has its own state. The `use` prefix lets React and the linter enforce the Rules of Hooks.

### [intermediate] How do you fetch data in `useEffect` safely? {#fetch-q}

Start the request inside the effect with an `AbortController` and pass its signal to `fetch`. Return a cleanup that aborts it, so when the dependency changes or the component unmounts the old request is cancelled and cannot overwrite newer state, and ignore the resulting `AbortError`. Check `res.ok`, track loading and error state, and include every input of the request in the dependencies. For anything beyond a simple case use TanStack Query or a framework loader, which add caching, de-duplication and retries.

### [intermediate] What are the cases where you do not need an effect? {#no-effect-q}

Deriving data from props or state, which you compute during render. Responding to a user action, which belongs in the event handler. Resetting state when a prop changes, which you do with a `key`. Updating state from other state in a chain of effects, which causes extra renders and loops. Sharing logic, which is a custom hook. Subscribing to an external store, which is `useSyncExternalStore`. Effects are for synchronising with the outside world.

### [intermediate] Why does `memo` not help when I pass an inline function or object prop? {#memo-ref-q}

`memo` compares props shallowly by reference. An inline function, array or object literal is a new reference on every render of the parent, so the props always look changed and the child re-renders. Keep the references stable with `useCallback` and `useMemo`, define constants outside the component, or let the React Compiler do it. Only memoize when profiling shows a real cost.

### [intermediate] A component re-renders although its props did not change. Why? {#rerender-q}

Because its parent re-rendered (children re-render with their parent unless wrapped in `memo`), or because it reads a context whose value changed, or its own state changed. Props being equal does not stop a re-render unless `memo` is used. Check what changed with the Profiler's "why did this render", move state down, pass children, or memoise.

### [intermediate] Why does everything re-render when a context value changes, and how do you reduce it? {#context-q}

Every component that calls `useContext` for that context re-renders when the provider's value changes by reference, even if it only uses a part of the value, and `memo` does not prevent it. Reduce it by memoising the value with `useMemo`, splitting the context into a state context and a stable dispatch context (or several smaller contexts), keeping state local where possible, and using a store with selectors (Redux Toolkit, Zustand) for frequently changing global state.

### [intermediate] What is the stale closure problem with `setInterval` in an effect? {#stale-q}

An effect created with `[]` captures the state and props of the first render, so a callback in `setInterval(() => setCount(count + 1))` always sees the initial `count` and the counter sticks. Fix it with the updater form `setCount(c => c + 1)`, which needs no dependency, by listing the dependency and restarting the interval, by reading the latest value from a ref, or with `useEffectEvent`.

### [intermediate] What is the difference between `useEffect` and `useLayoutEffect`? {#layout-q}

`useEffect` runs after the browser has painted, so it does not delay what the user sees. `useLayoutEffect` runs synchronously after the DOM updates but before the paint, so you can measure layout and change it without a visible flicker, at the cost of blocking painting. Use `useEffect` by default and `useLayoutEffect` only for measurements and DOM adjustments. Neither runs during server rendering.

### [deep] How do `useTransition` and `useDeferredValue` help with slow renders? {#transition-q}

They use concurrent rendering to keep the UI responsive. `useTransition` wraps a state update in `startTransition`, marking it non-urgent, so React can interrupt it for urgent updates such as typing and shows `isPending` meanwhile. `useDeferredValue` returns a copy of a value that lags behind, so an expensive list that depends on it re-renders in the background while the input stays fast. They do not make the work cheaper, they schedule it, and a slow component may still need memoisation or virtualisation.

### [deep] How would you design state management for a large React application? {#state-design-q}

Keep state as local as possible with `useState` and `useReducer`, lift it only when siblings share it, and derive what can be computed. Treat server data as a separate cache managed by TanStack Query or RTK Query (loading, caching, invalidation), not copied into global state. Put truly shared client state, such as the current user, UI preferences and cross-page workflow, in context for rarely changing values or in a store (Redux Toolkit or Zustand) with selectors for frequently changing ones. Keep URL state in the router, form state in a form library, and avoid putting everything in one global object.

### [deep] What changes with the React Compiler? {#compiler-q}

It is a build-time plugin that analyses components and hooks and inserts memoization automatically, so values and functions keep stable references and unchanged parts skip rendering, without writing `useMemo`, `useCallback` or `memo`. It relies on the rules of React: pure render, no mutation of props or state, hooks at the top level. Code that breaks the rules is skipped or can behave wrongly. Manual memoization is still valid and appears in older code, and you still reach for effects, keys, state placement and virtualisation to solve performance problems.

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

Explain: the state is a **discriminated union**, so `data` exists only when `status` is `'ready'` and the component cannot read it too early; the effect depends on `url`, so changing it **aborts the old request in the cleanup** and starts a new one, which prevents a slow old response from overwriting a new one (the race); an `AbortError` is ignored because it is expected; the async work is in an **inner async function**, since `useEffect` must return a cleanup function and not a promise; `res.ok` is checked because `fetch` does not reject on HTTP errors; and for real applications **TanStack Query** adds caching, de-duplication, retries and refetching on top of this idea.

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

Explain: the input stays **controlled and instant** by using the raw `text` state, while the request uses the **debounced** value, so one request is sent after the user stops typing instead of one per keystroke; the effect's **cleanup clears the timer**, so only the last value wins; `useDebounce` is generic and reusable and works for any value; the search reuses `useFetch`, whose **abort on cleanup** drops the responses for earlier queries; the query is passed through `encodeURIComponent`; and `useDeferredValue` is the built-in alternative for deferring rendering work, but it does not reduce the number of network requests, which is why debouncing is used here.

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

Explain: the reducer is a **pure function** over a **discriminated union** of actions, so it can be tested without React and the `never` check forces every new action to be handled; updates create **new arrays and objects**; **two contexts** separate the state (changes often) from `dispatch` (stable), so `AddButton`, which only reads `dispatch`, **does not re-render** when the cart changes; the custom hooks give a **typed, null-checked** way to read each context and fail with a clear message outside the provider; the total is **derived with `useMemo`** and not stored; React 19 lets the context be used directly as the provider; and for a cart that many distant components read in small parts, a store with selectors (Zustand or Redux Toolkit) avoids re-rendering all consumers.
