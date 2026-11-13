// Frame data for the Spring observability walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_OBS_SCENES = [
  {
    id: 'trace',
    label: 'Distributed trace',
    title: 'One trace id follows a request through every service',
    frames: [
      {
        note: 'A request enters the API gateway. Micrometer Tracing creates a trace id (4bf9...) and a first span for the gateway. The trace id is added to the logging context (MDC) so every log line of this request carries it.',
        boxes: [b('c', 'Client', ['POST /transfers'], 'new'), b('g', 'API gateway', ['trace 4bf9, span A', 'log: traceId=4bf9'], 'ok', 'root span')],
        deps: [d('Client', 'API gateway', 'request', 'ok')],
      },
      {
        note: 'The gateway calls the transfer service. The tracing instrumentation of the HTTP client adds a W3C traceparent header carrying the trace id and the current span id. The transfer service reads it and continues the same trace with a new child span B.',
        boxes: [b('g', 'API gateway', ['span A'], 'ok'), b('t', 'Transfer service', ['same trace 4bf9, span B', 'parent = A'], 'ok', 'child span')],
        deps: [d('API gateway', 'Transfer service', 'traceparent: 4bf9-A', 'ok')],
      },
      {
        note: 'The transfer service calls the ledger service, and also publishes a message to a broker: the trace context travels in the message headers too, so asynchronous hops stay in the same trace. The ledger service is slow today.',
        boxes: [b('t', 'Transfer service', ['span B'], 'ok'), b('l', 'Ledger service', ['span C: 1900 ms', 'database query slow'], 'bad', 'slow span'), b('k', 'Message broker', ['trace context in headers'], 'ok')],
        deps: [d('Transfer service', 'Ledger service', 'traceparent', 'ok'), d('Transfer service', 'Message broker', 'publish with headers', 'ok')],
      },
      {
        note: 'Each service exports its spans to a tracing backend (Zipkin, Tempo, Jaeger) through OpenTelemetry. Searching for trace 4bf9 shows the whole tree with timings, so you immediately see span C in the ledger service is where the 2 seconds went. Searching the logs of any service for the same traceId finds the matching log lines.',
        boxes: [b('x', 'Trace backend', ['trace 4bf9', 'A 2100 ms > B 2050 ms > C 1900 ms'], 'ok', 'timeline'), b('l', 'Ledger service', ['culprit found'], 'warn')],
        deps: [d('Ledger service', 'Trace backend', 'export spans', 'ok')],
      },
    ],
  },
  {
    id: 'metrics',
    label: 'Metrics and alerts',
    title: 'Micrometer collects numbers, Prometheus stores them, alerts wake you up',
    frames: [
      {
        note: 'The application records metrics with Micrometer: JVM memory and GC, HTTP server request timings, connection pool usage, and your own business counters such as transfers completed. Actuator exposes them at /actuator/prometheus.',
        boxes: [b('a', 'Transfer service', ['http.server.requests', 'hikaricp connections', 'transfers.completed'], 'new'), b('m', 'Metrics endpoint', ['/actuator/prometheus'], 'ok')],
        deps: [d('Transfer service', 'Metrics endpoint', 'Micrometer registry', 'ok')],
      },
      {
        note: 'Prometheus scrapes that endpoint every 15 seconds and stores the time series. Pull-based collection means the application does not need to know where the monitoring system is.',
        boxes: [b('p', 'Prometheus server', ['stores time series', 'scrape every 15 s'], 'ok'), b('m', 'Metrics endpoint', ['current values'], 'ok')],
        deps: [d('Prometheus server', 'Metrics endpoint', 'scrape', 'ok')],
      },
      {
        note: 'Dashboards (Grafana) show the signals that matter: request rate, error rate, latency percentiles (p95, p99, not averages), and saturation (pool usage, queue depth, CPU). Use low-cardinality tags: a user id as a tag would create millions of series.',
        boxes: [b('d', 'Dashboard', ['rate, errors, duration, saturation', 'p99 latency: 1.9 s'], 'warn', 'p99 rising'), b('p', 'Prometheus server', ['queries'], 'ok')],
        deps: [d('Dashboard', 'Prometheus server', 'query', 'ok')],
      },
      {
        note: 'An alert rule fires when the error rate is above 2 percent for 5 minutes, or the connection pool is exhausted. Alert on symptoms users feel (errors, latency) rather than on every cause, and link each alert to a runbook and to the traces that explain it.',
        boxes: [b('p', 'Prometheus server', ['rule: error rate > 2% for 5 min'], 'bad', 'firing'), b('n', 'Alert channel', ['page the on-call engineer', 'runbook + trace links'], 'ok')],
        deps: [d('Prometheus server', 'Alert channel', 'notify', 'bad')],
      },
    ],
  },
  {
    id: 'health',
    label: 'Health probes',
    title: 'Liveness and readiness tell the platform what to restart and what to route to',
    frames: [
      {
        note: 'Kubernetes asks each pod two questions. Liveness: is the process alive, or stuck and in need of a restart? Readiness: can it take traffic right now? Spring Boot exposes /actuator/health/liveness and /actuator/health/readiness for them.',
        boxes: [b('k', 'Kubernetes probe', ['liveness and readiness checks'], 'new'), b('a', 'Transfer service', ['/actuator/health/liveness', '/actuator/health/readiness'], 'ok')],
        deps: [d('Kubernetes probe', 'Transfer service', 'GET health', 'ok')],
      },
      {
        note: 'During startup the application is alive but not ready: it is still warming caches and running migrations. Readiness reports OUT_OF_SERVICE, so the load balancer sends no traffic yet and no requests fail.',
        boxes: [b('a', 'Transfer service', ['starting: readiness DOWN', 'liveness UP'], 'warn', 'not ready'), b('k', 'Kubernetes probe', ['waits, does not route traffic'], 'ok')],
        deps: [],
      },
      {
        note: 'A dependency fails: the database is unreachable. Readiness goes DOWN so the pod is taken out of rotation and callers go to healthy pods. Liveness stays UP, because restarting this pod will not fix the database. Keep external dependencies out of the liveness check, or a database outage restarts every pod at once.',
        boxes: [b('a', 'Transfer service', ['database down: readiness DOWN', 'liveness still UP'], 'warn'), b('d', 'Database', ['unreachable'], 'bad'), b('k', 'Kubernetes probe', ['removed from rotation, not restarted'], 'ok')],
        deps: [d('Transfer service', 'Database', 'health check fails', 'bad')],
      },
      {
        note: 'If the application deadlocks and cannot answer even the liveness endpoint, the probe fails repeatedly and Kubernetes restarts the container. On shutdown (server.shutdown=graceful) readiness turns DOWN first, in-flight requests finish, and then the pod stops.',
        boxes: [b('a', 'Transfer service', ['deadlocked: liveness fails'], 'bad'), b('k', 'Kubernetes probe', ['restart the container'], 'ok', 'restart')],
        deps: [d('Kubernetes probe', 'Transfer service', 'restart', 'warn')],
      },
    ],
  },
];
