// Frame data for the Spring Boot walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_BOOT_SCENES = [
  {
    id: 'startup',
    label: 'Startup',
    title: 'What happens inside SpringApplication.run()',
    frames: [
      {
        note: 'main() calls SpringApplication.run(). Boot works out the application type (servlet web, reactive or none), prepares the environment (properties, profiles, environment variables) and creates the application context.',
        boxes: [b('e', 'Config: environment', ['application.properties', 'profiles, env variables, arguments'], 'new', 'prepared'), b('c', 'Application context', ['created for a servlet web app'], 'new')],
        deps: [d('Config: environment', 'Application context', 'feeds', 'ok')],
      },
      {
        note: 'Component scanning starts from the package of the @SpringBootApplication class and registers your @Component, @Service and @Configuration classes as bean definitions.',
        boxes: [b('c', 'Application context', ['@ComponentScan from the main package'], 'ok'), b('u', 'Service bean', ['your TransferService, AccountController ...'], 'new', 'your beans')],
        deps: [d('Application context', 'Service bean', 'registers', 'ok')],
      },
      {
        note: 'Because of @EnableAutoConfiguration, Boot reads the list of auto-configuration classes shipped in the starters on the classpath (META-INF/spring/...AutoConfiguration.imports). Each one is a candidate, not a certainty.',
        boxes: [b('a', 'Auto-configuration', ['DataSourceAutoConfiguration', 'WebMvcAutoConfiguration', 'JacksonAutoConfiguration ...'], 'new', 'candidates'), b('c', 'Application context', ['evaluates each candidate'], 'ok')],
        deps: [d('Application context', 'Auto-configuration', 'load candidates', 'ok')],
      },
      {
        note: 'Each auto-configuration class is guarded by conditions (@ConditionalOnClass, @ConditionalOnMissingBean, @ConditionalOnProperty). Only those whose conditions pass register beans, and they back off wherever you defined your own.',
        boxes: [b('a', 'Auto-configuration', ['conditions pass: create DataSource, ObjectMapper', 'conditions fail: skipped'], 'ok', 'matched'), b('c', 'Application context', ['beans registered'], 'ok')],
        deps: [d('Auto-configuration', 'Application context', 'register beans', 'ok')],
      },
      {
        note: 'The context refreshes: singletons are created and wired, then the embedded web server (Tomcat by default) is created and started on the configured port. The application runs from a plain main(), with no external server installed.',
        boxes: [b('c', 'Application context', ['all singletons ready'], 'ok'), b('s', 'Embedded server', ['Tomcat started on port 8080'], 'ok', 'listening')],
        deps: [d('Application context', 'Embedded server', 'start', 'ok')],
      },
      {
        note: 'Finally CommandLineRunner and ApplicationRunner beans execute, and an ApplicationReadyEvent is published. Readiness probes can now report that the application is ready for traffic.',
        boxes: [b('r', 'Runner bean', ['CommandLineRunner: warm up, seed data'], 'ok'), b('c', 'Application context', ['ApplicationReadyEvent'], 'ok', 'ready')],
        deps: [d('Application context', 'Runner bean', 'run', 'ok')],
      },
    ],
  },
  {
    id: 'backoff',
    label: 'Auto-configuration',
    title: 'Auto-configuration provides sensible defaults and backs off when you define your own',
    frames: [
      {
        note: 'The classpath has spring-boot-starter-data-jpa and the PostgreSQL driver, and spring.datasource.url is set. DataSourceAutoConfiguration asks: is a DataSource class available (yes), is there a DataSource bean already (no)?',
        boxes: [b('a', 'Auto-configuration', ['DataSourceAutoConfiguration', '@ConditionalOnClass(DataSource)', '@ConditionalOnMissingBean(DataSource)'], 'new'), b('c', 'Application context', ['no DataSource bean defined'], 'none')],
        deps: [d('Auto-configuration', 'Application context', 'evaluate conditions', 'ok')],
      },
      {
        note: 'Both conditions pass, so Boot creates a pooled DataSource (HikariCP) from the spring.datasource.* properties. You wrote no configuration, yet a working connection pool is now a bean.',
        boxes: [b('a', 'Auto-configuration', ['conditions pass'], 'ok'), b('d', 'DataSource bean', ['HikariCP pool', 'url, username from properties'], 'ok', 'auto-configured')],
        deps: [d('Auto-configuration', 'DataSource bean', 'creates', 'ok')],
      },
      {
        note: 'Now you define your own DataSource @Bean, for example to use a different pool or read credentials from a vault. The condition @ConditionalOnMissingBean now fails, so the auto-configured one is not created. Your configuration wins.',
        boxes: [b('u', 'Config bean', ['@Bean DataSource myDataSource()'], 'new', 'yours'), b('a', 'Auto-configuration', ['@ConditionalOnMissingBean fails'], 'warn', 'backs off'), b('d', 'DataSource bean', ['only yours exists'], 'ok')],
        deps: [d('Config bean', 'DataSource bean', 'creates', 'ok'), d('Auto-configuration', 'DataSource bean', 'skipped', 'warn')],
      },
      {
        note: 'To see what matched and why, start with --debug (or set debug=true) for the conditions report, or inspect the Actuator conditions endpoint. To switch an auto-configuration off entirely, use @SpringBootApplication(exclude = ...) or spring.autoconfigure.exclude.',
        boxes: [b('r', 'Config: report', ['Positive matches: DataSourceAutoConfiguration', 'Negative matches: MongoAutoConfiguration (class not found)'], 'ok', '--debug'), b('a', 'Auto-configuration', ['excluded on request'], 'warn')],
        deps: [],
      },
    ],
  },
  {
    id: 'precedence',
    label: 'Property precedence',
    title: 'The same property from several sources: the higher source wins',
    frames: [
      {
        note: 'Property bank.fee-rate is defined in application.properties as 0.01. With nothing else set, that is the value the application sees.',
        boxes: [b('a', 'Config: application.properties', ['bank.fee-rate=0.01'], 'ok', 'wins'), b('r', 'Service bean', ['feeRate = 0.01'], 'ok')],
        deps: [d('Config: application.properties', 'Service bean', 'binds', 'ok')],
      },
      {
        note: 'With the prod profile active, application-prod.properties is loaded on top and overrides the same key. Profile-specific files beat the default file.',
        boxes: [b('a', 'Config: application.properties', ['bank.fee-rate=0.01'], 'warn', 'overridden'), b('p', 'Config: application-prod.properties', ['bank.fee-rate=0.02'], 'ok', 'wins'), b('r', 'Service bean', ['feeRate = 0.02'], 'ok')],
        deps: [d('Config: application-prod.properties', 'Service bean', 'binds', 'ok')],
      },
      {
        note: 'An OS environment variable BANK_FEE_RATE=0.03 (relaxed binding maps it to bank.fee-rate) beats both files. This is how containers and Kubernetes override configuration without rebuilding the image.',
        boxes: [b('p', 'Config: application-prod.properties', ['bank.fee-rate=0.02'], 'warn', 'overridden'), b('e', 'Config: environment variable', ['BANK_FEE_RATE=0.03'], 'ok', 'wins'), b('r', 'Service bean', ['feeRate = 0.03'], 'ok')],
        deps: [d('Config: environment variable', 'Service bean', 'binds', 'ok')],
      },
      {
        note: 'A command-line argument --bank.fee-rate=0.04 beats everything above. The order, lowest to highest: defaults, application.properties, profile files, environment variables, command-line arguments. Never put secrets in the files you commit; supply them through environment variables or a secret store.',
        boxes: [b('e', 'Config: environment variable', ['BANK_FEE_RATE=0.03'], 'warn', 'overridden'), b('c', 'Config: command line', ['--bank.fee-rate=0.04'], 'ok', 'wins'), b('r', 'Service bean', ['feeRate = 0.04'], 'ok')],
        deps: [d('Config: command line', 'Service bean', 'binds', 'ok')],
      },
    ],
  },
];
