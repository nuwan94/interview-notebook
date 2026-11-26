// Frame data for the REST API design walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- idempotency key ---------- */
const client = (lines, o = {}) => ({ id: 'client', x: 14, y: 96, w: 146, title: 'Client', lines, tone: 'new', ...o });
const svc = (lines, o = {}) => ({ id: 'svc', x: 256, y: 96, w: 160, title: 'Payment service', lines, tone: 'none', ...o });
const store = (lines, o = {}) => ({ id: 'store', x: 470, y: 24, w: 156, title: 'Idempotency keys', lines, mono: true, tone: 'none', ...o });
const db = (lines, o = {}) => ({ id: 'db', x: 470, y: 176, w: 156, title: 'Payments table', lines, mono: true, tone: 'none', ...o });

const idemFrames = [
  {
    h: 270,
    line: 'POST /payments   Idempotency-Key: 7f3a',
    cards: [client(['pay 100', 'key 7f3a']), svc(['new key: do the work']), store(['7f3a  in progress'], { tone: 'warn', badge: 'reserved' }), db(['(empty)'])],
    arrows: [{ from: 'client', to: 'svc', label: 'key 7f3a', tone: 'new' }, { from: 'svc', to: 'store', fs: 'r', ts: 'l' }],
    note: 'The client pays 100 with POST /payments. It sends a unique Idempotency-Key that it generated. The service has never seen this key, so it records it as "in progress" and makes the payment.',
  },
  {
    h: 270,
    line: '201 Created   (lost on the network)',
    result: { text: 'outcome unknown', tone: 'bad' },
    cards: [client(['timeout', 'did it pay?'], { tone: 'bad' }), svc(['payment done']), store(['7f3a  done', '      201, #881'], { tone: 'ok' }), db(['#881  100'], { tone: 'ok', badge: 'committed' })],
    arrows: [{ from: 'svc', to: 'client', fs: 'l', ts: 'r', cross: true, tone: 'bad', label: '201' }, { from: 'svc', to: 'db', fs: 'r', ts: 'l' }],
    note: 'The payment is saved, and the result is stored against the key in the same database transaction. The server sends 201 Created, but the response is lost on the way. The client only sees a timeout and cannot tell whether it paid.',
  },
  {
    h: 270,
    line: 'retry POST /payments   (no key)',
    result: { text: 'charged twice', tone: 'bad' },
    cards: [client(['retries'], { tone: 'warn' }), svc(['looks like a new request'], { tone: 'warn' }), store(['(not used)'], { dim: true }), db(['#881  100', '#882  100'], { tone: 'bad', badge: 'duplicate' })],
    arrows: [{ from: 'client', to: 'svc', tone: 'bad' }, { from: 'svc', to: 'db', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Without a key, the retry looks like a brand-new payment. The service pays again and the customer is charged twice. That is why POST is not safe to retry by default.',
  },
  {
    h: 270,
    line: 'retry POST /payments   Idempotency-Key: 7f3a',
    cards: [client(['retries', 'key 7f3a']), svc(['seen this key']), store(['7f3a  done', '      201, #881'], { tone: 'ok', badge: 'found' }), db(['#881  100'])],
    arrows: [{ from: 'client', to: 'svc', label: 'same key', tone: 'new' }, { from: 'svc', to: 'store', fs: 'r', ts: 'l', label: 'look up' }],
    note: 'With a key, the client retries the same request with the same Idempotency-Key. The service looks the key up and finds a finished result.',
  },
  {
    h: 270,
    line: '201 Created   payment #881   (replayed)',
    result: { text: 'paid exactly once', tone: 'ok' },
    cards: [client(['201, #881'], { tone: 'ok' }), svc(['replays the stored', 'response'], { tone: 'ok' }), store(['7f3a  done', '      201, #881'], { tone: 'ok' }), db(['#881  100'], { tone: 'ok', badge: 'one payment' })],
    arrows: [{ from: 'svc', to: 'client', fs: 'l', ts: 'r', label: 'stored 201', tone: 'ok' }],
    note: 'The service sends back the stored response and does not pay again. One payment exists, so the retry was safe. The same key with a different body gets 422, and a key whose first request is still running gets 409.',
  },
];

/* ---------- offset vs cursor paging ---------- */
const STEP = 61;
const slotX = (i) => 14 + i * STEP;
const row = (name, slot, o = {}) => ({ id: name, x: slotX(slot), y: 104, w: 52, h: 40, title: name, tone: 'none', ...o });
const page = (from, title, tone) => ({ x: slotX(from) - 6, y: 58, w: 3 * STEP + 3, h: 98, title, tone });
const before = ['T9', 'T8', 'T7', 'T6', 'T5', 'T4', 'T3', 'T2', 'T1'];
const after = ['T10', ...before];
const rows = (names, style = {}) => names.map((n, i) => row(n, i, style[n] || {}));

const pagingFrames = [
  {
    h: 200,
    line: 'GET /transactions?page=0&size=3   →   OFFSET 0 LIMIT 3',
    texts: [{ x: 14, y: 40, t: 'newest first' }],
    regions: [page(0, 'page 1', 'ok')],
    cards: rows(before, { T9: { tone: 'ok' }, T8: { tone: 'ok' }, T7: { tone: 'ok' } }),
    note: 'A client lists transactions, newest first, 3 per page. Offset pagination asks for page 1 with LIMIT 3 OFFSET 0. It gets T9, T8 and T7.',
  },
  {
    h: 200,
    line: 'INSERT T10',
    result: { text: 'every row shifts one place', tone: 'warn' },
    texts: [{ x: 14, y: 40, t: 'newest first' }],
    cards: rows(after, { T10: { tone: 'new', badge: 'new' }, T9: { dim: true }, T8: { dim: true }, T7: { dim: true } }),
    note: 'Before the client asks for page 2, a new transaction T10 arrives at the top. Every row moves down one position. The dim rows are the ones the client has already seen.',
  },
  {
    h: 200,
    line: 'GET /transactions?page=1&size=3   →   OFFSET 3 LIMIT 3',
    result: { text: 'T7 shown twice', tone: 'bad' },
    texts: [{ x: 14, y: 40, t: 'newest first' }],
    regions: [page(3, 'page 2 = OFFSET 3', 'bad')],
    cards: rows(after, { T10: { dim: true }, T9: { dim: true }, T8: { dim: true }, T7: { tone: 'bad', badge: 'again' }, T6: { tone: 'ok' }, T5: { tone: 'ok' } }),
    note: 'Page 2 skips 3 rows and returns T7, T6 and T5. The client already saw T7 on page 1. A deletion does the opposite and skips a row. Deep offsets are also slow, because the database reads and throws away every skipped row.',
  },
  {
    h: 200,
    line: 'GET ?after=T7   →   WHERE id < 7 LIMIT 3',
    result: { text: 'stable and fast', tone: 'ok' },
    texts: [{ x: 14, y: 40, t: 'newest first' }],
    regions: [page(4, 'page 2 = after T7', 'ok')],
    cards: rows(after, { T10: { dim: true }, T9: { dim: true }, T8: { dim: true }, T7: { tone: 'new', badge: 'cursor' }, T6: { tone: 'ok' }, T5: { tone: 'ok' }, T4: { tone: 'ok' } }),
    note: 'Cursor pagination remembers the last row seen, T7, and asks for the rows after it. It gets T6, T5 and T4, however many rows were added at the top, and an index makes every page fast. The cost: you can only move forward or back, not jump to page 40.',
  },
];

/* ---------- ETag and If-Match ---------- */
const ca = (lines, o = {}) => ({ id: 'a', x: 14, y: 30, w: 170, title: 'Client A', lines, tone: 'new', ...o });
const cb = (lines, o = {}) => ({ id: 'b', x: 14, y: 160, w: 170, title: 'Client B', lines, tone: 'new', ...o });
const cs = (lines, o = {}) => ({ id: 'cs', x: 420, y: 92, w: 206, title: 'Customer 7', lines, mono: true, tone: 'none', ...o });

const etagFrames = [
  {
    h: 250,
    line: 'GET /customers/7   →   ETag: "v3"',
    cards: [ca(['holds v3']), cb(['holds v3']), cs(['version 3', 'phone 0711 000 111'])],
    arrows: [
      { from: 'cs', to: 'a', fs: 'l', ts: 'r', label: 'ETag "v3"' },
      { from: 'cs', to: 'b', fs: 'l', ts: 'r', label: 'ETag "v3"' },
    ],
    note: 'Two staff members open the same customer. Each GET returns the data with an ETag header that names this version: "v3".',
  },
  {
    h: 250,
    line: 'PUT /customers/7   If-Match: "v3"',
    result: { text: '200, ETag "v4"', tone: 'ok' },
    cards: [ca(['new phone number'], { tone: 'ok' }), cb(['still holds v3']), cs(['version 4', 'phone 0722 222 333'], { tone: 'ok', badge: 'v3 matched' })],
    arrows: [{ from: 'a', to: 'cs', fs: 'r', ts: 'l', label: 'If-Match "v3"', tone: 'ok' }],
    note: 'Client A changes the phone number with If-Match: "v3". The version matches, so the service saves the change, moves to version 4, and returns the new ETag.',
  },
  {
    h: 250,
    line: 'PUT /customers/7   If-Match: "v3"',
    result: { text: '412 Precondition Failed', tone: 'bad' },
    cards: [ca(['new phone number'], { dim: true }), cb(['stale edit'], { tone: 'bad' }), cs(['version 4', 'phone 0722 222 333'], { tone: 'bad', badge: 'v3 ≠ v4' })],
    arrows: [{ from: 'b', to: 'cs', fs: 'r', ts: 'l', label: 'If-Match "v3"', tone: 'bad' }],
    note: 'Client B still holds version 3 and sends its change with If-Match: "v3". The current version is 4, so the check fails and the service answers 412. B\'s edit did not silently overwrite A\'s.',
  },
  {
    h: 250,
    line: 'GET again, merge, PUT   If-Match: "v4"',
    result: { text: 'no lost update', tone: 'ok' },
    cards: [ca(['new phone number'], { dim: true }), cb(['merged edit'], { tone: 'ok' }), cs(['version 5', 'both changes kept'], { tone: 'ok', badge: 'v4 matched' })],
    arrows: [{ from: 'b', to: 'cs', fs: 'r', ts: 'l', label: 'If-Match "v4"', tone: 'ok' }],
    note: 'Client B fetches again, merges its change and retries with If-Match: "v4". The ETag usually comes from a version column, so this is optimistic locking over HTTP. The same ETag lets a GET return 304 Not Modified to save bandwidth.',
  },
];

export const REST_API_SCENES = [
  { id: 'idempotency', label: 'Idempotency key', title: 'A retried payment request must not charge twice', stage: BoardStage, frames: idemFrames },
  { id: 'paging', label: 'Offset vs cursor paging', title: 'Why cursor pagination stays correct while data changes', stage: BoardStage, frames: pagingFrames },
  { id: 'etag', label: 'ETag and If-Match', title: 'Preventing lost updates over HTTP with conditional requests', stage: BoardStage, frames: etagFrames },
];
