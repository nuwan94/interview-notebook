---
title: Spring Boot essentials — starters, auto-configuration, properties and profiles
nav: Spring Boot essentials
slug: spring-boot
summary: What Spring Boot adds on top of Spring, how starters and auto-configuration work, externalized configuration and property precedence, profiles, the embedded server, packaging and Actuator basics, with Java examples and interview questions.
tags: [Spring Boot, Auto-configuration, Configuration, Profiles, Starters]
order: 24
topic: Spring / Fundamentals
updated: 2026-11-13
subnav: true
---

After the [Spring core](lesson:spring-core) container, the next interview question is *what does Spring Boot actually do, how does auto-configuration work, how do you configure an application per environment, and how is it packaged and run?* Boot is not a different framework: it is Spring plus **opinionated defaults, dependency management and an embedded runtime**. Next in the series: [AOP and proxies](lesson:spring-aop). Play the three scenes: startup, auto-configuration backing off, and property precedence.

```demo
name: spring-boot-walk
```

> **One sentence to remember:** *Boot looks at your classpath and properties, creates the beans you would probably have written by hand, and steps aside wherever you define your own.*

## What Boot adds {#what}

| Plain Spring | Spring Boot |
| --- | --- |
| you configure the container, data source, MVC, JSON, transaction manager | **auto-configuration** creates sensible defaults from the classpath |
| you pick compatible versions of dozens of libraries | **starters** and a managed **BOM** pick tested versions |
| deploy a WAR to an external server | **embedded server**, run a jar with `java -jar` |
| XML or lots of Java config | convention plus `application.properties` / `application.yml` |
| add monitoring yourself | **Actuator** (health, metrics, info) |

### The main class {#main}

```java
@SpringBootApplication
public class BankApplication {
    public static void main(String[] args) {
        SpringApplication.run(BankApplication.class, args);
    }
}
```

`@SpringBootApplication` is a shortcut for three annotations:

- `@SpringBootConfiguration` (a `@Configuration` class);
- `@EnableAutoConfiguration` (turns on auto-configuration);
- `@ComponentScan` (scans this package and below).

So **put the main class in the root package**, or beans in sub-packages are not found.

### Starters {#starters}

A **starter** is a dependency descriptor that pulls in a coherent set of libraries for a purpose: `spring-boot-starter-web` (Spring MVC, Jackson, embedded Tomcat), `-data-jpa` (Hibernate, Spring Data JPA, HikariCP), `-security`, `-validation`, `-actuator`, `-test`. The parent POM or the Gradle plugin imports the **Boot BOM** (`spring-boot-dependencies`), so you omit versions and get a tested combination. Pulling a starter in is what makes its auto-configuration activate.

## Auto-configuration {#autoconfig}

### How it works {#how}

1. `@EnableAutoConfiguration` imports a list of candidate classes, read from `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` in the jars on the classpath (older Boot versions used `spring.factories`).
2. Each candidate is a normal `@Configuration` class guarded by **conditions**.
3. Only candidates whose conditions pass register their beans.
4. They are processed **after** your own configuration, so user-defined beans take precedence.

Common conditions:

| Condition | Passes when |
| --- | --- |
| `@ConditionalOnClass` | a class is on the classpath (the library is present) |
| `@ConditionalOnMissingBean` | you have not defined a bean of that type: **the back-off mechanism** |
| `@ConditionalOnBean` | a given bean exists |
| `@ConditionalOnProperty` | a property has a given value |
| `@ConditionalOnWebApplication` | it is a (servlet or reactive) web app |
| `@Profile` | a profile is active |

### Seeing and controlling it {#control}

- Run with `--debug` (or `debug=true`) to print the **conditions evaluation report**: positive matches, negative matches and why.
- Actuator's `/actuator/conditions` shows the same at runtime.
- Exclude one: `@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)` or `spring.autoconfigure.exclude=...`.
- Override by defining your own bean of that type (the auto-configured one backs off).

### Writing your own starter {#own-starter}

Provide a `@AutoConfiguration` class with `@ConditionalOnClass` and `@ConditionalOnMissingBean` beans, an optional `@ConfigurationProperties` class, and list it in the `.imports` file. Teams use this to share logging, security or HTTP-client defaults across services.

## Configuration {#config}

### Properties and YAML {#properties}

```properties
# application.properties
server.port=8081
spring.datasource.url=jdbc:postgresql://localhost:5432/bank
bank.fee-rate=0.01
bank.limits.daily=5000
```

```yaml
# application.yml (same, hierarchical)
bank:
  fee-rate: 0.01
  limits:
    daily: 5000
```

Bind a group of properties to a typed object with `@ConfigurationProperties` (preferred over many `@Value`):

```java
@ConfigurationProperties(prefix = "bank")
@Validated
public record BankProperties(@NotNull BigDecimal feeRate, @Valid Limits limits) {
    public record Limits(@Positive BigDecimal daily) {}
}

@SpringBootApplication
@ConfigurationPropertiesScan          // or @EnableConfigurationProperties(BankProperties.class)
public class BankApplication { ... }
```

| | `@Value("${bank.fee-rate}")` | `@ConfigurationProperties` |
| --- | --- | --- |
| Best for | one or two values | a group of related settings |
| Type safety and nesting | manual | yes (objects, lists, maps, `Duration`, `DataSize`) |
| Relaxed binding (`fee-rate`, `feeRate`, `FEE_RATE`) | limited | yes |
| Validation | no | yes with `@Validated` |
| IDE metadata | no | yes |

### Property precedence {#precedence}

Sources are layered, a later source overriding an earlier one. Roughly, from lowest to highest priority:

1. defaults (`SpringApplication.setDefaultProperties`);
2. `application.properties` / `.yml` packaged in the jar;
3. profile-specific files (`application-prod.yml`) packaged in the jar;
4. files next to the jar or in `./config/` (external, override the packaged ones);
5. OS **environment variables** (`BANK_FEE_RATE`, relaxed binding);
6. Java system properties (`-Dbank.fee-rate=...`);
7. **command-line arguments** (`--bank.fee-rate=...`), highest.

This is what lets one built image run in every environment: change values with environment variables, not by rebuilding. **Never commit secrets**: inject them from environment variables or a secret manager (Vault, Kubernetes secrets, cloud key stores).

### Profiles {#profiles}

A **profile** names an environment (`dev`, `test`, `prod`). Activate with `spring.profiles.active=prod` (or `SPRING_PROFILES_ACTIVE`):

- `application-prod.yml` is loaded on top of `application.yml`;
- beans annotated `@Profile("prod")` are registered only then;
- one YAML can hold several documents separated by `---` with `spring.config.activate.on-profile`.

```java
@Configuration
class ClientConfig {
    @Bean @Profile("!prod")  PaymentGateway fakeGateway() { return new FakeGateway(); }
    @Bean @Profile("prod")   PaymentGateway realGateway(BankProperties p) { return new RealGateway(p); }
}
```

## Running it {#running}

### Embedded server and packaging {#embedded}

`spring-boot-starter-web` embeds **Tomcat** (swap to Jetty or Undertow by excluding it and adding the other starter); WebFlux uses Netty. The build produces an executable **fat jar** (all dependencies nested) run with `java -jar bank.jar`.

For containers prefer **layered jars** (dependencies, snapshot dependencies, application classes in separate layers so Docker caches the stable ones) or buildpacks (`./mvnw spring-boot:build-image`). Set `server.shutdown=graceful` so in-flight requests finish before the container stops, and size memory for the container (`-XX:MaxRAMPercentage`).

### Actuator {#actuator}

`spring-boot-starter-actuator` exposes operational endpoints under `/actuator`: `health` (with liveness and readiness probes for Kubernetes), `info`, `metrics`, `env`, `beans`, `conditions`, `loggers`, `threaddump`, `prometheus` (with Micrometer). Only `health` is exposed over HTTP by default; expose others deliberately (`management.endpoints.web.exposure.include=health,info,metrics`) and **secure them**, since `env`, `heapdump` and `beans` leak sensitive information. A separate management port (`management.server.port`) keeps them off the public listener.

### Other conveniences {#extras}

- **Logging:** Logback by default; level per package in properties (`logging.level.com.bank=DEBUG`).
- **DevTools:** automatic restart and live reload for development (never in production).
- **Startup hooks:** `CommandLineRunner` / `ApplicationRunner` beans, `ApplicationReadyEvent` listeners.
- **Testing:** `@SpringBootTest`, slice tests such as `@WebMvcTest` and `@DataJpaTest` (a later lesson).
- **Configuration processor:** `spring-boot-configuration-processor` generates IDE metadata for your properties.

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Boot | Spring plus defaults: starters, auto-configuration, embedded server, Actuator |
| `@SpringBootApplication` | `@SpringBootConfiguration` + `@EnableAutoConfiguration` + `@ComponentScan` |
| Starter | dependency bundle plus the trigger for auto-configuration |
| Auto-configuration | conditional `@Configuration` classes from `.imports`; back off with `@ConditionalOnMissingBean` |
| Debug it | `--debug` conditions report, `/actuator/conditions` |
| Exclude | `exclude = ...` or `spring.autoconfigure.exclude` |
| `@ConfigurationProperties` | typed, validated, relaxed binding; prefer over `@Value` for groups |
| Precedence (low to high) | packaged files, profile files, env variables, system properties, command line |
| Profiles | per-environment files and beans; `spring.profiles.active` |
| Packaging | executable fat jar; layered jar or buildpacks for containers |
| Actuator | health, metrics, info; expose carefully and secure |

## Interview questions {#questions}

### [basic] What is Spring Boot and how does it differ from Spring? {#what-q}

Spring Boot is not a separate framework but a layer on top of Spring that removes boilerplate: starters and a managed BOM for dependencies, auto-configuration that creates default beans from the classpath and properties, an embedded server so you run a plain jar, and production features such as Actuator. Plain Spring requires you to configure all of that yourself.

### [basic] What does @SpringBootApplication do? {#annotation-q}

It combines `@SpringBootConfiguration` (marks a configuration class), `@EnableAutoConfiguration` (activates auto-configuration) and `@ComponentScan` (scans the main class's package and sub-packages for beans). That is why the main class belongs in the root package.

### [basic] What is a Spring Boot starter? {#starter-q}

A dependency that bundles the libraries needed for a feature (for example `spring-boot-starter-web` brings Spring MVC, Jackson and Tomcat) with versions managed by the Boot BOM. Adding it also puts the classes on the classpath that make the matching auto-configuration activate.

### [basic] What is the difference between application.properties and application.yml? {#yaml-q}

They are two formats for the same configuration. Properties are flat key=value lines; YAML is hierarchical, more readable for nested settings and supports multiple profile documents in one file. Boot reads both (properties win if both define a key in the same location).

### [basic] What are Spring profiles? {#profile-q}

Named environment sets (dev, test, prod). Activating one (`spring.profiles.active`) loads `application-{profile}` properties on top of the base file and registers beans marked `@Profile`. They let the same build run with different configuration and beans, for example a fake payment gateway in dev and the real one in prod.

### [intermediate] How does auto-configuration work? {#autoconfig-q}

`@EnableAutoConfiguration` loads candidate configuration classes listed in `AutoConfiguration.imports` from the starter jars. Each is a normal `@Configuration` guarded by conditions (`@ConditionalOnClass`, `@ConditionalOnMissingBean`, `@ConditionalOnProperty`). Those whose conditions pass register beans, and they are processed after the user's configuration so your own beans win.

### [intermediate] How do you override or disable an auto-configured bean? {#override-q}

Define your own bean of that type (the auto-configured one backs off through `@ConditionalOnMissingBean`), set the relevant `spring.*` properties, or exclude the auto-configuration class with `exclude` on `@SpringBootApplication` or `spring.autoconfigure.exclude`. Use `--debug` to see which auto-configurations matched and why.

### [intermediate] How do you find out why a bean was or was not created? {#debug-q}

Start with `--debug` (or `debug=true`) to print the conditions evaluation report listing positive matches, negative matches (with the failed condition) and exclusions, or call the Actuator `conditions` endpoint. For bean wiring, `/actuator/beans` lists all beans and dependencies.

### [intermediate] @Value versus @ConfigurationProperties? {#value-q}

`@Value` injects one property and suits a single value. `@ConfigurationProperties` binds a group of properties with a common prefix into a typed object (nested objects, lists, durations), supports relaxed binding and `@Validated` validation, fails fast at startup on bad values and gives IDE metadata. Prefer it for anything beyond a couple of settings.

### [intermediate] What is the order of property sources? {#precedence-q}

From lowest to highest: defaults, `application.properties` in the jar, profile-specific files in the jar, external config files, OS environment variables, JVM system properties, then command-line arguments. A later source overrides an earlier one for the same key, which is how environment variables configure a container without rebuilding.

### [intermediate] How do you manage secrets in a Spring Boot application? {#secrets-q}

Never commit them in property files. Supply them through environment variables or mounted files (Kubernetes secrets), or fetch from a secret manager (Vault, AWS Secrets Manager, Azure Key Vault) using Spring Cloud integrations or config-tree imports. Restrict the Actuator `env` endpoint and mask sensitive values.

### [intermediate] How is a Spring Boot application packaged and run in a container? {#package-q}

As an executable fat jar run with `java -jar`. For containers use a layered jar (so Docker caches dependency layers) or buildpacks (`spring-boot:build-image`), a slim JRE base image, container-aware memory settings, graceful shutdown (`server.shutdown=graceful`) and Actuator liveness and readiness probes. Native images are possible with GraalVM and Spring AOT.

### [intermediate] How do you change the embedded server or port? {#server-q}

Port with `server.port`. To switch from Tomcat to Jetty or Undertow exclude `spring-boot-starter-tomcat` from the web starter and add the other server's starter. Tune with `server.*` properties (threads, timeouts, compression, SSL).

### [deep] What happens during SpringApplication.run()? {#run-q}

It determines the application type, loads initializers and listeners, prepares the environment (properties, profiles), creates the `ApplicationContext`, runs component scanning and auto-configuration (conditional bean registration), refreshes the context (creating singletons and starting the embedded server), runs `CommandLineRunner` and `ApplicationRunner` beans, and publishes `ApplicationReadyEvent`.

### [deep] How would you create a custom starter? {#own-starter-q}

Make an autoconfigure module with an `@AutoConfiguration` class whose beans use `@ConditionalOnClass` and `@ConditionalOnMissingBean`, a `@ConfigurationProperties` class for settings, and register the class in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`. A starter module depends on it and the needed libraries. Used to standardise logging, security or HTTP client defaults across services.

### [deep] Which Actuator endpoints are risky and how do you protect them? {#actuator-q}

`env`, `configprops`, `beans`, `heapdump`, `threaddump`, `loggers` (changeable) and `shutdown` expose internals or allow changes. Expose only what is needed (`management.endpoints.web.exposure.include`), put them on a separate management port or behind authentication and network rules, and sanitise sensitive values.

### [coding] Bind and validate a group of properties. {#coding-props}

```java
@ConfigurationProperties(prefix = "bank.transfer")
@Validated
public record TransferProperties(
        @NotNull @DecimalMin("0.00") BigDecimal feeRate,
        @NotNull Duration timeout,
        @Min(1) int maxRetries) {}

@Service
class TransferService {
    private final TransferProperties props;
    TransferService(TransferProperties props) { this.props = props; }
}
```

```yaml
bank:
  transfer:
    fee-rate: 0.01
    timeout: 5s
    max-retries: 3
```

Explain that the record is bound by constructor, validated at startup (a bad value stops the application), that `5s` converts to a `Duration`, and that registering needs `@ConfigurationPropertiesScan` or `@EnableConfigurationProperties`.

### [coding] Register a fake gateway in dev and the real one in prod. {#coding-profile}

```java
interface PaymentGateway { void pay(Payment p); }

@Component @Profile("!prod")
class FakeGateway implements PaymentGateway { public void pay(Payment p) { log.info("fake pay {}", p); } }

@Component @Profile("prod")
class RealGateway implements PaymentGateway { ... }
```

```bash
java -jar bank.jar --spring.profiles.active=prod
```

Explain that exactly one bean is registered per environment, so injection stays unambiguous, and that the profile can also come from the `SPRING_PROFILES_ACTIVE` environment variable.

### [coding] Write a conditional bean that backs off if the user defines one. {#coding-conditional}

```java
@AutoConfiguration
@ConditionalOnClass(AuditClient.class)
@EnableConfigurationProperties(AuditProperties.class)
public class AuditAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean                       // user-defined AuditClient wins
    @ConditionalOnProperty(prefix = "audit", name = "enabled", havingValue = "true", matchIfMissing = true)
    AuditClient auditClient(AuditProperties props) {
        return new AuditClient(props.url());
    }
}
```

Explain that the class registers a default bean only if the library is present, the user has not defined their own and the property has not turned it off, and that it is listed in the `.imports` file.
