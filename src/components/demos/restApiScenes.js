// Frame data for the REST API design walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const REST_API_SCENES = [
  {
    id: 'idempotency',
    label: 'Idempotency key',
    title: 'A retried payment request must not charge twice',
    frames: [
      {
        note: 'The client sends POST /payments to pay 100, with a unique Idempotency-Key header it generated. The payment service has never seen this key, so it records the key as "in progress" and performs the payment.',
        boxes: [b('c', 'Client', ['POST /payments amount=100', 'Idempotency-Key: 7f3a-91c2'], 'new'), b('s', 'Payment service', ['new key: process it'], 'ok'), b('k', 'Idempotency store', ['7f3a-91c2: in progress'], 'warn')],
        deps: [d('Client', 'Payment service', 'request', 'ok'), d('Payment service', 'Idempotency store', 'reserve key', 'ok')],
      },
      {
        note: 'The payment is made and the result is saved against the key, in the same database transaction as the payment itself. The server then sends 201 Created, but the response is lost on the network. The client sees only a timeout and does not know whether the payment happened.',
        boxes: [b('d', 'Database', ['payment #881 recorded', 'result stored with the key'], 'ok', 'committed'), b('c', 'Client', ['timeout: no response'], 'bad', 'unknown outcome')],
        deps: [d('Payment service', 'Client', '201 lost in transit', 'bad')],
      },
      {
        note: 'Without an idempotency key, a retry would create a second payment, and the customer would be charged twice. That is why POST is not safe to retry by default.',
        boxes: [b('c', 'Client', ['retries POST /payments'], 'warn'), b('d', 'Database', ['payment #881', 'payment #882 (duplicate!)'], 'bad', 'charged twice')],
        deps: [d('Client', 'Database', 'retry without a key', 'bad')],
      },
      {
        note: 'With the key, the client retries the same request with the same Idempotency-Key. The service looks the key up and finds a completed result.',
        boxes: [b('c', 'Client', ['retries with Idempotency-Key: 7f3a-91c2'], 'new'), b('s', 'Payment service', ['key already used'], 'ok'), b('k', 'Idempotency store', ['7f3a-91c2: completed', 'stored response: 201, payment #881'], 'ok')],
        deps: [d('Client', 'Payment service', 'same key', 'ok'), d('Payment service', 'Idempotency store', 'lookup', 'ok')],
      },
      {
        note: 'The service returns the stored response (201 and payment #881) without performing the payment again. One payment exists, and the retry is safe. If the same key arrives with a different body, reject it with 422, and if the first request is still in progress, answer 409.',
        boxes: [b('s', 'Payment service', ['replays the stored response'], 'ok'), b('c', 'Client', ['201 Created, payment #881'], 'ok', 'exactly once'), b('d', 'Database', ['one payment'], 'ok')],
        deps: [d('Payment service', 'Client', 'stored 201', 'ok')],
      },
    ],
  },
  {
    id: 'paging',
    label: 'Offset vs cursor paging',
    title: 'Why cursor pagination stays correct while data changes',
    frames: [
      {
        note: 'A client lists transactions newest first, 3 per page. Offset pagination asks for page 1: LIMIT 3 OFFSET 0. The rows are T9, T8, T7.',
        boxes: [b('c', 'Client', ['GET /transactions?page=0&size=3'], 'new'), b('d', 'Database', ['T9 T8 T7 | T6 T5 T4 | T3 T2 T1'], 'ok')],
        deps: [d('Client', 'Database', 'OFFSET 0 LIMIT 3', 'ok')],
      },
      {
        note: 'Before the client asks for page 2, a new transaction T10 is inserted at the top. Everything shifts down by one position.',
        boxes: [b('d', 'Database', ['T10 T9 T8 | T7 T6 T5 | T4 T3 T2 | T1'], 'warn', 'T10 inserted'), b('c', 'Client', ['still thinks it is on page 1'], 'none')],
        deps: [],
      },
      {
        note: 'Page 2 with OFFSET 3 now returns T7, T6, T5. T7 was already on page 1, so the client sees it twice. With a deletion the opposite happens and a row is skipped. Deep offsets are also slow because the database scans and discards all the earlier rows.',
        boxes: [b('c', 'Client', ['page 2: T7 (duplicate), T6, T5'], 'bad', 'duplicate'), b('d', 'Database', ['OFFSET 3 scans 3 rows first'], 'warn')],
        deps: [d('Client', 'Database', 'OFFSET 3 LIMIT 3', 'warn')],
      },
      {
        note: 'Cursor (keyset) pagination: the response includes a cursor for the last row seen, here the id of T7. The next request asks for rows before that id: WHERE id < 7 ORDER BY id DESC LIMIT 3. The result is T6, T5, T4 regardless of inserts at the top, and the index makes it fast on any page. The cost: you can only move forward or back, not jump to page 40.',
        boxes: [b('c', 'Client', ['GET /transactions?after=T7&size=3'], 'new'), b('d', 'Database', ['WHERE id < 7 ORDER BY id DESC LIMIT 3', 'returns T6 T5 T4'], 'ok', 'stable and fast')],
        deps: [d('Client', 'Database', 'cursor = last id', 'ok')],
      },
    ],
  },
  {
    id: 'etag',
    label: 'ETag and If-Match',
    title: 'Preventing lost updates over HTTP with conditional requests',
    frames: [
      {
        note: 'Two staff members open the same customer profile. Each GET returns the resource with an ETag header that identifies this version: ETag: "v3".',
        boxes: [b('a', 'Client A', ['GET /customers/7', 'ETag: "v3"'], 'new'), b('b', 'Client B', ['GET /customers/7', 'ETag: "v3"'], 'new'), b('s', 'Customer service', ['customer 7 is at version 3'], 'ok')],
        deps: [d('Customer service', 'Client A', 'body + ETag v3', 'ok'), d('Customer service', 'Client B', 'body + ETag v3', 'ok')],
      },
      {
        note: 'Client A updates the phone number: PUT /customers/7 with If-Match: "v3". The version matches, so the service applies the change and moves to version 4, returning the new ETag.',
        boxes: [b('a', 'Client A', ['PUT with If-Match: "v3"'], 'new'), b('s', 'Customer service', ['version matches', 'now at version 4'], 'ok', '200 OK, ETag v4')],
        deps: [d('Client A', 'Customer service', 'conditional PUT', 'ok')],
      },
      {
        note: 'Client B, still holding version 3, sends its own change with If-Match: "v3". The current version is 4, so the precondition fails and the service answers 412 Precondition Failed. Client B\'s edit did not silently overwrite Client A\'s.',
        boxes: [b('b', 'Client B', ['PUT with If-Match: "v3"'], 'new'), b('s', 'Customer service', ['current is v4: mismatch'], 'bad', '412 Precondition Failed')],
        deps: [d('Client B', 'Customer service', 'stale conditional PUT', 'bad')],
      },
      {
        note: 'Client B refetches, sees the new data, merges its change and retries with If-Match: "v4". The ETag usually comes from a version column in the database, so this is optimistic locking exposed through HTTP. The same ETag also lets GET return 304 Not Modified to save bandwidth.',
        boxes: [b('b', 'Client B', ['GET again, merge, PUT with If-Match: "v4"'], 'ok', 'retry'), b('s', 'Customer service', ['version 5'], 'ok')],
        deps: [d('Client B', 'Customer service', 'PUT with current ETag', 'ok')],
      },
    ],
  },
];
