// Frame data for the "Service communication and API gateway" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const COMMUNICATION_SCENES = [
  {
    id: 'styles',
    label: 'REST, gRPC or events',
    title: 'Three ways for services to talk',
    frames: [
      {
        note: 'REST over HTTP with JSON is the default for APIs that outside clients use. It is simple, readable, cacheable and works with every tool. The caller sends a request and waits for the answer.',
        boxes: [b('m', 'Mobile app', ['POST /payments'], 'new'), b('g', 'API gateway', ['public REST API'], 'ok', 'JSON over HTTP'), b('p', 'Payment service', ['returns 201 Created'], 'ok')],
        deps: [d('Mobile app', 'API gateway', 'HTTPS', 'ok'), d('API gateway', 'Payment service', 'REST', 'ok')],
      },
      {
        note: 'gRPC suits calls between your own services. The contract is a .proto file that generates typed client and server code, messages are compact binary (Protobuf) over HTTP/2, and it supports streaming. It is fast and strict, but harder to inspect than JSON and not natively callable from a browser.',
        boxes: [b('p', 'Payment service', ['generated client'], 'new'), b('a', 'Account service', ['generated server'], 'ok', 'Protobuf, HTTP/2')],
        deps: [d('Payment service', 'Account service', 'gRPC GetBalance', 'ok')],
      },
      {
        note: 'Events over a broker are asynchronous: the sender publishes a fact and carries on, and consumers react in their own time. The services are decoupled in time and a slow consumer does not slow the sender. The price is eventual consistency and harder debugging.',
        boxes: [b('p', 'Payment service', ['publishes PaymentCompleted'], 'new'), b('k', 'Kafka topic', ['payment-events'], 'ok', 'async'), b('n', 'Notification service', ['reacts later'], 'none'), b('r', 'Reporting service', ['reacts later'], 'none')],
        deps: [d('Payment service', 'Kafka topic', 'publish', 'ok'), d('Kafka topic', 'Notification service', 'consume', 'ok'), d('Kafka topic', 'Reporting service', 'consume', 'ok')],
      },
      {
        note: 'A chain of synchronous calls multiplies both latency and failure. If five services each answer in 50 ms and are 99.9 percent available, the request takes 250 ms and succeeds only about 99.5 percent of the time, and any one slow service slows them all. Keep chains short and use events where an immediate answer is not needed.',
        boxes: [b('a', 'Gateway call', ['request'], 'new'), b('b', 'Service B', ['waits for C'], 'warn'), b('c', 'Service C', ['waits for D'], 'warn'), b('e', 'Service D', ['slow'], 'bad', 'slowest link')],
        deps: [d('Gateway call', 'Service B', 'sync', 'warn'), d('Service B', 'Service C', 'sync', 'warn'), d('Service C', 'Service D', 'sync', 'bad')],
      },
    ],
  },
  {
    id: 'gateway',
    label: 'API gateway and BFF',
    title: 'One front door for clients, shaped for each client',
    frames: [
      {
        note: 'Without a gateway each client calls every service directly. Clients must know all the addresses, each service has to do its own authentication and rate limiting, and a screen that needs three services makes three calls over a slow mobile network.',
        boxes: [b('m', 'Mobile app', ['knows every address'], 'bad'), b('a', 'Account service', ['own login check'], 'warn'), b('c', 'Card service', ['own login check'], 'warn'), b('p', 'Payment service', ['own login check'], 'warn')],
        deps: [d('Mobile app', 'Account service', 'call 1', 'bad'), d('Mobile app', 'Card service', 'call 2', 'bad'), d('Mobile app', 'Payment service', 'call 3', 'bad')],
      },
      {
        note: 'An API gateway is the single entry point. It terminates TLS, authenticates the token, applies rate limits, routes by path, adds a correlation id and logs the request. The services behind it stay simpler and are not exposed to the internet.',
        boxes: [b('m', 'Mobile app', ['one address'], 'new'), b('g', 'API gateway', ['TLS, auth, rate limit, routing'], 'ok', 'front door'), b('a', 'Account service', ['private'], 'ok'), b('c', 'Card service', ['private'], 'ok')],
        deps: [d('Mobile app', 'API gateway', 'HTTPS', 'ok'), d('API gateway', 'Account service', '/accounts', 'ok'), d('API gateway', 'Card service', '/cards', 'ok')],
      },
      {
        note: 'A backend for frontend (BFF) is a small gateway built for one kind of client. The mobile BFF returns small, combined responses to save bandwidth; the web BFF returns richer data. Each client team owns its BFF, so one client\'s needs do not distort the shared services.',
        boxes: [b('m', 'Mobile app', ['small payloads'], 'new'), b('w', 'Web app', ['rich payloads'], 'new'), b('x', 'Mobile BFF', ['shaped for mobile'], 'ok', 'BFF'), b('y', 'Web BFF', ['shaped for web'], 'ok', 'BFF'), b('s', 'Account service', ['shared'], 'ok')],
        deps: [d('Mobile app', 'Mobile BFF', 'request', 'ok'), d('Web app', 'Web BFF', 'request', 'ok'), d('Mobile BFF', 'Account service', 'API', 'ok'), d('Web BFF', 'Account service', 'API', 'ok')],
      },
      {
        note: 'API composition: the BFF calls several services in parallel and merges the answers into one response, so the client makes one call. It sets a timeout for each call and returns a partial result when an optional service fails. Keep business rules out of the gateway: it routes and composes, it does not decide.',
        boxes: [b('x', 'Mobile BFF', ['one call in, three out'], 'ok'), b('a', 'Account service', ['balance'], 'ok'), b('c', 'Card service', ['card status'], 'ok'), b('o', 'Offers service', ['optional, may fail'], 'warn')],
        deps: [d('Mobile BFF', 'Account service', 'parallel', 'ok'), d('Mobile BFF', 'Card service', 'parallel', 'ok'), d('Mobile BFF', 'Offers service', 'parallel, optional', 'warn')],
      },
    ],
  },
  {
    id: 'contracts',
    label: 'Contracts and versioning',
    title: 'Change an API without breaking the callers',
    frames: [
      {
        note: 'An API is a contract. The payment service returns accountId, amount and status, and the mobile app and the reporting service both depend on those fields. Callers are deployed on their own schedule, so you cannot change the contract and fix them all at once.',
        boxes: [b('p', 'Payment API v1', ['accountId, amount, status'], 'ok', 'contract'), b('m', 'Mobile app', ['reads status'], 'none'), b('r', 'Reporting service', ['reads amount'], 'none')],
        deps: [d('Mobile app', 'Payment API v1', 'GET', 'ok'), d('Reporting service', 'Payment API v1', 'GET', 'ok')],
      },
      {
        note: 'Backward compatible changes are safe: add an optional field, add a new endpoint, accept more input. Old callers ignore what they do not know. Callers must be tolerant readers: ignore unknown fields rather than failing on them.',
        boxes: [b('p', 'Payment API', ['adds optional currency'], 'new', 'additive'), b('m', 'Mobile app', ['ignores currency'], 'ok'), b('r', 'Reporting service', ['ignores currency'], 'ok')],
        deps: [d('Mobile app', 'Payment API', 'still works', 'ok'), d('Reporting service', 'Payment API', 'still works', 'ok')],
      },
      {
        note: 'Breaking changes are not safe: removing or renaming a field, changing a type, making an optional field required, or changing the meaning of a value. The reporting service reads amount, which is now called total, and fails.',
        boxes: [b('p', 'Payment API', ['amount renamed to total'], 'bad', 'breaking'), b('r', 'Reporting service', ['amount is missing'], 'bad', 'fails')],
        deps: [d('Reporting service', 'Payment API', 'reads amount', 'bad')],
      },
      {
        note: 'When a breaking change is needed, run the old and the new version side by side: /v1 stays while /v2 is added. Announce a deprecation date, watch the traffic on v1 and switch it off only when nobody uses it. Versioning can be in the path, a header or the media type; the path is the simplest.',
        boxes: [b('v1', 'Payment API v1', ['deprecated, still served'], 'warn', 'sunset date'), b('v2', 'Payment API v2', ['total, currency'], 'ok', 'new'), b('r', 'Reporting service', ['migrates when ready'], 'new')],
        deps: [d('Reporting service', 'Payment API v1', 'today', 'warn'), d('Reporting service', 'Payment API v2', 'after migration', 'ok')],
      },
      {
        note: 'Consumer-driven contract tests catch breaks before release. Each consumer writes down what it needs from the provider (a Pact file). The provider\'s build replays those expectations against the real code, and a failing check blocks the release.',
        boxes: [b('c', 'Consumer test', ['expects amount and status'], 'new', 'writes the contract'), b('f', 'Pact file', ['the agreed contract'], 'ok'), b('p', 'Provider build', ['verifies the contract'], 'ok', 'CI gate')],
        deps: [d('Consumer test', 'Pact file', 'publish', 'ok'), d('Pact file', 'Provider build', 'verify', 'ok')],
      },
    ],
  },
  {
    id: 'discovery',
    label: 'Finding other services',
    title: 'Instances come and go, so addresses cannot be hard-coded',
    frames: [
      {
        note: 'In a cloud platform instances are created, moved and destroyed all the time, and each gets a new address. A fixed list of addresses in configuration is out of date within minutes. Callers need a way to find healthy instances by service name.',
        boxes: [b('p', 'Payment service', ['needs the card service'], 'new'), b('i', 'Card instance 1', ['10.0.1.5'], 'ok'), b('j', 'Card instance 2', ['10.0.2.9'], 'ok')],
        deps: [d('Payment service', 'Card instance 1', 'hard-coded address?', 'warn'), d('Payment service', 'Card instance 2', 'hard-coded address?', 'warn')],
      },
      {
        note: 'With client-side discovery each instance registers itself in a registry (Eureka, Consul) and sends heartbeats. The caller asks the registry for the instances of "card-service", then picks one itself, balancing the load in the client.',
        boxes: [b('r', 'Service registry', ['card-service: two instances'], 'ok', 'Eureka or Consul'), b('p', 'Payment service', ['looks up and picks one'], 'new'), b('i', 'Card instance 1', ['registers, heartbeats'], 'ok'), b('j', 'Card instance 2', ['registers, heartbeats'], 'ok')],
        deps: [d('Card instance 1', 'Service registry', 'register', 'ok'), d('Card instance 2', 'Service registry', 'register', 'ok'), d('Payment service', 'Service registry', 'lookup', 'ok')],
      },
      {
        note: 'When an instance stops sending heartbeats or fails its health check, the registry removes it and callers stop being sent to it. Health checks are what make discovery safe, and callers should still handle a stale entry with a timeout and a retry on another instance.',
        boxes: [b('r', 'Service registry', ['removed instance 2'], 'warn'), b('p', 'Payment service', ['uses instance 1'], 'ok'), b('i', 'Card instance 1', ['healthy'], 'ok'), b('j', 'Card instance 2', ['failed health check'], 'bad', 'down')],
        deps: [d('Payment service', 'Service registry', 'lookup', 'ok'), d('Payment service', 'Card instance 1', 'call', 'ok'), d('Card instance 2', 'Service registry', 'no heartbeat', 'bad')],
      },
      {
        note: 'On Kubernetes you rarely need a separate registry. A Service gives a stable name (card-service) and a virtual address; the platform tracks the ready pods behind it and balances the calls. This is server-side discovery: the caller just uses the name, and the platform does the rest.',
        boxes: [b('p', 'Payment service', ['http://card-service'], 'new'), b('s', 'Kubernetes Service', ['stable name and address'], 'ok', 'server-side'), b('i', 'Card pod 1', ['ready'], 'ok'), b('j', 'Card pod 2', ['ready'], 'ok')],
        deps: [d('Payment service', 'Kubernetes Service', 'DNS name', 'ok'), d('Kubernetes Service', 'Card pod 1', 'balances', 'ok'), d('Kubernetes Service', 'Card pod 2', 'balances', 'ok')],
      },
    ],
  },
];
