// Frame data for the minikube walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const MINIKUBE_SCENES = [
  {
    id: 'start',
    label: 'minikube start',
    title: 'minikube builds a one-node Kubernetes cluster on your laptop through a driver',
    frames: [
      {
        note: 'minikube start picks a driver, the technology that provides the "machine" the cluster runs on: Docker (a container, the most common), or a virtual machine (VirtualBox, Hyper-V, QEMU, KVM, HyperKit). The driver choice decides startup time, resources and what features work.',
        boxes: [b('m', 'minikube start', ['--driver=docker', '--cpus=4 --memory=8g'], 'new'), b('d', 'Driver', ['docker, Hyper-V, QEMU, VirtualBox'], 'ok'), b('n', 'Minikube node', ['container or VM'], 'ok')],
        deps: [d('minikube start', 'Driver', 'chooses', 'ok'), d('Driver', 'Minikube node', 'provides', 'ok')],
      },
      {
        note: 'On that node minikube installs a container runtime (containerd, CRI-O or Docker) and Kubernetes, with the control plane and the worker on the same node. It writes the kubeconfig and sets the kubectl context to minikube.',
        boxes: [b('n', 'Minikube node', ['control plane and worker'], 'ok'), b('r', 'Container runtime', ['containerd'], 'ok'), b('k', 'kubectl', ['context minikube'], 'new')],
        deps: [d('Minikube node', 'Container runtime', 'runs', 'ok'), d('kubectl', 'Minikube node', 'API server', 'ok')],
      },
      {
        note: 'Profiles let you keep several clusters side by side (minikube start -p test --kubernetes-version=v1.30.0), each with its own driver, size and version. minikube stop pauses a cluster, minikube delete removes it.',
        boxes: [b('a', 'Profile minikube', ['v1.31, 4 CPUs'], 'ok'), b('b', 'Profile legacy', ['v1.28 to test an upgrade'], 'ok'), b('c', 'Profile multinode', ['--nodes=3'], 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'access',
    label: 'Reaching your applications',
    title: 'The cluster sits behind the driver, so minikube gives you helpers to reach it',
    frames: [
      {
        note: 'A NodePort Service opens a port on the node, and minikube service payments --url prints a URL that works for your driver (it may start a tunnel on macOS and Windows with the Docker driver). minikube ip gives the node address when it is directly reachable.',
        boxes: [b('b', 'Browser', ['http://127.0.0.1:50321'], 'new'), b('s', 'minikube service', ['prints or tunnels the URL'], 'ok'), b('p', 'Service payments', ['NodePort 30080'], 'ok')],
        deps: [d('Browser', 'minikube service', 'URL', 'ok'), d('minikube service', 'Service payments', 'reaches', 'ok')],
      },
      {
        note: 'A LoadBalancer Service stays pending because there is no cloud. Run minikube tunnel in another terminal and it assigns an external IP on your machine and forwards traffic, behaving like a cloud load balancer for local testing.',
        boxes: [b('l', 'Service type LoadBalancer', ['EXTERNAL-IP pending'], 'warn'), b('t', 'minikube tunnel', ['assigns an IP, forwards traffic'], 'ok'), b('c', 'Client', ['curl EXTERNAL-IP'], 'new')],
        deps: [d('minikube tunnel', 'Service type LoadBalancer', 'sets EXTERNAL-IP', 'ok'), d('Client', 'minikube tunnel', 'request', 'ok')],
      },
      {
        note: 'For host-based routing enable the ingress addon (ingress-nginx) with minikube addons enable ingress, then use Ingress objects and map the hostname to the cluster address in your hosts file. The dashboard addon shows cluster resources in a browser.',
        boxes: [b('a', 'Addon ingress', ['ingress-nginx'], 'ok'), b('i', 'Ingress payments.local', ['host and path rules'], 'new'), b('s', 'Service payments', ['ClusterIP'], 'ok')],
        deps: [d('Addon ingress', 'Ingress payments.local', 'implements', 'ok'), d('Ingress payments.local', 'Service payments', 'routes', 'ok')],
      },
    ],
  },
  {
    id: 'images',
    label: 'Images and addons',
    title: 'Get your own image into the cluster and add platform features on demand',
    frames: [
      {
        note: "The cluster has its own runtime, so a locally built image must reach it. Option one: minikube image load bank/app:dev copies it. Option two: eval $(minikube docker-env) points your docker CLI at the cluster's Docker daemon, so docker build creates the image directly inside the node.",
        boxes: [b('l', 'Image bank/app:dev', ['built on your machine'], 'new'), b('i', 'minikube image load', ['copy into the node'], 'ok'), b('e', 'minikube docker-env', ['build inside the node'], 'ok'), b('n', 'Minikube node', ['image available'], 'ok')],
        deps: [d('Image bank/app:dev', 'minikube image load', 'input', 'ok'), d('minikube image load', 'Minikube node', 'copies', 'ok'), d('minikube docker-env', 'Minikube node', 'builds in', 'ok')],
      },
      {
        note: 'Remember imagePullPolicy: Never or IfNotPresent for local images with a fixed tag, otherwise Kubernetes tries to pull from a registry and fails. An alternative is the registry addon, a registry running in the cluster that you push to.',
        boxes: [b('p', 'Pod spec', ['imagePullPolicy: IfNotPresent'], 'ok'), b('r', 'Registry addon', ['localhost:5000'], 'ok'), b('n', 'Minikube node', ['uses local image'], 'ok')],
        deps: [d('Pod spec', 'Minikube node', 'uses local image', 'ok')],
      },
      {
        note: 'Addons are bundled features you switch on: metrics-server (for kubectl top and autoscaling), ingress, dashboard, registry, and storage provisioning. minikube addons list shows them. This is the main convenience over a bare kind cluster.',
        boxes: [b('a', 'minikube addons enable', ['one command each'], 'new'), b('m', 'metrics-server', ['kubectl top, HPA'], 'ok'), b('i', 'ingress', ['routing'], 'ok'), b('d', 'dashboard', ['web UI'], 'ok')],
        deps: [d('minikube addons enable', 'metrics-server', 'installs', 'ok'), d('minikube addons enable', 'ingress', 'installs', 'ok'), d('minikube addons enable', 'dashboard', 'installs', 'ok')],
      },
    ],
  },
];
