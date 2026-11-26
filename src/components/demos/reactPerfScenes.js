// Frame data for the "React performance and testing" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- why it re-renders ---------- */
const rendersFrames = [
  {
    h: 250,
    line: 'setQuery("visa")',
    result: { text: 'children render too, by default', tone: 'warn' },
    cards: [
      box('s', C1, 70, W, 'state changes', ['setQuery("visa")'], 'warn'),
      box('p', C2, 70, W, 'parent renders', ['the function runs', 'again'], 'ok'),
      box('c', C3, 70, W, 'children render', ['even with the', 'same props'], 'warn'),
      box('n', C1, 180, 612, 'a render is a function call that builds a new element tree', ['it is cheap and does not touch the DOM yet'], 'none'),
    ],
    arrows: [{ from: 's', to: 'p', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'p', to: 'c', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A state change makes React render that component. By default every child renders again too, even with the same props.',
  },
  {
    h: 250,
    line: 'render, then commit',
    result: { text: 'only the changed nodes are written', tone: 'ok' },
    cards: [
      box('n', C1, 70, W, 'new element tree', ['the output of render'], 'new'),
      box('r', C2, 70, W, 'reconciliation', ['diff against the', 'old tree'], 'ok'),
      box('d', C3, 70, W, 'DOM commit', ['only the changed', 'nodes'], 'ok'),
      box('x', C1, 180, 612, 'an extra render is wasted JavaScript time', ['it is not a DOM rewrite'], 'none'),
    ],
    arrows: [{ from: 'n', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'r', to: 'd', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'React compares the new tree with the old one (reconciliation) and writes only the differences to the DOM, in the commit phase.',
  },
  {
    h: 250,
    line: 'a keystroke at the top of the tree',
    result: { text: 'slow render, laggy typing', tone: 'bad' },
    cards: [
      box('k', C1, 70, W, 'keystroke', ['state lives at', 'the top'], 'warn'),
      box('l', C2, 70, W, 'big list renders', ['5,000 rows,', '80 ms'], 'bad'),
      box('f', C3, 70, W, 'laggy typing', ['the frame is missed'], 'bad'),
      box('x', C1, 180, 612, 'the browser cannot paint until the render finishes', ['it matters only when a render is slow or very frequent'], 'none'),
    ],
    arrows: [{ from: 'k', to: 'l', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'l', to: 'f', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'The cost is real when a render is slow or runs very often. One slow component makes typing feel laggy.',
  },
];

/* ---------- fixing slow renders ---------- */
const fixesFrames = [
  {
    h: 250,
    line: 'measure first',
    result: { text: 'fix what is slow and frequent', tone: 'ok' },
    cards: [
      box('r', C1, 70, W, 'record in Profiler', ['type in the', 'search box'], 'new'),
      box('f', C2, 70, W, 'flame graph', ['why did it render?'], 'ok'),
      box('s', C3, 70, W, 'slow component', ['TransactionTable'], 'warn'),
      box('x', C1, 180, 612, 'use a production build, change one thing, record again', ['if the number did not improve, undo the change'], 'none'),
    ],
    arrows: [{ from: 'r', to: 'f', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'f', to: 's', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Record the interaction in the React Profiler and read the flame graph. Do not guess.',
  },
  {
    h: 270,
    line: 'move state down',
    result: { text: 'the table no longer re-renders', tone: 'ok' },
    cards: [
      box('p', C2, 40, W, 'page', ['holds no search state'], 'ok'),
      box('a', C1, 150, W2, 'search box', ['owns its own state'], 'ok'),
      box('t', R2, 150, W2, 'transaction table', ['unaffected by typing'], 'ok'),
    ],
    arrows: [{ from: 'p', to: 'a', fs: 'b', ts: 't', tone: 'ok' }, { from: 'p', to: 't', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'The cheapest fix is structural. Keep the state in the small component that uses it. Or pass the slow part as children, which keep the same reference.',
  },
  {
    h: 250,
    line: 'when the structure cannot change',
    result: { text: 'memoise, defer, or let the Compiler do it', tone: 'ok' },
    cards: [
      box('m', C1, 70, W, 'memo + stable props', ['skip equal renders'], 'new'),
      box('d', C2, 70, W, 'useDeferredValue', ['the list lags behind', 'typing'], 'new'),
      box('c', C3, 70, W, 'React Compiler', ['automatic', 'memoisation'], 'new'),
      box('x', C1, 180, 612, 'typing stays urgent, the list updates a moment later', ['these keep the work from blocking input'], 'none'),
    ],
    note: 'Next options: memo on the slow child, useMemo for a costly calculation, and useDeferredValue or useTransition so typing stays smooth.',
  },
  {
    h: 250,
    line: '50,000 transactions',
    result: { text: 'render only what is visible', tone: 'ok' },
    cards: [
      box('a', C1, 70, W, 'full list', ['50,000 rows in', 'the DOM'], 'bad'),
      box('v', C2, 70, W, 'virtualised list', ['about 20 rows', 'in the DOM'], 'ok'),
      box('s', C3, 70, W, 'scroll position', ['decides the', 'visible slice'], 'new'),
      box('x', C1, 180, 612, 'TanStack Virtual or react-window', ['for huge data, also page it on the server'], 'none'),
    ],
    arrows: [{ from: 'a', to: 'v', fs: 'r', ts: 'l', tone: 'ok' }, { from: 's', to: 'v', fs: 't', ts: 't', tone: 'ok' }],
    note: 'A virtualised list keeps about 20 rows in the DOM and swaps them as you scroll, so the cost depends on the window, not the data.',
  },
];

/* ---------- loading performance ---------- */
const loadingFrames = [
  {
    h: 250,
    line: 'one big bundle',
    result: { text: 'late first paint', tone: 'bad' },
    cards: [
      box('b', C1, 70, W, 'one big bundle', ['2.4 MB of', 'JavaScript'], 'bad'),
      box('p', C2, 70, W, 'download and parse', ['slow on mobile'], 'warn'),
      box('u', C3, 70, W, 'late first paint', ['the user waits'], 'bad'),
      box('x', C1, 180, 612, 'the browser loads code for screens the user has not opened', ['a bundle analyser shows what is heavy'], 'none'),
    ],
    arrows: [{ from: 'b', to: 'p', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'p', to: 'u', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'One big bundle makes the first page slow. The analyser often points to a charting or date library.',
  },
  {
    h: 250,
    line: 'React.lazy(() => import("./Reports"))',
    result: { text: 'load a route only when needed', tone: 'ok' },
    cards: [
      box('r', C1, 70, W, 'route /reports', ['React.lazy and', 'import()'], 'new'),
      box('s', C2, 70, W, 'Suspense fallback', ['spinner while', 'it loads'], 'warn'),
      box('c', C3, 70, W, 'reports chunk', ['downloaded on', 'demand'], 'ok'),
      box('x', C1, 180, 612, 'split at the route level first', ['then lazy-load rare heavy parts, such as a PDF viewer'], 'none'),
    ],
    arrows: [{ from: 'r', to: 's', fs: 'r', ts: 'l', tone: 'warn' }, { from: 's', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Code splitting loads a route only when it is opened. Suspense shows a fallback while the chunk downloads.',
  },
  {
    h: 250,
    line: 'measure what users feel',
    result: { text: 'LCP, INP and CLS', tone: 'ok' },
    cards: [
      box('v', C1, 70, W, 'Web Vitals', ['LCP, INP, CLS'], 'new'),
      box('i', C2, 70, W, 'optimised images', ['sized, lazy,', 'modern format'], 'ok'),
      box('n', C3, 70, W, 'CDN and caching', ['hashed file names'], 'ok'),
      box('x', C1, 180, 612, 'LCP under 2.5 s, INP under 200 ms, CLS under 0.1', ['server rendering gives a faster first paint'], 'none'),
    ],
    note: 'Track the metrics users feel, then optimise images, cache static files with hashed names, and use a CDN.',
  },
];

/* ---------- testing ---------- */
const testingFrames = [
  {
    h: 250,
    line: 'the testing pyramid',
    result: { text: 'many unit, some component, few end-to-end', tone: 'ok' },
    cards: [
      box('u', C1, 70, W, 'unit tests', ['many, milliseconds'], 'ok'),
      box('c', C2, 70, W, 'component tests', ['React Testing', 'Library'], 'ok'),
      box('e', C3, 70, W, 'end-to-end tests', ['few, real browser'], 'warn'),
      box('x', C1, 180, 612, 'Vitest for logic, Testing Library for screens, Playwright for journeys', ['TypeScript and ESLint sit under all of them'], 'none'),
    ],
    arrows: [{ from: 'u', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'c', to: 'e', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Many fast unit tests, a good number of component tests, and a few end-to-end tests of key journeys.',
  },
  {
    h: 250,
    line: 'test what the user sees',
    result: { text: 'refactors do not break the test', tone: 'ok' },
    cards: [
      box('r', C1, 70, W, 'render(form)', ['a real DOM', 'in jsdom'], 'new'),
      box('q', C2, 70, W, 'getByRole,', ['getByLabelText', 'find like a user'], 'ok'),
      box('a', C3, 70, W, 'userEvent + expect', ['click, type,', 'assert the text'], 'ok'),
      box('x', C1, 180, 612, 'do not test state, props passed to children, or class names', ['those are implementation details'], 'none'),
    ],
    arrows: [{ from: 'r', to: 'q', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'q', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Testing Library renders the component and queries it like a user would: by role, label and text.',
  },
  {
    h: 250,
    line: 'mock the network, not your code',
    result: { text: 'the real fetch code runs', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'component', ['calls fetch', '/accounts'], 'none'),
      box('m', C2, 70, W, 'MSW handler', ['returns fake JSON'], 'new'),
      box('s', C3, 70, W, 'assertion', ['table shows', 'two rows'], 'ok'),
      box('x', C1, 180, 612, 'the same handlers serve tests, Storybook and local development', ['do not mock your own components, hooks or store'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Mock Service Worker intercepts the request at the network level, so the component runs its real fetching code.',
  },
];

export const REACT_PERF_SCENES = [
  { id: 'renders', label: 'Why it re-renders', title: 'State change, render, commit', stage: BoardStage, frames: rendersFrames },
  { id: 'fixes', label: 'Fixing slow renders', title: 'Measure first, then the cheapest fix', stage: BoardStage, frames: fixesFrames },
  { id: 'loading', label: 'Loading performance', title: 'Ship less, load it later', stage: BoardStage, frames: loadingFrames },
  { id: 'testing', label: 'Testing', title: 'Test what the user sees', stage: BoardStage, frames: testingFrames },
];
