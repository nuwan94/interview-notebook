---
title: Spring Cloud — gateway, discovery, config, HTTP clients and Resilience4j
nav: Spring Cloud and resilience
slug: spring-cloud
summary: How the Spring Cloud projects implement microservice patterns (Gateway, service discovery and load balancing, centralised config, declarative HTTP clients, Resilience4j circuit breaker, retry, bulkhead and rate limiter), what Kubernetes replaces, and how to combine them safely, with Java examples and interview questions.
tags: [Spring Cloud, Microservices, Gateway, Resilience4j, Circuit Breaker, Service Discovery, Config]
order: 93
topic: Spring / Microservices
updated: 2026-11-26
subnav: true
---

For a Spring Boot microservices role, interviewers connect the [microservice patterns](lesson:microservice-patterns) to concrete Spring tools. They ask: how do you build an API gateway, service discovery, central configuration and a circuit breaker in Spring? And what changes on Kubernetes?

This lesson maps each pattern to its Spring implementation. It builds on:

- [Spring Boot](lesson:spring-boot): configuration and Actuator,
- [Spring MVC](lesson:spring-mvc): the services behind the gateway,
- [Spring Security](lesson:spring-security): checking tokens at the edge,
- [messaging](lesson:messaging): asynchronous communication.

The demo has three scenes: the gateway with discovery, the circuit breaker states, and central configuration.

```demo
name: spring-cloud-walk
```

> **One sentence to remember:** *Spring Cloud implements the distributed-system patterns, but on Kubernetes use only the pieces you need.*

Spring Cloud gives each pattern a Spring-style tool: Gateway, LoadBalancer, Config, Resilience4j. But Kubernetes already does discovery, load balancing and configuration, so some of those tools are not needed there.

## The toolbox {#toolbox}

| Concern | Pattern ([details](lesson:microservice-patterns)) | Spring tool | On Kubernetes |
| --- | --- | --- | --- |
| One entry point, edge filters | API gateway | **Spring Cloud Gateway** | Keep the gateway, or use an ingress controller or a service mesh. |
| Find service instances | Service discovery | Eureka, Consul (client in **Spring Cloud LoadBalancer**) | Services and DNS (`http://ledger-service`), Spring Cloud Kubernetes. |
| Spread calls over instances | Client-side load balancing | **Spring Cloud LoadBalancer** | kube-proxy balances per connection, on the server side. |
| Shared config that can be refreshed | Externalised configuration | **Spring Cloud Config**, Vault | ConfigMaps, Secrets, environment variables. |
| Call other services | HTTP between services | **`RestClient`**, `WebClient`, OpenFeign, `@HttpExchange` | The same. |
| Survive failing dependencies | Circuit breaker, retry, bulkhead, rate limit | **Resilience4j** (Spring Cloud Circuit Breaker) | Service mesh retries and outlier detection can add to it. |
| Trace a request | Distributed tracing | Micrometer Tracing (OpenTelemetry) | The same. |
| Messaging | Event-driven | Spring Cloud Stream, Spring Kafka/AMQP | The same. |
| Contracts | Consumer-driven tests | Spring Cloud Contract | The same. |

Spring Cloud projects are versioned as a **release train**, for example 2023.0.x. The train must match the Spring Boot version. The BOM `spring-cloud-dependencies` manages it.

Netflix Ribbon, Hystrix and Zuul 1 are retired. Their replacements are LoadBalancer, Resilience4j and Gateway.

## Gateway and discovery {#gateway}

### Spring Cloud Gateway {#spring-gateway}

It is a reactive gateway, running on Netty. You configure it with **routes**:

- a *predicate* selects requests,
- *filters* change them,
- a *uri* names the target.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: accounts
          uri: lb://account-service                     # logical name resolved through discovery and load balancing
          predicates:
            - Path=/api/accounts/**
          filters:
            - StripPrefix=1
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 20
                redis-rate-limiter.burstCapacity: 40
            - name: Retry
              args: { retries: 2, statuses: SERVICE_UNAVAILABLE, methods: GET }
```

Typical gateway filters:

- JWT validation (the gateway acts as an OAuth2 resource server),
- token relay to the services behind it,
- rate limiting,
- correlation ids,
- CORS,
- path rewriting,
- response caching,
- a circuit breaker per route.

Write custom behaviour as a `GlobalFilter` or a `GatewayFilterFactory`. Keep **business logic out of the gateway**. It is a layer for routing and policy (see [API gateway and BFF](lesson:microservice-patterns#gateway)).

### Discovery and load balancing {#discovery}

Services register with a **registry** (a Eureka server, Consul) and send heartbeats. Clients ask the registry for the healthy instances behind a logical name.

**Spring Cloud LoadBalancer** resolves `lb://account-service` (in the gateway) or `http://account-service` (in a `@LoadBalanced` client). It caches the instance list and picks one: round robin by default, with other policies available. See [service discovery](lesson:microservice-patterns#discovery) for the pattern.

On **Kubernetes**, the Service object and cluster DNS already give discovery and load balancing. So the usual setup is plain `http://ledger-service` calls, with no Eureka. Spring Cloud Kubernetes can read ConfigMaps and endpoints if needed.

Watch out: kube-proxy balances per TCP connection. So long-lived HTTP/2 or gRPC connections can stick to one pod, unless you use a mesh or client-side balancing.

## Calling other services {#clients}

```java
// RestClient (Spring 6.1+): synchronous, fluent, replaces RestTemplate for new code
@Bean @LoadBalanced
RestClient.Builder restClientBuilder() { return RestClient.builder(); }

LedgerEntryDto[] entries = restClient.get()
        .uri("http://ledger-service/api/entries?account={id}", id)
        .retrieve()
        .body(LedgerEntryDto[].class);

// declarative interface client (Spring 6): @HttpExchange
@HttpExchange("/api/entries")
interface LedgerClient {
    @GetExchange List<LedgerEntryDto> byAccount(@RequestParam long account);
}
```

OpenFeign (`@FeignClient`) offers a similar declarative style, with Spring Cloud integration. `WebClient` is the non-blocking option for reactive code.

Whatever the client:

- **always set connect and read timeouts**,
- pass on the correlation id and the security token,
- map error responses to exceptions,
- wrap the call with resilience (below).

## Configuration {#config}

**Spring Cloud Config Server** serves properties to services by application name and profile. It reads them from a Git repository (or Vault, or JDBC). Clients import them with `spring.config.import=optional:configserver:http://config:8888`.

Config in Git is versioned and auditable. New values reach running instances through `@RefreshScope` beans and `POST /actuator/refresh`, or Spring Cloud Bus broadcasts the refresh. Otherwise, restart.

Cautions:

- The config server becomes a startup dependency. Make it highly available, or use `optional:` and fallbacks.
- Never keep secrets in plain Git. Encrypt them, or use Vault or Kubernetes Secrets.
- On Kubernetes, prefer **ConfigMaps and Secrets**, mounted as files or environment variables. Boot reads them natively ([property precedence](lesson:spring-boot#precedence)).

## Resilience4j {#resilience}

This is the overview. The full library (settings, decorator order, proxy pitfalls, testing) is in the [Resilience4j lesson](lesson:resilience4j).

### The decorators {#decorators}

| Decorator | Protects against | Key settings |
| --- | --- | --- |
| **Circuit breaker** | Calling a failing dependency again and again. | `failureRateThreshold`, `slidingWindowSize`, `waitDurationInOpenState`, `permittedNumberOfCallsInHalfOpenState` |
| **Retry** | Short-lived failures. | `maxAttempts`, `waitDuration`, exponential backoff, which exceptions retry |
| **Time limiter** | Calls that hang. | `timeoutDuration` |
| **Bulkhead** | One dependency using up all threads or connections. | `maxConcurrentCalls` (semaphore) or a thread-pool bulkhead |
| **Rate limiter** | Overloading yourself or a service you call. | `limitForPeriod`, `limitRefreshPeriod` |

```java
@Service
class PaymentClient {

    @CircuitBreaker(name = "payment", fallbackMethod = "paymentUnavailable")
    @Retry(name = "payment")
    @Bulkhead(name = "payment")
    public PaymentResult pay(PaymentRequest request) {
        return restClient.post().uri("http://payment-service/api/payments").body(request).retrieve().body(PaymentResult.class);
    }

    private PaymentResult paymentUnavailable(PaymentRequest request, Throwable t) {
        return PaymentResult.pending(request.id());           // degrade: accept and process later
    }
}
```

```yaml
resilience4j:
  circuitbreaker:
    instances:
      payment:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
        permittedNumberOfCallsInHalfOpenState: 3
  retry:
    instances:
      payment:
        maxAttempts: 3
        waitDuration: 200ms
        enableExponentialBackoff: true
```

The annotations work through **AOP proxies** ([AOP and proxies](lesson:spring-aop)), so self-invocation skips them.

The default order, from outside to inside, is **Retry, CircuitBreaker, RateLimiter, TimeLimiter, Bulkhead**.

### Using them safely {#safely}

- **Only retry idempotent operations**: GET, or POST with an idempotency key. Use **exponential backoff with jitter**, and cap the attempts. Retries multiply the load on a struggling service (retry storms).
- **Timeouts first.** Without timeouts, a circuit breaker waits for hung calls. Set a client timeout shorter than the caller's own deadline.
- **Fallbacks must be safe.** Return cached or default data, queue the work, or fail clearly. Never let a fallback quietly report success for a payment.
- **Do not count business errors as failures.** Use `ignoreExceptions` for expected 4xx or domain exceptions, so the breaker reacts only to infrastructure faults.
- **Monitor** the breaker state and metrics through Actuator and Micrometer, and alert when breakers open.
- Combine with [timeouts, bulkheads and load shedding](lesson:microservice-patterns#circuit-breaker). Resilience comes in layers, not from one annotation.

## Other Spring Cloud pieces {#others}

- **Distributed tracing:** Micrometer Tracing, with an OpenTelemetry or Zipkin exporter, adds trace and span ids to logs. It carries them across HTTP and messaging.
- **Spring Cloud Stream:** a binder layer over Kafka or RabbitMQ, using functional `Consumer`/`Function`/`Supplier` beans ([messaging](lesson:messaging)).
- **Spring Cloud Contract:** consumer-driven contract tests, so changes in a provider do not silently break its consumers.
- **Spring Cloud Kubernetes**, **Spring Cloud Vault**, and **Spring Cloud Task** for short-lived jobs.
- **Service mesh (Istio, Linkerd):** moves retries, mTLS, traffic shifting and observability out of the application code. Compare it with library-based resilience, and do not use both for the same job.

Try it in the lab: [The Spring Cloud stack around one request](lab:spring-cloud-stack).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Gateway | Spring Cloud Gateway. A route = predicate + filters + uri. Reactive. |
| Edge filters | JWT, rate limit, correlation id, retry. No business logic. |
| Discovery | Eureka or Consul. On Kubernetes, Services and DNS. |
| Load balancing | Spring Cloud LoadBalancer, client side, `lb://name`. |
| HTTP clients | `RestClient`, `@HttpExchange`, OpenFeign, `WebClient`. Always set timeouts. |
| Config | Config Server (Git) or ConfigMaps. `@RefreshScope`. Secrets in Vault. |
| Circuit breaker | Closed, open (fail fast, fallback), half-open (trial calls). |
| Retry | Only idempotent calls, with backoff and jitter, capped. |
| Bulkhead | Limit concurrent calls per dependency. |
| Order | Retry, circuit breaker, rate limiter, time limiter, bulkhead. |
| Proxies | The annotations use AOP: no self-invocation. |
| Replaced | Ribbon, Hystrix and Zuul 1 are gone. |

## Interview questions {#questions}

### [basic] What is Spring Cloud? {#what-q}

It is a set of projects that give Spring-style implementations of common distributed-system patterns for microservices:

- an API gateway,
- service discovery and client-side load balancing,
- central configuration,
- circuit breakers and other resilience tools,
- distributed tracing integration,
- messaging binders,
- contract testing.

It builds on Spring Boot. It is versioned as a release train that matches specific Boot versions.

### [basic] What does Spring Cloud Gateway do? {#gateway-q}

It is the single entry point to the services.

- It routes each request to the right service, using predicates (path, header, method).
- It applies filters: authentication, rate limiting, retries, path rewriting, correlation ids and more.

It is built on Spring WebFlux and Netty. It should hold edge policy, not business logic.

### [basic] What is service discovery and how do you do it in Spring? {#discovery-q}

Instances scale and move, so fixed addresses do not work. Instead, services register their address under a logical name with a registry (Eureka, Consul). Clients look up the healthy instances.

In Spring, a `@LoadBalanced` client or an `lb://name` URI uses Spring Cloud LoadBalancer to resolve the name and choose an instance. On Kubernetes, Services and DNS replace the registry.

### [basic] What are the states of a circuit breaker? {#states-q}

- **Closed:** calls pass, and failures are counted in a sliding window.
- **Open:** once the failure rate passes the threshold, calls fail at once (or use a fallback), without reaching the dependency, for a wait period.
- **Half-open:** a few trial calls test the dependency. Success closes the breaker. Failure opens it again.

### [basic] Which library replaced Hystrix and Ribbon? {#replaced-q}

- **Resilience4j** replaced Hystrix. It is lightweight and functional, with a circuit breaker, retry, bulkhead, rate limiter and time limiter.
- **Spring Cloud LoadBalancer** replaced Ribbon for client-side load balancing.
- **Spring Cloud Gateway** replaced Zuul 1.

### [intermediate] Do you still need Eureka and Spring Cloud Config on Kubernetes? {#k8s-q}

Usually not.

- Kubernetes Services and DNS give discovery and load balancing.
- ConfigMaps and Secrets give configuration. Boot reads them through environment variables or mounted files.
- Rolling updates and probes replace registry heartbeats.

You still use Spring Cloud for the gateway, Resilience4j and tracing. Keep Eureka or Config Server when you run outside Kubernetes, or when you need their specific features, such as Git-backed config with refresh.

### [intermediate] How do you make a call to another service resilient? {#resilient-q}

- Set connect and read timeouts.
- Wrap the call with a circuit breaker.
- Add a bounded retry: idempotent calls only, with exponential backoff and jitter.
- Add a bulkhead to limit concurrency.
- Provide a safe fallback.

Also pass on the correlation id and the deadline, monitor the breaker metrics, and test the failure behaviour (chaos testing or fault injection).

### [intermediate] In what order are Resilience4j decorators applied? {#order-q}

By default, from outermost to innermost: Retry, CircuitBreaker, RateLimiter, TimeLimiter, Bulkhead.

Retry sits outside the breaker, so the breaker records each attempt. The time limiter and bulkhead act closest to the call.

The order can be changed (aspect order properties), and it matters. For example, retry must wrap the breaker and a transaction.

### [intermediate] When should you not retry a call? {#retry-q}

- When it is not idempotent. A payment POST without an idempotency key could be applied twice.
- When the failure is a client error (4xx) that will not change.
- When the dependency is overloaded. Retries make it worse; use backoff, jitter and the circuit breaker.
- When the caller's deadline is nearly reached.

Cap the attempts, and share a retry budget across the whole call chain.

### [intermediate] How do you propagate security and tracing between services? {#propagate-q}

- **Security:** pass the access token on. Use token relay in the Gateway, or an interceptor on `RestClient`/Feign that copies the `Authorization` header. Or exchange it for a service token.
- **Tracing:** Micrometer Tracing passes the W3C `traceparent` header over HTTP and messaging, automatically, for instrumented clients.
- **Logs:** add a correlation id to the logging MDC.

### [intermediate] How do you refresh configuration without restarting? {#refresh-q}

Mark beans with `@RefreshScope` (or rely on `@ConfigurationProperties` rebinding). Then either:

- call `POST /actuator/refresh` on each instance, or
- publish a refresh event to all instances through Spring Cloud Bus (a message broker), often triggered by a Git webhook.

Not every property can be refreshed: a data source URL needs a restart. On Kubernetes, a rolling restart after changing a ConfigMap is a common, simpler approach.

### [intermediate] What is the difference between client-side and server-side load balancing? {#lb-q}

- **Client-side:** the caller gets the instance list from the registry and chooses one itself (Spring Cloud LoadBalancer). That allows smart policies, with no extra hop.
- **Server-side:** the caller talks to a load balancer or a Kubernetes Service, which picks an instance (kube-proxy, a cloud load balancer).

Server-side is simpler for clients. Client-side balances per request, not per connection.

### [deep] What problems can a circuit breaker introduce? {#breaker-problems-q}

- Thresholds set wrong, so it trips on normal errors, or never trips.
- Business or 4xx errors counted as failures.
- A fallback that hides serious failures, or returns wrong data.
- A breaker per method instead of per dependency.
- One shared breaker for unrelated endpoints.
- No monitoring, so an open breaker goes unnoticed.

Fix these by tuning per dependency, ignoring expected exceptions, making fallbacks explicit and alerting on state changes.

### [deep] How would you protect a service from a slow dependency exhausting its threads? {#bulkhead-q}

Combine:

- timeouts, shorter than the caller's deadline,
- a bulkhead that limits concurrent calls to that dependency (a semaphore or a separate thread pool), so the rest of the service keeps working,
- a circuit breaker, to fail fast once the dependency is clearly unhealthy,
- asynchronous or queue-based integration, where possible.

Virtual threads make threads cheap. But they do not reduce the load on the dependency, or the connection limits.

### [deep] Why keep logic out of the API gateway? {#gateway-logic-q}

A gateway with orchestration or business rules becomes a bottleneck. It is coupled to many teams, hard to change, and owned by no single domain team. Every release depends on it, so it is a single point of failure.

Keep it to edge concerns that cut across services: authentication, rate limits, routing, and aggregation for one client in a BFF. Let the services own the business logic.

### [coding] Configure a gateway route with a circuit breaker and a fallback. {#coding-gateway}

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: payments
          uri: lb://payment-service
          predicates:
            - Path=/api/payments/**
          filters:
            - name: CircuitBreaker
              args:
                name: paymentBreaker
                fallbackUri: forward:/fallback/payments
```

```java
@RestController
class FallbackController {
    @RequestMapping("/fallback/payments")
    ResponseEntity<ProblemDetail> payments() {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, "Payments are temporarily unavailable, please retry later");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(p);
    }
}
```

Explain these points:

- The filter trips on failures or timeouts.
- The fallback gives a clear 503 instead of hanging.
- The breaker settings come from the Resilience4j configuration.

### [coding] Add retry and a circuit breaker to an outbound call with a fallback. {#coding-resilience}

```java
@Service
class RateClient {
    private final RestClient http;
    RateClient(RestClient.Builder builder) { this.http = builder.baseUrl("http://rate-service").build(); }

    @CircuitBreaker(name = "rates", fallbackMethod = "cachedRate")
    @Retry(name = "rates")
    public BigDecimal rate(String pair) {
        return http.get().uri("/api/rates/{pair}", pair).retrieve().body(BigDecimal.class);
    }

    BigDecimal cachedRate(String pair, Throwable t) {                 // same arguments plus the exception
        return rateCache.lastKnown(pair).orElseThrow(() -> new RateUnavailableException(pair, t));
    }
}
```

```yaml
resilience4j.retry.instances.rates: { maxAttempts: 3, waitDuration: 200ms, enableExponentialBackoff: true, retryExceptions: [java.io.IOException, org.springframework.web.client.HttpServerErrorException] }
resilience4j.circuitbreaker.instances.rates: { slidingWindowSize: 20, failureRateThreshold: 50, waitDurationInOpenState: 20s, ignoreExceptions: [com.bank.RateNotFoundException] }
```

Explain these points:

- This is a read-only, idempotent call, so retry is safe.
- The fallback signature adds a `Throwable`.
- The breaker ignores a missing pair, because that is a business error.
- The call must go through the proxy, so it comes from another bean.

### [coding] Call another service with a declarative client and timeouts. {#coding-client}

```java
@HttpExchange("/api/entries")
interface LedgerClient {
    @GetExchange List<LedgerEntryDto> byAccount(@RequestParam long account);
}

@Configuration
class ClientConfig {
    @Bean
    LedgerClient ledgerClient(RestClient.Builder builder) {
        RestClient rest = builder.baseUrl("http://ledger-service")
                .requestFactory(timeouts(Duration.ofSeconds(1), Duration.ofSeconds(3)))
                .build();
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(rest)).build().createClient(LedgerClient.class);
    }
    private ClientHttpRequestFactory timeouts(Duration connect, Duration read) {
        var f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(connect); f.setReadTimeout(read);
        return f;
    }
}
```

Explain these points:

- The interface gives a typed client that is easy to mock.
- The proxy factory implements it.
- Explicit connect and read timeouts stop a slow dependency from holding threads.
- For discovery, add the load balancer annotation or builder.
