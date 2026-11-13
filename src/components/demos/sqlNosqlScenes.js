// Frame data for the SQL vs NoSQL walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SQLNOSQL_SCENES = [
  {
    id: 'model',
    label: 'Data model',
    title: 'The same customer data as tables and as one document',
    frames: [
      {
        note: 'A customer has a name, two addresses and two phone numbers. In a relational database this is normalised into separate tables linked by keys, so each fact is stored once.',
        boxes: [b('r', 'Relational database', ['customer(id, name)', 'address(id, customer_id, city)', 'phone(id, customer_id, number)'], 'ok', 'normalised')],
        deps: [],
      },
      {
        note: 'To show the customer page you JOIN the three tables. Flexible (any question can be asked later) but the join costs work on every read.',
        boxes: [b('c', 'Client', ['show customer 7'], 'new'), b('r', 'Relational database', ['SELECT ... FROM customer', 'JOIN address ... JOIN phone ...'], 'ok', 'join')],
        deps: [d('Client', 'Relational database', 'one query, three tables', 'ok')],
      },
      {
        note: 'In a document store the whole customer is one JSON document with the addresses and phones embedded. One read by key returns everything, and the shape can differ from document to document with no migration.',
        boxes: [b('c', 'Client', ['show customer 7'], 'new'), b('d', 'Document store', ['{ id: 7, name: "Alice",', '  addresses: [ ... ],', '  phones: [ ... ] }'], 'ok', 'one read')],
        deps: [d('Client', 'Document store', 'get by key', 'ok')],
      },
      {
        note: 'The cost shows up on shared data. Rename a city or a branch name that appears in thousands of documents and you must update every copy. The relational database changes one row. Embedded copies are fast to read and costly to keep in sync.',
        boxes: [b('r', 'Relational database', ['UPDATE branch SET name = ...', '1 row changed'], 'ok', 'one place'), b('d', 'Document store', ['name copied into 50,000 documents', 'update them all'], 'warn', 'many copies')],
        deps: [],
      },
    ],
  },
  {
    id: 'scale',
    label: 'Scaling',
    title: 'Scale up and read replicas, or shard across many nodes',
    frames: [
      {
        note: 'A relational database starts on one server. Growth is first handled by scaling up: a bigger machine with more CPU, memory and faster disks. Simple, and every transaction and join works.',
        boxes: [b('c', 'Client', ['app traffic'], 'new'), b('p', 'Primary database', ['one big server', 'all reads and writes'], 'ok')],
        deps: [d('Client', 'Primary database', 'reads and writes', 'ok')],
      },
      {
        note: 'When reads dominate, add read replicas. Writes still go to the single primary, so write throughput does not grow, and replica reads can be slightly stale (replication lag).',
        boxes: [b('p', 'Primary database', ['writes'], 'ok'), b('r1', 'Replica 1', ['reads'], 'ok'), b('r2', 'Replica 2', ['reads'], 'ok')],
        deps: [d('Primary database', 'Replica 1', 'replicate', 'ok'), d('Primary database', 'Replica 2', 'replicate', 'ok')],
      },
      {
        note: 'To grow writes and data size beyond one machine you shard: split the data across nodes by a key (hash of customer id). Each node owns part of the data, so reads and writes by key hit exactly one shard. Most NoSQL stores do this natively.',
        boxes: [b('c', 'Client', ['get customer 7'], 'new'), b('s1', 'Shard node 1', ['ids 0 to 3'], 'ok'), b('s2', 'Shard node 2', ['ids 4 to 7', 'customer 7 is here'], 'new', 'owner'), b('s3', 'Shard node 3', ['ids 8 to 11'], 'ok')],
        deps: [d('Client', 'Shard node 2', 'hash(7) routes here', 'ok')],
      },
      {
        note: 'The price: a query or transaction that spans shards (a join, or a transfer between two customers on different nodes) needs coordination and is slow or unsupported. Design the key so the common operations stay on one shard.',
        boxes: [b('c', 'Client', ['transfer from customer 3 to customer 7'], 'new'), b('s1', 'Shard node 1', ['customer 3'], 'warn'), b('s2', 'Shard node 2', ['customer 7'], 'warn', 'cross-shard')],
        deps: [d('Client', 'Shard node 1', 'debit', 'warn'), d('Client', 'Shard node 2', 'credit', 'warn')],
      },
    ],
  },
  {
    id: 'choose',
    label: 'Choosing a store',
    title: 'Polyglot persistence: pick the store that fits each need',
    frames: [
      {
        note: 'A bank-style platform has very different data needs. Using one database for everything forces compromises, so many systems pick a store per need (polyglot persistence).',
        boxes: [b('a', 'Payments service', ['money moves', 'must be exact'], 'new'), b('b', 'Profile service', ['flexible customer details'], 'new'), b('c', 'Session service', ['login state, expires'], 'new'), b('e', 'Search service', ['find by free text'], 'new')],
        deps: [],
      },
      {
        note: 'Payments need ACID transactions, constraints and joins, so a relational database. Profiles have varied, nested fields read as a whole, so a document store. Sessions are simple key lookups needing speed and expiry, so a key-value store.',
        boxes: [b('a', 'Payments service', ['transfer, ledger'], 'ok'), b('rd', 'Relational database', ['ACID, constraints, joins'], 'ok', 'PostgreSQL'), b('b', 'Profile service', ['customer profile'], 'ok'), b('dd', 'Document store', ['flexible JSON'], 'ok', 'MongoDB'), b('c', 'Session service', ['session by id'], 'ok'), b('kv', 'Key-value store', ['fast get and set, TTL'], 'ok', 'Redis')],
        deps: [d('Payments service', 'Relational database', 'transactions', 'ok'), d('Profile service', 'Document store', 'documents', 'ok'), d('Session service', 'Key-value store', 'key lookups', 'ok')],
      },
      {
        note: 'Free-text search and relevance ranking suit a search engine fed from the main data. Analytics over huge tables suit a column store. These are derived copies, so they are eventually consistent with the source of truth.',
        boxes: [b('rd', 'Relational database', ['source of truth'], 'ok'), b('e', 'Search service', ['inverted index'], 'ok', 'Elasticsearch'), b('cs', 'Column store', ['aggregates over billions of rows'], 'ok', 'warehouse')],
        deps: [d('Relational database', 'Search service', 'index changes', 'ok'), d('Relational database', 'Column store', 'load', 'ok')],
      },
      {
        note: 'The cost of many stores: more to operate, more skills, and consistency between them is your job (events, outbox, reconciliation). Start with one relational database and add a specialised store only when a real need appears.',
        boxes: [b('rd', 'Relational database', ['start here'], 'ok', 'default'), b('n', 'Document store', ['add when a need is proven'], 'warn', 'cost: ops and sync')],
        deps: [],
      },
    ],
  },
];
