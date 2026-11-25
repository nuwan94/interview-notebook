---
title: JVM troubleshooting — thread dumps, heap dumps and profiling in production
nav: JVM troubleshooting
slug: jvm-troubleshooting
summary: How to diagnose a Java service that is slow, hung, out of memory or killed: choosing the tool from the symptom, thread dumps and deadlocks, finding the busy thread, heap dumps and leak analysis, the different OutOfMemoryErrors, native memory and container limits, Java Flight Recorder and flame graphs, class loading and the JIT, and doing it safely in Kubernetes and Spring Boot, with examples and interview questions.
tags: [Java, JVM, Troubleshooting, Profiling, Production, Memory]
order: 18
topic: Java / JVM
updated: 2026-11-24
subnav: true
---

A production incident rarely says what is wrong. It says **"the payments API is slow"**, **"the pod keeps restarting"** or **"nothing responds"**.

Interviews for experienced roles ask *what you do in the first ten minutes*: which tool you use, what you look for and what it means. The JDK already contains everything you need: `jcmd`, thread dumps, heap dumps and Flight Recorder. The skill is matching the symptom to the right evidence.

The animation has four scenes: from symptom to tool, a memory leak, a busy thread and a deadlock.

```demo
name: jvm-walk
```

> **One sentence to remember:** *Match the symptom to the evidence, and capture that evidence before you restart.*

## Start with the symptom {#triage}

| Symptom | First look | Evidence to take |
| --- | --- | --- |
| High CPU. | Which thread is busy. | `top -H`, then a [thread dump](#thread-dumps), or a Flight Recorder profile. |
| Requests hang while CPU is low. | What the threads are waiting for. | Three thread dumps, 10 seconds apart. |
| The heap keeps growing, then `OutOfMemoryError`. | The heap size after each full GC. | The [GC log](lesson:garbage-collector#gc-logs), then a [heap dump](#heap-dumps). |
| Slow only after a deploy or restart. | JIT warm-up, empty caches, pools still starting. | The [JIT](#jit), and a warm-up plan. |
| Slow only under load. | Lock contention, GC pauses or a full pool. | Flight Recorder: locks, GC and I/O. |
| The pod is `OOMKilled` (exit code 137). | The memory of the whole process, not just the heap. | [Native memory tracking](#native). |
| `NoClassDefFoundError` or `NoSuchMethodError`. | Which jar the class came from. | [Class loading](#classloading), and `mvn dependency:tree`. |

Three habits apply to every case:

1. **Capture before you restart.** A restart wipes out the evidence. Take the dumps, copy the logs, and only then restart.
2. **Take more than one sample.** A single thread dump shows one moment. Three dumps show what is *stuck* and what is just *passing through*.
3. **Change one thing at a time.** Then confirm the fix by looking at the same evidence again.

## The tools in the JDK {#tools}

Almost everything goes through **`jcmd`**, which talks to a running JVM by its process id. It replaces the older `jstack`, `jmap` and `jinfo`, which still work.

| Need | Command |
| --- | --- |
| Find the process id. | `jcmd` (lists the JVMs) or `jps -l` |
| A thread dump. | `jcmd <pid> Thread.print` (older: `jstack <pid>`) |
| A heap dump. | `jcmd <pid> GC.heap_dump /dumps/app.hprof` (older: `jmap -dump`) |
| The number of objects per class. | `jcmd <pid> GC.class_histogram` |
| The heap layout and GC state. | `jcmd <pid> GC.heap_info`, and `jstat -gcutil <pid> 1000` |
| Flags and system properties. | `jcmd <pid> VM.flags`, `VM.system_properties`, `VM.command_line` |
| Native memory. | `jcmd <pid> VM.native_memory summary` |
| Flight Recorder. | `jcmd <pid> JFR.start`, `JFR.dump`, `JFR.stop` |
| Everything else it can do. | `jcmd <pid> help` |

Three things to know about `jcmd`:

- It must run as the **same user** as the JVM, on the same machine or in the same container.
- It needs a **JDK**, not just a JRE. That matters in containers; see [containers](#containers).
- `kill -3 <pid>` also prints a thread dump, to the JVM's standard output. Despite its name, it does **not** stop the JVM.

## Thread dumps {#thread-dumps}

A **thread dump** is a snapshot of every thread: its name, its state and its stack. It answers *"what is each thread doing right now?"*. That is the first question for a hang, a slowdown or a deadlock.

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

- **The name** (`http-nio-8080-exec-17`) tells you which pool the thread belongs to. A request handler, a scheduler and a database pool thread each have their own kind of name.
- **`nid`** is the operating system's id for the thread, **in hexadecimal**. It lets you match a thread with `top -H`; see [High CPU](#cpu).
- **The state** is one of the [thread states](lesson:java-concurrency#thread-states):
  - `RUNNABLE` means running, or ready to run.
  - `BLOCKED` means waiting for a `synchronized` monitor.
  - `WAITING` and `TIMED_WAITING` mean waiting for another thread, a lock, a sleep or a timeout.
- **The stack**, read from the top, shows exactly where the thread is. Here it waits for a database connection in `HikariPool.getConnection`.

What to look for:

| Pattern across the dump | Meaning |
| --- | --- |
| Most request threads are in the same frame. | A shared bottleneck, such as a connection pool, a lock or a slow downstream call. |
| Many threads are `BLOCKED` on one lock. | Lock contention. Find the thread that **owns** that lock. |
| All request threads wait in `HikariPool.getConnection`. | The pool is used up, often because a slow query or a leaked connection holds the connections. |
| Threads wait in `SocketInputStream.read` or `Socket.connect`. | A slow or dead downstream service, with no timeout set. |
| `Found one Java-level deadlock` at the end. | A [deadlock](lesson:java-concurrency#deadlock). The report names the threads and the locks. |
| A few threads are `RUNNABLE` in the same method in every dump. | Code that uses a lot of CPU; see [High CPU](#cpu). |

Two cautions:

- A thread that is `RUNNABLE` inside a native socket read is **not** using CPU. The JVM reports blocking I/O as "runnable".
- A single dump can mislead you, so take **three** and compare them.

**Virtual threads** ([Java 21](lesson:java-version-history#java-21)) do not appear in the normal `Thread.print` output, because there can be millions of them. To include them, use `jcmd <pid> Thread.dump_to_file -format=json /dumps/threads.json`.

## High CPU: find the busy thread {#cpu}

When a process is at 100% CPU, one or a few threads are doing the work. Find them in four steps (the "busy thread" scene above shows them):

```bash
top -H -p 4212                     # -H lists threads; note the thread id with the highest %CPU, say 4377
printf '%x\n' 4377                 # 1119  (decimal to hexadecimal)
jcmd 4212 Thread.print | grep -A 20 'nid=0x1119'
```

1. `top -H` lists the threads of the process. Note the id of the busiest one.
2. `top` shows the id in decimal, but a thread dump shows it in hexadecimal. So convert it with `printf`.
3. Take a thread dump and search it for that `nid`.
4. Read the stack. It names the code.

Typical findings:

- **A hot loop, or a retry that runs forever** with no delay between attempts.
- **Catastrophic backtracking in a regular expression** on user input. A pattern with nested repetition, such as `(a+)+$`, takes exponential time on a long string. This is also a denial-of-service risk, so limit the input length and use simple patterns.
- **GC threads at the top**, with names such as `G1 Conc#0` or `GC Thread#3`. Then it is a memory problem. Look at the [GC log](lesson:garbage-collector#gc-logs), not the code.
- **JIT compiler threads** (`C2 CompilerThread`) busy after a deploy. This is warm-up, and it settles by itself; see [the JIT](#jit).
- **Serialization, logging or string building** done for every request at a high rate. A profile (below) shows it.

If the stack does not give a clear answer, record a **Flight Recorder profile** for a minute. It shows where CPU time goes over time, not at one moment.

## Heap dumps and memory leaks {#heap-dumps}

A **heap dump** (an `.hprof` file) is a copy of every object on the heap and every reference between them. It answers *"what is holding the memory?"*. For what a leak means in a language with a garbage collector, see [memory leaks](lesson:java-memory-model#leaks). This section shows how to find one.

**First, recognise a leak.** In the [GC log](lesson:garbage-collector#gc-logs), look at the heap size **after each full GC** (or, in G1, after a concurrent cycle).

- If that number rises over hours, objects are being kept. That is a leak.
- If it stays flat and only the peaks are high, the heap is too small or the allocation rate is high. That is a tuning problem, not a leak.

**Take a dump:**

```bash
jcmd 4212 GC.heap_dump /dumps/payments.hprof        # live objects only: a full GC runs first
jcmd 4212 GC.heap_dump -all /dumps/payments.hprof   # include unreachable objects too
```

And always start production JVMs with:

```text
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps
```

Then the evidence exists even if nobody was watching. Write the file to a volume that outlives the pod.

**Analyse it** with **Eclipse MAT** (the Memory Analyzer), VisualVM or the IntelliJ profiler. The key ideas:

| Term | Meaning |
| --- | --- |
| **Shallow heap** | The memory of the object itself, without what it points to. |
| **Retained heap** | The memory that would be freed if this object disappeared. It is the object plus everything that only it keeps alive. |
| **Dominator tree** | The objects sorted by retained heap. The biggest entries are the suspects. |
| **GC root** | Something the collector must treat as alive, such as a static field, a live thread, a local variable on a stack or a JNI reference. |
| **Path to GC roots** | The chain of references from a root to the object. It shows **who** keeps the object alive. |

The method, as in the "heap dump" scene:

1. Open the dump.
2. Read the **Leak Suspects** report, or the dominator tree.
3. Pick the biggest object.
4. Run **Path to GC Roots**, excluding weak and soft references.
5. Find the one reference that should not be there.

Common culprits:

- a **static collection**, or a cache with no size limit or expiry;
- **listeners and callbacks** that are registered and never removed;
- a **`ThreadLocal`** in a pooled thread that is never cleared (see [ThreadLocal problems](lesson:java-concurrency#threadlocal-q));
- a **class loader** kept alive by a thread or a driver, which keeps all its classes and their [Metaspace](lesson:java-memory-model#metaspace);
- **unclosed resources**, such as result sets, streams and HTTP responses;
- a **session or request attribute** that grows with every call.

For a quick hint without a full dump, run `jcmd <pid> GC.class_histogram`. It lists the number of objects and the bytes for each class. If `byte[]`, `String` or one of your own classes keeps growing between two runs, follow that lead.

**A heap dump is dangerous data.** It contains everything in memory: card numbers, tokens, passwords and personal data. In a bank, treat it as confidential. Store it encrypted, restrict access, delete it afterwards, and never attach it to a ticket.

Taking a dump also **pauses** the JVM, for seconds or even minutes on a large heap. So if the service is behind a load balancer, take the instance out of rotation first.

## OutOfMemoryError: read the message {#oom}

The text after `java.lang.OutOfMemoryError:` names the area that ran out. It decides everything that follows.

| Message | Meaning and usual cause | What to do |
| --- | --- | --- |
| `Java heap space` | The heap is full of reachable objects. The cause is a leak, or a heap too small for the data. | Take a heap dump. Fix the leak, or raise `-Xmx` if the load is real. |
| `GC overhead limit exceeded` | The collector uses almost all the CPU and frees almost nothing (Parallel GC). | The same as above: the heap is nearly full. |
| `Metaspace` or `Compressed class space` | There are too many classes. The cause is a class loader leak after redeploys, or code that keeps generating proxies or classes. | Find the leaked loader in a heap dump; see [Metaspace](lesson:garbage-collector#metaspace). |
| `unable to create native thread` | The operating system refused a new thread. There are too many threads, or a process or memory limit was hit. | Take a thread dump to count the threads. Use a bounded pool or [virtual threads](lesson:java-concurrency#virtual-threads). |
| `Direct buffer memory` | Off-heap `ByteBuffer`s (Netty, NIO) went over `-XX:MaxDirectMemorySize`. | Find the code that allocates direct buffers and does not release them. |
| `Requested array size exceeds VM limit` | The code tried to create a huge array. | It is a bug, often a wrong size calculation. |
| `Out of swap space?` | The operating system has no memory left for the JVM. | The machine or the container is too small. |

An `OutOfMemoryError` is an `Error`, so do not catch it and carry on. After it, the JVM may only half work.

In containers it is better to **exit and be restarted**. Use `-XX:+ExitOnOutOfMemoryError`, or `-XX:+CrashOnOutOfMemoryError`, which also writes a crash file. Combine it with the heap-dump flag above. The platform then replaces the broken instance.

## Native memory and container limits {#native}

The heap is only part of a JVM process. The total also includes:

- Metaspace;
- thread stacks, about 1 MB each by default;
- direct buffers;
- the code cache;
- the GC's own data structures;
- native libraries.

A container limit applies to the **whole process**. So a pod can be killed with exit code **137** (`OOMKilled`, a `SIGKILL` from the kernel) while the heap is only 60% full. There is no Java exception and no heap dump, because the JVM never gets the chance.

Break the total down with **Native Memory Tracking**:

```bash
# start the JVM with:  -XX:NativeMemoryTracking=summary
jcmd 4212 VM.native_memory baseline
# ... wait while memory grows ...
jcmd 4212 VM.native_memory summary.diff
```

The diff shows which area grew:

- `Thread` means too many threads.
- `Internal` or `Other` means direct buffers.
- `Class` means class metadata.
- `Code` and `GC` are the code cache and the collector.

Tracking costs a little performance, so turn it on while you investigate.

To avoid the problem, leave spare room. Set `-XX:MaxRAMPercentage` to about 60 to 75, not 100 (see [containers and the GC](lesson:garbage-collector#choosing)). Also put a limit on the number of threads and on direct memory.

## Profiling with Flight Recorder {#jfr}

A thread dump shows one moment. A **profile** shows where time goes **over a period**.

**Java Flight Recorder (JFR)** is built into the JVM. It records events into a `.jfr` file: method samples, allocations, lock waits, GC pauses, file and socket I/O, and exceptions. Its overhead is typically **1 to 2%**, which is why it is safe to run in production. It has been in OpenJDK since [Java 11](lesson:java-version-history#java-11) (and 8u262).

```bash
jcmd 4212 JFR.start name=incident duration=120s filename=/dumps/incident.jfr settings=profile
# or from the start of the JVM:
#   -XX:StartFlightRecording:filename=/dumps/app.jfr,maxsize=200m,settings=profile
jfr summary /dumps/incident.jfr                       # which events were recorded
jfr print --events jdk.GCPhasePause /dumps/incident.jfr
```

Open the file in **JDK Mission Control**. It shows hot methods, allocation by class and stack, lock contention, GC pauses and I/O waits on one timeline.

For a different view, **async-profiler** (also free) draws **flame graphs**. In a flame graph:

- each box is a method;
- the boxes stack up to show who called whom;
- the **width** of a box is the share of samples in which that method was on the stack.

So:

- wide boxes at the top are where the time goes;
- the left-to-right order has **no meaning**, because it is sorted by name, not by time;
- look for a wide flat area, then read down to see who calls it.

A sampling profiler sees only threads that are **running**. For threads that wait on locks or I/O, use the profiler's wall-clock mode, or JFR's lock and I/O events.

Profile under realistic load. Change one thing between two profiles, so that you can compare them.

## Class loading {#classloading}

The JVM loads classes when they are first needed. It uses a chain of **class loaders**: bootstrap, then platform, then application, and in Spring Boot also a loader for nested jars. Each loader asks its **parent first**.

This has two effects:

- You cannot replace `java.lang.String`, because the bootstrap loader always finds it first.
- If two jars contain different versions of one class, you get surprises: the first one found on the class path wins.

| Error | Meaning |
| --- | --- |
| `ClassNotFoundException` | Code asked to load a class **by name** (with `Class.forName`, a driver or a framework), and it is not on the class path. It is a checked exception. |
| `NoClassDefFoundError` | The class **was** there when the code was compiled, but at run time it is missing or failed to initialise. It is an `Error`. Look for an earlier `ExceptionInInitializerError`. |
| `NoSuchMethodError`, `IncompatibleClassChangeError` | There are two versions of a library: the code was compiled against one and runs with another. Run `mvn dependency:tree` or `gradle dependencyInsight` (see [Maven](lesson:maven) and [Gradle](lesson:gradle)). |

To see where a class came from, start the JVM with `-Xlog:class+load` (or `-verbose:class`) and search for the class name. The line names the source jar.

## The JIT and warm-up {#jit}

HotSpot runs code in three stages. This is called **tiered compilation**:

1. It first **interprets** the bytecode.
2. It compiles hot methods with **C1**, which compiles fast but produces simple code.
3. If they stay hot, it compiles them again with **C2**, which is slow to compile but produces very optimised code.

So a JVM is **slowest right after it starts**. The code is not compiled yet, the caches are empty, and the compiler threads compete for CPU. Things you can explain in an interview:

- The first requests after a deploy are slow, and CPU is high for a minute or two. Send traffic gradually, and warm up with typical requests before the pod is marked ready.
- A benchmark that does not warm up measures the interpreter, not your code. Use JMH.
- The optimised code relies on assumptions, for example that a call has only one implementation. If a newly loaded class breaks an assumption, the JVM **deoptimises**: it goes back to slower code for a while.
- The **code cache** holds the compiled code. If it fills up (`CodeCache is full. Compiler has been disabled`), performance drops suddenly. Raise `-XX:ReservedCodeCacheSize`.
- To cut start-up time, use **class data sharing** (`-XX:+AutoCreateSharedArchive`), Spring AOT and native images, or CRaC (checkpoint and restore).

`-XX:+PrintCompilation` shows what gets compiled, and JFR records compilation events.

## Doing it safely in production {#production}

### In Spring Boot {#boot}

[Actuator](lesson:spring-observability#actuator) gives you much of this over HTTP:

- `/actuator/threaddump` returns a thread dump. It is the quickest option.
- `/actuator/heapdump` downloads a heap dump, so **never expose it publicly**.
- `/actuator/metrics/jvm.memory.used`, `jvm.gc.pause` and `jvm.threads.live` give JVM metrics.
- `/actuator/health` reports health.

Expose only what you need with `management.endpoints.web.exposure.include`. Put the endpoints on a separate management port, and secure them.

Graph the [Micrometer metrics](lesson:spring-observability#metrics): heap after GC, GC pauses, thread count, pool usage and connection pool waits. Then you see a problem building up before it becomes an incident.

### In containers {#containers}

Run `jcmd` inside the pod. There, the JVM is usually process id 1:

```bash
kubectl exec payments-7c9d-x4k2 -- jcmd 1 Thread.print
kubectl exec payments-7c9d-x4k2 -- jcmd 1 GC.heap_dump /dumps/app.hprof
kubectl cp payments-7c9d-x4k2:/dumps/app.hprof ./app.hprof
```

A minimal ("distroless") image has only a JRE and no `jcmd`. You have two options:

- use an image that contains a JDK;
- or attach an **ephemeral debug container** with `kubectl debug --target`. It shares the process namespace, so it can see the JVM.

Write dumps to a mounted volume, because the container's file system disappears with the pod. See [Kubernetes](lesson:kubernetes) for pods and volumes.

### Rules of thumb for a bank {#rules}

- Keep `-XX:+HeapDumpOnOutOfMemoryError`, `-XX:+ExitOnOutOfMemoryError` and [GC logging](lesson:garbage-collector#gc-logs) on **by default**. They cost almost nothing.
- Keep Flight Recorder available, and practise using it **before** an incident.
- Never put card numbers, tokens or personal data in logs. Treat dumps as confidential data.
- Take an instance out of the load balancer before a heap dump. Take the dump from one instance, not from all of them.
- Write a short runbook: the symptom, the command, what to look for and who to call.

Try it in the lab: [Hunting a memory leak from latency spikes](lab:jvm-memory-leak-hunt).

## Cheat sheet {#cheatsheet}

| Situation | Do this |
| --- | --- |
| A hang with low CPU. | Take three thread dumps 10 s apart. Look for the same frame, or a deadlock. |
| High CPU. | `top -H -p pid`, then `printf '%x'`, then `jcmd pid Thread.print` and find the `nid`. Or take a JFR profile. |
| The heap grows. | Check the heap after full GC in the GC log. Then `GC.class_histogram`, `GC.heap_dump`, and the Eclipse MAT dominator tree. |
| `OutOfMemoryError`. | Read the text after the colon. Always start with `HeapDumpOnOutOfMemoryError`. |
| `OOMKilled` while the heap looks healthy. | `-XX:NativeMemoryTracking=summary`, then `VM.native_memory summary.diff`. Lower `MaxRAMPercentage`. |
| Slow after a deploy. | Warm-up, the JIT and the code cache. Use `-XX:+PrintCompilation`. |
| Where does the time go? | JFR (`settings=profile`) and a flame graph. |
| `NoClassDefFoundError`. | `-Xlog:class+load` and `mvn dependency:tree`. |
| Inside Kubernetes. | `kubectl exec pod -- jcmd 1 ...`, or an ephemeral debug container. Write dumps to a volume. |
| On every JVM, always. | `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=... -XX:+ExitOnOutOfMemoryError`, and a GC log. |

## Interview questions {#questions}

### [basic] What is a thread dump and how do you take one? {#thread-dump-q}

A snapshot of all threads in a JVM, with each thread's name, state and stack trace. It is the first tool for a hang, a slowdown or a deadlock.

Ways to take one:

- `jcmd <pid> Thread.print`;
- `jstack <pid>`;
- `kill -3 <pid>`, which prints to the JVM's output and does not stop it;
- Actuator's `/actuator/threaddump`.

Take **several**, a few seconds apart, and compare them. One snapshot cannot tell a stuck thread from one that is just passing through.

### [basic] What is a heap dump and when do you take one? {#heap-dump-q}

A file (`.hprof`) that lists every object on the heap and the references between them.

Take one when memory use is high or growing and you need to know **what** holds it. Examples are a suspected leak, an `OutOfMemoryError`, or a heap that stays full after each full GC.

Use `jcmd <pid> GC.heap_dump`, or the flag `-XX:+HeapDumpOnOutOfMemoryError`, and open it in Eclipse MAT. Handle it carefully: it contains sensitive data, and the JVM pauses while it is written.

### [basic] What does `OutOfMemoryError: Java heap space` mean? Is it always a leak? {#oom-heap-q}

**No, not always.** It means the heap is full of objects that are still reachable, and the collector could not free enough.

The heap may simply be too small for the data or the load, for example a large query result or a batch job. To tell the two cases apart, look at the heap after each full GC:

- If it keeps rising, objects are being kept. That is a leak, so take a heap dump.
- If it is flat and the application really needs more, raise `-Xmx` or hold less data at once (with paging or streaming).

### [basic] Which JDK tools do you use to diagnose a running JVM? {#tools-q}

From the JDK:

- `jcmd` for nearly everything: thread dumps, heap dumps, the class histogram, flags, native memory and Flight Recorder;
- `jstack` and `jmap`, the older tools that each do one job;
- `jstat` for GC statistics over time;
- `jinfo` for flags;
- `jps` to find process ids;
- `jfr` and JDK Mission Control for Flight Recorder files;
- `-Xlog` options for GC and class-loading logs.

Outside the JDK: Eclipse MAT for heap dumps, and async-profiler for flame graphs.

### [basic] What is a memory leak in Java, given that there is a garbage collector? {#leak-q}

An object that is still **reachable** but that the program will never use again.

The collector frees only objects that are **unreachable**. If a static field, a cache, a registered listener or a `ThreadLocal` still points to an object, it is never freed. The heap grows until `OutOfMemoryError`.

The cure is to remove the reference: limit or expire caches, unregister listeners, clear `ThreadLocal`s and close resources.

### [intermediate] A service is at 100% CPU. How do you find the cause? {#cpu-q}

Find the busy **thread**, then read its stack:

1. Run `top -H -p <pid>` to find the busy thread.
2. Convert its decimal id to hexadecimal with `printf '%x'`.
3. Take a thread dump with `jcmd <pid> Thread.print`, and find `nid=0x...` to read its stack.
4. Repeat two or three times to confirm.

What the thread tells you:

- A GC thread means a memory problem.
- A compiler thread means JIT warm-up.
- One of your own threads: its stack names the loop, the regular expression or the hot method.

If it is not obvious, record a JFR profile to see where CPU time goes over a minute. Then fix the code and compare.

### [intermediate] Requests hang but CPU is low. What do you do? {#hang-q}

The threads are waiting, not working. So take three thread dumps ten seconds apart, and look at what the request threads wait for. The usual causes:

- **The connection pool is used up:** all threads wait in `HikariPool.getConnection`.
- **A lock** is held by one thread and wanted by many. The waiting threads are `BLOCKED`; find the owner.
- **A deadlock**, reported at the end of the dump.
- **A slow downstream call with no timeout:** threads wait in a socket read.

Fix the real cause (a slow query, a leaked connection, a missing timeout or the lock order), not only the pool size. Add timeouts and metrics so you see it next time.

### [intermediate] How do you analyse a heap dump? {#analyse-dump-q}

1. Open it in Eclipse MAT.
2. Run the Leak Suspects report, or open the **dominator tree**. It sorts objects by **retained heap**: the memory that would be freed if that object were removed.
3. Take the biggest suspect and run **Path to GC Roots**, excluding weak and soft references. It shows the chain of references that keeps the object alive, for example a static field that holds a map with millions of entries. That reference is the bug.
4. Confirm with the histogram, which shows the classes that have far too many objects.
5. Fix it, then check that the heap after GC stays flat.

### [intermediate] What are the different `OutOfMemoryError`s and what does each point to? {#oom-kinds-q}

The message names the area that ran out:

| Message | Points to | Evidence to take |
| --- | --- | --- |
| `Java heap space`, `GC overhead limit exceeded` | The heap: a leak, or a heap that is too small. | A heap dump. |
| `Metaspace` | Too many classes, typically a class loader leak or generated classes. | A heap dump. |
| `unable to create native thread` | The operating system refused a thread: too many threads, or a process limit. | A thread dump. |
| `Direct buffer memory` | Off-heap buffers, for example in Netty. | Native memory tracking. |
| `Requested array size exceeds VM limit` | A bug that asks for a giant array. | The stack trace. |

### [intermediate] A pod is `OOMKilled` but the heap looks fine. Why? {#oomkilled-q}

Because the container limit covers the **whole process**, not just the heap. The process also uses Metaspace, thread stacks, direct buffers, the code cache and GC data structures.

When the total crosses the limit, the kernel kills the process (exit code 137). The JVM throws nothing and writes no dump.

What to do:

1. Measure with Native Memory Tracking (`-XX:NativeMemoryTracking=summary`, then `jcmd <pid> VM.native_memory summary.diff`) to find the area that grows.
2. Leave spare room: `-XX:MaxRAMPercentage` of about 60 to 75, a limit on threads, and a limit on direct memory.
3. Compare the memory limit with the `-Xmx` that is actually in use.

### [intermediate] What is Java Flight Recorder and why is it suitable for production? {#jfr-q}

An event recorder built into the JVM. It records method samples, allocations, lock contention, GC pauses, I/O and exceptions into a `.jfr` file.

It suits production because its overhead is only about 1 to 2%. It uses data the JVM already has, and it takes samples instead of instrumenting every method. So it is safe to run on a live service.

You can start it with the JVM (`-XX:StartFlightRecording`) or when you need it (`jcmd <pid> JFR.start`). Open the file in JDK Mission Control, or read it with the `jfr` tool. It has been free in OpenJDK since Java 11.

### [intermediate] How do you read a flame graph? {#flamegraph-q}

- Each box is a method. The boxes above it are the methods it called, so the stack grows upwards.
- The **width** of a box is the share of samples in which that method was on the stack. So wide boxes are where the time goes.
- The left-to-right order is alphabetical, not by time.

Look for a wide flat area near the top: that is what really uses the time. Then read down to see who calls it.

Remember that a CPU profile misses threads that are waiting. For those, use a wall-clock profile, or lock and I/O events.

### [intermediate] What is the difference between `ClassNotFoundException` and `NoClassDefFoundError`? {#classnotfound-q}

- **`ClassNotFoundException`** is a checked exception. It is thrown when code asks for a class **by name** at run time (with `Class.forName`, a JDBC driver or a plug-in), and the class loader cannot find it.
- **`NoClassDefFoundError`** is an error. It is thrown when a class that **was** there at compile time cannot be found or initialised at run time. Examples are a missing transitive dependency, or a static initialiser that failed (look for an earlier `ExceptionInInitializerError`).

Both usually come from the class path. Check the dependency tree, and use `-Xlog:class+load` to see which jar was used.

### [intermediate] How do you expose diagnostics safely from a Spring Boot service? {#actuator-q}

Use Actuator, and lock it down:

1. Expose only what is needed with `management.endpoints.web.exposure.include`, for example `health`, `metrics` and `threaddump`.
2. Serve it on a separate management port that cannot be reached from outside.
3. Require authentication.
4. Treat `heapdump` as highly sensitive, because it returns every object in memory. Never enable it on a public route.

Also publish JVM metrics (heap after GC, GC pauses, thread count and connection pool usage) to Prometheus through Micrometer, and alert on trends. Then the dumps become the second step, not the first.

### [deep] Why is a JVM slow right after it starts, and what can you do? {#warmup-q}

Because HotSpot starts by **interpreting** the bytecode. It compiles only the methods that become hot: first with C1, and then, if they stay hot, with the optimising C2. So early requests run slow code while the compiler threads use CPU. The caches and connection pools are also still empty.

What you can do:

- warm up with typical requests before the readiness probe passes;
- increase traffic gradually;
- give the pod enough CPU for start-up;
- shorten start-up with class data sharing, Spring AOT, a native image or CRaC.

Also watch for a full **code cache**. It turns off compilation without any loud warning.

### [deep] What are the risks of taking a heap dump from production? {#dump-risk-q}

1. **It pauses the JVM.** A live-only dump first runs a full GC, then writes the file. On a large heap this takes seconds to minutes, so take the instance out of the load balancer first.
2. **The file is as big as the heap.** It needs disk space on the right volume.
3. **It contains sensitive data**, such as card numbers, tokens and passwords. Restrict access, encrypt the storage and delete the file afterwards.
4. **It may be lost** if it is written to the container's own disk.

To reduce the risks, write `HeapDumpOnOutOfMemoryError` dumps to a persistent volume, dump only one instance, and take a class histogram first when that is enough.

### [deep] Why can a thread dump mislead you? {#dump-mislead-q}

1. **It is a snapshot.** One moment may not be typical, so take several.
2. **"Runnable" is not always busy.** A thread reading from a socket shows as `RUNNABLE` although it uses no CPU, because the JVM calls blocking native I/O "runnable".
3. **Safepoints.** To take a dump, the threads must reach a safepoint. A thread in a long loop without one may not show where it really is.
4. **A waiting thread is a symptom.** The cause is the thread that owns the lock, or the service that is slow.

So follow each wait to its owner, and combine the dump with metrics and a profile.

### [deep] A payments API slows down every day around noon, and the heap is fine. How do you investigate? {#scenario-q}

1. **Look for what happens at noon.** It could be a batch job, a cache expiry, a traffic peak, a scheduled task or a log rotation.
2. **Check the metrics around that time:** GC pauses, thread count, connection pool waits and downstream latency.
3. **Record a JFR profile that covers the window**, or take thread dumps during it. Compare it with a normal period. Look for lock contention, I/O waits, a burst of allocation, or a method that suddenly dominates.
4. **If threads wait for the pool**, look at the slow query or the downstream call.
5. **Fix the cause**, and add a timeout or a bulkhead (a separate, limited pool for one dependency).
6. **Keep the metric on a dashboard**, with an alert.

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

What to explain:

- **The report shows a cycle.** Each thread holds the lock the other one wants.
- **A fixed lock order makes a cycle impossible.** Both threads lock the lower id first, so one simply waits for the other.
- **Alternatives:** `ReentrantLock.tryLock` with a timeout, or avoiding two locks by using a database transaction.
- **Edge cases:** equal ids need a tie-breaker, and a deadlock test should run transfers in both directions at the same time.

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

What to explain:

- **How you found it.** The old generation stayed high after each GC. The dominator tree showed one `ConcurrentHashMap` held by a static GC root.
- **Why you need both a size limit and an expiry.** The limit caps the memory. The expiry removes entries that are old, even when the cache is not full.
- **Why it should be a managed bean, not a static field.** Then tests and metrics work with it.
- **How you confirm the fix.** The heap after each full GC stays flat.
