---
title: Authentication in Node.js — passwords, sessions, JWT, refresh rotation, MFA and attacks
nav: Node.js authentication
slug: node-authentication
summary: Implementing authentication in a Node.js and Express API, storing passwords with argon2id, scrypt or bcrypt and salts, login without account enumeration and timing leaks, rehashing, server-side sessions with express-session and Redis and secure cookie flags, session fixation, JWT access tokens with the jose library, algorithm and claim validation, refresh token rotation with reuse detection, sessions versus tokens and the backend for frontend, OIDC and social login with Passport and openid-client, TOTP and passkeys with step-up authentication, password reset and email verification tokens, API keys and service authentication, brute force and credential stuffing defences, CSRF, logging and testing, compared with Spring Security, with banking examples and interview questions.
tags: [Node.js, Authentication, Passwords, Sessions, JWT, Refresh tokens, MFA, TOTP, Security, Backend, Full stack]
order: 72
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

In backend interviews, authentication tests your judgement, not your syntax. Expect questions like these:

- How do you store passwords, and why not with SHA-256?
- How does login avoid revealing which emails exist?
- Session or JWT, and where does the token live?
- How do refresh tokens work, and what does rotation protect against?
- How do you add MFA?
- How do you make a password reset safe?
- How do you stop brute force?
- What do you log?

This lesson builds those parts in Node.js and Express. It builds on the ideas in [authentication and authorisation](lesson:authn-authz#basics), [JWT](lesson:jwt#validation) and [OAuth 2.0](lesson:oauth2#tokens). It uses the layers from [Express middleware](lesson:node-express-middleware#auth). The examples use bank accounts. Play the four scenes: passwords and login, session or token, refresh token rotation, and defence in depth.

```demo
name: auth-node-walk
```

> **One sentence to remember:** *Store only a slow salted hash, and answer every failed login the same way.*

Then prove the login with a session you can revoke, or a short-lived token plus a rotating refresh token. Ask for a second factor before risky actions. Log every event, but never a secret.

## Authentication and where it fits {#basics}

**Authentication** answers "who are you?". **Authorisation** answers "what may you do?". This lesson covers the first, plus the points where it hands over to the second.

An authentication system has five parts:

| Part | Job | Examples |
| --- | --- | --- |
| **credential** | proof of identity | password, passkey, one-time code, API key |
| **verification** | checking the proof | hash comparison, signature check |
| **session or token** | remembering the login between requests | session id cookie, JWT, refresh token |
| **recovery** | a safe way back | password reset, account recovery |
| **protection** | making attacks expensive | rate limits, MFA, monitoring |

**Build or buy?** For anything beyond a simple app, prefer an identity provider (IdP), such as Keycloak, Auth0, Cognito, Okta or a bank's own. Connect to it with **OpenID Connect**, and let your API only **verify tokens**. Writing your own password storage, MFA and recovery is hard to get right. It is a common cause of breaches.

You still need to know how it works. Interviewers ask, and many systems still keep their own login.

## Storing passwords {#passwords}

Rules:

1. **Never** store the password. Never encrypt it either, because encryption can be reversed.
2. Use a **slow, memory-hard, salted** password hash:
   - **argon2id** is the current recommendation;
   - **scrypt** is also good;
   - **bcrypt** is older but still acceptable. Only its first 72 bytes count.

   Do not use MD5, SHA-1 or plain SHA-256. They are built to be fast. So an attacker with a leaked database tries billions of guesses a second on a GPU.
3. A **salt** is a random value stored with the hash, different for every user. Two users with the same password then get different hashes. It also defeats rainbow tables, which are precomputed lists of hashes.
4. A **pepper** is an extra secret kept outside the database, in a secret manager or HSM. It is mixed in with an HMAC. A stolen database alone is then not enough. It is an optional extra layer.
5. Store the **algorithm, its parameters and the salt** in one string with the hash. Then you can **upgrade** the settings later.
6. Compare hashes in **constant time**, so the time taken reveals nothing.

With a package, call `argon2.hash(password)` and `argon2.verify(hash, password)` from the `argon2` npm package. Or call `bcrypt.hash(password, 12)` and `bcrypt.compare`. Node.js also has **scrypt built in**:

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

- **Cost is a trade-off.** Aim for about 50 to 250 ms per hash on your hardware.
  - Hashing runs on the libuv **thread pool**, which has 4 threads by default ([thread pool](lesson:node-runtime#runtime)).
  - Many logins at once can fill it, which also slows `fs` and DNS.
  - So **rate limit login**. Consider a larger `UV_THREADPOOL_SIZE`, or a separate service.
- **Limit the password length** before hashing, for example to 128 characters. Otherwise an attacker can send a 10 MB "password" to burn CPU.
- **Password policy**, following NIST 800-63B:
  - set a **minimum length** of 8 or more, with 12 recommended;
  - allow long passphrases and every character;
  - **check against lists of breached passwords**, for example with k-anonymity range queries to Have I Been Pwned;
  - do **not** force regular password changes or arbitrary complexity rules;
  - show a strength meter, and let password managers paste.
- **Rehash on login.** After a successful check, if `needsRehash(stored)` is true, hash again with the current settings and save. The cost rises over the years, and nobody is forced to reset.

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

Why each detail matters:

- An unknown email and a wrong password get the **same response**. The **dummy hash** makes the timing similar too. Otherwise login, registration and password reset all let an attacker **enumerate accounts**, which means find out who is registered.
- **Normalise the email**: lower case, with spaces trimmed. Put a **unique index** on the normalised value.
- **Verify the email address** before trusting the account. See below.
- Use **HTTPS only**. Never put credentials in a URL or a log line.
- **Rate limit** by IP **and** by account ([rate limiting](lesson:node-express#security)). A distributed attack uses many IPs against one account.

## Server-side sessions {#sessions}

A **session** keeps the login state on the **server**. The browser holds only a random **session id** in a cookie. The second scene shows this.

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

**Cookie flags.** Each one blocks an attack:

| Flag | Effect |
| --- | --- |
| `HttpOnly` | JavaScript cannot read it, so XSS cannot steal the session id |
| `Secure` | sent only over HTTPS |
| `SameSite=Lax` or `Strict` | not sent on cross-site sub-requests, which blocks most CSRF |
| `__Host-` name prefix | the browser enforces Secure, `Path=/` and no `Domain`, so another subdomain cannot overwrite it |
| `Max-Age` | idle lifetime (use both an idle and an **absolute** timeout) |

**Session security checklist:**

- **Session fixation.** An attacker plants a session id they know in the victim's browser. The victim logs in. Now the attacker holds a logged-in id. To stop it, **issue a new id at login**, and again whenever privileges change.
- **Hijacking**, meaning someone steals a live session. Use HTTPS, `HttpOnly` and short timeouts. Optionally tie the session to rough client data, and ask the user to log in again before sensitive actions.
- **Storage.** Use a shared store such as Redis, with a TTL. The default in-memory store leaks memory, and it breaks when you run several instances.
- **Revocation** is instant: delete the record. Do this on logout, password change, "log out everywhere" or an account ban. Keep an index of each user's sessions, so you can delete them all.
- **CSRF**, or cross-site request forgery. The browser sends cookies automatically, even on requests another site triggers. So protect requests that change state with `SameSite`, a CSRF token, or a required custom header. The token can be a synchroniser token or a double-submit cookie. Never change state on a `GET`.

## JWT access tokens {#jwt}

A **JSON Web Token** (JWT) is a signed set of claims. The server, or a separate auth service, signs it. Any API that has the verification key can check it **without a database call** ([JWT basics](lesson:jwt#what)). Use the **`jose`** library:

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

- **Verify the token. Never just decode it.** Check the signature, `exp`, `nbf`, **`iss`** and **`aud`**. Allow only the algorithms you expect, with a **whitelist**. This blocks `alg: none` and the attack that swaps RS256 for HS256.
- **Asymmetric keys** (ES256, RS256, EdDSA) let many services verify with a public key. The key usually comes from the issuer's **JWKS** endpoint, through `createRemoteJWKSet`, and is cached. **HS256** uses one shared secret. It is fine only when the same service both signs and verifies.
- **Keep the lifetime short**, 5 to 15 minutes. A signed token **cannot be revoked** before it expires.
- **Keep claims small and non-sensitive.** A JWT is only signed, not encrypted, so anyone can read the payload. Never put secrets or personal data in it, such as account numbers or full names.
- Never rely on the token for permissions that must be accurate right now. The claims can be up to 15 minutes old.
- **Where the client keeps it.** Any script can read a token in `localStorage`, so XSS can steal it. Two better options:
  - a **BFF** (backend for frontend) that holds the tokens, and gives the browser an httpOnly session cookie;
  - the token in memory, plus a refresh token in an httpOnly cookie ([where to store tokens](lesson:fullstack-integration#auth)).

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

A common bank setup: the browser talks to a **BFF with a session cookie**, and the BFF uses tokens to call internal APIs.

## Refresh token rotation {#refresh}

A short access token must be renewed often. So the client also holds a **refresh token**. This is a long, random, **opaque** string, not a JWT. The client exchanges it for a new access token.

Two habits limit the damage if it is stolen. Store only its hash. And **rotate** it on every use. The third scene shows this.

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

- Every refresh returns a **new** refresh token, and marks the old one **used**. Each token works **once**.
- All tokens from one login share a **family id**. Suppose a used token comes back. Then two parties hold copies, one of them stolen, and you cannot tell which. So **revoke the whole family**. The user signs in again, and the thief's token is dead.
- **Store only hashes**, as with passwords. A fast hash is fine here, because the token has 256 bits of randomness. A database leak then leaks no usable tokens.
- **Races and multiple tabs.** Two tabs refreshing at the same moment look like reuse. Use an atomic update. Optionally allow a short **grace period**, for example 10 seconds, in which the previous token works once more.
- **Absolute lifetime.** A family should end after a maximum age, for example 30 days, even if it is used all the time.
- Send it in an **httpOnly, Secure, SameSite=Strict cookie, limited to the refresh path** (`Path=/auth/refresh`). Then it is not sent with other requests.
- **Logout** revokes the family. **A password change** revokes every family of that user.

## OpenID Connect and social login {#oidc}

When an identity provider handles login, your app is a **relying party**. It uses the **authorization code flow with PKCE** ([OIDC flow](lesson:oidc#flow)). In Node.js, use **`openid-client`**, a certified client library, or **Passport** strategies:

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

This shows `openid-client` v6. Check the version you install, because its API changed between major versions.

Each part has a job:

- **`state`** blocks CSRF on the callback.
- **`nonce`** ties the ID token to this session.
- **PKCE** stops an attacker who intercepts the code from using it.

Also:

- Validate the **ID token**: signature, `iss`, `aud`, `exp` and `nonce`.
- Match users by the stable **`sub`** claim, not by email.
- Trust an email only when `email_verified` is true.
- Avoid open redirects. Allow-list the URL the user returns to after login.

## Multi-factor authentication {#mfa}

With a second factor, a stolen password is not enough. Common factors:

- **TOTP** (RFC 6238). A 6-digit code from an authenticator app. It is computed from a shared secret and the current 30-second time step.
- **Passkeys and WebAuthn.** Public-key credentials, tied to the site and stored on the device or a security key. They are **phishing-resistant**, and the best option. Use a library such as `@simplewebauthn/server`.
- **SMS and email codes.** Weak, because of SIM swaps and interception, but better than nothing.
- **Recovery codes.** Single-use codes, stored as hashes, shown once when the user enrols.

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

- **Store the TOTP secret encrypted**, not hashed, because the server must read it back. Generate it with `randomBytes(20)`. Show it as a QR code (an `otpauth://` URI) at enrolment. Ask for one valid code to **confirm** enrolment.
- **Reject a reused code.** Remember the last accepted counter for each user. Otherwise a phished code works again within its window.
- **Rate limit** code attempts. A 6-digit code has only a million values.
- **Step-up authentication.** Ask for a fresh factor before risky actions: adding a payee, a large transfer, or changing the password or phone. Record `authTime` and the **assurance level** in the session or token. Ask the user to authenticate again when `authTime` is older than a limit.

## Password reset and email verification {#reset}

In many systems, reset is the weakest link, because it is a second way to log in.

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

- Tokens are **random, long, hashed in the database, short-lived and single-use**.
- Put the token in the URL **fragment** (after `#`), or send it in a POST. Then it does not appear in server logs or `Referer` headers.
- Give a **generic response**, so the form cannot be used to find out which emails exist.
- After a reset, **invalidate all sessions and refresh tokens**, and **email the user** to tell them.
- **Email verification** uses the same pattern. Send a random single-use token to the address. The account stays limited until it is confirmed.
- **Changing the email or password** while logged in should require the current password or a fresh factor.

## API keys and service authentication {#service}

- **API keys** identify a **client application**, not a person.
  - Generate them randomly, with a readable prefix and an id: `bk_live_<id>_<secret>`.
  - Store only a **hash of the secret**. Look the key up by its id, and compare in constant time.
  - Show the key **once**.
  - Support **rotation**, scopes, expiry and a rate limit per key.
- **Service to service.** Use the OAuth 2.0 **client credentials** grant, where a service gets a short-lived token with its own identity. Or use **mutual TLS** inside a service mesh. Do not pass a user's token between services without careful audience and scope handling.
- **Webhooks** are checked with an **HMAC signature** over the raw body ([verifying signatures](lesson:node-express-middleware#bodies)).
- **Secrets**, such as signing keys, client secrets and the pepper, live in a secret manager. Rotate them, and never commit them.

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

Locking an account after N failures lets an attacker **lock out real users**. That is a denial of service. So prefer growing delays, a CAPTCHA after several failures, and notifications.

## Logging, monitoring and testing {#ops}

- **Audit log.** Make it structured, and include the request id. Record:
  - login success and failure;
  - MFA events;
  - password changes and resets;
  - refresh token reuse;
  - session revocation;
  - role changes.

  **Never log** passwords, tokens, reset links or full card numbers. Alert on spikes of failures, on many accounts tried from one IP, on logins from new devices or countries, and on refresh reuse.
- **Unit tests.** Cover:
  - `hashPassword`, `verifyPassword` and `needsRehash`;
  - `rotateRefreshToken`, including reuse and the race;
  - `verifyTotp`, with the RFC test vectors;
  - JWT verification, with a wrong `aud`, an expired token and a wrong algorithm.
- **Integration tests.** Drive the login endpoint with supertest ([testing Express](lesson:node-express#testing)). Check that:
  - an unknown email and a wrong password get the same response;
  - the cookie flags are present;
  - the session id changes at login;
  - logout invalidates the session;
  - the rate limit returns 429.

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

Store the output of a slow, salted, memory-hard password hash, such as argon2id, scrypt or bcrypt. Keep the algorithm, its parameters and the salt in one string with the hash.

SHA-256 is designed to be fast. An attacker with a leaked database can test billions of guesses a second on a GPU.

A random salt for each user makes equal passwords hash differently, and makes precomputed rainbow tables useless. The cost parameter can be raised over time as hardware gets faster. Passwords are never stored in plain text, and never encrypted.

### [basic] What is the difference between authentication and authorisation? {#authn-authz-q}

Authentication establishes who the caller is, with a password, a token or a certificate. When it fails, the answer is 401.

Authorisation decides what that identity may do, using roles, scopes or ownership of an object. When it fails, the answer is 403.

In an Express API, authentication is a middleware that sets `req.user`. Authorisation is further middleware, plus checks in the service.

### [basic] What is a salt and what is a pepper? {#salt-q}

A salt is a random value, different for every password, stored next to the hash. It makes equal passwords produce different hashes, and makes precomputed tables useless. It is not secret.

A pepper is a secret value kept outside the database, in a secret manager or HSM, and mixed into the hashing. Then even a full database leak is not enough to crack passwords.

The salt is required. The pepper is an optional extra layer.

### [basic] How do you prevent account enumeration on login? {#enumeration-q}

Return the same status and body for an unknown email and for a wrong password.

Make the timing similar too. Always run a password hash, using a precomputed dummy hash when the user does not exist.

Apply the same rule to registration ("check your email") and to password reset ("if that email exists, we sent a link"). Any difference lets an attacker learn which accounts exist.

### [basic] Where should the session id or token be stored in the browser? {#storage-q}

In an httpOnly, Secure, SameSite cookie, so JavaScript cannot read it. Any injected script can steal a token kept in `localStorage`.

If a single-page app must hold an access token itself, keep it in memory, and put the refresh token in an httpOnly cookie.

Better still, use a backend for frontend. It keeps the tokens on the server, and gives the browser only a session cookie.

### [intermediate] Compare server-side sessions and JWT access tokens. When would you choose each? {#session-vs-jwt-q}

A session keeps state on the server, usually in Redis, and the browser holds a random id. Revocation is immediate. The cost is a lookup on every request, and a store shared by all instances.

A JWT carries signed claims. Any service with the public key verifies it, with no database call. But it cannot be revoked before it expires. So it must be short-lived, and paired with refresh tokens.

Sessions suit a single web app and its backend. Tokens suit several services, mobile apps and third parties. A backend for frontend combines both: a session cookie for the browser, and tokens between servers.

### [intermediate] What must you validate when you receive a JWT? {#jwt-validate-q}

Check all of these:

- the signature, with the right key;
- the algorithm, against a whitelist, which blocks `alg: none` and key-confusion attacks;
- `exp` and `nbf`;
- the issuer, `iss`;
- the audience, `aud`.

Fetch keys from the issuer's JWKS and cache them. Use `kid` to pick the key, so keys can rotate. Then apply authorisation with scopes and roles.

Never just decode a token and trust the payload. Never put secrets in it, because it is signed, not encrypted.

### [intermediate] How does refresh token rotation with reuse detection work? {#rotation-q}

The access token is short-lived. The client exchanges an opaque, random refresh token for a new one.

On each exchange, the server issues a new refresh token and marks the old one used. It stores only hashes. A family id links all the tokens from one login.

If a used token comes back, either the user or a thief has an old copy. So the server revokes the entire family, and forces a new login. That makes the stolen token useless.

Atomic updates, and an optional short grace period, avoid false alarms when two tabs refresh at once.

### [intermediate] What is session fixation and how do you prevent it? {#fixation-q}

The attacker makes the victim use a session id the attacker already knows, planted before login. When the victim logs in, that session becomes authenticated. Now the attacker can use it.

To prevent it:

- issue a new session id at login with `req.session.regenerate`, and again when privileges change;
- never accept session ids from URLs;
- use HttpOnly and Secure cookies.

### [intermediate] How do you make password reset safe? {#reset-q}

Generate a long, random, single-use token. Store only its hash, with a short expiry of 15 to 60 minutes. Email a link that carries the token in the URL fragment or a POST body.

Respond the same way whether or not the email exists, and rate limit the endpoint.

On success, consume the token and set the new password hash. Invalidate all sessions and refresh tokens, and notify the user.

Never use predictable tokens, never let a token be reused, and never reveal whether the account exists.

### [intermediate] How do you defend against brute force and credential stuffing? {#bruteforce-q}

Use several layers:

- rate limit login per IP and per account, with growing delays;
- add a global limit and bot detection;
- require MFA;
- check new passwords against breached-password lists;
- alert on spikes, and on logins from new devices.

Avoid permanent lockout, because it lets an attacker deny service to real users. Prefer temporary delays, a CAPTCHA after repeated failures, and notifications.

Also make sure the slow hash cannot be used to exhaust the CPU. Limit the request rate and the password length.

### [intermediate] How does TOTP work and what must you remember when implementing it? {#totp-q}

Both sides share a secret. The code is an HMAC, SHA-1 by default, of the current 30-second time-step counter, cut down to 6 digits. This is RFC 6238, built on HOTP from RFC 4226.

The server must:

- compute the code for the current step and one step either side, to tolerate clock drift;
- compare in constant time;
- reject any counter already used;
- rate limit attempts;
- store the secret encrypted;
- require a confirming code at enrolment;
- provide recovery codes.

Passkeys are stronger, because they resist phishing.

### [deep] Why can a signed JWT not be revoked, and how do you cope? {#revoke-q}

Verification needs only the signature and the expiry. No server is asked whether the token is still valid.

To cope, keep access tokens short, a few minutes, and revoke the refresh token. Then the damage window is small.

For immediate revocation there are three options:

- a small deny-list of `jti` values, or a per-user "valid after" timestamp, checked on each request. This brings back a lookup.
- opaque tokens with introspection, for high-risk systems;
- sessions instead of tokens.

The right choice trades revocation speed against statelessness.

### [deep] How would you design authentication for a banking web app with a React front end and Express APIs? {#design-q}

Use an OIDC identity provider with MFA and passkeys. Put a backend for frontend (BFF) in Node.js in front of the APIs. The BFF runs the authorization code flow with PKCE, and keeps the access and refresh tokens on the server.

The browser gets only a session cookie: httpOnly, Secure and SameSite. It has idle and absolute timeouts, a CSRF defence, and a new id at login.

Internal APIs verify short-lived JWTs from a JWKS. They check issuer, audience, algorithm and scopes.

Moving money requires step-up authentication. Rate limits and idempotency keys apply. Every event is logged with a request id. Sessions and tokens are revoked on a password change or suspicious activity. See [the integration lesson](lesson:fullstack-integration#auth).

### [deep] What are the weaknesses of SMS codes and how do passkeys improve on them? {#passkey-q}

SMS codes have three weaknesses:

- They can be intercepted through SIM swapping or SS7 attacks.
- An attacker can talk the phone carrier into redirecting them.
- A fake site can phish them, and relay them to the real site in real time.

A passkey (WebAuthn) is a public-key credential tied to the site's origin. The private key never leaves the device. The browser signs a server challenge only for the genuine domain. There is nothing to type, so there is nothing to phish.

Passkeys are also faster for users. And the server stores only public keys, so a leak exposes no secrets.

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

Explain these points:

- The salt is random for each password.
- The parameters travel with the hash. So each user is verified with the settings used when their hash was made.
- `timingSafeEqual` avoids timing leaks.
- The length limits block CPU abuse.
- `needsRehash` upgrades weak hashes the next time the user logs in.

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

Explain these points:

- Tokens are random, and only their hashes are stored.
- Each token works once.
- All tokens from one login share a family id.
- Presenting a used token revokes the whole family.
- In a real database, "mark as used" must be one atomic statement. Then two requests at the same time cannot both succeed.
- An optional grace period avoids false alarms from two browser tabs.

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

Explain these points:

- The code is an HMAC of the time step, cut down to 6 digits.
- The window also accepts the previous and next 30-second step, for clock drift.
- The comparison is constant-time.
- Returning the counter lets the caller store it, and refuse the same code twice.
- The attempt rate must still be limited, because a 6-digit code has only a million possibilities.
