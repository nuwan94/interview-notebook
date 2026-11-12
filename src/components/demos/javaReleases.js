// Compact data behind the animated Java timeline. The full story lives in content/lessons/java-version-history.md;
// `anchor` is the id of that version's heading, so the timeline links straight to it.
// tags: lang = language, api = libraries, jvm = JVM & GC, conc = concurrency, sec = security, rm = removals

export const TAGS = [
  { id: 'lang', label: 'Language' },
  { id: 'api', label: 'Libraries' },
  { id: 'jvm', label: 'JVM & GC' },
  { id: 'conc', label: 'Concurrency' },
  { id: 'sec', label: 'Security' },
  { id: 'rm', label: 'Removals' },
];

export const RELEASES = [
  { v: '1.0', date: 'Jan 1996', anchor: 'java-1-0', tags: ['api'], headline: 'Write once, run anywhere: applets, AWT and an interpreted JVM.', bullets: ['Bytecode on a virtual machine', 'Applets in the browser', 'java.lang, java.io, java.util'] },
  { v: '1.1', date: 'Feb 1997', anchor: 'java-1-1', tags: ['lang', 'api'], headline: 'Inner classes, reflection, JDBC and JavaBeans.', bullets: ['Inner classes', 'Reflection API', 'JDBC, RMI, JavaBeans'] },
  { v: '1.2', date: 'Dec 1998', anchor: 'java-1-2', tags: ['api', 'jvm'], headline: 'The Collections framework and Swing; the platform becomes "Java 2".', bullets: ['List, Set, Map', 'Swing', 'JIT compiler, strictfp'] },
  { v: '1.3', date: 'May 2000', anchor: 'java-1-3', tags: ['jvm', 'api'], headline: 'HotSpot becomes the default JVM.', bullets: ['HotSpot by default', 'Dynamic proxies', 'JNDI, Java Sound'] },
  { v: '1.4', date: 'Feb 2002', anchor: 'java-1-4', tags: ['lang', 'api'], headline: 'assert, NIO, regular expressions and logging.', bullets: ['assert keyword', 'NIO channels and buffers', 'java.util.regex, logging, exception chaining'] },
  { v: '5', date: 'Sep 2004', anchor: 'java-5', tags: ['lang', 'conc', 'api'], headline: 'The biggest language update: generics, annotations, enums, autoboxing, java.util.concurrent.', bullets: ['Generics, enums, annotations', 'Autoboxing, varargs, for-each', 'java.util.concurrent and a new memory model'] },
  { v: '6', date: 'Dec 2006', anchor: 'java-6', tags: ['api', 'jvm'], headline: 'A performance and tooling release: scripting, compiler API, JVM tuning.', bullets: ['Scripting and compiler APIs', 'JDBC 4', 'Biased locking, escape analysis'] },
  { v: '7', date: 'Jul 2011', anchor: 'java-7', tags: ['lang', 'conc', 'jvm', 'api'], headline: 'Project Coin syntax, NIO.2, Fork/Join and the first supported G1.', bullets: ['Diamond, try-with-resources, multi-catch', 'NIO.2 (Path, Files)', 'Fork/Join, invokedynamic, G1'] },
  { v: '8', date: 'Mar 2014', lts: true, anchor: 'java-8', tags: ['lang', 'api', 'jvm', 'conc', 'rm'], headline: 'Lambdas, streams, java.time and the end of PermGen.', bullets: ['Lambdas and method references', 'Stream API, Optional, java.time', 'Metaspace replaces PermGen; HashMap tree bins'] },
  { v: '9', date: 'Sep 2017', anchor: 'java-9', tags: ['lang', 'api', 'jvm'], headline: 'Modules (Jigsaw), JShell and G1 as the default collector.', bullets: ['Module system', 'JShell, List.of / Map.of', 'G1 default, compact strings'] },
  { v: '10', date: 'Mar 2018', anchor: 'java-10', tags: ['lang', 'jvm'], headline: 'var, and the start of six-month releases.', bullets: ['var for locals', 'Parallel full GC for G1', 'Time-based release train'] },
  { v: '11', date: 'Sep 2018', lts: true, anchor: 'java-11', tags: ['api', 'jvm', 'sec', 'rm'], headline: 'Standard HTTP client, single-file programs; Java EE and CORBA removed.', bullets: ['HTTP Client, java File.java', 'ZGC and Epsilon (experimental)', 'TLS 1.3; Java EE modules removed'] },
  { v: '12', date: 'Mar 2019', anchor: 'java-12', tags: ['lang', 'jvm'], headline: 'First switch expression preview; Shenandoah arrives (experimental).', bullets: ['Switch expressions (preview)', 'Shenandoah GC (experimental)', 'Collectors.teeing'] },
  { v: '13', date: 'Sep 2019', anchor: 'java-13', tags: ['lang', 'jvm'], headline: 'Text blocks preview, ZGC returns memory to the OS.', bullets: ['Text blocks (preview)', 'ZGC uncommits memory', 'New Socket implementation'] },
  { v: '14', date: 'Mar 2020', anchor: 'java-14', tags: ['lang', 'jvm', 'rm'], headline: 'Switch expressions final, records preview, helpful NullPointerExceptions; CMS removed.', bullets: ['Switch expressions final', 'Records, instanceof patterns (preview)', 'CMS collector removed'] },
  { v: '15', date: 'Sep 2020', anchor: 'java-15', tags: ['lang', 'jvm', 'rm'], headline: 'Text blocks final, ZGC and Shenandoah production-ready, sealed classes preview.', bullets: ['Text blocks final', 'ZGC, Shenandoah production', 'Nashorn removed'] },
  { v: '16', date: 'Mar 2021', anchor: 'java-16', tags: ['lang', 'api', 'sec'], headline: 'Records and instanceof patterns final; JDK internals strongly encapsulated.', bullets: ['Records final', 'Pattern matching for instanceof', 'Strong encapsulation, Stream.toList()'] },
  { v: '17', date: 'Sep 2021', lts: true, anchor: 'java-17', tags: ['lang', 'sec', 'rm'], headline: 'Sealed classes final, strong encapsulation enforced; Security Manager deprecated.', bullets: ['Sealed classes final', 'Illegal reflective access gone', 'Security Manager deprecated for removal'] },
  { v: '18', date: 'Mar 2022', anchor: 'java-18', tags: ['api', 'jvm'], headline: 'UTF-8 by default, a simple web server.', bullets: ['UTF-8 default charset', 'jwebserver', 'Finalization deprecated for removal'] },
  { v: '19', date: 'Sep 2022', anchor: 'java-19', tags: ['conc', 'lang'], headline: 'Virtual threads and record patterns arrive as previews.', bullets: ['Virtual threads (preview)', 'Record patterns (preview)', 'Structured concurrency (incubator)'] },
  { v: '20', date: 'Mar 2023', anchor: 'java-20', tags: ['conc', 'lang'], headline: 'Refinement release: scoped values incubate, previews iterate.', bullets: ['Scoped values (incubator)', 'Second previews of the Java 19 features'] },
  { v: '21', date: 'Sep 2023', lts: true, anchor: 'java-21', tags: ['lang', 'conc', 'jvm', 'api'], headline: 'Virtual threads, pattern matching for switch and record patterns final; generational ZGC.', bullets: ['Virtual threads final', 'Pattern switch + record patterns final', 'Sequenced collections, generational ZGC'] },
  { v: '22', date: 'Mar 2024', anchor: 'java-22', tags: ['lang', 'api', 'jvm'], headline: 'Unnamed variables and the Foreign Function & Memory API go final.', bullets: ['Unnamed variables and patterns', 'FFM API final', 'Multi-file source launch'] },
  { v: '23', date: 'Sep 2024', anchor: 'java-23', tags: ['jvm', 'api', 'sec'], headline: 'Generational ZGC by default, Markdown in Javadoc.', bullets: ['Generational ZGC is the default', 'Markdown doc comments', 'Unsafe memory access deprecated for removal'] },
  { v: '24', date: 'Mar 2025', anchor: 'java-24', tags: ['api', 'jvm', 'sec', 'conc'], headline: 'Stream Gatherers, Class-File API, post-quantum crypto; Security Manager disabled.', bullets: ['Stream Gatherers final', 'Virtual threads without pinning', 'ML-KEM / ML-DSA, Security Manager gone'] },
  { v: '25', date: 'Sep 2025', lts: true, anchor: 'java-25', tags: ['lang', 'jvm', 'conc'], headline: 'LTS: scoped values, compact source files, flexible constructors, compact object headers.', bullets: ['Scoped values final', 'Compact source files, flexible constructor bodies', 'Compact object headers, generational Shenandoah'] },
  { v: '26', date: 'Mar 2026', anchor: 'java-26', tags: ['api', 'jvm', 'rm'], headline: 'HTTP/3 in the HTTP client, final means final; Applet API removed.', bullets: ['HTTP/3 for HttpClient', 'Warnings for mutating final fields', 'Applet API removed'] },
  { v: '27', date: 'Sep 2026', anchor: 'java-27', tags: ['jvm', 'sec'], headline: 'G1 becomes the default collector everywhere; compact object headers on by default.', bullets: ['G1 default in all environments', 'Hybrid post-quantum TLS 1.3 key exchange', 'Compact object headers by default'] },
];
