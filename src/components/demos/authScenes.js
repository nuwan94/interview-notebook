// Frame data for the authentication / authorization walk-through (same box-and-arrow player as the other walks).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const AUTH_SCENES = [
  {
    id: 'authn-authz',
    label: 'AuthN vs AuthZ',
    title: 'Authentication asks "who are you?", authorization asks "what may you do?"',
    frames: [
      {
        note: 'Alice sends a request to read a report. The server does not know her yet, so the first step is authentication: proving identity.',
        boxes: [b('a', 'Alice', ['request: GET /reports/42'], 'ok'), b('s', 'Server', ['identity: unknown'], 'warn')],
        deps: [d('Alice', 'Server', 'GET /reports/42', 'ok')],
      },
      {
        note: 'Alice presents a credential (a password, a token, a certificate). The server checks it and learns who she is. A failure here is 401 Unauthorized, which really means "unauthenticated".',
        boxes: [b('a', 'Alice', ['credential: password + one-time code'], 'new'), b('s', 'Server', ['identity: alice', 'authenticated'], 'ok', 'authN passed')],
        deps: [d('Alice', 'Server', 'credential', 'ok'), d('Server', 'Alice', 'identity confirmed', 'ok')],
      },
      {
        note: 'Now authorization: may alice read report 42? The server checks roles, permissions or policies attached to her identity and to the resource.',
        boxes: [b('a', 'Alice', ['role: analyst'], 'ok'), b('p', 'Policy', ['analyst can read reports', 'only admin can delete'], 'new'), b('s', 'Server', ['decision: allow read'], 'ok', 'authZ passed')],
        deps: [d('Server', 'Policy', 'can alice read /reports/42?', 'ok'), d('Policy', 'Server', 'yes', 'ok')],
      },
      {
        note: 'The same authenticated Alice tries to delete the report. Her identity is fine but she lacks the permission, so the answer is 403 Forbidden. Different failure, different status code.',
        boxes: [b('a', 'Alice', ['role: analyst', 'DELETE /reports/42'], 'warn'), b('p', 'Policy', ['only admin can delete'], 'new'), b('s', 'Server', ['decision: deny'], 'bad', '403 Forbidden')],
        deps: [d('Server', 'Policy', 'can alice delete /reports/42?', 'ok'), d('Policy', 'Server', 'no', 'bad')],
      },
    ],
  },
  {
    id: 'session',
    label: 'Session cookie',
    title: 'Server-side session: the server remembers you',
    frames: [
      {
        note: 'Alice logs in with her password. The server verifies it against the stored password hash.',
        boxes: [b('b', 'Browser', ['username + password'], 'ok'), b('s', 'Server', ['verifies password hash'], 'ok'), b('st', 'Session store', ['empty'], 'none')],
        deps: [d('Browser', 'Server', 'POST /login', 'ok')],
      },
      {
        note: 'The server creates a session record and a random, unguessable session id, and sends the id back in a cookie (HttpOnly, Secure, SameSite).',
        boxes: [b('b', 'Browser', ['cookie: SID=f81c...'], 'new', 'cookie'), b('s', 'Server', ['created session'], 'ok'), b('st', 'Session store', ['f81c... -> alice, role analyst'], 'new', 'state')],
        deps: [d('Server', 'Session store', 'save session', 'ok'), d('Server', 'Browser', 'Set-Cookie: SID=f81c...', 'ok')],
      },
      {
        note: 'On every later request the browser sends the cookie automatically. The server looks the id up and knows who is calling.',
        boxes: [b('b', 'Browser', ['cookie: SID=f81c...'], 'ok'), b('s', 'Server', ['identity: alice'], 'ok'), b('st', 'Session store', ['f81c... -> alice'], 'ok')],
        deps: [d('Browser', 'Server', 'GET /reports (Cookie: SID)', 'ok'), d('Server', 'Session store', 'lookup f81c...', 'ok')],
      },
      {
        note: 'Logout or an admin revoking the session just deletes the record, so it takes effect immediately. The cost: the store is shared state, so many servers need a shared store (Redis, database) or sticky sessions, and cookies need CSRF protection.',
        boxes: [b('b', 'Browser', ['cookie: SID=f81c...'], 'warn'), b('s', 'Server', ['identity: unknown'], 'bad', '401'), b('st', 'Session store', ['f81c... deleted'], 'bad')],
        deps: [d('Server', 'Session store', 'delete f81c...', 'bad')],
      },
    ],
  },
  {
    id: 'token',
    label: 'Signed token',
    title: 'Self-contained token: the token carries the identity',
    frames: [
      {
        note: 'Alice logs in once with an identity provider (or the login endpoint of the API).',
        boxes: [b('c', 'Client', ['username + password'], 'ok'), b('i', 'Token issuer', ['holds a signing key'], 'ok')],
        deps: [d('Client', 'Token issuer', 'POST /login', 'ok')],
      },
      {
        note: 'The issuer returns a signed token that contains the claims: who she is, her roles, and an expiry. Because it is signed, nobody can change it without being detected.',
        boxes: [b('c', 'Client', ['token: eyJ...'], 'new', 'token'), b('i', 'Token issuer', ['sub: alice', 'roles: analyst', 'exp: in 15 minutes', 'signature'], 'ok')],
        deps: [d('Token issuer', 'Client', 'signed token', 'ok')],
      },
      {
        note: 'The client sends the token in the Authorization header. Any service holding the issuer public key (or shared secret) verifies the signature and reads the claims. No lookup, no shared session store.',
        boxes: [b('c', 'Client', ['Authorization: Bearer eyJ...'], 'ok'), b('s', 'API service', ['verifies signature', 'checks exp', 'identity: alice, roles: analyst'], 'ok', 'valid')],
        deps: [d('Client', 'API service', 'GET /reports', 'ok')],
      },
      {
        note: 'The trade-off: the service never asks the issuer, so a stolen token works until it expires and revoking it early needs extra work. That is why access tokens are short-lived and paired with refresh tokens.',
        boxes: [b('c', 'Attacker', ['stolen token'], 'bad', 'stolen'), b('s', 'API service', ['signature valid', 'not expired'], 'warn', 'accepted'), b('i', 'Token issuer', ['not consulted'], 'none')],
        deps: [d('Attacker', 'API service', 'replays the token', 'bad')],
      },
    ],
  },
  {
    id: 'delegation',
    label: 'Delegated access',
    title: 'OAuth 2.0 idea: let an app act for you without giving it your password',
    frames: [
      {
        note: 'A printing app wants to read Alice\'s photos stored at a photo service. Handing the app her photo-service password would give it everything, forever. OAuth avoids that.',
        boxes: [b('a', 'Alice (resource owner)', ['owns the photos'], 'ok'), b('app', 'Print app (client)', ['wants to read photos'], 'warn'), b('as', 'Authorization server', ['knows Alice'], 'ok'), b('rs', 'Photo API (resource server)', ['holds the photos'], 'ok')],
        deps: [],
      },
      {
        note: 'The app sends Alice to the authorization server. There she logs in (the app never sees the password) and approves a narrow permission: "read photos".',
        boxes: [b('a', 'Alice (resource owner)', ['logs in at the auth server', 'approves scope: photos.read'], 'new', 'consent'), b('app', 'Print app (client)', ['waiting'], 'none'), b('as', 'Authorization server', ['authenticates Alice', 'records consent'], 'ok')],
        deps: [d('Print app', 'Authorization server', 'redirect Alice here', 'ok'), d('Alice', 'Authorization server', 'login + approve', 'ok')],
      },
      {
        note: 'The authorization server gives the app a short-lived access token limited to that scope.',
        boxes: [b('app', 'Print app (client)', ['access token (scope photos.read)'], 'new', 'token'), b('as', 'Authorization server', ['issued token'], 'ok')],
        deps: [d('Authorization server', 'Print app', 'access token', 'ok')],
      },
      {
        note: 'The app calls the photo API with the token. The API accepts it for reading photos and would refuse to delete anything, because the scope does not allow it. Alice can revoke the grant at any time without changing her password.',
        boxes: [b('app', 'Print app (client)', ['Bearer access token'], 'ok'), b('rs', 'Photo API (resource server)', ['scope allows read: 200', 'delete not in scope: 403'], 'ok', 'scoped')],
        deps: [d('Print app', 'Photo API', 'GET /photos', 'ok'), d('Print app', 'Photo API', 'DELETE /photos/7', 'bad')],
      },
    ],
  },
];
