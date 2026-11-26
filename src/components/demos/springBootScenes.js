// Frame data for the Spring Boot walk-through, drawn by BoardStage (hand-placed cards and arrows).

import { BoardStage } from './BoardStage.jsx';

/* ---------- startup ---------- */
const RUN_STEPS = ['environment', 'scan', 'candidates', 'conditions', 'server', 'ready'];
const ctx = { x: 204, y: 8, w: 428, h: 248, title: 'ApplicationContext', tone: 'new' };
const main = (o = {}) => ({ id: 'main', x: 14, y: 44, w: 172, title: 'BankApplication', lines: ['main()', 'SpringApplication.run()'], tone: 'new', ...o });
const env = (o = {}) => ({ id: 'env', x: 14, y: 156, w: 172, title: 'Environment', lines: ['application.yml', 'profiles, env variables', 'command-line args'], tone: 'ok', ...o });
const beans = (o = {}) => ({ id: 'beans', x: 218, y: 52, w: 196, title: 'Your beans', lines: ['TransferService', 'AccountController'], tone: 'ok', ...o });
const autoCand = { id: 'auto', x: 426, y: 52, w: 196, title: 'Auto-configuration', lines: ['DataSourceAutoConfig', 'WebMvcAutoConfig', 'MongoAutoConfig', '... about 150 more'], tone: 'new', badge: 'candidates' };
const autoDone = { id: 'auto', x: 426, y: 52, w: 196, title: 'Auto-configuration', lines: ['DataSource: matched', 'WebMvc: matched', { t: 'Mongo: no driver', strike: true }, 'others: checked the same way'], tone: 'ok', badge: 'conditions' };
const server = { id: 'server', x: 426, y: 186, w: 196, title: 'Embedded Tomcat', lines: ['listening on :8080'], tone: 'ok', badge: 'started' };
const runner = { id: 'runner', x: 218, y: 186, w: 196, title: 'CommandLineRunner', lines: ['warm caches, seed data'], tone: 'ok' };

const startupFrames = [
  {
    h: 318,
    line: 'SpringApplication.run(BankApplication.class, args)',
    regions: [ctx],
    cards: [main(), env({ focus: true })],
    arrows: [{ from: 'main', to: 'env', label: 'prepare', fs: 'b', ts: 't' }],
    steps: { items: RUN_STEPS, at: 0 },
    note: 'main() calls SpringApplication.run(). Boot works out the app type (servlet web, reactive or none). It prepares the environment: properties files, profiles, environment variables and arguments. Then it creates an empty application context.',
  },
  {
    h: 318,
    line: '@ComponentScan  // from the package of BankApplication',
    regions: [ctx],
    cards: [main(), env(), beans({ tone: 'new' })],
    arrows: [{ from: 'main', to: 'beans', label: 'scan', fs: 'r', ts: 'l' }],
    steps: { items: RUN_STEPS, at: 1 },
    note: 'Component scanning starts from the package of the @SpringBootApplication class. It registers your @Component, @Service and @Configuration classes as bean definitions.',
  },
  {
    h: 318,
    line: '@EnableAutoConfiguration  // reads AutoConfiguration.imports',
    regions: [ctx],
    cards: [main({ dim: true }), env(), beans(), autoCand],
    arrows: [],
    steps: { items: RUN_STEPS, at: 2 },
    note: 'Boot reads the list of auto-configuration classes that ship inside the starters on your classpath. Each one is only a candidate. It has not been decided yet whether it will create anything.',
  },
  {
    h: 318,
    line: '@ConditionalOnClass  ·  @ConditionalOnMissingBean',
    regions: [ctx],
    cards: [main({ dim: true }), env(), beans(), autoDone],
    arrows: [],
    steps: { items: RUN_STEPS, at: 3 },
    note: 'Each candidate has conditions. DataSource and WebMvc pass, so they create a connection pool and the MVC setup. Mongo fails because no MongoDB driver is on the classpath, so it creates nothing. Candidates also step back wherever you defined your own bean.',
  },
  {
    h: 318,
    line: 'Tomcat started on port 8080 (http)',
    regions: [ctx],
    cards: [main({ dim: true }), env(), beans(), autoDone, server],
    arrows: [{ from: 'auto', to: 'server', label: 'start', fs: 'b', ts: 't' }],
    steps: { items: RUN_STEPS, at: 4 },
    note: 'The context refreshes: it creates and connects all singletons. Then it starts the embedded web server, Tomcat by default, on the configured port. No external server was installed.',
  },
  {
    h: 318,
    line: 'Started BankApplication in 2.1 seconds',
    result: { text: 'ApplicationReadyEvent', tone: 'ok' },
    regions: [ctx],
    cards: [main({ dim: true }), env(), beans(), autoDone, server, runner],
    arrows: [{ from: 'beans', to: 'runner', label: 'run', fs: 'b', ts: 't' }],
    steps: { items: RUN_STEPS, at: 5 },
    note: 'Last, the CommandLineRunner and ApplicationRunner beans run, and Boot publishes ApplicationReadyEvent. From now on the readiness probe reports that the app can take traffic.',
  },
];

/* ---------- auto-configuration steps back ---------- */
const cp = { id: 'cp', x: 14, y: 40, w: 172, title: 'Classpath', lines: ['starter-data-jpa', 'postgresql driver'], tone: 'ok' };
const props = { id: 'props', x: 14, y: 150, w: 172, title: 'Properties', lines: ['spring.datasource.url=...', 'spring.datasource.username=...'], tone: 'ok' };
const dsAuto = (o = {}) => ({ id: 'auto', x: 234, y: 82, w: 184, title: 'DataSourceAutoConfig', lines: ['@ConditionalOnClass(DataSource)', '@ConditionalOnMissingBean'], tone: 'new', ...o });

const backoffFrames = [
  {
    line: 'DataSourceAutoConfiguration',
    cards: [cp, props, dsAuto()],
    arrows: [
      { from: 'cp', to: 'auto', fs: 'r', ts: 'l', toff: -10 },
      { from: 'props', to: 'auto', fs: 'r', ts: 'l', toff: 12 },
    ],
    note: 'The classpath has the JPA starter and the PostgreSQL driver, and spring.datasource.url is set. DataSourceAutoConfiguration checks two conditions: is a DataSource class available, and is there no DataSource bean yet?',
  },
  {
    line: 'HikariDataSource created from spring.datasource.*',
    result: { text: 'both conditions pass', tone: 'ok' },
    cards: [cp, props, dsAuto({ tone: 'ok', lines: ['class found: yes', 'DataSource bean yet: none'] }), { id: 'ds', x: 470, y: 82, w: 156, title: 'dataSource', lines: ['HikariCP pool', 'made from properties'], tone: 'ok', badge: 'auto' }],
    arrows: [
      { from: 'cp', to: 'auto', fs: 'r', ts: 'l', toff: -10 },
      { from: 'props', to: 'auto', fs: 'r', ts: 'l', toff: 12 },
      { from: 'auto', to: 'ds', label: 'creates' },
    ],
    note: 'Both conditions pass, so Boot creates a pooled DataSource (HikariCP) from the spring.datasource properties. You wrote no configuration, yet a working connection pool is now a bean.',
  },
  {
    line: '@Bean DataSource myDataSource() { ... }',
    result: { text: 'auto-configuration steps back', tone: 'warn' },
    cards: [
      cp,
      props,
      dsAuto({ tone: 'warn', badge: 'skipped', lines: ['class found: yes', { t: 'DataSource bean yet: none', strike: true }] }),
      { id: 'mine', x: 234, y: 206, w: 184, title: 'AppConfig', lines: ['@Bean myDataSource()'], tone: 'new', badge: 'yours' },
      { id: 'ds', x: 470, y: 82, w: 156, title: 'myDataSource', lines: ['your bean', 'the only DataSource'], tone: 'ok' },
    ],
    arrows: [
      { from: 'cp', to: 'auto', fs: 'r', ts: 'l', toff: -10 },
      { from: 'auto', to: 'ds', tone: 'bad', dash: true, cross: true },
      { from: 'mine', to: 'ds', label: 'creates', fs: 'r', ts: 'b' },
    ],
    note: 'Now you define your own DataSource bean, for example to read the password from a vault. The @ConditionalOnMissingBean condition fails, so Boot does not create its own. Your configuration wins.',
  },
  {
    line: 'java -jar bank.jar --debug',
    cards: [
      { id: 'report', x: 40, y: 24, w: 560, title: 'Conditions report', mono: true, lines: ['Positive matches:', '   DataSourceAutoConfiguration: found DataSource, HikariDataSource', 'Negative matches:', '   MongoAutoConfiguration: class MongoClient not found'], tone: 'ok', badge: '--debug' },
      { id: 'exclude', x: 40, y: 172, w: 560, title: 'Turn one off completely', mono: true, lines: ['@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)', 'or: spring.autoconfigure.exclude=...'], tone: 'warn' },
    ],
    note: 'To see what matched and why, start with --debug for the conditions report, or open the Actuator conditions endpoint. To switch an auto-configuration off entirely, use exclude on @SpringBootApplication or the spring.autoconfigure.exclude property.',
  },
];

/* ---------- property precedence ---------- */
const SRC = [
  { id: 'cmd', y: 30, title: 'Command line', line: '--bank.fee-rate=0.04' },
  { id: 'envv', y: 96, title: 'Environment variable', line: 'BANK_FEE_RATE=0.03' },
  { id: 'prod', y: 162, title: 'application-prod.properties', line: 'bank.fee-rate=0.02' },
  { id: 'app', y: 228, title: 'application.properties', line: 'bank.fee-rate=0.01' },
];
const VALUE = { app: '0.01', prod: '0.02', envv: '0.03', cmd: '0.04' };

function precedenceFrame(present, note, line) {
  const winner = SRC.find((s) => present.includes(s.id)).id;
  return {
    h: 296,
    line,
    result: { text: `feeRate = ${VALUE[winner]}`, tone: 'ok' },
    texts: [{ x: 16, y: 20, t: 'higher in the list wins' }],
    cards: [
      ...SRC.map((s) =>
        present.includes(s.id)
          ? { id: s.id, x: 16, y: s.y, w: 300, title: s.title, lines: [{ t: s.line, mono: true }], tone: s.id === winner ? 'ok' : 'warn', badge: s.id === winner ? 'wins' : 'overridden' }
          : { id: s.id, x: 16, y: s.y, w: 300, title: `${s.title} (not set)`, ghost: true, h: 42 },
      ),
      { id: 'svc', x: 420, y: 126, w: 200, title: 'TransferService', lines: [`feeRate = ${VALUE[winner]}`], tone: 'new' },
    ],
    arrows: [{ from: winner, to: 'svc', label: 'binds', fs: 'r', ts: 'l' }],
    note,
  };
}

const precedenceFrames = [
  precedenceFrame(['app'], 'bank.fee-rate is set in application.properties to 0.01. Nothing else sets it, so that is the value the application sees.', 'bank.fee-rate=0.01'),
  precedenceFrame(['prod', 'app'], 'With the prod profile active, application-prod.properties is loaded on top and sets the same key to 0.02. A profile file beats the default file.', 'spring.profiles.active=prod'),
  precedenceFrame(['envv', 'prod', 'app'], 'The environment variable BANK_FEE_RATE=0.03 beats both files. Relaxed binding maps BANK_FEE_RATE to bank.fee-rate. This is how a container or Kubernetes changes settings without rebuilding the image.', 'export BANK_FEE_RATE=0.03'),
  precedenceFrame(['cmd', 'envv', 'prod', 'app'], 'A command-line argument beats everything above it. The full order, lowest to highest: defaults, application.properties, profile files, environment variables, system properties, command-line arguments. Never put secrets in committed files.', 'java -jar bank.jar --bank.fee-rate=0.04'),
];

export const SPRING_BOOT_SCENES = [
  { id: 'startup', label: 'Startup', title: 'What happens inside SpringApplication.run()', stage: BoardStage, frames: startupFrames },
  { id: 'backoff', label: 'Auto-configuration', title: 'Auto-configuration gives sensible defaults and steps back when you define your own', stage: BoardStage, frames: backoffFrames },
  { id: 'precedence', label: 'Property precedence', title: 'The same property from several sources: the higher source wins', stage: BoardStage, frames: precedenceFrames },
];
