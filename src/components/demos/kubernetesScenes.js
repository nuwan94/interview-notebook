// Frame data for the Kubernetes walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const KUBERNETES_SCENES = [
  {
    id: 'objects',
    label: 'Deployment, pods, service',
    title: 'You declare the desired state, and controllers keep making it true',
    frames: [
      {
        note: 'A Pod is the smallest unit: one or more containers sharing a network and storage, with one IP. You rarely create Pods directly because a bare Pod is not replaced if its node fails.',
        boxes: [b('p', 'Pod payments-7d9f', ['container: payments:1.4', 'IP 10.1.2.5', 'dies with its node'], 'warn')],
        deps: [],
      },
      {
        note: 'A Deployment declares "keep 3 replicas of this pod template running". It creates a ReplicaSet, and the ReplicaSet creates and replaces the Pods. If a pod crashes or a node disappears, the ReplicaSet starts a new pod to get back to 3.',
        boxes: [b('d', 'Deployment payments', ['replicas: 3', 'image payments:1.4'], 'new'), b('r', 'ReplicaSet', ['keeps 3 pods alive'], 'ok'), b('p1', 'Pod 1', ['Running'], 'ok'), b('p2', 'Pod 2', ['Running'], 'ok'), b('p3', 'Pod 3', ['Running'], 'ok')],
        deps: [d('Deployment payments', 'ReplicaSet', 'owns', 'ok'), d('ReplicaSet', 'Pod 1', 'creates', 'ok'), d('ReplicaSet', 'Pod 2', 'creates', 'ok'), d('ReplicaSet', 'Pod 3', 'creates', 'ok')],
      },
      {
        note: 'Pod IPs change every time a pod is replaced. A Service gives them one stable virtual IP and DNS name, payments.bank.svc.cluster.local, and load-balances across the pods that match its label selector and are Ready.',
        boxes: [b('c', 'Client pod', ['calls http://payments'], 'new'), b('s', 'Service payments', ['stable IP and DNS name', 'selector: app=payments'], 'ok'), b('p1', 'Pod 1', ['app=payments, Ready'], 'ok'), b('p2', 'Pod 2', ['app=payments, Ready'], 'ok'), b('p3', 'Pod 3', ['not Ready: no traffic'], 'warn')],
        deps: [d('Client pod', 'Service payments', 'DNS name', 'ok'), d('Service payments', 'Pod 1', 'forwards', 'ok'), d('Service payments', 'Pod 2', 'forwards', 'ok'), d('Service payments', 'Pod 3', 'skipped', 'warn')],
      },
      {
        note: 'To reach the service from outside the cluster, an Ingress (or a LoadBalancer Service) exposes HTTP routes. The Ingress controller terminates TLS and routes by host and path to Services. ClusterIP is internal only, NodePort opens a port on every node, LoadBalancer asks the cloud for an external load balancer.',
        boxes: [b('u', 'Internet user', ['https://bank.example/api'], 'new'), b('i', 'Ingress', ['TLS, host and path rules'], 'ok'), b('s', 'Service payments', ['ClusterIP'], 'ok'), b('p', 'Pods', ['payments'], 'ok')],
        deps: [d('Internet user', 'Ingress', 'HTTPS', 'ok'), d('Ingress', 'Service payments', 'route /api', 'ok'), d('Service payments', 'Pods', 'forwards', 'ok')],
      },
    ],
  },
  {
    id: 'rolling',
    label: 'Rolling update',
    title: 'A rolling update replaces pods gradually so the service never goes down',
    frames: [
      {
        note: 'You change the image in the Deployment from 1.4 to 1.5. The Deployment creates a new ReplicaSet for 1.5 and keeps the old one. Three pods of 1.4 are running and serving traffic.',
        boxes: [b('d', 'Deployment', ['image: 1.4 -> 1.5', 'maxSurge 1, maxUnavailable 0'], 'new'), b('o', 'ReplicaSet v1.4', ['3 pods, serving'], 'ok'), b('n', 'ReplicaSet v1.5', ['0 pods yet'], 'new')],
        deps: [d('Deployment', 'ReplicaSet v1.4', 'scales down', 'ok'), d('Deployment', 'ReplicaSet v1.5', 'scales up', 'ok')],
      },
      {
        note: 'maxSurge 1 allows one extra pod, so a 1.5 pod starts first. It receives traffic only when its readiness probe passes. Only then does Kubernetes terminate one old pod. maxUnavailable 0 means capacity never drops below 3 ready pods.',
        boxes: [b('o', 'ReplicaSet v1.4', ['2 pods serving', '1 terminating'], 'warn'), b('n', 'ReplicaSet v1.5', ['1 pod: readiness passed'], 'ok'), b('p', 'Readiness probe', ['gate before traffic'], 'ok')],
        deps: [d('Readiness probe', 'ReplicaSet v1.5', 'admits pod', 'ok')],
      },
      {
        note: 'The cycle repeats pod by pod until all replicas run 1.5 and the old ReplicaSet is scaled to zero (kept for rollback). Users saw no downtime as long as the new pods become ready and the app shuts down gracefully.',
        boxes: [b('o', 'ReplicaSet v1.4', ['0 pods', 'kept for rollback'], 'none'), b('n', 'ReplicaSet v1.5', ['3 pods, serving'], 'ok', 'done')],
        deps: [],
      },
      {
        note: 'If the new pods never become Ready (a bug, a bad config), the rollout stalls and the old pods keep serving. kubectl rollout undo deployment/payments returns to the previous ReplicaSet. Canary and blue-green releases use two Deployments or a service mesh to shift traffic more carefully.',
        boxes: [b('n', 'ReplicaSet v1.5', ['pods CrashLoopBackOff', 'never Ready'], 'bad'), b('o', 'ReplicaSet v1.4', ['old pods still serving'], 'ok', 'safe'), b('u', 'kubectl rollout undo', ['back to v1.4'], 'ok')],
        deps: [d('kubectl rollout undo', 'ReplicaSet v1.4', 'restores', 'ok')],
      },
    ],
  },
  {
    id: 'probes',
    label: 'Probes and shutdown',
    title: 'Liveness restarts a stuck pod, readiness removes it from traffic, startup protects slow starts',
    frames: [
      {
        note: 'The kubelet runs three kinds of probe against each container. Startup: has the app finished starting? Liveness: is the process still healthy, or should it be restarted? Readiness: can it serve requests right now?',
        boxes: [b('s', 'Startup probe', ['slow start allowed', 'others wait for it'], 'new'), b('l', 'Liveness probe', ['fail: restart container'], 'warn'), b('r', 'Readiness probe', ['fail: remove from Service'], 'warn')],
        deps: [],
      },
      {
        note: 'With Spring Boot the probes point at Actuator: /actuator/health/liveness and /actuator/health/readiness. The readiness group can include the database; keep the liveness group free of external dependencies, or a database outage would restart every pod at once.',
        boxes: [b('a', 'Actuator health', ['/liveness: app alive', '/readiness: can serve'], 'ok'), b('d', 'Database down', ['readiness fails', 'liveness still passes'], 'warn'), b('k', 'Pod', ['removed from Service', 'not restarted'], 'ok', 'correct')],
        deps: [d('Database down', 'Pod', 'readiness DOWN', 'warn')],
      },
      {
        note: 'A slow JVM start can exceed the liveness timeout, so Kubernetes kills the pod in a loop (CrashLoopBackOff). A startup probe gives the app up to failureThreshold x periodSeconds to start before liveness begins.',
        boxes: [b('x', 'Liveness only', ['JVM needs 40 s', 'killed at 30 s, repeat'], 'bad', 'CrashLoopBackOff'), b('y', 'Startup probe', ['allows 60 s', 'then liveness takes over'], 'ok', 'fix')],
        deps: [],
      },
      {
        note: 'On shutdown Kubernetes removes the pod from the Service endpoints and sends SIGTERM at about the same time. The app should stop taking new requests, finish in-flight ones and exit before terminationGracePeriodSeconds (30 s default) ends. Spring Boot: server.shutdown=graceful. A short preStop sleep covers the delay in endpoint propagation.',
        boxes: [b('t', 'SIGTERM', ['sent to PID 1'], 'new'), b('g', 'Graceful shutdown', ['finish in-flight requests', 'then exit'], 'ok'), b('k', 'SIGKILL after grace period', ['whatever is left is cut off'], 'bad')],
        deps: [d('SIGTERM', 'Graceful shutdown', 'starts', 'ok'), d('Graceful shutdown', 'SIGKILL after grace period', 'too slow', 'bad')],
      },
    ],
  },
  {
    id: 'resources',
    label: 'Resources and scaling',
    title: 'Requests reserve capacity, limits cap it, and the autoscaler adds pods under load',
    frames: [
      {
        note: 'requests are what the scheduler reserves for a pod when picking a node: it only fits on a node with that much free. limits are the ceiling the pod may use. Pods without requests can be packed onto nodes in unpredictable ways.',
        boxes: [b('p', 'Pod', ['requests: 500m CPU, 512Mi', 'limits: 1 CPU, 1Gi'], 'new'), b('n', 'Node', ['free: 2 CPU, 3Gi', 'scheduler places the pod here'], 'ok')],
        deps: [d('Pod', 'Node', 'scheduled', 'ok')],
      },
      {
        note: 'The two limits behave differently. Above its CPU limit a container is throttled: slower but alive. Above its memory limit the container is killed with OOMKilled (exit code 137). A JVM needs heap plus metaspace, threads and direct buffers, so set the memory limit well above -Xmx, or use -XX:MaxRAMPercentage.',
        boxes: [b('c', 'CPU over limit', ['throttled, slower'], 'warn'), b('m', 'Memory over limit', ['OOMKilled, exit 137', 'container restarts'], 'bad'), b('j', 'JVM sizing', ['MaxRAMPercentage=75', 'leaves room for non-heap'], 'ok')],
        deps: [],
      },
      {
        note: 'The Horizontal Pod Autoscaler watches a metric such as average CPU against a target (say 70 percent of the request). When load rises it raises the replica count, and lowers it when load falls, within minReplicas and maxReplicas.',
        boxes: [b('m', 'Metrics server', ['average CPU 92%', 'target 70%'], 'warn'), b('h', 'HPA', ['min 3, max 10', 'desired = 4'], 'new'), b('d', 'Deployment', ['replicas 3 -> 4'], 'ok')],
        deps: [d('Metrics server', 'HPA', 'reads', 'warn'), d('HPA', 'Deployment', 'scales', 'ok')],
      },
      {
        note: 'A PodDisruptionBudget protects availability during voluntary disruptions such as node drains and cluster upgrades: "keep at least 2 payments pods available". Combine it with several replicas spread over zones using anti-affinity or topology spread.',
        boxes: [b('p', 'PodDisruptionBudget', ['minAvailable: 2'], 'ok'), b('d', 'kubectl drain node', ['evicts pods one at a time'], 'warn'), b('z', 'Spread across zones', ['one node failure is survivable'], 'ok')],
        deps: [d('PodDisruptionBudget', 'kubectl drain node', 'limits evictions', 'ok')],
      },
    ],
  },
  {
    id: 'config',
    label: 'ConfigMap and Secret',
    title: 'Keep configuration out of the image and inject it at run time',
    frames: [
      {
        note: 'The same image should run in dev, test and production. Environment-specific values live outside it: a ConfigMap for ordinary settings and a Secret for credentials.',
        boxes: [b('i', 'Image payments:1.4', ['same everywhere'], 'ok'), b('c', 'ConfigMap payments-config', ['LOG_LEVEL=INFO', 'FEATURE_X=true'], 'new'), b('s', 'Secret payments-secret', ['DB_PASSWORD=...'], 'warn')],
        deps: [],
      },
      {
        note: 'They are injected into the pod as environment variables or as files in a mounted volume. Spring Boot maps environment variables to properties: SPRING_DATASOURCE_PASSWORD becomes spring.datasource.password, so no code change is needed.',
        boxes: [b('c', 'ConfigMap payments-config', ['env or file'], 'new'), b('s', 'Secret payments-secret', ['env or file'], 'warn'), b('p', 'Pod', ['SPRING_DATASOURCE_PASSWORD', 'application.yaml from a mounted volume'], 'ok')],
        deps: [d('ConfigMap payments-config', 'Pod', 'injects', 'ok'), d('Secret payments-secret', 'Pod', 'injects', 'ok')],
      },
      {
        note: 'A Secret is only base64-encoded by default, not encrypted, so anyone with read access to it can decode it. Restrict access with RBAC, enable encryption at rest for etcd, and prefer an external secret manager (Vault, a cloud KMS) synced into the cluster. Never commit real secrets to Git.',
        boxes: [b('b', 'Secret in YAML', ['base64, not encryption'], 'bad'), b('r', 'RBAC and etcd encryption', ['limit who can read'], 'ok'), b('v', 'External secret manager', ['Vault or cloud KMS'], 'ok', 'preferred')],
        deps: [],
      },
      {
        note: 'Environment variables are read at start, so changing a ConfigMap does not change a running pod: restart the pods (rollout restart) or use mounted files with a reload mechanism. Mounted ConfigMap files do update in place after a short delay.',
        boxes: [b('e', 'Env var from ConfigMap', ['fixed at container start'], 'warn'), b('f', 'Mounted file', ['updated in place, app must re-read'], 'ok'), b('r', 'kubectl rollout restart', ['pods restart with new values'], 'ok')],
        deps: [],
      },
    ],
  },
];
