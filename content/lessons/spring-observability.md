---
title: Observability in Spring Boot — Actuator, Micrometer, tracing, logging and health probes
nav: Observability and Actuator
slug: spring-observability
summary: The three pillars of observability in a Spring Boot service, Actuator endpoints and health probes, Micrometer metrics and custom meters, distributed tracing with OpenTelemetry, structured logging and correlation ids, SLOs and alerting, with Java examples and interview questions.
tags: [Spring, Observability, Actuator, Micrometer, Tracing, Logging, Metrics]
order: 49
topic: Spring / Production
updated: 2026-11-13
subnav: true
---

"How do you know your service is healthy, and how do you debug a slow request across five services?" is the production-readiness question. Interviewers expect: *the three pillars (logs, metrics, traces), what Actuator exposes, how Micrometer works, how a trace id travels between services, what liveness and readiness mean, and what you would alert on.* It builds on [Spring Boot](lesson:spring-boot#actuator) (Actuator basics), [Spring Cloud](lesson:spring-cloud) and the [microservice patterns](lesson:microservice-patterns) (distributed tracing, health checks). Play the three scenes: a distributed trace, metrics to alerts, and health probes.

```demo
name: spring-obs-walk
```

> **One sentence to remember:** *metrics tell you something is wrong, traces tell you where, logs tell you why, and all three must share a correlation id so you can move between them.*

## The three pillars {#pillars}

| Pillar | Answers | Spring tooling | Typical backend |
| --- | --- | --- | --- |
| **Metrics** | is it healthy, how much, how fast (aggregated numbers over time) | Micrometer + Actuator | Prometheus, Grafana, Datadog |
| **Traces** | where did the time go in this one request across services | Micrometer Tracing (OpenTelemetry, Brave) | Tempo, Zipkin, Jaeger |
| **Logs** | what exactly happened (events with context) | SLF4J + Logback, structured JSON | Loki, ELK, CloudWatch |

Observability is the ability to ask new questions about a running system from its outputs, without shipping new code. **Monitoring** watches known failure modes; observability helps with unknown ones.

## Actuator {#actuator}

`spring-boot-starter-actuator` adds operational endpoints under `/actuator`:

| Endpoint | Shows |
| --- | --- |
| `health` | status with details; liveness and readiness groups |
| `info` | build and git info |
| `metrics`, `prometheus` | Micrometer metrics (the second in Prometheus text format) |
| `env`, `configprops`, `beans`, `mappings`, `conditions` | configuration and wiring (sensitive) |
| `loggers` | view and **change log levels at runtime** |
| `threaddump`, `heapdump` | diagnostics (very sensitive) |
| `httpexchanges`, `scheduledtasks`, `caches`, `flyway` | feature-specific |

```yaml
management:
  endpoints.web.exposure.include: health,info,metrics,prometheus
  endpoint.health:
    probes.enabled: true
    show-details: when-authorized
  server.port: 9090                       # separate management port, not exposed publicly
```

Expose only what you need, **secure the rest** (authentication, a management port bound to an internal network); `env`, `heapdump` and `beans` leak secrets and structure. Never expose all endpoints on the public port.

### Health and probes {#health}

```java
@Component
class LedgerHealthIndicator implements HealthIndicator {
    private final LedgerClient ledger;
    LedgerHealthIndicator(LedgerClient ledger) { this.ledger = ledger; }

    @Override public Health health() {
        try { ledger.ping(); return Health.up().build(); }
        catch (Exception e) { return Health.down(e).build(); }
    }
}
```

- **Liveness** (`/actuator/health/liveness`): the process is running; if it fails the platform **restarts** the container. Keep it simple: no external dependencies in it, or a database outage restarts every pod.
- **Readiness** (`/actuator/health/readiness`): the instance can take traffic; if it fails the platform **stops routing** to it without restarting. It can include dependencies it cannot work without, and it goes DOWN first on graceful shutdown (`server.shutdown=graceful`).
- A **startup probe** covers slow starts. Custom indicators check dependencies; keep them fast and cached. Group them with `management.endpoint.health.group.readiness.include=readinessState,db`.

## Metrics with Micrometer {#metrics}

**Micrometer** is the metrics facade (like SLF4J for metrics) with registries for Prometheus, Datadog, CloudWatch and others. Boot instruments the JVM (memory, GC, threads), HTTP server and client requests, the connection pool, caches, and Kafka or Rabbit clients.

```java
@Service
class TransferService {
    private final Counter completed;
    private final Timer latency;

    TransferService(MeterRegistry registry) {
        this.completed = Counter.builder("transfers.completed").tag("type", "domestic").register(registry);
        this.latency = Timer.builder("transfers.latency").publishPercentiles(0.95, 0.99).register(registry);
    }

    void transfer(...) {
        latency.record(() -> doTransfer());
        completed.increment();
    }
}
```

| Meter | Use |
| --- | --- |
| **Counter** | only goes up: requests, errors, transfers completed |
| **Gauge** | a current value: queue depth, pool usage |
| **Timer** | duration and count (latency histograms, percentiles) |
| **DistributionSummary** | sizes of things (payload bytes, amounts) |

- **Tags (labels)** must be **low cardinality** (status, type, outcome). A user id, account number or URL with ids as a tag creates millions of time series and crashes the metrics backend.
- **Percentiles, not averages:** p95 and p99 latency show the tail users feel; averages hide it. Use histograms (`management.metrics.distribution.percentiles-histogram`) so percentiles can be aggregated across instances.
- Monitor the **four golden signals**: latency, traffic, errors, saturation. For services: the **RED** method (rate, errors, duration); for resources: **USE** (utilisation, saturation, errors).

## Distributed tracing {#tracing}

A **trace** is the whole journey of one request; it is a tree of **spans** (one per operation, with start, duration, tags). A **trace id** is shared by all spans and a **span id** identifies each. Spring Boot 3 uses **Micrometer Tracing** with an **OpenTelemetry** or Brave bridge and an exporter (OTLP, Zipkin).

- The trace context travels in the **W3C `traceparent`** header on HTTP calls and in message headers for Kafka and RabbitMQ; instrumented clients (`RestClient`, `WebClient`, JDBC, messaging) add and read it automatically.
- Trace and span ids are put into the **MDC**, so every log line carries `traceId` and `spanId`: from a slow trace you jump straight to the logs of that request.
- **Sampling** limits cost: trace a percentage (`management.tracing.sampling.probability=0.1`) plus all errors and slow requests (tail-based sampling in the collector).
- Add business context as span tags (low cardinality), propagate through async boundaries (executors need context propagation), and keep baggage small.

The **Observation API** (Spring Framework 6) unifies this: instrument an operation once (`@Observed` or `ObservationRegistry`) and handlers emit a timer metric, a span and log context from the same observation.

## Logging {#logging}

- **SLF4J** API with **Logback** (Boot default). Use parameterised messages (`log.info("Transfer {} done", id)`), appropriate levels, and never log secrets, full card numbers or personal data (mask them).
- **Structured logging** (JSON; Boot 3.4 supports it natively with `logging.structured.format.console=ecs`) so fields are searchable: `traceId`, `userId`, `accountId`, `outcome`.
- **Correlation id:** a filter puts an id in the MDC (and returns it in a response header), or the tracing id does it; services propagate it downstream ([filter example](lesson:spring-mvc#q-coding-filter)).
- **Levels at runtime:** change with `POST /actuator/loggers/com.bank` while investigating, then revert; avoid DEBUG in production by default.
- **Log events, not noise:** one line per significant event with context, no logging inside tight loops, log an exception once (where it is handled), and keep audit logs separate and tamper-evident for regulated domains.
- **Ship to a central store** (stdout collected by the platform; ELK, Loki, CloudWatch); do not write log files inside containers.

## Alerting and SLOs {#alerting}

- Define **SLIs** (measurements such as the share of successful requests under 500 ms) and **SLOs** (targets, 99.9 percent over 30 days). The remaining **error budget** guides how risky releases may be.
- **Alert on symptoms users feel** (error rate, latency, saturation, queue backlog, failed payments) and on SLO burn rate, not on every cause (a single CPU spike). Each alert needs an owner, a **runbook** and links to dashboards and traces. Too many alerts cause alert fatigue.
- Business metrics matter: payments completed per minute, settlement lag, reconciliation breaks, dead-letter queue size.
- Include **synthetic checks** and dependency metrics (circuit breaker state, pool saturation, consumer lag).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Pillars | metrics (what), traces (where), logs (why) |
| Actuator | `/actuator/health`, `metrics`, `prometheus`, `loggers`; expose few, secure the rest |
| Liveness | restart if stuck; no external dependencies |
| Readiness | route traffic only when able; includes needed dependencies |
| Micrometer | counter, gauge, timer, summary; vendor-neutral facade |
| Tags | low cardinality only |
| Latency | percentiles (p95, p99), not averages |
| Trace | trace id for the journey, span id per operation; W3C `traceparent` |
| Correlation | trace id in MDC and logs and response headers |
| Logging | structured JSON, no secrets, one place per exception |
| Alerts | symptoms and SLO burn, with runbooks |
| Golden signals | latency, traffic, errors, saturation |

## Interview questions {#questions}

### [basic] What is observability and what are its pillars? {#pillars-q}

The ability to understand a system's internal state from its outputs. The pillars are metrics (aggregated numbers over time, for alerting and trends), traces (the path and timing of one request across services) and logs (detailed event records). Correlating them by a trace id lets you go from an alert to the slow request to the exact log lines.

### [basic] What is Spring Boot Actuator? {#actuator-q}

A starter that exposes production-ready endpoints: health, info, metrics, Prometheus, loggers, environment, thread dump and more under `/actuator`. By default only health is exposed over HTTP; others must be enabled deliberately and secured because several reveal sensitive configuration.

### [basic] What is Micrometer? {#micrometer-q}

A vendor-neutral metrics facade for JVM applications, comparable to SLF4J for logging. You record counters, gauges, timers and summaries once, and a registry exports them to Prometheus, Datadog, CloudWatch and others. Spring Boot auto-instruments the JVM, HTTP, data source and more with it.

### [basic] What is the difference between liveness and readiness probes? {#probes-q}

Liveness answers "is the process alive?": failure makes the platform restart the container. Readiness answers "can it serve traffic now?": failure removes the instance from the load balancer without restarting. Include dependencies in readiness, not in liveness, or a downstream outage restarts every instance.

### [intermediate] How does distributed tracing work across services? {#tracing-q}

The first service creates a trace id and span; when it calls another service, instrumented clients add the trace context to the request (W3C `traceparent` header, or message headers for brokers). The callee extracts it and creates a child span in the same trace. Each service exports its spans to a backend that assembles the tree with timings. Ids in the MDC link traces to logs.

### [intermediate] What are metric tags and why must their cardinality be low? {#cardinality-q}

Tags (labels) create a separate time series for each unique combination of values. Tags such as status, method or outcome have a handful of values. A user id, account number or raw URL has unbounded values and produces millions of series, exhausting memory and cost in the metrics backend. Put high-cardinality detail in logs and traces.

### [intermediate] Why use percentiles instead of averages for latency? {#percentiles-q}

An average hides the slow tail: 99 requests at 50 ms and one at 5 s average to about 100 ms while one user waits 5 seconds. p95 and p99 show what the worst-affected users experience, and SLOs are normally expressed in percentiles. Use histograms so percentiles can be aggregated across instances.

### [intermediate] How do you correlate the logs of a single request across services? {#correlation-q}

Generate or accept a correlation id (or use the trace id) at the edge, put it in the logging MDC for every log line, send it on all downstream calls and messages, and return it in a response header. Then search the central log store for that id to see the request's whole path.

### [intermediate] What would you alert on for a payments service? {#alerts-q}

Symptoms users feel and that matter to the business: error rate and latency percentiles breaching SLOs (burn rate), failed or stuck payments, dead-letter queue growth, consumer lag, reconciliation differences, plus saturation signals (connection pool, thread pool, queue depth). Each alert has an owner and runbook. Avoid alerting on every internal cause.

### [intermediate] How do you secure Actuator endpoints? {#secure-q}

Expose only needed endpoints (`management.endpoints.web.exposure.include`), put them on a separate management port reachable only internally, require authentication and authorisation for sensitive ones (Spring Security with a dedicated role), mask sensitive values, and avoid `heapdump`, `env` and `shutdown` in production unless protected.

### [deep] How would you debug a request that is slow only sometimes? {#slow-q}

Start from metrics to confirm the percentile and affected endpoint, find sample slow traces (exemplars, or tail-based sampling that keeps slow requests), identify the slow span (database, downstream call, lock wait, GC pause), then read that request's logs through the trace id. Check saturation (pool waits, queue depth, thread dumps) and recent deploys or dependency changes.

### [deep] What is the Observation API in Spring 6? {#observation-q}

A single instrumentation abstraction (from Micrometer) where you start and stop an observation around an operation (or annotate with `@Observed`) with low- and high-cardinality key values. Registered handlers turn it into a timer metric, a tracing span and log context at once, so code is instrumented once. Spring MVC, WebClient, RestClient, JDBC and messaging already use it in Boot 3.

### [deep] What is tail-based sampling and why use it? {#sampling-q}

Head-based sampling decides at the start (for example 10 percent of requests) and may miss rare failures. Tail-based sampling lets a collector buffer a whole trace and decide after it finishes, keeping all traces with errors or high latency plus a sample of the rest. It keeps cost down while preserving the traces you need.

### [coding] Add a business counter and a timer, and expose a Prometheus endpoint. {#coding-meters}

```java
@Service
class PaymentService {
    private final Counter ok, failed;
    private final Timer timer;

    PaymentService(MeterRegistry registry) {
        this.ok = Counter.builder("payments.processed").tag("outcome", "success").register(registry);
        this.failed = Counter.builder("payments.processed").tag("outcome", "failure").register(registry);
        this.timer = Timer.builder("payments.duration").publishPercentileHistogram().register(registry);
    }

    PaymentResult pay(PaymentRequest r) {
        return timer.record(() -> {
            try { PaymentResult res = gateway.pay(r); ok.increment(); return res; }
            catch (RuntimeException e) { failed.increment(); throw e; }
        });
    }
}
```

```yaml
management.endpoints.web.exposure.include: health,prometheus
```

Explain the low-cardinality `outcome` tag, the timer histogram for percentiles, and the scrape endpoint `/actuator/prometheus`.

### [coding] Write a custom health indicator and group it into readiness. {#coding-health}

```java
@Component("ledger")
class LedgerHealth implements HealthIndicator {
    private final LedgerClient client;
    LedgerHealth(LedgerClient client) { this.client = client; }

    @Override public Health health() {
        try { return Health.up().withDetail("latencyMs", client.ping()).build(); }
        catch (Exception e) { return Health.down().withDetail("error", e.getClass().getSimpleName()).build(); }
    }
}
```

```yaml
management:
  endpoint.health:
    probes.enabled: true
    group.readiness.include: readinessState,db,ledger
    group.liveness.include: livenessState
```

Explain that readiness includes the dependencies needed to serve, liveness only the process state, and the details help diagnosis without leaking secrets.

### [coding] Add a correlation id to every request and to the logs. {#coding-mdc}

```java
@Component
class CorrelationFilter extends OncePerRequestFilter {
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String id = Optional.ofNullable(req.getHeader("X-Correlation-Id")).filter(s -> !s.isBlank()).orElse(UUID.randomUUID().toString());
        MDC.put("correlationId", id);
        res.setHeader("X-Correlation-Id", id);
        try { chain.doFilter(req, res); } finally { MDC.remove("correlationId"); }
    }
}
```

```xml
<!-- logback pattern: %d %-5level [%X{correlationId}] %logger - %msg%n -->
```

Explain that the filter reads or generates the id, the MDC makes it appear in every line of that request, it is returned to the caller, and downstream clients must copy it into their outgoing headers (or rely on trace propagation).
