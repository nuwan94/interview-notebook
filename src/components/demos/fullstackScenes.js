// Frame data for the "Full-stack integration" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const FULLSTACK_SCENES = [
  {
    id: 'architecture',
    label: 'The big picture',
    title: 'Browser, edge, API and database',
    frames: [
      {
        note: 'A typical full-stack app has three tiers. The React app runs in the browser. An Express API holds the business rules and checks every request. A database stores the data. The browser never talks to the database, because the API is the only trusted place to enforce rules.',
        boxes: [b('b', 'React app', ['runs in the browser'], 'new'), b('a', 'Express API', ['rules, auth, validation'], 'ok'), b('d', 'PostgreSQL', ['the source of truth'], 'ok')],
        deps: [d('React app', 'Express API', 'JSON over HTTPS', 'ok'), d('Express API', 'PostgreSQL', 'SQL, pooled', 'ok')],
      },
      {
        note: 'The built React app is just static files: HTML, JavaScript and CSS. Serve them from a CDN or object storage, with long caching because the file names contain a hash. Only the API needs servers. A reverse proxy routes /api to the API and everything else to the static files.',
        boxes: [b('u', 'User browser', ['loads the app once'], 'none'), b('c', 'CDN + static files', ['hashed names, cached'], 'ok'), b('p', 'Reverse proxy', ['/api goes to the API'], 'new'), b('a', 'Express API', ['containers, scaled'], 'ok')],
        deps: [d('User browser', 'CDN + static files', 'GET /', 'ok'), d('User browser', 'Reverse proxy', 'GET /api/...', 'ok'), d('Reverse proxy', 'Express API', 'forwards', 'ok')],
      },
      {
        note: 'Serving the app and the API from the same origin avoids CORS and lets cookies work simply. If they are on different origins (app.bank.com and api.bank.com) the API must send CORS headers, and cookies need SameSite and credentials settings. In development, the Vite dev server proxies /api to the local API so it looks like one origin.',
        boxes: [b('s', 'Same origin', ['no CORS, simple cookies'], 'ok'), b('x', 'Different origins', ['CORS + credentials'], 'warn'), b('v', 'Vite dev proxy', ['/api to localhost:3000'], 'new')],
        deps: [d('Vite dev proxy', 'Same origin', 'makes dev like prod', 'ok')],
      },
    ],
  },
  {
    id: 'login',
    label: 'Login and sessions',
    title: 'Authorization code with PKCE',
    frames: [
      {
        note: 'The SPA does not collect passwords. It redirects the user to the identity provider with a code challenge (PKCE). The user signs in there, with multi-factor authentication if required, and the provider redirects back to the app with a one-time authorization code.',
        boxes: [b('a', 'React app', ['redirect with code challenge'], 'new'), b('i', 'Identity provider', ['login + MFA'], 'ok'), b('c', 'Authorization code', ['one-time, short-lived'], 'warn')],
        deps: [d('React app', 'Identity provider', 'authorize request', 'ok'), d('Identity provider', 'Authorization code', 'redirects back with', 'warn')],
      },
      {
        note: 'The code is exchanged for tokens together with the PKCE verifier. The safest pattern for a bank is a backend for frontend: the API does the exchange, keeps the tokens on the server, and gives the browser only an httpOnly, Secure, SameSite session cookie. JavaScript cannot read that cookie, so an XSS bug cannot steal it.',
        boxes: [b('b', 'BFF / API', ['exchanges the code'], 'new'), b('t', 'Tokens on the server', ['never in the browser'], 'ok'), b('s', 'Session cookie', ['httpOnly, Secure, SameSite'], 'ok')],
        deps: [d('BFF / API', 'Tokens on the server', 'stores', 'ok'), d('BFF / API', 'Session cookie', 'sets', 'ok')],
      },
      {
        note: 'If the app keeps the access token itself, hold it in memory only, not in localStorage, which any injected script can read. Keep it short-lived, and renew it with a refresh token in an httpOnly cookie. When a call returns 401, refresh once, retry the call, and log the user out if the refresh fails.',
        boxes: [b('r', 'API call', ['access token in memory'], 'none'), b('u', '401 Unauthorized', ['token expired'], 'bad'), b('f', 'Refresh and retry', ['one attempt only'], 'new')],
        deps: [d('API call', '401 Unauthorized', 'rejected', 'bad'), d('401 Unauthorized', 'Refresh and retry', 'then', 'ok')],
      },
    ],
  },
  {
    id: 'transfer',
    label: 'One feature end to end',
    title: 'Sending a transfer',
    frames: [
      {
        note: 'The transfer form validates with a schema that both the browser and the server import from a shared package. The browser gives instant feedback, and the server runs the same check again, because a client can never be trusted. One schema also gives both sides the same TypeScript type.',
        boxes: [b('f', 'Transfer form', ['amount, account'], 'none'), b('s', 'Shared schema', ['zod, one source'], 'new'), b('e', 'Field errors', ['shown before sending'], 'warn')],
        deps: [d('Transfer form', 'Shared schema', 'validated by', 'ok'), d('Shared schema', 'Field errors', 'invalid', 'warn')],
      },
      {
        note: 'A mutation sends POST /transfers with an Idempotency-Key created when the form opened. If the network drops and the user clicks again, the same key makes the server return the first result instead of moving money twice. The button is disabled while the request is pending.',
        boxes: [b('m', 'useMutation', ['sends the request'], 'new'), b('k', 'Idempotency-Key', ['same key on retry'], 'ok'), b('a', 'POST /transfers', ['to the API'], 'ok')],
        deps: [d('useMutation', 'POST /transfers', 'JSON body', 'ok'), d('Idempotency-Key', 'POST /transfers', 'header', 'ok')],
      },
      {
        note: 'On the server the request passes authentication and validation, then the service opens one database transaction: it checks the balance, writes both ledger entries and stores the idempotency key. Either all of it commits or none of it does. The response is 201 with the new transfer.',
        boxes: [b('v', 'Auth + validation', ['who, and is it valid'], 'ok'), b('t', 'Service transaction', ['check, debit, credit, key'], 'new'), b('d', 'Ledger tables', ['commit or roll back'], 'ok')],
        deps: [d('Auth + validation', 'Service transaction', 'then', 'ok'), d('Service transaction', 'Ledger tables', 'one transaction', 'ok')],
      },
      {
        note: 'On success the client invalidates the accounts and transactions queries, so the balance and the history refetch and the screen shows the real server state. An error maps to a message by its code: 422 insufficient funds shows on the amount field, 409 duplicate says it was already sent, a network failure offers retry.',
        boxes: [b('r', '201 Created', ['transfer saved'], 'ok'), b('i', 'Invalidate queries', ['accounts, history'], 'new'), b('u', 'Updated screen', ['server state shown'], 'ok')],
        deps: [d('201 Created', 'Invalidate queries', 'onSuccess', 'ok'), d('Invalidate queries', 'Updated screen', 'refetch', 'ok')],
      },
    ],
  },
  {
    id: 'ship',
    label: 'Build and deploy',
    title: 'From commit to production',
    frames: [
      {
        note: 'Each push runs the pipeline: install with a frozen lockfile, lint, type-check the whole workspace, run unit and component tests, build the SPA and the API, and run a few end-to-end tests against a preview. A failure at any step stops the release.',
        boxes: [b('c', 'Git push', ['pull request'], 'none'), b('p', 'CI pipeline', ['lint, types, tests, build'], 'new'), b('e', 'End-to-end smoke', ['login and transfer'], 'ok')],
        deps: [d('Git push', 'CI pipeline', 'triggers', 'ok'), d('CI pipeline', 'End-to-end smoke', 'then', 'ok')],
      },
      {
        note: 'The two halves ship differently. The API becomes a container image from a multi-stage Dockerfile and is rolled out gradually with health checks. The SPA is uploaded to object storage with hashed file names and index.html set to no-cache, then the CDN is invalidated for index.html only.',
        boxes: [b('i', 'API image', ['multi-stage Docker build'], 'ok'), b('r', 'Rolling deploy', ['readiness checks'], 'new'), b('s', 'SPA to the CDN', ['hashed files, new index.html'], 'ok')],
        deps: [d('API image', 'Rolling deploy', 'deployed by', 'ok')],
      },
      {
        note: 'Database changes need care because old and new API versions run together during a rollout. Use the expand and contract pattern: first add the new column, deploy code that works with both, then remove the old column in a later release. Run migrations as a separate step, never at random on app start.',
        boxes: [b('x', 'Expand', ['add a nullable column'], 'ok'), b('m', 'Deploy both versions', ['code works with either'], 'new'), b('k', 'Contract', ['drop the old column later'], 'warn')],
        deps: [d('Expand', 'Deploy both versions', 'then', 'ok'), d('Deploy both versions', 'Contract', 'then', 'ok')],
      },
    ],
  },
];
