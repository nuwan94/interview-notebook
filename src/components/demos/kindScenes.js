// Frame data for the kind (Kubernetes IN Docker) walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const KIND_SCENES = [
  {
    id: 'cluster',
    label: 'A cluster made of containers',
    title: 'kind runs each Kubernetes node as a Docker container',
    frames: [
      {
        note: 'kind (Kubernetes IN Docker) was built to test Kubernetes itself, and is now the usual tool for CI and local clusters. You need only Docker. Each "node" of the cluster is one container.',
        boxes: [b('c', 'kind create cluster', ['one command'], 'new'), b('d', 'Docker', ['the only requirement'], 'ok')],
        deps: [d('kind create cluster', 'Docker', 'asks for node containers', 'ok')],
      },
      {
        note: 'kind pulls a node image (kindest/node) that contains systemd, a container runtime (containerd) and the Kubernetes binaries, and starts it as a container. Inside, kubeadm bootstraps the control plane: API server, etcd, scheduler and controller manager.',
        boxes: [b('n', 'Node container kind-control-plane', ['kindest/node:v1.31', 'containerd, kubelet, kubeadm'], 'new'), b('p', 'Control plane pods', ['kube-apiserver, etcd', 'scheduler, controller manager'], 'ok'), b('d', 'Docker', ['runs the node container'], 'ok')],
        deps: [d('Docker', 'Node container kind-control-plane', 'starts', 'ok'), d('Node container kind-control-plane', 'Control plane pods', 'kubeadm', 'ok')],
      },
      {
        note: 'kind writes a kubeconfig entry and sets the context kind-kind, so kubectl talks to the API server on a localhost port forwarded to the node container. After that, everything is ordinary Kubernetes: Deployments, Services, Pods.',
        boxes: [b('k', 'kubectl', ['context kind-kind'], 'new'), b('a', 'API server', ['127.0.0.1:random port'], 'ok'), b('w', 'Your workloads', ['Deployments, Services'], 'ok')],
        deps: [d('kubectl', 'API server', 'kubeconfig', 'ok'), d('API server', 'Your workloads', 'schedules', 'ok')],
      },
      {
        note: 'A config file adds nodes: one control plane and two workers lets you test scheduling, affinity, PodDisruptionBudgets and rolling updates across nodes. Several control planes (with a built-in load balancer container) test high availability.',
        boxes: [b('c', 'kind-config.yaml', ['1 control-plane, 2 workers'], 'new'), b('n1', 'Node kind-control-plane', ['container'], 'ok'), b('n2', 'Node kind-worker', ['container'], 'ok'), b('n3', 'Node kind-worker2', ['container'], 'ok')],
        deps: [d('kind-config.yaml', 'Node kind-control-plane', 'creates', 'ok'), d('kind-config.yaml', 'Node kind-worker', 'creates', 'ok'), d('kind-config.yaml', 'Node kind-worker2', 'creates', 'ok')],
      },
    ],
  },
  {
    id: 'images',
    label: 'Images and access',
    title: 'Nodes do not see your local images, and ports are not published by default',
    frames: [
      {
        note: 'The cluster nodes have their own container runtime, separate from your Docker images. An image you just built with docker build is not available inside the cluster, so a Pod fails with ErrImagePull.',
        boxes: [b('l', 'Local image bank/app:dev', ['built on your machine'], 'new'), b('n', 'kind node', ['own containerd'], 'ok'), b('p', 'Pod', ['ErrImagePull'], 'bad')],
        deps: [d('kind node', 'Local image bank/app:dev', 'cannot see', 'bad'), d('kind node', 'Pod', 'cannot pull', 'bad')],
      },
      {
        note: 'kind load docker-image bank/app:dev copies the image into every node. Use a specific tag, not latest: with latest, Kubernetes defaults to imagePullPolicy Always and tries the registry. For many images, run a local registry container connected to the kind network instead.',
        boxes: [b('l', 'Local image bank/app:dev', ['built locally'], 'new'), b('k', 'kind load docker-image', ['copy into nodes'], 'ok'), b('n', 'kind node', ['image present'], 'ok'), b('p', 'Pod', ['Running'], 'ok')],
        deps: [d('Local image bank/app:dev', 'kind load docker-image', 'input', 'ok'), d('kind load docker-image', 'kind node', 'loads', 'ok'), d('kind node', 'Pod', 'starts', 'ok')],
      },
      {
        note: 'Reaching a Service from your browser: kubectl port-forward is the quickest. For something closer to production, create the cluster with extraPortMappings (host 80 and 443 to the node) and install an ingress controller (ingress-nginx), then use Ingress objects with localhost hostnames.',
        boxes: [b('b', 'Browser', ['http://localhost'], 'new'), b('m', 'extraPortMappings', ['host 80 to node 80'], 'ok'), b('i', 'ingress-nginx', ['routes by host and path'], 'ok'), b('s', 'Service payments', ['ClusterIP'], 'ok')],
        deps: [d('Browser', 'extraPortMappings', 'localhost:80', 'ok'), d('extraPortMappings', 'ingress-nginx', 'node port', 'ok'), d('ingress-nginx', 'Service payments', 'routes', 'ok')],
      },
    ],
  },
  {
    id: 'ci',
    label: 'Testing in CI',
    title: 'Fast, disposable clusters make Kubernetes tests repeatable',
    frames: [
      {
        note: 'A CI job (GitHub Actions, GitLab) can create a cluster in under a minute, deploy the application with Helm or kubectl, run integration or end-to-end tests, and delete the cluster. Each run starts clean, so there is no leftover state.',
        boxes: [b('c', 'CI job', ['on every pull request'], 'new'), b('k', 'kind cluster', ['created for this run'], 'ok'), b('t', 'Integration tests', ['against real Kubernetes'], 'ok'), b('x', 'kind delete cluster', ['throw away'], 'warn')],
        deps: [d('CI job', 'kind cluster', 'creates', 'ok'), d('kind cluster', 'Integration tests', 'runs', 'ok'), d('Integration tests', 'kind delete cluster', 'then', 'warn')],
      },
      {
        note: "What kind is not: it is not a production platform, it has no cloud load balancers (LoadBalancer Services stay pending unless you add something like MetalLB or cloud-provider-kind), and it uses your machine's CPU and memory. Use it to test manifests, Helm charts, operators and rollouts.",
        boxes: [b('a', 'Good for', ['manifests, Helm, operators', 'rollout and probe behaviour'], 'ok'), b('b', 'Not for', ['production', 'performance numbers'], 'warn'), b('l', 'LoadBalancer Service', ['pending without MetalLB'], 'warn')],
        deps: [],
      },
    ],
  },
];
