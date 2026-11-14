// Frame data for the "Decomposition and migration" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const DECOMPOSITION_SCENES = [
  {
    id: 'boundaries',
    label: 'Finding the boundaries',
    title: 'Split by business capability, not by technical layer',
    frames: [
      {
        note: 'A bank starts with one application and one database. Accounts, payments, cards and notifications are modules of the same program, and they can read each other\'s tables. It is simple to run, but every change touches shared code.',
        boxes: [b('m', 'Banking monolith', ['accounts, payments, cards, notifications'], 'warn', 'one deployable'), b('d', 'Shared database', ['one schema, every table'], 'warn')],
        deps: [d('Banking monolith', 'Shared database', 'joins across everything', 'warn')],
      },
      {
        note: 'Splitting by technical layer (a web service, a logic service, a data service) is the common mistake: every feature still needs all three, so teams cannot work or deploy alone. Split by business capability instead: what the business does, such as holding accounts or moving money.',
        boxes: [b('l', 'Web layer service', ['screens for everything'], 'bad', 'by layer'), b('g', 'Logic layer service', ['rules for everything'], 'bad', 'by layer'), b('t', 'Data layer service', ['tables for everything'], 'bad', 'by layer')],
        deps: [d('Web layer service', 'Logic layer service', 'every feature', 'bad'), d('Logic layer service', 'Data layer service', 'every feature', 'bad')],
      },
      {
        note: 'Domain-driven design gives a way to find the boundaries: a bounded context is the area inside which a word has one precise meaning. "Customer" is a verified identity to Accounts, a cardholder with limits to Cards, and a segment for marketing. Each context gets its own model.',
        boxes: [b('a', 'Accounts context', ['Customer = verified identity'], 'ok'), b('c', 'Cards context', ['Customer = cardholder with limits'], 'ok'), b('k', 'Marketing context', ['Customer = segment and consent'], 'ok')],
        deps: [],
      },
      {
        note: 'A context map shows how the contexts relate. Payments calls Accounts through its API. Payments publishes events that Notifications consumes. Cards uses an anti-corruption layer to translate the Accounts model into its own, so a change in Accounts does not leak into Cards.',
        boxes: [b('p', 'Payments context', ['moves money'], 'new'), b('a', 'Accounts context', ['owns balances'], 'ok'), b('n', 'Notifications context', ['sends messages'], 'none'), b('c', 'Cards context', ['anti-corruption layer'], 'ok', 'translates')],
        deps: [d('Payments context', 'Accounts context', 'API call', 'ok'), d('Payments context', 'Notifications context', 'event', 'ok'), d('Cards context', 'Accounts context', 'via translation', 'ok')],
      },
    ],
  },
  {
    id: 'strangler',
    label: 'Strangler fig',
    title: 'Replace the monolith one slice at a time',
    frames: [
      {
        note: 'The strangler fig pattern migrates without a big-bang rewrite. First put a facade in front of the monolith, such as an API gateway or reverse proxy. At the start it only forwards every request to the monolith, so nothing changes for users.',
        boxes: [b('c', 'Mobile app', ['all requests'], 'new'), b('g', 'API gateway', ['facade, routes by path'], 'ok', 'new'), b('m', 'Legacy monolith', ['handles everything'], 'warn')],
        deps: [d('Mobile app', 'API gateway', 'request', 'ok'), d('API gateway', 'Legacy monolith', '/*', 'warn')],
      },
      {
        note: 'Pick a slice with clear boundaries and low risk, such as notifications. Build it as a new service and switch the route for /notifications to it. The rest of the traffic still goes to the monolith. If the new service misbehaves, switch the route back.',
        boxes: [b('g', 'API gateway', ['route by path'], 'ok'), b('n', 'Notification service', ['new, owns its data'], 'new', 'extracted'), b('m', 'Legacy monolith', ['everything else'], 'warn')],
        deps: [d('API gateway', 'Notification service', '/notifications', 'ok'), d('API gateway', 'Legacy monolith', 'the rest', 'warn')],
      },
      {
        note: 'Keep extracting slices, riskier ones later, such as payments. During the move both sides may need the same data, so the old code and the new service are kept in step, with events or change data capture, until the monolith no longer needs it.',
        boxes: [b('g', 'API gateway', ['route by path'], 'ok'), b('p', 'Payment service', ['new'], 'new', 'extracted'), b('m', 'Legacy monolith', ['shrinking'], 'warn'), b('e', 'Change events', ['keep data in step'], 'none')],
        deps: [d('API gateway', 'Payment service', '/payments', 'ok'), d('API gateway', 'Legacy monolith', 'the rest', 'warn'), d('Legacy monolith', 'Change events', 'publish', 'ok'), d('Change events', 'Payment service', 'consume', 'ok')],
      },
      {
        note: 'When the last route has moved, the monolith receives no traffic and can be switched off. The migration was a series of small, reversible steps, each one shippable, and the business never waited for a rewrite to finish.',
        boxes: [b('g', 'API gateway', ['all routes'], 'ok'), b('a', 'Account service', ['extracted'], 'ok'), b('p', 'Payment service', ['extracted'], 'ok'), b('n', 'Notification service', ['extracted'], 'ok')],
        deps: [d('API gateway', 'Account service', '/accounts', 'ok'), d('API gateway', 'Payment service', '/payments', 'ok'), d('API gateway', 'Notification service', '/notifications', 'ok')],
      },
    ],
  },
  {
    id: 'database',
    label: 'Splitting the database',
    title: 'The database is the hardest part to cut',
    frames: [
      {
        note: 'The payment code reads the account tables directly with a join. As long as that works, the payment service is not independent: a change to the account schema breaks it, and both must deploy together.',
        boxes: [b('p', 'Payment service', ['SELECT ... JOIN account'], 'bad', 'tight coupling'), b('d', 'Shared database', ['account and payment tables'], 'warn')],
        deps: [d('Payment service', 'Shared database', 'reads account tables', 'bad')],
      },
      {
        note: 'Step one: stop reading the other team\'s tables. Account data is reached through the Account service\'s API, which becomes the only way in. The schema behind it can now change freely, as long as the API stays the same.',
        boxes: [b('p', 'Payment service', ['asks for the balance'], 'new'), b('a', 'Account service', ['owns account tables'], 'ok', 'API'), b('d', 'Shared database', ['still one database'], 'warn')],
        deps: [d('Payment service', 'Account service', 'GET /accounts/42', 'ok'), d('Account service', 'Shared database', 'reads and writes', 'ok')],
      },
      {
        note: 'Step two: calling the API for every payment is slow and couples availability. Where a service needs data often, it keeps its own copy, fed by events from the owner, and accepts that the copy is slightly stale. For exact checks it still calls the owner.',
        boxes: [b('a', 'Account service', ['publishes AccountChanged'], 'ok'), b('e', 'Event stream', ['account events'], 'none'), b('p', 'Payment service', ['local copy of what it needs'], 'new', 'own copy')],
        deps: [d('Account service', 'Event stream', 'publish', 'ok'), d('Event stream', 'Payment service', 'update copy', 'ok')],
      },
      {
        note: 'Step three: each service gets its own schema, then its own database. Cross-service foreign keys and joins are gone; consistency across services uses sagas and events. Do the cut in this order, so every step can be released and rolled back.',
        boxes: [b('a', 'Account service', ['owns its data'], 'ok'), b('x', 'Account database', ['own schema'], 'ok', 'split'), b('p', 'Payment service', ['owns its data'], 'ok'), b('y', 'Payment database', ['own schema'], 'ok', 'split')],
        deps: [d('Account service', 'Account database', 'reads and writes', 'ok'), d('Payment service', 'Payment database', 'reads and writes', 'ok')],
      },
    ],
  },
  {
    id: 'modular',
    label: 'Modular monolith first',
    title: 'Clean boundaries inside one deployable come first',
    frames: [
      {
        note: 'A big ball of mud: every part calls every other part and shares tables. Splitting this into services would just turn tangled method calls into tangled network calls, which are slower and fail more.',
        boxes: [b('a', 'Accounts code', ['calls everything'], 'bad'), b('p', 'Payments code', ['calls everything'], 'bad'), b('c', 'Cards code', ['calls everything'], 'bad')],
        deps: [d('Accounts code', 'Payments code', 'any class', 'bad'), d('Payments code', 'Cards code', 'any class', 'bad'), d('Cards code', 'Accounts code', 'any class', 'bad')],
      },
      {
        note: 'A modular monolith keeps one deployable but gives each business module a public interface and hides everything else. Other modules may call only that interface, and a build or architecture test enforces it. Spring Modulith is one tool for this.',
        boxes: [b('a', 'Accounts module', ['public interface only'], 'ok'), b('p', 'Payments module', ['public interface only'], 'ok'), b('c', 'Cards module', ['public interface only'], 'ok')],
        deps: [d('Payments module', 'Accounts module', 'interface', 'ok'), d('Cards module', 'Accounts module', 'interface', 'ok')],
      },
      {
        note: 'Each module also owns its tables and no other module reads them. Modules talk through interfaces or in-process events. The system is still one program with fast calls and simple transactions, but the seams are where services would be cut.',
        boxes: [b('a', 'Accounts module', ['accounts schema'], 'ok'), b('p', 'Payments module', ['payments schema'], 'ok'), b('d', 'One database', ['one schema per module'], 'ok')],
        deps: [d('Accounts module', 'One database', 'own tables', 'ok'), d('Payments module', 'One database', 'own tables', 'ok')],
      },
      {
        note: 'Only when a module needs different scaling, a different team or a different release pace do you extract it into a service. Because the boundary already exists, the move is mostly mechanical. If it never needs to move, you saved the cost of distribution.',
        boxes: [b('m', 'Remaining monolith', ['accounts, cards'], 'ok'), b('p', 'Payment service', ['extracted when needed'], 'new', 'extracted'), b('g', 'API gateway', ['routes /payments'], 'none')],
        deps: [d('API gateway', 'Payment service', '/payments', 'ok'), d('API gateway', 'Remaining monolith', 'the rest', 'ok')],
      },
    ],
  },
];
