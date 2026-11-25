---
title: Java version history — what changed and when
nav: Version history
slug: java-version-history
summary: Every notable change from Java 1.0 to Java 27, grouped by era, with change trails that follow one feature across versions, an upgrade guide and interview questions.
tags: [Java, History, Releases]
order: 7
topic: Java / Language
updated: 2026-11-24
subnav: true
---

Java changes a lot, and interviewers like to ask "which version added that?". This lesson walks through every release. Then it follows one idea, such as garbage collectors, pattern matching or concurrency, across many versions.

The timeline below plays through the releases. You can filter it by theme and jump to any version. Every version heading in this lesson also has its own link (hover the heading and press 🔗).

```demo
name: java-timeline
```

> **How to use the cross-links:** some changes belong to a topic with its own lesson, for example the garbage collectors. There, the word links to that lesson. A word with a ⏳ links to a lesson that is not written yet. It becomes a normal link as soon as that lesson exists.

> **One sentence to remember:** *The long-term support releases are 8, 11, 17, 21 and 25, and most big features arrive as a preview first.*

## How Java ships {#how-java-ships}

### Names and numbers {#names-and-numbers}

The first releases were called JDK 1.0 and JDK 1.1.

Java 1.2, 1.3 and 1.4 were sold under the name "Java 2". Their full names were J2SE 1.2, 1.3 and 1.4.

With **J2SE 5.0** (2004), the internal version 1.5 got the public name 5. From Java SE 6 onwards, the public name is simply the version number.

The command `java -version` printed `1.8.0` up to Java 8. From Java 9 on, it prints `9`, `10`, `11` and so on.

### The release train {#release-train}

- **From 1996 to 2014**, a new version came out every one to three years. Each one had a long list of planned features. Java 7 took five years, because Oracle was taking over Sun at the time.
- **Java 9 (2017)** was the last big release of this old style.
- **From Java 10 (2018)**, a feature release comes out **every March and September** (JEP 322). A feature ships when it is ready. If it is not ready, it waits six months for the next release.
- **LTS (long-term support)** releases are the ones that vendors support for many years. They are **8, 11, 17, 21 and 25**. Until Java 17 there were three years between them. Since Java 21 there are two years, so the next LTS after 25 is 29 (September 2027).
- The other releases get only about six months of updates. That is why most production systems skip them.

### How a feature matures {#feature-lifecycle-section}

New ideas are tried in public before they become final. So one feature often appears in several versions, at different stages:

| Stage | How you use it | What it means |
| --- | --- | --- |
| Incubator module | You add a `jdk.incubator.*` module. | The API may still change or disappear. Examples are the Vector API and early structured concurrency. |
| Preview feature | You compile and run with `--enable-preview`. | The design is finished, and the JDK team wants feedback. It may change in the next version. |
| Experimental | You turn it on with `-XX:+UnlockExperimentalVMOptions`. | It is a JVM feature that is not ready for production yet. Examples are early ZGC and Shenandoah. |
| Final (product) | You need nothing special. | It is supported and here to stay. |
| Deprecated | You get a warning when you compile. | It still works, but it will go away. |
| Deprecated for removal | You get a stronger warning. | It will be removed in a future version. |
| Removed | It is gone. | Code that uses it no longer compiles or runs. |

Each change has a number called a **JEP** (JDK Enhancement Proposal). This lesson quotes JEP numbers, so you can look any change up at `openjdk.org/jeps/<number>`.

A **JSR** (Java Specification Request) is the older way of describing a change, through the Java Community Process. For example, JSR 335 describes lambdas.

## The early years: 1.0 to 1.4 {#early-years}

In these years Java went from a curiosity in web browsers to the standard platform for business software. The language itself barely changed. The libraries and the virtual machine changed a lot.

### Java 1.0 {#java-1-0}

**January 1996.** The promise was "write once, run anywhere". Java source code compiles to **bytecode**, a portable format that runs on any machine with a JVM (Java Virtual Machine).

- **Libraries:** It shipped `java.lang`, `java.io`, `java.util` and the AWT toolkit for windows and buttons. It also had **applets**, small programs that ran inside web pages.
- **JVM:** The JVM was only an interpreter. There was no just-in-time (JIT) compiler yet, so Java was slow.

### Java 1.1 {#java-1-1}

**February 1997.**

- **Language:** Inner classes arrived. These are nested classes and anonymous classes, the original way to write a callback.
- **Libraries:** It added the reflection API, JDBC for databases, RMI for remote calls, JavaBeans, and readers and writers that understand Unicode.

### Java 1.2 {#java-1-2}

**December 1998.** The platform was renamed "Java 2" and split into editions: J2SE (standard), J2EE (enterprise) and J2ME (mobile).

- **Libraries:** It added the **Collections framework** (`List`, `Set`, `Map` and `Collections`), Swing for desktop screens, and the `java.lang.ref` reference types (`SoftReference` and `WeakReference`).
- **Language:** It added the `strictfp` keyword, which makes floating-point maths give the same result on every machine.
- **JVM:** Sun's JVM now included a JIT compiler.

### Java 1.3 {#java-1-3}

**May 2000.**

- **JVM:** **HotSpot** became the default virtual machine. It brought adaptive optimisation, which means it watches the running program and compiles the busy parts. This is still the core of the JVM today.
- **Libraries:** It added dynamic proxies (`java.lang.reflect.Proxy`), JNDI for directory lookups, Java Sound, and RMI over IIOP.

### Java 1.4 {#java-1-4}

**February 2002.**

- **Language:** It added the `assert` keyword.
- **Libraries:** It added **NIO** (buffers, channels and selectors for non-blocking input and output) and regular expressions (`java.util.regex`). It also added the logging API, exception chaining (`getCause()`), IPv6 support, XML parsing (JAXP), Image I/O, `LinkedHashMap` and `IdentityHashMap`.

## Java 5 to 7: the language grows up {#java-5-to-7}

### Java 5 {#java-5}

**September 2004** (code name Tiger). This was the largest language update before Java 8.

- **Language:** It added **generics**, **annotations**, **enums**, **autoboxing and unboxing**, the enhanced `for` loop, varargs, static imports and `@Override`. Generics use **type erasure**: the type information is removed after compiling, so old code keeps working.
- **Concurrency:** It added **[`java.util.concurrent`](lesson:java-concurrency#executors)** (JSR 166). This package has thread pools (`ExecutorService`), `Future`, locks, atomic classes, `ConcurrentHashMap` and blocking queues. The **Java Memory Model** was also rewritten (JSR 133). It finally gave `volatile` and `synchronized` a precise meaning (see [happens-before](lesson:java-memory-model#happens-before)).
- **Libraries:** It added `StringBuilder`, `printf` and `Formatter`, `Scanner`, `ProcessBuilder`, JMX monitoring and the `java.lang.instrument` agent API.

### Java 6 {#java-6}

**December 2006** (code name Mustang). This was the last release made by Sun. It focused on tools and speed.

- **Libraries:** It added the scripting API (JSR 223), the compiler API (JSR 199), JDBC 4.0, pluggable annotation processing (JSR 269), `Deque`, `NavigableMap` and `NavigableSet`.
- **JVM:** Biased locking, lock coarsening and better escape analysis made `synchronized` code cheaper.
- **Ecosystem:** Sun began to make the JDK open source (OpenJDK) in 2006 and 2007. Oracle bought Sun in 2010.

### Java 7 {#java-7}

**July 2011** (code name Dolphin). This was the first Oracle release, five years after Java 6.

- **Language (Project Coin):** It added the **diamond operator** `<>`, **try-with-resources**, strings in `switch`, multi-catch, binary literals and underscores in numbers (`1_000_000`).
- **Libraries:** It added **NIO.2** (`Path`, `Files` and `WatchService`) and the **[Fork/Join](lesson:java-concurrency#fork-join)** framework. It also added `java.util.Objects`, `AutoCloseable`, `Phaser` and `ThreadLocalRandom`.
- **JVM and GC:** It added `invokedynamic` (JSR 292), the base for lambdas and for dynamic languages on the JVM. The **[G1 collector](lesson:garbage-collector#g1)** became supported from update 7u4. [Interned strings moved from the permanent generation to the heap](lesson:java-memory-model#pool-location).
- **Security and hashing:** Update 7u6 added an optional second way to hash strings. It protects `HashMap` against collision attacks (see [hash flooding](lesson:java-hashmap#q-hash-flooding)).
- **Support:** Public updates ended in April 2015.

## Java 8 to 11: functional Java, modules and a new cadence {#java-8-to-11}

### Java 8 {#java-8}

**March 2014 · LTS.** This release changed how Java is written. It is still the most widely used old version.

- **Language:** It added **lambda expressions** and **method references** (JSR 335), **functional interfaces**, and **default and static methods in interfaces**. It also added repeating annotations and type annotations.
- **Libraries:** It added the **Stream API**, `Optional` and the new date and time API `java.time` (JSR 310). It also added [`CompletableFuture`](lesson:java-concurrency#futures), `StampedLock`, [`LongAdder`](lesson:java-concurrency#atomics), `Base64` and `String.join`. `Map` got new methods: `computeIfAbsent`, `merge`, `getOrDefault` and `forEach`. There is also `Arrays.parallelSort`, and reflection can read parameter names (with the `-parameters` flag).
- **JVM and GC:** The permanent generation was removed. Class metadata moved to native memory, called **[Metaspace](lesson:garbage-collector#metaspace)** (JEP 122). G1 string deduplication arrived in update 8u20. `HashMap` buckets can turn into trees (JEP 180, see [treeification](lesson:java-hashmap#treeify)).
- **Tools:** It added the **Nashorn** JavaScript engine (JEP 174) and compact profiles for small devices. JavaFX was bundled with the JDK.

### Java 9 {#java-9}

**September 2017.** A big release with a short life: it had only six months of support.

- **Language:** It added the **module system** (Project Jigsaw, JPMS, JEP 261) and private methods in interfaces. An effectively final variable can now be used directly in try-with-resources. The diamond operator works with anonymous classes.
- **Libraries:** It added `List.of`, `Set.of` and `Map.of` (JEP 269). Streams got `takeWhile`, `dropWhile`, `iterate` with a condition, and `ofNullable`. It also added `Optional.ifPresentOrElse`, the Flow API for reactive streams (JEP 266), the Process API (JEP 102), the stack-walking API and variable handles. An HTTP/2 client arrived as an incubator module (JEP 110).
- **JVM and GC:** **[G1 became the default collector](lesson:garbage-collector#g1)** (JEP 248) on server-class machines. **[Compact strings](lesson:java-memory-model#string-storage)** store Latin-1 text with one byte per character (JEP 254). JVM logging was unified under `-Xlog`, and multi-release JARs arrived.
- **Tools:** It added **JShell**, an interactive shell where you type Java and see the result at once (a REPL, JEP 222). It also added `jlink`, which builds a trimmed runtime image.
- **Deprecated:** The Applet API (JEP 289), the **[CMS collector](lesson:garbage-collector#cms)** (JEP 291) and `Object.finalize()` were deprecated.

### Java 10 {#java-10}

**March 2018.** This was the first release on the six-month train.

- **Language:** It added **`var`**, which lets the compiler work out the type of a local variable (JEP 286).
- **Libraries:** It added `List.copyOf`, `Set.copyOf` and `Map.copyOf`, `Collectors.toUnmodifiableList` and `Optional.orElseThrow()`.
- **JVM and GC:** G1 got a parallel full GC (JEP 307), and the GC code got a clean interface (JEP 304). It also added application class-data sharing (JEP 310), thread-local handshakes and the experimental Graal JIT (JEP 317).

### Java 11 {#java-11}

**September 2018 · LTS.** This was the first LTS of the new model, and the main upgrade target after Java 8.

- **Language:** `var` can be used in lambda parameters (JEP 323). Nest-based access control arrived (JEP 181).
- **Libraries:** The standard **HTTP Client** arrived (JEP 321). It supports HTTP/2 and `CompletableFuture`. `String` got `isBlank`, `lines`, `strip` and `repeat`. `Files` got `readString` and `writeString`, and `Predicate.not` arrived.
- **Tools:** You can run a single source file directly with `java Hello.java` (JEP 330).
- **JVM and GC:** The **[ZGC](lesson:garbage-collector#zgc)** low-latency collector arrived as experimental (JEP 333). So did the **[Epsilon](lesson:garbage-collector#epsilon)** collector, which never frees memory (JEP 318). **Flight Recorder** became open source (JEP 328), and low-overhead heap profiling arrived.
- **Security:** It added TLS 1.3 (JEP 332) and ChaCha20-Poly1305 (JEP 329).
- **Removed:** The **Java EE and CORBA modules** were removed (JEP 320). These include JAXB, JAX-WS and `javax.annotation`. JavaFX moved out into the separate OpenJFX project. Nashorn was deprecated.
- **Licensing:** Oracle JDK became a paid product for production use. Free builds come from OpenJDK vendors such as Temurin, Corretto and Zulu.

## Java 12 to 17: previews become features {#java-12-to-17}

Most of this stretch is Project Amber delivering small language features. Each feature went through two or three preview rounds. Remember the pattern: **a preview in version N, final in N+1 or N+2**.

### Java 12 {#java-12}

**March 2019.**

- **Language:** **Switch expressions** arrived as a preview (JEP 325).
- **Libraries:** It added `Collectors.teeing`, `String.indent`, `String.transform` and `CompactNumberFormat`.
- **JVM and GC:** The **[Shenandoah](lesson:garbage-collector#shenandoah)** low-pause collector arrived as experimental (JEP 189). Default CDS archives arrived (JEP 341). G1 now returns unused memory promptly (JEP 346) and can stop a mixed collection early.

### Java 13 {#java-13}

**September 2019.**

- **Language:** **Text blocks**, strings between triple quotes, arrived as a preview (JEP 355). Switch expressions got a second preview with `yield` (JEP 354).
- **JVM and GC:** ZGC can return unused memory to the operating system (JEP 351). Dynamic CDS archives arrived (JEP 350).
- **Internals:** The old `Socket` code was rewritten (JEP 353). This was needed before virtual threads could work.

### Java 14 {#java-14}

**March 2020.**

- **Language:** **Switch expressions became final** (JEP 361). **Records** (JEP 359) and pattern matching for `instanceof` (JEP 305) arrived as previews.
- **JVM:** **Helpful NullPointerException messages** arrived (JEP 358). They are on by default from Java 15. JFR event streaming (JEP 349) and NUMA-aware G1 arrived, and ZGC came to macOS and Windows.
- **Tools:** The `jpackage` installer builder arrived as an incubator (JEP 343). So did the foreign-memory access API (JEP 370).
- **Removed:** The **[CMS collector](lesson:garbage-collector#cms)** (JEP 363) and the Pack200 tools were removed.

### Java 15 {#java-15}

**September 2020.**

- **Language:** **Text blocks became final** (JEP 378). **Sealed classes** arrived as a preview (JEP 360). Records and `instanceof` patterns got a second preview.
- **JVM and GC:** **[ZGC](lesson:garbage-collector#zgc)** and **[Shenandoah](lesson:garbage-collector#shenandoah)** both became ready for production (JEP 377 and 379). Hidden classes arrived (JEP 371) for frameworks that generate classes. Biased locking was turned off by default (JEP 374).
- **Security:** It added EdDSA signatures (JEP 339).
- **Removed:** The Nashorn engine was removed (JEP 372).

### Java 16 {#java-16}

**March 2021.**

- **Language:** **Records became final** (JEP 395), and so did **pattern matching for `instanceof`** (JEP 394). Sealed classes got a second preview.
- **Libraries:** It added `Stream.toList()`, `Stream.mapMulti` and Unix-domain sockets (JEP 380). The Vector API (JEP 338), the Foreign Linker and foreign-memory APIs arrived as incubators.
- **JVM and GC:** Elastic metaspace returns memory sooner (JEP 387). ZGC processes thread stacks concurrently (JEP 376). The JVM warns when code synchronizes on value-based classes such as `Integer`.
- **Encapsulation:** JDK internals are **strongly encapsulated by default** (JEP 396). Reflection into the internals of `java.*` now fails unless you add `--add-opens`.
- **Tools:** `jpackage` became final (JEP 392). The JDK source code moved to Git and GitHub.

### Java 17 {#java-17}

**September 2021 · LTS.**

- **Language:** **Sealed classes became final** (JEP 409). Pattern matching for `switch` arrived as a preview (JEP 406). Floating-point maths is always strict again (JEP 306).
- **Libraries:** It added better random number generators (`RandomGenerator`, JEP 356) and context-specific deserialization filters (JEP 415).
- **JVM and platforms:** It added a new macOS rendering pipeline (JEP 382) and support for macOS on Apple Silicon (JEP 391).
- **Encapsulation:** The `--illegal-access` escape hatch is **gone**. JDK internals are closed unless you open them explicitly (JEP 403).
- **Deprecated:** The **Security Manager** (JEP 411) and the Applet API (JEP 398) were deprecated for removal.
- **Removed:** RMI Activation (JEP 407) and the experimental AOT and JIT compilers (JEP 410) were removed.
- **Licensing:** Oracle JDK 17 became free again under the "No-Fee Terms and Conditions".

## Java 18 to 21: virtual threads and patterns {#java-18-to-21}

### Java 18 {#java-18}

**March 2022.**

- **Libraries:** **UTF-8 became the default charset** everywhere (JEP 400). A small web server, `jwebserver`, arrived (JEP 408). Javadoc got `@snippet` (JEP 413), and an address-resolution SPI arrived.
- **Internals:** Core reflection was rebuilt on method handles (JEP 416).
- **Deprecated:** Finalization was deprecated for removal (JEP 421).
- **Previews:** Pattern matching for `switch` got a second preview.

### Java 19 {#java-19}

**September 2022.**

- **Concurrency:** **[Virtual threads](lesson:java-concurrency#virtual-threads-basics)** arrived as a preview (JEP 425). **Structured concurrency** arrived as an incubator (JEP 428).
- **Language:** **Record patterns** arrived as a preview (JEP 405). `switch` patterns got a third preview.
- **Native interop:** The Foreign Function and Memory API arrived as a preview (JEP 424).
- **Platforms:** A Linux port for RISC-V arrived.

### Java 20 {#java-20}

**March 2023.** This release mostly refined earlier previews.

- **Concurrency:** **Scoped values** arrived as an incubator (JEP 429). Virtual threads and structured concurrency got second rounds.
- **Language:** Record patterns got a second preview, and `switch` patterns got a fourth.

### Java 21 {#java-21}

**September 2023 · LTS.** This was the biggest LTS since Java 8.

- **Concurrency:** **[Virtual threads became final](lesson:java-concurrency#virtual-threads-basics)** (JEP 444). They give you millions of cheap threads, so blocking-style code scales (Project Loom).
- **Language:** **Pattern matching for `switch` became final** (JEP 441), and so did **record patterns** (JEP 440). Three previews arrived: string templates (JEP 430), unnamed patterns and variables (JEP 443), and unnamed classes with an instance `main` (JEP 445).
- **Libraries:** **Sequenced collections** arrived (JEP 431). The new types `SequencedCollection`, `SequencedSet` and `SequencedMap` add `getFirst()`, `getLast()` and `reversed()` to `List`, `Deque`, `LinkedHashMap` and similar types. A key encapsulation mechanism (KEM) API also arrived (JEP 452).
- **JVM and GC:** **[Generational ZGC](lesson:garbage-collector#generational-zgc)** arrived as an option you turn on (JEP 439).
- **Deprecated:** The Windows 32-bit x86 port was deprecated (JEP 449). The JVM now warns when agents are loaded into a running program (JEP 451).

## Java 22 to 27: simpler Java, native access and smaller objects {#java-22-to-27}

### Java 22 {#java-22}

**March 2024.**

- **Language:** **Unnamed variables and patterns** with `_` became final (JEP 456). Statements before `super(...)` arrived as a preview (JEP 447).
- **Native interop:** The **Foreign Function and Memory API became final** (JEP 454). It is the modern replacement for JNI.
- **Tools:** The `java` command can launch a program made of several source files (JEP 458).
- **JVM and GC:** G1 got region pinning, so JNI critical sections no longer stall garbage collection (JEP 423).
- **Previews:** String templates (second preview), implicit classes, the Class-File API and Stream Gatherers were previews.

### Java 23 {#java-23}

**September 2024.**

- **Libraries:** Javadoc comments can be written in **Markdown** (JEP 467).
- **JVM and GC:** **[Generational ZGC](lesson:garbage-collector#generational-zgc) became the default** mode of ZGC (JEP 474).
- **Deprecated:** The memory-access methods of `sun.misc.Unsafe` were deprecated for removal (JEP 471).
- **Previews:** Primitive types in patterns (JEP 455), module import declarations (JEP 476) and flexible constructor bodies (second preview, JEP 482) were previews. **String templates were dropped for a redesign**, so they are not in this release.

### Java 24 {#java-24}

**March 2025.**

- **Libraries:** **Stream Gatherers became final** (JEP 485), and so did the **Class-File API** (JEP 484).
- **Concurrency:** A virtual thread can now use `synchronized` without [pinning](lesson:java-concurrency#q-pinning) its carrier thread (JEP 491).
- **JVM and GC:** **[Compact object headers](lesson:garbage-collector#compact-object-headers)** arrived as experimental (JEP 450, from Project Lilliput). Generational Shenandoah also arrived as experimental (JEP 404). The non-generational mode of ZGC was removed (JEP 490). Ahead-of-time class loading and linking arrived for faster startup (JEP 483, from Project Leyden).
- **Security:** It added the quantum-resistant algorithms ML-KEM and ML-DSA (JEP 496 and 497). The **Security Manager is permanently disabled** (JEP 486).
- **Warnings:** Using the memory access of `sun.misc.Unsafe` (JEP 498) and using JNI (JEP 472) now print warnings.
- **Removed:** The Windows 32-bit x86 port was removed (JEP 479).

### Java 25 {#java-25}

**September 2025 · LTS.**

- **Language:** **[Scoped values became final](lesson:java-concurrency#structured)** (JEP 506). **Module import declarations** became final too (`import module java.base;`, JEP 511). **Compact source files and instance `main` methods** became final, so a first program can be just `void main() { ... }` (JEP 512). **Flexible constructor bodies**, which allow statements before `super(...)`, became final (JEP 513).
- **JVM and GC:** **[Compact object headers](lesson:garbage-collector#compact-object-headers) became a product feature** (JEP 519), and so did **generational [Shenandoah](lesson:garbage-collector#shenandoah)** (JEP 521). Ahead-of-time command-line ergonomics and method profiling arrived (JEP 514 and 515).
- **Observability:** JFR got cooperative sampling, and method timing and tracing (JEP 518 and 520).
- **Security:** It added a key derivation function API (JEP 510).
- **Previews:** Stable values (JEP 502), structured concurrency (fifth preview), primitive types in patterns (third preview) and PEM encodings (JEP 470) were previews.
- **Removed:** The 32-bit x86 port was removed (JEP 503).

### Java 26 {#java-26}

**March 2026.** This release has ten JEPs.

- **Libraries:** The HTTP Client supports **HTTP/3** (JEP 517). It falls back to HTTP/2 or HTTP/1.1 when HTTP/3 is not available.
- **Integrity:** JEP 500 is called **"Prepare to make `final` mean final"**. The JVM warns when deep reflection changes a `final` field. This is a step towards forbidding it by default.
- **JVM and GC:** G1 got faster by using less synchronization (JEP 522). The ahead-of-time object cache works with any collector (JEP 516).
- **Removed:** The **Applet API** was removed (JEP 504). It had been deprecated for removal since Java 17.
- **Previews:** Lazy constants (the new name for stable values, JEP 526), structured concurrency (sixth preview, JEP 525), primitive types in patterns (fourth preview, JEP 530) and PEM encodings (second preview, JEP 524) were previews. The Vector API had its eleventh incubator (JEP 529).

### Java 27 {#java-27}

**September 2026.** This is not an LTS.

> **Check before quoting:** this entry comes from the summary in the release announcement. Confirm the exact list at `openjdk.org/projects/jdk/27` before you rely on a detail in an interview.

- **JVM and GC:** **[G1](lesson:garbage-collector#g1) is the default collector in all environments**. Until now, the JVM picked the Serial collector on small machines and containers (fewer than two CPUs or less than about 2 GB of memory). That special case goes away, and you can still choose Serial yourself. **[Compact object headers](lesson:garbage-collector#compact-object-headers) are on by default.**
- **Security:** TLS 1.3 gets a hybrid post-quantum key exchange.
- **Observability:** JFR recordings can hide sensitive data inside the process.
- **Previews and incubators:** Lazy constants (third preview), primitive types in patterns (fifth), structured concurrency (seventh), PEM encodings (third) and the Vector API (twelfth incubator) are still not final.

## Follow one idea across versions {#trails}

The best way to remember the history is to follow one thread at a time. These trails also link to the lessons that cover each topic.

### Garbage collectors {#trail-gc}

The full story of each collector is in the [garbage collector lesson](lesson:garbage-collector).

| Version | Change |
| --- | --- |
| 1.2 to 7 | The Serial and Parallel collectors exist. **CMS** gives low pause times. |
| 7u4 | [G1](lesson:garbage-collector#g1) is supported. |
| 8 | [Metaspace](lesson:garbage-collector#metaspace) replaces the permanent generation. The default on servers is still the Parallel collector. |
| 9 | **G1 becomes the default** on server-class machines. CMS is deprecated. |
| 10 | G1 gets a parallel full GC. The GC code gets a clean interface. |
| 11 | [ZGC](lesson:garbage-collector#zgc) and [Epsilon](lesson:garbage-collector#epsilon) arrive as experimental. |
| 12 | [Shenandoah](lesson:garbage-collector#shenandoah) arrives as experimental. |
| 14 | **CMS is removed.** ZGC comes to macOS and Windows. |
| 15 | ZGC and Shenandoah are ready for production. |
| 21 | [Generational ZGC](lesson:garbage-collector#generational-zgc) arrives as an option. |
| 23 | Generational ZGC becomes the default mode. |
| 24 | Non-generational ZGC is removed. Generational Shenandoah and [compact object headers](lesson:garbage-collector#compact-object-headers) arrive as experimental. |
| 25 | Generational Shenandoah and compact object headers become product features. |
| 27 | G1 is the default in every environment. Compact object headers are on by default. |

### Pattern matching and data in the language {#trail-patterns}

| Version | Change |
| --- | --- |
| 10 | `var` arrives. |
| 14 | Switch expressions are final. Records and `instanceof` patterns are previews. |
| 15 | Text blocks are final. Sealed classes are a preview. |
| 16 | Records and `instanceof` patterns are final. |
| 17 | Sealed classes are final. `switch` patterns are a preview. |
| 19 | Record patterns are a preview. |
| 21 | `switch` patterns and record patterns are final. |
| 22 | Unnamed variables and patterns are final. |
| 23 to 27 | Primitive types in patterns are still a preview in Java 27. |

### Concurrency {#trail-concurrency}

Details and examples are in the [concurrency lesson](lesson:java-concurrency#history).

| Version | Change |
| --- | --- |
| 1.0 | `Thread`, `synchronized`, `wait` and `notify` exist. |
| 5 | `java.util.concurrent`, executors and the new memory model arrive. |
| 7 | Fork/Join arrives. |
| 8 | `CompletableFuture` and parallel streams arrive. |
| 9 | The Flow API for reactive streams arrives. |
| 19 | Virtual threads (preview) and structured concurrency (incubator) arrive. |
| 21 | **Virtual threads are final.** |
| 24 | `synchronized` no longer pins virtual threads. |
| 25 | **Scoped values are final.** |
| 27 | Structured concurrency is still a preview (the seventh). |

### Startup time and footprint (Leyden and Lilliput) {#trail-startup}

| Version | Change |
| --- | --- |
| 10 and 12 | Class-data sharing for applications arrives, then a default CDS archive. |
| 24 | Ahead-of-time class loading and linking arrive. Compact object headers arrive as experimental. |
| 25 | AOT method profiling and command-line ergonomics arrive. Compact object headers become final. |
| 26 | The AOT object cache works with any collector. |
| 27 | Compact object headers are on by default. |

## What was removed {#removed}

| Version | What went | Why it matters |
| --- | --- | --- |
| 8 | The permanent generation. | `-XX:PermSize` flags are ignored. Class metadata now lives in Metaspace. |
| 11 | The Java EE and CORBA modules, and JavaFX. | You must add JAXB, `javax.annotation` and similar libraries as dependencies. |
| 14 | The CMS collector and Pack200. | Choose G1, ZGC or Shenandoah instead. |
| 15 | Nashorn. | Use GraalJS or another script engine. |
| 17 | `--illegal-access`, RMI Activation, and the experimental AOT and JIT compilers. | Open packages with `--add-opens` instead. |
| 24 | The Security Manager (disabled), the Windows 32-bit x86 port and non-generational ZGC. | Sandboxing now needs containers or the operating system. |
| 25 | The 32-bit x86 port. | |
| 26 | The Applet API. | |

## Upgrading guide {#upgrading}

This section lists what usually breaks at each step, and what to do about it.

### Java 8 to 11 {#upgrade-8-11}

- **Removed modules:** Code that uses JAXB, JAX-WS or `javax.annotation` no longer compiles. Add them as Maven or Gradle dependencies.
- **Illegal reflective access:** Libraries that reach into JDK internals print warnings. Upgrade those libraries.
- **Build tools:** Old versions of Maven plugins, Lombok, ByteBuddy, Mockito and JaCoCo do not understand newer class files. Upgrade them too.
- **JavaFX** is a separate download now. **Nashorn** is deprecated.
- **The default GC** changes to G1.

### Java 11 to 17 {#upgrade-11-17}

- **Strong encapsulation** (JEP 403): Reflection into JDK internals fails. Upgrade the library, or add `--add-opens`.
- **Removed:** CMS (in 14) and Nashorn (in 15) are gone. The Security Manager is deprecated.
- **Frameworks:** Spring Framework 6 and Spring Boot 3 need Java 17. They also use the **`jakarta.*` namespace** instead of `javax.*`. This is the usual reason teams move to 17.

### Java 17 to 21 {#upgrade-17-21}

- This step is mostly smooth. The **UTF-8 default charset** (from 18) can change how files are read on Windows.
- **Sequenced collections** add methods such as `reversed()` and `getFirst()`. They can clash with methods in your own `List` subclasses.
- **Loading an agent into a running program** prints a warning (JEP 451).
- **Virtual threads** and **pattern matching** are opt-in, so they do not break existing code.

### Java 21 to 25 {#upgrade-21-25}

- **The Security Manager** is permanently off (in 24). Code that still installs one fails.
- **`sun.misc.Unsafe`** memory access and **JNI** print warnings (in 24).
- **Removed ports:** The 32-bit x86 ports are gone (Windows in 24, Linux in 25).
- **ZGC:** The old non-generational mode is gone.
- New in 26: the **Applet API** is removed, and deep reflection on `final` fields prints a warning.

## Project map {#projects-map}

Many changes above belong to a named OpenJDK project. Knowing the names helps you place a feature.

| Project | Goal | Where it shows up |
| --- | --- | --- |
| **Coin** | Small improvements to the language. | Diamond and try-with-resources (7). |
| **Jigsaw** | A modular JDK. | Modules (9) and strong encapsulation (16, 17). |
| **Amber** | Less boilerplate in the language. | `var`, switch expressions, text blocks, records, sealed classes, pattern matching, unnamed variables and compact source files. |
| **Loom** | Lightweight concurrency. | Virtual threads (21), structured concurrency and scoped values (25). |
| **Panama** | Calling native code and using native memory. | The Foreign Function and Memory API (22) and the Vector API. |
| **Valhalla** | Value types and flatter memory layouts. | It is still in progress. |
| **Leyden** | Faster startup and warm-up. | CDS, the AOT cache and AOT profiling (24 to 26). |
| **Lilliput** | Smaller object headers. | Compact object headers (24 to 27). |

## Which version added it? {#cheatsheet}

| Feature | Final in |
| --- | --- |
| Generics, enums, annotations, autoboxing | 5 |
| try-with-resources, diamond, strings in `switch` | 7 |
| Lambdas, streams, `Optional`, `java.time`, default methods | 8 |
| Modules, `List.of`, JShell | 9 |
| `var` | 10 |
| `HttpClient`, `java File.java` | 11 |
| Switch expressions | 14 |
| Text blocks | 15 |
| Records, `instanceof` patterns | 16 |
| Sealed classes | 17 |
| UTF-8 default | 18 |
| Virtual threads, `switch` and record patterns, sequenced collections | 21 |
| Unnamed variables, Foreign Function and Memory API | 22 |
| Stream Gatherers, Class-File API | 24 |
| Scoped values, compact source files, flexible constructor bodies, module imports | 25 |
| Structured concurrency, primitive patterns, lazy constants | Still a preview in 27. |
| String templates | Withdrawn after previews in 21 and 22. |

Try it in the lab: [From Java 8 to 21: what each release removed](lab:java-modern-features).

## Interview questions {#questions}

### [basic] What are the LTS versions of Java, and what does LTS mean? {#lts}

**8, 11, 17, 21 and 25.**

LTS means **long-term support**. The vendor gives security and bug-fix updates for several years, instead of six months.

- The LTS releases are **8 (2014), 11 (2018), 17 (2021), 21 (2023) and 25 (2025)**.
- Until Java 17 there were three years between them. Since Java 21 there are two years, so the next one is 29.
- Production systems usually stay on LTS releases and skip the ones in between.

### [basic] How often does Java release a new version? {#cadence}

**Every six months, in March and September.**

- This started with Java 10 in 2018 (JEP 322).
- Before that, releases came every one to three years. Java 7 took five.
- A feature ships when it is ready. A feature that misses a release simply waits for the next one.
- Each release has a fixed date when features freeze, so teams can plan.

### [basic] What are the main features of Java 8? {#java8-features}

Lambdas and streams are the headline. The full list:

- **Lambda expressions and method references**, built on functional interfaces.
- **Default and static methods in interfaces**, so an interface can get new methods without breaking the classes that implement it.
- The **Stream API**, for processing collections by describing what you want instead of writing loops.
- **`Optional`**, to show that a value may be absent.
- **`java.time`**, a clean, immutable date and time API that replaces `Date` and `Calendar`.
- **`CompletableFuture`**, for chaining asynchronous work.
- In the JVM, **Metaspace replaced PermGen**, and `HashMap` buckets can turn into trees.

### [basic] What is the difference between the JDK, the JRE and the JVM? {#jdk-jre-jvm}

Each one contains the one before it.

1. The **JVM** runs bytecode. HotSpot is the common one.
2. The **JRE** is the JVM plus the standard class library. It is what you need to *run* Java.
3. The **JDK** is the JRE plus the developer tools: `javac`, `jar`, `jlink` and `jshell`.

Since Java 11 there is no separate JRE download. You install a JDK, or you build a trimmed runtime with `jlink`.

### [basic] What does var do, and when was it added? {#var}

**`var` lets the compiler work out the type of a local variable. It arrived in Java 10 (JEP 286).**

- The compiler reads the type from the value on the right: `var users = new ArrayList<User>();`.
- The variable still has a fixed type. This is not dynamic typing.
- It works only for local variables, not for fields or method signatures.
- Java 11 allowed `var` in lambda parameters.

Use it when the type is obvious from the right-hand side. Avoid it when it hides what you are holding.

### [basic] What are records, and in which version did they become final? {#records-q}

**A record is a short way to write an immutable data class. Records became final in Java 16 (JEP 395).**

`record Point(int x, int y) {}` generates the constructor, the accessors, `equals`, `hashCode` and `toString`.

- Records were a preview in Java 14 and 15.
- They make good map keys and DTOs (data transfer objects).
- A record cannot extend a class, and its fields are final. So records do not replace JPA entities, which must be changeable.

### [basic] Which Java version should a new project use? {#which-version}

**The newest LTS that your frameworks and your vendor support. Today that is Java 25.**

- Keep the build flexible enough to move to the next LTS.
- Java 17 and 21 are common in existing systems.
- Check the framework's minimum version. For example, Spring Boot 3 needs Java 17 or newer.
- Avoid non-LTS releases in production, unless you are ready to upgrade every six months.

### [intermediate] What is the difference between a preview feature, an incubator module and an experimental feature? {#feature-lifecycle}

All three are not final yet, but they differ in what they are and how you turn them on.

- **A preview feature** is a language or API feature with a finished design, shipped to get feedback. You must compile and run with `--enable-preview`. It can change or be removed in the next release. For example, `switch` patterns were previews from 17 to 20 and became final in 21.
- **An incubator module** is an API in a `jdk.incubator.*` module that you add explicitly. For example, the Vector API has been incubating since Java 16.
- **An experimental feature** is a JVM feature behind `-XX:+UnlockExperimentalVMOptions` that is not ready for production. Examples are ZGC in 11 and Shenandoah in 12.

Preview code compiled with one version will not run on another version. So previews do not belong in production.

### [intermediate] What did Java 9's module system change, and what problems did it cause? {#modules-q}

**It split the JDK into modules and hid the JDK's internals. That broke libraries that used those internals.**

Java 9 introduced the **Java Platform Module System** (Project Jigsaw, JEP 261). A file called `module-info.java` declares what a module needs (`requires`) and what it offers to others (`exports`).

The benefits:

- Strong encapsulation: code outside a module cannot use what the module does not export.
- Reliable configuration: a missing module is found at startup, not later.
- Smaller runtimes, built with `jlink`.

The problems:

- Libraries that used reflection on JDK internals broke.
- "Split packages", where one package is spread over two JARs, had to be fixed.

Most applications stay on the classpath and never write a `module-info`. They still feel the encapsulation, through the `--add-opens` and `--add-exports` flags.

### [intermediate] What did Java 8 do to PermGen, and why? {#permgen}

**Java 8 removed PermGen and moved class metadata to Metaspace, which grows on demand.**

- The **permanent generation** (PermGen) was a fixed-size area of the heap that held class metadata.
- You had to tune its size with `-XX:MaxPermSize`. Otherwise you got `OutOfMemoryError: PermGen space`.
- Java 8 removed it (JEP 122). Class metadata now lives in **[Metaspace](lesson:garbage-collector#metaspace)**. Metaspace uses native memory and grows when needed, up to the limit set by `-XX:MaxMetaspaceSize`.
- Interned strings had already moved to the heap in Java 7.

A memory leak through class loaders now shows up as Metaspace growth instead.

### [intermediate] Which garbage collector is the default in each Java version? {#default-gc}

It depends on the version:

- **Java 8 and earlier:** the **Parallel** collector, built for throughput, on server-class machines.
- **Java 9 to 26:** **[G1](lesson:garbage-collector#g1)** on server-class machines, and **Serial** on small machines and containers (fewer than two CPUs or about 2 GB of memory).
- **Java 27 (as announced):** G1 in all environments.

ZGC and Shenandoah are never the default. You choose them with `-XX:+UseZGC` or `-XX:+UseShenandoahGC`. Since Java 23, `-XX:+UseZGC` means the generational mode.

### [intermediate] What are sealed classes and pattern matching for switch? {#sealed-patterns}

**Sealed classes fix the list of subtypes, and a pattern `switch` handles each subtype. Together, the compiler can check that you covered every case.**

- **Sealed classes and interfaces** (final in 17) list exactly which classes may extend them: `sealed interface Shape permits Circle, Square {}`.
- **Pattern matching for `switch`** (final in 21) lets a `switch` test a value against type patterns and record patterns. It also supports guards, which are extra conditions on a case.

Together they model a closed set of choices, called an algebraic data type. The compiler checks that your `switch` covers every case, so you need no `default`. If someone adds a new subtype, every `switch` that does not handle it becomes a compile error.

### [intermediate] What problems do text blocks and switch expressions solve? {#text-blocks-switch}

**Both remove boilerplate and a class of bugs.**

- **Text blocks** (preview in 13, final in 15) are strings between triple quotes that keep their line breaks. JSON, SQL and HTML need no `\n` and no escaped quotes.
- **Switch expressions** (preview in 12, final in 14) let a `switch` return a value: `int days = switch (m) { case FEB -> 28; default -> 31; };`. They use `->`, so there is no fall-through from one case into the next. They must also cover every possible value.

### [intermediate] What are virtual threads, and how do they differ from platform threads? {#virtual-threads}

**A virtual thread is a cheap thread managed by the JVM. A platform thread is an expensive operating-system thread.**

- A **platform thread** is a thin wrapper around an operating-system thread. It is heavy (about a megabyte of stack), so you can have only thousands.
- A **virtual thread** (Project Loom, preview in 19, **final in 21**, JEP 444) is a lightweight thread run by the JVM on a small pool of **carrier threads**. When it waits for I/O, the JVM takes it off its carrier, so the carrier can run another one.
- So you can run **millions** of virtual threads and write simple blocking code instead of asynchronous callbacks.
- They suit work that waits for I/O, not work that keeps the CPU busy.
- Before Java 24, blocking inside `synchronized` could **pin** the carrier thread, which means the carrier stayed stuck too. Java 24 removed most of that (JEP 491).

### [intermediate] What was removed from Java between 8 and 21? {#removed-q}

Mostly old enterprise modules, an old collector and old scripting:

- the Java EE and CORBA modules (11);
- JavaFX, moved out of the JDK (11);
- the **CMS** collector (14);
- Pack200 (14);
- the **Nashorn** engine (15);
- the `--illegal-access` flag (17);
- RMI Activation (17);
- the experimental AOT and JIT compilers (17).

Later, the **Security Manager**, deprecated for removal in 17, was permanently disabled in 24. The **Applet API** went in 26. These removals are the usual reasons an old application does not start on a new JDK.

### [intermediate] What breaks when you upgrade from Java 8 to 17? {#upgrade-8-17}

Five things usually break:

1. **Removed modules.** JAXB, JAX-WS and `javax.annotation` must be added as dependencies.
2. **Strong encapsulation.** Reflection into JDK internals fails. Upgrade the library or add `--add-opens`.
3. **Old tools and libraries** cannot read the new class files. Examples are Lombok, ByteBuddy, Mockito, JaCoCo and build plugins.
4. **Removed features.** CMS, Nashorn and Pack200 are gone.
5. **Changed behaviour.** The default GC is G1, the default charset is UTF-8 from 18, and the version string has a new format.

How to approach it: upgrade in two steps (8 to 11, then 11 to 17). Run `jdeps` to find uses of internal APIs, and fix the dependencies first.

### [intermediate] Why does Spring Boot 3 need Java 17? {#spring-boot-3}

**Because Spring Framework 6, which Spring Boot 3 is built on, requires Java 17 as its minimum.**

- Spring 6 uses records, sealed types and other modern features.
- It also moved from Java EE (`javax.*`) to **Jakarta EE 9+ (`jakarta.*`)**.

That namespace change, not Java itself, is the real cost of the migration. Imports, the servlet and JPA APIs, and third-party libraries must all use the `jakarta` packages. Spring Boot 2.x supports Java 8 to 17, so it is the line for teams that cannot move yet.

### [deep] How did Java's concurrency model evolve? {#concurrency-evolution}

**From managing threads by hand, to chaining futures, to cheap threads with simple code.**

1. **Java 1.0** had `Thread` and `synchronized`.
2. **Java 5** added `java.util.concurrent` (executors, locks, atomics and concurrent collections) and fixed the **memory model**.
3. **Java 7** added Fork/Join for divide-and-conquer work.
4. **Java 8** added `CompletableFuture` and parallel streams for chaining asynchronous work.
5. **Java 9** added the Flow API for reactive streams.
6. **Java 21** made **virtual threads** final, so blocking code scales again.
7. **Structured concurrency** treats a group of tasks as one unit. It is still a preview through Java 27.
8. **Scoped values** (final in 25) replace `ThreadLocal` for passing data to child tasks.

More is in the [concurrency lesson](lesson:java-concurrency).

### [deep] How did Java's garbage collectors evolve? {#gc-evolution}

**From long pauses towards pauses of a few milliseconds, even on huge heaps.**

1. The Serial and Parallel collectors came first.
2. **CMS** gave low pauses. It was deprecated in 9 and removed in 14.
3. **G1** (supported in 7u4, default in 9) divides the heap into regions and aims for predictable pauses.
4. **ZGC** (experimental in 11, production in 15) and **Shenandoah** (experimental in 12, production in 15) keep pauses to milliseconds even on huge heaps. They do most of their work while the program keeps running.
5. Both became **generational**: ZGC in 21 (the default mode in 23) and Shenandoah in 25.
6. Java 27 makes G1 the default everywhere.

The details of each collector are in the [garbage collector lesson](lesson:garbage-collector).

### [deep] What does "strong encapsulation of JDK internals" mean? {#encapsulation}

**Code can no longer use reflection to reach into the JDK's non-public classes, unless the application opens them explicitly.**

1. Before Java 9, any code could use reflection to reach non-public JDK classes, such as `sun.misc.Unsafe` or the internals of `java.lang`.
2. Modules (9) made packages closed by default. But the JVM still allowed this "illegal reflective access" with a warning, to make migration easier.
3. **Java 16 denied it by default** (JEP 396).
4. **Java 17 removed the `--illegal-access` flag** (JEP 403).

Now a library must use supported APIs, or the application must opt in with `--add-opens module/package=ALL-UNNAMED`. Many "works on 8, fails on 17" bugs come from this.

### [deep] Why did string templates disappear? {#string-templates}

**Because the design turned out too complicated, so it was withdrawn for a redesign.**

- String templates (`STR."Hello \{name}"`) were previews in Java 21 and 22.
- Feedback showed that the design was more complicated than needed, and that the "processor" model was hard to explain.
- So the feature was **dropped from Java 23** and sent back for a redesign.

It is a good example of why previews exist: the community could try it, and the JDK team could still change course. Do not use it in production code.

### [deep] What is the story of the Security Manager? {#security-manager}

**It was deprecated in Java 17 and permanently disabled in Java 24.**

- The Security Manager put untrusted code in a sandbox. It is what made applets safe to run.
- It was complex, rarely used correctly and costly to maintain.
- It was **deprecated for removal in Java 17** (JEP 411).
- It was **permanently disabled in Java 24** (JEP 486). Installing one now fails.

Today, isolation comes from containers, operating-system sandboxes and separate processes, not from inside the JVM.

### [deep] Why were sequenced collections added in Java 21? {#sequenced}

**Because Java had no common type for "a collection with a fixed order", so getting the first or last element was different for every type.**

Before Java 21:

- A list used `list.get(0)`.
- A deque used `deque.getFirst()`.
- A `LinkedHashSet` needed `linkedHashSet.iterator().next()`.
- A sorted set used `sortedSet.first()`.

**SequencedCollection, SequencedSet and SequencedMap** (JEP 431) add the same methods to all of them: `getFirst()`, `getLast()`, `addFirst()`, `addLast()` and `reversed()`.

A warning for upgrades: if your own `List` subclass has a method named `reversed()` or `getFirst()`, it may now clash.

### [deep] What does "make final mean final" (JEP 500) mean? {#final-means-final}

**Java is moving towards forbidding reflection from changing `final` fields. Java 26 starts with warnings.**

- Reflection (`Field.setAccessible(true)`) has long allowed code to change `final` fields.
- That breaks the JVM's assumption that a `final` field never changes, and it blocks some optimisations.
- **Java 26** starts to **warn** when deep reflection changes a `final` field. A later release is meant to forbid it by default.

If a library or a serialization framework changes final fields, you will need an update or an explicit flag. This is part of a wider "integrity by default" direction, together with strong encapsulation and the deprecation of `Unsafe`.

### [deep] What are compact object headers? {#compact-headers}

**A smaller header on every Java object: 8 bytes instead of 12.**

- Every Java object starts with a header. It holds a mark word and a pointer to the object's class.
- On a 64-bit JVM with compressed pointers, the header is 12 bytes.
- **Project Lilliput** shrinks it to **8 bytes**. This reduces heap use and makes better use of the CPU cache in programs with many small objects.
- It was **experimental in 24** (JEP 450), became a **product feature in 25** (JEP 519) and is **on by default in 27**, as announced.

The details of memory layout and the effects on garbage collection are in the [garbage collector lesson](lesson:garbage-collector#compact-object-headers).

### [deep] What are Amber, Loom, Panama, Valhalla, Leyden and Lilliput? {#projects}

They are OpenJDK projects. Each one has one goal:

- **Amber** reduces boilerplate in the language: records, sealed classes and pattern matching.
- **Loom** brings lightweight concurrency: virtual threads, structured concurrency and scoped values.
- **Panama** improves access to native code and memory: the Foreign Function and Memory API and the Vector API.
- **Valhalla** adds value types for flatter memory layouts. It is still in progress.
- **Leyden** speeds up startup and warm-up with ahead-of-time caches.
- **Lilliput** shrinks object headers.

The project map above shows where each one appears.

### [coding] Modernise this Java 7 code. {#modernise}

This is a common exercise. It shows that you know what each version replaced. Start from old-style code:

```java
// Java 7
List<String> names = new ArrayList<String>();
for (User u : users) {
    if (u.getAge() >= 18) {
        names.add(u.getName().toUpperCase());
    }
}
Collections.sort(names);

String json = "{\n" +
              "  \"count\": " + names.size() + "\n" +
              "}";

if (shape instanceof Circle) {
    Circle c = (Circle) shape;
    area = Math.PI * c.getRadius() * c.getRadius();
} else if (shape instanceof Square) {
    Square s = (Square) shape;
    area = s.getSide() * s.getSide();
}
```

and move it forward:

```java
// Java 8: streams and lambdas
List<String> names = users.stream()
        .filter(u -> u.getAge() >= 18)
        .map(u -> u.getName().toUpperCase())
        .sorted()
        .collect(Collectors.toList());          // Java 16+: .toList()

// Java 15: text block, Java 10: var
var json = """
        { "count": %d }
        """.formatted(names.size());

// Java 21: sealed interface Shape permits Circle, Square, records and a pattern switch
double area = switch (shape) {
    case Circle c -> Math.PI * c.radius() * c.radius();
    case Square s -> s.side() * s.side();
};   // no default: the compiler checks that every permitted subtype is covered
```

Name the version for each step as you go. Also say that you would use `var` only where the type is obvious.
