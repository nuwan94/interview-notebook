// Frame data for the "Express middleware" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- the layer stack: Express scans an array ---------- */
const LAYERS = [
  'app.use(logger)',
  'app.use(express.json())',
  'app.get("/health", health)',
  'app.use("/api", authenticate)',
  'app.use("/api/accounts", accounts)',
  'app.use(notFound)',
  'app.use((err, req, res, next) => …)',
];
// st: ok (ran), skip (no match), now (ends the response), bad, idle (not reached)
const layers = (states, list = LAYERS) => list.map((t, i) => {
  const [st, badge] = states[i] || ['idle'];
  const tone = { ok: 'ok', now: 'new', bad: 'bad', warn: 'warn' }[st] || 'none';
  return { id: `l${i}`, x: 14, y: 34 + i * 36, w: 400, h: 28, title: t, mono: true, tone, dim: st === 'skip' || st === 'idle', badge, badgeTone: st === 'skip' ? 'none' : undefined };
});
const reqCard = (lines, o = {}) => ({ id: 'req', x: 456, y: 34, w: 170, title: 'request', lines, mono: true, tone: 'new', ...o });
const resCard = (lines, o = {}) => ({ id: 'res', x: 456, y: 210, w: 170, title: 'response', lines, mono: true, tone: 'ok', ...o });

const stackFrames = [
  {
    h: 300,
    line: 'GET /api/accounts/42',
    result: { text: 'scan from the top', tone: 'ok' },
    cards: [...layers({ 0: ['ok', 'match'], 1: ['ok', 'match'], 2: ['skip', 'skip'], 3: ['now', 'match'] }), reqCard(['GET /api/accounts/42'])],
    arrows: [{ from: 'req', to: 'l0', fs: 'l', ts: 'r', tone: 'new' }],
    note: 'Express keeps an array of layers. Every app.use, app.get and router.use adds one. For each request, it walks the array from the top, and calls each layer whose path and method match. The /health route does not match, so it is skipped.',
  },
  {
    h: 300,
    line: 'accounts router sends res.json(account)',
    result: { text: '200: later layers never run', tone: 'ok' },
    cards: [...layers({ 0: ['ok'], 1: ['ok'], 2: ['skip'], 3: ['ok'], 4: ['now', 'responds'] }), reqCard(['GET /api/accounts/42']), resCard(['200 OK', '{ id: "42", … }'])],
    arrows: [{ from: 'l4', to: 'res', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'next() simply means "continue the scan from here". The first layer that ends the response wins. notFound and the error handler are never reached for this request.',
  },
  {
    h: 300,
    line: 'GET /api/nothing-here',
    result: { text: '404 from notFound', tone: 'warn' },
    cards: [...layers({ 0: ['ok'], 1: ['ok'], 2: ['skip'], 3: ['ok'], 4: ['skip', 'skip'], 5: ['now', 'responds'] }), reqCard(['GET /api/nothing-here']), resCard(['404', '{ code: "NOT_FOUND" }'], { tone: 'warn' })],
    arrows: [{ from: 'l5', to: 'res', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'When no route matches, the scan reaches the notFound layer near the end. If even that is missing, Express falls back to its own default 404. That is why notFound goes after every router.',
  },
  {
    h: 300,
    line: 'express.json() registered after the router',
    result: { text: 'req.body is undefined', tone: 'bad' },
    cards: [
      ...layers({ 0: ['ok'], 1: ['skip'], 2: ['ok'], 3: ['bad', 'no body'] }, ['app.use(logger)', 'app.get("/health", health)', 'app.use("/api", authenticate)', 'app.use("/api/accounts", accounts)', 'app.use(express.json())  // too late', 'app.use(notFound)', 'app.use((err, req, res, next) => …)']),
      reqCard(['POST /api/accounts', '{ "owner": "Ana" }']), resCard(['400', 'owner is required'], { tone: 'bad' }),
    ],
    arrows: [{ from: 'l3', to: 'res', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Order is design. A body parser after the routes leaves req.body undefined in them. Auth after a route leaves it open. CORS after auth makes preflights fail. Review the order like code.',
  },
];

/* ---------- the next() family ---------- */
const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });

const nextFrames = [
  {
    h: 250,
    line: 'next()',
    result: { text: 'continue the scan', tone: 'ok' },
    cards: [box('a', 14, 60, 180, 'logger', ['next()'], 'ok'), box('b', 230, 60, 180, 'express.json()', ['next()'], 'ok'), box('c', 446, 60, 180, 'route handler', ['res.json(…)'], 'new')],
    arrows: [{ from: 'a', to: 'b', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'b', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    texts: [{ x: 14, y: 170, t: 'respond OR call next(): never both, never neither' }],
    note: 'next() with no argument continues with the next matching layer. It is the normal case. Calling it after sending a response causes "headers already sent". Doing neither leaves the request hanging.',
  },
  {
    h: 250,
    line: 'next(err)   // or a throw',
    result: { text: 'jump to the error handler', tone: 'warn' },
    cards: [box('a', 14, 44, 180, 'route handler', ['throw new AppError(…)'], 'bad'), box('b', 230, 44, 180, 'notFound', ['(skipped)'], 'none', { dim: true }), box('c', 446, 44, 180, 'errorHandler', ['(err, req, res, next)'], 'new', { badge: '4 params' })],
    arrows: [{ from: 'a', to: 'c', fs: 'b', ts: 'b', tone: 'bad', label: 'skips every normal layer', ly: 170 }],
    note: 'next(err), or a throw, starts the error flow. Express skips every normal layer, and calls the next layer with four parameters. It finds error handlers by counting parameters, so keep all four.',
  },
  {
    h: 250,
    line: 'next("route")',
    result: { text: 'the next route takes it', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 410, h: 92, title: 'GET /accounts/:id' }, { x: 6, y: 142, w: 410, h: 92, title: 'GET /accounts/me' }],
    cards: [
      box('h1', 18, 62, 224, 'handler 1', ["id === 'me' → next('route')"], 'warn'),
      box('h2', 256, 62, 150, 'handler 2', ['(skipped)'], 'none', { dim: true }),
      box('h3', 226, 174, 180, 'current user', ['res.json(me)'], 'ok'),
      box('rq', 456, 62, 170, 'request', ['GET /accounts/me'], 'new'),
    ],
    arrows: [{ from: 'h1', to: 'h3', fs: 'b', ts: 't', tone: 'warn' }],
    note: 'next("route") skips the remaining handlers of the current route, and goes on to the next matching route. One of several handlers can decide that this route does not apply.',
  },
  {
    h: 250,
    line: 'next("router")',
    result: { text: 'back to the parent app', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 410, h: 120, title: 'adminRouter' }],
    cards: [
      box('g', 18, 62, 180, 'guard', ["not admin → next('router')"], 'warn'),
      box('r1', 226, 62, 180, 'admin routes', ['(skipped)'], 'none', { dim: true }),
      box('ap', 18, 180, 388, 'app.use(notFound)', ['the parent app continues here'], 'ok'),
      box('rq', 456, 62, 170, 'request', ['GET /admin/users', 'user: not admin'], 'new'),
    ],
    arrows: [{ from: 'g', to: 'ap', fs: 'b', ts: 't', tone: 'warn' }],
    note: 'next("router") leaves the current router entirely, and goes back to its parent. A guard at the top of an admin router hands other requests back to the app.',
  },
];

/* ---------- routers and mount paths ---------- */
const mountFrames = [
  {
    h: 250,
    line: 'app.use("/api/accounts", accounts)',
    result: { text: 'req.url loses the mount path', tone: 'ok' },
    cards: [
      box('ou', 14, 40, 612, 'req.originalUrl  (never changes)', ['/api/accounts/42?x=1'], 'none'),
      box('bu', 14, 150, 290, 'req.baseUrl', ['/api/accounts'], 'ok', { badge: 'mount' }),
      box('ru', 336, 150, 290, 'req.url  (inside the router)', ['/42?x=1'], 'new', { badge: 'relative' }),
    ],
    arrows: [{ from: 'ou', to: 'bu', fs: 'b', ts: 't', tone: 'ok' }, { from: 'ou', to: 'ru', fs: 'b', ts: 't', tone: 'new' }],
    note: 'Inside a mounted router, Express removes the mount path from req.url. So the router declares routes relative to itself: "/" and "/:id". Log req.originalUrl, and build links with req.baseUrl.',
  },
  {
    h: 270,
    line: 'app → router → route',
    result: { text: 'use the narrowest level', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 620, h: 228, title: 'app level: every request' }, { x: 26, y: 100, w: 580, h: 148, title: 'router level: /api/accounts only', tone: 'new' }, { x: 46, y: 168, w: 540, h: 72, title: 'route level: POST /:id/transfers', tone: 'ok', solid: true }],
    cards: [
      box('a', 280, 50, 330, 'requestContext, logger', [], 'ok'),
      box('r', 300, 120, 290, 'authenticate', [], 'ok'),
      box('t', 320, 196, 250, "requireScope('transfers:write')", [], 'new'),
    ],
    note: 'Middleware can sit at three levels. At the app, it runs for every matching request. At a router, only for that feature. On one route, only for that endpoint. Use the narrowest level, so a public route does not pay for admin checks.',
  },
  {
    h: 250,
    line: 'Router({ mergeParams: true }) + router.param("id")',
    result: { text: 'load the account once', tone: 'ok' },
    cards: [
      box('p', 14, 44, 290, 'app.use(path, transfers)', ['/accounts/:accountId/transfers'], 'none'),
      box('c', 336, 44, 290, 'child router', ['mergeParams: true', 'sees req.params.accountId'], 'new'),
      box('l', 336, 160, 290, "accounts.param('id', loader)", ['find + check owner', 'req.account = account'], 'ok', { badge: 'once' }),
      box('h', 14, 160, 290, 'handlers', ['use req.account'], 'ok'),
    ],
    arrows: [{ from: 'p', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'l', to: 'h', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'A child router does not see the parent\'s path parameters, unless it is created with mergeParams: true. router.param("id", fn) runs once whenever a route has :id. It is a good place to load the account and check its owner.',
  },
];

/* ---------- context, hooks and raw bodies ---------- */
const X0 = 120;
let uid = 0;
const bar = (y, t0, t1, title, tone = 'ok', o = {}) => ({ id: `b${uid++}`, x: X0 + t0 * 1.1, y, w: (t1 - t0) * 1.1, h: 30, title, tone, ...o });
const lane = (y, t) => ({ x: 14, y: y + 20, t });

const contextFrames = [
  {
    h: 270,
    line: 'als.run({ requestId }, next)',
    result: { text: 'each request sees its own id', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 300, h: 220, title: 'request A' }, { x: 326, y: 30, w: 300, h: 220, title: 'request B' }],
    cards: [
      box('ma', 18, 62, 276, 'requestContext', ['store { requestId: "a1" }'], 'new'),
      box('sa', 18, 124, 276, 'service → repository', ['no req here'], 'none'),
      box('la', 18, 186, 276, 'log line', ['requestId: "a1"'], 'ok'),
      box('mb', 338, 62, 276, 'requestContext', ['store { requestId: "b7" }'], 'new'),
      box('sb', 338, 124, 276, 'service → repository', ['no req here'], 'none'),
      box('lb', 338, 186, 276, 'log line', ['requestId: "b7"'], 'ok'),
    ],
    arrows: [{ from: 'ma', to: 'sa', fs: 'b', ts: 't' }, { from: 'sa', to: 'la', fs: 'b', ts: 't', tone: 'ok' }, { from: 'mb', to: 'sb', fs: 'b', ts: 't' }, { from: 'sb', to: 'lb', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'Deep code, such as a repository, never receives req. AsyncLocalStorage keeps a store that follows the request through every await. Two requests running at the same time each see their own id. A module-level variable would mix them up.',
  },
  {
    h: 230,
    line: 'res.on("finish", log)',
    result: { text: 'status and ms known at the end', tone: 'ok' },
    texts: [lane(44, 'accessLog'), lane(94, 'handler'), lane(144, 'response'), { x: 400, y: 210, t: 'time  →' }],
    cards: [
      bar(44, 0, 110, 'start, next()', 'new'),
      bar(94, 110, 260, 'await db.find(…)', 'ok'),
      bar(144, 260, 320, 'finish', 'new', { id: 'fin' }),
      { id: 'lg', x: 490, y: 120, w: 136, title: 'log on finish', lines: ['status 200', 'ms 182'], mono: true, tone: 'ok' },
    ],
    arrows: [{ from: 'fin', to: 'lg', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'next() returns at once; the response is sent later. To log the status code and duration, record the start time, then listen for res "finish". Listen for "close" too: it fires when the client leaves before the end.',
  },
  {
    h: 250,
    line: 'app.use(express.json()) before the webhook',
    result: { text: 'signature mismatch: 401', tone: 'bad' },
    cards: [
      box('pv', 14, 44, 180, 'payment provider', ['signs the exact bytes'], 'none'),
      box('js', 230, 44, 180, 'express.json()', ['parses the body'], 'warn'),
      box('vs', 446, 44, 180, 'verifySignature', ['HMAC(JSON.stringify(body))'], 'bad', { badge: 'no match' }),
      box('df', 230, 160, 396, 'the bytes changed', ['spacing and key order differ from what was signed'], 'bad'),
    ],
    arrows: [{ from: 'pv', to: 'js', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'js', to: 'vs', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A webhook provider signs the exact bytes it sends, with an HMAC. If a JSON parser runs first and you stringify the object again, the bytes differ, and the signature never matches.',
  },
  {
    h: 250,
    line: 'app.post("/webhooks", express.raw(), verify, handle)',
    result: { text: 'verified, then parsed', tone: 'ok' },
    cards: [
      box('pv', 14, 44, 180, 'payment provider', ['signs the exact bytes'], 'none'),
      box('rw', 230, 44, 180, 'express.raw()', ['req.body is a Buffer'], 'ok', { badge: 'this route' }),
      box('vs', 446, 44, 180, 'verifySignature', ['HMAC(raw bytes)', 'timingSafeEqual'], 'ok'),
      box('gj', 14, 160, 612, 'app.use(express.json())', ['registered after the webhook route, for everything else'], 'none'),
    ],
    arrows: [{ from: 'pv', to: 'rw', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'rw', to: 'vs', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Give the webhook route its own raw parser, and register it before the global JSON parser. Compute the HMAC over the raw Buffer, compare with crypto.timingSafeEqual, reject old timestamps, and only then parse the JSON.',
  },
];

export const MIDDLEWARE_SCENES = [
  { id: 'stack', label: 'The layer stack', title: 'Registered in order, scanned in order', stage: BoardStage, frames: stackFrames },
  { id: 'next', label: 'The next() family', title: 'Four ways to pass control', stage: BoardStage, frames: nextFrames },
  { id: 'mount', label: 'Routers and mount paths', title: 'Mounting changes what the code sees', stage: BoardStage, frames: mountFrames },
  { id: 'context', label: 'Context, hooks and raw bodies', title: 'Per-request state, after-hooks and webhooks', stage: BoardStage, frames: contextFrames },
];
