---
title: Deploying Node.js services — Docker images, configuration, Kubernetes, zero-downtime rollouts and operations
nav: Node.js deployment
slug: node-deployment
summary: Taking a Node.js service to production, build once and promote the same artifact, pnpm frozen lockfile installs, TypeScript builds and Node version pinning, multi-stage Dockerfiles with slim non-root images and node as PID 1, .dockerignore and layer caching and image scanning, twelve-factor configuration with validation at startup and secrets from a secret manager, signals and graceful shutdown and the keep-alive trap, liveness and readiness and startup probes, Kubernetes Deployment with rolling updates and resources and HPA and PodDisruptionBudget, reverse proxy and trust proxy and timeouts, CI/CD pipeline with GitHub Actions, canary and blue-green and expand-and-contract migrations, serverless and Lambda and ECS compared, logs and metrics and crash diagnostics, hardening, compared with Spring Boot jars and JVM containers, with banking examples and interview questions.
tags: [Node.js, Deployment, Docker, Kubernetes, CI/CD, Configuration, Graceful shutdown, DevOps, Backend, Full stack]
order: 75
topic: Full stack / Node.js
updated: 2026-11-18
subnav: true
---

Deployment questions in a Node.js interview check that you can take a service from a laptop to production without surprises. They ask *how you build the image and why multi-stage, why not run as root, why `node` and not `npm start` as the command, where configuration and secrets come from, what liveness and readiness mean, what happens when a pod is stopped, how you roll out without dropping requests, how a database migration fits a rolling update, how many CPUs and how much memory a pod gets, and how you find out that a release is bad.* This lesson covers those, and builds on [Docker](lesson:docker#multistage), [Kubernetes](lesson:kubernetes#probes), [deployment strategies](lesson:deployment-strategies#rolling), [CI/CD](lesson:cicd-fundamentals#stages) and the [Node.js runtime](lesson:node-runtime#shutdown). Examples use a banking transfer service. Play the four scenes: build the image, config and secrets, zero-downtime rollout, and right-size and watch.

```demo
name: node-deploy-walk
```

> **One sentence to remember:** *Build one small, non-root image from a frozen lockfile, configure it only through validated environment variables and injected secrets, let `node` receive SIGTERM and drain gracefully behind readiness probes, roll out gradually with metrics watching, and size pods for a single-threaded process.*

## What deployment means for a Node service {#overview}

The principles are the **twelve-factor app** rules, and they matter more than the tool:

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

A bank usually runs containers on Kubernetes or ECS. The rest of this lesson assumes that, and notes where serverless differs ([serverless section](#serverless)).

## Building the artifact {#build}

A repeatable build starts with **dependencies you can reproduce**:

- Commit the lockfile (`pnpm-lock.yaml`) and install with **`pnpm install --frozen-lockfile`** in CI and in the Dockerfile. It fails if `package.json` and the lockfile disagree, instead of silently choosing new versions.
- **Pin the Node version**: `.nvmrc` or `engines` in `package.json` for developers, and the same major version in the Dockerfile base image. Use an even-numbered LTS release in production.
- **TypeScript**: compile in the build stage (`tsc`, or `esbuild` and `tsup` for speed) and **run the compiled JavaScript**. Running `ts-node` or `tsx` in production adds startup time and memory. Emit source maps and run with `node --enable-source-maps` so stack traces point at the TypeScript.
- **`NODE_ENV=production`** at runtime: Express and many libraries switch off verbose errors and enable caching.
- **Production dependencies only** in the final image (`pnpm install --prod` or `pnpm prune --prod`). Dev dependencies (compilers, test tools, linters) make the image bigger and widen the attack surface.
- **Supply chain**: review new dependencies, run `pnpm audit` in CI, consider `ignore-scripts` for installs and an internal registry mirror, and generate an **SBOM** (software bill of materials) for the image.
- **Bundling** (esbuild into one file) shortens startup and shrinks the image, and is common for serverless. For a long-running service, copying `node_modules` is usually fine.

## The Dockerfile {#docker}

A multi-stage Dockerfile for a TypeScript service with pnpm (see [multi-stage builds](lesson:docker#multistage)):

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

(I did not build this image in the session, so treat the details as a template and build it once to confirm the paths.)

Why each choice:

- **Multi-stage**: the compiler, dev dependencies and caches stay in the build stages. The final image has only the runtime, `node_modules` and `dist`.
- **Order for caching**: copy `package.json` and the lockfile first and install, then copy the source. Changing a source file does not reinstall dependencies. A **BuildKit cache mount** keeps the pnpm store between builds.
- **Base image**: `node:22-slim` (Debian) is a good default. **Alpine** is smaller but uses musl instead of glibc, which breaks some native modules and can behave differently, so test it. **Distroless** (`gcr.io/distroless/nodejs22`) has no shell or package manager, which is the smallest attack surface but harder to debug. Pin by **digest** for reproducibility, and rebuild regularly for security patches.
- **`USER node`**: never run as root. A compromised process then cannot modify the image or reach the host as easily. Combine with a **read-only root filesystem** and no extra Linux capabilities in the orchestrator.
- **`CMD ["node", "dist/main.js"]`** in **exec form** (a JSON array), not `CMD npm start` or the shell form. With npm or a shell as PID 1, **SIGTERM is not forwarded** to your app, so it never shuts down gracefully and is killed after the grace period (30 s on Kubernetes). With `node` as PID 1 you must handle signals yourself ([graceful shutdown](#process)). Alternatively run an init process (`docker run --init`, `tini`) as PID 1, which also reaps zombie processes.
- **`HEALTHCHECK`** is used by Docker and Compose. Kubernetes ignores it and uses its own probes. A tiny `node -e` check avoids needing `curl` in the image.
- **No secrets in the image**: not as `ENV`, not in `COPY .env`, not in build arguments (they stay in the image history). For build-time secrets use `RUN --mount=type=secret`.

`.dockerignore` keeps the context small and keeps secrets out:

```
node_modules
dist
.git
.env*
coverage
*.md
Dockerfile
```

In the pipeline, **scan the image** (Trivy, Grype, or the registry's scanner) and fail the build on critical vulnerabilities, **sign** it (Cosign), and tag it with the **git SHA** and push the digest forward, never `latest`.

## Configuration and secrets {#config}

Build the image once and run the **same image** in every environment. Only the configuration changes, and it arrives from outside (see [process, configuration and exit codes](lesson:node-runtime#process)):

- **Environment variables** for plain settings: `PORT`, `DATABASE_URL`, feature flags, timeouts. On Kubernetes they come from a **ConfigMap**.
- **Secrets** (passwords, signing keys, API keys): from a **secret manager** (AWS Secrets Manager, HashiCorp Vault) or a Kubernetes **Secret**, injected as environment variables or mounted files when the container starts. Access by identity (IAM role for the pod), not by a shared password. Rotate without rebuilding. Never log them, and never commit `.env` files.
- A Kubernetes Secret is only base64, not encrypted. Enable **encryption at rest** and restrict access with RBAC, or use the External Secrets Operator or a CSI driver that reads from the secret manager.
- **`node --env-file=.env`** (Node 20.6+) is for local development, not production.

### Validate at startup, fail fast

The process should check its configuration before it listens, report **all** problems at once, and exit non-zero. On Kubernetes a pod that crashes at startup stops the **rollout**, and the old version keeps serving. A service that starts and then fails on the first request is much worse.

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

I ran this with `node:test`: valid values give a frozen config, and a missing `DATABASE_URL`, `PORT=abc` and `NODE_ENV=prod` are all reported in one error. Print the problems but **never the values** of secrets.

## Process lifecycle and graceful shutdown {#process}

A container is a process, and the orchestrator controls its life with signals. To stop a pod, Kubernetes removes it from the Service endpoints, sends **SIGTERM**, waits `terminationGracePeriodSeconds` (default 30 s), then sends **SIGKILL**, which cannot be handled. A service that ignores SIGTERM drops its in-flight requests and any half-done work.

The graceful sequence, which you can see in the third scene:

1. **Fail readiness** immediately, so the load balancer stops sending new requests.
2. **Stop accepting connections** (`server.close()`), and let in-flight requests finish.
3. **Close idle keep-alive connections**, otherwise `server.close()` waits for them (see below).
4. **Release resources**: database pool, queue consumers and producers, Redis. Flush logs.
5. **Exit with code 0**, with a **timer** as a safety net that exits non-zero shortly before the grace period ends.

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

**The keep-alive trap**: `server.close()` stops accepting new connections but waits until every connection ends, and a keep-alive connection that is idle after its last response stays open for `keepAliveTimeout`. In my first test of this code, calling `closeIdleConnections()` once at the start left the drain waiting about **60 seconds** for a socket that went idle later. The fix is to sweep periodically (as above) or to answer with `Connection: close` during shutdown. A test that starts a slow request, calls `shutdown`, and checks that the request completes, the pool is closed afterwards and new connections are refused, now finishes in about 0.4 s.

More lifecycle points:

- **Exit codes**: `0` for a clean stop, non-zero for a failure, so the orchestrator and CI can tell. Do not call `process.exit` in the middle of the work, set `process.exitCode` or finish the shutdown first.
- **Crashes**: handle `uncaughtException` and `unhandledRejection` by **logging and exiting**, and let the orchestrator restart the pod. Continuing in an unknown state is more dangerous than restarting. Fix the cause ([error handling](lesson:node-runtime#errors)).
- **Restarts**: on Kubernetes the kubelet restarts failed containers with backoff (`CrashLoopBackOff` if they keep failing). On a VM use **systemd** or **PM2** (`pm2-runtime` in a container is rarely needed, because the orchestrator already restarts and scales).
- **Several cores**: run more pods rather than `cluster` inside a container, unless you must use a bigger VM ([using more than one core](lesson:node-runtime#scaling)). `os.availableParallelism()` reports the CPUs a process may use.

## Health checks {#health}

Three questions, three endpoints (see [probes](lesson:kubernetes#probes)):

| Endpoint | Question | Checks | On failure |
| --- | --- | --- | --- |
| `/health/live` | is the process stuck? | the event loop answers, nothing else | the container is **restarted** |
| `/health/ready` | can it take traffic now? | started, dependencies reachable, not shutting down | the pod is **removed from the Service**, not restarted |
| startup probe | has it finished starting? | the same as ready, with a long timeout | slow starters get time before the liveness probe applies |

Rules: **keep liveness free of external dependencies**. If the database is down and liveness checks it, every pod restarts and the outage grows. Put dependency checks in **readiness** (and keep them cheap and time-limited, for example a pooled `SELECT 1` with a 1 s timeout, cached for a few seconds). Readiness must report **not ready as soon as shutdown begins**. Do not put heavy work or authentication on these endpoints, and keep them off the public ingress.

## Kubernetes deployment {#kubernetes}

A Deployment for the transfer service (see [Kubernetes](lesson:kubernetes#yaml) for the objects):

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

(I did not apply this YAML in a cluster in the session. It is a template, so check the field names against your Kubernetes version.)

What to note:

- **Rolling update** with `maxUnavailable: 0` and `maxSurge: 1`: capacity never drops. New pods join only after readiness passes, old pods are stopped with the graceful sequence above. `kubectl rollout status` waits for it and `kubectl rollout undo` goes back ([rollouts](lesson:kubernetes#rollouts)).
- **`preStop` sleep**: after the pod is marked terminating, endpoint removal takes a moment to reach the proxies and load balancers, so requests can still arrive for a few seconds. Sleeping 5 s before SIGTERM covers that gap. The `terminationGracePeriodSeconds` must be longer than the `preStop` sleep plus your shutdown timeout.
- **Resources and Node**: JavaScript runs on one thread, so a pod rarely uses more than about **one CPU**. Request 500 m to 1 CPU and **scale out** with replicas. A **CPU limit** can throttle the process in bursts and raise latency, so many teams set a CPU request and no CPU limit. A **memory limit** is essential, and set the V8 heap (`--max-old-space-size`) to about **70 to 75%** of it, because Buffers and native memory live outside the heap ([memory](lesson:node-performance#memory)). If the heap limit equals the container limit, the pod is `OOMKilled`.
- **Autoscaling**: CPU is a fair default. For I/O-heavy Node services, **event loop utilisation or request concurrency** (through custom metrics and KEDA) often react sooner. Keep at least two or three pods across zones and set a maximum.
- **PodDisruptionBudget**: node drains and cluster upgrades never remove more than the budget allows at once.
- **Topology spread** or anti-affinity spreads replicas across nodes and zones.
- **Config**: ConfigMap and Secret as above. A change to them does not restart pods by itself, so roll the Deployment (a hash annotation, or Helm and Kustomize do it).

## Reverse proxy, ingress and timeouts {#proxy}

In production, clients do not talk to Node directly. They reach a load balancer or an **ingress** (nginx, an ALB, an API gateway) that terminates TLS, routes and limits requests. Consequences for the Node code:

- **`app.set('trust proxy', 1)`** (Express) so `req.ip`, `req.protocol` and `req.secure` come from `X-Forwarded-For` and `X-Forwarded-Proto`. Without it, rate limiting sees the proxy's address and `Secure` cookies are not set. Trust only the **known number of hops**, because a client can forge those headers.
- **Timeouts must nest**: the load balancer's idle timeout (60 s on an ALB) is shorter than Node's `server.keepAliveTimeout` (set it to 65 s), which is shorter than `server.headersTimeout`. If Node closes a connection the load balancer still thinks is open, the symptom is occasional **502 errors** on the first request after an idle period.
- **Do at the proxy what it does better**: TLS, HTTP/2, compression, static files and a CDN, rate limiting and request size limits, WAF rules. Node still sets its own body limits and timeouts as defence in depth ([Express middleware](lesson:node-express-middleware#common)).
- **Health checks** of the load balancer should call the readiness endpoint, and the response must stay cheap.

## CI/CD pipeline {#cicd}

A typical pipeline (stages from [CI/CD fundamentals](lesson:cicd-fundamentals#stages)): **install, lint and type check, test, build, scan, package the image, push, deploy to an environment, verify, promote.** A GitHub Actions workflow for the first part:

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

- **Build once, promote the digest**: the image tested in staging is the one that goes to production, so there is no "works on staging" surprise. Deploy by updating the image digest in a Git repository (**GitOps** with Argo CD or Flux) or by a pipeline job with approval for production.
- **Cache** the pnpm store and Docker layers to keep the pipeline fast ([GitLab CI](lesson:gitlab-ci#artifacts) shows the same ideas).
- **Gates**: tests, type check, audit, image scan, and for production a manual approval and a change record, which banks usually require ([quality gates](lesson:cicd-fundamentals#gates)).
- **Smoke tests** after each deployment (a login and a read-only call), and **verification by metrics** before widening a rollout.
- **Rollback** is deploying the previous digest. Keep it fast and rehearsed ([rollback](lesson:cicd-fundamentals#rollback)).

### Rollout strategies and database changes

During a **rolling update** both versions run at the same time and use one database, so every change must be **backward compatible** for one release. **Canary** (a small share of traffic, watched by metrics, automatic rollback) and **blue-green** (two environments, switch at once) reduce risk further ([canary](lesson:deployment-strategies#canary)). Feature flags separate deploy from release.

For schema changes use **expand and contract** (see [database changes during a release](lesson:deployment-strategies#database)):

1. **Expand**: add the new column or table, nullable or with a default. Old code ignores it.
2. **Deploy** code that writes to both (or reads from the new one with a fallback) and backfill the data.
3. **Contract** in a later release, once no old version runs: remove the old column.

Run migrations as a **separate step** before the rollout (a Kubernetes Job, or a pipeline step with a migration tool such as `node-pg-migrate`, Prisma Migrate or Flyway), not inside every pod at startup, where several pods race and a slow migration fails the readiness probe. A migration that locks a big table (`ALTER TABLE ... ADD COLUMN ... DEFAULT` on older PostgreSQL versions, an index created without `CONCURRENTLY`) can take the service down, so check the lock behaviour.

## Serverless and other targets {#serverless}

| Target | Node specifics |
| --- | --- |
| **AWS Lambda** ([Lambda](lesson:aws-compute#lambda)) | a handler function, not a server. **Cold starts** grow with bundle size, so bundle with esbuild and import only what you need. Create clients (database pool, AWS SDK) **outside the handler** so warm invocations reuse them. Many concurrent functions open many database connections, so use **RDS Proxy** or a data API. No background work after the response. Time limit of 15 minutes. |
| **ECS Fargate** ([ECS](lesson:aws-compute#ecs)) | the same container as above, health checks on the target group, rolling or blue-green through CodeDeploy, task roles for secrets |
| **Cloud Run, App Runner** | a container with a port, scale to zero, request-based pricing, same signals and probes |
| **VM with PM2 or systemd** | install Node with a version manager, run the process under systemd with `Restart=on-failure`, a reverse proxy in front, rolling restarts one VM at a time |
| **Front end (React)** | a static build uploaded to S3 and served by CloudFront with a long cache for hashed assets and no cache for `index.html`. Not a Node deployment at all ([integration](lesson:fullstack-integration#deploy)) |

## Logs, metrics and diagnostics in production {#observe}

- **Logs**: JSON lines to **stdout** (pino), one event per line with a request id, level and timestamp. No log files in the container. Never log secrets, tokens or full card numbers. The platform (Fluent Bit, CloudWatch, Loki) ships them.
- **Metrics and traces**: `prom-client` or OpenTelemetry exports request rate, errors, duration (p50, p95, p99), event loop lag and utilisation, heap used, pool in use. Alert on **symptoms** (error rate, p99) and use the others to explain them ([performance](lesson:node-performance#production)).
- **Source maps**: `--enable-source-maps` gives readable stack traces from compiled TypeScript.
- **Crash diagnostics**: `--report-on-fatalerror` and `--report-on-signal` write a **diagnostic report** (JSON with stacks, heap and handles), `--heapsnapshot-near-heap-limit` writes a heap snapshot just before an out-of-memory crash, and `kubectl debug` attaches an ephemeral container to a running pod. `kubectl logs --previous` shows why the last container died.
- **Release markers** on dashboards (the version label on each metric) show whether a new release caused a change.

Useful commands when a rollout goes wrong:

```bash
kubectl rollout status deployment/transfer-service
kubectl rollout undo deployment/transfer-service
kubectl describe pod <pod>                  # events: probe failures, OOMKilled, image pull errors
kubectl logs <pod> --previous               # logs of the crashed container
kubectl top pod                             # CPU and memory in use
```

## Production hardening {#security}

- **Image**: slim or distroless, non-root, read-only root filesystem, no capabilities, scanned and signed, rebuilt often for patches ([image security](lesson:docker#security)).
- **Process**: `NODE_ENV=production`, `helmet` for security headers, body size limits, timeouts, rate limiting, input validation ([Node security basics](lesson:node-runtime#security)). Newer Node versions also have an experimental **permission model** (`--permission`) that restricts file system and child process access.
- **Dependencies**: lockfile, `pnpm audit`, Dependabot or Renovate, few direct dependencies, and no install scripts from unknown packages.
- **Network**: Kubernetes **NetworkPolicies** so the pod talks only to what it needs, TLS to the database, and egress restricted where possible.
- **Secrets**: from the secret manager by workload identity, rotated, never in logs or error messages.
- **Auditability**: the image digest, commit SHA and approval are recorded for every production change, which regulators of a bank ask for.

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

The artifact (the container image) is built a single time in CI, identified by a digest or git SHA, and the same artifact is promoted through test, staging and production. Only configuration differs, supplied through environment variables and secrets. It matters because what you tested is exactly what runs in production. A different build per environment can contain different dependencies or code, and removes the value of your tests.

### [basic] Why use a multi-stage Dockerfile for a Node.js service? {#multistage-q}

The build stage needs compilers, dev dependencies and caches to produce `dist`, but none of that is needed at runtime. A second stage copies only the compiled output and production dependencies into a slim base image. The result is smaller, faster to pull and has a smaller attack surface. Ordering the copy of the package files and lockfile before the source also keeps the dependency layer cached.

### [basic] Why should a container not run as root, and how do you avoid it? {#root-q}

If an attacker gets code execution, root inside the container makes it easier to modify the image's files, abuse mounted volumes and attempt a container escape. Use a non-root user (`USER node`), copy files with the right ownership, make the root filesystem read-only with a writable `/tmp` if needed, drop all Linux capabilities and disallow privilege escalation, and require `runAsNonRoot` in the Kubernetes security context.

### [basic] Why is `CMD ["node", "dist/main.js"]` better than `CMD npm start`? {#cmd-q}

Signals. With `npm start` (or a shell form), npm or the shell is PID 1 and does not forward SIGTERM to the Node process, so the app cannot shut down gracefully and is killed with SIGKILL after the grace period, dropping in-flight requests and slowing every deployment by the full grace period. The exec form makes `node` PID 1, which receives the signal and must handle it. An init process such as tini also works and reaps zombies.

### [basic] What is the difference between liveness and readiness probes? {#probes-q}

Liveness asks whether the process is stuck and should be restarted, so it should check only the process (the event loop answers). Readiness asks whether the pod can handle traffic now, so it includes dependencies, start-up completion and the shutdown state, and a failure removes the pod from the Service without restarting it. If liveness checked the database, a database outage would restart every pod and make things worse.

### [intermediate] How do you manage configuration and secrets for a Node.js service across environments? {#config-q}

Configuration comes from environment variables (from a ConfigMap on Kubernetes) following twelve-factor, validated against a schema when the process starts, with all problems reported and a non-zero exit. Secrets come from a secret manager or a Kubernetes Secret with encryption at rest, injected as env vars or files, with access granted to the workload's identity. They are rotated without rebuilding, never baked into the image, build args or the repository, and never logged. The image is the same everywhere.

### [intermediate] Walk through what happens when a pod is terminated and how a Node.js service should respond. {#shutdown-q}

Kubernetes marks the pod terminating and removes it from endpoints, runs the `preStop` hook, sends SIGTERM, and sends SIGKILL after `terminationGracePeriodSeconds`. The service should fail readiness at once, stop accepting connections with `server.close()`, let in-flight requests finish, close idle keep-alive sockets (a one-time call is not enough, because sockets become idle later), close the database pool and other resources, and exit 0, with a safety timer that exits non-zero before the grace period ends. A short `preStop` sleep covers the delay before the proxies learn the pod is leaving.

### [intermediate] How do you deploy without downtime? {#zero-downtime-q}

Run at least two or three replicas and use a rolling update with `maxUnavailable: 0` and `maxSurge: 1`, so a new pod starts and passes readiness before an old pod is stopped. Make shutdown graceful, add a PodDisruptionBudget, and keep database changes backward compatible, because old and new versions run together. Watch error rate, p99 and event loop lag during the rollout, use a canary for risky changes, and keep `rollout undo` or the previous digest ready.

### [intermediate] How do you run database migrations safely with a rolling deployment? {#migration-q}

Use expand and contract. First add the new structure in a backward compatible way (new nullable column or table), then deploy code that works with both, backfill the data, and only in a later release, when no old version runs, remove the old structure. Run migrations as a separate job or pipeline step before the rollout instead of inside each pod at startup, where pods race and slow migrations break readiness. Check lock behaviour (index creation with `CONCURRENTLY`, no long table rewrites).

### [intermediate] How do you set CPU, memory and the heap size for a Node.js pod? {#resources-q}

Node runs JavaScript on one thread, so a pod usually needs about one CPU. Request 500 m to 1 CPU and scale out with replicas. Set a memory limit and a V8 heap limit (`--max-old-space-size`) at roughly 70 to 75% of it, because Buffers and native memory are outside the heap, otherwise the pod is OOMKilled before Node reports a heap error. Many teams omit the CPU limit to avoid throttling. Autoscale on CPU or, better for I/O-heavy services, event loop utilisation or request concurrency, with a minimum of two or three pods.

### [intermediate] A user sometimes gets a 502 on the first request after a quiet period. What is the likely cause? {#502-q}

A keep-alive timeout mismatch. The load balancer keeps an idle connection open for 60 seconds, while Node's default `keepAliveTimeout` is 5 seconds, so Node closes the connection first and the load balancer then sends a request on a connection that is already closed. Set `server.keepAliveTimeout` above the load balancer's idle timeout (for example 65 s) and `headersTimeout` above that.

### [intermediate] What do you need to configure in Express when it runs behind a reverse proxy? {#proxy-q}

Set `app.set('trust proxy', n)` with the exact number of trusted hops, so `req.ip`, `req.protocol` and `req.secure` use `X-Forwarded-*` headers, which matters for rate limiting, secure cookies and redirects. Do not trust the headers from arbitrary clients. Also align keep-alive timeouts, let the proxy handle TLS, compression and static files, expose a cheap readiness endpoint for the load balancer, and still keep body size limits and timeouts in the app.

### [intermediate] How would you reduce supply chain risk in a Node.js deployment? {#supply-q}

Commit the lockfile and install with `--frozen-lockfile`, pin versions, and review new dependencies and their install scripts. Run `pnpm audit` and automated updates (Renovate or Dependabot) in CI, scan the image, use a private registry or mirror, sign images and verify signatures at admission, keep few direct dependencies, run as non-root with a minimal image, and generate an SBOM so you can quickly find affected services when a vulnerability is announced.

### [deep] Design the delivery pipeline and runtime for a Node.js payments API in a bank. {#design-q}

Pull request: install with a frozen lockfile, lint, type check, unit and integration tests (Testcontainers), audit and static analysis. On merge: build one multi-stage image, scan, sign, tag with the git SHA, push to the internal registry, and record an SBOM. Deploy to test and staging by updating the image digest in a Git repository (GitOps), with smoke and contract tests, and a manual approval and change record for production. Production: a canary with automatic rollback on error rate, p99 and event loop lag, then a rolling update with `maxUnavailable: 0`. Pods run non-root with a read-only filesystem, probes, a PodDisruptionBudget, an autoscaler, secrets from the secret manager by workload identity, network policies and JSON logs and traces to the central platform. Migrations run as a separate job with expand and contract.

### [deep] A pod keeps restarting (`CrashLoopBackOff`) after a release. How do you investigate? {#crashloop-q}

Look at `kubectl describe pod` for events and the last state: the exit code and reason (`OOMKilled`, `Error`, probe failures), and `kubectl logs --previous` for the crashed container. Typical causes: invalid or missing configuration (validation should fail with a clear message), a secret or ConfigMap that does not exist, a liveness probe that is too strict or checks a dependency, a startup that takes longer than the probe allows (add a startup probe), an unhandled exception at boot, memory above the limit (heap limit too close to the container limit), or a database migration that has not run. Roll back with `rollout undo` first if users are affected, then fix the cause.

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

The `deps` stage depends only on `package.json` and the lockfile, so its layer is reused until a dependency changes, and the BuildKit cache mount keeps the pnpm store between builds. `--frozen-lockfile` fails if the lockfile is out of date. The build stage compiles and then prunes dev dependencies. The runtime stage starts from a fresh slim image and copies only `node_modules` and `dist` with the right ownership, runs as the `node` user, sets `NODE_ENV=production`, and starts `node` directly in exec form so that it receives SIGTERM. Add a `.dockerignore` for `node_modules`, `.git`, `.env*` and `dist`. I did not build this image in the session.

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

The helpers collect problems instead of throwing on the first one, so an operator fixes everything in one go. Defaults are explicit, numbers are checked as integers within a range, and `Object.freeze` stops code from changing the configuration later. The messages name the variable but never print its value, so a secret cannot leak into the logs. A thrown error at startup makes the container exit non-zero, which stops a Kubernetes rollout while the old pods keep serving. I tested the equivalent code with `node:test`: valid input, defaults, and `PORT=abc` with a missing `DATABASE_URL` and `NODE_ENV=prod` reported together.

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

The order matters: set the flag first so readiness reports 503 and the load balancer stops routing, then `server.close()` so current requests finish and no new connection is accepted, then close the pool, then exit 0. The periodic `closeIdleConnections()` is the important detail: a keep-alive socket that goes idle after its last response would otherwise keep `server.close()` waiting for up to `keepAliveTimeout` (in my first test the drain took about 60 seconds). The timer is `unref`ed so it never keeps the process alive, and it forces a non-zero exit before the platform sends SIGKILL. My test started a slow request, called `shutdown('SIGTERM')` while it ran, and checked that the response completed, the pool was closed afterwards and new connections were refused, in about 0.4 s.
