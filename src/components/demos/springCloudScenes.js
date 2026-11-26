// Frame data for the Spring Cloud walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- gateway, discovery, load balancing ---------- */
const client = (lines, o = {}) => ({ id: 'client', x: 14, y: 60, w: 150, title: 'Client', lines, tone: 'new', ...o });
const gw = (lines, o = {}) => ({ id: 'gw', x: 196, y: 44, w: 196, title: 'Spring Cloud Gateway', lines, mono: true, tone: 'none', ...o });
const reg = (lines, o = {}) => ({ id: 'reg', x: 196, y: 184, w: 196, title: 'Service registry', lines, mono: true, tone: 'none', ...o });
const inst = (n, lines, o = {}) => ({ id: `i${n}`, x: 430, y: 30 + (n - 1) * 72, w: 196, title: `account-service #${n}`, lines, tone: 'none', ...o });
const insts = (o = {}) => [inst(1, ['10.0.1.5'], o[1] || { dim: true }), inst(2, ['10.0.1.6'], o[2] || { dim: true }), inst(3, ['10.0.1.7'], o[3] || { dim: true })];
const ROUTE = ['Path=/api/accounts/**', 'uri: lb://account-service'];

const gatewayFrames = [
  {
    h: 280,
    line: 'GET /api/accounts/42',
    result: { text: 'route "accounts" matches', tone: 'ok' },
    cards: [client(['GET /api/accounts/42']), gw(ROUTE, { tone: 'new', badge: 'entry point' }), reg(['not asked yet'], { dim: true }), ...insts()],
    arrows: [{ from: 'client', to: 'gw', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'The client calls one public address. Spring Cloud Gateway is the single entry point. Each route has a predicate (Path=/api/accounts/**) that decides which requests it takes, and a uri that names the target.',
  },
  {
    h: 280,
    line: 'filters: JWT, rate limit, correlation id',
    result: { text: 'passed all filters', tone: 'ok' },
    cards: [
      client(['GET /api/accounts/42']),
      gw(['JWT valid', 'rate limit 20/s: ok', 'X-Correlation-Id added'], { tone: 'ok', badge: 'filters' }),
      { id: 'rej', x: 14, y: 184, w: 150, title: 'If a filter fails', lines: ['bad token: 401', 'too many: 429'], tone: 'warn' },
      ...insts(),
    ],
    arrows: [{ from: 'client', to: 'gw', fs: 'r', ts: 'l', tone: 'new' }, { from: 'gw', to: 'rej', fs: 'b', ts: 'r', tone: 'warn', dash: true }],
    note: 'Gateway filters run before the request is forwarded: check the JWT, apply a rate limit (backed by Redis), add a correlation id. These edge concerns live here once, instead of in every service.',
  },
  {
    h: 280,
    line: 'lb://account-service  →  which instances?',
    result: { text: '3 healthy instances', tone: 'ok' },
    cards: [client(['waiting']), gw(['lb://account-service'], { tone: 'new' }), reg(['account-service:', '10.0.1.5  10.0.1.6', '10.0.1.7'], { tone: 'ok', badge: 'healthy' }), ...insts({ 1: { tone: 'ok' }, 2: { tone: 'ok' }, 3: { tone: 'ok' } })],
    arrows: [{ from: 'gw', to: 'reg', fs: 'b', ts: 't', tone: 'ok', label: 'which instances?' }],
    note: 'lb://account-service is a logical name, not an address. Instances come and go with autoscaling and deployments. So the gateway asks the registry (Eureka, Consul, or Kubernetes DNS) which instances are healthy now.',
  },
  {
    h: 280,
    line: 'LoadBalancer: round robin',
    result: { text: 'forwarded to #2', tone: 'ok' },
    cards: [client(['waiting']), gw(['LoadBalancer', 'round robin: pick #2'], { tone: 'ok' }), reg(['cached instance list'], { tone: 'none' }), ...insts({ 1: { tone: 'none' }, 2: { tone: 'ok', badge: 'chosen' }, 3: { tone: 'none' } })],
    arrows: [{ from: 'gw', to: 'i2', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Spring Cloud LoadBalancer picks one instance on the client side, round robin by default. The next request may go to a different instance. That is why services should be stateless.',
  },
  {
    h: 280,
    line: 'restClient.get().uri("http://ledger-service/…")',
    result: { text: 'same pattern inside', tone: 'ok' },
    cards: [
      { id: 'acc', x: 14, y: 52, w: 190, title: 'account-service #2', lines: ['RestClient (@LoadBalanced)', 'http://ledger-service'], tone: 'new' },
      { id: 'dns', x: 270, y: 52, w: 170, title: 'Registry or K8s DNS', lines: ['ledger-service', '→ 10.0.2.4'], mono: true, tone: 'ok' },
      { id: 'led', x: 270, y: 180, w: 170, title: 'ledger-service #1', lines: ['10.0.2.4'], tone: 'ok' },
      { id: 'k8s', x: 480, y: 52, w: 146, title: 'On Kubernetes', lines: ['Services and DNS', 'already do this:', 'often no Eureka'], tone: 'none' },
    ],
    arrows: [{ from: 'acc', to: 'dns', fs: 'r', ts: 'l', tone: 'ok', label: 'resolve' }, { from: 'acc', to: 'led', fs: 'b', ts: 'l', tone: 'ok', label: 'call' }],
    note: 'Calls between services use the same pattern. A RestClient or OpenFeign client calls http://ledger-service, and the load balancer resolves the name. On Kubernetes, Services and DNS already give discovery and load balancing.',
  },
];

/* ---------- circuit breaker state machine ---------- */
const closed = (lines, o = {}) => ({ id: 'closed', x: 14, y: 44, w: 180, title: 'CLOSED', lines, mono: true, tone: 'none', ...o });
const open = (lines, o = {}) => ({ id: 'open', x: 446, y: 44, w: 180, title: 'OPEN', lines, mono: true, tone: 'none', ...o });
const half = (lines, o = {}) => ({ id: 'half', x: 230, y: 176, w: 180, title: 'HALF_OPEN', lines, mono: true, tone: 'none', ...o });

const breakerFrames = [
  {
    h: 260,
    line: 'account-service  →  payment-service',
    result: { text: 'calls pass through', tone: 'ok' },
    cards: [closed(['last 10 calls:', '✓✓✓✓✓✓✓✓✓✓'], { tone: 'ok', badge: 'now' }), open(['fail fast'], { dim: true }), half(['trial calls'], { dim: true })],
    note: 'Closed is the normal state. Calls to the payment service pass through. Resilience4j records successes and failures in a sliding window, here the last 10 calls.',
  },
  {
    h: 260,
    line: 'payment-service: timeouts and 503s',
    result: { text: 'breaker trips', tone: 'bad' },
    cards: [closed(['last 10 calls:', '✓✓✓✓✗✗✗✗✗✗', '6 of 10 failed'], { tone: 'warn' }), open(['fail fast'], { tone: 'bad', badge: 'now' }), half(['trial calls'], { dim: true })],
    arrows: [{ from: 'closed', to: 'open', fs: 'r', ts: 'l', tone: 'bad', label: 'failure rate ≥ 50%' }],
    note: 'The payment service gets slow and starts failing. When the failure rate in the window reaches the threshold (failureRateThreshold = 50 percent), the breaker opens.',
  },
  {
    h: 260,
    line: 'pay(request)   // while OPEN',
    result: { text: 'fallback: payment pending', tone: 'warn' },
    cards: [
      closed(['…'], { dim: true }),
      open(['CallNotPermitted', 'no call is made', 'waits 30 s'], { tone: 'bad', badge: 'now' }),
      { id: 'caller', x: 14, y: 176, w: 180, title: 'account-service', lines: ['fallback runs at once', 'no thread waits'], tone: 'warn' },
      { id: 'pay', x: 446, y: 176, w: 180, title: 'payment-service', lines: ['not called', 'time to recover'], tone: 'none' },
    ],
    arrows: [{ from: 'open', to: 'pay', fs: 'b', ts: 't', tone: 'bad', cross: true }],
    note: 'While open, calls fail at once with CallNotPermittedException, without touching the payment service. No thread waits for a timeout, and the failing service gets time to recover. The caller runs its fallback.',
  },
  {
    h: 260,
    line: 'after waitDurationInOpenState = 30s',
    result: { text: '3 trial calls', tone: 'warn' },
    cards: [closed(['…'], { dim: true }), open(['waited 30 s'], { tone: 'none' }), half(['3 trial calls allowed', 'others still rejected'], { tone: 'warn', badge: 'now' }),
      { id: 'pay', x: 446, y: 176, w: 180, title: 'payment-service', lines: ['gets the trial calls'], tone: 'new' }],
    arrows: [{ from: 'open', to: 'half', fs: 'l', ts: 't', tone: 'warn', label: 'after 30 s' }, { from: 'half', to: 'pay', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'After the wait, the breaker turns half-open. It lets a few trial calls through (permittedNumberOfCallsInHalfOpenState) to test whether the payment service has recovered.',
  },
  {
    h: 260,
    line: 'trial calls succeed',
    result: { text: 'closed again', tone: 'ok' },
    cards: [closed(['window reset:', '✓✓✓'], { tone: 'ok', badge: 'now' }), open(['if trials fail:', 'open again'], { tone: 'none' }), half(['3 of 3 succeeded'], { tone: 'ok' }),
      { id: 'pay', x: 446, y: 176, w: 180, title: 'payment-service', lines: ['healthy'], tone: 'ok' }],
    arrows: [{ from: 'half', to: 'closed', fs: 'l', ts: 'b', tone: 'ok', label: 'trials pass' }],
    note: 'If the trial calls succeed, the breaker closes and traffic resumes. If they fail, it opens again for another wait. Combine it with timeouts, bounded retries and bulkheads; one annotation is not enough.',
  },
];

/* ---------- central configuration ---------- */
const git = (lines, o = {}) => ({ id: 'git', x: 14, y: 44, w: 196, title: 'Git repository', lines, mono: true, tone: 'ok', ...o });
const srv = (lines, o = {}) => ({ id: 'srv', x: 250, y: 44, w: 160, title: 'Config Server', lines, tone: 'none', ...o });
const svc = (lines, o = {}) => ({ id: 'svc', x: 456, y: 44, w: 170, title: 'account-service', lines, tone: 'none', ...o });
const FILES = ['application.yml', 'account-service.yml', 'account-service-prod.yml'];

const configFrames = [
  {
    h: 250,
    line: 'config lives in Git',
    result: { text: 'versioned and reviewed', tone: 'ok' },
    cards: [git(FILES, { badge: 'source of truth' }), srv(['reads the repo', 'serves /{app}/{profile}'], { tone: 'new' }), svc(['not started'], { dim: true })],
    arrows: [{ from: 'srv', to: 'git', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'The settings for every service and environment live in a Git repository: application.yml is shared, account-service-prod.yml is for one service in production. Every change is versioned, reviewed and auditable.',
  },
  {
    h: 250,
    line: 'spring.config.import=configserver:',
    result: { text: 'fee-rate: 0.01 loaded', tone: 'ok' },
    cards: [git(FILES), srv(['merges the files', 'for account-service, prod'], { tone: 'ok' }), svc(['name: account-service', 'profile: prod', 'GET /account-service/prod'], { tone: 'new' })],
    arrows: [{ from: 'svc', to: 'srv', fs: 'l', ts: 'r', tone: 'new' }],
    note: 'On startup the service asks the Config Server for its settings, by application name and profile. It receives the merged properties. They take precedence over the files packaged in the jar.',
  },
  {
    h: 250,
    line: 'POST /actuator/refresh',
    result: { text: 'fee-rate: 0.02 live', tone: 'ok' },
    cards: [git([{ t: 'fee-rate: 0.01', strike: true }, 'fee-rate: 0.02'], { tone: 'warn', badge: 'new commit' }), srv(['serves the new value'], { tone: 'ok' }), svc(['@RefreshScope beans', 'rebuilt'], { tone: 'ok', badge: 'refreshed' }),
      { id: 'bus', x: 250, y: 176, w: 376, title: 'Spring Cloud Bus (optional)', lines: ['broadcasts the refresh to every instance'], tone: 'none' }],
    arrows: [{ from: 'srv', to: 'svc', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Someone changes a value in Git. Running instances see it only after a refresh: @RefreshScope beans are rebuilt on POST /actuator/refresh, or Spring Cloud Bus tells every instance. Otherwise a restart picks it up.',
  },
  {
    h: 250,
    line: 'secrets: never in plain Git',
    result: { text: 'injected at runtime', tone: 'ok' },
    cards: [git(['fee-rate: 0.02', 'no passwords here']), srv(['non-secret settings'], { tone: 'ok' }), svc(['reads secrets from', 'env vars or files'], { tone: 'ok' }),
      { id: 'vault', x: 250, y: 176, w: 200, title: 'Vault or K8s Secret', lines: ['db password', 'API keys'], tone: 'new', badge: 'secrets' }],
    arrows: [{ from: 'srv', to: 'svc', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'vault', to: 'svc', fs: 'r', ts: 'b', tone: 'new' }],
    note: 'Secrets do not belong in Git. Use Config Server encryption, Vault, or Kubernetes Secrets. On Kubernetes, many teams skip the Config Server and mount ConfigMaps and Secrets as files or environment variables.',
  },
];

export const SPRING_CLOUD_SCENES = [
  { id: 'gateway', label: 'Gateway and discovery', title: 'A request through the gateway, discovery and client-side load balancing', stage: BoardStage, frames: gatewayFrames },
  { id: 'breaker', label: 'Circuit breaker', title: 'Resilience4j circuit breaker: closed, open, half-open', stage: BoardStage, frames: breakerFrames },
  { id: 'config', label: 'Central configuration', title: 'Spring Cloud Config: services fetch their settings from one place', stage: BoardStage, frames: configFrames },
];
