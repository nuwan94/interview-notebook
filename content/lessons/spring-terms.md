---
title: Spring at a glance — what each Spring term means and what it contributes
nav: Spring terms at a glance
slug: spring-terms
summary: Short notes on every major Spring term (IoC, beans, AOP, MVC, WebFlux, Data, JPA, Hibernate, Security, Boot, Cloud, Batch, Integration, Actuator and more): what it means in Spring and how it contributes to the framework, with a one-request walk-through and interview questions.
tags: [Spring, Overview, Glossary, Spring Boot, Spring Data, Spring MVC, JPA]
order: 79
topic: Spring / Fundamentals
updated: 2026-11-26
subnav: true
---

"Spring" is not one library. It is a family of projects, and interviewers mix the names freely. Typical questions are:

- What is the difference between Spring, Spring Boot and Spring MVC?
- Where does JPA stop and Spring Data start?
- What does Hibernate have to do with it?

This page gives a short note for each term. Each note says **what the term is** and **what it adds**. Each section links to the full lesson.

Play the walk-through first. It follows one payment request through the layers. Then it shows the container and how the projects fit together.

```demo
name: spring-map-walk
```

> **One sentence to remember:** *Spring Framework is the core, Spring Boot sets it up for you, and the other Spring projects are optional add-ons.*

## The core container {#core}

The **container** is the part of Spring that creates your objects and connects them to each other.

| Term | What it means in Spring | What it adds |
| --- | --- | --- |
| **Spring Framework** | The base project. It holds the container, AOP, transactions, the web layer (MVC and WebFlux), JDBC support and testing support. | Every other Spring project is built on it. |
| **IoC** (inversion of control) | The framework creates your objects and decides when, instead of your code calling `new`. | Classes say what they need, not how to get it. This keeps them loosely coupled. |
| **Dependency injection (DI)** | The way IoC is done. The objects a class needs are passed in, best through the constructor. | Classes are easy to test, and one implementation can be swapped for another. |
| **Bean** | An object that the container creates and manages. | It is the unit that Spring connects, wraps in proxies and manages. |
| **ApplicationContext** | The container itself. It reads the bean definitions, creates the beans and publishes events. | It is the running "Spring" inside your application. |
| **`@Component` / `@Service` / `@Repository` / `@Controller`** | Stereotype annotations. They mark a class as a bean, and Spring finds it by scanning packages. | Beans are found automatically. `@Repository` also converts database errors into Spring's own exceptions. |
| **`@Configuration` and `@Bean`** | Java configuration. A `@Bean` method builds one bean by hand. | You can create beans from third-party classes and do custom setup. |
| **Scope** | How long a bean lives. The default is singleton (one shared object). Others are prototype, request and session. | You control whether a bean is shared and whether it can hold state. |
| **Profile** | A named group of beans and properties, such as `dev` or `prod`. | One codebase behaves differently in each environment. |
| **`Environment` and `@Value`** | The way to read properties and active profiles. | Configuration lives outside the code. |
| **SpEL** | Spring Expression Language: small expressions written as `#{...}`. | Annotations, security rules and cache keys can use computed values. |
| **Application event** | Publish and subscribe inside one application. | One part of the app can react to something without the other part calling it directly. |

Details: [Spring Core](lesson:spring-core).

## Cross-cutting concerns {#cross-cutting}

A **cross-cutting concern** is a job needed in many places, such as transactions, logging or security checks. Spring adds these around your methods so you do not repeat them.

| Term | What it means in Spring | What it adds |
| --- | --- | --- |
| **AOP** (aspect-oriented programming) | Adding behaviour around method calls without editing those methods. | Transactions, security checks, logging and caching each live in one place. |
| **Proxy** | A wrapper object that Spring generates around a bean. Callers talk to the wrapper, and it calls the real bean. | It is how `@Transactional`, `@Cacheable` and `@Async` work. It also explains the self-invocation trap: a call inside the same class skips the proxy. |
| **Aspect, advice, pointcut** | The aspect is the module. The advice is the code to run. The pointcut is the rule that says where it runs. | This is how you write your own cross-cutting logic. |
| **`@Transactional`** | Marks a method as one transaction. | Commit and rollback happen without boilerplate code. |
| **Transaction manager** | The component that begins, commits and rolls back a transaction for one resource, such as JDBC, JPA or JMS. | The same programming model works over many technologies. |
| **`@Cacheable`, `@CacheEvict`** | Annotations of the cache abstraction. | You add caching with Caffeine or Redis without changing the method body. |
| **`@Async`, `@Scheduled`** | `@Async` runs a method on another thread. `@Scheduled` runs it on a timer. | Background work. |
| **Bean Validation (`@Valid`)** | Rules on fields, such as `@NotNull` or `@Size`. | Input is checked before your code runs. |

Details: [AOP](lesson:spring-aop), [transactions](lesson:spring-transactions), [caching and async](lesson:spring-caching-async).

## Web layer {#web}

| Term | What it means in Spring | What it adds |
| --- | --- | --- |
| **Spring MVC** | The web framework built on servlets. Each request gets its own thread. | Controllers, URL mapping, JSON binding, validation and error handling. |
| **DispatcherServlet** | The front controller. It receives every request and sends it to the right controller method. | It is the single entry point of MVC. |
| **`@RestController`** | A controller whose return value is written straight into the response body. | It is the usual way to build a JSON API. |
| **`@RequestMapping` and friends** | Map a URL and an HTTP method to a handler method. | Routing. |
| **HttpMessageConverter** | Converts between Java objects and JSON or XML. Jackson does the JSON part. | Request and response bodies are converted automatically. |
| **`@ControllerAdvice`** | A class that handles exceptions for all controllers. | Every error response has the same shape (`ProblemDetail`). |
| **Filter and interceptor** | Code that runs before and after a request. A filter belongs to the servlet layer. An interceptor belongs to MVC. | Security, logging and correlation IDs. |
| **Spring WebFlux** | The non-blocking (reactive) web stack, built on Reactor. | It handles very many connections with few threads, and it supports streaming. |
| **`WebClient` / `RestClient`** | HTTP clients. `WebClient` is reactive. `RestClient` is a fluent blocking client. | Calling other services. |
| **Spring HATEOAS, Spring REST Docs, springdoc** | HATEOAS adds links to responses. REST Docs builds documentation from tests. springdoc generates OpenAPI documentation. | APIs are documented and easier to explore. |
| **WebSocket and STOMP** | WebSocket keeps a two-way connection open. STOMP is a messaging protocol on top of it. | Live updates and notifications. |

Details: [Spring MVC](lesson:spring-mvc), [REST API design](lesson:rest-api-design), [reactive](lesson:spring-reactive).

## Data access {#data}

An **ORM** (object-relational mapper) maps Java objects to database tables, so you work with objects instead of writing every SQL statement.

| Term | What it means in Spring | What it adds |
| --- | --- | --- |
| **JDBC** | The standard Java API for SQL databases. | It is the lowest layer. Everything else uses it. |
| **`JdbcTemplate`** | Spring's helper on top of JDBC. | You still write SQL, but you skip the code for connections and error handling. |
| **DataSource and connection pool (HikariCP)** | A DataSource hands out database connections. A pool keeps connections open and reuses them. | Faster queries, and a limit on how much load the database gets. |
| **JPA** (Jakarta Persistence) | The standard API for mapping objects to tables (`@Entity`, `EntityManager`, JPQL). | It is a specification for an ORM, not an implementation. |
| **Hibernate** | The most used JPA implementation (the "provider"). | It is the engine that writes the SQL, tracks changes and caches. |
| **Entity and persistence context** | An entity is a mapped class. The persistence context is the set of entities that one session is tracking. | Dirty checking: when the session flushes, changed entities are saved without a `save` call. |
| **Spring Data** | The umbrella project for repository-style data access. It has modules for JPA, JDBC, MongoDB, Redis, Cassandra, Elasticsearch and R2DBC. | One repository programming model across many stores. |
| **Spring Data JPA** | Spring Data on top of JPA and Hibernate. | You write repository interfaces, and Spring generates the implementation. |
| **Repository interface** | An interface such as `JpaRepository<Entity, Id>`. | Create, read, update, delete, paging and derived queries (such as `findByStatusOrderByCreatedAt`) with no code. |
| **`@Query`, Specification, projection** | `@Query` is a custom query. A Specification builds a filter at run time. A projection returns only some fields. | Flexibility where derived queries are not enough. |
| **Auditing** | Annotations such as `@CreatedDate` and `@LastModifiedBy`. | "Created" and "updated" fields are filled in automatically. |
| **Spring Data REST** | Exposes repositories directly as REST endpoints. | Quick CRUD APIs. Banking services rarely use it. |
| **R2DBC** | Reactive (non-blocking) database access. | Non-blocking SQL, used with WebFlux. |
| **Flyway / Liquibase** | Versioned database migrations. | Schema changes run the same way in every environment. |

The chain worth remembering is: **Spring Data JPA → JPA (the API) → Hibernate (the implementation) → JDBC → database.** Details: [Spring Data JPA](lesson:spring-data-jpa), [normalisation](lesson:normalization), [SQL vs NoSQL](lesson:sql-vs-nosql).

## Spring Boot and operations {#boot}

| Term | What it means in Spring | What it adds |
| --- | --- | --- |
| **Spring Boot** | A layer on top of the Framework with sensible defaults already chosen. | Production-ready apps with very little setup. |
| **Starter** | One dependency, such as `spring-boot-starter-web`, that pulls in a matching set of libraries. | You do not have to find compatible versions yourself. |
| **Auto-configuration** | Boot creates beans automatically based on the classpath and properties. It steps back when you define your own bean. | The "it just works" behaviour. |
| **`@SpringBootApplication`** | One annotation that combines `@Configuration`, `@EnableAutoConfiguration` and `@ComponentScan`. | A single entry point annotation. |
| **Embedded server** | Tomcat, Jetty or Undertow packed inside the jar. | You run the app with `java -jar` and install no server. |
| **`application.yml` and `@ConfigurationProperties`** | Configuration kept outside the code and bound to typed Java classes. | The same build runs in every environment. |
| **Actuator** | Built-in endpoints for production: health, metrics and info. | Health probes and monitoring. |
| **Micrometer** | A metrics facade that sends data to Prometheus, Datadog and others, and also bridges tracing. | Metrics and traces that are not tied to one vendor. |
| **DevTools** | Restarts the app and reloads the browser when code changes. | A faster development loop. |
| **Spring Initializr** | The project generator at start.spring.io. | A correct starting project. |
| **Native image (GraalVM)** | The app compiled ahead of time into a native executable. | Fast start-up and low memory use. |

Details: [Spring Boot](lesson:spring-boot), [Boot 3](lesson:spring-boot-3), [observability](lesson:spring-observability).

## Security {#security}

| Term | What it means in Spring | What it adds |
| --- | --- | --- |
| **Spring Security** | The security framework. It works as a chain of servlet filters in front of your controllers. | Authentication, authorisation, CSRF protection and security headers. |
| **Authentication and authorisation** | Authentication checks who you are. Authorisation decides what you may do. | Access control on URLs and on methods. |
| **`SecurityFilterChain`** | The configuration bean that defines the security rules. | Security is set up in one declared place. |
| **`@PreAuthorize`** | A rule on a method, written in SpEL. | Fine-grained checks close to the business logic. |
| **OAuth2 resource server / client** | A resource server checks incoming bearer tokens (JWT). A client gets tokens from an identity provider. | Integration with an identity provider ([OAuth2](lesson:oauth2), [OIDC](lesson:oidc), [JWT](lesson:jwt)). |
| **Spring Authorization Server** | A project that issues tokens. | You can build your own identity provider. |

Details: [Spring Security](lesson:spring-security), [authentication vs authorisation](lesson:authn-authz).

## Distributed systems and integration {#distributed}

| Term | What it means in Spring | What it adds |
| --- | --- | --- |
| **Spring Cloud** | A set of projects for problems that appear with microservices. | Gateway, central configuration, resilience and service discovery. |
| **Spring Cloud Gateway** | A reactive API gateway that sits in front of your services. | Routing, rate limiting and token relay at the edge. |
| **Config Server** | One central, versioned store for configuration. | You change configuration without redeploying. |
| **Service discovery (Eureka, Consul)** | A registry of running service instances. | Services find each other by name. Kubernetes DNS often replaces it. |
| **Resilience4j** | A library for circuit breaker, retry, bulkhead and rate limiter. | One failing service does not bring down the others. |
| **Spring Kafka / Spring AMQP** | Templates and listeners for Kafka and RabbitMQ. | Messaging with error handling and retries. |
| **Spring Cloud Stream** | A layer over messaging systems, where each system plugs in as a "binder". | You write producers and consumers as plain functions. |
| **Spring Integration** | Enterprise integration patterns: channels, routers and transformers. | Systems are connected through messages. |
| **Spring Batch** | Jobs that process data in chunks, with restart and skip. | Reliable bulk processing, such as statements and reconciliation. |
| **Spring Session** | Stores HTTP sessions outside the app, in Redis or a database. | A session survives when an instance stops or changes. |
| **Spring Modulith** | Module boundaries inside one application (a monolith). | A well-structured monolith that is easier to split into services later. |

Details: [Spring Cloud](lesson:spring-cloud), [Spring messaging](lesson:spring-messaging), [microservice patterns](lesson:microservice-patterns), [distributed scheduler](lesson:distributed-scheduler), [Redis caching](lesson:redis-caching).

## Testing {#testing}

| Term | What it means in Spring | What it adds |
| --- | --- | --- |
| **Spring TestContext** | Loads an ApplicationContext for tests and caches it between tests. | Integration tests with real wiring. |
| **`@SpringBootTest`** | Starts the full application context. | End-to-end style tests. |
| **Slice tests (`@WebMvcTest`, `@DataJpaTest`)** | Load only one layer of the app. | Fast, focused tests. |
| **`@MockBean` / `@MockitoBean`** | Replace one bean with a mock. | The code under test is isolated from its neighbours. |
| **MockMvc, Testcontainers** | MockMvc sends HTTP requests without starting a server. Testcontainers runs a real database in a container. | Realistic tests. |

Details: [Spring testing](lesson:spring-testing).

## Which project do I reach for? {#choose}

| I need to... | Use |
| --- | --- |
| create and connect objects, and add transactions and caching | Spring Framework (Core, AOP) |
| start an app quickly with sensible defaults | Spring Boot |
| build a blocking JSON API | Spring MVC |
| handle very many concurrent connections that mostly wait on I/O | WebFlux, or virtual threads with MVC |
| read and write a relational database through entities | Spring Data JPA (Hibernate) |
| write SQL by hand with less boilerplate | `JdbcTemplate` or Spring Data JDBC |
| use MongoDB or Redis | Spring Data MongoDB or Spring Data Redis |
| protect endpoints and methods | Spring Security |
| process millions of records in a scheduled job | Spring Batch |
| route, secure and limit calls between services | Spring Cloud Gateway, Resilience4j |
| watch health and metrics | Actuator and Micrometer |

Try it in the lab: [Where a Spring property value comes from](lab:spring-profiles-config).

## Interview questions {#questions}

### [basic] What is the difference between Spring, Spring Boot and Spring MVC? {#spring-boot-mvc-q}

They are three layers of the same stack.

- **Spring (the Framework)** is the core: the container, dependency injection, AOP, transactions and support for many technologies.
- **Spring MVC** is one module inside the Framework. It is the web framework built on servlets.
- **Spring Boot** sits on top and sets all of this up for you: starters, auto-configuration, an embedded server and Actuator.

Boot adds convenience, not new abilities. You can still use the Framework without Boot.

### [basic] What are inversion of control and dependency injection? {#ioc-di-q}

**IoC** means the framework creates and connects your objects, instead of your code calling `new`. **Dependency injection** is how this is done: a class lists what it needs, best as constructor parameters, and the container passes those objects in.

The benefits:

1. Classes are loosely coupled, because they do not build their own collaborators.
2. Classes are easy to test, because a test can pass in a fake.

### [basic] What is a Spring bean and what is the ApplicationContext? {#bean-context-q}

A **bean** is an object that the Spring container creates, connects and manages.

The **`ApplicationContext`** is that container. It:

- reads the bean definitions (annotations and `@Bean` methods),
- creates the beans and injects their dependencies,
- wraps beans in proxies where needed,
- publishes events and resolves properties.

### [basic] What does Spring Boot's auto-configuration do? {#autoconfig-q}

It creates sensible default beans for you when the app starts.

Boot looks at the classpath, the properties and the beans you already have. For example:

- If a database driver and a URL are present, it creates a `DataSource`.
- If Jackson is present, it configures JSON conversion.
- If the web starter is present, it starts an embedded Tomcat.

Each piece of configuration has a condition, such as `@ConditionalOnClass` or `@ConditionalOnMissingBean`. So when you define your own bean, Boot steps back and uses yours.

### [basic] What is a starter? {#starter-q}

A starter is one dependency that pulls in a tested, version-compatible set of libraries for one purpose.

- `spring-boot-starter-web` brings MVC, Jackson and Tomcat.
- `spring-boot-starter-data-jpa` brings Spring Data JPA, Hibernate and a connection pool.

You no longer hunt for libraries or fight version conflicts.

### [basic] What is the difference between JPA, Hibernate and Spring Data JPA? {#jpa-hibernate-data-q}

They are three layers, each on top of the next.

- **JPA** is a specification: an API with `@Entity`, `EntityManager` and JPQL. It has no code that runs by itself.
- **Hibernate** is the most common implementation of JPA. It writes the SQL and tracks changes.
- **Spring Data JPA** is a Spring layer on top. It generates repository implementations from your interfaces, so you rarely use the `EntityManager` directly.

The chain is Spring Data JPA → JPA → Hibernate → JDBC.

### [basic] What is the difference between Spring Data and Spring Data JPA? {#data-vs-jpa-q}

**Spring Data** is the umbrella project. **Spring Data JPA** is one module inside it.

- Spring Data defines a common repository model and has one module per store: JPA, JDBC, MongoDB, Redis, Cassandra, Elasticsearch and R2DBC.
- Spring Data JPA is the module for relational databases through JPA.

The repository interfaces look alike in every module. The features, such as JPQL or derived queries, depend on the store.

### [basic] What is Spring MVC and what does the DispatcherServlet do? {#mvc-q}

**Spring MVC** is the web framework in the Spring Framework, built on servlets. The **`DispatcherServlet`** is its front controller: every request goes through it.

For each request it:

1. finds the controller method that matches the URL (handler mapping),
2. calls that method, filling in path variables, query parameters and the JSON body,
3. turns the return value into the response through message converters,
4. or, if an exception is thrown, passes it to the exception handlers.

See [Spring MVC](lesson:spring-mvc).

### [intermediate] What is the difference between Spring MVC and WebFlux? {#mvc-vs-webflux-q}

MVC is blocking, and WebFlux is non-blocking.

- **MVC** gives each request its own thread, on the servlet API. It is simple, and it fits blocking libraries such as JDBC and JPA.
- **WebFlux** runs on Reactor and Netty. It handles many connections with few threads. But the whole call chain must be reactive, and it is harder to debug.

With virtual threads (Java 21), MVC scales much further. That removes the main reason to choose WebFlux for an ordinary service. See [reactive Spring](lesson:spring-reactive).

### [intermediate] How does Spring AOP contribute to the framework? {#aop-contribution-q}

AOP is how Spring adds behaviour around beans without changing their code.

Transactions, caching, security annotations, `@Async` and metrics are all advice, applied through proxies.

The catch: these annotations only work when the call goes through the proxy. If one method calls another method in the same class, the call skips the proxy and the annotation does nothing. See [AOP](lesson:spring-aop).

### [intermediate] What happens from the moment an HTTP request arrives until the database is queried? {#request-flow-q}

The request passes through these steps in order:

1. The embedded server receives the request.
2. The security filter chain checks who the caller is and whether they are allowed.
3. The `DispatcherServlet` picks the controller method, converts the JSON body and validates it.
4. The controller calls a service bean through a proxy. The proxy starts a transaction.
5. The service calls a Spring Data repository. Its generated implementation uses JPA and Hibernate to build the SQL.
6. The SQL goes to the database over a JDBC connection taken from the pool.

The response travels back the same way and is converted to JSON. If anything fails, `@ControllerAdvice` turns the error into a response. The walk-through above shows these steps.

### [intermediate] What is Spring Cloud and do you always need it? {#spring-cloud-q}

No, you need it only when you run several services.

Spring Cloud is a set of projects for distributed-system problems: a gateway, central configuration, service discovery, client-side load balancing and resilience patterns.

On Kubernetes, the platform already provides discovery, configuration and load balancing. So teams often keep only the gateway and Resilience4j. See [Spring Cloud](lesson:spring-cloud).

### [intermediate] When would you use Spring Batch instead of a @Scheduled method? {#batch-q}

Use Spring Batch for large jobs, and `@Scheduled` for small periodic tasks.

`@Scheduled` only starts your code on a timer. Spring Batch gives a large job what it needs:

- it reads, processes and writes in chunks, with one transaction per chunk,
- it restarts from the point where it failed,
- it has skip and retry rules,
- it keeps a history of every job run,
- it can split the work into parallel partitions.

So use Spring Batch for statement runs or reconciliation over millions of rows. Use `@Scheduled`, with a lock when several instances run, for small tasks.

### [intermediate] What is the difference between @Component, @Service, @Repository and @Controller? {#stereotypes-q}

All four make a class a Spring bean that component scanning finds. The difference is meaning.

- `@Service` marks business logic.
- `@Controller` and `@RestController` mark web handlers.
- `@Repository` marks data access. It also converts database errors into Spring's `DataAccessException` hierarchy.

Using the right one documents intent. It also lets tools and aspects target a whole layer.

### [intermediate] What is the difference between Spring Security authentication and authorisation, and where do they run? {#security-q}

**Authentication** finds out who the caller is, for example from a password or a JWT. **Authorisation** decides what that caller may do, for example from roles or permissions.

Both run in the `SecurityFilterChain`. This is a chain of servlet filters in front of the `DispatcherServlet`, so a request without valid credentials never reaches a controller.

Method security (`@PreAuthorize`) adds more rules at the service layer, using the same security context. See [Spring Security](lesson:spring-security).
