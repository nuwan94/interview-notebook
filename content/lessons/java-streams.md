---
title: Java Streams API — pipelines, collectors and parallel streams
nav: Streams
slug: java-streams
summary: How stream pipelines work (lazy, one element at a time), the operations and collectors you need, flatMap, reduce, primitive streams, parallel streams and their pitfalls, with animations and interview questions and coding tasks.
tags: [Java, Streams, Functional]
order: 11
topic: Java / Functional programming
updated: 2026-11-13
subnav: true
---

Streams are in almost every Java interview, both as theory ("what is lazy evaluation?") and as live coding ("group these transactions by account and sum them"). You need [lambdas and functional interfaces](lesson:java-functional) first, and the [collections](lesson:java-collections) the streams read from. Play the four scenes: the pipeline, collectors, `map` versus `flatMap`, and parallel streams.

```demo
name: java-streams-walk
```

> **One sentence to remember:** *a stream is a lazy, single-use pipeline over a source: intermediate operations (`filter`, `map`, `sorted`) describe the steps, one terminal operation (`collect`, `count`, `reduce`) runs them, elements flow through one at a time, and the source is never modified.*

## Pipeline anatomy {#pipeline}

```java
BigDecimal totalDebits = transactions.stream()          // source
        .filter(t -> t.type() == Type.DEBIT)             // intermediate: lazy
        .map(Transaction::amount)                        // intermediate: lazy
        .reduce(BigDecimal.ZERO, BigDecimal::add);       // terminal: runs the pipeline
```

| Part | Examples | Notes |
| --- | --- | --- |
| Source | `list.stream()`, `Arrays.stream(a)`, `Stream.of(...)`, `Files.lines(path)`, `Stream.iterate`, `Stream.generate` | a stream is **not** a data structure; it does not store elements |
| Intermediate | `filter`, `map`, `flatMap`, `distinct`, `sorted`, `limit`, `skip`, `peek`, `takeWhile`, `dropWhile` | return a new `Stream`; lazy |
| Terminal | `collect`, `toList`, `forEach`, `count`, `reduce`, `min`, `max`, `findFirst`, `anyMatch`, `allMatch`, `noneMatch` | trigger execution; the stream is then used up |

Key properties: **lazy** (nothing runs without a terminal operation), **one element at a time** through the whole pipeline (so `limit` and `findFirst` can stop early), **single use** (a second terminal call throws `IllegalStateException`) and **non-interfering** (do not modify the source while streaming).

## Common intermediate operations {#intermediate}

| Operation | Purpose | Stateful? |
| --- | --- | --- |
| `filter(p)` | keep elements matching the predicate | no |
| `map(f)` | transform each element | no |
| `flatMap(f)` | transform each element into a stream and flatten | no |
| `distinct()` | remove duplicates (uses `equals`) | yes, remembers seen |
| `sorted()` / `sorted(cmp)` | sort; needs all elements first | yes, buffers all |
| `limit(n)` / `skip(n)` | first n / drop first n | short-circuit / stateful |
| `peek(c)` | look at elements (debugging only) | no |
| `takeWhile(p)` / `dropWhile(p)` | Java 9: stop or start at the first failing element | short-circuit |

## Terminal operations {#terminal}

```java
long count      = txns.stream().filter(Transaction::isDebit).count();
boolean anyBig  = txns.stream().anyMatch(t -> t.amount().compareTo(LIMIT) > 0);
Optional<Txn> biggest = txns.stream().max(Comparator.comparing(Txn::amount));
List<String> ids = txns.stream().map(Txn::id).toList();      // Java 16: unmodifiable
txns.forEach(audit::record);                                  // for side effects only
```

`anyMatch`, `allMatch`, `noneMatch`, `findFirst` and `findAny` **short-circuit**: they stop as soon as the answer is known.

## Collectors {#collectors}

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

`toMap` throws `IllegalStateException` on duplicate keys unless you pass a merge function as a third argument (`(a, b) -> a`). `groupingBy` returns a `HashMap` of lists by default; pass `TreeMap::new` as the map factory for sorted keys.

## map versus flatMap {#flatmap}

`map` is one to one. `flatMap` takes a function that returns a stream for each element and **flattens** the results into one stream:

```java
List<Account> all = customers.stream()
        .flatMap(c -> c.accounts().stream())     // Stream<Account>, not Stream<List<Account>>
        .toList();

Set<String> words = lines.stream()
        .flatMap(line -> Arrays.stream(line.split("\\s+")))
        .collect(Collectors.toSet());
```

## reduce {#reduce}

`reduce` combines all elements into one value with an associative function.

```java
BigDecimal sum = amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);   // identity + accumulator
Optional<BigDecimal> max = amounts.stream().reduce(BigDecimal::max);           // no identity: Optional
```

The identity must be a true neutral element (`0` for addition) and the function must be associative, or parallel results will be wrong. For sums of numbers prefer `mapToInt(...).sum()`, or `collect(Collectors.summingInt(...))`.

## Primitive streams {#primitive}

`IntStream`, `LongStream` and `DoubleStream` avoid boxing and add `sum`, `average`, `min`, `max`, `summaryStatistics` and `range`/`rangeClosed`.

```java
int total = IntStream.rangeClosed(1, 100).sum();                  // 5050
double avg = accounts.stream().mapToDouble(a -> a.balance().doubleValue()).average().orElse(0);
List<Integer> boxed = IntStream.range(0, 5).boxed().toList();
```

Money should stay in `BigDecimal` (or minor units in `long`), not `double`.

## Parallel streams {#parallel}

`list.parallelStream()` or `.parallel()` splits the work over the common `ForkJoinPool`. It helps only for **large, CPU-bound, stateless** pipelines on easily split sources (`ArrayList`, arrays, `IntStream.range`). Do not use it for blocking I/O, for small data, with shared mutable state, or inside a request-handling service where it competes for the JVM-wide common pool. Always measure.

## Streams versus loops {#vs-loops}

Streams express "what" (filter, map, collect) and are great for transformations and grouping. A plain loop is better when you need early `return`s, mutation of several variables, checked exceptions, or when the stream version becomes hard to read. Do not stream just to look modern.

## Common mistakes {#mistakes}

- Forgetting the terminal operation: nothing happens.
- Reusing a stream: `IllegalStateException`.
- Side effects in `map`/`filter`/`peek` (adding to an outer list): breaks in parallel and is hard to reason about. Use `collect`.
- `toMap` with duplicate keys.
- `sorted()` on a stream of non-`Comparable` objects: `ClassCastException`.
- Using `Optional.get()` after `findFirst()` without a check.
- Infinite streams (`Stream.iterate`, `generate`) without `limit` or `takeWhile`.
- `parallel()` with blocking calls or shared state.

## Cheat sheet {#cheatsheet}

| Goal | Code |
| --- | --- |
| filter and transform to a list | `.filter(p).map(f).toList()` |
| group | `groupingBy(classifier)` |
| count per group | `groupingBy(classifier, counting())` |
| split in two | `partitioningBy(predicate)` |
| index by id | `toMap(Item::id, identity())` |
| flatten | `flatMap(x -> x.children().stream())` |
| sum of numbers | `mapToInt(...).sum()` |
| join strings | `collect(joining(", "))` |
| first match | `filter(p).findFirst()` |
| any match | `anyMatch(p)` |
| top n by a key | `sorted(comparing(K).reversed()).limit(n)` |

## Interview questions {#questions}

### [basic] What is a Stream in Java? {#what-is-stream}

A sequence of elements that supports aggregate operations in a pipeline (filter, map, collect...). It is not a data structure and does not store elements; it pulls them from a source such as a collection, array or file, and does not modify that source.

### [basic] What is the difference between intermediate and terminal operations? {#intermediate-vs-terminal}

Intermediate operations (`filter`, `map`, `sorted`) return a new stream and are lazy: they only add a step to the pipeline. A terminal operation (`collect`, `count`, `forEach`, `reduce`) starts the pipeline and produces a result or side effect, after which the stream is consumed.

### [basic] What does "lazy evaluation" mean for streams? {#lazy}

Intermediate operations do not run until a terminal operation is called, and then elements pass through the pipeline one at a time. That lets short-circuit operations such as `findFirst`, `anyMatch` and `limit` stop early and avoids creating intermediate collections.

### [basic] Can you reuse a stream? {#reuse}

No. After a terminal operation the stream is closed and another operation on it throws `IllegalStateException: stream has already been operated upon or closed`. Call `stream()` on the source again, or use a `Supplier<Stream<T>>`.

### [basic] What is the difference between map and flatMap? {#map-vs-flatmap-q}

`map` transforms each element into exactly one element. `flatMap` transforms each element into a stream and concatenates those streams, so it flattens nested structures: a stream of customers becomes a stream of all their accounts.

### [basic] What is the difference between a stream and a collection? {#stream-vs-collection}

A collection stores data in memory and can be traversed many times. A stream is a one-shot, possibly lazy or infinite view of a computation over a source. Collections are about storage and access; streams are about processing.

### [basic] What is the difference between findFirst and findAny? {#findfirst-findany}

`findFirst` returns the first element in encounter order. `findAny` may return any element, which gives the stream freedom to be faster in parallel. In a sequential stream they normally return the same thing. Both return an `Optional` and short-circuit.

### [basic] How do you convert a stream to a list, set and map? {#to-collections}

`stream.toList()` (Java 16, unmodifiable) or `collect(Collectors.toList())`, `collect(Collectors.toSet())`, `collect(Collectors.toMap(keyFn, valueFn))`. `toMap` fails on duplicate keys unless you supply a merge function.

### [basic] What is the difference between forEach on a collection and forEach on a stream? {#foreach}

`Iterable.forEach` runs over the collection directly in order. `Stream.forEach` ends a pipeline and for parallel streams does not preserve order (use `forEachOrdered`). Neither should be used to accumulate results in an outside variable; use `collect`.

### [intermediate] What do Collectors.groupingBy and partitioningBy do? {#grouping}

`groupingBy(classifier)` returns a `Map<K, List<T>>` grouping elements by a key, optionally with a downstream collector (`counting()`, `summingInt`, `mapping`). `partitioningBy(predicate)` always returns a map with exactly two keys, `true` and `false`.

### [intermediate] What happens with toMap when two elements have the same key? {#tomap-duplicates}

`Collectors.toMap` throws `IllegalStateException: Duplicate key`. Supply a merge function as the third argument, for example `(existing, replacement) -> existing` or `BigDecimal::add`, and a map factory (fourth argument) to choose the map type.

### [intermediate] What is the difference between reduce and collect? {#reduce-vs-collect}

`reduce` folds elements into a single immutable value (a sum, a maximum). `collect` is a mutable reduction into a container (a list, a map, a `StringBuilder`) and is designed to be efficient and parallel-safe. Building a list with `reduce` copies it each time, so use `collect`.

### [intermediate] What are the requirements for the function passed to reduce? {#reduce-rules}

It must be associative and the identity must be a neutral element (`identity op x == x`); otherwise the result differs between sequential and parallel runs. It should also be stateless and non-interfering.

### [intermediate] What are stateless and stateful intermediate operations? {#stateful}

Stateless operations (`filter`, `map`) process each element independently. Stateful ones (`sorted`, `distinct`, `limit`, `skip`) need to see other elements or all of them, and `sorted` must buffer the whole stream before passing anything on, which affects memory and parallel performance.

### [intermediate] What is the difference between Stream and IntStream? {#intstream}

`IntStream` is a primitive specialisation that avoids boxing `Integer` objects and provides `sum`, `average` and `range`. Convert with `mapToInt` and `boxed()`. Use it for numeric work on large data.

### [intermediate] Why shouldn't you modify external state inside a stream operation? {#side-effects}

It makes behaviour depend on execution order and thread, so it is a data race in a parallel stream, and it breaks the "non-interfering, stateless" contract that lets the framework reorder or split the work. Return the result from a `collect` or `reduce` instead of adding to an outside list.

### [intermediate] What does peek do and when should you use it? {#peek}

`peek` runs an action on each element as it flows past, mainly for debugging (printing intermediate values). It is lazy and may not run at all (for example if a later `count()` can compute the size without traversing, or after a short-circuit), so never put required logic in it.

### [intermediate] How would you handle checked exceptions inside a stream lambda? {#checked}

The functional interfaces do not allow them, so catch inside the lambda and wrap in an unchecked exception, or write a small helper that wraps a throwing function, or use a classic loop. Do not let a half-processed stream swallow the exception silently.

### [intermediate] What is a short-circuiting operation? {#short-circuit}

One that can finish without consuming the entire stream: `limit`, `findFirst`, `findAny`, `anyMatch`, `allMatch`, `noneMatch`, `takeWhile`. This is what makes processing infinite streams such as `Stream.iterate(1, n -> n + 1)` possible.

### [deep] When is a parallel stream appropriate, and what are the dangers? {#parallel-q}

When the work is CPU-bound, the data set is large, the source splits well (`ArrayList`, array, range) and operations are stateless and associative. Dangers: shared mutable state, blocking calls starving the common ForkJoinPool (which is shared by the whole JVM), ordering constraints, the overhead of splitting and merging on small data, and poor splitting for `LinkedList` and `Stream.iterate`. Benchmark before and after.

### [deep] How does a parallel stream split and merge the work? {#parallel-internals}

The source's `Spliterator` is recursively split into chunks (`trySplit`), the chunks are processed as ForkJoin tasks in the common pool, and a combiner merges partial results. That is why the accumulator and combiner must be associative and why the characteristics of the source (`SIZED`, `ORDERED`, `SUBSIZED`) influence performance.

### [deep] What is a Spliterator? {#spliterator}

The traversal-and-partition counterpart of `Iterator`: it can traverse elements (`tryAdvance`) and split off part of the data (`trySplit`) so streams can run in parallel. Collections provide their own spliterators, and `StreamSupport.stream(spliterator, parallel)` lets you build a stream from a custom source.

### [deep] How does a stream differ from an Iterator in laziness and resource handling? {#close}

Both are pull-based, but a stream is built as a pipeline and optimised as a whole. Streams from I/O sources (`Files.lines`, `Files.walk`) hold an open resource and must be closed: use try-with-resources.

### [deep] Explain the three-argument reduce and when you need it. {#three-arg-reduce}

`reduce(identity, accumulator, combiner)` is for when the result type differs from the element type: the accumulator folds an element into a partial result, and the combiner merges two partial results (needed for parallel streams). Often `map` followed by the simpler `reduce`, or `collect`, is clearer.

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

For a very large input, a bounded `PriorityQueue` is O(n log k) instead of sorting everything ([collections lesson](lesson:java-collections)).

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

This uses a stateful predicate, which is fine for a sequential stream with a short-circuiting terminal, but is not safe to parallelise. A plain loop is equally clear.

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

Keep the stream: it is a straight filter, map and sort. Keep a loop when you need early exits, several accumulators or checked exceptions.
