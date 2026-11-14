---
title: Decomposition and migration — bounded contexts, modular monolith and the strangler fig
nav: Decomposition and migration
slug: monolith-to-microservices
summary: How to decide service boundaries and migrate safely: monolith vs microservices trade-offs, domain-driven design and bounded contexts, decomposing by business capability, the modular monolith, the strangler fig pattern, splitting the shared database, anti-corruption layers, the distributed monolith trap and team topology, with Java examples and interview questions.
tags: [Microservices, DDD, Bounded context, Strangler fig, Modular monolith, Migration, Spring Modulith]
order: 26
topic: Microservices / Fundamentals
updated: 2026-11-14
subnav: true
---

"We have a monolith. How would you move to microservices?" is one of the most common architecture questions. The interviewer wants to hear that you do not rewrite from scratch, that you find boundaries from the business and not from the technology, that you cut the database last and carefully, and that you know when *not* to split. This lesson covers how to choose boundaries, the modular monolith, the strangler fig migration, and the traps. It builds on [microservice patterns](lesson:microservice-patterns) (the overview), and relates to [state management](lesson:microservice-state), the [saga pattern](lesson:saga) and [event sourcing](lesson:event-sourcing-cqrs) (what replaces cross-table transactions), [Kubernetes](lesson:kubernetes) (where the services run) and [REST API design](lesson:rest-api-design). Play the four scenes: finding boundaries, the strangler fig, splitting the database, and the modular monolith.

```demo
name: decomposition-walk
```

> **One sentence to remember:** *draw boundaries around business capabilities (bounded contexts), make them clean inside the monolith first, then peel services off one slice at a time behind a facade, and split the database last.*

## Why migrate at all {#why}

A monolith is not a mistake. It is one deployable with one database, simple to build, test, run and debug, and it has ACID transactions. Move away from it only for a reason you can name:

| Pain | Microservices may help when |
| --- | --- |
| many teams block each other on one codebase and one release | each team can own and deploy a service |
| one part needs much more scale than the rest | that part scales alone |
| a slow, risky release cycle | small independent releases |
| one failure or memory leak takes everything down | failures are isolated |
| one technology limits a part of the system | a service can use a different stack |

If you cannot name the pain, do not migrate. Microservices add network calls, partial failure, eventual consistency, distributed tracing and a platform to run. A small team usually does better with a **modular monolith**.

## Finding the boundaries {#boundaries}

**Split by business capability, not by technical layer.** A capability is something the business does: hold accounts, move money, issue cards, notify customers. A service per layer (web, logic, data) is the classic mistake: every feature still needs all three, so nothing can change or deploy alone.

**Domain-driven design (DDD)** gives the tools:

- **Ubiquitous language:** the business and the code use the same words.
- **Bounded context:** the area inside which a word has one precise meaning and one model. "Customer" is a verified identity in Accounts, a cardholder with limits in Cards, a segment with consent in Marketing. Do not force one shared `Customer` class on all three.
- **Context map:** how contexts relate: a customer-supplier API, a shared event, a conformist, or an **anti-corruption layer** that translates another model so it does not leak into yours.
- **Aggregate:** the unit of consistency inside a context (see [event sourcing](lesson:event-sourcing-cqrs)); a transaction changes one aggregate.

Practical ways to find contexts: **event storming** workshops with domain experts (put business events on a wall and group them), looking at **where the language changes**, **team ownership** (Conway's law: systems mirror the communication structure of the teams), and **how data changes together**. A good service has **high cohesion** (things that change together stay together) and **low coupling** (few calls to other services).

Signs of a wrong boundary: two services always change and deploy together, one service needs a synchronous call to another for almost every request, or a business operation needs a distributed transaction across three services.

## The modular monolith {#modular}

Before splitting, make the boundaries real **inside** the monolith:

- Each business module has a **public interface**; everything else is package-private or hidden.
- Modules may call each other only through those interfaces, or through **in-process events**.
- Each module **owns its tables**; no other module reads them.
- A build or test **enforces** all of this, otherwise it erodes.

In Spring, **Spring Modulith** verifies module boundaries and documents them; ArchUnit does the same for any Java project.

```java
// verifies in a normal unit test that modules only use each other's public API
class ModularityTests {
    @Test
    void verifiesModuleStructure() {
        ApplicationModules.of(BankingApplication.class).verify();
    }
}

// a module publishes an in-process event instead of calling another module's internals
@Service
class PaymentService {
    private final ApplicationEventPublisher events;

    @Transactional
    void complete(Payment payment) {
        payment.markCompleted();
        events.publishEvent(new PaymentCompleted(payment.id(), payment.amount()));
    }
}
```

The payoff: you get most of the design benefit with none of the network cost, and the seams are where services would be cut later. Sometimes that is the end of the story, and that is a good outcome.

## The strangler fig migration {#strangler}

The **strangler fig** pattern (named after a vine that grows around a tree) replaces a system **gradually** instead of with a big-bang rewrite:

1. Put a **facade** in front of the monolith (an API gateway or reverse proxy). At first it forwards everything.
2. Choose a **slice** with clear boundaries and modest risk (notifications, a read-only report, a reference-data service) and build it as a new service.
3. **Route** that slice's requests to the new service; everything else still goes to the monolith. If it misbehaves, switch the route back.
4. Repeat, moving riskier and more entangled slices later. Keep the data in step during the move (events or **change data capture**).
5. When nothing is routed to the monolith any more, **retire it**.

Why it works: every step is small, shippable and reversible, the business keeps getting value, and you learn the platform on a low-risk slice first. Why big-bang rewrites fail: they take longer than planned, the old system keeps changing, and nothing ships until everything does.

Useful supporting techniques: **branch by abstraction** (introduce an interface in the monolith, then swap its implementation for a remote call), **feature flags** to switch traffic gradually, and **shadow traffic** or a **parallel run** to compare old and new results before cutting over.

## Splitting the database {#database}

The shared database is the strongest coupling and the hardest part to cut. Do it in steps, so every step can be released and rolled back:

1. **Stop reading other modules' tables.** The owner exposes an API (or a view), and others use it. Now the owner can change its schema freely.
2. **Replicate what you need.** Where a service needs data often, give it a **local copy** fed by the owner's events or by change data capture. Accept that the copy is slightly stale; for exact decisions still ask the owner.
3. **Separate the schema**, then the database. Drop cross-service foreign keys and joins.
4. **Replace transactions that spanned services** with a [saga](lesson:saga) and an outbox, and accept eventual consistency where the business can.

Hard cases: **shared reference data** (copy it, or make it its own small service), **reports that join everything** (build a read model or a data warehouse, not a join across services), and **a table two contexts both write** (decide the owner; the other asks).

## Traps {#traps}

- **Distributed monolith:** services that share a database, must be deployed together, or call each other in long synchronous chains. You get all the cost of microservices and none of the benefits. A test: can this service be changed and released alone?
- **Too many, too small services (nanoservices):** every business operation crosses five of them. Start with fewer, larger services and split when a real reason appears.
- **Splitting by layer or by entity** (a "CustomerService" with CRUD for one table) instead of by capability.
- **Splitting before the domain is understood:** wrong boundaries are expensive to fix across a network. Prefer a modular monolith while you learn the domain.
- **No platform:** without CI/CD, monitoring, tracing and a container platform, each new service is a burden. Build the platform with the first extracted service.
- **Shared libraries with business logic:** they couple every service to one release. Share contracts (schemas), not behaviour.

## Teams and migration order {#teams}

Conway's law works in both directions: design the teams you want and the services follow (the "inverse Conway manoeuvre"). Give each service a **single owning team** that builds, runs and is on call for it. A sensible order to extract: first **edge and low-risk** capabilities (notifications, documents, reference data), then those with **clear scaling or change pressure**, and the **core, most entangled** domain (accounts, ledger) last, if ever.

## Cheat sheet {#cheatsheet}

| Question | Answer |
| --- | --- |
| How do you find boundaries? | business capabilities, bounded contexts, event storming, team ownership |
| What not to split by? | technical layers, or one service per table |
| Safest way to migrate? | strangler fig: facade, extract a slice, route, repeat |
| What first inside the monolith? | modular monolith with enforced boundaries |
| How to cut the database? | stop direct reads, replicate via events/CDC, split schema, then database |
| Replacement for cross-table transactions? | saga, outbox, eventual consistency |
| Sign of a distributed monolith? | shared database, joint deploys, long sync call chains |
| When not to migrate? | small team, unclear domain, no named pain |

## Interview questions {#questions}

### [basic] Why would you move from a monolith to microservices, and why might you not? {#why-q}

Move for a named reason: many teams blocking each other, parts needing different scaling, slow risky releases, or failure isolation. Do not move just because it is fashionable: you take on network failures, eventual consistency, tracing and a platform. A small team or an unclear domain is usually better served by a modular monolith.

### [basic] What is a bounded context? {#bounded-context-q}

The part of a domain inside which a term has one precise meaning and one model. "Customer" can mean a verified identity in Accounts and a cardholder in Cards, and each context keeps its own model instead of one shared class. Bounded contexts are the best starting point for service boundaries.

### [basic] How do you decide the boundaries of a microservice? {#boundaries-q}

By business capability and bounded context, found with domain experts (event storming), by where language and data change together, and by team ownership. Aim for high cohesion and low coupling. If two services always change together or need a synchronous call for most requests, the boundary is probably wrong.

### [basic] What is the strangler fig pattern? {#strangler-q}

Replacing a system gradually. Put a facade (gateway or proxy) in front of the monolith, build one slice as a new service, route that slice's traffic to it, and repeat until the monolith receives nothing and can be retired. Each step is small and reversible, so there is no risky big-bang rewrite.

### [basic] What is a modular monolith? {#modular-q}

One deployable with strongly separated business modules: each has a public interface, hides its internals, owns its tables and talks to others only through interfaces or in-process events, with the rules enforced by tests (Spring Modulith, ArchUnit). It gives most of the design benefit without distribution, and makes later extraction easy.

### [intermediate] Why is splitting by technical layer a mistake? {#layers-q}

Every feature then needs changes in the web, logic and data services, so teams cannot work or deploy independently and every request crosses all three services. Services should be vertical slices of a business capability that include their own logic and data.

### [intermediate] What is a distributed monolith? {#distributed-monolith-q}

A system split into services that are still tightly coupled: they share a database, must be deployed together, or depend on long synchronous call chains. It has the operational cost of microservices without independent deployment. A quick test is whether a service can be changed and released alone without breaking others.

### [intermediate] What is an anti-corruption layer? {#acl-q}

A translation layer between your context and another model (often a legacy system or another team's service). It maps the foreign model and its quirks into your own concepts so they do not spread through your code. When the other side changes, only the layer changes. It is useful while a monolith is being strangled.

### [intermediate] How do you migrate the database when splitting a service? {#db-split-q}

In reversible steps: stop other code from reading the tables directly and give them an API; give consumers a local copy fed by events or change data capture; separate the schema, then the database, dropping cross-service joins and foreign keys; and replace multi-table transactions with a saga and outbox. Never do the database cut first.

### [intermediate] How do you handle reports that used to join across what are now separate services? {#reports-q}

Do not join across service databases. Build a read model fed by events from each service, or load the data into a reporting store or warehouse, so reports read one prepared dataset. For a screen that needs several services, use API composition in a backend-for-frontend or gateway, with care about latency and partial failure.

### [intermediate] How do you migrate with no downtime and an easy rollback? {#rollback-q}

Route traffic through a facade so you can switch a slice back at any time, use feature flags and gradual traffic shifts, run the old and new paths in parallel and compare results (shadow traffic) before cutting over, and keep data in sync in both directions during the move. Release each step on its own so a problem points to one change.

### [deep] When would you advise against microservices? {#against-q}

With a small team, an unclear or fast-changing domain, no platform for CI/CD, monitoring and containers, or no named problem the split solves. A modular monolith keeps boundaries clean, deploys simply and can be split later when a real need appears. Microservices solve organisation and scaling problems and cost you operational complexity.

### [deep] How do you handle data that two contexts both need to write? {#shared-write-q}

Decide a single owner for each piece of data. Others change it by asking the owner (a command or API call) and read their own copy through events. If both really need to write, the boundary is likely wrong, or the data is two different concepts with the same name that belong in different contexts.

### [deep] What is Conway's law and how does it affect migration? {#conway-q}

Systems tend to mirror the communication structure of the organisation that builds them. If three teams share one codebase, you get a tangled system; if teams own separate capabilities, services follow. When migrating, shape the teams too: one owning team per service that builds, runs and supports it, so the architecture and the organisation point the same way.

### [deep] How do you order the extraction of services? {#order-q}

Start with low-risk edge capabilities with clear boundaries (notifications, documents, reference data) to build the platform and learn. Then extract parts with real scaling or change pressure. Leave the core, most entangled domain (ledger, accounts) until last, and consider whether it ever needs to move. Extract where it pays, not everything.

### [coding] Enforce module boundaries in a modular monolith with a test. {#coding-modulith}

```java
// pom.xml / build.gradle: spring-modulith-starter-core, spring-modulith-starter-test
// Layout: com.bank.accounts (public API in the package root), com.bank.accounts.internal (hidden),
//         com.bank.payments, com.bank.cards

@SpringBootApplication
public class BankingApplication {
    public static void main(String[] args) { SpringApplication.run(BankingApplication.class, args); }
}

class ModularityTests {
    ApplicationModules modules = ApplicationModules.of(BankingApplication.class);

    @Test
    void modulesAreWellFormed() {
        modules.verify();                // fails on cycles and on access to another module's internals
    }

    @Test
    void writeDocumentation() {
        new Documenter(modules).writeModulesAsPlantUml();   // diagram of modules and their dependencies
    }
}
```

Explain that the root package of each module is its public API and sub-packages are internal, that `verify()` fails the build when payments reaches into `accounts.internal` or when modules form a cycle, and that this keeps boundaries from eroding until a module is extracted.

### [coding] Route a slice to a new service with Spring Cloud Gateway (strangler facade). {#coding-strangler}

```java
@Configuration
class StranglerRoutes {

    @Bean
    RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
            // the extracted slice goes to the new service
            .route("notifications", r -> r.path("/notifications/**")
                .uri("http://notification-service:8080"))
            // a gradual cut-over: 10 percent of payment traffic to the new service
            .route("payments-new", r -> r.path("/payments/**").and().weight("payments", 10)
                .uri("http://payment-service:8080"))
            .route("payments-old", r -> r.path("/payments/**").and().weight("payments", 90)
                .uri("http://legacy-monolith:8080"))
            // everything else still goes to the monolith
            .route("legacy", r -> r.path("/**")
                .uri("http://legacy-monolith:8080"))
            .build();
    }
}
```

Explain that the gateway is the strangler facade, that routes are matched in order so the specific ones come first and the catch-all last, that weighted routes shift traffic gradually and can be rolled back by changing weights, and that the new service must be idempotent and keep its data in step with the monolith during the move.

### [coding] Put an anti-corruption layer in front of a legacy account service. {#coding-acl}

```java
// Legacy API returns awkward, legacy-shaped data
record LegacyAcctDto(String acctNo, String stat, String bal) {}

// Our own clean model
record Account(AccountId id, AccountStatus status, Money balance) {}

@Component
class LegacyAccountAdapter implements AccountPort {          // the port our domain depends on
    private final RestClient legacy;

    LegacyAccountAdapter(RestClient.Builder builder) {
        this.legacy = builder.baseUrl("http://legacy-core:8080").build();
    }

    @Override
    public Account find(AccountId id) {
        LegacyAcctDto dto = legacy.get().uri("/acct/{no}", id.value()).retrieve().body(LegacyAcctDto.class);
        return new Account(
            new AccountId(dto.acctNo().trim()),
            "A".equals(dto.stat()) ? AccountStatus.ACTIVE : AccountStatus.CLOSED,   // translate legacy codes
            Money.sgd(new BigDecimal(dto.bal())));
    }
}
```

Explain that the domain depends on the `AccountPort` interface and never sees the legacy DTO, that all translation of codes and formats happens in one adapter, and that when the legacy system is replaced only the adapter changes.
