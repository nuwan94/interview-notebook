// Frame data for the OAuth 2.0 walk-through (box-and-arrow player shared with the other walks).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const OAUTH_SCENES = [
  {
    id: 'code',
    label: 'Authorization code + PKCE',
    title: 'Authorization code flow with PKCE: the flow for web, SPA and mobile apps',
    frames: [
      {
        note: 'A print app (the client) wants to read Alice\'s photos. First it creates a random secret called the code verifier and keeps it. It sends only a hash of it, the code challenge, to the authorization server.',
        boxes: [b('c', 'Client (print app)', ['code_verifier: random secret (kept)', 'code_challenge = SHA-256(verifier)'], 'new', 'PKCE'), b('u', 'Alice (browser)', ['clicks "connect photos"'], 'ok'), b('as', 'Authorization server', ['not involved yet'], 'none')],
        deps: [],
      },
      {
        note: 'The app redirects Alice\'s browser to the authorization endpoint with its client_id, redirect_uri, the requested scope, a random state value and the code challenge.',
        boxes: [b('u', 'Alice (browser)', ['GET /authorize', 'client_id, redirect_uri', 'scope=photos.read', 'state=xyz, code_challenge'], 'ok'), b('as', 'Authorization server', ['checks client_id and redirect_uri'], 'ok')],
        deps: [d('Client', 'Authorization server', 'redirect via the browser', 'ok')],
      },
      {
        note: 'Alice logs in at the authorization server (the app never sees her password) and approves the requested scope on the consent screen.',
        boxes: [b('u', 'Alice (browser)', ['logs in', 'approves photos.read'], 'new', 'consent'), b('as', 'Authorization server', ['authenticates Alice', 'remembers the code_challenge'], 'ok')],
        deps: [d('Alice', 'Authorization server', 'login + consent', 'ok')],
      },
      {
        note: 'The server redirects back to the app with a one-time authorization code and the same state. The app checks that state matches (protects against CSRF). The code alone is useless: it is short-lived and single use.',
        boxes: [b('c', 'Client (print app)', ['received code=abc', 'state matches'], 'ok'), b('as', 'Authorization server', ['code=abc bound to the challenge'], 'ok')],
        deps: [d('Authorization server', 'Client', '302 redirect_uri?code=abc&state=xyz', 'ok')],
      },
      {
        note: 'The app calls the token endpoint directly (back channel) with the code and the original code_verifier. The server hashes the verifier and compares it with the stored challenge, proving the same app that started the flow is finishing it.',
        boxes: [b('c', 'Client (print app)', ['code=abc', 'code_verifier'], 'new'), b('as', 'Authorization server', ['SHA-256(verifier) == challenge: match'], 'ok', 'PKCE verified')],
        deps: [d('Client', 'Authorization server', 'POST /token (code + code_verifier)', 'ok')],
      },
      {
        note: 'The server returns an access token (minutes) and usually a refresh token. The app calls the photo API with the access token in the Authorization header.',
        boxes: [b('c', 'Client (print app)', ['access token', 'refresh token'], 'ok', 'tokens'), b('rs', 'Photo API (resource server)', ['validates the token and its scope', 'scope photos.read: 200 OK'], 'ok')],
        deps: [d('Authorization server', 'Client', 'access_token + refresh_token', 'ok'), d('Client', 'Photo API', 'GET /photos  Bearer access_token', 'ok')],
      },
      {
        note: 'Why PKCE: an attacker who steals the authorization code from the redirect (for example through a malicious app on the phone) cannot redeem it, because they do not have the code verifier.',
        boxes: [b('m', 'Attacker', ['stole code=abc', 'no code_verifier'], 'bad'), b('as', 'Authorization server', ['verifier missing or wrong'], 'bad', 'invalid_grant')],
        deps: [d('Attacker', 'Authorization server', 'POST /token (code only)', 'bad')],
      },
    ],
  },
  {
    id: 'client-credentials',
    label: 'Client credentials',
    title: 'Client credentials: one service calling another, no user involved',
    frames: [
      {
        note: 'A nightly reporting job needs to call the billing API. There is no user, the job itself is the principal. It was registered with the authorization server and has a client id and a secret (or better, a certificate).',
        boxes: [b('c', 'Reporting job (client)', ['client_id, client_secret'], 'ok'), b('as', 'Authorization server', ['knows the job and its allowed scopes'], 'ok'), b('rs', 'Billing API', ['protected'], 'ok')],
        deps: [],
      },
      {
        note: 'The job authenticates to the token endpoint and asks for a token with a scope. The server checks the credentials and the scope the job is allowed.',
        boxes: [b('c', 'Reporting job (client)', ['grant_type=client_credentials', 'scope=invoices.read'], 'new'), b('as', 'Authorization server', ['authenticates the client'], 'ok')],
        deps: [d('Reporting job', 'Authorization server', 'POST /token', 'ok')],
      },
      {
        note: 'It receives an access token that represents the job itself (its subject is the client id, not a person). There is normally no refresh token: the job just asks again.',
        boxes: [b('c', 'Reporting job (client)', ['access token (subject = the job)'], 'ok', 'token'), b('as', 'Authorization server', ['issued token'], 'ok')],
        deps: [d('Authorization server', 'Reporting job', 'access_token', 'ok')],
      },
      {
        note: 'The job calls the API with the token. The API validates the signature, audience, expiry and scope, then serves the request. This is the standard way for microservices to authenticate to each other.',
        boxes: [b('c', 'Reporting job (client)', ['Bearer access token'], 'ok'), b('rs', 'Billing API', ['audience ok, scope invoices.read ok', 'GET /invoices: 200', 'DELETE /invoices: 403'], 'ok', 'validated')],
        deps: [d('Reporting job', 'Billing API', 'GET /invoices', 'ok'), d('Reporting job', 'Billing API', 'DELETE /invoices/9', 'bad')],
      },
    ],
  },
  {
    id: 'refresh',
    label: 'Refresh token',
    title: 'Refresh tokens: short access tokens without logging in again',
    frames: [
      {
        note: 'The access token is valid for only a few minutes, so a leaked one is not useful for long. The app holds a longer-lived refresh token.',
        boxes: [b('c', 'Client app', ['access token (expires in 5 min)', 'refresh token RT1'], 'ok'), b('as', 'Authorization server', ['tracks RT1'], 'ok'), b('rs', 'API', ['protected'], 'ok')],
        deps: [],
      },
      {
        note: 'Later the access token has expired. The API answers 401 and the app knows it must refresh.',
        boxes: [b('c', 'Client app', ['access token expired', 'refresh token RT1'], 'warn'), b('rs', 'API', ['token expired'], 'bad', '401')],
        deps: [d('Client app', 'API', 'GET /photos  (expired token)', 'bad')],
      },
      {
        note: 'The app sends the refresh token to the token endpoint. The server issues a new access token and, with rotation, a new refresh token RT2 while invalidating RT1.',
        boxes: [b('c', 'Client app', ['new access token', 'refresh token RT2'], 'new', 'rotated'), b('as', 'Authorization server', ['RT1 invalidated', 'RT2 issued'], 'ok')],
        deps: [d('Client app', 'Authorization server', 'POST /token (refresh_token=RT1)', 'ok'), d('Authorization server', 'Client app', 'new tokens', 'ok')],
      },
      {
        note: 'If an attacker who stole RT1 tries to use it after the real app has rotated, the server sees an already-used refresh token, treats it as theft and revokes the whole token family, forcing a fresh login.',
        boxes: [b('m', 'Attacker', ['stolen RT1 (already used)'], 'bad'), b('as', 'Authorization server', ['reuse detected', 'revokes RT2 as well'], 'bad', 'family revoked')],
        deps: [d('Attacker', 'Authorization server', 'POST /token (refresh_token=RT1)', 'bad')],
      },
    ],
  },
];
