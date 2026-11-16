---
title: JVM troubleshooting — thread dumps, heap dumps and profiling in production
nav: JVM troubleshooting
slug: jvm-troubleshooting
summary: How to diagnose a Java service that is slow, hung, out of memory or killed: choosing the tool from the symptom, thread dumps and deadlocks, finding the busy thread, heap dumps and leak analysis, the different OutOfMemoryErrors, native memory and container limits, Java Flight Recorder and flame graphs, class loading and the JIT, and doing it safely in Kubernetes and Spring Boot, with examples and interview questions.
tags: [Java, JVM, Troubleshooting, Profiling, Production, Memory]
order: 16
topic: Java / JVM
updated: 2026-11-16
subnav: true
---

A production incident rarely says what is wrong. It says **"the payments API is slow"**, **"the pod keeps restarting"** or **"nothing responds"**. Interviews for experienced roles ask *what you do in the first ten minutes: which tool, what you look for and what it means.* The JDK already contains everything needed (`jcmd`, thread dumps, heap dumps, Flight Recorder), and the skill is matching the symptom to the right evidence. Play the four scenes: symptom to tool, a memory leak, a busy thread and a deadlock.

```demo
name: jvm-walk
```

> **One sentence to remember:** *Look at the symptom first (CPU, memory, hang or kill), take the evidence that fits it (thread dumps, GC log, heap dump, Flight Recorder), take it before you restart, and read it for what is waiting, what is running and what is holding memory.*

## Start with the symptom {#triage}

| Symptom | First look | Evidence to take |
| --- | --- | --- |
| high CPU | which thread is busy | `top -H`, then a [thread dump](#thread-dumps), or a Flight Recorder profile |
| requests hang, CPU low | what threads are waiting for | three thread dumps, 10 seconds apart |
| heap keeps growing, then `OutOfMemoryError` | heap after each full GC | [GC log](lesson:garbage-collector#gc-logs), then a [heap dump](#heap-dumps) |
| slow only after a deploy or restart | JIT warm-up, cold caches, pool start | [JIT](#jit) and a warm-up plan |
| slow under load only | contention, GC pauses, a full pool | Flight Recorder: locks, GC, I/O |
| pod `OOMKilled` (exit code 137) | process memory, not just the heap | [native memory tracking](#native) |
| `NoClassDefFoundError`, `NoSuchMethodError` | which jar the class came from | [class loading](#classloading), `mvn dependency:tree` |

Three habits apply to every case:

1. **Capture before you restart.** A restart clears the evidence. Take the dumps, copy the logs, then restart.
2. **Take more than one sample.** A single thread dump is one moment; three dumps show what is *stuck* and what is just *passing through*.
3. **Change one thing at a time**, and confirm the fix by looking at the same evidence again.

## The tools in the JDK {#tools}

Almost everything goes through **`jcmd`**, which talks to a running JVM by its process id. It replaces the older `jstack`, `jmap` and `jinfo`, which still work.

| Need | Command |
| --- | --- |
| find the process id | `jcmd` (lists JVMs) or `jps -l` |
| thread dump | `jcmd <pid> Thread.print` (older: `jstack <pid>`) |
| heap dump | `jcmd <pid> GC.heap_dump /dumps/app.hprof` (older: `jmap -dump`) |
| objects per class | `jcmd <pid> GC.class_histogram` |
| heap layout and GC state | `jcmd <pid> GC.heap_info`, and `jstat -gcutil <pid> 1000` |
| flags and system properties | `jcmd <pid> VM.flags`, `VM.system_properties`, `VM.command_line` |
| native memory | `jcmd <pid> VM.native_memory summary` |
| Flight Recorder | `jcmd <pid> JFR.start`, `JFR.dump`, `JFR.stop` |
| everything it can do | `jcmd <pid> help` |

`jcmd` must run as the **same user** as the JVM, on the same machine (or in the same container), and you need a **JDK**, not just a JRE. That matters in containers, see [containers](#containers). `kill -3 <pid>` also prints a thread dump, to the standard output of the JVM, and does **not** stop it.

## Thread dumps {#thread-dumps}

A **thread dump** is a snapshot of every thread: its name, state and stack. It answers *"what is each thread doing right now?"*, which is the first question for a hang, a slowdown and a deadlock.

```text
"http-nio-8080-exec-17" #58 [4471] prio=5 os_prio=0 cpu=1204.5ms elapsed=915.2s tid=0x00007f2c0c0a1000 nid=0x1177 waiting on condition [0x00007f2bd2cfd000]
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:269)
        at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:181)
        at com.bank.payments.PaymentRepository.save(PaymentRepository.java:44)
        at com.bank.payments.PaymentService.pay(PaymentService.java:61)
```

How to read it:

- **Name** (`http-nio-8080-exec-17`) tells you which pool the thread belongs to. A request handler, a scheduler or a database pool thread each look different.
- **`nid`** is the operating-system thread id **in hexadecimal**. It lets you match a thread to `top -H`, see [High CPU](#cpu).
- **State** is one of the [thread states](lesson:java-concurrency#thread-states): `RUNNABLE` (running or ready), `BLOCKED` (waiting for a `synchronized` monitor), `WAITING` and `TIMED_WAITING` (waiting for another thread, a lock, a sleep or a timeout).
- **The stack**, read from the top, shows exactly where it is waiting. Here the thread waits for a database connection in `HikariPool.getConnection`.

What to look for:

| Pattern across the dump | Meaning |
| --- | --- |
| most request threads in the same frame | a shared bottleneck: connection pool, lock, slow downstream call |
| many threads `BLOCKED` on one lock | lock contention; find the thread that **owns** that lock |
| all request threads waiting in `HikariPool.getConnection` | pool exhausted, often because a slow query or a leaked connection holds them |
| threads waiting in `SocketInputStream.read` or `Socket.connect` | slow or dead downstream service with no timeout set |
| `Found one Java-level deadlock` at the end | a [deadlock](lesson:java-concurrency#deadlock) with the threads and locks named |
| a few threads `RUNNABLE` in the same method, every dump | CPU-bound code, see [High CPU](#cpu) |

Two cautions. A thread in `RUNNABLE` inside a native socket read is **not** using CPU; the JVM reports "runnable" for blocking I/O. And a single dump can mislead, so take **three** and compare.

**Virtual threads** ([Java 21](lesson:java-version-history#java-21)) are not in the normal `Thread.print` output because there can be millions. Use `jcmd <pid> Thread.dump_to_file -format=json /dumps/threads.json` to include them.

## High CPU: find the busy thread {#cpu}

A process at 100% CPU has one or a few threads doing the work. Find them in four steps (the "busy thread" scene above):

```bash
top -H -p 4212                     # -H lists threads; note the thread id with the highest %CPU, say 4377
printf '%x\n' 4377                 # 1119  (decimal to hexadecimal)
jcmd 4212 Thread.print | grep -A 20 'nid=0x1119'
```

The stack tells you the code. Typical findings:

- **A hot loop or a runaway retry**, with no delay between attempts.
- **Catastrophic regular-expression backtracking** on user input; nested repetition such as `(a+)+$` takes exponential time on a long string. It is also a denial-of-service risk, so limit input length and use simple patterns.
- **GC threads** (names such as `G1 Conc#0` or `GC Thread#3`) at the top: it is a memory problem. Look at the [GC log](lesson:garbage-collector#gc-logs), not the code.
- **JIT compiler threads** (`C2 CompilerThread`) high after a deploy: warm-up, which settles by itself, see [the JIT](#jit).
- **Serialization, logging or string building** done for every request at a high rate; a profile (below) shows it.

If the stack is not conclusive, record a **Flight Recorder profile** for a minute. It shows where CPU time goes over time, not at one instant.

## Heap dumps and memory leaks {#heap-dumps}

A **heap dump** (`.hprof` file) is a copy of every object on the heap and every reference between them. It answers *"what is holding the memory?"*. For the idea of a leak in a garbage-collected language see [memory leaks](lesson:java-memory-model#leaks); here is how you find one.

**Recognise a leak first.** In the [GC log](lesson:garbage-collector#gc-logs), look at the heap size **after each full GC** (or after a concurrent cycle in G1). If that figure rises over hours, objects are being kept. If it stays flat and only the peaks are high, the heap is just too small or the allocation rate is high, which is a tuning problem and not a leak.

**Take a dump:**

```bash
jcmd 4212 GC.heap_dump /dumps/payments.hprof        # live objects only: a full GC runs first
jcmd 4212 GC.heap_dump -all /dumps/payments.hprof   # include unreachable objects too
```

and always start production JVMs with:

```text
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps
```

so the evidence exists even if nobody was watching (the file goes to a volume that outlives the pod).

**Analyse it** with **Eclipse MAT** (the Memory Analyzer), VisualVM or the IntelliJ profiler. Key ideas:

| Term | Meaning |
| --- | --- |
| **shallow heap** | the memory of the object itself, without what it points to |
| **retained heap** | the memory that would be freed if this object disappeared: itself plus everything only it keeps alive |
| **dominator tree** | objects ordered by retained heap; the biggest entries are the suspects |
| **GC root** | something the collector must treat as alive: a static field, a live thread, a local variable on a stack, a JNI reference |
| **path to GC roots** | the chain of references from a root to the object; it shows **who** is keeping it alive |

The method, as in the "heap dump" scene: open the dump, read the **Leak Suspects** report or the dominator tree, pick the biggest object, run **Path to GC Roots** (excluding weak and soft references) and find the one reference that should not be there. Common culprits:

- a **static collection** or a cache with no size limit or expiry;
- **listeners and callbacks** registered and never removed;
- a **`ThreadLocal`** in a pooled thread that is never cleared (see [ThreadLocal problems](lesson:java-concurrency#threadlocal-q));
- a **class loader** kept alive by a thread or driver, which pins all its classes and [Metaspace](lesson:java-memory-model#metaspace);
- **unclosed resources**: result sets, streams, HTTP responses;
- a **session or request attribute** that grows with every call.

For a quick hint without a full dump, `jcmd <pid> GC.class_histogram` lists the number of instances and bytes per class. If `byte[]`, `String` or one of your own classes keeps growing between two runs, that is the lead.

**A heap dump is dangerous data.** It contains everything in memory: card numbers, tokens, passwords, personal data. In a bank, treat it as confidential: store it encrypted, restrict access, delete it afterwards and never attach it to a ticket. Taking one also **pauses** the JVM for seconds to minutes for a large heap, so on a service behind a load balancer remove the instance from rotation first.

## OutOfMemoryError: read the message {#oom}

The text after `java.lang.OutOfMemoryError:` names the area that ran out. It decides everything that follows.

| Message | Meaning and usual cause | What to do |
| --- | --- | --- |
| `Java heap space` | the heap is full of reachable objects: a leak, or a heap too small for the data | heap dump; fix the leak, or raise `-Xmx` if the load is real |
| `GC overhead limit exceeded` | the collector uses almost all CPU and frees almost nothing (Parallel GC) | same as above: nearly out of heap |
| `Metaspace` or `Compressed class space` | too many classes: a class loader leak after redeploys, or runaway proxy or class generation | find the leaked loader in a heap dump, see [Metaspace](lesson:garbage-collector#metaspace) |
| `unable to create native thread` | the OS refused a new thread: too many threads, a process or memory limit | thread dump to count threads; use a bounded pool or [virtual threads](lesson:java-concurrency#virtual-threads) |
| `Direct buffer memory` | off-heap `ByteBuffer`s (Netty, NIO) exceeded `-XX:MaxDirectMemorySize` | find who allocates direct buffers and does not release them |
| `Requested array size exceeds VM limit` | code tried to create a huge array | a bug, often a bad size calculation |
| `Out of swap space?` | the OS has no memory left for the JVM | machine or container is too small |

An `OutOfMemoryError` is an `Error`: do not catch it and carry on. After it, the JVM may be half-working. In containers it is better to **exit and be restarted** with `-XX:+ExitOnOutOfMemoryError` (or `-XX:+CrashOnOutOfMemoryError`, which also writes a crash file), combined with the heap-dump flag above, so the platform replaces a broken instance.

## Native memory and container limits {#native}

The heap is only part of a JVM process. The total also includes **Metaspace, thread stacks (about 1 MB each by default), direct buffers, the code cache, the GC's own structures and native libraries.** A container limit applies to the **whole process**, so a pod can be killed with exit code **137** (`OOMKilled`, a `SIGKILL` from the kernel) while the heap is only 60% full. There is no Java exception and no heap dump, because the JVM never gets the chance.

Break the total down with **Native Memory Tracking**:

```bash
# start the JVM with:  -XX:NativeMemoryTracking=summary
jcmd 4212 VM.native_memory baseline
# ... wait while memory grows ...
jcmd 4212 VM.native_memory summary.diff
```

The diff shows which area grew: `Thread` (too many threads), `Internal` or `Other` (direct buffers), `Class` (metadata), `Code`, `GC`. Tracking costs a little performance, so enable it when investigating. To avoid the problem, leave headroom: set `-XX:MaxRAMPercentage` to something like 60 to 75, not 100 (see [containers and the GC](lesson:garbage-collector#choosing)), and cap threads and direct memory.

## Profiling with Flight Recorder {#jfr}

A thread dump is one instant. A **profile** shows where time goes **over time**. **Java Flight Recorder (JFR)** is built into the JVM: it records events (method samples, allocations, lock waits, GC pauses, file and socket I/O, exceptions) into a `.jfr` file with typically **1 to 2% overhead**, which is why it is safe to run in production. It has been in OpenJDK since [Java 11](lesson:java-version-history#java-11) (and 8u262).

```bash
jcmd 4212 JFR.start name=incident duration=120s filename=/dumps/incident.jfr settings=profile
# or from the start of the JVM:
#   -XX:StartFlightRecording:filename=/dumps/app.jfr,maxsize=200m,settings=profile
jfr summary /dumps/incident.jfr                       # which events were recorded
jfr print --events jdk.GCPhasePause /dumps/incident.jfr
```

Open the file in **JDK Mission Control** to see hot methods, allocation by class and stack, lock contention, GC pauses and I/O waits on one timeline.

For a different view, **async-profiler** (also free) produces **flame graphs**. In a flame graph each box is a method, boxes stack to show who called whom, and the **width** is the share of samples where that method was on the stack. So:

- wide boxes at the top are where the time is spent;
- the horizontal order has **no meaning** (it is sorted by name, not by time);
- look for a wide plateau, then read down to see who calls it.

Sampling profilers see only what is **running**, so for threads waiting on locks or I/O use the wall-clock mode of the profiler or JFR's lock and I/O events. Profile with realistic load, and change one thing between two profiles so that you can compare them.

## Class loading {#classloading}

The JVM loads classes on demand, through a chain of **class loaders** that ask their **parent first** (bootstrap, then platform, then application, in Spring Boot also a nested jar loader). That is why you cannot replace `java.lang.String`, and why two different jar versions of one class give surprises: the first one found on the class path wins.

| Error | Meaning |
| --- | --- |
| `ClassNotFoundException` | code asked to load a class **by name** (`Class.forName`, a driver, a framework) and it is not on the class path; a checked exception |
| `NoClassDefFoundError` | the class **was** present when compiled but is missing or failed to initialise at run time; an `Error`. Check for an earlier `ExceptionInInitializerError` |
| `NoSuchMethodError`, `IncompatibleClassChangeError` | two versions of a library: the code compiled against one and runs with another. Run `mvn dependency:tree` or `gradle dependencyInsight` (see [Maven](lesson:maven) and [Gradle](lesson:gradle)) |

To see where a class came from, start with `-Xlog:class+load` (or `-verbose:class`) and search for its name; the source jar is in the line.

## The JIT and warm-up {#jit}

HotSpot first **interprets** bytecode, then compiles hot methods with **C1** (fast, simple code) and, if they stay hot, with **C2** (slow to compile, very optimised): this is **tiered compilation**. The result is that a JVM is **slowest right after start**: code is cold, caches are empty and compiler threads compete for CPU. Consequences you can explain in an interview:

- the first requests after a deploy are slow, and CPU is high for a minute or two; send traffic gradually and warm up with representative requests before the pod is marked ready;
- a benchmark that does not warm up measures the interpreter, not your code (use JMH);
- the optimised code is based on assumptions (for example that a call has one implementation); if a new class breaks one, the JVM **deoptimises** and falls back for a while;
- the **code cache** holds the compiled code; if it fills (`CodeCache is full. Compiler has been disabled`) performance drops suddenly, so raise `-XX:ReservedCodeCacheSize`;
- to cut start-up time: **class data sharing** (`-XX:+AutoCreateSharedArchive`), Spring AOT and native images, or CRaC (checkpoint and restore).

`-XX:+PrintCompilation` shows what is compiled, and JFR records compilation events.

## Doing it safely in production {#production}

### In Spring Boot {#boot}

[Actuator](lesson:spring-observability#actuator) gives much of this over HTTP: `/actuator/threaddump` (a thread dump, the quickest option), `/actuator/heapdump` (downloads a heap dump, so **never expose it publicly**), `/actuator/metrics/jvm.memory.used`, `jvm.gc.pause` and `jvm.threads.live`, `/actuator/health`. Expose only what you need with `management.endpoints.web.exposure.include`, put it on a separate management port and secure it. With [Micrometer metrics](lesson:spring-observability#metrics) graphed (heap after GC, GC pause, thread count, pool usage, connection pool waiting) you see a problem developing before the incident.

### In containers {#containers}

Run `jcmd` inside the pod, where the JVM is usually process id 1:

```bash
kubectl exec payments-7c9d-x4k2 -- jcmd 1 Thread.print
kubectl exec payments-7c9d-x4k2 -- jcmd 1 GC.heap_dump /dumps/app.hprof
kubectl cp payments-7c9d-x4k2:/dumps/app.hprof ./app.hprof
```

A minimal ("distroless") image has only a JRE and no `jcmd`. Options: use an image with a JDK, or attach an **ephemeral debug container** with `kubectl debug --target`, sharing the process namespace. Write dumps to a mounted volume, because the container file system disappears when the pod does. See [Kubernetes](lesson:kubernetes) for pods and volumes.

### Rules of thumb for a bank {#rules}

- keep `-XX:+HeapDumpOnOutOfMemoryError`, `-XX:+ExitOnOutOfMemoryError` and [GC logging](lesson:garbage-collector#gc-logs) on **by default**; they cost almost nothing;
- keep Flight Recorder available and practise using it **before** the incident;
- never put card numbers, tokens or personal data in logs, and treat dumps as confidential data;
- remove an instance from the load balancer before a heap dump, and take the dump from one instance, not all of them;
- write a short runbook: symptom, command, what to look for and who to call.

## Cheat sheet {#cheatsheet}

| Situation | Do this |
| --- | --- |
| hang, low CPU | three thread dumps 10 s apart; look for the same frame or a deadlock |
| high CPU | `top -H -p pid`, `printf '%x'`, `jcmd pid Thread.print`, find `nid`; or a JFR profile |
| heap grows | GC log: heap after full GC; `GC.class_histogram`; `GC.heap_dump`; Eclipse MAT dominator tree |
| `OutOfMemoryError` | read the text after the colon; start with `HeapDumpOnOutOfMemoryError` |
| `OOMKilled` with a healthy heap | `-XX:NativeMemoryTracking=summary`, `VM.native_memory summary.diff`; lower `MaxRAMPercentage` |
| slow after deploy | warm-up, JIT and code cache; `-XX:+PrintCompilation` |
| where does time go | JFR (`settings=profile`) and a flame graph |
| `NoClassDefFoundError` | `-Xlog:class+load`, `mvn dependency:tree` |
| inside Kubernetes | `kubectl exec pod -- jcmd 1 ...`, or an ephemeral debug container; dumps to a volume |
| every JVM, always on | `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=... -XX:+ExitOnOutOfMemoryError`, GC log |

## Interview questions {#questions}

### [basic] What is a thread dump and how do you take one? {#thread-dump-q}

A thread dump is a snapshot of all threads in a JVM with each one's name, state and stack trace. Take one with `jcmd <pid> Thread.print`, `jstack <pid>`, `kill -3 <pid>` (prints to the JVM's output, does not stop it) or Actuator's `/actuator/threaddump`. It is the first tool for a hang, a slowdown or a deadlock. Take **several** a few seconds apart and compare them, because one snapshot cannot tell a stuck thread from a passing one.

### [basic] What is a heap dump and when do you take one? {#heap-dump-q}

A heap dump is a file (`.hprof`) listing every object on the heap and the references between them. Take one when memory use is high or growing and you need to know **what** holds it: a suspected leak, an `OutOfMemoryError`, or a heap that is full after each full GC. Use `jcmd <pid> GC.heap_dump` or the flag `-XX:+HeapDumpOnOutOfMemoryError`, and open it in Eclipse MAT. It contains sensitive data and pauses the JVM while it is written, so handle it carefully.

### [basic] What does `OutOfMemoryError: Java heap space` mean? Is it always a leak? {#oom-heap-q}

It means the heap is full of objects that are still reachable and the collector could not free enough. It is **not** always a leak: the heap may simply be too small for the data or the load (a large query result, a batch job). To tell them apart, look at the heap after each full GC. If it keeps rising, objects are being kept (a leak: take a heap dump). If it is flat and the application just needs more, raise `-Xmx` or reduce what is held at once (paging, streaming).

### [basic] Which JDK tools do you use to diagnose a running JVM? {#tools-q}

`jcmd` for nearly everything (thread dump, heap dump, class histogram, flags, native memory, Flight Recorder); `jstack` and `jmap` as the older single-purpose versions; `jstat` for GC statistics over time; `jinfo` for flags; `jps` to find process ids; `jfr` and JDK Mission Control for Flight Recorder files; and `-Xlog` options for GC and class-loading logs. Outside the JDK: Eclipse MAT for heap dumps and async-profiler for flame graphs.

### [basic] What is a memory leak in Java, given that there is a garbage collector? {#leak-q}

The collector frees objects that are **unreachable**. A leak is an object that is still **reachable** (a static field, a cache, a registered listener, a `ThreadLocal`) but that the program will never use again, so it is never freed. The heap grows until `OutOfMemoryError`. The cure is to remove the reference: bound or expire caches, unregister listeners, clear `ThreadLocal`s, close resources.

### [intermediate] A service is at 100% CPU. How do you find the cause? {#cpu-q}

Find the busy **thread** with `top -H -p <pid>`, convert its decimal id to hexadecimal (`printf '%x'`), take a thread dump with `jcmd <pid> Thread.print` and find `nid=0x...` to read its stack. Repeat two or three times to confirm. If the thread is a GC thread, it is a memory problem; if it is a compiler thread, it is JIT warm-up; if it is yours, the stack names the loop, regular expression or hot method. For anything not obvious, record a JFR profile to see where CPU time goes over a minute, then fix and compare.

### [intermediate] Requests hang but CPU is low. What do you do? {#hang-q}

The threads are waiting, so take three thread dumps ten seconds apart and look at what the request threads are waiting for. The usual causes: a **connection pool exhausted** (all threads in `HikariPool.getConnection`), a **lock** held by one thread and wanted by many (`BLOCKED`; find the owner), a **deadlock** (reported at the end of the dump), or a **slow downstream call with no timeout** (threads in a socket read). Fix the underlying cause (a slow query, a leaked connection, a missing timeout, a lock order) rather than only enlarging the pool, and add timeouts and metrics so it is visible next time.

### [intermediate] How do you analyse a heap dump? {#analyse-dump-q}

Open it in Eclipse MAT. Run the Leak Suspects report or open the **dominator tree**, which sorts objects by **retained heap** (the memory freed if that object were removed). Take the largest suspect and run **Path to GC Roots**, excluding weak and soft references, to see the chain of references that keeps it alive, for example a static field holding a map with millions of entries. That reference is the bug. Confirm with the histogram (which classes have far too many instances), fix it, then check that the heap after GC stays flat.

### [intermediate] What are the different `OutOfMemoryError`s and what does each point to? {#oom-kinds-q}

The message names the exhausted area. `Java heap space` and `GC overhead limit exceeded`: heap, so a leak or a heap too small. `Metaspace`: too many classes, typically a class loader leak or generated classes. `unable to create native thread`: the OS refused a thread, so too many threads or a process limit. `Direct buffer memory`: off-heap buffers, for example in Netty. `Requested array size exceeds VM limit`: a bug asking for a giant array. Each needs different evidence: a heap dump for heap and Metaspace, a thread dump for threads, native memory tracking for direct buffers.

### [intermediate] A pod is `OOMKilled` but the heap looks fine. Why? {#oomkilled-q}

The container limit covers the **whole process**: heap plus Metaspace, thread stacks, direct buffers, code cache and GC structures. The kernel kills the process (exit code 137) when the total crosses the limit, and the JVM throws nothing and writes no dump. Measure with Native Memory Tracking (`-XX:NativeMemoryTracking=summary`, `jcmd <pid> VM.native_memory summary.diff`) to find the growing area, and leave headroom: `-XX:MaxRAMPercentage` of about 60 to 75, a bounded thread count and a direct memory limit. Also compare the memory limit with the `-Xmx` actually in use.

### [intermediate] What is Java Flight Recorder and why is it suitable for production? {#jfr-q}

JFR is an event recorder built into the JVM. It records method samples, allocations, lock contention, GC pauses, I/O and exceptions into a `.jfr` file, with only about 1 to 2% overhead because it uses data the JVM already has and samples instead of instrumenting every method. That makes it safe to run on a live service, either from startup (`-XX:StartFlightRecording`) or on demand (`jcmd <pid> JFR.start`). You open the file in JDK Mission Control or read it with the `jfr` tool. It has been free in OpenJDK since Java 11.

### [intermediate] How do you read a flame graph? {#flamegraph-q}

Each box is a method and the boxes above it are the methods it called, so the stack grows upwards. The **width** of a box is the share of samples in which that method was on the stack, so wide boxes are where time goes. The left-to-right order is alphabetical, not chronological. Look for a wide plateau near the top (the real consumer of time), then read down to see who calls it. Remember that a CPU profile misses threads that are waiting; use a wall-clock profile or lock and I/O events for those.

### [intermediate] What is the difference between `ClassNotFoundException` and `NoClassDefFoundError`? {#classnotfound-q}

`ClassNotFoundException` is a checked exception thrown when code asks to load a class **by name** at run time (`Class.forName`, a JDBC driver, a plug-in) and the class loader cannot find it. `NoClassDefFoundError` is an error thrown when a class that **was** present at compile time cannot be found or initialised at run time, for example a missing transitive dependency or a failed static initialiser (look for an earlier `ExceptionInInitializerError`). Both usually come from the class path: check the dependency tree and use `-Xlog:class+load` to see which jar was used.

### [intermediate] How do you expose diagnostics safely from a Spring Boot service? {#actuator-q}

Use Actuator, but expose only what is needed with `management.endpoints.web.exposure.include` (for example `health`, `metrics`, `threaddump`), serve it on a separate management port that is not reachable from outside, and require authentication. Treat `heapdump` as highly sensitive, because it returns every object in memory, and do not enable it on a public route. Publish JVM metrics (heap after GC, GC pause, thread count, connection pool usage) to Prometheus through Micrometer, and alert on trends, so that the dumps are the second step and not the first.

### [deep] Why is a JVM slow right after it starts, and what can you do? {#warmup-q}

HotSpot starts by **interpreting** bytecode and compiles only methods that become hot, first with C1 and then, if still hot, with the optimising C2. So early requests run slow code while the compiler threads use CPU, and caches and connection pools are empty. Mitigate by warming up with representative requests before the readiness probe passes, by ramping traffic up gradually, by sizing CPU requests for start-up, and by shortening start-up with class data sharing, Spring AOT, a native image or CRaC. Also watch for a full **code cache**, which silently disables compilation.

### [deep] What are the risks of taking a heap dump from production? {#dump-risk-q}

It **pauses** the JVM (a full GC for live-only dumps, then the write), seconds to minutes on a large heap, so an instance should leave the load balancer first. The file is **as big as the heap** and needs disk space on the right volume. It contains **sensitive data** (card numbers, tokens, passwords), so access must be restricted, storage encrypted and the file deleted afterwards. And it may be **lost** if written to the container's own disk. Mitigate with `HeapDumpOnOutOfMemoryError` to a persistent volume, dumping from a single instance, and a class histogram first when that is enough.

### [deep] Why can a thread dump mislead you? {#dump-mislead-q}

It is a **snapshot**, so one moment can be unrepresentative: take several. A thread reading from a socket shows as `RUNNABLE` although it uses no CPU, because the JVM calls blocking native I/O "runnable". Getting a dump needs the threads to reach a safepoint, which can hide threads that are in a long loop without one. And a thread that waits is a **symptom**: the cause is the thread that owns the lock or the service that is slow. So follow the wait to the owner, and combine the dump with metrics and a profile.

### [deep] A payments API slows down every day around noon, and the heap is fine. How do you investigate? {#scenario-q}

Correlate first: what happens at noon (a batch job, a cache expiry, a traffic peak, a scheduled task, a log rotation)? Check metrics around that time: GC pause, thread count, connection pool waiting, downstream latency. Record a JFR profile that covers the window (or take thread dumps during it) and compare it with a normal period: lock contention, I/O waits, an allocation burst or a method that suddenly dominates. If threads wait in the pool, look at the slow query or the downstream call. Fix the cause, add a timeout or bulkhead, and keep the metric on a dashboard with an alert.

### [coding] This thread dump ends with a deadlock report. Find and fix it. {#coding-deadlock}

```text
Found one Java-level deadlock:
"transfer-1": waiting to lock monitor 0x...0a10 (object 0x...c0f0, a Account),
  which is held by "transfer-2"
"transfer-2": waiting to lock monitor 0x...0b28 (object 0x...c1a8, a Account),
  which is held by "transfer-1"
```

```java
// Bug: each thread locks its source account first, so A to B and B to A can deadlock
void transfer(Account from, Account to, long cents) {
    synchronized (from) {
        synchronized (to) {
            from.debit(cents);
            to.credit(cents);
        }
    }
}

// Fix: always lock in the same global order (the lower id first)
void transfer(Account from, Account to, long cents) {
    Account first = from.id() < to.id() ? from : to;
    Account second = first == from ? to : from;
    synchronized (first) {
        synchronized (second) {
            from.debit(cents);
            to.credit(cents);
        }
    }
}
```

Explain that the report shows a cycle (each thread holds what the other wants), that a fixed lock order makes a cycle impossible, and that alternatives are `ReentrantLock.tryLock` with a timeout, or avoiding two locks by using a database transaction. Mention that equal ids need a tie-breaker and that a deadlock test should run the transfers in both directions in parallel.

### [coding] A cache grows until the heap is full. Fix the leak. {#coding-cache}

```java
// Bug: a static map with no limit: every payment ever seen stays reachable
public class PaymentCache {
    private static final Map<String, PaymentEvent> ALL = new ConcurrentHashMap<>();

    public static void put(PaymentEvent e) { ALL.put(e.id(), e); }
    public static PaymentEvent get(String id) { return ALL.get(id); }
}
```

```java
// Fix: a bounded cache that expires entries (Caffeine)
public class PaymentCache {
    private final Cache<String, PaymentEvent> cache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofMinutes(10))
            .recordStats()                      // hit rate and evictions go to metrics
            .build();

    public void put(PaymentEvent e) { cache.put(e.id(), e); }
    public PaymentEvent get(String id) { return cache.getIfPresent(id); }
}
```

Explain how you found it (old generation flat-lining high after GC, the dominator tree showing one `ConcurrentHashMap` with a static GC root), why a bound **and** an expiry are both needed, that the cache should be a managed bean and not a static field (so tests and metrics work), and that you confirm the fix by watching the heap after each full GC stay flat.
