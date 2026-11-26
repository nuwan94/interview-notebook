---
title: Spring Boot 3 and Spring Framework 6 — what changed and how to migrate
nav: Boot 3 and Spring 6 changes
slug: spring-boot-3
summary: The changes in Spring Boot 3 and Spring Framework 6 that interviews and migrations hit (Java 17 baseline, Jakarta EE namespace, Security 6, ProblemDetail, RestClient and HTTP interfaces, the Observation API, virtual threads, AOT and native images), plus a migration checklist, with Java examples and interview questions.
tags: [Spring Boot 3, Spring 6, Jakarta EE, Migration, Native Image, Observability]
order: 83
topic: Spring / Fundamentals
updated: 2026-11-26
subnav: true
---

"What changed in Spring Boot 3?" separates people who have only used Boot from people who have migrated a real service. Expect questions about:

- Java 17 and the Jakarta rename,
- what broke during the upgrade,
- what is new: ProblemDetail, `RestClient`, observability, virtual threads and native images,
- how you would upgrade a service.

This lesson sums up the release line so you can answer briefly. It touches [Spring Boot essentials](lesson:spring-boot), [Spring Security](lesson:spring-security), [Spring MVC](lesson:spring-mvc), [observability](lesson:spring-observability) and [virtual threads](lesson:spring-reactive#virtual).

The demo has three scenes: the migration path, the Observation API, and AOT with native images.

```demo
name: spring-boot3-walk
```

> **One sentence to remember:** *Boot 3 needs Java 17 and renames `javax` to `jakarta`, and in return gives you better observability, virtual threads and native images.*

## Baseline and release line {#baseline}

| Version | Spring Framework | Java | Notes |
| --- | --- | --- | --- |
| Boot 2.7 (end of life) | 5.3 | 8 to 19 | The last line that uses `javax`. Migrate off it. |
| **Boot 3.0** (Nov 2022) | **6.0** | **17 minimum** | Jakarta EE 9/10, AOT and native images, the Observation API. |
| Boot 3.1 | 6.0 | 17+ | Docker Compose and Testcontainers support, `@ServiceConnection`, SSL bundles. |
| Boot 3.2 | 6.1 | 17+ (21 for virtual threads) | `RestClient`, `JdbcClient`, **virtual threads**, CRaC. |
| Boot 3.3 / 3.4 | 6.1 / 6.2 | 17+ | Structured logging (3.4), `@MockitoBean` (6.2), a better Observation API. |
| Boot 3.5 / newer | 6.2 / 7 line | 17+ | Check the current release notes. |

Some practical rules:

- Use the **latest supported 3.x** version.
- Check the Spring Boot support policy. Open source support for each minor version lasts about 18 months.
- Read the migration guide of every minor version you pass through.

Newer Boot lines and Spring 7 build on this base (Jakarta EE 11, null-safety with JSpecify). So a clean Boot 3 migration is the foundation for everything after it.

## Breaking changes {#breaking}

### Java 17 and Jakarta EE {#jakarta}

Spring Framework 6 requires **Java 17**.

Jakarta EE also changed its package names. The APIs moved from Oracle's `javax.*` packages to the Eclipse Foundation's `jakarta.*` packages, and Boot 3 uses Jakarta EE 9/10:

| Old | New |
| --- | --- |
| `javax.persistence.*` | `jakarta.persistence.*` |
| `javax.servlet.*` | `jakarta.servlet.*` |
| `javax.validation.*` | `jakarta.validation.*` |
| `javax.annotation.PostConstruct` | `jakarta.annotation.PostConstruct` |
| `javax.transaction.Transactional` | `jakarta.transaction.Transactional` (or Spring's own annotation) |

Everything on the classpath must support Jakarta. That includes **Hibernate 6**, Hibernate Validator 8, Tomcat 10.1, Spring Security 6, Flyway, the Jackson modules, and every internal or third-party library and starter.

**OpenRewrite** recipes (`UpgradeSpringBoot_3_x`) automate the package renames and many property changes.

### Spring Security 6 {#security}

`WebSecurityConfigurerAdapter` is **removed**. Instead you declare a `SecurityFilterChain` bean using the lambda style of configuration. Other changes:

- `authorizeHttpRequests` replaces `authorizeRequests`.
- `requestMatchers` replaces `antMatchers` and `mvcMatchers`.
- Each request's authorisation is decided by an `AuthorizationManager`.
- The CSRF and session defaults are stricter.
- `@EnableGlobalMethodSecurity` became `@EnableMethodSecurity` ([Spring Security](lesson:spring-security)).

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

- **Hibernate 6:** new defaults for ID generation (a sequence per entity), changed SQL type mappings, and some changes in how HQL behaves. Test your queries and validate the schema.
- **Trailing slash:** matching with a trailing slash is off by default. `/accounts/` no longer matches `/accounts`.
- **Properties:** some were renamed or removed. For example, `spring.redis.*` became `spring.data.redis.*`. Add `spring-boot-properties-migrator` for a while to get warnings about them.
- **Auto-configuration registration** moved from `spring.factories` to `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`.
- **Tracing:** Spring Cloud Sleuth is gone. **Micrometer Tracing** replaces it.
- **Removed or replaced:** older Spring Cloud Netflix components are gone. `RestTemplate` gets no new features, in favour of `RestClient`. Some Actuator endpoints and metric names changed.
- **HTTP clients:** Apache HttpClient 5, plus support for the Jetty and JDK clients. Netty 4.1 and Reactor also changed.

## What is new {#new}

### Web and HTTP {#web}

- **`ProblemDetail`** supports RFC 9457, a standard format for error bodies. Turn it on with `spring.mvc.problemdetails.enabled=true` ([error handling](lesson:spring-mvc#errors)).
- **`RestClient`** (6.1) is a synchronous HTTP client with a fluent API. It is the modern replacement for `RestTemplate`. **HTTP interface clients** (`@HttpExchange`) generate a client from an annotated interface ([clients](lesson:spring-cloud#clients)).
- **`JdbcClient`** (6.1) is a fluent API on top of `JdbcTemplate`.
- **Virtual threads** (Boot 3.2 with Java 21) are switched on with `spring.threads.virtual.enabled=true` ([virtual threads](lesson:spring-reactive#virtual)).
- Also: **declarative HTTP services**, better testing of `@RestController` with `RestTestClient` in newer versions, and **SSL bundles** (`spring.ssl.bundle.*`) for certificate configuration.

### Observability {#observability}

The **Observation API** (from Micrometer) lets you instrument code once. From that one instrumentation it produces metrics, traces and log context. Spring MVC, WebClient, RestClient, JDBC, Kafka and others are instrumented out of the box.

**Micrometer Tracing**, used with OpenTelemetry, replaces Sleuth ([observability](lesson:spring-observability#tracing)).

### Development and testing {#dev}

- **`@ServiceConnection`** works with **Testcontainers**. `spring-boot-docker-compose` starts the services you depend on during local development ([Testcontainers](lesson:spring-testing#testcontainers)).
- **`@MockitoBean`** and `@MockitoSpyBean` (Spring Framework 6.2 / Boot 3.4) replace `@MockBean` and `@SpyBean`.
- **Structured logging** (ECS, GELF, Logstash JSON) is built in from Boot 3.4.
- `@ConfigurationProperties` records are bound through the constructor by default.

### AOT and native images {#aot}

**Spring AOT** (ahead-of-time processing) does startup work at build time instead. It evaluates the conditions, generates code for the bean definitions, and records hints about the reflection, proxies and resources the app needs.

**GraalVM native-image** then compiles the result into a native executable. It starts in tens of milliseconds and uses far less memory. That suits serverless and apps that scale to zero.

The costs:

- builds take much longer,
- everything must be known at build time (the "closed world"), so reflection, dynamic proxies and classpath scanning at run time need hints,
- fewer libraries are compatible,
- debugging is harder,
- peak speed is lower than a warmed-up JIT compiler.

Alternatives are tuning the JVM (class data sharing, layered jars), **CRaC** checkpoint and restore, or virtual threads and lazy initialisation.

## Migration checklist {#migration}

1. **Upgrade to the latest 2.7.x first.** Fix the deprecation warnings and make the build and tests pass. Upgrade the JDK to 17 (or 21).
2. **List your dependencies** and check each one supports Jakarta: Hibernate, validators, security, Flyway, internal libraries, Swagger/springdoc, Lombok and MapStruct. Upgrade them.
3. **Run OpenRewrite** (`org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_x`) to rename packages and properties.
4. **Add `spring-boot-properties-migrator`** to catch renamed properties. Remove it afterwards.
5. **Rewrite the Spring Security configuration** as a `SecurityFilterChain` with the new matcher methods.
6. **Check Hibernate 6 behaviour.** Run integration tests against the real database, validate the schema, and review ID generation and HQL.
7. **Fix tracing and metrics.** Replace Sleuth with Micrometer Tracing, and re-check dashboards and metric names.
8. **Review web behaviour:** trailing slashes, error handling, content negotiation and CORS.
9. **Move step by step:** 3.0 first, then each minor version. Keep a way to roll back, deploy to a staging environment, and compare performance and memory.
10. **Then adopt the new features on purpose:** `RestClient`, `ProblemDetail`, virtual threads, structured logging and `@ServiceConnection`.

Try it in the lab: [Migrating a service from Boot 2.7 to Boot 3](lab:boot3-jakarta-migration).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Baseline | Spring 6, Java 17 minimum (21 for virtual threads). |
| Namespace | `javax.*` became `jakarta.*`. |
| Security 6 | A `SecurityFilterChain` bean. No `WebSecurityConfigurerAdapter`. `requestMatchers`. |
| Hibernate | 6.x: ID generation and SQL type mapping changed. |
| Errors | `ProblemDetail` (RFC 9457). |
| HTTP clients | `RestClient` and `@HttpExchange`. `WebClient` for reactive code. |
| Observability | The Observation API plus Micrometer Tracing (Sleuth removed). |
| Threads | `spring.threads.virtual.enabled=true`. |
| Native | Spring AOT plus GraalVM: fast start, long build, some limits. |
| Tests | `@ServiceConnection`, Testcontainers, `@MockitoBean`. |
| Migration | Latest 2.7.x first, OpenRewrite, properties migrator, step by step. |

## Interview questions {#questions}

### [basic] What are the main changes in Spring Boot 3? {#changes-q}

The main changes are:

- Java 17 is the minimum.
- `javax` packages became `jakarta` (Jakarta EE 9/10).
- It moves to Spring Framework 6, Spring Security 6 and Hibernate 6.
- AOT processing and GraalVM native images are supported.
- The Observation API and Micrometer Tracing replace Sleuth.
- `ProblemDetail` is supported for error bodies.
- Later 3.x versions add `RestClient`, `JdbcClient` and virtual threads.

### [basic] What is the javax to jakarta change and why did it happen? {#jakarta-q}

Oracle handed Java EE over to the Eclipse Foundation, but the Eclipse Foundation was not allowed to use the `javax` name. So from Jakarta EE 9, the APIs were renamed to `jakarta.*`.

Boot 3 uses these packages. So an import such as `javax.persistence.Entity` becomes `jakarta.persistence.Entity`, and every library on the classpath must support Jakarta.

### [basic] What Java version does Spring Boot 3 require? {#java-q}

Java 17 or later. Java 21 is recommended, and you need it for virtual threads (Boot 3.2 and later).

### [intermediate] How did Spring Security configuration change? {#security-q}

`WebSecurityConfigurerAdapter` was removed. You now define a `SecurityFilterChain` bean in the lambda style. Also:

- `authorizeHttpRequests` and `requestMatchers` replace `authorizeRequests` and the `antMatchers` family,
- `@EnableMethodSecurity` replaces `@EnableGlobalMethodSecurity`,
- authorisation decisions are made by `AuthorizationManager`.

### [intermediate] How would you migrate a Spring Boot 2.7 service to 3.x? {#migrate-q}

In this order:

1. Upgrade to the latest 2.7 and fix the warnings.
2. Move to Java 17 or 21.
3. Check that every dependency supports Jakarta.
4. Run the OpenRewrite recipes to rename packages and properties.
5. Use the properties migrator to find renamed properties.
6. Rewrite the Security configuration.
7. Check Hibernate 6 behaviour with integration tests on the real database.
8. Replace Sleuth with Micrometer Tracing.
9. Roll out step by step, with checks in staging and a plan to roll back.

### [intermediate] What is RestClient and why use it instead of RestTemplate? {#restclient-q}

`RestClient` (Spring 6.1) is a synchronous HTTP client with a fluent API. It is built to replace `RestTemplate`, which is now in maintenance mode.

- It uses the same message converters and request factories.
- It is easier to read.
- It supports `@HttpExchange` interface clients.
- It works with observability out of the box.

`WebClient` is still the choice for reactive, non-blocking code.

### [intermediate] What is the Observation API? {#observation-q}

It is a Micrometer API that comes with Spring 6. You instrument an operation once, with an `Observation` or `@Observed`, and attach key values: low-cardinality ones (few possible values) and high-cardinality ones (many possible values).

Handlers registered for it then produce metrics, tracing spans and log context from that one observation.

Spring's own components are already instrumented this way. Micrometer Tracing (with OpenTelemetry or Brave) replaced Spring Cloud Sleuth.

### [intermediate] What are virtual threads in Spring Boot 3.2 and what do they need? {#virtual-q}

With Java 21 and `spring.threads.virtual.enabled=true`, Tomcat, task executors and schedulers run their work on virtual threads. A blocking call no longer holds an expensive platform thread, so you can keep writing blocking code.

You still need to:

- limit shared resources, such as connection pools,
- avoid pinning, which happens when code blocks inside `synchronized`,
- keep your dependencies compatible.

### [intermediate] What is ProblemDetail? {#problem-q}

It is Spring 6's support for RFC 9457, "Problem Details for HTTP APIs". It is a standard JSON error body with:

- the fields `type`, `title`, `status`, `detail` and `instance`,
- any extra fields you add,
- the media type `application/problem+json`.

You return it from `@ExceptionHandler` methods, or switch it on globally for Spring's own exceptions.

### [deep] What are Spring AOT and native images and when are they worth it? {#aot-q}

**AOT** moves startup work to build time. Conditions are evaluated, bean definitions are generated as code, and reflection hints are recorded.

**GraalVM native-image** then compiles this into a native executable. It starts very fast and uses little memory, which is ideal for serverless and apps that scale to zero.

The costs are long builds, limits on reflection and proxies, fewer compatible libraries, harder debugging and lower peak throughput. So for a service that runs for a long time, a tuned JVM is often the better choice.

### [deep] What problems typically appear when moving to Hibernate 6? {#hibernate-q}

The usual problems:

- ID generation has different defaults, for example sequence names and allocation sizes.
- Some SQL types map differently: dates, UUIDs and enums.
- HQL and criteria queries behave more strictly or differently.
- Schema validation behaves differently.
- Deprecated APIs were removed.

Catch them with integration tests against a real database (Testcontainers), `ddl-auto=validate`, and by comparing the SQL that Hibernate generates.

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

Explain the four changes:

- The adapter class is replaced by a bean.
- `authorizeHttpRequests` and `requestMatchers` replace the old methods.
- The configuration uses lambdas.
- `@EnableMethodSecurity` turns on `@PreAuthorize` by default.

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

Explain three things:

- `RestClient` can do everything `RestTemplate` did, with a fluent API.
- The interface client is generated at startup.
- Timeouts and error handling are configured on the builder.

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

Explain three things:

- OpenRewrite does the package renames for you.
- Third-party libraries must have Jakarta versions.
- Tracing is configured with the `management.tracing.*` properties and an OTLP endpoint.
