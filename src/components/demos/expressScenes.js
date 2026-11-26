// Frame data for the "Express and REST" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- the middleware chain ---------- */
const MW = ['helmet()', 'cors(allowList)', 'requestId() + pino', 'express.json({ limit })', 'rateLimit', 'authenticate', 'accountsRouter', 'notFound  (404)', 'errorHandler(err, …)'];
// state per index: 'ok' ran, 'now' current, 'skip' not run, 'bad', 'warn'
const chain = (states) => MW.map((t, i) => {
  const st = states[i] || 'skip';
  const tone = st === 'ok' ? 'ok' : st === 'now' ? 'new' : st === 'bad' ? 'bad' : st === 'warn' ? 'warn' : 'none';
  return { id: `m${i}`, x: 14, y: 34 + i * 34, w: 270, h: 28, title: t, mono: true, tone, dim: st === 'skip' };
});
const reqCard = (lines, o = {}) => ({ id: 'req', x: 356, y: 34, w: 270, title: 'request', lines, mono: true, tone: 'new', ...o });
const resCard = (lines, o = {}) => ({ id: 'res', x: 356, y: 250, w: 270, title: 'response', lines, mono: true, tone: 'ok', ...o });
const ran = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, 'ok']));

const pipelineFrames = [
  {
    h: 350,
    line: 'app.use(...) in this order',
    result: { text: '201 Created', tone: 'ok' },
    cards: [...chain({ ...ran(6), 6: 'now' }), reqCard(['POST /api/accounts/42/transfers']), resCard(['201 Created', 'Location: /transfers/t1'])],
    arrows: [{ from: 'req', to: 'm0', fs: 'l', ts: 'r', tone: 'new' }, { from: 'm6', to: 'res', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'An Express app is an ordered chain of functions (req, res, next). Each one can change the request, end the response, or call next() to pass it on. They run in the order you registered them, so the order is part of the design.',
  },
  {
    h: 350,
    line: 'authenticate: no Authorization header',
    result: { text: '401, the route never runs', tone: 'warn' },
    cards: [...chain({ ...ran(5), 5: 'bad' }), reqCard(['POST /api/accounts/42/transfers', '(no token)']), resCard(['401 Unauthorized', '{ code: "MISSING_TOKEN" }'], { tone: 'warn' })],
    arrows: [{ from: 'req', to: 'm0', fs: 'l', ts: 'r', tone: 'new' }, { from: 'm5', to: 'res', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A middleware can stop the chain: it sends a response and does not call next(). Here authenticate answers 401, so the router never runs. Security and parsing go before the routes that need them.',
  },
  {
    h: 350,
    line: 'a middleware forgets next() and res',
    result: { text: 'request hangs', tone: 'bad' },
    cards: [...chain({ ...ran(4), 4: 'warn' }), reqCard(['POST /api/accounts/42/transfers']), resCard(['(nothing)', 'client times out after 30 s'], { tone: 'bad' })],
    arrows: [{ from: 'req', to: 'm0', fs: 'l', ts: 'r', tone: 'new' }],
    texts: [{ x: 296, y: 190, t: '← no next()' }],
    note: 'Every path through a middleware must either end the response or call next(). If it does neither, the request just hangs until the client times out. If it does both, Express fails with "headers already sent".',
  },
  {
    h: 350,
    line: 'handler throws: next(err)',
    result: { text: 'one place maps errors', tone: 'ok' },
    cards: [...chain({ ...ran(6), 6: 'bad', 8: 'now' }), reqCard(['POST /api/accounts/42/transfers']), resCard(['422', '{ code: "INSUFFICIENT_FUNDS",', '  requestId: "b3f1c2" }'], { tone: 'warn' })],
    arrows: [{ from: 'm6', to: 'm8', fs: 'r', ts: 'r', tone: 'bad', label: 'next(err)', lx: 300, ly: 280 }, { from: 'm8', to: 'res', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'An error skips every normal middleware and goes to the error handler: the one with four parameters, registered last. Express 5 forwards rejected promises from async handlers on its own. Express 4 needs a wrapper.',
  },
];

/* ---------- validation and errors ---------- */
const reqV = (lines, o = {}) => ({ id: 'req', x: 14, y: 44, w: 160, title: 'POST /transfers', lines, mono: true, tone: 'none', ...o });
const val = (lines, o = {}) => ({ id: 'val', x: 200, y: 44, w: 130, title: 'validate(schema)', lines, tone: 'none', ...o });
const hdl = (lines, o = {}) => ({ id: 'hdl', x: 356, y: 44, w: 120, title: 'handler', lines, tone: 'none', ...o });
const svc = (lines, o = {}) => ({ id: 'svc', x: 502, y: 44, w: 124, title: 'service', lines, tone: 'none', ...o });
const out = (lines, o = {}) => ({ id: 'out', x: 14, y: 168, w: 310, title: 'response', lines, mono: true, tone: 'ok', ...o });
const eh = (lines, o = {}) => ({ id: 'eh', x: 356, y: 168, w: 270, title: 'errorHandler', lines, tone: 'none', ...o });

const validationFrames = [
  {
    h: 260,
    line: 'body: { amount: "abc", role: "admin" }',
    result: { text: '400 with field errors', tone: 'warn' },
    cards: [reqV(['amount: "abc"', 'role: "admin"'], { tone: 'bad' }), val(['zod: strict()'], { tone: 'bad', badge: 'invalid' }), hdl(['never runs'], { dim: true }), svc(['never runs'], { dim: true }),
      out(['400 Bad Request', 'body.amount: expected number', 'body.role: unknown field'], { tone: 'warn' }), eh(['not needed'], { dim: true })],
    arrows: [{ from: 'req', to: 'val', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'val', to: 'out', fs: 'b', ts: 't', tone: 'warn' }],
    note: 'Never trust the body, params or query string. A validation middleware parses them with a schema. strict() rejects unknown fields, so a client cannot slip in role: "admin". Bad input gets 400 with every field error at once.',
  },
  {
    h: 260,
    line: 'body: { toAccount: "SG0123456789", amount: 12000 }',
    result: { text: '201 Created', tone: 'ok' },
    cards: [reqV(['amount: 12000', 'currency: "SGD"']), val(['parsed, typed'], { tone: 'ok' }), hdl(['HTTP in,', 'HTTP out'], { tone: 'new' }), svc(['rules +', 'database'], { tone: 'ok' }),
      out(['201 Created', 'Location: /transfers/t1']), eh(['not needed'], { dim: true })],
    arrows: [{ from: 'req', to: 'val', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'val', to: 'hdl', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'hdl', to: 'svc', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'hdl', to: 'out', fs: 'b', ts: 'r', tone: 'ok' }],
    note: 'Valid input reaches the handler as typed, trusted data. The handler only translates: read input, call the service, choose the status code. The service holds the business rules and the database calls.',
  },
  {
    h: 260,
    line: 'service: throw new InsufficientFunds()',
    result: { text: '422, a known error', tone: 'warn' },
    cards: [reqV(['amount: 999999']), val(['ok'], { tone: 'ok' }), hdl(['awaits'], { tone: 'ok' }), svc(['balance 50.00', 'throws'], { tone: 'bad', badge: 'AppError' }),
      out(['422', '{ code: "INSUFFICIENT_FUNDS",', '  requestId: "b3f1c2" }'], { tone: 'warn' }), eh(['AppError → its status', 'and code'], { tone: 'new' })],
    arrows: [{ from: 'svc', to: 'eh', fs: 'b', ts: 't', tone: 'bad' }, { from: 'eh', to: 'out', fs: 'l', ts: 'r', tone: 'warn' }],
    note: 'Validation checks the shape. Business rules, like enough balance, live in the service. It throws an AppError with a status and a code. The error handler turns it into a clean JSON response.',
  },
  {
    h: 260,
    line: 'TypeError: cannot read "id" of undefined',
    result: { text: '500, nothing leaked', tone: 'bad' },
    cards: [reqV(['amount: 12000']), val(['ok'], { tone: 'ok' }), hdl(['bug'], { tone: 'bad' }), svc(['not reached'], { dim: true }),
      out(['500', '{ code: "INTERNAL_ERROR",', '  requestId: "c91d07" }'], { tone: 'bad' }), eh(['unknown error:', 'stack → logs only'], { tone: 'new', badge: 'log' })],
    arrows: [{ from: 'hdl', to: 'eh', fs: 'b', ts: 't', tone: 'bad' }, { from: 'eh', to: 'out', fs: 'l', ts: 'r', tone: 'bad' }],
    note: 'An unexpected error becomes a generic 500 with a request id. The stack trace goes to the logs, never to the client. Support finds the log line with the request id.',
  },
];

/* ---------- CORS and authentication ---------- */
const authFrames = [
  {
    h: 260,
    line: 'OPTIONS /transfers   // browser preflight',
    result: { text: 'origin allowed', tone: 'ok' },
    cards: [
      { id: 'br', x: 14, y: 52, w: 170, title: 'browser', lines: ['app.bank.example'], tone: 'none' },
      { id: 'pf', x: 226, y: 44, w: 190, title: 'OPTIONS /transfers', lines: ['Origin: app.bank.example', 'wants: Authorization'], mono: true, tone: 'warn', badge: 'preflight' },
      { id: 'cors', x: 456, y: 52, w: 170, title: 'cors middleware', lines: ['origin on allow-list'], tone: 'ok' },
      { id: 'hd', x: 226, y: 168, w: 400, title: 'response headers', lines: ['Access-Control-Allow-Origin: https://app.bank.example', 'Access-Control-Allow-Headers: Authorization'], mono: true, tone: 'ok' },
    ],
    arrows: [{ from: 'br', to: 'pf', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'pf', to: 'cors', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'cors', to: 'hd', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'A page on app.bank.example calling api.bank.example is a cross-origin request. For a JSON body or an Authorization header, the browser first sends an OPTIONS preflight. The server answers with the allowed origin, methods and headers.',
  },
  {
    h: 260,
    line: 'Authorization: Bearer eyJhbGciOi…',
    result: { text: 'req.user set', tone: 'ok' },
    cards: [
      { id: 'rq', x: 14, y: 52, w: 170, title: 'POST /transfers', lines: ['Bearer eyJ…'], mono: true, tone: 'new' },
      { id: 'au', x: 226, y: 44, w: 190, title: 'authenticate', lines: ['signature ✓  exp ✓', 'iss ✓  aud ✓'], mono: true, tone: 'ok' },
      { id: 'jw', x: 226, y: 172, w: 190, title: 'identity provider', lines: ['JWKS: public keys', 'cached'], tone: 'none' },
      { id: 'us', x: 456, y: 52, w: 170, title: 'req.user', lines: ['id: u-7', 'scope: transfers:write'], mono: true, tone: 'ok' },
    ],
    arrows: [{ from: 'rq', to: 'au', fs: 'r', ts: 'l', tone: 'new' }, { from: 'jw', to: 'au', fs: 't', ts: 'b', tone: 'none' }, { from: 'au', to: 'us', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The real request carries a bearer JWT. The authenticate middleware checks the signature with the provider\'s public keys, plus expiry, issuer and audience. Then it puts the user on req.user.',
  },
  {
    h: 260,
    line: '401 versus 403',
    result: { text: 'who are you? / may you?', tone: 'warn' },
    cards: [
      { id: 'a1', x: 14, y: 44, w: 290, title: 'no token, or a bad one', lines: ['checked by authenticate'], tone: 'bad' },
      { id: 'a2', x: 14, y: 160, w: 290, title: '401 Unauthorized', lines: ['"who are you?"'], tone: 'warn' },
      { id: 'b1', x: 336, y: 44, w: 290, title: 'valid token, scope: read only', lines: ['checked by requireScope'], tone: 'warn' },
      { id: 'b2', x: 336, y: 160, w: 290, title: '403 Forbidden', lines: ['"you may not do this"'], tone: 'warn' },
    ],
    arrows: [{ from: 'a1', to: 'a2', fs: 'b', ts: 't', tone: 'warn' }, { from: 'b1', to: 'b2', fs: 'b', ts: 't', tone: 'warn' }],
    note: '401 means the caller is not authenticated. 403 means the caller is known, but not allowed: an authorize middleware checks the role or scope.',
  },
  {
    h: 260,
    line: 'GET /accounts/A-9   // as user u-7',
    result: { text: '404: not yours', tone: 'ok' },
    cards: [
      { id: 'rq', x: 14, y: 52, w: 170, title: 'GET /accounts/A-9', lines: ['req.user.id: u-7'], mono: true, tone: 'new' },
      { id: 'sv', x: 226, y: 44, w: 210, title: 'accounts.findOwned', lines: ["WHERE id = 'A-9'", "AND owner = 'u-7'"], mono: true, tone: 'ok', badge: 'object check' },
      { id: 'db', x: 476, y: 52, w: 150, title: 'account A-9', lines: ['owner: u-9'], tone: 'none' },
    ],
    arrows: [{ from: 'rq', to: 'sv', fs: 'r', ts: 'l', tone: 'new' }, { from: 'sv', to: 'db', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A valid token and the right role are not enough. User u-7 changes the id in the URL to read someone else\'s account. The service must check that the caller owns the object. This broken object-level authorisation is the top API vulnerability.',
  },
  {
    h: 260,
    line: 'rateLimit({ limit: 100, store: redis })',
    result: { text: '429, Retry-After: 23', tone: 'warn' },
    cards: [
      { id: 'i1', x: 14, y: 36, w: 170, title: 'instance 1', lines: ['express'], tone: 'ok' },
      { id: 'i2', x: 14, y: 106, w: 170, title: 'instance 2', lines: ['express'], tone: 'ok' },
      { id: 'i3', x: 14, y: 176, w: 170, title: 'instance 3', lines: ['express'], tone: 'warn', badge: '429' },
      { id: 'rd', x: 300, y: 98, w: 326, title: 'Redis: shared counter', lines: ['u-7 this minute: 101 / 100'], mono: true, tone: 'warn' },
    ],
    arrows: [{ from: 'i1', to: 'rd', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i2', to: 'rd', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i3', to: 'rd', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Rate limit per client or token, so one caller cannot exhaust the service. With several instances, keep the counter in Redis, or each instance counts separately. CORS only protects browsers; curl ignores it. Authentication protects the data.',
  },
];

/* ---------- layers and testing ---------- */
const lay = (id, x, title, lines, tone = 'ok', o = {}) => ({ id, x, y: 70, w: 108, title, lines, tone, ...o });
const LAYERS = () => [
  lay('rt', 14, 'router', ['URL →', 'handler']),
  lay('ct', 136, 'controller', ['req, res', 'status code'], 'new'),
  lay('sv', 268, 'service', ['business', 'rules'], 'new'),
  lay('rp', 390, 'repository', ['SQL'], 'ok'),
  lay('db', 512, 'database', ['pool'], 'none'),
];
const layerLinks = [['rt', 'ct'], ['ct', 'sv'], ['sv', 'rp'], ['rp', 'db']].map(([from, to]) => ({ from, to, fs: 'r', ts: 'l', tone: 'ok' }));

const layerFrames = [
  {
    h: 230,
    line: 'routes/ → controllers/ → services/ → repositories/',
    result: { text: 'HTTP stays thin', tone: 'ok' },
    regions: [{ x: 6, y: 36, w: 250, h: 140, title: 'knows Express', tone: 'warn' }, { x: 260, y: 36, w: 246, h: 140, title: 'no req, no res', tone: 'ok' }],
    cards: LAYERS(),
    arrows: layerLinks,
    note: 'Keep the layers apart. The router maps URLs, the controller deals with HTTP, the service holds the business rules and knows nothing about Express, and the repository holds the SQL. The same service can serve a queue consumer or a CLI.',
  },
  {
    h: 260,
    line: 'request(createApp({ svc: fake }))',
    result: { text: 'no port, no network', tone: 'ok' },
    cards: [
      { id: 'st', x: 14, y: 44, w: 190, title: 'supertest', lines: ['in memory'], tone: 'new' },
      { id: 'ap', x: 236, y: 44, w: 190, title: 'createApp()', lines: ['no listen() inside'], tone: 'ok' },
      { id: 'fk', x: 456, y: 44, w: 170, title: 'fake service', lines: ['vi.fn()'], tone: 'none', badge: 'stub' },
      { id: 'ut', x: 14, y: 164, w: 190, title: 'unit test', lines: ['service directly'], tone: 'new' },
      { id: 'sv', x: 236, y: 164, w: 190, title: 'service', lines: ['plain function'], tone: 'ok' },
      { id: 'it', x: 456, y: 164, w: 170, title: 'Testcontainers', lines: ['real database'], tone: 'none' },
    ],
    arrows: [{ from: 'st', to: 'ap', fs: 'r', ts: 'l', tone: 'new' }, { from: 'ap', to: 'fk', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'ut', to: 'sv', fs: 'r', ts: 'l', tone: 'new' }, { from: 'sv', to: 'it', fs: 'r', ts: 'l', tone: 'ok', dash: true }],
    note: 'Build the app in a function that does not call listen(). supertest sends requests to it in memory. Services are tested as plain functions. A few integration tests hit a real database.',
  },
];

export const EXPRESS_SCENES = [
  { id: 'pipeline', label: 'Middleware pipeline', title: 'A request passes through an ordered chain', stage: BoardStage, frames: pipelineFrames },
  { id: 'validation', label: 'Validation and errors', title: 'Bad input and failures become clean responses', stage: BoardStage, frames: validationFrames },
  { id: 'auth', label: 'CORS and authentication', title: 'Browser rules, then identity, then ownership', stage: BoardStage, frames: authFrames },
  { id: 'layers', label: 'Layers and testing', title: 'Keep HTTP thin and test the app', stage: BoardStage, frames: layerFrames },
];
