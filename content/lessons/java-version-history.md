---
title: Java version history — what changed and when
nav: Version history
slug: java-version-history
summary: Every notable change from Java 1.0 to Java 27, grouped by era, with change trails that follow one feature across versions, an upgrade guide and interview questions.
tags: [Java, History, Releases]
order: 7
topic: Java / Language
updated: 2026-11-12
subnav: true
---

Java changes a lot, and interviewers love "which version added that?" questions. This lesson walks through every release, then lets you follow one idea (garbage collectors, pattern matching, concurrency) across versions. Press play on the timeline, filter it by theme, and jump to any version from it. Every version below has its own link (hover the heading and press 🔗).

```demo
name: java-timeline
```

> **How to use the cross-links:** where a change belongs to a topic with its own lesson (for example the garbage collectors), the word links to that lesson. A word with a ⏳ is a link to a lesson that is not written yet; it becomes a normal link as soon as the lesson exists.

## How Java ships {#how-java-ships}

### Names and numbers {#names-and-numbers}

The first releases were called JDK 1.0 and 1.1. Java 1.2 to 1.4 were marketed as "Java 2" (J2SE 1.2, 1.3, 1.4). With **J2SE 5.0** (2004) the internal version 1.5 got the public name 5, and from Java SE 6 onwards the number is simply the version. `java -version` printed `1.8.0` until Java 8 and prints `9`, `10`, `11` … from Java 9 on.

### The release train {#release-train}

- **1996 to 2014:** a new version every one to three years, each with a long feature wish-list. Java 7 took five years because of the Sun to Oracle transition.
- **Java 9 (2017)** was the last big-bang release.
- **From Java 10 (2018)** a feature release comes out **every March and September** (JEP 322). Features ship when ready; anything that is not ready waits six months.
- **LTS (long-term support)** releases are the ones vendors support for years: **8, 11, 17, 21, 25**. The gap was three years until 17 and has been two years since 21, so the next LTS after 25 is 29 (September 2027).
- The non-LTS releases get about six months of updates, which is why most production systems skip them.

### How a feature matures {#feature-lifecycle-section}

New ideas are tried in public before they are final, so one feature often appears in several versions:

| Stage | How you use it | Meaning |
| --- | --- | --- |
| Incubator module | add `jdk.incubator.*` module | an API that may change or disappear (Vector API, early structured concurrency) |
| Preview feature | compile and run with `--enable-preview` | a finished design that wants feedback; may change in the next version |
| Experimental | `-XX:+UnlockExperimentalVMOptions` | a JVM feature that is not production-ready (early ZGC, Shenandoah) |
| Final / product | nothing needed | supported, here to stay |
| Deprecated | warning at compile time | still works, will go away |
| Deprecated for removal | stronger warning | will be removed in a future version |
| Removed | gone | code using it no longer compiles or runs |

Each change has a number called a **JEP** (JDK Enhancement Proposal). I quote JEP numbers below so you can look any change up at `openjdk.org/jeps/<number>`. A **JSR** is the older Java Community Process specification (for example JSR 335 for lambdas).

## The early years: 1.0 to 1.4 {#early-years}

Java went from a browser curiosity to the standard enterprise platform. The language barely changed; the libraries and the virtual machine did.

### Java 1.0 {#java-1-0}

**January 1996.** "Write once, run anywhere": source compiles to bytecode that runs on any machine with a JVM.

- **Libraries:** `java.lang`, `java.io`, `java.util`, the AWT toolkit and **applets** (small programs that ran inside web pages).
- **JVM:** an interpreter only. There was no just-in-time compiler yet, so it was slow.

### Java 1.1 {#java-1-1}

**February 1997.**

- **Language:** inner classes (nested classes and anonymous classes, the original way to write a callback).
- **Libraries:** the reflection API, JDBC for databases, RMI for remote calls, JavaBeans, Unicode-aware readers and writers.

### Java 1.2 {#java-1-2}

**December 1998.** Rebranded as the Java 2 platform, split into editions (J2SE, J2EE, J2ME).

- **Libraries:** the **Collections framework** (`List`, `Set`, `Map`, `Collections`), Swing for desktop UIs, the `java.lang.ref` reference types (`SoftReference`, `WeakReference`).
- **Language:** the `strictfp` keyword for reproducible floating-point maths.
- **JVM:** a JIT compiler ships with Sun's JVM.

### Java 1.3 {#java-1-3}

**May 2000.**

- **JVM:** **HotSpot** becomes the default virtual machine, bringing adaptive optimisation that is still the core of the JVM today.
- **Libraries:** dynamic proxies (`java.lang.reflect.Proxy`), JNDI, Java Sound, RMI over IIOP.

### Java 1.4 {#java-1-4}

**February 2002.**

- **Language:** the `assert` keyword.
- **Libraries:** **NIO** (buffers, channels and selectors for non-blocking I/O), regular expressions (`java.util.regex`), the logging API, exception chaining (`getCause()`), IPv6 support, XML parsing (JAXP), Image I/O, `LinkedHashMap` and `IdentityHashMap`.

## Java 5 to 7: the language grows up {#java-5-to-7}

### Java 5 {#java-5}

**September 2004** (codename Tiger). The largest language update before Java 8.

- **Language:** **generics** (implemented with type erasure so old code keeps working), **annotations**, **enums**, **autoboxing and unboxing**, the enhanced `for` loop, varargs, static imports, `@Override`.
- **Concurrency:** **[`java.util.concurrent`](lesson:java-concurrency#executors)** (JSR 166): thread pools (`ExecutorService`), `Future`, locks, atomic classes, `ConcurrentHashMap`, blocking queues. The **Java Memory Model** was rewritten (JSR 133), finally giving `volatile` and `synchronized` a precise meaning (see [happens-before](lesson:java-memory-model#happens-before)).
- **Libraries:** `StringBuilder`, `printf`/`Formatter`, `Scanner`, `ProcessBuilder`, JMX monitoring, the `java.lang.instrument` agent API.

### Java 6 {#java-6}

**December 2006** (Mustang). The last release by Sun; a tooling and performance release.

- **Libraries:** the scripting API (JSR 223), the compiler API (JSR 199), JDBC 4.0, pluggable annotation processing (JSR 269), `Deque`, `NavigableMap` and `NavigableSet`.
- **JVM:** biased locking, lock coarsening and better escape analysis made synchronized code cheaper.
- **Ecosystem:** Sun began open-sourcing the JDK (OpenJDK) in 2006 and 2007. Oracle bought Sun in 2010.

### Java 7 {#java-7}

**July 2011** (Dolphin), the first Oracle release, after five years.

- **Language (Project Coin):** the **diamond operator** `<>`, **try-with-resources**, strings in `switch`, multi-catch, binary literals and underscores in numbers (`1_000_000`).
- **Libraries:** **NIO.2** (`Path`, `Files`, `WatchService`), the **[Fork/Join](lesson:java-concurrency#fork-join)** framework, `java.util.Objects`, `AutoCloseable`, `Phaser`, `ThreadLocalRandom`.
- **JVM and GC:** `invokedynamic` (JSR 292, the foundation for lambdas and dynamic languages), the **[G1 collector](lesson:garbage-collector#g1)** supported from update 7u4, [interned strings moved from the permanent generation to the heap](lesson:java-memory-model#pool-location).
- **Security and hashing:** update 7u6 added optional alternative String hashing to defend `HashMap` against collision attacks (see [hash flooding](lesson:java-hashmap#q-hash-flooding)).
- **Support:** public updates ended in April 2015.

## Java 8 to 11: functional Java, modules and a new cadence {#java-8-to-11}

### Java 8 {#java-8}

**March 2014 · LTS.** The release that changed how Java is written, and still the most widely deployed old version.

- **Language:** **lambda expressions** and **method references** (JSR 335), **functional interfaces**, **default and static methods in interfaces**, repeating annotations and type annotations.
- **Libraries:** the **Stream API**, `Optional`, the new date/time API `java.time` (JSR 310), [`CompletableFuture`](lesson:java-concurrency#futures), `StampedLock`, [`LongAdder`](lesson:java-concurrency#atomics), `Base64`, `String.join`, new `Map` methods (`computeIfAbsent`, `merge`, `getOrDefault`, `forEach`), `Arrays.parallelSort`, reflection on parameter names (`-parameters`).
- **JVM and GC:** the permanent generation is removed and class metadata moves to native memory: **[Metaspace](lesson:garbage-collector#metaspace)** (JEP 122). G1 string deduplication arrives in update 8u20. `HashMap` buckets can become trees (JEP 180, see [treeification](lesson:java-hashmap#treeify)).
- **Tools:** the **Nashorn** JavaScript engine (JEP 174), compact profiles for small devices, JavaFX bundled with the JDK.

### Java 9 {#java-9}

**September 2017.** A big release with a short life (six months of support).

- **Language:** the **module system** (Project Jigsaw, JPMS, JEP 261), private interface methods, effectively-final variables allowed directly in try-with-resources, diamond with anonymous classes.
- **Libraries:** `List.of`, `Set.of`, `Map.of` (JEP 269), stream additions (`takeWhile`, `dropWhile`, `iterate` with a predicate, `ofNullable`), `Optional.ifPresentOrElse`, the Flow API for reactive streams (JEP 266), the Process API (JEP 102), the stack-walking API, variable handles, an HTTP/2 client as an incubator module (JEP 110).
- **JVM and GC:** **[G1 becomes the default collector](lesson:garbage-collector#g1)** (JEP 248) on server-class machines; **[compact strings](lesson:java-memory-model#string-storage)** store Latin-1 text in one byte per character (JEP 254); unified JVM logging (`-Xlog`); multi-release JARs.
- **Tools:** **JShell** (the REPL, JEP 222), `jlink` to build a trimmed runtime image.
- **Deprecated:** the Applet API (JEP 289), the **[CMS collector](lesson:garbage-collector#cms)** (JEP 291), `Object.finalize()`.

### Java 10 {#java-10}

**March 2018.** The first release on the six-month train.

- **Language:** **`var`** local-variable type inference (JEP 286).
- **Libraries:** `List.copyOf` / `Set.copyOf` / `Map.copyOf`, `Collectors.toUnmodifiableList`, `Optional.orElseThrow()`.
- **JVM and GC:** parallel full GC for G1 (JEP 307), a clean GC interface (JEP 304), application class-data sharing (JEP 310), thread-local handshakes, the experimental Graal JIT (JEP 317).

### Java 11 {#java-11}

**September 2018 · LTS.** The first LTS of the new model, and the main upgrade target after Java 8.

- **Language:** `var` in lambda parameters (JEP 323), nest-based access control (JEP 181).
- **Libraries:** the standard **HTTP Client** (JEP 321, with HTTP/2 and `CompletableFuture`), `String.isBlank/lines/strip/repeat`, `Files.readString/writeString`, `Predicate.not`.
- **Tools:** run a single source file directly: `java Hello.java` (JEP 330).
- **JVM and GC:** the **[ZGC](lesson:garbage-collector#zgc)** low-latency collector (experimental, JEP 333), the **[Epsilon](lesson:garbage-collector#epsilon)** no-op collector (JEP 318), **Flight Recorder** open-sourced (JEP 328), low-overhead heap profiling.
- **Security:** TLS 1.3 (JEP 332), ChaCha20-Poly1305 (JEP 329).
- **Removed:** the **Java EE and CORBA modules** (JAXB, JAX-WS, `javax.annotation`, and others, JEP 320). JavaFX moved out into OpenJFX. Nashorn was deprecated.
- **Licensing:** Oracle JDK became a paid product for production use; free builds come from OpenJDK vendors (Temurin, Corretto, Zulu and others).

## Java 12 to 17: previews become features {#java-12-to-17}

Most of this stretch is Project Amber delivering small language features through two or three preview rounds each. Remember the pattern: **preview in N, final in N+1 or N+2**.

### Java 12 {#java-12}

**March 2019.**

- **Language:** **switch expressions** as a preview (JEP 325).
- **Libraries:** `Collectors.teeing`, `String.indent` and `transform`, `CompactNumberFormat`.
- **JVM and GC:** the **[Shenandoah](lesson:garbage-collector#shenandoah)** low-pause collector (experimental, JEP 189), default CDS archives (JEP 341), G1 returns unused memory promptly (JEP 346) and can abort mixed collections.

### Java 13 {#java-13}

**September 2019.**

- **Language:** **text blocks** as a preview (JEP 355, triple-quoted strings), second preview of switch expressions with `yield` (JEP 354).
- **JVM and GC:** ZGC can return unused memory to the operating system (JEP 351), dynamic CDS archives (JEP 350).
- **Internals:** the legacy `Socket` implementation was rewritten (JEP 353), a prerequisite for virtual threads.

### Java 14 {#java-14}

**March 2020.**

- **Language:** **switch expressions are final** (JEP 361). Previews: **records** (JEP 359) and pattern matching for `instanceof` (JEP 305).
- **JVM:** **helpful NullPointerException messages** (JEP 358, on by default from Java 15), JFR event streaming (JEP 349), NUMA-aware G1, ZGC on macOS and Windows.
- **Tools:** the `jpackage` installer builder as an incubator (JEP 343), foreign-memory access API incubator (JEP 370).
- **Removed:** the **[CMS collector](lesson:garbage-collector#cms)** (JEP 363) and the Pack200 tools.

### Java 15 {#java-15}

**September 2020.**

- **Language:** **text blocks are final** (JEP 378). Previews: **sealed classes** (JEP 360), second previews of records and `instanceof` patterns.
- **JVM and GC:** **[ZGC](lesson:garbage-collector#zgc)** and **[Shenandoah](lesson:garbage-collector#shenandoah)** are both production-ready (JEP 377 and 379). Hidden classes (JEP 371) for frameworks that generate classes. Biased locking is disabled by default (JEP 374).
- **Security:** EdDSA signatures (JEP 339).
- **Removed:** the Nashorn engine (JEP 372).

### Java 16 {#java-16}

**March 2021.**

- **Language:** **records are final** (JEP 395) and **pattern matching for `instanceof` is final** (JEP 394). Sealed classes get a second preview.
- **Libraries:** `Stream.toList()`, `Stream.mapMulti`, Unix-domain sockets (JEP 380), the Vector API incubator (JEP 338), the Foreign Linker and foreign-memory incubators.
- **JVM and GC:** elastic metaspace returns memory sooner (JEP 387), ZGC processes thread stacks concurrently (JEP 376), warnings for synchronizing on value-based classes such as `Integer`.
- **Encapsulation:** JDK internals are **strongly encapsulated by default** (JEP 396): reflection into `java.*` internals now fails unless you add `--add-opens`.
- **Tools:** `jpackage` is final (JEP 392). The JDK source moved to Git and GitHub.

### Java 17 {#java-17}

**September 2021 · LTS.**

- **Language:** **sealed classes are final** (JEP 409). Pattern matching for `switch` appears as a preview (JEP 406). Floating-point arithmetic is always strict again (JEP 306).
- **Libraries:** enhanced pseudo-random number generators (`RandomGenerator`, JEP 356), context-specific deserialization filters (JEP 415).
- **JVM and platforms:** the new macOS rendering pipeline (JEP 382), macOS on Apple Silicon (JEP 391).
- **Encapsulation:** the `--illegal-access` escape hatch is **gone**; JDK internals are closed unless opened explicitly (JEP 403).
- **Deprecated:** the **Security Manager** for removal (JEP 411), the Applet API for removal (JEP 398).
- **Removed:** RMI Activation (JEP 407), the experimental AOT and JIT compilers (JEP 410).
- **Licensing:** Oracle JDK 17 is free again under the "No-Fee Terms and Conditions".

## Java 18 to 21: virtual threads and patterns {#java-18-to-21}

### Java 18 {#java-18}

**March 2022.**

- **Libraries:** **UTF-8 is the default charset** everywhere (JEP 400), a minimal web server `jwebserver` (JEP 408), `@snippet` in Javadoc (JEP 413), an address-resolution SPI.
- **Internals:** core reflection reimplemented on method handles (JEP 416).
- **Deprecated:** finalization, for removal (JEP 421).
- **Previews:** pattern matching for `switch` (second preview).

### Java 19 {#java-19}

**September 2022.**

- **Concurrency:** **[virtual threads](lesson:java-concurrency#virtual-threads-basics)** as a preview (JEP 425), **structured concurrency** as an incubator (JEP 428).
- **Language:** **record patterns** as a preview (JEP 405), third preview of `switch` patterns.
- **Native interop:** the Foreign Function and Memory API as a preview (JEP 424).
- **Platforms:** a Linux/RISC-V port.

### Java 20 {#java-20}

**March 2023.** A refinement release.

- **Concurrency:** **scoped values** as an incubator (JEP 429), second rounds of virtual threads and structured concurrency.
- **Language:** second preview of record patterns, fourth preview of `switch` patterns.

### Java 21 {#java-21}

**September 2023 · LTS.** The biggest LTS since 8.

- **Concurrency:** **[virtual threads are final](lesson:java-concurrency#virtual-threads-basics)** (JEP 444): millions of cheap threads for blocking-style code (Project Loom).
- **Language:** **pattern matching for `switch` is final** (JEP 441) and **record patterns are final** (JEP 440). Previews: string templates (JEP 430), unnamed patterns and variables (JEP 443), unnamed classes and instance `main` (JEP 445).
- **Libraries:** **sequenced collections** (JEP 431): `SequencedCollection`, `SequencedSet` and `SequencedMap` add `getFirst()`, `getLast()` and `reversed()` to `List`, `Deque`, `LinkedHashMap` and friends. Key encapsulation (KEM) API (JEP 452).
- **JVM and GC:** **[generational ZGC](lesson:garbage-collector#generational-zgc)** (JEP 439, opt-in).
- **Deprecated:** the Windows 32-bit x86 port (JEP 449). The JVM starts warning when agents are loaded dynamically (JEP 451).

## Java 22 to 27: simpler Java, native access and smaller objects {#java-22-to-27}

### Java 22 {#java-22}

**March 2024.**

- **Language:** **unnamed variables and patterns** with `_` are final (JEP 456). Preview: statements before `super(...)` (JEP 447).
- **Native interop:** the **Foreign Function and Memory API is final** (JEP 454), the modern replacement for JNI.
- **Tools:** launch a program made of several source files with `java` (JEP 458).
- **JVM and GC:** region pinning for G1, so JNI critical sections no longer stall garbage collection (JEP 423).
- **Previews:** string templates (second), implicit classes, Class-File API, Stream Gatherers.

### Java 23 {#java-23}

**September 2024.**

- **Libraries:** **Markdown in Javadoc** comments (JEP 467).
- **JVM and GC:** **[generational ZGC](lesson:garbage-collector#generational-zgc) becomes the default** mode of ZGC (JEP 474).
- **Deprecated:** the memory-access methods of `sun.misc.Unsafe`, for removal (JEP 471).
- **Previews:** primitive types in patterns (JEP 455), module import declarations (JEP 476), flexible constructor bodies (second preview, JEP 482). **String templates were dropped for a redesign** and are not in this release.

### Java 24 {#java-24}

**March 2025.**

- **Libraries:** **Stream Gatherers are final** (JEP 485), the **Class-File API is final** (JEP 484).
- **Concurrency:** virtual threads can synchronise without [pinning](lesson:java-concurrency#q-pinning) their carrier thread (JEP 491).
- **JVM and GC:** **[compact object headers](lesson:garbage-collector#compact-object-headers)** (experimental, JEP 450, from Project Lilliput), generational Shenandoah (experimental, JEP 404), the non-generational mode of ZGC is removed (JEP 490), ahead-of-time class loading and linking for faster startup (JEP 483, from Project Leyden).
- **Security:** quantum-resistant ML-KEM and ML-DSA (JEP 496 and 497); the **Security Manager is permanently disabled** (JEP 486).
- **Warnings:** use of `sun.misc.Unsafe` memory access (JEP 498) and JNI (JEP 472) starts to warn.
- **Removed:** the Windows 32-bit x86 port (JEP 479).

### Java 25 {#java-25}

**September 2025 · LTS.**

- **Language:** **[scoped values are final](lesson:java-concurrency#structured)** (JEP 506), **module import declarations** (`import module java.base;`, JEP 511), **compact source files and instance `main` methods** so a first program is `void main() { ... }` (JEP 512), **flexible constructor bodies** that allow statements before `super(...)` (JEP 513).
- **JVM and GC:** **[compact object headers](lesson:garbage-collector#compact-object-headers) are a product feature** (JEP 519), **generational [Shenandoah](lesson:garbage-collector#shenandoah)** is a product feature (JEP 521), ahead-of-time command-line ergonomics and method profiling (JEP 514 and 515).
- **Observability:** JFR cooperative sampling and method timing and tracing (JEP 518 and 520).
- **Security:** key derivation function API (JEP 510).
- **Previews:** stable values (JEP 502), structured concurrency (fifth preview), primitive types in patterns (third preview), PEM encodings (JEP 470).
- **Removed:** the 32-bit x86 port (JEP 503).

### Java 26 {#java-26}

**March 2026.** Ten JEPs.

- **Libraries:** **HTTP/3 in the HTTP Client** (JEP 517); the client falls back to HTTP/2 or 1.1 when HTTP/3 is unavailable.
- **Integrity:** **"Prepare to make `final` mean final"** (JEP 500): warnings when deep reflection changes a `final` field, a step towards forbidding it by default.
- **JVM and GC:** G1 throughput improved by reducing synchronization (JEP 522); the ahead-of-time object cache works with any collector (JEP 516).
- **Removed:** the **Applet API** (JEP 504), deprecated for removal since Java 17.
- **Previews:** lazy constants (the renamed stable values, JEP 526), structured concurrency (sixth preview, JEP 525), primitive types in patterns (fourth preview, JEP 530), PEM encodings (second preview, JEP 524), Vector API (eleventh incubator, JEP 529).

### Java 27 {#java-27}

**September 2026**, not an LTS.

> **Check before quoting:** this entry comes from the release announcement summary. Confirm the exact list at `openjdk.org/projects/jdk/27` before you rely on a detail in an interview.

- **JVM and GC:** **[G1](lesson:garbage-collector#g1) is the default collector in all environments**. Until now the JVM picked the Serial collector on small machines and containers (fewer than two CPUs or under about 2 GB of memory); that special case goes away, and you can still choose Serial explicitly. **[Compact object headers](lesson:garbage-collector#compact-object-headers) on by default.**
- **Security:** hybrid post-quantum key exchange for TLS 1.3.
- **Observability:** in-process redaction of sensitive data in JFR recordings.
- **Previews and incubators:** lazy constants (third preview), primitive types in patterns (fifth), structured concurrency (seventh), PEM encodings (third), Vector API (twelfth incubator).

## Follow one idea across versions {#trails}

The best way to remember the history is to follow a single thread. These trails are the natural places to link other lessons.

### Garbage collectors {#trail-gc}

The full story of each collector is in the [garbage collector lesson](lesson:garbage-collector).

| Version | Change |
| --- | --- |
| 1.2 to 7 | Serial and Parallel collectors; **CMS** for low pause times |
| 7u4 | [G1](lesson:garbage-collector#g1) supported |
| 8 | Permanent generation replaced by [Metaspace](lesson:garbage-collector#metaspace); default on servers is still the Parallel collector |
| 9 | **G1 becomes the default** on server-class machines; CMS deprecated |
| 10 | Parallel full GC for G1; clean GC interface |
| 11 | [ZGC](lesson:garbage-collector#zgc) and [Epsilon](lesson:garbage-collector#epsilon) (experimental) |
| 12 | [Shenandoah](lesson:garbage-collector#shenandoah) (experimental) |
| 14 | **CMS removed**; ZGC on macOS and Windows |
| 15 | ZGC and Shenandoah production-ready |
| 21 | [Generational ZGC](lesson:garbage-collector#generational-zgc) (opt-in) |
| 23 | Generational ZGC is the default mode |
| 24 | Non-generational ZGC removed; generational Shenandoah (experimental); [compact object headers](lesson:garbage-collector#compact-object-headers) (experimental) |
| 25 | Generational Shenandoah and compact object headers are product features |
| 27 | G1 default in every environment; compact object headers on by default |

### Pattern matching and data in the language {#trail-patterns}

| Version | Change |
| --- | --- |
| 10 | `var` |
| 14 | Switch expressions final; records and `instanceof` patterns (preview) |
| 15 | Text blocks final; sealed classes (preview) |
| 16 | Records and `instanceof` patterns final |
| 17 | Sealed classes final; `switch` patterns (preview) |
| 19 | Record patterns (preview) |
| 21 | `switch` patterns and record patterns final |
| 22 | Unnamed variables and patterns final |
| 23 to 27 | Primitive types in patterns, still previewing in Java 27 |

### Concurrency {#trail-concurrency}

Details and examples are in the [concurrency lesson](lesson:java-concurrency#history).

| Version | Change |
| --- | --- |
| 1.0 | `Thread`, `synchronized`, `wait/notify` |
| 5 | `java.util.concurrent`, executors, the new memory model |
| 7 | Fork/Join |
| 8 | `CompletableFuture`, parallel streams |
| 9 | Flow API (reactive streams) |
| 19 | Virtual threads and structured concurrency (preview and incubator) |
| 21 | **Virtual threads final** |
| 24 | Virtual threads no longer pinned by `synchronized` |
| 25 | **Scoped values final** |
| 27 | Structured concurrency still in preview (seventh) |

### Startup time and footprint (Leyden and Lilliput) {#trail-startup}

| Version | Change |
| --- | --- |
| 10 and 12 | Class-data sharing for applications and a default CDS archive |
| 24 | Ahead-of-time class loading and linking; compact object headers (experimental) |
| 25 | AOT method profiling and command-line ergonomics; compact object headers final |
| 26 | AOT object cache with any collector |
| 27 | Compact object headers by default |

## What was removed {#removed}

| Version | Gone | Why it matters |
| --- | --- | --- |
| 8 | Permanent generation | `-XX:PermSize` flags are ignored; class metadata is now in Metaspace |
| 11 | Java EE and CORBA modules, JavaFX | add JAXB, `javax.annotation` and so on as dependencies |
| 14 | CMS collector, Pack200 | choose G1, ZGC or Shenandoah |
| 15 | Nashorn | use GraalJS or another script engine |
| 17 | `--illegal-access`, RMI Activation, experimental AOT/JIT | open packages with `--add-opens` |
| 24 | Security Manager (disabled), Windows 32-bit x86, non-generational ZGC | sandboxing needs containers or the OS |
| 25 | 32-bit x86 port | |
| 26 | Applet API | |

## Upgrading guide {#upgrading}

What usually breaks at each hop, and what to do.

### Java 8 to 11 {#upgrade-8-11}

- **Removed modules:** code using JAXB, JAX-WS or `javax.annotation` fails to compile. Add them as Maven or Gradle dependencies.
- **Illegal reflective access:** libraries that reach into JDK internals print warnings. Upgrade them.
- **Build tooling:** old versions of Maven plugins, Lombok, ByteBuddy, Mockito and JaCoCo do not understand newer class files.
- **JavaFX** is a separate download. **Nashorn** is deprecated.
- **GC default** changes to G1.

### Java 11 to 17 {#upgrade-11-17}

- **Strong encapsulation** (JEP 403): reflection into JDK internals fails. Upgrade the library or add `--add-opens`.
- **Removed:** CMS (14), Nashorn (15). Security Manager is deprecated.
- **Frameworks:** Spring Framework 6 and Spring Boot 3 need Java 17 and the **`jakarta.*` namespace** instead of `javax.*`. That is the usual reason teams move to 17.

### Java 17 to 21 {#upgrade-17-21}

- Mostly smooth. **UTF-8 default charset** (from 18) can change how files are read on Windows.
- **Sequenced collections** add methods such as `reversed()` and `getFirst()` that can clash with your own `List` subclasses.
- **Dynamic agent loading** warns (JEP 451).
- **Virtual threads** and **pattern matching** are opt-in, so they do not break existing code.

### Java 21 to 25 {#upgrade-21-25}

- **Security Manager** is permanently off (24); code that still installs one fails.
- **`sun.misc.Unsafe`** memory access and **JNI** start to warn (24).
- **Removed ports:** 32-bit x86 (Windows in 24, Linux in 25).
- **ZGC:** the old non-generational mode is gone.
- New in 26: the **Applet API** is removed, and deep reflection on `final` fields warns.

## Project map {#projects-map}

Many changes above belong to a named OpenJDK project. Knowing the names helps you place a feature.

| Project | Goal | Shows up as |
| --- | --- | --- |
| **Coin** | small language improvements | diamond, try-with-resources (7) |
| **Jigsaw** | modular JDK | modules (9), encapsulation (16, 17) |
| **Amber** | less ceremony in the language | `var`, switch expressions, text blocks, records, sealed classes, pattern matching, unnamed variables, compact source files |
| **Loom** | lightweight concurrency | virtual threads (21), structured concurrency, scoped values (25) |
| **Panama** | native interop | Foreign Function and Memory API (22), Vector API |
| **Valhalla** | value types and flatter memory layouts | still in progress |
| **Leyden** | faster startup and warm-up | CDS, AOT cache and profiling (24 to 26) |
| **Lilliput** | smaller object headers | compact object headers (24 to 27) |

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
| Structured concurrency, primitive patterns, lazy constants | still preview in 27 |
| String templates | withdrawn after previews in 21 and 22 |

## Interview questions {#questions}

### [basic] What are the LTS versions of Java, and what does LTS mean? {#lts}

LTS means **long-term support**: the vendor provides security and bug-fix updates for several years instead of six months. The LTS releases are **8 (2014), 11 (2018), 17 (2021), 21 (2023) and 25 (2025)**. The gap between LTS releases was three years until 17 and has been two years since 21, so the next one is 29. Production systems usually stay on LTS releases and skip the ones in between.

### [basic] How often does Java release a new version? {#cadence}

Since Java 10 (2018) there is a feature release **every six months, in March and September** (JEP 322). Before that, releases came every one to three years (Java 7 took five). Features ship when ready; a feature that misses a release simply waits for the next. Each release has a fixed feature freeze, so teams can plan.

### [basic] What are the main features of Java 8? {#java8-features}

- **Lambda expressions and method references**, backed by functional interfaces.
- **Default and static methods in interfaces**, so interfaces can evolve without breaking implementers.
- The **Stream API** for declarative collection processing.
- **`Optional`** to model absent values.
- **`java.time`**, a clean immutable date/time API replacing `Date` and `Calendar`.
- **`CompletableFuture`** for composing async work.
- JVM: **Metaspace replaces PermGen**, and `HashMap` buckets can become trees.

### [basic] What is the difference between the JDK, the JRE and the JVM? {#jdk-jre-jvm}

The **JVM** runs bytecode (HotSpot is the common one). The **JRE** is the JVM plus the standard class library: what you need to *run* Java. The **JDK** is the JRE plus the developer tools (`javac`, `jar`, `jlink`, `jshell`). Since Java 11 there is no separate JRE download: you install a JDK, or build a trimmed runtime with `jlink`.

### [basic] What does var do, and when was it added? {#var}

`var` (Java 10, JEP 286) lets the compiler infer the type of a **local variable** from its initializer: `var users = new ArrayList<User>();`. The variable is still statically typed; this is not dynamic typing. It works only for locals, not fields or method signatures. Java 11 allowed `var` in lambda parameters. Use it when the type is obvious from the right-hand side, avoid it when it hides what you are holding.

### [basic] What are records, and in which version did they become final? {#records-q}

A **record** is a concise immutable data class: `record Point(int x, int y) {}` generates the constructor, accessors, `equals`, `hashCode` and `toString`. They were a preview in Java 14 and 15 and **final in Java 16** (JEP 395). Records are good map keys and DTOs. They cannot extend a class and their fields are final, so they do not replace mutable JPA entities.

### [basic] Which Java version should a new project use? {#which-version}

Use the **newest LTS that your frameworks and vendor support**, today Java 25, and keep the build flexible enough to move to the next LTS. Java 17 and 21 are common in existing systems. Check the framework baseline: Spring Boot 3 needs Java 17 or newer. Avoid non-LTS releases in production unless you are prepared to upgrade every six months.

### [intermediate] What is the difference between a preview feature, an incubator module and an experimental feature? {#feature-lifecycle}

- **Preview feature:** a language or API feature with a finished design that is shipped for feedback. You must compile and run with `--enable-preview`, and it can change or be removed in the next release (switch patterns were previewed from 17 to 20 before being final in 21).
- **Incubator module:** an API in a `jdk.incubator.*` module that you add explicitly (the Vector API has incubated since Java 16).
- **Experimental:** a JVM feature behind `-XX:+UnlockExperimentalVMOptions` that is not production-ready (ZGC in 11, Shenandoah in 12).

Preview code compiled with one version will not run on another, so previews do not belong in production.

### [intermediate] What did Java 9's module system change, and what problems did it cause? {#modules-q}

Java 9 introduced the **Java Platform Module System** (Project Jigsaw, JEP 261): the JDK was split into modules, and a `module-info.java` declares what a module requires and exports. The benefits are strong encapsulation, reliable configuration and smaller runtimes with `jlink`. The pain: libraries that used reflection on JDK internals broke, and "split packages" had to be fixed. Most applications stay on the classpath and never write a `module-info`, but they still feel the encapsulation through `--add-opens` and `--add-exports` flags.

### [intermediate] What did Java 8 do to PermGen, and why? {#permgen}

The **permanent generation** was a fixed-size region of the heap holding class metadata, and its size had to be tuned (`-XX:MaxPermSize`) or you got `OutOfMemoryError: PermGen space`. Java 8 removed it (JEP 122); class metadata now lives in **[Metaspace](lesson:garbage-collector#metaspace)**, which uses native memory and grows on demand, limited by `-XX:MaxMetaspaceSize`. Interned strings had already moved to the heap in Java 7. Memory leaks from class loaders now show up as Metaspace growth instead.

### [intermediate] Which garbage collector is the default in each Java version? {#default-gc}

- **Java 8 and earlier:** the **Parallel** (throughput) collector on server-class machines.
- **Java 9 to 26:** **[G1](lesson:garbage-collector#g1)** on server-class machines, **Serial** on small machines and containers (fewer than two CPUs or about 2 GB of memory).
- **Java 27 (as announced):** G1 in all environments.

ZGC and Shenandoah are never the default; you choose them with `-XX:+UseZGC` or `-XX:+UseShenandoahGC`. Since Java 23 `-XX:+UseZGC` means the generational mode.

### [intermediate] What are sealed classes and pattern matching for switch? {#sealed-patterns}

**Sealed classes and interfaces** (final in 17) list exactly which classes may extend them: `sealed interface Shape permits Circle, Square {}`. **Pattern matching for `switch`** (final in 21) lets a `switch` test a value against type patterns and record patterns, with guards. Together they model a closed set of alternatives (an algebraic data type), and the compiler can check that your `switch` covers every case without a `default`, so adding a new subtype produces a compile error where handling is missing.

### [intermediate] What problems do text blocks and switch expressions solve? {#text-blocks-switch}

**Text blocks** (preview in 13, final in 15) are triple-quoted strings that keep line breaks, so JSON, SQL and HTML need no `\n` and escaped quotes. **Switch expressions** (preview in 12, final in 14) make `switch` return a value (`int days = switch (m) { case FEB -> 28; default -> 31; };`), use `->` so there is no fall-through, and must be exhaustive. Both reduce boilerplate and a class of bugs.

### [intermediate] What are virtual threads, and how do they differ from platform threads? {#virtual-threads}

A **platform thread** is a thin wrapper over an operating-system thread: heavy (about a megabyte of stack) and limited to thousands. A **virtual thread** (Project Loom; preview in 19, **final in 21**, JEP 444) is a lightweight thread managed by the JVM and mounted on a small pool of carrier threads. When it blocks on I/O it is unmounted, so you can run **millions** of them and write simple blocking code instead of async callbacks. They suit I/O-bound work, not CPU-bound work. Before Java 24, blocking inside `synchronized` could pin the carrier thread; Java 24 removed most of that (JEP 491).

### [intermediate] What was removed from Java between 8 and 21? {#removed-q}

Java EE and CORBA modules (11), JavaFX from the JDK (11), the **CMS** collector (14), Pack200 (14), the **Nashorn** engine (15), the `--illegal-access` flag (17), RMI Activation (17) and the experimental AOT and JIT compilers (17). The **Security Manager** was deprecated for removal in 17 and permanently disabled in 24; the **Applet API** went in 26. These are the usual reasons an old application does not start on a new JDK.

### [intermediate] What breaks when you upgrade from Java 8 to 17? {#upgrade-8-17}

- **Removed modules:** JAXB, JAX-WS and `javax.annotation` must be added as dependencies.
- **Strong encapsulation:** reflection into JDK internals fails; upgrade the library or add `--add-opens`.
- **Old tooling and libraries** that do not read new class files: Lombok, ByteBuddy, Mockito, JaCoCo, build plugins.
- **Removed features:** CMS, Nashorn, Pack200.
- **Behaviour changes:** the default GC is G1, the default charset is UTF-8 from 18, the version string format changed.

Approach: upgrade in two hops (8 to 11, then 11 to 17), run `jdeps` to find internal API use, and fix dependencies first.

### [intermediate] Why does Spring Boot 3 need Java 17? {#spring-boot-3}

Spring Framework 6, which Spring Boot 3 is built on, has **Java 17 as its baseline** so it can use records, sealed types and other modern features, and it moved from Java EE (`javax.*`) to **Jakarta EE 9+ (`jakarta.*`)**. That namespace change, not Java itself, is the real migration cost: imports, servlet and JPA APIs and third-party libraries must all use the `jakarta` packages. Spring Boot 2.x supports Java 8 to 17 and is the line for teams that cannot move yet.

### [deep] How did Java's concurrency model evolve? {#concurrency-evolution}

Java 1.0 had `Thread` and `synchronized`. **Java 5** added `java.util.concurrent` (executors, locks, atomics, concurrent collections) and fixed the **memory model**. **Java 7** added Fork/Join for divide-and-conquer. **Java 8** added `CompletableFuture` and parallel streams for composing async work. **Java 9** added the Flow API for reactive streams. **Java 21** made **virtual threads** final so blocking code scales again; **structured concurrency** (still previewing through 27) treats a group of tasks as one unit, and **scoped values** (final in 25) replace `ThreadLocal` for passing data to child tasks. The trend: from managing threads by hand, to composing futures, to cheap threads with simple code. More in the [concurrency lesson](lesson:java-concurrency).

### [deep] How did Java's garbage collectors evolve? {#gc-evolution}

Serial and Parallel collectors came first, then **CMS** for low pauses (deprecated in 9, removed in 14). **G1** (supported in 7u4, default in 9) divides the heap into regions and aims for predictable pauses. **ZGC** (experimental 11, production 15) and **Shenandoah** (experimental 12, production 15) keep pauses to milliseconds even on huge heaps by working concurrently. Both became **generational** (ZGC in 21 and the default in 23; Shenandoah in 25). Java 27 makes G1 the default everywhere. The details of each collector belong in the [garbage collector lesson](lesson:garbage-collector).

### [deep] What does "strong encapsulation of JDK internals" mean? {#encapsulation}

Before Java 9, any code could reflectively reach into non-public JDK classes (such as `sun.misc.Unsafe` or `java.lang` internals). Modules (9) made packages non-exported by default, but the JVM allowed illegal reflective access with a warning to ease migration. **Java 16 denied it by default** (JEP 396) and **Java 17 removed the `--illegal-access` flag** (JEP 403). Now a library must use supported APIs, or the application must opt in with `--add-opens module/package=ALL-UNNAMED`. Many "works on 8, fails on 17" bugs are this.

### [deep] Why did string templates disappear? {#string-templates}

String templates (`STR."Hello \{name}"`) were previewed in Java 21 and 22. Feedback showed that the design was more complicated than needed and that the processor model was hard to explain, so the feature was **dropped from Java 23** and sent back for a redesign. It is a good example of why previews exist: the community could try it, and the JDK team could still change course. Do not use it in production code.

### [deep] What is the story of the Security Manager? {#security-manager}

The Security Manager sandboxed untrusted code (it powered applets). It was complex, rarely used correctly, and costly to maintain. It was **deprecated for removal in Java 17** (JEP 411) and **permanently disabled in Java 24** (JEP 486): installing one now fails. Modern isolation comes from containers, operating-system sandboxes and process separation rather than inside the JVM.

### [deep] Why were sequenced collections added in Java 21? {#sequenced}

Java had no common type for "a collection with a defined encounter order". Getting the first or last element was different for each type: `list.get(0)`, `deque.getFirst()`, `linkedHashSet.iterator().next()`, `sortedSet.first()`. **SequencedCollection, SequencedSet and SequencedMap** (JEP 431) add `getFirst()`, `getLast()`, `addFirst()`, `addLast()` and `reversed()` uniformly. A caveat for upgrades: your own `List` subclasses with a method named `reversed()` or `getFirst()` may now clash.

### [deep] What does "make final mean final" (JEP 500) mean? {#final-means-final}

Reflection (`Field.setAccessible(true)`) has long let code change `final` fields, which breaks the JVM's assumption that final means immutable and blocks optimisations. **Java 26** starts **warning** when deep reflection mutates a `final` field, and a later release is intended to forbid it by default. If a library or serialization framework mutates final fields you will need updates or an explicit flag. It belongs to the broader "integrity by default" direction that also includes strong encapsulation and Unsafe deprecation.

### [deep] What are compact object headers? {#compact-headers}

Every Java object starts with a header holding a mark word and a class pointer, 12 bytes with compressed pointers on a 64-bit JVM. **Project Lilliput** shrinks this to **8 bytes**, which reduces heap use and improves cache behaviour for programs with many small objects. It was **experimental in 24** (JEP 450), became a **product feature in 25** (JEP 519) and is **on by default in 27** as announced. Details of memory layout and garbage collection effects belong in the [garbage collector lesson](lesson:garbage-collector#compact-object-headers).

### [deep] What are Amber, Loom, Panama, Valhalla, Leyden and Lilliput? {#projects}

OpenJDK projects, each with a goal: **Amber** reduces language ceremony (records, sealed classes, pattern matching); **Loom** brings lightweight concurrency (virtual threads, structured concurrency, scoped values); **Panama** improves native interop (Foreign Function and Memory API, Vector API); **Valhalla** adds value types for flatter memory layouts (still in progress); **Leyden** speeds startup and warm-up (AOT caches); **Lilliput** shrinks object headers. See the project map above for where each appears.

### [coding] Modernise this Java 7 code. {#modernise}

A common exercise: show you know what each version replaced. Start from old-style code:

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

Name the version for each step as you go, and mention that you would only use `var` where the type is obvious.
