// Frame data for the "React hooks" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- useEffect ---------- */
const effectFrames = [
  {
    h: 250,
    line: 'useEffect(() => { ... })',
    result: { text: 'runs after the paint', tone: 'ok' },
    cards: [
      box('r', C1, 70, W, 'render', ['pure, no side', 'effects'], 'ok'),
      box('d', C2, 70, W, 'DOM committed', ['the screen is painted'], 'ok'),
      box('e', C3, 70, W, 'useEffect', ['subscribe, fetch,', 'timer, document title'], 'new'),
      box('n', C1, 180, 612, 'effects synchronise the component with the outside world', ['network, subscriptions, timers, browser APIs, non-React widgets'], 'none'),
    ],
    arrows: [{ from: 'r', to: 'd', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'd', to: 'e', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The component renders and the DOM is committed first. Then, after the paint, React runs the effect.',
  },
  {
    h: 250,
    line: 'useEffect(..., [userId])',
    result: { text: 'cleanup first, then run again', tone: 'ok' },
    cards: [
      box('u', C1, 70, W, 'userId changes', ['the dependency'], 'warn'),
      box('c', C2, 70, W, 'cleanup runs', ['abort the old', 'request'], 'new'),
      box('e', C3, 70, W, 'effect runs again', ['fetch the new user'], 'ok'),
      box('n', C1, 180, 612, 'cleanup also runs when the component unmounts', ['[] runs once, no array runs after every render'], 'none'),
    ],
    arrows: [{ from: 'u', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'c', to: 'e', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The dependency array says when to run again. Before it runs again, and on unmount, React runs the cleanup function returned by the previous run.',
  },
  {
    h: 270,
    line: 'click user 1, then user 2',
    result: { text: 'without cleanup, the old answer wins', tone: 'bad' },
    cards: [
      box('a', C1, 50, W2, 'request A', ['for user 1, slow'], 'warn'),
      box('b', R2, 50, W2, 'request B', ['for user 2, fast'], 'ok'),
      box('s', C1, 160, W2, 'stale response', ['A arrives last and overwrites B'], 'bad'),
      box('f', R2, 160, W2, 'abort in cleanup', ['A is cancelled, B wins'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 's', fs: 'b', ts: 't', tone: 'bad' }, { from: 'f', to: 'b', fs: 't', ts: 'b', tone: 'ok' }],
    note: 'Responses can arrive out of order. Abort the old request in the cleanup, or ignore its result.',
  },
  {
    h: 250,
    line: 'StrictMode, development only',
    result: { text: 'a matched pair changes nothing visible', tone: 'ok' },
    cards: [
      box('m', C1, 70, W, 'mount', ['effect connects'], 'ok'),
      box('s', C2, 70, W, 'simulated unmount', ['cleanup disconnects'], 'warn'),
      box('n', C3, 70, W, 'mount again', ['effect connects', 'again'], 'ok'),
      box('x', C1, 180, 612, 'a doubled subscription or request', ['means the cleanup is missing'], 'none'),
    ],
    arrows: [{ from: 'm', to: 's', fs: 'r', ts: 'l', tone: 'warn' }, { from: 's', to: 'n', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'StrictMode mounts, cleans up, and mounts again, as a test. If setup and cleanup are a matched pair, nothing visible changes.',
  },
];

/* ---------- memoization ---------- */
const memoFrames = [
  {
    h: 250,
    line: '<Child onSave={() => save()} />',
    result: { text: 'memo cannot help: a new prop every time', tone: 'bad' },
    cards: [
      box('p', C1, 70, W, 'parent render', ['creates onSave', 'again'], 'warn'),
      box('n', C2, 70, W, 'new function', ['a different', 'reference'], 'bad'),
      box('c', C3, 70, W, 'memo child', ['sees a changed prop,', 'renders anyway'], 'bad'),
      box('x', C1, 180, 612, '{}, [] and () => {} are new objects every render', ['memo compares props by reference'], 'none'),
    ],
    arrows: [{ from: 'p', to: 'n', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'n', to: 'c', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'A child wrapped in memo skips its render when its props are equal. But props are compared by reference, and the parent makes a new function on every render.',
  },
  {
    h: 250,
    line: 'useCallback(fn, [])',
    result: { text: 'same function, memo child skips', tone: 'ok' },
    cards: [
      box('u', C1, 70, W, 'useCallback', ['same function while', 'deps are unchanged'], 'new'),
      box('s', C2, 70, W, 'stable reference', ['unchanged between', 'renders'], 'ok'),
      box('c', C3, 70, W, 'memo child', ['equal prop,', 'skips the render'], 'ok'),
      box('x', C1, 180, 612, 'useMemo does the same for a computed value', ['both only matter with memo children or effect dependencies'], 'none'),
    ],
    arrows: [{ from: 'u', to: 's', fs: 'r', ts: 'l', tone: 'ok' }, { from: 's', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'useCallback returns the same function while its dependencies are unchanged. The memo child now receives an equal prop.',
  },
  {
    h: 250,
    line: 'measure before you memoize',
    result: { text: 'fix the slow part only', tone: 'ok' },
    cards: [
      box('m', C1, 70, W, 'measure first', ['React Profiler'], 'ok'),
      box('x', C2, 70, W, 'slow render found', ['one costly subtree'], 'warn'),
      box('f', C3, 70, W, 'targeted fix', ['move state down,', 'memo, or the Compiler'], 'ok'),
      box('n', C1, 180, 612, 'memoization costs code and comparisons, and a missing dependency gives a stale value', ['most renders are cheap'], 'none'),
    ],
    arrows: [{ from: 'm', to: 'x', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'x', to: 'f', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Memoization is an optimisation, not a default. The React Compiler can add it for you at build time.',
  },
];

/* ---------- reducer and context ---------- */
const reducerFrames = [
  {
    h: 250,
    line: 'dispatch({ type: "add", item })',
    result: { text: 'reducer: pure, returns new state', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'component', ['dispatch an action'], 'none'),
      box('r', C2, 70, W, 'reducer(state, action)', ['pure function'], 'new'),
      box('s', C3, 70, W, 'new state', ['a new object,', 'component renders'], 'ok'),
      box('n', C1, 180, 612, 'an action describes what happened', ['the reducer decides what the next state is, and can be tested without React'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'r', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'When state has many transitions, useReducer keeps them in one place. dispatch is stable, so it is safe to pass down.',
  },
  {
    h: 260,
    line: 'provider value changes',
    result: { text: 'every consumer re-renders', tone: 'warn' },
    cards: [
      box('p', C2, 40, W, 'provider', ['value changes'], 'new'),
      box('a', C1, 150, 140, 'consumer A', ['re-renders'], 'warn'),
      box('b', 174, 150, 140, 'consumer B', ['re-renders'], 'warn'),
      box('u', 334, 150, 140, 'unrelated', ['not affected'], 'none'),
    ],
    arrows: [{ from: 'p', to: 'a', fs: 'b', ts: 't', tone: 'warn' }, { from: 'p', to: 'b', fs: 'b', ts: 't', tone: 'warn' }],
    note: 'Context passes a value to any descendant, with no prop drilling. When the value changes by reference, every component that reads it renders again, even if it uses only part of the value.',
  },
  {
    h: 260,
    line: 'split state from dispatch',
    result: { text: 'add button no longer re-renders', tone: 'ok' },
    cards: [
      box('s', C1, 50, W2, 'state context', ['changes often'], 'warn'),
      box('d', R2, 50, W2, 'dispatch context', ['never changes'], 'ok'),
      box('l', C1, 160, W2, 'cart list', ['reads state, re-renders'], 'warn'),
      box('b', R2, 160, W2, 'add button', ['reads dispatch only,', 'does not re-render'], 'ok'),
    ],
    arrows: [{ from: 's', to: 'l', fs: 'b', ts: 't', tone: 'warn' }, { from: 'd', to: 'b', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'Put the state in one context and the stable dispatch in another. Memoise the provider value too.',
  },
];

/* ---------- custom hooks ---------- */
const customFrames = [
  {
    h: 250,
    line: 'useFetch(url)',
    result: { text: 'one hook, two pages', tone: 'ok' },
    cards: [
      box('a', C1, 40, W2, 'account page', ['const s = useFetch(url)'], 'ok'),
      box('b', C1, 150, W2, 'payments page', ['const s = useFetch(url)'], 'ok'),
      box('h', R2, 95, W2, 'useFetch hook', ['loading, error, abort, data'], 'new'),
    ],
    arrows: [{ from: 'a', to: 'h', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'b', to: 'h', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Move logic that two components repeat into a function whose name starts with use. It is plain JavaScript that may call other hooks.',
  },
  {
    h: 250,
    line: 'useCounter() called twice',
    result: { text: 'shares logic, not state', tone: 'ok' },
    cards: [
      box('a', C1, 50, W2, 'counter in A', ['count = 3'], 'ok'),
      box('b', R2, 50, W2, 'counter in B', ['count = 0'], 'ok'),
      box('h', C1, 160, 612, 'every call has its own state', ['to share the state itself, lift it up or use context'], 'new'),
    ],
    note: 'A custom hook shares logic, not state. Two components calling it have two separate counters.',
  },
  {
    h: 250,
    line: 'useQuery(["user", id], fetchUser)',
    result: { text: 'cache, dedupe, retry for free', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'component', ['useQuery(key, fn)'], 'none'),
      box('q', C2, 70, W, 'TanStack Query', ['cache by key,', 'dedupe, retry'], 'new'),
      box('s', C3, 70, W, 'server', ['one request,', 'shared'], 'ok'),
      box('n', C1, 180, 612, 'fetching by hand in useEffect repeats all of that work', ['loading and error state, races, caching, refetching'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'q', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'q', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'For server data, a library such as TanStack Query is a custom hook done well.',
  },
];

export const REACT_HOOKS_SCENES = [
  { id: 'effect', label: 'useEffect', title: 'Synchronise with the outside world', stage: BoardStage, frames: effectFrames },
  { id: 'memo', label: 'Memoization', title: 'Same value, same reference', stage: BoardStage, frames: memoFrames },
  { id: 'reducer', label: 'Reducer and context', title: 'Complex state and shared state', stage: BoardStage, frames: reducerFrames },
  { id: 'custom', label: 'Custom hooks', title: 'Share logic, not state', stage: BoardStage, frames: customFrames },
];
