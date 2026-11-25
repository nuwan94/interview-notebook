// Frame data for the "Data structures" walk-through. Every scene brings its own picture:
// DsListStage (nodes and pointers), DsHashStage (bucket array and chains), DsTreeStage (a binary search tree)
// and DsGraphStage (a graph with the queue or call stack beside it). Tones: ok | bad | warn | new | none | dim.
import { DsListStage } from './DsListStage.jsx';
import { DsHashStage } from './DsHashStage.jsx';
import { DsTreeStage } from './DsTreeStage.jsx';
import { DsGraphStage } from './DsGraphStage.jsx';

// ---- linked list: made-up addresses show that the nodes are scattered in memory
const n = (id, v, addr, slot, next, extra = {}) => ({ id, v, addr, slot, next, ...extra });

// ---- the friends graph used for both traversals; laid out by distance from Alice so no edge crosses another
const GRAPH = {
  pos: { Alice: [52, 150], Bob: [166, 84], Carol: [166, 216], Dave: [286, 84], Erin: [286, 216], Frank: [396, 150] },
  edges: [['Alice', 'Bob'], ['Alice', 'Carol'], ['Bob', 'Dave'], ['Carol', 'Dave'], ['Carol', 'Erin'], ['Dave', 'Frank'], ['Erin', 'Frank']],
};
const g = (frame) => ({ graph: GRAPH, used: [], active: [], ...frame });

export const DATA_STRUCTURE_SCENES = [
  {
    id: 'list',
    label: 'Linked list',
    title: 'A linked list chains nodes with pointers',
    stage: DsListStage, // nodes with a value part and a next part, the head variable and the arrows between them
    frames: [
      {
        line: 'Node head = n10;',
        note: 'A linked list stores each value in a node. A node also holds a pointer to the next node. The list only knows its first node, called the head. There is no index: to reach the third value, you follow two pointers from the head.',
        head: 'a',
        nodes: [n('a', 10, '@7f3a', 1, 'b'), n('b', 20, '@21c4', 2, 'c'), n('c', 30, '@9e08', 3, null)],
      },
      {
        line: 'Node n5 = new Node(5, head);',
        note: 'To add 5 at the front, first create a new node whose next pointer is the current first node. Nothing else moves. In an array, adding at the front would shift every element one place to the right.',
        head: 'a',
        nodes: [n('n', 5, '@4b10', 0, 'a', { tone: 'new', tag: 'new node' }), n('a', 10, '@7f3a', 1, 'b'), n('b', 20, '@21c4', 2, 'c'), n('c', 30, '@9e08', 3, null)],
      },
      {
        line: 'head = n5;',
        result: { text: 'O(1): no element moved', tone: 'ok' },
        note: 'Then point the head at the new node. Adding at the front took two pointer changes, whatever the length of the list. That is O(1).',
        head: 'n',
        nodes: [n('n', 5, '@4b10', 0, 'a', { tone: 'ok' }), n('a', 10, '@7f3a', 1, 'b'), n('b', 20, '@21c4', 2, 'c'), n('c', 30, '@9e08', 3, null)],
      },
      {
        line: 'Node current = head;',
        note: 'Now search for 30. Start at the head. The value there is 5, which is not 30, so move on.',
        head: 'n',
        cursor: 'n',
        nodes: [n('n', 5, '@4b10', 0, 'a', { tone: 'warn', tag: '5 is not 30' }), n('a', 10, '@7f3a', 1, 'b'), n('b', 20, '@21c4', 2, 'c'), n('c', 30, '@9e08', 3, null)],
      },
      {
        line: 'current = current.next;',
        result: { text: 'found after 4 nodes: O(n)', tone: 'ok' },
        note: 'Follow the next pointers one at a time: 10, then 20, then 30, which matches. Searching is O(n). You cannot jump to the middle, so binary search does not work on a linked list, even a sorted one.',
        head: 'n',
        cursor: 'c',
        nodes: [
          n('n', 5, '@4b10', 0, 'a', { tone: 'warn' }),
          n('a', 10, '@7f3a', 1, 'b', { tone: 'warn', edgeTone: 'warn' }),
          n('b', 20, '@21c4', 2, 'c', { tone: 'warn', edgeTone: 'warn' }),
          n('c', 30, '@9e08', 3, null, { tone: 'ok', tag: 'found' }),
        ],
      },
      {
        line: 'n10.next = n10.next.next;',
        result: { text: 'O(1) once you hold Node 10', tone: 'ok' },
        note: 'To delete 20 when you already hold the node before it (10), change one pointer: 10 now points straight to 30. Node 20 is unlinked, and the garbage collector removes it later. A doubly linked list can also delete a node you hold directly, because each node knows its previous node. In Java, ArrayList is still usually faster than LinkedList, because array elements sit side by side in memory and linked nodes are scattered.',
        head: 'n',
        nodes: [
          n('n', 5, '@4b10', 0, 'a'),
          n('a', 10, '@7f3a', 1, 'c', { tone: 'ok', edgeTone: 'ok' }),
          n('b', 20, '@21c4', 2, 'c', { tone: 'bad', tag: 'unlinked', low: true }),
          n('c', 30, '@9e08', 3, null),
        ],
      },
    ],
  },
  {
    id: 'hash',
    label: 'Hash table',
    title: 'A hash table turns a key into a bucket number',
    stage: DsHashStage, // the key, the hash function, the bucket array and the chains below it
    frames: [
      {
        line: 'map.put("ACC-42", 800.00);',
        result: { text: 'bucket 3', tone: 'new' },
        note: 'A hash table finds an entry without searching. A hash function turns the key into a number. That number modulo the table size picks a bucket. Here the key "ACC-42" goes to bucket 3 of 8.',
        buckets: 8,
        key: { text: 'ACC-42', calc: 'hash(key) % 8 = 3', to: 3 },
        items: [{ k: 'ACC-08', v: '120.00', b: 0 }, { k: 'ACC-31', v: '75.50', b: 6 }],
      },
      {
        line: 'map.put("ACC-42", 800.00);',
        result: { text: 'O(1) on average', tone: 'ok' },
        note: 'The entry, the key with its value, is stored in bucket 3. To read it later, hash the key again, go straight to bucket 3 and compare the key. There is no loop over the other entries.',
        buckets: 8,
        key: { text: 'ACC-42', calc: 'hash(key) % 8 = 3', to: 3 },
        items: [{ k: 'ACC-08', v: '120.00', b: 0 }, { k: 'ACC-42', v: '800.00', b: 3, tone: 'ok', tag: 'stored' }, { k: 'ACC-31', v: '75.50', b: 6 }],
      },
      {
        line: 'map.put("ACC-17", 250.00);',
        result: { text: 'collision in bucket 3', tone: 'warn' },
        note: 'Two different keys can land in the same bucket. This is called a collision. "ACC-17" also goes to bucket 3. With chaining, the bucket holds a short list of entries. Java\'s HashMap works like this, and turns a long chain into a balanced tree.',
        buckets: 8,
        key: { text: 'ACC-17', calc: 'hash(key) % 8 = 3', to: 3, tone: 'warn' },
        items: [{ k: 'ACC-08', v: '120.00', b: 0 }, { k: 'ACC-42', v: '800.00', b: 3 }, { k: 'ACC-17', v: '250.00', b: 3, tone: 'new', tag: 'added to the chain' }, { k: 'ACC-31', v: '75.50', b: 6 }],
      },
      {
        line: 'map.get("ACC-17");',
        result: { text: 'found: 250.00', tone: 'ok' },
        note: 'To look up "ACC-17", hash it, go to bucket 3 and compare keys along the chain with equals. "ACC-42" does not match, and "ACC-17" does. This is why keys need a correct hashCode and equals. A poor hash function that puts many keys in one bucket makes lookups slow.',
        buckets: 8,
        key: { text: 'ACC-17', calc: 'hash(key) % 8 = 3', to: 3 },
        items: [{ k: 'ACC-08', v: '120.00', b: 0 }, { k: 'ACC-42', v: '800.00', b: 3, tone: 'bad', tag: 'equals? no' }, { k: 'ACC-17', v: '250.00', b: 3, tone: 'ok', tag: 'equals? yes' }, { k: 'ACC-31', v: '75.50', b: 6 }],
      },
      {
        line: 'size > 0.75 × capacity: resize to 16',
        result: { text: 'resized and rehashed', tone: 'ok' },
        note: 'When the table gets too full, chains grow long. The limit is the load factor, 0.75 by default in Java. The table is then resized, usually doubled, and every entry is placed again with hash % 16. Here "ACC-17" moves to bucket 11, so bucket 3 has no collision any more. Resizing is expensive but rare, so adding is O(1) on average.',
        buckets: 16,
        resize: {
          old: [{ k: 'ACC-08', b: 0 }, { k: 'ACC-42', b: 3, tone: 'warn' }, { k: 'ACC-17', b: 3, tone: 'warn' }, { k: 'ACC-55', b: 5 }, { k: 'ACC-31', b: 6 }, { k: 'ACC-90', b: 7 }],
          items: [{ k: 'ACC-08', b: 0 }, { k: 'ACC-42', b: 3, tone: 'ok' }, { k: 'ACC-31', b: 6 }, { k: 'ACC-90', b: 7 }, { k: 'ACC-17', b: 11, tone: 'ok' }, { k: 'ACC-55', b: 13 }],
          moves: [{ k: 'ACC-42', from: 3, to: 3 }, { k: 'ACC-17', from: 3, to: 11 }],
        },
      },
    ],
  },
  {
    id: 'tree',
    label: 'Binary search tree',
    title: 'A binary search tree keeps smaller values left and larger right',
    stage: DsTreeStage, // nodes placed by their path from the root
    frames: [
      {
        line: 'insert 50, 30, 70, 20, 40',
        note: 'In a binary search tree, every node has at most two children. Smaller values go to the left of a node, and larger values to the right. Here 50 is the root, 30 and 70 are its children, and 20 and 40 are below 30.',
        nodes: [{ id: 50, v: 50, path: '', tone: 'new', tag: 'root' }, { id: 30, v: 30, path: 'L' }, { id: 70, v: 70, path: 'R' }, { id: 20, v: 20, path: 'LL' }, { id: 40, v: 40, path: 'LR' }],
      },
      {
        line: 'search(40)',
        note: 'To search for 40, start at the root and compare. 40 is smaller than 50, so go left. The whole right side, 70 and everything under it, is ruled out in one step.',
        nodes: [{ id: 50, v: 50, path: '', tone: 'warn', tag: '40 < 50: go left' }, { id: 30, v: 30, path: 'L', tone: 'new', edge: 'warn' }, { id: 70, v: 70, path: 'R', tone: 'dim' }, { id: 20, v: 20, path: 'LL' }, { id: 40, v: 40, path: 'LR' }],
      },
      {
        line: 'search(40)',
        result: { text: 'found in 3 steps: O(log n)', tone: 'ok' },
        note: 'At 30, 40 is larger, so go right, and there it is. Each step throws away a whole subtree, like binary search. A balanced tree needs about log n steps.',
        nodes: [{ id: 50, v: 50, path: '', tone: 'warn' }, { id: 30, v: 30, path: 'L', tone: 'warn', tag: '40 > 30: go right', edge: 'warn' }, { id: 70, v: 70, path: 'R', tone: 'dim' }, { id: 20, v: 20, path: 'LL', tone: 'dim' }, { id: 40, v: 40, path: 'LR', tone: 'ok', tag: 'found', edge: 'warn' }],
      },
      {
        line: 'insert(45)',
        result: { text: 'O(log n) when balanced', tone: 'ok' },
        note: 'Inserting follows the same path until it falls off the tree. For 45: left at 50, right at 30, right at 40. There is no node there, so 45 becomes the right child of 40.',
        nodes: [{ id: 50, v: 50, path: '' }, { id: 30, v: 30, path: 'L', edge: 'new' }, { id: 70, v: 70, path: 'R' }, { id: 20, v: 20, path: 'LL' }, { id: 40, v: 40, path: 'LR', edge: 'new' }, { id: 45, v: 45, path: 'LRR', tone: 'new', tag: 'new leaf', edge: 'new' }],
      },
      {
        line: 'insert 1, 2, 3, 4',
        result: { text: 'height 4 for 4 nodes: O(n)', tone: 'bad' },
        note: 'The shape depends on the insert order. If values arrive already sorted, every new node goes to the right. The tree becomes a chain, which is really a linked list, and a search takes O(n). A plain binary search tree gives no guarantee on height.',
        nodes: [{ id: 1, v: 1, path: '', tone: 'bad', tag: 'a chain, not a tree' }, { id: 2, v: 2, path: 'R', tone: 'bad', edge: 'bad' }, { id: 3, v: 3, path: 'RR', tone: 'bad', edge: 'bad' }, { id: 4, v: 4, path: 'RRR', tone: 'bad', edge: 'bad' }],
      },
      {
        line: 'TreeMap: a red-black tree',
        result: { text: 'height 3: O(log n)', tone: 'ok' },
        note: 'Self-balancing trees, such as AVL trees and red-black trees, rotate nodes during inserts so the height stays near log n. Here 2 has become the root. Java\'s TreeMap and TreeSet are red-black trees, so get, put and remove are O(log n), and the keys stay sorted.',
        nodes: [{ id: 2, v: 2, path: '', tone: 'ok', tag: 'root after a rotation' }, { id: 1, v: 1, path: 'L', tone: 'ok' }, { id: 3, v: 3, path: 'R', tone: 'ok' }, { id: 4, v: 4, path: 'RR', tone: 'ok' }],
      },
    ],
  },
  {
    id: 'bfs',
    label: 'Breadth-first search',
    title: 'Breadth-first search visits the graph level by level',
    stage: DsGraphStage, // the graph, the queue and the visit order
    frames: [
      g({
        line: 'queue.offer(Alice);',
        mode: 'queue',
        note: 'A graph is a set of nodes joined by edges. Here the arrows show who can reach whom. Breadth-first search (BFS) starts at Alice and uses a queue: it visits everyone one step away, then two steps away, and so on. It starts by putting Alice in the queue.',
        nodes: { Alice: ['warn', 'in queue'] },
        list: ['Alice'],
        order: [],
      }),
      g({
        line: 'node = queue.poll();  // Alice',
        mode: 'queue',
        note: 'Take Alice from the front of the queue and visit her. Add her neighbours Bob and Carol to the back. Mark a node as seen when you add it, so a node reachable by two paths is queued only once.',
        nodes: { Alice: ['new', 'visiting'], Bob: ['warn', 'in queue'], Carol: ['warn', 'in queue'] },
        list: ['Bob', 'Carol'],
        order: ['Alice'],
        active: [['Alice', 'Bob'], ['Alice', 'Carol']],
      }),
      g({
        line: 'node = queue.poll();  // Bob',
        mode: 'queue',
        note: 'Take Bob from the front. His neighbour Dave goes to the back of the queue, behind Carol.',
        nodes: { Alice: ['ok', 'distance 0'], Bob: ['new', 'visiting'], Carol: ['warn', 'in queue'], Dave: ['warn', 'in queue'] },
        list: ['Carol', 'Dave'],
        order: ['Alice', 'Bob'],
        used: [['Alice', 'Bob'], ['Alice', 'Carol']],
        active: [['Bob', 'Dave']],
      }),
      g({
        line: 'node = queue.poll();  // Carol',
        mode: 'queue',
        note: 'Take Carol. Dave is already queued, so he is skipped. Erin is added. Everyone one step from Alice has now been visited, before anyone two steps away.',
        nodes: { Alice: ['ok', 'distance 0'], Bob: ['ok', 'distance 1'], Carol: ['new', 'visiting'], Dave: ['warn', 'in queue'], Erin: ['warn', 'in queue'] },
        list: ['Dave', 'Erin'],
        order: ['Alice', 'Bob', 'Carol'],
        used: [['Alice', 'Bob'], ['Alice', 'Carol'], ['Bob', 'Dave']],
        active: [['Carol', 'Erin']],
      }),
      g({
        line: 'node = queue.poll();  // Dave',
        mode: 'queue',
        note: 'Take Dave and add Frank to the queue.',
        nodes: { Alice: ['ok', 'distance 0'], Bob: ['ok', 'distance 1'], Carol: ['ok', 'distance 1'], Dave: ['new', 'visiting'], Erin: ['warn', 'in queue'], Frank: ['warn', 'in queue'] },
        list: ['Erin', 'Frank'],
        order: ['Alice', 'Bob', 'Carol', 'Dave'],
        used: [['Alice', 'Bob'], ['Alice', 'Carol'], ['Bob', 'Dave'], ['Carol', 'Erin']],
        active: [['Dave', 'Frank']],
      }),
      g({
        line: 'node = queue.poll();  // Erin',
        mode: 'queue',
        note: 'Take Erin. Frank can be reached from her too, but he is already queued, so he is not added again.',
        nodes: { Alice: ['ok', 'distance 0'], Bob: ['ok', 'distance 1'], Carol: ['ok', 'distance 1'], Dave: ['ok', 'distance 2'], Erin: ['new', 'visiting'], Frank: ['warn', 'in queue'] },
        list: ['Frank'],
        order: ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'],
        used: [['Alice', 'Bob'], ['Alice', 'Carol'], ['Bob', 'Dave'], ['Carol', 'Erin'], ['Dave', 'Frank']],
      }),
      g({
        line: 'node = queue.poll();  // Frank',
        result: { text: 'shortest paths found: O(V + E)', tone: 'ok' },
        note: 'Take Frank. The queue is empty, and every node was visited in order of distance from Alice. This is why BFS finds the shortest path when every edge counts the same: the first time it reaches a node is by the fewest steps. It takes O(V + E) time, for V nodes and E edges, plus memory for the queue.',
        mode: 'queue',
        nodes: { Alice: ['ok', 'distance 0'], Bob: ['ok', 'distance 1'], Carol: ['ok', 'distance 1'], Dave: ['ok', 'distance 2'], Erin: ['ok', 'distance 2'], Frank: ['ok', 'distance 3'] },
        list: [],
        order: ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank'],
        used: [['Alice', 'Bob'], ['Alice', 'Carol'], ['Bob', 'Dave'], ['Carol', 'Erin'], ['Dave', 'Frank']],
      }),
    ],
  },
  {
    id: 'dfs',
    label: 'Depth-first search',
    title: 'Depth-first search goes as deep as it can, then backs up',
    stage: DsGraphStage, // the graph, the call stack and the visit order
    frames: [
      g({
        line: 'dfs(Alice);',
        mode: 'stack',
        note: 'Depth-first search (DFS) uses a stack. Often that stack is the call stack, because DFS is written as a recursive method. Instead of going level by level, it follows one path as far as it can before it tries another.',
        nodes: { Alice: ['new', 'visiting'] },
        list: ['Alice'],
        order: ['Alice'],
      }),
      g({
        line: 'dfs(Bob);',
        mode: 'stack',
        note: 'From Alice, go to her first neighbour, Bob. The call for Bob goes on top of the stack. Alice waits underneath.',
        nodes: { Alice: ['warn', 'waiting'], Bob: ['new', 'visiting'] },
        list: ['Alice', 'Bob'],
        order: ['Alice', 'Bob'],
        active: [['Alice', 'Bob']],
      }),
      g({
        line: 'dfs(Dave);',
        mode: 'stack',
        note: 'From Bob, go deeper to Dave. Each step goes one level deeper before anything else is tried.',
        nodes: { Alice: ['warn', 'waiting'], Bob: ['warn', 'waiting'], Dave: ['new', 'visiting'] },
        list: ['Alice', 'Bob', 'Dave'],
        order: ['Alice', 'Bob', 'Dave'],
        used: [['Alice', 'Bob']],
        active: [['Bob', 'Dave']],
      }),
      g({
        line: 'dfs(Frank);',
        mode: 'stack',
        note: 'From Dave, go to Frank. Frank has no neighbours left to visit. He is a dead end, the deepest point of this path.',
        nodes: { Alice: ['warn', 'waiting'], Bob: ['warn', 'waiting'], Dave: ['warn', 'waiting'], Frank: ['new', 'dead end'] },
        list: ['Alice', 'Bob', 'Dave', 'Frank'],
        order: ['Alice', 'Bob', 'Dave', 'Frank'],
        used: [['Alice', 'Bob'], ['Bob', 'Dave']],
        active: [['Dave', 'Frank']],
      }),
      g({
        line: 'return;  return;  return;',
        mode: 'stack',
        note: 'Now the search backtracks. Backtracking is just returning from the recursive calls. Frank returns, Dave has nothing left, Bob has nothing left. We are back in Alice\'s call, and she still has an unvisited neighbour, Carol.',
        nodes: { Alice: ['new', 'back here'], Bob: ['ok', 'finished'], Dave: ['ok', 'finished'], Frank: ['ok', 'finished'] },
        list: ['Alice'],
        order: ['Alice', 'Bob', 'Dave', 'Frank'],
        used: [['Alice', 'Bob'], ['Bob', 'Dave'], ['Dave', 'Frank']],
      }),
      g({
        line: 'dfs(Carol);',
        mode: 'stack',
        note: 'Go to Carol. Her neighbour Dave is already visited, so he is skipped.',
        nodes: { Alice: ['warn', 'waiting'], Bob: ['ok', 'finished'], Carol: ['new', 'visiting'], Dave: ['ok', 'finished'], Frank: ['ok', 'finished'] },
        list: ['Alice', 'Carol'],
        order: ['Alice', 'Bob', 'Dave', 'Frank', 'Carol'],
        used: [['Alice', 'Bob'], ['Bob', 'Dave'], ['Dave', 'Frank']],
        active: [['Alice', 'Carol']],
      }),
      g({
        line: 'dfs(Erin);',
        result: { text: 'all visited: O(V + E)', tone: 'ok' },
        note: 'From Carol, go to Erin. Erin\'s neighbour Frank is already visited, so he is skipped too. Every node was visited once. DFS is also O(V + E). It suits detecting cycles, topological ordering, finding connected components and exploring all paths, but it does not find shortest paths.',
        mode: 'stack',
        nodes: { Alice: ['warn', 'waiting'], Bob: ['ok', 'finished'], Carol: ['warn', 'waiting'], Dave: ['ok', 'finished'], Erin: ['new', 'visiting'], Frank: ['ok', 'finished'] },
        list: ['Alice', 'Carol', 'Erin'],
        order: ['Alice', 'Bob', 'Dave', 'Frank', 'Carol', 'Erin'],
        used: [['Alice', 'Bob'], ['Bob', 'Dave'], ['Dave', 'Frank'], ['Alice', 'Carol']],
        active: [['Carol', 'Erin']],
      }),
    ],
  },
];
