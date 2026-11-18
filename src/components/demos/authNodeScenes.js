// Frame data for the "Authentication in Node.js" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const AUTH_NODE_SCENES = [
  {
    id: 'password',
    label: 'Passwords and login',
    title: 'Store a slow salted hash, answer generically',
    frames: [
      {
        note: 'At registration the server never stores the password. It generates a random salt, runs a slow hash such as argon2id, scrypt or bcrypt, and stores the algorithm, its parameters, the salt and the hash in one string. A fast hash like SHA-256 is wrong, because an attacker can try billions per second.',
        boxes: [b('p', 'Password typed', ['at registration'], 'none'), b('h', 'Salted slow hash', ['argon2id, scrypt, bcrypt'], 'new'), b('d', 'Users table', ['stores the hash string only'], 'ok')],
        deps: [d('Password typed', 'Salted slow hash', 'hashed with salt', 'ok'), d('Salted slow hash', 'Users table', 'stored', 'ok')],
      },
      {
        note: 'At login the server finds the user by email, hashes the submitted password with the stored salt and parameters, and compares in constant time. If the user does not exist it still runs a dummy hash, so the response time does not reveal which emails are registered.',
        boxes: [b('l', 'Login request', ['email and password'], 'none'), b('v', 'Verify hash', ['constant-time compare'], 'new'), b('r', 'Same answer both ways', ['wrong email or password'], 'ok')],
        deps: [d('Login request', 'Verify hash', 'lookup, then hash', 'ok'), d('Verify hash', 'Same answer both ways', 'generic error', 'ok')],
      },
      {
        note: 'A failed login always returns one generic message and the same status, whether the email is unknown or the password is wrong. Different messages let an attacker enumerate accounts. Add rate limiting per account and per IP, because the hash is slow on purpose and is also a way to exhaust your CPU.',
        boxes: [b('a', 'Unknown email', ['dummy hash runs'], 'warn'), b('b', 'Wrong password', ['real hash runs'], 'warn'), b('c', '401 generic message', ['no hint which one'], 'ok')],
        deps: [d('Unknown email', '401 generic message', 'same reply', 'ok'), d('Wrong password', '401 generic message', 'same reply', 'ok')],
      },
      {
        note: 'On a successful login, upgrade old hashes: if the stored parameters are weaker than the current policy, hash the password again with the new settings and save it. This lets you raise the cost over the years without asking users to reset their passwords.',
        boxes: [b('o', 'Old hash', ['weaker parameters'], 'warn'), b('v', 'Verified at login', ['the password is known now'], 'ok'), b('n', 'Rehash and save', ['current parameters'], 'new')],
        deps: [d('Old hash', 'Verified at login', 'checked', 'ok'), d('Verified at login', 'Rehash and save', 'then', 'ok')],
      },
    ],
  },
  {
    id: 'session',
    label: 'Session or token',
    title: 'Where the proof of login lives',
    frames: [
      {
        note: 'A server-side session keeps the state on the server. After login it stores a record in Redis and sends the browser only a random session id in an httpOnly, Secure, SameSite cookie. Each request carries the cookie and the server looks the session up.',
        boxes: [b('c', 'Session cookie', ['random id only'], 'ok'), b('s', 'Session store', ['Redis, with a TTL'], 'new'), b('u', 'req.session.user', ['loaded each request'], 'ok')],
        deps: [d('Session cookie', 'Session store', 'looked up in', 'ok'), d('Session store', 'req.session.user', 'provides', 'ok')],
      },
      {
        note: 'Sessions can be revoked at once: delete the record and the user is logged out everywhere. The cost is a store lookup on every request and shared storage across instances. Regenerate the session id at login to prevent session fixation, and set both an idle and an absolute timeout.',
        boxes: [b('l', 'Logout or ban', ['delete the record'], 'warn'), b('r', 'Revoked at once', ['next request fails'], 'ok'), b('f', 'New id at login', ['stops fixation'], 'new')],
        deps: [d('Logout or ban', 'Revoked at once', 'effect', 'ok')],
      },
      {
        note: 'A JWT access token is stateless. The server signs claims such as sub, roles and exp with a key. Any service that has the key, or the public key, verifies it without a database call. It is short-lived, 5 to 15 minutes, because it cannot be revoked before it expires.',
        boxes: [b('t', 'Signed access token', ['sub, roles, exp'], 'new'), b('v', 'Verify signature and claims', ['no database call'], 'ok'), b('e', 'Expires in minutes', ['cannot be revoked early'], 'warn')],
        deps: [d('Signed access token', 'Verify signature and claims', 'checked by', 'ok'), d('Signed access token', 'Expires in minutes', 'limited by', 'warn')],
      },
      {
        note: 'Choose by need. A single web app with a browser client is simplest and safest with sessions. Several services, mobile apps and third parties fit short-lived tokens with refresh. Many banks use a backend for frontend that holds tokens and gives the browser only a session cookie.',
        boxes: [b('a', 'Browser web app', ['session cookie'], 'ok'), b('b', 'Mobile and services', ['access and refresh tokens'], 'ok'), b('c', 'Backend for frontend', ['tokens hidden from JS'], 'new')],
        deps: [d('Backend for frontend', 'Browser web app', 'gives', 'ok')],
      },
    ],
  },
  {
    id: 'refresh',
    label: 'Refresh token rotation',
    title: 'Short access, longer refresh, reuse detected',
    frames: [
      {
        note: 'The access token expires after 10 minutes. The client then sends its refresh token, a long random string, to the refresh endpoint. The server looks up its hash in the database, checks that it is active and not expired, and issues a new access token.',
        boxes: [b('e', 'Access token expired', ['401 from the API'], 'bad'), b('r', 'Refresh endpoint', ['checks the stored hash'], 'new'), b('n', 'New access token', ['10 more minutes'], 'ok')],
        deps: [d('Access token expired', 'Refresh endpoint', 'client calls', 'warn'), d('Refresh endpoint', 'New access token', 'issues', 'ok')],
      },
      {
        note: 'Rotation: every refresh also issues a new refresh token and marks the old one as used. Each token works once. The database stores only a hash of the token, like a password, and keeps a family id that links all tokens of one login.',
        boxes: [b('o', 'Refresh token 1', ['marked used'], 'warn'), b('n', 'Refresh token 2', ['active, new hash'], 'ok'), b('f', 'Token family', ['same login chain'], 'new')],
        deps: [d('Refresh token 1', 'Refresh token 2', 'replaced by', 'ok'), d('Refresh token 2', 'Token family', 'belongs to', 'ok')],
      },
      {
        note: 'Reuse detection: if token 1 is presented again, one of two parties holds a stolen copy, and the server cannot tell which. It revokes the whole family, so the legitimate user and the thief are both logged out. The user signs in again, and the stolen token is dead.',
        boxes: [b('t', 'Token 1 shown again', ['already used'], 'bad'), b('r', 'Revoke the family', ['all tokens invalid'], 'warn'), b('l', 'Sign in again', ['user logs in'], 'ok')],
        deps: [d('Token 1 shown again', 'Revoke the family', 'reuse detected', 'bad'), d('Revoke the family', 'Sign in again', 'forces', 'ok')],
      },
    ],
  },
  {
    id: 'defence',
    label: 'Defence in depth',
    title: 'Layers around the login',
    frames: [
      {
        note: 'Credential stuffing tries leaked passwords from other sites. Slow it with rate limits per IP and per account, with growing delays, and check new passwords against a list of breached ones. Hard account lockout is a denial-of-service lever, so prefer delays and alerts.',
        boxes: [b('a', 'Many login attempts', ['leaked passwords'], 'bad'), b('r', 'Rate limit and delay', ['per IP and per account'], 'new'), b('b', 'Breached password check', ['reject known leaks'], 'ok')],
        deps: [d('Many login attempts', 'Rate limit and delay', 'throttled by', 'ok')],
      },
      {
        note: 'A second factor protects against a stolen password. A time-based one-time password from an authenticator app, or better a passkey with WebAuthn, is required for login and again for risky actions such as adding a payee or a large transfer, which is called step-up authentication.',
        boxes: [b('p', 'Password correct', ['first factor'], 'ok'), b('t', 'TOTP or passkey', ['second factor'], 'new'), b('s', 'Step-up for transfers', ['ask again for risky actions'], 'warn')],
        deps: [d('Password correct', 'TOTP or passkey', 'then', 'ok'), d('TOTP or passkey', 'Step-up for transfers', 'again when risky', 'warn')],
      },
      {
        note: 'Cookie sessions need CSRF protection: SameSite cookies, and a token or custom header for state-changing requests. Password reset uses a random single-use token with a short expiry, stored as a hash, and a response that does not reveal whether the email exists.',
        boxes: [b('c', 'SameSite + CSRF token', ['blocks forged requests'], 'ok'), b('r', 'Reset token', ['random, hashed, 30 minutes'], 'new'), b('g', 'Generic reply', ['if the email exists, we sent a link'], 'ok')],
        deps: [d('Reset token', 'Generic reply', 'sent with', 'ok')],
      },
      {
        note: 'Log every authentication event with the request id: successful and failed logins, refresh reuse, password changes and resets, MFA changes. Never log passwords or tokens. Alert on spikes of failures and on logins from new places. Those logs are how a breach is found.',
        boxes: [b('e', 'Auth events', ['login, reset, MFA, reuse'], 'new'), b('l', 'Structured audit log', ['no secrets in it'], 'ok'), b('a', 'Alerts', ['spikes and new devices'], 'warn')],
        deps: [d('Auth events', 'Structured audit log', 'written to', 'ok'), d('Structured audit log', 'Alerts', 'feeds', 'warn')],
      },
    ],
  },
];
