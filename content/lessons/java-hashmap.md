---
title: Java HashMap — how it works inside
slug: java-hashmap
summary: Buckets, hash codes, collisions, treeification, resizing and the hashCode()/equals() contract — with animations you can replay and interview questions with sample answers.
tags: [Java, Collections, Data structures]
order: 1
topic: Java / Collections
updated: 2026-11-12
---

Read the sections top to bottom once, play every animation, then jump to the **interview questions** and answer each one out loud before opening it. Words with a dotted underline explain themselves when you hover, focus or tap them.

## The one-minute picture {#overview}

A `HashMap` is an **array of buckets**. To store or find a key it does four things:

1. Ask the key for its `hashCode()`, a 32-bit int.
2. Mix the high bits into the low bits: `h ^ (h >>> 16)`.
3. Keep only the low bits to get a bucket number: `(n - 1) & hash`.
4. Look inside that bucket. Compare the stored hash first, then `==` and `equals()`.

Two different keys can end up in the same bucket. That is a collision, and the bucket then holds a chain of nodes. If the chain gets long the bucket becomes a tree, and if the whole table gets too full the array doubles.

> **Say it in one breath:** an array of buckets; the hash picks the bucket; `equals()` picks the entry inside it; collisions are chained (and treeified when long); the table doubles at 75% full.

| Constant | Value | What it means |
| --- | --- | --- |
| default capacity | 16 | buckets in a new map (allocated on the first `put`) |
| load factor | 0.75 | how full the table may get before it grows |
| threshold | 12 | `16 × 0.75`: the 13th entry triggers a resize |
| `TREEIFY_THRESHOLD` | 8 | a bucket with more than 8 nodes is a candidate for a tree |
| `MIN_TREEIFY_CAPACITY` | 64 | below 64 buckets, HashMap resizes instead of treeifying |
| `UNTREEIFY_THRESHOLD` | 6 | a tree shrinks back to a list at 6 nodes or fewer |
| maximum capacity | 2³⁰ | about a billion buckets |

## Anatomy of a HashMap {#anatomy}

Everything lives in a handful of fields. This is a simplified view of `java.util.HashMap` (Java 8+):

```java
transient Node<K,V>[] table;   // the buckets; null until the first put
transient int size;            // number of entries
transient int modCount;        // structural changes, used by fail-fast iterators
int threshold;                 // resize when size > threshold
final float loadFactor;        // 0.75f by default

static class Node<K,V> implements Map.Entry<K,V> {
    final int hash;            // the spread hash, stored so it is never recomputed
    final K key;
    V value;
    Node<K,V> next;           // next node in the same bucket (the chain)
}
```

Notice that each node **stores its hash**. That makes a lookup cheaper (compare two ints before calling `equals()`) and makes a resize cheaper (nobody calls `hashCode()` again).

An empty bucket is just `null`. A bucket with one entry holds one node. A bucket with several entries holds a chain, or after treeification a tree of `TreeNode`s.

## Step 1: from key to bucket {#bucket-index}

The index calculation is two lines in the JDK:

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}

int index = (n - 1) & hash;     // n = table.length, always a power of two
```

Play the animation. Watch the 32 bits: the highlighted low bits are the only ones that choose the bucket in a 16-bucket table.

```demo
name: bucket-index
```

**Why `(n - 1) & hash` and not `%`?** Because `n` is a power of two, `n - 1` is a row of 1-bits (`16 - 1 = 0b1111`). ANDing with it keeps just the low bits, which equals `hash mod n` but is faster and never negative. `hashCode()` can be negative, and in Java `-7 % 16` is `-7`, which is not a valid array index.

**Why spread the bits with `h ^ (h >>> 16)`?** In a small table only the low bits count. Without the spread, two hash codes that differ only in their high bits would always collide. XOR-ing the top 16 bits into the bottom 16 lets every bit influence the bucket, at almost no cost.

**Why must the capacity be a power of two?** For the mask trick above, and because it makes resizing cheap (see [Resizing](#resize)).

## Step 2: put() and get() {#put-get}

`put(key, value)` follows these steps (`putVal` in the source):

1. If the table is `null` or empty, allocate it (`resize()`), 16 buckets by default.
2. Compute `i = (n - 1) & hash`.
3. If bucket `i` is empty, put a new node there. Done.
4. Otherwise compare the first node. Same key? Remember it as `e`.
5. If the bucket is a tree, ask the tree. If it is a chain, walk it; at the end append a new node at the **tail**. If the chain now has more than 8 nodes, call `treeifyBin`.
6. If an existing node `e` was found, replace its value and return the old value. The size does not change.
7. Otherwise increase `modCount` and `size`; if `size > threshold`, resize.

`get(key)` is steps 2 to 5 without the writing. The test used at every node is:

```java
e.hash == hash && ((k = e.key) == key || (key != null && key.equals(k)))
```

The order is deliberate, **cheapest check first**: an int comparison, then reference equality, and only then the possibly expensive `equals()`. This is also why the contract says equal keys must have equal hash codes: if the hashes differ, `equals()` is never even asked.

> **Gotcha:** replacing a value does not replace the key. If `put` finds an equal key, the *old key object* stays in the node and only the value changes.

## Collisions {#collisions}

A collision happens when two keys map to the same bucket. It is not a bug: there are about four billion possible hash codes and only a few buckets, so by the pigeonhole principle collisions are certain. HashMap uses **separate chaining**: each bucket holds a linked list of nodes.

There are two kinds, and the animation shows both:

- **Same bucket, different hash.** `"banana"` and `"date"` have different hash codes; only their low bits agree. The stored hash gives them away instantly, so `equals()` is never called.
- **Same hash, different keys.** `"Aa"` and `"BB"` both have `hashCode() == 2112`. Only `equals()` can tell them apart.

```demo
name: collision-chain
```

Two details worth remembering:

- **Java 8 appends at the tail** of a chain; Java 7 inserted at the head. That matters for the old concurrent-resize bug, and for how order is kept when resizing.
- A lookup in a chain costs O(chain length). With a decent hash function the average chain is well under 1, which is where the "average O(1)" comes from.

Try `Aa`, `BB`, `AaAa` and `BBBB` in the box above: strings built from `"Aa"` and `"BB"` blocks all share a hash, which is how people craft collisions on purpose (see the hash-flooding question).

## Chains become trees {#treeify}

Since Java 8 (JEP 180) a long chain can turn into a **red-black tree**, so a lookup costs O(log n) instead of O(n). The rule has two parts and people often forget the second:

- The chain must grow past `TREEIFY_THRESHOLD` (8): the **9th** node triggers `treeifyBin`.
- The table must have at least `MIN_TREEIFY_CAPACITY` (64) buckets. If it is smaller, `treeifyBin` **resizes the table instead**, hoping the keys will spread out.

Play the animation and watch what happens at the 9th, 10th and 11th key. All of them share bucket 1, so the table doubles twice before the tree appears.

```demo
name: treeify
```

Why 8? The JDK source explains that with well-spread hash codes, the number of nodes per bucket follows a Poisson distribution with a mean around 0.5. The chance of reaching 8 is about 0.00000006, so trees only appear when the hash function is bad or someone is attacking it. Tree nodes are about twice as big as plain nodes, which is another reason not to use them eagerly.

Why 6 for the way back? A gap between 8 and 6 stops a bucket from flipping between list and tree if it hovers around the limit.

> **Interview tip:** if you only say "treeifies at 8", an interviewer will ask "always?". The complete answer: more than 8 nodes *and* a table of at least 64 buckets, otherwise it resizes.

## Resizing and the load factor {#resize}

When `size` exceeds `threshold` (capacity × load factor), HashMap allocates a table twice as big and moves the nodes over. Because the capacity is a power of two and doubles, each node has only two possible destinations in the new table:

- stay at the same index `i`, if `hash & oldCap == 0` (the "lo" group), or
- move to `i + oldCap`, if `hash & oldCap != 0` (the "hi" group).

One bit of the stored hash decides. Nothing is rehashed, no `hashCode()` is called, and the relative order inside each chain is preserved.

```demo
name: resize
```

Resizing costs O(n) once, but it happens rarely (the table doubles each time), so the cost per `put` is **amortized** O(1). The table never shrinks.

**Pre-sizing.** If you know roughly how many entries are coming, size the map up front. The constructor argument is a *capacity*, not an entry count, and it is rounded up to a power of two:

```java
// 100 entries: 100 / 0.75 = 133.3 -> ask for 134 -> capacity 256, threshold 192, no resize
Map<String, Integer> a = new HashMap<>(134);

// new HashMap<>(100) is a trap: capacity 128, threshold 96, so the 97th put resizes

// Java 19+ does the arithmetic for you
Map<String, Integer> b = HashMap.newHashMap(100);
```

**Trade-off of the load factor.** A lower value (say 0.5) wastes memory but keeps chains short. A higher value (say 1.0) saves memory and slows lookups. 0.75 is the JDK's compromise; there is rarely a reason to change it.

## hashCode() and equals() {#contract}

A `HashMap` only works if the key class obeys the **contract**:

1. **Consistent:** while the object is not modified, `hashCode()` returns the same value every time.
2. **Equal means same hash:** if `a.equals(b)` then `a.hashCode() == b.hashCode()`.
3. Unequal objects *may* share a hash code. It is allowed but costs speed.

The default `Object.equals` compares identity, and the default `Object.hashCode` is an identity-based number. For classes that represent *values* you must override both, together. The animation shows two objects with the same coordinates, `p1` and `p2`, and what each combination of overrides does. Step through all four tabs.

```demo
name: contract
```

A correct key class, the classic way and the modern way:

```java
public final class Point {
    private final int x, y;
    public Point(int x, int y) { this.x = x; this.y = y; }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Point p)) return false;   // pattern matching, Java 16+
        return x == p.x && y == p.y;
    }

    @Override public int hashCode() { return Objects.hash(x, y); }
}

// Java 16+: equals, hashCode and toString are generated for you
public record Point(int x, int y) {}
```

**Rules of thumb.** Use the same fields in both methods. Prefer **immutable** keys (`String`, `Integer`, enums, records). Never use arrays as keys: their `hashCode()` is identity-based, so `map.get(new int[]{1, 2})` will not find `new int[]{1, 2}`. And never mutate a field that feeds `hashCode()` while the object is inside a map: the "Mutable key trap" tab shows the entry stranded in a bucket nobody will ever look in.

## Behaviours worth knowing {#behaviours}

- **Null.** One `null` key is allowed; its hash is defined as 0, so it lives in bucket 0. Any number of `null` values are allowed.
- **No order.** Iteration goes bucket by bucket, so the order depends on hash codes and on the capacity, and it can change after a resize. Never depend on it.
- **Fail-fast iterators.** Each structural change bumps `modCount`; an iterator remembers the value it saw and throws `ConcurrentModificationException` if it differs. It is a best-effort bug detector, not a guarantee. Remove during iteration with `iterator.remove()` or `removeIf`.
- **Not thread-safe.** Concurrent writers can lose updates. In Java 7 a concurrent resize could also create a cycle in a chain, and a later `get` would spin forever at 100% CPU.
- **Memory.** Each entry costs a node object (about 32 bytes with compressed pointers) plus a table slot, on top of the key and value objects.

| Map | Order | Null key | Thread-safe | get / put |
| --- | --- | --- | --- | --- |
| `HashMap` | none | one | no | O(1) average |
| `LinkedHashMap` | insertion or access | one | no | O(1) |
| `TreeMap` | sorted by key | no (natural ordering) | no | O(log n) |
| `Hashtable` | none | no | yes, one big lock | O(1) |
| `ConcurrentHashMap` | none | no | yes, fine-grained | O(1) |

## Cheat sheet {#cheatsheet}

- `index = (n - 1) & (h ^ (h >>> 16))`; `n` is a power of two.
- Defaults: capacity 16, load factor 0.75, threshold 12. Table allocated on first `put`.
- Compare order at a node: stored hash, then `==`, then `equals()`.
- Chain → tree when a bucket exceeds 8 nodes **and** the table has at least 64 buckets; otherwise resize. Tree → list at 6 or fewer.
- Resize: double, and each node stays (`hash & oldCap == 0`) or moves by `oldCap`. No rehash.
- Average O(1); worst case O(log n) with a tree and `Comparable` keys, O(n) otherwise.
- Keys: immutable, with consistent `hashCode()` and `equals()`.
- Thread safety: `ConcurrentHashMap`, never plain `HashMap`.

## Interview questions {#questions}

Questions are tagged by how deep they go: **basic** (screening call), **intermediate** (typical technical round), **deep** (senior or "why" follow-ups) and **coding** (whiteboard). Use the filters, try to answer first, then open each one.

### [basic] How does a HashMap work internally? {#how-it-works}

**Thirty-second answer.** A HashMap stores entries in an array of buckets. For a key it calls `hashCode()`, spreads the bits with `h ^ (h >>> 16)`, and takes `(n - 1) & hash` as the bucket index. If the bucket is empty the new node goes there. If not, it walks the chain comparing the stored hash and then `equals()`: a match replaces the value, otherwise the new node is appended at the tail. When a chain gets too long (more than 8 nodes, table at least 64 buckets) it becomes a red-black tree. When the size passes capacity × 0.75 the table doubles. `get` does the same lookup. Average cost is O(1).

**Follow-ups to expect:** why a power of two, what happens on collision, what changed in Java 8, is it thread-safe.

### [basic] What are the default capacity, load factor and threshold? {#defaults}

Capacity **16**, load factor **0.75**, so the threshold is **12**: the 13th entry makes the table grow to 32 buckets (threshold 24). The table is allocated lazily on the first `put`. A capacity you pass to the constructor is rounded up to the next power of two. The maximum is 2³⁰.

### [basic] What is a hash collision, and how does HashMap handle it? {#collision-q}

A collision is two different keys mapping to the same bucket. They are unavoidable because there are far more possible keys than buckets. HashMap uses **separate chaining**: the bucket holds a linked list of nodes, and the lookup walks it comparing hash then `equals()`. Since Java 8, a chain of more than 8 nodes in a table of at least 64 buckets is converted to a red-black tree, so a bucket costs O(log n) rather than O(n).

### [basic] What is the time complexity of get and put? {#complexity}

- **Average:** O(1) for both, as long as the hash function spreads keys well.
- **Worst case:** O(n) if every key lands in one bucket and the bucket is a list (Java 7 and earlier). In Java 8+ a tree bucket gives **O(log n)**, provided the keys are `Comparable`.
- A **resize** is O(n), but it is rare, so `put` is amortized O(1).
- **Iteration** is O(capacity + size), so a huge, mostly empty map is slow to iterate.

### [basic] Does HashMap allow null keys and values? {#nulls}

Yes: **one** `null` key (its hash is 0, so it sits in bucket 0) and any number of `null` values. `Hashtable` and `ConcurrentHashMap` allow neither. A consequence: `map.get(k) == null` can mean "absent" or "mapped to null", so use `containsKey` when the difference matters.

### [basic] What is the difference between HashMap and Hashtable? {#hashmap-vs-hashtable}

- `Hashtable` is legacy (Java 1.0): every method is `synchronized` on one lock, so it is thread-safe but slow under contention. `HashMap` is unsynchronized and faster.
- `Hashtable` rejects `null` keys and values; `HashMap` allows them.
- `Hashtable` uses `(hash & 0x7FFFFFFF) % length` with a default capacity of 11 and grows to `2n + 1`; `HashMap` uses power-of-two sizes and a bit mask.
- `HashMap` has tree bins since Java 8. `Hashtable` does not.
- For thread safety use `ConcurrentHashMap`, not `Hashtable`.

### [basic] What is the difference between HashMap, LinkedHashMap and TreeMap? {#map-flavours}

- `HashMap`: no ordering, O(1).
- `LinkedHashMap`: a HashMap plus a doubly linked list through the entries, so iteration follows insertion order, or access order if you ask for it. O(1). It is the easy way to build an LRU cache.
- `TreeMap`: a red-black tree, keys kept sorted (natural order or a `Comparator`), O(log n), supports range queries such as `floorKey` and `subMap`. No hashing, so no `hashCode()` needed, but keys must be comparable.

### [basic] Is HashMap thread-safe? What do you use instead? {#thread-safe}

No. Two threads calling `put` at the same time can lose updates, and a `get` racing with a resize can miss entries. In Java 7 concurrent resizes could even create a cycle in a chain and hang a thread. Options: `ConcurrentHashMap` (the default choice), `Collections.synchronizedMap` (one lock around everything), or confining the map to one thread. See the "make it thread-safe" question for trade-offs.

### [basic] What happens when you put() a key that already exists? {#duplicate-key}

The lookup finds the node whose key `equals()` the new key. HashMap **replaces the value**, keeps the old key object, returns the old value, and leaves `size` and `modCount` unchanged. If the key was new, `put` returns `null`.

### [basic] Is the iteration order of a HashMap guaranteed? {#iteration-order}

No. Iteration walks the table bucket by bucket, so the order depends on the hash codes and the capacity, and it can change after a resize. Code that works "because it came out in the right order" is a bug waiting to happen. Use `LinkedHashMap` for insertion order or `TreeMap` for sorted order. (The immutable `Map.of(...)` collections even randomize their order per JVM run on purpose.)

### [basic] How are HashSet and HashMap related? {#hashset}

`HashSet` is a thin wrapper around a `HashMap`. Its elements are the map's **keys**, and every value is the same dummy object (`PRESENT`). `add(e)` is `map.put(e, PRESENT) == null`. So a `HashSet` inherits all of HashMap's behaviour, including the need for a correct `hashCode()`/`equals()` on its elements.

### [basic] Why should map keys be immutable? {#immutable-keys}

The bucket is chosen from the key's hash code at insertion time. If a field that feeds `hashCode()` changes later, the key now hashes somewhere else: `get` looks in the wrong bucket and reports "not found", while the entry still sits in the old bucket, still referenced, and can never be removed or reached. `String`, `Integer`, enums and records are safe choices because they cannot change.

### [intermediate] Explain the hashCode() and equals() contract. What breaks if you override only one? {#contract-q}

**The contract:** if `a.equals(b)` then `a.hashCode() == b.hashCode()`; `hashCode()` must be stable while the object is unchanged; unequal objects may share a hash code.

- **Only `equals()` overridden:** two equal objects keep their different identity hash codes, so they usually land in different buckets. `map.get(equalKey)` returns `null`, and a `HashSet` happily stores both "duplicates". It can even work by luck (1 time in 16 in a 16-bucket table), which makes it a nasty bug to find.
- **Only `hashCode()` overridden:** equal-looking objects reach the same bucket, but `equals()` still compares identity, so the lookup does not match. You get collisions with no benefit.

Always override both, over the same fields, and prefer immutable keys.

### [intermediate] How is the bucket index calculated, and why use (n - 1) & hash instead of %? {#index-formula}

`index = (n - 1) & hash`, where `hash = h ^ (h >>> 16)` and `n` is the table length. Because `n` is a power of two, `n - 1` is a mask of low 1-bits, so the AND keeps the low bits of the hash: the same result as `hash mod n` for non-negative numbers, but a single cheap CPU instruction instead of a division. It is also **never negative**, whereas `hashCode() % n` can be, and a negative index would throw.

### [intermediate] Why is the capacity always a power of two? {#power-of-two}

Three reasons: (1) it lets `(n - 1) & hash` replace the modulo operation; (2) every bit of the mask is used, so all buckets are reachable; (3) when the table doubles, each node either stays at index `i` or moves to `i + oldCap`, decided by a single bit (`hash & oldCap`), so a resize needs no recalculation. HashMap enforces this with `tableSizeFor`, which rounds any requested capacity up to the next power of two.

### [intermediate] Why does HashMap XOR the hash with its upper 16 bits? {#spread}

In a small table only the lowest bits pick the bucket. Hash codes that differ only in their upper bits (for example some `Float` values, or numbers that are multiples of a large power of two) would all fall into the same few buckets. `h ^ (h >>> 16)` folds the high half into the low half so every bit of the hash affects the index. It costs one shift and one XOR, and it is a cheap defence against poorly distributed hash codes. Java 7 used a longer sequence of shifts; Java 8 simplified it because tree bins now limit the damage of collisions.

### [intermediate] What is the load factor, and why is the default 0.75? {#load-factor}

The load factor is how full the table may get before it grows: resize when `size > capacity × loadFactor`. A lower value means fewer collisions but more wasted memory; a higher value saves memory but lengthens chains. 0.75 is a well-tested compromise between time and space (the JDK source notes that at this level the number of nodes per bucket follows a Poisson distribution with a mean around 0.5, so long chains are very rare).
### [intermediate] What happens during a resize? Are all keys rehashed? {#resize-q}

The table is replaced by one twice as large and every node is moved. But **no hash is recomputed**: each node stores its hash, and the capacity is a power of two, so one bit (`hash & oldCap`) decides whether it stays at index `i` or goes to `i + oldCap`. Each chain is split into a "lo" and a "hi" list, preserving relative order. The cost is O(n), paid rarely, hence amortized O(1) per `put`. In Java 7 the nodes were re-indexed one by one and inserted at the head, which reversed chains and caused the concurrent-resize loop.

### [intermediate] What changed in HashMap in Java 8? {#java8}

- **Tree bins:** long chains turn into red-black trees (JEP 180), improving the worst case from O(n) to O(log n).
- **Tail insertion** instead of head insertion, and resize that preserves node order (no more reversed chains).
- **Simplified hash function:** `h ^ (h >>> 16)`.
- **Cheaper resize:** the lo/hi split using one bit, with no re-hash.
- New functional methods on `Map`: `computeIfAbsent`, `merge`, `getOrDefault`, `forEach`.
- The optional alternative String hashing of Java 7 was removed; trees replaced it as the defence.

### [intermediate] How does get() decide it found the right entry? {#get-compare}

After picking the bucket it examines nodes in order. For each node it tests `node.hash == hash && (node.key == key || key.equals(node.key))`: the stored hash first (a cheap int compare that rejects almost every non-match), then reference equality, then `equals()`. So `equals()` is only called when the hashes already match. In a tree bin the descent is guided by the hash and, for ties, by `compareTo` when the keys are comparable.

### [intermediate] What is a fail-fast iterator? How do you remove entries safely during iteration? {#fail-fast}

HashMap's iterators remember `modCount` when they are created and check it on every step; if the map was structurally modified in between, `ConcurrentModificationException` is thrown. It is *best-effort*: it detects bugs, it does not guarantee anything in concurrent code (and removing the second-to-last element can even slip through without an exception).

Safe ways to remove while iterating:

```java
map.entrySet().removeIf(e -> e.getValue() < 0);        // simplest

Iterator<Map.Entry<String, Integer>> it = map.entrySet().iterator();
while (it.hasNext()) {
    if (it.next().getValue() < 0) it.remove();         // the iterator's own remove is allowed
}
```

Calling `map.remove(key)` inside a for-each loop is the classic mistake.

### [intermediate] How do you pre-size a HashMap to avoid resizing? {#presize}

Compute the capacity from the expected number of entries: `capacity ≥ expected / 0.75`. Pass that to the constructor, and HashMap rounds it up to a power of two. For 100 entries ask for 134 (→ 256 buckets). The common mistake is `new HashMap<>(100)`: that gives 128 buckets and a threshold of 96, so the 97th entry still triggers a resize. On Java 19+ use `HashMap.newHashMap(100)`.

### [intermediate] What happens if hashCode() always returns the same value? {#constant-hash}

Everything still **works**, because correctness comes from `equals()`, but every key lands in one bucket and the map degrades into a single chain. Each lookup is O(n) (and the table keeps resizing pointlessly until it reaches 64 buckets and the bucket treeifies). With `Comparable` keys the tree gives O(log n); with non-comparable keys the tree cannot order them and lookups may need to search both subtrees. Moral: a legal hash function is not necessarily a good one.

### [intermediate] Can you use a mutable object as a key? What can go wrong? {#mutable-key}

You can, but you must not change any field used by `hashCode()`/`equals()` while the object is in the map. If you do, the entry stays in the bucket chosen from the *old* hash while lookups use the *new* hash: `get` and `containsKey` return "not found", `remove` fails, but the entry is still counted in `size`, still iterates, and still occupies memory: a **memory leak** that is very hard to see. Fix: use immutable keys, or remove the entry before changing the key and put it back afterwards.

### [intermediate] How would you make a HashMap thread-safe, and which option do you pick? {#make-thread-safe}

- **`ConcurrentHashMap`**: the default choice. Lock-free reads, writes that lock at most one bucket, atomic `compute`, `merge`, `putIfAbsent`. No null keys or values.
- **`Collections.synchronizedMap(map)`**: one lock for every method. Simple, but every thread queues up, and iteration still has to be wrapped in `synchronized (map)` by hand.
- **`Hashtable`**: same as above, legacy, avoid.
- **Immutability / confinement:** build the map once and publish it as unmodifiable (`Map.copyOf`), or keep it inside one thread.

Mention that compound actions ("check, then put") are only atomic with the dedicated methods such as `putIfAbsent`/`computeIfAbsent`; two separate calls on any thread-safe map are still a race.

### [intermediate] What is the difference between keySet(), values() and entrySet()? {#views}

They are **live views** over the same map, not copies: removing from the view removes from the map, and changes to the map show in the view (adding through a view is not supported). Prefer `entrySet()` when you need both key and value; looping over `keySet()` and calling `get(key)` repeats a hash lookup for every key.

### [intermediate] Which classes make good HashMap keys? {#good-keys}

**Good:** `String` (immutable, and it caches its hash code), `Integer`/`Long` and the other wrappers, enums (or `EnumMap`), records and any immutable value class with a proper `hashCode()`/`equals()`. **Avoid:** arrays (identity hash code; wrap them in a `List` or use `Arrays.hashCode`), mutable objects, and JPA entities whose `hashCode()` uses a database id that is `null` until the entity is saved (the hash changes at `persist()`).

### [intermediate] A key you are sure is in the map returns null from get(). How do you debug it? {#debug-missing-key}

Check these in order:

1. **Wrong key type.** `Map<Long, String>` and `map.get(1)` pass an `Integer`; `Integer` is never equal to `Long`, so the result is `null`. Use `1L`.
2. **Mutated key.** A field used by `hashCode()` changed after insertion. Print `key.hashCode()` now and compare with the hash stored when it was put.
3. **Broken contract.** `equals()` overridden without `hashCode()` (or over different fields).
4. **`equals()` that is not symmetric** or compares different classes (`getClass()` versus `instanceof` mismatch in subclasses).
5. **Floating point or `BigDecimal` keys:** `new BigDecimal("1.0")` and `new BigDecimal("1.00")` are *not* equal (scale matters) and have different hash codes.
6. A concurrent writer on a plain `HashMap`.

### [deep] Exactly when does a bucket turn into a tree, and why 8, 6 and 64? {#treeify-q}

`treeifyBin` is called when appending a node makes a chain longer than `TREEIFY_THRESHOLD` (8), that is, on the **9th** node. Then:

- If the table has fewer than `MIN_TREEIFY_CAPACITY` (**64**) buckets, HashMap **resizes** instead: a small table with a long chain usually means the table is too small, and doubling often splits the chain.
- Otherwise the nodes become `TreeNode`s in a red-black tree.

**Why 8:** with decent hash codes the bucket size is Poisson-distributed with mean about 0.5, and the probability of 8 is about 0.00000006, so trees are practically only seen with bad or malicious hashes. Tree nodes cost about twice the memory, so they are used reluctantly.

**Why 6 for the way back:** `UNTREEIFY_THRESHOLD` is lower than 8 to give hysteresis, so a bucket hovering around the limit does not flip between list and tree. A tree is converted back during a **resize split** when a half has 6 nodes or fewer, and on removal when the tree gets too small.

**Why 64:** below that the table is cheap to double, and a larger table is the better cure for collisions.

### [deep] How does a tree bin order its nodes, and what if the keys are not Comparable? {#tree-order}

Nodes are ordered by **hash** first. If two hashes are equal and both keys are instances of the same class that implements `Comparable<thatClass>`, `compareTo` breaks the tie. If that is impossible, `tieBreakOrder` compares class names and finally `System.identityHashCode`. The identity tie-break only keeps the tree consistent for inserts; it cannot help a lookup, so when many keys share a hash and are not comparable, `find` must search **both** subtrees and degrades towards O(n). So a bad `hashCode()` is only rescued by trees when the keys are also `Comparable` (such as `String` or `Integer`).

### [deep] Explain the Java 7 infinite loop caused by concurrent resize. {#java7-loop}

Java 7's `transfer()` moved each node to the **head** of its new bucket, which reverses the order of a chain (A → B becomes B → A). Suppose two threads resize at once. Thread 1 is paused after reading `e = A` and `next = B`. Thread 2 completes the whole resize, leaving B → A in the new table. Thread 1 resumes with its stale pointers: it puts A at the head, then moves on to B (whose `next` is now A) and puts B at the head, and A.next ends up pointing at B while B.next points at A. The chain is now a **cycle**, and any later `get` that walks that bucket never terminates, burning 100% CPU.

Java 8 keeps the original order (lo/hi lists with tail insertion), which removes this specific cycle. But `HashMap` is still **not** thread-safe: updates can be lost, and a resize racing with a write can drop entries. The fix is `ConcurrentHashMap`, not "it's fixed in Java 8".

### [deep] How does ConcurrentHashMap work internally (Java 8+)? {#chm}

- It has the same table-of-bins layout as HashMap, with the same tree bins.
- **Empty bucket:** the first node is inserted with a **CAS**, no lock at all.
- **Non-empty bucket:** the thread takes a `synchronized` lock on the **first node** of that bucket only, so writers to different buckets never block each other.
- **Reads are lock-free**: node fields `value` and `next` are `volatile`.
- **Size** is kept in a base counter plus striped counter cells (the idea behind `LongAdder`) to avoid a contended counter; `size()` is an estimate under concurrency.
- **Resize** is cooperative: threads that arrive during a resize help move bins in chunks.
- No `null` keys or values; its iterators are *weakly consistent* (never throw `ConcurrentModificationException`).

Java 7 instead split the map into 16 `Segment`s (each a `ReentrantLock`) by default, which capped concurrency; Java 8 replaced that with per-bin locking.

### [deep] Why does ConcurrentHashMap not allow null keys or values? {#chm-null}

Because `get(k) == null` would be ambiguous: either the key is absent or it is mapped to `null`. In a plain map you can resolve it with `containsKey(k)`, but in a concurrent map the state may change between the two calls, so no correct answer exists. Disallowing `null` makes `null` mean "absent" unambiguously. (This is the reasoning given by the designers of `ConcurrentHashMap`.)

### [deep] What is the memory overhead of a HashMap entry? {#memory}

Roughly **32 bytes per node** on a 64-bit JVM with compressed pointers (12-byte object header, `hash` 4, `key` 4, `value` 4, `next` 4 = 28, rounded up to 32), plus **4 bytes** for the table slot, plus the key and value objects themselves (a boxed `Integer` is 16 bytes). At a load factor of 0.75 the table is between 37% and 75% full, so there are also empty slots. A tree node is about twice a plain node. For millions of small primitive keys this is why people use specialised collections (fastutil, Eclipse Collections, Koloboke) or `EnumMap`.

### [deep] What is a hash-flooding attack, and how does Java defend against it? {#hash-flooding}

If an attacker can choose the keys (HTTP parameters, JSON field names) and knows the hash function, they can send thousands of keys with the same hash code so one bucket becomes a long chain, and each request costs O(n) instead of O(1): a cheap denial-of-service. For `String` it is easy to produce collisions because of blocks such as `"Aa"`/`"BB"`. Defences: Java 8 tree bins make the per-lookup cost O(log n) for `Comparable` keys (JEP 180 replaced Java 7's optional alternative hashing); frameworks cap the number of parameters and request size; and sensitive code can use a keyed or randomized hash.

### [deep] Why doesn't HashMap shrink, and does remove() free memory? {#no-shrink}

`remove` unlinks the node (which can then be garbage-collected), but the table array keeps its length. The table only ever **doubles**. A map that once held a million entries and now holds ten still has a million-slot array, and iteration still scans every slot. If that matters, build a new `HashMap` from the survivors (`new HashMap<>(old)`) or `clear()` and reuse it carefully (`clear()` empties buckets but also keeps the array).

### [deep] What are the pitfalls of computeIfAbsent, compute and merge? {#compute-pitfalls}

- The **mapping function must not modify the same map**. In Java 9+, `HashMap` detects it and throws `ConcurrentModificationException` (earlier versions could corrupt the map). That bites recursive memoization such as a Fibonacci cache that calls `computeIfAbsent` recursively.
- On `ConcurrentHashMap` a recursive update can **deadlock or throw** `IllegalStateException("Recursive update")`.
- They are atomic only on `ConcurrentHashMap`. On `HashMap` they are just convenient.
- Returning `null` from the function means "no mapping": `compute` removes the key and `computeIfAbsent` stores nothing.
- Keep the function short, especially on `ConcurrentHashMap`, because it runs while the bucket is locked.

`merge(word, 1, Integer::sum)` is the idiomatic word counter.

### [deep] How do HashMap.equals() and hashCode() work, and can a map be a key? {#map-equals}

`AbstractMap.equals` says two maps are equal if they contain the same mappings, regardless of the map class (a `HashMap` can equal a `TreeMap`). `hashCode()` is the **sum of the hash codes of the entries**, where an entry's hash is `Objects.hashCode(key) ^ Objects.hashCode(value)`. Summing makes it independent of iteration order. A map *can* be used as a key, but it is mutable, so changing it afterwards breaks the container it sits in, and computing the hash is O(n) each time. Use `Map.copyOf` if you really need an immutable map key.

### [deep] Why is HashMap's table transient, and how is a HashMap serialized? {#serialization}

The `table` field is `transient`, so default serialization skips it. `writeObject` writes the capacity, the size and then each key and value; `readObject` rebuilds the table by calling `putVal` for each entry. The bucket layout is not serialized because it depends on hash codes, and hash codes are **not guaranteed to be the same in another JVM** (identity hashes certainly are not, and some classes' hash codes depend on JVM state). Recomputing the layout on load is the only safe approach.

### [coding] Implement a simple HashMap with put, get, remove and resize. {#implement}

Keep it small, say aloud what you skip (generics bounds, treeification, iterators, null checks beyond the key).

```java
public class SimpleHashMap<K, V> {
    private static class Node<K, V> {
        final int hash; final K key; V value; Node<K, V> next;
        Node(int hash, K key, V value, Node<K, V> next) {
            this.hash = hash; this.key = key; this.value = value; this.next = next;
        }
    }

    private Node<K, V>[] table = newTable(16);
    private int size;

    @SuppressWarnings("unchecked")
    private static <K, V> Node<K, V>[] newTable(int n) { return (Node<K, V>[]) new Node[n]; }

    private static int hash(Object key) {
        int h;
        return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
    }

    public V get(Object key) {
        int h = hash(key);
        for (Node<K, V> e = table[(table.length - 1) & h]; e != null; e = e.next)
            if (e.hash == h && Objects.equals(e.key, key)) return e.value;
        return null;
    }

    public V put(K key, V value) {
        int h = hash(key);
        int i = (table.length - 1) & h;
        Node<K, V> last = null;
        for (Node<K, V> e = table[i]; e != null; last = e, e = e.next) {
            if (e.hash == h && Objects.equals(e.key, key)) {
                V old = e.value; e.value = value; return old;     // replace
            }
        }
        Node<K, V> n = new Node<>(h, key, value, null);
        if (last == null) table[i] = n; else last.next = n;        // append at the tail
        if (++size > table.length * 0.75) resize();
        return null;
    }

    public V remove(Object key) {
        int h = hash(key);
        int i = (table.length - 1) & h;
        Node<K, V> prev = null;
        for (Node<K, V> e = table[i]; e != null; prev = e, e = e.next) {
            if (e.hash == h && Objects.equals(e.key, key)) {
                if (prev == null) table[i] = e.next; else prev.next = e.next;
                size--;
                return e.value;
            }
        }
        return null;
    }

    private void resize() {
        Node<K, V>[] old = table;
        table = newTable(old.length * 2);
        for (Node<K, V> head : old) {
            for (Node<K, V> e = head; e != null; ) {
                Node<K, V> next = e.next;
                int i = (table.length - 1) & e.hash;               // stored hash reused
                e.next = table[i]; table[i] = e;                   // simple head insert
                e = next;
            }
        }
    }

    public int size() { return size; }
}
```

**Talking points:** storing the hash avoids recomputing it; `Objects.equals` makes a `null` key safe; resizing doubles so the mask trick still works; the real class additionally keeps chain order on resize, treeifies long chains and detects concurrent modification.

### [coding] Write a correct equals() and hashCode() for an Employee class. {#equals-hashcode-code}

Decide first what identity means. Here two employees are the same person when they have the same `id`; the other fields describe state that may change.

```java
public final class Employee {
    private final long id;          // business key: never changes
    private String name;            // mutable, deliberately NOT part of equals/hashCode
    private String department;

    public Employee(long id, String name, String department) {
        this.id = id; this.name = name; this.department = department;
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Employee other)) return false;
        return id == other.id;
    }

    @Override public int hashCode() { return Long.hashCode(id); }
}
```

**What interviewers look for:** `this == o` shortcut; the `instanceof` (or `getClass()`) check, with a stated reason for the choice; same fields in both methods; fields that can change are left out; a primitive `long` is hashed with `Long.hashCode`; and a mention that for a plain data holder a `record` does all of this for you. For JPA entities, avoid a generated id that is `null` before the first save.

### [coding] Build an LRU cache with LinkedHashMap. {#lru}

`LinkedHashMap` can order its entries by *access* instead of insertion, and calls `removeEldestEntry` after every insert so you can evict:

```java
public class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int maxEntries;

    public LruCache(int maxEntries) {
        super(16, 0.75f, true);          // true = access order: get() moves an entry to the end
        this.maxEntries = maxEntries;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > maxEntries;      // evict the least recently used
    }
}
```

Using it: put `a`, `b`, `get(a)`, put `c` with `maxEntries = 2` evicts `b`. Say that it is **not thread-safe** (wrap with `Collections.synchronizedMap`, or use a library such as Caffeine), and be ready to implement it by hand with a `HashMap` plus a doubly linked list for O(1) get and put.

### [coding] Solve common problems with a map: Two Sum and word frequency. {#map-patterns}

These two patterns cover a large share of "use a HashMap" questions: *remember what you have seen* and *count things*.

```java
// Two Sum: indices of two numbers adding up to target, in one pass, O(n)
static int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();          // value -> index
    for (int i = 0; i < nums.length; i++) {
        Integer j = seen.get(target - nums[i]);
        if (j != null) return new int[] { j, i };
        seen.put(nums[i], i);
    }
    return new int[0];
}

// Word frequency
Map<String, Integer> counts = new HashMap<>();
for (String w : text.split("\\s+")) {
    counts.merge(w, 1, Integer::sum);
}
```

Explain why the map turns an O(n²) double loop into O(n) time with O(n) extra space, and mention the edge cases: duplicates, no solution, and negative numbers.
