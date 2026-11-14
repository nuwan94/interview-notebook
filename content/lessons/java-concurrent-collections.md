---
title: Concurrent collections — ConcurrentHashMap, CopyOnWriteArrayList and BlockingQueue
nav: Concurrent collections
slug: java-concurrent-collections
summary: Why plain collections fail across threads, how ConcurrentHashMap, CopyOnWriteArrayList, ConcurrentLinkedQueue, BlockingQueue and ConcurrentSkipListMap work, weakly consistent iterators and atomic compound operations, with animations and interview questions.
tags: [Java, Concurrency, Collections]
order: 17
topic: Java / Concurrency
updated: 2026-11-13
subnav: true
---

After "what is a race condition?" the next interview question is usually "what do you use instead of `HashMap` across threads, and how does it work?". This lesson builds on [Java concurrency](lesson:java-concurrency) (threads, locks, atomics) and the [collections framework](lesson:java-collections); the internals of the plain map are in [HashMap](lesson:java-hashmap). Play the four scenes: why plain collections fail, `ConcurrentHashMap`, `CopyOnWriteArrayList`, and `BlockingQueue`.

```demo
name: java-concurrent-collections-walk
```

> **One sentence to remember:** *`ArrayList` and `HashMap` are not thread-safe; use `ConcurrentHashMap` for shared maps (bucket-level locking and CAS, atomic `merge`/`compute`), `CopyOnWriteArrayList` for read-mostly lists, and a `BlockingQueue` to hand work between threads, and remember that two safe calls in a row are still not atomic.*

## Why synchronized wrappers are not enough {#why}

| Approach | Safe for single calls? | Scales? | Problem |
| --- | --- | --- | --- |
| plain `HashMap` / `ArrayList` | no | n/a | lost updates, corrupted structure, infinite loops on resize (Java 7) |
| `Hashtable`, `Vector` | yes | poor | one lock on every method |
| `Collections.synchronizedMap(...)` | yes | poor | one lock; **iteration and check-then-act still need manual locking** |
| `java.util.concurrent` collections | yes | good | different semantics (weakly consistent iterators, no nulls) |

```java
// still a race with a synchronized map: two threads can both see "absent"
if (!map.containsKey(id)) { map.put(id, new Account(id)); }

// atomic with a ConcurrentHashMap
Account acc = map.computeIfAbsent(id, Account::new);
```

## ConcurrentHashMap {#chm}

The standard thread-safe map. Since Java 8 it has no segments and no global lock: an array of bins where inserting into an **empty bin uses CAS** (compare-and-swap), and otherwise the writer `synchronized`s on the **first node of that one bin**. Reads are lock-free (volatile reads). Many threads can write to different bins at the same time. Long bins become trees, like `HashMap`.

| Feature | Behaviour |
| --- | --- |
| nulls | `null` keys and values are **not allowed** (so `get` returning `null` means "absent") |
| iterators | weakly consistent: no `ConcurrentModificationException`, may or may not see concurrent changes |
| `size()` | an estimate while writers run (`mappingCount()` returns a `long`) |
| atomic per-key methods | `putIfAbsent`, `computeIfAbsent`, `computeIfPresent`, `compute`, `merge`, `replace`, `remove(key, value)` |
| bulk operations | `forEach`, `reduce`, `search` with a parallelism threshold |

```java
ConcurrentMap<String, LongAdder> hits = new ConcurrentHashMap<>();
hits.computeIfAbsent(accountId, k -> new LongAdder()).increment();   // atomic and contention-friendly

ConcurrentMap<String, Integer> counts = new ConcurrentHashMap<>();
counts.merge(word, 1, Integer::sum);                                  // atomic read-modify-write
```

Keep the function passed to `compute*` and `merge` short, side-effect free and never touching the same map: it runs while the bin is locked, and a slow or re-entrant function blocks other writers or can deadlock.

## CopyOnWriteArrayList and CopyOnWriteArraySet {#cow}

Every mutation copies the whole backing array; reads take no lock and iterate a **snapshot**. Iterators never throw and never see later changes, and they do not support `remove`.

| Good for | Bad for |
| --- | --- |
| listener lists, configuration, small lists read constantly and changed rarely | large lists, frequent writes (each write is O(n) and creates garbage) |

## Queues {#queues}

| Class | Blocking? | Bounded? | Notes |
| --- | --- | --- | --- |
| `ConcurrentLinkedQueue` / `ConcurrentLinkedDeque` | no (non-blocking, lock-free CAS) | no | `poll` returns `null` when empty; `size()` is O(n) |
| `ArrayBlockingQueue` | yes | yes (fixed) | one lock, optional fairness |
| `LinkedBlockingQueue` | yes | optional (default unbounded) | separate put and take locks, higher throughput |
| `PriorityBlockingQueue` | take blocks | unbounded | ordered by priority |
| `DelayQueue` | take blocks until delay expired | unbounded | scheduled tasks |
| `SynchronousQueue` | yes | zero capacity | direct hand-off (used by cached thread pools) |
| `LinkedTransferQueue` | yes | no | `transfer` waits for a consumer |

`BlockingQueue` methods: `put` (block when full), `take` (block when empty), `offer(e, timeout, unit)`, `poll(timeout, unit)`. A bounded queue gives **backpressure**.

```java
BlockingQueue<PaymentRequest> queue = new ArrayBlockingQueue<>(100);

// producer
queue.put(request);                              // waits if 100 are already queued

// consumer
PaymentRequest next = queue.take();              // waits for work
```

## Sorted concurrent collections {#skiplist}

`ConcurrentSkipListMap` and `ConcurrentSkipListSet` are the concurrent counterparts of `TreeMap` and `TreeSet`: a skip list (layers of linked lists) with lock-free updates, sorted order, O(log n) operations and navigation methods (`ceilingKey`, `headMap`).

## Atomic counters {#counters}

For a shared number, an `AtomicLong` is a single CAS variable; `LongAdder` spreads updates over several cells and sums them on read, which is much faster under heavy contention but gives a non-atomic snapshot of the total.

## Immutable beats concurrent {#immutable}

The simplest thread-safe collection is one nobody changes: build it, make it immutable (`List.copyOf`, `Map.copyOf`), and publish it safely (a `final` or `volatile` field). To update, build a new one and swap the reference (the idea behind copy-on-write). Also consider confining a collection to one thread.

## Choosing {#choosing}

| Need | Use |
| --- | --- |
| shared map | `ConcurrentHashMap` |
| shared sorted map | `ConcurrentSkipListMap` |
| list read much more than written | `CopyOnWriteArrayList` |
| unbounded non-blocking queue | `ConcurrentLinkedQueue` |
| producer-consumer with backpressure | `ArrayBlockingQueue` / `LinkedBlockingQueue(capacity)` |
| shared counter | `AtomicLong` or `LongAdder` |
| a set | `ConcurrentHashMap.newKeySet()` |

## Cheat sheet {#cheatsheet}

| Plain | Thread-safe replacement |
| --- | --- |
| `HashMap` | `ConcurrentHashMap` |
| `TreeMap` | `ConcurrentSkipListMap` |
| `HashSet` | `ConcurrentHashMap.newKeySet()` |
| `ArrayList` (read-mostly) | `CopyOnWriteArrayList` |
| `ArrayDeque` / `LinkedList` queue | `ConcurrentLinkedQueue` or a `BlockingQueue` |
| `PriorityQueue` | `PriorityBlockingQueue` |

## Interview questions {#questions}

### [basic] Why is HashMap not thread-safe? {#hashmap-unsafe}

Operations such as `put` are several steps (read size, find bucket, link node, maybe resize) that can interleave between threads, so updates can be lost or the structure corrupted, and a visibility problem means one thread may not see another's writes. In Java 7 a concurrent resize could even create an infinite loop. See [HashMap](lesson:java-hashmap).

### [basic] What is the difference between HashMap, Hashtable, Collections.synchronizedMap and ConcurrentHashMap? {#map-comparison}

`HashMap` is fast but unsafe. `Hashtable` and `synchronizedMap` lock the whole map on each call (safe, but contended; iteration needs extra locking). `ConcurrentHashMap` locks per bin or uses CAS, has lock-free reads and atomic compound methods. It disallows `null` keys and values.

### [basic] What is a ConcurrentModificationException and do concurrent collections throw it? {#cme}

A fail-fast signal from plain collections when they change while being iterated. Concurrent collections do not throw it: their iterators are weakly consistent (or work on a snapshot), so iteration continues and may or may not reflect concurrent changes.

### [basic] When would you use CopyOnWriteArrayList? {#cow-when}

For lists that are iterated very often and modified rarely, such as a list of event listeners, because reads need no locking and iteration is on a snapshot. Avoid it for large or frequently written lists since every write copies the array.

### [basic] What is a BlockingQueue and what is it used for? {#blockingqueue-q}

A queue whose `put` blocks when full and `take` blocks when empty, used for producer-consumer designs and thread pools. It removes the need for manual `wait`/`notify` and, when bounded, applies backpressure to fast producers.

### [basic] Why does ConcurrentHashMap not allow null keys or values? {#chm-null-q}

Because `get(key)` returning `null` must unambiguously mean "no mapping". In a concurrent map you cannot reliably follow up with `containsKey` to distinguish "absent" from "mapped to null", since another thread may change the map in between.

### [intermediate] How does ConcurrentHashMap work internally in Java 8+? {#chm-internals}

An array of bins. For an empty bin the first node is inserted with CAS (no lock). Otherwise the thread synchronizes on the head node of that bin, so only writers to the same bin contend. Reads use volatile reads and never lock. Large bins become red-black trees, and resizing is done cooperatively by multiple threads, with a `ForwardingNode` marking moved bins. Java 7 used segments (a fixed number of locks) instead.

### [intermediate] Are ConcurrentHashMap operations atomic as a group? {#chm-compound}

Each single method is atomic, but a sequence of calls is not. `if (!map.containsKey(k)) map.put(k, v)` is a race. Use `putIfAbsent`, `computeIfAbsent`, `compute` or `merge`, which perform the read-modify-write atomically for that key. Operations across several keys are still not atomic.

### [intermediate] What does computeIfAbsent guarantee, and what are its pitfalls? {#compute-if-absent}

It runs the mapping function at most once per absent key and the result becomes visible atomically. The function executes while the bin is locked, so it must be fast, must not block on I/O and must not modify the same map (the update can deadlock or throw `IllegalStateException: Recursive update` on Java 9+). Do not use it to start long computations; store a `CompletableFuture` or `Lazy` holder instead.

### [intermediate] What are weakly consistent iterators? {#weakly-consistent}

Iterators that are safe to use while the collection changes: they never throw `ConcurrentModificationException`, they traverse elements as they existed at or after creation, and may or may not reflect changes made after that. They are not a point-in-time snapshot (unlike `CopyOnWriteArrayList`'s).

### [intermediate] Is size() accurate on a ConcurrentHashMap? {#chm-size}

Only when no concurrent updates are happening. It sums counter cells, so under concurrent modification it is an estimate that may be stale immediately. Use `mappingCount()` for a `long`, and do not base logic on `size()` of a map being modified.

### [intermediate] How do you create a concurrent Set? {#concurrent-set}

`ConcurrentHashMap.newKeySet()` (backed by a `ConcurrentHashMap`), `ConcurrentSkipListSet` for a sorted one, `CopyOnWriteArraySet` for tiny read-mostly sets. `Collections.newSetFromMap(new ConcurrentHashMap<>())` also works.

### [intermediate] What is the difference between ArrayBlockingQueue and LinkedBlockingQueue? {#abq-vs-lbq}

`ArrayBlockingQueue` is bounded with a fixed array and a single lock (optional fairness). `LinkedBlockingQueue` uses linked nodes, optional capacity (unbounded by default), and separate locks for put and take, so producers and consumers contend less. An unbounded queue can hide overload until memory runs out; give it a capacity.

### [intermediate] How would you implement a producer-consumer with a BlockingQueue? {#producer-consumer}

Create a bounded queue, give producers `put` and consumers `take` in loops, and use a poison pill (a special sentinel item) or interruption to stop consumers. A thread pool does the same: its work queue is a `BlockingQueue<Runnable>`.

### [intermediate] What is backpressure and how does a BlockingQueue give you it? {#backpressure-q}

Slowing the producer when the consumer cannot keep up. With a bounded queue, `put` blocks when full (or `offer` returns `false`), so memory stays bounded and the load is pushed back to the caller instead of building up unbounded.

### [intermediate] ConcurrentLinkedQueue versus LinkedBlockingQueue? {#clq-vs-lbq}

`ConcurrentLinkedQueue` is non-blocking and lock-free (CAS), unbounded, and `poll` returns `null` when empty, so consumers must spin or sleep. `LinkedBlockingQueue` blocks consumers on empty and optionally producers on full, which is what you want for worker threads, and can be bounded.

### [deep] How do CopyOnWriteArrayList's iterators and writes work? {#cow-internals}

The list holds a `volatile` array reference. A write takes a lock, copies the array (`Arrays.copyOf`), modifies the copy and publishes it. An iterator captures the array reference at creation and iterates that fixed snapshot, so it never sees later changes and does not support `remove`. Memory churn and O(n) writes are the price.

### [deep] What is a lock-free algorithm and how does CAS work? {#cas}

CAS (compare-and-swap) is a CPU instruction that sets a variable to a new value only if it still holds the expected one. Lock-free structures such as `ConcurrentLinkedQueue` and the atomic classes retry in a loop until their CAS succeeds, so some thread always makes progress without holding a lock. The ABA problem and retry storms under heavy contention are the drawbacks.

### [deep] How does LongAdder differ from AtomicLong? {#longadder}

`AtomicLong` is one CAS variable, so many threads updating it keep retrying. `LongAdder` keeps a base plus an array of cells; contended updates go to different cells and `sum()` adds them. It is far faster for heavily updated counters and statistics, but `sum()` is not an atomic snapshot and it is a poor choice for sequence generators.

### [deep] Why was the Java 7 HashMap resize able to loop forever? {#java7-loop}

Resizing reversed the order of nodes in a bucket chain while transferring them. Two threads resizing the same bucket could form a cycle in the chain, so a later `get` looped forever on that bucket. Java 8 preserves order during transfer, but `HashMap` is still unsafe and can lose data.

### [deep] How does ConcurrentSkipListMap work and when do you use it? {#skiplist-q}

A skip list: several layers of sorted linked lists where higher layers skip over more nodes, giving O(log n) search with probabilistic balancing and lock-free updates via CAS. Use it when you need a sorted, navigable map or set (range queries, `ceilingKey`) shared across threads, where `TreeMap` would need a global lock.

### [deep] What is the memory visibility guarantee when you put an object into a concurrent collection? {#visibility}

Actions in a thread before putting an element into a concurrent collection happen-before actions in another thread after it reads or removes that element. So a safely constructed object handed over through `ConcurrentHashMap` or a `BlockingQueue` is fully visible to the reader without extra synchronisation.

### [coding] Implement a thread-safe word counter. {#coding-word-counter}

```java
class WordCounter {
    private final ConcurrentMap<String, LongAdder> counts = new ConcurrentHashMap<>();

    void record(String word) {
        counts.computeIfAbsent(word, w -> new LongAdder()).increment();
    }

    long countOf(String word) {
        LongAdder a = counts.get(word);
        return a == null ? 0 : a.sum();
    }
}
// simpler for light contention: counts.merge(word, 1L, Long::sum);
```

### [coding] Write a bounded producer-consumer with a BlockingQueue. {#coding-producer-consumer}

```java
BlockingQueue<String> queue = new ArrayBlockingQueue<>(10);
String POISON = "__STOP__";

Thread producer = new Thread(() -> {
    try {
        for (int i = 0; i < 100; i++) queue.put("job-" + i);
        queue.put(POISON);
    } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
});

Thread consumer = new Thread(() -> {
    try {
        for (String job = queue.take(); !job.equals(POISON); job = queue.take()) {
            process(job);
        }
    } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
});

producer.start(); consumer.start();
```

### [coding] Fix this racy cache. {#coding-racy-cache}

```java
private final Map<String, Rate> cache = new HashMap<>();

Rate rate(String currency) {
    Rate r = cache.get(currency);
    if (r == null) {
        r = loadFromService(currency);
        cache.put(currency, r);
    }
    return r;
}
```

```java
private final ConcurrentMap<String, Rate> cache = new ConcurrentHashMap<>();

Rate rate(String currency) {
    return cache.computeIfAbsent(currency, this::loadFromService);
}
```

The original has a visibility problem, a lost-update problem and can load the rate twice. `computeIfAbsent` is atomic per key. If `loadFromService` is slow, store a `CompletableFuture<Rate>` in the map so the bin is not locked during the remote call.
