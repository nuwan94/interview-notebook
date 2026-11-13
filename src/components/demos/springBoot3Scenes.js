// Frame data for the Spring Boot 3 and Spring 6 changes walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_BOOT3_SCENES = [
  {
    id: 'migrate',
    label: 'Migrating to Boot 3',
    title: 'The usual path from Spring Boot 2.7 to 3.x',
    frames: [
      {
        note: 'Start from the latest 2.7.x so deprecations are visible, and make sure the build runs on Java 17 or later (Boot 3 requires it). Boot 3 is built on Spring Framework 6.',
        boxes: [b('a', 'Config: build', ['Boot 2.7.18', 'Java 11 or 17'], 'warn', 'before'), b('t', 'Config: target', ['Boot 3.x', 'Java 17 minimum, 21 recommended'], 'new', 'after')],
        deps: [d('Config: build', 'Config: target', 'upgrade JDK first', 'ok')],
      },
      {
        note: 'The big breaking change is Jakarta EE 9+: every javax.* package for servlet, persistence, validation and annotations became jakarta.*. Imports in your code and in libraries change (javax.persistence.Entity becomes jakarta.persistence.Entity). Tools such as OpenRewrite automate most of it.',
        boxes: [b('a', 'Config: imports', ['javax.persistence.Entity', 'javax.validation.Valid', 'javax.servlet.Filter'], 'warn', 'old'), b('t', 'Config: imports updated', ['jakarta.persistence.Entity', 'jakarta.validation.Valid', 'jakarta.servlet.Filter'], 'ok', 'new')],
        deps: [d('Config: imports', 'Config: imports updated', 'rename packages', 'ok')],
      },
      {
        note: 'Dependencies must be Jakarta-compatible: Hibernate 6, Spring Security 6, Flyway, Jackson and your own libraries. Spring Security 6 removed WebSecurityConfigurerAdapter, so you declare a SecurityFilterChain bean with the lambda DSL. Property names and some defaults also changed; the properties migrator helps find them.',
        boxes: [b('s', 'Config: security', ['WebSecurityConfigurerAdapter removed', 'declare a SecurityFilterChain bean'], 'warn'), b('p', 'Config: properties', ['spring-boot-properties-migrator reports renamed keys'], 'ok')],
        deps: [],
      },
      {
        note: 'Then take advantage of what is new: ProblemDetail for errors, declarative @HttpExchange clients and RestClient, the Observation API for metrics and tracing, virtual threads on Java 21, and optional native images with GraalVM through Spring AOT. Upgrade in small steps and run the test suite after each.',
        boxes: [b('n', 'Config: new features', ['ProblemDetail, RestClient, Observation API', 'virtual threads, AOT and native image'], 'ok', 'adopt')],
        deps: [],
      },
    ],
  },
  {
    id: 'observation',
    label: 'Observation API',
    title: 'One instrumentation point produces metrics, traces and logs',
    frames: [
      {
        note: 'Before Boot 3 you instrumented code three times: a timer for metrics, a span for tracing and log statements. They drifted apart and each needed its own library calls.',
        boxes: [b('a', 'Config: before', ['Timer.record(...)', 'tracer.nextSpan(...)', 'log.info(...)'], 'warn', 'three APIs')],
        deps: [],
      },
      {
        note: 'Spring Framework 6 introduces the Observation API (from Micrometer). You write one observation around an operation, or simply annotate it with @Observed, and register handlers that decide what to do with it.',
        boxes: [b('o', 'Observation', ['observation: transfer.execute', 'low-cardinality tag: type=domestic'], 'new', 'instrument once'), b('s', 'Transfer service', ['@Observed(name = "transfer.execute")'], 'ok')],
        deps: [d('Transfer service', 'Observation', 'start and stop', 'ok')],
      },
      {
        note: 'Handlers turn the same observation into a timer metric (for Prometheus), a tracing span (for Zipkin or Tempo through OpenTelemetry) and correlated log context. Spring MVC, WebClient, RestClient, JDBC and messaging are already instrumented this way in Boot 3.',
        boxes: [b('o', 'Observation', ['transfer.execute'], 'ok'), b('m', 'Metrics endpoint', ['timer and counter'], 'ok'), b('x', 'Trace backend', ['span with timings'], 'ok')],
        deps: [d('Observation', 'Metrics endpoint', 'metric handler', 'ok'), d('Observation', 'Trace backend', 'tracing handler', 'ok')],
      },
    ],
  },
  {
    id: 'native',
    label: 'AOT and native image',
    title: 'Ahead-of-time processing trades build time and flexibility for fast startup and low memory',
    frames: [
      {
        note: 'On the JVM, Spring does a lot of work at startup: scanning the classpath, reading annotations, evaluating auto-configuration conditions, creating proxies by reflection. That is why a typical service starts in several seconds.',
        boxes: [b('j', 'Application context', ['scans and reflects at startup', 'JVM warm-up'], 'warn', 'seconds to start')],
        deps: [],
      },
      {
        note: 'Spring AOT moves that work to build time. It evaluates conditions and generates plain Java source for the bean definitions plus hints about which reflection and resources are needed. Nothing is discovered at runtime any more.',
        boxes: [b('a', 'Config: AOT build step', ['generates bean definition code', 'reflection and proxy hints'], 'new', 'build time'), b('j', 'Application context', ['fixed at build time'], 'ok')],
        deps: [d('Config: AOT build step', 'Application context', 'generated code', 'ok')],
      },
      {
        note: 'GraalVM native-image compiles the application and those hints into a native executable: start in tens of milliseconds, a fraction of the memory, ideal for serverless and scale-to-zero.',
        boxes: [b('n', 'Native executable', ['starts in about 50 ms', 'low memory'], 'ok', 'fast'), b('j', 'Application context', ['no JVM warm-up'], 'ok')],
        deps: [],
      },
      {
        note: 'The costs: much longer builds, a closed-world assumption (dynamic proxies, reflection, classpath scanning and runtime conditions must be known at build time), fewer compatible libraries, harder debugging and lower peak throughput than a warmed-up JIT. Many teams keep the JVM, and use CRaC or virtual threads and tuned startup instead.',
        boxes: [b('n', 'Native executable', ['slow build', 'reflection needs hints', 'peak speed lower than JIT'], 'warn', 'trade-offs')],
        deps: [],
      },
    ],
  },
];
