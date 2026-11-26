// Frame data for the Spring transactions walk-through, drawn by BoardStage.
// Transactions are drawn as regions; the methods that run inside a transaction sit inside its region.

import { BoardStage } from './BoardStage.jsx';

/* ---------- REQUIRED vs REQUIRES_NEW ---------- */
const txA = (title, tone) => ({ x: 14, y: 30, w: 300, h: 196, title, tone });
const txB = (title, tone) => ({ x: 340, y: 30, w: 286, h: 196, title, tone });
const transfer = (lines, o = {}) => ({ id: 'transfer', x: 30, y: 74, w: 268, title: 'TransferService.transfer()', lines, tone: 'new', ...o });
const recordIn = (lines, o = {}) => ({ id: 'record', x: 30, y: 152, w: 268, title: 'AuditService.record()', lines, tone: 'new', ...o });
const recordOut = (lines, o = {}) => ({ id: 'record', x: 356, y: 74, w: 254, title: 'AuditService.record()', lines, tone: 'new', ...o });
const held = (n) => ({ x: 14, y: 250, t: `connections held by this thread: ${n}` });

const propFrames = [
  {
    h: 264,
    line: 'transfer() calls auditService.record()',
    regions: [txA('Transaction A', 'new')],
    texts: [held(1)],
    cards: [transfer(['@Transactional', 'started Transaction A']), recordOut(['@Transactional(propagation = ?)'], { tone: 'none' })],
    arrows: [{ from: 'transfer', to: 'record', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'transfer() is @Transactional, so it started Transaction A. It calls record() on another bean. The call goes through that bean\'s proxy, so Spring must decide what record() does with the transaction that already exists.',
  },
  {
    h: 264,
    line: 'propagation = REQUIRED   (the default)',
    result: { text: 'one transaction', tone: 'ok' },
    regions: [txA('Transaction A', 'ok')],
    texts: [held(1)],
    cards: [transfer(['writes the transfer rows'], { tone: 'ok' }), recordIn(['joins A', 'writes the audit row'], { tone: 'ok' })],
    arrows: [{ from: 'transfer', to: 'record', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'With REQUIRED, record() joins Transaction A. There is one physical transaction, so the audit row and the transfer rows commit or roll back together.',
  },
  {
    h: 264,
    line: 'catch (RuntimeException e) { }   // swallowed',
    result: { text: 'UnexpectedRollbackException', tone: 'bad' },
    regions: [txA('Transaction A: marked rollback-only', 'bad')],
    texts: [held(1)],
    cards: [transfer(['catches it, returns normally', 'then tries to commit'], { tone: 'warn' }), recordIn(['throws RuntimeException'], { tone: 'bad', badge: 'dooms A' })],
    arrows: [{ from: 'record', to: 'transfer', fs: 't', ts: 'b', tone: 'bad' }],
    note: 'The trap: record() throws, and transfer() catches the exception and carries on. But the shared transaction was already marked rollback-only. When transfer() returns and Spring tries to commit, it throws UnexpectedRollbackException and rolls everything back.',
  },
  {
    h: 264,
    line: 'propagation = REQUIRES_NEW',
    regions: [txA('Transaction A: suspended', 'warn'), txB('Transaction B: its own connection', 'new')],
    texts: [held(2)],
    cards: [transfer(['waits for record()'], { tone: 'warn' }), recordOut(['writes the audit row'], { tone: 'new' })],
    arrows: [{ from: 'transfer', to: 'record', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'With REQUIRES_NEW, Spring suspends Transaction A and starts an independent Transaction B on a second connection. B commits or rolls back on its own. Note that the thread now holds two connections at once.',
  },
  {
    h: 264,
    line: 'transfer fails later  →  A rolls back',
    result: { text: 'audit row survives', tone: 'ok' },
    regions: [txA('Transaction A: rolled back', 'bad'), txB('Transaction B: committed', 'ok')],
    texts: [held(0)],
    cards: [transfer(['transfer undone'], { tone: 'bad' }), recordOut(['audit row kept'], { tone: 'ok' })],
    note: 'If the transfer then fails and A rolls back, the audit row in B is already committed and stays. That is right for audit trails and failure logs. The cost is a second connection and no atomicity between the two, so use it on purpose.',
  },
];

/* ---------- rollback rules ---------- */
const method = (lines, o = {}) => ({ id: 'm', x: 14, y: 70, w: 230, title: 'transfer()', lines, mono: true, tone: 'none', ...o });
const proxy = (lines, o = {}) => ({ id: 'p', x: 282, y: 80, w: 150, title: 'Transaction proxy', lines, tone: 'none', ...o });
const rows = (lines, o = {}) => ({ id: 'db', x: 470, y: 80, w: 156, title: 'Database', lines, mono: true, tone: 'none', ...o });
const rbArrows = (t1, t2) => [{ from: 'm', to: 'p', fs: 'r', ts: 'l', tone: t1 }, { from: 'p', to: 'db', fs: 'r', ts: 'l', tone: t2 }];

const rollbackFrames = [
  {
    h: 220,
    line: 'throw new InsufficientFundsException()   // unchecked',
    result: { text: 'rolled back', tone: 'ok' },
    cards: [method(['debit(from, 100);', 'throw new Insufficient…', '// extends RuntimeException'], { tone: 'bad' }), proxy(['unchecked exception', '→ rollback'], { tone: 'ok' }), rows(['debit: undone'], { tone: 'ok' })],
    arrows: rbArrows('bad', 'ok'),
    note: 'The default rule: a RuntimeException or an Error that leaves a @Transactional method rolls the transaction back. InsufficientFundsException is unchecked, so the debit is undone.',
  },
  {
    h: 220,
    line: 'throw new BankException()   // checked',
    result: { text: 'commits half the work', tone: 'bad' },
    cards: [method(['debit(from, 100);', 'throw new BankException();', '// extends Exception'], { tone: 'warn' }), proxy(['checked exception', '→ commit'], { tone: 'warn' }), rows(['debit: -100 saved', 'credit: missing'], { tone: 'bad', badge: 'wrong' })],
    arrows: rbArrows('warn', 'bad'),
    note: 'The surprise: a checked exception does NOT roll back by default. The transaction commits, including the debit made before the exception. The money leaves one account and never arrives in the other.',
  },
  {
    h: 220,
    line: '@Transactional(rollbackFor = Exception.class)',
    result: { text: 'rolled back', tone: 'ok' },
    cards: [method(['debit(from, 100);', 'throw new BankException();', '// rollbackFor covers it'], { tone: 'warn' }), proxy(['listed in rollbackFor', '→ rollback'], { tone: 'ok' }), rows(['debit: undone'], { tone: 'ok' })],
    arrows: rbArrows('warn', 'ok'),
    note: 'The fix: add rollbackFor = Exception.class (or the specific type), or make the exception unchecked. Many teams make all domain exceptions RuntimeExceptions to avoid this trap.',
  },
  {
    h: 220,
    line: 'catch (Exception e) { log.warn(..); }',
    result: { text: 'commits half the work', tone: 'bad' },
    cards: [method(['debit(from, 100);', 'try { credit(); }', 'catch (e) { log }'], { tone: 'warn', badge: 'swallowed' }), proxy(['normal return', '→ commit'], { tone: 'warn' }), rows(['debit: -100 saved', 'credit: missing'], { tone: 'bad', badge: 'wrong' })],
    arrows: rbArrows('ok', 'bad'),
    note: 'Another silent commit: a try/catch that swallows the exception. The proxy only sees what leaves the method, and a normal return means commit. Rethrow, or call setRollbackOnly() on the current transaction status.',
  },
];

/* ---------- events and commit ---------- */
const tx = (title, tone) => ({ x: 14, y: 30, w: 300, h: 196, title, tone });
const esvc = (lines, o = {}) => ({ id: 'svc', x: 30, y: 74, w: 268, title: 'TransferService.transfer()', lines, tone: 'new', ...o });
const erows = (lines, o = {}) => ({ id: 'rows', x: 30, y: 152, w: 268, title: 'rows written', lines, mono: true, tone: 'none', ...o });
const right1 = (title, lines, o = {}) => ({ id: 'r1', x: 360, y: 74, w: 266, title, lines, tone: 'none', ...o });
const right2 = (title, lines, o = {}) => ({ id: 'r2', x: 360, y: 160, w: 266, title, lines, tone: 'none', ...o });

const eventFrames = [
  {
    h: 244,
    line: 'kafka.send("transfers", event);   // inside the transaction',
    regions: [tx('Transaction A: open', 'warn')],
    cards: [esvc(['saves the transfer', 'sends a message']), erows(['transfer #9  (not committed)']), right1('Message broker', ['TransferCompleted #9'], { tone: 'warn' })],
    arrows: [{ from: 'svc', to: 'r1', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'transfer() saves the transfer and, still inside the transaction, sends a TransferCompleted message to the broker. The database changes are not committed yet.',
  },
  {
    h: 244,
    line: 'consumer: select * from transfer where id = 9',
    result: { text: 'not found, or never happened', tone: 'bad' },
    regions: [tx('Transaction A: still open', 'warn')],
    cards: [esvc(['saves the transfer', 'sends a message']), erows(['transfer #9  (not committed)']), right1('Message broker', ['TransferCompleted #9']), right2('Consumer', ['reads transfer #9'], { tone: 'bad' })],
    arrows: [{ from: 'r1', to: 'r2', fs: 'b', ts: 't' }, { from: 'r2', to: 'rows', fs: 'l', ts: 'r', tone: 'bad', cross: true }],
    note: 'Problem 1: a consumer reacts at once and queries the database, but the row is not committed, so it finds nothing. Problem 2: if the transaction then rolls back, the message describes something that never happened.',
  },
  {
    h: 244,
    line: '@TransactionalEventListener(phase = AFTER_COMMIT)',
    result: { text: 'runs only after commit', tone: 'ok' },
    regions: [tx('Transaction A: committed', 'ok')],
    cards: [esvc(['publishEvent(TransferCompleted)'], { tone: 'ok' }), erows(['transfer #9  (committed)'], { tone: 'ok' }), right1('NotificationListener', ['AFTER_COMMIT', 'skipped on rollback'], { tone: 'ok' })],
    arrows: [{ from: 'rows', to: 'r1', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'For in-process events, publish an ApplicationEvent and handle it with @TransactionalEventListener(phase = AFTER_COMMIT). Spring holds the listener until the transaction commits, and skips it on rollback.',
  },
  {
    h: 244,
    line: 'insert into outbox ...   // same transaction',
    result: { text: 'guaranteed delivery', tone: 'ok' },
    regions: [tx('Transaction A: committed atomically', 'ok')],
    cards: [esvc(['saves transfer + outbox row'], { tone: 'ok' }), erows(['transfer #9', 'outbox: TransferCompleted'], { tone: 'ok', badge: 'atomic' }), right1('Outbox relay', ['reads new outbox rows'], { tone: 'ok' }), right2('Message broker', ['at-least-once delivery'], { tone: 'ok' })],
    arrows: [{ from: 'rows', to: 'r1', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'r1', to: 'r2', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'AFTER_COMMIT still has a gap: the app can crash between the commit and the send. For guaranteed delivery, write the event to an outbox table in the same transaction, and let a relay publish it. This is the transactional outbox pattern.',
  },
];

export const SPRING_TX_SCENES = [
  { id: 'propagation', label: 'REQUIRED vs REQUIRES_NEW', title: 'An inner call either joins the outer transaction or runs in its own', stage: BoardStage, frames: propFrames },
  { id: 'rollback', label: 'Rollback rules', title: 'Which exceptions roll back, and which silently commit', stage: BoardStage, frames: rollbackFrames },
  { id: 'aftercommit', label: 'Events and commit', title: 'Publish to other systems only after the transaction has committed', stage: BoardStage, frames: eventFrames },
];
