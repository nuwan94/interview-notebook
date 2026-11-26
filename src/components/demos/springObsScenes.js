// Frame data for the Spring observability walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- distributed trace ---------- */
const cl = (lines, o = {}) => ({ id: 'client', x: 14, y: 52, w: 100, title: 'Client', lines, tone: 'new', ...o });
const gw = (lines, o = {}) => ({ id: 'gw', x: 160, y: 44, w: 130, title: 'API gateway', lines, tone: 'none', ...o });
const tr = (lines, o = {}) => ({ id: 'tr', x: 340, y: 44, w: 130, title: 'Transfer service', lines, tone: 'none', ...o });
const lg = (lines, o = {}) => ({ id: 'lg', x: 516, y: 44, w: 110, title: 'Ledger service', lines, tone: 'none', ...o });

const X0 = 120;
const SCALE = 0.24; // px per ms
const tx = (ms) => X0 + ms * SCALE;
let uid = 0;
const span = (y, t0, t1, title, tone = 'ok', o = {}) => ({ id: `s${uid++}`, x: tx(t0), y, w: (t1 - t0) * SCALE, h: 30, title, tone, ...o });
const lane = (y, t) => ({ x: 14, y: y + 20, t });

const traceFrames = [
  {
    h: 220,
    line: 'POST /transfers',
    result: { text: 'trace 4bf9 starts', tone: 'ok' },
    cards: [cl(['POST /transfers']), gw(['trace 4bf9', 'span A (root)'], { tone: 'new', badge: 'root span' }), tr(['not called yet'], { dim: true }), lg(['not called yet'], { dim: true }),
      { id: 'log', x: 160, y: 150, w: 310, title: 'gateway log line', lines: ['INFO accepted  traceId=4bf9 spanId=A'], mono: true, tone: 'none' }],
    arrows: [{ from: 'client', to: 'gw', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'A request enters the API gateway. Micrometer Tracing creates a trace id (4bf9) and a first span, A. The ids go into the logging context (MDC), so every log line of this request carries them.',
  },
  {
    h: 220,
    line: 'gateway  →  transfer service',
    result: { text: 'same trace, child span B', tone: 'ok' },
    cards: [cl(['waiting']), gw(['span A'], { tone: 'ok' }), tr(['trace 4bf9', 'span B, parent A'], { tone: 'new', badge: 'child' }), lg(['not called yet'], { dim: true }),
      { id: 'hdr', x: 160, y: 150, w: 310, title: 'HTTP header on the call', lines: ['traceparent: 00-4bf9…-A-01'], mono: true, tone: 'new' }],
    arrows: [{ from: 'gw', to: 'tr', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The gateway calls the transfer service. The instrumented HTTP client adds a W3C traceparent header with the trace id and the current span id. The transfer service reads it and continues the same trace with a child span, B.',
  },
  {
    h: 240,
    line: 'transfer  →  ledger, and a message to the broker',
    result: { text: 'ledger takes 1900 ms', tone: 'bad' },
    cards: [cl(['waiting']), gw(['span A'], { tone: 'ok' }), tr(['span B'], { tone: 'ok' }), lg(['span C', 'slow query'], { tone: 'bad', badge: 'slow' }),
      { id: 'bk', x: 340, y: 160, w: 286, title: 'Message broker', lines: ['message headers carry traceparent'], tone: 'ok' }],
    arrows: [{ from: 'tr', to: 'lg', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'tr', to: 'bk', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'The transfer service calls the ledger service, and publishes a message. The trace context also travels in message headers, so asynchronous hops stay in the same trace. Today the ledger service is slow.',
  },
  {
    h: 250,
    line: 'trace backend: search 4bf9',
    result: { text: 'culprit: span C', tone: 'warn' },
    texts: [lane(40, 'gateway'), lane(84, 'transfer'), lane(128, 'ledger'), { x: 540, y: 196, t: 'time  →' }],
    cards: [
      span(40, 0, 2100, 'A  POST /transfers   2100 ms'),
      span(84, 30, 2080, 'B  transfer()   2050 ms'),
      span(128, 120, 2020, 'C  select … for update   1900 ms', 'bad'),
      { id: 'lgl', x: 14, y: 210, w: 612, h: 30, title: 'ledger log, same traceId:  WARN slow query 1.8 s  traceId=4bf9 spanId=C', tone: 'warn' },
    ],
    note: 'Each service exports its spans (through OpenTelemetry) to a backend such as Tempo, Zipkin or Jaeger. The backend joins them into one waterfall. Span C in the ledger is where the time went. Searching the logs for traceId=4bf9 finds the matching log line.',
  },
];

/* ---------- metrics to alerts ---------- */
const app = (lines, o = {}) => ({ id: 'app', x: 14, y: 44, w: 190, title: 'Transfer service', lines, mono: true, tone: 'none', ...o });
const ep = (lines, o = {}) => ({ id: 'ep', x: 14, y: 160, w: 330, title: 'GET /actuator/prometheus', lines, mono: true, tone: 'none', ...o });
const prom = (lines, o = {}) => ({ id: 'prom', x: 270, y: 44, w: 150, title: 'Prometheus', lines, tone: 'none', ...o });
const graf = (lines, o = {}) => ({ id: 'graf', x: 476, y: 44, w: 150, title: 'Grafana', lines, tone: 'none', ...o });

const METER_LINES = ['Counter transfers', 'Timer   http requests', 'Gauge   pool active'];
const EP_LINES = ['transfers_completed_total 9120', 'hikaricp_connections_active 9'];

const metricsFrames = [
  {
    h: 250,
    line: 'Counter.builder("transfers.completed")',
    result: { text: 'meters recorded', tone: 'ok' },
    cards: [app(METER_LINES, { tone: 'new' }), ep(EP_LINES, { tone: 'ok' }), prom(['not yet'], { dim: true }), graf(['not yet'], { dim: true })],
    arrows: [{ from: 'app', to: 'ep', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'The service records metrics with Micrometer: JVM memory and GC, HTTP request timings, the connection pool, and business counters such as transfers completed. Actuator shows the current values at /actuator/prometheus.',
  },
  {
    h: 250,
    line: 'scrape_interval: 15s',
    result: { text: 'pulled every 15 s', tone: 'ok' },
    cards: [app(METER_LINES), ep(EP_LINES, { tone: 'ok' }), prom(['stores time series'], { tone: 'new', badge: 'scrape' }), graf(['not yet'], { dim: true })],
    arrows: [{ from: 'prom', to: 'ep', fs: 'b', ts: 'r', tone: 'ok' }],
    note: 'Prometheus scrapes that endpoint every 15 seconds and stores each value over time. Collection is pull-based, so the service does not need to know where the monitoring system is.',
  },
  {
    h: 250,
    line: 'histogram_quantile(0.99, …)',
    result: { text: 'p99 rising', tone: 'warn' },
    cards: [app(METER_LINES), ep(EP_LINES), prom(['stores time series'], { tone: 'ok' }), graf(['average   95 ms', 'p50       45 ms', 'p99      1.9 s'], { tone: 'warn', mono: true, badge: 'p99' }),
      { id: 'sig', x: 400, y: 160, w: 226, title: 'Golden signals', lines: ['latency, traffic', 'errors, saturation'], tone: 'none' }],
    arrows: [{ from: 'graf', to: 'prom', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'A Grafana dashboard queries Prometheus. The average looks fine at 95 ms, but p99 is 1.9 s: one request in a hundred is very slow. Percentiles show what the slowest users feel; averages hide it.',
  },
  {
    h: 250,
    line: 'tag("userId", id)   // never',
    result: { text: 'series explode', tone: 'bad' },
    cards: [
      { id: 'good', x: 14, y: 44, w: 290, title: 'tag("outcome", …)', lines: ['outcome=success', 'outcome=failure', '2 time series'], mono: true, tone: 'ok', badge: 'low' },
      { id: 'bad', x: 336, y: 44, w: 290, title: 'tag("userId", …)', lines: ['userId=u-000001', 'userId=u-000002  …', '1,000,000 time series'], mono: true, tone: 'bad', badge: 'high' },
      { id: 'where', x: 14, y: 170, w: 612, h: 40, title: 'per-user detail goes into logs and trace tags, not metric tags', tone: 'none' },
    ],
    note: 'Every distinct tag value creates a separate time series. A tag with a few values (outcome, status, method) is cheap. A user id or account number creates millions of series and can bring down the metrics backend.',
  },
  {
    h: 250,
    line: 'error rate > 2% for 5 min',
    result: { text: 'alert firing', tone: 'bad' },
    cards: [app(METER_LINES), ep(EP_LINES), prom(['rule: errors > 2%', 'for 5 min'], { tone: 'bad', badge: 'firing' }), graf(['p99 1.9 s'], { tone: 'warn' }),
      { id: 'pager', x: 400, y: 160, w: 226, title: 'On-call engineer', lines: ['runbook link', 'dashboard and trace links'], tone: 'new' }],
    arrows: [{ from: 'prom', to: 'pager', fs: 'b', ts: 't', tone: 'bad' }],
    note: 'An alert rule fires when the error rate stays above 2 percent for 5 minutes. Alert on symptoms users feel (errors, latency, stuck payments), not on every cause. Each alert links to a runbook, a dashboard and example traces.',
  },
];

/* ---------- health probes ---------- */
const lb = (o = {}) => ({ id: 'lb', x: 14, y: 52, w: 140, title: 'Load balancer', lines: ['routes traffic'], tone: 'none', ...o });
const pod = (live, ready, o = {}) => ({ id: 'pod', x: 210, y: 44, w: 220, title: 'Transfer service pod', lines: [`liveness   ${live}`, `readiness  ${ready}`], mono: true, tone: 'ok', ...o });
const kube = (lines, o = {}) => ({ id: 'kube', x: 210, y: 170, w: 220, title: 'kubelet (probes)', lines, tone: 'none', ...o });
const db = (lines, o = {}) => ({ id: 'db', x: 486, y: 52, w: 140, title: 'Database', lines, tone: 'ok', ...o });

const healthFrames = [
  {
    h: 250,
    line: 'GET /actuator/health/liveness  and  /readiness',
    result: { text: 'both UP: gets traffic', tone: 'ok' },
    cards: [lb(), pod('UP', 'UP'), kube(['asks both, every 10 s']), db(['reachable'])],
    arrows: [{ from: 'lb', to: 'pod', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'kube', to: 'pod', fs: 't', ts: 'b', tone: 'new' }, { from: 'pod', to: 'db', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Kubernetes asks each pod two questions. Liveness: is the process alive, or stuck and in need of a restart? Readiness: can it take traffic now? Spring Boot answers at /actuator/health/liveness and /actuator/health/readiness.',
  },
  {
    h: 250,
    line: 'starting: warming caches, running migrations',
    result: { text: 'no traffic yet', tone: 'warn' },
    cards: [lb(), pod('UP', 'OUT_OF_SERVICE', { tone: 'warn', badge: 'starting' }), kube(['alive: no restart', 'not ready: no traffic']), db(['reachable'])],
    arrows: [{ from: 'lb', to: 'pod', fs: 'r', ts: 'l', tone: 'bad', cross: true }, { from: 'kube', to: 'pod', fs: 't', ts: 'b', tone: 'new' }],
    note: 'While it starts, the service is alive but not ready. Readiness reports OUT_OF_SERVICE, so the load balancer sends it no traffic, and no request fails.',
  },
  {
    h: 250,
    line: 'database unreachable',
    result: { text: 'out of rotation, not restarted', tone: 'warn' },
    cards: [lb({ lines: ['sends to other pods'] }), pod('UP', 'DOWN', { tone: 'warn' }), kube(['readiness DOWN: no traffic', 'liveness UP: no restart']), db(['unreachable'], { tone: 'bad', badge: 'down' })],
    arrows: [{ from: 'lb', to: 'pod', fs: 'r', ts: 'l', tone: 'bad', cross: true }, { from: 'pod', to: 'db', fs: 'r', ts: 'l', tone: 'bad', cross: true }, { from: 'kube', to: 'pod', fs: 't', ts: 'b', tone: 'new' }],
    note: 'The database goes down. Readiness turns DOWN, so the pod leaves the rotation. Liveness stays UP, because a restart would not fix the database. If liveness checked the database, every pod would restart at once.',
  },
  {
    h: 250,
    line: 'deadlock: the process stops answering',
    result: { text: 'container restarted', tone: 'bad' },
    cards: [lb({ lines: ['sends to other pods'] }), pod('FAIL', 'FAIL', { tone: 'bad', badge: 'stuck' }), kube(['liveness failed 3 times', 'restart the container'], { tone: 'warn', badge: 'restart' }), db(['reachable'])],
    arrows: [{ from: 'lb', to: 'pod', fs: 'r', ts: 'l', tone: 'bad', cross: true }, { from: 'kube', to: 'pod', fs: 't', ts: 'b', tone: 'warn' }],
    note: 'If the service deadlocks and cannot even answer liveness, the probe fails several times and Kubernetes restarts the container. On shutdown (server.shutdown=graceful), readiness turns DOWN first, requests in flight finish, then the pod stops.',
  },
];

export const SPRING_OBS_SCENES = [
  { id: 'trace', label: 'Distributed trace', title: 'One trace id follows a request through every service', stage: BoardStage, frames: traceFrames },
  { id: 'metrics', label: 'Metrics and alerts', title: 'Micrometer records numbers, Prometheus stores them, alerts page you', stage: BoardStage, frames: metricsFrames },
  { id: 'health', label: 'Health probes', title: 'Liveness decides restarts, readiness decides traffic', stage: BoardStage, frames: healthFrames },
];
