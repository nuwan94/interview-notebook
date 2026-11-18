// Frame data for the "React performance and testing" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const REACT_PERF_SCENES = [
  {
    id: 'renders',
    label: 'Why it re-renders',
    title: 'State change, render, commit',
    frames: [
      {
        note: 'A state change makes React render that component: it calls the function and builds a new element tree. By default every child component renders again too, even if its props are the same. Rendering is cheap and does not touch the DOM yet.',
        boxes: [b('s', 'State changes', ['setQuery("visa")'], 'warn'), b('p', 'Parent renders', ['function runs again'], 'ok'), b('c', 'Children render', ['even with same props'], 'warn')],
        deps: [d('State changes', 'Parent renders', 'triggers', 'warn'), d('Parent renders', 'Children render', 'by default', 'warn')],
      },
      {
        note: 'React compares the new tree with the previous one, which is called reconciliation, and finds the smallest set of changes. Only those changes are written to the DOM in the commit phase. So an extra render is wasted work, but not a DOM rewrite.',
        boxes: [b('n', 'New element tree', ['output of render'], 'new'), b('r', 'Reconciliation', ['diff against the old tree'], 'ok'), b('d', 'DOM commit', ['only the changed nodes'], 'ok')],
        deps: [d('New element tree', 'Reconciliation', 'compared', 'ok'), d('Reconciliation', 'DOM commit', 'minimal updates', 'ok')],
      },
      {
        note: 'The cost is real when a render is slow or runs very often: a big list, an expensive calculation, or a state that changes on every keystroke high in the tree. One slow component makes typing feel laggy because the browser cannot paint until it finishes.',
        boxes: [b('k', 'Keystroke', ['state at the top'], 'warn'), b('l', 'Big list renders', ['5,000 rows, 80 ms'], 'bad'), b('f', 'Laggy typing', ['frame is missed'], 'bad')],
        deps: [d('Keystroke', 'Big list renders', 'whole subtree', 'bad'), d('Big list renders', 'Laggy typing', 'blocks the paint', 'bad')],
      },
    ],
  },
  {
    id: 'fixes',
    label: 'Fixing slow renders',
    title: 'Measure first, then the cheapest fix',
    frames: [
      {
        note: 'Start with the React Profiler in DevTools. Record the interaction, then read the flame graph: which component rendered, why it rendered, and how long it took. Fix the one that is both slow and frequent. Do not guess.',
        boxes: [b('r', 'Record in Profiler', ['type in the search box'], 'new'), b('f', 'Flame graph', ['why did it render?'], 'ok'), b('s', 'Slow component', ['TransactionTable'], 'warn')],
        deps: [d('Record in Profiler', 'Flame graph', 'shows', 'ok'), d('Flame graph', 'Slow component', 'points to', 'warn')],
      },
      {
        note: 'The cheapest fix is structural. Move state down to the component that uses it, so the typing state no longer lives above the table. Or pass the slow part as children, which are created by the parent and keep the same reference.',
        boxes: [b('a', 'Search box', ['owns its own state'], 'ok'), b('t', 'TransactionTable', ['no longer re-renders'], 'ok'), b('p', 'Page', ['holds no search state'], 'ok')],
        deps: [d('Page', 'Search box', 'renders', 'ok'), d('Page', 'TransactionTable', 'unaffected', 'ok')],
      },
      {
        note: 'Next options: memo on the slow child (with stable props), useMemo for an expensive calculation, and useDeferredValue or useTransition so typing stays urgent and the list updates later. The React Compiler can add much of the memoisation for you.',
        boxes: [b('m', 'memo + stable props', ['skip equal renders'], 'new'), b('d', 'useDeferredValue', ['list lags behind typing'], 'new'), b('c', 'React Compiler', ['automatic memoisation'], 'new')],
        deps: [d('memo + stable props', 'useDeferredValue', 'then', 'ok'), d('useDeferredValue', 'React Compiler', 'or', 'ok')],
      },
      {
        note: 'For very long lists, render only what is visible. Virtualisation (react-window, TanStack Virtual) keeps about 20 rows in the DOM and swaps them as you scroll, so 50,000 transactions cost the same as 20.',
        boxes: [b('a', 'Full list', ['50,000 transactions'], 'bad'), b('v', 'Virtualised list', ['about 20 rows in the DOM'], 'ok'), b('s', 'Scroll position', ['decides the visible slice'], 'new')],
        deps: [d('Scroll position', 'Virtualised list', 'selects rows', 'ok'), d('Full list', 'Virtualised list', 'replaced by', 'ok')],
      },
    ],
  },
  {
    id: 'loading',
    label: 'Loading performance',
    title: 'Ship less, load it later',
    frames: [
      {
        note: 'One big bundle makes the first page slow: the browser downloads and parses code for screens the user has not opened. The bundle analyser shows what is heavy, often a charting or date library.',
        boxes: [b('b', 'One big bundle', ['2.4 MB of JavaScript'], 'bad'), b('p', 'Download and parse', ['slow on mobile'], 'warn'), b('u', 'Late first paint', ['the user waits'], 'bad')],
        deps: [d('One big bundle', 'Download and parse', 'before anything', 'warn'), d('Download and parse', 'Late first paint', 'delays', 'bad')],
      },
      {
        note: 'Code splitting with React.lazy and dynamic import loads a route or heavy component only when needed. Suspense shows a fallback while the chunk downloads. Splitting at the route level is the usual first step.',
        boxes: [b('r', 'Route /reports', ['React.lazy(() => import)'], 'new'), b('s', 'Suspense fallback', ['spinner while loading'], 'warn'), b('c', 'Reports chunk', ['loaded on demand'], 'ok')],
        deps: [d('Route /reports', 'Suspense fallback', 'shows', 'warn'), d('Route /reports', 'Reports chunk', 'downloads', 'ok')],
      },
      {
        note: 'Also measure what users feel: Largest Contentful Paint, Interaction to Next Paint and Cumulative Layout Shift. Optimise images (size, format, lazy loading), cache static files with hashed names, and use a CDN. Frameworks add server rendering for a faster first paint.',
        boxes: [b('v', 'Web Vitals', ['LCP, INP, CLS'], 'new'), b('i', 'Optimised images', ['sized, lazy, modern format'], 'ok'), b('n', 'CDN + caching', ['hashed file names'], 'ok')],
        deps: [d('Web Vitals', 'Optimised images', 'guides', 'ok'), d('Web Vitals', 'CDN + caching', 'guides', 'ok')],
      },
    ],
  },
  {
    id: 'testing',
    label: 'Testing',
    title: 'Test what the user sees',
    frames: [
      {
        note: 'Use a pyramid. Many fast unit tests for pure logic (reducers, selectors, helpers) with Vitest or Jest. A good number of component tests with React Testing Library. A few end-to-end tests of key journeys with Playwright or Cypress.',
        boxes: [b('u', 'Unit tests', ['many, milliseconds'], 'ok'), b('c', 'Component tests', ['React Testing Library'], 'ok'), b('e', 'End-to-end tests', ['few, real browser'], 'warn')],
        deps: [d('Unit tests', 'Component tests', 'then', 'ok'), d('Component tests', 'End-to-end tests', 'then', 'warn')],
      },
      {
        note: 'React Testing Library renders the component and queries it like a user would: by role, label and text, not by class name or internal state. userEvent clicks and types. Then you assert on what is on the screen, so refactors do not break the test.',
        boxes: [b('r', 'render(Transfer form)', ['real DOM in jsdom'], 'new'), b('q', 'getByRole, getByLabelText', ['find like a user'], 'ok'), b('a', 'userEvent + expect', ['click, type, assert text'], 'ok')],
        deps: [d('render(Transfer form)', 'getByRole, getByLabelText', 'query', 'ok'), d('getByRole, getByLabelText', 'userEvent + expect', 'act and assert', 'ok')],
      },
      {
        note: 'Components call the network. Mock Service Worker (MSW) intercepts the request at the network level and returns a fake response, so the component runs its real fetch code. The same handlers serve tests, Storybook and local development.',
        boxes: [b('c', 'Component', ['calls fetch /accounts'], 'none'), b('m', 'MSW handler', ['returns fake JSON'], 'new'), b('s', 'Assertion', ['table shows two rows'], 'ok')],
        deps: [d('Component', 'MSW handler', 'request intercepted', 'ok'), d('MSW handler', 'Assertion', 'renders result', 'ok')],
      },
    ],
  },
];
