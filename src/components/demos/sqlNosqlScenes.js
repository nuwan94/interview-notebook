// Frame data for the SQL vs NoSQL walk-through.
// The data model scene is drawn by SqlDocStage (tables and a document); the others use the box-and-arrow player.
// box.tone: ok | bad | warn | new | none.

import { SqlDocStage } from './SqlDocStage.jsx';

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

const ALICE = { customer: [0], branch: [0], address: [0, 1], phone: [0, 1] };

export const SQLNOSQL_SCENES = [
  {
    id: 'model',
    label: 'Data model',
    title: 'The same customer as linked tables and as one document',
    stage: SqlDocStage, // drawn by SqlDocStage: four tables with foreign keys, and one JSON document
    frames: [
      {
        line: '-- customer 7 is Alice: one branch, two addresses, two phones',
        focus: 'sql',
        note: 'Alice has a branch, two addresses and two phone numbers. A relational database splits this into four tables. Each fact is stored once, and foreign keys link the rows together.',
      },
      {
        line: 'SELECT ... FROM customer JOIN branch JOIN address JOIN phone WHERE customer.id = 7',
        result: { text: 'one query, four tables', tone: 'new' },
        focus: 'sql',
        links: true,
        hit: ALICE,
        note: 'To show Alice\'s page, the database follows the keys and joins the four tables. This is flexible, because you can ask any new question later. The cost is that every read does the join work.',
      },
      {
        line: 'db.customers.findOne({ _id: 7 })',
        result: { text: 'one read, no join', tone: 'ok' },
        focus: 'doc',
        docHit: true,
        note: 'A document store keeps the whole customer in one JSON document, with the addresses and phones inside it. One read by key returns everything. Each document can have a different shape, with no migration.',
      },
      {
        line: "UPDATE branch SET name = 'Orchard Road' WHERE id = 1",
        result: { text: 'SQL: 1 row. Documents: 50,000 copies', tone: 'warn' },
        focus: 'both',
        branchName: 'Orchard Road',
        branchTone: 'ok',
        docMark: true,
        docMore: true,
        note: 'The cost of copies shows up when shared data changes. Renaming the branch changes one row in SQL. In the document store, the name is copied into 50,000 documents, and every copy must be updated.',
      },
    ],
  },
  {
    id: 'scale',
    label: 'Scaling',
    title: 'Scale up and add read replicas, or shard across many nodes',
    frames: [
      {
        note: 'A relational database starts on one server. When it grows, the first step is to scale up: a bigger machine with more CPU, memory and faster disks. It is simple, and every transaction and join still works.',
        boxes: [b('c', 'Client', ['app traffic'], 'new'), b('p', 'Primary database', ['one big server', 'all reads and writes'], 'ok')],
        deps: [d('Client', 'Primary database', 'reads and writes', 'ok')],
      },
      {
        note: 'When most traffic is reads, add read replicas. Writes still go to the one primary, so write capacity does not grow. Replicas copy the primary with a short delay (replication lag), so their reads can be slightly stale.',
        boxes: [b('p', 'Primary database', ['writes'], 'ok'), b('r1', 'Replica 1', ['reads'], 'ok'), b('r2', 'Replica 2', ['reads'], 'ok')],
        deps: [d('Primary database', 'Replica 1', 'replicate', 'ok'), d('Primary database', 'Replica 2', 'replicate', 'ok')],
      },
      {
        note: 'To grow writes and data beyond one machine, you shard. The data is split across nodes by a key, here a hash of the customer id. Each node owns part of the data, so a read or write by key goes to exactly one shard. Most NoSQL stores do this out of the box.',
        boxes: [b('c', 'Client', ['get customer 7'], 'new'), b('s1', 'Shard node 1', ['ids 0 to 3'], 'ok'), b('s2', 'Shard node 2', ['ids 4 to 7', 'customer 7 is here'], 'new', 'owner'), b('s3', 'Shard node 3', ['ids 8 to 11'], 'ok')],
        deps: [d('Client', 'Shard node 2', 'hash(7) routes here', 'ok')],
      },
      {
        note: 'The price is work that spans shards. A transfer from customer 3 to customer 7 touches two nodes, so it needs coordination and is slow, or not supported at all. Choose the key so the common operations stay on one shard.',
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
        note: 'A banking platform has very different kinds of data. One database for everything forces compromises. So many systems pick one store per need, which is called polyglot persistence.',
        boxes: [b('a', 'Payments service', ['money moves', 'must be exact'], 'new'), b('b', 'Profile service', ['flexible customer details'], 'new'), b('c', 'Session service', ['login state, expires'], 'new'), b('e', 'Search service', ['find by free text'], 'new')],
        deps: [],
      },
      {
        note: 'Payments need ACID transactions, constraints and joins, so they use a relational database. Profiles have varied, nested fields that are read as a whole, so they use a document store. Sessions are simple lookups by key that must be fast and expire, so they use a key-value store.',
        boxes: [b('a', 'Payments service', ['transfer, ledger'], 'ok'), b('rd', 'Relational database', ['ACID, constraints, joins'], 'ok', 'PostgreSQL'), b('b', 'Profile service', ['customer profile'], 'ok'), b('dd', 'Document store', ['flexible JSON'], 'ok', 'MongoDB'), b('c', 'Session service', ['session by id'], 'ok'), b('kv', 'Key-value store', ['fast get and set, TTL'], 'ok', 'Redis')],
        deps: [d('Payments service', 'Relational database', 'transactions', 'ok'), d('Profile service', 'Document store', 'documents', 'ok'), d('Session service', 'Key-value store', 'key lookups', 'ok')],
      },
      {
        note: 'Free-text search with relevance ranking suits a search engine. Analytics over huge tables suit a column store. Both are filled from the main database. They are copies, so they are only eventually consistent with the source of truth.',
        boxes: [b('rd', 'Relational database', ['source of truth'], 'ok'), b('e', 'Search service', ['inverted index'], 'ok', 'Elasticsearch'), b('cs', 'Column store', ['totals over billions of rows'], 'ok', 'warehouse')],
        deps: [d('Relational database', 'Search service', 'index changes', 'ok'), d('Relational database', 'Column store', 'load', 'ok')],
      },
      {
        note: 'Many stores have a cost. There is more to run and more to learn, and keeping the stores consistent is your job (events, the outbox and reconciliation). Start with one relational database, and add a specialised store only when a real need appears.',
        boxes: [b('rd', 'Relational database', ['start here'], 'ok', 'default'), b('n', 'Document store', ['add when a need is proven'], 'warn', 'cost: ops and sync')],
        deps: [],
      },
    ],
  },
];
