// Frame data for the "React hooks" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const REACT_HOOKS_SCENES = [
  {
    id: 'effect',
    label: 'useEffect',
    title: 'Synchronise with the outside world',
    frames: [
      {
        note: 'An effect is code that talks to something outside React: a network request, a subscription, a timer, the document title. The component renders and the DOM is committed first. Then, after the paint, React runs the effect.',
        boxes: [b('r', 'Component render', ['pure, no side effects'], 'ok'), b('d', 'DOM committed', ['the screen is painted'], 'ok'), b('e', 'useEffect', ['subscribe, fetch, timer'], 'new')],
        deps: [d('Component render', 'DOM committed', 'commit', 'ok'), d('DOM committed', 'useEffect', 'then runs', 'ok')],
      },
      {
        note: 'The dependency array says when to run again. With [userId] the effect re-runs only when userId changed. Before it runs again, and when the component unmounts, React first runs the cleanup function returned by the previous run.',
        boxes: [b('u', 'userId changes', ['the dependency'], 'warn'), b('c', 'Cleanup runs', ['abort the old request'], 'new'), b('e', 'Effect runs again', ['fetch the new user'], 'ok')],
        deps: [d('userId changes', 'Cleanup runs', 'first', 'ok'), d('Cleanup runs', 'Effect runs again', 'then', 'ok')],
      },
      {
        note: 'Without cleanup there is a race. The user clicks A then B. Request A is slow and request B is fast. B arrives and shows, then A arrives later and overwrites it with the wrong data. Abort the old request in the cleanup, or ignore its result.',
        boxes: [b('a', 'Request A', ['slow, for user 1'], 'warn'), b('b', 'Request B', ['fast, for user 2'], 'ok'), b('s', 'Stale response', ['A arrives last and wins'], 'bad'), b('f', 'Abort in cleanup', ['A is cancelled'], 'ok')],
        deps: [d('Request A', 'Stale response', 'overwrites B', 'bad'), d('Abort in cleanup', 'Request A', 'cancels', 'ok')],
      },
      {
        note: 'In development, StrictMode mounts the component, runs the cleanup, and mounts it again. It is a test: if your effect and cleanup are a matched pair, nothing visible changes. If a subscription doubles or a request is sent twice, the cleanup is missing.',
        boxes: [b('m', 'Mount: effect runs', ['connect'], 'ok'), b('s', 'Simulated unmount', ['cleanup disconnects'], 'warn'), b('n', 'Mount again', ['effect connects again'], 'ok')],
        deps: [d('Mount: effect runs', 'Simulated unmount', 'StrictMode, dev only', 'warn'), d('Simulated unmount', 'Mount again', 'then', 'ok')],
      },
    ],
  },
  {
    id: 'memo',
    label: 'Memoization',
    title: 'Same value, same reference',
    frames: [
      {
        note: 'A child wrapped in memo skips its render when its props are equal. But props are compared by reference. The parent creates a new function or object on every render, so the child sees a new prop each time and renders anyway.',
        boxes: [b('p', 'Parent render', ['creates onSave again'], 'warn'), b('n', 'New function each time', ['a different reference'], 'bad'), b('c', 'memo child', ['sees a changed prop'], 'bad')],
        deps: [d('Parent render', 'New function each time', 'creates', 'warn'), d('New function each time', 'memo child', 'prop changed', 'bad')],
      },
      {
        note: 'useCallback returns the same function between renders while its dependencies are unchanged, and useMemo does the same for a computed value. The memo child now receives an equal prop and skips the render.',
        boxes: [b('u', 'useCallback', ['same function, same deps'], 'new'), b('s', 'Stable reference', ['unchanged between renders'], 'ok'), b('c', 'memo child', ['skips the render'], 'ok')],
        deps: [d('useCallback', 'Stable reference', 'returns', 'ok'), d('Stable reference', 'memo child', 'equal prop', 'ok')],
      },
      {
        note: 'Memoization has a cost and a risk: extra code, comparison work, and a stale value if a dependency is missing. Measure with the Profiler first. Most renders are cheap. The React Compiler can add memoization for you at build time.',
        boxes: [b('m', 'Measure first', ['React Profiler'], 'ok'), b('x', 'Slow render found', ['one costly subtree'], 'warn'), b('f', 'Targeted fix', ['memo, split, or Compiler'], 'ok')],
        deps: [d('Measure first', 'Slow render found', 'shows', 'warn'), d('Slow render found', 'Targeted fix', 'then fix that', 'ok')],
      },
    ],
  },
  {
    id: 'reducer',
    label: 'Reducer and context',
    title: 'Complex state and shared state',
    frames: [
      {
        note: 'When state has many transitions, useReducer keeps them in one place. A component dispatches an action, which describes what happened. The reducer is a pure function that takes the current state and the action and returns the next state.',
        boxes: [b('c', 'Component', ['dispatch({ type: add })'], 'none'), b('r', 'reducer(state, action)', ['pure, returns new state'], 'new'), b('s', 'New state', ['a new object'], 'ok')],
        deps: [d('Component', 'reducer(state, action)', 'dispatch', 'ok'), d('reducer(state, action)', 'New state', 'returns', 'ok'), d('New state', 'Component', 'renders again', 'ok')],
      },
      {
        note: 'Context passes a value to any descendant without threading props through every level. When the provider value changes, every component that reads that context renders again, even if it uses only part of the value.',
        boxes: [b('p', 'Provider', ['value changes'], 'new'), b('a', 'Consumer A', ['re-renders'], 'warn'), b('b', 'Consumer B', ['re-renders'], 'warn'), b('u', 'Unrelated component', ['not affected'], 'none')],
        deps: [d('Provider', 'Consumer A', 'value', 'warn'), d('Provider', 'Consumer B', 'value', 'warn')],
      },
      {
        note: 'Split what changes often from what does not. Put the state in one context and the dispatch function, which is stable, in another. Components that only dispatch no longer render when the state changes. Memoise the provider value.',
        boxes: [b('s', 'State context', ['changes often'], 'warn'), b('d', 'Dispatch context', ['never changes'], 'ok'), b('b', 'Add button', ['reads dispatch only'], 'ok'), b('l', 'Cart list', ['reads state'], 'ok')],
        deps: [d('Dispatch context', 'Add button', 'stable, no re-render', 'ok'), d('State context', 'Cart list', 're-renders on change', 'warn')],
      },
    ],
  },
  {
    id: 'custom',
    label: 'Custom hooks',
    title: 'Share logic, not state',
    frames: [
      {
        note: 'Two components fetch data the same way: loading flag, error, abort, result. Move that logic into a function whose name starts with use, a custom hook, and both components call it. It is plain JavaScript that may call other hooks.',
        boxes: [b('a', 'Account page', ['calls useFetch'], 'ok'), b('b', 'Payments page', ['calls useFetch'], 'ok'), b('h', 'useFetch hook', ['loading, error, abort, data'], 'new')],
        deps: [d('Account page', 'useFetch hook', 'uses', 'ok'), d('Payments page', 'useFetch hook', 'uses', 'ok')],
      },
      {
        note: 'A custom hook shares logic, not state. Each call creates its own state, as if the code were written inside that component. Two components calling useCounter have two separate counters. To share state itself, lift it up or use context.',
        boxes: [b('a', 'Counter in A', ['count = 3'], 'ok'), b('b', 'Counter in B', ['count = 0'], 'ok'), b('h', 'useCounter hook', ['called twice, two states'], 'new')],
        deps: [d('Counter in A', 'useCounter hook', 'own copy of state', 'ok'), d('Counter in B', 'useCounter hook', 'own copy of state', 'ok')],
      },
      {
        note: 'For server data, a library such as TanStack Query is a custom hook done well. It caches by key, shares one request between components, retries, refetches when stale, and tracks loading and error. Fetching in useEffect by hand repeats all that work.',
        boxes: [b('c', 'Component', ['useQuery(key, fn)'], 'none'), b('q', 'TanStack Query', ['cache, dedupe, retry'], 'new'), b('s', 'Server', ['one request, shared'], 'ok')],
        deps: [d('Component', 'TanStack Query', 'asks by key', 'ok'), d('TanStack Query', 'Server', 'fetches if stale', 'ok')],
      },
    ],
  },
];
