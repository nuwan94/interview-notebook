// Frame data for the "React core" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- render and commit ---------- */
const renderFrames = [
  {
    h: 250,
    line: 'onClick={() => setCount(count + 1)}',
    result: { text: 'asks for a render, changes nothing yet', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'click event', ['user clicks +'], 'none'),
      box('s', C2, 70, W, 'setCount(count + 1)', ['asks for new state'], 'new'),
      box('r', C3, 70, W, 'React scheduler', ['batches the updates,', 'queues a render'], 'ok'),
      box('n', C1, 180, 612, 'the variable count does not change right away', ['the new value shows up in the next render'], 'none'),
    ],
    arrows: [{ from: 'c', to: 's', fs: 'r', ts: 'l', tone: 'ok' }, { from: 's', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The handler calls the setter. That does not change the variable. It tells React that this component needs a new render, and React schedules it.',
  },
  {
    h: 250,
    line: 'render phase',
    result: { text: 'must be pure: no side effects', tone: 'ok' },
    cards: [
      box('r', C1, 70, W, 'React scheduler', ['starts the render'], 'ok'),
      box('c', C2, 70, W, 'Counter()', ['called again', 'with count = 1'], 'new'),
      box('t', C3, 70, W, 'new element tree', ['a description', 'of the UI'], 'ok'),
      box('n', C1, 180, 612, 'same props and state in, same JSX out', ['no fetch, no mutation, no Math.random() or Date.now() in the output'], 'warn'),
    ],
    arrows: [{ from: 'r', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'c', to: 't', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'React calls the component function again with the new state. It returns a tree of elements. Rendering may be paused, repeated or thrown away, so it must have no side effects.',
  },
  {
    h: 250,
    line: 'reconciliation',
    result: { text: 'only the text changed', tone: 'ok' },
    cards: [
      box('p', C1, 70, W, 'previous tree', ['<button>0</button>'], 'none'),
      box('n', C1, 160, W, 'new tree', ['<button>1</button>'], 'ok'),
      box('d', C2, 110, W, 'diff', ['same type, same place', '= update, not replace'], 'new'),
      box('x', C3, 110, W, 'result', ['one text node', 'changes'], 'ok'),
    ],
    arrows: [
      { from: 'p', to: 'd', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'n', to: 'd', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'd', to: 'x', fs: 'r', ts: 'l', tone: 'ok' },
    ],
    note: 'React compares the new tree with the previous one, level by level. The same type in the same place means update. A different type means replace.',
  },
  {
    h: 250,
    line: 'commit phase',
    result: { text: 'useEffect runs after the paint', tone: 'ok' },
    cards: [
      box('d', 14, 70, 132, 'diff', ['one change'], 'ok'),
      box('m', 174, 70, 132, 'DOM update', ['one text node'], 'new'),
      box('b', 334, 70, 132, 'browser paint', ['the screen', 'updates'], 'ok'),
      box('e', 494, 70, 132, 'effects', ['run after', 'the paint'], 'warn'),
      box('n', 14, 180, 612, 'useLayoutEffect runs before the paint', ['useEffect runs after it, so it never blocks what the user sees'], 'none'),
    ],
    arrows: [
      { from: 'd', to: 'm', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'm', to: 'b', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'b', to: 'e', fs: 'r', ts: 'l', tone: 'warn' },
    ],
    note: 'React applies only the difference to the real DOM. The browser paints. Effects run after that.',
  },
];

/* ---------- props and state ---------- */
const dataFrames = [
  {
    h: 250,
    line: 'props flow down',
    result: { text: 'children only read their props', tone: 'ok' },
    cards: [
      box('a', C2, 40, W, 'App', ['owns the state:', 'filter'], 'new'),
      box('s', C1, 160, W2, 'SearchBox', ['gets value and onChange'], 'ok'),
      box('l', R2, 160, W2, 'ProductList', ['gets the filtered items'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 's', fs: 'b', ts: 't', tone: 'ok' }, { from: 'a', to: 'l', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'Data flows one way, from parents to children, through props. App owns the filter text. It passes the value and a change handler to SearchBox, and the filtered items to ProductList.',
  },
  {
    h: 250,
    line: 'user types in SearchBox',
    result: { text: 'events go up, data comes down', tone: 'ok' },
    cards: [
      box('s', C1, 70, W, 'SearchBox', ['calls onChange(text)'], 'new'),
      box('a', C2, 70, W, 'App', ['setFilter(text)', 'renders again'], 'ok'),
      box('l', C3, 70, W, 'ProductList', ['re-renders with', 'new props'], 'ok'),
      box('n', C1, 180, 612, 'a child cannot change its props', ['it calls the function it was given, and the parent changes its own state'], 'none'),
    ],
    arrows: [{ from: 's', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'a', to: 'l', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'SearchBox calls onChange. That runs setFilter in App. App renders again, and both children receive new props.',
  },
  {
    h: 250,
    line: 'two components need the same data',
    result: { text: 'lift the state up', tone: 'ok' },
    cards: [
      box('p', C2, 40, W, 'common parent', ['holds the shared', 'state'], 'new'),
      box('x', C1, 160, W2, 'sibling A', ['shows it (props)'], 'ok'),
      box('y', R2, 160, W2, 'sibling B', ['changes it (handler prop)'], 'ok'),
    ],
    arrows: [
      { from: 'p', to: 'x', fs: 'b', ts: 't', tone: 'ok' },
      { from: 'p', to: 'y', fs: 'b', ts: 't', tone: 'ok' },
    ],
    note: 'Move the state to the closest common parent, and pass it down to both. Keep state as low as possible, and as high as needed.',
  },
];

/* ---------- lists and keys ---------- */
const keyFrames = [
  {
    h: 250,
    line: 'items.map((item) => <Row key={item.id} />)',
    result: { text: 'one stable key per item', tone: 'ok' },
    cards: [
      box('a', C1, 70, W, 'array of items', ['id: 7, 8, 9'], 'none'),
      box('m', C2, 70, W, 'map to elements', ['key = item.id'], 'new'),
      box('l', C3, 70, W, 'list rows', ['one per item'], 'ok'),
      box('n', C1, 180, 612, 'a key must be unique among siblings', ['the best key is a stable id from the data'], 'none'),
    ],
    arrows: [{ from: 'a', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 'l', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Each element in a list needs a key. React uses it to match items between renders.',
  },
  {
    h: 250,
    line: 'order changes: 7, 8, 9 → 9, 7, 8',
    result: { text: 'rows move, state stays with each row', tone: 'ok' },
    cards: [
      box('o', C1, 70, W, 'reordered array', ['9, 7, 8'], 'none'),
      box('k', C2, 70, W, 'stable keys', ['matched by id'], 'ok'),
      box('r', C3, 70, W, 'rows moved', ['no rebuild', 'typed text stays'], 'ok'),
    ],
    arrows: [{ from: 'o', to: 'k', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'k', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'With stable keys, React moves the existing rows. Each row keeps its DOM node and its own state, such as text typed in an input.',
  },
  {
    h: 250,
    line: 'key={index}, new item added at the top',
    result: { text: 'state ends up on the wrong row', tone: 'bad' },
    cards: [
      box('i', C1, 70, W, 'index keys', ['key = position'], 'bad'),
      box('s', C2, 70, W, 'input state', ['stays at position 0'], 'warn'),
      box('w', C3, 70, W, 'wrong row', ['shows the old text'], 'bad'),
    ],
    arrows: [{ from: 'i', to: 's', fs: 'r', ts: 'l', tone: 'bad' }, { from: 's', to: 'w', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'A new item at the top shifts every index. React thinks position 0 is the same row as before, so the typed text now appears on the wrong item.',
  },
  {
    h: 250,
    line: '<ProfileForm key={userId} />',
    result: { text: 'a changed key resets the component', tone: 'ok' },
    cards: [
      box('u', C1, 70, W, 'new key', ['userId changed'], 'new'),
      box('o', C2, 40, W, 'old form', ['unmounted,', 'state discarded'], 'bad'),
      box('f', C2, 150, W, 'fresh form', ['mounted with', 'empty state'], 'ok'),
    ],
    arrows: [{ from: 'u', to: 'o', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'u', to: 'f', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A key is also a reset button. Changing it makes React throw the old component away and create a new one.',
  },
];

/* ---------- state is a snapshot ---------- */
const stateFrames = [
  {
    h: 250,
    line: 'setCount(count + 1); console.log(count)',
    result: { text: 'the handler still sees the old count', tone: 'warn' },
    cards: [
      box('a', C1, 70, W, 'render 1', ['count = 0'], 'ok'),
      box('h', C2, 70, W, 'click handler', ['sees count = 0,', 'even after setCount'], 'warn'),
      box('b', C3, 70, W, 'render 2', ['count = 1'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 'h', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'h', to: 'b', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Each render has its own snapshot of props and state. A handler sees the values of the render it belongs to. The new value shows up in the next render.',
  },
  {
    h: 250,
    line: 'click: three updates in one handler',
    result: { text: 'use the updater form', tone: 'ok' },
    cards: [
      box('x', C1, 70, W2, 'setCount(count + 1) x3', ['same snapshot: 0 + 1', 'result 1'], 'bad'),
      box('y', R2, 70, W2, 'setCount(c => c + 1) x3', ['queued, each gets the latest', 'result 3'], 'ok'),
      box('n', C1, 180, 612, 'use the updater form', ['when the new value depends on the old one'], 'none'),
    ],
    note: 'Three calls with count + 1 all read the same snapshot, so the result is 1. With an updater function, React feeds each call the latest value.',
  },
  {
    h: 250,
    line: 'items.push(x)  vs  setItems([...items, x])',
    result: { text: 'never mutate state', tone: 'bad' },
    cards: [
      box('m', C1, 50, W2, 'items.push(x)', ['same array reference'], 'bad'),
      box('s', R2, 50, W2, 'no re-render', ['React sees no change'], 'bad'),
      box('n', C1, 160, W2, 'setItems([...items, x])', ['a new array'], 'ok'),
      box('r', R2, 160, W2, 're-render', ['the list updates'], 'ok'),
    ],
    arrows: [{ from: 'm', to: 's', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'n', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'React compares state by reference. push keeps the same array, so React may skip the render. Create a new array instead.',
  },
];

export const REACT_SCENES = [
  { id: 'render', label: 'Render and commit', title: 'From a click to the screen', stage: BoardStage, frames: renderFrames },
  { id: 'data', label: 'Props and state', title: 'Data flows down, events flow up', stage: BoardStage, frames: dataFrames },
  { id: 'keys', label: 'Lists and keys', title: 'Keys tell React which item is which', stage: BoardStage, frames: keyFrames },
  { id: 'state', label: 'State is a snapshot', title: 'Update, do not mutate', stage: BoardStage, frames: stateFrames },
];
