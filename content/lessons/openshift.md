---
title: OpenShift — Kubernetes for the enterprise: routes, builds, security constraints and operators
nav: OpenShift
slug: openshift
summary: What OpenShift adds to Kubernetes (projects, routes, Source-to-Image builds, ImageStreams, Security Context Constraints, Operators, pipelines and GitOps), how it differs from plain Kubernetes, and how to run a Spring Boot service on it, with diagrams, YAML examples and interview questions.
tags: [OpenShift, Kubernetes, Containers, Routes, SCC, Operators, S2I, GitOps]
order: 36
topic: Containers / OpenShift
updated: 2026-11-14
subnav: true
---

Banks and other regulated companies often run **Red Hat OpenShift** rather than plain Kubernetes, so interviews ask *what is OpenShift, how is it different from Kubernetes, what is a Route, why does my image fail with a permission error, and what is an Operator?* This lesson assumes you know the basics from [Docker](lesson:docker) and [Kubernetes](lesson:kubernetes); everything you learned there still applies. Play the five scenes: the platform layers, a build and deploy, routes and the router, security constraints, and operators with delivery.

```demo
name: openshift-walk
```

> **One sentence to remember:** *OpenShift is a certified Kubernetes distribution with security on by default, a built-in developer experience (builds, registry, router, console) and Operators that manage both the platform and the software on it; you keep using Deployments, Services and ConfigMaps, and add Routes, ImageStreams and Security Context Constraints.*

## From servers to containers to a platform {#why}

![Traditional, virtualised and container deployment compared](images/deployment-evolution.png "Applications moved from bare servers to virtual machines to containers sharing one operating system. | Red Hat, OpenShift documentation (Apache-2.0) | https://github.com/openshift/openshift-docs")

Containers made applications portable, and Kubernetes made running many of them manageable. But "raw" Kubernetes is a toolbox: you still choose and integrate networking, ingress, registry, logging, monitoring, security policy, CI/CD and upgrades. A **platform** such as OpenShift packages those choices, tests them together, supports them and upgrades them as one product.

## Kubernetes vs OpenShift {#vs-kubernetes}

| Topic | Kubernetes | OpenShift |
| --- | --- | --- |
| What it is | the orchestration engine (open source) | a distribution built on Kubernetes (Red Hat), with an open source upstream called **OKD** |
| Installation | you assemble components or use a managed service | installer and Operators manage the cluster and its upgrades |
| Nodes | any Linux | Red Hat CoreOS, an immutable OS managed by the cluster |
| Security defaults | permissive: containers can often run as root | restrictive: **Security Context Constraints**, random UID, no privileged containers |
| Namespace | `Namespace` | **Project** (a namespace with extra annotations and a request flow) |
| External access | `Ingress` (needs a controller you install) | **Route** served by the built-in router; Ingress objects also work |
| Image building | outside the cluster (CI) | built in: **BuildConfig**, **Source-to-Image**, **ImageStream**, integrated registry |
| Authentication | you integrate an identity provider | built-in **OAuth server** connecting to LDAP, OIDC and others |
| CLI | `kubectl` | `oc` (a superset of `kubectl`, plus `oc login`, `oc new-app`, `oc new-project`) |
| Web UI | optional dashboard | full console with Administrator and Developer perspectives |
| Add-on software | Helm charts, manifests | **Operators** from OperatorHub, managed by the Operator Lifecycle Manager |

OpenShift is Kubernetes, so a standard `Deployment` runs unchanged. What breaks is usually an assumption about security (running as root) or a missing platform feature (Ingress class). The product comes in several forms: **OpenShift Container Platform** (self-managed, on-premises or cloud), managed services (**ROSA** on AWS, **ARO** on Azure, OpenShift Dedicated), and **OpenShift Local** or the free **Developer Sandbox** for learning.

## Architecture {#architecture}

![Red Hat OpenShift architecture: control plane nodes and compute nodes](images/openshift-architecture.png "Control plane nodes run the API server, scheduler, controller manager and etcd; compute nodes run workloads, monitoring, networking and the registry. | Red Hat, OpenShift documentation (Apache-2.0) | https://github.com/openshift/openshift-docs")

- **Control plane nodes** (older documents say "master") run the Kubernetes API server, scheduler, controller manager and **etcd**, plus OpenShift's own services and the **Cluster Version Operator**, which updates the platform.
- **Compute (worker) nodes** run your pods, each with a **kubelet** and a container runtime (CRI-O).
- **Infrastructure services** (router, integrated registry, monitoring with Prometheus, logging) run as pods, often on dedicated infra nodes.
- **Everything is an Operator**: networking, DNS, ingress, authentication, storage and the console are each managed by a cluster Operator that you can inspect with `oc get clusteroperators`.

## Projects, access and the `oc` tool {#projects}

A **project** is a Kubernetes namespace with extra defaults: a UID range, default quotas and limits, a default network policy if configured, and role bindings. Users never see other teams' projects unless granted access with **RBAC**.

```bash
oc login https://api.cluster.example:6443 --token=...     # or a username and password
oc new-project payments --display-name="Payments"
oc new-app registry.example.com/bank/payments-service:1.4 # Deployment + Service from an image
oc expose service/payments-service                        # create a Route
oc get pods,svc,route
oc logs -f deploy/payments-service
oc rollout status deploy/payments-service
oc adm policy add-role-to-user edit alice -n payments     # RBAC: alice may edit this project
```

## Building and deploying: Source-to-Image {#builds}

![The OpenShift build process from Git to a running pod](images/openshift-s2i-build.png "Development, build and deployment: a Git change triggers a build that combines a builder image with code, then deploys the result to pods. | Red Hat, OpenShift documentation (Apache-2.0) | https://github.com/openshift/openshift-docs")

OpenShift can build images itself. A **BuildConfig** defines the source and strategy:

| Strategy | What it does | When to use |
| --- | --- | --- |
| **Source-to-Image (S2I)** | injects your source into a *builder image* (Java, Node, Python) and produces an application image, with no Dockerfile | quick start, standard stacks |
| **Docker** | runs your `Dockerfile` | custom images |
| **Pipeline (Tekton)** | a pipeline does the build, tests, scans and push | production delivery |
| **Custom** | your own builder image | special cases |

An **ImageStream** is a Kubernetes-style pointer to images and their tags (digests). It lets the cluster react when an image changes (an **image trigger** can redeploy) and decouples a deployment from a registry URL. The **integrated registry** stores built images and is reachable inside the cluster.

For regulated environments the typical flow is not S2I from a laptop: a **pipeline** builds with a hardened base image, tests, scans for vulnerabilities, signs the image and pushes it to an enterprise registry (Quay, Artifactory), and **GitOps** deploys it. See [Docker](lesson:docker) for building small non-root images.

`DeploymentConfig` is the older OpenShift-only deployment object; it is **deprecated**. Use the standard Kubernetes `Deployment` (with an image trigger annotation if you need one).

## Routes and the router {#routes}

![Ingress controllers with route selectors dividing routes between them](images/openshift-route-sharding.png "Route sharding: several Ingress Controllers each serve only routes whose labels match their selector, for example one for internal and one for public applications. | Red Hat, OpenShift documentation (Apache-2.0) | https://github.com/openshift/openshift-docs")

A **Route** exposes a Service on a hostname. The **router** (the default Ingress Controller, HAProxy-based) listens on ports 80 and 443 of the infrastructure nodes, reads the `Host` header and forwards to the Service's pods.

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: payments
  namespace: payments
spec:
  host: payments.apps.bank.example
  to:
    kind: Service
    name: payments-service
    weight: 100
  port:
    targetPort: http
  tls:
    termination: reencrypt          # TLS to the router and again to the pod
    insecureEdgeTerminationPolicy: Redirect
```

| Termination | TLS ends at | Notes |
| --- | --- | --- |
| **edge** | the router; plain HTTP to the pod | simplest, traffic inside the cluster is unencrypted |
| **passthrough** | the pod | the router cannot read or route by path; for end-to-end TLS |
| **re-encrypt** | the router, then new TLS to the pod | common where policy requires encryption on every hop |

Routes also support **weighted backends** (two Services at 90/10 for canary releases), path-based routing, rate limiting annotations and several Ingress Controllers with **route selectors** (internal vs public). Plain Kubernetes `Ingress` objects are accepted and turned into Routes. The cluster's wildcard DNS (`*.apps.<cluster-domain>`) gives every route a name automatically.

## Security Context Constraints {#scc}

**Security Context Constraints (SCCs)** decide what a pod is allowed to do: run as which user, use which volumes, add which Linux capabilities, run privileged or use host networking. At creation the admission controller picks the most restrictive SCC the pod's service account may use. The default for ordinary workloads is **`restricted-v2`**:

- must run as **non-root**, as a **random UID** from the project's range (for example `1000650000-1000659999`), always with **GID 0 (root group)**;
- all Linux capabilities dropped, privilege escalation disallowed, `seccomp` profile applied;
- no host paths, host network or privileged mode.

This is why "works on Docker Desktop, fails on OpenShift" is so common: the image assumes it is root, writes to `/app`, or binds to port 80.

**Making an image OpenShift-friendly:**

```dockerfile
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY target/app.jar app.jar
# files must be readable and writable by GID 0 because the UID is random
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Rules: do not hard-code a UID in the pod spec, do not rely on being able to write outside `/tmp` and mounted volumes, listen on a port above 1024 (8080), and avoid a `HOME` that is not writable.

Granting a broader SCC (`anyuid`, `privileged`) to a service account (`oc adm policy add-scc-to-user anyuid -z payments-sa`) is a cluster-admin decision. In a bank it needs a security review; fix the image instead.

Other OpenShift security features: the built-in **OAuth server** and identity providers, **RBAC** with projects as the boundary, **NetworkPolicy** (and multi-tenant isolation with the OVN-Kubernetes network), image signature policy, the **Compliance Operator** (CIS, PCI-DSS profiles), **Advanced Cluster Security (StackRox)** for scanning and runtime rules, and encrypted etcd.

## Operators {#operators}

An **Operator** is a controller that encodes the operational knowledge of an application (install, scale, back up, upgrade, recover) and exposes it through a **custom resource**. You declare the desired state and the Operator reconciles reality to match it, the same control loop Kubernetes uses for Deployments.

- The **Operator Lifecycle Manager (OLM)** installs Operators from **OperatorHub** catalogues (Red Hat, certified partners, community) and handles their updates.
- OpenShift itself is made of **cluster Operators**; the **Cluster Version Operator** performs over-the-air cluster upgrades.
- Examples: Red Hat OpenShift Pipelines, GitOps, Service Mesh, Serverless, AMQ Streams (Kafka, based on Strimzi), a PostgreSQL operator, the Elasticsearch and logging operators.

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: payments-events
spec:
  kafka:
    replicas: 3
    listeners:
      - name: tls
        port: 9093
        type: internal
        tls: true
    storage:
      type: persistent-claim
      size: 100Gi
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi
```

You write that one resource and the Operator creates the brokers, volumes, certificates and rolling upgrades. See [messaging](lesson:messaging) for what Kafka is used for.

## CI/CD and GitOps on OpenShift {#cicd}

- **OpenShift Pipelines** is Tekton: pipelines are Kubernetes resources (`Task`, `Pipeline`, `PipelineRun`) and each step runs in a pod. It replaces a separate Jenkins server for many teams; Jenkins is still supported.
- **OpenShift GitOps** is Argo CD: a repository of manifests (or Helm/Kustomize) is the desired state and Argo CD continuously syncs the cluster to it, shows drift, and gives a Git history of every change and an easy rollback.
- A common bank flow: commit, pipeline builds and tests, scans, signs and pushes the image, updates the image tag in the manifest repository through a pull request, approval, Argo CD applies it to staging and then production.
- **Helm** charts and **Kustomize** overlays handle per-environment differences; **Secrets** should come from a vault (HashiCorp Vault, External Secrets Operator) rather than Git.

## Running a Spring Boot service on OpenShift {#spring}

Most things you learned about [Kubernetes](lesson:kubernetes) and [Spring Boot](lesson:spring-boot) carry over:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-service
spec:
  replicas: 3
  selector:
    matchLabels: { app: payments-service }
  template:
    metadata:
      labels: { app: payments-service }
    spec:
      containers:
        - name: app
          image: image-registry.openshift-image-registry.svc:5000/payments/payments-service:1.4
          ports:
            - name: http
              containerPort: 8080
          envFrom:
            - configMapRef: { name: payments-config }
            - secretRef: { name: payments-secret }
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: http }
          livenessProbe:
            httpGet: { path: /actuator/health/liveness, port: http }
          resources:
            requests: { cpu: 250m, memory: 512Mi }
            limits: { memory: 512Mi }
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: [ALL] }
          volumeMounts:
            - { name: tmp, mountPath: /tmp }
      volumes:
        - { name: tmp, emptyDir: {} }
```

- **Port 8080** and no hard-coded user: Spring Boot and the SCC agree.
- **Probes** use the Actuator health groups (see [observability](lesson:spring-observability)).
- **Memory limit** equal to the request, and JVM flags that respect the container (`-XX:MaxRAMPercentage=75`), because a limit smaller than the heap causes an `OOMKilled` pod. See the [memory model](lesson:java-memory-model).
- **Configuration** through ConfigMaps and Secrets or Spring Cloud Kubernetes, not baked into the image. See [Spring Cloud](lesson:spring-cloud).
- **Writable paths**: `readOnlyRootFilesystem` needs an `emptyDir` for `/tmp` (Tomcat, temporary files).
- **Graceful shutdown**: `server.shutdown=graceful` and a `terminationGracePeriodSeconds` longer than the longest request.
- **Metrics**: Micrometer with a Prometheus endpoint; the platform's monitoring stack scrapes it through a `ServiceMonitor`.

## Cheat sheet {#cheatsheet}

| Need | Command or object |
| --- | --- |
| log in, switch project | `oc login`, `oc project payments` |
| create a project | `oc new-project` |
| deploy an image | `oc new-app <image>`, or a `Deployment` |
| build from Git | `oc new-app <builder>~<git-url>` (S2I) |
| expose a Service | `oc expose svc/<name>` (creates a Route) |
| see why a pod failed to start | `oc describe pod`, `oc get events`; look for SCC errors |
| which SCC a pod got | annotation `openshift.io/scc` on the pod |
| debug a failing container | `oc debug deploy/<name>` |
| who can do what | `oc adm policy who-can`, `oc auth can-i` |
| install an Operator | OperatorHub in the console, or a `Subscription` |
| check the platform | `oc get clusteroperators`, `oc get clusterversion` |
| port-forward | `oc port-forward pod/<name> 8080` |

## Interview questions {#questions}

### [basic] What is OpenShift and how does it differ from Kubernetes? {#what-is-openshift}

OpenShift is Red Hat's enterprise Kubernetes distribution. It contains standard Kubernetes and adds an opinionated, supported platform: secure defaults (Security Context Constraints), an integrated registry, build tooling (Source-to-Image, ImageStreams), Routes and the router, a web console, a built-in OAuth server, Operators and Operator Lifecycle Manager, and managed upgrades. Kubernetes is the engine; OpenShift is the engine plus the parts a company would otherwise assemble.

### [basic] What is a Project in OpenShift? {#project-q}

A Project is a Kubernetes namespace with additional OpenShift features: it is the unit of access control and isolation, carries default quotas and limits, a UID range for pods, and role bindings. Users only see the projects they have access to. In practice you can treat it as a namespace.

### [basic] What is the difference between a Route and an Ingress? {#route-vs-ingress}

Both publish a Service outside the cluster. `Ingress` is the Kubernetes standard and needs an Ingress controller. A `Route` is OpenShift's own, older object, served by the built-in router, with features such as weighted backends, passthrough and re-encrypt TLS termination and route selectors. OpenShift accepts Ingress objects and creates Routes from them, so either works; Routes expose more features.

### [basic] What is `oc` and how does it relate to `kubectl`? {#oc-q}

`oc` is OpenShift's command line client. It supports every `kubectl` command and adds OpenShift features: `oc login`, `oc new-project`, `oc new-app`, `oc start-build`, `oc adm policy`, `oc debug`. Anything you know from `kubectl` transfers directly.

### [basic] What is Source-to-Image (S2I)? {#s2i-q}

A build strategy that combines your source code with a **builder image** to produce a runnable application image without a Dockerfile. The builder image knows how to assemble (for example run Maven) and run the app. It standardises builds and keeps the base image controlled, though production pipelines often prefer explicit Dockerfiles or Buildpacks with scanning and signing.

### [basic] What is an ImageStream? {#imagestream-q}

An OpenShift resource that tracks a set of image tags and their digests, like a pointer to images that can live in the integrated registry or an external one. It lets the platform detect when an image changes and trigger a build or rollout, and it decouples deployments from registry locations.

### [basic] What is an Operator? {#operator-q}

A Kubernetes controller that manages a specific application using a custom resource. It encodes operational tasks (install, configure, back up, scale, upgrade) as code, so a declared `PostgresCluster` or `Kafka` resource is turned into running, maintained software. On OpenShift the Operator Lifecycle Manager installs and updates Operators, and the platform itself is run by cluster Operators.

### [intermediate] What is a Security Context Constraint and why do containers fail because of it? {#scc-q}

An SCC is a policy deciding which security settings a pod may use: user ID, capabilities, privileged mode, host access, volume types. The default `restricted-v2` forces a non-root random UID, drops capabilities and blocks privileged containers. Images that run as root, bind to port 80 or write to directories owned by a fixed user fail with permission errors. Fix the image (non-root user, port 8080, group-writable directories) rather than granting a broader SCC.

### [intermediate] Why does OpenShift run containers with a random user ID? {#random-uid-q}

It limits the damage if a container is compromised: each project gets its own UID range, so a process in one project cannot read another's files even when volumes are shared. The UID is random but the group is always 0, so files the application must write have to be group-writable (`chgrp -R 0` and `chmod -R g=u`). That is why a hard-coded `runAsUser` in a pod spec is usually rejected.

### [intermediate] What are the three TLS termination types of a Route? {#tls-q}

Edge: the router terminates TLS and talks plain HTTP to the pod. Passthrough: the router forwards the encrypted traffic and the pod terminates TLS (no path routing or header inspection). Re-encrypt: the router terminates the client TLS and opens a new TLS connection to the pod, so traffic is encrypted on both legs and the router can still inspect it. Regulated environments typically use re-encrypt or service mesh mTLS.

### [intermediate] How would you do a canary release with Routes? {#canary-q}

Deploy the new version as a second Deployment and Service, then give the Route two backends with weights, for example `payments-v1` at 90 and `payments-v2` at 10. Watch error rates and latency in monitoring and adjust the weights until the new version has 100 percent. A service mesh or Argo Rollouts gives finer control (headers, automated analysis).

### [intermediate] What is the difference between DeploymentConfig and Deployment? {#dc-vs-deployment}

`DeploymentConfig` was OpenShift's original deployment object, with its own controller, lifecycle hooks and image triggers. It is deprecated in favour of the standard Kubernetes `Deployment`, which is portable and now supports image triggers through annotations. New applications should use `Deployment`.

### [intermediate] How does OpenShift handle authentication and authorisation? {#authn-q}

A built-in OAuth server authenticates users against identity providers (LDAP, OpenID Connect, GitHub, htpasswd) and issues tokens. Authorisation uses Kubernetes **RBAC** (roles and role bindings, usually per project) plus SCCs for pod permissions. Service accounts represent applications. This ties to [OAuth 2.0](lesson:oauth2), [OIDC](lesson:oidc) and [authn vs authz](lesson:authn-authz).

### [intermediate] How do you deploy to OpenShift from CI/CD? {#cicd-q}

A common pattern is a Tekton pipeline (OpenShift Pipelines) that builds, tests, scans and pushes an image, then commits the new image tag to a manifests repository. Argo CD (OpenShift GitOps) syncs that repository to the cluster, giving auditable, reversible deployments. Jenkins can run the same stages, and `oc rollout` or Helm are used for simpler flows. Secrets come from a vault, not from Git.

### [intermediate] A pod is stuck in CrashLoopBackOff on OpenShift but the same image works locally. What do you check? {#crashloop-q}

Read `oc logs --previous` and `oc describe pod`. On OpenShift the usual causes are the SCC (the image expects root or a fixed UID, so a permission denied error appears), a port below 1024, a read-only file system or a non-writable directory, a failing readiness or liveness probe, missing ConfigMap or Secret values, or an `OOMKilled` memory limit. `oc debug` starts a shell in a copy of the pod, and the pod annotation `openshift.io/scc` shows which constraint was applied.

### [intermediate] How do you size a Java application's memory in a pod? {#jvm-memory-q}

Set a memory request and limit (equal for predictable behaviour) and let the JVM size its heap from the limit with `-XX:MaxRAMPercentage` (for example 70 to 75), leaving room for metaspace, thread stacks and native memory. If the heap plus non-heap exceeds the limit the kernel kills the container (`OOMKilled`). Measure with Actuator and Micrometer and adjust.

### [deep] What happens when you run `oc new-app` with a Git URL? {#new-app-q}

OpenShift inspects the repository to detect the language, picks a matching builder image, and creates a BuildConfig, an ImageStream for the output, a Deployment and a Service. A build pod runs S2I: it clones the code, runs the build in the builder image and pushes the application image to the integrated registry. When the ImageStream tag updates, the trigger rolls out new pods. You then `oc expose` the Service to create a Route.

### [deep] How do Operators and the Operator Lifecycle Manager fit together? {#olm-q}

An Operator is the controller and its custom resource definitions. OLM is the system that installs, updates and manages Operators: you create a `Subscription` to a channel in a catalogue (OperatorHub), OLM resolves dependencies, installs the Operator's ClusterServiceVersion and handles upgrades (automatic or manually approved). The Operator then watches its custom resources and reconciles the application. OpenShift's cluster Operators work similarly under the Cluster Version Operator.

### [deep] How do you secure a banking workload on OpenShift? {#secure-q}

Use projects and RBAC for least privilege; keep the default restricted SCC and fix images instead of granting broader ones; NetworkPolicy with default deny and explicit allows; re-encrypt TLS or mesh mTLS inside the cluster; signed and scanned images from a trusted registry with an admission policy; secrets in a vault, etcd encryption, the Compliance Operator for CIS and PCI profiles, audit logging forwarded to a SIEM, and resource quotas to limit blast radius. Combine with GitOps so every change is reviewed and traceable.

### [coding] Write a Route that exposes a Service with re-encrypt TLS and a canary backend. {#coding-route}

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: payments
spec:
  host: payments.apps.bank.example
  to:
    kind: Service
    name: payments-v1
    weight: 90
  alternateBackends:
    - kind: Service
      name: payments-v2
      weight: 10
  port:
    targetPort: https
  tls:
    termination: reencrypt
    insecureEdgeTerminationPolicy: Redirect
```

Explain that the router sends 90 percent to `payments-v1` and 10 percent to `payments-v2`, re-encrypts to the pod so traffic is encrypted on both legs, and redirects plain HTTP to HTTPS.

### [coding] Make a Dockerfile run under the restricted SCC. {#coding-dockerfile}

```dockerfile
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY target/payments.jar payments.jar
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "payments.jar"]
```

Explain: a numeric non-root `USER`, port 8080, group 0 ownership because OpenShift assigns a random UID in group 0, and a heap size tied to the container memory limit.

### [coding] Give a pod a hardened security context and a writable /tmp. {#coding-security-context}

```yaml
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  capabilities:
    drop: [ALL]
  seccompProfile:
    type: RuntimeDefault
volumeMounts:
  - name: tmp
    mountPath: /tmp
volumes:
  - name: tmp
    emptyDir: {}
```

Explain that the settings pass the restricted SCC without a special grant, that the root file system is read-only so the application cannot be modified at run time, and that an `emptyDir` supplies the temporary directory Tomcat and Spring need.
