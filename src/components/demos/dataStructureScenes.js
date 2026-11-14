// Frame data for the "Data structures" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

// the friends graph used for traversal: every frame shows all six people, only the tones change
const PEOPLE = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank'];
const EDGES = [d('Alice', 'Bob'), d('Alice', 'Carol'), d('Bob', 'Dave'), d('Carol', 'Dave'), d('Carol', 'Erin'), d('Dave', 'Frank'), d('Erin', 'Frank')];
// state: name -> [tone, line, badge]
const people = (state) => PEOPLE.map((n) => b(n, n, state[n] ? [state[n][1]] : ['not seen yet'], state[n]?.[0] || 'none', state[n]?.[2]));

export const DATA_STRUCTURE_SCENES = [
  {
    id: 'list',
    label: 'Linked list',
    title: 'A linked list chains nodes with pointers',
    frames: [
      {
        note: 'A linked list stores each value in a node together with a pointer to the next node. The list only knows its head. There is no index: to reach the third element you follow two pointers from the head.',
        boxes: [b('h', 'Head', ['points to the first node'], 'new'), b('a', 'Node 10', ['next to Node 20'], 'ok'), b('b', 'Node 20', ['next to Node 30'], 'ok'), b('c', 'Node 30', ['next is null'], 'ok', 'last')],
        deps: [d('Head', 'Node 10', 'head'), d('Node 10', 'Node 20', 'next'), d('Node 20', 'Node 30', 'next')],
      },
      {
        note: 'Adding at the front is O(1): create a node, point it at the old first node, and make the head point to it. No elements are moved, unlike an array, where inserting at the front shifts everything.',
        boxes: [b('h', 'Head', ['now points to Node 5'], 'new'), b('n', 'Node 5', ['new node'], 'new', 'inserted'), b('a', 'Node 10', [], 'ok'), b('b', 'Node 20', [], 'ok'), b('c', 'Node 30', [], 'ok')],
        deps: [d('Head', 'Node 5', 'head', 'new'), d('Node 5', 'Node 10', 'next', 'new'), d('Node 10', 'Node 20', 'next'), d('Node 20', 'Node 30', 'next')],
      },
      {
        note: 'Searching is O(n). To find 30 you start at the head and follow the pointers, comparing each node, until you reach it. Even if the list is sorted, you cannot jump to the middle, so binary search does not work on a linked list.',
        boxes: [b('h', 'Head', [], 'none'), b('n', 'Node 5', ['5 is not 30'], 'warn', 'checked'), b('a', 'Node 10', ['10 is not 30'], 'warn', 'checked'), b('b', 'Node 20', ['20 is not 30'], 'warn', 'checked'), b('c', 'Node 30', ['found'], 'ok', 'found')],
        deps: [d('Head', 'Node 5', 'head'), d('Node 5', 'Node 10', 'next', 'warn'), d('Node 10', 'Node 20', 'next', 'warn'), d('Node 20', 'Node 30', 'next', 'warn')],
      },
      {
        note: 'Deleting a node you already hold is O(1) in a doubly linked list: make its neighbours point to each other. Here Node 10 skips Node 20 and points to Node 30 directly. Finding the node in the first place is still O(n). In Java, LinkedList is rarely faster than ArrayList in practice, because array elements sit together in memory and linked nodes are scattered.',
        boxes: [b('a', 'Node 10', ['next is now Node 30'], 'ok'), b('b', 'Node 20', ['unlinked'], 'bad', 'removed'), b('c', 'Node 30', [], 'ok')],
        deps: [d('Node 10', 'Node 30', 'next', 'ok')],
      },
    ],
  },
  {
    id: 'hash',
    label: 'Hash table',
    title: 'A hash table turns a key into a bucket number',
    frames: [
      {
        note: 'A hash table finds an entry without searching. A hash function turns the key into a number, and the number modulo the table size picks a bucket. Here "ACC-42" hashes to bucket 3 of 8.',
        boxes: [b('k', 'Key ACC-42', ['an account id'], 'new'), b('f', 'Hash function', ['hash(key) % 8 = 3'], 'ok'), b('u', 'Bucket 3', ['empty'], 'none')],
        deps: [d('Key ACC-42', 'Hash function', 'hash'), d('Hash function', 'Bucket 3', 'index 3')],
      },
      {
        note: 'The entry (key and value) is stored in bucket 3. To read it later, hash the key again, go straight to bucket 3 and compare the key. That is O(1) on average, with no loop over the other entries.',
        boxes: [b('f', 'Hash function', ['hash(key) % 8 = 3'], 'ok'), b('u', 'Bucket 3', ['holds entries'], 'ok'), b('e', 'Entry ACC-42', ['balance 800.00'], 'ok', 'stored')],
        deps: [d('Hash function', 'Bucket 3', 'index 3'), d('Bucket 3', 'Entry ACC-42', 'entry')],
      },
      {
        note: 'Two different keys can hash to the same bucket, called a collision. ACC-17 also maps to bucket 3. With chaining, the bucket holds a small list of entries. Java\'s HashMap does this, and turns long chains into balanced trees.',
        boxes: [b('u', 'Bucket 3', ['two entries'], 'warn', 'collision'), b('e', 'Entry ACC-42', ['first in the chain'], 'ok'), b('g', 'Entry ACC-17', ['added to the chain'], 'new')],
        deps: [d('Bucket 3', 'Entry ACC-42', 'first'), d('Entry ACC-42', 'Entry ACC-17', 'next', 'new')],
      },
      {
        note: 'To look up ACC-17, hash it, go to bucket 3, and compare keys along the chain using equals. ACC-42 does not match, ACC-17 does. This is why keys need a correct hashCode and equals, and why a poor hash function that fills one bucket makes lookups slow.',
        boxes: [b('u', 'Bucket 3', ['look up ACC-17'], 'new'), b('e', 'Entry ACC-42', ['not equal'], 'bad', 'skipped'), b('g', 'Entry ACC-17', ['equal: found'], 'ok', 'found')],
        deps: [d('Bucket 3', 'Entry ACC-42', 'first'), d('Entry ACC-42', 'Entry ACC-17', 'next', 'ok')],
      },
      {
        note: 'When the table gets too full (the load factor, 0.75 by default in Java), chains grow long. The table is resized, usually doubled, and every entry is rehashed into the new buckets. Resizing is expensive but rare, so adding is O(1) on average.',
        boxes: [b('o', 'Old table', ['8 buckets, 75 percent full'], 'warn', 'too full'), b('n', 'New table', ['16 buckets'], 'ok', 'resized')],
        deps: [d('Old table', 'New table', 'rehash every entry', 'ok')],
      },
    ],
  },
  {
    id: 'tree',
    label: 'Binary search tree',
    title: 'A binary search tree keeps smaller values left and larger right',
    frames: [
      {
        note: 'In a binary search tree every node has at most two children. Values smaller than a node go to its left, larger values to its right. Here 50 is the root, 30 and 70 are its children, and 20 and 40 are below 30.',
        boxes: [b('a', 'Node 50', ['root'], 'new'), b('b', 'Node 30', ['smaller than 50'], 'ok'), b('c', 'Node 70', ['larger than 50'], 'ok'), b('d', 'Node 20', [], 'ok'), b('e', 'Node 40', [], 'ok')],
        deps: [d('Node 50', 'Node 30', 'left'), d('Node 50', 'Node 70', 'right'), d('Node 30', 'Node 20', 'left'), d('Node 30', 'Node 40', 'right')],
      },
      {
        note: 'To search for 40, compare with the root: 40 is smaller than 50, so go left. At 30, 40 is larger, so go right. Found after three steps. Each step discards a whole subtree, like binary search, so a balanced tree needs about log n steps.',
        boxes: [b('a', 'Node 50', ['40 is smaller: go left'], 'warn', 'checked'), b('b', 'Node 30', ['40 is larger: go right'], 'warn', 'checked'), b('c', 'Node 70', ['never visited'], 'none'), b('d', 'Node 20', ['never visited'], 'none'), b('e', 'Node 40', ['found'], 'ok', 'found')],
        deps: [d('Node 50', 'Node 30', 'left', 'warn'), d('Node 50', 'Node 70', 'right'), d('Node 30', 'Node 20', 'left'), d('Node 30', 'Node 40', 'right', 'warn')],
      },
      {
        note: 'Insertion follows the same path until it falls off the tree. Inserting 45 goes 50, then left to 30, then right to 40, then right again, where there is no node, so 45 becomes the right child of 40. Insert is O(log n) when the tree is balanced.',
        boxes: [b('a', 'Node 50', [], 'ok'), b('b', 'Node 30', [], 'ok'), b('e', 'Node 40', ['has a new child'], 'ok'), b('n', 'Node 45', ['new leaf'], 'new', 'inserted')],
        deps: [d('Node 50', 'Node 30', 'left'), d('Node 30', 'Node 40', 'right'), d('Node 40', 'Node 45', 'right', 'new')],
      },
      {
        note: 'The shape depends on the insert order. If values arrive already sorted (1, 2, 3, 4), every new node goes to the right and the tree becomes a chain, which is a linked list. Search then takes O(n). Plain binary search trees give no guarantee on height.',
        boxes: [b('a', 'Node 1', ['root'], 'bad'), b('b', 'Node 2', [], 'bad'), b('c', 'Node 3', [], 'bad'), b('d', 'Node 4', ['height 4 for 4 nodes'], 'bad', 'degenerate')],
        deps: [d('Node 1', 'Node 2', 'right', 'bad'), d('Node 2', 'Node 3', 'right', 'bad'), d('Node 3', 'Node 4', 'right', 'bad')],
      },
      {
        note: 'Self-balancing trees, such as AVL and red-black trees, rotate nodes during inserts so the height stays around log n. Java\'s TreeMap and TreeSet are red-black trees, so get, put and remove are O(log n) and the keys stay sorted.',
        boxes: [b('b', 'Node 2', ['root after rotation'], 'ok', 'balanced'), b('a', 'Node 1', [], 'ok'), b('c', 'Node 3', [], 'ok'), b('d', 'Node 4', [], 'ok')],
        deps: [d('Node 2', 'Node 1', 'left', 'ok'), d('Node 2', 'Node 3', 'right', 'ok'), d('Node 3', 'Node 4', 'right', 'ok')],
      },
    ],
  },
  {
    id: 'bfs',
    label: 'Breadth-first search',
    title: 'Breadth-first search visits the graph level by level',
    frames: [
      {
        note: 'A graph is nodes connected by edges. Here the arrows show who can reach whom. Breadth-first search (BFS) starts at Alice and uses a queue: it visits all neighbours at distance one, then distance two, and so on.',
        boxes: people({ Alice: ['new', 'start here', 'start'] }),
        deps: EDGES,
      },
      {
        note: 'Visit Alice and add her unvisited neighbours, Bob and Carol, to the queue. Mark nodes as visited when you add them, so a node reachable by two paths is queued only once. The queue is now: Bob, Carol.',
        boxes: people({ Alice: ['ok', 'visited 1st'], Bob: ['warn', 'in the queue'], Carol: ['warn', 'in the queue'] }),
        deps: EDGES,
      },
      {
        note: 'Take Bob from the front of the queue and visit him; queue his neighbour Dave. Then visit Carol and queue Erin (Dave is already queued). All nodes one step from Alice have been visited before any node two steps away.',
        boxes: people({ Alice: ['ok', 'visited 1st'], Bob: ['ok', 'visited 2nd'], Carol: ['ok', 'visited 3rd'], Dave: ['warn', 'in the queue'], Erin: ['warn', 'in the queue'] }),
        deps: EDGES,
      },
      {
        note: 'Visit Dave and Erin, and queue Frank, who is reachable from both but queued only once. The queue is now just Frank.',
        boxes: people({ Alice: ['ok', 'visited 1st'], Bob: ['ok', 'visited 2nd'], Carol: ['ok', 'visited 3rd'], Dave: ['ok', 'visited 4th'], Erin: ['ok', 'visited 5th'], Frank: ['warn', 'in the queue'] }),
        deps: EDGES,
      },
      {
        note: 'Visit Frank. Every node has been visited in order of distance from Alice. This is why BFS finds the shortest path in a graph where every edge counts the same: the first time you reach a node is by the fewest steps. It takes O(V + E) time, for V nodes and E edges, and memory for the queue.',
        boxes: people({ Alice: ['ok', 'distance 0'], Bob: ['ok', 'distance 1'], Carol: ['ok', 'distance 1'], Dave: ['ok', 'distance 2'], Erin: ['ok', 'distance 2'], Frank: ['ok', 'distance 3', 'last'] }),
        deps: EDGES,
      },
    ],
  },
  {
    id: 'dfs',
    label: 'Depth-first search',
    title: 'Depth-first search goes as deep as it can, then backs up',
    frames: [
      {
        note: 'Depth-first search (DFS) uses a stack, or recursion, which is a stack in disguise. Instead of visiting neighbours level by level, it follows one path as far as it can before trying another.',
        boxes: people({ Alice: ['new', 'start here', 'start'] }),
        deps: EDGES,
      },
      {
        note: 'From Alice go to Bob, then to Dave, then to Frank, which has no unvisited neighbours. Each step goes one level deeper before anything else is tried.',
        boxes: people({ Alice: ['ok', 'visited 1st'], Bob: ['ok', 'visited 2nd'], Dave: ['ok', 'visited 3rd'], Frank: ['new', 'visited 4th, dead end', 'deepest'] }),
        deps: EDGES,
      },
      {
        note: 'Frank is a dead end, so the search backtracks: up to Dave (nothing left), up to Bob (nothing left), and back to Alice, who still has an unvisited neighbour, Carol. Backtracking is just returning from the recursive calls.',
        boxes: people({ Alice: ['ok', 'visited 1st'], Bob: ['ok', 'visited 2nd'], Dave: ['ok', 'visited 3rd'], Frank: ['ok', 'visited 4th'], Carol: ['new', 'visited 5th', 'backtracked'] }),
        deps: EDGES,
      },
      {
        note: 'From Carol go to Erin. Erin\'s neighbour Frank is already visited, so it is skipped. Every node has been visited once. DFS is also O(V + E). It suits detecting cycles, topological ordering, finding connected components and exploring all paths, but it does not find shortest paths.',
        boxes: people({ Alice: ['ok', 'visited 1st'], Bob: ['ok', 'visited 2nd'], Dave: ['ok', 'visited 3rd'], Frank: ['ok', 'visited 4th'], Carol: ['ok', 'visited 5th'], Erin: ['ok', 'visited 6th', 'last'] }),
        deps: EDGES,
      },
    ],
  },
];
