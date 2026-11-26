// Frame data for the Spring messaging walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- listener, acknowledgement, dead letters ---------- */
const OFFSETS = [40, 41, 42, 43, 44, 45];
const topic = { x: 14, y: 34, w: 404, h: 84, title: 'topic transfers, partition 0' };
const cell = (o, tone = 'none', extra = {}) => ({ id: `o${o}`, x: 26 + (o - 40) * 64, y: 66, w: 56, h: 36, title: `${o}`, mono: true, tone, ...extra });
const cells = (spec) => OFFSETS.map((o) => cell(o, ...(spec[o] || ['none', { dim: true }])));
const listener = (lines, o = {}) => ({ id: 'lis', x: 14, y: 170, w: 280, title: '@KafkaListener(topics = "transfers")', lines, tone: 'none', ...o });

const listenerFrames = [
  {
    h: 250,
    line: 'container polls offset 41',
    result: { text: 'on(TransferCompleted)', tone: 'ok' },
    regions: [topic],
    cards: [...cells({ 40: ['ok'], 41: ['new', { badge: 'now' }], 42: ['none'], 43: ['none'] }), listener(['called on a container thread'], { tone: 'new' })],
    arrows: [{ from: 'o41', to: 'lis', fs: 'b', ts: 't', tone: 'new' }],
    note: 'A @KafkaListener method consumes TransferCompleted events. The listener container polls the broker, turns the bytes into an object, and calls your method on a container thread.',
  },
  {
    h: 250,
    line: 'method returns normally',
    result: { text: 'offset 41 committed', tone: 'ok' },
    regions: [topic],
    cards: [...cells({ 40: ['ok'], 41: ['ok', { badge: 'ack' }], 42: ['none'], 43: ['none'] }), listener(['processed, then acknowledged'], { tone: 'ok' })],
    arrows: [{ from: 'lis', to: 'o41', fs: 't', ts: 'b', tone: 'ok' }],
    note: 'When the method returns normally, the container commits the offset, so the broker will not deliver it again. The commit comes after the work. If the app crashes in between, the message comes again: this is at-least-once delivery.',
  },
  {
    h: 250,
    line: 'offset 42 throws: ledger timeout',
    result: { text: 'retry 2 of 3, partition blocked', tone: 'warn' },
    regions: [topic],
    cards: [...cells({ 40: ['ok'], 41: ['ok'], 42: ['warn', { badge: 'retry' }], 43: ['none', { dim: true }], 44: ['none', { dim: true }] }), listener(['throws: not committed', 'backoff 1 s, 2 s, 4 s'], { tone: 'warn' })],
    arrows: [{ from: 'o42', to: 'lis', fs: 'b', ts: 't', tone: 'warn' }],
    texts: [{ x: 312, y: 196, t: '43, 44 wait behind 42' }],
    note: 'If the method throws, the offset is not committed. The error handler retries with a backoff. Meanwhile 42 blocks every later message on this partition. That is fine for a short glitch, but not for a message that can never succeed.',
  },
  {
    h: 250,
    line: 'retries exhausted',
    result: { text: 'parked in transfers.DLT', tone: 'warn' },
    regions: [topic],
    cards: [
      ...cells({ 40: ['ok'], 41: ['ok'], 42: ['bad', { badge: 'DLT' }], 43: ['new', { badge: 'now' }], 44: ['none'] }),
      listener(['gave up on 42 after 3 tries', 'carries on with 43'], { tone: 'ok' }),
      { id: 'dlt', x: 456, y: 34, w: 170, title: 'transfers.DLT', lines: ['payload of 42', 'exception headers', 'topic, partition, offset'], tone: 'warn', badge: 'parked' },
    ],
    arrows: [{ from: 'lis', to: 'dlt', fs: 'r', ts: 'b', tone: 'warn' }, { from: 'o43', to: 'lis', fs: 'b', ts: 't', tone: 'new' }],
    note: 'After the last retry, the error handler publishes the message to a dead-letter topic, with the exception details. Then it commits 42 and moves on. People inspect the dead letters, fix the cause, and replay them.',
  },
];

/* ---------- idempotent consumer ---------- */
const broker = (lines, o = {}) => ({ id: 'brk', x: 14, y: 52, w: 140, title: 'Broker', lines, tone: 'none', ...o });
const lis2 = (lines, o = {}) => ({ id: 'lis', x: 196, y: 44, w: 200, title: 'Listener', lines, tone: 'none', ...o });
const dbRegion = { x: 436, y: 30, w: 190, h: 196, title: 'Database' };
const acct = (lines, o = {}) => ({ id: 'acct', x: 448, y: 60, w: 166, title: 'accounts', lines, mono: true, tone: 'none', ...o });
const proc = (lines, o = {}) => ({ id: 'proc', x: 448, y: 146, w: 166, title: 'processed_message', lines, mono: true, tone: 'none', ...o });

const idemFrames = [
  {
    h: 250,
    line: 'm-77: credit account A by 50',
    result: { text: 'crash before the ack', tone: 'bad' },
    regions: [dbRegion],
    cards: [broker(['m-77 delivered']), lis2(['credit A by 50', 'crash before ack'], { tone: 'bad', badge: 'crash' }), acct(['A = 150'], { tone: 'ok' }), proc(['(not used yet)'], { dim: true })],
    arrows: [{ from: 'brk', to: 'lis', fs: 'r', ts: 'l', tone: 'new' }, { from: 'lis', to: 'acct', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The listener handles message m-77: credit account A by 50. The balance goes from 100 to 150. Then the app crashes before the offset is committed.',
  },
  {
    h: 250,
    line: 'restart: m-77 delivered again',
    result: { text: 'credited twice', tone: 'bad' },
    regions: [dbRegion],
    cards: [broker(['m-77 again'], { tone: 'warn' }), lis2(['credit A by 50 again'], { tone: 'bad' }), acct(['A = 200'], { tone: 'bad', badge: 'wrong' }), proc(['(not used yet)'], { dim: true })],
    arrows: [{ from: 'brk', to: 'lis', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'lis', to: 'acct', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'After the restart, the broker delivers m-77 again, because it was never acknowledged. A naive listener credits again. The account ends at 200: the customer got 50 too much.',
  },
  {
    h: 250,
    line: 'INSERT INTO processed_message VALUES (\'m-77\')',
    result: { text: 'duplicate skipped', tone: 'ok' },
    regions: [dbRegion],
    cards: [broker(['m-77 again'], { tone: 'warn' }), lis2(['insert m-77: unique violation', 'so skip the credit'], { tone: 'ok' }), acct(['A = 150'], { tone: 'ok' }), proc(['m-77   (primary key)'], { tone: 'warn', badge: 'exists' })],
    arrows: [{ from: 'brk', to: 'lis', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'lis', to: 'proc', fs: 'b', ts: 'l', tone: 'warn' }],
    note: 'The fix: in the same transaction as the credit, insert the message id into a table with a unique key. The first time, both commit together. On redelivery the insert fails as a duplicate, and the listener skips the work.',
  },
  {
    h: 250,
    line: 'producer side: transactional outbox',
    result: { text: 'no lost events', tone: 'ok' },
    regions: [{ x: 196, y: 30, w: 210, h: 196, title: 'one database transaction', tone: 'ok' }],
    cards: [
      { id: 'svc', x: 14, y: 52, w: 140, title: 'TransferService', lines: ['complete(t)'], tone: 'new' },
      { id: 'row', x: 208, y: 60, w: 186, title: 'transfers', lines: ['t-9  COMPLETED'], mono: true, tone: 'ok' },
      { id: 'out', x: 208, y: 146, w: 186, title: 'outbox', lines: ['TransferCompleted t-9'], mono: true, tone: 'ok' },
      { id: 'relay', x: 456, y: 146, w: 170, title: 'Relay', lines: ['reads new rows', 'publishes them'], tone: 'none' },
      { id: 'brk', x: 456, y: 44, w: 170, title: 'Broker', lines: ['at-least-once'], tone: 'none' },
    ],
    arrows: [
      { from: 'svc', to: 'row', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'svc', to: 'out', fs: 'b', ts: 'l', tone: 'ok' },
      { from: 'out', to: 'relay', fs: 'r', ts: 'l', tone: 'ok' },
      { from: 'relay', to: 'brk', fs: 't', ts: 'b', tone: 'ok' },
    ],
    note: 'The producer has the same problem: the database and the broker are two systems. So save the event in an outbox table, in the same transaction as the business change. A relay publishes it. Outbox plus idempotent consumer gives effectively-once processing.',
  },
];

/* ---------- partitions and consumer groups ---------- */
const prod = (o = {}) => ({ id: 'prod', x: 14, y: 52, w: 140, title: 'Producer', lines: ['key = accountId'], tone: 'new', ...o });
const topicR = { x: 190, y: 30, w: 210, h: 200, title: 'topic transfers' };
const p0 = (o = {}) => ({ id: 'p0', x: 202, y: 60, w: 186, title: 'partition 0', lines: ['A1  A2  A3'], mono: true, tone: 'ok', ...o });
const p1 = (o = {}) => ({ id: 'p1', x: 202, y: 146, w: 186, title: 'partition 1', lines: ['B1  B2'], mono: true, tone: 'ok', ...o });
const cons = (n, lines, o = {}) => ({ id: `c${n}`, x: 446, y: 34 + (n - 1) * 80, w: 180, title: `consumer #${n}`, lines, tone: 'ok', ...o });

const partitionFrames = [
  {
    h: 270,
    line: 'kafka.send("transfers", accountId, event)',
    result: { text: 'same key, same partition', tone: 'ok' },
    regions: [topicR],
    cards: [prod(), p0(), p1()],
    arrows: [{ from: 'prod', to: 'p0', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'prod', to: 'p1', fs: 'b', ts: 'l', tone: 'ok' }],
    note: 'A topic is split into partitions. The producer picks the partition from a hash of the message key, here the account id. All events of account A go to partition 0, all of account B to partition 1. So each account\'s events stay in order.',
  },
  {
    h: 270,
    line: 'groupId = "ledger-service", 2 instances',
    result: { text: 'one owner per partition', tone: 'ok' },
    regions: [topicR],
    cards: [prod({ dim: true }), p0(), p1(), cons(1, ['owns partition 0']), cons(2, ['owns partition 1'])],
    arrows: [{ from: 'p0', to: 'c1', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'p1', to: 'c2', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Consumers with the same group id form a consumer group. Each partition is read by exactly one consumer in the group. The two instances share the work, and the order per key is kept.',
  },
  {
    h: 270,
    line: 'scale to 3 instances',
    result: { text: '#3 sits idle', tone: 'warn' },
    regions: [topicR],
    cards: [prod({ dim: true }), p0(), p1(), cons(1, ['owns partition 0']), cons(2, ['owns partition 1']), cons(3, ['no partition left'], { tone: 'warn', badge: 'idle' })],
    arrows: [{ from: 'p0', to: 'c1', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'p1', to: 'c2', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A third instance gets nothing, because there are only two partitions. The partition count caps parallelism. Plan partitions for peak load: adding them later changes which partition a key maps to.',
  },
  {
    h: 270,
    line: 'consumer #2 crashes',
    result: { text: 'rebalanced to #3', tone: 'warn' },
    regions: [topicR],
    cards: [prod({ dim: true }), p0(), p1(), cons(1, ['owns partition 0']), cons(2, ['crashed'], { tone: 'bad', badge: 'down' }), cons(3, ['takes partition 1', 'from last commit'], { tone: 'new', badge: 'rebalanced' })],
    arrows: [{ from: 'p0', to: 'c1', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'p1', to: 'c2', fs: 'r', ts: 'l', tone: 'bad', cross: true }, { from: 'p1', to: 'c3', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'When an instance dies, the group rebalances. Its partition moves to another consumer, which resumes from the last committed offset. Messages after that offset are delivered again: one more reason consumers must be idempotent.',
  },
];

export const SPRING_MSG_SCENES = [
  { id: 'listener', label: 'Listener and acknowledgement', title: 'When the listener acknowledges decides what happens on failure', stage: BoardStage, frames: listenerFrames },
  { id: 'idempotent', label: 'Idempotent consumer', title: 'At-least-once delivery means the same message can arrive twice', stage: BoardStage, frames: idemFrames },
  { id: 'partition', label: 'Partitions and ordering', title: 'Same key, same partition, same order; a group shares the partitions', stage: BoardStage, frames: partitionFrames },
];
