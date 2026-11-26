// Frame data for the "Authentication in Node.js" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;

/* ---------- passwords and login ---------- */
const passwordFrames = [
  {
    h: 250,
    line: 'hashPassword("correct horse")',
    result: { text: 'only the hash string is stored', tone: 'ok' },
    cards: [
      box('pw', C1, 44, W, 'password typed', ['"correct horse"'], 'none'),
      box('salt', C1, 140, W, 'randomBytes(16)', ['salt: 9fK2…'], 'new', { badge: 'per user' }),
      box('h', C2, 80, W, 'scrypt / argon2id', ['slow on purpose', '~100 ms per hash'], 'new'),
      box('db', C3, 80, W, 'users.password_hash', ['scrypt$32768$8$1$', '9fK2…$Qm7x…'], 'ok'),
    ],
    arrows: [{ from: 'pw', to: 'h', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'salt', to: 'h', fs: 'r', ts: 'l', tone: 'new' }, { from: 'h', to: 'db', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The server never stores the password. It makes a random salt, runs a slow hash, and stores one string: the algorithm, its settings, the salt and the hash. The settings travel with the hash, so they can be raised later.',
  },
  {
    h: 230,
    line: 'attacker with a leaked database',
    result: { text: 'slow hash: guessing is too slow', tone: 'ok' },
    texts: [{ x: 14, y: 60, t: 'guesses per second on one GPU' }, { x: 14, y: 106, t: 'SHA-256' }, { x: 14, y: 156, t: 'scrypt' }],
    cards: [
      { id: 'fast', x: 120, y: 90, w: 506, h: 30, title: '~ 10,000,000,000', tone: 'bad', badge: 'fast' },
      { id: 'slow', x: 120, y: 140, w: 70, h: 30, title: '~ 10,000', tone: 'ok' },
    ],
    note: 'SHA-256 is built to be fast. A GPU tries billions of guesses a second against a leaked hash. A slow, memory-hard hash cuts that to thousands, so cracking even a weak password takes far longer.',
  },
  {
    h: 260,
    line: 'POST /auth/login',
    result: { text: 'same 401, same timing', tone: 'ok' },
    regions: [{ x: 6, y: 30, w: 300, h: 120, title: 'unknown email' }, { x: 326, y: 30, w: 300, h: 120, title: 'wrong password' }],
    cards: [
      box('u', 18, 62, 276, 'verify(pw, DUMMY_HASH)', ['a hash still runs'], 'warn'),
      box('w', 338, 62, 276, 'verify(pw, user.hash)', ['a real hash runs'], 'warn'),
      box('r', 168, 180, 300, '401 INVALID_CREDENTIALS', ['~100 ms both ways'], 'ok'),
    ],
    arrows: [{ from: 'u', to: 'r', fs: 'b', ts: 't', tone: 'ok' }, { from: 'w', to: 'r', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'An unknown email and a wrong password get the same answer. A dummy hash makes the timing match too. Any difference would let an attacker find out which emails are registered.',
  },
  {
    h: 230,
    line: 'if (needsRehash(user.passwordHash)) …',
    result: { text: 'cost raised without a reset', tone: 'ok' },
    cards: [
      box('o', C1, 60, W, 'stored hash', ['scrypt$16384$…'], 'warn', { badge: 'old cost' }),
      box('v', C2, 60, W, 'verified at login', ['the password is known'], 'ok'),
      box('n', C3, 60, W, 'rehash and save', ['scrypt$32768$…'], 'new'),
    ],
    arrows: [{ from: 'o', to: 'v', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'v', to: 'n', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'Only at login does the server know the plain password. If the stored settings are weaker than today\'s, it hashes again and saves. The cost goes up over the years, and nobody is asked to reset.',
  },
];

/* ---------- session or token ---------- */
const sessionFrames = [
  {
    h: 250,
    line: 'Cookie: __Host-sid=s8Hq…',
    result: { text: 'state lives on the server', tone: 'ok' },
    cards: [
      box('b', C1, 60, W, 'browser', ['cookie: random id', 'HttpOnly, Secure'], 'none'),
      box('a', C2, 60, W, 'Express', ['express-session'], 'new'),
      box('r', C3, 60, W, 'Redis', ['s8Hq… → userId 7', 'TTL 30 min'], 'ok'),
      box('u', C2, 170, W, 'req.session.userId', ['7'], 'ok'),
    ],
    arrows: [{ from: 'b', to: 'a', fs: 'r', ts: 'l' }, { from: 'a', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'a', to: 'u', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'With a server-side session, the browser holds only a random id in a cookie. Each request looks the id up in Redis. JavaScript cannot read the cookie, because it is HttpOnly.',
  },
  {
    h: 250,
    line: 'req.session.regenerate() at login',
    result: { text: 'fixation blocked', tone: 'ok' },
    cards: [
      box('a', C1, 44, W, 'attacker plants', ['sid = known-123'], 'bad'),
      box('l', C2, 44, W, 'victim logs in', ['old id dropped'], 'ok'),
      box('n', C3, 44, W, 'new session id', ['sid = x9Fv…'], 'new'),
      box('d', C2, 160, 396, 'logout or ban: delete the Redis record', ['the next request fails at once'], 'warn'),
    ],
    arrows: [{ from: 'a', to: 'l', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'l', to: 'n', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Session fixation plants a known id before login. A fresh id at login defeats it. Sessions are also easy to revoke: delete the record, and the user is logged out everywhere.',
  },
  {
    h: 250,
    line: 'Authorization: Bearer eyJ…',
    result: { text: 'verified with no database call', tone: 'ok' },
    cards: [
      box('t', C1, 44, W, 'access token', ['sub: 7', 'roles: [user]', 'exp: +10 min'], 'new'),
      box('v', C2, 44, W, 'jwtVerify', ['signature, alg', 'iss, aud, exp'], 'ok'),
      box('k', C3, 44, W, 'public key', ['from JWKS, cached'], 'none'),
      box('e', C1, 170, 612, 'cannot be revoked before exp', ['so keep it short: 5 to 15 minutes'], 'warn'),
    ],
    arrows: [{ from: 't', to: 'v', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'k', to: 'v', fs: 'l', ts: 'r' }],
    note: 'A JWT carries signed claims. Any service with the public key can check it, with no database call. The catch: nothing can cancel it before it expires, so it must be short-lived.',
  },
  {
    h: 250,
    line: 'browser → BFF → APIs',
    result: { text: 'tokens never reach browser JS', tone: 'ok' },
    cards: [
      box('b', C1, 80, W, 'browser', ['session cookie only'], 'none'),
      box('f', C2, 80, W, 'BFF (Node.js)', ['holds access and', 'refresh tokens'], 'new', { badge: 'server side' }),
      box('a', C3, 44, W, 'accounts API', ['verifies the JWT'], 'ok'),
      box('p', C3, 140, W, 'payments API', ['verifies the JWT'], 'ok'),
    ],
    arrows: [{ from: 'b', to: 'f', fs: 'r', ts: 'l' }, { from: 'f', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'f', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Choose by need. One web app fits sessions. Many services, mobile apps and partners fit short tokens with refresh. A backend for frontend (BFF) combines both: a cookie for the browser, and tokens between servers.',
  },
];

/* ---------- refresh token rotation ---------- */
const tok = (id, x, title, state, tone, o = {}) => box(id, x, 70, 150, title, [state], tone, o);

const refreshFrames = [
  {
    h: 230,
    line: 'POST /auth/refresh   (access token expired)',
    result: { text: 'new access token for 10 min', tone: 'ok' },
    cards: [
      box('c', C1, 60, W, 'client', ['401 from the API', 'sends refresh token'], 'warn'),
      box('s', C2, 60, W, 'refresh endpoint', ['find sha256(token)', 'active? not expired?'], 'new'),
      box('n', C3, 60, W, 'new access token', ['exp: +10 min'], 'ok'),
    ],
    arrows: [{ from: 'c', to: 's', fs: 'r', ts: 'l', tone: 'warn' }, { from: 's', to: 'n', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The access token is short-lived. When it expires, the client sends its refresh token: a long random string. The server stores only its hash, checks it is active, and issues a new access token.',
  },
  {
    h: 230,
    line: 'every refresh rotates',
    result: { text: 'each token works once', tone: 'ok' },
    regions: [{ x: 6, y: 34, w: 620, h: 110, title: 'family f-81 (one login)' }],
    cards: [tok('r1', 18, 'refresh token 1', 'used', 'none', { dim: true }), tok('r2', 236, 'refresh token 2', 'used', 'none', { dim: true }), tok('r3', 454, 'refresh token 3', 'active', 'ok')],
    arrows: [{ from: 'r1', to: 'r2', fs: 'r', ts: 'l' }, { from: 'r2', to: 'r3', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Each refresh also returns a new refresh token, and marks the old one as used. All tokens from one login share a family id.',
  },
  {
    h: 260,
    line: 'refresh token 1 shows up again',
    result: { text: 'reuse: revoke the whole family', tone: 'bad' },
    regions: [{ x: 6, y: 34, w: 620, h: 110, title: 'family f-81 (one login)', tone: 'bad' }],
    cards: [
      tok('r1', 18, 'refresh token 1', 'presented again', 'bad', { badge: 'reuse' }),
      tok('r2', 236, 'refresh token 2', 'revoked', 'bad'),
      tok('r3', 454, 'refresh token 3', 'revoked', 'bad'),
      box('l', 168, 180, 300, 'user and thief both logged out', ['the user signs in again'], 'warn'),
    ],
    note: 'A used token coming back means someone has a stolen copy, and the server cannot tell who. So it revokes the whole family. The real user signs in again, and the stolen token is dead.',
  },
];

/* ---------- defence in depth ---------- */
const defenceFrames = [
  {
    h: 250,
    line: '5,000 logins from leaked password lists',
    result: { text: 'throttled, not locked out', tone: 'ok' },
    cards: [
      box('a', C1, 60, W, 'credential stuffing', ['many IPs', 'many accounts'], 'bad'),
      box('r', C2, 60, W, 'rate limit + delay', ['per IP and per account', 'growing delays'], 'new'),
      box('b', C3, 60, W, 'breached-password check', ['at registration', 'and password change'], 'ok'),
      box('x', C2, 170, 396, 'avoid hard lockout', ['an attacker could lock out real users'], 'warn'),
    ],
    arrows: [{ from: 'a', to: 'r', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Credential stuffing tries passwords leaked from other sites. Rate limits per IP and per account slow it down. Reject known breached passwords. Prefer delays and alerts to hard lockout, which an attacker can abuse.',
  },
  {
    h: 230,
    line: 'POST /transfers  { amount: 9000 }',
    result: { text: 'step-up: prove it again', tone: 'warn' },
    cards: [
      box('p', C1, 60, W, 'password', ['first factor'], 'ok'),
      box('t', C2, 60, W, 'TOTP or passkey', ['second factor'], 'ok'),
      box('s', C3, 60, W, 'large transfer', ['authTime too old', 'ask for a fresh factor'], 'warn', { badge: 'step-up' }),
    ],
    arrows: [{ from: 'p', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 's', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A second factor means a stolen password is not enough. Passkeys are best, because they resist phishing. Risky actions, such as a large transfer or a new payee, ask for a fresh factor again. This is step-up authentication.',
  },
  {
    h: 230,
    line: 'POST /auth/forgot',
    result: { text: 'same reply either way', tone: 'ok' },
    cards: [
      box('t', C1, 60, W, 'reset token', ['randomBytes(32)', 'hash stored, 30 min'], 'new'),
      box('m', C2, 60, W, 'email link', ['token in #fragment', 'single use'], 'ok'),
      box('g', C3, 60, W, '202', ['"If that email exists,', 'we sent a link"'], 'ok'),
    ],
    arrows: [{ from: 't', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Reset is a second way to log in, so it gets the same care. The token is random, stored as a hash, short-lived and single-use. The reply never reveals whether the email exists. After a reset, revoke every session.',
  },
  {
    h: 230,
    line: 'audit("login_failed", { requestId })',
    result: { text: 'events logged, secrets never', tone: 'ok' },
    cards: [
      box('e', C1, 60, W, 'auth events', ['login, reset, MFA,', 'refresh reuse'], 'new'),
      box('l', C2, 60, W, 'structured audit log', ['ids and request ids', 'no passwords, no tokens'], 'ok'),
      box('a', C3, 60, W, 'alerts', ['failure spikes', 'new devices'], 'warn'),
    ],
    arrows: [{ from: 'e', to: 'l', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'l', to: 'a', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Log every authentication event with the request id. Never log passwords or tokens. Alert on spikes of failures and on new devices. These logs are how a breach gets found.',
  },
];

export const AUTH_NODE_SCENES = [
  { id: 'password', label: 'Passwords and login', title: 'Store a slow salted hash, answer generically', stage: BoardStage, frames: passwordFrames },
  { id: 'session', label: 'Session or token', title: 'Where the proof of login lives', stage: BoardStage, frames: sessionFrames },
  { id: 'refresh', label: 'Refresh token rotation', title: 'Short access, rotating refresh, reuse detected', stage: BoardStage, frames: refreshFrames },
  { id: 'defence', label: 'Defence in depth', title: 'Layers around the login', stage: BoardStage, frames: defenceFrames },
];
