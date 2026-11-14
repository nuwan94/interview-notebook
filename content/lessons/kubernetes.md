---
title: Kubernetes — pods, deployments, services, probes and scaling
nav: Kubernetes
slug: kubernetes
summary: The Kubernetes architecture and core objects (Pod, Deployment, Service, Ingress, ConfigMap, Secret), rolling updates, probes and graceful shutdown, resource requests and limits, autoscaling, RBAC and troubleshooting, for Spring Boot services, with animations and interview questions.
tags: [Kubernetes, Containers, DevOps]
order: 33
topic: Containers / Kubernetes
updated: 2026-11-13
subnav: true
---

After "what is a container?" ([Docker](lesson:docker)) the next question is "how do you run, scale and update fifty of them without downtime?". That is Kubernetes. Interviewers for a Java or Spring Boot role rarely expect cluster administration; they expect you to explain the objects, write a Deployment, set probes and resources correctly, and debug a `CrashLoopBackOff`. The service side is in [Spring Boot](lesson:spring-boot), [observability](lesson:spring-observability) (probes, metrics) and [Spring Cloud](lesson:spring-cloud) (which Kubernetes partly replaces). Play the five scenes: objects, rolling update, probes and shutdown, resources and scaling, and configuration.

```demo
name: kubernetes-walk
```

> **One sentence to remember:** *you declare the desired state in YAML (Deployment, Service, ConfigMap); controllers continuously compare it with reality and fix the difference, so pods are replaced, scaled and updated automatically, provided you give the app readiness and liveness probes, resource requests and limits, and graceful shutdown.*

## Architecture {#architecture}

![Kubernetes cluster architecture](images/k8s-cluster-architecture.svg "A control plane (API server, scheduler, controller manager, etcd) manages worker nodes running kubelet and pods. | Kubernetes documentation, CC BY 4.0 | https://github.com/kubernetes/website")

![Components of a Kubernetes cluster](images/k8s-components.svg "The same components in detail, including the cloud controller manager and kube-proxy. | Kubernetes documentation, CC BY 4.0 | https://github.com/kubernetes/website")

| Component | Where | Role |
| --- | --- | --- |
| **API server** | control plane | the front door: every `kubectl` call and every component talks to it |
| **etcd** | control plane | the cluster's key-value database: all desired and current state |
| **scheduler** | control plane | picks a node for each new pod (requests, affinity, taints) |
| **controller manager** | control plane | runs the controllers (Deployment, ReplicaSet, Node, ...) that reconcile state |
| **kubelet** | each node | starts and watches the containers of the pods assigned to its node, runs probes |
| **kube-proxy** | each node | implements Service networking rules |
| **container runtime** | each node | runs containers (containerd, CRI-O) |

Everything works as a **reconciliation loop**: observe current state, compare with desired state, act to close the gap, repeat.

## Core objects {#objects}

| Object | What it is |
| --- | --- |
| **Pod** | one or more containers sharing a network namespace (one IP) and volumes; the smallest deployable unit; disposable |
| **ReplicaSet** | keeps N identical pods running |
| **Deployment** | manages ReplicaSets to give declarative rolling updates and rollbacks for stateless apps |
| **StatefulSet** | pods with stable names, stable storage and ordered startup (databases, Kafka) |
| **DaemonSet** | one pod per node (log shippers, agents) |
| **Job / CronJob** | run-to-completion and scheduled tasks |
| **Service** | stable virtual IP and DNS name that load-balances to matching, ready pods |
| **Ingress** | HTTP(S) routing and TLS from outside to Services (needs an ingress controller) |
| **ConfigMap / Secret** | configuration and credentials injected into pods |
| **Namespace** | logical partition of a cluster for teams, environments, quotas, RBAC |
| **PersistentVolumeClaim** | a pod's request for storage, bound to a PersistentVolume provided by a StorageClass |

Objects are connected by **labels** and **selectors**: a Service selects pods with `app: payments`; a Deployment manages pods with its selector.

## A Spring Boot Deployment and Service {#yaml}

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments
  labels: { app: payments }
spec:
  replicas: 3
  selector:
    matchLabels: { app: payments }
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    metadata:
      labels: { app: payments }
    spec:
      terminationGracePeriodSeconds: 40
      containers:
        - name: payments
          image: registry.example/bank/payments:1.4
          ports: [{ containerPort: 8080 }]
          envFrom:
            - configMapRef: { name: payments-config }
            - secretRef:    { name: payments-secret }
          resources:
            requests: { cpu: 500m, memory: 768Mi }
            limits:   { memory: 1Gi }
          startupProbe:
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            failureThreshold: 30
            periodSeconds: 2
          livenessProbe:
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            periodSeconds: 10
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: 8080 }
            periodSeconds: 5
          lifecycle:
            preStop:
              exec: { command: ["sleep", "5"] }
---
apiVersion: v1
kind: Service
metadata:
  name: payments
spec:
  selector: { app: payments }
  ports: [{ port: 80, targetPort: 8080 }]
```

## Services and networking {#services}

![Ingress sending all traffic to one Service](images/k8s-ingress.svg "An Ingress routes external HTTP traffic to Services inside the cluster. | Kubernetes documentation, CC BY 4.0 | https://github.com/kubernetes/website")

| Service type | Reachable from | Use |
| --- | --- | --- |
| `ClusterIP` (default) | inside the cluster | service-to-service calls |
| `NodePort` | `<node-ip>:<30000-32767>` | simple exposure, demos |
| `LoadBalancer` | an external cloud load balancer | exposing one service to the internet |
| headless (`clusterIP: None`) | DNS returns pod IPs | StatefulSets, client-side discovery |
| `ExternalName` | DNS alias to an outside host | pointing at an external system |

Every Service gets a DNS name: `payments` inside its namespace, `payments.bank` across namespaces, `payments.bank.svc.cluster.local` in full. This replaces much of what a Eureka-style registry did ([Spring Cloud](lesson:spring-cloud)). An **Ingress** routes external HTTP(S) by host and path, terminates TLS and talks to Services. A **NetworkPolicy** limits which pods may talk to which (default is allow all).

## Configuration and secrets {#config}

Keep one image for every environment and inject configuration: **ConfigMap** for ordinary settings, **Secret** for credentials, as environment variables (`envFrom`) or mounted files. Spring Boot maps `SPRING_DATASOURCE_URL` to `spring.datasource.url`. A Secret is only **base64-encoded**, not encrypted: restrict it with RBAC, enable etcd encryption at rest, and prefer an external manager (Vault, cloud KMS, External Secrets). Environment variables are fixed at container start, so changing a ConfigMap needs `kubectl rollout restart` (mounted files update in place).

## Probes and graceful shutdown {#probes}

| Probe | Question | On failure |
| --- | --- | --- |
| **startup** | has the app finished starting? | keeps other probes waiting; kills the container if it never succeeds |
| **liveness** | is the process stuck beyond recovery? | the container is **restarted** |
| **readiness** | can it handle requests now? | the pod is **removed from the Service** (no restart) |

Spring Boot: `management.endpoint.health.probes.enabled=true` exposes `/actuator/health/liveness` and `/readiness`. Keep **liveness free of external dependencies** (an outage of the database must not restart every pod); put dependencies in **readiness**. A slow JVM start needs a **startup probe**, or liveness kills it in a loop.

Shutdown: Kubernetes removes the pod from endpoints and sends `SIGTERM`; if the app is still running after `terminationGracePeriodSeconds` (default 30) it sends `SIGKILL`. Use `server.shutdown=graceful` with `spring.lifecycle.timeout-per-shutdown-phase` below the grace period, and a short `preStop` sleep so load balancers stop sending new requests first.

## Resources and scaling {#resources}

- **requests**: what the scheduler reserves; **limits**: the ceiling. Above its **CPU** limit a container is **throttled**; above its **memory** limit it is **OOMKilled** (exit 137).
- QoS classes: **Guaranteed** (requests = limits), **Burstable**, **BestEffort** (none; evicted first under pressure).
- A common JVM setup: memory request = memory limit, `-XX:MaxRAMPercentage=75`, CPU request set and often no CPU limit to avoid throttling.
- **HPA** (Horizontal Pod Autoscaler) scales replicas by CPU, memory or custom metrics; **VPA** adjusts requests; the **cluster autoscaler** adds nodes when pods cannot be scheduled.
- A **PodDisruptionBudget** keeps a minimum number of pods available during drains and upgrades. Use several replicas and spread them over nodes and zones (anti-affinity, topology spread constraints).

## Rolling updates and releases {#rollouts}

A Deployment update creates a new ReplicaSet and shifts pods gradually. `maxSurge` is how many extra pods may exist, `maxUnavailable` how many may be missing; with `maxUnavailable: 0` capacity never drops, provided readiness probes are correct. `kubectl rollout status`, `kubectl rollout undo deployment/payments` and `kubectl rollout history` manage it. **Blue-green** runs two full environments and flips the Service selector or the ingress; **canary** sends a small share of traffic to the new version (ingress weights or a service mesh). Database changes must be backward compatible so old and new pods can run together ([Saga](lesson:saga), expand and contract migrations).

## Storage {#storage}

Pods are ephemeral. Persistent data uses a **PersistentVolumeClaim** (a request) satisfied by a **PersistentVolume** (the disk), usually provisioned dynamically by a **StorageClass**. Stateful systems use a **StatefulSet** with `volumeClaimTemplates`. For databases in production, most banks prefer a managed service or an operator over hand-written StatefulSets.

## Security {#security}

- **RBAC**: Roles and ClusterRoles grant verbs on resources; RoleBindings attach them to users, groups and **ServiceAccounts**. Give each workload its own ServiceAccount with least privilege.
- Pod `securityContext`: `runAsNonRoot`, `readOnlyRootFilesystem`, drop capabilities, no privilege escalation; Pod Security Standards enforce this per namespace.
- **NetworkPolicy** for east-west restrictions, TLS or mutual TLS (service mesh) between services, image scanning and signed images, no secrets in Git.

## Troubleshooting {#troubleshooting}

| Status | Meaning | First checks |
| --- | --- | --- |
| `Pending` | not scheduled | `kubectl describe pod` events: insufficient CPU or memory, unbound PVC, taints, node selector |
| `ImagePullBackOff` / `ErrImagePull` | image cannot be pulled | wrong tag or name, missing registry credentials (`imagePullSecrets`) |
| `CrashLoopBackOff` | container keeps crashing and restarting | `kubectl logs <pod> --previous`, exit code, config, failing liveness probe |
| `OOMKilled` (exit 137) | exceeded memory limit | raise the limit, fix heap settings or a leak |
| `Running` but not `Ready` | readiness probe failing | probe path and port, dependencies, startup time |
| `Terminating` for long | not exiting on `SIGTERM` | shutdown handling, finalizers |

```bash
kubectl get pods -n bank -o wide
kubectl describe pod payments-7d9f-abcde -n bank      # events at the bottom
kubectl logs payments-7d9f-abcde -n bank --previous   # logs of the crashed container
kubectl exec -it payments-7d9f-abcde -n bank -- sh
kubectl rollout restart deployment/payments -n bank
kubectl top pods -n bank
kubectl port-forward svc/payments 8080:80 -n bank
```

## Cheat sheet {#cheatsheet}

| Need | Object or setting |
| --- | --- |
| run N copies, update without downtime | Deployment |
| stable name and disk per replica | StatefulSet |
| stable address for pods | Service (ClusterIP) |
| HTTP routing and TLS | Ingress |
| settings / credentials | ConfigMap / Secret |
| restart a stuck container | liveness probe |
| keep a pod out of traffic | readiness probe |
| slow start | startup probe |
| capacity and ceiling | requests and limits |
| scale on load | HPA |
| keep availability during drains | PodDisruptionBudget |

## Interview questions {#questions}

### [basic] What is Kubernetes and why use it? {#what-is-k8s}

An open-source container orchestrator. It schedules containers onto a cluster of machines and keeps the desired state: replicas running, restarts on failure, rolling updates and rollbacks, service discovery and load balancing, scaling, configuration and secret management. It lets you run many services reliably without managing individual servers.

### [basic] What is a Pod? {#pod}

The smallest deployable unit: one or more tightly coupled containers that share a network namespace (one IP, localhost between them) and volumes, and are scheduled together on one node. Pods are ephemeral: when they die they are replaced by new pods with new IPs.

### [basic] What is the difference between a Pod, a ReplicaSet and a Deployment? {#pod-rs-deployment}

A Pod runs containers. A ReplicaSet keeps a set number of identical pods alive. A Deployment manages ReplicaSets to provide declarative updates: rolling updates, rollbacks and history. You normally create Deployments, not ReplicaSets or bare Pods.

### [basic] What is a Service and which types are there? {#service-types}

A stable virtual IP and DNS name in front of a changing set of pods selected by labels, load-balancing across ready pods. Types: `ClusterIP` (internal), `NodePort`, `LoadBalancer` (external cloud load balancer), headless (no virtual IP, DNS returns pod IPs) and `ExternalName`.

### [basic] What is an Ingress? {#ingress-q}

An API object plus a controller (NGINX, Traefik, cloud load balancers) that routes external HTTP and HTTPS traffic to Services by host and path rules and terminates TLS. It avoids creating one load balancer per service.

### [basic] What is the difference between a ConfigMap and a Secret? {#configmap-vs-secret}

Both inject configuration. A ConfigMap holds non-sensitive settings; a Secret holds sensitive data and gets special handling (not shown in logs, can be encrypted at rest, tighter RBAC). A Secret is base64-encoded, **not encrypted by default**, so protect it with RBAC and encryption at rest or use an external secret manager.

### [basic] What are namespaces for? {#namespaces}

Logical partitions inside a cluster to separate teams, environments or applications, with their own resource quotas, RBAC rules and network policies. Names must be unique within a namespace, not across the cluster. They are not a strong security boundary on their own.

### [basic] What are liveness, readiness and startup probes? {#probes-q}

Health checks run by the kubelet. Liveness failure restarts the container; readiness failure removes the pod from Service endpoints without restarting; startup protects slow-starting apps by delaying the other probes until it succeeds. In Spring Boot they map to `/actuator/health/liveness` and `/readiness`.

### [basic] What are resource requests and limits? {#requests-limits}

Requests are the amount the scheduler reserves for the pod when choosing a node. Limits are the maximum the container may use: exceeding the CPU limit throttles it, exceeding the memory limit gets it OOMKilled. Pods without requests are scheduled blindly and are first to be evicted.

### [basic] How do you scale an application on Kubernetes? {#scaling}

Manually with `kubectl scale deployment payments --replicas=5`, automatically with a Horizontal Pod Autoscaler on CPU, memory or custom metrics (HPA needs resource requests and the metrics server), and by adding nodes with the cluster autoscaler. The application must be stateless or externalise state.

### [intermediate] Explain how a rolling update works and how to avoid downtime. {#rolling-q}

The Deployment creates a new ReplicaSet and gradually scales it up while scaling the old one down, controlled by `maxSurge` and `maxUnavailable`. New pods receive traffic only after their readiness probe passes, and old pods get `SIGTERM` and a grace period. To avoid downtime: correct readiness probes, `maxUnavailable: 0`, graceful shutdown, multiple replicas, a PodDisruptionBudget, and backward-compatible database changes.

### [intermediate] What is the difference between liveness and readiness, and what goes wrong if you mix them up? {#liveness-vs-readiness}

Liveness asks "should this container be restarted?"; readiness asks "should it receive traffic?". If liveness checks a database or another service, an outage restarts every pod at once and makes things worse. If readiness is missing, pods get traffic before they are ready, causing errors during startup and deploys. Put dependency checks in readiness, keep liveness simple.

### [intermediate] A pod is in CrashLoopBackOff. How do you debug it? {#crashloop}

`kubectl describe pod` (events, last state, exit code), `kubectl logs <pod> --previous` for the crashed instance's output, then check: the application error, missing or wrong config and secrets, a failing liveness probe or too-short startup time, OOMKilled (exit 137), a wrong command or image. Reproduce locally with the same image and environment. The back-off delay grows up to five minutes between restarts.

### [intermediate] What is the difference between CPU and memory limits when exceeded? {#cpu-vs-memory-limit}

CPU is compressible: a container above its limit is **throttled** (slower, latency spikes) but keeps running. Memory is not: a container above its limit is **OOMKilled** and restarted. Many teams set a memory limit equal to the request and no CPU limit to avoid throttling, while still setting a CPU request.

### [intermediate] How do you configure a Spring Boot app on Kubernetes? {#spring-config}

Package one image, inject settings through ConfigMaps and Secrets as environment variables (relaxed binding maps `SPRING_DATASOURCE_URL` to `spring.datasource.url`) or mounted `application.yaml`, use profiles for environments, and optionally Spring Cloud Kubernetes to reload config. Credentials come from Secrets or an external vault, never from the image.

### [intermediate] What is the difference between a Deployment and a StatefulSet? {#deployment-vs-statefulset}

Deployment pods are interchangeable and have random names; they suit stateless services. StatefulSet pods have stable, ordered identities (`db-0`, `db-1`), stable DNS names and their own persistent volume, and start and stop in order, which suits databases and brokers. StatefulSets are harder to operate, so use managed services or operators where possible.

### [intermediate] How does service discovery work in Kubernetes? {#discovery}

Each Service gets a cluster DNS name resolved by CoreDNS (`payments.bank.svc.cluster.local`). The Service's endpoints are the ready pods matching its selector, kept current by the control plane, and kube-proxy routes traffic to them. Clients just call the DNS name, so an external registry like Eureka is usually unnecessary.

### [intermediate] What is a PodDisruptionBudget? {#pdb}

A policy limiting how many pods of an application may be voluntarily taken down at once (node drain, cluster upgrade), for example `minAvailable: 2`. It does not protect against involuntary failures such as a node crash.

### [intermediate] How do you handle graceful shutdown of a Spring Boot pod? {#graceful-shutdown}

Kubernetes removes the pod from endpoints and sends `SIGTERM` concurrently. Set `server.shutdown=graceful` so Spring stops accepting new requests and finishes in-flight ones within `spring.lifecycle.timeout-per-shutdown-phase`; add a `preStop` sleep (a few seconds) so traffic stops arriving first; and set `terminationGracePeriodSeconds` larger than both. Make sure the JVM is PID 1 (exec-form entrypoint).

### [deep] Describe what happens when you run kubectl apply -f deployment.yaml. {#apply-flow}

`kubectl` sends the manifest to the API server, which authenticates, authorises (RBAC), validates and stores it in etcd. The Deployment controller sees the new object and creates a ReplicaSet; the ReplicaSet controller creates Pod objects; the scheduler assigns each Pod to a node; the kubelet on that node tells the container runtime to pull the image and start the containers and runs the probes; endpoints are updated once pods are Ready. All components watch the API server and reconcile.

### [deep] What is a controller and the reconciliation loop? {#reconciliation}

A controller watches objects through the API server, compares the desired state in `spec` with the observed state in `status`, and takes actions to converge them, over and over. This is how self-healing works: a deleted pod is noticed by the ReplicaSet controller and recreated. Operators extend the idea with custom resources for specific software.

### [deep] How does the scheduler decide where a pod runs? {#scheduler}

It filters out nodes that cannot host the pod (insufficient requested resources, node selectors and affinity, taints without tolerations, volume zone constraints) and scores the rest (spreading, resource balance, affinity preferences), then binds the pod to the best node. Taints and tolerations repel pods from nodes, affinity attracts them, topology spread constraints distribute them across zones.

### [deep] How do you secure a Kubernetes cluster and workloads? {#k8s-security}

Least-privilege RBAC and per-workload ServiceAccounts, no `cluster-admin` for apps, Pod Security Standards (non-root, read-only file system, dropped capabilities), NetworkPolicies, secrets in an external manager with etcd encryption, image scanning and signing from trusted registries, private API endpoint, audit logging, and regular patching.

### [deep] What are the trade-offs of Kubernetes versus simpler options? {#k8s-tradeoffs}

Kubernetes gives self-healing, scaling, standard deployment and a huge ecosystem, but has high operational and learning cost, many moving parts and YAML. For a few services a managed container platform, ECS or a PaaS may be simpler. In a bank, a platform team usually runs the cluster and application teams own manifests and Helm charts.

### [coding] Write the probes and resources for a Spring Boot Deployment. {#coding-probes}

```yaml
resources:
  requests: { cpu: 500m, memory: 768Mi }
  limits:   { memory: 768Mi }
startupProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  periodSeconds: 2
  failureThreshold: 30            # up to 60 s to start
livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 8080 }
  periodSeconds: 5
```

With `management.endpoint.health.probes.enabled=true`, `server.shutdown=graceful` and `-XX:MaxRAMPercentage=75`. Memory request equals limit so the pod is Guaranteed for memory; liveness has no dependency checks.

### [coding] Write an HPA that scales payments between 3 and 10 replicas at 70% CPU. {#coding-hpa}

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: payments
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payments
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
```

Utilisation is measured against the CPU **request**, so the Deployment must set one.

### [coding] Expose the payments service outside the cluster over HTTPS. {#coding-ingress}

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payments
spec:
  tls:
    - hosts: [api.bank.example]
      secretName: api-tls
  rules:
    - host: api.bank.example
      http:
        paths:
          - path: /payments
            pathType: Prefix
            backend:
              service: { name: payments, port: { number: 80 } }
```

An ingress controller must be installed; the TLS certificate comes from the `api-tls` Secret (often managed by cert-manager).
