---
title: Spring at a glance — what each Spring term means and what it contributes
nav: Spring terms at a glance
slug: spring-terms
summary: Short notes on every major Spring term (IoC, beans, AOP, MVC, WebFlux, Data, JPA, Hibernate, Security, Boot, Cloud, Batch, Integration, Actuator and more): what it means in Spring and how it contributes to the framework, with a one-request walk-through and interview questions.
tags: [Spring, Overview, Glossary, Spring Boot, Spring Data, Spring MVC, JPA]
order: 44
topic: Spring / Fundamentals
updated: 2026-11-14
subnav: true
---

"Spring" is not one library but a family of projects, and interviews mix the names freely: *what is the difference between Spring, Spring Boot and Spring MVC, where does JPA stop and Spring Data start, and what does Hibernate have to do with it?* This page gives a short note for each term: **what it is** and **what it contributes**. Each row links to the full lesson. Play the walk-through first: it follows one payment request through the layers, then shows the container and how the projects fit together.

```demo
name: spring-map-walk
```

> **One sentence to remember:** *Spring Framework is the core (a container that creates and wires your objects, plus AOP, transactions and the web layer); Spring Boot configures it for you; Spring Data, Security, Batch, Cloud and the rest are optional projects built on that core.*

## The core container {#core}

| Term | What it means in Spring | What it contributes |
| --- | --- | --- |
| **Spring Framework** | the base project: container, AOP, transactions, MVC/WebFlux, JDBC, testing | the foundation every other Spring project builds on |
| **IoC** (inversion of control) | the framework, not your code, creates objects and decides when | loose coupling: classes declare what they need, not how to get it |
| **Dependency injection (DI)** | the way IoC is applied: collaborators are passed in, preferably by constructor | testable classes, swappable implementations |
| **Bean** | an object created and managed by the container | the unit Spring wires, proxies and manages |
| **ApplicationContext** | the container: reads bean definitions, creates beans, publishes events | the running "Spring" inside your application |
| **`@Component` / `@Service` / `@Repository` / `@Controller`** | stereotype annotations that mark a class as a bean found by scanning | auto-detection; `@Repository` also translates persistence exceptions |
| **`@Configuration` and `@Bean`** | Java configuration: methods that build beans explicitly | wiring for third-party classes and custom setup |
| **Scope** | the life of a bean: singleton (default), prototype, request, session | control over sharing and state |
| **Profile** | a named set of beans and properties (`dev`, `prod`) | environment-specific behaviour from one codebase |
| **`Environment` and `@Value`** | the access point for properties and profiles | externalised configuration |
| **SpEL** | Spring Expression Language, `#{...}` expressions | dynamic values in annotations, security rules and cache keys |
| **Application event** | a publish/subscribe mechanism inside one application | decoupled reactions to things that happened |

Details: [Spring Core](lesson:spring-core).

## Cross-cutting concerns {#cross-cutting}

| Term | What it means in Spring | What it contributes |
| --- | --- | --- |
| **AOP** (aspect-oriented programming) | adding behaviour around method calls without editing them | one place for transactions, security checks, logging, caching |
| **Proxy** | a generated wrapper object around a bean | the mechanism behind `@Transactional`, `@Cacheable`, `@Async`; explains the self-invocation trap |
| **Aspect, advice, pointcut** | the module, the code to run, and the rule for where it runs | how custom cross-cutting logic is written |
| **`@Transactional`** | declarative transaction boundary on a method | commit and rollback without boilerplate |
| **Transaction manager** | the component that begins, commits and rolls back a transaction for a resource (JDBC, JPA, JMS) | one programming model over many technologies |
| **`@Cacheable`, `@CacheEvict`** | cache abstraction annotations | caching with Caffeine or Redis without changing the method |
| **`@Async`, `@Scheduled`** | run a method on another thread, or on a timer | background work |
| **Bean Validation (`@Valid`)** | declarative constraints such as `@NotNull`, `@Size` | input checked before your code runs |

Details: [AOP](lesson:spring-aop), [transactions](lesson:spring-transactions), [caching and async](lesson:spring-caching-async).

## Web layer {#web}

| Term | What it means in Spring | What it contributes |
| --- | --- | --- |
| **Spring MVC** | the servlet-based web framework (one thread per request) | controllers, URL mapping, JSON binding, validation, error handling |
| **DispatcherServlet** | the front controller that receives every request and routes it | the single entry point of MVC |
| **`@RestController`** | a controller whose return values are written as the response body | the usual way to build a JSON API |
| **`@RequestMapping` and friends** | map URL and method to a handler | routing |
| **HttpMessageConverter** | converts between Java objects and JSON/XML | automatic request and response bodies (Jackson) |
| **`@ControllerAdvice`** | global exception handling and model advice | consistent error responses (`ProblemDetail`) |
| **Filter and interceptor** | code that runs around a request (servlet filter, MVC interceptor) | security, logging, correlation ids |
| **Spring WebFlux** | the non-blocking, reactive web stack on Reactor | high concurrency with few threads, streaming |
| **`WebClient` / `RestClient`** | HTTP clients (reactive, and a fluent blocking one) | calling other services |
| **Spring HATEOAS, Spring REST Docs, springdoc** | hypermedia links, test-driven docs, OpenAPI | API documentation and discoverability |
| **WebSocket and STOMP** | two-way connections and a messaging protocol on top | live updates, notifications |

Details: [Spring MVC](lesson:spring-mvc), [REST API design](lesson:rest-api-design), [reactive](lesson:spring-reactive).

## Data access {#data}

| Term | What it means in Spring | What it contributes |
| --- | --- | --- |
| **JDBC** | the Java API for SQL databases | the lowest layer everything else uses |
| **`JdbcTemplate`** | Spring's helper over JDBC | no connection and exception boilerplate; you keep writing SQL |
| **DataSource and connection pool (HikariCP)** | the source of reusable database connections | performance and limits on database load |
| **JPA** (Jakarta Persistence) | the standard API for mapping objects to tables (`@Entity`, `EntityManager`, JPQL) | an ORM specification, not an implementation |
| **Hibernate** | the most used JPA implementation (the provider) | the engine that generates SQL, tracks changes and caches |
| **Entity and persistence context** | a mapped class, and the set of entities a session is tracking | dirty checking: changes are saved at flush without calling `save` |
| **Spring Data** | the umbrella project for repository-style data access (JPA, JDBC, MongoDB, Redis, Cassandra, Elasticsearch, R2DBC) | one repository programming model across stores |
| **Spring Data JPA** | Spring Data on top of JPA/Hibernate | repository interfaces with generated implementations |
| **Repository interface** | `JpaRepository<Entity, Id>` | CRUD, paging and derived queries (`findByStatusOrderByCreatedAt`) with no code |
| **`@Query`, Specification, projection** | custom queries, dynamic filters, partial results | flexibility where derived queries stop |
| **Auditing** | `@CreatedDate`, `@LastModifiedBy` | automatic created/updated metadata |
| **Spring Data REST** | exposes repositories as REST endpoints | quick CRUD APIs (rarely used for banking services) |
| **R2DBC** | reactive database access | non-blocking SQL, used with WebFlux |
| **Flyway / Liquibase** | versioned database migrations | repeatable schema changes |

Relationship worth remembering: **Spring Data JPA → JPA (API) → Hibernate (implementation) → JDBC → database.** Details: [Spring Data JPA](lesson:spring-data-jpa), [normalisation](lesson:normalization), [SQL vs NoSQL](lesson:sql-vs-nosql).

## Spring Boot and operations {#boot}

| Term | What it means in Spring | What it contributes |
| --- | --- | --- |
| **Spring Boot** | an opinionated layer over the Framework | production-ready apps with minimal setup |
| **Starter** | a dependency (`spring-boot-starter-web`) that pulls a consistent set of libraries | no hunting for compatible versions |
| **Auto-configuration** | beans created automatically from the classpath and properties, backing off when you define your own | the "it just works" behaviour |
| **`@SpringBootApplication`** | combines `@Configuration`, `@EnableAutoConfiguration`, `@ComponentScan` | the single entry point annotation |
| **Embedded server** | Tomcat, Jetty or Undertow inside the jar | run with `java -jar`, no server install |
| **`application.yml` and `@ConfigurationProperties`** | externalised, typed configuration | the same build runs in every environment |
| **Actuator** | production endpoints: health, metrics, info | health probes and monitoring |
| **Micrometer** | a metrics facade (Prometheus, Datadog) and tracing bridge | vendor-neutral metrics and traces |
| **DevTools** | automatic restart and live reload | faster development loop |
| **Spring Initializr** | the project generator (start.spring.io) | a correct starting project |
| **Native image (GraalVM)** | ahead-of-time compiled executable | fast start-up and low memory |

Details: [Spring Boot](lesson:spring-boot), [Boot 3](lesson:spring-boot-3), [observability](lesson:spring-observability).

## Security {#security}

| Term | What it means in Spring | What it contributes |
| --- | --- | --- |
| **Spring Security** | the security framework: a chain of servlet filters | authentication, authorisation, CSRF, headers |
| **Authentication and authorisation** | who you are, and what you may do | access control on URLs and methods |
| **`SecurityFilterChain`** | the configuration bean that defines the rules | declarative security setup |
| **`@PreAuthorize`** | method-level rule using SpEL | fine-grained checks close to the business logic |
| **OAuth2 resource server / client** | validates bearer tokens (JWT), or obtains tokens | integration with an identity provider ([OAuth2](lesson:oauth2), [OIDC](lesson:oidc), [JWT](lesson:jwt)) |
| **Spring Authorization Server** | issues tokens | build your own identity provider |

Details: [Spring Security](lesson:spring-security), [authentication vs authorisation](lesson:authn-authz).

## Distributed systems and integration {#distributed}

| Term | What it means in Spring | What it contributes |
| --- | --- | --- |
| **Spring Cloud** | a set of projects for microservice problems | gateway, configuration, resilience, discovery |
| **Spring Cloud Gateway** | a reactive API gateway | routing, rate limiting, token relay at the edge |
| **Config Server** | central, versioned configuration | change configuration without redeploying |
| **Service discovery (Eureka, Consul)** | a registry of service instances | find services by name; often replaced by Kubernetes DNS |
| **Resilience4j** | circuit breaker, retry, bulkhead, rate limiter | stop failures spreading between services |
| **Spring Kafka / Spring AMQP** | templates and listeners for Kafka and RabbitMQ | messaging with error handling and retries |
| **Spring Cloud Stream** | binder abstraction over messaging systems | write consumers and producers as functions |
| **Spring Integration** | enterprise integration patterns (channels, routers, transformers) | message-driven integration of systems |
| **Spring Batch** | chunk-oriented jobs with restart and skip | reliable bulk processing (statements, reconciliation) |
| **Spring Session** | externalises HTTP sessions (Redis, JDBC) | sessions that survive instance changes |
| **Spring Modulith** | module boundaries inside a monolith | structured monolith, an easier path to services |

Details: [Spring Cloud](lesson:spring-cloud), [Spring messaging](lesson:spring-messaging), [microservice patterns](lesson:microservice-patterns), [distributed scheduler](lesson:distributed-scheduler), [Redis caching](lesson:redis-caching).

## Testing {#testing}

| Term | What it means in Spring | What it contributes |
| --- | --- | --- |
| **Spring TestContext** | loads and caches an ApplicationContext for tests | integration tests with real wiring |
| **`@SpringBootTest`** | starts the full application context | end-to-end style tests |
| **Slice tests (`@WebMvcTest`, `@DataJpaTest`)** | load only one layer | fast, focused tests |
| **`@MockBean` / `@MockitoBean`** | replace a bean with a mock | isolate the unit under test |
| **MockMvc, Testcontainers** | HTTP-level tests without a server, real databases in containers | realistic tests |

Details: [Spring testing](lesson:spring-testing).

## Which project do I reach for? {#choose}

| I need to... | Use |
| --- | --- |
| create and wire objects, add transactions and caching | Spring Framework (Core, AOP) |
| start an app quickly with sensible defaults | Spring Boot |
| build a blocking JSON API | Spring MVC |
| handle very many concurrent, I/O-heavy connections | WebFlux (or virtual threads with MVC) |
| read and write a relational database through entities | Spring Data JPA (Hibernate) |
| write SQL by hand with less boilerplate | `JdbcTemplate` or Spring Data JDBC |
| use MongoDB or Redis | Spring Data MongoDB or Spring Data Redis |
| protect endpoints and methods | Spring Security |
| process millions of records in a scheduled job | Spring Batch |
| route, secure and limit calls across services | Spring Cloud Gateway, Resilience4j |
| watch health and metrics | Actuator and Micrometer |

## Interview questions {#questions}

### [basic] What is the difference between Spring, Spring Boot and Spring MVC? {#spring-boot-mvc-q}

Spring (the Framework) is the core: the container, dependency injection, AOP, transactions and support for many technologies. Spring MVC is one module inside it, the servlet-based web framework. Spring Boot is a layer on top that configures all of this automatically (starters, auto-configuration, an embedded server, Actuator). Boot adds convenience, not new capabilities, and you can still use the Framework without it.

### [basic] What are inversion of control and dependency injection? {#ioc-di-q}

IoC means the framework controls object creation and wiring instead of your code calling `new`. Dependency injection is the technique: a class declares its dependencies (preferably as constructor parameters) and the container supplies them. The benefits are loose coupling and easy testing, because a test can pass a fake in.

### [basic] What is a Spring bean and what is the ApplicationContext? {#bean-context-q}

A bean is an object instantiated, assembled and managed by the Spring container. The `ApplicationContext` is that container: it reads bean definitions (annotations and `@Bean` methods), creates the beans, injects dependencies, applies proxies, publishes events and resolves properties.

### [basic] What does Spring Boot's auto-configuration do? {#autoconfig-q}

On start-up Boot inspects the classpath, properties and existing beans and registers sensible default beans: a `DataSource` if a database driver and URL are present, Jackson, an embedded Tomcat when the web starter is there. Each configuration is conditional (`@ConditionalOnClass`, `@ConditionalOnMissingBean`) and backs off when you define your own bean.

### [basic] What is a starter? {#starter-q}

A starter is a dependency descriptor that pulls in a curated, version-compatible set of libraries for one purpose, such as `spring-boot-starter-web` (MVC, Jackson, Tomcat) or `spring-boot-starter-data-jpa` (Spring Data JPA, Hibernate, a connection pool). It removes dependency hunting and version conflicts.

### [basic] What is the difference between JPA, Hibernate and Spring Data JPA? {#jpa-hibernate-data-q}

JPA is a specification (an API: `@Entity`, `EntityManager`, JPQL). Hibernate is the most common implementation of that specification and does the actual SQL generation and change tracking. Spring Data JPA is a Spring layer on top that generates repository implementations from interfaces, so you rarely use the `EntityManager` directly. The chain is Spring Data JPA, then JPA, then Hibernate, then JDBC.

### [basic] What is the difference between Spring Data and Spring Data JPA? {#data-vs-jpa-q}

Spring Data is the umbrella project that defines a common repository model and has modules per store (JPA, JDBC, MongoDB, Redis, Cassandra, Elasticsearch, R2DBC). Spring Data JPA is the module for relational databases through JPA. The repository interfaces look alike across modules, but the features (such as JPQL or derived query support) depend on the store.

### [basic] What is Spring MVC and what does the DispatcherServlet do? {#mvc-q}

Spring MVC is the servlet-based web framework in the Spring Framework. The `DispatcherServlet` is the front controller: it receives each request, uses handler mapping to find the controller method, invokes it (binding path variables, query parameters and the JSON body), and renders the result through message converters, or sends exceptions to exception handlers. See [Spring MVC](lesson:spring-mvc).

### [intermediate] What is the difference between Spring MVC and WebFlux? {#mvc-vs-webflux-q}

MVC is blocking, thread-per-request on the servlet API: simple, and ideal with blocking libraries such as JDBC and JPA. WebFlux is non-blocking on Reactor and Netty, handling many concurrent connections with few threads, but requires the whole call chain to be reactive and is harder to debug. With virtual threads (Java 21) MVC scales much further, which removes the main reason to choose WebFlux for ordinary services. See [reactive Spring](lesson:spring-reactive).

### [intermediate] How does Spring AOP contribute to the framework? {#aop-contribution-q}

It is the mechanism that lets Spring add behaviour around beans without changing them. Transactions, caching, security annotations, `@Async` and metrics are all implemented as advice applied through proxies. The consequence is that these annotations only work on calls that go through the proxy, so a call from one method to another in the same class bypasses them. See [AOP](lesson:spring-aop).

### [intermediate] What happens from the moment an HTTP request arrives until the database is queried? {#request-flow-q}

The embedded server hands the request to the security filter chain, which authenticates and authorises. The `DispatcherServlet` maps it to a controller, converts the JSON body and validates it. The controller calls a service bean through a proxy that starts a transaction. The service calls a Spring Data repository, whose generated implementation uses JPA and Hibernate to create SQL, sent over a pooled JDBC connection. The response travels back, converted to JSON, with errors handled by `@ControllerAdvice`. The walk-through above shows this.

### [intermediate] What is Spring Cloud and do you always need it? {#spring-cloud-q}

A collection of projects solving distributed-system problems: gateway, central configuration, discovery, client-side load balancing and resilience patterns. You only need it with several services, and on Kubernetes many parts (discovery, configuration, load balancing) are provided by the platform, so teams often keep just the gateway and Resilience4j. See [Spring Cloud](lesson:spring-cloud).

### [intermediate] When would you use Spring Batch instead of a @Scheduled method? {#batch-q}

`@Scheduled` only triggers code. Spring Batch provides what a large job needs: chunked reading, processing and writing with a transaction per chunk, restart from the failure point, skip and retry rules, job history and parallel partitions. Use it for statement runs or reconciliation over millions of rows; use `@Scheduled` (with a lock in a cluster) for small periodic tasks.

### [intermediate] What is the difference between @Component, @Service, @Repository and @Controller? {#stereotypes-q}

All four make a class a Spring bean found by component scanning. The difference is meaning: `@Service` marks business logic, `@Controller` and `@RestController` mark web handlers, and `@Repository` marks data access and additionally translates persistence exceptions into Spring's `DataAccessException` hierarchy. Using the right one documents intent and lets tooling and aspects target layers.

### [intermediate] What is the difference between Spring Security authentication and authorisation, and where do they run? {#security-q}

Authentication establishes who the caller is (a password, a JWT) and authorisation decides what they may do (roles, permissions). Both run in the `SecurityFilterChain`, a chain of servlet filters in front of the `DispatcherServlet`, so unauthenticated requests never reach a controller. Method security (`@PreAuthorize`) adds rules at the service layer using the same security context. See [Spring Security](lesson:spring-security).
