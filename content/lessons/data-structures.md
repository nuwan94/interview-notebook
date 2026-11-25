---
title: Data structures and Big-O — arrays, lists, stacks, hash tables, trees and graphs
nav: Data structures and Big-O
slug: data-structures
summary: The data structures every interview assumes: Big-O and amortised cost, arrays and ArrayList, linked lists, stacks and queues, hash tables, binary search trees and heaps, tries, and graphs with BFS and DFS, plus how to choose a structure and which Java class implements it, with Java code and interview questions.
tags: [Data structures, Big-O, Algorithms, Arrays, Linked list, Hash table, Tree, Heap, Graph, Java]
order: 4
topic: Fundamentals / Data structures and algorithms
updated: 2026-11-24
subnav: true
---

Almost every coding interview uses a few basic data structures. Almost every design discussion is about their trade-offs. Typical questions:

- Why is an `ArrayList` usually faster than a `LinkedList`?
- How does a `HashMap` find a key without searching?
- What is a heap for?
- How do you find the shortest path?
- What does O(n log n) mean?

This lesson explains each structure, shows how it behaves and names the Java class that implements it.

Related lessons: it leads into [sorting and searching](lesson:sorting-searching) and [coding patterns](lesson:coding-patterns). The Java API lessons on [collections](lesson:java-collections), [HashMap](lesson:java-hashmap) and [concurrent collections](lesson:java-concurrent-collections) go deeper into the Java classes.

The animation has five scenes: a linked list, a hash table, a binary search tree, breadth-first search and depth-first search.

```demo
name: data-structure-walk
```

> **One sentence to remember:** *Pick the structure that makes your most frequent operation cheap.*

## Big-O in plain words {#bigo}

**Big-O** describes how the time or memory a piece of code needs **grows with the input size n**. It ignores constant factors and small terms. It answers the question "what happens when the data gets 1000 times bigger?".

| Complexity | Name | Example | Steps for n = 1,000,000 |
| --- | --- | --- | --- |
| O(1) | constant | Reading an array by index. A `HashMap` get, on average. | 1 step |
| O(log n) | logarithmic | Binary search. A lookup in a balanced tree. | About 20 steps |
| O(n) | linear | Scanning a list. Adding up an array. | 1 million steps |
| O(n log n) | linearithmic | A good sort, such as merge sort or TimSort. | About 20 million steps |
| O(n²) | quadratic | Two nested loops over the same data. Bubble sort. | 1 trillion steps, which is too slow |
| O(2ⁿ) | exponential | Trying every subset. | Impossible once n is above about 40 |

How to work out the Big-O of code:

- **One loop over n items is O(n).** Two nested loops over n items are O(n²). A loop that halves the range each time is O(log n).
- **Steps done one after another add up.** Then you keep only the biggest term.
- **Drop constants and smaller terms.** 3n + 10 is O(n), and n² + n is O(n²).
- **Usually give the worst case.** Say so when you mean the average or the best case.
- **Space complexity** counts extra memory in the same way. The depth of a recursion counts too, because each call uses stack memory.
- **Amortised cost** spreads an occasional expensive step over many cheap ones. `ArrayList.add` is O(1) amortised. Usually it is a single write. About once per doubling it copies the whole array, which is O(n). Averaged over all the adds, the cost per add is constant. `HashMap.put` is O(1) amortised for the same reason: it sometimes resizes.
- **Big-O is about growth, not speed.** For small n, a "worse" algorithm can win because its constant work is smaller or it uses memory better. Measure with real data before you optimise.

## Arrays and ArrayList {#arrays}

An **array** is one block of memory with a fixed number of slots, side by side. Every slot has the same size, so Java finds slot `i` with simple arithmetic. That makes **access by index O(1)**.

- Inserting or deleting in the middle shifts all the later elements, so it is **O(n)**.
- Searching an unsorted array is O(n). Searching a sorted array is O(log n) with [binary search](lesson:sorting-searching).
- The size is fixed. To grow, you must create a new, larger array and copy the elements.

`ArrayList` wraps an array that grows by about 1.5 times when it is full.

- `get(i)` is O(1).
- `add` at the end is O(1) amortised.
- `add(0, x)` and `remove(0)` are O(n), because everything shifts.

The elements sit next to each other in memory. This is **cache friendly**: the CPU loads several neighbours at once. It is the main reason `ArrayList` beats `LinkedList` in practice.

A **two-dimensional array** (`int[rows][cols]`) models a grid or a matrix.

## Linked lists {#lists}

A **linked list** is a chain of nodes. Each node holds a value and a pointer to the next node. In a **doubly linked list**, each node also points to the previous node. There is no index: to reach element i, you follow i pointers from the start.

| Operation | Singly linked list | Array or ArrayList |
| --- | --- | --- |
| Access by index | O(n) | O(1) |
| Insert or delete at the front | O(1) | O(n) |
| Insert or delete after a node you already hold | O(1) | O(n) |
| Search | O(n) | O(n) |
| Memory per element | The value plus one or two pointers. The nodes are scattered in memory. | Only the value. The elements sit side by side. |

Linked lists appear in interviews for two reasons:

- **Pointer exercises.** Reverse a list, find the middle with a fast and a slow pointer, or detect a cycle.
- **Building blocks.** Other structures use them inside, such as `LinkedHashMap` and queues.

In everyday Java, prefer `ArrayList` or `ArrayDeque`. `LinkedList` is rarely the best choice.

## Stacks and queues {#stack-queue}

A **stack** is **last in, first out** (LIFO). You `push` onto the top, `pop` from the top and `peek` at the top. Uses: undo, the call stack, matching brackets, evaluating expressions and depth-first search.

A **queue** is **first in, first out** (FIFO). You `offer` at the back, `poll` from the front and `peek` at the front. Uses: task scheduling, buffering and breadth-first search.

A **deque** (double-ended queue) lets you add and remove at both ends.

In Java, use **`ArrayDeque`** for both. Call `push` and `pop` for a stack, and `offer` and `poll` for a queue. All these operations are O(1). The old `Stack` class is synchronised and kept only for old code.

- Code shared between threads uses a `BlockingQueue` (see [concurrent collections](lesson:java-concurrent-collections)).
- A **priority queue** (`PriorityQueue`) always hands out the smallest element first, or the highest priority one when you give it a comparator. It is built on a heap, which is explained below.

## Hash tables {#hash}

A **hash table** maps keys to values. Get, put and remove are **O(1) on average**.

1. A **hash function** turns the key into an integer.
2. That integer picks a **bucket**, a slot in an internal array.
3. The entry is stored in that bucket.

Two different keys can land in the same bucket. This is called a **collision**. Java's `HashMap` keeps a short list of entries in each bucket. When a list gets long, it turns it into a balanced tree, so the worst case is O(log n) instead of O(n).

The **load factor** says how full the table may get, 0.75 by default. When the number of entries passes load factor × capacity, the table **resizes**: it creates a bigger array and puts every entry into its new bucket (rehashing).

For a key to work, its **`hashCode` and `equals` must agree**. Equal objects must have equal hash codes. A key must also not change while it is in the map.

Related classes:

- `HashSet` is a `HashMap` that uses only the keys.
- `LinkedHashMap` also remembers the insertion order or the access order. It is the base of an LRU cache.
- `TreeMap` keeps the keys sorted, with O(log n) operations.
- `ConcurrentHashMap` is safe to use from many threads.

See [HashMap internals](lesson:java-hashmap) for the details.

Typical uses:

- Counting how often each value appears (a frequency map).
- Removing duplicates.
- Caching.
- Finding records by id.
- Turning an O(n²) nested search into O(n) by remembering what you have already seen. This is the **two-sum** trick.

## Trees and heaps {#trees}

A **tree** is a connected structure with no cycles. It has one **root**, and every node can have **children**. A **binary tree** has at most two children per node.

**Binary search tree (BST).** Smaller values go to the left of a node and larger values to the right. Search, insert and delete follow one path down from the root, so they cost O(height).

- In a balanced tree, the height is about log n.
- If values arrive already sorted, the tree becomes a chain, and the cost becomes O(n).
- **Self-balancing** trees, such as AVL trees and red-black trees, rotate nodes to keep the height near log n.
- Java's `TreeMap` and `TreeSet` are red-black trees. They keep keys sorted, cost O(log n) per operation and support ranges (`subMap`, `floor`, `ceiling`).

**Traversals** are the standard orders for visiting every node:

- **In-order** (left, node, right) visits a BST in sorted order.
- **Pre-order** (the node first) is used to copy a tree.
- **Post-order** (the children first) is used to delete a tree or to evaluate an expression.
- **Level-order** uses a queue and visits one level at a time. It is breadth-first search.

**Heap.** A heap is a complete binary tree stored in an array. In a **min-heap**, each parent is no larger than its children. So the smallest element is always at the top.

- `peek` is O(1). `offer` and `poll` are O(log n).
- It powers `PriorityQueue`, top-k problems, schedulers and Dijkstra's algorithm.
- A heap is **not** sorted as a whole. Only the top element is guaranteed.

**Trie (prefix tree).** Each node is a character, and a path from the root spells a word. Finding all words with a given prefix takes O(length of the prefix). Tries are used for autocomplete and dictionaries.

**B-tree and B+ tree.** These are wide, shallow, balanced trees designed for disk pages. Database indexes use them. A lookup needs only a few page reads, even for billions of rows (see [SQL vs NoSQL](lesson:sql-vs-nosql)).

## Graphs {#graphs}

A **graph** is a set of nodes (also called vertices) connected by edges. Edges can be **directed** (one way) or **undirected** (both ways), and **weighted** (they carry a cost) or not.

Graphs model networks, maps, dependencies and relationships. Examples: accounts and the transfers between them, services that call other services, and build dependencies.

**How to store a graph:**

- An **adjacency list** is a map from each node to the list of its neighbours. It uses O(V + E) memory, for V nodes and E edges. It suits sparse graphs (few edges per node), and most real graphs are sparse.
- An **adjacency matrix** is a V × V array of true or false values. Checking one edge is O(1), but it uses O(V²) memory.

**Traversals.** Both cost O(V + E).

- **Breadth-first search (BFS)** uses a **queue** and visits the graph level by level. It finds the **shortest path in an unweighted graph**, meaning the path with the fewest edges.
- **Depth-first search (DFS)** uses a **stack or recursion** and goes as deep as it can before it backs up. It suits cycle detection, finding connected components, topological sort and exploring all paths.

Always keep a **visited** set. Without it, a cycle makes the search loop forever.

Other graph algorithms worth naming:

- **Dijkstra** finds the shortest path when the edge weights are not negative. It uses a priority queue and costs O((V + E) log V).
- **Topological sort** orders tasks so that each task comes after the tasks it depends on. It works only for directed graphs without cycles.
- **Union-find** (disjoint sets) groups items and tests whether two items are connected, in nearly O(1).

## Choosing a structure {#choosing}

| You need | Use | Java class | Cost |
| --- | --- | --- | --- |
| Fast access by position | An array or a list | `ArrayList`, `int[]` | get is O(1) |
| Fast lookup by key | A hash table | `HashMap`, `HashSet` | O(1) on average |
| Keys kept sorted, with ranges, floor and ceiling | A balanced tree | `TreeMap`, `TreeSet` | O(log n) |
| Insertion order kept, plus lookup by key | A hash table plus a linked list | `LinkedHashMap` | O(1) |
| Processing in arrival order | A queue | `ArrayDeque` | O(1) |
| Processing the last item first | A stack | `ArrayDeque` | O(1) |
| Always the smallest or highest priority item next | A heap | `PriorityQueue` | poll is O(log n) |
| Prefix search | A trie | Your own class, or a library | O(length) |
| Relationships and paths | A graph | `Map<Node, List<Node>>` | BFS or DFS is O(V + E) |
| A membership test on huge data, where a few false positives are allowed | A Bloom filter | Guava | O(1), with very little memory |

Try it in the lab: [An LRU cache: hash map plus linked list](lab:ds-lru-cache).

## Cheat sheet {#cheatsheet}

| Structure | Access | Search | Insert | Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Array | O(1) | O(n) | O(n) | O(n) | Side by side in memory, cache friendly. |
| ArrayList | O(1) | O(n) | O(1) amortised at the end | O(n) | Grows by copying. |
| Linked list | O(n) | O(n) | O(1) at a node you hold | O(1) at a node you hold | No index. |
| Stack, queue (ArrayDeque) | O(1) at the ends | O(n) | O(1) | O(1) | Order of processing. |
| HashMap | Not applicable | O(1) average | O(1) average | O(1) average | No order. |
| TreeMap | Not applicable | O(log n) | O(log n) | O(log n) | Sorted. |
| PriorityQueue | peek is O(1) | O(n) | O(log n) | O(log n) | Only the top is the smallest. |
| Graph (adjacency list) | Not applicable | BFS or DFS O(V + E) | O(1) to add an edge | O(degree) | Sparse graphs. |

## Interview questions {#questions}

### [basic] What is Big-O notation? {#bigo-q}

It describes how the time or memory of an algorithm grows with the input size n.

- It ignores constant factors and smaller terms.
- O(1) is constant, O(log n) is logarithmic, O(n) is linear, O(n log n) is typical for a good sort, and O(n²) is quadratic.
- It tells you how an algorithm scales, and lets you compare approaches. It does not tell you how fast the code runs on a given machine.

### [basic] What is the difference between an array and a linked list? {#array-vs-list-q}

**An array keeps elements side by side. A linked list chains separate nodes with pointers.**

- **Array:** index access is O(1) and it is cache friendly. Inserting or deleting in the middle is O(n), and the size is fixed.
- **Linked list:** inserting or deleting at a node you hold is O(1). Reaching an element needs an O(n) walk, and each node costs extra memory for its pointers.

In practice, `ArrayList` is usually faster.

### [basic] What is a stack and what is a queue? {#stack-queue-q}

- A **stack** is last in, first out. You push and pop at the same end. It is used for undo, the call stack, bracket matching and DFS.
- A **queue** is first in, first out. You add at the back and remove from the front. It is used for scheduling, buffering and BFS.

In Java, `ArrayDeque` is the best class for both, and its operations are O(1).

### [basic] How does a HashMap work? {#hashmap-q}

It stores each entry in a bucket chosen by the key's hash code.

1. It computes the key's hash code and turns it into a bucket index.
2. It stores the entry in that bucket.
3. A lookup computes the same hash, goes to the same bucket and compares keys with `equals`.
4. Collisions are handled by keeping several entries in one bucket. This starts as a linked list and becomes a balanced tree when it gets long.
5. When the table passes the load factor (0.75), it doubles its size and rehashes every entry.

Get and put are O(1) on average.

### [basic] What is the difference between a HashMap and a TreeMap? {#hashmap-vs-treemap-q}

**A `HashMap` has no order and is O(1). A `TreeMap` keeps keys sorted and is O(log n).**

- `HashMap` needs a good `hashCode` and `equals` on the key.
- `TreeMap` sorts keys by their natural order or by a comparator. It adds extras such as `firstKey`, `floorKey` and range views.

Use `HashMap` for plain lookups. Use `TreeMap` when you need order or ranges.

### [intermediate] Why must `hashCode` and `equals` be consistent for hash keys? {#hashcode-q}

**Because otherwise the map cannot find the entry again.**

- If two equal keys had different hash codes, the lookup would go to a different bucket and miss the entry.
- If a key changes after it is stored, its hash code changes, and the entry is lost in the same way.

So override both methods together, base them on the same fields that never change, and prefer immutable keys such as strings, records and value objects.

### [intermediate] What is amortised complexity? Give an example. {#amortised-q}

It is the average cost per operation over a long run of operations, when only an occasional one is expensive.

Example: appending to an `ArrayList`.

- Most appends are O(1).
- When the internal array is full, it is copied into a larger one, which is O(n).
- The capacity grows by a fixed factor each time, so copies get rarer as the list grows. The total cost of n appends is O(n), so each append is O(1) amortised.

`HashMap` resizing follows the same reasoning.

### [intermediate] What is a binary search tree and why does balance matter? {#bst-q}

A binary search tree keeps smaller values in the left subtree of each node and larger values in the right subtree.

- Search, insert and delete follow one path from the root, so they cost O(height).
- If the tree is balanced, the height is about log n.
- If values are inserted in sorted order, the tree becomes a chain, like a linked list, and every operation becomes O(n).

Self-balancing trees, such as red-black trees, keep the height logarithmic. `TreeMap` uses a red-black tree.

### [intermediate] What is a heap and what is it used for? {#heap-q}

A heap is a complete binary tree, stored in an array, where the top element is always the smallest (min-heap) or the largest (max-heap).

- In a min-heap each parent is smaller than its children. In a max-heap each parent is larger.
- peek is O(1). Insert and remove are O(log n).
- It implements `PriorityQueue`. It is used for top-k problems, task scheduling, merging sorted lists and Dijkstra's algorithm.

A heap is not fully sorted. Only the top is guaranteed.

### [intermediate] What are the tree traversals and when do you use each? {#traversal-q}

- **In-order** (left, node, right) visits a binary search tree in sorted order.
- **Pre-order** (node, left, right) is used to copy or serialise a tree.
- **Post-order** (left, right, node) is used to delete a tree or to evaluate an expression.
- **Level-order** uses a queue and visits one level at a time. Use it, for example, to find the depth or to print the tree level by level.

### [intermediate] BFS or DFS: how do you choose? {#bfs-dfs-q}

**Use BFS for shortest paths. Use DFS to explore paths and structure.**

- **BFS** uses a queue. Use it for the shortest path in an unweighted graph, or to explore by distance. Its memory grows with the widest level.
- **DFS** uses a stack or recursion. Use it to explore all paths, detect cycles, find connected components or do a topological sort. Its memory grows with the depth.

Both are O(V + E), and both need a visited set.

### [intermediate] How do you represent a graph in code? {#graph-repr-q}

**Usually as an adjacency list.**

- An **adjacency list** is a `Map<Node, List<Node>>`, or an array of lists. It uses O(V + E) memory and makes it fast to loop over a node's neighbours. It suits sparse graphs.
- An **adjacency matrix** is a V by V array. Checking one edge is O(1), but it uses O(V²) memory. It suits dense graphs or a small number of nodes.

For a weighted graph, the list holds (neighbour, weight) pairs.

### [intermediate] Why is ArrayList usually faster than LinkedList in practice? {#arraylist-vs-linkedlist-q}

**Because of memory layout.**

1. Array elements sit side by side in memory. The CPU cache loads several of them at once, and index access is O(1).
2. `LinkedList` nodes are separate objects, scattered in memory, each with extra pointers. Walking through them causes cache misses and uses more memory.
3. Even an insert in the middle of a `LinkedList` first needs an O(n) walk to reach the position.

`LinkedList` wins mainly when you already hold a node. For queue-like use, `ArrayDeque` is usually better anyway.

### [deep] How does Java's HashMap handle many collisions? {#collisions-q}

It turns a long bucket list into a red-black tree.

- Each bucket starts as a linked list.
- When a bucket reaches 8 entries and the table has at least 64 buckets, the list becomes a red-black tree. The worst-case lookup in that bucket is then O(log n) instead of O(n).
- If the table is smaller than 64 buckets, it is resized instead.

This protects against poor hash functions and against deliberate hash-collision attacks.

### [deep] How does Dijkstra's algorithm find the shortest path? {#dijkstra-q}

It always finishes the closest unfinished node next.

1. It keeps the best known distance to each node: 0 for the source and infinity for all others.
2. It keeps a priority queue of nodes, ordered by distance.
3. It repeatedly takes the closest unfinished node and tries to improve the distance of each neighbour through it.
4. When a node is taken from the queue, its distance is final. This holds only if no weight is negative.

With a binary heap it runs in O((V + E) log V). Negative weights need the Bellman-Ford algorithm instead.

### [deep] When would you choose a trie, and what does it cost? {#trie-q}

**Choose a trie for prefix operations.** Examples: autocomplete, spell check, dictionary lookups and IP routing.

- Finding all words with a prefix costs O(length of the prefix), plus the number of results. It does not depend on how many words are stored.
- The cost is memory: many nodes, each with child pointers.
- You can reduce the memory with compressed tries, or by storing the children in a small map or array.

### [deep] How would you design an LRU cache? {#lru-q}

**Combine a hash map with a doubly linked list.** LRU means "least recently used": when the cache is full, it removes the entry that was used longest ago.

1. The hash map finds an entry in O(1).
2. The doubly linked list keeps the entries ordered by recent use.
3. On every get or put, the entry moves to the front of the list.
4. When the capacity is exceeded, the entry at the tail is evicted.

Both get and put are O(1). In Java, the quickest way is a `LinkedHashMap` with `accessOrder = true` and an overridden `removeEldestEntry`. Production caches, such as Caffeine, add expiry, size limits by weight and thread safety.

### [coding] Reverse a singly linked list. {#coding-reverse-list}

```java
class Node {
    int value;
    Node next;
    Node(int value, Node next) { this.value = value; this.next = next; }
}

static Node reverse(Node head) {
    Node previous = null;
    Node current = head;
    while (current != null) {
        Node next = current.next;   // remember the rest of the list
        current.next = previous;    // point this node backwards
        previous = current;         // move both pointers forward
        current = next;
    }
    return previous;                // the old last node is the new head
}
```

How it works:

- Each node's pointer is flipped to point backwards, in one pass.
- `next` is saved before it is overwritten, so the rest of the list is not lost.
- It takes O(n) time and O(1) extra space.

### [coding] Check whether brackets are balanced, with a stack. {#coding-parentheses}

```java
static boolean isBalanced(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        switch (c) {
            case '(', '[', '{' -> stack.push(c);
            case ')', ']', '}' -> {
                if (stack.isEmpty()) return false;            // a closing bracket with nothing open
                char open = stack.pop();
                if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{')) return false;
            }
            default -> { }                                     // ignore other characters
        }
    }
    return stack.isEmpty();                                    // anything left open means unbalanced
}
```

How it works:

- Each opening bracket is pushed onto the stack.
- Each closing bracket must match the most recent open bracket, which is on top of the stack (last in, first out).
- If anything is left on the stack at the end, some bracket was never closed.
- It takes O(n) time, and O(n) space in the worst case.

### [coding] Find the shortest path between two nodes in an unweighted graph. {#coding-bfs}

```java
static int shortestPath(Map<String, List<String>> graph, String start, String target) {
    Deque<String> queue = new ArrayDeque<>();
    Map<String, Integer> distance = new HashMap<>();       // also serves as the visited set
    queue.offer(start);
    distance.put(start, 0);
    while (!queue.isEmpty()) {
        String node = queue.poll();
        if (node.equals(target)) return distance.get(node);
        for (String next : graph.getOrDefault(node, List.of())) {
            if (!distance.containsKey(next)) {                // visit each node only once
                distance.put(next, distance.get(node) + 1);
                queue.offer(next);
            }
        }
    }
    return -1;                                                 // not reachable
}
```

How it works:

- BFS explores nodes in order of distance. So the first time it reaches the target, it got there with the fewest edges.
- Each node is marked when it is queued. This avoids loops on cycles and avoids queuing a node twice.
- It takes O(V + E) time.

### [coding] Implement an LRU cache with LinkedHashMap. {#coding-lru}

```java
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    LruCache(int capacity) {
        super(16, 0.75f, true);          // true = access order: every get moves the entry to the end
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;        // called after each put: evict the least recently used entry
    }
}

LruCache<String, BigDecimal> cache = new LruCache<>(2);
cache.put("ACC-1", new BigDecimal("100"));
cache.put("ACC-2", new BigDecimal("200"));
cache.get("ACC-1");                      // ACC-1 is now the most recently used
cache.put("ACC-3", new BigDecimal("300"));   // evicts ACC-2
```

How it works:

- Access order keeps the most recently used entries at the end.
- `removeEldestEntry` runs after each put. It evicts the first entry, the least recently used one, when the size passes the capacity.
- Get and put are O(1).
- This class is not thread-safe. Wrap it with `Collections.synchronizedMap`, or use Caffeine.
