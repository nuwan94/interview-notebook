---
title: Deployment strategies — rolling, blue-green, canary and safe releases
nav: Deployment strategies
slug: deployment-strategies
summary: How to put a new version into production without downtime or with a small blast radius, comparing recreate, rolling update, blue-green, canary, shadow traffic and feature flags, with Kubernetes rolling-update settings, readiness probes and graceful shutdown, automatic analysis and rollback, database changes with expand and contract, and what a bank adds, with examples and interview questions.
tags: [Deployment, Canary, Blue-green, Rolling update, Kubernetes, CI/CD, Release]
order: 50
topic: CI/CD / Releasing
updated: 2026-11-17
subnav: true
---

A pipeline can build a perfect artifact, and the release can still fail: the new version has a bug that only real traffic shows, the old and new versions disagree about the database, or the rollout drops requests. A **deployment strategy** is the plan for replacing the running version with a new one: how much traffic moves, how fast, what is checked on the way, and how you get back. Interviews ask *how a rolling update works, what blue-green and canary are and when to use each, how you avoid downtime, how you handle database changes, what makes a rollback possible, and the difference between deploying and releasing.* Play the four scenes: a rolling update, blue-green, a canary, and a database change.

```demo
name: deploy-walk
```

> **One sentence to remember:** *Move traffic to the new version gradually or behind a switch, check real signals at each step, keep the old version ready, and make the database compatible with both versions, so any release can be stopped or undone quickly.*

## Deploy is not release {#deploy-vs-release}

Two words that people mix up:

- **Deploying** puts a version on the servers. It is a technical event.
- **Releasing** exposes a feature to users. It is a product decision.

With feature flags and traffic control the two can be separated: deploy on Tuesday with the feature off, release on Thursday for 1 percent of users, then everyone. Most strategies below are about *how the new version gets traffic*, and a [feature flag](lesson:cicd-fundamentals#branching) is about *which behaviour the user sees*. Use both.

## The strategies at a glance {#overview}

| Strategy | How it works | Downtime | Extra capacity | Rollback | Best for |
| --- | --- | --- | --- | --- | --- |
| **Recreate** | stop all of v1, then start v2 | **yes**, a gap | none | redeploy v1 (slow) | batch jobs, dev and test, incompatible versions |
| **Rolling update** | replace instances a few at a time | no | a little (surge) | roll back the rollout | the default for stateless services |
| **Blue-green** | a second full environment, switch the router | no | **double** during the release | switch back in seconds | big or risky releases, instant rollback needed |
| **Canary** | send a small share of traffic to v2, grow it step by step | no | a little | set the share to zero | high-traffic services, risk reduction with real data |
| **Shadow (mirroring)** | copy real requests to v2, ignore its responses | no | a full copy | not applicable, users never saw it | checking a rewrite or a new algorithm safely |
| **A/B test** | different users get different versions to compare a **business** result | no | a little | remove the experiment | product experiments, not safety |

Interview tip: say that these are not exclusive. A common real setup is a rolling update inside a canary, with a feature flag for the risky part.

## Recreate {#recreate}

Stop every instance of the old version, then start the new one. It is the simplest, and there is **downtime** between the two. Use it when two versions cannot run side by side (a destructive schema change, an incompatible protocol), when downtime is acceptable (a nightly batch job), or in non-production environments.

## Rolling update {#rolling}

Replace instances **a few at a time**: start a new one, wait until it is ready, stop an old one, repeat (the first scene). It is the default in [Kubernetes](lesson:kubernetes#rollouts) and needs no extra environment.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1             # at most 1 pod above 4 during the update
      maxUnavailable: 0       # never drop below 4 ready pods
  minReadySeconds: 10         # a new pod must stay ready 10 s before it counts
  template:
    spec:
      containers:
        - name: payments
          image: registry.example.com/payments:1.4.2     # an immutable tag, never latest
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: 8080 }
          lifecycle:
            preStop:
              exec: { command: ["sleep", "5"] }          # let the load balancer stop sending traffic first
      terminationGracePeriodSeconds: 40
```

What makes a rolling update **really** without downtime:

- A **readiness probe** that tells the truth. A pod receives traffic only when it is ready, and a rollout that gets stuck on a bad version stops by itself ([probes](lesson:kubernetes#probes)).
- **Graceful shutdown**: on `SIGTERM` the application stops taking new requests and finishes the current ones. In Spring Boot, set `server.shutdown=graceful`, and keep `terminationGracePeriodSeconds` longer than `spring.lifecycle.timeout-per-shutdown-phase`.
- `maxUnavailable: 0` with a `maxSurge` keeps the full capacity.
- A **PodDisruptionBudget** so that node maintenance does not remove too many pods at once.

The limits: during the update **both versions serve requests**, so they must be compatible (API, messages, [database](lesson:deployment-strategies#database)), and a rollback is another rolling update, so it is not instant.

## Blue-green {#blue-green}

Keep **two identical environments**. *Blue* serves the users with version 1. Deploy version 2 to *green*, test it there with no user traffic, then switch the router to green in **one step** (the second scene). Blue stays untouched, so the rollback is the same switch in reverse and takes seconds.

- **Strengths:** no mixed versions for the users, a full test of the real environment before the switch, an instant rollback.
- **Costs:** double the infrastructure during the release, and a data problem: both environments usually share **one database**, so the schema must work with both versions, and the data written after the switch does not disappear when you switch back.
- **In practice:** a load balancer rule, DNS with a low TTL (slower and cached), a Kubernetes Service selector that changes from `version: blue` to `version: green`, or a router in a service mesh or an API gateway.
- **Warm up** green before switching (caches, connection pools, JIT) so the first users do not meet a cold system, and drain blue's in-flight requests.

## Canary {#canary}

Named after the canary in the coal mine. Send a **small share** of real traffic to the new version, watch it, and grow the share only while it looks healthy (the third scene): 1, 5, 25, 50, 100 percent.

- **Strength:** the **blast radius** is small. A bad release hurts a few users, and the data comes from real traffic, which no test environment can fully reproduce.
- **What to compare:** the canary against the **stable version at the same time**, not against yesterday: error rate, latency percentiles, saturation, and a business signal such as payment success rate or approval rate.
- **Who gets the canary:** a random share of requests, or a chosen group (internal staff first, one region, a percentage of customers by a stable hash so a user does not flip between versions).
- **Automation:** tools such as **Argo Rollouts** and **Flagger**, or a service mesh (Istio) and a gateway, split the traffic by weight, run the metric analysis and **promote or abort automatically**.
- **Limits:** you need good metrics, enough traffic for the numbers to mean something, and, as with rolling updates, two versions running at once. A very slow canary on a low-traffic service gives no information.

## Shadow traffic, dark launch and A/B tests {#others}

- **Shadow (traffic mirroring):** a copy of the real requests is sent to the new version and its responses are **thrown away**. Users never see it. It is good for checking a rewritten service or a new pricing algorithm under real load. Be careful about **side effects**: the shadow must not send emails, charge cards or write to shared data, so use read-only calls, stubs or a separate data store.
- **Dark launch:** the code is in production and runs, but its result is not shown to users, only compared or logged.
- **A/B test:** a product experiment that shows version A to some users and B to others to compare a **business** metric such as conversion. It is not a safety mechanism, and it needs enough users to give a statistically meaningful result.

## Feature flags as a strategy {#flags}

A flag gives the **fastest rollback** of all, because turning a feature off needs no deployment. They allow gradual exposure by user, group or percentage and a kill switch for a risky feature. The rules that keep them healthy: give every flag an owner and a removal date, test both states, keep the flag check at a **single decision point** and not scattered, and store them in a service or configuration that can change at run time (a flag platform, or a config server), with changes **audited**.

## Database changes during a release {#database}

The hardest part of any strategy. In a rolling update, canary or blue-green release the old and new application versions use the **same database** at the same time, so the change must be compatible with both (the fourth scene). The pattern is **expand and contract** (also called parallel change):

1. **Expand:** add the new column, table or index in a migration, keeping the old structure. Old code still works.
2. **Migrate and dual-write:** deploy code that writes both and reads the new one, and copy the existing data (a backfill, in small batches).
3. **Switch reads:** when the data is complete and verified, the code uses only the new structure.
4. **Contract:** in a **later** release, when no old version can come back, drop the old column.

Rules of thumb: never rename or drop a column in the same release that stops using it, make new columns **nullable or with a default**, add indexes concurrently on big tables, run migrations as a separate, earlier pipeline step with Flyway or Liquibase, and test them on production-sized data. The same compatibility rule applies to **APIs and messages**: add fields, do not remove or change them, and tolerate unknown ones (see [microservice communication](lesson:microservice-communication)).

## Health checks, verification and automatic rollback {#verification}

A strategy is only as good as the signal that tells you it is working:

- **Readiness** decides whether an instance may receive traffic. A smoke test after each step checks one real business path ([pipeline stages](lesson:cicd-fundamentals#stages)).
- **Golden signals** during the rollout: latency, traffic, errors and saturation, plus business metrics ([observability](lesson:spring-observability)). Define the **thresholds before** the release, so nobody argues at 2 a.m.
- **Automatic rollback** when a threshold is crossed for a set time. Manual rollback needs a **rehearsed**, one-command procedure.
- **Rollback is a feature to test.** Practise it in a test environment. A rollback that has never been run often does not work, especially after a database change ([rollback and roll forward](lesson:cicd-fundamentals#rollback)).
- Keep the **previous artifact** and its configuration available, and avoid releases that cannot be undone, such as a one-way data migration, without a plan.
- Send a **deployment marker** (a version tag) to the monitoring system, so a graph shows exactly when the release happened.

## Choosing a strategy {#choosing}

| Situation | Reasonable choice |
| --- | --- |
| a normal stateless Spring Boot service | rolling update with good probes and graceful shutdown |
| a risky change on a high-traffic service | canary with automatic analysis |
| a release that must be reversible in seconds, and there is budget for two environments | blue-green |
| a new feature that is not ready for everyone | feature flag, deployed dark |
| a rewrite of a critical calculation | shadow traffic first, then canary |
| a destructive, incompatible change | recreate in a maintenance window, or redesign with expand and contract |
| a stateful system (database, broker) | operator-driven, carefully ordered rolling upgrade; never a naive swap |
| a mobile app or an installed client | a staged rollout through the store, and a server that supports old clients for a long time |

## In a bank {#bank}

- **Release windows and approvals.** A strategy lives inside the change process: the approval and the window are part of the pipeline, and the strategy limits the damage inside the window.
- **Prefer reversible, gradual releases.** A bank would rather release a payment change to 1 percent of traffic, or to internal users, than to everyone, and keep a one-step rollback.
- **Business metrics as gates.** Payment success rate and the rate of declined or duplicate transactions are watched during the canary, not only HTTP errors.
- **Idempotency and in-flight work.** A transfer that is half done during a restart must complete or be safely retried, so requests carry idempotency keys, shutdown is graceful, and messages are processed at-least-once ([resilience](lesson:microservice-resilience)).
- **Evidence.** Each step, the metrics and the decision to promote or roll back are recorded for audit.
- **Data first.** Schema and message changes follow expand and contract, because regulatory data cannot simply be lost or reshaped.

## Cheat sheet {#cheatsheet}

| Need | Use |
| --- | --- |
| simplest, downtime accepted | recreate |
| default, no downtime, no extra environment | rolling update, `maxUnavailable: 0`, readiness probe |
| instant rollback, switch everything at once | blue-green |
| small blast radius, real data | canary, with metric analysis |
| test with real load, no user impact | shadow traffic |
| separate deploy from release, kill switch | feature flag |
| change the schema safely | expand and contract, in separate releases |
| no dropped requests on stop | graceful shutdown, `preStop`, grace period |
| a stuck rollout | readiness probe fails, the rollout stops, `kubectl rollout undo` |
| progressive delivery tools | Argo Rollouts, Flagger, a service mesh |
| rollback | tested, one step, automatic on metrics |

## Interview questions {#questions}

### [basic] What is the difference between deploying and releasing? {#deploy-release-q}

Deploying puts a version on the servers, a technical step. Releasing makes a feature available to users, a business decision. They can be separated: the code is deployed with a feature flag off and released later, to a few users first and then to all of them. This lowers risk, because the deployment is small and boring and the release can be undone by switching a flag.

### [basic] What is a rolling update? {#rolling-q}

A strategy that replaces the running instances gradually: a new instance is started, and when it is ready an old one is stopped, until all run the new version. It needs no extra environment and causes no downtime, provided there is a correct readiness probe and graceful shutdown. Its limits are that two versions run side by side during the update, so they must be compatible, and that a rollback is another rolling update.

### [basic] What is blue-green deployment? {#blue-green-q}

Two identical environments. Blue serves production with the current version, and the new version is deployed to green and tested there without user traffic. Then the router sends all traffic to green in one step. The old environment stays available, so a rollback means switching back, which takes seconds. The cost is running two environments, and the shared database must be compatible with both versions.

### [basic] What is a canary release? {#canary-q}

A strategy that sends a small percentage of real traffic to the new version while most users stay on the stable one. If the error rate, latency and business metrics of the canary stay healthy, the percentage grows in steps up to 100. If they get worse, the traffic is set back to zero. Its main benefit is a small blast radius with real production data.

### [basic] Which strategy has downtime, and when is that acceptable? {#recreate-q}

Recreate: all old instances are stopped before the new ones start, so there is a gap. It is acceptable for batch jobs, for non-production environments, or when two versions cannot coexist, for example after an incompatible schema change, and the work can be done in a maintenance window.

### [intermediate] How do you achieve a rolling update with no dropped requests on Kubernetes? {#zero-downtime-q}

Four things. A correct **readiness probe**, so a pod gets traffic only when it can serve it. **maxUnavailable: 0** with a **maxSurge** of at least one, so capacity never falls. **Graceful shutdown**: on SIGTERM the application stops accepting new requests and finishes the current ones, with a short `preStop` sleep so the load balancer and endpoints are updated first, and a termination grace period longer than the shutdown timeout. Add a PodDisruptionBudget against node drains, and make the versions compatible.

### [intermediate] What do maxSurge and maxUnavailable mean? {#surge-q}

They set the pace of a rolling update. `maxSurge` is how many pods above the desired count may exist during the update (extra capacity), and `maxUnavailable` is how many pods may be missing. With 4 replicas, `maxSurge: 1` and `maxUnavailable: 0` means the controller starts one new pod, waits until it is ready, then removes one old pod, so there are always at least 4 ready pods. Higher values make the rollout faster and riskier.

### [intermediate] What happens if the new version never becomes ready during a rolling update? {#stuck-q}

The new pods never pass the readiness probe, so they receive no traffic, and the controller does not remove more old pods, because that would exceed the allowed unavailability. The rollout stalls, and the old version keeps serving. You see it in `kubectl rollout status`, and after `progressDeadlineSeconds` the Deployment is marked as failed. Then you run `kubectl rollout undo` or fix and redeploy. It works only if the probe checks something meaningful.

### [intermediate] Compare blue-green and canary. {#compare-q}

Blue-green moves **all** traffic at once between two full environments, so the cut-over and the rollback are instant, and users see no mixed versions, but it costs double infrastructure and exposes everyone at the same moment. Canary moves traffic **gradually**, so a bad release affects few users and gets real-world validation, but it takes longer, needs good metrics and traffic, and has two versions live. Choose blue-green when you need an instant, clean switch, and canary when you want to limit the risk and learn from real usage.

### [intermediate] How do you decide that a canary is healthy? {#canary-metrics-q}

Compare the canary with the stable version at the same time, on the same traffic, using the golden signals (error rate, latency percentiles, saturation) and a business metric such as payment success rate. Define the thresholds and the observation time before the release, and let a tool such as Argo Rollouts or Flagger evaluate them automatically and either promote or abort. Make sure there is enough traffic for the difference to be statistically meaningful.

### [intermediate] Why is a database migration the hard part of a zero-downtime release? {#db-hard-q}

Because the old and the new application versions run at the same time against the same database, and the database cannot be switched at the same instant as the application. A migration that renames or drops something breaks the old version immediately, and one that is not reversible blocks the rollback. The solution is to make each schema change backward compatible and split it into steps (expand and contract) across several releases.

### [intermediate] Explain the expand and contract pattern with an example. {#expand-contract-q}

To rename `name` to `full_name`: (1) **expand**: add `full_name` (nullable) and keep `name`; (2) deploy code that writes both columns and reads `full_name` with a fallback, and backfill existing rows in batches; (3) when the data is complete and the old version cannot return, deploy code that uses only `full_name`; (4) **contract**: in a later release drop `name`. At each step the previous version still works, so every step can be rolled back on its own.

### [intermediate] What is shadow traffic and what is the risk? {#shadow-q}

A copy of production requests is sent to a new version whose responses are discarded, so the team can compare behaviour and performance under real load with no user impact. The risk is **side effects**: the shadow instance must not charge cards, send emails or write to shared data. Use read-only paths, stubs, or an isolated data store, and watch the extra load.

### [intermediate] How do feature flags help a deployment strategy, and what problems do they bring? {#flags-q}

They separate deploy from release, allow a gradual rollout by user or percentage, and are the fastest rollback because switching a flag needs no deployment. The problems: more combinations to test, leftover flags that become permanent clutter, flag logic scattered through the code, and risk from changing a flag without control. Give every flag an owner and an expiry, test both states, centralise the decision and audit changes.

### [deep] Design the release process of a payment service for a bank, with a rollback plan. {#design-q}

The pipeline builds one signed image and deploys it to test, where integration and contract tests run. After the approval and inside the release window, the same image is released as a **canary** to a small share of traffic, or to internal users first, with a feature flag keeping the new behaviour off. An automatic analysis compares the canary with the stable version on error rate, latency, payment success and duplicate or declined rates, and promotes in steps. Database changes are made earlier with expand and contract, so the old version always works. Shutdown is graceful and requests carry idempotency keys, so in-flight payments are completed or safely retried. A threshold breach sets traffic back to the stable version automatically and switches the flag off, and the rollback has been rehearsed. Every step and the metrics are stored as audit evidence.

### [deep] What happens to in-flight requests and messages during a deployment, and how do you protect them? {#in-flight-q}

When an instance is stopped, requests in progress can be cut, and messages being processed can be lost or processed twice. Protect them with graceful shutdown (stop accepting new work, finish the current work, with a grace period longer than the longest normal request), a `preStop` delay so the load balancer stops sending traffic first, retries by clients with **idempotency keys** so that a repeated request is harmless, and for messaging, acknowledge after processing and make consumers **idempotent**, because at-least-once delivery can repeat a message. Long jobs should be resumable or handled by a separate worker with its own drain procedure.

### [deep] How would you roll out a change that is not backward compatible, such as a new message format? {#incompatible-q}

Make it compatible in stages. First deploy **consumers** that understand both the old and the new format (tolerant readers that ignore unknown fields). Then deploy the **producers** that start sending the new format, ideally behind a flag, and watch. Only after all old producers and messages are gone, remove the support for the old format. For a REST API, use versioning or add fields and endpoints instead of changing them. If a change truly cannot be staged, use a planned maintenance window with a recreate strategy and a tested fallback.

### [deep] How do progressive delivery tools such as Argo Rollouts work? {#progressive-q}

A Rollout resource replaces the Deployment and describes the strategy as steps: set the weight to 5 percent, pause or analyse for ten minutes, go to 25 percent, and so on. The controller creates the new ReplicaSet and shifts traffic through an ingress, a service mesh or a gateway that supports weights. An **AnalysisTemplate** queries metrics (for example from Prometheus) and decides whether the step passed. If a check fails, the controller aborts and returns the traffic to the stable version automatically, and if it passes, the rollout continues until the new version is fully promoted.

### [coding] Write the rolling-update settings and probes of a Spring Boot Deployment that never drops capacity and shuts down gracefully. {#coding-rolling}

```yaml
spec:
  replicas: 4
  minReadySeconds: 10
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    spec:
      terminationGracePeriodSeconds: 45
      containers:
        - name: payments
          image: registry.example.com/payments:1.4.2
          ports: [{ containerPort: 8080 }]
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: 8080 }
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            initialDelaySeconds: 30
          lifecycle:
            preStop:
              exec: { command: ["sleep", "5"] }
```

```properties
# application.properties
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=30s
management.endpoint.health.probes.enabled=true
```

Explain: `maxUnavailable: 0` with `maxSurge: 1` keeps four ready pods all the time; `minReadySeconds` makes a new pod prove itself before an old one is removed; readiness decides who gets traffic and liveness restarts a stuck process, so they use different endpoints; the `preStop` sleep gives the endpoints time to be removed before the process receives SIGTERM; and the grace period (45 s) is longer than the 5 s sleep plus the 30 s shutdown phase, so Spring can finish in-flight requests.

### [coding] Write an Argo Rollouts canary that goes 10, 30 and 60 percent with analysis between the steps. {#coding-canary}

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: payments
spec:
  replicas: 6
  selector:
    matchLabels: { app: payments }
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 30
        - pause: { duration: 10m }
        - setWeight: 60
        - pause: { duration: 10m }
  template:
    metadata:
      labels: { app: payments }
    spec:
      containers:
        - name: payments
          image: registry.example.com/payments:1.4.2
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
    - name: payment-success
      interval: 1m
      count: 5
      successCondition: result[0] >= 0.995
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(payments_completed_total{app="payments",version="canary"}[2m]))
            / sum(rate(payments_attempted_total{app="payments",version="canary"}[2m]))
```

Explain: the weights are applied through the configured traffic router; after the first pause an analysis queries the **business** success rate of the canary and, if it falls below 99.5 percent more than once, the rollout **aborts** and the traffic returns to the stable version automatically; the pauses give metrics time to accumulate; and when the last step passes, the canary is promoted to be the stable version. A manual `kubectl argo rollouts abort payments` is always available.

### [coding] Write the two migrations (expand and contract) for renaming `customer.name` to `full_name` with Flyway. {#coding-migration}

```sql
-- V12__expand_customer_full_name.sql   (release N: expand)
ALTER TABLE customer ADD COLUMN full_name VARCHAR(200) NULL;

-- backfill in batches, from a separate job so it does not lock the table for long
-- UPDATE customer SET full_name = name WHERE full_name IS NULL AND id BETWEEN :from AND :to;

-- V13__contract_customer_name.sql      (release N+2, only when no old version can return)
ALTER TABLE customer DROP COLUMN name;
```

Explain the releases around them: **release N** runs V12, and the code writes both `name` and `full_name` and reads `full_name`, falling back to `name`; a batch job fills the old rows; **release N+1** reads and writes only `full_name` once the backfill is verified; **release N+2** runs V13 and removes the old column. The column is nullable so the old version, which does not know it, can still insert rows; the drop happens in a later release so a rollback of N+1 still finds the old column; and the migration is a separate, earlier pipeline step so a failure stops the release before any traffic moves.
