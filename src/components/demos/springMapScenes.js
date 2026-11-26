// Frame data for the "Spring at a glance" walk-through, drawn by SpringMapStage.

import { SpringMapStage } from './SpringMapStage.jsx';

const LAYERS = [
  { id: 'client', name: 'Client', detail: 'POST /payments', project: '' },
  { id: 'tomcat', name: 'Embedded Tomcat', detail: 'receives HTTP', project: 'Spring Boot' },
  { id: 'security', name: 'Security filter chain', detail: 'who are you, may you?', project: 'Spring Security' },
  { id: 'dispatcher', name: 'DispatcherServlet', detail: 'finds the method', project: 'Spring MVC' },
  { id: 'controller', name: 'PaymentController', detail: 'JSON in, validated', project: 'Spring MVC' },
  { id: 'proxy', name: 'Transaction proxy', detail: 'begin / commit', project: 'Spring AOP' },
  { id: 'service', name: 'PaymentService', detail: 'business logic', project: 'Spring Core' },
  { id: 'repo', name: 'AccountRepository', detail: 'interface only', project: 'Spring Data JPA' },
  { id: 'hibernate', name: 'Hibernate', detail: 'entities to SQL', project: 'JPA provider' },
  { id: 'jdbc', name: 'JDBC + HikariCP', detail: 'pooled connection', project: 'Spring Framework' },
  { id: 'db', name: 'Database', detail: 'rows', project: '' },
];

const req = (frame) => ({ kind: 'request', layers: LAYERS, dir: 'down', ...frame });

export const SPRING_MAP_SCENES = [
  {
    id: 'request',
    label: 'One request, every layer',
    title: 'A payment request passes through most Spring projects on its way to the database',
    stage: SpringMapStage,
    frames: [
      req({
        line: 'POST /payments  {"from":"ACC-1","to":"ACC-2","amount":250}',
        active: ['client', 'tomcat'],
        note: 'The request arrives at the embedded Tomcat server. Spring Boot started this server for you inside the jar, so no separate server was installed.',
      }),
      req({
        line: 'Security filter chain',
        active: ['security'],
        done: ['client', 'tomcat'],
        note: 'Before any controller runs, the Spring Security filters check who the caller is and whether they may make a payment. A request that fails here never reaches your code.',
      }),
      req({
        line: '@PostMapping("/payments")',
        active: ['dispatcher', 'controller'],
        done: ['client', 'tomcat', 'security'],
        note: 'The DispatcherServlet is the single entry point of Spring MVC. It finds the controller method for POST /payments, turns the JSON body into a Java object and validates it.',
      }),
      req({
        line: '@Transactional transfer(from, to, amount)',
        active: ['proxy', 'service'],
        done: ['client', 'tomcat', 'security', 'dispatcher', 'controller'],
        note: 'The controller calls the service. It actually calls a proxy that Spring AOP put around the service. The proxy starts a transaction, then calls the real PaymentService. The container created this service and passed in its repository.',
      }),
      req({
        line: 'INSERT INTO payment ...',
        active: ['repo', 'hibernate', 'jdbc', 'db'],
        done: ['client', 'tomcat', 'security', 'dispatcher', 'controller', 'proxy', 'service'],
        note: 'The repository is only an interface. Spring Data generated its implementation at start-up. It hands the entity to Hibernate, which writes the SQL. The SQL goes to the database over a connection taken from the HikariCP pool.',
      }),
      req({
        line: 'HTTP/1.1 201 Created',
        dir: 'up',
        ops: true,
        active: ['proxy', 'controller', 'client'],
        done: ['tomcat', 'security', 'dispatcher', 'service', 'repo', 'hibernate', 'jdbc', 'db'],
        result: { text: '201 Created', tone: 'ok' },
        note: 'On the way back, the proxy commits the transaction and Spring MVC turns the result into JSON. If something had failed, a @ControllerAdvice would turn the exception into an error response. Actuator and Micrometer record how long the request took and its trace ID.',
      }),
    ],
  },
  {
    id: 'container',
    label: 'The container and beans',
    title: 'Spring Core: you write the recipes, and the container creates, connects and wraps the objects',
    stage: SpringMapStage,
    frames: [
      {
        kind: 'container',
        step: 1,
        line: '@Service class PaymentService { ... }',
        note: 'You mark classes with @Service or @Repository, or write a @Bean method in a @Configuration class. These are bean definitions. They are recipes, not objects yet.',
      },
      {
        kind: 'container',
        step: 2,
        line: 'SpringApplication.run(App.class)',
        note: 'When the app starts, the ApplicationContext (the container) scans your packages and reads every recipe.',
      },
      {
        kind: 'container',
        step: 3,
        line: 'new PaymentService(...)',
        note: 'The container creates one object for each recipe. These objects are the beans. By default there is exactly one of each, which is called a singleton.',
      },
      {
        kind: 'container',
        step: 4,
        line: 'PaymentService(AccountRepository repo, Clock clock)',
        result: { text: 'constructor injection', tone: 'new' },
        note: 'PaymentService asks for a repository and a clock in its constructor. The container passes in the beans it already made. This is inversion of control: the service never creates or looks up its own collaborators.',
      },
      {
        kind: 'container',
        step: 5,
        line: '@Transactional public void transfer(...)',
        result: { text: 'callers get the proxy', tone: 'warn' },
        note: 'Because the container owns the objects, it can wrap them. Here it puts a proxy around PaymentService to add transactions. Other beans receive the proxy, not the bare object. Caching, security annotations and @Async work the same way.',
      },
    ],
  },
  {
    id: 'projects',
    label: 'Framework, Boot, Data, Cloud',
    title: 'Spring is a family of projects built on one core',
    stage: SpringMapStage,
    frames: [
      {
        kind: 'projects',
        show: ['framework'],
        focus: ['framework'],
        line: 'spring-core, spring-context, spring-webmvc',
        note: 'Spring Framework is the foundation. It holds the container, AOP, transactions, MVC and WebFlux for the web, JDBC support and testing support. Every other project is built on it.',
      },
      {
        kind: 'projects',
        show: ['framework', 'boot'],
        focus: ['boot'],
        line: 'spring-boot-starter-web',
        note: 'Spring Boot is not a new framework. It is a convenience layer: starters bring matching libraries, auto-configuration creates sensible beans, and you get an embedded server and Actuator. It removes setup, not features.',
      },
      {
        kind: 'projects',
        show: ['framework', 'boot', 'data', 'security', 'batch', 'messaging'],
        focus: ['data', 'security', 'batch', 'messaging'],
        line: 'spring-boot-starter-data-jpa, -security, -batch',
        note: 'Other projects each add one ability on top. Spring Data gives repositories for databases, Spring Security protects the app, Spring Batch runs large jobs, and Spring Kafka and AMQP handle messaging. Boot sets each one up when you add its starter.',
      },
      {
        kind: 'projects',
        show: ['framework', 'boot', 'data', 'security', 'batch', 'messaging', 'cloud'],
        focus: ['cloud'],
        line: 'spring-cloud-starter-gateway',
        note: 'Spring Cloud solves problems that appear only with many services: a gateway, central configuration, service discovery and resilience with Resilience4j. You need it only for a distributed system, and Kubernetes now provides several of its parts.',
      },
    ],
  },
];
