---
title: Deploying Node.js services — Docker images, configuration, Kubernetes, zero-downtime rollouts and operations
nav: Node.js deployment
slug: node-deployment
summary: Taking a Node.js service to production, build once and promote the same artifact, pnpm frozen lockfile installs, TypeScript builds and Node version pinning, multi-stage Dockerfiles with slim non-root images and node as PID 1, .dockerignore and layer caching and image scanning, twelve-factor configuration with validation at startup and secrets from a secret manager, signals and graceful shutdown and the keep-alive trap, liveness and readiness and startup probes, Kubernetes Deployment with rolling updates and resources and HPA and PodDisruptionBudget, reverse proxy and trust proxy and timeouts, CI/CD pipeline with GitHub Actions, canary and blue-green and expand-and-contract migrations, serverless and Lambda and ECS compared, logs and metrics and crash diagnostics, hardening, compared with Spring Boot jars and JVM containers, with banking examples and interview questions.
tags: [Node.js, Deployment, Docker, Kubernetes, CI/CD, Configuration, Graceful shutdown, DevOps, Backend, Full stack]
order: 75
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

Deployment questions in a Node.js interview check that you can take a service from a laptop to production without surprises. Expect questions like these:

- How do you build the image, and why use several stages?
- Why not run as root?
- Why start the container with `node` and not `npm start`?
- Where do configuration and secrets come from?
- What do liveness and readiness mean?
- What happens when a pod is stopped?
- How do you roll out without dropping requests?
- How does a database migration fit a rolling update?
- How many CPUs and how much memory does a pod need?
- How do you find out that a release is bad?

This lesson covers those. It builds on [Docker](lesson:docker#multistage), [Kubernetes](lesson:kubernetes#probes), [deployment strategies](lesson:deployment-strategies#rolling), [CI/CD](lesson:cicd-fundamentals#stages) and the [Node.js runtime](lesson:node-runtime#shutdown). The examples use a banking transfer service. Play the four scenes: build the image, config and secrets, zero-downtime rollout, and right-size and watch.

```demo
name: node-deploy-walk
```

> **One sentence to remember:** *Build one small, non-root image, and run that same image everywhere.*

Configure it only through validated environment variables and injected secrets. Let `node` receive SIGTERM and drain gracefully behind readiness probes. Roll out gradually, with metrics watching. Size each pod for a process with one main thread.

## What deployment means for a Node service {#overview}

The guiding rules are the **twelve-factor app** principles. They matter more than any tool:

| Principle | In practice |
| --- | --- |
| **one codebase, many deploys** | the same commit goes to test, staging and production |
| **build, release, run are separate** | build the artifact once, add config at release, run it |
| **dependencies declared and isolated** | a lockfile and a pinned Node version, no global installs |
| **config in the environment** | environment variables and secrets, never in the code or the image |
| **stateless processes** | no local files or memory as the source of truth: sessions in Redis, data in the database |
| **disposable** | fast start, graceful stop, can be killed any time |
| **logs are an event stream** | write to stdout, the platform ships them |
| **dev and production alike** | the same image and the same engines (PostgreSQL, Redis) everywhere |

Where it can run:

| Target | Fits | Remember |
| --- | --- | --- |
| **a VM with PM2 or systemd** | small, simple systems | you manage the OS, restarts and rollouts |
| **container on ECS Fargate or Cloud Run** | most services, simple operations | health checks, rolling updates built in |
| **Kubernetes** | many services, a platform team | the most control and the most to learn |
| **serverless (Lambda)** | spiky, event-driven, small functions | cold starts, no long-lived connections |
| **PaaS (Heroku, Render, Elastic Beanstalk)** | small teams | fast start, less control |

A bank usually runs containers on Kubernetes or ECS. The rest of this lesson assumes that. It notes where serverless differs ([serverless section](#serverless)).

## Building the artifact {#build}

A repeatable build starts with **dependencies you can reproduce**:

- **Commit the lockfile** (`pnpm-lock.yaml`). Install with **`pnpm install --frozen-lockfile`** in CI and in the Dockerfile. It fails if `package.json` and the lockfile disagree, instead of quietly picking new versions.
- **Pin the Node version.** Use `.nvmrc`, or `engines` in `package.json`, for developers. Use the same major version in the Dockerfile's base image. In production, use an even-numbered LTS (long-term support) release.
- **TypeScript.** Compile it in the build stage, with `tsc`, or `esbuild` and `tsup` for speed. Then **run the compiled JavaScript**. Running `ts-node` or `tsx` in production adds startup time and memory. Emit source maps, and run with `node --enable-source-maps`, so stack traces point at the TypeScript.
- **Set `NODE_ENV=production`** at runtime. Express and many libraries then turn off verbose errors and turn on caching.
- **Ship production dependencies only** in the final image, with `pnpm install --prod` or `pnpm prune --prod`. Dev dependencies, such as compilers, test tools and linters, make the image bigger and give attackers more to work with.
- **Supply chain.** Review new dependencies. Run `pnpm audit` in CI. Consider `ignore-scripts` for installs, and an internal registry mirror. Generate an **SBOM** (software bill of materials) for the image.
- **Bundling** with esbuild into one file shortens startup and shrinks the image. It is common for serverless. For a long-running service, copying `node_modules` is usually fine.

## The Dockerfile {#docker}

Here is a multi-stage Dockerfile for a TypeScript service built with pnpm (see [multi-stage builds](lesson:docker#multistage)):

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# 1. install dependencies: this layer is cached until the lockfile changes
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# 2. compile, then drop dev dependencies
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

# 3. the runtime image: only what is needed to run
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/main.js"]
```

I did not build this image in the session. Treat the details as a template, and build it once to confirm the paths.

Why each choice:

- **Multi-stage.** The compiler, dev dependencies and caches stay in the build stages. The final image holds only the runtime, `node_modules` and `dist`.
- **Order for caching.** Copy `package.json` and the lockfile first, and install. Then copy the source. Changing a source file then does not reinstall dependencies. A **BuildKit cache mount** keeps the pnpm store between builds.
- **Base image.**
  - `node:22-slim` (Debian) is a good default.
  - **Alpine** is smaller, but it uses musl instead of glibc. That breaks some native modules, and can change behaviour, so test it.
  - **Distroless** (`gcr.io/distroless/nodejs22`) has no shell and no package manager. That gives the smallest attack surface, but it is harder to debug.
  - Pin the base image by **digest**, so builds are reproducible. Rebuild regularly to pick up security patches.
- **`USER node`.** Never run as root. Then a compromised process cannot easily change the image or reach the host. Add a **read-only root filesystem**, and no extra Linux capabilities, in the orchestrator.
- **`CMD ["node", "dist/main.js"]`**, in **exec form** (a JSON array). Not `CMD npm start`, and not the shell form.
  - With npm or a shell as PID 1, **SIGTERM is not forwarded** to your app. So it never shuts down gracefully, and is killed after the grace period: 30 s on Kubernetes.
  - With `node` as PID 1, you must handle signals yourself ([graceful shutdown](#process)).
  - Or run an init process as PID 1, with `docker run --init` or `tini`. That also cleans up zombie processes.
- **`HEALTHCHECK`** is used by Docker and Compose. Kubernetes ignores it, and uses its own probes. A tiny `node -e` check avoids needing `curl` in the image.
- **No secrets in the image.** Not as `ENV`, not through `COPY .env`, and not in build arguments, which stay in the image history. For secrets needed at build time, use `RUN --mount=type=secret`.

`.dockerignore` keeps the build context small, and keeps secrets out:

```
node_modules
dist
.git
.env*
coverage
*.md
Dockerfile
```

In the pipeline:

- **scan the image** with Trivy, Grype or the registry's scanner, and fail the build on critical vulnerabilities;
- **sign** it with Cosign;
- tag it with the **git SHA**, and pass the digest forward. Never use `latest`.

## Configuration and secrets {#config}

Build the image once, and run the **same image** in every environment. Only the configuration changes, and it arrives from outside (see [process, configuration and exit codes](lesson:node-runtime#process)):

- **Environment variables** hold plain settings: `PORT`, `DATABASE_URL`, feature flags, timeouts. On Kubernetes they come from a **ConfigMap**.
- **Secrets**, such as passwords, signing keys and API keys, come from a **secret manager** (AWS Secrets Manager, HashiCorp Vault) or a Kubernetes **Secret**.
  - They are injected as environment variables or mounted files when the container starts.
  - Grant access by identity, such as an IAM role for the pod, not by a shared password.
  - Rotate them without rebuilding.
  - Never log them, and never commit `.env` files.
- A Kubernetes Secret is only base64-encoded, not encrypted. Turn on **encryption at rest**, and restrict access with RBAC. Or use the External Secrets Operator, or a CSI driver that reads from the secret manager.
- **`node --env-file=.env`** (Node 20.6+) is for local development, not production.

### Validate at startup, fail fast

The process should check its configuration before it listens. It should report **all** problems at once, and exit with a non-zero code.

On Kubernetes, a pod that crashes at startup stops the **rollout**, and the old version keeps serving. A service that starts and then fails on its first request is much worse.

```javascript
// config.js: no library needed (zod or envalid do the same with a schema)
export function loadConfig(env = process.env) {
  const problems = [];
  const str = (name, { required = true, fallback } = {}) => {
    const v = env[name] ?? fallback;
    if ((v === undefined || v === '') && required) problems.push(`${name} is required`);
    return v;
  };
  const int = (name, fallback, { min = 1, max = 65535 } = {}) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) problems.push(`${name} must be an integer between ${min} and ${max}`);
    return n;
  };
  const oneOf = (name, allowed, fallback) => {
    const v = env[name] ?? fallback;
    if (!allowed.includes(v)) problems.push(`${name} must be one of ${allowed.join(', ')}`);
    return v;
  };

  const config = Object.freeze({
    nodeEnv: oneOf('NODE_ENV', ['development', 'test', 'production'], 'development'),
    port: int('PORT', 3000),
    databaseUrl: str('DATABASE_URL'),
    shutdownTimeoutMs: int('SHUTDOWN_TIMEOUT_MS', 25_000, { min: 1000, max: 120_000 }),
  });
  if (problems.length) {
    const err = new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
    err.code = 'INVALID_CONFIG';
    throw err;
  }
  try { new URL(config.databaseUrl); } catch { throw new Error('Invalid configuration:\n - DATABASE_URL must be a valid URL'); }
  return config;
}
```

I ran this with `node:test`. Valid values give a frozen config. A missing `DATABASE_URL`, `PORT=abc` and `NODE_ENV=prod` are all reported in one error. Print the problems, but **never the values** of secrets.

## Process lifecycle and graceful shutdown {#process}

A container is a process, and the orchestrator controls its life with signals. To stop a pod, Kubernetes does this:

1. removes the pod from the Service endpoints;
2. sends **SIGTERM**;
3. waits `terminationGracePeriodSeconds`, 30 s by default;
4. sends **SIGKILL**, which cannot be handled.

A service that ignores SIGTERM drops its in-flight requests, and any half-done work.

The graceful sequence, shown in the third scene:

1. **Fail readiness** at once, so the load balancer stops sending new requests.
2. **Stop accepting connections** with `server.close()`, and let in-flight requests finish.
3. **Close idle keep-alive connections.** Otherwise `server.close()` waits for them (see below).
4. **Release resources**: the database pool, queue consumers and producers, Redis. Flush the logs.
5. **Exit with code 0.** Keep a **timer** as a safety net, which exits non-zero shortly before the grace period ends.

```javascript
import http from 'node:http';

export function createServer({ pool, shutdownTimeoutMs = 25_000, log = console.log } = {}) {
  let ready = false;
  let shuttingDown = false;

  const server = http.createServer(async (req, res) => {
    if (req.url === '/health/live') { res.statusCode = 200; return res.end('alive'); }     // the process is not stuck
    if (req.url === '/health/ready') {                                                      // can it take traffic now?
      res.statusCode = ready && !shuttingDown ? 200 : 503;
      return res.end(res.statusCode === 200 ? 'ready' : 'not ready');
    }
    /* ... the application routes ... */
  });
  server.keepAliveTimeout = 65_000;       // above the load balancer idle timeout (60 s on an ALB)

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;                                    // 1. readiness now fails
    log(`${signal} received, draining`);
    const timer = setTimeout(() => { log('forced exit'); process.exit(1); }, shutdownTimeoutMs);
    timer.unref();
    await new Promise((resolve) => {
      server.close(resolve);                                // 2. stop accepting, wait for in-flight requests
      const sweep = setInterval(() => server.closeIdleConnections(), 100);   // 3. close sockets as they become idle
      sweep.unref();
      server.once('close', () => clearInterval(sweep));
    });
    await pool?.end();                                      // 4. release resources
    clearTimeout(timer);
    log('shutdown complete');
  }

  return {
    server,
    shutdown,
    async start(port) {
      await pool?.connect?.();                              // ready only after dependencies are up
      await new Promise((r) => server.listen(port, r));
      ready = true;
      return server.address().port;
    },
  };
}

const app = createServer({ pool });
await app.start(config.port);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.shutdown(signal).then(() => process.exit(0)));
```

**The keep-alive trap.** `server.close()` stops accepting new connections, but it waits until every existing connection ends. A keep-alive connection that goes idle after its last response stays open for `keepAliveTimeout`.

In my first test of this code, I called `closeIdleConnections()` only once, at the start. The drain then waited about **60 seconds**, for a socket that went idle later.

The fix is to sweep regularly, as above, or to answer with `Connection: close` during shutdown. My test starts a slow request, calls `shutdown`, and checks three things: the request completes, the pool is closed afterwards, and new connections are refused. It now finishes in about 0.4 s.

More lifecycle points:

- **Exit codes.** Use `0` for a clean stop, and non-zero for a failure, so the orchestrator and CI can tell them apart. Do not call `process.exit` in the middle of the work. Set `process.exitCode`, or finish the shutdown first.
- **Crashes.** Handle `uncaughtException` and `unhandledRejection` by **logging and exiting**, and let the orchestrator restart the pod. Carrying on in an unknown state is more dangerous than restarting. Then fix the cause ([error handling](lesson:node-runtime#errors)).
- **Restarts.** On Kubernetes, the kubelet restarts failed containers with a growing delay. If they keep failing, the pod shows `CrashLoopBackOff`. On a VM, use **systemd** or **PM2**. `pm2-runtime` inside a container is rarely needed, because the orchestrator already restarts and scales.
- **Several cores.** Run more pods, rather than `cluster` inside a container, unless you must use a bigger VM ([using more than one core](lesson:node-runtime#scaling)). `os.availableParallelism()` reports the CPUs a process may use.

## Health checks {#health}

There are three questions, and three endpoints (see [probes](lesson:kubernetes#probes)):

| Endpoint | Question | Checks | On failure |
| --- | --- | --- | --- |
| `/health/live` | is the process stuck? | the event loop answers, nothing else | the container is **restarted** |
| `/health/ready` | can it take traffic now? | started, dependencies reachable, not shutting down | the pod is **removed from the Service**, not restarted |
| startup probe | has it finished starting? | the same as ready, with a long timeout | slow starters get time before the liveness probe applies |

Rules:

- **Keep liveness free of external dependencies.** If the database is down and liveness checks it, every pod restarts, and the outage grows.
- Put dependency checks in **readiness**. Keep them cheap and time-limited: for example, a pooled `SELECT 1` with a 1 s timeout, cached for a few seconds.
- Readiness must report **not ready as soon as shutdown begins**.
- Do not put heavy work or authentication on these endpoints. Keep them off the public ingress.

## Kubernetes deployment {#kubernetes}

Here is a Deployment for the transfer service (see [Kubernetes](lesson:kubernetes#yaml) for the objects):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: transfer-service
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }       # start a new pod before stopping an old one
  selector:
    matchLabels: { app: transfer-service }
  template:
    metadata:
      labels: { app: transfer-service }
    spec:
      terminationGracePeriodSeconds: 30
      securityContext: { runAsNonRoot: true, seccompProfile: { type: RuntimeDefault } }
      containers:
        - name: app
          image: registry.example.com/bank/transfer-service@sha256:<digest>     # an immutable digest, not "latest"
          ports: [{ containerPort: 3000 }]
          env:
            - { name: NODE_ENV, value: production }
            - { name: NODE_OPTIONS, value: "--max-old-space-size=384 --enable-source-maps" }   # about 75% of 512Mi
          envFrom:
            - configMapRef: { name: transfer-service-config }
            - secretRef: { name: transfer-service-secrets }
          resources:
            requests: { cpu: 500m, memory: 512Mi }
            limits: { memory: 512Mi }                       # a memory limit, deliberately no CPU limit
          startupProbe:  { httpGet: { path: /health/live,  port: 3000 }, periodSeconds: 2, failureThreshold: 30 }
          livenessProbe: { httpGet: { path: /health/live,  port: 3000 }, periodSeconds: 10, timeoutSeconds: 2 }
          readinessProbe: { httpGet: { path: /health/ready, port: 3000 }, periodSeconds: 5, timeoutSeconds: 2 }
          lifecycle:
            preStop: { exec: { command: ["sleep", "5"] } }   # let endpoint updates reach the load balancers first
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
          volumeMounts: [{ name: tmp, mountPath: /tmp }]
      volumes: [{ name: tmp, emptyDir: {} }]
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: transfer-service }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: transfer-service }
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: transfer-service }
spec:
  minAvailable: 2
  selector:
    matchLabels: { app: transfer-service }
```

I did not apply this YAML to a cluster in the session. It is a template, so check the field names against your Kubernetes version.

What to note:

- **Rolling update** with `maxUnavailable: 0` and `maxSurge: 1`. Capacity never drops. New pods join only after readiness passes. Old pods stop with the graceful sequence above. `kubectl rollout status` waits for it, and `kubectl rollout undo` goes back ([rollouts](lesson:kubernetes#rollouts)).
- **`preStop` sleep.** After a pod is marked terminating, its removal from the endpoints takes a moment to reach the proxies and load balancers. So requests can still arrive for a few seconds. Sleeping 5 s before SIGTERM covers that gap. `terminationGracePeriodSeconds` must be longer than the `preStop` sleep plus your shutdown timeout.
- **Resources and Node.**
  - JavaScript runs on one thread, so a pod rarely uses more than about **one CPU**. Request 500 m to 1 CPU, and **scale out** with more replicas.
  - A **CPU limit** can throttle the process in bursts and raise latency. So many teams set a CPU request, and no CPU limit.
  - A **memory limit** is essential. Set the V8 heap (`--max-old-space-size`) to about **70 to 75%** of it, because Buffers and native memory live outside the heap ([memory](lesson:node-performance#memory)). If the heap limit equals the container limit, the pod is `OOMKilled`.
- **Autoscaling.** CPU is a fair default. For I/O-heavy Node services, **event loop utilisation or request concurrency** often react sooner, through custom metrics and KEDA. Keep at least two or three pods across zones, and set a maximum.
- **PodDisruptionBudget.** Node drains and cluster upgrades never remove more pods at once than the budget allows.
- **Topology spread**, or anti-affinity, spreads replicas across nodes and zones.
- **Config.** Use a ConfigMap and a Secret, as above. Changing them does not restart pods by itself. So roll the Deployment: a hash annotation does it, as do Helm and Kustomize.

## Reverse proxy, ingress and timeouts {#proxy}

In production, clients do not talk to Node directly. They reach a load balancer or an **ingress**, such as nginx, an ALB or an API gateway. It terminates TLS, routes requests and limits them. This affects the Node code:

- **`app.set('trust proxy', 1)`** (Express). Then `req.ip`, `req.protocol` and `req.secure` come from `X-Forwarded-For` and `X-Forwarded-Proto`. Without it, rate limiting sees the proxy's address, and `Secure` cookies are not set. Trust only the **known number of hops**, because a client can forge those headers.
- **Timeouts must nest.** The load balancer's idle timeout (60 s on an ALB) must be shorter than Node's `server.keepAliveTimeout` (set it to 65 s). That in turn must be shorter than `server.headersTimeout`. If Node closes a connection the load balancer still thinks is open, you see occasional **502 errors** on the first request after a quiet period.
- **Let the proxy do what it does better**: TLS, HTTP/2, compression, static files and a CDN, rate limiting, request size limits and WAF rules. Node still sets its own body limits and timeouts, as a second layer of defence ([Express middleware](lesson:node-express-middleware#common)).
- **The load balancer's health checks** should call the readiness endpoint, and that response must stay cheap.

## CI/CD pipeline {#cicd}

A typical pipeline has these stages (from [CI/CD fundamentals](lesson:cicd-fundamentals#stages)): **install, lint and type check, test, build, scan, package the image, push, deploy to an environment, verify, promote.** Here is a GitHub Actions workflow for the first part:

```yaml
name: ci
on:
  pull_request:
  push: { branches: [main] }

jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck
      - run: pnpm test                                        # unit and integration tests (Docker for Testcontainers)
      - run: pnpm audit --prod --audit-level=high
      - uses: docker/login-action@v3
        if: github.ref == 'refs/heads/main'
        with: { registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}" }
      - uses: docker/build-push-action@v6
        with:
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ghcr.io/example/transfer-service:${{ github.sha }}      # the git SHA identifies the build
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Practices:

- **Build once, promote the digest.** The image tested in staging is the one that goes to production, so "it worked on staging" surprises go away. Deploy by updating the image digest in a Git repository (**GitOps**, with Argo CD or Flux). Or use a pipeline job, with an approval step for production.
- **Cache** the pnpm store and the Docker layers, to keep the pipeline fast ([GitLab CI](lesson:gitlab-ci#artifacts) shows the same ideas).
- **Gates.** Tests, type check, audit and image scan. For production, add a manual approval and a change record, which banks usually require ([quality gates](lesson:cicd-fundamentals#gates)).
- **Smoke tests** after each deployment, such as a login and a read-only call. **Check the metrics** before widening a rollout.
- **Rollback** means deploying the previous digest. Keep it fast, and rehearse it ([rollback](lesson:cicd-fundamentals#rollback)).

### Rollout strategies and database changes

During a **rolling update**, both versions run at the same time, against one database. So every change must stay **backward compatible** for one release.

Two strategies reduce risk further ([canary](lesson:deployment-strategies#canary)):

- **Canary**: a small share of traffic goes to the new version. Metrics are watched, and the release rolls back automatically if they break a threshold.
- **Blue-green**: two full environments, with traffic switched over at once.

Feature flags separate deploying code from releasing a feature.

For schema changes, use **expand and contract** (see [database changes during a release](lesson:deployment-strategies#database)):

1. **Expand**: add the new column or table, nullable or with a default. Old code ignores it.
2. **Deploy** code that writes to both, or reads from the new one with a fallback. Backfill the data.
3. **Contract** in a later release, once no old version runs: remove the old column.

Run migrations as a **separate step** before the rollout. Use a Kubernetes Job, or a pipeline step with a migration tool such as `node-pg-migrate`, Prisma Migrate or Flyway. Do not run them inside every pod at startup. There, several pods race each other, and a slow migration fails the readiness probe.

A migration that locks a big table can take the service down. Examples are `ALTER TABLE ... ADD COLUMN ... DEFAULT` on older PostgreSQL versions, and an index created without `CONCURRENTLY`. So check the lock behaviour first.

## Serverless and other targets {#serverless}

| Target | Node specifics |
| --- | --- |
| **AWS Lambda** ([Lambda](lesson:aws-compute#lambda)) | a handler function, not a server. **Cold starts** grow with bundle size, so bundle with esbuild and import only what you need. Create clients (database pool, AWS SDK) **outside the handler** so warm invocations reuse them. Many concurrent functions open many database connections, so use **RDS Proxy** or a data API. No background work after the response. Time limit of 15 minutes. |
| **ECS Fargate** ([ECS](lesson:aws-compute#ecs)) | the same container as above, health checks on the target group, rolling or blue-green through CodeDeploy, task roles for secrets |
| **Cloud Run, App Runner** | a container with a port, scale to zero, request-based pricing, same signals and probes |
| **VM with PM2 or systemd** | install Node with a version manager, run the process under systemd with `Restart=on-failure`, a reverse proxy in front, rolling restarts one VM at a time |
| **Front end (React)** | a static build uploaded to S3 and served by CloudFront with a long cache for hashed assets and no cache for `index.html`. Not a Node deployment at all ([integration](lesson:fullstack-integration#deploy)) |

## Logs, metrics and diagnostics in production {#observe}

- **Logs.** Write JSON lines to **stdout** with pino: one event per line, with a request id, a level and a timestamp. Do not write log files inside the container. Never log secrets, tokens or full card numbers. The platform ships the logs, with a tool such as Fluent Bit, CloudWatch or Loki.
- **Metrics and traces.** `prom-client` or OpenTelemetry exports request rate, errors, duration (p50, p95, p99), event loop lag and utilisation, heap used and pool use. Alert on **symptoms**, such as error rate and p99. Use the rest to explain them ([performance](lesson:node-performance#production)).
- **Source maps.** `--enable-source-maps` gives readable stack traces from compiled TypeScript.
- **Crash diagnostics.**
  - `--report-on-fatalerror` and `--report-on-signal` write a **diagnostic report**: JSON with stacks, heap and handles.
  - `--heapsnapshot-near-heap-limit` writes a heap snapshot just before an out-of-memory crash.
  - `kubectl debug` attaches a temporary container to a running pod.
  - `kubectl logs --previous` shows why the last container died.
- **Release markers** on dashboards, such as a version label on each metric, show whether a new release caused a change.

Useful commands when a rollout goes wrong:

```bash
kubectl rollout status deployment/transfer-service
kubectl rollout undo deployment/transfer-service
kubectl describe pod <pod>                  # events: probe failures, OOMKilled, image pull errors
kubectl logs <pod> --previous               # logs of the crashed container
kubectl top pod                             # CPU and memory in use
```

## Production hardening {#security}

- **Image**: slim or distroless, non-root, a read-only root filesystem, no capabilities. Scan it, sign it, and rebuild it often for patches ([image security](lesson:docker#security)).
- **Process**: `NODE_ENV=production`, `helmet` for security headers, body size limits, timeouts, rate limiting and input validation ([Node security basics](lesson:node-runtime#security)). Newer Node versions also have an experimental **permission model** (`--permission`), which restricts file system and child process access.
- **Dependencies**: a lockfile, `pnpm audit`, Dependabot or Renovate, few direct dependencies, and no install scripts from unknown packages.
- **Network**: Kubernetes **NetworkPolicies**, so the pod talks only to what it needs. Use TLS to the database, and restrict outbound traffic where you can.
- **Secrets**: from the secret manager, by workload identity. Rotate them. Keep them out of logs and error messages.
- **Auditability**: record the image digest, commit SHA and approval for every production change. Bank regulators ask for this.

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| `npm install` in the Dockerfile, no lockfile check | `pnpm install --frozen-lockfile` |
| one big image with dev dependencies and the compiler | multi-stage build, production dependencies only |
| running as root | `USER node`, non-root, read-only filesystem |
| `CMD npm start` or the shell form | `CMD ["node", "dist/main.js"]` |
| no SIGTERM handler | graceful shutdown with a safety timer |
| `server.close()` hangs on idle keep-alive sockets | sweep `closeIdleConnections()` or send `Connection: close` while draining |
| readiness stays green during shutdown | fail readiness first |
| liveness checks the database | liveness is process-only, dependencies go in readiness |
| config baked in the image, a different image per environment | one image, environment variables at release |
| secrets in `ENV`, build args or the repository | secret manager, injected at start |
| config not validated, the service starts and fails later | validate at startup, exit non-zero |
| the heap limit equals the container memory limit | about 70 to 75% of it |
| a CPU limit that throttles the process | a CPU request, no CPU limit (or a generous one) |
| `latest` tags | git SHA tags and digests |
| keep-alive timeout below the load balancer idle timeout | Node 65 s above the ALB's 60 s |
| trusting `X-Forwarded-For` from anywhere | `trust proxy` with the exact hop count |
| migrations run by every pod at startup | a separate migration job before the rollout |
| a breaking schema change in one release | expand and contract |
| no rollback plan | keep the previous digest, rehearse `rollout undo` |
| logs written to files in the container | JSON to stdout |

## For a Java developer {#java}

| Spring Boot on the JVM | Node.js |
| --- | --- |
| a fat JAR (`java -jar`) | `dist` plus `node_modules`, or one bundled file |
| Maven or Gradle build | `pnpm install --frozen-lockfile` and `tsc` or esbuild |
| JDK and JRE versions | Node LTS version in `.nvmrc` and the image |
| Jib, Cloud Native Buildpacks, Dockerfile with layers | multi-stage Dockerfile, or `pack` buildpacks |
| `-Xmx`, `-XX:MaxRAMPercentage=75` | `--max-old-space-size` at about 75% of the limit |
| JVM warm-up, JIT, long startup, startup probe | fast start, but still validate and warm connections before ready |
| Actuator `/health/liveness` and `/health/readiness` | your own `/health/live` and `/health/ready` |
| `server.shutdown=graceful` | your own SIGTERM handler with `server.close()` |
| Spring profiles and `application-prod.yml` | environment variables, validated at startup |
| Spring Cloud Config, Vault | the same: Vault, Secrets Manager, ConfigMap |
| many threads per pod, several CPUs per pod | one thread, about one CPU per pod, scale out |
| thread dump, JFR | diagnostic report, `--cpu-prof`, heap snapshot |
| Micrometer and Actuator metrics | `prom-client` and OpenTelemetry |
| Flyway, Liquibase | `node-pg-migrate`, Prisma Migrate, Flyway also works |

Try it in the lab: [Graceful shutdown of a Node service](lab:node-graceful-shutdown).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| principles | build once, config from the environment, stateless, disposable, logs to stdout |
| install | `pnpm install --frozen-lockfile`, lockfile committed, Node pinned |
| TypeScript | compile in the build stage, run `node dist/main.js`, source maps on |
| Dockerfile | multi-stage, slim image, `USER node`, `CMD ["node", ...]`, `.dockerignore`, BuildKit cache |
| image | tag with the git SHA, pin the digest, scan, sign, never `latest` |
| config | env vars and a secret manager, validate at startup, fail fast |
| shutdown | SIGTERM, fail readiness, `server.close()`, sweep idle sockets, close pools, exit 0, safety timer |
| probes | liveness is the process only, readiness is dependencies and shutdown, startup for slow starts |
| Kubernetes | `maxUnavailable: 0`, `preStop` sleep, PDB, HPA, grace period longer than shutdown |
| resources | about 1 CPU per pod, scale out, memory limit, heap at about 75% |
| proxy | `trust proxy`, keep-alive 65 s above the load balancer's 60 s, TLS and compression at the edge |
| pipeline | install, lint, test, build, scan, image, push, deploy, verify, promote the digest |
| releases | rolling, canary, blue-green, feature flags, automatic rollback on metrics |
| database | expand and contract, migrations as a separate job, avoid long locks |
| serverless | bundle small, init outside the handler, RDS Proxy, no background work |
| observe | JSON logs, p99 and error alerts, event loop lag, diagnostic reports |
| harden | non-root, read-only filesystem, no capabilities, audit, network policies |

## Interview questions {#questions}

### [basic] What does "build once, deploy everywhere" mean and why does it matter? {#build-once-q}

The artifact, a container image, is built once in CI. It is identified by a digest or a git SHA. That same artifact is promoted through test, staging and production. Only the configuration differs, supplied through environment variables and secrets.

It matters because what you tested is exactly what runs in production. A separate build per environment can pick up different dependencies or code. Then your tests no longer prove anything about production.

### [basic] Why use a multi-stage Dockerfile for a Node.js service? {#multistage-q}

The build stage needs compilers, dev dependencies and caches to produce `dist`. None of that is needed at runtime.

A second stage copies only the compiled output and the production dependencies onto a slim base image. The result is smaller, faster to pull, and gives an attacker less to work with.

Copying the package files and lockfile before the source also keeps the dependency layer cached.

### [basic] Why should a container not run as root, and how do you avoid it? {#root-q}

If an attacker gets to run code, root inside the container helps them. They can change the image's files more easily, abuse mounted volumes, and attempt to escape the container.

To avoid it:

- run as a non-root user (`USER node`), and copy files with the right ownership;
- make the root filesystem read-only, with a writable `/tmp` if needed;
- drop all Linux capabilities, and disallow privilege escalation;
- require `runAsNonRoot` in the Kubernetes security context.

### [basic] Why is `CMD ["node", "dist/main.js"]` better than `CMD npm start`? {#cmd-q}

Because of signals. With `npm start`, or the shell form, npm or the shell is PID 1. It does not forward SIGTERM to the Node process.

So the app cannot shut down gracefully. It is killed with SIGKILL after the grace period. That drops in-flight requests, and slows every deployment by the full grace period.

The exec form makes `node` PID 1. It receives the signal, and must handle it. An init process such as tini also works, and it cleans up zombie processes.

### [basic] What is the difference between liveness and readiness probes? {#probes-q}

Liveness asks whether the process is stuck and needs a restart. So it checks only the process: does the event loop answer?

Readiness asks whether the pod can handle traffic right now. So it covers dependencies, whether startup has finished, and whether shutdown has begun. A failure removes the pod from the Service, without restarting it.

If liveness checked the database, a database outage would restart every pod, and make things worse.

### [intermediate] How do you manage configuration and secrets for a Node.js service across environments? {#config-q}

Configuration comes from environment variables, following twelve-factor. On Kubernetes, they come from a ConfigMap. The process validates them against a schema when it starts. It reports every problem, and exits non-zero.

Secrets come from a secret manager, or a Kubernetes Secret with encryption at rest. They are injected as environment variables or files. Access is granted to the workload's identity. They are rotated without a rebuild.

Secrets are never baked into the image, build arguments or the repository, and never logged. The image is the same everywhere.

### [intermediate] Walk through what happens when a pod is terminated and how a Node.js service should respond. {#shutdown-q}

Kubernetes marks the pod as terminating, and removes it from the endpoints. It runs the `preStop` hook, then sends SIGTERM. After `terminationGracePeriodSeconds`, it sends SIGKILL.

The service should:

1. fail readiness at once;
2. stop accepting connections with `server.close()`, and let in-flight requests finish;
3. close idle keep-alive sockets. One call is not enough, because sockets become idle later;
4. close the database pool and other resources;
5. exit 0.

A safety timer exits non-zero before the grace period ends. A short `preStop` sleep covers the delay before the proxies learn the pod is leaving.

### [intermediate] How do you deploy without downtime? {#zero-downtime-q}

Run at least two or three replicas. Use a rolling update with `maxUnavailable: 0` and `maxSurge: 1`. Then a new pod starts and passes readiness before an old pod is stopped.

Also:

- make shutdown graceful;
- add a PodDisruptionBudget;
- keep database changes backward compatible, because old and new versions run together;
- watch error rate, p99 and event loop lag during the rollout;
- use a canary for risky changes;
- keep `rollout undo`, or the previous digest, ready.

### [intermediate] How do you run database migrations safely with a rolling deployment? {#migration-q}

Use expand and contract.

1. Add the new structure in a backward compatible way, such as a new nullable column or table.
2. Deploy code that works with both, and backfill the data.
3. In a later release, once no old version runs, remove the old structure.

Run migrations as a separate job, or pipeline step, before the rollout. Inside each pod at startup, pods race each other, and slow migrations break readiness.

Check the lock behaviour: create indexes `CONCURRENTLY`, and avoid long table rewrites.

### [intermediate] How do you set CPU, memory and the heap size for a Node.js pod? {#resources-q}

Node runs JavaScript on one thread, so a pod usually needs about one CPU. Request 500 m to 1 CPU, and scale out with replicas. Many teams leave out the CPU limit, to avoid throttling.

Set a memory limit. Set the V8 heap limit (`--max-old-space-size`) to about 70 to 75% of it, because Buffers and native memory are outside the heap. Otherwise the pod is OOMKilled before Node reports a heap error.

Autoscale on CPU. For I/O-heavy services, event loop utilisation or request concurrency is better. Keep a minimum of two or three pods.

### [intermediate] A user sometimes gets a 502 on the first request after a quiet period. What is the likely cause? {#502-q}

A keep-alive timeout mismatch.

The load balancer keeps an idle connection open for 60 seconds. Node's default `keepAliveTimeout` is 5 seconds. So Node closes the connection first. The load balancer then sends a request on a connection that is already closed.

Set `server.keepAliveTimeout` above the load balancer's idle timeout, for example 65 s. Set `headersTimeout` above that.

### [intermediate] What do you need to configure in Express when it runs behind a reverse proxy? {#proxy-q}

Set `app.set('trust proxy', n)`, with the exact number of trusted hops. Then `req.ip`, `req.protocol` and `req.secure` use the `X-Forwarded-*` headers. That matters for rate limiting, secure cookies and redirects. Do not trust those headers from arbitrary clients.

Also:

- line up the keep-alive timeouts;
- let the proxy handle TLS, compression and static files;
- expose a cheap readiness endpoint for the load balancer;
- still keep body size limits and timeouts in the app.

### [intermediate] How would you reduce supply chain risk in a Node.js deployment? {#supply-q}

- Commit the lockfile, and install with `--frozen-lockfile`.
- Pin versions, and review new dependencies and their install scripts.
- Run `pnpm audit` and automated updates (Renovate or Dependabot) in CI.
- Scan the image, and use a private registry or mirror.
- Sign images, and verify the signatures when they are deployed.
- Keep few direct dependencies.
- Run as non-root, on a minimal image.
- Generate an SBOM, so you can quickly find affected services when a vulnerability is announced.

### [deep] Design the delivery pipeline and runtime for a Node.js payments API in a bank. {#design-q}

**Pull request.** Install with a frozen lockfile. Lint, type check, and run unit and integration tests with Testcontainers. Add an audit and static analysis.

**On merge.** Build one multi-stage image. Scan it, sign it, tag it with the git SHA, and push it to the internal registry. Record an SBOM.

**Test and staging.** Deploy by updating the image digest in a Git repository (GitOps). Run smoke and contract tests. Production needs a manual approval and a change record.

**Production rollout.** Start with a canary, with automatic rollback on error rate, p99 and event loop lag. Then a rolling update with `maxUnavailable: 0`.

**Runtime.** Pods run non-root, with a read-only filesystem, probes, a PodDisruptionBudget and an autoscaler. Secrets come from the secret manager by workload identity. Network policies limit traffic. JSON logs and traces go to the central platform.

**Migrations** run as a separate job, using expand and contract.

### [deep] A pod keeps restarting (`CrashLoopBackOff`) after a release. How do you investigate? {#crashloop-q}

Start with `kubectl describe pod`. Look at the events and the last state: the exit code and the reason, such as `OOMKilled`, `Error` or probe failures. Then read `kubectl logs --previous` for the crashed container.

Typical causes:

- configuration that is invalid or missing. Validation should fail with a clear message.
- a Secret or ConfigMap that does not exist;
- a liveness probe that is too strict, or checks a dependency;
- a startup slower than the probe allows. Add a startup probe.
- an unhandled exception at boot;
- memory above the limit, because the heap limit is too close to the container limit;
- a database migration that has not run.

If users are affected, roll back with `rollout undo` first. Then fix the cause.

### [coding] Write a production Dockerfile for a TypeScript Node.js service built with pnpm: multi-stage, cached dependencies, production dependencies only, non-root, and `node` as the process. {#coding-dockerfile}

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/main.js"]
```

Explain these points:

- The `deps` stage depends only on `package.json` and the lockfile. So its layer is reused until a dependency changes.
- The BuildKit cache mount keeps the pnpm store between builds.
- `--frozen-lockfile` fails if the lockfile is out of date.
- The build stage compiles, then prunes the dev dependencies.
- The runtime stage starts from a fresh slim image. It copies only `node_modules` and `dist`, with the right ownership.
- It runs as the `node` user, and sets `NODE_ENV=production`.
- It starts `node` directly, in exec form, so it receives SIGTERM.
- Add a `.dockerignore` for `node_modules`, `.git`, `.env*` and `dist`.
- I did not build this image in the session.

### [coding] Implement `loadConfig(env)` that validates `NODE_ENV`, `PORT`, `DATABASE_URL` and `SHUTDOWN_TIMEOUT_MS`, reports all problems together and returns a frozen object. {#coding-config}

```javascript
export function loadConfig(env = process.env) {
  const problems = [];

  const str = (name, { required = true, fallback } = {}) => {
    const v = env[name] ?? fallback;
    if ((v === undefined || v === '') && required) problems.push(`${name} is required`);
    return v;
  };
  const int = (name, fallback, { min = 1, max = 65535 } = {}) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) problems.push(`${name} must be an integer between ${min} and ${max}`);
    return n;
  };
  const oneOf = (name, allowed, fallback) => {
    const v = env[name] ?? fallback;
    if (!allowed.includes(v)) problems.push(`${name} must be one of ${allowed.join(', ')}`);
    return v;
  };

  const config = Object.freeze({
    nodeEnv: oneOf('NODE_ENV', ['development', 'test', 'production'], 'development'),
    port: int('PORT', 3000),
    databaseUrl: str('DATABASE_URL'),
    shutdownTimeoutMs: int('SHUTDOWN_TIMEOUT_MS', 25_000, { min: 1000, max: 120_000 }),
  });

  if (config.databaseUrl) {
    try { new URL(config.databaseUrl); } catch { problems.push('DATABASE_URL must be a valid URL'); }
  }
  if (problems.length) {
    const err = new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
    err.code = 'INVALID_CONFIG';
    throw err;
  }
  return config;
}

// main.js: fail fast, exit non-zero, never print secret values
let config;
try { config = loadConfig(); } catch (err) { console.error(err.message); process.exit(1); }
```

Explain these points:

- The helpers collect problems, instead of throwing on the first one. So an operator fixes everything in one go.
- Defaults are explicit, and numbers are checked as integers within a range.
- `Object.freeze` stops other code from changing the configuration later.
- The messages name the variable, but never print its value. So a secret cannot leak into the logs.
- A thrown error at startup makes the container exit non-zero. That stops a Kubernetes rollout, while the old pods keep serving.
- I tested the equivalent code with `node:test`: valid input, defaults, and `PORT=abc` with a missing `DATABASE_URL` and `NODE_ENV=prod`, all reported together.

### [coding] Implement graceful shutdown for an HTTP server: readiness fails first, in-flight requests finish, idle keep-alive sockets are closed, resources are released, with a safety timer. {#coding-shutdown}

```javascript
import http from 'node:http';

export function createServer({ pool, shutdownTimeoutMs = 25_000, log = console.log } = {}) {
  let ready = false;
  let shuttingDown = false;

  const server = http.createServer(async (req, res) => {
    if (req.url === '/health/live') return res.end('alive');
    if (req.url === '/health/ready') {
      res.statusCode = ready && !shuttingDown ? 200 : 503;       // fails as soon as shutdown starts
      return res.end(res.statusCode === 200 ? 'ready' : 'not ready');
    }
    /* application routes */
    res.end('ok');
  });
  server.keepAliveTimeout = 65_000;

  async function shutdown(signal) {
    if (shuttingDown) return;                                    // ignore a second signal
    shuttingDown = true;
    log(`${signal} received, draining`);

    const timer = setTimeout(() => { log('forced exit'); process.exit(1); }, shutdownTimeoutMs);
    timer.unref();

    await new Promise((resolve) => {
      server.close(resolve);                                     // stop accepting, wait for active requests
      const sweep = setInterval(() => server.closeIdleConnections(), 100);   // sockets that become idle are closed
      sweep.unref();
      server.once('close', () => clearInterval(sweep));
    });

    await pool?.end();                                           // then release resources
    clearTimeout(timer);
    log('shutdown complete');
  }

  return {
    server,
    shutdown,
    async start(port) {
      await pool?.connect?.();
      await new Promise((r) => server.listen(port, r));
      ready = true;                                              // ready only after the dependencies are up
      return server.address().port;
    },
  };
}

const app = createServer({ pool });
await app.start(3000);
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => app.shutdown(signal).then(() => process.exit(0), () => process.exit(1)));
}
```

Explain these points:

- The order matters. First set the flag, so readiness reports 503 and the load balancer stops routing.
- Then `server.close()`, so current requests finish and no new connection is accepted.
- Then close the pool, and exit 0.
- The regular `closeIdleConnections()` sweep is the key detail. A keep-alive socket that goes idle after its last response would otherwise keep `server.close()` waiting for up to `keepAliveTimeout`. In my first test, the drain took about 60 seconds.
- The timer is `unref`ed, so it never keeps the process alive. It forces a non-zero exit before the platform sends SIGKILL.
- My test started a slow request, called `shutdown('SIGTERM')` while it ran, and checked three things: the response completed, the pool was closed afterwards, and new connections were refused. It took about 0.4 s.
