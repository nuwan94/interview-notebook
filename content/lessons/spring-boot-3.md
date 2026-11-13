---
title: Spring Boot 3 and Spring Framework 6 — what changed and how to migrate
nav: Boot 3 and Spring 6 changes
slug: spring-boot-3
summary: The changes in Spring Boot 3 and Spring Framework 6 that interviews and migrations hit (Java 17 baseline, Jakarta EE namespace, Security 6, ProblemDetail, RestClient and HTTP interfaces, the Observation API, virtual threads, AOT and native images), plus a migration checklist, with Java examples and interview questions.
tags: [Spring Boot 3, Spring 6, Jakarta EE, Migration, Native Image, Observability]
order: 34
topic: Spring / Fundamentals
updated: 2026-11-13
subnav: true
---

"What changed in Spring Boot 3?" separates people who have only used Boot from people who have migrated a real service. Expect: *Java 17 and Jakarta, what broke, what is new (ProblemDetail, `RestClient`, observability, virtual threads, native images) and how you would upgrade.* This lesson summarises the release line so you can answer concisely. It touches [Spring Boot essentials](lesson:spring-boot), [Spring Security](lesson:spring-security), [Spring MVC](lesson:spring-mvc), [observability](lesson:spring-observability) and [virtual threads](lesson:spring-reactive#virtual). Play the three scenes: the migration path, the Observation API, and AOT with native images.

```demo
name: spring-boot3-walk
```

> **One sentence to remember:** *Boot 3 means Java 17 or later, the `javax` to `jakarta` rename, Spring Security 6 and Hibernate 6; the migration is mostly mechanical, and the payoff is observability, virtual threads and native-image support.*

## Baseline and release line {#baseline}

| Version | Spring Framework | Java | Notes |
| --- | --- | --- | --- |
| Boot 2.7 (end of life) | 5.3 | 8 to 19 | last `javax` line; migrate off it |
| **Boot 3.0** (Nov 2022) | **6.0** | **17 minimum** | Jakarta EE 9/10, AOT and native, Observation |
| Boot 3.1 | 6.0 | 17+ | Docker Compose and Testcontainers support, `@ServiceConnection`, SSL bundles |
| Boot 3.2 | 6.1 | 17+ (21 for virtual threads) | `RestClient`, `JdbcClient`, **virtual threads**, CRaC |
| Boot 3.3 / 3.4 | 6.1 / 6.2 | 17+ | structured logging (3.4), `@MockitoBean` (6.2), improved Observation |
| Boot 3.5 / newer | 6.2 / 7 line | 17+ | check the current release notes |

Use the **latest supported 3.x**, check the Spring Boot support policy (open source support for each minor lasts roughly 18 months), and read the migration guide of every minor you cross. Newer Boot lines and Spring 7 build on this base (Jakarta EE 11, null-safety with JSpecify), so a clean Boot 3 migration is the foundation.

## Breaking changes {#breaking}

### Java 17 and Jakarta EE {#jakarta}

Spring Framework 6 requires **Java 17**. Jakarta EE moved from Oracle's `javax.*` to the Eclipse `jakarta.*` namespace, and Boot 3 uses Jakarta EE 9/10:

| Old | New |
| --- | --- |
| `javax.persistence.*` | `jakarta.persistence.*` |
| `javax.servlet.*` | `jakarta.servlet.*` |
| `javax.validation.*` | `jakarta.validation.*` |
| `javax.annotation.PostConstruct` | `jakarta.annotation.PostConstruct` |
| `javax.transaction.Transactional` | `jakarta.transaction.Transactional` (or Spring's own annotation) |

Everything on the classpath must be Jakarta-compatible: **Hibernate 6**, Hibernate Validator 8, Tomcat 10.1, Spring Security 6, Flyway, Jackson modules, and any internal or third-party libraries and starters. **OpenRewrite** recipes (`UpgradeSpringBoot_3_x`) automate the package renames and many property changes.

### Spring Security 6 {#security}

`WebSecurityConfigurerAdapter` is **removed**: declare a `SecurityFilterChain` bean with the lambda DSL. Other changes: `authorizeHttpRequests` replaces `authorizeRequests`, `requestMatchers` replaces `antMatchers` and `mvcMatchers`, authorization is asked per request by `AuthorizationManager`, CSRF and session defaults tightened, the `@EnableGlobalMethodSecurity` annotation became `@EnableMethodSecurity` ([Spring Security](lesson:spring-security)).

```java
@Configuration
@EnableMethodSecurity
class SecurityConfig {
    @Bean
    SecurityFilterChain chain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(a -> a.requestMatchers("/actuator/health/**").permitAll().anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
            .build();
    }
}
```

### Other behaviour changes {#other-breaking}

- **Hibernate 6:** new ID generation defaults (sequences per entity), changed SQL type mappings and some HQL semantics; test queries and schema validation.
- **Trailing slash matching** is off by default (`/accounts/` no longer matches `/accounts`).
- **Properties** renamed or removed (`spring.redis.*` became `spring.data.redis.*`, and others): add `spring-boot-properties-migrator` temporarily to get warnings.
- **Auto-configuration registration** moved from `spring.factories` to `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`.
- **Micrometer and tracing:** Spring Cloud Sleuth is gone, replaced by **Micrometer Tracing**.
- **Removed or replaced:** older Spring Cloud Netflix components, `RestTemplate` features frozen in favour of `RestClient`, some actuator endpoints and metric names changed.
- **HTTP clients:** Apache HttpClient 5, `Jetty` and `JDK` clients support; Netty 4.1 and Reactor changes.

## What is new {#new}

### Web and HTTP {#web}

- **`ProblemDetail`** (RFC 9457) support for standard error bodies, enabled with `spring.mvc.problemdetails.enabled=true` ([error handling](lesson:spring-mvc#errors)).
- **`RestClient`** (6.1): a synchronous fluent HTTP client, the modern `RestTemplate` replacement, and **HTTP interface clients** (`@HttpExchange`) that generate a client from an annotated interface ([clients](lesson:spring-cloud#clients)).
- **`JdbcClient`** (6.1): a fluent API over `JdbcTemplate`.
- **Virtual threads** (Boot 3.2 with Java 21): `spring.threads.virtual.enabled=true` ([virtual threads](lesson:spring-reactive#virtual)).
- **Declarative HTTP services**, improved **`@RestController`** testing with `RestTestClient` in newer versions, and better **SSL bundles** (`spring.ssl.bundle.*`) for certificate configuration.

### Observability {#observability}

The **Observation API** (Micrometer) instruments code once and produces metrics, traces and log context; Spring MVC, WebClient, RestClient, JDBC, Kafka and others are instrumented out of the box. **Micrometer Tracing** with OpenTelemetry replaces Sleuth ([observability](lesson:spring-observability#tracing)).

### Development and testing {#dev}

- **`@ServiceConnection`** with **Testcontainers**, plus `spring-boot-docker-compose` to start dependencies in local development ([Testcontainers](lesson:spring-testing#testcontainers)).
- **`@MockitoBean`** and `@MockitoSpyBean` (Spring Framework 6.2 / Boot 3.4) replace `@MockBean` and `@SpyBean`.
- **Structured logging** (ECS, GELF, Logstash JSON) built in from Boot 3.4.
- Constructor-binding by default for `@ConfigurationProperties` records.

### AOT and native images {#aot}

**Spring AOT** processes the application at build time: it evaluates conditions, generates bean-definition code and records reflection, proxy and resource hints. With **GraalVM native-image** the result is a native executable that starts in tens of milliseconds and uses far less memory, which suits serverless and scale-to-zero. The costs are long builds, a closed-world assumption (reflection, dynamic proxies and runtime classpath scanning need hints), fewer compatible libraries, harder debugging and lower peak throughput than a warmed-up JIT. Alternatives: tune the JVM (class data sharing, layered jars), **CRaC** checkpoint/restore, or virtual threads and lazy initialisation.

## Migration checklist {#migration}

1. **Upgrade to the latest 2.7.x** first, fix deprecation warnings, and make the build and tests green. Upgrade the JDK to 17 (or 21).
2. **Inventory dependencies** for Jakarta support (Hibernate, validators, security, Flyway, internal libraries, Swagger/springdoc, Lombok, MapStruct) and upgrade them.
3. **Run OpenRewrite** (`org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_x`) to rename packages and properties.
4. **Add `spring-boot-properties-migrator`** to catch renamed properties; remove it afterwards.
5. **Rewrite Spring Security config** to `SecurityFilterChain` and the new matcher methods.
6. **Check Hibernate 6** behaviour: run integration tests against the real database, validate the schema, review ID generation and HQL.
7. **Fix tracing and metrics:** replace Sleuth with Micrometer Tracing, re-check dashboards and metric names.
8. **Review web behaviour:** trailing slashes, error handling, content negotiation, CORS.
9. **Move step by step** (3.0, then each minor), keep a rollback, deploy to a staging environment, compare performance and memory.
10. **Then adopt new features** deliberately: `RestClient`, `ProblemDetail`, virtual threads, structured logging, `@ServiceConnection`.

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Baseline | Spring 6, Java 17 minimum (21 for virtual threads) |
| Namespace | `javax.*` to `jakarta.*` |
| Security 6 | `SecurityFilterChain` bean; no `WebSecurityConfigurerAdapter`; `requestMatchers` |
| Hibernate | 6.x: ID generation and SQL mapping changes |
| Errors | `ProblemDetail` (RFC 9457) |
| HTTP clients | `RestClient`, `@HttpExchange`; `WebClient` for reactive |
| Observability | Observation API + Micrometer Tracing (Sleuth removed) |
| Threads | `spring.threads.virtual.enabled=true` |
| Native | Spring AOT + GraalVM: fast start, long build, limits |
| Tests | `@ServiceConnection`, Testcontainers, `@MockitoBean` |
| Migration | latest 2.7.x, OpenRewrite, properties migrator, step by step |

## Interview questions {#questions}

### [basic] What are the main changes in Spring Boot 3? {#changes-q}

Java 17 as the minimum, the move from `javax` to the `jakarta` namespace (Jakarta EE 9/10), Spring Framework 6, Spring Security 6 and Hibernate 6, AOT processing and GraalVM native image support, the Observation API with Micrometer Tracing (replacing Sleuth), `ProblemDetail` support, and later in the 3.x line `RestClient`, `JdbcClient` and virtual threads.

### [basic] What is the javax to jakarta change and why did it happen? {#jakarta-q}

Java EE was transferred from Oracle to the Eclipse Foundation, which could not use the `javax` name, so the APIs were renamed to `jakarta.*` starting with Jakarta EE 9. Boot 3 uses these packages, so imports such as `javax.persistence.Entity` become `jakarta.persistence.Entity`, and all libraries on the classpath must be Jakarta-compatible.

### [basic] What Java version does Spring Boot 3 require? {#java-q}

Java 17 or later. Java 21 is recommended and is required to use virtual threads (Boot 3.2+).

### [intermediate] How did Spring Security configuration change? {#security-q}

`WebSecurityConfigurerAdapter` was removed: you define a `SecurityFilterChain` bean using the lambda DSL. `authorizeHttpRequests` and `requestMatchers` replace `authorizeRequests` and the `antMatchers` family, `@EnableMethodSecurity` replaces `@EnableGlobalMethodSecurity`, and authorisation decisions use `AuthorizationManager`.

### [intermediate] How would you migrate a Spring Boot 2.7 service to 3.x? {#migrate-q}

Upgrade to the latest 2.7 and fix warnings, move to Java 17 or 21, check that dependencies support Jakarta, run OpenRewrite recipes for package and property changes, use the properties migrator, rewrite Security config, verify Hibernate 6 behaviour with integration tests on the real database, replace Sleuth with Micrometer Tracing, and roll out stepwise with staging checks and a rollback plan.

### [intermediate] What is RestClient and why use it instead of RestTemplate? {#restclient-q}

`RestClient` (Spring 6.1) is a synchronous HTTP client with a fluent API, built on the same message converters and request factories, designed to replace `RestTemplate` (now in maintenance mode). It is simpler to read, supports `@HttpExchange` interface clients, and integrates with observability. `WebClient` remains for reactive, non-blocking use.

### [intermediate] What is the Observation API? {#observation-q}

A Micrometer abstraction included in Spring 6: you instrument an operation once (an `Observation` or `@Observed`) with low- and high-cardinality key values, and registered handlers produce metrics, tracing spans and log context from it. Spring components are already instrumented, and Micrometer Tracing (with OpenTelemetry or Brave) replaced Spring Cloud Sleuth.

### [intermediate] What are virtual threads in Spring Boot 3.2 and what do they need? {#virtual-q}

With Java 21 and `spring.threads.virtual.enabled=true`, Tomcat, task executors and schedulers run work on virtual threads, so blocking calls no longer tie up expensive platform threads. You keep blocking code. You must still bound resources (connection pools), avoid pinning (blocking in `synchronized`), and keep dependencies compatible.

### [intermediate] What is ProblemDetail? {#problem-q}

Spring 6's implementation of RFC 9457 (Problem Details for HTTP APIs): a standard JSON error body (`type`, `title`, `status`, `detail`, `instance` plus custom members, media type `application/problem+json`). It is used from `@ExceptionHandler` methods or enabled globally for Spring's own exceptions.

### [deep] What are Spring AOT and native images and when are they worth it? {#aot-q}

AOT moves startup work to build time: conditions are evaluated, bean definitions generated as code and reflection hints recorded. GraalVM native-image compiles this into a native executable with very fast startup and low memory, ideal for serverless and scale-to-zero. They cost long builds, restricted reflection and proxies, fewer compatible libraries, harder debugging and lower peak throughput, so for long-running services the JVM with tuning is often better.

### [deep] What problems typically appear when moving to Hibernate 6? {#hibernate-q}

Different default ID generation (sequence naming and allocation), changed mappings for some SQL types (dates, UUIDs, enums), stricter or changed HQL and criteria behaviour, schema validation differences, and removal of deprecated APIs. Catch them with integration tests against a real database (Testcontainers), `ddl-auto=validate`, and comparing generated SQL.

### [coding] Convert this security configuration to Spring Security 6. {#coding-security}

```java
@Configuration
@EnableGlobalMethodSecurity(prePostEnabled = true)
class OldSecurity extends WebSecurityConfigurerAdapter {
    @Override protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests().antMatchers("/public/**").permitAll().anyRequest().authenticated()
            .and().oauth2ResourceServer().jwt();
    }
}
```

```java
@Configuration
@EnableMethodSecurity
class SecurityConfig {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(a -> a.requestMatchers("/public/**").permitAll().anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
            .build();
    }
}
```

Explain the adapter replaced by a bean, `authorizeHttpRequests` and `requestMatchers`, the lambda DSL, and `@EnableMethodSecurity` (which enables `@PreAuthorize` by default).

### [coding] Replace RestTemplate with RestClient and an HTTP interface. {#coding-restclient}

```java
// before
RateDto rate = restTemplate.getForObject("http://rate-service/api/rates/{pair}", RateDto.class, pair);

// after: RestClient
RateDto rate = restClient.get().uri("/api/rates/{pair}", pair).retrieve().body(RateDto.class);

// after: declarative interface
@HttpExchange("/api/rates")
interface RateClient { @GetExchange("/{pair}") RateDto rate(@PathVariable String pair); }

@Bean
RateClient rateClient(RestClient.Builder builder) {
    RestClient rest = builder.baseUrl("http://rate-service").build();
    return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(rest)).build().createClient(RateClient.class);
}
```

Explain that `RestClient` has the same capabilities with a fluent API, that the interface client is generated at startup, and that timeouts and error handling are configured on the builder.

### [coding] Fix the namespace and tracing imports after the upgrade. {#coding-namespace}

```java
// compile errors after moving to Boot 3
import javax.persistence.Entity;               // -> jakarta.persistence.Entity
import javax.validation.constraints.NotBlank;  // -> jakarta.validation.constraints.NotBlank
import javax.servlet.http.HttpServletRequest;  // -> jakarta.servlet.http.HttpServletRequest
import org.springframework.cloud.sleuth.Tracer; // Sleuth removed -> io.micrometer.tracing.Tracer
```

```xml
<!-- build: remove spring-cloud-starter-sleuth, add -->
<dependency><groupId>io.micrometer</groupId><artifactId>micrometer-tracing-bridge-otel</artifactId></dependency>
<dependency><groupId>io.opentelemetry</groupId><artifactId>opentelemetry-exporter-otlp</artifactId></dependency>
```

Explain that OpenRewrite performs the package renames, that third-party libraries must have Jakarta versions, and that tracing is configured with `management.tracing.*` and an OTLP endpoint.
