// Frame data for the Spring Boot 3 and Spring 6 changes walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- migration path ---------- */
const MIG = ['2.7 + JDK 17', 'jakarta', 'security', 'properties', 'new features'];
const before = (title, lines, o = {}) => ({ id: 'before', x: 16, y: 40, w: 260, title, lines, mono: true, tone: 'warn', badge: 'before', ...o });
const after = (title, lines, o = {}) => ({ id: 'after', x: 364, y: 40, w: 260, title, lines, mono: true, tone: 'ok', badge: 'after', ...o });

const migrateFrames = [
  {
    h: 290,
    line: 'Boot 2.7.18  →  Boot 3.x',
    cards: [before('build', ['Spring Boot 2.7.18', 'Java 11']), after('build', ['Spring Boot 3.x', 'Java 17 (21 recommended)'])],
    arrows: [{ from: 'before', to: 'after', label: 'JDK first' }],
    steps: { items: MIG, at: 0 },
    note: 'Start from the latest 2.7.x, so every deprecation warning is visible. Make sure the build runs on Java 17 or later, because Boot 3 requires it. Boot 3 is built on Spring Framework 6.',
  },
  {
    h: 290,
    line: 'javax.*  →  jakarta.*',
    cards: [
      before('imports', [{ t: 'javax.persistence.Entity', strike: true }, { t: 'javax.validation.Valid', strike: true }, { t: 'javax.servlet.Filter', strike: true }]),
      after('imports', ['jakarta.persistence.Entity', 'jakarta.validation.Valid', 'jakarta.servlet.Filter']),
    ],
    arrows: [{ from: 'before', to: 'after', label: 'OpenRewrite' }],
    steps: { items: MIG, at: 1 },
    note: 'The biggest breaking change is Jakarta EE 9+. Every javax package for servlets, persistence, validation and annotations became jakarta. This changes imports in your code and in your libraries. OpenRewrite does most of the renaming for you.',
  },
  {
    h: 290,
    line: 'WebSecurityConfigurerAdapter  →  SecurityFilterChain',
    cards: [
      before('security config', [{ t: 'extends WebSecurityConfigurerAdapter', strike: true }, { t: '.antMatchers("/public/**")', strike: true }, { t: '@EnableGlobalMethodSecurity', strike: true }]),
      after('security config', ['@Bean SecurityFilterChain', '.requestMatchers("/public/**")', '@EnableMethodSecurity']),
    ],
    arrows: [{ from: 'before', to: 'after', label: 'rewrite' }],
    steps: { items: MIG, at: 2 },
    note: 'Every dependency must support Jakarta: Hibernate 6, Spring Security 6, Flyway, Jackson and your own libraries. Spring Security 6 removed WebSecurityConfigurerAdapter, so you declare a SecurityFilterChain bean instead.',
  },
  {
    h: 290,
    line: 'spring-boot-properties-migrator',
    cards: [
      before('application.yml', [{ t: 'spring.redis.host', strike: true }, { t: 'spring.redis.port', strike: true }]),
      after('application.yml', ['spring.data.redis.host', 'spring.data.redis.port']),
    ],
    arrows: [{ from: 'before', to: 'after', label: 'renamed' }],
    steps: { items: MIG, at: 3 },
    note: 'Some property names and defaults changed too. Add spring-boot-properties-migrator for a while: it reports renamed keys at startup. Remove it once they are all fixed.',
  },
  {
    h: 290,
    line: 'adopt on purpose, one at a time',
    result: { text: 'migration done', tone: 'ok' },
    cards: [
      { id: 'n1', x: 16, y: 40, w: 196, title: 'ProblemDetail', lines: ['standard error bodies'], tone: 'ok' },
      { id: 'n2', x: 222, y: 40, w: 196, title: 'RestClient', lines: ['and @HttpExchange clients'], tone: 'ok' },
      { id: 'n3', x: 428, y: 40, w: 196, title: 'Observation API', lines: ['metrics and traces at once'], tone: 'ok' },
      { id: 'n4', x: 119, y: 120, w: 196, title: 'Virtual threads', lines: ['Java 21, one property'], tone: 'ok' },
      { id: 'n5', x: 325, y: 120, w: 196, title: 'AOT + native image', lines: ['fast start, optional'], tone: 'ok' },
    ],
    steps: { items: MIG, at: 4 },
    note: 'Then use what is new: ProblemDetail for errors, RestClient and @HttpExchange clients, the Observation API, virtual threads on Java 21, and optional native images through Spring AOT. Upgrade in small steps and run the tests after each one.',
  },
];

/* ---------- the Observation API ---------- */
const svc = (o = {}) => ({ id: 'svc', x: 16, y: 116, w: 176, title: 'TransferService', lines: ['transfer()'], tone: 'new', ...o });

const observationFrames = [
  {
    line: 'three separate APIs',
    result: { text: 'they drift apart', tone: 'warn' },
    cards: [
      svc(),
      { id: 't', x: 300, y: 30, w: 220, title: 'Timer.record(...)', lines: ['metrics library'], tone: 'warn' },
      { id: 's', x: 300, y: 116, w: 220, title: 'tracer.nextSpan(...)', lines: ['tracing library'], tone: 'warn' },
      { id: 'l', x: 300, y: 202, w: 220, title: 'log.info(...)', lines: ['logging'], tone: 'warn' },
    ],
    arrows: [
      { from: 'svc', to: 't', fs: 'r', ts: 'l', fo: -10 },
      { from: 'svc', to: 's', fs: 'r', ts: 'l' },
      { from: 'svc', to: 'l', fs: 'r', ts: 'l', fo: 10 },
    ],
    note: 'Before Boot 3 you instrumented the same code three times: a timer for metrics, a span for tracing, and log statements. Each used its own library, and over time they disagreed with each other.',
  },
  {
    line: '@Observed(name = "transfer.execute")',
    cards: [svc({ lines: ['@Observed', 'transfer()'] }), { id: 'obs', x: 300, y: 108, w: 200, title: 'Observation', lines: ['name: transfer.execute', 'tag: type=domestic'], tone: 'new', badge: 'instrument once' }],
    arrows: [{ from: 'svc', to: 'obs', label: 'start / stop' }],
    note: 'Spring Framework 6 brings the Observation API from Micrometer. You put one observation around an operation, or simply add @Observed, and attach tags. You write it once.',
  },
  {
    line: 'ObservationHandler  ×  3',
    result: { text: 'one source, three outputs', tone: 'ok' },
    cards: [
      svc({ lines: ['@Observed', 'transfer()'] }),
      { id: 'obs', x: 228, y: 108, w: 176, title: 'Observation', lines: ['transfer.execute'], tone: 'ok' },
      { id: 'm', x: 460, y: 24, w: 164, title: 'Prometheus', lines: ['timer metric'], tone: 'ok' },
      { id: 'tr', x: 460, y: 112, w: 164, title: 'Tempo / Zipkin', lines: ['tracing span'], tone: 'ok' },
      { id: 'lg', x: 460, y: 200, w: 164, title: 'Logs', lines: ['trace ID in every line'], tone: 'ok' },
    ],
    arrows: [
      { from: 'svc', to: 'obs' },
      { from: 'obs', to: 'm', fs: 'r', ts: 'l', fo: -10 },
      { from: 'obs', to: 'tr', fs: 'r', ts: 'l' },
      { from: 'obs', to: 'lg', fs: 'r', ts: 'l', fo: 10 },
    ],
    note: 'Handlers turn that one observation into a timer metric for Prometheus, a tracing span for Tempo or Zipkin through OpenTelemetry, and a trace ID in the logs. Spring MVC, WebClient, RestClient, JDBC and messaging are already instrumented this way.',
  },
];

/* ---------- AOT and native image ---------- */
const nativeFrames = [
  {
    h: 210,
    line: 'java -jar bank.jar',
    result: { text: 'about 2.5 s to start', tone: 'warn' },
    regions: [{ x: 16, y: 20, w: 608, h: 112, title: 'at startup, on the JVM', tone: 'warn' }],
    cards: [
      { id: 'a', x: 32, y: 66, w: 136, title: 'scan', lines: ['read the classpath'], tone: 'warn' },
      { id: 'b', x: 182, y: 66, w: 136, title: 'conditions', lines: ['auto-config checks'], tone: 'warn' },
      { id: 'c', x: 332, y: 66, w: 136, title: 'reflection', lines: ['read annotations'], tone: 'warn' },
      { id: 'd', x: 482, y: 66, w: 126, title: 'proxies', lines: ['generate classes'], tone: 'warn' },
    ],
    arrows: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }],
    note: 'On the JVM, Spring does a lot of work when it starts: it scans the classpath, reads annotations, checks auto-configuration conditions and creates proxies through reflection. That is why a typical service takes a few seconds to start.',
  },
  {
    h: 210,
    line: './mvnw -Pnative package   (Spring AOT)',
    regions: [{ x: 16, y: 20, w: 608, h: 128, title: 'at build time', tone: 'new' }],
    cards: [
      { id: 'a', x: 32, y: 66, w: 250, title: 'AOT processing', lines: ['runs the conditions now', 'decides every bean'], tone: 'new' },
      { id: 'b', x: 358, y: 66, w: 250, title: 'Generated output', lines: ['Java code for bean definitions', 'reflection and proxy hints'], tone: 'ok' },
    ],
    arrows: [{ from: 'a', to: 'b', label: 'writes' }],
    note: 'Spring AOT moves that work to build time. It runs the conditions and writes plain Java code for the bean definitions, plus hints about the reflection and resources the app needs. Nothing is discovered at run time any more.',
  },
  {
    h: 210,
    line: './bank   (native executable)',
    result: { text: 'about 0.05 s to start', tone: 'ok' },
    texts: [
      { x: 16, y: 24, t: 'startup time, same service' },
      { x: 96, y: 132, t: 'about 0.05 s, about 60 MB of memory' },
    ],
    cards: [
      { id: 'jvm', x: 16, y: 40, w: 520, title: 'JVM', lines: ['about 2.5 s, about 300 MB of memory'], tone: 'warn', h: 46 },
      { id: 'nat', x: 16, y: 104, w: 70, title: 'native', tone: 'ok', h: 46 },
    ],
    note: 'GraalVM native-image compiles the app and those hints into a native executable. It starts in tens of milliseconds and uses a fraction of the memory. That suits serverless and apps that scale to zero.',
  },
  {
    h: 210,
    line: 'what you give up',
    result: { text: 'trade-offs', tone: 'warn' },
    cards: [
      { id: 'g', x: 16, y: 30, w: 296, title: 'You gain', lines: ['start in about 50 ms', 'low memory', 'good for serverless'], tone: 'ok' },
      { id: 'c', x: 328, y: 30, w: 296, title: 'You pay', lines: ['much slower builds', 'reflection and proxies need hints', 'fewer compatible libraries', 'lower peak speed than the JIT'], tone: 'warn' },
    ],
    note: 'The costs: much longer builds, and everything must be known at build time, so reflection, dynamic proxies and run-time classpath scanning need hints. Fewer libraries work, debugging is harder, and peak speed is lower than a warmed-up JIT. Many teams keep the JVM and use CRaC or virtual threads instead.',
  },
];

export const SPRING_BOOT3_SCENES = [
  { id: 'migrate', label: 'Migrating to Boot 3', title: 'The usual path from Spring Boot 2.7 to 3.x', stage: BoardStage, frames: migrateFrames },
  { id: 'observation', label: 'Observation API', title: 'One instrumentation point produces metrics, traces and logs', stage: BoardStage, frames: observationFrames },
  { id: 'native', label: 'AOT and native image', title: 'Ahead-of-time processing trades build time for fast startup and low memory', stage: BoardStage, frames: nativeFrames },
];
