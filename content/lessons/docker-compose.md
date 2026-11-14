---
title: Docker Compose — run a multi-container application with one file
nav: Docker Compose
slug: docker-compose
summary: How Docker Compose defines and runs a multi-container application: services, networks, volumes, healthchecks and depends_on, environment and secrets, profiles and override files, watch mode, Spring Boot integration and Testcontainers, and when to move to Kubernetes, with YAML examples and interview questions.
tags: [Docker, Compose, Containers, Local development, Spring Boot, Testcontainers]
order: 30
topic: Containers / Docker
updated: 2026-11-14
subnav: true
---

Real applications are never one container: a Spring Boot service needs a database, a cache, perhaps Kafka. Starting each with a long `docker run` command and wiring the networks by hand does not scale. **Docker Compose** lets you describe the whole set in one `compose.yaml` and start it with `docker compose up`. Interviews ask *how do services find each other, what does `depends_on` really guarantee, how do you keep data between restarts, how do you handle secrets and per-environment settings, and when is Compose not enough?* This lesson builds on [Docker](lesson:docker) and leads towards [Kubernetes](lesson:kubernetes). Play the two scenes: what `up` creates, and the development workflow.

```demo
name: compose-walk
```

> **One sentence to remember:** *Compose turns a YAML file into a private network, named volumes and a set of containers that find each other by service name; it is excellent for local development, tests and small single-host setups, and it is not an orchestrator for production clusters.*

## The Compose file {#file}

```yaml
# compose.yaml  (the old top-level "version:" key is obsolete and can be omitted)
name: bank

services:
  app:
    build: .                                  # build the image from the Dockerfile in this directory
    ports:
      - "8080:8080"                           # host:container, the only way in from outside
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/bank
      SPRING_DATASOURCE_USERNAME: bank
      SPRING_DATA_REDIS_HOST: redis
    env_file: [.env]                          # extra variables, not committed
    depends_on:
      db:
        condition: service_healthy            # wait for the healthcheck, not just for the start
      redis:
        condition: service_started
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: bank
      POSTGRES_USER: bank
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_password]
    volumes:
      - pgdata:/var/lib/postgresql/data       # named volume: data survives container removal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bank -d bank"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7
    command: ["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]

volumes:
  pgdata:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

Key top-level sections: **`services`** (the containers), **`volumes`** (named storage), **`networks`** (custom networks; a default one is created), **`secrets`** and **`configs`** (files mounted into containers). The command is **`docker compose`** (Compose V2, a plugin of the Docker CLI); the old standalone `docker-compose` (V1) is no longer maintained.

## What `docker compose up` does {#up}

1. Reads `compose.yaml` (and `compose.override.yaml` if present) and the `.env` file, substituting `${VARIABLES}`.
2. Creates a **project** (named by `name:` or the directory), a **default network** `bank_default` and the named **volumes**.
3. Builds images that have a `build:` section and pulls the others.
4. Creates and starts containers in **dependency order**, and attaches logs (or returns with `-d`).

Every service is reachable from the others by its **service name** through Docker's embedded DNS: the app connects to `db:5432`. Inside a container `localhost` means that container itself. Only ports under `ports:` are published to your machine; `expose:` merely documents a port for other containers.

```bash
docker compose up -d --build        # create and start in the background, rebuilding changed images
docker compose ps                   # status and health
docker compose logs -f app          # follow one service
docker compose exec db psql -U bank # run a command in a running container
docker compose run --rm app ./gradlew test   # one-off container from a service definition
docker compose config               # print the merged, resolved file (great for debugging)
docker compose down                 # stop and remove containers and the network
docker compose down -v              # ...and also the named volumes (deletes data)
```

## Startup order and healthchecks {#healthchecks}

`depends_on` controls **start order**, but by default it only waits until the dependency container has **started**, not until the service inside is ready. A database container starts in a second but needs several more to accept connections, so the app can fail on its first connection.

| Condition | Waits until |
| --- | --- |
| `service_started` (default) | the container is running |
| `service_healthy` | the dependency's `healthcheck` reports healthy |
| `service_completed_successfully` | the dependency exited with code 0 (for example a migration job) |

Define a `healthcheck` on every service that others wait for, and make the application itself resilient: retry database connections and use a migration tool such as Flyway so start order is not the only safeguard. Spring Boot's own retries and connection pool validation handle short gaps.

## Networking, volumes and data {#storage}

- **Networks**: the default network is enough for one application. Define extra networks to separate concerns (a `frontend` and a `backend` network, with the database only on the backend one).
- **Named volumes** (`pgdata:/var/lib/postgresql/data`) are managed by Docker and survive `docker compose down` (but not `down -v`). Use them for databases.
- **Bind mounts** (`./config:/app/config:ro`) map a host folder into the container: good for source code and configuration in development, but permissions and performance differ by platform.
- **tmpfs** mounts keep data in memory only.
- Database state in a container is for development. Production databases belong on managed services or properly operated storage.

## Configuration, environment and secrets {#config}

- `environment:` sets variables inline; `env_file:` loads them from a file. Compose also reads a **`.env`** file next to `compose.yaml` to substitute `${VAR}` inside the YAML itself (for example `image: bank/app:${TAG:-dev}`).
- **Do not commit secrets.** Keep `.env` in `.gitignore`, and for passwords prefer **secrets** (mounted as files at `/run/secrets/<name>`), which many images read through `*_FILE` variables.
- Anything in `environment:` is visible with `docker inspect` and in process listings of the host, which is acceptable for development passwords but not for production credentials.

## Profiles, override files and reuse {#profiles}

| Feature | Use |
| --- | --- |
| **`compose.override.yaml`** | merged automatically over `compose.yaml`: local ports, bind mounts, debug flags |
| **`-f a.yaml -f b.yaml`** | explicit layers, for example `compose.yaml` plus `compose.prod.yaml` |
| **`profiles: [debug]`** | optional services (pgAdmin, Kafka UI) that start only with `--profile debug` |
| **`extends`** | reuse one service definition inside another |
| **`include`** | pull another Compose file (a shared platform stack) into this one |
| **YAML anchors and `x-` fields** | share repeated blocks inside one file |

```yaml
# compose.override.yaml (automatic in development)
services:
  app:
    ports: ["5005:5005"]                      # remote debugger
    environment:
      JAVA_TOOL_OPTIONS: -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005
    develop:
      watch:
        - action: rebuild                     # rebuild the image when the build files change
          path: ./pom.xml
        - action: sync                        # copy changed files into the running container
          path: ./src/main/resources
          target: /app/resources
  pgadmin:
    image: dpage/pgadmin4
    profiles: [debug]
    ports: ["5050:80"]
```

`docker compose watch` (Compose 2.22+) then keeps the container in step with your edits using the `sync`, `rebuild` and `sync+restart` actions.

## Resources, restart and logging {#runtime}

- `restart: unless-stopped` (or `on-failure`) restarts crashed containers and brings them back after a reboot.
- `deploy.resources.limits` (`cpus`, `memory`) limit a container; set a memory limit so the [JVM](lesson:docker#jvm) sizes its heap from it.
- `logging:` configures the log driver and rotation, so local disks do not fill with logs.
- `stop_grace_period` gives the application time for a graceful shutdown (Spring's `server.shutdown=graceful`).
- `init: true` runs a small init process that forwards signals and reaps zombie processes.

## Compose with Spring Boot {#spring}

- **Spring Boot Docker Compose support** (Spring Boot 3.1+): add `spring-boot-docker-compose` as a development dependency. When you run the application from the IDE, Boot finds `compose.yaml`, runs `docker compose up`, waits for the services, and configures the `DataSource`, Redis and Kafka connection details automatically, then stops them on exit. You do not copy hosts and ports into `application.yml`.
- **Testcontainers** starts containers from the test code itself, one set per test class or suite, with random ports and automatic cleanup. Prefer it for **automated tests** (isolation, repeatability in CI) and Compose for the **developer's running environment**. Spring Boot 3.1+ `@ServiceConnection` wires Testcontainers beans just as automatically. See [Spring testing](lesson:spring-testing).
- A common layout: `compose.yaml` for dependencies only (database, Redis, Kafka) while the application runs in the IDE, and a second profile that also builds and runs the application image to test the real container.

## Compose in context {#context}

| Aspect | Docker Compose | Kubernetes |
| --- | --- | --- |
| Scope | one Docker host | a cluster of nodes |
| Failure handling | restart policy only | self-healing, rescheduling on another node |
| Scaling | `up --scale app=3` on one host | autoscaling across nodes |
| Updates | recreate containers (brief downtime) | rolling updates, rollbacks |
| Networking | one private network, port publishing | Services, Ingress, network policies |
| Configuration | `.env`, secrets files | ConfigMaps, Secrets |
| Best for | local development, tests, demos, small internal tools | production services |

Use Compose to run what you need locally; use [Kubernetes](lesson:kubernetes) (with [kind](lesson:kind) or [minikube](lesson:minikube) locally) when you must run like production. The tool **Kompose** converts Compose files to Kubernetes manifests as a starting point, and Compose files can also be used with Docker Swarm, which is rarely chosen today.

## Troubleshooting {#troubleshooting}

| Symptom | Likely cause and fix |
| --- | --- |
| app cannot connect to the database on start | `depends_on` without `service_healthy`, or the app uses `localhost` instead of `db` |
| `port is already allocated` | another process uses the host port; change the left side of `ports:` |
| changes in `.env` are not picked up | recreate the container (`up -d`); environment is read at creation |
| data disappears | you ran `down -v`, or the data directory is not on a volume |
| database image ignores new `POSTGRES_*` values | initialisation runs only on an empty data volume; remove the volume to re-initialise |
| container exits immediately | `docker compose logs <service>` and check the command and healthcheck |
| bind mount permission denied | user ID mismatch between host and container; set `user:` or fix ownership |
| services cannot reach each other | different networks; put them on a shared network |

## Cheat sheet {#cheatsheet}

| Need | Do |
| --- | --- |
| start everything | `docker compose up -d` |
| rebuild after code change | `docker compose up -d --build` |
| see what is running | `docker compose ps` |
| view logs | `docker compose logs -f <service>` |
| shell into a service | `docker compose exec <service> sh` |
| stop, keep data | `docker compose down` |
| stop, delete data | `docker compose down -v` |
| check the final file | `docker compose config` |
| optional services | `profiles:` and `--profile <name>` |
| wait for readiness | `healthcheck` + `depends_on: condition: service_healthy` |
| connect between services | use the service name as the host |
| keep secrets out of Git | `.env` in `.gitignore`, `secrets:` files |

## Interview questions {#questions}

### [basic] What is Docker Compose and why use it? {#what-q}

A tool to define and run multi-container applications from a single YAML file (`compose.yaml`). One command creates the network, volumes and containers for the application and its dependencies, so a new developer can start the whole environment with `docker compose up`. It removes long `docker run` commands and documents the local environment in version control.

### [basic] How do containers in a Compose project reach each other? {#dns-q}

Compose creates a default network for the project and attaches every service to it. Docker's embedded DNS resolves each service name to its container IP, so the application connects to `db:5432`. `localhost` inside a container refers to the container itself, which is a common mistake.

### [basic] What is the difference between `ports` and `expose`? {#ports-q}

`ports` publishes a container port on the host (`"8080:8080"`, host side first) so it can be reached from outside Docker. `expose` only documents a port for other containers on the network; services on the same network can reach any listening port anyway, so you rarely need it.

### [basic] What is the difference between `docker compose down` and `down -v`? {#down-q}

`down` stops and removes the containers and the network but keeps named volumes, so database data survives. `down -v` also removes the named volumes, which deletes the data. Use `-v` deliberately, for a clean start.

### [basic] Why is the version key not needed in modern Compose files? {#version-q}

The Compose Specification is a single, evolving format and Compose V2 ignores the old `version:` field (it prints a warning). The file is simply `services`, `volumes`, `networks`, `secrets` and so on. The command is `docker compose`, the V2 plugin; the standalone `docker-compose` (V1) is end of life.

### [intermediate] Does `depends_on` wait until the database is ready? {#depends-on-q}

Not by default. It waits only for the dependency container to **start**. To wait for readiness, give the dependency a `healthcheck` and use `depends_on` with `condition: service_healthy`. The application should still retry connections, because a database can be briefly unavailable at any time, not only at start-up.

### [intermediate] How do you persist database data between restarts? {#volumes-q}

Mount a named volume at the data directory (`pgdata:/var/lib/postgresql/data`) and declare it under `volumes:`. Docker stores it outside the container filesystem, so it survives `down` and container recreation. Bind mounts also persist, but depend on host paths and permissions. Remember that the image's initialisation scripts run only when the volume is empty.

### [intermediate] How do you manage different settings for development and production? {#override-q}

Keep a base `compose.yaml` and layer files on top: `compose.override.yaml` is merged automatically (developer ports, bind mounts, debug options), and `-f compose.yaml -f compose.prod.yaml` selects production settings. Variables come from `.env` or the shell, and `docker compose config` shows the final result. Profiles switch optional services on and off.

### [intermediate] How do you handle secrets in Compose? {#secrets-q}

Do not hard-code them or commit `.env`. Use `secrets:` entries backed by files, which are mounted read-only in `/run/secrets/<name>` and consumed through `*_FILE` variables or by reading the file. Environment variables are easy but visible through `docker inspect`. For anything beyond local development use a secrets manager (Vault, a cloud service, Kubernetes Secrets).

### [intermediate] What are Compose profiles? {#profiles-q}

Labels on services (`profiles: [debug]`) that make them optional: services without a profile always start, others start only when you pass `--profile debug` or set `COMPOSE_PROFILES`. They are useful for tools (pgAdmin, Kafka UI), test helpers and heavier stacks that most developers do not need every time.

### [intermediate] Compose or Testcontainers for integration tests? {#testcontainers-q}

Testcontainers for automated tests: containers are created from test code, use random ports, are isolated per test run and removed afterwards, which suits CI and parallel builds. Compose for the developer's long-running local environment and demos. Spring Boot 3.1 supports both with automatic connection configuration (`@ServiceConnection` and `spring-boot-docker-compose`).

### [intermediate] Why is Compose not recommended for production clusters? {#prod-q}

It manages one host and offers only restart policies: no scheduling across machines, no self-healing when a host dies, no rolling updates or autoscaling, and limited networking and secret management. For production on several nodes use Kubernetes (or a managed container service). Compose remains fine for small single-host deployments, internal tools and test environments.

### [intermediate] A container exits immediately after `docker compose up`. How do you investigate? {#debug-q}

Run `docker compose ps -a` for the exit code and `docker compose logs <service>` for the output. Typical causes: the command or entrypoint fails (missing file, wrong arguments), a dependency was not ready, a port is already in use, an environment variable is missing or a bind mount has the wrong permissions. `docker compose config` shows the real resolved configuration, and `docker compose run --rm <service> sh` gives a shell to experiment.

### [deep] How does Compose handle scaling a service? {#scale-q}

`docker compose up --scale app=3` starts three replicas on the same host. You cannot publish the same host port for all of them (use a range or a reverse proxy), and there is no built-in load balancer beyond DNS round-robin on the service name. It is useful for testing statelessness, not for production scaling, where an orchestrator and a load balancer are used.

### [deep] How would you wire Compose into the Spring Boot developer workflow? {#spring-workflow-q}

Put database, Redis and Kafka in `compose.yaml` and add `spring-boot-docker-compose` as a development dependency: running the application from the IDE starts the services, waits for them and configures the connection beans, so `application.yml` needs no host or port. Add Flyway for the schema and seed data. Keep a second Compose profile that builds and runs the application image so that the container build is tested as well, and use Testcontainers in automated tests.

### [coding] Write a Compose file for a Spring Boot service with PostgreSQL and a healthcheck. {#coding-compose}

```yaml
name: payments

services:
  app:
    build: .
    ports: ["8080:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/payments
      SPRING_DATASOURCE_USERNAME: payments
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD:?set DB_PASSWORD in .env}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: payments
      POSTGRES_USER: payments
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U payments -d payments"]
      interval: 5s
      retries: 10

volumes:
  pgdata:
```

Explain that the app reaches the database as `db`, starts only when the healthcheck passes, the password comes from `.env` (and Compose fails with a message if it is missing), and data lives in a named volume.

### [coding] Add an optional pgAdmin service and a developer override. {#coding-override}

```yaml
# compose.override.yaml
services:
  app:
    ports: ["5005:5005"]
    environment:
      JAVA_TOOL_OPTIONS: "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
  pgadmin:
    image: dpage/pgadmin4
    profiles: [debug]
    environment:
      PGADMIN_DEFAULT_EMAIL: dev@example.com
      PGADMIN_DEFAULT_PASSWORD: dev
    ports: ["5050:80"]
```

Explain that the override file merges automatically for developers, the debugger port is opened only locally, and pgAdmin starts only with `docker compose --profile debug up`.
