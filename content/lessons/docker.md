---
title: Docker — images, containers, Dockerfiles, networking and Compose
nav: Docker
slug: docker
summary: What a container really is, image layers and caching, writing a good Dockerfile (multi-stage, non-root, exec form), volumes, networking, Docker Compose, running the JVM in a container and image security, with animations and interview questions.
tags: [Docker, Containers, DevOps]
order: 37
topic: Containers / Docker
updated: 2026-11-13
subnav: true
---

Every modern Java or Spring Boot service ships as a container image, so an interviewer will ask what an image is, how layers and caching work, how you would write a Dockerfile for a Spring Boot app, and what goes wrong with the JVM in a container. The next lesson, [Kubernetes](lesson:kubernetes), runs these images at scale; the services themselves come from [Spring Boot](lesson:spring-boot) and the [microservice patterns](lesson:microservice-patterns). Play the four scenes: image layers and cache, image versus container, networking and Compose, and multi-stage builds.

```demo
name: docker-walk
```

> **One sentence to remember:** *an image is an immutable, layered package of your app and its file system; a container is a running process started from an image with a thin writable layer, isolated by namespaces and limited by cgroups; build small, cache-friendly, non-root images and keep data in volumes.*

## What a container is {#container}

A container is **not a small virtual machine**. It is an ordinary Linux process (or group of processes) that the kernel isolates:

| Mechanism | What it does |
| --- | --- |
| **namespaces** | give the process its own view of process ids, network, mounts, hostname, users |
| **cgroups** | limit and account for CPU, memory and I/O |
| **union file system** (overlayfs) | stacks read-only image layers with a writable layer |

| | Virtual machine | Container |
| --- | --- | --- |
| Isolation | own kernel, hypervisor | shared host kernel, namespaces |
| Start time | seconds to minutes | milliseconds to seconds |
| Size | GBs | MBs |
| Overhead | high | low |
| Isolation strength | stronger | weaker (kernel is shared) |

## Images, layers and registries {#images}

An image is built from **layers**; each layer is a read-only diff. Layers are content-addressed (sha256), cached and shared between images. An image is referenced as `registry/repository:tag` (for example `eclipse-temurin:21-jre`) or, unambiguously, by **digest** (`@sha256:...`). Tags are mutable (`latest` can point to anything tomorrow); digests are not, so pin a digest for reproducible production builds.

## The Dockerfile {#dockerfile}

```dockerfile
# syntax=docker/dockerfile:1
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q dependency:go-offline          # cached unless pom.xml changes
COPY src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 app
WORKDIR /app
COPY --from=build /src/target/payments.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

| Instruction | Purpose | Notes |
| --- | --- | --- |
| `FROM` | base image (starts a stage) | pick small, maintained images (`-jre`, `-slim`, distroless) |
| `WORKDIR` | working directory | creates it if missing |
| `COPY` / `ADD` | copy files in | prefer `COPY`; `ADD` also fetches URLs and unpacks archives |
| `RUN` | execute during build, creates a layer | chain related commands, clean caches in the same `RUN` |
| `ENV` | environment variable, in image and at run time | not for secrets |
| `ARG` | build-time variable only | visible in image history, not for secrets |
| `EXPOSE` | documents the port | does **not** publish it |
| `USER` | user to run as | use a non-root user |
| `HEALTHCHECK` | command that reports health | Kubernetes uses its own probes |
| `ENTRYPOINT` / `CMD` | what runs at start | use the **exec form** (JSON array) |

**CMD versus ENTRYPOINT:** `ENTRYPOINT` is the fixed executable; `CMD` is its default arguments, overridden by arguments to `docker run`. For a service: `ENTRYPOINT ["java", "-jar", "app.jar"]`.

**Shell form versus exec form:** `CMD java -jar app.jar` runs through `/bin/sh -c`, so the shell is PID 1 and may not forward `SIGTERM` to the JVM; `CMD ["java", "-jar", "app.jar"]` makes the JVM PID 1 so it shuts down gracefully.

## Layer caching {#caching}

Docker reuses cached layers until the first instruction whose inputs changed, then rebuilds everything after it. Order instructions from **least to most frequently changing**: base image, system packages, dependency descriptors (`pom.xml`), dependency download, then your source. Add a `.dockerignore` (`target/`, `.git`, `.env`) so the build context is small and irrelevant changes do not bust the cache.

## Multi-stage builds {#multistage}

Use a first stage with the full JDK and Maven to build, and a second, small stage that copies only the artefact. The result is smaller, faster to pull, has fewer vulnerabilities and does not contain your source or build tools. Spring Boot alternatives: `./mvnw spring-boot:build-image` (Cloud Native Buildpacks, no Dockerfile), **layered jars** (`java -Djarmode=tools extract --layers`, dependencies in their own cached layer) and **Jib** (builds without a Docker daemon).

## Running containers {#running}

![Docker architecture: client, daemon, registry](images/docker-architecture.png "The client sends commands to the Docker daemon, which builds, runs and pulls images and containers, and talks to a registry. | Docker architecture by dc, CC BY-SA 4.0, via Wikimedia Commons | https://commons.wikimedia.org/wiki/File:Docker-architecture.png")

```bash
docker build -t payments:1.4 .
docker run -d --name payments -p 8080:8080 -e SPRING_PROFILES_ACTIVE=prod --memory 1g payments:1.4
docker logs -f payments
docker exec -it payments sh
docker stop payments        # SIGTERM, then SIGKILL after 10 s
docker rm payments
```

`docker stop` sends `SIGTERM` and then `SIGKILL` after a grace period; `docker kill` sends `SIGKILL` immediately. A container lives as long as its main process; if PID 1 exits, the container stops.

## Storage {#storage}

| Type | Where | Survives `docker rm`? | Use |
| --- | --- | --- | --- |
| writable layer | inside the container | no | scratch only |
| **volume** | managed by Docker | yes | databases, persistent data |
| **bind mount** | a host folder | yes (it is the host's) | local development (live source) |
| **tmpfs** | memory | no | temporary secrets, caches |

## Networking {#networking}

| Driver | Behaviour |
| --- | --- |
| `bridge` (default) | private network on the host; containers get internal IPs; publish ports with `-p host:container` |
| user-defined bridge / Compose network | adds automatic DNS: containers reach each other **by name** |
| `host` | shares the host network stack (no isolation, no port mapping) |
| `none` | no networking |

Inside a container `localhost` is the container itself, so an app talks to its database at `db:5432` (the service name), not `localhost:5432`. Only ports you publish with `-p` are reachable from outside the Docker host.

## Docker Compose {#compose}

Compose describes a multi-container application in `compose.yaml` and starts it with one command.

```yaml
services:
  app:
    build: .
    ports: ["8080:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/bank
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
volumes:
  pgdata:
```

`docker compose up -d`, `docker compose logs -f app`, `docker compose down` (add `-v` to delete volumes). `depends_on` alone only orders startup; use `condition: service_healthy` or make the app retry. Compose is for local development and tests; production uses an orchestrator ([Kubernetes](lesson:kubernetes)).

## The JVM in a container {#jvm}

- Modern JVMs (Java 10+, and 8u191+) are **container-aware**: they read the cgroup memory and CPU limits instead of the host's.
- Set heap by **percentage**: `-XX:MaxRAMPercentage=75`. A heap equal to the whole limit leaves no room for **non-heap memory** (metaspace, thread stacks, direct buffers, code cache), so the kernel kills the container: `OOMKilled`, exit code **137**.
- CPU limits decide how many processors the JVM sees (`availableProcessors`), which sizes GC and common thread pools; a limit under 1 CPU can make the JVM pick the serial collector.
- Startup is slow compared with native apps: consider class data sharing, layered jars, and [native images](lesson:spring-boot-3).
- Log to **stdout and stderr**, not files; the platform collects them.

## Image security {#security}

- Run as a **non-root** user; add `--read-only` and drop capabilities where possible.
- Use minimal, maintained base images (JRE-only, distroless) and **pin versions or digests**.
- **Never put secrets** in the image, `ENV`, `ARG` or layers (they stay in history); inject them at run time.
- Scan images for vulnerabilities in CI (Trivy, Grype) and rebuild regularly.
- Use multi-stage builds so compilers and source are not shipped.

## Cheat sheet {#cheatsheet}

| Task | Command |
| --- | --- |
| build | `docker build -t name:tag .` |
| run in background with a port | `docker run -d -p 8080:8080 name:tag` |
| list containers (including stopped) | `docker ps -a` |
| logs | `docker logs -f name` |
| shell inside | `docker exec -it name sh` |
| stop, remove | `docker stop name`, `docker rm name` |
| see image layers | `docker history name:tag` |
| clean unused data | `docker system prune` |
| compose up, down | `docker compose up -d`, `docker compose down` |

## Interview questions {#questions}

### [basic] What is Docker and what problem does it solve? {#what-is-docker}

A platform for packaging an application with its dependencies into an image that runs the same way on a laptop, in CI and in production. It removes "works on my machine" problems, makes deployments repeatable, and lets many isolated services share one host efficiently.

### [basic] What is the difference between an image and a container? {#image-vs-container}

An image is an immutable, layered template (the file system and metadata). A container is a running instance of an image: a process with a thin writable layer on top. You can start many containers from one image; deleting a container does not delete the image.

### [basic] What is the difference between a container and a virtual machine? {#container-vs-vm}

A VM virtualises hardware and runs its own full OS kernel on a hypervisor. A container shares the host kernel and is isolated with namespaces and cgroups, so it starts in seconds, uses less memory and is smaller, but is isolated less strongly than a VM.

### [basic] What are Docker layers and why do they matter? {#layers-q}

Each file-system-changing instruction creates a read-only layer identified by a hash. Layers are cached and shared between images, which makes builds and pulls fast and storage efficient. Instruction order therefore determines how much is rebuilt after a change.

### [basic] What is the difference between CMD and ENTRYPOINT? {#cmd-vs-entrypoint}

`ENTRYPOINT` defines the executable that always runs; `CMD` supplies default arguments (or a default command if there is no entrypoint) and is replaced by arguments given to `docker run`. Typical service: `ENTRYPOINT ["java", "-jar", "app.jar"]` and optionally `CMD` for default flags.

### [basic] What is the difference between COPY and ADD? {#copy-vs-add}

`COPY` copies local files into the image. `ADD` does the same and can also download a URL and auto-extract local tar archives, which makes it less predictable. Use `COPY` unless you need those extras.

### [basic] Does EXPOSE publish a port? {#expose}

No. `EXPOSE` only documents which port the container listens on. To make it reachable from the host you publish it with `-p 8080:8080` (or `-P`) at run time, or `ports:` in Compose.

### [basic] How do you persist data from a container? {#persist}

Use a **volume** (`-v pgdata:/var/lib/postgresql/data`) or a bind mount. The container's writable layer is deleted with the container, so data written there is lost.

### [basic] What is the difference between a volume and a bind mount? {#volume-vs-bind}

A volume is created and managed by Docker in its own storage area, independent of the host directory layout, and is the preferred way to persist data. A bind mount maps an existing host path into the container, convenient for development but tied to the host's structure and permissions.

### [basic] What is Docker Compose? {#what-is-compose}

A tool and YAML format for defining and running several containers (services, networks, volumes) together, for example an app, a database and a cache, with `docker compose up`. Good for local development and integration tests, not a production orchestrator.

### [intermediate] How does Docker's build cache work, and how do you write a cache-friendly Dockerfile? {#cache-friendly}

A layer is reused if the instruction and its inputs (including copied file contents) are unchanged and every layer before it was reused. Put rarely-changing steps first: base image, dependency descriptor, dependency download, then source copy and build. Use `.dockerignore`, chain `RUN` commands that belong together, and use BuildKit cache mounts for package caches.

### [intermediate] What is a multi-stage build and why use it? {#multistage-q}

A Dockerfile with several `FROM` stages: an early stage builds with heavy tools (JDK, Maven), and the final stage copies only the artefacts (`COPY --from=build ...`) onto a small runtime image. Benefits: smaller images, faster pulls, fewer vulnerabilities, no source or build secrets in the final image.

### [intermediate] Why use the exec form of CMD or ENTRYPOINT? {#exec-form}

In shell form (`CMD java -jar app.jar`) Docker starts `/bin/sh -c ...`, so the shell is PID 1 and may not pass `SIGTERM` to the JVM; the app is killed after the grace period without shutting down cleanly. In exec form (`["java", "-jar", "app.jar"]`) the JVM is PID 1 and receives signals, so Spring Boot's graceful shutdown works.

### [intermediate] How do containers on the same host talk to each other? {#container-networking}

On a user-defined bridge network (and in Compose) Docker provides DNS, so containers address each other by service or container name (`db:5432`). On the default bridge you would need IPs or legacy links. `localhost` inside a container refers to the container itself, so using it for another service is a common mistake.

### [intermediate] A container exits immediately after start. How do you debug it? {#debug-exit}

`docker ps -a` to see the exit code, `docker logs <name>` for output, `docker inspect` for configuration. Typical causes: the main process finished or crashed, a missing environment variable or config, a wrong `CMD`, the process running as a background daemon (a container lives only as long as PID 1), or a permission problem for the non-root user. Override the entrypoint (`--entrypoint sh`) to explore the image.

### [intermediate] Why does a Java app get OOMKilled although -Xmx is below the container limit? {#oomkilled}

The JVM uses more than heap: metaspace, thread stacks, direct and mapped buffers, code cache, GC structures and native libraries. If heap plus non-heap exceeds the cgroup memory limit, the kernel's OOM killer ends the process (exit code 137). Use `-XX:MaxRAMPercentage` (commonly 50 to 75), leave headroom, and monitor non-heap memory.

### [intermediate] How do you keep secrets out of a Docker image? {#secrets}

Never bake them into `ENV`, `ARG`, copied files or any layer, because layers keep history and can be pulled by anyone with image access. Provide them at run time: environment variables from the orchestrator's secret store, mounted secret files, or BuildKit secret mounts (`RUN --mount=type=secret`) for build-time needs. Add `.env` to `.dockerignore`.

### [intermediate] What is the difference between ARG and ENV? {#arg-vs-env}

`ARG` exists only during the build and is not available to the running container (but is visible in `docker history`). `ENV` is stored in the image and set in every container started from it. Neither is suitable for secrets.

### [intermediate] What does depends_on do in Compose, and what does it not do? {#depends-on}

It controls start order only. It does not wait for the dependency to be **ready**. Use a `healthcheck` with `depends_on: condition: service_healthy`, or make the application retry its connection on startup.

### [intermediate] What is the difference between docker stop and docker kill? {#stop-vs-kill}

`stop` sends `SIGTERM`, waits (10 s by default), then `SIGKILL`. `kill` sends `SIGKILL` immediately (or another signal with `-s`). Prefer `stop` so the application can finish in-flight work.

### [deep] How do namespaces and cgroups provide container isolation? {#namespaces-cgroups}

Namespaces give a process its own view of system resources (PID, network, mount, UTS, IPC, user). Cgroups limit and meter what it can consume (CPU, memory, I/O, pids). Together with a layered root file system they create the illusion of a separate machine while all containers share one kernel, which is also why a kernel vulnerability can affect all of them.

### [deep] How does the overlay file system implement layers and copy-on-write? {#overlayfs}

The read-only image layers are merged with a writable upper layer into one view. Reading a file finds it in the topmost layer containing it. Writing to a file from a lower layer first copies it up into the writable layer (copy-on-write), and deleting writes a "whiteout" marker. That is why large writes to the container layer are slow and why the layer vanishes with the container.

### [deep] What makes a container image reproducible, and what undermines it? {#reproducible}

Pinning base images by digest, locking dependency versions, deterministic build steps and no network fetches of floating versions. `latest` tags, `apt-get install` without versions, timestamps and unpinned plugins make two builds of the same Dockerfile differ.

### [deep] What risks come from running a container as root? {#root-risk}

If the app is compromised, the attacker has root inside the container and, with a kernel exploit, a misconfigured mount or extra capabilities (`--privileged`, the Docker socket), a path to the host. Run as a non-root user, set a read-only root file system, drop capabilities and never mount `/var/run/docker.sock` into an application container.

### [deep] What are the trade-offs of JVM images: JRE, distroless, jlink and native image? {#jvm-images}

A JRE image is the simple default. Distroless images have no shell or package manager, so a smaller attack surface but harder debugging. `jlink` builds a trimmed runtime with only the needed modules. A GraalVM native image starts in milliseconds with low memory but has longer builds, reflection limits and different peak performance ([Boot 3 and Spring 6](lesson:spring-boot-3)).

### [coding] Write a production Dockerfile for a Spring Boot service. {#coding-dockerfile}

```dockerfile
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 app
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

Points to mention: multi-stage, dependency layer cached, non-root user, exec-form entrypoint, memory set by percentage, config injected at run time.

### [coding] Write a Compose file for the app plus PostgreSQL with a healthcheck. {#coding-compose}

```yaml
services:
  app:
    build: .
    ports: ["8080:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/bank
      SPRING_DATASOURCE_USERNAME: bank
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: bank
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: bank
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bank"]
      interval: 5s
      retries: 10
volumes:
  pgdata:
```

The password comes from an environment variable or `.env` (kept out of Git), the app reaches the database as `db`, and data survives `docker compose down`.

### [coding] This Dockerfile rebuilds slowly and the image is huge. Fix it. {#coding-fix-dockerfile}

```dockerfile
FROM maven:3-eclipse-temurin-21
COPY . /app
WORKDIR /app
RUN mvn package
CMD java -jar target/app.jar
```

Fixes: add a `.dockerignore`; copy `pom.xml` and run `dependency:go-offline` **before** copying `src` so dependencies are cached; use a multi-stage build and ship only the JRE and the jar; run as a non-root user; replace the shell-form `CMD` with an exec-form `ENTRYPOINT`; pin the base image version.
