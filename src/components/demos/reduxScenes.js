// Frame data for the "Redux Toolkit" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- one-way data flow ---------- */
const flowFrames = [
  {
    h: 250,
    line: 'dispatch(itemAdded(item))',
    result: { text: 'the UI describes, it does not change', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'click in the UI', ['Add to cart'], 'none'),
      box('a', C2, 70, W, 'dispatch(itemAdded)', ['an action describes', 'the event'], 'new'),
      box('s', C3, 70, W, 'Redux store', ['one state tree'], 'ok'),
      box('x', C1, 180, 612, 'an action is a plain object: { type: "cart/itemAdded", payload }', ['name actions as events that happened, not as setters'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'a', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The component does not change any state. It dispatches an action that says what happened. The store holds the whole app state.',
  },
  {
    h: 250,
    line: '(state, action) => next state',
    result: { text: 'pure: no network, no mutation', tone: 'ok' },
    cards: [
      box('s', C1, 70, W, 'Redux store', ['current state'], 'ok'),
      box('r', C2, 70, W, 'reducer', ['(state, action)', '=> next state'], 'new'),
      box('n', C3, 70, W, 'new state', ['a new object,', 'the old one is kept'], 'ok'),
      box('x', C1, 180, 612, 'Redux Toolkit lets you write mutating code', ['Immer turns it into an immutable copy'], 'none'),
    ],
    arrows: [{ from: 's', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'r', to: 'n', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The store calls the reducer with the current state and the action. The reducer decides the next state from those two inputs and nothing else.',
  },
  {
    h: 260,
    line: 'useSelector compares by reference',
    result: { text: 'only changed readers render', tone: 'ok' },
    cards: [
      box('n', C2, 40, W, 'new state', ['saved in the store'], 'ok'),
      box('r', C1, 150, 140, 'cart badge', ['value changed,', 'renders'], 'ok'),
      box('x', 174, 150, 140, 'footer', ['value same,', 'skips'], 'none'),
    ],
    arrows: [{ from: 'n', to: 'r', fs: 'b', ts: 't', tone: 'ok' }, { from: 'n', to: 'x', fs: 'b', ts: 't', tone: 'none' }],
    note: 'The store tells its subscribers. Each useSelector re-runs and compares its result by reference. Only components whose selected value changed render again.',
  },
  {
    h: 250,
    line: 'middleware sits before the reducer',
    result: { text: 'the reducer stays pure', tone: 'ok' },
    cards: [
      box('d', C1, 70, W, 'dispatch(action)', ['from the UI'], 'none'),
      box('m', C2, 70, W, 'middleware chain', ['thunk, logger,', 'listeners'], 'new'),
      box('r', C3, 70, W, 'reducer', ['still pure'], 'ok'),
      box('x', C1, 180, 612, 'middleware sees every action', ['log it, run async code, send analytics, react to it'], 'none'),
    ],
    arrows: [{ from: 'd', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Middleware can see every action and act on it. Thunk is middleware: it lets you dispatch a function.',
  },
];

/* ---------- async with thunks ---------- */
const asyncFrames = [
  {
    h: 250,
    line: 'dispatch(fetchAccounts())',
    result: { text: 'pending: loading = true', tone: 'warn' },
    cards: [
      box('d', C1, 70, W, 'dispatch', ['fetchAccounts()'], 'none'),
      box('t', C2, 70, W, 'thunk', ['runs the async call'], 'new'),
      box('p', C3, 70, W, 'accounts/pending', ['loading = true'], 'warn'),
      box('x', C1, 180, 612, 'a reducer must be pure, so the network call lives in a thunk', ['createAsyncThunk wraps the usual pattern'], 'none'),
    ],
    arrows: [{ from: 'd', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 'p', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'When the thunk starts, it dispatches a pending action. The slice uses it to set loading to true.',
  },
  {
    h: 250,
    line: 'the request succeeded',
    result: { text: 'fulfilled: data saved', tone: 'ok' },
    cards: [
      box('t', C1, 70, W, 'thunk', ['request succeeded'], 'ok'),
      box('f', C2, 70, W, 'accounts/fulfilled', ['payload = the', 'accounts'], 'ok'),
      box('s', C3, 70, W, 'accounts slice', ['items saved,', 'loading = false'], 'ok'),
      box('x', C1, 180, 612, 'the component, subscribed with useSelector, renders the list', ['no manual setState anywhere'], 'none'),
    ],
    arrows: [{ from: 't', to: 'f', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'f', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'On success the thunk dispatches fulfilled with the result as its payload. The reducer stores the data.',
  },
  {
    h: 250,
    line: 'the request failed',
    result: { text: 'rejected: store a message', tone: 'bad' },
    cards: [
      box('t', C1, 70, W, 'thunk', ['request failed'], 'bad'),
      box('r', C2, 70, W, 'accounts/rejected', ['an error message'], 'bad'),
      box('s', C3, 70, W, 'accounts slice', ['error saved,', 'loading = false'], 'warn'),
      box('x', C1, 180, 612, 'never put the raw Error object in state', ['state should be plain serialisable data'], 'none'),
    ],
    arrows: [{ from: 't', to: 'r', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'r', to: 's', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'On failure a rejected action carries the error. The slice stores a serialisable message and clears loading.',
  },
];

/* ---------- selectors and re-renders ---------- */
const selectorFrames = [
  {
    h: 250,
    line: 'useSelector((s) => s.cart.items)',
    result: { text: 'same reference, no render', tone: 'ok' },
    cards: [
      box('d', C1, 70, W, 'any dispatch', ['an unrelated action'], 'none'),
      box('s', C2, 70, W, 'select the items', ['state.cart.items'], 'ok'),
      box('c', C3, 70, W, 'cart list', ['same reference,', 'no render'], 'ok'),
      box('x', C1, 180, 612, 'useSelector runs after every dispatch', ['it re-renders only if the result is not === to the last one'], 'none'),
    ],
    arrows: [{ from: 'd', to: 's', fs: 'r', ts: 'l', tone: 'ok' }, { from: 's', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Selecting a primitive or an existing object from state is safe. Nothing changed means the same reference.',
  },
  {
    h: 250,
    line: 'useSelector((s) => s.items.filter(...))',
    result: { text: 'new array every time, always renders', tone: 'bad' },
    cards: [
      box('d', C1, 70, W, 'any dispatch', ['an unrelated action'], 'none'),
      box('s', C2, 70, W, 'select with filter', ['returns a new array'], 'bad'),
      box('c', C3, 70, W, 'cart list', ['renders every time'], 'bad'),
      box('x', C1, 180, 612, 'this is the most common Redux performance bug', ['the component renders after every action in the whole app'], 'none'),
    ],
    arrows: [{ from: 'd', to: 's', fs: 'r', ts: 'l', tone: 'warn' }, { from: 's', to: 'c', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'A selector that builds a new array or object returns a new reference on every run, so the component renders after every action.',
  },
  {
    h: 250,
    line: 'createSelector([items], (items) => ...)',
    result: { text: 'same input, same reference', tone: 'ok' },
    cards: [
      box('i', C1, 70, W, 'input selectors', ['items, filter'], 'none'),
      box('m', C2, 70, W, 'createSelector', ['recomputes only', 'on change'], 'new'),
      box('r', C3, 70, W, 'memoised result', ['the same reference'], 'ok'),
      box('x', C1, 180, 612, 'the component renders only when the data it depends on changed', ['select the smallest value you need'], 'none'),
    ],
    arrows: [{ from: 'i', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'createSelector memoises the result. It recomputes only when its input selectors return different values.',
  },
];

/* ---------- RTK Query ---------- */
const rtkqueryFrames = [
  {
    h: 250,
    line: 'useGetAccountsQuery()',
    result: { text: 'cache first, server on a miss', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'accounts page', ['useGetAccounts', 'Query()'], 'none'),
      box('q', C2, 70, W, 'RTK Query cache', ['keyed by endpoint', '+ arguments'], 'new'),
      box('s', C3, 70, W, 'API server', ['called on a miss'], 'ok'),
      box('x', C1, 180, 612, 'loading and error state come with the hook', ['no thunk, no reducer, no loading flag to write'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'q', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'q', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The generated hook looks in the cache. If there is nothing, RTK Query calls the server and stores the response.',
  },
  {
    h: 260,
    line: 'two components, one key',
    result: { text: 'one request, shared', tone: 'ok' },
    cards: [
      box('q', C2, 40, W, 'RTK Query cache', ['one request,', 'one entry'], 'new'),
      box('a', C1, 150, W2, 'accounts page', ['first subscriber'], 'ok'),
      box('b', R2, 150, W2, 'header menu', ['second subscriber,', 'gets it at once'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 'q', fs: 't', ts: 'b', tone: 'ok' }, { from: 'b', to: 'q', fs: 't', ts: 'b', tone: 'ok' }],
    note: 'A second component asking for the same data gets the cached value at once. The cache is cleared when nothing uses it any more.',
  },
  {
    h: 250,
    line: 'invalidatesTags: ["Account"]',
    result: { text: 'the list refetches itself', tone: 'ok' },
    cards: [
      box('m', C1, 70, W, 'addAccount', ['a POST to the', 'server'], 'new'),
      box('t', C2, 70, W, 'tag: Account', ['invalidated'], 'warn'),
      box('r', C3, 70, W, 'refetch', ['the list reloads'], 'ok'),
      box('x', C1, 180, 612, 'the query provides the tag, the mutation invalidates it', ['every query with that tag is refetched, no manual code'], 'none'),
    ],
    arrows: [{ from: 'm', to: 't', fs: 'r', ts: 'l', tone: 'warn' }, { from: 't', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'When a mutation succeeds, every query that provides the invalidated tag is refetched.',
  },
];

export const REDUX_SCENES = [
  { id: 'flow', label: 'One-way data flow', title: 'Action, reducer, state, view', stage: BoardStage, frames: flowFrames },
  { id: 'async', label: 'Async with thunks', title: 'Pending, fulfilled, rejected', stage: BoardStage, frames: asyncFrames },
  { id: 'selectors', label: 'Selectors and re-renders', title: 'Select little, keep references stable', stage: BoardStage, frames: selectorFrames },
  { id: 'rtkquery', label: 'RTK Query', title: 'A cache for server data', stage: BoardStage, frames: rtkqueryFrames },
];
