// Frame data for the "Node.js deployment" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const NODE_DEPLOY_SCENES = [
  {
    id: 'image',
    label: 'Build the image',
    title: 'From source to a small, safe image',
    frames: [
      {
        note: 'Build once in a multi-stage Dockerfile. The build stage installs all dependencies from the lockfile and compiles TypeScript. The runtime stage copies only the compiled output and the production dependencies. The same image then runs in every environment.',
        boxes: [b('s', 'Source and lockfile', ['pnpm-lock.yaml, src'], 'ok'), b('b', 'Build stage', ['install, compile'], 'new'), b('r', 'Runtime stage', ['dist and prod deps only'], 'ok')],
        deps: [d('Source and lockfile', 'Build stage', 'frozen install', 'ok'), d('Build stage', 'Runtime stage', 'copy dist', 'ok')],
      },
      {
        note: 'A fat image carries compilers, dev dependencies and a root user: it is slow to pull and gives an attacker much to work with. A slim image runs as a non-root user with a read-only filesystem and is scanned in the pipeline for known vulnerabilities before it is pushed.',
        boxes: [b('f', 'Fat image', ['dev deps, root user'], 'bad'), b('s', 'Slim image', ['non-root, prod deps'], 'ok'), b('c', 'Image scan', ['fail on critical CVEs'], 'warn')],
        deps: [d('Fat image', 'Slim image', 'replace with', 'warn'), d('Slim image', 'Image scan', 'checked by', 'warn')],
      },
      {
        note: 'Start the process directly with CMD ["node", "dist/main.js"]. If you start it with npm start, npm becomes PID 1 and does not forward SIGTERM, so the app never learns it should stop and is killed after the grace period, dropping in-flight requests.',
        boxes: [b('n', 'npm start as PID 1', ['wraps the app'], 'bad'), b('x', 'SIGTERM never arrives', ['killed after 30 s'], 'bad'), b('p', 'node as PID 1', ['receives the signal'], 'ok')],
        deps: [d('npm start as PID 1', 'SIGTERM never arrives', 'causes', 'bad')],
      },
    ],
  },
  {
    id: 'config',
    label: 'Config and secrets',
    title: 'One image, many environments',
    frames: [
      {
        note: 'Build the image once and promote the same image through test, staging and production. Only the configuration differs, and it arrives as environment variables or mounted files. Never bake the environment into the image, or you are no longer deploying what you tested.',
        boxes: [b('i', 'One image', ['same digest everywhere'], 'ok'), b('e', 'Environment variables', ['URLs, limits, flags'], 'new'), b('n', 'Environments', ['test, staging, prod'], 'ok')],
        deps: [d('One image', 'Environments', 'runs in', 'ok'), d('Environment variables', 'Environments', 'configure', 'ok')],
      },
      {
        note: 'Secrets such as database passwords and signing keys must not be in the image, the repository or the logs. Keep them in a secret manager or a Kubernetes Secret and inject them when the container starts. Rotate them without rebuilding the image.',
        boxes: [b('b', 'Secret in the image', ['readable by anyone'], 'bad'), b('m', 'Secret manager', ['access by identity'], 'ok'), b('j', 'Injected at start', ['env var or mounted file'], 'ok')],
        deps: [d('Secret manager', 'Injected at start', 'supplies', 'ok')],
      },
      {
        note: 'Validate the configuration when the process starts, with a schema, and exit with a clear message if something is missing or malformed. A pod that fails to start stops the rollout and the old version keeps serving, which is far better than a service that starts and fails on the first request.',
        boxes: [b('v', 'Validate at startup', ['schema checks env'], 'new'), b('m', 'Missing variable', ['DATABASE_URL not set'], 'bad'), b('r', 'Rollout stops early', ['old pods keep serving'], 'ok')],
        deps: [d('Validate at startup', 'Missing variable', 'detects', 'bad'), d('Missing variable', 'Rollout stops early', 'so', 'ok')],
      },
    ],
  },
  {
    id: 'rollout',
    label: 'Zero-downtime rollout',
    title: 'Replace pods without dropping requests',
    frames: [
      {
        note: 'A rolling update starts new pods before stopping old ones. The readiness probe decides when a new pod may receive traffic, so the pod must report ready only after the database pool is connected. Liveness stays simple and independent of dependencies.',
        boxes: [b('r', 'Readiness probe', ['dependencies are up'], 'new'), b('n', 'New pod ready', ['joins the Service'], 'ok'), b('o', 'Old pod removed', ['after the new one is ready'], 'warn')],
        deps: [d('Readiness probe', 'New pod ready', 'gates', 'ok'), d('New pod ready', 'Old pod removed', 'then', 'warn')],
      },
      {
        note: 'When an old pod is stopped it gets SIGTERM. The app first makes readiness fail so no new requests arrive, then closes the server so current requests can finish, closes the database pool and exits 0, all before the grace period ends. A short preStop sleep covers the delay before endpoints update.',
        boxes: [b('t', 'SIGTERM received', ['start of shutdown'], 'warn'), b('f', 'Readiness fails', ['no new traffic'], 'ok'), b('d', 'Drain then exit', ['finish, close, exit 0'], 'ok')],
        deps: [d('SIGTERM received', 'Readiness fails', 'first', 'warn'), d('Readiness fails', 'Drain then exit', 'then', 'ok')],
      },
      {
        note: 'A canary sends a small share of traffic to the new version while metrics are compared: error rate, p99 latency, event loop lag. If a metric crosses its threshold, the release is rolled back automatically. Only then is the rest of the traffic moved.',
        boxes: [b('c', 'Canary release', ['5% of traffic'], 'new'), b('m', 'Metrics watched', ['errors, p99, lag'], 'ok'), b('a', 'Automatic rollback', ['on a threshold breach'], 'warn')],
        deps: [d('Canary release', 'Metrics watched', 'compared by', 'ok'), d('Metrics watched', 'Automatic rollback', 'triggers', 'warn')],
      },
      {
        note: 'During a rollout old and new code run at the same time against one database, so schema changes use expand and contract. First add the new column in a backward compatible way, then deploy code that uses it, and remove the old column in a later release once no old version runs.',
        boxes: [b('e', 'Expand schema', ['add column, nullable'], 'new'), b('n', 'Deploy new code', ['reads both'], 'ok'), b('c', 'Contract later', ['drop the old column'], 'warn')],
        deps: [d('Expand schema', 'Deploy new code', 'then', 'ok'), d('Deploy new code', 'Contract later', 'later', 'warn')],
      },
    ],
  },
  {
    id: 'runtime',
    label: 'Right-size and watch',
    title: 'Resources, scaling and signals',
    frames: [
      {
        note: 'Node runs JavaScript on one thread, so a pod rarely needs more than about one CPU, and scaling comes from more pods. Set the V8 heap limit to roughly 70 percent of the container memory limit. If the heap fills the whole limit, Buffers and native memory push the pod over it and Kubernetes kills it.',
        boxes: [b('c', 'CPU request', ['about 1 core per pod'], 'ok'), b('m', 'Memory limit', ['heap at about 70%'], 'ok'), b('o', 'OOMKilled', ['heap equals the limit'], 'bad')],
        deps: [d('Memory limit', 'OOMKilled', 'if too tight', 'bad')],
      },
      {
        note: 'A horizontal pod autoscaler adds pods when a signal rises. CPU is a fair default, but event loop utilisation or the request queue often predicts trouble sooner for an I/O-heavy Node service. Keep a minimum of two pods for availability and set a maximum so a bug cannot scale the bill.',
        boxes: [b('h', 'Autoscaler', ['min 2, max 10'], 'new'), b('s', 'Scaling signal', ['CPU or loop utilisation'], 'ok'), b('p', 'More pods', ['spread across nodes'], 'ok')],
        deps: [d('Scaling signal', 'Autoscaler', 'drives', 'ok'), d('Autoscaler', 'More pods', 'adds', 'ok')],
      },
      {
        note: 'Write logs as JSON lines to stdout and let the platform collect them. Export metrics and traces with OpenTelemetry. Alert on user-facing symptoms such as error rate and p99 latency, and use event loop lag and memory as causes to look at when an alert fires.',
        boxes: [b('l', 'JSON logs to stdout', ['request id on each line'], 'ok'), b('t', 'Metrics and traces', ['OpenTelemetry'], 'new'), b('a', 'Symptom alerts', ['errors and p99'], 'warn')],
        deps: [d('JSON logs to stdout', 'Metrics and traces', 'with', 'ok'), d('Metrics and traces', 'Symptom alerts', 'feed', 'warn')],
      },
    ],
  },
];
