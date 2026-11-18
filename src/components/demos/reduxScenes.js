// Frame data for the "Redux Toolkit" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const REDUX_SCENES = [
  {
    id: 'flow',
    label: 'One-way data flow',
    title: 'Action, reducer, state, view',
    frames: [
      {
        note: 'A user clicks Add to cart. The component does not change any state. It dispatches an action, a plain object that says what happened, for example { type: "cart/itemAdded", payload: item }. The store is the single object that holds the whole app state.',
        boxes: [b('c', 'Click in the UI', ['Add to cart'], 'none'), b('a', 'dispatch(itemAdded)', ['an action describes the event'], 'new'), b('s', 'Redux store', ['one state tree'], 'ok')],
        deps: [d('Click in the UI', 'dispatch(itemAdded)', 'handler calls', 'ok'), d('dispatch(itemAdded)', 'Redux store', 'sent to', 'ok')],
      },
      {
        note: 'The store calls the reducer with the current state and the action. The reducer is a pure function: it decides the next state from those two inputs and nothing else, with no network call, no random numbers and no mutation. With Redux Toolkit you may write mutating code, because Immer turns it into a copy.',
        boxes: [b('s', 'Redux store', ['current state'], 'ok'), b('r', 'Reducer', ['(state, action) => next state'], 'new'), b('n', 'New state', ['a new object, old one kept'], 'ok')],
        deps: [d('Redux store', 'Reducer', 'state + action', 'ok'), d('Reducer', 'New state', 'returns', 'ok')],
      },
      {
        note: 'The store saves the new state and tells its subscribers. Each useSelector re-runs its selector and compares the result to the last one by reference. Only components whose selected value changed render again, so the others do no work.',
        boxes: [b('n', 'New state', ['saved in the store'], 'ok'), b('u', 'useSelector', ['compares by reference'], 'new'), b('r', 'Cart badge', ['value changed, renders'], 'ok'), b('x', 'Footer', ['value same, skips'], 'none')],
        deps: [d('New state', 'useSelector', 'notifies', 'ok'), d('useSelector', 'Cart badge', 're-render', 'ok'), d('useSelector', 'Footer', 'no change', 'none')],
      },
      {
        note: 'Middleware sits between dispatch and the reducer. It can see every action and act on it: log it, run async code (the thunk middleware lets you dispatch a function), send analytics, or react to specific actions. The reducer itself stays pure.',
        boxes: [b('d', 'dispatch(action)', ['from the UI'], 'none'), b('m', 'Middleware chain', ['thunk, logger, listeners'], 'new'), b('r', 'Reducer', ['still pure'], 'ok')],
        deps: [d('dispatch(action)', 'Middleware chain', 'passes through', 'ok'), d('Middleware chain', 'Reducer', 'then reaches', 'ok')],
      },
    ],
  },
  {
    id: 'async',
    label: 'Async with thunks',
    title: 'Pending, fulfilled, rejected',
    frames: [
      {
        note: 'Reducers must be pure, so a network call lives in a thunk, a function you dispatch. createAsyncThunk wraps it. When it starts it dispatches a pending action, which the slice uses to set loading to true.',
        boxes: [b('d', 'dispatch(fetchAccounts)', ['from the component'], 'none'), b('t', 'Thunk', ['runs the async call'], 'new'), b('p', 'accounts/pending', ['loading = true'], 'warn')],
        deps: [d('dispatch(fetchAccounts)', 'Thunk', 'runs', 'ok'), d('Thunk', 'accounts/pending', 'dispatches first', 'warn')],
      },
      {
        note: 'When the request succeeds, the thunk dispatches a fulfilled action carrying the result as its payload. The slice reducer stores the data and sets loading to false. The component, subscribed with useSelector, renders the list.',
        boxes: [b('t', 'Thunk', ['request succeeded'], 'ok'), b('f', 'accounts/fulfilled', ['payload = the accounts'], 'ok'), b('s', 'Accounts slice', ['items saved, loading = false'], 'ok')],
        deps: [d('Thunk', 'accounts/fulfilled', 'dispatches', 'ok'), d('accounts/fulfilled', 'Accounts slice', 'reducer stores', 'ok')],
      },
      {
        note: 'When it fails, a rejected action carries the error. The slice stores a serialisable error message and clears loading. Never put the raw Error object in state, because state should be plain serialisable data.',
        boxes: [b('t', 'Thunk', ['request failed'], 'bad'), b('r', 'accounts/rejected', ['error message'], 'bad'), b('s', 'Accounts slice', ['error saved, loading = false'], 'warn')],
        deps: [d('Thunk', 'accounts/rejected', 'dispatches', 'bad'), d('accounts/rejected', 'Accounts slice', 'reducer stores', 'warn')],
      },
    ],
  },
  {
    id: 'selectors',
    label: 'Selectors and re-renders',
    title: 'Select little, keep references stable',
    frames: [
      {
        note: 'useSelector runs after every dispatch and re-renders the component if the result is not the same reference as before. Selecting a primitive or an existing object from state is safe, because nothing changed means the same reference.',
        boxes: [b('d', 'Any dispatch', ['unrelated action'], 'none'), b('s', 'Select the items', ['state.cart.items'], 'ok'), b('c', 'Cart list', ['same reference, no render'], 'ok')],
        deps: [d('Any dispatch', 'Select the items', 'selector re-runs', 'ok'), d('Select the items', 'Cart list', 'unchanged', 'ok')],
      },
      {
        note: 'A selector that builds a new array or object, such as state.items.filter(...), returns a new reference on every run, so the component renders after every action in the whole app, even unrelated ones. This is the most common Redux performance bug.',
        boxes: [b('d', 'Any dispatch', ['unrelated action'], 'none'), b('s', 'Select with filter', ['returns a new array'], 'bad'), b('c', 'Cart list', ['renders every time'], 'bad')],
        deps: [d('Any dispatch', 'Select with filter', 'selector re-runs', 'warn'), d('Select with filter', 'Cart list', 'new reference', 'bad')],
      },
      {
        note: 'createSelector from Reselect memoises the result. It recomputes only when its input selectors return different values, and otherwise returns the same reference. The component then renders only when the data it really depends on changed.',
        boxes: [b('i', 'Input selectors', ['items, filter'], 'none'), b('m', 'createSelector', ['recomputes only on change'], 'new'), b('r', 'Memoised result', ['same reference'], 'ok')],
        deps: [d('Input selectors', 'createSelector', 'inputs', 'ok'), d('createSelector', 'Memoised result', 'cached output', 'ok')],
      },
    ],
  },
  {
    id: 'rtkquery',
    label: 'RTK Query',
    title: 'A cache for server data',
    frames: [
      {
        note: 'RTK Query handles server data. A component calls the generated hook useGetAccountsQuery(). RTK Query looks in its cache, keyed by endpoint and arguments, and if there is nothing it calls the server and stores the response, with loading and error state.',
        boxes: [b('c', 'Accounts page', ['useGetAccountsQuery()'], 'none'), b('q', 'RTK Query cache', ['keyed by endpoint + args'], 'new'), b('s', 'API server', ['called on a miss'], 'ok')],
        deps: [d('Accounts page', 'RTK Query cache', 'asks', 'ok'), d('RTK Query cache', 'API server', 'fetches if missing', 'ok')],
      },
      {
        note: 'A second component asks for the same data. It gets the cached value at once and no second request is sent. Requests with the same key are shared and de-duplicated, and the cache is cleared when no component uses it any more.',
        boxes: [b('a', 'Accounts page', ['first subscriber'], 'ok'), b('b', 'Header menu', ['second subscriber'], 'ok'), b('q', 'RTK Query cache', ['one request, shared'], 'new')],
        deps: [d('Accounts page', 'RTK Query cache', 'subscribes', 'ok'), d('Header menu', 'RTK Query cache', 'subscribes', 'ok')],
      },
      {
        note: 'A mutation changes data on the server. Endpoints declare tags: the query provides the tag Accounts and the mutation invalidates it. When the mutation succeeds, every query with that tag is refetched, so the list updates without any manual code.',
        boxes: [b('m', 'addAccount mutation', ['POST to the server'], 'new'), b('t', 'Tag: Accounts', ['invalidated'], 'warn'), b('r', 'Refetch', ['the list reloads'], 'ok')],
        deps: [d('addAccount mutation', 'Tag: Accounts', 'invalidates', 'warn'), d('Tag: Accounts', 'Refetch', 'triggers', 'ok')],
      },
    ],
  },
];
