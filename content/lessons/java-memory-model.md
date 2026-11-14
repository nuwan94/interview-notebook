---
title: Java memory — stack, heap and the string pool
nav: Memory model
slug: java-memory-model
summary: Where variables and objects live (stack, heap, Metaspace), how the string pool works, what the Java Memory Model promises between threads, and the memory errors you will be asked about.
tags: [Java, JVM, Memory, Strings, Concurrency]
order: 14
topic: Java / JVM
updated: 2026-11-12
subnav: true
---

"Java memory" means two different things in interviews. The first is **where data lives at run time**: the stack, the heap, the string pool. The second is the **Java Memory Model (JMM)**: the rules that say when one thread is guaranteed to see what another thread wrote. This lesson covers both, in that order. Press play to watch the first one happen line by line.

```demo
name: memory-walk
```

> **One sentence to remember:** *variables (and the references inside them) live on the stack, objects live on the heap, and the string pool is a table inside the heap that lets equal string literals share one object.*

## The big picture {#overview}

### Runtime data areas {#data-areas}

When the JVM runs your program, it manages these memory areas. Some are shared by all threads, some belong to a single thread.

| Area | Shared? | What is in it | Typical error |
| --- | --- | --- | --- |
| **Heap** | all threads | every object and array, including the string pool | `OutOfMemoryError: Java heap space` |
| **Metaspace** (method area) | all threads | class metadata, method bytecode, the runtime constant pool | `OutOfMemoryError: Metaspace` |
| **Stack** | one per thread | a frame per method call: local variables and partial results | `StackOverflowError` |
| **PC register** | one per thread | the address of the instruction the thread is running | none |
| **Native method stack** | one per thread | frames for native (JNI) calls | `StackOverflowError` |
| **Direct (off-heap) memory** | all threads | buffers allocated outside the heap, for fast I/O | `OutOfMemoryError: Direct buffer memory` |

The heap, Metaspace and direct memory exist once per JVM. Each thread gets its own stack, so local variables are never shared between threads. That one fact explains why local variables are thread-safe and fields are not.

### Where does each thing live? {#where-things-live}

| Thing | Where |
| --- | --- |
| Local variable of a primitive type (`int count`) | the stack frame |
| Local variable that refers to an object (`Order o`) | the reference is in the stack frame |
| The object itself (`new Order()`) | the heap |
| Instance fields (primitive or reference) | inside their object, on the heap |
| Static fields | with the class: in HotSpot they sit in the `Class` object on the heap |
| Class definitions and method bytecode | Metaspace |
| String literals | the string pool, which is part of the heap |
| Arrays (even `int[]`) | the heap |

A reference is a small value (4 bytes with compressed pointers, otherwise 8) that says "the object is over there". Copying a reference copies the pointer, never the object.

## The stack {#stack}

### Frames {#stack-frames}

Each time a method is called, the JVM pushes a **stack frame** for it. When the method returns (normally or by an exception), the frame is popped and everything in it disappears at once. A frame holds:

- the **local variables**, including parameters (`this` is local variable 0 in instance methods),
- an **operand stack** used as scratch space while evaluating expressions,
- bookkeeping: a link to the constant pool of the method's class and the return address.

Because frames are pushed and popped in strict order, stack memory needs no garbage collector. It is fast, and its size is fixed per thread (`-Xss`, commonly 1 MB on 64-bit Linux).

### Pass by value {#pass-by-value}

Java always passes arguments **by value**. For a primitive the value is copied. For an object the *reference* is copied, so the callee gets its own variable that points at the same object. That is why `ship(o, count)` in the animation can change `o.qty` for the caller but cannot make `count` change, and why reassigning `o = new Order()` inside the method never affects the caller's variable.

### StackOverflowError {#stack-overflow}

If calls nest deeper than the stack allows, the JVM throws `StackOverflowError`. The usual cause is **unbounded recursion**: a missing base case, or two methods calling each other (also `toString()` calling itself through a bidirectional relationship). Fix the recursion, or make it iterative. Raising `-Xss` only hides the bug and costs memory for every thread.

### Does an object ever live on the stack? {#escape-analysis}

Semantically no: every object is allocated on the heap. But the **JIT compiler** performs **escape analysis**: if it can prove an object never leaves the method, it can replace it with plain local values (*scalar replacement*) and skip the allocation altogether. You cannot rely on this and cannot ask for it. It is the reason short-lived temporary objects are often cheaper than they look.

### Virtual threads {#stack-virtual}

A platform thread has a fixed-size stack reserved up front. A **virtual thread** (Java 21) keeps its frames in ordinary objects on the **heap** while it is not running, and copies them onto a carrier thread's stack when it is mounted. That is why millions of them are affordable. See [virtual threads in the version history](lesson:java-version-history#java-21).

## The heap {#heap}

### What lives there {#heap-contents}

Every object and every array is allocated on the heap with `new` (or by a factory method that calls it). The heap is shared by all threads, so access to shared objects needs the care described in the [memory model section](lesson:java-memory-model#jmm). Objects are freed only by the **[garbage collector](lesson:garbage-collector)**, when no live reference can reach them any more.

### Anatomy of an object {#object-layout}

An object is its **header** plus its fields, rounded up to a multiple of 8 bytes. On a 64-bit HotSpot JVM with compressed pointers the header is 12 bytes (a mark word and a class pointer; [compact object headers](lesson:garbage-collector#compact-object-headers) reduce it to 8). So `new Order(7)` with one `int` field takes 12 + 4 = 16 bytes. This is why millions of tiny objects use much more memory than the data inside them suggest, and why `Integer` costs about four times an `int`.

### Generations {#generations}

Most objects die young, so collectors split the heap by age:

- **Young generation:** new objects start in **eden**. Surviving a collection moves them between two **survivor** spaces, and each survival raises their age.
- **Old generation:** objects that survive long enough are promoted here. It is collected less often, and more expensively.

The collector details (and the newer collectors that drop the fixed split) belong in the [garbage collector lesson](lesson:garbage-collector#generations). To keep allocation fast, each thread gets a private slice of eden, a **TLAB** (thread-local allocation buffer), so allocating an object is usually just a pointer bump with no locking.

### Sizing the heap {#heap-sizing}

| Flag | Meaning |
| --- | --- |
| `-Xms` | initial heap size |
| `-Xmx` | maximum heap size (default: a quarter of the machine's or container's memory) |
| `-XX:+HeapDumpOnOutOfMemoryError` | write a heap dump when the heap runs out, for analysis afterwards |

In containers set `-Xmx` (or `-XX:MaxRAMPercentage`) deliberately: the heap is only part of the process's memory. Metaspace, thread stacks, direct buffers and the JIT code cache all count against the container limit too. **Compressed oops** let a heap up to about 32 GB use 4-byte references, so very large heaps cost disproportionately more.

### GC roots and reachability {#gc-roots}

The collector keeps an object if it is **reachable** from a **GC root**: local variables and parameters on any thread's stack, static fields, active threads, and JNI references. Everything else is garbage. That is what the last frame of the animation shows: when `main()` returns, the stack reference to the `Order` is gone, so it becomes unreachable. See [GC roots](lesson:garbage-collector#gc-roots).

## Metaspace and the method area {#metaspace}

Class metadata (the class structure, method bytecode, the **runtime constant pool**) lives in the **method area**. Before Java 8, HotSpot kept it in the **permanent generation**, a fixed-size part of the heap that had to be tuned (`OutOfMemoryError: PermGen space`). **Java 8 replaced it with Metaspace**, which uses native memory and grows on demand (see [Java 8 changes](lesson:java-version-history#java-8)). Limit it with `-XX:MaxMetaspaceSize`.

Metaspace grows when many classes are loaded: lots of generated proxies, a framework that redeploys applications without releasing the old **class loader**, or a leaked class loader. Class metadata is freed only when its class loader is unreachable.

## The string pool {#string-pool}

Strings are used everywhere and are often repeated (field names, status codes, SQL, log messages). The JVM keeps one table of **interned** strings, the **string pool** (also called the string table or intern table), so equal literals share one object instead of creating thousands of copies.

### Literals are pooled {#pool-literals}

```java
String a = "hi";
String b = "hi";
System.out.println(a == b);       // true: both refer to the one pooled object
```

When a class is loaded, each string literal in it is resolved through the pool: if "hi" is already there you get that object, otherwise a new `String` is created and added. `==` compares references, so two variables set from the same literal are `==`.

### new String creates a new object {#new-string}

```java
String c = new String("hi");
System.out.println(a == c);       // false: c is a separate heap object
System.out.println(a.equals(c));  // true: same characters
```

`new String("hi")` allocates a new `String` on the heap every time. If the literal `"hi"` was not in the pool yet, it is also created there when the class loads. That is the classic question "how many objects does `new String("hi")` create": **one** at run time (plus the pooled literal, if it was not already there). It is almost never useful. Use `equals()` to compare text, never `==`.

### intern() {#intern}

`s.intern()` returns the pooled string with the same characters, adding `s` itself to the pool first if there is none:

```java
String d = c.intern();
System.out.println(a == d);       // true
```

Interning can save memory when you hold millions of copies of a few distinct values, but it has a cost (a hash-table lookup) and the pool is a shared resource. Prefer a plain `Map`-based cache you control, or the garbage collector's string deduplication, over calling `intern()` everywhere.

### Compile-time constants {#compile-time-constants}

The compiler folds constant expressions, and the result is a pooled literal:

```java
String x = "a" + "b";             // the compiler stores the literal "ab"
System.out.println(x == "ab");    // true

String p = "a";
String y = p + "b";               // computed at run time: a new object
System.out.println(y == "ab");    // false

final String q = "a";             // a constant variable
String z = q + "b";               // folded at compile time
System.out.println(z == "ab");    // true
```

A `final` variable initialised with a constant counts as a constant. The same variable without `final` does not.

### Where the pool lives {#pool-location}

- **Java 6 and earlier:** in the permanent generation, so interning heavily could exhaust PermGen.
- **Java 7 onwards:** in the ordinary **heap**, so pooled strings are garbage-collected like any other object once nothing refers to them (see [Java 7](lesson:java-version-history#java-7)).
- The pool is a hash table with a fixed number of buckets; tune it with `-XX:StringTableSize` if you really do intern millions of values.

### Why String is immutable {#string-immutable}

Sharing one object between many variables is only safe if nobody can change it. That is the main reason `String` is **immutable**. Others:

- **Hash caching:** the hash code is computed once and stored, so strings are fast `HashMap` keys.
- **Security:** a file name, class name or SQL parameter cannot be changed after it was validated.
- **Thread safety:** immutable objects can be shared across threads without locking.

### Concatenation and StringBuilder {#concatenation}

Every "change" to a string creates a new one. In a loop this is wasteful:

```java
String s = "";
for (String part : parts) {
    s += part;                    // allocates a new String (and copies) on every iteration
}

StringBuilder sb = new StringBuilder();
for (String part : parts) {
    sb.append(part);              // one growing buffer
}
String s2 = sb.toString();
```

| Class | Mutable | Thread-safe | Use for |
| --- | --- | --- | --- |
| `String` | no | yes (immutable) | most text |
| `StringBuilder` | yes | no | building text in a single thread |
| `StringBuffer` | yes | yes (synchronized) | rarely needed; legacy |

A single `a + b + c` expression is fine: since [Java 9](lesson:java-version-history#java-9) it is compiled to an `invokedynamic` call that sizes the result once (JEP 280).

### Storage inside a String {#string-storage}

Before Java 9 a `String` held a `char[]` with two bytes per character. **Compact strings** ([Java 9](lesson:java-version-history#java-9), JEP 254) store text that fits in Latin-1 as a `byte[]` with one byte per character, which roughly halves memory for typical English and numeric text. The G1 collector can also *deduplicate* equal strings behind the scenes (`-XX:+UseStringDeduplication`), sharing the underlying array without changing their identity.

## Other caches that look like pools {#caches}

`Integer.valueOf` (which autoboxing uses) caches the boxed values **-128 to 127**:

```java
Integer a = 127, b = 127;
System.out.println(a == b);       // true: both from the cache

Integer c = 128, d = 128;
System.out.println(c == d);       // false: two separate objects
System.out.println(c.equals(d));  // true
```

`Long`, `Short` and `Byte` cache the same range, `Character` caches 0 to 127, and `Boolean` has two constants. Always compare wrapper objects with `equals()`. Unboxing in arithmetic or comparisons with a primitive (`c == 128` with an `int`) works as expected.

## When memory goes wrong {#problems}

### The errors {#errors}

| Error | Meaning | First thing to check |
| --- | --- | --- |
| `StackOverflowError` | one thread's stack is full | infinite or very deep recursion |
| `OutOfMemoryError: Java heap space` | the heap is full and the collector cannot free enough | a leak, or a heap that is too small for the data set |
| `OutOfMemoryError: GC overhead limit exceeded` | the JVM spends almost all its time collecting and frees almost nothing | the same as above, seen earlier |
| `OutOfMemoryError: Metaspace` | too much class metadata | class loader leaks, runaway class generation |
| `OutOfMemoryError: unable to create native thread` | the OS refused another thread | too many threads, low container limit, large `-Xss` |
| `OutOfMemoryError: Direct buffer memory` | off-heap buffers are exhausted | unreleased `ByteBuffer.allocateDirect` buffers |

### Memory leaks {#leaks}

Java has a garbage collector, but you can still leak memory: keep a reference to something you no longer need and the collector must keep it. The usual suspects:

- **Static collections** that only grow (a cache or registry without eviction).
- **Listeners and callbacks** registered but never removed.
- **ThreadLocal** values on pooled threads that are never cleared.
- **Unbounded caches**; use size-bounded caches such as `LinkedHashMap` in access order with `removeEldestEntry` (see [LRU cache](lesson:java-hashmap#q-lru)), or Caffeine.
- **Mutable keys** in a hash map, which leave entries nobody can find (see [the mutable key trap](lesson:java-hashmap#contract)).
- **Class loaders** kept alive by a static reference, taking all their classes with them.

### Finding the problem {#diagnosing}

- Add `-XX:+HeapDumpOnOutOfMemoryError` to production and open the dump in a heap analyser; look at the **dominator tree** to see what retains the most memory.
- `jcmd <pid> GC.heap_info`, `jcmd <pid> GC.class_histogram` and `jmap -histo <pid>` show what objects exist and how many.
- **Java Flight Recorder** (`jcmd <pid> JFR.start`) records allocation and GC behaviour with little overhead.
- A heap that keeps growing after each full collection is a leak. A heap that is simply too small shows a flat "saw-tooth" at the limit.

## The Java Memory Model {#jmm}

Everything so far was about *where* data lives. The JMM (specified in JSR 133, [Java 5](lesson:java-version-history#java-5)) is about *when changes become visible* between threads. The [concurrency lesson](lesson:java-concurrency) builds on it with locks, executors and virtual threads.

### Why it is needed {#jmm-why}

Each CPU core has its own caches and registers, and both the compiler and the CPU are free to **reorder** independent operations to run faster. Within one thread the result always looks as if the code ran in order. Between threads, without a rule, a write on one thread may be invisible to another for an arbitrary time, or be seen in a different order than it was written:

```java
class Stopper {
    boolean running = true;               // not volatile

    void worker() { while (running) { /* work */ } }   // may never see the change
    void stop()   { running = false; }
}
```

The JIT is allowed to read `running` once and keep it in a register, so `worker()` may spin forever. The JMM defines exactly which guarantees you get and what you must write to get them.

### Three problems it solves {#jmm-problems}

| Problem | Meaning | Tool |
| --- | --- | --- |
| **Atomicity** | an operation happens entirely or not at all | `synchronized`, locks, atomic classes |
| **Visibility** | one thread's write is seen by another | `volatile`, `synchronized`, `final`, thread start/join |
| **Ordering** | operations are not seen out of order | `volatile`, `synchronized` |

### Happens-before {#happens-before}

The central idea is the **happens-before** relation. If action A happens-before action B, then everything A did is visible to B and appears to run before it. The main rules:

- **Program order:** each action in a thread happens-before the next action in that thread.
- **Monitor lock:** an unlock of a monitor happens-before every later lock of the same monitor.
- **Volatile:** a write to a `volatile` field happens-before every later read of that field.
- **Thread start:** `thread.start()` happens-before every action in the started thread.
- **Thread join:** every action in a thread happens-before another thread's successful `join()` on it.
- **Transitivity:** if A happens-before B and B happens-before C, then A happens-before C.

The `java.util.concurrent` classes add more (submitting a task to an executor happens-before the task runs; actions before putting an item in a concurrent collection happen-before the action that gets it). When two threads touch the same variable, at least one writes, and no happens-before edge connects them, you have a **data race**, and the result is not guaranteed.

### volatile {#volatile-jmm}

A `volatile` field gives **visibility and ordering** but not atomicity. Declaring `running` volatile fixes the example above. But `volatile int count; count++` is still a bug: `count++` is a read, an add and a write, and two threads can interleave them. Use `AtomicInteger`, `LongAdder` or a lock for that.

### synchronized {#synchronized-jmm}

Entering a `synchronized` block gives mutual exclusion (atomicity of the whole block) and also creates the lock/unlock happens-before edge, so everything written inside is visible to the next thread that locks the same monitor. Both threads must use the **same** lock for this to work.

### final fields {#final-jmm}

The JMM gives `final` fields a special guarantee: once the constructor finishes, any thread that sees a reference to the object also sees the correct values of its final fields, without synchronization, **provided `this` did not escape during construction** (for example by registering itself as a listener inside the constructor). This is one reason immutable objects are safe to share.

### Safe publication and double-checked locking {#dcl}

Making an object visible to other threads before it is fully set up is *unsafe publication*. The classic example is the lazy singleton:

```java
class Config {
    private static volatile Config instance;      // volatile is essential

    static Config get() {
        Config c = instance;
        if (c == null) {
            synchronized (Config.class) {
                c = instance;
                if (c == null) instance = c = new Config();
            }
        }
        return c;
    }
}
```

Without `volatile`, the assignment can be reordered so that another thread sees a non-null `instance` whose fields are not yet set. Simpler alternatives: the **holder idiom** (a private static nested class that holds the instance, initialised by the JVM when first used) or an `enum` singleton.

### Atomicity of long and double {#long-double}

Reads and writes of `long` and `double` that are not `volatile` may be split into two 32-bit operations on some JVMs. In practice 64-bit JVMs do not tear them, but the specification allows it, and `volatile` guarantees atomicity for them.

## Cheat sheet {#cheatsheet}

| Question | Answer |
| --- | --- |
| Where do local primitives live? | on the stack, in the method's frame |
| Where do objects live? | on the heap |
| Where do object references live? | in whatever holds them: a stack frame, or a field inside a heap object |
| Where does the string pool live? | in the heap (since Java 7) |
| Where are class definitions? | Metaspace (since Java 8) |
| Is a local variable thread-safe? | yes, each thread has its own stack |
| Are fields thread-safe? | no, not without synchronization, volatile or immutability |
| Which flag sets max heap / thread stack size? | `-Xmx` / `-Xss` |
| `"a" == "a"`? | true (same pooled literal) |
| `new String("a") == "a"`? | false |
| `Integer` 127 == 127? | true; 128 == 128 is false (boxed objects) |

## Interview questions {#questions}

### [basic] What is the difference between the stack and the heap? {#stack-vs-heap}

The **stack** is per-thread memory holding one frame per method call: local variables, parameters and intermediate values. It is fast, automatically freed when the method returns, and small. The **heap** is shared by all threads and holds every object and array. It is much larger, and objects are freed by the garbage collector when nothing references them. Primitive locals and object *references* are on the stack; the objects they refer to are on the heap.

### [basic] Where are local variables, instance variables and static variables stored? {#where-variables}

Local variables (and parameters) are in the **stack frame** of their method. Instance variables are part of their object on the **heap**. Static variables belong to the class: in HotSpot they are stored in the class's mirror object on the heap, while the class metadata is in Metaspace. Whether a variable is a primitive or a reference decides what the slot contains (a value or a pointer), not where the slot is.

### [basic] What is the string pool? {#what-is-pool}

A table of unique `String` objects that the JVM keeps so that equal string literals share one object. Literals are put in the pool when their class is loaded, and `String.intern()` can add or look up strings at run time. Since [Java 7](lesson:java-version-history#java-7) the pool is part of the heap, so unused pooled strings can be garbage-collected.

### [basic] What is the difference between == and equals() for strings? {#string-equality}

`==` compares **references**: do both variables point at the same object? `equals()` compares the **characters**. `"hi" == "hi"` is true because both are the same pooled literal, but `new String("hi") == "hi"` is false. Always use `equals()` (or `equalsIgnoreCase()`) for text; `==` happens to work for literals and nothing else you should depend on.

### [basic] How many objects does new String("hello") create? {#how-many-objects}

At run time, **one**: a new `String` on the heap. The literal `"hello"` is also an object in the string pool, created when the class was loaded (if that text was not there already). So the answer is "one, or two counting the pooled literal if it was new". Interviewers mostly want to hear that `new String(...)` always makes a new heap object and is rarely a good idea.

### [basic] Why is String immutable in Java? {#why-immutable}

Because strings are shared: the pool lets many variables refer to one object, which is only safe if nobody can change it. Immutability also allows the hash code to be cached (fast map keys), makes strings safe to use as file names, class names and security-sensitive parameters, and makes them thread-safe without locking. The cost is that every "modification" creates a new string.

### [basic] Is Java pass-by-value or pass-by-reference? {#pass-by-value-q}

Always **pass-by-value**. For primitives the value is copied. For objects the *reference* is copied, so the called method gets its own variable pointing at the same object. It can change that object's fields, and the caller will see the change, but reassigning the parameter to a different object does not affect the caller's variable.

### [basic] What causes StackOverflowError, and what causes OutOfMemoryError? {#soe-vs-oom}

`StackOverflowError` means one thread's stack is full, nearly always from infinite or excessively deep recursion. `OutOfMemoryError` means a memory area ran out, and its message says which: *Java heap space*, *Metaspace*, *unable to create native thread*, *Direct buffer memory*. The first is fixed in the code; the second needs diagnosis (a heap dump) to see whether the fix is a leak, a bigger limit, or a smaller data set.

### [intermediate] What does String.intern() do, and should you use it? {#intern-q}

It returns the string from the pool that equals this one, adding this string to the pool if none was there. After `String t = s.intern()`, `t` is the pooled instance and `t == "literal"` is true for the same text. It helps when you have very many duplicates of a few values, and it makes `==` comparisons possible, but each call costs a hash lookup, the pool is shared and has a fixed number of buckets, and it encourages the `==` mistake. In modern Java prefer your own bounded cache or G1's string deduplication.

### [intermediate] Where is the string pool stored, and did that change? {#pool-history}

In Java 6 and earlier it was in the permanent generation, a fixed-size area, so heavy interning could cause `OutOfMemoryError: PermGen space`. **Java 7** moved it to the ordinary **heap**, where pooled strings are garbage-collected when unreachable, and **Java 8** then removed PermGen altogether (Metaspace). The bucket count is tunable with `-XX:StringTableSize`.

### [intermediate] What does this print? "a" + "b" == "ab" and the same with non-final variables. {#constant-folding}

`"a" + "b" == "ab"` is **true**: the compiler folds the constant expression into the literal `"ab"`, which is the pooled one. With `String p = "a"; (p + "b") == "ab"` it is **false**, because the concatenation runs at run time and builds a new object. If `p` is declared `final String p = "a";` it is a constant variable, the expression is folded again, and the result is **true**. The lesson: never rely on `==` for strings.

### [intermediate] Why is Integer 127 == 127 true but 128 == 128 false? {#integer-cache}

Autoboxing calls `Integer.valueOf`, which returns cached objects for **-128 to 127**, so two boxes of 127 are the same object and `==` is true. Outside that range each call creates a new `Integer`, so `==` compares two different objects and is false. The upper bound can be raised with `-XX:AutoBoxCacheMax`. Compare wrappers with `equals()`.

### [intermediate] What is the difference between String, StringBuilder and StringBuffer? {#sb-sbuf}

`String` is immutable. `StringBuilder` is a mutable buffer that is not synchronized, the right choice for building text in one thread (and what the compiler uses behind simple concatenation). `StringBuffer` is the same but with every method `synchronized`; it is legacy because you rarely share a builder between threads, and locking each call is the wrong granularity anyway. Concatenating in a loop with `+=` copies the whole string every time, so use a `StringBuilder`.

### [intermediate] How is the heap organised? What are eden, survivor and old? {#generations-q}

Because most objects die young, the heap is split by age. New objects are allocated in **eden**. When eden fills, a young collection copies live objects into a **survivor** space (there are two, used alternately) and increases their age. Objects that survive enough collections are **promoted** to the **old generation**, which is collected less often. Some modern collectors (ZGC, Shenandoah, G1) divide the heap into regions rather than fixed areas, but the age idea remains. Details are in the [garbage collector lesson](lesson:garbage-collector#generations).

### [intermediate] What flags would you set for heap and stack size? {#jvm-flags}

`-Xms` is the initial and `-Xmx` the maximum heap size; production services often set them equal to avoid resizing pauses. `-Xss` sets each thread's stack size. In containers, `-XX:MaxRAMPercentage` sizes the heap relative to the container limit. Remember the heap is not the whole process: Metaspace, thread stacks, direct buffers and the code cache add to it, so leave headroom below the container limit.

### [intermediate] What is Metaspace, and how does it differ from PermGen? {#metaspace-q}

Both hold class metadata. PermGen was a fixed-size part of the Java heap, so you had to size it (`-XX:MaxPermSize`) and could run out. **Metaspace** ([Java 8](lesson:java-version-history#java-8), JEP 122) lives in **native memory**, grows on demand and is limited only by `-XX:MaxMetaspaceSize` or the machine. Class metadata is freed when its class loader becomes unreachable, so Metaspace growth usually points to a class-loader leak or runaway class generation.

### [intermediate] What is a GC root? Give examples. {#gc-root-q}

A starting point of reachability: an object is kept alive if it can be reached from a root through references. Roots include **local variables and parameters on active thread stacks**, **static fields** of loaded classes, **live threads**, and JNI global references. Everything the collector cannot reach from a root is garbage, even if objects in that group refer to each other (reference cycles do not keep each other alive).

### [intermediate] Give examples of memory leaks in a garbage-collected language. {#leak-examples}

A leak is a reference you forgot about. Common ones: a **static `Map` used as a cache with no eviction**; **listeners** registered and never removed; **`ThreadLocal`** values never cleared on pooled threads; **inner classes** or lambdas that capture a large outer object; a **mutable key** in a hash map; an **unclosed resource** whose cleaner holds the buffer; and a **class loader** retained by a static field after redeploy. Diagnosis is a heap dump and its dominator tree.

### [intermediate] Are local variables thread-safe? What about an object referenced by one? {#locals-thread-safe}

A local variable itself is thread-safe because each thread has its own stack. If it holds a **primitive** nothing is shared. If it holds a **reference**, the variable is private but the *object* may not be: if the reference was passed in from elsewhere, or you stored it in a field or collection that another thread can see, that object is shared and needs synchronization or immutability. An object that is created locally and never escapes is safe.

### [intermediate] What is escape analysis? {#escape-analysis-q}

A JIT compiler analysis that determines whether an object can be seen outside the method (or thread) that creates it. If not, the compiler can remove the allocation by keeping its fields in registers (scalar replacement) and can remove locks on it. Java semantics do not change: objects are still conceptually on the heap. It is why creating small short-lived objects, such as iterators or `Optional`s, is usually cheap in hot code.

### [deep] What is the Java Memory Model, and what does happens-before mean? {#jmm-q}

The JMM defines how threads interact through memory: which writes a read may see, and which reorderings are allowed. **Happens-before** is the guarantee it uses: if action A happens-before B, A's effects are visible to B. The edges come from program order, unlock-before-lock on the same monitor, volatile write-before-read, `Thread.start()` and `join()`, executor submission and concurrent-collection hand-off, and transitivity. Without such an edge between a write and a read of the same variable you have a **data race** and no guarantee.

### [deep] What exactly does volatile guarantee, and what does it not? {#volatile-q}

It guarantees that a write is visible to subsequent reads from any thread, and that operations before the write are not reordered after it (a happens-before edge). It also makes reads and writes of `long` and `double` atomic. It does **not** make compound operations atomic: `count++` on a volatile field is still a lost-update race. Use `AtomicInteger`, `LongAdder` or a lock. Typical valid uses: a stop flag, or publishing an immutable object once.

### [deep] Why does double-checked locking need volatile? {#dcl-q}

`instance = new Config()` is really three steps: allocate memory, run the constructor, assign the reference. Without a happens-before edge the compiler or CPU may assign the reference **before** the constructor's writes become visible. A second thread then sees a non-null `instance` that is only partly built and skips the `synchronized` block. Declaring the field `volatile` forbids that reordering. The holder idiom or an enum singleton avoids the problem entirely.

### [deep] How do final fields help with thread safety? {#final-q}

The JMM guarantees that after a constructor finishes, every thread that sees the object also sees the final fields' correct values, with no synchronization, as long as `this` did not escape from the constructor. That makes truly immutable objects (all fields final, no escaping references to mutable internals) safe to share and publish via a plain field, which is why `String`, `Integer` and records are so convenient across threads.

### [deep] Why does an Integer or an object cost more memory than the data it holds? {#object-overhead}

Every object has a header (12 bytes on 64-bit HotSpot with compressed pointers) and its size is rounded up to 8 bytes. An `int` is 4 bytes, but an `Integer` is 16 bytes plus the 4-byte reference that points to it. A `HashMap` entry adds another node object. So collections of boxed values or tiny objects use several times the raw data size. This is the motivation for primitive arrays, specialised collections, Project Valhalla and compact object headers.

### [deep] Where do the stack frames of virtual threads live? {#virtual-stack-q}

While a virtual thread runs, its frames are on its carrier (platform) thread's stack like any other. When it blocks and is unmounted, the JVM copies its frames into **stack-chunk objects on the heap**, and copies them back when it resumes. The stack therefore grows and shrinks with use, which is how millions of virtual threads fit in memory where the same number of platform threads, each with a fixed reserved stack, would not.

### [deep] What is direct (off-heap) memory, and when would you use it? {#direct-memory}

`ByteBuffer.allocateDirect` (and the Foreign Function and Memory API) allocate memory outside the Java heap, in native memory. It avoids copying when passing data to the operating system for I/O, which is why networking libraries such as Netty use it, and it is not moved by the collector. The costs: allocation is slower, memory is freed only when the buffer object is collected (or explicitly with the newer APIs), and exhausting it raises `OutOfMemoryError: Direct buffer memory`. It is limited by `-XX:MaxDirectMemorySize`.

### [coding] What does this print? {#string-puzzle}

```java
String s1 = "warehouse";
String s2 = "ware" + "house";
String s3 = new String("warehouse");
String part = "ware";
String s4 = part + "house";
String s5 = s4.intern();

System.out.println(s1 == s2);
System.out.println(s1 == s3);
System.out.println(s1 == s4);
System.out.println(s1 == s5);
System.out.println(s1.equals(s3));
```

`true, false, false, true, true`.

- `s1 == s2`: `"ware" + "house"` is a compile-time constant, so it is the pooled literal.
- `s1 == s3`: `new String` makes a separate heap object.
- `s1 == s4`: `part` is not final, so the concatenation runs at run time and builds a new object.
- `s1 == s5`: `intern()` returns the pooled instance, which is `s1`.
- `equals` is true for all of them, because the characters match.

### [coding] This cache grows until the service crashes. Find the problem. {#leak-cache}

```java
public class ProductCache {
    private static final Map<String, Product> CACHE = new HashMap<>();

    public static Product get(String sku) {
        return CACHE.computeIfAbsent(sku, ProductCache::loadFromDb);
    }
}
```

The map is **static** (a GC root) and **unbounded**: every SKU ever requested stays reachable forever, so heap use climbs until `OutOfMemoryError`. It is also a plain `HashMap` used from many threads, which is a thread-safety bug. Fix it with a bounded, thread-safe cache with eviction, for example Caffeine (`Caffeine.newBuilder().maximumSize(10_000).expireAfterWrite(...)`), or a `LinkedHashMap` in access order wrapped for concurrency; and measure with a heap dump before and after.
