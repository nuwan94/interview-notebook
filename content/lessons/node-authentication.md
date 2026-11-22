---
title: Authentication in Node.js — passwords, sessions, JWT, refresh rotation, MFA and attacks
nav: Node.js authentication
slug: node-authentication
summary: Implementing authentication in a Node.js and Express API, storing passwords with argon2id, scrypt or bcrypt and salts, login without account enumeration and timing leaks, rehashing, server-side sessions with express-session and Redis and secure cookie flags, session fixation, JWT access tokens with the jose library, algorithm and claim validation, refresh token rotation with reuse detection, sessions versus tokens and the backend for frontend, OIDC and social login with Passport and openid-client, TOTP and passkeys with step-up authentication, password reset and email verification tokens, API keys and service authentication, brute force and credential stuffing defences, CSRF, logging and testing, compared with Spring Security, with banking examples and interview questions.
tags: [Node.js, Authentication, Passwords, Sessions, JWT, Refresh tokens, MFA, TOTP, Security, Backend, Full stack]
order: 72
topic: Full stack / Node.js
updated: 2026-11-18
subnav: true
---

Authentication is where backend interviews check judgement, not syntax. They ask *how you store passwords and why not SHA-256, how login avoids revealing which emails exist, session or JWT and where the token lives, how refresh tokens work and what rotation protects against, how you add MFA, how a password reset is made safe, how you stop brute force, and what you log.* This lesson implements those parts in Node.js and Express, on top of the concepts in [authentication and authorisation](lesson:authn-authz#basics), [JWT](lesson:jwt#validation) and [OAuth 2.0](lesson:oauth2#tokens), and uses the layers from [Express middleware](lesson:node-express-middleware#auth). Examples use banking accounts. Play the four scenes: passwords and login, session or token, refresh token rotation, and defence in depth.

```demo
name: auth-node-walk
```

> **One sentence to remember:** *Store only a slow salted hash, answer every failure the same way, prove login with a revocable session or a short-lived token plus a rotating refresh token, add a second factor for risky actions, and log everything except secrets.*

## Authentication and where it fits {#basics}

**Authentication** answers "who are you?" and **authorisation** answers "what may you do?". This lesson covers the first, plus the hooks into the second. The parts of an authentication system:

| Part | Job | Examples |
| --- | --- | --- |
| **credential** | proof of identity | password, passkey, one-time code, API key |
| **verification** | checking the proof | hash comparison, signature check |
| **session or token** | remembering the login between requests | session id cookie, JWT, refresh token |
| **recovery** | a safe way back | password reset, account recovery |
| **protection** | making attacks expensive | rate limits, MFA, monitoring |

**Build or buy?** For anything beyond a simple app, prefer an identity provider (Keycloak, Auth0, Cognito, Okta, a bank's own IdP) with **OpenID Connect**, and let your API only **verify tokens**. Writing your own password storage, MFA and recovery is hard to get right and a common source of breaches. You still need to know how it works, because interviewers ask, and because many systems keep their own login.

## Storing passwords {#passwords}

Rules:

1. **Never** store the password, and never encrypt it (encryption can be reversed).
2. Use a **slow, memory-hard, salted** password hash: **argon2id** (the current recommendation), **scrypt**, or **bcrypt** (older, still acceptable, but only the first 72 bytes count). Not MD5, SHA-1 or plain SHA-256: they are built to be fast, so an attacker with a leaked database tries billions of guesses per second on a GPU.
3. A **salt** is a random value stored with the hash, unique per user. It makes identical passwords hash differently and defeats precomputed (rainbow) tables.
4. A **pepper** is an extra secret kept outside the database (in a secret manager or HSM), mixed in with an HMAC. A stolen database alone is then not enough. Optional extra layer.
5. Store the **algorithm, its parameters and the salt** together with the hash in one string, so you can **upgrade** the settings later.
6. Compare hashes in **constant time**.

With a package: `argon2.hash(password)` and `argon2.verify(hash, password)` (the `argon2` npm package), or `bcrypt.hash(password, 12)` and `bcrypt.compare`. Node.js also has **scrypt built in**:

```javascript
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const CURRENT = { N: 2 ** 15, r: 8, p: 1, keylen: 32 };        // cost parameters, raise over time
const maxmem = (N, r) => 256 * N * r;                           // allow the memory scrypt needs (128 * N * r)

const normalise = (password) => password.normalize('NFKC');     // same characters, same bytes

export async function hashPassword(password) {
  const { N, r, p, keylen } = CURRENT;
  const salt = randomBytes(16);
  const key = await scryptAsync(normalise(password), salt, keylen, { N, r, p, maxmem: maxmem(N, r) });
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const salt = Buffer.from(saltB64, 'base64url');
  const expected = Buffer.from(keyB64, 'base64url');
  const actual = await scryptAsync(normalise(password), salt, expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: maxmem(Number(N), Number(r)) });
  return timingSafeEqual(actual, expected);                      // constant-time comparison
}

export function needsRehash(stored) {                            // weaker than today's policy?
  const [, N, r, p] = stored.split('$');
  return Number(N) < CURRENT.N || Number(r) < CURRENT.r || Number(p) < CURRENT.p;
}
```

Practical points:

- **Cost is a trade-off.** Aim for roughly 50 to 250 ms per hash on your hardware. Hashing runs on the libuv **thread pool** (4 threads by default, [thread pool](lesson:node-runtime#runtime)), so many concurrent logins can saturate it and slow `fs` and DNS too. **Rate limit login** and consider a larger `UV_THREADPOOL_SIZE` or a separate service.
- **Limit the password length** (for example 128 characters) before hashing, so an attacker cannot send a 10 MB "password" to burn CPU.
- **Password policy** (NIST 800-63B): a **minimum length** (8 or more, 12 recommended), allow long passphrases and all characters, **check against lists of breached passwords** (k-anonymity range queries to Have I Been Pwned), and do **not** force periodic rotation or arbitrary complexity rules. Show a strength meter and allow password managers to paste.
- **Rehash on login**: after a successful verification, if `needsRehash(stored)`, hash again with the current parameters and save. This raises the cost over the years without forcing resets.

## Registration and login {#login}

```javascript
const DUMMY_HASH = await hashPassword('not-a-real-password');   // computed once at startup

app.post('/auth/register', registerLimiter, validate(RegisterBody), async (req, res) => {
  const { email, password } = req.body;
  if (await isBreached(password)) {
    return res.status(422).json({ code: 'PASSWORD_BREACHED', message: 'Choose a password not found in known leaks' });
  }
  try {
    await users.insert({ email: email.toLowerCase(), passwordHash: await hashPassword(password) });
  } catch (e) {
    if (e.code !== 'UNIQUE_VIOLATION') throw e;
    // do not reveal that the email exists: send an "you already have an account" email instead
  }
  res.status(202).json({ message: 'Check your email to verify your address' });
});

app.post('/auth/login', loginLimiter, validate(LoginBody), async (req, res) => {
  const { email, password } = req.body;
  const user = await users.findByEmail(email.toLowerCase());

  // always run a hash, even for unknown emails, so timing does not reveal who is registered
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok) {
    audit('login_failed', { email, ip: req.ip });
    return res.status(401).json({ code: 'INVALID_CREDENTIALS' });        // the same answer in both cases
  }
  if (needsRehash(user.passwordHash)) await users.setHash(user.id, await hashPassword(password));
  if (user.mfaEnabled) return res.json({ mfaRequired: true, challenge: await mfa.startChallenge(user.id) });

  await startSession(req, user);                                          // session or tokens, below
  audit('login_ok', { userId: user.id, ip: req.ip });
  res.json({ ok: true });
});
```

Why each detail:

- **Same response for unknown email and wrong password**, and the **dummy hash** for similar timing. Otherwise login, registration and password reset become ways to **enumerate accounts**.
- **Normalise the email** (lower case, trim) and apply a **unique index** on the normalised value.
- **Verify the email address** before trusting the account (see below).
- **HTTPS only**, and never put credentials in a URL or a log line.
- **Rate limit** by IP **and** by account ([rate limiting](lesson:node-express#security)), because a distributed attack uses many IPs against one account.

## Server-side sessions {#sessions}

A **session** keeps the login state on the **server**. The browser holds only a random **session id** in a cookie (the second scene).

```javascript
import session from 'express-session';
import { RedisStore } from 'connect-redis';

app.set('trust proxy', 1);                                  // behind a load balancer, so Secure cookies work
app.use(session({
  name: '__Host-sid',                                       // __Host- prefix: must be Secure, Path=/, no Domain
  secret: [process.env.SESSION_SECRET_NEW, process.env.SESSION_SECRET_OLD],   // first signs, all verify (rotation)
  store: new RedisStore({ client: redis, ttl: 1800 }),      // shared by all instances
  resave: false,
  saveUninitialized: false,                                 // no cookie until there is something to store
  rolling: true,                                            // refresh the idle timeout on activity
  cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 60_000 },
}));

function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {                       // NEW session id at login: prevents fixation
      if (err) return reject(err);
      req.session.userId = user.id;
      req.session.createdAt = Date.now();                   // for an absolute timeout
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

export function requireSession(req, res, next) {
  const s = req.session;
  if (!s?.userId || Date.now() - s.createdAt > 8 * 3600_000) {   // absolute lifetime of 8 hours
    return res.status(401).json({ code: 'UNAUTHENTICATED' });
  }
  req.user = { id: s.userId };
  next();
}

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {                               // delete the server-side record
    res.clearCookie('__Host-sid');
    res.sendStatus(204);
  });
});
```

**Cookie flags** (each one blocks an attack):

| Flag | Effect |
| --- | --- |
| `HttpOnly` | JavaScript cannot read it, so XSS cannot steal the session id |
| `Secure` | sent only over HTTPS |
| `SameSite=Lax` or `Strict` | not sent on cross-site sub-requests, which blocks most CSRF |
| `__Host-` name prefix | the browser enforces Secure, `Path=/` and no `Domain`, so another subdomain cannot overwrite it |
| `Max-Age` | idle lifetime (use both an idle and an **absolute** timeout) |

**Session security checklist:**

- **Session fixation:** an attacker plants a known session id in the victim's browser, the victim logs in, and the attacker now has a logged-in id. **Regenerate the id at login** and at privilege changes.
- **Hijacking:** HTTPS, `HttpOnly`, short timeouts, and optionally bind the session to coarse client data and re-authenticate for sensitive actions.
- **Storage:** use a shared store (Redis) with a TTL. The default in-memory store leaks memory and breaks with several instances.
- **Revocation** is instant: delete the record (logout, password change, "log out everywhere", account ban). Keep an index of a user's sessions to delete them all.
- **CSRF:** because cookies are sent automatically, protect state-changing requests with `SameSite`, a CSRF token (synchroniser or double-submit) or a required custom header, and never change state on `GET`.

## JWT access tokens {#jwt}

A **JSON Web Token** is a signed set of claims. The server (or a separate auth service) signs it, and any API that has the verification key checks it **without a database call** ([JWT basics](lesson:jwt#what)). Use the **`jose`** library:

```javascript
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { randomUUID } from 'node:crypto';

const ISSUER = 'https://auth.bank.example';
const AUDIENCE = 'accounts-api';
const privateKey = await importPKCS8(process.env.JWT_PRIVATE_KEY, 'ES256');   // only the auth service has it
const publicKey = await importSPKI(process.env.JWT_PUBLIC_KEY, 'ES256');      // every API can have it

export function signAccessToken(user) {
  return new SignJWT({ roles: user.roles, scope: 'accounts:read transfers:write' })
    .setProtectedHeader({ alg: 'ES256', kid: 'key-2026-11' })     // kid lets you rotate signing keys
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('10m')                                       // short-lived
    .setJti(randomUUID())                                           // id, for logs and optional deny-lists
    .sign(privateKey);
}

export async function authenticate(req, res, next) {
  const token = req.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ code: 'MISSING_TOKEN' });
  try {
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['ES256'],                                        // a whitelist: never trust the token's own alg
      clockTolerance: 5,                                            // seconds
    });
    req.user = { id: payload.sub, roles: payload.roles ?? [], scopes: String(payload.scope ?? '').split(' ') };
    next();
  } catch {
    res.status(401).json({ code: 'INVALID_TOKEN' });                // do not say why: expired, bad signature...
  }
}
```

Rules:

- **Verify**, never just decode: signature, **algorithm whitelist** (blocks `alg: none` and the RS256-to-HS256 key confusion attack), `exp`, `nbf`, **`iss`**, **`aud`**.
- **Asymmetric keys** (ES256, RS256, EdDSA) let many services verify with a public key, usually fetched from the issuer's **JWKS** endpoint (`createRemoteJWKSet`) and cached. **HS256** (a shared secret) is fine only when one service both signs and verifies.
- **Short lifetime** (5 to 15 minutes), because a signed token **cannot be revoked** before it expires. Keep claims small and **non-sensitive**, since a JWT is only signed, not encrypted: anyone can read the payload.
- Never put secrets or personal data (account numbers, full names) in the payload. Never use the token as a reference to permissions that must be immediately accurate.
- **Where the client keeps it:** a token in `localStorage` can be read by any script (XSS). Better: a **BFF** that holds tokens and gives the browser an httpOnly session cookie, or the token in memory plus a refresh token in an httpOnly cookie ([where to store tokens](lesson:fullstack-integration#auth)).

**Session or token?**

| | Server-side session | JWT access token (with refresh) |
| --- | --- | --- |
| state | on the server (Redis) | in the token, stateless verification |
| revocation | immediate | only at expiry, or with a deny-list |
| cost per request | a store lookup | a signature check |
| scales across services | needs shared store or a gateway | verifies anywhere with the public key |
| browser fit | excellent (cookie, CSRF defence) | needs care about storage |
| mobile, third parties | awkward | natural |
| best for | one web app, one backend | many services, mobile, partners |

A common bank setup: browser to a **BFF with a session cookie**, and the BFF uses tokens to call internal APIs.

## Refresh token rotation {#refresh}

A short access token forces frequent renewal, so the client also holds a **refresh token**: a long, random, **opaque** string (not a JWT) that can be exchanged for a new access token. Storing it as a hash and **rotating** it on every use limits the damage of a theft (the third scene).

```javascript
import { randomBytes, createHash, randomUUID } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const REFRESH_TTL_MS = 14 * 24 * 3600_000;

export class AuthError extends Error {
  constructor(code) { super(code); this.code = code; this.status = 401; }
}

export async function issueRefreshToken(db, userId, familyId = randomUUID()) {
  const token = randomBytes(32).toString('base64url');                  // 256 bits of randomness
  await db.refresh.insert({
    hash: sha256(token),                                                // only the hash is stored
    userId, familyId, usedAt: null, expiresAt: Date.now() + REFRESH_TTL_MS,
  });
  return token;
}

export async function rotateRefreshToken(db, presented) {
  const row = await db.refresh.findByHash(sha256(presented));
  if (!row || row.expiresAt < Date.now()) throw new AuthError('INVALID_REFRESH_TOKEN');

  // atomic claim: only one caller can mark it used (UPDATE ... WHERE used_at IS NULL)
  const claimed = await db.refresh.markUsed(row.hash);
  if (!claimed) {                                                       // it was already used
    await db.refresh.revokeFamily(row.familyId);                        // reuse detected: kill the whole chain
    throw new AuthError('REFRESH_TOKEN_REUSED');
  }

  const refreshToken = await issueRefreshToken(db, row.userId, row.familyId);
  const accessToken = await signAccessToken(await users.findById(row.userId));
  return { accessToken, refreshToken };
}
```

How it works:

- Every refresh returns a **new** refresh token and marks the old one **used**. Each works **once**.
- All tokens of one login share a **family id**. If a used token is presented again, one of two parties holds a stolen copy and you cannot tell which, so **revoke the whole family**. The user signs in again and the thief's token is dead.
- **Store only hashes** (like passwords, but a fast hash is fine because the token has 256 bits of entropy), so a database leak does not leak usable tokens.
- **Race and multiple tabs:** two tabs refreshing at the same moment look like reuse. Use an atomic update, and optionally a short **grace period** (for example 10 seconds) in which the previous token is accepted once more.
- **Absolute lifetime:** a family should end after a maximum age (for example 30 days) even if used continuously.
- Deliver it in an **httpOnly, Secure, SameSite=Strict cookie scoped to the refresh path** (`Path=/auth/refresh`), so it is not sent with other requests.
- **Logout** revokes the family. **Password change** revokes all families of the user.

## OpenID Connect and social login {#oidc}

When login is delegated to an identity provider, your app is a **relying party** using the **authorization code flow with PKCE** ([OIDC flow](lesson:oidc#flow)). In Node.js use **`openid-client`** (a certified client library) or **Passport** strategies:

```javascript
import * as client from 'openid-client';

const config = await client.discovery(new URL('https://idp.bank.example'), CLIENT_ID, CLIENT_SECRET);

app.get('/auth/login', async (req, res) => {
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  req.session.oidc = { verifier, state, nonce };                      // kept server side
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: REDIRECT_URI, scope: 'openid profile email',
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256', state, nonce,
  });
  res.redirect(url.href);
});

app.get('/auth/callback', async (req, res) => {
  const { verifier, state, nonce } = req.session.oidc ?? {};
  const tokens = await client.authorizationCodeGrant(config, new URL(req.originalUrl, BASE_URL),
    { pkceCodeVerifier: verifier, expectedState: state, expectedNonce: nonce });
  const claims = tokens.claims();                                     // validated ID token claims
  await startSession(req, await users.findOrCreateByIdp(claims.sub, claims.email));
  res.redirect('/');
});
```

(`openid-client` v6 shown. Check the version you install, because its API changed between major versions.)

Points: the **`state`** value blocks CSRF on the callback, **`nonce`** binds the ID token to the session, **PKCE** blocks code interception. Validate the **ID token** (signature, `iss`, `aud`, `exp`, `nonce`), match users by the stable **`sub`** claim rather than the email, and only trust an email if `email_verified` is true. Avoid open redirects: allow-list the post-login return URL.

## Multi-factor authentication {#mfa}

A second factor means a stolen password is not enough. Common factors:

- **TOTP** (RFC 6238): a 6-digit code from an authenticator app, computed from a shared secret and the current 30-second time step.
- **Passkeys and WebAuthn**: public-key credentials bound to the site and stored on the device or security key. **Phishing-resistant**, and the best option. Use a library (`@simplewebauthn/server`).
- **SMS and email codes**: weak (SIM swap, interception) but better than nothing.
- **Recovery codes**: single-use codes, stored as hashes, shown once at enrolment.

```javascript
import { createHmac, timingSafeEqual } from 'node:crypto';

function hotp(secret, counter, digits = 6) {                        // RFC 4226
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;                      // dynamic truncation
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

// Returns the matching time-step counter, or null. The caller stores it and rejects counters already used.
export function verifyTotp(secret, token, { step = 30, window = 1, now = Date.now() } = {}) {
  if (!/^\d{6}$/.test(token)) return null;
  const counter = Math.floor(now / 1000 / step);
  for (let w = -window; w <= window; w++) {                         // allow one step of clock drift
    const expected = hotp(secret, counter + w);
    if (timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return counter + w;
  }
  return null;
}
```

Details that matter:

- Store the TOTP **secret encrypted** (it must be recoverable), generate it with `randomBytes(20)`, and show it as a QR code (`otpauth://` URI) at enrolment, requiring one valid code to **confirm** enrolment.
- **Reject reuse** of a code: remember the last accepted counter per user, otherwise a phished code works again within its window.
- **Rate limit** code attempts (a 6-digit code has only a million values).
- **Step-up authentication:** require a fresh factor for risky actions (adding a payee, a large transfer, changing the password or phone). Record `authTime` and the **assurance level** in the session or token, and demand re-authentication when it is older than a threshold.

## Password reset and email verification {#reset}

Reset is the weakest link in many systems, because it is a second way to log in.

```javascript
import { randomBytes, createHash } from 'node:crypto';

app.post('/auth/forgot', forgotLimiter, async (req, res) => {
  const user = await users.findByEmail(req.body.email.toLowerCase());
  if (user) {
    const token = randomBytes(32).toString('base64url');            // unguessable
    await resetTokens.insert({
      userId: user.id,
      hash: createHash('sha256').update(token).digest('hex'),       // store the hash only
      expiresAt: Date.now() + 30 * 60_000,                          // short expiry
    });
    await mail.send(user.email, `https://app.bank.example/reset#token=${token}`);
  }
  res.status(202).json({ message: 'If that email exists, we sent a link' });   // same reply either way
});

app.post('/auth/reset', async (req, res) => {
  const row = await resetTokens.consume(sha256(req.body.token));    // single use: deleted as it is read
  if (!row || row.expiresAt < Date.now()) return res.status(400).json({ code: 'INVALID_OR_EXPIRED' });
  await users.setHash(row.userId, await hashPassword(req.body.password));
  await sessions.destroyAllFor(row.userId);                         // log out everywhere
  await refresh.revokeAllFor(row.userId);
  audit('password_reset', { userId: row.userId });
  res.sendStatus(204);
});
```

- Tokens are **random, long, hashed in the database, short-lived and single-use**. Put the token in the URL **fragment** or POST it, so it does not appear in server logs or `Referer` headers.
- **Generic response**, so the form cannot be used to enumerate emails.
- After a reset, **invalidate all sessions and refresh tokens**, and **notify** the user by email.
- **Email verification** uses the same pattern: a random single-use token sent to the address, and the account stays limited until it is confirmed.
- **Changing the email or password** while logged in should require the current password or a fresh factor.

## API keys and service authentication {#service}

- **API keys** identify a **client application**, not a person. Generate them randomly with a readable prefix and an id: `bk_live_<id>_<secret>`. Store only a **hash of the secret**, look up by the id, compare in constant time, show the key **once**, and support **rotation**, scopes, expiry and per-key rate limits.
- **Service to service:** the OAuth 2.0 **client credentials** grant (a service gets a short-lived token with its own identity), or **mutual TLS** inside a mesh. Do not reuse a user's token between services without careful audience and scope handling.
- **Webhooks** are authenticated by an **HMAC signature** over the raw body ([verifying signatures](lesson:node-express-middleware#bodies)).
- **Secrets** (signing keys, client secrets, pepper) live in a secret manager, are rotated, and are never committed.

## Attacks and defences {#attacks}

| Attack | Defence |
| --- | --- |
| **Brute force** one account | per-account rate limit with growing delay, MFA |
| **Credential stuffing** (leaked passwords from other sites, many accounts) | per-IP and global limits, breached-password check, MFA, bot detection, alerts |
| **Account enumeration** (login, register, reset reveal who exists) | identical responses and timing |
| **Password database leak** | argon2id or scrypt with salts, a pepper, rehash policy |
| **Session fixation and hijacking** | regenerate id at login, HttpOnly, Secure, HTTPS, short timeouts |
| **CSRF** | SameSite, CSRF token or custom header, no state changes on GET |
| **XSS stealing credentials** | HttpOnly cookies, CSP, output escaping, no tokens in `localStorage` |
| **Token theft** | short access tokens, refresh rotation with reuse detection, token binding where supported |
| **JWT attacks** (`alg: none`, key confusion, missing `aud`) | algorithm whitelist, verify `iss` and `aud`, keys from a trusted JWKS |
| **Open redirect after login** | allow-list return URLs |
| **Timing attacks** | `timingSafeEqual`, dummy hash |
| **Phishing** | passkeys (WebAuthn), user education, device alerts |
| **Account lockout abuse** | prefer delays and alerts over hard lockout, or short temporary locks |

Locking an account after N failures lets an attacker **lock out real users** (a denial of service), so prefer progressive delays, CAPTCHA after several failures, and notifications.

## Logging, monitoring and testing {#ops}

- **Audit log** (structured, with the request id): login success and failure, MFA events, password changes and resets, token refresh reuse, session revocation, role changes. **Never log** passwords, tokens, reset links or full card numbers. Alert on spikes of failures, many accounts from one IP, logins from new devices or countries, and refresh reuse.
- **Tests:** unit-test `hashPassword`, `verifyPassword` and `needsRehash`, `rotateRefreshToken` (including reuse and the race), `verifyTotp` with the RFC test vectors, and the JWT verification (wrong `aud`, expired, wrong algorithm). Integration-test the login endpoint with supertest: same response for unknown email and wrong password, cookie flags present, session id changes at login, logout invalidates, rate limit returns 429 ([testing Express](lesson:node-express#testing)).

```javascript
test('login does not reveal whether the email exists', async () => {
  const unknown = await request(app).post('/auth/login').send({ email: 'nobody@bank.example', password: 'x'.repeat(12) });
  const wrong = await request(app).post('/auth/login').send({ email: 'alice@bank.example', password: 'wrong-password' });
  expect(unknown.status).toBe(401);
  expect(wrong.status).toBe(401);
  expect(unknown.body).toEqual(wrong.body);
});

test('the session cookie has the security flags', async () => {
  const res = await request(app).post('/auth/login').send(validCredentials);
  const cookie = res.headers['set-cookie'][0];
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/Secure/);
  expect(cookie).toMatch(/SameSite=Lax/);
});
```

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| SHA-256 or MD5 for passwords | argon2id, scrypt or bcrypt |
| no salt, or one global salt | a random salt per password |
| different messages for unknown email and wrong password | one generic response and a dummy hash |
| no rate limit on login, reset, MFA | per IP and per account |
| JWT in `localStorage` | BFF with an httpOnly cookie, or memory plus a refresh cookie |
| long-lived access tokens | 5 to 15 minutes plus refresh |
| decoding a JWT without verifying | `jwtVerify` with issuer, audience and algorithm |
| accepting any algorithm | whitelist it |
| refresh tokens stored in plain text or reusable | store hashes, rotate, detect reuse |
| same session id before and after login | regenerate at login |
| in-memory session store in production | Redis with a TTL |
| reset tokens that are guessable, reusable or never expire | random, hashed, single-use, short expiry |
| reset flow that reveals which emails exist | same response either way |
| trusting an unverified email from an IdP | check `email_verified`, match on `sub` |
| logging tokens or passwords | log events and ids only |
| hard account lockout | delays, alerts and MFA |

## For a Java developer {#java}

| Spring Security | Node.js |
| --- | --- |
| `PasswordEncoder` (`BCryptPasswordEncoder`, `Argon2PasswordEncoder`, `DelegatingPasswordEncoder`) | `argon2`, `bcrypt` or `crypto.scrypt` with a stored parameter string, `needsRehash` |
| `UserDetailsService`, `AuthenticationProvider` | your `users` repository and a verify function, or Passport strategies |
| `SecurityFilterChain` | middleware order: session or `authenticate`, then `requireRole` |
| `HttpSession`, Spring Session with Redis | `express-session` with `connect-redis` |
| `SessionFixationProtection` | `req.session.regenerate` |
| `CsrfFilter` | SameSite cookies and a CSRF token middleware |
| resource server with `JwtDecoder` | `jose` `jwtVerify` with a JWKS |
| `spring-security-oauth2-client` | `openid-client` or Passport |
| `@PreAuthorize("hasRole('ADMIN')")` | `requireRole('admin')` middleware or checks in the service |
| `SecurityContextHolder` (thread-bound) | `req.user` and `AsyncLocalStorage` |
| Keycloak, Okta | the same, via OIDC |

Try it in the lab: [Node API login: hashed password, access and refresh tokens](lab:node-auth-tokens).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| password storage | argon2id or scrypt or bcrypt, per-user salt, parameters in the string, rehash on login |
| never | plaintext, encryption, MD5, SHA-256, a global salt |
| login | same error and timing for every failure, dummy hash, rate limits |
| session | random id in an HttpOnly, Secure, SameSite cookie, store in Redis, regenerate at login |
| `__Host-` | cookie prefix that forces Secure, Path=/, no Domain |
| JWT | verify signature, alg whitelist, `exp`, `iss`, `aud`. Short-lived. No secrets in it |
| refresh | opaque random, hashed, rotated, family id, reuse means revoke all |
| session vs JWT | revocable and simple versus stateless and portable. BFF combines them |
| OIDC | code flow with PKCE, `state`, `nonce`, match on `sub` |
| MFA | TOTP (RFC 6238), passkeys best, recovery codes, step-up for risky actions |
| reset | random hashed single-use short-lived token, generic reply, revoke sessions after |
| API keys | prefix plus id plus secret, store a hash, rotate, scope |
| attacks | brute force, stuffing, enumeration, fixation, CSRF, XSS, token theft, timing |
| log | auth events with request ids, no secrets |

## Interview questions {#questions}

### [basic] How should passwords be stored and why not SHA-256? {#store-q}

As the output of a slow, salted, memory-hard password hash such as argon2id, scrypt or bcrypt, together with the algorithm, parameters and salt in one string. SHA-256 is designed to be fast, so an attacker with a leaked database can test billions of guesses per second on a GPU. A per-user random salt makes identical passwords hash differently and defeats rainbow tables, and the cost parameter can be raised over time as hardware improves. Passwords are never stored in plain text or encrypted.

### [basic] What is the difference between authentication and authorisation? {#authn-authz-q}

Authentication establishes who the caller is (a password, a token, a certificate) and answers with 401 when it fails. Authorisation decides what that identity may do (roles, scopes, ownership of an object) and answers with 403 when it fails. In an Express API, authentication is a middleware that sets `req.user`, and authorisation is further middleware and checks in the service.

### [basic] What is a salt and what is a pepper? {#salt-q}

A salt is a random value, unique per password, stored next to the hash. It makes equal passwords produce different hashes and makes precomputed tables useless, but it is not secret. A pepper is a secret value, kept outside the database (a secret manager or HSM), mixed into the hashing. Even a full database leak is then not enough to crack passwords. The pepper is an optional extra layer, the salt is mandatory.

### [basic] How do you prevent account enumeration on login? {#enumeration-q}

Return the same status and body for an unknown email and a wrong password, and make the timing similar by always performing a password hash, using a precomputed dummy hash when the user does not exist. Apply the same rule to registration ("check your email") and password reset ("if that email exists, we sent a link"), because any difference lets an attacker learn which accounts exist.

### [basic] Where should the session id or token be stored in the browser? {#storage-q}

In an httpOnly, Secure, SameSite cookie, so JavaScript cannot read it. A token in `localStorage` can be stolen by any injected script. If a SPA must hold an access token itself, keep it in memory and use a refresh token in an httpOnly cookie, or better, use a backend for frontend that keeps the tokens on the server and gives the browser only a session cookie.

### [intermediate] Compare server-side sessions and JWT access tokens. When would you choose each? {#session-vs-jwt-q}

A session keeps state on the server (usually Redis), the browser holds a random id, and revocation is immediate, at the cost of a lookup and a shared store. A JWT carries signed claims and is verified without a database call by any service with the public key, but it cannot be revoked before it expires, so it must be short-lived and paired with refresh tokens. Sessions suit a single web app and its backend. Tokens suit several services, mobile apps and third parties. A backend for frontend combines them: a session cookie for the browser and tokens between servers.

### [intermediate] What must you validate when you receive a JWT? {#jwt-validate-q}

Verify the signature with the right key, restrict the allowed algorithms with a whitelist (blocking `alg: none` and key-confusion attacks), and check `exp` and `nbf`, the issuer (`iss`) and the audience (`aud`). Fetch keys from the issuer's JWKS and cache them, honour `kid` for rotation, and apply authorisation using scopes and roles. Never just decode a token and trust the payload, and never put secrets in it, because it is signed and not encrypted.

### [intermediate] How does refresh token rotation with reuse detection work? {#rotation-q}

The access token is short-lived. The client exchanges an opaque, random refresh token for a new access token. On each exchange the server issues a new refresh token, marks the old one used, and stores only hashes, with a family id linking the tokens of one login. If a used token is presented again, either the user or a thief has a stale copy, so the server revokes the entire family and forces a new login, which neutralises a stolen token. Atomic updates and an optional short grace period avoid false alarms from two tabs refreshing at once.

### [intermediate] What is session fixation and how do you prevent it? {#fixation-q}

The attacker makes the victim use a session id the attacker already knows (planted before login). When the victim logs in, the session becomes authenticated and the attacker can use it. Prevent it by issuing a new session id when authentication happens (`req.session.regenerate`) and when privileges change, by never accepting session ids from URLs, and by using HttpOnly and Secure cookies.

### [intermediate] How do you make password reset safe? {#reset-q}

Generate a long random single-use token, store only its hash with a short expiry (15 to 60 minutes), and email a link that carries it in the URL fragment or a POST body. Respond identically whether or not the email exists, rate limit the endpoint, and on success consume the token, set the new password hash, invalidate all sessions and refresh tokens, and notify the user. Do not use predictable tokens, do not let tokens be reused, and do not leak whether the account exists.

### [intermediate] How do you defend against brute force and credential stuffing? {#bruteforce-q}

Rate limit login per IP and per account with growing delays, add a global limit and bot detection, require MFA, check new passwords against breached-password lists, and alert on spikes and logins from new devices. Avoid permanent lockout, which lets an attacker deny service to real users, and prefer temporary delays, CAPTCHA after repeated failures and notifications. Make sure the slow hash does not become a CPU exhaustion vector by limiting request rate and password length.

### [intermediate] How does TOTP work and what must you remember when implementing it? {#totp-q}

Both sides share a secret. The code is an HMAC (SHA-1 by default) of the current 30-second time-step counter, truncated to 6 digits (RFC 6238 on top of HOTP, RFC 4226). The server computes the codes for the current step and one step either side to tolerate clock drift, compares in constant time, rejects any counter already used, rate limits attempts, stores the secret encrypted, requires a confirming code at enrolment, and provides recovery codes. Passkeys are stronger because they resist phishing.

### [deep] Why can a signed JWT not be revoked, and how do you cope? {#revoke-q}

Verification needs only the signature and expiry, so no server is asked whether the token is still valid. To cope, keep access tokens short (minutes) and revoke the refresh token, so the damage window is small. For immediate revocation add a small deny-list of `jti` values or a per-user "valid after" timestamp checked on each request (which reintroduces a lookup), use opaque tokens with introspection for high-risk systems, or use sessions. The right choice balances revocation speed against statelessness.

### [deep] How would you design authentication for a banking web app with a React front end and Express APIs? {#design-q}

Use an OIDC identity provider with MFA and passkeys, and a backend for frontend in Node.js that performs the authorization code flow with PKCE and keeps access and refresh tokens server side. The browser gets only an httpOnly, Secure, SameSite session cookie with idle and absolute timeouts, a CSRF defence, and a regenerated id at login. Internal APIs verify short-lived JWTs (issuer, audience, algorithm, scopes) from a JWKS. Money movement requires step-up authentication, rate limits and idempotency keys apply, every event is logged with a request id, and sessions and tokens are revoked on password change or suspicious activity. See [the integration lesson](lesson:fullstack-integration#auth).

### [deep] What are the weaknesses of SMS codes and how do passkeys improve on them? {#passkey-q}

SMS codes can be intercepted through SIM swapping or SS7 attacks, redirected by social engineering of the carrier, and phished by a fake site that relays the code in real time. A passkey (WebAuthn) is a public-key credential bound to the origin: the private key never leaves the device, the browser signs a server challenge only for the genuine domain, and there is nothing to type or to phish. They are also faster for users, and a server stores only public keys, so a leak exposes no secrets.

### [coding] Implement `hashPassword` and `verifyPassword` with Node's built-in scrypt: salted, parameters stored in the string, constant-time compare, and `needsRehash`. {#coding-hash}

```javascript
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const CURRENT = { N: 2 ** 15, r: 8, p: 1, keylen: 32 };
const maxmem = (N, r) => 256 * N * r;
const normalise = (pw) => pw.normalize('NFKC');

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new RangeError('Password must be 8 to 128 characters');       // also blocks huge inputs
  }
  const { N, r, p, keylen } = CURRENT;
  const salt = randomBytes(16);                                           // unique per password
  const key = await scryptAsync(normalise(password), salt, keylen, { N, r, p, maxmem: maxmem(N, r) });
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, keyB64] = String(stored).split('$');
  if (alg !== 'scrypt' || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64url');
  const actual = await scryptAsync(
    normalise(String(password).slice(0, 128)),
    Buffer.from(saltB64, 'base64url'),
    expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: maxmem(Number(N), Number(r)) },
  );
  return timingSafeEqual(actual, expected);                               // same length, constant time
}

export function needsRehash(stored) {
  const [, N, r, p] = stored.split('$');
  return Number(N) < CURRENT.N || Number(r) < CURRENT.r || Number(p) < CURRENT.p;
}

// usage in the login handler
const ok = await verifyPassword(input, user?.passwordHash ?? DUMMY_HASH);
if (ok && needsRehash(user.passwordHash)) await users.setHash(user.id, await hashPassword(input));
```

The salt is random per password, the parameters travel with the hash so each user can be verified with the settings used when it was created, `timingSafeEqual` avoids timing leaks, the length limits block CPU abuse, and `needsRehash` upgrades weak hashes when the user next logs in.

### [coding] Implement refresh token rotation with reuse detection against an in-memory store (family ids, hashed tokens, atomic use). {#coding-rotation}

```javascript
import { randomBytes, createHash, randomUUID } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export class TokenService {
  #byHash = new Map();                                        // stand-in for a database table
  constructor({ ttlMs = 14 * 24 * 3600_000, signAccess }) {
    this.ttlMs = ttlMs;
    this.signAccess = signAccess;
  }

  issue(userId, familyId = randomUUID()) {
    const token = randomBytes(32).toString('base64url');
    this.#byHash.set(sha256(token), {
      userId, familyId, usedAt: null, revoked: false, expiresAt: Date.now() + this.ttlMs,
    });
    return token;                                              // only the client has the raw value
  }

  revokeFamily(familyId) {
    for (const row of this.#byHash.values()) if (row.familyId === familyId) row.revoked = true;
  }

  rotate(presented) {
    const row = this.#byHash.get(sha256(presented));
    if (!row || row.revoked || row.expiresAt < Date.now()) throw new Error('INVALID_REFRESH_TOKEN');

    if (row.usedAt) {                                          // a used token came back: possible theft
      this.revokeFamily(row.familyId);
      throw new Error('REFRESH_TOKEN_REUSED');
    }
    row.usedAt = Date.now();                                   // in SQL: UPDATE ... WHERE used_at IS NULL, check rowCount

    return {
      accessToken: this.signAccess(row.userId),
      refreshToken: this.issue(row.userId, row.familyId),      // same family, a new token
    };
  }
}

// behaviour
const svc = new TokenService({ signAccess: (id) => `access-for-${id}` });
const r1 = svc.issue('user-1');
const { refreshToken: r2 } = svc.rotate(r1);       // normal refresh: r1 is now used, r2 is active
svc.rotate(r2);                                    // another normal refresh: r3 issued
svc.rotate(r1);                                    // throws REFRESH_TOKEN_REUSED and revokes the family
// from now on r2 and r3 also fail with INVALID_REFRESH_TOKEN, so the thief and the user must log in again
```

Tokens are random and only their hashes are stored. Each works once, all tokens of a login share a family id, and presenting a used token revokes the whole family. In a real database the "mark as used" must be a single atomic statement so two simultaneous requests cannot both succeed, and an optional grace period avoids false alarms from two browser tabs.

### [coding] Implement TOTP verification (RFC 6238) with a one-step drift window, constant-time comparison and replay protection. {#coding-totp}

```javascript
import { createHmac, timingSafeEqual } from 'node:crypto';

function hotp(secret, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));                                  // 8-byte big-endian counter
  const hmac = createHmac('sha1', secret).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;                            // dynamic truncation
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * @param secret  Buffer with the shared secret
 * @param token   the 6 digits typed by the user
 * @param lastUsedCounter  highest counter already accepted for this user (replay protection)
 * @returns the counter that matched, to be stored, or null
 */
export function verifyTotp(secret, token, { lastUsedCounter = -1, step = 30, window = 1, now = Date.now() } = {}) {
  if (!/^\d{6}$/.test(token)) return null;
  const current = Math.floor(now / 1000 / step);

  for (let w = -window; w <= window; w++) {
    const counter = current + w;
    if (counter <= lastUsedCounter) continue;                              // this step (or older) was already used
    const expected = hotp(secret, counter);
    if (timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return counter;
  }
  return null;
}

// RFC 6238 test vector: secret "12345678901234567890", at 59 seconds the 6-digit code is 287082
const secret = Buffer.from('12345678901234567890');
const counter = verifyTotp(secret, '287082', { now: 59_000 });             // 1
verifyTotp(secret, '287082', { now: 59_000, lastUsedCounter: counter });   // null: replay is rejected
```

The code is an HMAC of the time step, truncated to digits. The window accepts the previous and next 30-second step for clock drift, the comparison is constant-time, and returning the counter lets the caller store it and refuse the same code twice. The attempt rate must still be limited, because a 6-digit code has only a million possibilities.
