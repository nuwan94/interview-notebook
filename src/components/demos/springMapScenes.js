// Frame data for the "Spring at a glance" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_MAP_SCENES = [
  {
    id: 'request',
    label: 'One request, every layer',
    title: 'A payment request touches most Spring modules on its way to the database',
    frames: [
      {
        note: 'The request arrives at the embedded server (Tomcat) that Spring Boot started for you. Spring MVC\'s DispatcherServlet is the single entry point: it finds the controller method for POST /payments, converts the JSON body to an object with a message converter and validates it.',
        boxes: [b('c', 'Client', ['POST /payments {json}'], 'new'), b('m', 'Spring MVC', ['DispatcherServlet', 'maps URL, binds JSON, validates'], 'ok', 'web layer'), b('t', 'Embedded Tomcat', ['started by Spring Boot'], 'ok')],
        deps: [d('Client', 'Embedded Tomcat', 'HTTP', 'ok'), d('Embedded Tomcat', 'Spring MVC', 'servlet', 'ok')],
      },
      {
        note: 'Before the controller runs, Spring Security\'s filter chain has already authenticated the caller and checked authorisation. The controller then calls a service bean. The container (Spring Core, the ApplicationContext) created that bean and injected its dependencies.',
        boxes: [b('s', 'Spring Security', ['filter chain: who are you, may you?'], 'ok', 'security'), b('m', 'Spring MVC', ['PaymentController'], 'ok'), b('i', 'Spring Core container', ['creates and injects beans'], 'new', 'IoC'), b('v', 'PaymentService bean', ['business logic'], 'ok')],
        deps: [d('Spring Security', 'Spring MVC', 'allowed', 'ok'), d('Spring MVC', 'PaymentService bean', 'calls', 'ok'), d('Spring Core container', 'PaymentService bean', 'injects', 'new')],
      },
      {
        note: 'The service method is annotated @Transactional. Spring AOP wraps the bean in a proxy that opens a transaction before the method and commits or rolls back after it. Logging, caching (@Cacheable) and security annotations work the same way: cross-cutting behaviour added around your code.',
        boxes: [b('p', 'Spring AOP proxy', ['begin transaction', 'commit or rollback'], 'new', 'proxy'), b('v', 'PaymentService bean', ['transfer(from, to, amount)'], 'ok'), b('x', 'Transaction manager', ['one transaction per request'], 'ok')],
        deps: [d('Spring AOP proxy', 'PaymentService bean', 'wraps', 'ok'), d('Spring AOP proxy', 'Transaction manager', 'begin / commit', 'ok')],
      },
      {
        note: 'The service calls a Spring Data repository, which is only an interface: Spring Data generates the implementation at start-up. It delegates to JPA, and Hibernate (the JPA provider) turns entity changes into SQL. JDBC and the connection pool send the SQL to the database.',
        boxes: [b('r', 'Spring Data repository', ['interface only', 'implementation generated'], 'new', 'data'), b('h', 'Hibernate (JPA)', ['entities to SQL'], 'ok'), b('j', 'JDBC and pool', ['HikariCP connections'], 'ok'), b('d', 'Database', ['rows'], 'ok')],
        deps: [d('Spring Data repository', 'Hibernate (JPA)', 'persist', 'ok'), d('Hibernate (JPA)', 'JDBC and pool', 'SQL', 'ok'), d('JDBC and pool', 'Database', 'query', 'ok')],
      },
      {
        note: 'On the way out, Spring MVC converts the result to JSON, or a @ControllerAdvice turns an exception into a proper error response. Actuator and Micrometer have meanwhile recorded the request duration and a trace id, so operations can see it.',
        boxes: [b('m', 'Spring MVC', ['JSON response or error body'], 'ok'), b('a', 'Actuator and Micrometer', ['metrics, health, traces'], 'ok', 'operations'), b('c', 'Client', ['201 Created'], 'new')],
        deps: [d('Spring MVC', 'Client', 'response', 'ok'), d('Spring MVC', 'Actuator and Micrometer', 'metrics', 'ok')],
      },
    ],
  },
  {
    id: 'container',
    label: 'The container and beans',
    title: 'Spring Core: you declare objects, Spring creates, wires and manages them',
    frames: [
      {
        note: 'You mark classes (@Component, @Service, @Repository) or declare them in @Configuration classes with @Bean methods. These are bean definitions: recipes, not objects yet.',
        boxes: [b('a', 'PaymentService', ['@Service'], 'new'), b('b', 'AccountRepository', ['@Repository'], 'new'), b('c', 'Configuration class', ['@Bean ClockProvider'], 'new')],
        deps: [],
      },
      {
        note: 'At start-up, the ApplicationContext scans for these definitions, creates the objects (beans), and injects each bean\'s dependencies, usually through the constructor. This is Inversion of Control: your classes do not create or look up their collaborators.',
        boxes: [b('x', 'ApplicationContext', ['scan, create, wire'], 'ok', 'IoC container'), b('a', 'PaymentService', ['needs AccountRepository'], 'ok'), b('b', 'AccountRepository', ['injected into the service'], 'ok')],
        deps: [d('ApplicationContext', 'PaymentService', 'creates', 'ok'), d('ApplicationContext', 'AccountRepository', 'creates', 'ok'), d('AccountRepository', 'PaymentService', 'injected', 'new')],
      },
      {
        note: 'Because the container owns the objects, it can add behaviour around them. BeanPostProcessors wrap beans in proxies (transactions, caching, security, async), and the container runs lifecycle callbacks such as @PostConstruct and @PreDestroy. Tests can swap a real bean for a mock the same way.',
        boxes: [b('p', 'BeanPostProcessor', ['wraps selected beans in proxies'], 'new'), b('a', 'PaymentService proxy', ['@Transactional added'], 'ok', 'proxy'), b('l', 'Lifecycle callbacks', ['@PostConstruct, @PreDestroy'], 'ok')],
        deps: [d('BeanPostProcessor', 'PaymentService proxy', 'creates', 'new')],
      },
    ],
  },
  {
    id: 'projects',
    label: 'Framework, Boot, Data, Cloud',
    title: 'Spring is a family of projects built on one core',
    frames: [
      {
        note: 'Spring Framework is the foundation: the container (IoC and dependency injection), AOP, transactions, Spring MVC and WebFlux for the web, JDBC support, testing support and the events and caching abstractions. Everything else builds on it.',
        boxes: [b('f', 'Spring Framework', ['container, AOP, transactions', 'MVC, WebFlux, JDBC, testing'], 'ok', 'foundation')],
        deps: [],
      },
      {
        note: 'Spring Boot is not a new framework but a convenience layer: starters bring compatible dependencies, auto-configuration creates sensible beans from what is on the classpath, and it provides an embedded server, externalised configuration and Actuator. It removes setup, not features.',
        boxes: [b('f', 'Spring Framework', ['the foundation'], 'ok'), b('o', 'Spring Boot', ['starters, auto-configuration', 'embedded server, Actuator'], 'new', 'convenience')],
        deps: [d('Spring Boot', 'Spring Framework', 'configures', 'ok')],
      },
      {
        note: 'Other projects add a capability on top. Spring Data gives repository access to databases (JPA, MongoDB, Redis). Spring Security protects the application. Spring Batch runs large jobs. Spring Integration and Spring Kafka and AMQP handle messaging.',
        boxes: [b('o', 'Spring Boot', ['wires them in'], 'new'), b('d', 'Spring Data', ['repositories for JPA, MongoDB, Redis'], 'ok'), b('s', 'Spring Security', ['authentication, authorisation'], 'ok'), b('b', 'Spring Batch', ['chunked jobs, restart'], 'ok'), b('m', 'Spring Kafka and AMQP', ['messaging'], 'ok')],
        deps: [d('Spring Boot', 'Spring Data', 'auto-configures', 'ok'), d('Spring Boot', 'Spring Security', 'auto-configures', 'ok'), d('Spring Boot', 'Spring Batch', 'auto-configures', 'ok'), d('Spring Boot', 'Spring Kafka and AMQP', 'auto-configures', 'ok')],
      },
      {
        note: 'Spring Cloud addresses problems that appear when you have many services: an API gateway, service discovery, central configuration, client-side load balancing and resilience (circuit breakers with Resilience4j). It is only needed once you run a distributed system, and many of its pieces are now provided by Kubernetes.',
        boxes: [b('c', 'Spring Cloud', ['for many services'], 'new', 'distributed'), b('g', 'Spring Cloud Gateway', ['one entry point'], 'ok'), b('n', 'Config server', ['central configuration'], 'ok'), b('r', 'Resilience4j', ['circuit breaker, retry, rate limit'], 'ok')],
        deps: [d('Spring Cloud', 'Spring Cloud Gateway', 'includes', 'ok'), d('Spring Cloud', 'Config server', 'includes', 'ok'), d('Spring Cloud', 'Resilience4j', 'integrates', 'ok')],
      },
    ],
  },
];
