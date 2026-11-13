// Frame data for the Spring Cloud walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_CLOUD_SCENES = [
  {
    id: 'gateway',
    label: 'Gateway and discovery',
    title: 'A request through Spring Cloud Gateway, service discovery and client-side load balancing',
    frames: [
      {
        note: 'The client calls one public address: GET /api/accounts/42. Spring Cloud Gateway is the single entry point. It matches the request against its routes: a predicate (Path=/api/accounts/**) decides which route applies.',
        boxes: [b('c', 'Client', ['GET /api/accounts/42'], 'new'), b('g', 'API gateway', ['route: Path=/api/accounts/**', 'uri: lb://account-service'], 'new', 'entry point')],
        deps: [d('Client', 'API gateway', 'one public address', 'ok')],
      },
      {
        note: 'Gateway filters run before the request is forwarded: validate the JWT, apply a Redis-backed rate limit, add a correlation id, strip a prefix, retry on 503. Cross-cutting edge concerns live here once, instead of in every service.',
        boxes: [b('g', 'API gateway', ['filter: validate JWT', 'filter: rate limit 20 per second', 'filter: add X-Correlation-Id'], 'ok', 'filters'), b('c', 'Client', ['rejected with 401 or 429 if a filter fails'], 'warn')],
        deps: [d('API gateway', 'Client', '401 / 429 on failure', 'warn')],
      },
      {
        note: 'The route target lb://account-service is a logical name, not an address. Instances come and go (autoscaling, deployments), so the gateway asks the service registry (Eureka, Consul or Kubernetes DNS) which instances of account-service are currently healthy.',
        boxes: [b('g', 'API gateway', ['lb://account-service'], 'new'), b('r', 'Service registry', ['account-service:', '10.0.1.5:8080, 10.0.1.6:8080, 10.0.1.7:8080'], 'ok', 'healthy list')],
        deps: [d('API gateway', 'Service registry', 'which instances?', 'ok'), d('Service registry', 'API gateway', 'instance list', 'ok')],
      },
      {
        note: 'Spring Cloud LoadBalancer picks one instance on the client side (round robin by default) and the gateway forwards the request to it. The next request may go to a different instance, which is why services should be stateless.',
        boxes: [b('g', 'API gateway', ['LoadBalancer: round robin'], 'ok'), b('i1', 'Account service instance 1', ['10.0.1.5'], 'none'), b('i2', 'Account service instance 2', ['10.0.1.6: chosen'], 'ok', 'selected'), b('i3', 'Account service instance 3', ['10.0.1.7'], 'none')],
        deps: [d('API gateway', 'Account service instance 2', 'forward request', 'ok')],
      },
      {
        note: 'Service-to-service calls use the same pattern: a RestClient or an OpenFeign interface calls http://ledger-service, the load balancer resolves it through the registry. On Kubernetes, the platform already provides discovery and load balancing (Services and DNS), so Eureka is often unnecessary.',
        boxes: [b('i2', 'Account service instance 2', ['RestClient: GET http://ledger-service/entries'], 'new'), b('r', 'Service registry', ['resolves ledger-service'], 'ok'), b('l', 'Ledger service instance 1', ['10.0.2.4'], 'ok')],
        deps: [d('Account service instance 2', 'Service registry', 'resolve', 'ok'), d('Account service instance 2', 'Ledger service instance 1', 'call', 'ok')],
      },
    ],
  },
  {
    id: 'breaker',
    label: 'Circuit breaker',
    title: 'Resilience4j circuit breaker: closed, open, half-open',
    frames: [
      {
        note: 'Closed (normal): calls from the account service to the payment service pass through while Resilience4j records successes and failures in a sliding window (for example the last 10 calls).',
        boxes: [b('a', 'Account service instance 1', ['calls the payment service'], 'new'), b('cb', 'Circuit breaker', ['state: CLOSED', 'window: 10 calls, 0 failures'], 'ok', 'closed'), b('p', 'Payment service', ['healthy'], 'ok')],
        deps: [d('Account service instance 1', 'Circuit breaker', 'call', 'ok'), d('Circuit breaker', 'Payment service', 'passes through', 'ok')],
      },
      {
        note: 'The payment service becomes slow and starts failing. When the failure rate in the window passes the threshold (failureRateThreshold = 50 percent) the breaker trips.',
        boxes: [b('p', 'Payment service', ['timeouts and 503 errors'], 'bad', 'failing'), b('cb', 'Circuit breaker', ['6 of 10 calls failed: 60 percent', 'threshold 50 percent exceeded'], 'warn', 'tripping')],
        deps: [d('Payment service', 'Circuit breaker', 'failures', 'bad')],
      },
      {
        note: 'Open: calls fail immediately with CallNotPermittedException without touching the payment service. Threads are not held waiting for timeouts, the struggling service gets breathing room, and the caller runs its fallback (cached data, a default, or a clear "try later").',
        boxes: [b('a', 'Account service instance 1', ['fallback: "payment temporarily unavailable"'], 'warn'), b('cb', 'Circuit breaker', ['state: OPEN for 30 seconds', 'fail fast'], 'bad', 'open')],
        deps: [d('Account service instance 1', 'Circuit breaker', 'call', 'warn'), d('Circuit breaker', 'Account service instance 1', 'rejected at once', 'bad')],
      },
      {
        note: 'Half-open: after waitDurationInOpenState the breaker lets a few trial calls through (permittedNumberOfCallsInHalfOpenState). It is testing whether the payment service has recovered.',
        boxes: [b('cb', 'Circuit breaker', ['state: HALF_OPEN', '3 trial calls allowed'], 'warn', 'probing'), b('p', 'Payment service', ['receives the trial calls'], 'new')],
        deps: [d('Circuit breaker', 'Payment service', 'trial calls', 'warn')],
      },
      {
        note: 'If the trial calls succeed the breaker closes and traffic resumes; if they fail it opens again for another wait period. Annotate with @CircuitBreaker(name = "payment", fallbackMethod = "..."), and combine with timeouts, retries (with backoff and jitter) and bulkheads. Order of decorators: retry wraps circuit breaker, which wraps rate limiter, bulkhead and time limiter.',
        boxes: [b('cb', 'Circuit breaker', ['state: CLOSED again', 'trial calls succeeded'], 'ok', 'recovered'), b('p', 'Payment service', ['healthy'], 'ok')],
        deps: [d('Circuit breaker', 'Payment service', 'normal traffic', 'ok')],
      },
    ],
  },
  {
    id: 'config',
    label: 'Central configuration',
    title: 'Spring Cloud Config: services fetch their settings from one place',
    frames: [
      {
        note: 'Configuration for every service and environment lives in a Git repository: application.yml (shared), account-service-prod.yml and so on. Changes are versioned, reviewed and auditable.',
        boxes: [b('r', 'Git repository', ['application.yml', 'account-service.yml', 'account-service-prod.yml'], 'ok', 'source of truth'), b('s', 'Config server', ['Spring Cloud Config Server', 'serves /account-service/prod'], 'new')],
        deps: [d('Config server', 'Git repository', 'clone and read', 'ok')],
      },
      {
        note: 'On startup the account service contacts the Config server (spring.config.import=configserver:) with its application name and profile, and receives the merged properties. They sit in the Environment with higher precedence than the packaged files.',
        boxes: [b('a', 'Account service instance 1', ['name: account-service', 'profile: prod'], 'new'), b('s', 'Config server', ['returns merged properties'], 'ok')],
        deps: [d('Account service instance 1', 'Config server', 'GET /account-service/prod', 'ok'), d('Config server', 'Account service instance 1', 'properties', 'ok')],
      },
      {
        note: 'Someone changes a value in Git. Running instances do not see it until refreshed: beans marked @RefreshScope are rebuilt on POST /actuator/refresh, or Spring Cloud Bus broadcasts a refresh to all instances. Otherwise a restart picks it up.',
        boxes: [b('r', 'Git repository', ['fee-rate: 0.02 (changed)'], 'warn', 'new commit'), b('a', 'Account service instance 1', ['POST /actuator/refresh', '@RefreshScope beans rebuilt'], 'ok', 'refreshed')],
        deps: [d('Config server', 'Account service instance 1', 'new values', 'ok')],
      },
      {
        note: 'Secrets do not belong in Git. Use Config server encryption, Vault, or the platform: Kubernetes ConfigMaps and Secrets with the Spring Cloud Kubernetes or config tree import. On Kubernetes many teams skip the Config server entirely and mount ConfigMaps and environment variables.',
        boxes: [b('v', 'Config: secret store', ['Vault or Kubernetes Secret', 'passwords and keys'], 'ok', 'secrets here'), b('a', 'Account service instance 1', ['reads secrets from the environment'], 'ok')],
        deps: [d('Config: secret store', 'Account service instance 1', 'inject at runtime', 'ok')],
      },
    ],
  },
];
