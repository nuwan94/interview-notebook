// Frame data for the "React core" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const REACT_SCENES = [
  {
    id: 'render',
    label: 'Render and commit',
    title: 'From a click to the screen',
    frames: [
      {
        note: 'A user clicks a button. The handler calls setCount(count + 1). That does not change the variable right away. It tells React that this component needs a new render with a new state, and React schedules it.',
        boxes: [b('c', 'Click event', ['user clicks +'], 'none'), b('s', 'setCount(count + 1)', ['asks for new state'], 'new'), b('r', 'React scheduler', ['batches the updates'], 'ok')],
        deps: [d('Click event', 'setCount(count + 1)', 'handler runs', 'ok'), d('setCount(count + 1)', 'React scheduler', 'queues a render', 'ok')],
      },
      {
        note: 'Render phase: React calls the component function again, with the new state. It returns a description of the UI, a tree of elements. Rendering must be pure: the same props and state give the same result, with no side effects.',
        boxes: [b('r', 'React scheduler', ['starts the render'], 'ok'), b('c', 'Counter component', ['runs again, count = 1'], 'new'), b('t', 'New element tree', ['a description of the UI'], 'ok')],
        deps: [d('React scheduler', 'Counter component', 'calls it', 'ok'), d('Counter component', 'New element tree', 'returns', 'ok')],
      },
      {
        note: 'Reconciliation: React compares the new tree with the previous one, element by element. Same type in the same place means update, a different type means replace. Here only the text changed from 0 to 1.',
        boxes: [b('p', 'Previous tree', ['count = 0'], 'none'), b('n', 'New element tree', ['count = 1'], 'ok'), b('d', 'Diff', ['only the text changed'], 'new')],
        deps: [d('Previous tree', 'Diff', 'compared with', 'ok'), d('New element tree', 'Diff', 'compared with', 'ok')],
      },
      {
        note: 'Commit phase: React applies only the difference to the real DOM, here one text node. The browser then paints. Effects added with useEffect run after the paint, so they never block what the user sees.',
        boxes: [b('d', 'Diff', ['one change'], 'ok'), b('m', 'DOM update', ['one text node'], 'new'), b('b', 'Browser paint', ['the screen updates'], 'ok'), b('e', 'Effects', ['run after the paint'], 'warn')],
        deps: [d('Diff', 'DOM update', 'commit', 'ok'), d('DOM update', 'Browser paint', 'then', 'ok'), d('Browser paint', 'Effects', 'then', 'warn')],
      },
    ],
  },
  {
    id: 'data',
    label: 'Props and state',
    title: 'Data flows down, events flow up',
    frames: [
      {
        note: 'Data flows one way, from parents to children, through props. The App component owns the filter text as state. It passes the value and a change handler to SearchBox and the filtered items to ProductList. Children only read their props.',
        boxes: [b('a', 'App', ['owns the state: filter'], 'new'), b('s', 'SearchBox', ['gets value and onChange'], 'ok'), b('l', 'ProductList', ['gets the filtered items'], 'ok')],
        deps: [d('App', 'SearchBox', 'props down', 'ok'), d('App', 'ProductList', 'props down', 'ok')],
      },
      {
        note: 'When the user types, SearchBox cannot change its props. It calls the onChange function it was given. That function runs setFilter in App, App renders again, and both children receive new props. Events go up, data comes down.',
        boxes: [b('s', 'SearchBox', ['calls onChange(text)'], 'new'), b('a', 'App', ['setFilter(text)'], 'ok'), b('l', 'ProductList', ['re-renders with new props'], 'ok')],
        deps: [d('SearchBox', 'App', 'event up', 'ok'), d('App', 'ProductList', 'new props down', 'ok')],
      },
      {
        note: 'When two components need the same state, move it up to their closest common parent and pass it down to both. This is lifting state up. Keep state as low as possible, and as high as needed.',
        boxes: [b('p', 'Common parent', ['holds the shared state'], 'new'), b('x', 'Sibling A', ['shows it'], 'ok'), b('y', 'Sibling B', ['changes it'], 'ok')],
        deps: [d('Common parent', 'Sibling A', 'props', 'ok'), d('Common parent', 'Sibling B', 'props and handler', 'ok'), d('Sibling B', 'Common parent', 'calls the handler', 'ok')],
      },
    ],
  },
  {
    id: 'keys',
    label: 'Lists and keys',
    title: 'Keys tell React which item is which',
    frames: [
      {
        note: 'A list is built by mapping an array to elements. Each element needs a key, a value that is unique among its siblings. React uses it to match items between renders. The best key is a stable id from the data.',
        boxes: [b('a', 'Array of items', ['id: 7, 8, 9'], 'none'), b('m', 'map to elements', ['key = item.id'], 'new'), b('l', 'List rows', ['one per item'], 'ok')],
        deps: [d('Array of items', 'map to elements', 'items.map', 'ok'), d('map to elements', 'List rows', 'returns', 'ok')],
      },
      {
        note: 'With stable keys, when the order changes React moves the existing rows instead of rebuilding them. Each row keeps its DOM node and its own state, such as text typed in an input, because React knows which row is which.',
        boxes: [b('o', 'Reordered array', ['9, 7, 8'], 'none'), b('k', 'Stable keys', ['7, 8, 9 matched by id'], 'ok'), b('r', 'Rows moved', ['state stays with each row'], 'ok')],
        deps: [d('Reordered array', 'Stable keys', 'matched by', 'ok'), d('Stable keys', 'Rows moved', 'moves, no rebuild', 'ok')],
      },
      {
        note: 'With the array index as the key, a new item added at the top shifts every index. React thinks the row at position 0 is the same row as before, so it keeps that row state. The text typed into the first input now appears on the wrong item.',
        boxes: [b('i', 'Index keys', ['key = position'], 'bad'), b('s', 'Input state', ['stays at position 0'], 'warn'), b('w', 'Wrong row', ['shows the old text'], 'bad')],
        deps: [d('Index keys', 'Input state', 'matches by position', 'bad'), d('Input state', 'Wrong row', 'attached to', 'bad')],
      },
      {
        note: 'A key is also a reset button. Changing the key of a component makes React throw the old one away and create a new one with fresh state. Giving a profile form key={userId} resets it whenever the user changes.',
        boxes: [b('u', 'New key', ['userId changed'], 'new'), b('o', 'Old form', ['unmounted'], 'bad'), b('f', 'Fresh form', ['mounted, empty state'], 'ok')],
        deps: [d('New key', 'Old form', 'removes', 'bad'), d('New key', 'Fresh form', 'creates', 'ok')],
      },
    ],
  },
  {
    id: 'state',
    label: 'State is a snapshot',
    title: 'Update, do not mutate',
    frames: [
      {
        note: 'Each render has its own snapshot of props and state. An event handler sees the values from the render it belongs to. After setCount(count + 1) the variable count in the same handler is still 0. The new value shows up in the next render.',
        boxes: [b('a', 'Render 1', ['count = 0'], 'ok'), b('h', 'Click handler', ['still sees count = 0'], 'warn'), b('b', 'Render 2', ['count = 1'], 'ok')],
        deps: [d('Render 1', 'Click handler', 'closes over', 'ok'), d('Click handler', 'Render 2', 'setCount triggers', 'ok')],
      },
      {
        note: 'Calling setCount(count + 1) three times uses the same snapshot, so the result is 1, not 3. Pass an updater function, setCount(c => c + 1), and React queues the calls and feeds each one the latest value, so the result is 3.',
        boxes: [b('x', 'setCount(count + 1) x3', ['same snapshot, result 1'], 'bad'), b('y', 'setCount(c => c + 1) x3', ['queued updates, result 3'], 'ok')],
        deps: [d('setCount(count + 1) x3', 'setCount(c => c + 1) x3', 'use the updater form', 'ok')],
      },
      {
        note: 'Never change state in place. items.push(x) changes the same array, so React sees the same reference and may skip the render, and other code holding that array sees the change. Create a new array: setItems([...items, x]).',
        boxes: [b('m', 'items.push(x)', ['same array reference'], 'bad'), b('s', 'No re-render', ['React sees no change'], 'bad'), b('n', 'setItems([...items, x])', ['a new array'], 'ok'), b('r', 'Re-render', ['the list updates'], 'ok')],
        deps: [d('items.push(x)', 'No re-render', 'bails out', 'bad'), d('setItems([...items, x])', 'Re-render', 'new reference', 'ok')],
      },
    ],
  },
];
