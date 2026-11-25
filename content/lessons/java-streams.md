---
title: Java Streams API — pipelines, collectors and parallel streams
nav: Streams
slug: java-streams
summary: How stream pipelines work (lazy, one element at a time), the operations and collectors you need, flatMap, reduce, primitive streams, parallel streams and their pitfalls, with animations and interview questions and coding tasks.
tags: [Java, Streams, Functional]
order: 13
topic: Java / Functional programming
updated: 2026-11-24
subnav: true
---

Streams come up in almost every Java interview, in two ways:

- **Theory**, such as "what is lazy evaluation?".
- **Live coding**, such as "group these transactions by account and sum them".

You need [lambdas and functional interfaces](lesson:java-functional) first. Streams read from the [collections](lesson:java-collections), so know those too.

The animation has four scenes: the pipeline, collectors, `map` versus `flatMap`, and parallel streams.

```demo
name: java-streams-walk
```

> **One sentence to remember:** *A stream does nothing until a terminal operation pulls each element through every step, one at a time.*

## Pipeline anatomy {#pipeline}

A stream is a **pipeline**: a chain of steps that elements pass through.

```java
BigDecimal totalDebits = transactions.stream()          // source
        .filter(t -> t.type() == Type.DEBIT)             // intermediate: lazy
        .map(Transaction::amount)                        // intermediate: lazy
        .reduce(BigDecimal.ZERO, BigDecimal::add);       // terminal: runs the pipeline
```

A pipeline has three parts:

| Part | Examples | Notes |
| --- | --- | --- |
| Source | `list.stream()`, `Arrays.stream(a)`, `Stream.of(...)`, `Files.lines(path)`, `Stream.iterate`, `Stream.generate` | A stream is **not** a data structure. It does not store elements. |
| Intermediate operations | `filter`, `map`, `flatMap`, `distinct`, `sorted`, `limit`, `skip`, `peek`, `takeWhile`, `dropWhile` | Each one returns a new `Stream`. They are lazy. |
| Terminal operation | `collect`, `toList`, `forEach`, `count`, `reduce`, `min`, `max`, `findFirst`, `anyMatch`, `allMatch`, `noneMatch` | It starts the work. After it, the stream is used up. |

Four key properties:

1. **Lazy.** Nothing runs until a terminal operation is called.
2. **One element at a time.** Each element goes through the whole pipeline before the next one starts. So `limit` and `findFirst` can stop early.
3. **Single use.** A second terminal call throws `IllegalStateException`.
4. **Non-interfering.** Do not change the source while the stream runs.

Try it in the lab: [A stream does nothing until a terminal operation](lab:stream-lazy-pipeline).

## Common intermediate operations {#intermediate}

An operation is **stateful** when it must remember other elements, not just the current one.

| Operation | Purpose | Stateful? |
| --- | --- | --- |
| `filter(p)` | Keeps the elements that match the predicate. | No. |
| `map(f)` | Changes each element into another value. | No. |
| `flatMap(f)` | Turns each element into a stream, and joins those streams into one. | No. |
| `distinct()` | Removes duplicates, using `equals`. | Yes. It remembers the elements it has seen. |
| `sorted()` / `sorted(cmp)` | Sorts. It needs all the elements first. | Yes. It holds all of them. |
| `limit(n)` / `skip(n)` | Keeps the first n, or drops the first n. | `limit` stops early. `skip` is stateful. |
| `peek(c)` | Looks at each element. For debugging only. | No. |
| `takeWhile(p)` / `dropWhile(p)` | Java 9. Stops, or starts, at the first element that fails the test. | They stop early. |

## Terminal operations {#terminal}

```java
long count      = txns.stream().filter(Transaction::isDebit).count();
boolean anyBig  = txns.stream().anyMatch(t -> t.amount().compareTo(LIMIT) > 0);
Optional<Txn> biggest = txns.stream().max(Comparator.comparing(Txn::amount));
List<String> ids = txns.stream().map(Txn::id).toList();      // Java 16: unmodifiable
txns.forEach(audit::record);                                  // for side effects only
```

`anyMatch`, `allMatch`, `noneMatch`, `findFirst` and `findAny` **short-circuit**. They stop as soon as they know the answer.

## Collectors {#collectors}

`collect` gathers the elements into a result, such as a list, a map or a string. The `Collectors` class has ready-made collectors:

```java
Map<String, List<Account>> byBranch =
        accounts.stream().collect(Collectors.groupingBy(Account::branch));

Map<String, Long> countPerBranch =
        accounts.stream().collect(Collectors.groupingBy(Account::branch, Collectors.counting()));

Map<String, BigDecimal> totalPerBranch =
        accounts.stream().collect(Collectors.groupingBy(Account::branch,
                Collectors.reducing(BigDecimal.ZERO, Account::balance, BigDecimal::add)));

Map<Boolean, List<Account>> activeSplit =
        accounts.stream().collect(Collectors.partitioningBy(Account::isActive));

Map<String, Account> byId =
        accounts.stream().collect(Collectors.toMap(Account::id, Function.identity()));

String ids = accounts.stream().map(Account::id).collect(Collectors.joining(", ", "[", "]"));
```

Two things to know:

- `toMap` throws `IllegalStateException` when two elements have the same key. To avoid it, pass a **merge function** as the third argument, such as `(a, b) -> a`.
- `groupingBy` returns a `HashMap` of lists by default. For sorted keys, pass `TreeMap::new` as the map factory.

## map versus flatMap {#flatmap}

`map` is **one to one**: each element becomes exactly one new element.

`flatMap` is **one to many**. Its function returns a stream for each element. `flatMap` then **flattens** all those streams into one stream.

```java
List<Account> all = customers.stream()
        .flatMap(c -> c.accounts().stream())     // Stream<Account>, not Stream<List<Account>>
        .toList();

Set<String> words = lines.stream()
        .flatMap(line -> Arrays.stream(line.split("\\s+")))
        .collect(Collectors.toSet());
```

Try it in the lab: [map, flatMap and groupingBy](lab:stream-flatmap-collect).

## reduce {#reduce}

`reduce` combines all the elements into one value.

```java
BigDecimal sum = amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);   // identity + accumulator
Optional<BigDecimal> max = amounts.stream().reduce(BigDecimal::max);           // no identity: Optional
```

Two rules, or parallel results will be wrong:

- The **identity** must be a true neutral value, one that changes nothing. For addition it is `0`.
- The function must be **associative**: `(a + b) + c` must equal `a + (b + c)`, so the grouping does not matter.

For sums of numbers, prefer `mapToInt(...).sum()` or `collect(Collectors.summingInt(...))`.

## Primitive streams {#primitive}

`IntStream`, `LongStream` and `DoubleStream` hold primitives, so they avoid **boxing** (wrapping each number in an object). They add `sum`, `average`, `min`, `max`, `summaryStatistics`, `range` and `rangeClosed`.

```java
int total = IntStream.rangeClosed(1, 100).sum();                  // 5050
double avg = accounts.stream().mapToDouble(a -> a.balance().doubleValue()).average().orElse(0);
List<Integer> boxed = IntStream.range(0, 5).boxed().toList();
```

Keep money in `BigDecimal`, or in minor units (such as cents) in a `long`. Do not use `double` for money.

## Parallel streams {#parallel}

`list.parallelStream()` or `.parallel()` splits the work across several threads. The threads come from the **common `ForkJoinPool`**, one pool shared by the whole JVM.

It helps only when all of these are true:

- the data is **large**,
- the work is **CPU-bound** (computation, not waiting),
- the steps are **stateless**,
- the source splits easily, such as an `ArrayList`, an array or `IntStream.range`.

Do not use it:

- for blocking I/O,
- for small data,
- with shared changeable state,
- inside a service that handles requests, where it competes for the shared common pool.

Always measure first.

Try it in the lab: [Parallel streams: when they help and when they hurt](lab:stream-parallel).

## Streams versus loops {#vs-loops}

Streams describe *what* you want: filter, map, collect. They are great for transforming and grouping data.

A plain loop is better when:

- you need an early `return`,
- you change several variables,
- you call code that throws checked exceptions,
- the stream version becomes hard to read.

Do not use a stream just to look modern.

## Common mistakes {#mistakes}

- **Forgetting the terminal operation.** Nothing happens.
- **Reusing a stream.** It throws `IllegalStateException`.
- **Side effects in `map`, `filter` or `peek`**, such as adding to a list outside the stream. This breaks in parallel and is hard to follow. Use `collect` instead.
- **`toMap` with duplicate keys.** It throws an exception.
- **`sorted()` on objects that are not `Comparable`.** It throws `ClassCastException`.
- **Calling `Optional.get()` after `findFirst()` without a check.**
- **An infinite stream** (`Stream.iterate`, `generate`) without `limit` or `takeWhile`.
- **`parallel()` with blocking calls or shared state.**

## Cheat sheet {#cheatsheet}

| Goal | Code |
| --- | --- |
| Filter and transform to a list | `.filter(p).map(f).toList()` |
| Group | `groupingBy(classifier)` |
| Count per group | `groupingBy(classifier, counting())` |
| Split in two | `partitioningBy(predicate)` |
| Index by id | `toMap(Item::id, identity())` |
| Flatten | `flatMap(x -> x.children().stream())` |
| Sum numbers | `mapToInt(...).sum()` |
| Join strings | `collect(joining(", "))` |
| First match | `filter(p).findFirst()` |
| Any match | `anyMatch(p)` |
| Top n by a key | `sorted(comparing(K).reversed()).limit(n)` |

## Interview questions {#questions}

### [basic] What is a Stream in Java? {#what-is-stream}

A stream is a sequence of elements that you process in a pipeline of operations, such as `filter`, `map` and `collect`.

- It is **not** a data structure, and it does not store elements.
- It pulls the elements from a source, such as a collection, an array or a file.
- It does not change that source.

### [basic] What is the difference between intermediate and terminal operations? {#intermediate-vs-terminal}

- **Intermediate operations** (`filter`, `map`, `sorted`) return a new stream. They are lazy: they only add a step to the pipeline.
- **A terminal operation** (`collect`, `count`, `forEach`, `reduce`) starts the pipeline and produces a result or a side effect. After it, the stream is used up.

### [basic] What does "lazy evaluation" mean for streams? {#lazy}

Intermediate operations do not run until a terminal operation is called. Then the elements pass through the pipeline one at a time.

This gives two benefits:

1. Short-circuit operations such as `findFirst`, `anyMatch` and `limit` can stop early.
2. No collection is created between the steps.

### [basic] Can you reuse a stream? {#reuse}

**No.** After a terminal operation, the stream is closed. Another operation on it throws `IllegalStateException: stream has already been operated upon or closed`.

Call `stream()` on the source again, or keep a `Supplier<Stream<T>>`.

### [basic] What is the difference between map and flatMap? {#map-vs-flatmap-q}

- **`map`** changes each element into exactly one element.
- **`flatMap`** changes each element into a stream, and joins those streams into one. So it flattens nested data.

Example: `flatMap` turns a stream of customers into a stream of all their accounts.

### [basic] What is the difference between a stream and a collection? {#stream-vs-collection}

- **A collection stores data** in memory. You can go through it many times.
- **A stream processes data.** You can use it once. It can be lazy, and it can even be infinite.

Collections are about storage and access. Streams are about processing.

### [basic] What is the difference between findFirst and findAny? {#findfirst-findany}

- **`findFirst`** returns the first element in **encounter order** (the order of the source).
- **`findAny`** may return any element. This lets a parallel stream be faster.

In a sequential stream, they normally return the same element. Both return an `Optional`, and both stop early.

### [basic] How do you convert a stream to a list, set and map? {#to-collections}

- **List:** `stream.toList()` (Java 16, unmodifiable) or `collect(Collectors.toList())`.
- **Set:** `collect(Collectors.toSet())`.
- **Map:** `collect(Collectors.toMap(keyFn, valueFn))`.

`toMap` fails on duplicate keys unless you give it a merge function.

### [basic] What is the difference between forEach on a collection and forEach on a stream? {#foreach}

- **`Iterable.forEach`** goes over the collection directly, in order.
- **`Stream.forEach`** ends a pipeline. In a parallel stream it does not keep the order. Use `forEachOrdered` when order matters.

Do not use either one to collect results into an outside variable. Use `collect`.

### [intermediate] What do Collectors.groupingBy and partitioningBy do? {#grouping}

- **`groupingBy(classifier)`** returns a `Map<K, List<T>>`. It groups the elements by a key. You can add a **downstream collector**, such as `counting()`, `summingInt` or `mapping`, to change what each group holds.
- **`partitioningBy(predicate)`** always returns a map with exactly two keys, `true` and `false`.

### [intermediate] What happens with toMap when two elements have the same key? {#tomap-duplicates}

`Collectors.toMap` throws `IllegalStateException: Duplicate key`.

To fix it, pass a merge function as the third argument, such as `(existing, replacement) -> existing` or `BigDecimal::add`. A fourth argument, the map factory, chooses the map type.

### [intermediate] What is the difference between reduce and collect? {#reduce-vs-collect}

- **`reduce`** combines elements into one value that does not change, such as a sum or a maximum.
- **`collect`** is a **mutable reduction**. It adds elements into a container, such as a list, a map or a `StringBuilder`. It is built to be fast and safe in parallel.

Building a list with `reduce` copies the list each time, so use `collect` for that.

### [intermediate] What are the requirements for the function passed to reduce? {#reduce-rules}

1. It must be **associative**, so the grouping of the steps does not matter.
2. The identity must be a **neutral element**: `identity op x == x`.

Otherwise the result differs between sequential and parallel runs. The function should also be stateless, and must not change the source.

### [intermediate] What are stateless and stateful intermediate operations? {#stateful}

- **Stateless** operations, such as `filter` and `map`, handle each element on its own.
- **Stateful** operations, such as `sorted`, `distinct`, `limit` and `skip`, need to see other elements, or all of them.

`sorted` must hold the whole stream before it passes anything on. This costs memory and slows parallel streams.

### [intermediate] What is the difference between Stream and IntStream? {#intstream}

`IntStream` is a stream of primitive `int`s. It avoids boxing each number into an `Integer` object, and it adds `sum`, `average` and `range`.

Convert with `mapToInt`, and back with `boxed()`. Use it for number work on large data.

### [intermediate] Why shouldn't you modify external state inside a stream operation? {#side-effects}

1. The behaviour then depends on the order and the thread in which elements run.
2. In a parallel stream, it is a **data race**.
3. It breaks the rule that operations are stateless and do not interfere. Streams rely on that rule to reorder or split the work.

Return the result from `collect` or `reduce`, instead of adding to an outside list.

### [intermediate] What does peek do and when should you use it? {#peek}

`peek` runs an action on each element as it passes. It is mainly for debugging, such as printing values between steps.

It is lazy and may not run at all. For example, a later `count()` may know the size without going through the elements, or a short-circuit may stop early. So never put required logic in `peek`.

### [intermediate] How would you handle checked exceptions inside a stream lambda? {#checked}

The functional interfaces do not allow checked exceptions. Three options:

1. Catch the exception inside the lambda, and wrap it in an unchecked exception.
2. Write a small helper that wraps a function that throws.
3. Use a normal loop.

Do not let a half-processed stream hide the exception silently.

### [intermediate] What is a short-circuiting operation? {#short-circuit}

An operation that can finish without reading the whole stream: `limit`, `findFirst`, `findAny`, `anyMatch`, `allMatch`, `noneMatch` and `takeWhile`.

This is what makes infinite streams usable, such as `Stream.iterate(1, n -> n + 1)`.

### [deep] When is a parallel stream appropriate, and what are the dangers? {#parallel-q}

It is appropriate when all of these hold:

- the work is CPU-bound,
- the data set is large,
- the source splits well (`ArrayList`, an array, a range),
- the operations are stateless and associative.

The dangers:

1. Shared changeable state causes data races.
2. Blocking calls starve the common ForkJoinPool, which the whole JVM shares.
3. Ordering rules limit the gain.
4. On small data, splitting and merging cost more than they save.
5. `LinkedList` and `Stream.iterate` split badly.

Benchmark before and after.

### [deep] How does a parallel stream split and merge the work? {#parallel-internals}

1. The source's **`Spliterator`** is split again and again into chunks, with `trySplit`.
2. Each chunk runs as a ForkJoin task in the common pool.
3. A **combiner** merges the partial results.

This is why the accumulator and the combiner must be associative. The source's characteristics (`SIZED`, `ORDERED`, `SUBSIZED`) also affect the speed.

### [deep] What is a Spliterator? {#spliterator}

A `Spliterator` is like an `Iterator` that can also split. It can go through elements (`tryAdvance`), and it can split off part of the data (`trySplit`). Splitting is what lets streams run in parallel.

Collections provide their own spliterators. `StreamSupport.stream(spliterator, parallel)` builds a stream from your own source.

### [deep] How does a stream differ from an Iterator in laziness and resource handling? {#close}

Both are **pull-based**: the consumer asks for the next element. But a stream is built as a whole pipeline, and it is optimised as a whole.

Streams from I/O sources, such as `Files.lines` and `Files.walk`, hold an open file. You must close them, so use try-with-resources.

### [deep] Explain the three-argument reduce and when you need it. {#three-arg-reduce}

`reduce(identity, accumulator, combiner)` is for when the result type differs from the element type.

- The **accumulator** adds one element into a partial result.
- The **combiner** merges two partial results. Parallel streams need it.

Often a `map` followed by the simpler `reduce`, or a `collect`, is clearer.

### [coding] Group transactions by account and sum the amounts. {#coding-group-sum}

```java
Map<String, BigDecimal> totals = transactions.stream()
        .collect(Collectors.groupingBy(
                Transaction::accountId,
                Collectors.reducing(BigDecimal.ZERO, Transaction::amount, BigDecimal::add)));
```

### [coding] Find the three accounts with the highest balances. {#coding-top3}

```java
List<Account> top3 = accounts.stream()
        .sorted(Comparator.comparing(Account::balance).reversed())
        .limit(3)
        .toList();
```

For a very large input, a `PriorityQueue` that holds only k items is O(n log k), instead of sorting everything ([collections lesson](lesson:java-collections)).

### [coding] Count the frequency of each word in a list of lines. {#coding-word-count}

```java
Map<String, Long> freq = lines.stream()
        .flatMap(l -> Arrays.stream(l.toLowerCase().split("\\W+")))
        .filter(w -> !w.isBlank())
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
```

### [coding] Find the first duplicate id in a list, or report none. {#coding-first-duplicate}

```java
Set<String> seen = new HashSet<>();
Optional<String> firstDup = ids.stream()
        .filter(id -> !seen.add(id))       // add returns false when already present
        .findFirst();
```

The predicate here has state (the `seen` set). That is fine in a sequential stream that ends with a short-circuit. It is not safe in parallel. A plain loop is just as clear.

### [coding] Convert this loop to a stream, then say whether you would keep it. {#coding-loop-to-stream}

```java
List<String> result = new ArrayList<>();
for (Account a : accounts) {
    if (a.isActive() && a.balance().signum() > 0) {
        result.add(a.owner().toUpperCase());
    }
}
Collections.sort(result);
```

```java
List<String> result = accounts.stream()
        .filter(Account::isActive)
        .filter(a -> a.balance().signum() > 0)
        .map(a -> a.owner().toUpperCase())
        .sorted()
        .toList();
```

**Keep the stream.** It is a simple filter, map and sort. Keep a loop when you need early exits, several running totals or checked exceptions.
