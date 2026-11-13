// Frame data for the ACID and BASE walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const ACID_SCENES = [
  {
    id: 'atomic',
    label: 'Atomicity and durability',
    title: 'A transfer is all or nothing, and a committed transfer survives a crash',
    frames: [
      {
        note: 'Move 100 from account A to account B. Both balances are 500. This is one transaction with two updates: debit A, credit B.',
        boxes: [b('t', 'Transaction T1', ['BEGIN', 'debit A by 100', 'credit B by 100', 'COMMIT'], 'new'), b('d', 'Database', ['A = 500', 'B = 500'], 'ok')],
        deps: [],
      },
      {
        note: 'Before changing the data pages, the database writes each change to the write-ahead log (WAL), with the old and new values. The log is the safety net: it is flushed to disk first.',
        boxes: [b('l', 'Write-ahead log', ['T1: A 500 -> 400', 'T1: B 500 -> 600 (not yet)'], 'new', 'logged first'), b('d', 'Database', ['A = 400 (in memory)', 'B = 500'], 'warn', 'half done')],
        deps: [d('Transaction T1', 'Write-ahead log', 'log the change', 'ok'), d('Transaction T1', 'Database', 'debit A', 'ok')],
      },
      {
        note: 'The server crashes after the debit but before the credit and before COMMIT. Money has vanished from A and not arrived at B. Without atomicity the data would now be wrong.',
        boxes: [b('d', 'Database', ['crashed with A = 400, B = 500'], 'bad', 'crash'), b('t', 'Transaction T1', ['no COMMIT record'], 'bad')],
        deps: [],
      },
      {
        note: 'On restart, recovery reads the log. T1 has no commit record, so it is undone using the old values: A goes back to 500. Atomicity: a transaction either happens completely or not at all.',
        boxes: [b('l', 'Write-ahead log', ['T1 has no COMMIT: undo'], 'warn'), b('d', 'Database', ['A = 500', 'B = 500'], 'ok', 'rolled back')],
        deps: [d('Write-ahead log', 'Database', 'undo T1', 'ok')],
      },
      {
        note: 'Run it again, and this time it commits. The commit record is flushed to the log on disk before the client is told "success". That is durability: even if the server loses power right now, recovery will redo the changes from the log.',
        boxes: [b('t', 'Transaction T1', ['COMMIT acknowledged'], 'ok', 'committed'), b('l', 'Write-ahead log', ['T1 COMMIT (flushed to disk)'], 'ok', 'durable'), b('d', 'Database', ['A = 400', 'B = 600'], 'ok')],
        deps: [d('Transaction T1', 'Write-ahead log', 'COMMIT', 'ok')],
      },
    ],
  },
  {
    id: 'lost-update',
    label: 'Lost update and locking',
    title: 'Two transactions read the same balance: one update is lost, unless the database or you prevent it',
    frames: [
      {
        note: 'Account A holds 100. Transaction T1 wants to withdraw 30 and T2 wants to withdraw 50. Both start at the same time and read the balance first.',
        boxes: [b('d', 'Database', ['A = 100'], 'ok'), b('t1', 'Transaction T1', ['reads A = 100'], 'new'), b('t2', 'Transaction T2', ['reads A = 100'], 'new')],
        deps: [d('Transaction T1', 'Database', 'read A', 'ok'), d('Transaction T2', 'Database', 'read A', 'ok')],
      },
      {
        note: 'Each computes its own new value from what it read and writes it back: T1 writes 70, then T2 writes 50. T2 overwrote T1 without ever seeing it. 80 was withdrawn but the balance only dropped by 50: a lost update.',
        boxes: [b('t1', 'Transaction T1', ['writes A = 70'], 'new'), b('t2', 'Transaction T2', ['writes A = 50 (overwrites 70)'], 'bad', 'overwrote T1'), b('d', 'Database', ['A = 50', 'should be 20'], 'bad', 'lost update')],
        deps: [d('Transaction T1', 'Database', 'write 70', 'ok'), d('Transaction T2', 'Database', 'write 50', 'bad')],
      },
      {
        note: 'Fix 1, pessimistic locking: read with SELECT ... FOR UPDATE. T1 locks the row; T2\'s read waits until T1 commits, then sees 70 and writes 20. Safe, but T2 waits and deadlocks become possible.',
        boxes: [b('t1', 'Transaction T1', ['SELECT FOR UPDATE: locks A', 'writes 70, commits'], 'ok'), b('t2', 'Transaction T2', ['waits for the lock', 'then reads 70, writes 20'], 'ok', 'serialised'), b('d', 'Database', ['A = 20'], 'ok', 'correct')],
        deps: [d('Transaction T2', 'Database', 'waits while T1 holds the row lock', 'warn')],
      },
      {
        note: 'Fix 2, optimistic locking: the row has a version column. Each update says "set balance = 70, version = 2 WHERE version = 1". T1 succeeds. T2\'s update matches zero rows because the version is now 2, so it fails with an optimistic lock error and must retry.',
        boxes: [b('t1', 'Transaction T1', ['UPDATE ... WHERE version = 1', '1 row updated, version 2'], 'ok'), b('t2', 'Transaction T2', ['UPDATE ... WHERE version = 1', '0 rows: conflict, retry'], 'warn', 'retry'), b('d', 'Database', ['A = 70, version 2'], 'ok')],
        deps: [d('Transaction T2', 'Database', 'stale version rejected', 'bad')],
      },
    ],
  },
  {
    id: 'write-skew',
    label: 'Write skew',
    title: 'Snapshot isolation can still break an invariant that spans two rows',
    frames: [
      {
        note: 'Rule (an invariant): a joint account\'s two sub-accounts together must never go below 0. A = 60 and B = 60, total 120. Two transactions each withdraw 100, but from different sub-accounts. Each checks the rule before writing.',
        boxes: [b('d', 'Database', ['A = 60', 'B = 60', 'rule: A + B >= 0'], 'ok'), b('t1', 'Transaction T1', ['withdraw 100 from A'], 'new'), b('t2', 'Transaction T2', ['withdraw 100 from B'], 'new')],
        deps: [],
      },
      {
        note: 'Under snapshot isolation (the REPEATABLE READ of PostgreSQL or Oracle\'s SERIALIZABLE) each transaction works on its own consistent snapshot: both see A = 60 and B = 60. T1 sees A + B - 100 = 20, which is fine. T2 sees the same and is also fine.',
        boxes: [b('t1', 'Transaction T1', ['snapshot: A=60, B=60', 'check: 120 - 100 >= 0: ok'], 'ok'), b('t2', 'Transaction T2', ['snapshot: A=60, B=60', 'check: 120 - 100 >= 0: ok'], 'ok')],
        deps: [d('Transaction T1', 'Database', 'read A and B', 'ok'), d('Transaction T2', 'Database', 'read A and B', 'ok')],
      },
      {
        note: 'They write different rows (T1 updates A, T2 updates B), so there is no write-write conflict and both commit. The result: A = -40, B = -40. The invariant is broken even though each transaction was correct on its own: write skew.',
        boxes: [b('d', 'Database', ['A = -40', 'B = -40', 'A + B = -80'], 'bad', 'invariant broken'), b('t1', 'Transaction T1', ['committed'], 'ok'), b('t2', 'Transaction T2', ['committed'], 'ok')],
        deps: [d('Transaction T1', 'Database', 'update A', 'ok'), d('Transaction T2', 'Database', 'update B', 'ok')],
      },
      {
        note: 'Fixes: use SERIALIZABLE isolation (the database detects the dangerous read-write pattern and aborts one transaction, which you retry), lock the rows both transactions read (SELECT FOR UPDATE on both), or enforce the rule with a constraint or a single row holding the total.',
        boxes: [b('t2', 'Transaction T2', ['aborted: could not serialize', 'retries and sees the new total'], 'warn', 'retry'), b('d', 'Database', ['A = -40 (T1 committed)', 'T2 retry: rejects the withdrawal'], 'ok', 'invariant kept')],
        deps: [d('Transaction T2', 'Database', 'serialization failure', 'bad')],
      },
    ],
  },
  {
    id: 'base',
    label: 'BASE: eventual consistency',
    title: 'BASE: stay available, accept soft state, converge later',
    frames: [
      {
        note: 'A profile store keeps copies on a primary and a replica in another region, replicating asynchronously. The user\'s display name is "Alice".',
        boxes: [b('p', 'Primary database', ['name = Alice'], 'ok'), b('r', 'Replica', ['name = Alice'], 'ok'), b('c', 'Client', ['online'], 'none')],
        deps: [d('Primary database', 'Replica', 'asynchronous replication', 'ok')],
      },
      {
        note: 'Basically Available: the user renames the profile to "Alicia". The primary accepts and acknowledges the write immediately, without waiting for the replica. The system stays responsive even if the other region is slow.',
        boxes: [b('c', 'Client', ['sets name = Alicia'], 'new'), b('p', 'Primary database', ['name = Alicia', 'acknowledged'], 'ok', 'available'), b('r', 'Replica', ['name = Alice', 'update in transit'], 'warn')],
        deps: [d('Client', 'Primary database', 'write', 'ok'), d('Primary database', 'Replica', 'update in transit', 'warn')],
      },
      {
        note: 'Soft state: for a short time the system holds two different answers. A read served by the replica returns the old name. The state is not fixed until replication finishes, and it can change without new input.',
        boxes: [b('c', 'Client', ['reads from the nearby replica'], 'new'), b('r', 'Replica', ['returns name = Alice (stale)'], 'warn', 'stale read')],
        deps: [d('Client', 'Replica', 'read', 'ok'), d('Replica', 'Client', 'Alice (stale)', 'warn')],
      },
      {
        note: 'Eventually consistent: the update arrives and the replica applies it. With no further writes, all copies now agree. Techniques that make BASE safe: idempotent updates, versioning, read-your-writes routing, and reconciliation of conflicts.',
        boxes: [b('p', 'Primary database', ['name = Alicia'], 'ok'), b('r', 'Replica', ['name = Alicia'], 'ok', 'converged')],
        deps: [d('Primary database', 'Replica', 'update applied', 'ok')],
      },
    ],
  },
];
