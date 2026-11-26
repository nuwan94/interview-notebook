---
title: Spring Boot essentials — starters, auto-configuration, properties and profiles
nav: Spring Boot essentials
slug: spring-boot
summary: What Spring Boot adds on top of Spring, how starters and auto-configuration work, externalized configuration and property precedence, profiles, the embedded server, packaging and Actuator basics, with Java examples and interview questions.
tags: [Spring Boot, Auto-configuration, Configuration, Profiles, Starters]
order: 81
topic: Spring / Fundamentals
updated: 2026-11-26
subnav: true
---

After the [Spring core](lesson:spring-core) container, the next interview questions are:

- What does Spring Boot actually do?
- How does auto-configuration work?
- How do you configure an application for each environment?
- How is it packaged and run?

Boot is not a different framework. It is Spring plus three things: **sensible defaults already chosen, managed library versions, and a built-in server**. Next in the series: [AOP and proxies](lesson:spring-aop).

The demo has three scenes: startup, auto-configuration stepping back, and which property value wins.

```demo
name: spring-boot-walk
```

> **One sentence to remember:** *Boot creates the beans you would have written yourself, and steps back wherever you define your own.*

## What Boot adds {#what}

| Plain Spring | Spring Boot |
| --- | --- |
| You configure the container, data source, MVC, JSON and transaction manager yourself. | **Auto-configuration** creates sensible defaults based on what is on the classpath. |
| You pick compatible versions of dozens of libraries. | **Starters** and a managed **BOM** (bill of materials, a list of tested versions) pick them for you. |
| You deploy a WAR file to an external server. | An **embedded server** is inside the jar. You run it with `java -jar`. |
| You write XML or a lot of Java configuration. | Conventions plus `application.properties` or `application.yml`. |
| You add monitoring yourself. | **Actuator** gives health, metrics and info endpoints. |

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

- `@SpringBootConfiguration`: marks this as a configuration class.
- `@EnableAutoConfiguration`: turns on auto-configuration.
- `@ComponentScan`: scans this package and every package below it.

So **put the main class in the root package**. Otherwise beans in other packages are not found.

### Starters {#starters}

A **starter** is one dependency that pulls in a matching set of libraries for one purpose. Examples:

- `spring-boot-starter-web` brings Spring MVC, Jackson and an embedded Tomcat.
- `spring-boot-starter-data-jpa` brings Hibernate, Spring Data JPA and the HikariCP connection pool.
- Others: `-security`, `-validation`, `-actuator` and `-test`.

The Boot parent POM, or the Boot Gradle plugin, imports the **Boot BOM** (`spring-boot-dependencies`). So you leave out version numbers and get a combination that was tested together.

Adding a starter is also what switches on its auto-configuration, because it puts the right classes on the classpath.

## Auto-configuration {#autoconfig}

### How it works {#how}

1. `@EnableAutoConfiguration` loads a list of candidate classes. The list is in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` inside the jars on the classpath. (Older Boot versions used `spring.factories`.)
2. Each candidate is a normal `@Configuration` class, guarded by **conditions**.
3. Only candidates whose conditions pass register their beans.
4. They are processed **after** your own configuration. So your own beans win.

The common conditions:

| Condition | Passes when |
| --- | --- |
| `@ConditionalOnClass` | A class is on the classpath, meaning the library is present. |
| `@ConditionalOnMissingBean` | You have not defined a bean of that type. This is **how Boot steps back**. |
| `@ConditionalOnBean` | A certain bean exists. |
| `@ConditionalOnProperty` | A property has a certain value. |
| `@ConditionalOnWebApplication` | The app is a web app (servlet or reactive). |
| `@Profile` | A profile is active. |

### Seeing and controlling it {#control}

- **See what happened.** Run with `--debug` (or set `debug=true`). Boot prints the **conditions evaluation report**: which auto-configurations matched, which did not, and why.
- **See it at run time.** Actuator's `/actuator/conditions` endpoint shows the same report.
- **Turn one off.** Use `@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)` or `spring.autoconfigure.exclude=...`.
- **Replace one.** Define your own bean of that type. The auto-configured one steps back.

### Writing your own starter {#own-starter}

You need three parts:

- an `@AutoConfiguration` class whose beans use `@ConditionalOnClass` and `@ConditionalOnMissingBean`,
- optionally, a `@ConfigurationProperties` class for its settings,
- a line in the `.imports` file that lists the class.

Teams use their own starters to share logging, security or HTTP-client defaults across services.

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

Bind a group of properties to a typed object with `@ConfigurationProperties`. Prefer this over many separate `@Value` fields:

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
| Best for | One or two values. | A group of related settings. |
| Types and nesting | You convert values yourself. | Built in: objects, lists, maps, `Duration` and `DataSize`. |
| Relaxed binding (`fee-rate`, `feeRate` and `FEE_RATE` all match) | Limited. | Yes. |
| Validation | No. | Yes, with `@Validated`. |
| IDE auto-complete | No. | Yes. |

### Property precedence {#precedence}

Boot reads properties from many sources, in layers. A later source overrides an earlier one for the same key. From lowest to highest priority, roughly:

1. Defaults set with `SpringApplication.setDefaultProperties`.
2. `application.properties` or `.yml` packaged inside the jar.
3. Profile-specific files inside the jar, such as `application-prod.yml`.
4. Files next to the jar or in `./config/`. These external files override the packaged ones.
5. Operating system **environment variables**, such as `BANK_FEE_RATE` (relaxed binding maps it to `bank.fee-rate`).
6. Java system properties, such as `-Dbank.fee-rate=...`.
7. **Command-line arguments**, such as `--bank.fee-rate=...`. These win over everything.

This is what lets one built image run in every environment. You change values with environment variables, not by rebuilding.

**Never commit secrets.** Inject them from environment variables or a secret manager, such as Vault, Kubernetes secrets or a cloud key store.

### Profiles {#profiles}

A **profile** names an environment, such as `dev`, `test` or `prod`. You turn one on with `spring.profiles.active=prod` (or the `SPRING_PROFILES_ACTIVE` environment variable). Then:

- `application-prod.yml` is loaded on top of `application.yml`.
- Beans marked `@Profile("prod")` are registered. Other profile beans are not.
- One YAML file can also hold several documents, separated by `---`, each with `spring.config.activate.on-profile`.

```java
@Configuration
class ClientConfig {
    @Bean @Profile("!prod")  PaymentGateway fakeGateway() { return new FakeGateway(); }
    @Bean @Profile("prod")   PaymentGateway realGateway(BankProperties p) { return new RealGateway(p); }
}
```

## Running it {#running}

### Embedded server and packaging {#embedded}

`spring-boot-starter-web` includes **Tomcat**. To use Jetty or Undertow instead, exclude Tomcat and add the other server's starter. WebFlux uses Netty.

The build produces an executable **fat jar**: one jar that contains all its dependencies. You run it with `java -jar bank.jar`.

For containers:

- Prefer a **layered jar**. Dependencies, snapshot dependencies and your own classes go into separate layers, so Docker can cache the layers that rarely change. Buildpacks (`./mvnw spring-boot:build-image`) are another option.
- Set `server.shutdown=graceful`, so requests in progress finish before the container stops.
- Size the memory for the container, for example with `-XX:MaxRAMPercentage`.

### Actuator {#actuator}

`spring-boot-starter-actuator` adds operational endpoints under `/actuator`. The main ones are:

- `health`, including liveness and readiness probes for Kubernetes,
- `info`, `metrics` and `prometheus` (with Micrometer),
- `env`, `beans`, `conditions`, `loggers` and `threaddump`.

Only `health` is exposed over HTTP by default. Expose others on purpose, for example `management.endpoints.web.exposure.include=health,info,metrics`.

**Secure them.** `env`, `heapdump` and `beans` leak sensitive information. A separate management port (`management.server.port`) keeps them off the public listener.

### Other conveniences {#extras}

- **Logging:** Logback is the default. You set the level per package in properties, for example `logging.level.com.bank=DEBUG`.
- **DevTools:** restarts the app and reloads the browser during development. Never use it in production.
- **Startup hooks:** `CommandLineRunner` and `ApplicationRunner` beans, or listeners for `ApplicationReadyEvent`, run code once the app has started.
- **Testing:** `@SpringBootTest`, and slice tests such as `@WebMvcTest` and `@DataJpaTest` (covered in a later lesson).
- **Configuration processor:** `spring-boot-configuration-processor` generates IDE auto-complete data for your own properties.

Try it in the lab: [How auto-configuration decides what to create](lab:boot-autoconfiguration).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Boot | Spring plus defaults: starters, auto-configuration, an embedded server and Actuator. |
| `@SpringBootApplication` | `@SpringBootConfiguration` + `@EnableAutoConfiguration` + `@ComponentScan`. |
| Starter | A bundle of dependencies, and the trigger for auto-configuration. |
| Auto-configuration | Conditional `@Configuration` classes listed in `.imports`. They step back with `@ConditionalOnMissingBean`. |
| Debug it | The `--debug` conditions report, or `/actuator/conditions`. |
| Turn one off | `exclude = ...` or `spring.autoconfigure.exclude`. |
| `@ConfigurationProperties` | Typed, validated, relaxed binding. Prefer it over `@Value` for groups. |
| Precedence (low to high) | Packaged files, profile files, environment variables, system properties, command line. |
| Profiles | Files and beans per environment, chosen with `spring.profiles.active`. |
| Packaging | An executable fat jar. Use a layered jar or buildpacks for containers. |
| Actuator | Health, metrics and info. Expose carefully and secure. |

## Interview questions {#questions}

### [basic] What is Spring Boot and how does it differ from Spring? {#what-q}

Spring Boot is not a separate framework. It is a layer on top of Spring that removes setup work:

- starters and a managed BOM choose your dependencies and versions,
- auto-configuration creates default beans from the classpath and properties,
- an embedded server lets you run a plain jar,
- production features such as Actuator are built in.

With plain Spring, you configure all of that yourself.

### [basic] What does @SpringBootApplication do? {#annotation-q}

It combines three annotations:

- `@SpringBootConfiguration` marks the class as a configuration class.
- `@EnableAutoConfiguration` turns on auto-configuration.
- `@ComponentScan` scans the main class's package and its sub-packages for beans.

That is why the main class belongs in the root package.

### [basic] What is a Spring Boot starter? {#starter-q}

A starter is one dependency that bundles the libraries needed for a feature, with versions managed by the Boot BOM. For example, `spring-boot-starter-web` brings Spring MVC, Jackson and Tomcat.

Adding it also puts the classes on the classpath that switch on the matching auto-configuration.

### [basic] What is the difference between application.properties and application.yml? {#yaml-q}

They are two formats for the same configuration.

- **Properties** files are flat `key=value` lines.
- **YAML** is nested. It is easier to read for nested settings, and one file can hold a document per profile.

Boot reads both. If both define the same key in the same location, the properties file wins.

### [basic] What are Spring profiles? {#profile-q}

A profile is a named environment, such as dev, test or prod.

When you activate one with `spring.profiles.active`:

- Boot loads `application-{profile}` properties on top of the base file,
- beans marked `@Profile` for that profile are registered.

So the same build runs with different settings and beans. For example, a fake payment gateway in dev and the real one in prod.

### [intermediate] How does auto-configuration work? {#autoconfig-q}

1. `@EnableAutoConfiguration` loads the candidate configuration classes listed in `AutoConfiguration.imports` inside the starter jars.
2. Each candidate is a normal `@Configuration` class guarded by conditions, such as `@ConditionalOnClass`, `@ConditionalOnMissingBean` and `@ConditionalOnProperty`.
3. Candidates whose conditions pass register their beans.
4. They are processed after your own configuration, so your own beans win.

### [intermediate] How do you override or disable an auto-configured bean? {#override-q}

There are three ways:

1. **Define your own bean** of that type. The auto-configured one steps back through `@ConditionalOnMissingBean`.
2. **Set the related `spring.*` properties** to change how it is built.
3. **Exclude the auto-configuration class**, with `exclude` on `@SpringBootApplication` or with `spring.autoconfigure.exclude`.

Run with `--debug` to see which auto-configurations matched and why.

### [intermediate] How do you find out why a bean was or was not created? {#debug-q}

Start the app with `--debug` (or `debug=true`). Boot prints the conditions evaluation report. It lists:

- positive matches,
- negative matches, with the condition that failed,
- exclusions.

At run time, the Actuator `conditions` endpoint shows the same. For wiring, `/actuator/beans` lists every bean and its dependencies.

### [intermediate] @Value versus @ConfigurationProperties? {#value-q}

Use `@Value` for one value. Use `@ConfigurationProperties` for anything more.

`@ConfigurationProperties` binds a group of properties with a common prefix into a typed object. It:

- supports nested objects, lists and durations,
- supports relaxed binding,
- supports validation with `@Validated`,
- fails at startup on bad values,
- gives IDE auto-complete.

### [intermediate] What is the order of property sources? {#precedence-q}

From lowest to highest priority:

1. defaults,
2. `application.properties` in the jar,
3. profile-specific files in the jar,
4. external config files,
5. operating system environment variables,
6. JVM system properties,
7. command-line arguments.

A later source overrides an earlier one for the same key. That is how environment variables configure a container without rebuilding it.

### [intermediate] How do you manage secrets in a Spring Boot application? {#secrets-q}

Never put them in property files that are committed.

- Supply them through environment variables or mounted files, such as Kubernetes secrets.
- Or fetch them from a secret manager, such as Vault, AWS Secrets Manager or Azure Key Vault, using Spring Cloud integrations or config-tree imports.
- Restrict the Actuator `env` endpoint and mask sensitive values.

### [intermediate] How is a Spring Boot application packaged and run in a container? {#package-q}

As an executable fat jar, run with `java -jar`. For a container:

- Use a layered jar, so Docker caches the dependency layers, or build with buildpacks (`spring-boot:build-image`).
- Use a slim JRE base image.
- Use container-aware memory settings.
- Turn on graceful shutdown (`server.shutdown=graceful`).
- Expose Actuator liveness and readiness probes.

Native images are also possible, with GraalVM and Spring AOT.

### [intermediate] How do you change the embedded server or port? {#server-q}

- **Port:** set `server.port`.
- **Server:** to switch from Tomcat to Jetty or Undertow, exclude `spring-boot-starter-tomcat` from the web starter and add the other server's starter.
- **Tuning:** use the `server.*` properties for threads, timeouts, compression and SSL.

### [deep] What happens during SpringApplication.run()? {#run-q}

In order, it:

1. works out the application type (servlet, reactive or none),
2. loads the initializers and listeners,
3. prepares the environment: properties and profiles,
4. creates the `ApplicationContext`,
5. runs component scanning and auto-configuration, which register beans under conditions,
6. refreshes the context: creates the singletons and starts the embedded server,
7. runs the `CommandLineRunner` and `ApplicationRunner` beans,
8. publishes `ApplicationReadyEvent`.

### [deep] How would you create a custom starter? {#own-starter-q}

Build two modules.

- **An autoconfigure module.** It holds an `@AutoConfiguration` class whose beans use `@ConditionalOnClass` and `@ConditionalOnMissingBean`, plus a `@ConfigurationProperties` class for settings. Register the class in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`.
- **A starter module.** It depends on the autoconfigure module and on the libraries it needs.

Teams use this to standardise logging, security or HTTP client defaults across services.

### [deep] Which Actuator endpoints are risky and how do you protect them? {#actuator-q}

These endpoints show internals or allow changes:

- `env`, `configprops` and `beans` show configuration,
- `heapdump` and `threaddump` show memory and threads,
- `loggers` lets callers change log levels,
- `shutdown` stops the app.

To protect them:

1. Expose only what you need (`management.endpoints.web.exposure.include`).
2. Put them on a separate management port, or behind authentication and network rules.
3. Mask sensitive values.

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

Explain four things:

- The record is filled in through its constructor.
- It is validated at startup, so a bad value stops the application.
- `5s` is converted into a `Duration`.
- To register it, you need `@ConfigurationPropertiesScan` or `@EnableConfigurationProperties`.

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

Explain that exactly one bean is registered in each environment, so injection is never ambiguous. The profile can also come from the `SPRING_PROFILES_ACTIVE` environment variable.

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

Explain that the class registers a default bean only when all three hold:

- the library is on the classpath,
- the user has not defined their own `AuditClient`,
- the `audit.enabled` property has not turned it off.

The class must also be listed in the `.imports` file.
