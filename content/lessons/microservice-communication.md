---
title: Service communication and the API gateway — REST, gRPC, events, BFF, contracts and versioning
nav: Communication and API gateway
slug: microservice-communication
summary: How microservices talk to each other and to clients: synchronous vs asynchronous, REST vs gRPC vs GraphQL vs events, API gateway and backend for frontend, API composition, contracts, backward compatibility and versioning, consumer-driven contract tests, error models, service discovery, and communication anti-patterns, with Java examples and interview questions.
tags: [Microservices, REST, gRPC, API gateway, BFF, Versioning, Contracts, Service discovery, Spring Cloud Gateway]
order: 27
topic: Microservices / Communication
updated: 2026-11-14
subnav: true
---

"How do your services talk to each other?" opens a long list of follow-ups: *REST or gRPC, why not just use events, what does the API gateway do, how do you change an API without breaking clients, how do you version it, how do you find other services, and what does a failed call look like to the caller?* This lesson answers them. It builds on [microservice patterns](lesson:microservice-patterns) (the overview) and [REST API design](lesson:rest-api-design) (the details of one HTTP API), and relates to [messaging](lesson:messaging) and [Spring messaging](lesson:spring-messaging) (the asynchronous style), [Spring Cloud](lesson:spring-cloud) (Gateway, OpenFeign, discovery), [resilience](lesson:microservice-resilience) (timeouts, retries, breakers on these calls), [Kubernetes](lesson:kubernetes) (Services and DNS), and [authentication](lesson:authn-authz) and [JWT](lesson:jwt) (what the gateway checks). Play the four scenes: REST, gRPC or events, the API gateway and BFF, contracts and versioning, and finding other services.

```demo
name: communication-walk
```

> **One sentence to remember:** *use events where an immediate answer is not needed, a typed contract such as gRPC between your own services, and REST at the edge; put one gateway in front of the clients, treat every API as a contract you change only in backward compatible steps, and let the platform find the instances.*

## Two kinds of communication {#kinds}

| | Synchronous (request and response) | Asynchronous (messages and events) |
| --- | --- | --- |
| Pattern | caller sends a request and waits | sender publishes and carries on |
| Coupling | in time: callee must be up now | loose: broker buffers |
| Latency | direct answer | eventual |
| Failure | callee down means caller fails or degrades | consumer catches up later |
| Use | queries, commands that need the result now | notifications, propagating changes, long workflows |
| Technology | REST, gRPC, GraphQL | Kafka, RabbitMQ, SQS |

Also distinguish **commands** (do this; one receiver) from **events** (this happened; any listeners), see [event sourcing](lesson:event-sourcing-cqrs). A **chain** of synchronous calls multiplies latency and failure: five services at 99.9 percent availability are about 99.5 percent together, and the slowest one sets the pace. Prefer **asynchronous events** between services where an immediate answer is not needed, keep synchronous chains short (ideally one hop), and protect every synchronous call with [timeouts, retries and breakers](lesson:microservice-resilience).

## REST, gRPC, GraphQL or events {#choices}

| | REST + JSON | gRPC | GraphQL | Events (Kafka, etc.) |
| --- | --- | --- | --- | --- |
| Best for | public and partner APIs, simple CRUD | internal service-to-service calls | flexible client queries over many sources | decoupled reactions, data propagation |
| Contract | OpenAPI (optional) | `.proto` file, required and typed | schema, required and typed | event schema (Avro, JSON Schema, Protobuf) |
| Format | text, readable | binary Protobuf, compact | JSON | any, usually Avro or JSON |
| Transport | HTTP/1.1 or 2 | HTTP/2, streaming | HTTP | broker |
| Browser | native | needs gRPC-Web | native | no |
| Caching | HTTP caching works well | harder | harder | n/a |
| Weakness | verbose, loosely typed | harder to debug, less tooling at the edge | complex queries can overload services | eventual consistency, debugging |

A common bank layout: **REST at the edge** (mobile, web, partners, through the gateway), **gRPC or REST between a few internal services** with strict latency needs, and **Kafka events** for everything that can happen afterwards (notifications, reporting, audit, search indexing).

**gRPC** generates client and server code from a `.proto` file, so the contract is explicit and checked at compile time. It supports unary calls and **streaming** in either direction, uses deadlines that propagate across calls, and is fast and compact. Its costs are binary payloads that are harder to inspect and weaker support in browsers and proxies.

**GraphQL** lets the client ask for exactly the fields it needs across several sources in one call, which suits varied front ends. It needs care: query depth and cost limits, caching, and field-level authorisation. A **federation** gateway can combine several services' schemas.

## API gateway and backend for frontend {#gateway}

An **API gateway** is the single entry point for clients. It handles cross-cutting concerns so services do not each repeat them:

- **routing** by path or header to the right service;
- **authentication** (validate the token, reject early) and coarse authorisation;
- **rate limiting** and quotas, **TLS termination**, request size limits;
- **correlation id** and access logging, metrics;
- optional **response aggregation**, caching and protocol translation (REST outside, gRPC inside).

A **backend for frontend (BFF)** is a gateway built for one kind of client (mobile BFF, web BFF, partner API) and owned by that client's team. It shapes responses for that client, for example combining three service calls into one small mobile response, so shared services are not bent to fit each screen.

**API composition** is the BFF calling several services in parallel and merging results. Rules: set a timeout on each call, run them in parallel, mark optional parts so a partial result can be returned, and keep **business rules out of the gateway**. A gateway that grows logic becomes a new monolith and a bottleneck.

Also watch for the gateway as a **single point of failure**: run several instances behind a load balancer, keep it stateless, and keep its configuration in version control. In the Spring world this is **Spring Cloud Gateway**; cloud providers and tools such as Kong, Apigee and Envoy-based gateways play the same role.

## Contracts, compatibility and versioning {#contracts}

An API is a **contract** between independently deployed teams. You cannot change it and fix every caller at once, so you change it in steps that never break a caller.

| Change | Safe? |
| --- | --- |
| add an optional field to a response | yes (if callers ignore unknown fields) |
| add a new endpoint | yes |
| accept more input or loosen a rule | yes |
| remove or rename a field | **no, breaking** |
| change a field type or the meaning of a value | **no, breaking** |
| make an optional request field required | **no, breaking** |
| add a new enum value | risky: old callers may not handle it |

**Robustness principle:** be conservative in what you send and **tolerant in what you accept**: callers should ignore unknown fields (`@JsonIgnoreProperties(ignoreUnknown = true)`, which Spring Boot's Jackson does by default).

**Versioning** is for the breaking changes that remain: version in the **path** (`/v2/payments`, the simplest and most visible), a **header**, or the **media type**. Run old and new together, announce a **deprecation** date with `Deprecation` and `Sunset` headers, watch the traffic on the old version, and remove it when nobody uses it. Prefer **evolving** the API (additive changes) over creating versions, because every version is a thing to maintain.

**Protobuf and event schemas** have their own rules: never reuse or renumber a field, add new fields with new numbers, and mark removed ones `reserved`. Use a **schema registry** (Avro, Protobuf, JSON Schema) with a compatibility mode (backward, forward or full) enforced when schemas are published.

**Contract testing.** Integration tests across many services are slow and flaky. **Consumer-driven contract tests** (Pact, Spring Cloud Contract) let each consumer record what it needs from a provider, and the provider's build verifies it, so a breaking change fails before release without starting every service together. Pair this with an **OpenAPI** file as documentation and for generating clients.

## Errors and the contract of failure {#errors}

A caller needs to know *what kind* of failure it was. Use HTTP status codes consistently (4xx the caller's fault, 5xx the service's fault, 429 and 503 retryable) and return a standard body: **Problem Details (RFC 9457)**, which Spring supports as `ProblemDetail`, with a machine-readable `type`, a title, status, detail and any extra fields such as an error code and a correlation id. Never leak stack traces or internal messages. For gRPC use the standard status codes (`UNAVAILABLE`, `DEADLINE_EXCEEDED`, `NOT_FOUND`) and rich error details.

Callers should treat errors by class: retry the transient ones (timeouts, 503) if idempotent, never retry validation errors, and surface the business ones (`INSUFFICIENT_FUNDS`) to the user.

## Finding services and balancing calls {#discovery}

Addresses change as instances come and go, so callers use a **name**, not an address.

- **Client-side discovery:** instances register with a registry (Eureka, Consul) and send heartbeats; the caller asks the registry for the healthy instances and balances itself (Spring Cloud LoadBalancer).
- **Server-side discovery:** the caller uses one stable name or address, and a load balancer or the platform picks an instance. On **Kubernetes** a `Service` gives a stable DNS name (`http://card-service`) and balances across ready pods; you rarely need a separate registry.
- **Health checks** decide which instances receive traffic (readiness probes on Kubernetes).
- Load balancing policies: round robin, least connections, zone-aware. For long-lived gRPC connections balance **per request**, not per connection, because HTTP/2 multiplexes many calls over one connection.
- A **service mesh** (Istio, Linkerd) moves discovery, load balancing, retries, mutual TLS and telemetry into sidecar proxies, so application code stays simple.

## Communication anti-patterns {#anti-patterns}

- **Chatty services:** many fine-grained calls for one screen. Combine them in a BFF, give APIs coarse operations, or replicate read data through events.
- **Long synchronous chains:** latency adds up and availability falls. Shorten them or make a step asynchronous.
- **Shared domain library with business logic and DTOs:** couples every service to one release. Share contracts (schemas), not code; generate clients from them.
- **Calling another service's database** instead of its API.
- **Business logic in the gateway:** it becomes a bottleneck and a monolith.
- **No timeouts, or retries on non-idempotent calls.**
- **Ignoring versioning** until the first breaking change takes down a consumer.
- **Using events as remote procedure calls** (publish a message and wait for the reply on another topic): you get the complexity of both styles. Use a synchronous call if you need the answer now.

## Cheat sheet {#cheatsheet}

| Need | Choice |
| --- | --- |
| Public or partner API | REST + JSON with OpenAPI, through the gateway |
| Fast internal calls with strict contracts | gRPC |
| Client picks fields across many sources | GraphQL |
| Notify others, propagate data, long workflows | events on Kafka or RabbitMQ |
| One door for clients, auth and limits | API gateway |
| Different needs per client | backend for frontend |
| One screen needs several services | API composition in the BFF, in parallel |
| Change an API safely | additive changes, tolerant readers, versions only for breaks |
| Catch breaks before release | consumer-driven contract tests, schema registry |
| Standard error body | Problem Details (RFC 9457) |
| Find instances | Kubernetes Service, or a registry with client-side load balancing |

## Interview questions {#questions}

### [basic] Synchronous or asynchronous communication: how do you choose? {#sync-async-q}

Use synchronous calls (REST, gRPC) when the caller needs the answer now, such as a balance query. Use asynchronous messaging when the work can happen later or many parties need to react, such as notifications and reporting. Async decouples services in time and absorbs spikes but gives eventual consistency; sync is simpler to reason about but multiplies latency and failure across a chain.

### [basic] What does an API gateway do? {#gateway-q}

It is the single entry point for clients. It routes requests to services and handles cross-cutting concerns: TLS termination, authentication, rate limiting, logging, correlation ids and sometimes aggregation or protocol translation. It keeps services private and simpler. It should not contain business logic, and it must itself be highly available.

### [basic] What is a backend for frontend? {#bff-q}

A gateway built for one type of client, such as mobile or web, and owned by that client's team. It shapes and combines responses to fit that client, so the shared services keep clean general APIs. It avoids one generic API that suits no client well.

### [basic] When would you choose gRPC over REST? {#grpc-q}

For internal service-to-service calls that need low latency, a strict typed contract, generated clients in several languages, streaming, and deadlines. REST is better for public APIs, browser clients, and where readability, tooling and HTTP caching matter. Many systems use REST at the edge and gRPC inside.

### [basic] What is service discovery? {#discovery-q}

A way for callers to find healthy instances of a service by name, because instances change addresses as they scale or restart. Client-side discovery uses a registry (Eureka, Consul) and the caller balances; server-side discovery uses a load balancer or platform. On Kubernetes, a Service and its DNS name do this for you.

### [intermediate] What is a breaking change in an API and how do you avoid it? {#breaking-q}

A change that makes existing callers fail: removing or renaming a field, changing a type or meaning, making an optional request field required. Avoid it by making only additive changes, keeping callers tolerant (ignore unknown fields), and when a break is unavoidable, introducing a new version, running both, and deprecating the old one with a date.

### [intermediate] How do you version an API? {#versioning-q}

Common options are the URL path (`/v2/payments`), a header, or the media type. The path is the simplest and most visible. Prefer evolving the API with backward compatible changes, and create a new version only for breaking ones. Run versions side by side, publish `Deprecation` and `Sunset` information, monitor usage of the old one, and remove it when it is unused.

### [intermediate] What is consumer-driven contract testing? {#contract-test-q}

Each consumer records the requests it makes and the responses it relies on (a contract, for example a Pact file). The provider's build replays those contracts against its real code, so a change that would break a consumer fails the provider's pipeline before release. It gives much of the safety of end-to-end tests without starting all the services.

### [intermediate] How do you handle a screen that needs data from several services? {#composition-q}

Use API composition in a BFF or gateway: call the services in parallel with a timeout on each, merge the results, and return a partial response when optional parts fail. If it is a hot path or too chatty, build a read model fed by events so the screen is served from one place. Avoid chains of synchronous calls between services to build one answer.

### [intermediate] How should an API report errors? {#errors-q}

With correct HTTP status codes (4xx for caller errors, 5xx for service errors, 429 and 503 for retryable) and a consistent body, ideally Problem Details (RFC 9457) with a type, title, status, detail, an error code and a correlation id. Never expose stack traces. This lets callers decide whether to retry, fix the request or show a message.

### [intermediate] How do you evolve a Kafka event or Protobuf schema safely? {#schema-evolution-q}

Add fields with new numbers or optional fields and defaults, never reuse or renumber a field, and mark removed fields as reserved. Use a schema registry with a compatibility mode (backward, forward or full) that rejects incompatible schemas when they are published, so a bad change fails in CI instead of breaking consumers in production.

### [intermediate] What is the difference between a gateway, a load balancer and a service mesh? {#mesh-q}

A load balancer spreads traffic across instances. An API gateway sits at the edge for external clients and handles routing, authentication and rate limiting. A service mesh handles traffic between services inside the cluster (discovery, retries, mutual TLS, telemetry) with sidecar proxies. They overlap and are often used together: gateway at the edge, mesh inside.

### [deep] Why can the API gateway become a problem and how do you prevent it? {#gateway-risk-q}

It is on every request path, so it is a single point of failure and a possible bottleneck, and it tends to attract business logic that makes it a new monolith owned by nobody. Run several stateless instances, keep it thin (routing, security, composition only), give BFFs to client teams, monitor it closely, and keep its configuration in version control.

### [deep] How do you propagate identity from the gateway to downstream services? {#identity-q}

The gateway validates the external token, then either forwards it (each service validates it again) or exchanges it for an internal token with only the needed claims. Services should not trust headers just because a request came from inside the network; use mutual TLS or signed tokens. Propagate a correlation id and the user or tenant id for logging and authorisation.

### [deep] Why are events not a good way to implement request and response? {#rpc-over-events-q}

Publishing a request on one topic and waiting for the reply on another gives you the complexity of both styles: correlation ids, reply topics, timeouts, and no simple error handling, for a result that is still needed right now. If the caller needs the answer immediately, use a synchronous call with timeouts and resilience; use events for facts that others may react to later.

### [coding] Write a gRPC contract and a service implementation. {#coding-grpc}

```protobuf
// account.proto
syntax = "proto3";
option java_package = "com.bank.account.grpc";
option java_multiple_files = true;

service AccountService {
  rpc GetBalance (BalanceRequest) returns (BalanceReply);
}

message BalanceRequest { string account_id = 1; }
message BalanceReply {
  string account_id = 1;
  string amount = 2;        // decimal as a string, never a float
  string currency = 3;
  // field 4 is reserved: removed fields are never reused
  reserved 4;
}
```

```java
@GrpcService                                           // from a Spring gRPC starter
class AccountGrpcService extends AccountServiceGrpc.AccountServiceImplBase {
    private final AccountRepository accounts;

    @Override
    public void getBalance(BalanceRequest request, StreamObserver<BalanceReply> response) {
        accounts.findById(request.getAccountId()).ifPresentOrElse(account -> {
            response.onNext(BalanceReply.newBuilder()
                .setAccountId(account.id())
                .setAmount(account.balance().toPlainString())
                .setCurrency("SGD")
                .build());
            response.onCompleted();
        }, () -> response.onError(Status.NOT_FOUND.withDescription("unknown account").asRuntimeException()));
    }
}
```

Explain that the `.proto` file is the contract and generates typed client and server code, that field numbers are never reused (hence `reserved`), that money is sent as a string rather than a float, that errors use gRPC status codes, and that callers set a deadline on the stub (`stub.withDeadlineAfter(2, TimeUnit.SECONDS)`).

### [coding] Compose a response from several services in parallel with timeouts. {#coding-composition}

```java
@Service
class SummaryService {
    private final AccountClient accounts;
    private final CardClient cards;
    private final OffersClient offers;

    AccountSummary summary(String customerId) {
        CompletableFuture<Balance> balance = CompletableFuture
            .supplyAsync(() -> accounts.balance(customerId))
            .orTimeout(1, TimeUnit.SECONDS);                       // essential: failure fails the call

        CompletableFuture<List<CardInfo>> cardList = CompletableFuture
            .supplyAsync(() -> cards.forCustomer(customerId))
            .orTimeout(1, TimeUnit.SECONDS);

        CompletableFuture<List<Offer>> offerList = CompletableFuture
            .supplyAsync(() -> offers.forCustomer(customerId))
            .orTimeout(500, TimeUnit.MILLISECONDS)
            .exceptionally(e -> List.of());                         // optional: fall back to an empty list

        return new AccountSummary(balance.join(), cardList.join(), offerList.join());
    }
}
```

Explain that the three calls run in parallel, so the total time is the slowest one and not the sum, that each has its own timeout, that the offers call is optional and falls back to an empty list (graceful degradation) while balances and cards are essential, and that the executor should be a bounded pool or virtual threads, with each downstream protected by a circuit breaker.

### [coding] Return errors as Problem Details in Spring. {#coding-problem}

```java
@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(InsufficientFundsException.class)
    ProblemDetail insufficientFunds(InsufficientFundsException e, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
        problem.setType(URI.create("https://api.bank.example/problems/insufficient-funds"));
        problem.setTitle("Insufficient funds");
        problem.setProperty("code", "INSUFFICIENT_FUNDS");                       // machine-readable
        problem.setProperty("correlationId", MDC.get("correlationId"));          // for support and tracing
        return problem;
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception e) {
        log.error("unexpected error", e);                                         // details stay in the log
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong");
    }
}
```

Explain that Spring returns `application/problem+json` with the standard fields, that the `type` and `code` let callers react programmatically, that a correlation id links the response to logs and traces, and that internal details and stack traces are logged but never returned (enable `spring.mvc.problemdetails.enabled=true` to use Problem Details for the framework's own errors too).
