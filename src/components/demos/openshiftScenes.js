// Frame data for the OpenShift walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const OPENSHIFT_SCENES = [
  {
    id: 'platform',
    label: 'OpenShift on Kubernetes',
    title: 'OpenShift is Kubernetes plus the parts a company would otherwise assemble itself',
    frames: [
      {
        note: 'At the centre is plain Kubernetes: API server, scheduler, controllers, etcd on the control plane, and kubelet on the workers. Your Deployments, Services, ConfigMaps and Secrets work unchanged.',
        boxes: [b('k', 'Kubernetes', ['API server, scheduler, etcd', 'Deployments, Services, Pods'], 'ok', 'core')],
        deps: [],
      },
      {
        note: 'OpenShift adds a hardened operating system (Red Hat CoreOS, managed by the cluster), an integrated image registry, a router for external traffic, and a web console for developers and administrators.',
        boxes: [b('k', 'Kubernetes', ['the core'], 'ok'), b('o', 'OpenShift', ['CoreOS nodes, web console', 'integrated registry, router'], 'new', 'platform')],
        deps: [d('OpenShift', 'Kubernetes', 'built on', 'ok')],
      },
      {
        note: 'It also adds security by default (projects, Security Context Constraints, an OAuth server and RBAC), build tooling (Source-to-Image, BuildConfigs, ImageStreams) and Operators that install and upgrade both the platform itself and add-on software.',
        boxes: [b('o', 'OpenShift', ['secure defaults'], 'new'), b('s', 'Security Context Constraints', ['no root containers by default'], 'ok'), b('b', 'Source-to-Image build', ['from Git to image'], 'ok'), b('p', 'Operators', ['install and upgrade software'], 'ok')],
        deps: [d('OpenShift', 'Security Context Constraints', 'enforces', 'ok'), d('OpenShift', 'Source-to-Image build', 'builds', 'ok'), d('OpenShift', 'Operators', 'runs', 'ok')],
      },
      {
        note: 'On top sit optional services: OpenShift Pipelines (Tekton) for CI, OpenShift GitOps (Argo CD) for delivery, Service Mesh (Istio), Serverless (Knative) and built-in monitoring with Prometheus. Each is installed as an Operator from OperatorHub.',
        boxes: [b('h', 'OperatorHub', ['catalogue of Operators'], 'new'), b('t', 'OpenShift Pipelines', ['Tekton CI'], 'ok'), b('g', 'OpenShift GitOps', ['Argo CD'], 'ok'), b('m', 'Service Mesh', ['Istio'], 'ok'), b('r', 'Monitoring', ['Prometheus, Alertmanager'], 'ok')],
        deps: [d('OperatorHub', 'OpenShift Pipelines', 'installs', 'ok'), d('OperatorHub', 'OpenShift GitOps', 'installs', 'ok'), d('OperatorHub', 'Service Mesh', 'installs', 'ok')],
      },
    ],
  },
  {
    id: 's2i',
    label: 'Build and deploy',
    title: 'From Git to a running pod: Source-to-Image, ImageStream and the deployment trigger',
    frames: [
      {
        note: 'A BuildConfig describes how to build: the Git URL, a builder image (for example a Java 17 builder) and the output image name. oc new-app or the console creates it for you. The strategy can be Source-to-Image, a Dockerfile (Docker strategy) or a pipeline.',
        boxes: [b('g', 'Git repository', ['payments-service'], 'new'), b('c', 'BuildConfig', ['source: Git URL', 'strategy: S2I, builder: java17'], 'ok'), b('i', 'Builder image', ['Java runtime and build tools'], 'ok')],
        deps: [d('Git repository', 'BuildConfig', 'source', 'ok'), d('Builder image', 'BuildConfig', 'used by', 'ok')],
      },
      {
        note: 'A build runs in a pod. Source-to-Image injects your source into the builder image, runs the build (for Java, Maven), and commits the result as a new application image. The developer never writes a Dockerfile.',
        boxes: [b('b', 'Build pod', ['clone, mvn package', 'assemble the image'], 'new', 'build'), b('i', 'Application image', ['payments:latest'], 'ok'), b('r', 'Integrated registry', ['stores the image'], 'ok')],
        deps: [d('Build pod', 'Application image', 'produces', 'ok'), d('Application image', 'Integrated registry', 'pushed', 'ok')],
      },
      {
        note: 'The image is recorded in an ImageStream, a pointer that tracks tags and their digests. A Deployment can watch it: when the tag in the ImageStream changes, the trigger starts a rolling update with the new image.',
        boxes: [b('s', 'ImageStream payments', ['tag latest -> new digest'], 'new'), b('d', 'Deployment payments', ['image trigger'], 'ok'), b('p', 'New pods', ['rolling update'], 'ok', 'rollout')],
        deps: [d('ImageStream payments', 'Deployment payments', 'triggers', 'new'), d('Deployment payments', 'New pods', 'creates', 'ok')],
      },
      {
        note: 'Finally you expose it: a Service load-balances the pods inside the cluster, and a Route publishes a hostname through the OpenShift router with TLS. The whole flow can be automated by a pipeline instead of clicking or running oc by hand.',
        boxes: [b('r', 'Route', ['payments.apps.bank.example', 'edge TLS'], 'new'), b('s', 'Service', ['load balances'], 'ok'), b('p', 'Pods', ['3 replicas'], 'ok')],
        deps: [d('Route', 'Service', 'forwards', 'ok'), d('Service', 'Pods', 'selects', 'ok')],
      },
    ],
  },
  {
    id: 'routes',
    label: 'Routes and the router',
    title: 'A Route publishes a Service to the outside world through the OpenShift router',
    frames: [
      {
        note: 'External clients resolve a wildcard DNS name such as *.apps.bank.example to the cluster\'s load balancer. That sends traffic to the router, an HAProxy-based Ingress Controller running as pods in the cluster.',
        boxes: [b('c', 'Client', ['https://payments.apps.bank.example'], 'new'), b('l', 'Load balancer', ['wildcard DNS target'], 'ok'), b('r', 'Router (Ingress Controller)', ['HAProxy pods'], 'ok')],
        deps: [d('Client', 'Load balancer', 'HTTPS', 'ok'), d('Load balancer', 'Router (Ingress Controller)', 'forwards', 'ok')],
      },
      {
        note: 'The router reads the Host header (and SNI for TLS) and looks up the matching Route object. Termination can be edge (the router decrypts and sends plain HTTP to the pod), passthrough (the pod terminates TLS) or re-encrypt (TLS on both legs, the usual choice for sensitive traffic).',
        boxes: [b('r', 'Router (Ingress Controller)', ['match host to Route'], 'ok'), b('t', 'Route payments', ['host, path, TLS termination', 'to: Service payments'], 'new'), b('e', 'TLS options', ['edge, passthrough, re-encrypt'], 'warn')],
        deps: [d('Router (Ingress Controller)', 'Route payments', 'looks up', 'ok')],
      },
      {
        note: 'The router sends the request directly to the pod endpoints of the Service (it bypasses the Service virtual IP) with load balancing, and can do weighted routing between two Services, which gives simple blue-green or canary releases.',
        boxes: [b('t', 'Route payments', ['90% v1, 10% v2'], 'new'), b('a', 'Service payments-v1', ['stable'], 'ok'), b('b', 'Service payments-v2', ['canary'], 'warn')],
        deps: [d('Route payments', 'Service payments-v1', '90%', 'ok'), d('Route payments', 'Service payments-v2', '10%', 'warn')],
      },
      {
        note: 'Several Ingress Controllers can run side by side and use route selectors (labels) to split traffic: for example one for internal applications and one for internet-facing ones. Standard Kubernetes Ingress objects also work and are translated to routes.',
        boxes: [b('i', 'Internal router', ['routeSelector: internal'], 'ok'), b('x', 'Public router', ['routeSelector: public'], 'ok'), b('a', 'Route admin-portal', ['label internal'], 'new'), b('p', 'Route payments-api', ['label public'], 'new')],
        deps: [d('Internal router', 'Route admin-portal', 'serves', 'ok'), d('Public router', 'Route payments-api', 'serves', 'ok')],
      },
    ],
  },
  {
    id: 'security',
    label: 'Security Context Constraints',
    title: 'Why an image that runs on plain Kubernetes may fail on OpenShift',
    frames: [
      {
        note: 'Many public images run as root and listen on port 80. On a default OpenShift cluster that fails: the restricted Security Context Constraint (SCC) forbids running as root, drops dangerous Linux capabilities and blocks privileged containers.',
        boxes: [b('i', 'Image runs as root', ['USER root', 'listens on port 80'], 'bad'), b('s', 'restricted-v2 SCC', ['no root, no privileged', 'capabilities dropped'], 'ok', 'blocks'), b('p', 'Pod', ['CreateContainerConfigError or permission denied'], 'bad')],
        deps: [d('Image runs as root', 'restricted-v2 SCC', 'admission', 'bad'), d('restricted-v2 SCC', 'Pod', 'rejects', 'bad')],
      },
      {
        note: 'OpenShift starts each project\'s pods with a random user ID from a range assigned to the namespace. The user is always in the root group (GID 0), so files your image writes must be group-writable (chgrp -R 0 and chmod -R g=u). Running as a fixed UID would be rejected.',
        boxes: [b('n', 'Namespace payments', ['UID range 1000650000/10000'], 'new'), b('p', 'Pod', ['runs as UID 1000650123', 'group 0'], 'ok'), b('f', 'Image directories', ['group-writable for GID 0'], 'ok')],
        deps: [d('Namespace payments', 'Pod', 'assigns UID', 'ok'), d('Pod', 'Image directories', 'writes via group 0', 'ok')],
      },
      {
        note: 'The fix is to build a compliant image: a non-root user, an unprivileged port such as 8080 (Spring Boot already defaults to it), no writes outside /tmp and mounted volumes, and group permissions set for GID 0. Then no special permission is needed.',
        boxes: [b('i', 'Compliant image', ['USER 1001, port 8080', 'group-writable /app'], 'ok'), b('s', 'restricted-v2 SCC', ['allowed'], 'ok'), b('p', 'Pod', ['Running'], 'ok')],
        deps: [d('Compliant image', 'restricted-v2 SCC', 'admission', 'ok'), d('restricted-v2 SCC', 'Pod', 'allows', 'ok')],
      },
      {
        note: 'A SCC is granted to a service account, not requested by a pod. Granting anyuid or privileged is a security decision for a cluster administrator, and for a regulated environment it should be the exception that needs review, not the default fix.',
        boxes: [b('a', 'Cluster admin', ['reviews the request'], 'new'), b('g', 'Grant SCC anyuid', ['to one service account'], 'warn', 'exception'), b('r', 'RBAC', ['who may use which SCC'], 'ok')],
        deps: [d('Cluster admin', 'Grant SCC anyuid', 'decides', 'warn'), d('RBAC', 'Grant SCC anyuid', 'controls', 'ok')],
      },
    ],
  },
  {
    id: 'operators',
    label: 'Operators and delivery',
    title: 'Operators manage software like a human operator would, and pipelines deliver to the cluster',
    frames: [
      {
        note: 'An Operator is a controller for an application. You declare what you want in a custom resource (for example a PostgresCluster with 3 replicas) and the Operator creates and maintains the pods, volumes, backups and upgrades to match it.',
        boxes: [b('c', 'Custom resource', ['PostgresCluster', 'replicas: 3, version: 15'], 'new'), b('o', 'Operator', ['watches the resource'], 'ok', 'controller'), b('a', 'Database pods', ['3 replicas, backups'], 'ok')],
        deps: [d('Custom resource', 'Operator', 'desired state', 'new'), d('Operator', 'Database pods', 'creates and repairs', 'ok')],
      },
      {
        note: 'The Operator Lifecycle Manager (OLM) installs and updates Operators from catalogues in OperatorHub. Even the platform itself is run by Operators: the Cluster Version Operator updates OpenShift, and each core component (network, ingress, authentication) has its own Operator.',
        boxes: [b('h', 'OperatorHub', ['certified and community'], 'new'), b('l', 'Operator Lifecycle Manager', ['install, update, remove'], 'ok'), b('v', 'Cluster Version Operator', ['updates the cluster itself'], 'ok')],
        deps: [d('OperatorHub', 'Operator Lifecycle Manager', 'catalogue', 'ok'), d('Operator Lifecycle Manager', 'Cluster Version Operator', 'manages', 'ok')],
      },
      {
        note: 'Delivery on OpenShift is usually pipeline plus GitOps: a Tekton pipeline builds, tests and scans the image on every commit, then updates a Git repository of manifests. Argo CD watches that repository and applies the change to the cluster, so Git is the record of what runs.',
        boxes: [b('g', 'Git commit', ['application code'], 'new'), b('t', 'Tekton pipeline', ['build, test, scan, push'], 'ok'), b('m', 'Manifest repository', ['image tag updated'], 'ok'), b('a', 'Argo CD', ['syncs Git to the cluster'], 'ok')],
        deps: [d('Git commit', 'Tekton pipeline', 'triggers', 'ok'), d('Tekton pipeline', 'Manifest repository', 'updates', 'ok'), d('Argo CD', 'Manifest repository', 'watches', 'ok')],
      },
    ],
  },
];
