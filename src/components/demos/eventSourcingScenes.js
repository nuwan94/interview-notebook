// Frame data for the "Event sourcing and CQRS" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const EVENT_SOURCING_SCENES = [
  {
    id: 'commands',
    label: 'Commands and events',
    title: 'A command is a request, an event is a fact',
    frames: [
      {
        note: 'A command is a request to do something, written in the imperative: WithdrawMoney. It can be refused. The caller sends it to the aggregate, the one object that owns the rules for an account.',
        boxes: [b('c', 'Command', ['WithdrawMoney 20'], 'new', 'request'), b('a', 'Account aggregate', ['loads its past events', 'checks the rules'], 'ok')],
        deps: [d('Command', 'Account aggregate', 'handle', 'ok')],
      },
      {
        note: 'To decide, the aggregate rebuilds its state from the events stored for this account. With a balance of 100, a withdrawal of 20 is allowed.',
        boxes: [b('e', 'Event store', ['Opened', 'Deposited 100'], 'ok', 'history'), b('a', 'Account aggregate', ['balance = 100', 'withdraw 20 is allowed'], 'ok'), b('c', 'Command', ['WithdrawMoney 20'], 'new')],
        deps: [d('Event store', 'Account aggregate', 'load events', 'ok'), d('Command', 'Account aggregate', 'handle', 'ok')],
      },
      {
        note: 'If the rules allow it, the aggregate produces an event in the past tense: MoneyWithdrawn. An event is a fact that already happened, so it is never changed or deleted. It is appended to the event store.',
        boxes: [b('a', 'Account aggregate', ['rules passed'], 'ok'), b('e', 'Event store', ['Opened', 'Deposited 100', 'MoneyWithdrawn 20'], 'ok', 'appended')],
        deps: [d('Account aggregate', 'Event store', 'append event', 'ok')],
      },
      {
        note: 'If the rules fail, for example the balance is only 10, the command is rejected and nothing is stored. Rejecting a command is normal and leaves no trace in the event history.',
        boxes: [b('c', 'Command', ['WithdrawMoney 20'], 'new'), b('a', 'Account aggregate', ['balance = 10', 'insufficient funds'], 'bad', 'rejected'), b('e', 'Event store', ['nothing appended'], 'none')],
        deps: [d('Command', 'Account aggregate', 'handle', 'bad'), d('Account aggregate', 'Event store', 'no event', 'none')],
      },
      {
        note: 'Once stored, the event is published so other parts of the system can react. The event bus delivers it to listeners such as notifications and read models. The write side does not know or care who listens.',
        boxes: [b('e', 'Event store', ['MoneyWithdrawn 20'], 'ok'), b('x', 'Event bus', ['publishes the event'], 'new'), b('n', 'Notification service', ['SMS: you spent 20'], 'none'), b('r', 'Read model', ['updates the balance view'], 'none')],
        deps: [d('Event store', 'Event bus', 'publish', 'ok'), d('Event bus', 'Notification service', 'deliver', 'ok'), d('Event bus', 'Read model', 'deliver', 'ok')],
      },
    ],
  },
  {
    id: 'store',
    label: 'The event store',
    title: 'Events are appended to one stream per aggregate',
    frames: [
      {
        note: 'The event store keeps one ordered stream of events per aggregate: all events of account 42 in the order they happened, each with a version number 1, 2, 3. It is append-only: no update, no delete.',
        boxes: [b('s', 'Event store', ['account-42: v1 Opened', 'v2 Deposited 100', 'v3 MoneyWithdrawn 20'], 'ok', 'append only')],
        deps: [],
      },
      {
        note: 'Two requests handle the same account at the same moment. Both read the stream at version 3 and both decide to append version 4.',
        boxes: [b('a', 'Request A', ['read up to v3', 'wants to write v4'], 'new'), b('c', 'Request B', ['read up to v3', 'wants to write v4'], 'new'), b('s', 'Event store', ['account-42 at v3'], 'ok')],
        deps: [d('Request A', 'Event store', 'append v4', 'ok'), d('Request B', 'Event store', 'append v4', 'ok')],
      },
      {
        note: 'The stream id and version form a unique key. The first append of version 4 succeeds. The second fails with a conflict, because it was decided from outdated history. This is optimistic concurrency with an expected version.',
        boxes: [b('a', 'Request A', ['append v4 succeeded'], 'ok', 'wins'), b('c', 'Request B', ['conflict on v4'], 'bad', 'rejected'), b('s', 'Event store', ['account-42 at v4'], 'ok')],
        deps: [d('Request A', 'Event store', 'stored', 'ok'), d('Request B', 'Event store', 'unique key violated', 'bad')],
      },
      {
        note: 'Request B reloads the stream, which now includes the new event, runs the rules again and tries version 5. If it is still allowed, it succeeds. Nothing is lost and nobody overwrote anyone.',
        boxes: [b('c', 'Request B', ['reload to v4', 'decide again'], 'new', 'retry'), b('s', 'Event store', ['account-42 at v5'], 'ok')],
        deps: [d('Request B', 'Event store', 'append v5', 'ok')],
      },
      {
        note: 'Replaying thousands of events for every command would be slow. A snapshot stores the state at some version, say 4900. The aggregate loads the snapshot and replays only the events after it. Snapshots are an optimisation and can be deleted and rebuilt.',
        boxes: [b('n', 'Snapshot', ['state at v4900'], 'new', 'optimisation'), b('s', 'Event store', ['events v4901 to v5000'], 'ok'), b('a', 'Account aggregate', ['snapshot + 100 events'], 'ok')],
        deps: [d('Snapshot', 'Account aggregate', 'load first', 'ok'), d('Event store', 'Account aggregate', 'replay the rest', 'ok')],
      },
    ],
  },
  {
    id: 'projections',
    label: 'Read models',
    title: 'Read models are built from the events and can be rebuilt',
    frames: [
      {
        note: 'The event stream is hard to query directly: "which accounts are overdrawn?" would mean replaying everything. So listeners called projectors turn events into tables shaped for a question, called read models.',
        boxes: [b('e', 'Event store', ['all events'], 'ok'), b('p', 'Balance projector', ['updates a balance row'], 'new'), b('v', 'Balance view', ['account 42: 80.00'], 'ok', 'read model')],
        deps: [d('Event store', 'Balance projector', 'events', 'ok'), d('Balance projector', 'Balance view', 'upsert', 'ok')],
      },
      {
        note: 'One set of events can feed many read models, each in the store that suits it: a relational table for statements, a search index for transaction search, a cache for the mobile balance. Each is a different view of the same facts.',
        boxes: [b('e', 'Event store', ['MoneyWithdrawn 20'], 'ok'), b('s', 'Statement table', ['PostgreSQL'], 'ok'), b('i', 'Search index', ['Elasticsearch'], 'ok'), b('r', 'Redis cache', ['mobile balance'], 'ok')],
        deps: [d('Event store', 'Statement table', 'project', 'ok'), d('Event store', 'Search index', 'project', 'ok'), d('Event store', 'Redis cache', 'project', 'ok')],
      },
      {
        note: 'Events are delivered at least once, so a projector can see the same event twice. It remembers the position it has reached, called a checkpoint, in the same transaction as the update, and skips events it already applied.',
        boxes: [b('e', 'Event store', ['event 5001 delivered twice'], 'warn', 'duplicate'), b('p', 'Balance projector', ['already applied 5001'], 'ok', 'idempotent'), b('k', 'Checkpoint table', ['position = 5001'], 'ok')],
        deps: [d('Event store', 'Balance projector', 'event 5001 again', 'warn'), d('Balance projector', 'Checkpoint table', 'compare and skip', 'ok')],
      },
      {
        note: 'A bug in a projector, or a new question nobody planned for, is not a disaster. Delete the read model, reset the checkpoint to zero and replay every event. The read model is rebuilt from the source of truth.',
        boxes: [b('e', 'Event store', ['replay from event 1'], 'ok', 'source of truth'), b('p', 'New projector', ['fixed logic'], 'new'), b('v', 'Rebuilt view', ['correct again'], 'ok', 'rebuilt')],
        deps: [d('Event store', 'New projector', 'replay all', 'ok'), d('New projector', 'Rebuilt view', 'write', 'ok')],
      },
    ],
  },
  {
    id: 'consistency',
    label: 'Eventual consistency',
    title: 'The read side can be a moment behind the write side',
    frames: [
      {
        note: 'A customer deposits 100 and the screen immediately reloads the balance. The write is stored in the event store at once, but the read model is updated a moment later.',
        boxes: [b('u', 'Customer', ['deposits 100', 'reloads the screen'], 'new'), b('e', 'Event store', ['Deposited 100 stored'], 'ok'), b('v', 'Balance view', ['still shows 80.00'], 'warn', 'stale')],
        deps: [d('Customer', 'Event store', 'command', 'ok'), d('Customer', 'Balance view', 'query', 'warn')],
      },
      {
        note: 'The projector catches up, usually within milliseconds. The read model now shows 180. Until then the system is eventually consistent: the two sides agree after a short delay, not at the same instant.',
        boxes: [b('e', 'Event store', ['Deposited 100'], 'ok'), b('p', 'Balance projector', ['applies the event'], 'new'), b('v', 'Balance view', ['now shows 180.00'], 'ok', 'caught up')],
        deps: [d('Event store', 'Balance projector', 'event', 'ok'), d('Balance projector', 'Balance view', 'update', 'ok')],
      },
      {
        note: 'One fix is to return the new version number with the command result. The query then asks for a balance at least that version, and the read side waits briefly or answers "still updating" until it has caught up.',
        boxes: [b('u', 'Customer', ['command returns version 7'], 'new'), b('q', 'Query API', ['wait until view reaches v7'], 'ok'), b('v', 'Balance view', ['at version 7'], 'ok')],
        deps: [d('Customer', 'Query API', 'GET balance, min version 7', 'ok'), d('Query API', 'Balance view', 'read when ready', 'ok')],
      },
      {
        note: 'Another fix is in the user interface: show the new balance straight away from the command response, mark it pending, and replace it when the read model confirms. For decisions that must be exact, such as approving a payment, read from the write side, never from a lagging view.',
        boxes: [b('u', 'Customer', ['sees 180.00 (pending)'], 'new', 'optimistic UI'), b('a', 'Account aggregate', ['exact balance for approvals'], 'ok', 'authoritative'), b('v', 'Balance view', ['for display only'], 'warn')],
        deps: [d('Customer', 'Balance view', 'display', 'warn'), d('Customer', 'Account aggregate', 'approve payment', 'ok')],
      },
    ],
  },
  {
    id: 'evolution',
    label: 'Changing events',
    title: 'You cannot edit history, so you add to it',
    frames: [
      {
        note: 'A wrong event cannot be edited, because other services and read models have already used it. A mistake is fixed by appending a new event that corrects it, for example a reversal. The history shows both the mistake and the fix, which is what auditors want.',
        boxes: [b('e', 'Event store', ['MoneyWithdrawn 200 (typo, meant 20)'], 'bad', 'wrong'), b('c', 'Correction event', ['WithdrawalReversed 200', 'MoneyWithdrawn 20'], 'ok', 'new facts')],
        deps: [d('Correction event', 'Event store', 'append', 'ok')],
      },
      {
        note: 'The shape of an event changes over time: version 1 of MoneyDeposited has only an amount, version 2 adds a currency. Old events stay in the store in their old shape forever.',
        boxes: [b('o', 'Event v1', ['amount: 100'], 'warn', 'stored years ago'), b('n', 'Event v2', ['amount: 100', 'currency: SGD'], 'new', 'new shape')],
        deps: [],
      },
      {
        note: 'An upcaster converts an old event into the current shape when it is read: v1 becomes v2 with a default currency of SGD. The code that handles events only needs to know the newest version, and the stored events are untouched.',
        boxes: [b('o', 'Event v1', ['amount: 100'], 'warn'), b('u', 'Upcaster', ['adds currency = SGD'], 'new', 'converts'), b('h', 'Event handler', ['sees only the current shape'], 'ok')],
        deps: [d('Event v1', 'Upcaster', 'read', 'warn'), d('Upcaster', 'Event handler', 'v2', 'ok')],
      },
      {
        note: 'Personal data in an immutable log conflicts with the right to be forgotten. Common answers: keep personal data out of events and store it in a separate table you can delete, or encrypt it with a key per customer and delete the key (crypto-shredding), which makes the stored data unreadable.',
        boxes: [b('e', 'Event store', ['events hold ciphertext'], 'ok'), b('k', 'Key vault', ['one key per customer'], 'new', 'delete to forget'), b('c', 'Customer', ['asks to be forgotten'], 'none')],
        deps: [d('Customer', 'Key vault', 'delete the key', 'bad'), d('Key vault', 'Event store', 'data unreadable', 'bad')],
      },
    ],
  },
];
