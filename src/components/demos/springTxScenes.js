// Frame data for the Spring transactions walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_TX_SCENES = [
  {
    id: 'propagation',
    label: 'REQUIRED vs REQUIRES_NEW',
    title: 'An inner call either joins the outer transaction or runs in its own',
    frames: [
      {
        note: 'TransferService.transfer() is @Transactional and starts Transaction A. It calls AuditService.record() on another bean, so the call goes through that bean\'s proxy and Spring has to decide what to do with the existing transaction.',
        boxes: [b('s', 'Transfer service bean', ['transfer() @Transactional'], 'new'), b('t', 'Transaction A', ['started by transfer()'], 'ok', 'active'), b('a', 'Audit service bean', ['record() called inside'], 'new')],
        deps: [d('Transfer service bean', 'Audit service bean', 'record()', 'ok')],
      },
      {
        note: 'REQUIRED (the default): record() joins Transaction A. There is one physical transaction, so the audit row and the transfer rows commit or roll back together.',
        boxes: [b('t', 'Transaction A', ['transfer rows', 'audit row'], 'ok', 'one transaction'), b('a', 'Audit service bean', ['REQUIRED: joined A'], 'ok')],
        deps: [d('Audit service bean', 'Transaction A', 'joins', 'ok')],
      },
      {
        note: 'The trap: if record() throws a RuntimeException that transfer() catches and swallows, the shared transaction has already been marked rollback-only. When transfer() returns normally and tries to commit, Spring throws UnexpectedRollbackException and everything rolls back.',
        boxes: [b('a', 'Audit service bean', ['throws RuntimeException'], 'bad'), b('t', 'Transaction A', ['marked rollback-only'], 'bad', 'doomed'), b('s', 'Transfer service bean', ['catches it, returns normally'], 'warn')],
        deps: [d('Audit service bean', 'Transaction A', 'rollback-only', 'bad')],
      },
      {
        note: 'REQUIRES_NEW: record() suspends Transaction A and starts an independent Transaction B on a separate connection. B commits on its own, regardless of A.',
        boxes: [b('t1', 'Transaction A', ['suspended'], 'warn', 'waiting'), b('t2', 'Transaction B', ['audit row'], 'ok', 'independent'), b('a', 'Audit service bean', ['REQUIRES_NEW'], 'new')],
        deps: [d('Audit service bean', 'Transaction B', 'starts new', 'ok')],
      },
      {
        note: 'If the transfer later fails and Transaction A rolls back, the audit row in B is already committed and stays: the right choice for audit trails and failure logs. The cost is a second connection held at the same time and no atomicity between the two, so use it deliberately.',
        boxes: [b('t1', 'Transaction A', ['rolled back: transfer undone'], 'bad', 'rolled back'), b('t2', 'Transaction B', ['audit row committed'], 'ok', 'committed')],
        deps: [],
      },
    ],
  },
  {
    id: 'rollback',
    label: 'Rollback rules',
    title: 'Which exceptions roll back, and which silently commit',
    frames: [
      {
        note: 'Default rule: a RuntimeException (unchecked) or an Error thrown out of a @Transactional method marks the transaction for rollback. Here an InsufficientFundsException extends RuntimeException, so the debit is undone.',
        boxes: [b('s', 'Transfer service bean', ['throws InsufficientFundsException', '(unchecked)'], 'bad'), b('t', 'Transaction A', ['rolled back'], 'ok', 'rollback')],
        deps: [d('Transfer service bean', 'Transaction A', 'RuntimeException', 'bad')],
      },
      {
        note: 'Surprise: a checked exception (extends Exception, such as IOException or a custom checked BankException) does NOT roll back by default. The transaction commits, including the half-finished work done before the exception.',
        boxes: [b('s', 'Transfer service bean', ['debit done, then throws', 'checked BankException'], 'warn'), b('t', 'Transaction A', ['committed with the debit but no credit'], 'bad', 'wrong commit')],
        deps: [d('Transfer service bean', 'Transaction A', 'checked exception', 'warn')],
      },
      {
        note: 'Fix: @Transactional(rollbackFor = Exception.class) (or the specific type), or make the exception unchecked. Many teams make all domain exceptions RuntimeExceptions to avoid this trap.',
        boxes: [b('s', 'Transfer service bean', ['@Transactional(rollbackFor = Exception.class)'], 'ok'), b('t', 'Transaction A', ['rolled back on the checked exception'], 'ok', 'correct')],
        deps: [d('Transfer service bean', 'Transaction A', 'rollbackFor', 'ok')],
      },
      {
        note: 'Another silent commit: a try/catch inside the method that swallows the exception. The proxy only sees what leaves the method, so a normal return means commit. Rethrow, or call TransactionAspectSupport.currentTransactionStatus().setRollbackOnly().',
        boxes: [b('s', 'Transfer service bean', ['try { credit(); } catch (Exception e) { log }'], 'warn', 'swallowed'), b('t', 'Transaction A', ['commits: partial work saved'], 'bad', 'wrong commit')],
        deps: [d('Transfer service bean', 'Transaction A', 'returns normally', 'warn')],
      },
    ],
  },
  {
    id: 'aftercommit',
    label: 'Events and commit',
    title: 'Publish to other systems only after the transaction has committed',
    frames: [
      {
        note: 'transfer() saves the transfer and, still inside the transaction, sends a "TransferCompleted" message to a broker. The database changes are not committed yet.',
        boxes: [b('s', 'Transfer service bean', ['save transfer', 'publish message'], 'new'), b('t', 'Transaction A', ['not committed yet'], 'warn', 'open'), b('k', 'Message broker', ['TransferCompleted delivered'], 'ok')],
        deps: [d('Transfer service bean', 'Message broker', 'publish inside the transaction', 'warn')],
      },
      {
        note: 'Problem 1: a consumer reacts at once and queries the database, but the transfer row is not committed, so it sees nothing. Problem 2: if the transaction then rolls back, the message was already sent about something that never happened.',
        boxes: [b('k', 'Message broker', ['consumer reads the database'], 'bad'), b('t', 'Transaction A', ['row invisible, or later rolled back'], 'bad', 'inconsistent')],
        deps: [d('Message broker', 'Transaction A', 'reads uncommitted data', 'bad')],
      },
      {
        note: 'Fix for in-process events: publish an ApplicationEvent and handle it with @TransactionalEventListener(phase = AFTER_COMMIT). Spring delays the listener until the transaction has committed and skips it on rollback.',
        boxes: [b('s', 'Transfer service bean', ['publishEvent(TransferCompleted)'], 'ok'), b('t', 'Transaction A', ['commit, then listeners run'], 'ok', 'committed'), b('l', 'Listener bean', ['@TransactionalEventListener AFTER_COMMIT'], 'ok')],
        deps: [d('Transaction A', 'Listener bean', 'after commit only', 'ok')],
      },
      {
        note: 'AFTER_COMMIT still has a gap: the application can crash between the commit and the send, losing the message. For guaranteed delivery write the event to an outbox table in the same transaction and let a relay publish it (the transactional outbox pattern).',
        boxes: [b('t', 'Transaction A', ['transfer row + outbox row committed atomically'], 'ok', 'atomic'), b('r', 'Message relay', ['reads the outbox, publishes'], 'ok'), b('k', 'Message broker', ['at-least-once delivery'], 'ok')],
        deps: [d('Message relay', 'Message broker', 'publish', 'ok')],
      },
    ],
  },
];
