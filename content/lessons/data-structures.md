---
title: Data structures and Big-O — arrays, lists, stacks, hash tables, trees and graphs
nav: Data structures and Big-O
slug: data-structures
summary: The data structures every interview assumes: Big-O and amortised cost, arrays and ArrayList, linked lists, stacks and queues, hash tables, binary search trees and heaps, tries, and graphs with BFS and DFS, plus how to choose a structure and which Java class implements it, with Java code and interview questions.
tags: [Data structures, Big-O, Algorithms, Arrays, Linked list, Hash table, Tree, Heap, Graph, Java]
order: 4
topic: Fundamentals / Data structures and algorithms
updated: 2026-11-14
subnav: true
---

Almost every coding interview rests on a few data structures, and almost every design discussion on their trade-offs: *why is an ArrayList usually faster than a LinkedList, how does a HashMap find a key without searching, what is a heap for, how do you find the shortest path, and what does O(n log n) mean?* This lesson explains the structures, shows how they behave, and maps each to its Java class. It leads into [sorting and searching](lesson:sorting-searching) and [coding patterns](lesson:coding-patterns), and complements the Java API lessons on [collections](lesson:java-collections), [HashMap](lesson:java-hashmap) and [concurrent collections](lesson:java-concurrent-collections). Play the five scenes: linked list, hash table, binary search tree, breadth-first search and depth-first search.

```demo
name: data-structure-walk
```

> **One sentence to remember:** *pick the structure by the operation you do most: arrays for index access, hash tables for lookup by key, trees for sorted order and ranges, heaps for the next smallest, queues and stacks for order of processing, graphs for relationships, and know the Big-O of each.*

## Big-O in plain words {#bigo}

**Big-O** describes how the work (time) or memory a piece of code needs **grows with the input size n**, ignoring constants and small terms. It answers "what happens when the data gets 1000 times bigger?".

| Complexity | Name | Example | For n = 1,000,000 |
| --- | --- | --- | --- |
| O(1) | constant | array index, HashMap get (average) | 1 step |
| O(log n) | logarithmic | binary search, balanced tree lookup | about 20 steps |
| O(n) | linear | scan a list, sum an array | 1 million steps |
| O(n log n) | linearithmic | good sorting (merge sort, TimSort) | about 20 million |
| O(n²) | quadratic | nested loops over the same data, bubble sort | 1 trillion: too slow |
| O(2ⁿ) | exponential | trying every subset | impossible beyond n of about 40 |

How to analyse code:

- **One loop over n items is O(n); two nested loops over n are O(n²);** a loop that halves the range each time is O(log n); do things in sequence and you **add** (then keep the biggest term).
- **Drop constants and smaller terms:** 3n + 10 is O(n), n² + n is O(n²).
- Usually give the **worst case**, and say when you mean average or best.
- **Space complexity** counts the extra memory in the same way (recursion depth counts too).
- **Amortised cost** averages an occasional expensive step over many cheap ones. `ArrayList.add` is O(1) amortised: it is usually a single write, and about once per doubling it copies the array in O(n), which averages out to constant time. `HashMap.put` is O(1) amortised for the same reason (resizing).
- Big-O is a guide to scaling, not speed: for small n a "worse" algorithm with small constants or better memory locality can win, so measure real data before optimising.

## Arrays and ArrayList {#arrays}

An **array** is a block of contiguous memory of fixed size. Because every slot has the same size, index `i` is found by arithmetic: **access by index is O(1)**. Inserting or deleting in the middle shifts the rest, so it is **O(n)**; searching an unsorted array is O(n), or O(log n) if sorted ([binary search](lesson:sorting-searching)). A fixed size means growing needs a new array.

`ArrayList` wraps an array that grows (by about 1.5 times) when full: `get(i)` O(1), `add` at the end O(1) amortised, `add(0, x)` and `remove(0)` O(n). Elements sit next to each other, which is **cache friendly** and the main reason `ArrayList` beats `LinkedList` in practice. **Two dimensional arrays** model grids and matrices (`int[rows][cols]`).

## Linked lists {#lists}

A **linked list** is a chain of nodes, each holding a value and a pointer to the next one (and to the previous one in a doubly linked list). There is no index: reaching element i means walking i pointers.

| Operation | Singly linked list | Array / ArrayList |
| --- | --- | --- |
| access by index | O(n) | O(1) |
| insert or delete at the front | O(1) | O(n) |
| insert or delete after a node you already hold | O(1) | O(n) |
| search | O(n) | O(n) |
| memory per element | value plus pointer(s), objects scattered in memory | value only, contiguous |

Linked lists appear in interviews for pointer manipulation (reverse a list, find the middle with fast and slow pointers, detect a cycle) and inside other structures (`LinkedHashMap`, queues). In everyday Java, prefer `ArrayList` or `ArrayDeque`; `LinkedList` is rarely the best choice.

## Stacks and queues {#stack-queue}

A **stack** is last in, first out (LIFO): `push`, `pop`, `peek`. Uses: undo, the call stack, matching brackets, evaluating expressions, depth-first search. A **queue** is first in, first out (FIFO): `offer`, `poll`, `peek`. Uses: task scheduling, buffering, breadth-first search. A **deque** works at both ends.

In Java use **`ArrayDeque`** for both (`push/pop` for a stack, `offer/poll` for a queue); the old `Stack` class is synchronised and legacy. All these operations are O(1). Concurrent code uses `BlockingQueue` implementations (see [concurrent collections](lesson:java-concurrent-collections)). A **priority queue** (`PriorityQueue`) always returns the smallest (or by comparator, highest priority) element first: it is built on a heap, below.

## Hash tables {#hash}

A **hash table** maps keys to values with **O(1) average** get, put and remove. A **hash function** turns the key into an integer, which picks a **bucket**. Different keys can land in the same bucket (a **collision**); Java's `HashMap` keeps a short list per bucket, and turns long lists into balanced trees (worst case O(log n) instead of O(n)). When the number of entries passes **load factor × capacity** (0.75 by default), the table **resizes** and rehashes everything.

For a key to work, its **`hashCode` and `equals` must agree**: equal objects must have equal hash codes, and keys must not change while stored. `HashSet` is a `HashMap` where only the key matters. Variants: `LinkedHashMap` (keeps insertion or access order, the base of an LRU cache), `TreeMap` (sorted, O(log n)), `ConcurrentHashMap` (thread-safe). See [HashMap internals](lesson:java-hashmap).

Typical uses: counting (frequency maps), de-duplication, caching, indexing records by id, and turning an O(n²) nested search into O(n) by remembering what you have seen (the **two-sum** trick).

## Trees and heaps {#trees}

A **tree** is a connected structure with no cycles: a root and children. A **binary tree** has at most two children per node.

- **Binary search tree (BST):** smaller values go left, larger values right, so search, insert and delete follow one path from the root: O(height). Balanced, the height is log n; fed sorted data it degenerates into a chain with O(n). **Self-balancing** trees (AVL, red-black) rotate to keep the height near log n; Java's `TreeMap` and `TreeSet` are red-black trees, keeping keys sorted with O(log n) operations and supporting ranges (`subMap`, `floor`, `ceiling`).
- **Traversals:** **in-order** (left, node, right) visits a BST in sorted order; **pre-order** (node first) copies a tree; **post-order** (children first) deletes or evaluates; **level-order** uses a queue (BFS).
- **Heap:** a complete binary tree stored in an array where each parent is no larger (min-heap) than its children. The smallest element is always at the top: `peek` O(1), `offer` and `poll` O(log n). It powers `PriorityQueue`, top-k problems, schedulers and Dijkstra's algorithm. It is **not** sorted overall, only the top is guaranteed.
- **Trie (prefix tree):** each node is a character, and paths spell words, so finding all words with a prefix takes O(length of the prefix). Used for autocomplete and dictionaries.
- **B-tree and B+ tree:** wide, shallow, balanced trees designed for disk pages. They are how database indexes work, giving a lookup in a few page reads even for billions of rows (see [SQL vs NoSQL](lesson:sql-vs-nosql)).

## Graphs {#graphs}

A **graph** is nodes (vertices) connected by edges, which can be directed or undirected, weighted or not. It models networks, maps, dependencies and relationships: accounts and transfers, services calling services, build dependencies.

**Representation:** an **adjacency list** (a map from each node to its neighbours) uses O(V + E) memory and suits sparse graphs, which most real ones are; an **adjacency matrix** (V × V array) gives O(1) edge checks but uses O(V²) memory.

**Traversals**, both O(V + E):

- **Breadth-first search (BFS)** uses a **queue** and visits level by level. It finds the **shortest path in an unweighted graph** (fewest edges).
- **Depth-first search (DFS)** uses a **stack or recursion** and goes deep before backing up. It suits cycle detection, connected components, topological sort and exploring all paths.

Always keep a **visited** set, otherwise cycles cause infinite loops. Other graph algorithms worth naming: **Dijkstra** (shortest path with non-negative weights, using a priority queue, O((V + E) log V)), **topological sort** (order tasks so dependencies come first, only for directed acyclic graphs), and **union-find** (disjoint sets: group items and test if two are connected in near O(1)).

## Choosing a structure {#choosing}

| You need | Use | Java class | Cost |
| --- | --- | --- | --- |
| fast access by position | array, list | `ArrayList`, `int[]` | get O(1) |
| fast lookup by key | hash table | `HashMap`, `HashSet` | O(1) average |
| keys kept sorted, ranges, floor and ceiling | balanced tree | `TreeMap`, `TreeSet` | O(log n) |
| keep insertion order and look up by key | hash plus linked list | `LinkedHashMap` | O(1) |
| process in arrival order | queue | `ArrayDeque` | O(1) |
| process last in first | stack | `ArrayDeque` | O(1) |
| always the smallest or highest priority next | heap | `PriorityQueue` | poll O(log n) |
| prefix search | trie | your own, or a library | O(length) |
| relationships and paths | graph | `Map<Node, List<Node>>` | BFS or DFS O(V + E) |
| membership test on huge data, a few false positives allowed | Bloom filter | Guava | O(1), tiny memory |

## Cheat sheet {#cheatsheet}

| Structure | Access | Search | Insert | Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Array | O(1) | O(n) | O(n) | O(n) | contiguous, cache friendly |
| ArrayList | O(1) | O(n) | O(1) amortised at end | O(n) | resizes by copying |
| Linked list | O(n) | O(n) | O(1) at a known node | O(1) at a known node | no index |
| Stack, queue (ArrayDeque) | O(1) ends | O(n) | O(1) | O(1) | order of processing |
| HashMap | n/a | O(1) average | O(1) average | O(1) average | no order |
| TreeMap | n/a | O(log n) | O(log n) | O(log n) | sorted |
| PriorityQueue | peek O(1) | O(n) | O(log n) | O(log n) | smallest on top only |
| Graph (adjacency list) | n/a | BFS or DFS O(V + E) | O(1) add edge | O(degree) | sparse graphs |

## Interview questions {#questions}

### [basic] What is Big-O notation? {#bigo-q}

A way to describe how the time or memory of an algorithm grows with the input size n, ignoring constant factors and lower-order terms. O(1) is constant, O(log n) logarithmic, O(n) linear, O(n log n) typical for good sorting, O(n²) quadratic. It tells you how an algorithm scales and lets you compare approaches, not how fast it runs on a given machine.

### [basic] What is the difference between an array and a linked list? {#array-vs-list-q}

An array stores elements contiguously, so index access is O(1) and it is cache friendly, but inserting or deleting in the middle is O(n) and the size is fixed. A linked list chains nodes with pointers, so inserting or deleting at a known node is O(1), but reaching an element needs O(n) traversal, and each node costs extra memory. In practice ArrayList is usually faster.

### [basic] What is a stack and what is a queue? {#stack-queue-q}

A stack is last in, first out (push and pop at one end), used for undo, the call stack, bracket matching and DFS. A queue is first in, first out (add at the back, remove from the front), used for scheduling, buffering and BFS. In Java both are best implemented with `ArrayDeque`, with O(1) operations.

### [basic] How does a HashMap work? {#hashmap-q}

It computes the key's hash code, maps it to a bucket index, and stores the entry there. Lookup repeats the hash and then compares keys with `equals` inside the bucket. Collisions are handled by keeping several entries per bucket (a linked list that becomes a balanced tree when long). When the table passes the load factor (0.75) it doubles and rehashes. Average get and put are O(1).

### [basic] What is the difference between a HashMap and a TreeMap? {#hashmap-vs-treemap-q}

HashMap is unordered with O(1) average operations and needs a good `hashCode` and `equals`. TreeMap keeps keys sorted using their natural order or a comparator, with O(log n) operations and extras such as `firstKey`, `floorKey` and range views. Use HashMap for plain lookups and TreeMap when you need ordering or ranges.

### [intermediate] Why must `hashCode` and `equals` be consistent for hash keys? {#hashcode-q}

If two keys are equal they must have the same hash code, otherwise the second lookup goes to a different bucket and the entry is never found. A mutable key whose hash changes after it was stored is lost in the same way. Override both together, base them on the same immutable fields, and prefer immutable keys such as strings, records and value objects.

### [intermediate] What is amortised complexity? Give an example. {#amortised-q}

The average cost per operation over a sequence of operations, when an occasional operation is expensive. Appending to an `ArrayList` costs O(1) most of the time, and O(n) when the internal array must be copied to a larger one; because the capacity grows geometrically, the total cost of n appends is O(n), so each append is O(1) amortised. The same reasoning applies to `HashMap` resizing.

### [intermediate] What is a binary search tree and why does balance matter? {#bst-q}

A tree where each node's left subtree holds smaller values and the right subtree larger ones, so search, insert and delete follow one path in O(height). If it is balanced the height is about log n; if values are inserted in sorted order it degenerates into a linked list with O(n) operations. Self-balancing trees such as red-black trees keep the height logarithmic, which is what `TreeMap` uses.

### [intermediate] What is a heap and what is it used for? {#heap-q}

A complete binary tree, stored in an array, where each parent is smaller than its children (min-heap) or larger (max-heap). The top element is always the minimum or maximum: peek is O(1), insert and remove are O(log n). It implements `PriorityQueue` and is used for top-k problems, task scheduling, merging sorted lists and Dijkstra's algorithm. It is not fully sorted, only the top is guaranteed.

### [intermediate] What are the tree traversals and when do you use each? {#traversal-q}

In-order (left, node, right) visits a binary search tree in sorted order. Pre-order (node, left, right) is used to copy or serialise a tree. Post-order (left, right, node) is used to delete a tree or evaluate expressions. Level-order uses a queue and visits level by level, for example to find the depth or to print per level.

### [intermediate] BFS or DFS: how do you choose? {#bfs-dfs-q}

Use BFS (a queue) when you need the shortest path in an unweighted graph or want to explore by distance; it uses memory proportional to the widest level. Use DFS (a stack or recursion) to explore all paths, detect cycles, find connected components or do a topological sort; it uses memory proportional to the depth. Both are O(V + E) and both need a visited set.

### [intermediate] How do you represent a graph in code? {#graph-repr-q}

Usually as an adjacency list: a `Map<Node, List<Node>>` (or an array of lists), using O(V + E) memory and giving fast iteration over neighbours, which suits sparse graphs. An adjacency matrix uses a V by V array, gives O(1) edge lookup but O(V²) memory, which suits dense graphs or small V. For weighted graphs the list holds (neighbour, weight) pairs.

### [intermediate] Why is ArrayList usually faster than LinkedList in practice? {#arraylist-vs-linkedlist-q}

Array elements sit contiguously in memory, so the CPU cache loads several at once and index access is O(1). LinkedList nodes are separate objects scattered in memory, each with extra pointers, so traversal causes cache misses and uses more memory, and even an insert in the middle needs an O(n) walk to reach the position. LinkedList wins mainly when you already hold a node, or for queue-like use, where `ArrayDeque` is usually better anyway.

### [deep] How does Java's HashMap handle many collisions? {#collisions-q}

Each bucket starts as a linked list. When a bucket reaches 8 entries and the table has at least 64 buckets, the list is converted to a red-black tree, so worst-case lookup in that bucket is O(log n) instead of O(n). If the table is small it is resized instead. This protects against poor hash functions and deliberate hash-collision attacks.

### [deep] How does Dijkstra's algorithm find the shortest path? {#dijkstra-q}

It keeps the best known distance to each node, starting with 0 for the source and infinity for others, and a priority queue ordered by distance. It repeatedly takes the closest unfinished node, then tries to improve the distance of each neighbour through it. When a node is taken its distance is final, provided all weights are non-negative. With a binary heap it runs in O((V + E) log V). Negative weights need Bellman-Ford.

### [deep] When would you choose a trie, and what does it cost? {#trie-q}

For prefix operations: autocomplete, spell check, dictionary look-ups, IP routing. Finding all words with a prefix costs O(length of the prefix) plus the number of results, independent of how many words are stored. The cost is memory: many nodes with child pointers, which can be reduced with compressed tries or by storing children in a small map or array.

### [deep] How would you design an LRU cache? {#lru-q}

A hash map for O(1) lookup combined with a doubly linked list ordered by recent use: on every get or put the entry moves to the front, and when the capacity is exceeded the entry at the tail is evicted. Both operations are O(1). In Java the quickest way is `LinkedHashMap` with `accessOrder = true` and an overridden `removeEldestEntry`. Production caches add expiry, size by weight and thread safety (Caffeine).

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

Explain that each node's pointer is flipped in one pass, that `next` is saved before it is overwritten so the rest of the list is not lost, and that it runs in O(n) time and O(1) extra space.

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

Explain that opening brackets are pushed and each closing bracket must match the most recent open one (last in, first out), that leftovers on the stack mean unbalanced, and that the time is O(n) with O(n) space in the worst case.

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

Explain that BFS explores nodes in order of distance, so the first time the target is reached is by the fewest edges, that marking nodes when they are queued avoids cycles and duplicates, and that the time is O(V + E).

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

Explain that access order keeps the most recently used entries at the end, that `removeEldestEntry` evicts the first (least recently used) one when the size passes the capacity, that get and put are O(1), and that this class is not thread-safe (wrap it with `Collections.synchronizedMap` or use Caffeine).
