// Frame data for the "Node.js microservices" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- service shape ---------- */
const shapeFrames = [
  {
    h: 250,
    line: 'modular monolith first',
    result: { text: 'split one capability at a time', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 300, h: 200, title: 'one deploy', tone: 'none' }],
    cards: [
      box('a', 18, 66, 130, 'accounts', ['module'], 'ok'),
      box('t', 162, 66, 130, 'transfers', ['module'], 'ok'),
      box('n', 18, 150, 130, 'notify', ['module'], 'warn', { badge: 'own rhythm' }),
      box('s', 446, 120, W, 'notification-service', ['own team', 'own data', 'own deploy'], 'new'),
    ],
    arrows: [{ from: 'n', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Start with a modular monolith with clear module boundaries. Extract a module only when it has a different team, release rhythm or scaling need. The rule for a boundary: one business capability, one team, one data owner.',
  },
  {
    h: 250,
    line: '@bank/common v3 → v4',
    result: { text: 'every service upgrades together', tone: 'bad' },
    cards: [
      box('l', C2, 40, W, '@bank/common', ['models, helpers,', 'clients, rules'], 'bad', { badge: 'shared' }),
      box('a', C1, 160, W, 'accounts', ['must upgrade'], 'bad'),
      box('t', C2, 160, W, 'transfers', ['must upgrade'], 'bad'),
      box('n', C3, 160, W, 'notify', ['must upgrade'], 'bad'),
    ],
    arrows: [
      { from: 'l', to: 'a', fs: 'b', ts: 't', tone: 'bad' },
      { from: 'l', to: 't', fs: 'b', ts: 't', tone: 'bad' },
      { from: 'l', to: 'n', fs: 'b', ts: 't', tone: 'bad' },
    ],
    note: 'A shared library full of models and business helpers couples every service to every other. One change forces all of them to release together. Share only versioned contracts, such as API schemas and event types.',
  },
  {
    h: 250,
    line: 'ALTER TABLE accounts ...',
    result: { text: 'the other service breaks', tone: 'bad' },
    cards: [
      box('a', C1, 50, W, 'account-service', ['owns the schema'], 'ok'),
      box('r', C3, 50, W, 'report-service', ['reads the table', 'directly'], 'bad'),
      box('d', C2, 150, W, 'accounts DB', ['column renamed'], 'warn'),
    ],
    arrows: [
      { from: 'a', to: 'd', fs: 'b', ts: 'l', tone: 'ok' },
      { from: 'r', to: 'd', fs: 'b', ts: 'r', tone: 'bad' },
    ],
    note: 'When two services share tables, a schema change by one breaks the other without warning. Neither team can deploy alone. Keep each database private, and share data through the owner\'s API or its events.',
  },
];

/* ---------- calling services ---------- */
const callFrames = [
  {
    h: 250,
    line: "callJson('/accounts/1')",
    result: { text: 'timeout, retry, breaker', tone: 'ok' },
    cards: [
      box('c', C1, 50, W, 'caller', ['AbortSignal', 'timeout 2 s'], 'new'),
      box('r', C2, 50, W, 'retry', ['safe requests only', '100, 200, 400 ms', '+ jitter'], 'ok'),
      box('s', C3, 50, W, 'account-service', ['503, 503, 200'], 'warn'),
      box('b', C1, 170, 612, 'circuit breaker', ['after 3 failures: open, fail fast, no network call; later one trial call (half-open)'], 'warn'),
    ],
    arrows: [{ from: 'c', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'r', to: 's', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A remote call can be slow, fail, or fail halfway. Give every call a deadline. Retry only safe or idempotent calls, with backoff and jitter. A circuit breaker stops calling a sick service, so it cannot drag its callers down.',
  },
  {
    h: 250,
    line: 'POST /transfers (no key)',
    result: { text: 'not retried: it might run twice', tone: 'warn' },
    cards: [
      box('p', C1, 60, W2, 'POST without idempotency-key', ['1 attempt, error returned'], 'warn'),
      box('k', R2, 60, W2, 'POST with idempotency-key', ['retried safely', 'server dedupes by key'], 'ok'),
      box('x', C1, 170, 612, '400 Bad Request', ['never retried, and does not count against the breaker'], 'none'),
    ],
    note: 'A plain POST is not retried, because the first attempt may have worked. With an idempotency key the server can recognise a repeat, so a retry is safe. A 400 is the caller\'s fault, so it is not retried either.',
  },
  {
    h: 260,
    line: 'loadDashboard(user)',
    result: { text: 'page shown, cards and offers degraded', tone: 'warn' },
    cards: [
      box('f', C2, 30, W, 'BFF', ['deadline 100 ms', 'allSettled'], 'new'),
      box('a', C1, 150, W, 'accounts', ['ok in 20 ms'], 'ok', { badge: 'essential' }),
      box('c', C2, 150, W, 'cards', ['too slow: aborted'], 'warn'),
      box('o', C3, 150, W, 'offers', ['threw'], 'bad'),
    ],
    arrows: [
      { from: 'f', to: 'a', fs: 'b', ts: 't', tone: 'ok' },
      { from: 'f', to: 'c', fs: 'b', ts: 't', tone: 'warn' },
      { from: 'f', to: 'o', fs: 'b', ts: 't', tone: 'bad' },
    ],
    note: 'A backend for frontend calls several services in parallel for one screen, under one shared deadline. It fails only if an essential call fails. Optional parts come back empty, listed in degraded. Pass the abort signal to every call.',
  },
  {
    h: 250,
    line: 'x-correlation-id: 7f3a',
    result: { text: 'one search shows the whole journey', tone: 'ok' },
    cards: [
      box('g', C1, 60, W, 'gateway', ['creates id 7f3a'], 'new'),
      box('t', C2, 60, W, 'transfer-service', ['AsyncLocalStorage', 'logs id=7f3a'], 'ok'),
      box('l', C3, 60, W, 'ledger-service', ['header + message', 'logs id=7f3a'], 'ok'),
      box('q', C1, 180, 612, 'log search: id=7f3a', ['gateway → transfer → ledger, with a traceparent for the trace'], 'ok'),
    ],
    arrows: [{ from: 'g', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 'l', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Give each request a correlation id at the edge. Pass it on every outbound call and message. Inside a service, AsyncLocalStorage carries it through the async code, so every log line has it.',
  },
];

/* ---------- events and the outbox ---------- */
const eventFrames = [
  {
    h: 250,
    line: 'save(transfer); publish(event)',
    result: { text: 'crash in between: event lost', tone: 'bad' },
    cards: [
      box('d', C1, 60, W, 'database', ['transfer saved'], 'ok'),
      box('x', C2, 60, W, 'process', ['crash'], 'bad', { badge: 'here' }),
      box('b', C3, 60, W, 'broker', ['no event'], 'bad'),
    ],
    arrows: [{ from: 'd', to: 'x', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'x', to: 'b', fs: 'r', ts: 'l', tone: 'bad', cross: true }],
    note: 'Saving and publishing are two separate writes. If the process crashes between them, the transfer exists but nobody hears about it. Nothing remembers that an event was owed, so a retry cannot fix it.',
  },
  {
    h: 260,
    line: 'BEGIN; INSERT transfer; INSERT outbox; COMMIT',
    result: { text: 'data and event saved together', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 300, h: 210, title: 'one transaction', tone: 'ok' }],
    cards: [
      box('t', 18, 66, 276, 'transfers', ['id 42, 500.00 SGD'], 'ok'),
      box('o', 18, 150, 276, 'outbox', ['TransferCompleted 42', 'published_at: null'], 'new'),
      box('r', C3, 66, W, 'relay', ['SKIP LOCKED batch', 'publish, mark done'], 'ok'),
      box('b', C3, 170, W, 'broker', ['at least once'], 'warn'),
    ],
    arrows: [{ from: 'o', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'r', to: 'b', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'The transactional outbox writes the business row and an outbox row in one transaction. A relay publishes unpublished rows and marks them done. A crash after publishing sends the event again, so delivery is at least once.',
  },
  {
    h: 250,
    line: 'message 9c1 arrives again',
    result: { text: 'duplicate skipped and acknowledged', tone: 'ok' },
    cards: [
      box('m', C1, 60, W, 'message 9c1', ['second delivery'], 'warn'),
      box('c', C2, 60, W, 'consumer tx', ['INSERT processed(9c1)', 'conflict → skip'], 'ok'),
      box('q', C3, 60, W, 'dead-letter queue', ['poison messages', 'parked, alerted'], 'warn'),
    ],
    arrows: [{ from: 'm', to: 'c', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'c', to: 'q', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Because duplicates happen, every consumer must be idempotent. It records the message id in the same transaction as its own change, so a repeat is skipped. Transient errors are retried; poison messages go to a dead-letter queue.',
  },
  {
    h: 260,
    line: 'saga 42: credit failed',
    result: { text: 'compensate: refund the debit', tone: 'warn' },
    cards: [
      box('o', C2, 30, W, 'orchestrator', ['state in a table', 'step: CREDITING'], 'new'),
      box('d', C1, 150, W, 'debit A', ['done'], 'ok'),
      box('c', C2, 150, W, 'credit B', ['failed'], 'bad'),
      box('r', C3, 150, W, 'refund A', ['compensation'], 'warn'),
    ],
    arrows: [
      { from: 'o', to: 'd', fs: 'b', ts: 't', tone: 'ok' },
      { from: 'o', to: 'c', fs: 'b', ts: 't', tone: 'bad' },
      { from: 'o', to: 'r', fs: 'b', ts: 't', tone: 'warn' },
    ],
    note: 'A saga splits one business operation into local transactions, with a compensation for each. The orchestrator stores its state and reacts to each reply. It ignores duplicate and late replies, and sends stuck cases to manual review.',
  },
];

/* ---------- run, secure, observe ---------- */
const runFrames = [
  {
    h: 250,
    line: 'rename amount → value',
    result: { text: 'breaking: add a field instead', tone: 'warn' },
    cards: [
      box('b', C1, 60, W2, 'breaking change', ['remove or rename a field', 'old consumers fail'], 'bad'),
      box('a', R2, 60, W2, 'additive change', ['new optional field', 'consumers ignore extras'], 'ok'),
      box('p', C1, 170, 612, 'consumer-driven contract test (Pact)', ['the provider pipeline checks every consumer\'s contract before deploy'], 'new'),
    ],
    note: 'Services change independently, so contracts must stay backward compatible. Adding an optional field is safe. Removing or renaming one breaks consumers. Contract tests catch the break before deployment.',
  },
  {
    h: 250,
    line: 'transfer → ledger',
    result: { text: 'authenticate and authorise every call', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 620, h: 110, title: 'internal network: not trusted', tone: 'warn' }],
    cards: [
      box('t', C1, 66, W, 'transfer-service', ['client certificate'], 'ok'),
      box('l', C3, 66, W, 'ledger-service', ['checks caller', 'checks user owns acct'], 'ok'),
      box('n', C1, 170, 612, 'network policy', ['default deny; only the calls meant to exist are allowed'], 'new'),
    ],
    arrows: [{ from: 't', to: 'l', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The internal network is not a safe zone. Services prove who they are with mutual TLS or signed tokens, and pass the user\'s identity along. Every service authorises each request again.',
  },
  {
    h: 250,
    line: 'deploy notification-service',
    result: { text: 'one service, released alone', tone: 'ok' },
    cards: [
      box('t', C1, 60, W, 'service template', ['health, shutdown,', 'logs, metrics'], 'new'),
      box('p', C2, 60, W, 'own pipeline', ['image per commit', 'canary release'], 'ok'),
      box('o', C3, 60, W, 'owning team', ['carries the pager'], 'warn'),
    ],
    arrows: [{ from: 't', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'p', to: 'o', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Independence is the point. Each service has its own pipeline, image and release, built from a template that already includes the basics. The team that builds a service also runs it.',
  },
];

export const NODE_MICRO_SCENES = [
  { id: 'shape', label: 'Service shape', title: 'Small services with clear owners', stage: BoardStage, frames: shapeFrames },
  { id: 'calls', label: 'Calling services', title: 'Every remote call can fail or be slow', stage: BoardStage, frames: callFrames },
  { id: 'events', label: 'Events and the outbox', title: 'Change data and publish the event together', stage: BoardStage, frames: eventFrames },
  { id: 'run', label: 'Run, secure, observe', title: 'Contracts, trust and ownership', stage: BoardStage, frames: runFrames },
];
