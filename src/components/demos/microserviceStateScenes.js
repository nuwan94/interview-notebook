// Frame data for the "State management in microservices" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const MICROSERVICE_STATE_SCENES = [
  {
    id: 'stateless',
    label: 'Keeping services stateless',
    title: 'Why a service should not keep user state in its own memory',
    frames: [
      {
        note: 'A user logs in to a service that stores the session in its own memory. Instance A remembers who the user is. This works while there is only one instance.',
        boxes: [b('u', 'Customer', ['logs in'], 'new'), b('a', 'Instance A', ['session in local memory'], 'warn', 'stateful')],
        deps: [d('Customer', 'Instance A', 'login', 'ok')],
      },
      {
        note: 'Now the service is scaled to two instances behind a load balancer. The next request is sent to instance B, which has never seen this user, so the customer is asked to log in again. State in local memory does not survive scaling out.',
        boxes: [
          b('u', 'Customer', ['next request'], 'new'),
          b('l', 'Load balancer', ['round robin'], 'none'),
          b('a', 'Instance A', ['has the session'], 'warn'),
          b('c', 'Instance B', ['no session'], 'bad', 'logged out'),
        ],
        deps: [d('Customer', 'Load balancer', 'request', 'ok'), d('Load balancer', 'Instance B', 'routed here', 'bad'), d('Load balancer', 'Instance A', 'not here', 'none')],
      },
      {
        note: 'Sticky sessions send the same customer to the same instance every time. It works, but it is fragile: if instance A restarts or is removed during a deployment, every session on it is lost, and the load can become uneven.',
        boxes: [
          b('u', 'Customer', ['always routed to A'], 'new'),
          b('l', 'Load balancer', ['sticky by cookie'], 'warn', 'sticky'),
          b('a', 'Instance A', ['crashes, sessions lost'], 'bad', 'down'),
        ],
        deps: [d('Customer', 'Load balancer', 'request', 'ok'), d('Load balancer', 'Instance A', 'pinned', 'bad')],
      },
      {
        note: 'The usual fix is to keep the session outside the service, in a shared store such as Redis. Any instance can read it, so instances are interchangeable and can be added, removed or restarted freely. The service itself becomes stateless.',
        boxes: [
          b('l', 'Load balancer', ['any instance'], 'none'),
          b('a', 'Instance A', ['stateless'], 'ok'),
          b('c', 'Instance B', ['stateless'], 'ok'),
          b('r', 'Redis', ['session store', 'TTL 30 minutes'], 'ok', 'shared'),
        ],
        deps: [d('Load balancer', 'Instance A', 'request', 'ok'), d('Load balancer', 'Instance B', 'request', 'ok'), d('Instance A', 'Redis', 'read session', 'ok'), d('Instance B', 'Redis', 'read session', 'ok')],
      },
      {
        note: 'Another option is to put the state in the request itself. The client holds a signed token (a JWT) and every service verifies the signature, so there is no session store to read at all. The cost is that a token cannot easily be revoked before it expires.',
        boxes: [
          b('u', 'Customer', ['sends JWT with each call'], 'new', 'token'),
          b('a', 'Payment service', ['verifies the signature', 'no session lookup'], 'ok', 'stateless'),
          b('k', 'Identity provider', ['signs tokens', 'publishes public keys'], 'none'),
        ],
        deps: [d('Customer', 'Payment service', 'Bearer token', 'ok'), d('Payment service', 'Identity provider', 'fetch keys once', 'ok')],
      },
    ],
  },
  {
    id: 'where',
    label: 'Where state lives',
    title: 'Each kind of state has a natural home',
    frames: [
      {
        note: 'Start with a simple rule: ask what the state is for and how long it must live. Request state, such as the parsed input of one call, lives only in memory and disappears with the request.',
        boxes: [b('c', 'Client call', ['POST /transfers'], 'new'), b('s', 'Transfer service', ['variables of this request'], 'ok', 'in memory')],
        deps: [d('Client call', 'Transfer service', 'handled', 'ok')],
      },
      {
        note: 'Business data, such as accounts and balances, must survive crashes and be correct. It lives in the service\'s own database, and no other service reads that database directly. Other services ask through its API or events.',
        boxes: [b('s', 'Account service', ['owns accounts'], 'ok'), b('d', 'Account database', ['source of truth', 'ACID'], 'ok', 'durable'), b('o', 'Other service', ['asks via API'], 'none')],
        deps: [d('Account service', 'Account database', 'reads and writes', 'ok'), d('Other service', 'Account service', 'API call', 'ok')],
      },
      {
        note: 'Shared, disposable state, such as sessions, rate-limit counters and cached lookups, lives in a fast shared store like Redis. If it is lost, users log in again or the cache refills, so it must never be the only copy of important data.',
        boxes: [b('a', 'Instance A', ['stateless'], 'ok'), b('c', 'Instance B', ['stateless'], 'ok'), b('r', 'Redis', ['sessions, counters, cache'], 'warn', 'disposable')],
        deps: [d('Instance A', 'Redis', 'read, write', 'ok'), d('Instance B', 'Redis', 'read, write', 'ok')],
      },
      {
        note: 'State of a long running process, such as a money transfer that spans several services, is stored as a record that says which step it is on. A saga or workflow engine keeps it in a database so the process can continue after a restart.',
        boxes: [b('o', 'Orchestrator', ['runs the transfer steps'], 'new'), b('w', 'Workflow table', ['transfer 91: step 2 of 3'], 'ok', 'durable'), b('s', 'Ledger service', ['step 2'], 'none')],
        deps: [d('Orchestrator', 'Workflow table', 'save step', 'ok'), d('Orchestrator', 'Ledger service', 'next command', 'ok')],
      },
      {
        note: 'State that other services need to react to is published as events through a broker, so each service keeps its own copy of what it needs. The log of events can also be the state itself, which is the idea behind event sourcing.',
        boxes: [b('p', 'Payment service', ['publishes events'], 'new'), b('k', 'Kafka topic', ['payment-completed'], 'ok', 'log'), b('n', 'Notification service', ['keeps what it needs'], 'none'), b('r', 'Reporting service', ['own read copy'], 'none')],
        deps: [d('Payment service', 'Kafka topic', 'publish', 'ok'), d('Kafka topic', 'Notification service', 'consume', 'ok'), d('Kafka topic', 'Reporting service', 'consume', 'ok')],
      },
    ],
  },
  {
    id: 'idempotency',
    label: 'Retries and idempotency',
    title: 'A retried payment must not be charged twice',
    frames: [
      {
        note: 'A client sends a payment, the service processes it, but the response is lost on the network. The client does not know it succeeded, so it retries. Without protection the service handles it as a new payment.',
        boxes: [b('c', 'Mobile app', ['POST /payments 50.00'], 'new'), b('p', 'Payment service', ['no duplicate check'], 'bad'), b('l', 'Ledger', ['debited twice'], 'bad', '100.00')],
        deps: [d('Mobile app', 'Payment service', 'request and retry', 'bad'), d('Payment service', 'Ledger', 'two debits', 'bad')],
      },
      {
        note: 'The fix is an idempotency key. The client generates a unique key for the payment and sends it as a header on every attempt, including retries. The key identifies the intent, not the HTTP call.',
        boxes: [b('c', 'Mobile app', ['Idempotency-Key: 7f3a'], 'new', 'same key'), b('p', 'Payment service', ['checks the key first'], 'ok')],
        deps: [d('Mobile app', 'Payment service', 'attempt 1 and 2', 'ok')],
      },
      {
        note: 'On the first attempt the service stores the key together with the result in a table with a unique constraint on the key, in the same transaction as the debit. The payment happens once.',
        boxes: [b('p', 'Payment service', ['first attempt'], 'ok'), b('k', 'Key table', ['7f3a: done, 50.00'], 'ok', 'unique key'), b('l', 'Ledger', ['debited once'], 'ok', '50.00')],
        deps: [d('Payment service', 'Key table', 'insert key', 'ok'), d('Payment service', 'Ledger', 'debit', 'ok')],
      },
      {
        note: 'On the retry the service finds the key already stored and returns the saved response without charging again. The client gets the same answer as if the first call had worked.',
        boxes: [b('c', 'Mobile app', ['retry, same key'], 'new'), b('p', 'Payment service', ['key already seen'], 'ok'), b('k', 'Key table', ['returns saved result'], 'ok', 'hit'), b('l', 'Ledger', ['not touched again'], 'none')],
        deps: [d('Mobile app', 'Payment service', 'retry', 'ok'), d('Payment service', 'Key table', 'lookup', 'ok')],
      },
      {
        note: 'Two identical requests can also arrive at the same moment. The unique constraint lets only one insert win, and the other waits or gets a conflict response. Consumers of messages need the same protection, because brokers deliver at least once.',
        boxes: [b('r1', 'Request 1', ['inserts the key'], 'ok', 'wins'), b('r2', 'Request 2', ['insert fails'], 'warn', 'blocked'), b('k', 'Key table', ['unique constraint'], 'ok')],
        deps: [d('Request 1', 'Key table', 'insert', 'ok'), d('Request 2', 'Key table', 'insert', 'bad')],
      },
    ],
  },
  {
    id: 'events',
    label: 'Event sourcing and CQRS',
    title: 'Store the changes as events, and read from a separate view',
    frames: [
      {
        note: 'Normally an account row stores only the current balance, and each update overwrites the last one. The history is gone unless you add an audit table yourself.',
        boxes: [b('s', 'Account service', ['update balance'], 'new'), b('t', 'Account table', ['balance = 80.00', 'old values lost'], 'warn')],
        deps: [d('Account service', 'Account table', 'overwrite', 'warn')],
      },
      {
        note: 'With event sourcing the service does not store the balance. It appends events such as Deposited 100 and Withdrawn 20 to an event store. The events are never changed, and the current state is what you get by replaying them.',
        boxes: [b('c', 'Command', ['withdraw 20'], 'new'), b('a', 'Account aggregate', ['checks the rules'], 'ok'), b('e', 'Event store', ['Deposited 100', 'Withdrawn 20'], 'ok', 'append only')],
        deps: [d('Command', 'Account aggregate', 'handle', 'ok'), d('Account aggregate', 'Event store', 'append event', 'ok')],
      },
      {
        note: 'Replaying a long history on every request is slow, so the service saves a snapshot every so often. To rebuild an account it loads the latest snapshot and replays only the events after it.',
        boxes: [b('e', 'Event store', ['events 1 to 5000'], 'ok'), b('n', 'Snapshot', ['balance at event 4900'], 'new', 'fast'), b('a', 'Account aggregate', ['snapshot + last 100 events'], 'ok')],
        deps: [d('Snapshot', 'Account aggregate', 'load', 'ok'), d('Event store', 'Account aggregate', 'replay the rest', 'ok')],
      },
      {
        note: 'CQRS separates the write side from the read side. Events update a read model that is shaped for screens, for example a table of balances per customer. Queries use only that model, so reads and writes can be scaled and stored differently.',
        boxes: [b('e', 'Event store', ['source of truth'], 'ok'), b('p', 'Projector', ['builds the view'], 'new'), b('v', 'Read model', ['balance per customer'], 'ok', 'fast reads'), b('q', 'Query API', ['GET /balance'], 'none')],
        deps: [d('Event store', 'Projector', 'events', 'ok'), d('Projector', 'Read model', 'update', 'ok'), d('Query API', 'Read model', 'read', 'ok')],
      },
      {
        note: 'The price is eventual consistency: the read model lags a little behind the events, so a customer may not see a deposit for a moment. It also adds more parts to run and event schemas that must be versioned. Use it where history and audit matter, not by default.',
        boxes: [b('e', 'Event store', ['Deposited 100 at 10:00:00'], 'ok'), b('v', 'Read model', ['still shows the old balance'], 'warn', 'lagging'), b('u', 'Customer', ['refreshes the screen'], 'new')],
        deps: [d('Event store', 'Read model', 'projected a moment later', 'warn'), d('Customer', 'Read model', 'reads', 'warn')],
      },
    ],
  },
  {
    id: 'kubernetes',
    label: 'Stateful workloads',
    title: 'Pods are disposable, so their data must live elsewhere',
    frames: [
      {
        note: 'A Deployment runs identical pods that can be killed and replaced at any time. Anything written to a pod\'s own filesystem is lost with it, so a stateless service needs no special storage.',
        boxes: [b('d', 'Deployment', ['3 identical pods'], 'new'), b('p', 'Pod', ['local disk is temporary'], 'warn', 'disposable')],
        deps: [d('Deployment', 'Pod', 'creates and replaces', 'ok')],
      },
      {
        note: 'For data that must survive a restart, a pod claims a persistent volume. The claim is separate from the pod, so when the pod is deleted the volume and its data stay.',
        boxes: [b('p', 'Pod', ['mounts /data'], 'new'), b('c', 'Volume claim', ['asks for 20 GB'], 'ok'), b('v', 'Persistent volume', ['disk that outlives the pod'], 'ok', 'durable')],
        deps: [d('Pod', 'Volume claim', 'mounts', 'ok'), d('Volume claim', 'Persistent volume', 'bound to', 'ok')],
      },
      {
        note: 'A StatefulSet is for databases and brokers. Its pods get stable names (db-0, db-1, db-2), start in order and each keeps its own volume. If db-1 is rescheduled it comes back with the same name and the same data.',
        boxes: [b('s', 'StatefulSet', ['db with 3 replicas'], 'new'), b('a', 'db-0', ['primary', 'volume 0'], 'ok'), b('c', 'db-1', ['replica', 'volume 1'], 'ok'), b('e', 'db-2', ['replica', 'volume 2'], 'ok')],
        deps: [d('StatefulSet', 'db-0', 'stable name', 'ok'), d('StatefulSet', 'db-1', 'stable name', 'ok'), d('StatefulSet', 'db-2', 'stable name', 'ok')],
      },
      {
        note: 'Running a database yourself also means you run backups, failover and upgrades. Many teams keep stateful systems outside the cluster, as managed services, and keep only the stateless services inside it.',
        boxes: [b('a', 'Payment service', ['pods, stateless'], 'ok'), b('m', 'Managed database', ['backups and failover handled'], 'ok', 'managed'), b('r', 'Managed Redis', ['sessions and cache'], 'ok', 'managed')],
        deps: [d('Payment service', 'Managed database', 'SQL', 'ok'), d('Payment service', 'Managed Redis', 'cache', 'ok')],
      },
    ],
  },
];
