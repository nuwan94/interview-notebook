// Frame data for the Spring Data JPA and Hibernate walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- entity states ---------- */
// "your code" on the left, the persistence context in the middle, the database on the right.
const ctxRegion = (title = 'persistence context', tone = 'new') => ({ x: 196, y: 24, w: 240, h: 230, title, tone });
const db = (lines, o = {}) => ({ id: 'db', x: 470, y: 96, w: 156, title: 'account table', lines, mono: true, tone: 'none', ...o });
const acct = (x, y, lines, o = {}) => ({ id: 'acct', x, y, w: 152, title: 'Account', lines, mono: true, tone: 'none', ...o });
const IN = [216, 70];
const OUT = [20, 70];
const OUT_LOW = [20, 170];

const stateFrames = [
  {
    h: 270,
    line: 'Account a = new Account("NL01", 100);',
    texts: [{ x: 20, y: 44, t: 'your code' }, { x: 216, y: 140, t: '(empty)' }],
    regions: [ctxRegion()],
    cards: [acct(...OUT, ['id = null', 'balance = 100'], { badge: 'transient', badgeTone: 'none' }), db(['(no row)'])],
    note: 'new Account() creates a plain Java object. It is transient: the persistence context does not know it, there is no database row, and changes to it are never saved.',
  },
  {
    h: 270,
    line: 'repository.save(a);   // persist',
    texts: [{ x: 20, y: 44, t: 'your code' }, { x: 216, y: 160, t: 'INSERT queued until flush' }],
    regions: [ctxRegion()],
    cards: [acct(...IN, ['id = 1', 'balance = 100'], { tone: 'ok', badge: 'managed' }), db(['(no row yet)'])],
    note: 'save() calls persist, and the entity becomes managed: the persistence context now tracks it. The INSERT does not run yet. Hibernate queues it and sends it at flush, usually at commit.',
  },
  {
    h: 270,
    line: 'a.setBalance(70);   // no save() needed',
    result: { text: 'UPDATE at commit', tone: 'ok' },
    texts: [{ x: 20, y: 44, t: 'your code' }],
    regions: [ctxRegion()],
    cards: [
      acct(...IN, ['id = 1', 'balance = 70'], { tone: 'ok', badge: 'dirty' }),
      { id: 'snap', x: 216, y: 170, w: 152, title: 'snapshot', lines: ['balance = 100'], mono: true, tone: 'none' },
      db(['1  NL01  70'], { tone: 'ok', badge: 'flushed' }),
    ],
    arrows: [{ from: 'acct', to: 'db', fs: 'r', ts: 'l', label: 'flush', tone: 'ok' }],
    note: 'While the entity is managed, changing a field is enough. At flush Hibernate compares it with the snapshot it took on loading. This is dirty checking: the balance differs, so it sends an UPDATE. Inside a transaction you do not call save().',
  },
  {
    h: 270,
    line: 'transaction committed  →  context closed',
    result: { text: 'changes ignored', tone: 'warn' },
    texts: [{ x: 20, y: 44, t: 'your code' }],
    regions: [ctxRegion('persistence context (closed)', 'none')],
    cards: [acct(...OUT_LOW, ['id = 1', 'balance = 70'], { tone: 'warn', badge: 'detached' }), db(['1  NL01  70'])],
    note: 'When the transaction ends, the context closes and the entity becomes detached. It still has its id and data, but nothing tracks it, so new changes are not saved. Its lazy associations can no longer load.',
  },
  {
    h: 270,
    line: 'Account managed = repository.save(detached);   // merge',
    texts: [{ x: 20, y: 44, t: 'your code' }],
    regions: [ctxRegion()],
    cards: [
      acct(...OUT_LOW, ['id = 1', 'balance = 50'], { tone: 'warn', badge: 'detached', id: 'old' }),
      acct(...IN, ['id = 1', 'balance = 50'], { tone: 'ok', badge: 'managed copy' }),
      db(['1  NL01  70']),
    ],
    arrows: [{ from: 'old', to: 'acct', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'save() on a detached entity calls merge. Hibernate loads the row into the context and copies your state onto that managed copy. Use the returned object, not the one you passed in. delete() marks a managed entity as removed, and the DELETE runs at flush.',
  },
];

/* ---------- the N+1 problem ---------- */
const svc = (lines, o = {}) => ({ id: 'svc', x: 14, y: 100, w: 150, title: 'ReportService', lines, tone: 'new', ...o });
const log = (lines, o = {}) => ({ id: 'log', x: 206, y: 30, w: 270, title: 'SQL sent', lines, mono: true, tone: 'none', ...o });
const ndb = (o = {}) => ({ id: 'db', x: 516, y: 100, w: 110, title: 'Database', lines: ['customer', 'address'], tone: 'none', ...o });
const nArrows = (tone) => [{ from: 'svc', to: 'log', fs: 'r', ts: 'l', tone }, { from: 'log', to: 'db', fs: 'r', ts: 'l', tone }];

const n1Frames = [
  {
    h: 260,
    line: 'customerRepository.findAll()',
    result: { text: '1 query', tone: 'ok' },
    cards: [svc(['findAll()']), log(['select * from customer']), ndb()],
    arrows: nArrows('new'),
    note: 'A report loads all 100 customers and prints their addresses. findAll() runs one query for the customers. Addresses are lazy, so they are not loaded yet.',
  },
  {
    h: 260,
    line: 'for (Customer c : all) c.getAddresses()...',
    result: { text: '1 + 100 = 101 queries', tone: 'bad' },
    cards: [
      svc(['getAddresses()', 'for each customer'], { tone: 'warn' }),
      log(['select * from customer', 'select … where customer_id = 1', 'select … where customer_id = 2', 'select … where customer_id = 3', '…', 'select … where customer_id = 100'], { tone: 'bad', badge: 'N+1' }),
      ndb({ tone: 'bad' }),
    ],
    arrows: nArrows('bad'),
    note: 'The loop calls getAddresses() on each customer. Every call runs its own SELECT. That is 1 + N = 101 queries to print one page. It feels fine in development with 5 rows, and collapses in production.',
  },
  {
    h: 260,
    line: 'select c from Customer c join fetch c.addresses',
    result: { text: '1 query', tone: 'ok' },
    cards: [svc(['findAllWithAddresses()'], { tone: 'ok' }), log(['select c.*, a.*', 'from customer c', 'join address a on …'], { tone: 'ok', badge: 'fetch join' }), ndb({ tone: 'ok' })],
    arrows: nArrows('ok'),
    note: 'Fix 1: fetch the addresses in the same query with a fetch join, or an @EntityGraph. One query returns the customers with their addresses already loaded.',
  },
  {
    h: 260,
    line: 'hibernate.default_batch_fetch_size=50',
    result: { text: '3 queries', tone: 'ok' },
    cards: [
      svc(['paged list'], { tone: 'ok' }),
      log(['select * from customer', 'select … where customer_id in (1 … 50)', 'select … where customer_id in (51 … 100)'], { tone: 'ok', badge: 'batched' }),
      ndb({ tone: 'ok' }),
    ],
    arrows: nArrows('ok'),
    note: 'Fix 2, for paged lists: batch fetching loads the addresses of 50 customers per query, so 100 customers need 3 queries. A DTO projection that selects only the needed columns also works. Catch N+1 by logging SQL or counting statements in tests.',
  },
];

/* ---------- lazy loading error ---------- */
const txRegion = (title, tone) => ({ x: 14, y: 24, w: 306, h: 220, title, tone });
const lsvc = (lines, o = {}) => ({ id: 'svc', x: 30, y: 66, w: 274, title: 'AccountService', lines, tone: 'new', ...o });
const lent = (x, lines, o = {}) => ({ id: 'ent', x, y: 150, w: 274, title: 'Account #42', lines, mono: true, tone: 'ok', ...o });
const lctrl = (lines, o = {}) => ({ id: 'ctrl', x: 352, y: 66, w: 274, title: 'AccountController', lines, tone: 'none', ...o });

const lazyFrames = [
  {
    h: 260,
    line: '@Transactional  findById(42)',
    regions: [txRegion('transaction: context open', 'new')],
    cards: [lsvc(['findById(42)']), lent(30, ['balance = 100', 'transactions = (lazy proxy)'], { badge: 'managed' }), lctrl(['waiting'])],
    arrows: [{ from: 'svc', to: 'ent', fs: 'b', ts: 't' }],
    note: 'findById() runs inside a transactional service method. The Account is loaded. Its transactions collection is lazy, so it holds only a proxy placeholder, and no SQL has run for it.',
  },
  {
    h: 260,
    line: 'return account;   // commit',
    regions: [txRegion('transaction committed: context closed', 'none')],
    cards: [lsvc(['returned'], { dim: true }), lent(352, ['balance = 100', 'transactions = (lazy proxy)'], { tone: 'warn', badge: 'detached' }), lctrl(['got the entity'])],
    arrows: [{ from: 'ctrl', to: 'ent', fs: 'b', ts: 't', tone: 'warn' }],
    note: 'The method returns and the transaction commits. The persistence context closes, so the Account is now detached. The lazy collection is still only a proxy, and it can no longer reach the database.',
  },
  {
    h: 260,
    line: 'account.getTransactions().size()',
    result: { text: 'LazyInitializationException', tone: 'bad' },
    regions: [txRegion('transaction committed: context closed', 'none')],
    cards: [lsvc(['returned'], { dim: true }), lent(352, ['balance = 100', 'transactions = (lazy proxy)'], { tone: 'bad', badge: 'no session' }), lctrl(['getTransactions()', 'or the JSON serializer'], { tone: 'bad' })],
    arrows: [{ from: 'ctrl', to: 'ent', fs: 'b', ts: 't', tone: 'bad', cross: true }],
    note: 'Later the controller, or the JSON serializer, touches account.getTransactions(). The proxy needs an open context to load the rows, and finds it closed. Hibernate throws LazyInitializationException: "could not initialize proxy - no Session".',
  },
  {
    h: 260,
    line: 'return AccountDto.from(account);   // inside the transaction',
    result: { text: 'fixed', tone: 'ok' },
    regions: [txRegion('transaction: context open', 'new')],
    cards: [
      lsvc(['findWithTransactions(42)', 'maps to a DTO'], { tone: 'ok' }),
      lent(30, ['balance = 100', 'transactions = [3 rows]'], { badge: 'fetch join' }),
      lctrl(['gets AccountDto', 'plain data, no proxies'], { tone: 'ok' }),
    ],
    arrows: [{ from: 'svc', to: 'ctrl', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The fix: load what the use case needs inside the transaction, with a fetch join or an entity graph, and return a DTO. The web layer never touches lazy data. Making everything EAGER is not a fix. Open-in-view hides the problem but holds a connection for the whole request.',
  },
];

export const SPRING_JPA_SCENES = [
  { id: 'states', label: 'Entity states', title: 'An entity moves between transient, managed, detached and removed', stage: BoardStage, frames: stateFrames },
  { id: 'n1', label: 'The N+1 problem', title: 'One query for the list, then one more per row, unless you fetch together', stage: BoardStage, frames: n1Frames },
  { id: 'lazy', label: 'Lazy loading error', title: 'Touching a lazy association after the transaction ended throws LazyInitializationException', stage: BoardStage, frames: lazyFrames },
];
