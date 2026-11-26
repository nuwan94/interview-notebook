---
title: Observability in Spring Boot — Actuator, Micrometer, tracing, logging and health probes
nav: Observability and Actuator
slug: spring-observability
summary: The three pillars of observability in a Spring Boot service, Actuator endpoints and health probes, Micrometer metrics and custom meters, distributed tracing with OpenTelemetry, structured logging and correlation ids, SLOs and alerting, with Java examples and interview questions.
tags: [Spring, Observability, Actuator, Micrometer, Tracing, Logging, Metrics]
order: 92
topic: Spring / Production and quality
updated: 2026-11-26
subnav: true
---

The production-readiness question is: "How do you know your service is healthy, and how do you debug a slow request across five services?" Interviewers expect you to explain:

- the three pillars: logs, metrics and traces,
- what Actuator exposes,
- how Micrometer works,
- how a trace id travels between services,
- what liveness and readiness mean,
- what you would alert on.

This lesson builds on [Spring Boot](lesson:spring-boot#actuator) (Actuator basics), [Spring Cloud](lesson:spring-cloud) and the [microservice patterns](lesson:microservice-patterns) (distributed tracing, health checks).

The demo has three scenes: a distributed trace, metrics to alerts, and health probes.

```demo
name: spring-obs-walk
```

> **One sentence to remember:** *Metrics say something is wrong, traces say where, logs say why.*

All three must share a correlation id, so you can jump from one to the others.

## The three pillars {#pillars}

| Pillar | Answers | Spring tooling | Typical backend |
| --- | --- | --- | --- |
| **Metrics** | Is it healthy? How much? How fast? (Numbers added up over time.) | Micrometer + Actuator | Prometheus, Grafana, Datadog |
| **Traces** | Where did the time go in this one request, across services? | Micrometer Tracing (OpenTelemetry, Brave) | Tempo, Zipkin, Jaeger |
| **Logs** | What exactly happened? (Events with context.) | SLF4J + Logback, structured JSON | Loki, ELK, CloudWatch |

**Observability** is the ability to ask new questions about a running system from its outputs, without shipping new code. **Monitoring** watches for failures you already know about. Observability also helps with failures you did not expect.

## Actuator {#actuator}

`spring-boot-starter-actuator` adds operational endpoints under `/actuator`. An **endpoint** here is a URL that reports on the running app.

| Endpoint | Shows |
| --- | --- |
| `health` | The status, with details. Has liveness and readiness groups. |
| `info` | Build and git information. |
| `metrics`, `prometheus` | Micrometer metrics. The second uses the Prometheus text format. |
| `env`, `configprops`, `beans`, `mappings`, `conditions` | Configuration and wiring. Sensitive. |
| `loggers` | Shows log levels, and lets you **change them at runtime**. |
| `threaddump`, `heapdump` | Diagnostics. Very sensitive. |
| `httpexchanges`, `scheduledtasks`, `caches`, `flyway` | Feature-specific details. |

```yaml
management:
  endpoints.web.exposure.include: health,info,metrics,prometheus
  endpoint.health:
    probes.enabled: true
    show-details: when-authorized
  server.port: 9090                       # separate management port, not exposed publicly
```

Expose only what you need, and **secure the rest**: require authentication, and bind a separate management port to an internal network. `env`, `heapdump` and `beans` leak secrets and the app's structure. Never expose all endpoints on the public port.

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

A **probe** is a check the platform (such as Kubernetes) runs against your app again and again.

- **Liveness** (`/actuator/health/liveness`) says the process is running. If it fails, the platform **restarts** the container. Keep it simple, with no external dependencies. Otherwise a database outage restarts every pod.
- **Readiness** (`/actuator/health/readiness`) says the instance can take traffic. If it fails, the platform **stops routing** to it, without a restart. It can include dependencies the app cannot work without. It goes DOWN first on a graceful shutdown (`server.shutdown=graceful`).
- A **startup probe** covers slow starts. The details, tuning and failure modes are in [Kubernetes probes](lesson:kubernetes-probes).

Custom health indicators check dependencies. Keep them fast, and cache their results. Group them with `management.endpoint.health.group.readiness.include=readinessState,db`.

## Metrics with Micrometer {#metrics}

**Micrometer** is a metrics facade: one API, like SLF4J is for logging. Its **registries** send the numbers to Prometheus, Datadog, CloudWatch and others.

Spring Boot measures many things for you: the JVM (memory, GC, threads), HTTP server and client requests, the connection pool, caches, and Kafka or Rabbit clients.

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
| **Counter** | Only goes up: requests, errors, transfers completed. |
| **Gauge** | A current value: queue depth, pool usage. |
| **Timer** | Duration and count: latency histograms and percentiles. |
| **DistributionSummary** | Sizes of things: payload bytes, amounts. |

- **Tags (labels)** must have **low cardinality**: only a few possible values, such as status, type or outcome. A tag with a user id, an account number or a URL containing ids creates millions of time series. That can crash the metrics backend.
- **Use percentiles, not averages.** p95 and p99 latency show the slow tail that users feel. Averages hide it. Use histograms (`management.metrics.distribution.percentiles-histogram`), so percentiles can be combined across instances.
- Monitor the **four golden signals**: latency, traffic, errors and saturation. For services, use the **RED** method: rate, errors, duration. For resources, use **USE**: utilisation, saturation, errors.

## Distributed tracing {#tracing}

A **trace** is the whole journey of one request. It is a tree of **spans**: one per operation, each with a start, a duration and tags.

- A **trace id** is shared by all the spans of one request.
- A **span id** identifies each span.

Spring Boot 3 uses **Micrometer Tracing**, with an **OpenTelemetry** or Brave bridge, and an exporter (OTLP, Zipkin) that sends the spans out.

- The trace context travels in the **W3C `traceparent`** header on HTTP calls, and in message headers for Kafka and RabbitMQ. Instrumented clients (`RestClient`, `WebClient`, JDBC, messaging) add and read it automatically.
- Trace and span ids are put into the **MDC** (the logging context), so every log line carries `traceId` and `spanId`. From a slow trace, you jump straight to the logs of that request.
- The full picture (span model, propagation, OpenTelemetry Collector, tail sampling, reading a waterfall) is in the [distributed tracing lesson](lesson:distributed-tracing).
- **Sampling** limits cost. Trace a percentage of requests (`management.tracing.sampling.probability=0.1`), plus all errors and slow requests (tail-based sampling in the collector).
- Add business context as span tags, with low cardinality.
- Carry the context across async boundaries: executors need context propagation.
- Keep baggage (extra values sent along with the trace) small.

The **Observation API** (Spring Framework 6) brings this together. You instrument an operation once, with `@Observed` or `ObservationRegistry`. Handlers then produce a timer metric, a span and log context from that one observation.

## Logging {#logging}

- **API:** the **SLF4J** API with **Logback**, the Boot default. The [logging lesson](lesson:java-logging) covers levels, MDC, JSON logs and Log4j 2 in depth.
  - Use parameterised messages: `log.info("Transfer {} done", id)`.
  - Use the right levels.
  - Never log secrets, full card numbers or personal data. Mask them.
- **Structured logging:** write logs as JSON, so fields such as `traceId`, `userId`, `accountId` and `outcome` are searchable. Boot 3.4 supports it natively with `logging.structured.format.console=ecs`.
- **Correlation id:** a filter puts an id in the MDC and returns it in a response header. Or the tracing id does this job. Services pass it on to the services they call ([filter example](lesson:spring-mvc#q-coding-filter)).
- **Levels at runtime:** change a level with `POST /actuator/loggers/com.bank` while investigating, then change it back. Avoid DEBUG in production by default.
- **Log events, not noise:**
  - one line per significant event, with context,
  - no logging inside tight loops,
  - log an exception once, where it is handled,
  - in regulated domains, keep audit logs separate and tamper-evident.
- **Ship logs to a central store** (ELK, Loki, CloudWatch). Write to stdout and let the platform collect it. Do not write log files inside containers.

## Alerting and SLOs {#alerting}

- An **SLI** (service level indicator) is a measurement, such as the share of successful requests under 500 ms.
- An **SLO** (service level objective) is a target for it, such as 99.9 percent over 30 days.
- The **error budget** is the failure the SLO still allows. What is left of it decides how risky releases may be.
- **Alert on symptoms users feel**: error rate, latency, saturation, queue backlog, failed payments. Also alert on how fast the SLO budget burns. Do not alert on every cause, such as a single CPU spike.
- Each alert needs an owner, a **runbook** (steps to follow) and links to dashboards and traces. Too many alerts cause alert fatigue: people stop reacting.
- Business metrics matter too: payments completed per minute, settlement lag, reconciliation breaks, dead-letter queue size.
- Add **synthetic checks** (fake requests that test the service from outside) and dependency metrics: circuit breaker state, pool saturation, consumer lag.

Try it in the lab: [One request, three signals: logs, metrics, traces](lab:observability-trace-flow).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Pillars | Metrics (what), traces (where), logs (why). |
| Actuator | `/actuator/health`, `metrics`, `prometheus`, `loggers`. Expose few, secure the rest. |
| Liveness | Restart if stuck. No external dependencies. |
| Readiness | Route traffic only when able. Includes the dependencies it needs. |
| Micrometer | Counter, gauge, timer, summary. A vendor-neutral facade. |
| Tags | Low cardinality only. |
| Latency | Percentiles (p95, p99), not averages. |
| Trace | A trace id for the journey, a span id per operation. W3C `traceparent`. |
| Correlation | The trace id in the MDC, the logs and the response headers. |
| Logging | Structured JSON, no secrets, each exception logged in one place. |
| Alerts | On symptoms and SLO burn, with runbooks. |
| Golden signals | Latency, traffic, errors, saturation. |

## Interview questions {#questions}

### [basic] What is observability and what are its pillars? {#pillars-q}

It is the ability to understand a system's internal state from its outputs. The pillars are:

- **metrics:** numbers added up over time, for alerts and trends,
- **traces:** the path and timing of one request across services,
- **logs:** detailed records of events.

Linking them by a trace id takes you from an alert, to the slow request, to the exact log lines.

### [basic] What is Spring Boot Actuator? {#actuator-q}

It is a starter that adds production-ready endpoints under `/actuator`: health, info, metrics, Prometheus, loggers, environment, thread dump and more.

By default only health is exposed over HTTP. You must turn the others on deliberately, and secure them, because several reveal sensitive configuration.

### [basic] What is Micrometer? {#micrometer-q}

It is a vendor-neutral metrics facade for JVM applications, like SLF4J is for logging.

You record counters, gauges, timers and summaries once. A registry exports them to Prometheus, Datadog, CloudWatch or others. Spring Boot uses it to measure the JVM, HTTP, the data source and more, automatically.

### [basic] What is the difference between liveness and readiness probes? {#probes-q}

**Liveness** answers "is the process alive?". If it fails, the platform restarts the container.

**Readiness** answers "can it serve traffic now?". If it fails, the instance is removed from the load balancer, without a restart.

Include dependencies in readiness, not in liveness. Otherwise an outage further down restarts every instance.

### [intermediate] How does distributed tracing work across services? {#tracing-q}

1. The first service creates a trace id and a span.
2. When it calls another service, instrumented clients add the trace context to the request: the W3C `traceparent` header, or message headers for brokers.
3. The called service reads it and creates a child span in the same trace.
4. Each service exports its spans to a backend, which builds the tree with timings.

The ids in the MDC link traces to logs.

### [intermediate] What are metric tags and why must their cardinality be low? {#cardinality-q}

Tags (labels) create a separate time series for each unique combination of values.

- Tags such as status, method or outcome have only a few values.
- A user id, account number or raw URL has unlimited values. It produces millions of series, which uses up memory and money in the metrics backend.

Put detail with many values in logs and traces instead.

### [intermediate] Why use percentiles instead of averages for latency? {#percentiles-q}

An average hides the slow tail. For example, 99 requests at 50 ms and one at 5 s average about 100 ms, but one user waits 5 seconds.

p95 and p99 show what the worst-affected users experience, and SLOs are normally written in percentiles. Use histograms, so percentiles can be combined across instances.

### [intermediate] How do you correlate the logs of a single request across services? {#correlation-q}

1. At the edge, accept a correlation id or create one. The trace id can play this role.
2. Put it in the logging MDC, so it appears on every log line.
3. Send it on every call and message to other services.
4. Return it in a response header.

Then search the central log store for that id, to see the request's whole path.

### [intermediate] What would you alert on for a payments service? {#alerts-q}

Alert on symptoms that users feel and that matter to the business:

- error rate and latency percentiles breaking the SLOs (burn rate),
- failed or stuck payments,
- a growing dead-letter queue,
- consumer lag,
- reconciliation differences,
- saturation: connection pool, thread pool, queue depth.

Each alert has an owner and a runbook. Do not alert on every internal cause.

### [intermediate] How do you secure Actuator endpoints? {#secure-q}

- Expose only the endpoints you need (`management.endpoints.web.exposure.include`).
- Put them on a separate management port that only the internal network can reach.
- Require authentication and authorisation for sensitive ones: Spring Security with a dedicated role.
- Mask sensitive values.
- Avoid `heapdump`, `env` and `shutdown` in production unless they are protected.

### [deep] How would you debug a request that is slow only sometimes? {#slow-q}

1. Use metrics to confirm which percentile is slow, and which endpoint.
2. Find sample slow traces: exemplars, or tail-based sampling that keeps slow requests.
3. Find the slow span: database, a call to another service, a lock wait, a GC pause.
4. Read that request's logs through the trace id.

Also check saturation (pool waits, queue depth, thread dumps), and recent deploys or dependency changes.

### [deep] What is the Observation API in Spring 6? {#observation-q}

It is one instrumentation API, from Micrometer. You start and stop an observation around an operation, or annotate it with `@Observed`. You attach key values with low or high cardinality.

Registered handlers turn the observation into a timer metric, a tracing span and log context, all at once. So the code is instrumented only once. In Boot 3, Spring MVC, WebClient, RestClient, JDBC and messaging already use it.

### [deep] What is tail-based sampling and why use it? {#sampling-q}

**Head-based sampling** decides at the start, for example "keep 10 percent of requests". It can miss rare failures.

**Tail-based sampling** lets a collector hold a whole trace and decide after it finishes. It keeps every trace with errors or high latency, plus a sample of the rest.

That keeps cost down, and still keeps the traces you need.

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

Explain these points:

- The `outcome` tag has low cardinality.
- The timer histogram allows percentiles.
- Prometheus scrapes the endpoint `/actuator/prometheus`.

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

Explain these points:

- Readiness includes the dependencies needed to serve.
- Liveness includes only the process state.
- The details help diagnosis without leaking secrets.

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

Explain these points:

- The filter reads the id, or creates one.
- The MDC makes it appear on every log line of that request.
- It is returned to the caller.
- Clients calling other services must copy it into their outgoing headers, or rely on trace propagation.
