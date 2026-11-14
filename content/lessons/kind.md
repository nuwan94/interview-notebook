---
title: kind — Kubernetes in Docker for local clusters and CI
nav: kind (Kubernetes in Docker)
slug: kind
summary: What kind is and how it runs Kubernetes nodes as Docker containers: creating single and multi-node clusters, config files, loading images, ingress and port mappings, a local registry, using it in CI, limits, and how it compares with minikube, k3d and Docker Desktop, with YAML examples and interview questions.
tags: [kind, Kubernetes, Docker, Local development, CI, Testing]
order: 36
topic: Containers / Local Kubernetes
updated: 2026-11-14
subnav: true
---

You should test a Deployment, a Helm chart or a rollout on a real Kubernetes API before it reaches a shared cluster, but nobody wants a cloud cluster for every pull request. **kind** (*Kubernetes IN Docker*) creates a real, conformant Kubernetes cluster in seconds on any machine that has Docker, by running each node as a container. Interviews ask *what is kind, how is it different from minikube, how do you get your own image into it, how do you reach a service, and what is it not good for?* This lesson assumes [Docker](lesson:docker) and [Kubernetes](lesson:kubernetes); its sibling is [minikube](lesson:minikube). Play the three scenes: the cluster of containers, images and access, and testing in CI.

```demo
name: kind-walk
```

> **One sentence to remember:** *kind runs each Kubernetes node as a Docker container, so a whole multi-node cluster is created and thrown away in about a minute with one command: ideal for CI and for testing manifests and operators, but not a production platform.*

## What kind is {#what}

kind was created by the Kubernetes project (a SIG Testing tool) to test Kubernetes itself. It runs a real kubeadm-bootstrapped cluster, so the API server, scheduler, etcd and kubelet are the genuine components, and conformance tests pass. It needs only **Docker** (or Podman, experimentally) and the single `kind` binary.

![kind architecture: a node container running systemd, containerd and the Kubernetes components inside Docker](images/kind-diagram.png "Each kind node is a container running systemd, a container runtime and the Kubernetes components. The diagram is older: the default network plugin today is kindnet rather than Weave. | Kubernetes SIGs, kind documentation, Apache-2.0 | https://github.com/kubernetes-sigs/kind")

| Part | What it does |
| --- | --- |
| **Node image** (`kindest/node:vX.Y.Z`) | contains systemd, containerd and the Kubernetes binaries for one version |
| **Node container** | one Docker container per Kubernetes node (control plane or worker) |
| **kubeadm** | bootstraps the control plane inside the node container |
| **kindnet** | the default CNI (pod networking) |
| **local-path provisioner** | the default `standard` StorageClass, which stores volumes on the node |
| **kubeconfig context** | `kind-<cluster-name>`, written for you |

Nodes are containers, so creating a cluster is pulling one image and starting a few containers; there is no virtual machine to boot, which is why kind is faster and lighter than VM-based tools.

## Basic commands {#commands}

```bash
kind create cluster                               # cluster "kind", context kind-kind
kind create cluster --name dev --image kindest/node:v1.31.0
kind get clusters
kubectl cluster-info --context kind-dev
kind load docker-image bank/payments:dev --name dev   # copy a local image into every node
kind export logs ./logs --name dev                # collect logs for debugging
kind delete cluster --name dev
```

Pin the node image to the Kubernetes version you run in production (`kindest/node:v1.31.x`), so you test against the same API.

## Multi-node and configuration {#config}

A config file defines the topology, port mappings and patches:

```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: dev
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:                  # host ports forwarded to the node container
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
  - role: worker
  - role: worker
```

```bash
kind create cluster --config kind-config.yaml
```

- Several `control-plane` nodes create a **high-availability** control plane, and kind adds a small load balancer container in front.
- Workers let you test scheduling, **topology spread**, **affinity**, taints, `PodDisruptionBudget`s and rolling updates across nodes. See [Kubernetes](lesson:kubernetes).
- `containerdConfigPatches` configure registries; `kubeadmConfigPatches` change cluster settings; `featureGates` enable alpha features for testing.

## Getting your image into the cluster {#images}

The nodes have their **own container runtime** (containerd inside each node container), so images in your host Docker are not visible. Options:

| Option | How | Notes |
| --- | --- | --- |
| **Load** | `kind load docker-image app:dev` | copies the image into every node; simple, repeat after each build |
| **Local registry** | run a `registry:2` container on the `kind` network and push to `localhost:5001/app` | scales to many images; needs a containerd patch |
| **Public or private registry** | normal pull | needs network access and credentials (image pull secrets) |

Use an explicit tag (`app:dev`, or a version), not `latest`. With `latest` Kubernetes defaults to `imagePullPolicy: Always` and tries to pull from a registry; with a fixed tag the default is `IfNotPresent`, which uses the loaded image. A Pod stuck in `ErrImagePull` or `ImagePullBackOff` for a locally built image almost always means the image was not loaded or the policy forces a pull.

```yaml
containers:
  - name: payments
    image: bank/payments:dev
    imagePullPolicy: IfNotPresent
```

## Reaching your applications {#access}

kind does not publish node ports to your machine by default. Choose a way:

1. **`kubectl port-forward svc/payments 8080:80`**: simplest, for a single service.
2. **Ingress with `extraPortMappings`**: create the cluster as above, then install an ingress controller (ingress-nginx has a kind-specific manifest) and use `Ingress` rules with hostnames such as `payments.localtest.me` (a public DNS name that resolves to 127.0.0.1) or entries in your hosts file.
3. **NodePort** with an `extraPortMappings` entry for that port.
4. **LoadBalancer**: Services stay `Pending` because there is no cloud. Install **MetalLB** or the official **cloud-provider-kind**, which assigns addresses and forwards traffic.

## Storage and networking {#storage}

- Volumes use the `standard` StorageClass (local-path): a `PersistentVolumeClaim` is bound to a directory on the node that scheduled the Pod, so data is lost when the cluster is deleted, and a Pod that moves nodes does not take its data along.
- Pods get addresses from the pod subnet and Services from the service subnet via **kindnet**. For network policy testing, create the cluster with the default CNI disabled and install Calico or Cilium.
- Because the nodes are containers on a Docker network, Pods can reach the internet through your host's connection, and reach other Docker containers on the `kind` network by IP.

## kind in CI {#ci}

kind is the standard choice for Kubernetes tests in CI because clusters are fast, disposable and need only Docker, which hosted runners provide.

```yaml
# .github/workflows/e2e.yaml
name: e2e
on: [pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: helm/kind-action@v1
        with:
          version: v0.24.0
          node_image: kindest/node:v1.31.0
      - run: docker build -t bank/payments:ci .
      - run: kind load docker-image bank/payments:ci
      - run: helm install payments ./chart --set image.tag=ci --wait --timeout 3m
      - run: ./scripts/smoke-test.sh
```

A typical pipeline: create the cluster, load the image built in the same job, install the chart or manifests, wait for readiness, run end-to-end tests, and let the runner discard everything. Use `kind export logs` as a failure artefact. This tests the **Kubernetes manifests and Helm chart**, which unit tests and Testcontainers do not.

## What kind is not {#limits}

- **Not for production**: single host, no real high availability, no cloud integrations, local-path storage.
- **Resource-bound**: every node is a container using your CPU and memory; many nodes on a laptop are slow. Performance numbers from kind are not meaningful.
- **No cloud features**: no cloud load balancers, cloud storage classes or IAM; you substitute with MetalLB, local storage and test doubles.
- **Docker dependency**: Docker Desktop settings (memory, file sharing) affect it; rootless Docker and Podman have extra requirements.
- Version `0.x` software: pin the version in CI.

## kind, minikube and other local options {#compare}

| Tool | How it runs | Strengths | Weaknesses |
| --- | --- | --- | --- |
| **kind** | nodes as Docker containers | fast, multi-node, CI friendly, tests Kubernetes itself | no addons catalogue, you wire ingress and LoadBalancer yourself |
| **[minikube](lesson:minikube)** | a VM or container via drivers | rich addons, dashboard, tunnel, many drivers, good for learning | slower, heavier; multi-node works but less CI oriented |
| **k3d** | k3s (lightweight Kubernetes) in Docker | very fast and small, built-in registry support | k3s differs from upstream in some components |
| **Docker Desktop Kubernetes** | single-node cluster built into Docker Desktop | zero setup | one node, fixed version, tied to the desktop app |
| **MicroK8s, k3s** | packaged lightweight distributions | also run on edge and servers | not primarily test-cluster tools |

Rule of thumb: **kind for CI and for testing cluster behaviour (multi-node, rollouts, operators)**, **minikube for a friendly learning and development cluster with addons**.

## kind in a Spring Boot workflow {#spring}

1. Build the image (`./mvnw spring-boot:build-image` or a Dockerfile; see [Docker](lesson:docker)).
2. `kind load docker-image bank/payments:dev`.
3. Apply the Deployment, Service and ConfigMap (see the YAML in the [Kubernetes lesson](lesson:kubernetes#yaml)), with readiness and liveness probes pointing at the Actuator health groups ([observability](lesson:spring-observability)).
4. `kubectl port-forward` or an Ingress to call it; `kubectl rollout restart` after each new image.
5. Use more nodes and `kubectl drain` to see how your service survives a node loss and how a `PodDisruptionBudget` behaves.

## Cheat sheet {#cheatsheet}

| Need | Do |
| --- | --- |
| create a cluster | `kind create cluster --name dev` |
| match the production version | `--image kindest/node:v1.31.x` |
| multiple nodes or port mappings | `--config kind-config.yaml` |
| use a locally built image | `kind load docker-image app:dev` (fixed tag, `IfNotPresent`) |
| reach a service | `kubectl port-forward`, or Ingress with `extraPortMappings` |
| `LoadBalancer` stays pending | install MetalLB or cloud-provider-kind |
| debug a failing cluster | `kind export logs`, `docker ps`, `docker logs <node>` |
| clean up | `kind delete cluster --name dev` |
| run in CI | `helm/kind-action`, then load the image, deploy and test |

## Interview questions {#questions}

### [basic] What is kind and how does it work? {#what-q}

kind (Kubernetes IN Docker) creates a real Kubernetes cluster by running each node as a Docker container. The node image contains systemd, containerd and the Kubernetes binaries; kubeadm bootstraps the control plane inside it. It needs only Docker, starts in under a minute and was designed for testing Kubernetes and for CI.

### [basic] What are the typical uses of kind? {#uses-q}

Testing manifests, Helm charts, operators and controllers against a real API; running end-to-end tests in CI with a fresh cluster per run; trying Kubernetes features such as multi-node scheduling, rollouts and disruption budgets locally; and reproducing issues on a specific Kubernetes version.

### [basic] How do you create a multi-node kind cluster? {#multinode-q}

Write a config file with the node roles (`control-plane` and several `worker` entries, optionally several control planes for HA) and run `kind create cluster --config kind-config.yaml`. Each node becomes a container named `<cluster>-control-plane`, `<cluster>-worker`, and so on.

### [basic] How do you use a locally built image in kind? {#load-q}

The nodes do not share your host's Docker images, so run `kind load docker-image name:tag` to copy the image into every node (or push to a local registry connected to the kind network). Use a specific tag and `imagePullPolicy: IfNotPresent`; with `latest` Kubernetes tries to pull from a registry and the Pod fails with `ErrImagePull`.

### [intermediate] How do you access a service running in kind from your browser? {#access-q}

For a quick check use `kubectl port-forward`. For ingress-like access create the cluster with `extraPortMappings` for ports 80 and 443 on a node labelled `ingress-ready=true`, install ingress-nginx and use Ingress rules with local hostnames. NodePort services also work through a port mapping. LoadBalancer services need MetalLB or cloud-provider-kind.

### [intermediate] Why does a LoadBalancer Service stay in Pending on kind? {#lb-q}

LoadBalancer Services are fulfilled by a cloud controller that creates an external load balancer, and kind has none. Install MetalLB (give it an address range from the Docker network) or run cloud-provider-kind, which assigns external IPs and forwards traffic from your host.

### [intermediate] What is the difference between kind and minikube? {#vs-minikube-q}

kind runs nodes as containers (Docker only), is very fast, supports multi-node and HA easily and is built for tests and CI, but gives you a bare cluster. minikube runs the cluster in a VM or container through drivers and bundles addons (ingress, dashboard, metrics-server, registry, tunnel) with a friendlier developer experience, at a higher resource cost. Both run real Kubernetes.

### [intermediate] How would you use kind in a CI pipeline? {#ci-q}

Start a cluster with a CI action (for example `helm/kind-action`) pinned to the production Kubernetes version, build the image in the job and `kind load` it, install the Helm chart or manifests and wait for readiness, run smoke and end-to-end tests, export logs on failure, and let the runner discard the cluster. It validates manifests, probes, configuration and rollouts that unit tests cannot.

### [intermediate] How does persistent storage behave in kind? {#storage-q}

The default StorageClass uses a local-path provisioner that creates a directory on the node where the Pod is scheduled. Data persists across Pod restarts on that node, but is lost when the cluster is deleted, and a Pod rescheduled to another node does not find its data. It is enough to test PVC usage and StatefulSets, not storage failover.

### [intermediate] What are the limitations of kind? {#limits-q}

It is not a production platform: single host, no cloud load balancers or storage, results depend on your machine's resources, and the project is still version 0.x. Network policies need a CNI that enforces them. For performance or multi-region behaviour you need a real cluster.

### [deep] How would you test a node failure and a PodDisruptionBudget with kind? {#drain-q}

Create a cluster with several workers and a Deployment with replicas spread by `topologySpreadConstraints`, plus a `PodDisruptionBudget` with `minAvailable: 2`. Run `kubectl drain kind-worker --ignore-daemonsets --delete-emptydir-data` and watch evictions respect the budget and Pods reschedule on other nodes; `docker stop kind-worker` simulates an abrupt node loss and shows how long Kubernetes takes to mark the node `NotReady` and replace Pods.

### [deep] Why does the kind node image version matter? {#node-image-q}

The node image fixes the Kubernetes version (and the containerd version) of the cluster. Testing on a different minor version than production can hide removed APIs or changed defaults. Pin `kindest/node:vX.Y.Z` to production's version, and test upgrades by running two clusters of different versions.

### [coding] Write a kind config with one control plane, two workers and ports 80 and 443 published. {#coding-config}

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - { containerPort: 80, hostPort: 80, protocol: TCP }
      - { containerPort: 443, hostPort: 443, protocol: TCP }
  - role: worker
  - role: worker
```

Explain that the control plane is labelled so an ingress controller can run there, the port mappings forward host ports 80 and 443 to it, and the two workers allow scheduling and drain experiments.

### [coding] Deploy a locally built Spring Boot image to kind and call it. {#coding-deploy}

```bash
docker build -t bank/payments:dev .
kind load docker-image bank/payments:dev --name dev
kubectl create deployment payments --image=bank/payments:dev --port=8080
kubectl set image deployment/payments payments=bank/payments:dev    # (re)use the loaded image
kubectl patch deployment payments -p '{"spec":{"template":{"spec":{"containers":[{"name":"payments","imagePullPolicy":"IfNotPresent"}]}}}}'
kubectl expose deployment payments --port=80 --target-port=8080
kubectl port-forward svc/payments 8080:80 &
curl http://localhost:8080/actuator/health
```

Explain that `kind load` makes the image available to the nodes, the fixed tag plus `IfNotPresent` prevents a registry pull, and `port-forward` provides access without an ingress.
