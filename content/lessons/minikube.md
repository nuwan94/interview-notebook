---
title: minikube — a local Kubernetes cluster with drivers, addons and tunnels
nav: minikube
slug: minikube
summary: What minikube is and how it runs a local Kubernetes cluster: drivers, profiles and multi-node, reaching services (NodePort, tunnel, ingress), getting images in, addons, mounting files, resource tuning, troubleshooting, and how it compares with kind and Docker Desktop, with commands, YAML and interview questions.
tags: [minikube, Kubernetes, Local development, Addons, Ingress, Drivers]
order: 33
topic: Containers / Local Kubernetes
updated: 2026-11-14
subnav: true
---

To learn Kubernetes or to develop a service against it you want a cluster on your own laptop that you can break and recreate. **minikube** is the longest-standing tool for that: one command creates a local cluster, and a catalogue of **addons** adds ingress, a dashboard, metrics and a registry. Interviews ask *what is minikube, what is a driver, how do you reach a service when there is no cloud load balancer, how do you use a locally built image, and how does it differ from kind?* This lesson builds on [Kubernetes](lesson:kubernetes) and [Docker](lesson:docker), and is the companion of [kind](lesson:kind). Play the three scenes: starting a cluster, reaching applications, and images and addons.

```demo
name: minikube-walk
```

> **One sentence to remember:** *minikube runs a single-node (or small multi-node) Kubernetes cluster on your machine through a driver (Docker, a VM) and adds developer conveniences, addons, tunnels and a dashboard, so you can learn and develop against real Kubernetes without a cloud account.*

## What minikube is {#what}

minikube is a Kubernetes SIG project that creates a local, conformant cluster. By default it creates **one node that runs both the control plane and your workloads**, which is enough for development; it can also create several nodes.

| Part | What it does |
| --- | --- |
| **Driver** | provides the machine the node runs on: container (`docker`, `podman`) or VM (`hyperv`, `kvm2`, `qemu`, `virtualbox`, `vmware`) |
| **Runtime** | the container runtime in the node: containerd (default), CRI-O or Docker |
| **Profile** | a named cluster; you can have many (`-p dev`, `-p test`) |
| **Addons** | optional, bundled components installed with one command |
| **kubeconfig context** | `minikube` (or the profile name), set automatically |

The **driver** choice matters. The **Docker driver** is the quickest and most common: the node is a container, like kind. A **VM driver** gives stronger isolation and a real kernel but needs more memory and a hypervisor. On Linux there is also a `none` driver that runs Kubernetes directly on the host (for CI machines or dedicated boxes), which changes the host system and needs care.

## Basic commands {#commands}

```bash
minikube start                                     # create or resume the default cluster
minikube start -p dev --driver=docker --cpus=4 --memory=8g --kubernetes-version=v1.31.0
minikube start --nodes=3 -p multi                  # a three-node cluster
minikube status
minikube profile list
minikube kubectl -- get pods -A                    # bundled kubectl of the matching version
minikube stop                                      # stop, keep the cluster state
minikube delete -p dev                             # remove the cluster
minikube delete --all
```

Set sensible resources: Kubernetes plus a JVM application and a database needs several GB of memory. Pin `--kubernetes-version` to the version you run in production so manifests are tested against the same API. `minikube config set driver docker` makes a driver the default.

## Reaching your applications {#access}

There is no cloud load balancer and the node is behind the driver, so minikube supplies helpers:

| Need | How |
| --- | --- |
| **NodePort service** | `minikube service payments --url` prints a reachable URL (with the Docker driver on macOS and Windows it opens a tunnel, and the terminal must stay open); `minikube ip` gives the node address when it is directly reachable |
| **LoadBalancer service** | run `minikube tunnel` in a separate terminal: it assigns an `EXTERNAL-IP` and forwards traffic (it needs administrator rights for low ports and routes) |
| **Ingress** | `minikube addons enable ingress` installs ingress-nginx; use `Ingress` rules and map the host name to the cluster address in your hosts file, or use the `ingress-dns` addon |
| **Quick test** | `kubectl port-forward svc/payments 8080:80` |
| **Web UI** | `minikube dashboard` opens the Kubernetes Dashboard (the `dashboard` addon) |

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payments
spec:
  rules:
    - host: payments.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: payments
                port:
                  number: 80
```

## Getting your image into the cluster {#images}

The node has its own container runtime, so an image built on your host is not visible. Three ways:

1. **`minikube image load bank/payments:dev`**: copies an image from your local Docker into the cluster.
2. **`eval $(minikube docker-env)`** (PowerShell: `& minikube -p minikube docker-env --shell powershell | Invoke-Expression`): points your `docker` CLI at the Docker daemon inside the node, so `docker build` produces the image directly in the cluster. This works when the node's runtime is Docker.
3. **`minikube image build -t bank/payments:dev .`**: builds inside the cluster without touching your host Docker.
4. The **registry addon** (`minikube addons enable registry`) runs a registry you can push to (`localhost:5000`).

As with [kind](lesson:kind#images), use a **fixed tag** and `imagePullPolicy: IfNotPresent` (or `Never`), otherwise Kubernetes tries to pull from a remote registry and the Pod ends in `ErrImagePull`.

## Addons {#addons}

```bash
minikube addons list
minikube addons enable metrics-server     # kubectl top, HorizontalPodAutoscaler
minikube addons enable ingress            # ingress-nginx
minikube addons enable dashboard
minikube addons enable registry
```

| Addon | Gives you |
| --- | --- |
| `metrics-server` | resource metrics for `kubectl top` and the [HPA](lesson:kubernetes#resources) |
| `ingress`, `ingress-dns` | an ingress controller and local DNS for ingress hosts |
| `dashboard` | the Kubernetes web UI |
| `registry` | an in-cluster image registry |
| `storage-provisioner`, `default-storageclass` | dynamic volumes (enabled by default) |
| `csi-hostpath-driver`, `volumesnapshots` | CSI storage and snapshots for testing |

This catalogue is the main reason people pick minikube for learning: features that you would assemble by hand in a bare cluster are one command away.

## Storage, files and profiles {#storage}

- The default `standard` StorageClass provisions volumes in a directory on the node (hostPath), so a `PersistentVolumeClaim` works but data lives only as long as the cluster.
- `minikube mount ./config:/mnt/config` shares a host folder into the node, which a Pod can then mount through a `hostPath` volume. It is handy for source code or test data.
- `minikube ssh` opens a shell in the node for inspection (`crictl ps`, logs).
- **Profiles** let you keep a "stable" and a "next version" cluster and switch with `kubectl config use-context` or `minikube profile`.

## Multi-node and advanced options {#advanced}

- `--nodes=3` creates a control-plane node and two workers (with the Docker or VM drivers), enough to try scheduling, anti-affinity and drains.
- `--cni=calico` (or `cilium`, `flannel`) chooses a network plugin; Calico or Cilium are needed to try **NetworkPolicy** enforcement.
- `--container-runtime=containerd|cri-o|docker` selects the runtime.
- `--extra-config` passes flags to the kubelet, API server and others, and `--feature-gates` turns on features.
- Tune CPU and memory (`--cpus`, `--memory`) and disk (`--disk-size`) per profile.

## Troubleshooting {#troubleshooting}

| Symptom | Likely cause and fix |
| --- | --- |
| start fails with a driver or virtualisation error | Docker is not running, virtualisation is disabled in firmware, or another hypervisor conflicts; check `minikube start --alsologtostderr` and try another driver |
| Pods `Pending` | not enough CPU or memory: raise `--cpus` and `--memory`, or check `kubectl describe pod` |
| `ErrImagePull` for your image | the image was not loaded into the cluster, or the pull policy forces a pull |
| LoadBalancer `EXTERNAL-IP` pending | `minikube tunnel` is not running |
| URL from `minikube service` stops working | the tunnel terminal was closed (Docker driver on macOS and Windows) |
| ingress host does not resolve | add the host name to your hosts file with the address, or use `ingress-dns` |
| strange state after upgrades | `minikube delete` and start again; clusters are disposable |
| slow cluster | too few resources, or an antivirus scanning the VM or Docker disk |

`minikube logs` collects cluster logs, `minikube status` shows component state, and `kubectl get events -A` shows what Kubernetes itself is reporting.

## minikube vs kind vs Docker Desktop {#compare}

| Aspect | minikube | [kind](lesson:kind) | Docker Desktop Kubernetes |
| --- | --- | --- | --- |
| Runs as | VM or container (driver) | Docker containers | built into Docker Desktop |
| Startup | tens of seconds to minutes | about a minute, very light | with Docker Desktop |
| Multi-node | yes | yes, easy | no (one node) |
| Addons | rich catalogue | none, you install | none |
| LoadBalancer | `minikube tunnel` | MetalLB or cloud-provider-kind | built in (maps to localhost) |
| Best for | learning, developer environment, demos | CI and testing cluster behaviour | quick start with no extra tool |
| Production-like? | no | no | no |

All three are real Kubernetes and none is for production. Choose by the job: minikube for a comfortable learning and development cluster, kind for CI and disposable test clusters.

## minikube in a Spring Boot workflow {#spring}

1. `minikube start -p dev --cpus=4 --memory=8g --kubernetes-version=<prod version>`.
2. `minikube addons enable ingress metrics-server`.
3. Build the image into the cluster: `minikube image build -t bank/payments:dev .` (or `image load` after a normal `docker build`).
4. Apply the Deployment, Service, ConfigMap and Ingress, with probes on the Actuator health groups ([Kubernetes](lesson:kubernetes#yaml), [observability](lesson:spring-observability)).
5. Reach it with `minikube service payments --url` or the ingress host; watch `kubectl top pods` and try a `HorizontalPodAutoscaler`.
6. For dependencies (PostgreSQL, Kafka, Redis) install Helm charts or operators in the same cluster, or run them in [Docker Compose](lesson:docker-compose) outside it and point the Service at `host.minikube.internal`, the name that resolves to your host from inside the cluster.

## Cheat sheet {#cheatsheet}

| Need | Do |
| --- | --- |
| create or resume a cluster | `minikube start` |
| size and version | `--cpus --memory --kubernetes-version` |
| several clusters | `-p <profile>` |
| multi-node | `--nodes=3` |
| reach a NodePort service | `minikube service <name> --url` |
| reach a LoadBalancer service | `minikube tunnel` |
| ingress | `minikube addons enable ingress` |
| use a local image | `minikube image load`, `minikube image build`, or `docker-env` |
| metrics and autoscaling | `minikube addons enable metrics-server` |
| open the UI | `minikube dashboard` |
| shell into the node | `minikube ssh` |
| reach the host from a Pod | `host.minikube.internal` |
| reset | `minikube delete` |

## Interview questions {#questions}

### [basic] What is minikube? {#what-q}

A tool that runs a local Kubernetes cluster for learning and development. One command (`minikube start`) creates a single-node cluster (control plane and worker together) on your machine using a driver such as Docker or a virtual machine, sets up kubectl, and offers addons like ingress, a dashboard and metrics. It is not for production.

### [basic] What is a minikube driver? {#driver-q}

The driver provides the machine that hosts the Kubernetes node: a container (`docker`, `podman`) or a virtual machine (`hyperv`, `kvm2`, `qemu`, `virtualbox`, `vmware`), or the host itself (`none`, on Linux). It determines start-up time, resource use, isolation and which networking features work. Docker is the usual default because it is fast and needs no hypervisor.

### [basic] What is a minikube profile? {#profile-q}

A named cluster. `minikube start -p dev` creates a cluster `dev` independent of the default one, with its own driver, size and Kubernetes version. Profiles let you test an upgrade against an older version or keep a separate cluster per project, and each gets its own kubectl context.

### [basic] What are minikube addons? {#addons-q}

Bundled, optional components enabled with `minikube addons enable <name>`: ingress (ingress-nginx), metrics-server, dashboard, registry, ingress-dns, storage provisioners and more. They save the manual installation you would do in a bare cluster, which is why minikube is popular for learning.

### [intermediate] How do you access a service from your machine in minikube? {#access-q}

For a NodePort service use `minikube service <name> --url`, which prints (and with some drivers tunnels) a working URL. For a LoadBalancer service run `minikube tunnel` so it gets an external IP. For host-based routing enable the ingress addon and map the host name to the cluster address. For a quick look use `kubectl port-forward`.

### [intermediate] Why is my LoadBalancer Service stuck in Pending on minikube and how do you fix it? {#lb-q}

There is no cloud provider to create a load balancer, so `EXTERNAL-IP` stays `<pending>`. Run `minikube tunnel` in a separate terminal (with the rights it asks for): it allocates an address on your machine and routes traffic to the service, imitating a cloud load balancer. Stop the tunnel and the address stops working.

### [intermediate] How do you use a locally built image in minikube? {#image-q}

The cluster has its own runtime, so the image must be put there: `minikube image load name:tag` copies it from your Docker, `minikube image build` builds inside the cluster, and `eval $(minikube docker-env)` points your docker CLI at the node's daemon so builds land there. Use a fixed tag and `imagePullPolicy: IfNotPresent` or `Never`; with `latest` Kubernetes tries to pull and fails.

### [intermediate] How does minikube compare with kind? {#vs-kind-q}

Both create real local clusters. kind runs nodes as Docker containers, is faster and lighter, handles multi-node and HA easily and is built for CI, but is a bare cluster. minikube uses drivers (VM or container), bundles addons, a dashboard and tunnels, and suits learning and day-to-day development; it uses more resources. Choose kind for pipelines and cluster-behaviour tests, minikube for an all-in-one developer cluster.

### [intermediate] Can you run a multi-node cluster in minikube? {#multinode-q}

Yes: `minikube start --nodes=3` creates a control plane node and workers. It lets you try scheduling, affinity, taints and node drains. Each node uses resources from your machine, so size `--cpus` and `--memory` accordingly. For many nodes or CI, kind is usually lighter.

### [intermediate] How do you test a HorizontalPodAutoscaler in minikube? {#hpa-q}

Enable the metrics-server addon (`minikube addons enable metrics-server`), define CPU requests on the Deployment (the HPA calculates utilisation against requests), create an HPA, then generate load with a `busybox` or `hey` pod and watch `kubectl get hpa -w` and `kubectl top pods`. Without metrics-server or without requests the HPA shows `<unknown>`.

### [deep] How can a Pod in minikube reach a service running on your laptop? {#host-q}

Use `host.minikube.internal`, a name minikube adds inside the node that resolves to the host's address. A Spring Boot Pod can then use `jdbc:postgresql://host.minikube.internal:5432/bank` for a database that runs on your machine or in [Docker Compose](lesson:docker-compose). The host must listen on an address reachable from the node, not only on `127.0.0.1`.

### [deep] When would you use the none driver and what are the risks? {#none-q}

On a Linux machine (often a CI worker or a dedicated test server) the `none` driver installs and runs Kubernetes components directly on the host without a VM or container, giving the best performance and no nesting. The risks are that it modifies the host (packages, iptables, services), needs root, offers no isolation and is harder to clean up, so it should be used only on disposable machines.

### [coding] Start a cluster, enable ingress and deploy a Spring Boot image. {#coding-start}

```bash
minikube start -p dev --cpus=4 --memory=8g --kubernetes-version=v1.31.0
minikube -p dev addons enable ingress
minikube -p dev addons enable metrics-server

minikube -p dev image build -t bank/payments:dev .
kubectl create deployment payments --image=bank/payments:dev --port=8080
kubectl patch deployment payments -p '{"spec":{"template":{"spec":{"containers":[{"name":"payments","imagePullPolicy":"IfNotPresent"}]}}}}'
kubectl expose deployment payments --port=80 --target-port=8080
kubectl apply -f ingress.yaml          # host: payments.local
minikube -p dev tunnel                 # in a separate terminal if you use a LoadBalancer or low ports
```

Explain that the profile isolates this cluster, the image is built inside it so no registry is needed, `IfNotPresent` avoids a pull, and ingress lets you use a host name.

### [coding] Write a Deployment that runs a local image with probes and a memory limit. {#coding-deployment}

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments
spec:
  replicas: 2
  selector:
    matchLabels: { app: payments }
  template:
    metadata:
      labels: { app: payments }
    spec:
      containers:
        - name: payments
          image: bank/payments:dev
          imagePullPolicy: IfNotPresent
          ports: [{ containerPort: 8080 }]
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: 8080 }
          livenessProbe:
            httpGet: { path: /actuator/health/liveness, port: 8080 }
          resources:
            requests: { cpu: 250m, memory: 512Mi }
            limits: { memory: 512Mi }
```

Explain that `IfNotPresent` uses the image already in the cluster, the Actuator probes control traffic and restarts, and the CPU request is what makes a HorizontalPodAutoscaler work.
