// Frame data for the microservice patterns walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const MICROSERVICE_SCENES = [
  {
    id: 'circuit',
    label: 'Circuit breaker',
    title: 'Circuit breaker: stop calling a service that is failing',
    frames: [
      {
        note: 'The account service calls the ledger service through a circuit breaker. While calls succeed the breaker is CLOSED and simply passes them through, counting results.',
        boxes: [b('a', 'Account service', ['needs a balance'], 'ok'), b('cb', 'Circuit breaker', ['state: CLOSED', 'failures: 0 of last 10'], 'ok', 'closed'), b('l', 'Ledger service', ['healthy'], 'ok')],
        deps: [d('Account service', 'Circuit breaker', 'call', 'ok'), d('Circuit breaker', 'Ledger service', 'forwarded', 'ok')],
      },
      {
        note: 'The ledger service becomes slow and starts timing out. Each failed call is counted. Without a breaker, every caller thread would wait for the timeout and the account service would run out of threads too.',
        boxes: [b('a', 'Account service', ['threads waiting...'], 'warn'), b('cb', 'Circuit breaker', ['state: CLOSED', 'failures: 6 of last 10'], 'warn'), b('l', 'Ledger service', ['timing out'], 'bad', 'failing')],
        deps: [d('Circuit breaker', 'Ledger service', 'timeout', 'bad')],
      },
      {
        note: 'The failure rate crosses the threshold (for example 50%), so the breaker trips to OPEN. Now calls fail immediately, without touching the ledger service, and a fallback answers (a cached balance or a clear error). The failing service gets time to recover.',
        boxes: [b('a', 'Account service', ['gets a fast fallback', 'threads stay free'], 'ok'), b('cb', 'Circuit breaker', ['state: OPEN', 'rejects calls for 30 s'], 'bad', 'open'), b('l', 'Ledger service', ['left alone to recover'], 'none')],
        deps: [d('Account service', 'Circuit breaker', 'call', 'ok'), d('Circuit breaker', 'Account service', 'fail fast + fallback', 'bad')],
      },
      {
        note: 'After the wait time the breaker moves to HALF-OPEN and lets a few trial calls through to probe the ledger service.',
        boxes: [b('cb', 'Circuit breaker', ['state: HALF-OPEN', 'allows 3 trial calls'], 'warn', 'half-open'), b('l', 'Ledger service', ['recovering'], 'warn')],
        deps: [d('Circuit breaker', 'Ledger service', '3 trial calls', 'ok')],
      },
      {
        note: 'If the trial calls succeed the breaker closes and normal traffic resumes. If they fail it goes back to OPEN for another wait. Pair it with timeouts, retries with backoff, and a bulkhead for complete resilience.',
        boxes: [b('a', 'Account service', ['normal again'], 'ok'), b('cb', 'Circuit breaker', ['state: CLOSED', 'failures: 0'], 'ok', 'closed'), b('l', 'Ledger service', ['healthy'], 'ok')],
        deps: [d('Account service', 'Ledger service', 'calls flow through again', 'ok')],
      },
    ],
  },
  {
    id: 'gateway',
    label: 'API gateway',
    title: 'API gateway and service discovery: one front door, moving services behind it',
    frames: [
      {
        note: 'A mobile app should not know about ten services and their addresses. It calls one API gateway.',
        boxes: [b('m', 'Mobile app', ['GET /api/accounts/42', 'Bearer token'], 'new'), b('g', 'API gateway', ['single entry point'], 'ok')],
        deps: [d('Mobile app', 'API gateway', 'one request', 'ok')],
      },
      {
        note: 'The gateway handles cross-cutting work once: it validates the token, applies rate limits, and adds a correlation id for tracing. Bad requests never reach the services.',
        boxes: [b('g', 'API gateway', ['token valid', 'rate limit ok', 'adds X-Correlation-Id'], 'ok', 'checks passed')],
        deps: [],
      },
      {
        note: 'It routes /api/accounts/** to the account service. Service addresses change all the time (scaling, redeploys), so it asks the service registry, or Kubernetes DNS, where healthy instances are.',
        boxes: [b('g', 'API gateway', ['route: /api/accounts/** -> account-service'], 'ok'), b('r', 'Service registry', ['account-service: 10.0.1.4, 10.0.1.9', 'ledger-service: 10.0.2.3'], 'new', 'discovery')],
        deps: [d('API gateway', 'Service registry', 'where is account-service?', 'ok'), d('Service registry', 'API gateway', 'two healthy instances', 'ok')],
      },
      {
        note: 'The gateway load-balances to one instance. If an instance is unhealthy it drops out of the registry and receives no traffic. The client sees none of this.',
        boxes: [b('g', 'API gateway', ['picks 10.0.1.9'], 'ok'), b('a', 'Account service', ['instance 10.0.1.9', 'handles the request'], 'ok', '200 OK'), b('a2', 'Account service (second)', ['instance 10.0.1.4', 'idle this time'], 'none')],
        deps: [d('API gateway', 'Account service', 'forwarded', 'ok'), d('Account service', 'Mobile app', 'response', 'ok')],
      },
    ],
  },
  {
    id: 'outbox',
    label: 'Outbox pattern',
    title: 'Transactional outbox: update the database and publish the event reliably',
    frames: [
      {
        note: 'The transfer service must save a transfer and tell other services through a message broker. Doing both separately is risky: if it saves and then crashes before publishing, the event is lost; if it publishes first and the save fails, the event is a lie.',
        boxes: [b('t', 'Transfer service', ['save transfer', 'publish TransferCreated'], 'warn'), b('db', 'Database', ['transfers'], 'none'), b('mb', 'Message broker', ['topic: transfers'], 'none')],
        deps: [d('Transfer service', 'Database', 'write', 'ok'), d('Transfer service', 'Message broker', 'publish (separate step)', 'bad')],
      },
      {
        note: 'Outbox pattern: in ONE local database transaction the service saves the transfer and also inserts the event into an outbox table. Either both commit or neither does.',
        boxes: [b('t', 'Transfer service', ['BEGIN', 'insert transfer', 'insert outbox row', 'COMMIT'], 'new', 'one transaction'), b('db', 'Database', ['transfers: T-100', 'outbox: TransferCreated (unsent)'], 'ok', 'atomic')],
        deps: [d('Transfer service', 'Database', 'single transaction', 'ok')],
      },
      {
        note: 'A separate relay (a polling publisher or change data capture such as Debezium) reads unsent outbox rows and publishes them to the broker, then marks them sent.',
        boxes: [b('db', 'Database', ['outbox: TransferCreated'], 'ok'), b('rl', 'Outbox relay', ['reads unsent rows'], 'new'), b('mb', 'Message broker', ['TransferCreated T-100'], 'ok', 'published')],
        deps: [d('Outbox relay', 'Database', 'poll or CDC', 'ok'), d('Outbox relay', 'Message broker', 'publish', 'ok')],
      },
      {
        note: 'If the broker is down, the row simply stays in the outbox and is retried later. The event is never lost. The price: delivery is at-least-once, so the same event can arrive twice.',
        boxes: [b('rl', 'Outbox relay', ['broker unavailable', 'retries later'], 'warn'), b('db', 'Database', ['outbox: still unsent'], 'ok', 'safe'), b('mb', 'Message broker', ['down'], 'bad')],
        deps: [d('Outbox relay', 'Message broker', 'publish fails', 'bad')],
      },
      {
        note: 'So the consumer must be idempotent: it remembers processed message ids and ignores a duplicate. Outbox plus idempotent consumer gives effectively-once processing without a distributed transaction.',
        boxes: [b('mb', 'Message broker', ['TransferCreated T-100 (delivered twice)'], 'warn'), b('n', 'Notification service', ['seen id T-100: ignore duplicate', 'sends one notification'], 'ok', 'idempotent')],
        deps: [d('Message broker', 'Notification service', 'delivery 1 and delivery 2', 'ok')],
      },
    ],
  },
];
