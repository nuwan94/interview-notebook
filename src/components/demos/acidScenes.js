// Frame data for the ACID and BASE walk-through.
// Atomicity is drawn by WalStage (steps, memory, log and data file); the lost update and write skew by
// TxnTimelineStage (two transactions over time); BASE uses the box-and-arrow player.
// box.tone: ok | bad | warn | new | none.

import { WalStage } from './WalStage.jsx';
import { TxnTimelineStage } from './TxnTimelineStage.jsx';

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });
// one step on the timeline: who acts, what it says, what kind of arrow, and the database rows afterwards
const ev = (id, lane, text, kind, o = {}) => ({ id, lane, text, kind, ...o });

const T1_A = { id: 'l1', text: 'T1  A: 500 -> 400' };
const T1_UNDO = { id: 'l2', text: 'T1  ROLLBACK (undone)' };
const T2_A = { id: 'l3', text: 'T2  A: 500 -> 400' };
const T2_B = { id: 'l4', text: 'T2  B: 500 -> 600' };
const T2_C = { id: 'l5', text: 'T2  COMMIT (on disk)' };

export const ACID_SCENES = [
  {
    id: 'atomic',
    label: 'Atomicity and durability',
    title: 'A transfer is all or nothing, and a committed transfer survives a crash',
    stage: WalStage, // drawn by WalStage: transaction steps, memory, the write-ahead log and the data file
    frames: [
      {
        line: 'BEGIN',
        tx: 'T1',
        steps: ['run', 'todo', 'todo', 'todo'],
        mem: { A: [500], B: [500] },
        log: [],
        disk: { A: [500], B: [500] },
        note: 'We move 100 from account A to account B. Both balances start at 500. The transfer is one transaction with two updates: debit A, then credit B.',
      },
      {
        line: "UPDATE account SET balance = balance - 100 WHERE id = 'A'",
        tx: 'T1',
        steps: ['done', 'run', 'todo', 'todo'],
        mem: { A: [400, 'warn'], B: [500] },
        log: [{ ...T1_A, tone: 'new' }],
        disk: { A: [500], B: [500] },
        arrows: ['A'],
        note: 'Before it changes any data, the database writes the change to the write-ahead log (WAL), with the old and the new value. The log goes to disk first. Then A changes to 400 in memory.',
      },
      {
        line: '-- the server loses power',
        result: { text: 'crash before COMMIT', tone: 'bad' },
        tx: 'T1',
        steps: ['done', 'done', 'skip', 'skip'],
        mem: null,
        log: [T1_A],
        disk: { A: [400, 'bad'], B: [500, 'bad'] },
        note: 'The server crashes after the debit, but before the credit and before COMMIT. The page for A had already been written to the data file. So the disk says A = 400 and B = 500, and 100 has vanished.',
      },
      {
        line: '-- restart: recovery reads the log',
        result: { text: 'T1 undone: A = 500, B = 500', tone: 'ok' },
        tx: 'T1',
        steps: ['done', 'undone', 'skip', 'skip'],
        mem: { A: [500], B: [500] },
        log: [T1_A, { ...T1_UNDO, tone: 'warn' }],
        disk: { A: [500, 'ok'], B: [500, 'ok'] },
        recover: { kind: 'undo', to: ['A'] },
        note: 'On restart, recovery reads the log. T1 has no COMMIT record, so recovery undoes it with the old value, and A is 500 again. This is atomicity: a transaction happens completely or not at all.',
      },
      {
        line: 'COMMIT',
        result: { text: '"success" only after the log is on disk', tone: 'ok' },
        tx: 'T2',
        steps: ['done', 'done', 'done', 'run'],
        mem: { A: [400, 'ok'], B: [600, 'ok'] },
        log: [T1_A, T1_UNDO, T2_A, T2_B, { ...T2_C, tone: 'ok' }],
        disk: { A: [500], B: [500] },
        note: 'We run the transfer again as T2, and this time it commits. The COMMIT record is written to the log on disk before the client is told "success". The data file still holds the old values, and that is fine.',
      },
      {
        line: '-- crash after COMMIT, then restart',
        result: { text: 'T2 redone: A = 400, B = 600', tone: 'ok' },
        tx: 'T2',
        steps: ['done', 'done', 'done', 'done'],
        mem: { A: [400], B: [600] },
        log: [T1_A, T1_UNDO, T2_A, T2_B, T2_C],
        disk: { A: [400, 'ok'], B: [600, 'ok'] },
        recover: { kind: 'redo', to: ['A', 'B'] },
        note: 'Even if the server crashes right after COMMIT, nothing is lost. Recovery finds the COMMIT record and redoes T2 from the log, so the data file gets A = 400 and B = 600. This is durability.',
      },
    ],
  },
  {
    id: 'lost-update',
    label: 'Lost update and locking',
    title: 'Two transactions read the same balance, and one update is lost unless you prevent it',
    stage: TxnTimelineStage, // drawn by TxnTimelineStage: T1, the database and T2, with time running down
    frames: [
      {
        line: "SELECT balance FROM account WHERE id = 'A'",
        events: [ev('r1', 1, ['read A', 'gets 100'], 'read', { db: 'A = 100' }), ev('r2', 2, ['read A', 'gets 100'], 'read', { db: 'A = 100' })],
        note: 'Account A holds 100. T1 wants to withdraw 30, and T2 wants to withdraw 50. Both start at the same time, and both read the balance first.',
      },
      {
        line: "UPDATE account SET balance = 70 WHERE id = 'A'",
        events: [
          ev('r1', 1, ['read A', 'gets 100'], 'read', { db: 'A = 100' }),
          ev('r2', 2, ['read A', 'gets 100'], 'read', { db: 'A = 100' }),
          ev('w1', 1, ['write 100 - 30 = 70'], 'write', { tone: 'new', db: 'A = 70' }),
        ],
        note: 'T1 works out its new balance from what it read, 100 - 30 = 70, and writes it.',
      },
      {
        line: "UPDATE account SET balance = 50 WHERE id = 'A'",
        result: { text: 'lost update: A should be 20', tone: 'bad' },
        events: [
          ev('r1', 1, ['read A', 'gets 100'], 'read', { db: 'A = 100' }),
          ev('r2', 2, ['read A', 'gets 100'], 'read', { db: 'A = 100' }),
          ev('w1', 1, ['write 100 - 30 = 70'], 'write', { db: 'A = 70' }),
          ev('w2', 2, ['write 100 - 50 = 50', 'overwrites T1'], 'write', { tone: 'bad', db: 'A = 50', dbTone: 'bad' }),
        ],
        note: 'T2 also uses the 100 it read, and writes 50. It overwrites T1 without ever seeing it. In total 80 was withdrawn, but the balance dropped by only 50. This is a lost update.',
      },
      {
        line: "UPDATE account SET balance = balance - 30 WHERE id = 'A' AND balance >= 30",
        result: { text: 'A = 20: correct', tone: 'ok' },
        events: [
          ev('a1', 1, ['balance = balance - 30', 'read and write in one step'], 'write', { tone: 'ok', db: 'A = 70' }),
          ev('a2', 2, ['balance = balance - 50', 'runs after T1, sees 70'], 'write', { tone: 'ok', db: 'A = 20', dbTone: 'ok' }),
        ],
        note: 'Fix 1 is an atomic update. The statement reads and writes the balance in one step, and the database runs the two statements one after the other. T2 starts from 70, so the result is 20.',
      },
      {
        line: "SELECT balance FROM account WHERE id = 'A' FOR UPDATE",
        result: { text: 'A = 20: correct, but T2 waited', tone: 'ok' },
        events: [
          ev('p1', 1, ['FOR UPDATE: gets 100', 'and locks row A'], 'read', { tone: 'new', db: 'A = 100, locked' }),
          ev('p2', 2, ['FOR UPDATE on A', 'waits for the lock'], 'wait', { tone: 'warn' }),
          ev('p3', 1, ['write 70, COMMIT', 'the lock is released'], 'write', { tone: 'ok', db: 'A = 70' }),
          ev('p4', 2, ['gets 70 and the lock'], 'read', { tone: 'new', db: 'A = 70, locked' }),
          ev('p5', 2, ['write 70 - 50 = 20', 'COMMIT'], 'write', { tone: 'ok', db: 'A = 20', dbTone: 'ok' }),
        ],
        note: 'Fix 2 is pessimistic locking. T1 reads with SELECT ... FOR UPDATE, which locks the row. T2 must wait until T1 commits, then it reads 70 and writes 20. This is safe, but T2 waits, and deadlocks become possible.',
      },
      {
        line: "UPDATE account SET balance = ?, version = 2 WHERE id = 'A' AND version = 1",
        result: { text: 'A = 20: T2 retried', tone: 'ok' },
        events: [
          ev('o1', 1, ['read A', 'gets 100, version 1'], 'read', { db: 'A = 100, v1' }),
          ev('o2', 2, ['read A', 'gets 100, version 1'], 'read', { db: 'A = 100, v1' }),
          ev('o3', 1, ['set 70 where version = 1', '1 row updated'], 'write', { tone: 'ok', db: 'A = 70, v2' }),
          ev('o4', 2, ['set 50 where version = 1', '0 rows: conflict'], 'fail', { tone: 'warn', db: 'A = 70, v2' }),
          ev('o5', 2, ['retry: gets 70, version 2', 'set 20 where version = 2'], 'write', { tone: 'ok', db: 'A = 20, v3', dbTone: 'ok' }),
        ],
        note: 'Fix 3 is optimistic locking. The row has a version column, and each update only applies "where version = 1". T1 succeeds and the version becomes 2. T2\'s update matches 0 rows, so it fails with an optimistic lock error and retries with the fresh value.',
      },
    ],
  },
  {
    id: 'write-skew',
    label: 'Write skew',
    title: 'Snapshot isolation can still break a rule that spans two rows',
    stage: TxnTimelineStage,
    frames: [
      {
        line: '-- rule: A + B >= 0',
        events: [
          ev('s1', 1, ['read A + B', 'snapshot: 60 + 60 = 120'], 'read', { db: 'A = 60, B = 60' }),
          ev('s2', 2, ['read A + B', 'snapshot: 60 + 60 = 120'], 'read', { db: 'A = 60, B = 60' }),
        ],
        note: 'A joint account has two sub-accounts, A and B, with 60 each. The rule (an invariant) says A + B must never go below 0. Under snapshot isolation, each transaction reads its own fixed copy of the data, a snapshot. Both see 120.',
      },
      {
        line: '-- each transaction checks the rule',
        events: [
          ev('s1', 1, ['read A + B', 'snapshot: 60 + 60 = 120'], 'read', { db: 'A = 60, B = 60' }),
          ev('s2', 2, ['read A + B', 'snapshot: 60 + 60 = 120'], 'read', { db: 'A = 60, B = 60' }),
          ev('c1', 1, ['withdraw 100 from A?', '120 - 100 = 20: OK'], 'note', { tone: 'ok' }),
          ev('c2', 2, ['withdraw 100 from B?', '120 - 100 = 20: OK'], 'note', { tone: 'ok' }),
        ],
        note: 'T1 wants to take 100 from A, and T2 wants to take 100 from B. Each checks the rule against its snapshot. 120 - 100 = 20, which is fine, so both go ahead. (Snapshot isolation is PostgreSQL\'s REPEATABLE READ and Oracle\'s SERIALIZABLE.)',
      },
      {
        line: "UPDATE account SET balance = balance - 100 WHERE id = 'A'  -- and 'B'",
        result: { text: 'rule broken: A + B = -80', tone: 'bad' },
        events: [
          ev('s1', 1, ['read A + B', 'snapshot: 60 + 60 = 120'], 'read', { db: 'A = 60, B = 60' }),
          ev('s2', 2, ['read A + B', 'snapshot: 60 + 60 = 120'], 'read', { db: 'A = 60, B = 60' }),
          ev('c1', 1, ['withdraw 100 from A?', '120 - 100 = 20: OK'], 'note', { tone: 'ok' }),
          ev('c2', 2, ['withdraw 100 from B?', '120 - 100 = 20: OK'], 'note', { tone: 'ok' }),
          ev('u1', 1, ['write A = -40', 'COMMIT'], 'write', { tone: 'new', db: 'A = -40, B = 60' }),
          ev('u2', 2, ['write B = -40', 'COMMIT'], 'write', { tone: 'bad', db: 'A = -40, B = -40', dbTone: 'bad' }),
        ],
        note: 'They write different rows, so neither overwrites the other, and both commit. Now A = -40 and B = -40. The rule is broken, even though each transaction was correct on its own. This is write skew.',
      },
      {
        line: 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
        result: { text: 'rule kept: A + B = 20', tone: 'ok' },
        events: [
          ev('z1', 1, ['read A + B = 120'], 'read', { db: 'A = 60, B = 60' }),
          ev('z2', 2, ['read A + B = 120'], 'read', { db: 'A = 60, B = 60' }),
          ev('z3', 1, ['write A = -40', 'COMMIT'], 'write', { tone: 'ok', db: 'A = -40, B = 60' }),
          ev('z4', 2, ['write B = -40, COMMIT', 'fails: could not serialize'], 'fail', { tone: 'warn', db: 'A = -40, B = 60' }),
          ev('z5', 2, ['retry: A + B = 20', '20 - 100 < 0: refused'], 'read', { tone: 'ok', db: 'A = -40, B = 60', dbTone: 'ok' }),
        ],
        note: 'Fix 1: SERIALIZABLE isolation. The database spots the risky read-then-write pattern and aborts T2, which retries and sees the new total. Fix 2: lock the rows both transactions read, with SELECT ... FOR UPDATE. Fix 3: enforce the rule with a constraint, or keep the total in a single row.',
      },
    ],
  },
  {
    id: 'base',
    label: 'BASE: eventual consistency',
    title: 'BASE: stay available, accept soft state, agree later',
    frames: [
      {
        note: 'A profile store keeps a primary copy and a replica in another region. Changes are copied to the replica asynchronously, which means the primary does not wait for it. The customer\'s display name is "Alice".',
        boxes: [b('p', 'Primary database', ['name = Alice'], 'ok'), b('r', 'Replica', ['name = Alice'], 'ok'), b('c', 'Client', ['online'], 'none')],
        deps: [d('Primary database', 'Replica', 'asynchronous replication', 'ok')],
      },
      {
        note: 'Basically Available: the customer renames the profile to "Alicia". The primary accepts the write and confirms it at once, without waiting for the replica. The system stays fast even if the other region is slow.',
        boxes: [b('c', 'Client', ['sets name = Alicia'], 'new'), b('p', 'Primary database', ['name = Alicia', 'confirmed'], 'ok', 'available'), b('r', 'Replica', ['name = Alice', 'update on the way'], 'warn')],
        deps: [d('Client', 'Primary database', 'write', 'ok'), d('Primary database', 'Replica', 'update on the way', 'warn')],
      },
      {
        note: 'Soft state: for a short time, the system holds two different answers. A read served by the replica returns the old name. The state is not settled until replication finishes, and it can change without any new input.',
        boxes: [b('c', 'Client', ['reads from the nearby replica'], 'new'), b('r', 'Replica', ['returns name = Alice (stale)'], 'warn', 'stale read')],
        deps: [d('Client', 'Replica', 'read', 'ok'), d('Replica', 'Client', 'Alice (stale)', 'warn')],
      },
      {
        note: 'Eventually consistent: the update arrives and the replica applies it. With no more writes, all copies now agree. Idempotent updates, version numbers, read-your-writes routing and conflict reconciliation make BASE safe to use.',
        boxes: [b('p', 'Primary database', ['name = Alicia'], 'ok'), b('r', 'Replica', ['name = Alicia'], 'ok', 'in agreement')],
        deps: [d('Primary database', 'Replica', 'update applied', 'ok')],
      },
    ],
  },
];
