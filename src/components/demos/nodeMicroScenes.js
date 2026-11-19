// Frame data for the "Node.js microservices" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const NODE_MICRO_SCENES = [
  {
    id: 'shape',
    label: 'Service shape',
    title: 'Small services with clear owners',
    frames: [
      {
        note: 'Start with a modular monolith and split only when a boundary has proved itself: a business capability such as payments or notifications, with its own team, its own release rhythm and its own data. Node suits the split well because services are small, start fast and make cheap I/O calls.',
        boxes: [b('m', 'Modular monolith first', ['clear modules, one deploy'], 'ok'), b('c', 'Split by capability', ['payments, notifications'], 'new'), b('o', 'Own team and data', ['one owner each'], 'ok')],
        deps: [d('Modular monolith first', 'Split by capability', 'then', 'ok'), d('Split by capability', 'Own team and data', 'gives', 'ok')],
      },
      {
        note: 'A shared common library full of models and helpers quietly couples every service to every other. A change to it forces all of them to upgrade together. Share only versioned contracts, such as API schemas and event types, and keep business code inside each service.',
        boxes: [b('l', 'Shared common library', ['models, helpers, clients'], 'bad'), b('k', 'Lockstep releases', ['all services upgrade'], 'bad'), b('p', 'Contracts-only package', ['schemas and types'], 'ok')],
        deps: [d('Shared common library', 'Lockstep releases', 'causes', 'bad'), d('Lockstep releases', 'Contracts-only package', 'fixed by', 'ok')],
      },
      {
        note: 'Each service owns its data. When two services read and write the same tables, a schema change breaks the other one without warning, and neither team can deploy alone. Expose the data through the owner API or through events, and keep the database private.',
        boxes: [b('s', 'Shared database', ['two services, one schema'], 'bad'), b('h', 'Hidden coupling', ['change breaks the other'], 'bad'), b('o', 'Own data and API', ['database per service'], 'ok')],
        deps: [d('Shared database', 'Hidden coupling', 'causes', 'bad'), d('Hidden coupling', 'Own data and API', 'fixed by', 'ok')],
      },
    ],
  },
  {
    id: 'calls',
    label: 'Calling services',
    title: 'Every remote call can fail or be slow',
    frames: [
      {
        note: 'A remote call needs a deadline, limited retries and a circuit breaker. Time out every call with an AbortSignal. Retry only idempotent calls, with exponential backoff and jitter. After repeated failures the breaker opens and calls fail at once, so a sick dependency does not drag its callers down.',
        boxes: [b('r', 'Remote call', ['fetch with a deadline'], 'new'), b('t', 'Timeout and retry', ['backoff with jitter'], 'ok'), b('c', 'Circuit breaker', ['open after failures'], 'warn')],
        deps: [d('Remote call', 'Timeout and retry', 'guarded by', 'ok'), d('Timeout and retry', 'Circuit breaker', 'then', 'warn')],
      },
      {
        note: 'A backend for frontend calls several services in parallel for one screen. Use Promise.allSettled with a shared deadline, fail the page only when an essential call fails, and return a partial result with the missing parts marked when an optional service is slow or down.',
        boxes: [b('b', 'Backend for frontend', ['one call per screen'], 'new'), b('p', 'Parallel calls', ['shared deadline'], 'ok'), b('r', 'Partial result', ['optional parts may be empty'], 'warn')],
        deps: [d('Backend for frontend', 'Parallel calls', 'makes', 'ok'), d('Parallel calls', 'Partial result', 'returns', 'warn')],
      },
      {
        note: 'Give every request a correlation id at the edge and pass it on every outbound call and message. AsyncLocalStorage carries it through the async code inside a service, and the traceparent header carries the trace across services, so one search shows the whole journey of a transfer.',
        boxes: [b('c', 'Correlation id', ['set at the edge'], 'new'), b('h', 'Propagated in headers', ['http and message headers'], 'ok'), b('t', 'One trace', ['across all services'], 'ok')],
        deps: [d('Correlation id', 'Propagated in headers', 'sent in', 'ok'), d('Propagated in headers', 'One trace', 'builds', 'ok')],
      },
    ],
  },
  {
    id: 'events',
    label: 'Events and the outbox',
    title: 'Change data and publish the event together',
    frames: [
      {
        note: 'Saving to the database and then publishing to the broker are two separate writes. If the process crashes between them the transfer exists but nobody hears about it. Retrying later cannot fix it, because the information that an event was owed is gone.',
        boxes: [b('d', 'Dual write', ['save, then publish'], 'bad'), b('l', 'Lost event', ['crash in between'], 'bad'), b('o', 'Transactional outbox', ['event saved with the data'], 'ok')],
        deps: [d('Dual write', 'Lost event', 'can cause', 'bad'), d('Lost event', 'Transactional outbox', 'fixed by', 'ok')],
      },
      {
        note: 'The service writes the business row and an outbox row in one database transaction. A relay reads unpublished rows, using FOR UPDATE SKIP LOCKED so several relays do not clash, publishes them and marks them done. If it crashes after publishing, the event goes out again, so delivery is at least once.',
        boxes: [b('r', 'Outbox relay', ['SKIP LOCKED batches'], 'new'), b('b', 'Broker', ['Kafka, RabbitMQ, SQS'], 'ok'), b('a', 'At-least-once delivery', ['duplicates possible'], 'warn')],
        deps: [d('Outbox relay', 'Broker', 'publishes to', 'ok'), d('Broker', 'At-least-once delivery', 'means', 'warn')],
      },
      {
        note: 'Because duplicates happen, every consumer must be idempotent. It records the message id in the same transaction as its own change, so a redelivered message is recognised and skipped. Transient errors are retried with backoff, and poison messages go to a dead-letter queue for people to inspect.',
        boxes: [b('i', 'Idempotent consumer', ['message id in same tx'], 'ok'), b('d', 'Duplicate delivery', ['skipped, acknowledged'], 'warn'), b('q', 'Dead-letter queue', ['poison messages parked'], 'warn')],
        deps: [d('Duplicate delivery', 'Idempotent consumer', 'handled by', 'ok'), d('Idempotent consumer', 'Dead-letter queue', 'gives up to', 'warn')],
      },
      {
        note: 'A saga spreads one business operation over several services as a chain of local transactions with compensations. An orchestrator keeps the state in a table and reacts to each reply: debit, credit, notify, and on a failure a refund. Ignore duplicate and late replies, and send stuck cases to manual review.',
        boxes: [b('o', 'Saga orchestrator', ['persisted state machine'], 'new'), b('l', 'Local transactions', ['debit, credit, notify'], 'ok'), b('c', 'Compensation', ['refund the debit'], 'warn')],
        deps: [d('Saga orchestrator', 'Local transactions', 'drives', 'ok'), d('Local transactions', 'Compensation', 'on failure', 'warn')],
      },
    ],
  },
  {
    id: 'run',
    label: 'Run, secure, observe',
    title: 'Contracts, trust and ownership',
    frames: [
      {
        note: 'Services evolve independently, so changes must stay backward compatible. Adding an optional field is safe, removing or renaming one is a breaking change. Consumers read only what they need and ignore the rest, and consumer-driven contract tests prove that a provider change does not break a consumer before it is deployed.',
        boxes: [b('b', 'Breaking change', ['rename or remove a field'], 'bad'), b('a', 'Additive change', ['new optional field'], 'ok'), b('c', 'Contract test', ['consumer states needs'], 'new')],
        deps: [d('Breaking change', 'Additive change', 'replace with', 'warn'), d('Additive change', 'Contract test', 'verified by', 'ok')],
      },
      {
        note: 'The internal network is not a safe zone. Services authenticate each other with mutual TLS or signed tokens, pass the end user identity along, and every service authorises each request again instead of trusting the caller. Network policies allow only the calls that are meant to exist.',
        boxes: [b('t', 'Trusted network', ['anything inside is fine'], 'bad'), b('m', 'mTLS between services', ['both sides prove identity'], 'ok'), b('p', 'Token propagation', ['user and service identity'], 'ok')],
        deps: [d('Trusted network', 'mTLS between services', 'replace with', 'warn'), d('mTLS between services', 'Token propagation', 'plus', 'ok')],
      },
      {
        note: 'Independence is the point, so each service has its own pipeline, image and release, built from a common service template that already includes health checks, graceful shutdown, logging and metrics. The owning team carries the pager, because operating the service is part of owning it.',
        boxes: [b('p', 'Independent pipeline', ['deploy one service alone'], 'ok'), b('t', 'Service template', ['health, logs, metrics built in'], 'new'), b('o', 'Ownership and on-call', ['you build it, you run it'], 'warn')],
        deps: [d('Service template', 'Independent pipeline', 'speeds up', 'ok'), d('Independent pipeline', 'Ownership and on-call', 'with', 'warn')],
      },
    ],
  },
];
