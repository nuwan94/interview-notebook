---
title: Spring Cloud — gateway, discovery, config, HTTP clients and Resilience4j
nav: Spring Cloud and resilience
slug: spring-cloud
summary: How the Spring Cloud projects implement microservice patterns (Gateway, service discovery and load balancing, centralised config, declarative HTTP clients, Resilience4j circuit breaker, retry, bulkhead and rate limiter), what Kubernetes replaces, and how to combine them safely, with Java examples and interview questions.
tags: [Spring Cloud, Microservices, Gateway, Resilience4j, Circuit Breaker, Service Discovery, Config]
order: 55
topic: Spring / Microservices
updated: 2026-11-13
subnav: true
---

Interviewers for a Spring Boot microservices role connect the [microservice patterns](lesson:microservice-patterns) to concrete Spring tools: *how do you implement an API gateway, service discovery, central configuration and a circuit breaker in Spring, and what changes on Kubernetes?* This lesson maps each pattern to its Spring implementation. It builds on [Spring Boot](lesson:spring-boot) (configuration and Actuator), [Spring MVC](lesson:spring-mvc) (the services behind the gateway), [Spring Security](lesson:spring-security) (token validation at the edge) and [messaging](lesson:messaging) for asynchronous communication. Play the three scenes: gateway with discovery, the circuit breaker states, and central configuration.

```demo
name: spring-cloud-walk
```

> **One sentence to remember:** *Spring Cloud gives each distributed-system pattern a Spring-style implementation (Gateway, LoadBalancer, Config, Resilience4j), but on Kubernetes the platform already does discovery, load balancing and config, so use only the pieces you actually need.*

## The toolbox {#toolbox}

| Concern | Pattern ([details](lesson:microservice-patterns)) | Spring tool | On Kubernetes |
| --- | --- | --- | --- |
| Single entry point, edge filters | API gateway | **Spring Cloud Gateway** | Gateway kept, or an ingress controller or service mesh |
| Find service instances | Service discovery | Eureka, Consul (client in **Spring Cloud LoadBalancer**) | Services and DNS (`http://ledger-service`), Spring Cloud Kubernetes |
| Spread calls over instances | Client-side load balancing | **Spring Cloud LoadBalancer** | kube-proxy balances per connection (server-side) |
| Shared and refreshable config | Externalised configuration | **Spring Cloud Config**, Vault | ConfigMaps, Secrets, environment variables |
| Call other services | Inter-service HTTP | **`RestClient`**, `WebClient`, OpenFeign, `@HttpExchange` | same |
| Survive failing dependencies | Circuit breaker, retry, bulkhead, rate limit | **Resilience4j** (Spring Cloud Circuit Breaker) | service mesh retries and outlier detection can complement |
| Trace a request | Distributed tracing | Micrometer Tracing (OpenTelemetry) | same |
| Messaging | Event-driven | Spring Cloud Stream, Spring Kafka/AMQP | same |
| Contracts | Consumer-driven tests | Spring Cloud Contract | same |

Spring Cloud projects are versioned as a **release train** (for example 2023.0.x) that must match the Spring Boot version; the BOM `spring-cloud-dependencies` manages it. Netflix Ribbon, Hystrix and Zuul 1 are retired; their replacements are LoadBalancer, Resilience4j and Gateway.

## Gateway and discovery {#gateway}

### Spring Cloud Gateway {#spring-gateway}

A reactive (Netty) gateway configured with **routes**: a *predicate* selects requests, *filters* transform them, a *uri* names the target.

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

Typical gateway filters: JWT validation (the gateway as an OAuth2 resource server), token relay to downstream services, rate limiting, correlation ids, CORS, path rewriting, response caching and a circuit breaker per route. Custom behaviour is written as a `GlobalFilter` or a `GatewayFilterFactory`. Keep **business logic out of the gateway**; it is a routing and policy layer (see [API gateway and BFF](lesson:microservice-patterns#gateway)).

### Discovery and load balancing {#discovery}

Services register with a **registry** (Eureka server, Consul) and send heartbeats; clients query it for healthy instances of a logical name. `lb://account-service` (gateway) or `http://account-service` (a `@LoadBalanced` client) is resolved by **Spring Cloud LoadBalancer**, which caches the instance list and picks one (round robin default, others pluggable). See [service discovery](lesson:microservice-patterns#discovery) for the pattern.

On **Kubernetes** the Service object and cluster DNS already give discovery and balancing, so the idiomatic setup is plain `http://ledger-service` calls with no Eureka; Spring Cloud Kubernetes can read ConfigMaps and endpoints if needed. Be aware kube-proxy balances per TCP connection, so long-lived HTTP/2 or gRPC connections can pin to one pod unless you use a mesh or client-side balancing.

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

OpenFeign (`@FeignClient`) offers a similar declarative style with Spring Cloud integration. Whatever the client: **always set connect and read timeouts**, propagate the correlation id and security token, map error responses to exceptions, and wrap the call with resilience (below). `WebClient` is the non-blocking option for reactive code.

## Configuration {#config}

**Spring Cloud Config Server** serves properties from a Git repository (or Vault, JDBC) to services by application name and profile; clients import them with `spring.config.import=optional:configserver:http://config:8888`. Config in Git is versioned and auditable. Values reach running instances through `@RefreshScope` beans and `POST /actuator/refresh` (or Spring Cloud Bus to broadcast); otherwise restart.

Cautions: the config server becomes a startup dependency (make it highly available, or use `optional:` and fallbacks); never keep secrets in plain Git (encrypt, or use Vault or Kubernetes Secrets); and on Kubernetes prefer **ConfigMaps and Secrets** mounted as files or environment variables, which Boot reads natively ([property precedence](lesson:spring-boot#precedence)).

## Resilience4j {#resilience}

### The decorators {#decorators}

| Decorator | Protects against | Key settings |
| --- | --- | --- |
| **Circuit breaker** | repeatedly calling a failing dependency | `failureRateThreshold`, `slidingWindowSize`, `waitDurationInOpenState`, `permittedNumberOfCallsInHalfOpenState` |
| **Retry** | transient failures | `maxAttempts`, `waitDuration`, exponential backoff, which exceptions retry |
| **Time limiter** | calls that hang | `timeoutDuration` |
| **Bulkhead** | one dependency consuming all threads or connections | `maxConcurrentCalls` (semaphore) or a thread-pool bulkhead |
| **Rate limiter** | overloading yourself or a downstream | `limitForPeriod`, `limitRefreshPeriod` |

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

The annotations are **AOP proxies** ([AOP and proxies](lesson:spring-aop)), so self-invocation bypasses them. Default decoration order (outer to inner): **Retry, CircuitBreaker, RateLimiter, TimeLimiter, Bulkhead**.

### Using them safely {#safely}

- **Only retry idempotent operations** (GET, or POST with an idempotency key), use **exponential backoff with jitter**, and cap attempts; retries multiply load on a struggling service (retry storms).
- **Timeouts first:** a circuit breaker without timeouts waits for hung calls. Set a client timeout shorter than the caller's own deadline.
- **Fallbacks must be safe:** return cached or default data, queue the work, or fail clearly. Never let a fallback silently report success for a payment.
- **Do not count business errors as failures:** `ignoreExceptions` for expected 4xx or domain exceptions, so the breaker reacts only to infrastructure faults.
- **Monitor** the breaker state and metrics through Actuator and Micrometer, and alert when breakers open.
- Combine with [timeouts, bulkheads and load shedding](lesson:microservice-patterns#circuit-breaker); resilience is layered, not one annotation.

## Other Spring Cloud pieces {#others}

- **Distributed tracing:** Micrometer Tracing with an OpenTelemetry or Zipkin exporter adds trace and span ids to logs and propagates them across HTTP and messaging.
- **Spring Cloud Stream:** a binder abstraction over Kafka or RabbitMQ with functional `Consumer`/`Function`/`Supplier` beans ([messaging](lesson:messaging)).
- **Spring Cloud Contract:** consumer-driven contract tests so provider changes do not silently break consumers.
- **Spring Cloud Kubernetes**, **Spring Cloud Vault**, **Spring Cloud Task** for short-lived jobs.
- **Service mesh (Istio, Linkerd)** moves retries, mTLS, traffic shifting and observability out of application code; evaluate it against library-based resilience rather than using both for the same job.

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Gateway | Spring Cloud Gateway: routes = predicate + filters + uri; reactive |
| Edge filters | JWT, rate limit, correlation id, retry; no business logic |
| Discovery | Eureka or Consul; on Kubernetes, Services and DNS |
| Load balancing | Spring Cloud LoadBalancer, client side, `lb://name` |
| HTTP clients | `RestClient`, `@HttpExchange`, OpenFeign, `WebClient`; always set timeouts |
| Config | Config Server (Git) or ConfigMaps; `@RefreshScope`; secrets in Vault |
| Circuit breaker | closed, open (fail fast, fallback), half-open (probe) |
| Retry | only idempotent calls, backoff and jitter, capped |
| Bulkhead | limit concurrent calls per dependency |
| Order | retry, circuit breaker, rate limiter, time limiter, bulkhead |
| Proxies | annotations use AOP: no self-invocation |
| Replaced | Ribbon, Hystrix, Zuul 1 gone |

## Interview questions {#questions}

### [basic] What is Spring Cloud? {#what-q}

A set of projects that provide Spring-style implementations of common distributed-system patterns for microservices: an API gateway, service discovery and client-side load balancing, centralised configuration, circuit breakers and other resilience tools, distributed tracing integration, messaging binders and contract testing. It builds on Spring Boot and is versioned as a release train compatible with specific Boot versions.

### [basic] What does Spring Cloud Gateway do? {#gateway-q}

It is the single entry point to the services: it routes requests to the right service using predicates (path, header, method), and applies filters for authentication, rate limiting, retries, path rewriting, correlation ids and more. It is built on Spring WebFlux and Netty. It should hold edge policy, not business logic.

### [basic] What is service discovery and how do you do it in Spring? {#discovery-q}

Services register their address under a logical name with a registry (Eureka, Consul) and clients look up healthy instances instead of using fixed addresses, because instances scale and move. In Spring a `@LoadBalanced` client or `lb://name` URI uses Spring Cloud LoadBalancer to resolve and choose an instance. On Kubernetes, Services and DNS replace the registry.

### [basic] What are the states of a circuit breaker? {#states-q}

Closed: calls pass and failures are counted in a sliding window. Open: after the failure rate exceeds the threshold, calls fail immediately (or use a fallback) without hitting the dependency for a wait period. Half-open: a few trial calls test the dependency; success closes the breaker, failure opens it again.

### [basic] Which library replaced Hystrix and Ribbon? {#replaced-q}

Resilience4j replaced Hystrix (circuit breaker, retry, bulkhead, rate limiter, time limiter; lightweight and functional) and Spring Cloud LoadBalancer replaced Ribbon for client-side load balancing. Zuul 1 was replaced by Spring Cloud Gateway.

### [intermediate] Do you still need Eureka and Spring Cloud Config on Kubernetes? {#k8s-q}

Usually not. Kubernetes Services and DNS provide discovery and load balancing, ConfigMaps and Secrets provide configuration (read by Boot through environment variables or mounted files), and rolling updates and probes replace registry heartbeats. You still use Spring Cloud for the gateway, Resilience4j and tracing. Keep Eureka or Config Server when running outside Kubernetes or when you need their specific features (Git-backed config with refresh).

### [intermediate] How do you make a call to another service resilient? {#resilient-q}

Set connect and read timeouts, wrap the call with a circuit breaker, a bounded retry (idempotent calls only, exponential backoff with jitter), a bulkhead to limit concurrency, and provide a safe fallback. Propagate the correlation id and deadline, monitor breaker metrics, and test failure behaviour (chaos or fault injection).

### [intermediate] In what order are Resilience4j decorators applied? {#order-q}

Outermost to innermost by default: Retry, CircuitBreaker, RateLimiter, TimeLimiter, Bulkhead. Retry is outside the breaker so each attempt is recorded by it, and a time limiter or bulkhead acts closest to the call. The order is configurable (aspect order properties) and matters, for example retry must wrap the breaker and a transaction.

### [intermediate] When should you not retry a call? {#retry-q}

When it is not idempotent (a payment POST without an idempotency key could be applied twice), when the failure is a client error (4xx) that will not change, when the dependency is overloaded (retries amplify the problem; use backoff, jitter and the circuit breaker), or when the caller's deadline is nearly reached. Cap attempts and budget retries across the call chain.

### [intermediate] How do you propagate security and tracing between services? {#propagate-q}

Pass the access token (token relay in Gateway, or an interceptor on `RestClient`/Feign copying the `Authorization` header, or exchange it for a service token), and the trace context (Micrometer Tracing propagates W3C `traceparent` headers over HTTP and messaging automatically for instrumented clients) plus a correlation id in the logging MDC.

### [intermediate] How do you refresh configuration without restarting? {#refresh-q}

Mark beans with `@RefreshScope` (or use `@ConfigurationProperties` rebinding) and call `POST /actuator/refresh` on each instance, or publish a refresh event through Spring Cloud Bus (a message broker) to all instances, often triggered by a Git webhook. Not every property is refreshable (a data source URL needs a restart). On Kubernetes a rolling restart after changing a ConfigMap is a common, simpler approach.

### [intermediate] What is the difference between client-side and server-side load balancing? {#lb-q}

Client-side: the caller gets the instance list from the registry and chooses one itself (Spring Cloud LoadBalancer), allowing smart policies without an extra hop. Server-side: the caller talks to a load balancer or Kubernetes Service that picks an instance (kube-proxy, cloud load balancer). Server-side is simpler for clients; client-side balances per request rather than per connection.

### [deep] What problems can a circuit breaker introduce? {#breaker-problems-q}

Misconfigured thresholds that trip on normal errors or never trip, counting business or 4xx errors as failures, a fallback that hides serious failures or returns wrong data, a breaker per method instead of per dependency, one shared breaker for unrelated endpoints, and lack of monitoring so an open breaker goes unnoticed. Mitigate by tuning per dependency, ignoring expected exceptions, making fallbacks explicit and alerting on state changes.

### [deep] How would you protect a service from a slow dependency exhausting its threads? {#bulkhead-q}

Combine timeouts (shorter than the caller's deadline), a bulkhead limiting concurrent calls to that dependency (semaphore or a separate thread pool) so the rest of the service keeps working, a circuit breaker to fail fast once it is clearly unhealthy, and where possible asynchronous or queue-based integration. Virtual threads reduce thread cost but not the load on the dependency or the connection limits.

### [deep] Why keep logic out of the API gateway? {#gateway-logic-q}

A gateway that holds orchestration or business rules becomes a coupled, hard-to-change bottleneck owned by no single domain team, and a single point of failure for every release. Keep it to cross-cutting edge concerns (authentication, rate limits, routing, aggregation for a client in a BFF), and let services own business logic.

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

Explain that the filter trips on failures or timeouts, the fallback gives a clear 503 instead of hanging, and the breaker settings come from the Resilience4j configuration.

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

Explain that this is a read-only idempotent call so retry is safe, the fallback signature adds a `Throwable`, a missing pair (business error) is ignored by the breaker, and the call must go through the proxy (another bean).

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

Explain that the interface gives a typed, mockable client, the proxy factory implements it, and explicit connect and read timeouts prevent a slow dependency from holding threads (add the load balancer annotation or builder for discovery).
