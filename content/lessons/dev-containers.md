---
title: Dev Containers — a reproducible development environment as code
nav: Dev Containers
slug: dev-containers
summary: What Dev Containers are and how devcontainer.json works: images, Features, lifecycle commands, Docker Compose services, prebuilds, Codespaces and the CLI, Docker-in-Docker vs the host socket, security and trust, and how they compare with Docker Compose, Testcontainers and local installs, with a Spring Boot setup and interview questions.
tags: [Dev Containers, Docker, VS Code, Codespaces, Developer experience, Spring Boot]
order: 33
topic: Containers / Docker
updated: 2026-11-14
subnav: true
---

"It works on my machine" usually means *my JDK, my Maven, my environment variables and my database version are different from yours*. A **Dev Container** moves the development environment itself into a container described by a file in the repository, so a new developer (or a CI job, or a cloud workspace) gets the same tools in minutes. Interviews ask *what is a dev container, how is it different from running the application in Docker, what is in devcontainer.json, what are Features, how do you add a database, and what are the security risks?* This lesson builds on [Docker](lesson:docker) and [Docker Compose](lesson:docker-compose). Play the three scenes: reopening in a container, the configuration and lifecycle, and services, prebuilds and security.

```demo
name: devcontainer-walk
```

> **One sentence to remember:** *a dev container runs your editor's tooling (JDK, build tools, language servers, debugger, terminal) inside a container defined by `devcontainer.json` in the repository, so the whole team shares one reproducible environment and a broken one is replaced by rebuilding.*

## The problem and the idea {#idea}

Setting up a Java project often means the right JDK, Maven or Gradle, Node, Docker, database clients, environment variables and a README that is a little out of date. Different laptops drift, onboarding takes a day, and bugs appear only on one machine. On a bank's managed laptops, installing tools may also need approvals.

The **Dev Containers specification** (containers.dev) standardises a development environment in a container. The file **`.devcontainer/devcontainer.json`** says which image to use, which tools to add, which editor extensions to install, which ports to forward and which commands to run after creation. Supporting tools read it and give you a ready environment:

| Tool | Where the container runs |
| --- | --- |
| **VS Code Dev Containers extension** | your local Docker (or a remote Docker host) |
| **GitHub Codespaces** | a cloud virtual machine, opened in the browser or VS Code |
| **JetBrains IDEs** (IntelliJ IDEA through the remote development support) | local or remote Docker |
| **`devcontainer` CLI** (`@devcontainers/cli`) | anywhere, for scripts and CI |
| **DevPod, Cursor and other editors** | local, cloud or Kubernetes providers |

It is not the same as running the *application* in Docker. The container holds the **development tools and your source mount**; the application you are building runs inside it (or in other containers next to it), like it would on your laptop.

## A first devcontainer.json {#first}

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "payments-service",
  "image": "mcr.microsoft.com/devcontainers/java:1-21-bookworm",

  "features": {
    "ghcr.io/devcontainers/features/java:1": { "version": "21", "installMaven": "true", "mavenVersion": "3.9.9" },
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "vscjava.vscode-java-pack",
        "vmware.vscode-boot-dev-pack",
        "redhat.vscode-yaml"
      ],
      "settings": { "java.configuration.updateBuildConfiguration": "automatic" }
    }
  },

  "forwardPorts": [8080, 5005],
  "portsAttributes": { "8080": { "label": "payments api", "onAutoForward": "notify" } },

  "containerEnv": { "SPRING_PROFILES_ACTIVE": "dev" },
  "remoteUser": "vscode",

  "postCreateCommand": "./mvnw -q -B dependency:go-offline"
}
```

Open the folder and choose **Reopen in Container**. The tool builds the container, installs Features and extensions, mounts the workspace at `/workspaces/<repo>`, forwards the ports and runs `postCreateCommand`. From then on the terminal, the debugger and the language server all run inside the container.

## How it works {#how}

1. **Read** the configuration (`.devcontainer/devcontainer.json`, `.devcontainer.json`, or several in subfolders for monorepos).
2. **Build or pull** the image, or bring up a Compose project.
3. **Apply Features**, which are installed into the image in a defined order.
4. **Create and start the container** with the workspace mounted and the user and environment set.
5. **Install the editor server** inside it and connect (for VS Code the VS Code Server, with the extensions you listed running there).
6. **Run the lifecycle commands** and set up port forwarding.

The container only has to be rebuilt when the configuration changes. Your code is not stored in the image: it is a **bind mount** of your folder, or a **volume** (see the next section).

## Configuration building blocks {#config}

| Property | Purpose |
| --- | --- |
| **`image`** | a ready image (Microsoft publishes Java, Node, Python, .NET and universal images) |
| **`build`** (`dockerfile`, `context`, `args`) | build your own image when you need system packages not covered by Features |
| **`dockerComposeFile`**, **`service`**, `runServices` | use a Compose project; the named service is the dev container and the rest are dependencies |
| **`features`** | reusable add-ons from a registry, with options (Java, Node, Docker, kubectl, Azure CLI, Terraform) |
| **`customizations.vscode`** | extensions and settings (JetBrains and others have their own sections) |
| **`forwardPorts`**, `portsAttributes` | ports to forward to `localhost`, with labels and behaviour |
| **`containerEnv`**, `remoteEnv` | environment variables for the container, or only for the tool's processes |
| **`remoteUser`**, `containerUser` | the user inside; prefer a non-root user (`vscode`) |
| **`mounts`** | extra mounts, for example a Maven cache volume or a read-only credentials folder |
| **`runArgs`**, `capAdd`, `privileged` | extra Docker flags (use sparingly) |
| **`hostRequirements`** | minimum CPUs, memory and storage |
| **`workspaceFolder`**, `workspaceMount` | where the code appears inside the container, and how it is mounted |

Variables such as `${localWorkspaceFolder}`, `${containerWorkspaceFolder}` and `${localEnv:NAME}` let the file refer to paths and host environment variables.

## Features and Templates {#features}

A **Feature** is a small, versioned installer (a script plus metadata) published as an OCI artifact, for example `ghcr.io/devcontainers/features/java:1`. It adds one tool, with options, to whichever base image you use, so you compose an environment instead of writing a long Dockerfile. You can host your own Features in an internal registry, for example one that installs your company CA certificates and Maven settings.

A **Template** is a starting `.devcontainer` folder (for example "Java", "Java and PostgreSQL") that the editor can add to a new project. For a bank, an internal Template with approved base image, proxies and certificates is a good way to standardise.

## Lifecycle commands {#lifecycle}

| Command | Runs | Typical use |
| --- | --- | --- |
| `initializeCommand` | on the **host**, before the container is created | create a folder, check that a token exists |
| `onCreateCommand` | once, when the container is first created | install system tools |
| `updateContentCommand` | after the code changes (and in prebuilds) | resolve dependencies |
| `postCreateCommand` | once, after creation, with user secrets available | `mvn dependency:go-offline`, install Git hooks |
| `postStartCommand` | every time the container starts | start a background service |
| `postAttachCommand` | every time the editor attaches | print instructions |

Commands can be a string, an array, or an object of named commands that run in parallel. Keep them **idempotent** and quick; slow work belongs in a prebuild.

## Adding a database: dev containers with Docker Compose {#compose}

The dev container often needs PostgreSQL, Redis or Kafka. Point `devcontainer.json` at a Compose file whose `app` service is the development container:

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "payments-service",
  "dockerComposeFile": "compose.yaml",
  "service": "app",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "forwardPorts": [8080],
  "remoteUser": "vscode",
  "features": { "ghcr.io/devcontainers/features/java:1": { "version": "21" } }
}
```

```yaml
# .devcontainer/compose.yaml
services:
  app:
    image: mcr.microsoft.com/devcontainers/java:1-21-bookworm
    volumes:
      - ..:/workspaces/payments:cached
    command: sleep infinity            # keep the dev container running; you start the app from the editor
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/payments
    depends_on:
      db: { condition: service_healthy }
  db:
    image: postgres:16
    environment: { POSTGRES_DB: payments, POSTGRES_USER: payments, POSTGRES_PASSWORD: dev }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U payments"]
      interval: 5s
volumes:
  pgdata:
```

The application runs in `app` and reaches the database as `db:5432`; the editor forwards `8080` to your browser. Compare this with [Docker Compose](lesson:docker-compose#spring), where the application stays on the host and only dependencies are containers.

## Speed, volumes and prebuilds {#speed}

- **File performance**: on Windows and macOS a bind mount of the host folder can be slow for build-heavy work. Use **"Clone Repository in Container Volume"** to keep the code in a Docker volume (fast, but the files are not visible in the host file manager), and a named volume for the Maven or Gradle cache (`"mounts": ["source=maven-cache,target=/home/vscode/.m2,type=volume"]`).
- **Prebuilds**: building Features and dependencies on every machine wastes time. Build the image in CI with `devcontainer build --image-name registry/team/payments-dev:1.4`, push it, and reference it from `devcontainer.json` (the build metadata travels as an image label). GitHub Codespaces also offers prebuilds on a schedule or on push.
- **Resources**: Docker Desktop memory and CPU limits apply; set `hostRequirements` so Codespaces picks an adequate machine.
- **Dotfiles**: editors can clone your personal dotfiles repository into each dev container for shell preferences.

## Running Docker inside a dev container {#docker}

Integration tests with Testcontainers, or building images, need a Docker daemon.

| Approach | How | Trade-off |
| --- | --- | --- |
| **Docker-in-Docker** | the `docker-in-docker` Feature runs a separate daemon inside the container | isolated from the host's containers, but needs `privileged` mode and has its own image cache |
| **Docker-outside-of-Docker** | the `docker-outside-of-docker` Feature mounts the host's `/var/run/docker.sock` | simple and fast, shares the host cache, but gives the container control of the host's Docker (effectively root on the host) |

On a managed bank laptop security teams often prefer Docker-in-Docker, a remote Docker host, or rootless approaches, so check the policy.

## Security and trust {#security}

- A dev container is code that runs on your machine or in the cloud with your **source code and credentials** nearby. A repository's `devcontainer.json` can run commands (`initializeCommand` runs on the host), so open unknown repositories with **workspace trust** and review the file first.
- Use a **non-root `remoteUser`**, avoid `privileged`, and mount only what is needed (read-only where possible). Mounting the Docker socket or the whole home directory widens the risk.
- Keep **secrets out** of `devcontainer.json`: use the tool's secrets feature (Codespaces secrets), environment variables from the host (`${localEnv:...}`) or a vault, never commit tokens.
- Pull base images from an **approved internal registry** and pin versions or digests; scan the dev image like any other.
- A dev container **shares the host kernel**; it is not a security boundary against a malicious repository the way a virtual machine would be.

## Dev Containers compared {#compare}

| Approach | What it solves | Limits |
| --- | --- | --- |
| **Local installs** | nothing extra to learn | drift between machines, long onboarding, conflicting versions |
| **Dev Containers** | one reproducible toolchain and editor setup per repository | needs Docker and a supporting editor; some performance cost on macOS and Windows |
| **[Docker Compose](lesson:docker-compose)** alone | runs dependencies (database, Kafka) | does not define the editor and toolchain; the app usually runs on the host |
| **[Testcontainers](lesson:spring-testing)** | throwaway dependencies inside automated tests | not a development environment |
| **Cloud workspaces (Codespaces, Gitpod)** | no local resources, instant onboarding, uniform security controls | cost, network dependence, data residency questions |
| **Virtual machines** | stronger isolation, full OS | heavy, slow, harder to version in the repository |
| **Nix and similar** | very reproducible toolchains without containers | steeper learning curve |

They combine well: the dev container provides the toolchain, Compose provides services next to it, and Testcontainers runs inside it for tests. See also [Spring Boot](lesson:spring-boot) for the application side.

## Troubleshooting {#troubleshooting}

| Symptom | Likely cause and fix |
| --- | --- |
| build fails after editing the config | run **Rebuild Container** (or "Rebuild Without Cache"); check the build log |
| files created in the container are owned by root on the host | run as a non-root user and let the tool update the UID (`updateRemoteUserUID`), or fix mount ownership |
| very slow builds or file watching | use a container volume instead of a bind mount on macOS and Windows |
| the port is not reachable | add it to `forwardPorts`, and check the application listens on `0.0.0.0`, not only `127.0.0.1` |
| extension missing in the container | list it under `customizations.vscode.extensions`; extensions are installed per container |
| Git or SSH credentials do not work | the tool forwards the agent and Git credential helper; check `ssh-add -l` on the host |
| Docker commands fail inside | add the `docker-in-docker` or `docker-outside-of-docker` Feature |
| works locally but not behind the corporate proxy | pass proxy variables through `containerEnv` and build args, and add the company CA certificate |

## Cheat sheet {#cheatsheet}

| Need | Do |
| --- | --- |
| a reproducible JDK and Maven | `image` + `features` (java, maven) in `devcontainer.json` |
| add tools without a Dockerfile | Features |
| database next to the app | `dockerComposeFile` + `service` |
| install dependencies once | `postCreateCommand` |
| open ports in the browser | `forwardPorts` |
| fast build on Windows or macOS | volume clone and a cache volume |
| quick start for everyone | prebuilt image from CI |
| run Docker in the container | docker-in-docker (isolated) or docker-outside-of-docker (host socket) |
| safe defaults | non-root user, no secrets in the file, approved images |
| scripted use | `devcontainer up`, `devcontainer exec` |

## Interview questions {#questions}

### [basic] What is a Dev Container? {#what-q}

A development environment that runs inside a container and is defined by a configuration file (`devcontainer.json`) kept in the repository. The editor connects to the container, so the JDK, build tools, extensions and settings are the same for every developer. It follows the Dev Containers specification, supported by VS Code, GitHub Codespaces, JetBrains IDEs and the `devcontainer` CLI.

### [basic] What problem do Dev Containers solve? {#problem-q}

Environment drift and slow onboarding: different tool versions and settings on each machine cause "works on my machine" bugs, and a new developer spends a day installing and configuring. With a dev container the environment is code: clone, reopen in container, and the right tools are there. A broken environment is fixed by rebuilding rather than debugging the host.

### [basic] How is a dev container different from running the application in Docker? {#vs-app-q}

An application container packages the **application** to run (a runtime image with your jar). A dev container packages the **development tools** (JDK, Maven, debugger, language server, Git) and mounts your source code, so you edit, build and debug inside it. The application you develop runs within it, or in sibling containers.

### [basic] What goes in devcontainer.json? {#content-q}

The base `image` or a `build` section, or a Compose file and service; `features` for tools; `customizations` for editor extensions and settings; `forwardPorts`; environment variables; the `remoteUser`; mounts; and lifecycle commands such as `postCreateCommand`. It can live in `.devcontainer/devcontainer.json` or `.devcontainer.json`, with several configurations for a monorepo.

### [basic] What are Dev Container Features? {#features-q}

Small, versioned, reusable installers distributed as OCI artifacts (for example `ghcr.io/devcontainers/features/java:1`) that add a tool, with options, to any base image. They avoid maintaining long Dockerfiles, can be shared across projects, and teams can publish their own in an internal registry.

### [intermediate] What are the lifecycle commands and in which order do they run? {#lifecycle-q}

`initializeCommand` runs on the host first. Then inside the container: `onCreateCommand`, `updateContentCommand`, `postCreateCommand` once after creation, then `postStartCommand` on every start and `postAttachCommand` each time the editor attaches. Use `postCreateCommand` for things such as downloading Maven dependencies, and keep commands idempotent. Slow, shareable work belongs in a prebuild.

### [intermediate] How do you give a dev container a database? {#database-q}

Use a Docker Compose file: set `dockerComposeFile` and `service` so the named service is the dev container, and define `db` (and Redis or Kafka) as other services on the same network. The application then connects to `db:5432`, and `forwardPorts` exposes what you need in your browser. This keeps the environment closer to production than a database installed on the host.

### [intermediate] How do Dev Containers compare with Docker Compose and Testcontainers? {#compare-q}

Compose describes a set of services to run, typically the dependencies, while the application often runs on the host; it does not define the editor and toolchain. Testcontainers starts throwaway dependencies from test code. A dev container defines the developer's toolchain and editor setup, and can use Compose underneath for services and Testcontainers inside for tests. They complement each other.

### [intermediate] Why can a dev container be slow on macOS or Windows, and what helps? {#performance-q}

Docker Desktop runs containers in a VM, and bind-mounting the host folder crosses a file-sharing layer, which is slow for tools that touch many files (Maven, Node, file watchers). Keep the repository in a Docker volume ("Clone Repository in Container Volume"), put build caches in named volumes, give Docker enough CPU and memory, and prebuild the image.

### [intermediate] What are prebuilds and why use them? {#prebuild-q}

Building Features and installing dependencies on every developer's machine takes minutes. A prebuild runs that work once in CI (`devcontainer build`, or GitHub Codespaces prebuilds), pushes the image to a registry, and `devcontainer.json` references it. Opening the project then takes seconds, and everyone gets an identical, tested image whose configuration travels as image metadata.

### [intermediate] How do you run Docker or Testcontainers inside a dev container? {#docker-q}

Add the `docker-in-docker` Feature, which runs its own daemon in the container and needs privileged mode but is isolated, or `docker-outside-of-docker`, which mounts the host Docker socket and shares its images and containers. The socket approach is simple and fast but lets code in the container control the host's Docker, which is equivalent to root access on the host, so it needs a security decision.

### [deep] What are the security risks of Dev Containers? {#security-q}

A repository's `devcontainer.json` can execute commands (including on the host through `initializeCommand`), so opening an untrusted repository is risky; use workspace trust and review the file. Privileged mode, the Docker socket, and broad mounts weaken isolation, and containers share the host kernel. Keep secrets out of the file, use a non-root user, pin base images from an approved registry, and scan the image. For stronger isolation use a remote or cloud workspace.

### [deep] How would you roll out Dev Containers to a team of banking developers? {#rollout-q}

Start with an internal Template and Features that bake in the approved base image from the internal registry, company CA certificates, proxy settings and Maven mirror. Prebuild the image in CI on every change, and have `devcontainer.json` reference it. Provide a Compose service set for PostgreSQL, Kafka and Redis, document the Docker policy (Docker-in-Docker or remote host), manage secrets through a vault rather than the file, and offer a cloud workspace for locked-down laptops. Measure onboarding time before and after.

### [coding] Write a devcontainer.json for a Spring Boot service with Java 21, Maven, and port 8080. {#coding-basic}

```jsonc
{
  "name": "payments-service",
  "image": "mcr.microsoft.com/devcontainers/java:1-21-bookworm",
  "features": {
    "ghcr.io/devcontainers/features/java:1": { "version": "21", "installMaven": "true" }
  },
  "customizations": {
    "vscode": { "extensions": ["vscjava.vscode-java-pack", "vmware.vscode-boot-dev-pack"] }
  },
  "forwardPorts": [8080],
  "remoteUser": "vscode",
  "postCreateCommand": "./mvnw -q -B dependency:go-offline"
}
```

Explain the base image, the Feature that pins Java and Maven, the extensions installed in the container, the forwarded port, the non-root user, and that dependencies are fetched once after creation.

### [coding] Add PostgreSQL to the dev container with Docker Compose. {#coding-compose}

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "payments-service",
  "dockerComposeFile": "compose.yaml",
  "service": "app",
  "workspaceFolder": "/workspaces/payments",
  "forwardPorts": [8080],
  "remoteUser": "vscode"
}
```

```yaml
# .devcontainer/compose.yaml
services:
  app:
    image: mcr.microsoft.com/devcontainers/java:1-21-bookworm
    volumes: ["..:/workspaces/payments:cached"]
    command: sleep infinity
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/payments
    depends_on:
      db: { condition: service_healthy }
  db:
    image: postgres:16
    environment: { POSTGRES_DB: payments, POSTGRES_USER: payments, POSTGRES_PASSWORD: dev }
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U payments"], interval: 5s }
```

Explain that `service` marks `app` as the dev container, `sleep infinity` keeps it alive while you run the application from the editor, the database is reachable as `db`, and the password is a local development value only.
