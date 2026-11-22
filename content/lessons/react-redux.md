---
title: Redux Toolkit — store, slices, thunks, selectors and RTK Query
nav: Redux
slug: react-redux
summary: State management with Redux, the store, actions and reducers, one-way data flow, immutability and Immer, Redux Toolkit with configureStore and createSlice, React-Redux hooks, typed hooks in TypeScript, createAsyncThunk for async work, selectors and Reselect memoisation, createEntityAdapter, listener middleware, RTK Query with cache tags and mutations, normalised state, Redux DevTools, testing, and when to use Redux instead of context, Zustand or TanStack Query, with banking examples and interview questions.
tags: [Redux, Redux Toolkit, RTK Query, React, State management, Selectors, Thunk, Full stack]
order: 66
topic: Full stack / React
updated: 2026-11-18
subnav: true
---

Redux appears in most React interviews at companies with large front ends. They ask *what Redux is and why you would use it, what an action, a reducer and the store are, why reducers must be pure, what Redux Toolkit changed, how you do async work, what a selector is and how it avoids re-renders, what RTK Query is, and when you would not use Redux at all.* This lesson builds on [React hooks](lesson:react-hooks#reducer) (`useReducer` is Redux in small) and on [TypeScript](lesson:ts-essentials#generics). The examples are TypeScript and use banking data. Play the four scenes: the data flow, async thunks, selectors and re-renders, and RTK Query.

```demo
name: redux-walk
```

> **One sentence to remember:** *Components dispatch actions, pure reducers return the next state, the store notifies subscribers, selectors pick what each component needs, and RTK Query keeps server data out of your reducers.*

## What Redux is {#what}

**Redux** is a predictable state container: one **store** holds the application state as a single plain object, and the only way to change it is to **dispatch an action**. A **reducer** (a pure function) computes the next state from the current state and the action. Any component can read from the store and re-render when the part it reads changes.

Three principles:

1. **Single source of truth**: one store, one state tree.
2. **State is read-only**: you never change it directly, you dispatch an action that describes what happened.
3. **Changes are made with pure functions**: `(state, action) => newState`, with no side effects.

Because every change is an action, you get a log of *what happened and in which order*. The Redux DevTools use this for time-travel debugging: step back and forth through actions and inspect the state after each.

**Plain Redux versus Redux Toolkit.** Hand-written Redux needed a lot of boilerplate (action type constants, action creators, switch statements, spread copies, store setup). **Redux Toolkit (RTK)** is the official, recommended way to write Redux today. It removes that boilerplate and adds good defaults. New code should use RTK, and "Redux" in a job description normally means "Redux Toolkit".

## The data flow {#flow}

The first scene shows one-way flow:

1. A user event runs a handler, which calls `dispatch(action)`.
2. The store passes the current state and the action to the **reducer**.
3. The reducer returns the **new state**. The store saves it.
4. Subscribers are notified. Each `useSelector` re-runs and compares its result by **reference**. Components whose selected value changed render again.
5. **Middleware** sits between `dispatch` and the reducer and can see every action.

An action is a plain object, by convention `{ type: 'domain/eventName', payload }`:

```ts
dispatch({ type: 'cart/itemAdded', payload: { sku: 'CARD-GOLD', qty: 1 } });
```

Name actions as **events that happened** (`cart/itemAdded`), not as setters (`setCart`). This keeps reducers in charge of how state changes and makes the log readable.

## Reducers must be pure {#pure}

A reducer takes `(state, action)` and returns the next state. It must be:

- **Pure**: the same inputs always give the same output. No network calls, no `Date.now()`, no `Math.random()`, no writing to the DOM.
- **Immutable**: it never changes the `state` object it received. It returns a new object for what changed and reuses the rest.

Why: Redux and React detect change by **reference** (`===`). If you mutate the old object and return it, nothing looks changed, the selector returns the same reference, and the UI does not update. Pure reducers are also trivial to test and to replay.

```ts
// Hand-written immutable update: copy every level you change
function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'cart/itemAdded':
      return {
        ...state,
        items: [...state.items, action.payload],   // new array, new state
      };
    default:
      return state;                                // unknown action: same reference
  }
}
```

Deeply nested updates with spreads are error-prone. RTK solves this with **Immer**.

## Redux Toolkit: configureStore and createSlice {#toolkit}

A **slice** is a piece of state with its reducers and generated action creators, kept together in one file.

```ts
// features/accounts/accountsSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Account {
  id: string;
  owner: string;
  balance: number;       // minor units (cents), never floating point money
  frozen: boolean;
}

interface AccountsState {
  items: Account[];
  selectedId: string | null;
}

const initialState: AccountsState = { items: [], selectedId: null };

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    accountSelected(state, action: PayloadAction<string>) {
      state.selectedId = action.payload;           // looks like mutation, is not
    },
    accountFrozen(state, action: PayloadAction<string>) {
      const account = state.items.find((a) => a.id === action.payload);
      if (account) account.frozen = true;
    },
  },
});

export const { accountSelected, accountFrozen } = accountsSlice.actions;
export default accountsSlice.reducer;
```

`createSlice` generates the action creators (`accountFrozen('A-1')` returns `{ type: 'accounts/accountFrozen', payload: 'A-1' }`) and the reducer.

**Immer.** Inside `createSlice` reducers you may write "mutating" code. RTK wraps your reducer with Immer, which gives you a **draft** (a proxy), records what you changed, and produces a new immutable state with structural sharing (unchanged parts keep the same reference). Rules: either mutate the draft **or** return a new value, never both, and this only works inside `createSlice`, `createReducer` and `produce`, not in a hand-written reducer.

**The store:**

```ts
// app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import accounts from '../features/accounts/accountsSlice';
import { api } from '../services/api';

export const store = configureStore({
  reducer: {
    accounts,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

`configureStore` combines the slice reducers, adds the **thunk** middleware, turns on the **Redux DevTools**, and in development adds checks that warn about **state mutation** and **non-serialisable values** in state or actions (a `Date`, a `Map`, a class instance, an `Error`).

## React-Redux hooks {#hooks}

Wrap the app once in a `Provider`, then read and write with hooks.

```tsx
import { Provider, useDispatch, useSelector } from 'react-redux';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
```

In TypeScript, define **typed hooks** once and use them everywhere, so you never repeat the types:

```ts
// app/hooks.ts
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

```tsx
function SelectedAccount() {
  const account = useAppSelector((s) =>
    s.accounts.items.find((a) => a.id === s.accounts.selectedId));
  const dispatch = useAppDispatch();

  if (!account) return <p>Select an account.</p>;
  return (
    <button onClick={() => dispatch(accountFrozen(account.id))}>
      Freeze {account.owner}
    </button>
  );
}
```

`useSyncExternalStore` ([hooks lesson](lesson:react-hooks#other)) is what React-Redux uses under the hood, so it is safe with concurrent rendering.

## Async work: createAsyncThunk {#thunks}

Reducers must be pure, so side effects such as a network call live outside them. The **thunk middleware** (included by default) lets you dispatch a **function** instead of an object. `createAsyncThunk` builds the usual pattern: it dispatches **pending**, then **fulfilled** or **rejected** (the second scene).

```ts
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export const fetchAccounts = createAsyncThunk<
  Account[],                              // returned (fulfilled payload)
  void,                                   // argument
  { rejectValue: string }                 // reject payload type
>('accounts/fetch', async (_, { rejectWithValue, signal }) => {
  const res = await fetch('/api/accounts', { signal });
  if (!res.ok) return rejectWithValue(`HTTP ${res.status}`);
  return (await res.json()) as Account[];
});

const slice = createSlice({
  name: 'accounts',
  initialState: { items: [] as Account[], status: 'idle' as 'idle' | 'loading' | 'failed', error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccounts.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchAccounts.fulfilled, (s, a) => { s.status = 'idle'; s.items = a.payload; })
      .addCase(fetchAccounts.rejected, (s, a) => { s.status = 'failed'; s.error = a.payload ?? a.error.message ?? 'Unknown error'; });
  },
});
```

Points to know:

- `extraReducers` handles actions defined **outside** the slice (thunk lifecycle actions, other slices' actions). `reducers` defines the slice's own actions.
- `dispatch(fetchAccounts())` returns a promise. `await dispatch(...).unwrap()` throws on rejection, which is handy in an event handler.
- It passes an `AbortSignal` (`signal`) and the promise has `.abort()`, for [cancellation](lesson:js-async#cancellation).
- A `condition` option can skip a call when the data is already loaded or loading.
- Store a **serialisable** error message in state, not the `Error` object.

For new code that only loads and caches server data, prefer **RTK Query** (below) over hand-written thunks. Thunks remain right for multi-step workflows that touch several slices.

## Selectors {#selectors}

A **selector** is a function `(state) => value` that reads from the store. Keep them next to the slice and use them everywhere, so components do not know the shape of the state.

```ts
export const selectAccounts = (s: RootState) => s.accounts.items;
export const selectSelectedId = (s: RootState) => s.accounts.selectedId;
```

**Re-render rule.** After every dispatch `useSelector` re-runs and compares the result with the previous one using `===`. If it is the same reference, the component skips the render (the third scene).

The common bug is a selector that **creates a new reference every time**:

```ts
// Bad: .filter returns a new array on every run, so the component renders after EVERY action
const frozen = useAppSelector((s) => s.accounts.items.filter((a) => a.frozen));
```

Fix it with **`createSelector`** from Reselect (re-exported by RTK). It memoises: it recomputes only when its input selectors return different values.

```ts
import { createSelector } from '@reduxjs/toolkit';

export const selectFrozenAccounts = createSelector(
  [selectAccounts],
  (items) => items.filter((a) => a.frozen),       // runs only when items changed
);

export const selectTotalBalance = createSelector(
  [selectAccounts],
  (items) => items.reduce((sum, a) => sum + a.balance, 0),
);
```

Other rules:

- Select the **smallest** value you need. Selecting the whole `state.accounts` re-renders on any change inside it.
- A selector that takes an argument (`selectAccountById(state, id)`) needs care, because a plain `createSelector` has a cache size of one. Use `createSelector` with an `id` argument for a small list, or `createEntityAdapter` selectors.
- Compute **derived data** in selectors, not in the store. Do not store `totalBalance` in state, because it can go out of sync.

## Normalised state and createEntityAdapter {#normalise}

Storing a list as an array makes "find by id" and updating one item slow and clumsy. **Normalised** state stores items in an object keyed by id plus an ordered list of ids, like a database table. `createEntityAdapter` generates this shape, the reducers and the selectors.

```ts
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

const accountsAdapter = createEntityAdapter<Account>({
  sortComparer: (a, b) => a.owner.localeCompare(b.owner),
});

const slice = createSlice({
  name: 'accounts',
  initialState: accountsAdapter.getInitialState(),    // { ids: [], entities: {} }
  reducers: {
    accountsLoaded: accountsAdapter.setAll,
    accountUpdated: accountsAdapter.updateOne,
    accountRemoved: accountsAdapter.removeOne,
  },
});

export const { selectAll, selectById, selectIds } =
  accountsAdapter.getSelectors((s: RootState) => s.accounts);
```

Normalise when the same entity appears in several places (an account shown in a list, a detail page and a payment form) so that there is **one copy** to update.

## Middleware and listeners {#middleware}

**Middleware** wraps `dispatch`. It receives every action before the reducer and can log it, change it, delay it, dispatch more actions, or stop it. Thunk is middleware. RTK adds the **listener middleware** for side effects triggered by actions, without a separate library:

```ts
import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';

export const listeners = createListenerMiddleware();

listeners.startListening({
  matcher: isAnyOf(accountFrozen),
  effect: async (action, api) => {
    await fetch(`/api/accounts/${action.payload}/freeze`, { method: 'POST' });
    api.dispatch(notificationAdded('Account frozen'));
  },
});
```

Use it for "when X happens, also do Y" logic (audit logging, persisting a draft, analytics). Older code uses **redux-saga** (generators) or **redux-observable** (RxJS) for the same job, which you may meet in legacy projects.

## RTK Query {#rtkquery}

**RTK Query** is a data-fetching and caching layer built into RTK. You describe endpoints, and it generates hooks that fetch, cache, de-duplicate and refetch, so you do not write thunks, loading flags or reducers for server data (the fourth scene).

```ts
// services/api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Account'],
  endpoints: (build) => ({
    getAccounts: build.query<Account[], void>({
      query: () => '/accounts',
      providesTags: ['Account'],
    }),
    getAccount: build.query<Account, string>({
      query: (id) => `/accounts/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Account', id }],
    }),
    addAccount: build.mutation<Account, Pick<Account, 'owner'>>({
      query: (body) => ({ url: '/accounts', method: 'POST', body }),
      invalidatesTags: ['Account'],
    }),
  }),
});

export const { useGetAccountsQuery, useGetAccountQuery, useAddAccountMutation } = api;
```

```tsx
function AccountList() {
  const { data, isLoading, isError, refetch } = useGetAccountsQuery();
  const [addAccount, { isLoading: saving }] = useAddAccountMutation();

  if (isLoading) return <p>Loading…</p>;
  if (isError || !data) return <button onClick={refetch}>Retry</button>;

  return (
    <>
      <ul>{data.map((a) => <li key={a.id}>{a.owner}</li>)}</ul>
      <button disabled={saving} onClick={() => addAccount({ owner: 'Alice' })}>Add</button>
    </>
  );
}
```

How it works:

- **Cache key** = endpoint name + serialised arguments. Components that ask for the same key **share one request and one cache entry**.
- **Reference counting**: the entry is removed after `keepUnusedDataFor` seconds (default 60) once no component uses it.
- **Tags**: queries `providesTags`, mutations `invalidatesTags`. When a mutation succeeds, every query that provides an invalidated tag is **refetched** automatically.
- Options: `pollingInterval`, `refetchOnFocus`, `refetchOnReconnect`, `skip`, `selectFromResult`, **optimistic updates** with `onQueryStarted` and `updateQueryData`, and **streaming updates** with `onCacheEntryAdded` (for example a WebSocket).
- `isLoading` is true only for the first load, `isFetching` is true for any request in flight.

RTK Query and **TanStack Query** solve the same problem. RTK Query fits when you already use Redux and want the cache inside the store and visible in DevTools. TanStack Query is store-independent.

## Redux or something else {#when}

| Need | Good choice |
| --- | --- |
| state used by one component | `useState` |
| state shared by a few nearby components | lift state up |
| rarely changing global value (theme, current user, locale) | context |
| server data (lists, details, caching, refetching) | RTK Query or TanStack Query |
| a lot of client state shared widely, with many events and complex updates | Redux Toolkit |
| a small global client store with little ceremony | Zustand or Jotai |
| state that belongs in the URL (filters, page, tab) | the router and search params |
| form state | React Hook Form or Formik, not Redux |

Redux earns its cost when many parts of the UI **react to the same events**, state transitions are non-trivial, you want **DevTools and an action log**, or a big team needs one predictable convention. It is a poor fit for a small app, for server data that you copy into slices by hand, or for form fields. The modern advice: put **server state** in RTK Query or TanStack Query and keep **only real client state** in Redux, which usually shrinks the store to a few small slices.

## Testing {#testing}

- **Reducers and slices**: call the reducer with a state and an action and assert the result. No React needed.
- **Selectors**: pass a state object, assert the output (and that the same input gives the same reference).
- **Thunks**: dispatch to a real store and check the final state, with `fetch` mocked (MSW is the usual tool).
- **Components**: render with a real store through a small helper, not a mocked one, and assert what the user sees.

```ts
import { configureStore } from '@reduxjs/toolkit';
import reducer, { accountFrozen } from './accountsSlice';

test('freezes the account', () => {
  const before = { items: [{ id: 'A-1', owner: 'Alice', balance: 100, frozen: false }], selectedId: null };
  const after = reducer(before, accountFrozen('A-1'));
  expect(after.items[0].frozen).toBe(true);
  expect(before.items[0].frozen).toBe(false);          // old state untouched
});

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({ reducer: { accounts: reducer }, preloadedState });
}
```

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| mutating state outside `createSlice` | return new objects, or move the code into a slice |
| a selector that returns a new array or object | `createSelector`, or select primitives |
| selecting the whole slice | select the smallest value |
| storing derived data | compute it in a selector |
| putting a `Date`, `Map`, class or `Error` in state | store a string, number or plain object |
| side effects in a reducer | use a thunk, a listener or RTK Query |
| copying RTK Query data into a slice | read it with the hook |
| one giant slice | one slice per feature, keep related state together |
| putting form input or UI-only flags in Redux | keep it in local state |
| dispatching setters (`setBalance`) | dispatch events (`paymentSettled`) |
| forgetting `api.middleware` in the store | the cache and polling will not work |

## For a Java developer {#java}

| Java and Spring | Redux |
| --- | --- |
| a single application-scoped state holder | the store |
| a command or event | an action |
| an event handler that returns a new aggregate | a reducer |
| event sourcing (replay events to rebuild state) | the action log and time-travel DevTools |
| an immutable record with `with...` copies | Immer drafts and structural sharing |
| an `ApplicationListener` or `@EventListener` | listener middleware |
| an interceptor or filter chain | middleware |
| a repository query | a selector |
| `@Cacheable` plus eviction on update | RTK Query tags and invalidation |
| a read model projected from events | derived data from `createSelector` |

Try it in the lab: [Redux: dispatch, reducer, store, selector](lab:redux-data-flow).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| store | one object, changed only by dispatching actions |
| action | plain object `{ type, payload }`, named as an event |
| reducer | pure `(state, action) => state`, no mutation, no side effects |
| Redux Toolkit | `configureStore`, `createSlice`, Immer, DevTools, thunk and checks included |
| Immer | mutate the draft or return a new value, never both |
| hooks | `Provider`, `useSelector`, `useDispatch`, typed with `.withTypes` |
| thunk | `createAsyncThunk`, pending, fulfilled, rejected, `unwrap()` |
| selector | `(state) => value`, select little, memoise derived values with `createSelector` |
| re-render | `useSelector` compares by `===`, a new reference means a render |
| normalise | `createEntityAdapter`, `ids` plus `entities` |
| listener | `createListenerMiddleware` for "when X happens do Y" |
| RTK Query | `createApi`, cache by endpoint and args, tags for invalidation |
| use Redux for | shared client state with many events, not server data or forms |

## Interview questions {#questions}

### [basic] What is Redux and what problem does it solve? {#what-q}

Redux is a predictable state container with **one store** holding the application state. State changes only by dispatching **actions**, and **pure reducers** compute the next state. It solves the problem of state shared by many distant components: instead of passing props through many levels or having several components change shared data in ways that are hard to trace, all changes go through one path that is logged, testable and inspectable with DevTools. It costs boilerplate and indirection, so it is worth it when the shared client state is large and complex.

### [basic] What are an action, a reducer and the store? {#parts-q}

An **action** is a plain object that describes an event, `{ type: 'cart/itemAdded', payload }`. A **reducer** is a pure function `(state, action) => newState`. The **store** holds the state, runs the reducer when an action is dispatched, and notifies subscribers. Components read with selectors and write by dispatching.

### [basic] Why must a reducer be pure and never mutate state? {#pure-q}

Redux and React detect change by **reference comparison**. If a reducer mutates the existing state and returns it, the reference is the same, so selectors return the same value and the UI does not update. Impurity (network calls, random values, time) also makes the same action produce different results, which breaks testing, time-travel and replay. So a reducer computes the new state only from its two arguments and returns new objects for whatever changed.

### [basic] What is Redux Toolkit and why is it recommended? {#rtk-q}

Redux Toolkit is the official toolset for writing Redux. `configureStore` sets up the store with the DevTools, thunk middleware and development checks. `createSlice` generates action creators and reducers from one definition, and uses **Immer** so you can write "mutating" code that is turned into immutable updates. It also provides `createAsyncThunk`, `createEntityAdapter`, `createSelector`, the listener middleware and **RTK Query**. It removes most boilerplate and common mistakes of hand-written Redux.

### [basic] How do you read from and write to the store in a React component? {#hooks-q}

Wrap the app in `<Provider store={store}>`. Read with `useSelector((state) => state.slice.value)`, which re-renders the component when the selected value changes. Write with `const dispatch = useDispatch()` and `dispatch(action())`. In TypeScript you define `useAppSelector` and `useAppDispatch` once with `.withTypes<RootState>()` and `.withTypes<AppDispatch>()` and use those.

### [basic] What is a selector and why use one? {#selector-q}

A selector is a function that takes the state and returns a value. Using selectors hides the shape of the state from components (so you can reorganise it), puts derived-data logic in one place and, with `createSelector`, allows memoisation. Components should use selectors rather than reach into `state.a.b.c` directly.

### [intermediate] How does Immer let you write mutating code in a reducer? {#immer-q}

Inside `createSlice`, RTK wraps each reducer with Immer's `produce`. The reducer receives a **draft**, a proxy of the state. Your assignments and `push` calls on the draft are recorded, and when the reducer finishes Immer builds a new immutable state that contains the changes and **shares unchanged parts** with the old one. Rules: mutate the draft **or** return a new value (not both), do not use it in a plain hand-written reducer, and do not keep references to the draft after the reducer returns.

### [intermediate] How do you handle async operations in Redux? {#async-q}

Reducers must stay pure, so async work lives outside them. The standard way is `createAsyncThunk`: you give it an async function, and it dispatches `pending`, then `fulfilled` (with the result) or `rejected` (with the error). The slice handles those in `extraReducers` to set loading, data and error. `unwrap()` turns the dispatch promise into one that throws on failure. For pure data fetching and caching, **RTK Query** is better. For "when this action happens, also do that", use the **listener middleware** (or saga in older code).

### [intermediate] Why does my component re-render on every dispatch, and how do I fix it? {#rerender-q}

`useSelector` runs after every dispatch and re-renders if the result is not `===` to the last one. A selector that builds a new array or object each time (`.filter`, `.map`, `{ ...a }`) always returns a new reference, so the component renders for every action in the app. Fix: select primitives or existing references, wrap derived data in `createSelector` so it returns the same reference when the inputs are unchanged, select the smallest value you need, or pass an equality function such as `shallowEqual`.

### [intermediate] What does `createSelector` do and what is its limitation? {#reselect-q}

It builds a **memoised** selector from input selectors and a result function. The result function re-runs only when an input selector returns a different value (by reference), otherwise the cached result is returned, which keeps the reference stable and avoids repeated work. Its default cache holds **one** result, so a selector used with different arguments in different components (for example by id) keeps recomputing. Use a selector factory per component, or `createEntityAdapter` selectors, for that.

### [intermediate] What is normalised state and when do you need it? {#normalise-q}

Normalised state stores entities in an object keyed by id (`entities`) plus an ordered list of ids (`ids`), like database tables, and references other entities by id instead of nesting them. It gives O(1) lookup, a single copy of each entity to update, and simple immutable updates. Use it when the same entity appears in many places or relations are deep. `createEntityAdapter` generates the shape, the reducers (`addOne`, `upsertMany`, `updateOne`) and the selectors.

### [intermediate] What is RTK Query and how does cache invalidation work? {#rtkq-q}

RTK Query is the data-fetching layer of RTK. `createApi` defines endpoints and generates hooks. Results are cached by **endpoint and arguments**, shared by all components that ask, de-duplicated, and removed after a delay when unused. Queries declare `providesTags` and mutations declare `invalidatesTags`. When a mutation finishes, every query that provides an invalidated tag is refetched, so lists stay correct without manual code. It also supports polling, refetch on focus, optimistic updates and streaming.

### [intermediate] Why must state be serialisable, and what does the serialisability check warn about? {#serial-q}

DevTools, time-travel, persistence and replay need state and actions that can be turned into JSON and back. A `Date`, `Map`, `Set`, function, class instance or `Error` breaks that, and compares badly by reference. The check in `configureStore` warns in development. Store ISO strings, numbers, plain objects and arrays, and error messages as strings. If you really must (for example a form file object), configure `serializableCheck` to ignore that path rather than switching the check off.

### [deep] When would you choose Redux, and when would you choose context, Zustand or TanStack Query? {#choose-q}

I split state by kind. **Server state** (lists, details, caching, refetching) goes to RTK Query or TanStack Query, never into hand-written slices. **Local UI state** stays in `useState`. **Rarely changing global values** (theme, user, locale) go in context. For a **small global client store**, Zustand has less ceremony. Redux Toolkit fits when a large app has lots of shared client state, many components react to the same events, transitions are complex, a team needs one convention, and DevTools time-travel and an action log help debugging. The point is not "Redux or not" but keeping each kind of state in the right tool.

### [deep] How would you structure the store of a large application? {#structure-q}

Feature folders: each feature has its slice, selectors, thunks or API endpoints and components together (`features/accounts`, `features/payments`). One slice per feature with a clear boundary, the shared `api` slice for server data, and a `listeners` middleware for cross-feature reactions. Keep state minimal and normalised, derive the rest with selectors, avoid slices that know about each other's internals (communicate through actions), export typed hooks from one `app/hooks.ts`, and lazy-load rarely used slices with `reducerManager` or `combineSlices` for code splitting.

### [deep] How do you avoid performance problems in a large Redux app? {#perf-q}

Select the smallest value and keep selector results reference-stable with `createSelector` and entity selectors. Normalise state so updating one item does not replace a whole list. Split components so a frequent update re-renders only a small leaf. Use `memo` for expensive children. Avoid putting rapidly changing values (mouse position, every keystroke) in the store. Keep RTK Query's `selectFromResult` to pick fields. Measure with the React Profiler and the Redux DevTools before optimising.

### [deep] How would you implement an optimistic update with RTK Query? {#optimistic-q}

In the mutation's `onQueryStarted`, update the cached query data immediately with `dispatch(api.util.updateQueryData('getAccount', id, (draft) => { draft.frozen = true; }))`, which returns a patch result. Then `await queryFulfilled`. If it rejects, call `patchResult.undo()` to roll back. The UI changes at once, the server confirms in the background, and a failure restores the old value. Combine it with invalidation or `refetch` so the cache converges with the server.

### [coding] Write a typed `accounts` slice with an async thunk, selectors and a memoised "frozen accounts" selector. {#coding-slice}

```ts
// features/accounts/accountsSlice.ts
import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

export interface Account {
  id: string;
  owner: string;
  balance: number;        // minor units
  frozen: boolean;
}

type Status = 'idle' | 'loading' | 'failed';

interface AccountsState {
  items: Account[];
  status: Status;
  error: string | null;
}

const initialState: AccountsState = { items: [], status: 'idle', error: null };

export const fetchAccounts = createAsyncThunk<Account[], void, { rejectValue: string }>(
  'accounts/fetch',
  async (_arg, { rejectWithValue, signal }) => {
    try {
      const res = await fetch('/api/accounts', { signal });
      if (!res.ok) return rejectWithValue(`HTTP ${res.status}`);
      return (await res.json()) as Account[];
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Network error');
    }
  },
  {
    // do not start a second request while one is running
    condition: (_arg, { getState }) =>
      (getState() as RootState).accounts.status !== 'loading',
  },
);

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    accountFrozen(state, action: PayloadAction<string>) {
      const account = state.items.find((a) => a.id === action.payload);
      if (account) account.frozen = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccounts.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchAccounts.fulfilled, (s, a) => { s.status = 'idle'; s.items = a.payload; })
      .addCase(fetchAccounts.rejected, (s, a) => {
        s.status = 'failed';
        s.error = a.payload ?? a.error.message ?? 'Unknown error';
      });
  },
});

export const { accountFrozen } = accountsSlice.actions;
export default accountsSlice.reducer;

// selectors
export const selectAccounts = (s: RootState) => s.accounts.items;
export const selectAccountsStatus = (s: RootState) => s.accounts.status;

export const selectFrozenAccounts = createSelector(
  [selectAccounts],
  (items) => items.filter((a) => a.frozen),     // same reference until items change
);
```

The slice owns its state, the thunk handles the three phases, the error stored is a string (serialisable), and the memoised selector avoids a new array on every dispatch.

### [coding] Write an RTK Query API for accounts with a list, a detail, an add mutation, and an optimistic freeze. {#coding-rtkq}

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface Account { id: string; owner: string; balance: number; frozen: boolean }

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Account'],
  endpoints: (build) => ({
    getAccounts: build.query<Account[], void>({
      query: () => '/accounts',
      providesTags: (result) =>
        result
          ? [...result.map((a) => ({ type: 'Account' as const, id: a.id })), { type: 'Account', id: 'LIST' }]
          : [{ type: 'Account', id: 'LIST' }],
    }),
    getAccount: build.query<Account, string>({
      query: (id) => `/accounts/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Account', id }],
    }),
    addAccount: build.mutation<Account, Pick<Account, 'owner'>>({
      query: (body) => ({ url: '/accounts', method: 'POST', body }),
      invalidatesTags: [{ type: 'Account', id: 'LIST' }],      // refetch the list only
    }),
    freezeAccount: build.mutation<void, string>({
      query: (id) => ({ url: `/accounts/${id}/freeze`, method: 'POST' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData('getAccount', id, (draft) => { draft.frozen = true; }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();                                         // roll back on failure
        }
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'Account', id }],
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useGetAccountQuery,
  useAddAccountMutation,
  useFreezeAccountMutation,
} = api;
```

Per-id tags mean freezing one account refetches only that account, adding one invalidates only the list, and the optimistic patch shows the change at once and is rolled back if the call fails.

### [coding] Convert an array of accounts to normalised state with `createEntityAdapter` and write a selector for the total balance of frozen accounts. {#coding-entity}

```ts
import { createEntityAdapter, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

export interface Account { id: string; owner: string; balance: number; frozen: boolean }

const adapter = createEntityAdapter<Account>({
  sortComparer: (a, b) => a.owner.localeCompare(b.owner),
});

const accountsSlice = createSlice({
  name: 'accounts',
  initialState: adapter.getInitialState({ selectedId: null as string | null }),
  reducers: {
    accountsLoaded: adapter.setAll,
    accountUpserted: adapter.upsertOne,
    accountSelected(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },
    balanceChanged(state, action: PayloadAction<{ id: string; delta: number }>) {
      const account = state.entities[action.payload.id];     // O(1) lookup
      if (account) account.balance += action.payload.delta;
    },
  },
});

export const { accountsLoaded, accountUpserted, accountSelected, balanceChanged } = accountsSlice.actions;
export default accountsSlice.reducer;

export const { selectAll: selectAllAccounts, selectById: selectAccountById } =
  adapter.getSelectors((s: RootState) => s.accounts);

export const selectFrozenBalance = createSelector([selectAllAccounts], (accounts) =>
  accounts.filter((a) => a.frozen).reduce((sum, a) => sum + a.balance, 0),
);
```

Updating one account by id is O(1), the list stays sorted, and `selectFrozenBalance` is memoised, so it recomputes only when the accounts change.
