// Frame data for the "Node.js deployment" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;

/* ---------- build the image ---------- */
const imageFrames = [
  {
    h: 250,
    line: 'docker build   # multi-stage',
    result: { text: 'only dist + prod deps ship', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 410, h: 120, title: 'build stages (thrown away)' }, { x: 436, y: 30, w: 190, h: 200, title: 'runtime image', tone: 'ok' }],
    cards: [
      box('d', 18, 62, 160, 'deps', ['pnpm install', '--frozen-lockfile'], 'new'),
      box('b', 214, 62, 190, 'build', ['tsc, prune --prod'], 'new'),
      box('r', 448, 62, 166, 'node:22-slim', ['dist/', 'node_modules (prod)'], 'ok'),
      box('x', 18, 170, 386, 'left behind', ['compiler, dev deps, pnpm store, source'], 'none', { dim: true }),
    ],
    arrows: [{ from: 'd', to: 'b', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'b', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The build stages install everything from the lockfile and compile TypeScript. The runtime stage starts fresh and copies only the compiled output and the production dependencies.',
  },
  {
    h: 250,
    line: 'USER node + read-only filesystem + scan',
    result: { text: 'small, non-root, scanned', tone: 'ok' },
    cards: [
      box('f', C1, 60, 290, 'fat image', ['1.1 GB, dev deps, compiler', 'runs as root'], 'bad'),
      box('s', 336, 60, 290, 'slim image', ['~200 MB, prod deps only', 'runs as node (uid 1000)'], 'ok'),
      box('c', C1, 170, 612, 'image scan in the pipeline (Trivy, Grype)', ['fail the build on critical CVEs, then sign and push'], 'warn'),
    ],
    arrows: [{ from: 'f', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A fat image is slow to pull, and gives an attacker tools and root. A slim image runs as a non-root user with a read-only filesystem. The pipeline scans it before it is pushed.',
  },
  {
    h: 250,
    line: 'CMD npm start   vs   CMD ["node", "dist/main.js"]',
    result: { text: 'node must be PID 1', tone: 'warn' },
    cards: [
      box('k', C1, 44, W, 'kubelet', ['sends SIGTERM'], 'none'),
      box('n', C2, 44, W, 'npm  (PID 1)', ['does not forward it'], 'bad'),
      box('a', C3, 44, W, 'node app', ['never told: SIGKILL', 'after 30 s'], 'bad'),
      box('k2', C1, 160, W, 'kubelet', ['sends SIGTERM'], 'none'),
      box('p', C2, 160, W, 'node  (PID 1)', ['receives it, drains', 'and exits 0'], 'ok'),
    ],
    arrows: [{ from: 'k', to: 'n', fs: 'r', ts: 'l' }, { from: 'n', to: 'a', fs: 'r', ts: 'l', tone: 'bad', cross: true }, { from: 'k2', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'With npm start, npm is PID 1 and does not pass SIGTERM on. The app never learns it should stop, and is killed after the grace period, dropping requests. Start node directly, in exec form.',
  },
];

/* ---------- config and secrets ---------- */
const configFrames = [
  {
    h: 250,
    line: 'image: transfer-service@sha256:9f2c…',
    result: { text: 'one image, config differs', tone: 'ok' },
    cards: [
      box('i', C1, 100, W, 'one image', ['same digest everywhere'], 'new', { badge: 'built once' }),
      box('t', C3, 40, W, 'test', ['DATABASE_URL=test-db'], 'ok'),
      box('s', C3, 110, W, 'staging', ['DATABASE_URL=stg-db'], 'ok'),
      box('p', C3, 180, W, 'production', ['DATABASE_URL=prod-db'], 'ok'),
    ],
    arrows: [{ from: 'i', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i', to: 's', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Build the image once, and promote the same digest through every environment. Only the configuration differs. It arrives as environment variables or mounted files, never baked into the image.',
  },
  {
    h: 250,
    line: 'ENV DB_PASSWORD=…  in the Dockerfile',
    result: { text: 'secrets injected at start', tone: 'ok' },
    cards: [
      box('b', C1, 50, W, 'secret in the image', ['readable by anyone', 'who can pull it'], 'bad'),
      box('m', C2, 140, W, 'secret manager', ['Vault, Secrets Manager', 'access by pod identity'], 'ok'),
      box('j', C3, 140, W, 'container start', ['env var or', 'mounted file'], 'ok'),
    ],
    arrows: [{ from: 'm', to: 'j', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A secret in the image, the repository or a build argument is readable by anyone who gets hold of it. Keep secrets in a secret manager, and inject them when the container starts. Rotate them without a rebuild.',
  },
  {
    h: 250,
    line: 'loadConfig(process.env)   // before listen()',
    result: { text: 'bad config stops the rollout', tone: 'ok' },
    cards: [
      box('v', C1, 50, W, 'validate at startup', ['all problems at once'], 'new'),
      box('e', C2, 50, W, 'Invalid configuration', ['DATABASE_URL is required', 'PORT must be an integer'], 'bad', { badge: 'exit 1' }),
      box('n', C3, 50, W, 'new pod', ['never becomes ready'], 'warn'),
      box('o', C3, 160, W, 'old pods', ['keep serving'], 'ok'),
    ],
    arrows: [{ from: 'v', to: 'e', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'e', to: 'n', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Check the configuration before the server listens, and exit with a clear message. A pod that fails to start stops the rollout, and the old version keeps serving. That beats a service that fails on its first request.',
  },
];

/* ---------- zero-downtime rollout ---------- */
const pod = (id, x, title, line, tone, o = {}) => box(id, x, 70, 140, title, [line], tone, o);

const rolloutFrames = [
  {
    h: 230,
    line: 'maxSurge: 1, maxUnavailable: 0',
    result: { text: 'new pod first, old pod after', tone: 'ok' },
    regions: [{ x: 6, y: 34, w: 620, h: 110, title: 'Service endpoints' }],
    cards: [pod('o1', 18, 'v1 pod', 'serving', 'ok'), pod('o2', 170, 'v1 pod', 'serving', 'ok'), pod('o3', 322, 'v1 pod', 'stopping next', 'warn'), pod('n1', 474, 'v2 pod', '/health/ready 200', 'new', { badge: 'joined' })],
    note: 'A rolling update starts a new pod before stopping an old one. The readiness probe decides when the new pod may get traffic. It reports ready only after the database pool connects.',
  },
  {
    h: 260,
    line: 'SIGTERM → drain → exit 0',
    result: { text: 'no request dropped', tone: 'ok' },
    steps: { items: ['preStop sleep 5', 'readiness 503', 'server.close()', 'sweep idle sockets', 'pool.end()', 'exit 0'], at: 5 },
    cards: [
      box('t', C1, 50, W, 'SIGTERM', ['start of shutdown'], 'warn'),
      box('r', C2, 50, W, 'readiness fails', ['no new traffic'], 'ok'),
      box('d', C3, 50, W, 'in-flight request', ['finishes, then exit'], 'ok'),
    ],
    arrows: [{ from: 't', to: 'r', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'r', to: 'd', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'On SIGTERM, the app first fails readiness, so no new requests arrive. Then it stops accepting connections, lets current requests finish, closes idle sockets and the pool, and exits 0 before the grace period ends.',
  },
  {
    h: 230,
    line: 'canary: 5% of traffic to v2',
    result: { text: 'p99 breached: rolled back', tone: 'warn' },
    cards: [
      box('l', C1, 70, W, 'load balancer', ['95% v1, 5% v2'], 'none'),
      box('c', C2, 70, W, 'v2 canary', ['errors 0.1%', 'p99 900 ms'], 'bad', { badge: 'over limit' }),
      box('a', C3, 70, W, 'automatic rollback', ['back to 100% v1'], 'warn'),
    ],
    arrows: [{ from: 'l', to: 'c', fs: 'r', ts: 'l' }, { from: 'c', to: 'a', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A canary sends a small share of traffic to the new version, and compares error rate, p99 and event loop lag. If a metric crosses its threshold, the release rolls back automatically.',
  },
  {
    h: 230,
    line: 'expand → deploy → contract',
    result: { text: 'old and new code both work', tone: 'ok' },
    cards: [
      box('e', C1, 70, W, '1. expand', ['ADD COLUMN', 'nullable'], 'new'),
      box('n', C2, 70, W, '2. deploy + backfill', ['code reads both'], 'ok'),
      box('c', C3, 70, W, '3. contract later', ['DROP old column'], 'warn', { badge: 'next release' }),
    ],
    arrows: [{ from: 'e', to: 'n', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'n', to: 'c', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'During a rollout, old and new code run against one database. So add the new column first, in a backward compatible way. Deploy code that uses it. Remove the old column in a later release.',
  },
];

/* ---------- right-size and watch ---------- */
const memFrames = [
  {
    h: 250,
    line: 'limits.memory: 512Mi  --max-old-space-size=384',
    result: { text: 'heap at ~75% of the limit', tone: 'ok' },
    texts: [{ x: 14, y: 60, t: 'container memory limit 512 Mi' }, { x: 14, y: 166, t: 'heap = limit  →  OOMKilled' }],
    cards: [
      { id: 'h', x: 14, y: 76, w: 459, h: 34, title: 'V8 heap 384 Mi', tone: 'ok' },
      { id: 'n', x: 473, y: 76, w: 153, h: 34, title: 'Buffers, native', tone: 'new' },
      { id: 'h2', x: 14, y: 182, w: 516, h: 34, title: 'V8 heap 512 Mi', tone: 'bad' },
      { id: 'n2', x: 530, y: 182, w: 96, h: 34, title: '+ native', tone: 'bad', badge: 'over' },
    ],
    note: 'Node runs JavaScript on one thread, so a pod rarely needs more than one CPU. Scale out with more pods. Set the heap to about 70 to 75% of the memory limit, so Buffers and native memory fit.',
  },
  {
    h: 230,
    line: 'HPA: min 3, max 10, CPU 70%',
    result: { text: 'scale out on a leading signal', tone: 'ok' },
    cards: [
      box('s', C1, 70, W, 'signal', ['CPU, or event loop', 'utilisation'], 'new'),
      box('h', C2, 70, W, 'autoscaler', ['min 3, max 10'], 'ok'),
      box('p', C3, 70, W, 'more pods', ['spread across zones'], 'ok'),
    ],
    arrows: [{ from: 's', to: 'h', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'h', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'An autoscaler adds pods when a signal rises. CPU is a fair default. Event loop utilisation often warns sooner for I/O-heavy services. Keep a minimum for availability, and a maximum to cap the bill.',
  },
  {
    h: 230,
    line: 'logger.info({ requestId, route, ms })',
    result: { text: 'alert on symptoms', tone: 'warn' },
    cards: [
      box('l', C1, 70, W, 'JSON logs to stdout', ['request id per line'], 'ok'),
      box('t', C2, 70, W, 'metrics and traces', ['OpenTelemetry'], 'new'),
      box('a', C3, 70, W, 'alerts', ['error rate, p99'], 'warn'),
    ],
    arrows: [{ from: 'l', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 'a', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Write JSON logs to stdout, and let the platform collect them. Export metrics and traces. Alert on what users feel, such as errors and p99. Use lag and memory to explain an alert.',
  },
];

export const NODE_DEPLOY_SCENES = [
  { id: 'image', label: 'Build the image', title: 'From source to a small, safe image', stage: BoardStage, frames: imageFrames },
  { id: 'config', label: 'Config and secrets', title: 'One image, many environments', stage: BoardStage, frames: configFrames },
  { id: 'rollout', label: 'Zero-downtime rollout', title: 'Replace pods without dropping requests', stage: BoardStage, frames: rolloutFrames },
  { id: 'runtime', label: 'Right-size and watch', title: 'Resources, scaling and signals', stage: BoardStage, frames: memFrames },
];
