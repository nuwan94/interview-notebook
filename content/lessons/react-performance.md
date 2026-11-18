---
title: React performance and testing — renders, profiling, code splitting, Testing Library and MSW
nav: Performance and testing
slug: react-performance
summary: React performance and testing, what causes a re-render, reconciliation and the commit phase, finding slow components with the Profiler, moving state down, children as props, memo, useMemo and useCallback, useDeferredValue and useTransition, list virtualisation, code splitting with React.lazy and Suspense, bundle size, Web Vitals (LCP, INP, CLS), images and caching, the testing pyramid, Vitest, React Testing Library queries and userEvent, async tests with findBy and waitFor, Mock Service Worker, testing hooks, reducers and Redux, accessibility checks and end-to-end tests with Playwright, with banking examples and interview questions.
tags: [React, Performance, Testing, React Testing Library, Vitest, MSW, Playwright, Profiler, Code splitting, Full stack]
order: 66
topic: Full stack / React
updated: 2026-11-18
subnav: true
---

These two topics close the React part of a full-stack interview. They ask *why a component re-renders, how you find and fix a slow screen, what `memo`, `useMemo` and `useCallback` really give you, how you reduce the first load, how you test a component, what you mock and what you do not, and how you test a hook or a Redux slice.* This lesson builds on [React hooks](lesson:react-hooks#memo) and [Redux](lesson:react-redux#selectors). Examples are TypeScript with banking screens. Play the four scenes: why it re-renders, fixing slow renders, loading performance, and testing.

```demo
name: react-perf-walk
```

> **One sentence to remember:** *Measure first, then fix the structure before you memoise, ship less code on the first load, and test what the user sees, not how the component is built.*

## Why a component re-renders {#renders}

Recap from [React core](lesson:react-core#rendering): a component renders when its **state** changes, when its **parent** renders, or when a **context** it reads changes. Props changing is not a separate trigger. A parent render re-renders every child by default, even if the child's props are identical (the first scene).

Two phases:

1. **Render**: React calls your component function and builds a new element tree. This is plain JavaScript and must be pure.
2. **Commit**: React compares the new tree with the old one (**reconciliation**) and updates only the DOM nodes that changed.

So a "wasted" render costs **JavaScript time**, not a DOM rewrite. Most renders take microseconds and are fine. A problem exists only when a render is **slow** (heavy calculation, thousands of elements) or **very frequent** (state that changes on every keystroke high in the tree) and the user feels lag. Do not optimise renders you have not measured.

## Measure first {#profiler}

- **React DevTools Profiler**: record an interaction, then read the flame graph. It shows which components rendered, **why** (props changed, state changed, parent rendered, hooks changed) and how long each took. Enable "Record why each component rendered".
- **Browser Performance tab**: shows long tasks (over 50 ms) on the main thread, scripting versus rendering versus painting time.
- **`<Profiler>` component**: logs render timings from code, for example in staging.
- **Production build**: always measure a production build, because development mode with StrictMode renders twice and is much slower.
- **Real users**: track **Web Vitals** (below) with real-user monitoring.

Method: reproduce the slow interaction, record, find the component that is both slow and frequent, change one thing, record again and compare. If the number did not improve, undo the change.

## Fix the structure first {#fixes}

Cheapest and most robust fixes come first (the second scene).

**1. Move state down.** If a piece of state is used by one small component, keep it there. Typing in a search box should not re-render a huge table.

```tsx
// Slow: query state lives in the page, so every keystroke re-renders the whole table
function Page() {
  const [query, setQuery] = useState('');
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <TransactionTable />                 {/* renders on every keystroke */}
    </>
  );
}

// Fast: the state moved into its own component
function SearchBox() {
  const [query, setQuery] = useState('');
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
function Page() {
  return (
    <>
      <SearchBox />
      <TransactionTable />                 {/* unaffected */}
    </>
  );
}
```

**2. Pass the slow part as `children`.** Elements created by a parent are the **same reference** while that parent does not re-render, so a stateful wrapper does not re-render its children.

```tsx
function Resizable({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(300);          // changes often
  return <div style={{ width }} onMouseMove={...}>{children}</div>;
}
// <Resizable><TransactionTable /></Resizable>: the table does not re-render when width changes
```

**3. `memo`, `useMemo`, `useCallback`** when the structure cannot change. `memo(Component)` skips a render when props are shallowly equal, so the props must be **stable references** (see [referential equality](lesson:react-hooks#memo)). Memoise a slow child and its callback together, not one without the other. The **React Compiler** adds much of this automatically at build time, so do not litter code with `useMemo` "just in case".

**4. Keep expensive work out of render.** Sort or filter a big list with `useMemo`, or better, do it once in a [selector](lesson:react-redux#selectors) or on the server. Use stable, unique **keys** and never the array index for lists that reorder.

**5. Keep the main thread responsive** with concurrent features:

```tsx
function Transactions({ all }: { all: Tx[] }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);                // lags behind while React is busy
  const shown = useMemo(() => all.filter((t) => t.memo.includes(deferred)), [all, deferred]);
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />   {/* urgent, stays smooth */}
      <TransactionTable rows={shown} />                                    {/* may update a moment later */}
    </>
  );
}
```

`useTransition` does the same for a state update you control: wrap the slow `setState` in `startTransition` and React treats it as interruptible and low priority.

**6. Virtualise long lists.** Rendering 50,000 rows creates 50,000 DOM nodes even if memoised. A virtualised list (**TanStack Virtual**, **react-window**) renders only the rows in view plus a few extra, so cost depends on the window, not on the data size. Combine it with server-side paging for very large data.

**7. Avoid avoidable work:** do not create large objects in render, avoid inline heavy computations in JSX, debounce an input that triggers a request ([debounce](lesson:js-async#event-loop)), and avoid putting fast-changing values (mouse position, scroll) in React state when a CSS or ref update is enough.

## Context and store re-renders {#store}

- A context value change re-renders **every consumer**. Split state and dispatch contexts and memoise the provider value ([context](lesson:react-hooks#context)).
- With Redux, `useSelector` re-renders when the selected value changes by reference. Select little and memoise derived data with `createSelector`.
- For a large shared store that changes often, consider a library with selector-based subscriptions (Redux, Zustand, Jotai) instead of one big context.

## Loading performance {#loading}

The first load cost is downloading, parsing and running JavaScript (the third scene). Fixes, roughly in order of payoff:

1. **Code splitting by route** with `React.lazy` and `Suspense`. The user downloads the reports screen only when they open it.

```tsx
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

const Reports = lazy(() => import('./pages/Reports'));     // separate chunk

export function AppRoutes() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Suspense>
  );
}
```

2. **Analyse the bundle** (`vite-bundle-visualizer`, `source-map-explorer`) and replace heavy libraries (a full date or chart library for one function), import only what you use, and load rare heavy components on demand (a PDF viewer, a rich editor).
3. **Images**: correct size, modern format (WebP, AVIF), `loading="lazy"` for below-the-fold images, and width and height set to avoid layout shift.
4. **Caching**: hashed file names (`app.3f9a1c.js`) with long `Cache-Control`, so returning visitors download nothing. Use a **CDN**.
5. **Server rendering or static generation** (Next.js, Remix, Astro) gives a meaningful first paint before the JavaScript runs.
6. **Prefetch** the next likely route on hover or when idle.
7. **Fonts**: preload critical fonts, use `font-display: swap`.

**Core Web Vitals**, the metrics users feel:

| Metric | Measures | Good |
| --- | --- | --- |
| **LCP** Largest Contentful Paint | when the main content appears | under 2.5 s |
| **INP** Interaction to Next Paint | delay from a click or key to the next paint | under 200 ms |
| **CLS** Cumulative Layout Shift | unexpected movement of the layout | under 0.1 |

Measure with Lighthouse in the lab and with the `web-vitals` library in the field.

## Testing strategy {#testing}

Use a pyramid (the fourth scene):

| Layer | Tool | What it covers | How many |
| --- | --- | --- | --- |
| Unit | Vitest or Jest | pure functions, reducers, selectors, helpers | many |
| Component (integration) | React Testing Library | a component or screen, with the real DOM in jsdom | a good number |
| End-to-end | Playwright or Cypress | key journeys in a real browser against a real or staged backend | few |
| Visual | Storybook, Chromatic | appearance regressions | as needed |

A static layer sits underneath all of them: **TypeScript** and **ESLint** (with the Rules of Hooks plugin) catch many bugs before any test runs.

**Vitest** is the usual runner with Vite (Jest-compatible API, fast, native ESM). Jest is the same idea and the long-standing default with Create React App and many existing projects.

```ts
// vite.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',                 // a browser-like DOM in Node
    setupFiles: './src/test/setup.ts',    // jest-dom matchers, MSW server
    globals: true,
  },
});
```

## React Testing Library {#rtl}

**Philosophy:** *the more your tests resemble the way your software is used, the more confidence they give.* Test **behaviour**: what the user sees and does. Do not test state variables, hook calls or component internals. Then refactoring does not break tests.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferForm } from './TransferForm';

test('submits a transfer with the entered amount', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<TransferForm balance={500} onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/amount/i), '120');
  await user.click(screen.getByRole('button', { name: /send/i }));

  expect(onSubmit).toHaveBeenCalledWith({ amount: 120 });
});

test('shows an error when the amount is above the balance', async () => {
  const user = userEvent.setup();
  render(<TransferForm balance={50} onSubmit={vi.fn()} />);

  await user.type(screen.getByLabelText(/amount/i), '120');
  await user.click(screen.getByRole('button', { name: /send/i }));

  expect(screen.getByRole('alert')).toHaveTextContent(/insufficient funds/i);
});
```

**Queries**, in order of preference (closest to how users and assistive technology find things):

1. `getByRole('button', { name: /send/i })`: accessible role and name. Best choice, and it checks accessibility for free.
2. `getByLabelText`, `getByPlaceholderText`, `getByText`, `getByDisplayValue`: form fields and visible text.
3. `getByAltText`, `getByTitle`.
4. `getByTestId`: last resort, only when nothing a user can see identifies the element.

Three families: `getBy` (throws if missing, for present elements), `queryBy` (returns null, for asserting absence: `expect(queryByText(...)).not.toBeInTheDocument()`), `findBy` (returns a promise that waits, for async appearance). Add `All` for several elements.

- **`userEvent`** simulates real interaction (focus, keydown, input, click) and is preferred over `fireEvent`. It is async, so `await` it.
- **`jest-dom`** adds readable matchers: `toBeInTheDocument`, `toBeDisabled`, `toHaveTextContent`, `toHaveValue`.
- **`waitFor`** retries an assertion until it passes or times out. Prefer `findBy` for appearance, and use `waitFor` for other conditions. Never put side effects inside `waitFor`.
- **Fake timers** (`vi.useFakeTimers()`) test debounce and polling without real waiting.
- Wrap the component in the same **providers** as the app (router, theme, Redux store) with a small `renderWithProviders` helper.

## Mocking the network with MSW {#msw}

Components fetch data. Instead of mocking `fetch` or a hook, use **Mock Service Worker**: it intercepts the request at the network layer and returns a fake response, so the component runs its **real** fetching code (the last scene).

```ts
// src/test/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/accounts', () =>
    HttpResponse.json([
      { id: 'A-1', owner: 'Alice', balance: 12000 },
      { id: 'A-2', owner: 'Bob', balance: 4500 },
    ]),
  ),
];

// src/test/setup.ts
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom/vitest';

export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```tsx
test('lists accounts from the API', async () => {
  render(<AccountList />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  expect(await screen.findByText('Alice')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

test('shows an error and a retry button when the API fails', async () => {
  server.use(http.get('/api/accounts', () => new HttpResponse(null, { status: 500 })));
  render(<AccountList />);
  expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

`server.use` overrides one handler for one test. `onUnhandledRequest: 'error'` fails a test that makes an unexpected call. The same handlers can run in the browser for local development and Storybook.

**What to mock:** the network boundary (MSW), time, randomness, and browser APIs that jsdom lacks (`matchMedia`, `IntersectionObserver`). **What not to mock:** your own child components, hooks, or the store. Mocking them tests the mock.

## Testing hooks, reducers and Redux {#hooks-test}

- **Pure logic** (reducers, selectors, helpers): call it and assert, no React needed. See [testing Redux](lesson:react-redux#testing).
- **Custom hooks**: `renderHook` from Testing Library, with `act` for updates.

```tsx
import { act, renderHook } from '@testing-library/react';

test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter(0));
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

- **A component that uses the store**: render with a real store created by a helper, with `preloadedState` for the scenario, instead of mocking `useSelector`.

```tsx
export function renderWithStore(ui: React.ReactElement, preloadedState?: Partial<RootState>) {
  const store = configureStore({ reducer: rootReducer, preloadedState });
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}
```

## Accessibility and end-to-end {#e2e}

- Because Testing Library queries by role and label, a passing test is partly an accessibility check. Add **`jest-axe`** (or `vitest-axe`) for automatic rule checks, and the ESLint plugin `jsx-a11y`.
- **End-to-end** tests drive a real browser through a whole journey. Keep them few, stable and valuable: sign in, make a transfer, see it in the history.

```ts
// e2e/transfer.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test('a user can send a transfer', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('link', { name: 'Transfers' }).click();
  await page.getByLabel('Amount').fill('120');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByRole('status')).toHaveText(/transfer sent/i);
});
```

Playwright auto-waits for elements, runs in parallel across browsers and records traces. Avoid flaky tests: no fixed sleeps, a known test user and data, and one journey per test.

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| optimising before measuring | profile a production build first |
| `useMemo` and `useCallback` everywhere | fix structure first, memoise only measured hot spots |
| `memo` on a child that gets an inline function or object | stabilise the props, or drop `memo` |
| state held higher than needed | move it down, or pass slow parts as `children` |
| array index as key in a list that reorders | use a stable id |
| rendering thousands of rows | virtualise and page |
| one huge bundle | split by route and analyse the bundle |
| testing implementation (state, class names, internal calls) | assert on what the user sees, query by role |
| `getByTestId` for everything | prefer role, label and text |
| `fireEvent` and arbitrary `setTimeout` waits | `userEvent` and `findBy` |
| mocking `fetch` or hooks by hand in every test | MSW at the network layer |
| snapshot tests of large trees | small explicit assertions |
| many slow end-to-end tests | a few journeys, the rest as component tests |

## For a Java developer {#java}

| Java and Spring | React |
| --- | --- |
| JMH or a profiler (VisualVM, Flight Recorder) | React Profiler and the browser Performance tab |
| premature optimisation warning | measure before memoising |
| a connection pool or lazy bean loading | code splitting and lazy routes |
| paging a repository query | virtualisation and server-side paging |
| JUnit | Vitest or Jest |
| Mockito mocking a collaborator | mock only the boundary (MSW), not your own components |
| `MockMvc` or `WebTestClient` slice tests | React Testing Library component tests |
| WireMock | Mock Service Worker |
| Testcontainers or Selenium end-to-end | Playwright or Cypress |
| test pyramid | the same pyramid |

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| re-render triggers | own state, parent render, context change |
| wasted render | costs JS time, not a DOM rewrite |
| measure | Profiler, production build, one change at a time |
| fix order | move state down, children as props, then `memo`, then virtualise |
| `memo` | needs stable props to help |
| concurrent | `useDeferredValue` and `useTransition` keep input responsive |
| load | split by route, analyse bundle, images, caching, CDN, SSR |
| Web Vitals | LCP, INP, CLS |
| pyramid | many unit, some component, few end-to-end |
| Testing Library | query by role, label, text. `userEvent`. `findBy` for async |
| MSW | intercepts the network, real fetch code runs |
| do not mock | your own components, hooks, store |
| hooks | `renderHook` and `act` |
| e2e | Playwright, few journeys, no fixed sleeps |

## Interview questions {#questions}

### [basic] When does a React component re-render? {#rerender-q}

When its own **state** changes, when its **parent** renders (children render by default even with identical props), or when a **context** it reads changes. Props changing is not a separate cause. A render is a function call that produces an element tree. React then compares it with the previous tree and updates only the DOM nodes that changed.

### [basic] Does a re-render mean the DOM is rewritten? {#dom-q}

No. Rendering runs your component and builds elements. **Reconciliation** diffs the new tree with the old and the **commit** phase applies only the real differences to the DOM. An unnecessary render wastes JavaScript time but leaves the DOM alone. It matters only when the render is slow or very frequent.

### [basic] What does `React.memo` do? {#memo-q}

It wraps a component so React skips re-rendering it when its props are shallowly equal to the previous props. It helps only when the props are stable references, so an inline object, array or function prop defeats it unless you stabilise it with `useMemo` or `useCallback`. It adds a comparison cost, so apply it to measured hot spots.

### [basic] What is the testing pyramid for a React app? {#pyramid-q}

Many fast **unit tests** for pure logic (reducers, selectors, helpers), a good number of **component tests** with React Testing Library that render a screen in jsdom, and a few **end-to-end tests** in a real browser (Playwright, Cypress) for the key journeys. Static checks (TypeScript, ESLint) sit under all of them. Most confidence per cost comes from component tests.

### [basic] What is React Testing Library's guiding principle? {#rtl-q}

Test the software the way users use it. Render the component, find elements by what a user perceives (role, label, text), interact with `userEvent`, and assert on what appears. Do not test implementation details such as state, props passed to children or CSS classes, so a refactor that keeps behaviour does not break the test.

### [basic] What is the difference between `getBy`, `queryBy` and `findBy`? {#queries-q}

`getBy` returns the element or throws, for things that must be present. `queryBy` returns `null` when absent, for asserting that something is not there. `findBy` returns a promise that retries until the element appears or a timeout, for async content. The `All` versions return arrays.

### [intermediate] How do you find out why a React screen is slow? {#profile-q}

Reproduce it in a **production build** and record it with the React DevTools **Profiler** (enable "why did this render") and the browser Performance tab. Find the component that is both slow and frequent, and the reason it renders. Change one thing, measure again, and keep the change only if the number improves. Also check long tasks on the main thread and the network waterfall in case the problem is not rendering at all.

### [intermediate] What would you do before reaching for `useMemo` and `useCallback`? {#before-memo-q}

Fix the structure: **move state down** to the smallest component that needs it, **pass slow subtrees as `children`** so they keep the same reference, split a component so a fast-changing part is isolated, and reduce the work (paging, a server-side filter, a selector). Memoisation is the next step, applied to measured hot spots, and the **React Compiler** can add it automatically. Memoising everything adds code, comparison cost and stale-value risks.

### [intermediate] How do `useDeferredValue` and `useTransition` keep typing smooth? {#concurrent-q}

Typing is an urgent update and rendering a big filtered list is not. `useDeferredValue(query)` gives a copy of the value that lags behind while React is busy, so the input renders immediately and the list updates a moment later, and React can interrupt that render if you type again. `useTransition` marks a state update you control as a low-priority, interruptible transition and gives an `isPending` flag. They do not make the work faster, they keep it from blocking input.

### [intermediate] How do you render a list of 50,000 transactions? {#virtual-q}

Virtualise: render only the rows in the viewport plus a small overscan, with a library such as TanStack Virtual or react-window, using a container with a fixed or measured height. The DOM then holds about 20 rows whatever the data size. Better still, **page or infinite-load** from the server so the browser never holds all rows. Memoise the row component and give rows stable keys.

### [intermediate] How do you reduce the initial load time of a React app? {#load-q}

Code-split by route with `React.lazy`, `Suspense` and dynamic `import()`, analyse the bundle and replace or lazy-load heavy libraries, optimise images (size, format, lazy loading), use hashed file names with long cache headers and a CDN, consider server rendering or static generation for a faster first paint, preload critical resources and prefetch the next route. Track LCP, INP and CLS to confirm the improvement for real users.

### [intermediate] What are LCP, INP and CLS? {#vitals-q}

Core Web Vitals. **LCP** (Largest Contentful Paint) is when the main content becomes visible, aim for under 2.5 seconds. **INP** (Interaction to Next Paint) is the delay between a user input and the next visual update, aim for under 200 ms. **CLS** (Cumulative Layout Shift) measures unexpected layout movement, aim for under 0.1. They are measured in the lab with Lighthouse and in the field with the `web-vitals` library.

### [intermediate] Why use Mock Service Worker instead of mocking `fetch` in each test? {#msw-q}

MSW intercepts requests at the network boundary, so the component runs its real fetching code, caching and error handling and the test only controls the response. You do not couple tests to how data is fetched (`fetch`, axios, RTK Query), the same handlers serve tests, Storybook and local development, and `server.use` overrides a single case such as a 500 error. Hand-mocking `fetch` or hooks tests the mock and breaks when the implementation changes.

### [intermediate] How do you test a component that uses the Redux store? {#redux-test-q}

Render it inside a real `Provider` with a store built from the real reducers and a `preloadedState` that sets up the scenario, through a small `renderWithStore` helper. Then interact like a user and assert what is on screen, and optionally read `store.getState()`. Mocking `useSelector` or `useDispatch` tests the mock and hides wiring bugs. Test reducers and selectors separately as pure functions.

### [deep] What should you not mock in a component test, and why? {#nomock-q}

Do not mock your own child components, hooks, store or utilities: that removes the integration you are trying to verify and makes tests pass when the real code is broken. Mock only the **edges** you do not control: the network (MSW), time, randomness, and browser APIs missing in jsdom. A test with few mocks fails for real reasons and survives refactoring.

### [deep] How do you keep end-to-end tests reliable? {#flaky-q}

Keep them few and focused on valuable journeys, one journey per test. Use a known test user and seeded data, and reset state between runs. Locate elements by role and label, and rely on Playwright's auto-waiting and web-first assertions (`expect(locator).toHaveText`) instead of fixed sleeps. Isolate tests so they can run in parallel, stub third-party services you do not control, capture traces on failure, and run them in CI against a staged environment. Push detail into faster component tests.

### [deep] How would you set up performance and quality budgets in CI for a React app? {#budget-q}

Run type checks, ESLint and the test suite on every pull request. Add a **bundle size budget** (fail if a chunk exceeds a limit, with `size-limit` or the build's reporter), Lighthouse CI against a preview build with thresholds for LCP, INP and CLS, and an accessibility check (`axe`). Run Playwright on a smoke set per pull request and the full set nightly. Track real-user Web Vitals in production and alert on regressions, so performance is protected continuously, not fixed once.

### [coding] A search box makes a 5,000-row transaction table lag. Fix it in three ways. {#coding-lag}

```tsx
import { memo, useDeferredValue, useMemo, useState } from 'react';

interface Tx { id: string; memo: string; amount: number }

// 1. Move the state down: the page no longer re-renders when the user types
function SearchBox({ onChange }: { onChange: (q: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <input
      aria-label="Search transactions"
      value={value}
      onChange={(e) => { setValue(e.target.value); onChange(e.target.value); }}
    />
  );
}

// 2. memo the row, so unchanged rows are skipped (props are primitives, so they are stable)
const Row = memo(function Row({ memo: text, amount }: Omit<Tx, 'id'>) {
  return <tr><td>{text}</td><td>{(amount / 100).toFixed(2)}</td></tr>;
});

export function Transactions({ all }: { all: Tx[] }) {
  const [query, setQuery] = useState('');
  // 3. Keep typing urgent, let the list lag behind
  const deferred = useDeferredValue(query);
  const rows = useMemo(
    () => all.filter((t) => t.memo.toLowerCase().includes(deferred.toLowerCase())),
    [all, deferred],
  );

  return (
    <>
      <SearchBox onChange={setQuery} />
      <table>
        <tbody>
          {rows.map((t) => <Row key={t.id} memo={t.memo} amount={t.amount} />)}
        </tbody>
      </table>
    </>
  );
}
```

The three fixes address different causes: state placement stops unrelated renders, `memo` skips unchanged rows, and `useDeferredValue` keeps the input responsive while the filtered list renders. For tens of thousands of rows add virtualisation or server-side paging.

### [coding] Write component tests for an account list: loading, success and API error, using MSW. {#coding-msw}

```tsx
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/setup';
import { AccountList } from './AccountList';

const accounts = [
  { id: 'A-1', owner: 'Alice', balance: 12000 },
  { id: 'A-2', owner: 'Bob', balance: 4500 },
];

describe('AccountList', () => {
  test('shows loading, then the accounts', async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.json(accounts)));
    render(<AccountList />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();           // first render
    expect(await screen.findByText('Alice')).toBeInTheDocument();       // waits for the response
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  test('shows an empty state', async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.json([])));
    render(<AccountList />);
    expect(await screen.findByText(/no accounts/i)).toBeInTheDocument();
  });

  test('shows an error with a retry that works', async () => {
    server.use(http.get('/api/accounts', () => new HttpResponse(null, { status: 500 })));
    render(<AccountList />);
    const retry = await screen.findByRole('button', { name: /retry/i });

    server.use(http.get('/api/accounts', () => HttpResponse.json(accounts)));
    await userEvent.setup().click(retry);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });
});
```

The tests query by text and role, wait with `findBy`, cover loading, empty, success and failure, and override the handler per test, so they describe behaviour and survive a change of fetching library.

### [coding] Write tests for a `useDebounce` hook with fake timers and for a debounced search input. {#coding-debounce}

```tsx
import { act, renderHook, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDebounce } from './useDebounce';
import { SearchInput } from './SearchInput';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('useDebounce returns the new value only after the delay', () => {
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
    initialProps: { v: 'a' },
  });

  rerender({ v: 'ab' });
  expect(result.current).toBe('a');                      // still old

  act(() => { vi.advanceTimersByTime(299); });
  expect(result.current).toBe('a');

  act(() => { vi.advanceTimersByTime(1); });
  expect(result.current).toBe('ab');                     // delay reached
});

test('SearchInput calls onSearch once after the user stops typing', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const onSearch = vi.fn();
  render(<SearchInput onSearch={onSearch} />);

  await user.type(screen.getByRole('searchbox'), 'visa');
  expect(onSearch).not.toHaveBeenCalled();               // still typing

  act(() => { vi.advanceTimersByTime(300); });
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onSearch).toHaveBeenCalledWith('visa');
});
```

Fake timers make the debounce deterministic and fast. `renderHook` plus `act` tests the hook alone, and the component test uses `userEvent` with the same fake clock and asserts only the observable result.
