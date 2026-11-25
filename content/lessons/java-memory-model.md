---
title: Java memory — stack, heap and the string pool
nav: Memory model
slug: java-memory-model
summary: Where variables and objects live (stack, heap, Metaspace), how the string pool works, what the Java Memory Model promises between threads, and the memory errors you will be asked about.
tags: [Java, JVM, Memory, Strings, Concurrency]
order: 16
topic: Java / JVM
updated: 2026-11-24
subnav: true
---

"Java memory" means two different things in interviews:

- **Where data lives while the program runs:** the stack, the heap and the string pool.
- **The Java Memory Model (JMM):** the rules that say when one thread is sure to see what another thread wrote.

This lesson covers both, in that order. The animation shows the first part: it runs the code line by line and draws the stack, the heap and the arrows between them.

```demo
name: memory-walk
```

> **One sentence to remember:** *Variables live on the stack, objects live on the heap, and equal string literals share one object in the string pool.*

## The big picture {#overview}

### Runtime data areas {#data-areas}

When the JVM runs your program, it manages the memory areas below. Some are shared by all threads. Others belong to one thread only.

| Area | Shared? | What is in it | Typical error |
| --- | --- | --- | --- |
| **Heap** | Shared by all threads. | Every object and array, including the string pool. | `OutOfMemoryError: Java heap space` |
| **Metaspace** (method area) | Shared by all threads. | Class metadata, method bytecode and the runtime constant pool. | `OutOfMemoryError: Metaspace` |
| **Stack** | One per thread. | One frame per method call, with its local variables and partial results. | `StackOverflowError` |
| **PC register** | One per thread. | The address of the instruction the thread is running. | None. |
| **Native method stack** | One per thread. | Frames for native (JNI) calls. | `StackOverflowError` |
| **Direct (off-heap) memory** | Shared by all threads. | Buffers kept outside the heap, for fast input and output. | `OutOfMemoryError: Direct buffer memory` |

The heap, Metaspace and direct memory exist once per JVM. Each thread gets its own stack, so local variables are never shared between threads. This one fact explains why local variables are thread-safe and fields are not.

### Where does each thing live? {#where-things-live}

| Thing | Where it lives |
| --- | --- |
| A local variable of a primitive type (`int count`) | In the stack frame. |
| A local variable that refers to an object (`Order o`) | The reference is in the stack frame. |
| The object itself (`new Order()`) | On the heap. |
| Instance fields, primitive or reference | Inside their object, on the heap. |
| Static fields | With the class. In HotSpot they sit in the `Class` object on the heap. |
| Class definitions and method bytecode | In Metaspace. |
| String literals | In the string pool, which is part of the heap. |
| Arrays, even `int[]` | On the heap. |

A **reference** is a small value that says "the object is over there". It takes 4 bytes with compressed pointers, and 8 bytes otherwise. Copying a reference copies only this pointer, never the object.

## The stack {#stack}

### Frames {#stack-frames}

Each time a method is called, the JVM pushes a **stack frame** for it. When the method returns, normally or with an exception, the frame is popped and everything in it disappears at once. A frame holds:

- the **local variables**, including the parameters (in an instance method, `this` is local variable 0);
- an **operand stack**, which is scratch space for working out expressions;
- bookkeeping, such as a link to the constant pool of the method's class and the return address.

Frames are pushed and popped in strict order, so stack memory needs no garbage collector. It is fast. Its size is fixed for each thread with `-Xss`, and is commonly 1 MB on 64-bit Linux.

### Pass by value {#pass-by-value}

Java always passes arguments **by value**:

- For a primitive, the value is copied.
- For an object, the *reference* is copied. The called method gets its own variable that points to the same object.

In the animation, `ship(o, count)` can change `o.qty`, and the caller sees the change. But it cannot change the caller's `count`. Also, if the method writes `o = new Order()`, only its own copy of the reference changes, and the caller's variable stays the same.

### StackOverflowError {#stack-overflow}

If calls nest deeper than the stack allows, the JVM throws `StackOverflowError`. The usual cause is **recursion that never stops**. Examples are a missing base case, two methods that call each other, or `toString()` calling itself through two objects that point to each other.

Fix the recursion, or rewrite it as a loop. Raising `-Xss` only hides the bug, and it costs memory for every thread.

### Does an object ever live on the stack? {#escape-analysis}

By the rules of the language, no: every object is created on the heap.

But the **JIT compiler** (the part of the JVM that compiles hot code to machine code while the program runs) does **escape analysis**. It checks whether an object can ever be seen outside the method that creates it. If it cannot, the compiler can replace the object with plain local values. This is called *scalar replacement*, and the object is then never created at all.

You cannot rely on this, and you cannot ask for it. It is the reason short-lived temporary objects are often cheaper than they look.

### Virtual threads {#stack-virtual}

A normal (platform) thread reserves a stack of fixed size when it starts. A **virtual thread** (Java 21) works differently. While it is not running, it keeps its frames in ordinary objects on the **heap**. When it runs again, the JVM copies the frames onto the stack of a carrier thread. That is why you can afford millions of virtual threads. See [virtual threads in the version history](lesson:java-version-history#java-21).

## The heap {#heap}

### What lives there {#heap-contents}

Every object and every array is created on the heap with `new`, or by a factory method that calls `new`. The heap is shared by all threads, so shared objects need the care described in the [memory model section](lesson:java-memory-model#jmm).

Only the **[garbage collector](lesson:garbage-collector)** frees objects. It does so when no live reference can reach them any more.

### Anatomy of an object {#object-layout}

An object is a **header** plus its fields, rounded up to a multiple of 8 bytes. On a 64-bit HotSpot JVM with compressed pointers, the header is 12 bytes: a mark word and a class pointer. [Compact object headers](lesson:garbage-collector#compact-object-headers) reduce it to 8 bytes.

So `new Order(7)`, with one `int` field, takes 12 + 4 = 16 bytes. This is why millions of tiny objects use much more memory than the data inside them. It is also why an `Integer` costs about four times as much as an `int`.

### Generations {#generations}

Most objects die young, so collectors split the heap by age:

- **Young generation:** new objects start in **eden**. An object that survives a collection moves between two **survivor** spaces, and each survival raises its age.
- **Old generation:** objects that survive long enough are **promoted** here. This area is collected less often, and each collection costs more.

The details, and the newer collectors that drop the fixed split, are in the [garbage collector lesson](lesson:garbage-collector#generations).

To keep allocation fast, each thread gets its own private slice of eden, called a **TLAB** (thread-local allocation buffer). So creating an object is usually just moving a pointer forward, with no locking.

### Sizing the heap {#heap-sizing}

| Flag | Meaning |
| --- | --- |
| `-Xms` | The initial heap size. |
| `-Xmx` | The maximum heap size. By default it is a quarter of the machine's or the container's memory. |
| `-XX:+HeapDumpOnOutOfMemoryError` | Writes a heap dump when the heap runs out, so you can analyse it afterwards. |

In containers, set `-Xmx` (or `-XX:MaxRAMPercentage`) on purpose. The heap is only part of the process's memory. Metaspace, thread stacks, direct buffers and the JIT code cache also count against the container limit.

**Compressed oops** (compressed object pointers) let a heap of up to about 32 GB use 4-byte references. Above that size every reference takes 8 bytes, so very large heaps cost more than their size suggests.

### GC roots and reachability {#gc-roots}

The collector keeps an object if a **GC root** can reach it by following references. GC roots are:

- local variables and parameters on any thread's stack;
- static fields;
- active threads;
- JNI references held by native code.

Everything else is garbage. The last step of the animation shows this. When `main()` returns, the stack reference to the `Order` is gone, so nothing can reach the `Order` any more. See [GC roots](lesson:garbage-collector#gc-roots).

## Metaspace and the method area {#metaspace}

Class metadata lives in the **method area**. It includes the class structure, the method bytecode and the **runtime constant pool** (the table of constants and names each class uses).

- Before Java 8, HotSpot kept it in the **permanent generation** (PermGen). This was a fixed-size part of the heap that had to be tuned, and it failed with `OutOfMemoryError: PermGen space`.
- **Java 8 replaced it with Metaspace**, which uses native memory and grows when needed (see [Java 8 changes](lesson:java-version-history#java-8)). You can limit it with `-XX:MaxMetaspaceSize`.

Metaspace grows when many classes are loaded. Common causes are lots of generated proxies, a framework that redeploys applications without releasing the old **class loader**, or a leaked class loader. Class metadata is freed only when its class loader can no longer be reached.

## The string pool {#string-pool}

Programs use strings everywhere, and the same values repeat: field names, status codes, SQL, log messages. So the JVM keeps one table of **interned** strings, called the **string pool** (also the string table or intern table). Equal literals then share one object instead of creating thousands of copies. Putting a string into this table is called **interning**.

### Literals are pooled {#pool-literals}

```java
String a = "hi";
String b = "hi";
System.out.println(a == b);       // true: both refer to the one pooled object
```

When a class is loaded, each string literal in it is looked up in the pool. If "hi" is already there, you get that object. If not, a new `String` is created and added. `==` compares references, so two variables set from the same literal are `==`.

### new String creates a new object {#new-string}

```java
String c = new String("hi");
System.out.println(a == c);       // false: c is a separate heap object
System.out.println(a.equals(c));  // true: same characters
```

`new String("hi")` creates a new `String` on the heap every time. If the literal `"hi"` was not in the pool yet, it is also created there when the class loads.

This is the classic question "how many objects does `new String("hi")` create?". The answer is **one** at run time, plus the pooled literal if it was not there already.

`new String(...)` is almost never useful. To compare text, use `equals()`, never `==`.

### intern() {#intern}

`s.intern()` returns the pooled string with the same characters. If the pool has no such string, it first adds `s` itself:

```java
String d = c.intern();
System.out.println(a == d);       // true
```

Interning can save memory when you hold millions of copies of a few different values. But it has costs: each call is a hash-table lookup, and the pool is shared by the whole JVM. Prefer a plain `Map`-based cache that you control, or the garbage collector's string deduplication, over calling `intern()` everywhere.

### Compile-time constants {#compile-time-constants}

The compiler works out constant expressions before the program runs. This is called **constant folding**, and the result is a pooled literal:

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

A `final` variable set to a constant counts as a constant. The same variable without `final` does not.

### Where the pool lives {#pool-location}

- **Java 6 and earlier:** in the permanent generation. Interning a lot could fill up PermGen.
- **Java 7 and later:** in the normal **heap**. Pooled strings are garbage-collected like any other object once nothing refers to them (see [Java 7](lesson:java-version-history#java-7)).
- The pool is a hash table with a fixed number of buckets. If you really do intern millions of values, tune it with `-XX:StringTableSize`.

### Why String is immutable {#string-immutable}

Many variables can share one pooled object. That is only safe if nobody can change it, and it is the main reason `String` is **immutable** (it never changes after it is created). There are other reasons too:

- **Hash caching:** a string calculates its hash code once and stores it, so strings are fast `HashMap` keys.
- **Security:** a file name, class name or SQL parameter cannot be changed after it was checked.
- **Thread safety:** an object that never changes can be shared between threads without locks.

### Concatenation and StringBuilder {#concatenation}

Every "change" to a string creates a new string. In a loop this wastes a lot of work:

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

| Class | Can change? | Thread-safe? | Use for |
| --- | --- | --- | --- |
| `String` | No. | Yes, because it never changes. | Most text. |
| `StringBuilder` | Yes. | No. | Building text inside one thread. |
| `StringBuffer` | Yes. | Yes, its methods are `synchronized`. | Old code. It is rarely needed. |

A single expression such as `a + b + c` is fine. Since [Java 9](lesson:java-version-history#java-9), the compiler turns it into an `invokedynamic` call that works out the size of the result once (JEP 280).

### Storage inside a String {#string-storage}

Before Java 9, a `String` held a `char[]`, with two bytes per character.

**Compact strings** ([Java 9](lesson:java-version-history#java-9), JEP 254) changed this. Text that fits in Latin-1 is stored as a `byte[]` with one byte per character. This roughly halves the memory for typical English and numeric text.

The G1 collector can also *deduplicate* equal strings in the background (`-XX:+UseStringDeduplication`). The strings then share one internal array, but they stay separate objects.

## Other caches that look like pools {#caches}

`Integer.valueOf`, which autoboxing uses, caches the boxed values from **-128 to 127**:

```java
Integer a = 127, b = 127;
System.out.println(a == b);       // true: both from the cache

Integer c = 128, d = 128;
System.out.println(c == d);       // false: two separate objects
System.out.println(c.equals(d));  // true
```

`Long`, `Short` and `Byte` cache the same range. `Character` caches 0 to 127, and `Boolean` has just two constants.

Always compare wrapper objects with `equals()`. When you compare a wrapper with a primitive (`c == 128` with an `int`), Java unboxes it first, so that works as expected. The same is true in arithmetic.

## When memory goes wrong {#problems}

### The errors {#errors}

| Error | Meaning | First thing to check |
| --- | --- | --- |
| `StackOverflowError` | One thread's stack is full. | Recursion that never stops, or is very deep. |
| `OutOfMemoryError: Java heap space` | The heap is full and the collector cannot free enough. | A leak, or a heap that is too small for the data. |
| `OutOfMemoryError: GC overhead limit exceeded` | The JVM spends almost all its time collecting and frees almost nothing. | The same as above, but caught earlier. |
| `OutOfMemoryError: Metaspace` | There is too much class metadata. | Class loader leaks, or code that keeps generating classes. |
| `OutOfMemoryError: unable to create native thread` | The operating system refused to create another thread. | Too many threads, a low container limit, or a large `-Xss`. |
| `OutOfMemoryError: Direct buffer memory` | The off-heap buffers are used up. | `ByteBuffer.allocateDirect` buffers that are never released. |

### Memory leaks {#leaks}

Java has a garbage collector, but you can still leak memory. If you keep a reference to something you no longer need, the collector must keep it. The usual suspects:

- **Static collections** that only grow, such as a cache or registry that never removes anything.
- **Listeners and callbacks** that are registered but never removed.
- **ThreadLocal** values on pooled threads that are never cleared.
- **Unbounded caches.** Use a size-limited cache instead, such as a `LinkedHashMap` in access order with `removeEldestEntry` (see [LRU cache](lesson:java-hashmap#q-lru)), or Caffeine.
- **Mutable keys** in a hash map. If a key changes after it was added, its entry can never be found again (see [the mutable key trap](lesson:java-hashmap#contract)).
- **Class loaders** kept alive by a static reference. They keep all their classes alive with them.

### Finding the problem {#diagnosing}

- Add `-XX:+HeapDumpOnOutOfMemoryError` in production, and open the dump in a heap analyser. Look at the **dominator tree**, which shows which objects keep the most memory alive.
- `jcmd <pid> GC.heap_info`, `jcmd <pid> GC.class_histogram` and `jmap -histo <pid>` show which objects exist and how many.
- **Java Flight Recorder** (`jcmd <pid> JFR.start`) records allocation and GC behaviour with little overhead.
- If the heap keeps growing after each full collection, you have a leak. If the heap is simply too small, it shows a flat "saw-tooth" pattern at the limit.

## The Java Memory Model {#jmm}

Everything so far was about *where* data lives. The JMM is about *when a change becomes visible* to other threads. It is specified in JSR 133 ([Java 5](lesson:java-version-history#java-5)). The [concurrency lesson](lesson:java-concurrency) builds on it with locks, executors and virtual threads.

### Why it is needed {#jmm-why}

Each CPU core has its own caches and registers. Both the compiler and the CPU may also **reorder** independent operations to run faster.

Inside one thread, the result always looks as if the code ran in order. Between threads, there is no such promise unless you ask for one. A write on one thread may stay invisible to another thread for any length of time, or be seen in a different order:

```java
class Stopper {
    boolean running = true;               // not volatile

    void worker() { while (running) { /* work */ } }   // may never see the change
    void stop()   { running = false; }
}
```

The JIT is allowed to read `running` only once and keep it in a register. Then `worker()` may loop forever. The JMM states exactly which guarantees you get, and what you must write to get them.

### Three problems it solves {#jmm-problems}

| Problem | Meaning | Tools |
| --- | --- | --- |
| **Atomicity** | An operation happens completely or not at all. | `synchronized`, locks and atomic classes. |
| **Visibility** | A write by one thread is seen by another thread. | `volatile`, `synchronized`, `final`, and thread start and join. |
| **Ordering** | Other threads do not see operations out of order. | `volatile` and `synchronized`. |

### Happens-before {#happens-before}

The central idea is the **happens-before** relation. If action A happens-before action B, then B sees everything A did, and A appears to run before B. The main rules:

- **Program order:** each action in a thread happens-before the next action in the same thread.
- **Monitor lock:** unlocking a monitor happens-before every later lock of the same monitor.
- **Volatile:** a write to a `volatile` field happens-before every later read of that field.
- **Thread start:** `thread.start()` happens-before every action in the new thread.
- **Thread join:** every action in a thread happens-before another thread returns from `join()` on it.
- **Transitivity:** if A happens-before B, and B happens-before C, then A happens-before C.

The `java.util.concurrent` classes add more rules. For example, submitting a task to an executor happens-before the task runs. And whatever a thread did before putting an item into a concurrent collection happens-before the action of the thread that takes it out.

A **data race** is when two threads use the same variable, at least one of them writes, and no happens-before rule connects them. With a data race, the result is not guaranteed.

### volatile {#volatile-jmm}

A `volatile` field gives **visibility and ordering**, but not atomicity. Making `running` volatile fixes the example above.

But `volatile int count; count++` is still a bug. `count++` is three steps (a read, an add and a write), and two threads can mix their steps. Use `AtomicInteger`, `LongAdder` or a lock for that.

### synchronized {#synchronized-jmm}

A `synchronized` block gives two things:

1. **Mutual exclusion:** only one thread at a time runs the block, so the whole block is atomic.
2. **Visibility:** unlocking happens-before the next lock of the same monitor. So the next thread that takes the same lock sees everything written inside the block.

Both threads must use the **same** lock for this to work.

### final fields {#final-jmm}

The JMM gives `final` fields a special guarantee. Once the constructor finishes, any thread that sees a reference to the object also sees the correct values of its final fields, without any synchronization.

There is one condition: `this` must not **escape** during construction. It escapes, for example, if the constructor registers the object as a listener. This guarantee is one reason immutable objects are safe to share.

### Safe publication and double-checked locking {#dcl}

**Publishing** an object means making it visible to other threads. Publishing it before it is fully set up is *unsafe publication*. The classic example is the lazy singleton:

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

Without `volatile`, the assignment can be reordered. Another thread could then see an `instance` that is not `null` but whose fields are not set yet.

There are simpler options:

- The **holder idiom**: a private static nested class holds the instance, and the JVM creates it the first time the class is used.
- An `enum` singleton.

### Atomicity of long and double {#long-double}

On some JVMs, reads and writes of `long` and `double` fields that are not `volatile` may be split into two 32-bit operations. Another thread could then see half of an old value and half of a new one. In practice, 64-bit JVMs do not split them, but the specification allows it. `volatile` guarantees that they are atomic.

Try it in the lab: [Visibility: why a thread never sees the flag change](lab:jmm-visibility).

## Cheat sheet {#cheatsheet}

| Question | Answer |
| --- | --- |
| Where do local primitives live? | On the stack, in the method's frame. |
| Where do objects live? | On the heap. |
| Where do object references live? | In whatever holds them: a stack frame, or a field inside a heap object. |
| Where does the string pool live? | In the heap, since Java 7. |
| Where are class definitions? | In Metaspace, since Java 8. |
| Is a local variable thread-safe? | Yes, because each thread has its own stack. |
| Are fields thread-safe? | No, not without synchronization, `volatile` or immutability. |
| Which flags set the maximum heap and the thread stack size? | `-Xmx` and `-Xss`. |
| Is `"a" == "a"` true? | Yes, because both are the same pooled literal. |
| Is `new String("a") == "a"` true? | No. |
| Is `Integer` 127 == 127 true? | Yes. But 128 == 128 is false, because they are two boxed objects. |

## Interview questions {#questions}

### [basic] What is the difference between the stack and the heap? {#stack-vs-heap}

- The **stack** belongs to one thread. It holds one frame per method call, with the local variables, parameters and partial results. It is small and fast, and a frame is freed automatically when its method returns.
- The **heap** is shared by all threads and holds every object and array. It is much larger. The garbage collector frees an object when nothing refers to it any more.

For example, in `Order o = new Order(7);` the variable `o` (a reference) is on the stack, and the `Order` object is on the heap.

### [basic] Where are local variables, instance variables and static variables stored? {#where-variables}

- **Local variables** and parameters are in the **stack frame** of their method.
- **Instance variables** are part of their object, on the **heap**.
- **Static variables** belong to the class. In HotSpot they are stored in the class's mirror object (its `Class` object) on the heap. The class metadata itself is in Metaspace.

Whether a variable is a primitive or a reference decides what its slot contains (a value or a pointer). It does not decide where the slot is.

### [basic] What is the string pool? {#what-is-pool}

A table of unique `String` objects that the JVM keeps, so that equal string literals share one object.

- Literals are added to the pool when their class is loaded.
- `String.intern()` can look up or add strings while the program runs.
- Since [Java 7](lesson:java-version-history#java-7), the pool is part of the heap, so pooled strings that nobody uses can be garbage-collected.

### [basic] What is the difference between == and equals() for strings? {#string-equality}

`==` compares **references**: do both variables point to the same object? `equals()` compares the **characters**.

- `"hi" == "hi"` is true, because both are the same pooled literal.
- `new String("hi") == "hi"` is false, because they are two objects.

Always use `equals()` (or `equalsIgnoreCase()`) for text. `==` happens to work for literals, and nothing else you should depend on.

### [basic] How many objects does new String("hello") create? {#how-many-objects}

**One at run time.** `new String(...)` always creates a new `String` on the heap.

The literal `"hello"` is also an object, in the string pool. It is created when the class is loaded, but only if that text was not there already. So the full answer is "one, or two if you count a pooled literal that was new".

Interviewers mostly want to hear that `new String(...)` always makes a new heap object and is rarely a good idea.

### [basic] Why is String immutable in Java? {#why-immutable}

Because strings are shared. Four reasons:

1. **The pool** lets many variables refer to one object. That is only safe if nobody can change it.
2. **The hash code can be cached**, which makes strings fast map keys.
3. **Security:** strings are safe to use as file names, class names and other sensitive parameters, because they cannot change after a check.
4. **Thread safety:** strings can be shared between threads without locks.

The cost is that every "change" creates a new string.

### [basic] Is Java pass-by-value or pass-by-reference? {#pass-by-value-q}

**Always pass-by-value.**

- For a primitive, the value is copied.
- For an object, the *reference* is copied. The called method gets its own variable that points to the same object.

So the method can change the object's fields, and the caller sees the change. But if the method points its parameter at a different object, the caller's variable does not change.

### [basic] What causes StackOverflowError, and what causes OutOfMemoryError? {#soe-vs-oom}

- **`StackOverflowError`** means one thread's stack is full. It nearly always comes from recursion that never stops or goes too deep. You fix it in the code.
- **`OutOfMemoryError`** means a memory area ran out, and the message says which one: *Java heap space*, *Metaspace*, *unable to create native thread* or *Direct buffer memory*. It needs diagnosis, usually a heap dump. The fix may be a leak, a bigger limit or a smaller data set.

### [intermediate] What does String.intern() do, and should you use it? {#intern-q}

It returns the string from the pool that equals this one. If none is there, it adds this string to the pool first. After `String t = s.intern()`, `t` is the pooled object, so `t == "literal"` is true for the same text.

When it helps: you have very many duplicates of a few values. It also makes `==` comparisons possible.

Its costs:

- Each call is a hash lookup.
- The pool is shared and has a fixed number of buckets.
- It encourages the `==` mistake.

In modern Java, prefer your own bounded cache, or G1's string deduplication.

### [intermediate] Where is the string pool stored, and did that change? {#pool-history}

**Yes, it moved.**

- In **Java 6 and earlier**, it was in the permanent generation, a fixed-size area. Heavy interning could cause `OutOfMemoryError: PermGen space`.
- **Java 7** moved it to the normal **heap**. There, pooled strings are garbage-collected when nothing reaches them.
- **Java 8** then removed PermGen completely and replaced it with Metaspace.

You can tune the number of buckets with `-XX:StringTableSize`.

### [intermediate] What does this print? "a" + "b" == "ab" and the same with non-final variables. {#constant-folding}

- `"a" + "b" == "ab"` is **true**. The compiler folds the constant expression into the literal `"ab"`, which is the pooled one.
- With `String p = "a"; (p + "b") == "ab"` it is **false**. The joining happens at run time and builds a new object.
- If `p` is declared `final String p = "a";`, it is a constant variable. The expression is folded again, and the result is **true**.

The lesson: never rely on `==` for strings.

### [intermediate] Why is Integer 127 == 127 true but 128 == 128 false? {#integer-cache}

Autoboxing calls `Integer.valueOf`, which returns cached objects for the values **-128 to 127**.

- Two boxes of 127 are the same cached object, so `==` is true.
- Outside that range, each call creates a new `Integer`. `==` then compares two different objects, so it is false.

You can raise the upper limit with `-XX:AutoBoxCacheMax`. Compare wrappers with `equals()`.

### [intermediate] What is the difference between String, StringBuilder and StringBuffer? {#sb-sbuf}

- **`String`** cannot change.
- **`StringBuilder`** is a buffer you can change, and it is not synchronized. It is the right choice for building text in one thread. The compiler also uses it behind simple concatenation.
- **`StringBuffer`** is the same, but every method is `synchronized`. It is old: you rarely share a builder between threads, and locking each call is the wrong level of locking anyway.

Joining strings in a loop with `+=` copies the whole string every time, so use a `StringBuilder` there.

### [intermediate] How is the heap organised? What are eden, survivor and old? {#generations-q}

The heap is split by age, because most objects die young.

1. New objects are created in **eden**.
2. When eden fills up, a young collection copies the live objects into a **survivor** space and raises their age. There are two survivor spaces, used in turn.
3. Objects that survive enough collections are **promoted** to the **old generation**, which is collected less often.

Some modern collectors (G1, ZGC, Shenandoah) divide the heap into regions instead of fixed areas, but the idea of age stays. The details are in the [garbage collector lesson](lesson:garbage-collector#generations).

### [intermediate] What flags would you set for heap and stack size? {#jvm-flags}

- `-Xms` sets the initial heap size and `-Xmx` the maximum. Production services often set them equal, to avoid pauses for resizing.
- `-Xss` sets the stack size of each thread.
- In containers, `-XX:MaxRAMPercentage` sizes the heap as a share of the container limit.

Remember that the heap is not the whole process. Metaspace, thread stacks, direct buffers and the code cache add to it, so leave room below the container limit.

### [intermediate] What is Metaspace, and how does it differ from PermGen? {#metaspace-q}

Both hold class metadata. The difference is where they live:

- **PermGen** was a fixed-size part of the Java heap. You had to size it (`-XX:MaxPermSize`), and you could run out.
- **Metaspace** ([Java 8](lesson:java-version-history#java-8), JEP 122) lives in **native memory** and grows when needed. Only `-XX:MaxMetaspaceSize` or the machine's memory limits it.

Class metadata is freed when its class loader can no longer be reached. So when Metaspace keeps growing, it usually points to a class loader leak or to code that keeps generating classes.

### [intermediate] What is a GC root? Give examples. {#gc-root-q}

A starting point for reachability. An object stays alive if a chain of references leads to it from a root. Examples of roots:

- **local variables and parameters on the stacks of active threads**;
- **static fields** of loaded classes;
- **live threads**;
- JNI global references.

Everything the collector cannot reach from a root is garbage. This is true even if objects in that group refer to each other: reference cycles do not keep each other alive.

### [intermediate] Give examples of memory leaks in a garbage-collected language. {#leak-examples}

A leak is a reference you forgot about. Common examples:

- a **static `Map` used as a cache that never removes entries**;
- **listeners** that are registered and never removed;
- **`ThreadLocal`** values on pooled threads that are never cleared;
- **inner classes** or lambdas that capture a large outer object;
- a **mutable key** in a hash map;
- an **unclosed resource** whose cleaner still holds the buffer;
- a **class loader** kept by a static field after a redeploy.

You find them with a heap dump and its dominator tree.

### [intermediate] Are local variables thread-safe? What about an object referenced by one? {#locals-thread-safe}

**The variable is, but the object may not be.** Each thread has its own stack, so a local variable is always private to its thread.

- If it holds a **primitive**, nothing is shared.
- If it holds a **reference**, the variable is private, but the *object* may be shared. That happens if the reference came from somewhere else, or if you stored it in a field or collection that another thread can see. A shared object needs synchronization or immutability.

An object that is created locally and never escapes the method is safe.

### [intermediate] What is escape analysis? {#escape-analysis-q}

An analysis done by the JIT compiler. It decides whether an object can be seen outside the method (or thread) that creates it.

If the object cannot be seen outside:

- the compiler can remove the allocation and keep the object's fields in registers (scalar replacement);
- it can remove locks on that object.

The rules of Java do not change: objects are still on the heap in theory. This is why creating small short-lived objects, such as iterators or `Optional`s, is usually cheap in hot code.

### [deep] What is the Java Memory Model, and what does happens-before mean? {#jmm-q}

The JMM defines how threads interact through memory: which writes a read may see, and which reorderings are allowed.

**Happens-before** is the guarantee it uses. If action A happens-before action B, B sees the effects of A. The rules that create happens-before are:

- program order inside one thread;
- unlocking a monitor before a later lock of the same monitor;
- a volatile write before a later read of it;
- `Thread.start()` and `join()`;
- submitting a task to an executor, and handing an item over through a concurrent collection;
- transitivity.

If no such rule connects a write and a read of the same variable, you have a **data race**, and there is no guarantee.

### [deep] What exactly does volatile guarantee, and what does it not? {#volatile-q}

It guarantees:

1. **Visibility:** a write is seen by every later read, from any thread.
2. **Ordering:** operations before the write are not moved after it. The write happens-before later reads.
3. **Atomic `long` and `double`:** reads and writes of these types are not split.

It does **not** make compound operations atomic. `count++` on a volatile field is still a race that can lose updates. Use `AtomicInteger`, `LongAdder` or a lock for that.

Typical good uses are a stop flag, or publishing an immutable object once.

### [deep] Why does double-checked locking need volatile? {#dcl-q}

Because `instance = new Config()` is really three steps:

1. Allocate memory.
2. Run the constructor.
3. Assign the reference.

Without a happens-before rule, the compiler or the CPU may make the assignment visible **before** the constructor's writes. A second thread then sees an `instance` that is not `null` but only partly built, and it skips the `synchronized` block.

Making the field `volatile` forbids that reordering. The holder idiom or an enum singleton avoids the problem completely.

### [deep] How do final fields help with thread safety? {#final-q}

The JMM promises that once a constructor finishes, every thread that sees the object also sees the correct values of its final fields, with no synchronization. The condition is that `this` did not escape from the constructor.

So a truly immutable object (all fields final, and no escaping references to changeable parts) is safe to share and to publish through a plain field. That is why `String`, `Integer` and records are so easy to use across threads.

### [deep] Why does an Integer or an object cost more memory than the data it holds? {#object-overhead}

Because every object has a header, and its size is rounded up to 8 bytes. On 64-bit HotSpot with compressed pointers, the header is 12 bytes.

For example, an `int` is 4 bytes. An `Integer` is 16 bytes, plus the 4-byte reference that points to it. A `HashMap` entry adds another node object on top.

So collections of boxed values or tiny objects use several times the size of the raw data. This is the reason for primitive arrays, specialised collections, Project Valhalla and compact object headers.

### [deep] Where do the stack frames of virtual threads live? {#virtual-stack-q}

**On the heap while the thread waits, and on a carrier thread's stack while it runs.**

1. While a virtual thread runs, its frames are on the stack of its carrier (platform) thread, like any other frames.
2. When it blocks and is unmounted, the JVM copies its frames into **stack-chunk objects on the heap**.
3. When it continues, the JVM copies them back.

So its stack grows and shrinks with use. That is how millions of virtual threads fit in memory. The same number of platform threads would not fit, because each one reserves a fixed stack.

### [deep] What is direct (off-heap) memory, and when would you use it? {#direct-memory}

Memory outside the Java heap, in native memory. `ByteBuffer.allocateDirect` and the Foreign Function and Memory API allocate it.

Why use it:

- It avoids a copy when the data goes to the operating system for input and output. That is why networking libraries such as Netty use it.
- The collector does not move it.

Its costs:

- Allocating it is slower.
- It is freed only when the buffer object is collected, or explicitly with the newer APIs.
- When it runs out, you get `OutOfMemoryError: Direct buffer memory`.

Its size is limited by `-XX:MaxDirectMemorySize`.

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

- `s1 == s2` is true. `"ware" + "house"` is a compile-time constant, so it is the pooled literal.
- `s1 == s3` is false. `new String` makes a separate heap object.
- `s1 == s4` is false. `part` is not final, so the joining runs at run time and builds a new object.
- `s1 == s5` is true. `intern()` returns the pooled object, which is `s1`.
- `equals` is true for all of them, because the characters are the same.

### [coding] This cache grows until the service crashes. Find the problem. {#leak-cache}

```java
public class ProductCache {
    private static final Map<String, Product> CACHE = new HashMap<>();

    public static Product get(String sku) {
        return CACHE.computeIfAbsent(sku, ProductCache::loadFromDb);
    }
}
```

There are two problems.

1. **A leak.** The map is **static**, so it is a GC root, and it has **no limit**. Every SKU ever requested stays reachable forever. Heap use climbs until `OutOfMemoryError`.
2. **A thread-safety bug.** It is a plain `HashMap` used by many threads.

Fix both with a bounded, thread-safe cache that removes old entries. For example, use Caffeine (`Caffeine.newBuilder().maximumSize(10_000).expireAfterWrite(...)`), or a `LinkedHashMap` in access order wrapped for concurrency. Then take a heap dump before and after the change to check the fix.
