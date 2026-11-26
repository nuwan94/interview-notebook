// Frame data for the "Full-stack integration" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- the big picture ---------- */
const architectureFrames = [
  {
    h: 250,
    line: 'three tiers',
    result: { text: 'the API is the only trusted place', tone: 'ok' },
    cards: [
      box('b', C1, 70, W, 'React app', ['runs in the browser'], 'new'),
      box('a', C2, 70, W, 'Express API', ['rules, auth,', 'validation'], 'ok'),
      box('d', C3, 70, W, 'PostgreSQL', ['the source of truth'], 'ok'),
      box('x', C1, 180, 612, 'the browser never talks to the database', ['everything it sends can be forged, so the API checks every request'], 'none'),
    ],
    arrows: [{ from: 'b', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'a', to: 'd', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The React app calls the API with JSON over HTTPS. The API talks to the database with pooled SQL.',
  },
  {
    h: 270,
    line: 'static files plus an API',
    result: { text: 'a proxy routes /api to the API', tone: 'ok' },
    cards: [
      box('u', C1, 40, W, 'user browser', ['loads the app once'], 'none'),
      box('c', C2, 40, W, 'CDN + static files', ['hashed names,', 'long cache'], 'ok'),
      box('p', C1, 160, W, 'reverse proxy', ['/api goes to', 'the API'], 'new'),
      box('a', C2, 160, W, 'Express API', ['containers, scaled'], 'ok'),
    ],
    arrows: [{ from: 'u', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'u', to: 'p', fs: 'b', ts: 't', tone: 'ok' }, { from: 'p', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The built React app is only static files. Serve them from a CDN. Only the API needs servers.',
  },
  {
    h: 250,
    line: 'one origin or two',
    result: { text: 'prefer one origin behind a proxy', tone: 'ok' },
    cards: [
      box('s', C1, 70, W, 'same origin', ['no CORS,', 'simple cookies'], 'ok'),
      box('x', C2, 70, W, 'different origins', ['CORS and', 'credentials'], 'warn'),
      box('v', C3, 70, W, 'Vite dev proxy', ['/api to', 'localhost:3000'], 'new'),
      box('n', C1, 180, 612, 'the dev proxy makes development behave like production', ['two origins need CORS headers and SameSite cookie settings'], 'none'),
    ],
    note: 'Serving the app and the API from the same origin avoids CORS. In development, the Vite dev server proxies /api to the local API.',
  },
];

/* ---------- login and sessions ---------- */
const loginFrames = [
  {
    h: 250,
    line: 'authorization code with PKCE',
    result: { text: 'the SPA never sees the password', tone: 'ok' },
    cards: [
      box('a', C1, 70, W, 'React app', ['redirect with a', 'code challenge'], 'new'),
      box('i', C2, 70, W, 'identity provider', ['login and MFA'], 'ok'),
      box('c', C3, 70, W, 'authorization code', ['one-time,', 'short-lived'], 'warn'),
      box('x', C1, 180, 612, 'the user signs in at the provider, then it redirects back', ['a stolen code is useless without the PKCE verifier'], 'none'),
    ],
    arrows: [{ from: 'a', to: 'i', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i', to: 'c', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'The SPA redirects the user to the identity provider. The provider redirects back with a one-time authorization code.',
  },
  {
    h: 250,
    line: 'backend for frontend (BFF)',
    result: { text: 'tokens stay on the server', tone: 'ok' },
    cards: [
      box('b', C1, 70, W, 'BFF / API', ['exchanges the code'], 'new'),
      box('t', C2, 70, W, 'tokens on the server', ['never in the', 'browser'], 'ok'),
      box('s', C3, 70, W, 'session cookie', ['httpOnly, Secure,', 'SameSite'], 'ok'),
      box('x', C1, 180, 612, 'JavaScript cannot read an httpOnly cookie', ['so an XSS bug cannot steal the session'], 'none'),
    ],
    arrows: [{ from: 'b', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The safest pattern for a bank: the API does the code exchange and gives the browser only a session cookie.',
  },
  {
    h: 250,
    line: 'a 401 on an API call',
    result: { text: 'refresh once, retry once', tone: 'ok' },
    cards: [
      box('r', C1, 70, W, 'API call', ['access token', 'in memory'], 'none'),
      box('u', C2, 70, W, '401 Unauthorized', ['the token expired'], 'bad'),
      box('f', C3, 70, W, 'refresh and retry', ['one attempt only'], 'new'),
      box('x', C1, 180, 612, 'if the refresh fails, send the user to log in', ['share one refresh between many failing calls'], 'none'),
    ],
    arrows: [{ from: 'r', to: 'u', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'u', to: 'f', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'If the app holds the token itself, keep it in memory, never in localStorage. When a call returns 401, refresh once and retry.',
  },
];

/* ---------- one feature end to end ---------- */
const transferFrames = [
  {
    h: 250,
    line: 'validate on both sides',
    result: { text: 'one schema, two checks', tone: 'ok' },
    cards: [
      box('f', C1, 70, W, 'transfer form', ['amount, account'], 'none'),
      box('s', C2, 70, W, 'shared schema', ['zod, one source'], 'new'),
      box('e', C3, 70, W, 'field errors', ['shown before', 'sending'], 'warn'),
      box('x', C1, 180, 612, 'the browser gives instant feedback, the server checks again', ['a client can never be trusted'], 'none'),
    ],
    arrows: [{ from: 'f', to: 's', fs: 'r', ts: 'l', tone: 'ok' }, { from: 's', to: 'e', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Both the browser and the server import the same schema. One schema also gives both sides the same TypeScript type.',
  },
  {
    h: 250,
    line: 'POST /transfers',
    result: { text: 'a retry cannot move money twice', tone: 'ok' },
    cards: [
      box('m', C1, 70, W, 'useMutation', ['sends the request'], 'new'),
      box('k', C2, 70, W, 'Idempotency-Key', ['same key on', 'every retry'], 'ok'),
      box('a', C3, 70, W, 'POST /transfers', ['to the API'], 'ok'),
      box('x', C1, 180, 612, 'the key is created when the form opens', ['the button is disabled while the request is pending'], 'none'),
    ],
    arrows: [{ from: 'm', to: 'k', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'k', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'If the network drops and the user clicks again, the same key makes the server return the first result.',
  },
  {
    h: 250,
    line: 'one database transaction',
    result: { text: 'all of it commits, or none of it', tone: 'ok' },
    cards: [
      box('v', C1, 70, W, 'auth + validation', ['who, and is it', 'valid'], 'ok'),
      box('t', C2, 70, W, 'service transaction', ['check, debit,', 'credit, key'], 'new'),
      box('d', C3, 70, W, 'ledger tables', ['commit or roll back'], 'ok'),
      box('x', C1, 180, 612, 'a row lock stops two transfers from overdrawing the account', ['the response is 201 with the new transfer'], 'none'),
    ],
    arrows: [{ from: 'v', to: 't', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 'd', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The service checks the balance, writes both ledger entries and stores the idempotency key, in one transaction.',
  },
  {
    h: 250,
    line: 'on success, refetch',
    result: { text: 'the screen shows real server state', tone: 'ok' },
    cards: [
      box('r', C1, 70, W, '201 Created', ['the transfer', 'is saved'], 'ok'),
      box('i', C2, 70, W, 'invalidate queries', ['accounts, history'], 'new'),
      box('u', C3, 70, W, 'updated screen', ['server state shown'], 'ok'),
      box('x', C1, 180, 612, 'errors map by code: 422 on the amount field, 409 "already sent"', ['a network failure offers a retry with the same key'], 'none'),
    ],
    arrows: [{ from: 'r', to: 'i', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i', to: 'u', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The client invalidates the accounts and transactions queries, so the balance and history refetch.',
  },
];

/* ---------- build and deploy ---------- */
const shipFrames = [
  {
    h: 250,
    line: 'each push runs the pipeline',
    result: { text: 'a failure at any step stops the release', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'git push', ['a pull request'], 'none'),
      box('p', C2, 70, W, 'CI pipeline', ['lint, types,', 'tests, build'], 'new'),
      box('e', C3, 70, W, 'end-to-end smoke', ['login and transfer'], 'ok'),
      box('x', C1, 180, 612, 'install with a frozen lockfile, check every workspace', ['the end-to-end tests run against a preview environment'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'p', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'p', to: 'e', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The pipeline lints, type-checks, tests and builds both the SPA and the API.',
  },
  {
    h: 250,
    line: 'the two halves ship separately',
    result: { text: 'a container and static files', tone: 'ok' },
    cards: [
      box('i', C1, 70, W, 'API image', ['multi-stage', 'Docker build'], 'ok'),
      box('r', C2, 70, W, 'rolling deploy', ['readiness checks'], 'new'),
      box('s', C3, 70, W, 'SPA to the CDN', ['hashed files,', 'new index.html'], 'ok'),
      box('x', C1, 180, 612, 'index.html is set to no-cache, and only it is invalidated on the CDN', ['keep the old hashed files for a while'], 'none'),
    ],
    arrows: [{ from: 'i', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The API rolls out gradually behind health checks. The SPA is uploaded with hashed file names, and index.html last.',
  },
  {
    h: 250,
    line: 'expand and contract',
    result: { text: 'old and new versions run together', tone: 'ok' },
    cards: [
      box('x', C1, 70, W, 'expand', ['add a nullable', 'column'], 'ok'),
      box('m', C2, 70, W, 'deploy both versions', ['code works with', 'either'], 'new'),
      box('k', C3, 70, W, 'contract', ['drop the old column', 'later'], 'warn'),
      box('n', C1, 180, 612, 'run migrations as a separate pipeline step', ['never at random on app start, where ten instances could run it'], 'none'),
    ],
    arrows: [{ from: 'x', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 'k', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'During a rollout, old and new API versions run together. So database changes go in small, compatible steps.',
  },
];

export const FULLSTACK_SCENES = [
  { id: 'architecture', label: 'The big picture', title: 'Browser, edge, API and database', stage: BoardStage, frames: architectureFrames },
  { id: 'login', label: 'Login and sessions', title: 'Authorization code with PKCE', stage: BoardStage, frames: loginFrames },
  { id: 'transfer', label: 'One feature end to end', title: 'Sending a transfer', stage: BoardStage, frames: transferFrames },
  { id: 'ship', label: 'Build and deploy', title: 'From commit to production', stage: BoardStage, frames: shipFrames },
];
