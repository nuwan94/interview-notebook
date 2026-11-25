---
title: Concurrent collections — ConcurrentHashMap, CopyOnWriteArrayList and BlockingQueue
nav: Concurrent collections
slug: java-concurrent-collections
summary: Why plain collections fail across threads, how ConcurrentHashMap, CopyOnWriteArrayList, ConcurrentLinkedQueue, BlockingQueue and ConcurrentSkipListMap work, weakly consistent iterators and atomic compound operations, with animations and interview questions.
tags: [Java, Concurrency, Collections]
order: 20
topic: Java / Concurrency
updated: 2026-11-24
subnav: true
---

After "what is a race condition?", the next interview question is usually: "What do you use instead of `HashMap` when several threads share it, and how does it work?"

This lesson builds on two others:

- [Java concurrency](lesson:java-concurrency) covers threads, locks and atomics.
- The [collections framework](lesson:java-collections) covers the plain collections. The inside of the plain map is explained in [HashMap](lesson:java-hashmap).

The animation has four scenes: why plain collections fail, `ConcurrentHashMap`, `CopyOnWriteArrayList` and `BlockingQueue`.

```demo
name: java-concurrent-collections-walk
```

> **One sentence to remember:** *Share a `ConcurrentHashMap`, never a `HashMap`, and use one atomic call such as `merge` instead of two safe calls in a row.*

## Why synchronized wrappers are not enough {#why}

| Approach | Is one call safe? | Does it scale? | Problem |
| --- | --- | --- | --- |
| Plain `HashMap` / `ArrayList` | No. | Not relevant. | Updates get lost and the structure can break. In Java 7, a resize could even loop for ever. |
| `Hashtable`, `Vector` | Yes. | Poorly. | Every method takes the same single lock. |
| `Collections.synchronizedMap(...)` | Yes. | Poorly. | It has one lock too. **Loops over it and check-then-act still need your own lock.** |
| `java.util.concurrent` collections | Yes. | Well. | They behave a little differently: iterators are weakly consistent and `null` is not allowed. |

A safe single call does not make a sequence of calls safe:

```java
// still a race with a synchronized map: two threads can both see "absent"
if (!map.containsKey(id)) { map.put(id, new Account(id)); }

// atomic with a ConcurrentHashMap
Account acc = map.computeIfAbsent(id, Account::new);
```

## ConcurrentHashMap {#chm}

`ConcurrentHashMap` is the standard thread-safe map. Since Java 8 it has no segments and no lock for the whole map.

Inside, it is an array of **bins** (buckets):

- To put a node into an **empty bin**, a thread uses **CAS** (compare-and-swap): "set this slot to my node only if it is still empty". No lock is needed.
- To change a bin that already has nodes, the thread locks only the **first node of that bin** with `synchronized`.
- Reads take no lock. They use volatile reads, which always see the latest published value.

So many threads can write to different bins at the same time. A bin with many nodes becomes a tree, as in `HashMap`.

| Feature | Behaviour |
| --- | --- |
| Nulls | `null` keys and values are **not allowed**. So when `get` returns `null`, the key is absent. |
| Iterators | They are weakly consistent. They never throw `ConcurrentModificationException`, and they may or may not see changes made while they run. |
| `size()` | It is only an estimate while other threads write. `mappingCount()` returns the count as a `long`. |
| Atomic methods for one key | `putIfAbsent`, `computeIfAbsent`, `computeIfPresent`, `compute`, `merge`, `replace` and `remove(key, value)`. |
| Bulk operations | `forEach`, `reduce` and `search`, each with a parallelism threshold (the size above which the work runs in parallel). |

```java
ConcurrentMap<String, LongAdder> hits = new ConcurrentHashMap<>();
hits.computeIfAbsent(accountId, k -> new LongAdder()).increment();   // atomic and contention-friendly

ConcurrentMap<String, Integer> counts = new ConcurrentHashMap<>();
counts.merge(word, 1, Integer::sum);                                  // atomic read-modify-write
```

Keep the function you pass to `compute*` and `merge` short. It should have no side effects and must never touch the same map. The reason: it runs while the bin is locked. A slow function blocks other writers, and a function that updates the same map can deadlock.

## CopyOnWriteArrayList and CopyOnWriteArraySet {#cow}

Every change copies the whole backing array. Reads take no lock.

An iterator walks a **snapshot**: the array as it was when the iterator was created. So iterators never throw and never see later changes. They also do not support `remove`.

| Good for | Bad for |
| --- | --- |
| Listener lists, configuration, and other small lists that are read all the time and changed rarely. | Large lists, and lists that change often. Each write takes O(n) time (it grows with the list size) and creates garbage. |

## Queues {#queues}

| Class | Blocking? | Bounded? | Notes |
| --- | --- | --- | --- |
| `ConcurrentLinkedQueue` / `ConcurrentLinkedDeque` | No. It never blocks and uses CAS instead of locks. | No. | `poll` returns `null` when the queue is empty. `size()` is O(n), because it counts the nodes. |
| `ArrayBlockingQueue` | Yes. | Yes, with a fixed size. | It has one lock, with an optional fair mode. |
| `LinkedBlockingQueue` | Yes. | Optional, and unbounded by default. | It has separate locks for put and take, so it handles more operations per second. |
| `PriorityBlockingQueue` | `take` blocks. | No. | Items come out in priority order. |
| `DelayQueue` | `take` blocks until an item's delay has passed. | No. | Used for scheduled tasks. |
| `SynchronousQueue` | Yes. | It has zero capacity. | It hands each item directly to a waiting thread. Cached thread pools use it. |
| `LinkedTransferQueue` | Yes. | No. | `transfer` waits until a consumer takes the item. |

The `BlockingQueue` methods:

- `put` waits while the queue is full.
- `take` waits while the queue is empty.
- `offer(e, timeout, unit)` and `poll(timeout, unit)` wait only up to a time limit.

A bounded queue gives you **backpressure**: when the queue is full, the producer has to wait, so a fast producer is slowed down to the speed of the consumers.

```java
BlockingQueue<PaymentRequest> queue = new ArrayBlockingQueue<>(100);

// producer
queue.put(request);                              // waits if 100 are already queued

// consumer
PaymentRequest next = queue.take();              // waits for work
```

## Sorted concurrent collections {#skiplist}

`ConcurrentSkipListMap` and `ConcurrentSkipListSet` are the thread-safe versions of `TreeMap` and `TreeSet`.

They are built on a **skip list**: several layers of sorted linked lists, where the higher layers skip over more nodes. They give you:

- updates without locks,
- sorted order,
- O(log n) operations,
- navigation methods such as `ceilingKey` and `headMap`.

## Atomic counters {#counters}

For a shared number there are two choices:

- An `AtomicLong` is a single variable updated with CAS.
- A `LongAdder` spreads the updates over several cells and adds them up when you read it. It is much faster when many threads update it at once. The price is that the total you read is not an atomic snapshot.

## Immutable beats concurrent {#immutable}

The simplest thread-safe collection is one that nobody changes.

1. Build it.
2. Make it immutable with `List.copyOf` or `Map.copyOf`.
3. Publish it safely, through a `final` or `volatile` field.

To update it, build a new one and swap the reference. This is the same idea as copy-on-write. Another option is to keep a collection inside one thread, so no other thread ever sees it.

## Choosing {#choosing}

| Need | Use |
| --- | --- |
| A shared map | `ConcurrentHashMap` |
| A shared sorted map | `ConcurrentSkipListMap` |
| A list that is read much more than written | `CopyOnWriteArrayList` |
| An unbounded queue that never blocks | `ConcurrentLinkedQueue` |
| Producer-consumer with backpressure | `ArrayBlockingQueue` / `LinkedBlockingQueue(capacity)` |
| A shared counter | `AtomicLong` or `LongAdder` |
| A set | `ConcurrentHashMap.newKeySet()` |

Try it in the lab: [ConcurrentHashMap: check-then-act and atomic compute](lab:concurrent-map-atomic).

## Cheat sheet {#cheatsheet}

| Plain | Thread-safe replacement |
| --- | --- |
| `HashMap` | `ConcurrentHashMap` |
| `TreeMap` | `ConcurrentSkipListMap` |
| `HashSet` | `ConcurrentHashMap.newKeySet()` |
| `ArrayList` (read-mostly) | `CopyOnWriteArrayList` |
| `ArrayDeque` / `LinkedList` used as a queue | `ConcurrentLinkedQueue` or a `BlockingQueue` |
| `PriorityQueue` | `PriorityBlockingQueue` |

## Interview questions {#questions}

### [basic] Why is HashMap not thread-safe? {#hashmap-unsafe}

Because a `put` is several steps, and two threads can run those steps at the same time.

1. A `put` reads the size, finds the bucket, links the node and maybe resizes. Steps of two threads can interleave, so updates can be lost or the structure can break.
2. There is also a visibility problem: one thread may not see what another thread wrote.
3. In Java 7, two threads resizing at the same time could even create an infinite loop.

See [HashMap](lesson:java-hashmap).

### [basic] What is the difference between HashMap, Hashtable, Collections.synchronizedMap and ConcurrentHashMap? {#map-comparison}

They differ in safety and in how much they lock.

- `HashMap` is fast but not safe across threads.
- `Hashtable` and `synchronizedMap` lock the whole map on each call. They are safe, but threads wait for each other, and loops over them need an extra lock.
- `ConcurrentHashMap` locks one bin at a time or uses CAS. Reads take no lock, and it has atomic compound methods. It does not allow `null` keys or values.

### [basic] What is a ConcurrentModificationException and do concurrent collections throw it? {#cme}

It is an error that plain collections throw when they change while you loop over them. This early failure is called **fail-fast**.

Concurrent collections do not throw it. Their iterators are weakly consistent, or they walk a snapshot. So the loop continues, and it may or may not see the changes.

### [basic] When would you use CopyOnWriteArrayList? {#cow-when}

For lists that are looped over very often and changed rarely, such as a list of event listeners.

- Reads need no lock.
- Loops run on a snapshot, so they are never disturbed.

Avoid it for large lists or lists that change often, because every write copies the whole array.

### [basic] What is a BlockingQueue and what is it used for? {#blockingqueue-q}

It is a queue where `put` waits when the queue is full and `take` waits when it is empty.

- It is used for producer-consumer designs and inside thread pools.
- It removes the need for your own `wait` and `notify` code.
- When it is bounded, it slows down producers that are too fast (backpressure).

### [basic] Why does ConcurrentHashMap not allow null keys or values? {#chm-null-q}

So that `get(key)` returning `null` always means "there is no entry".

With a `null` value allowed, you would have to call `containsKey` to tell "absent" from "mapped to null". In a concurrent map that check is not reliable, because another thread can change the map between the two calls.

### [intermediate] How does ConcurrentHashMap work internally in Java 8+? {#chm-internals}

It is an array of bins, and it locks at most one bin at a time.

1. For an empty bin, the first node is put in with CAS. No lock is taken.
2. Otherwise, the thread synchronizes on the first node of that bin. So only writers to the same bin wait for each other.
3. Reads use volatile reads and never lock.
4. Large bins become red-black trees.
5. Several threads share the work of a resize. A `ForwardingNode` marks the bins that have already moved to the new array.

Java 7 used segments instead: a fixed number of locks.

### [intermediate] Are ConcurrentHashMap operations atomic as a group? {#chm-compound}

No. Each single method is atomic, but a sequence of calls is not.

`if (!map.containsKey(k)) map.put(k, v)` is a race. Use `putIfAbsent`, `computeIfAbsent`, `compute` or `merge` instead. Each of them does the read-modify-write for that key in one atomic step.

Operations across several keys are still not atomic.

### [intermediate] What does computeIfAbsent guarantee, and what are its pitfalls? {#compute-if-absent}

It runs the mapping function at most once for an absent key, and the result appears atomically.

The pitfall is that the function runs while the bin is locked. So the function:

- must be fast,
- must not wait for I/O,
- must not change the same map. That can deadlock, or throw `IllegalStateException: Recursive update` on Java 9+.

Do not use it to start a long computation. Store a `CompletableFuture` or a `Lazy` holder in the map instead.

### [intermediate] What are weakly consistent iterators? {#weakly-consistent}

They are iterators that are safe to use while the collection changes.

- They never throw `ConcurrentModificationException`.
- They return the elements as they existed when the iterator was created, or later.
- They may or may not show changes made after the iterator was created.

They are not a snapshot taken at one moment. The iterators of `CopyOnWriteArrayList` are snapshots.

### [intermediate] Is size() accurate on a ConcurrentHashMap? {#chm-size}

Only when no other thread is changing the map.

`size()` adds up several counter cells. While other threads write, the sum is only an estimate, and it can be out of date immediately. Use `mappingCount()` to get the count as a `long`. Do not base program logic on the `size()` of a map that is being changed.

### [intermediate] How do you create a concurrent Set? {#concurrent-set}

There are several ways:

- `ConcurrentHashMap.newKeySet()`, which is backed by a `ConcurrentHashMap`.
- `ConcurrentSkipListSet` for a sorted set.
- `CopyOnWriteArraySet` for tiny sets that are mostly read.
- `Collections.newSetFromMap(new ConcurrentHashMap<>())` also works.

### [intermediate] What is the difference between ArrayBlockingQueue and LinkedBlockingQueue? {#abq-vs-lbq}

They differ in storage, size limit and locking.

- `ArrayBlockingQueue` is bounded. It uses a fixed array and a single lock, with an optional fair mode.
- `LinkedBlockingQueue` uses linked nodes. Its capacity is optional, and it is unbounded by default. It has separate locks for put and take, so producers and consumers wait for each other less.

An unbounded queue can hide an overload until memory runs out, so give it a capacity.

### [intermediate] How would you implement a producer-consumer with a BlockingQueue? {#producer-consumer}

1. Create a bounded queue.
2. Producers call `put` in a loop, and consumers call `take` in a loop.
3. To stop the consumers, send a **poison pill** (a special item that means "stop"), or interrupt them.

A thread pool works the same way: its work queue is a `BlockingQueue<Runnable>`.

### [intermediate] What is backpressure and how does a BlockingQueue give you it? {#backpressure-q}

Backpressure means slowing the producer down when the consumer cannot keep up.

With a bounded queue, `put` waits when the queue is full, or `offer` returns `false`. So memory use stays limited, and the load is pushed back to the caller instead of piling up without limit.

### [intermediate] ConcurrentLinkedQueue versus LinkedBlockingQueue? {#clq-vs-lbq}

The first never blocks. The second makes threads wait.

- `ConcurrentLinkedQueue` uses CAS instead of locks and is unbounded. `poll` returns `null` when it is empty, so a consumer has to loop or sleep.
- `LinkedBlockingQueue` makes a consumer wait while it is empty, and optionally makes a producer wait while it is full. It can be bounded. This is what you want for worker threads.

### [deep] How do CopyOnWriteArrayList's iterators and writes work? {#cow-internals}

The list holds a `volatile` reference to an array that is never changed in place.

1. A write takes a lock and copies the array with `Arrays.copyOf`.
2. It changes the copy.
3. It publishes the copy by pointing the reference at it.

An iterator remembers the array reference from the moment it was created and walks that fixed snapshot. So it never sees later changes, and it does not support `remove`.

The price is O(n) writes and a lot of short-lived garbage.

### [deep] What is a lock-free algorithm and how does CAS work? {#cas}

CAS (compare-and-swap) is a CPU instruction. It sets a variable to a new value only if the variable still holds the expected value.

Lock-free structures, such as `ConcurrentLinkedQueue` and the atomic classes, repeat their CAS in a loop until it succeeds. So some thread always makes progress, and no thread holds a lock.

The drawbacks:

- **The ABA problem:** a value changes from A to B and back to A, and CAS cannot tell.
- **Retry storms:** when many threads compete, many CAS attempts fail and are repeated.

### [deep] How does LongAdder differ from AtomicLong? {#longadder}

`AtomicLong` is one value. `LongAdder` spreads the value over several cells.

- With `AtomicLong`, many threads update the same CAS variable, so they keep retrying.
- `LongAdder` keeps a base value plus an array of cells. When threads compete, their updates go to different cells, and `sum()` adds them all up.

`LongAdder` is far faster for counters and statistics that are updated very often. But `sum()` is not an atomic snapshot, so it is a poor choice for generating sequence numbers.

### [deep] Why was the Java 7 HashMap resize able to loop forever? {#java7-loop}

Because two threads could turn a bucket's chain into a circle.

1. A resize moves the nodes of each bucket to a new array, and in Java 7 it reversed their order while doing so.
2. Two threads resizing the same bucket at once could link the nodes into a cycle.
3. A later `get` on that bucket then followed the cycle for ever.

Java 8 keeps the order during the move. `HashMap` is still not safe across threads, and it can still lose data.

### [deep] How does ConcurrentSkipListMap work and when do you use it? {#skiplist-q}

It is a skip list: several layers of sorted linked lists, where the higher layers skip over more nodes.

- A search takes O(log n) time.
- It stays balanced by chance: each new node gets a random number of layers.
- It updates nodes with CAS instead of locks.

Use it when several threads share a sorted map or set, and you need navigation such as range queries or `ceilingKey`. A `TreeMap` would need one lock for the whole map.

### [deep] What is the memory visibility guarantee when you put an object into a concurrent collection? {#visibility}

Everything a thread did before it put an element into a concurrent collection **happens-before** everything another thread does after it reads or removes that element.

So when you hand over a correctly built object through a `ConcurrentHashMap` or a `BlockingQueue`, the reader sees it completely. No extra synchronization is needed.

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

`computeIfAbsent` creates each word's counter exactly once, and `LongAdder` handles many threads adding at once.

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

The queue holds at most 10 jobs, so the producer waits when it gets too far ahead. The poison pill tells the consumer to stop.

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

The original has three problems:

1. A visibility problem: one thread may not see the rate that another thread stored.
2. A lost-update problem: the `HashMap` can lose entries or break.
3. Two threads can both miss the cache and load the same rate twice.

```java
private final ConcurrentMap<String, Rate> cache = new ConcurrentHashMap<>();

Rate rate(String currency) {
    return cache.computeIfAbsent(currency, this::loadFromService);
}
```

`computeIfAbsent` is atomic for each key. If `loadFromService` is slow, store a `CompletableFuture<Rate>` in the map instead, so the bin is not locked during the remote call.
