---
title: Express middleware in depth — the layer stack, next(), routers, context and error flow
nav: Express middleware
slug: node-express-middleware
summary: Express middleware in depth, how Express stores and runs layers, the (req, res, next) contract, ordering and mount paths, next(), next(err), next('route') and next('router'), application, router and route-level middleware, req.url, baseUrl and originalUrl, Router, mergeParams and router.param, writing middleware factories, async middleware in Express 4 and 5, error-handling middleware and the default handler, built-in and common third-party middleware, body parsers and raw bodies for webhook signatures, request context with AsyncLocalStorage, timing and logging with res finish and close events, authentication and authorisation middleware, testing middleware, performance, and a minimal Express-like runner, compared with Java servlet filters and Spring interceptors, with examples and interview questions.
tags: [Express, Node.js, Middleware, Routing, Error handling, AsyncLocalStorage, Backend, Full stack]
order: 71
topic: Full stack / Node.js
updated: 2026-11-18
subnav: true
---

[The Express lesson](lesson:node-express#middleware) introduced middleware and its order. Interviews go further: *what exactly does `next` do, how does Express decide which layer runs, what is the difference between `next()`, `next(err)`, `next('route')` and `next('router')`, how does mounting change `req.url`, how do you write configurable middleware, how are async errors handled, how do you verify a webhook signature that needs the raw body, how do you keep a request id available in deep code, and could you write the middleware engine yourself?* Examples are JavaScript and TypeScript with banking APIs. Play the four scenes: the layer stack, the `next()` family, routers and mount paths, and context and the error path.

```demo
name: middleware-walk
```

> **One sentence to remember:** *Express is a list of layers walked in registration order, `next` moves to the next matching layer, an error skips to the four-argument error handlers, and everything else (routing, parsing, auth) is just a layer.*

## What middleware is {#what}

A **middleware** is a function with access to the request, the response and the `next` function:

```javascript
function middleware(req, res, next) {
  // 1. do something with req or res
  // 2. then EITHER end the response, OR call next()
}
```

It can do four things: **run any code**, **change `req` and `res`** (add `req.user`, parse a body), **end the request-response cycle** (send a response), or **call `next`** to pass control on. Routing itself is middleware: a route handler is a layer that matches a method and a path.

## How Express runs it {#stack}

Internally an application (and every `Router`) holds an **ordered array of layers**. Each layer has a **path matcher**, an optional **HTTP method** and a **function**. Every `app.use(...)`, `app.get(...)`, `router.use(...)` pushes a layer (the first scene).

When a request arrives, Express runs a loop:

1. Take the next layer in the array.
2. Does its path (and method) match the request? If not, go to 1.
3. Call the layer's function with `(req, res, next)`.
4. The function calls `next()` to go to step 1, ends the response, or throws or calls `next(err)`.
5. If the array is exhausted with nobody responding, call the **final handler**: a 404, or a 500 if there was an error.

So `next` is just "continue the loop from where we are". There is no separate "route table": registration order is the execution order, and **the first layer that ends the response wins**.

```javascript
app.use(logger);                          // layer 1: every request
app.use(express.json());                  // layer 2: every request
app.get('/health', (req, res) => res.json({ ok: true }));   // layer 3: GET /health only
app.use('/api', authenticate);            // layer 4: paths starting with /api
app.use('/api/accounts', accountsRouter); // layer 5
app.use((req, res) => res.status(404).json({ code: 'NOT_FOUND' }));     // layer 6: nothing matched
app.use((err, req, res, next) => { /* ... */ });                        // layer 7: errors, last
```

**`app.use` versus `app.METHOD`.**

- `app.use([path], fn)` matches **any method** and any URL that **starts with** `path` (default `/`). It is for cross-cutting layers and for mounting routers.
- `app.get('/x', fn)` (and `post`, `put`, `patch`, `delete`) matches **one method and the whole path**.
- `app.all('/x', fn)` matches any method on one exact path.
- `app.route('/x').get(a).post(b)` chains several methods on one path.
- You can pass **several handlers** or an **array**: `app.post('/transfers', authenticate, validate(schema), handler)`.

**Order is a design decision** (the first scene's last frame):

| Problem | Cause |
| --- | --- |
| `req.body` is `undefined` in a route | the body parser is registered after the route |
| a "public" endpoint is open or an "admin" one needs no token | auth registered after (or not on) the route |
| CORS preflight fails with 401 | auth runs before the CORS layer, and `OPTIONS` carries no token |
| logs miss rejected requests | the logger is registered after the layer that rejects them |
| static files pass through auth and logging | `express.static` registered after them |
| errors are not formatted | the error middleware is not last |

## The next() family {#next}

The second scene. There are four ways to continue:

| Call | Meaning |
| --- | --- |
| `next()` | continue with the **next matching layer** |
| `next(err)` | **error**: skip all normal layers, go to the next **error-handling** layer |
| `next('route')` | skip the **remaining handlers of the current route** and go on to the next matching route |
| `next('router')` | leave the **current router** entirely and go back to its parent |

```javascript
// next('route'): several handlers on one route, one may decide the route does not apply
app.get('/accounts/:id',
  (req, res, next) => (req.params.id === 'me' ? next('route') : next()),   // /accounts/me goes to the next route
  (req, res) => res.json(loadById(req.params.id)),
);
app.get('/accounts/me', (req, res) => res.json(loadCurrent(req.user)));

// next('router'): a guard at the top of a router
adminRouter.use((req, res, next) => (req.user?.roles.includes('admin') ? next() : next('router')));
```

Rules:

- **Respond or call `next`, not both.** Sending a response and then calling `next()` runs later layers on a finished response and causes `ERR_HTTP_HEADERS_SENT`. Use `return res.status(401).json(...)` so the function stops.
- **If you do neither, the request hangs** until a timeout.
- A **synchronous throw** in a layer is caught by Express and treated as `next(err)`.
- Calling `next` **twice** runs the rest of the chain twice.
- `next(err)` with an **`Error`** (or any truthy value other than `'route'` and `'router'`) starts the error flow.

## Levels of middleware {#levels}

| Level | How | Runs for |
| --- | --- | --- |
| **application** | `app.use(fn)` | every request that matches, for the whole app |
| **router** | `router.use(fn)` | requests reaching that router |
| **route** | `app.post('/x', fn1, fn2, handler)` | only that route |
| **built-in** | `express.json()`, `express.static()` | shipped with Express |
| **third-party** | `helmet()`, `cors()`, `compression()` | npm packages |
| **error-handling** | `(err, req, res, next)` | only after `next(err)` or a throw |

Use the **narrowest level**, so a public endpoint does not pay for admin checks and a heavy parser is not run for `GET`.

## Mount paths, routers and req.url {#mount}

(The third scene.) A **`Router`** is a mini application: its own stack of layers, mounted under a prefix.

```javascript
const accounts = express.Router();
accounts.get('/', list);              // GET  /api/accounts
accounts.get('/:id', getOne);         // GET  /api/accounts/42
app.use('/api/accounts', accounts);
```

Inside a mounted router or middleware, Express **strips the mount path** from `req.url` so the code is independent of where it is mounted:

| For `GET /api/accounts/42?x=1` inside the router | Value |
| --- | --- |
| `req.originalUrl` | `/api/accounts/42?x=1` (never changes) |
| `req.baseUrl` | `/api/accounts` (the mounted part) |
| `req.url` | `/42?x=1` (relative to the mount) |
| `req.path` | `/42` |

Consequences: log `req.originalUrl`, not `req.url`; build links with `req.baseUrl`; and a middleware mounted with `app.use('/static', ...)` sees paths without `/static`.

**Params in nested routers.** A child router does not see the parent's path parameters unless it is created with `mergeParams`:

```javascript
const transfers = express.Router({ mergeParams: true });      // gets :accountId from the parent path
transfers.get('/', (req, res) => res.json(loadTransfers(req.params.accountId)));
app.use('/accounts/:accountId/transfers', transfers);
```

**`router.param`** runs once per request for a named parameter, wherever it appears in the router, so it is a good place to load and check the resource:

```javascript
accounts.param('id', async (req, res, next, id) => {
  const account = await repo.find(id);
  if (!account || account.ownerId !== req.user.id) return next(new AppError(404, 'ACCOUNT_NOT_FOUND'));
  req.account = account;                                       // handlers use req.account
  next();
});
accounts.get('/:id', (req, res) => res.json(req.account));
accounts.get('/:id/balance', (req, res) => res.json({ balance: req.account.balance }));
```

(In Express 5, wildcard paths use a named form such as `/*splat`, and path syntax is stricter than in 4.)

## Writing middleware {#writing}

**Plain middleware** for a fixed behaviour, and a **factory** (a function that returns the middleware) when it needs configuration:

```javascript
// factory: configuration in, middleware out
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ code: 'UNAUTHENTICATED' });
  if (!roles.some((r) => req.user.roles.includes(r))) return res.status(403).json({ code: 'FORBIDDEN' });
  next();
};

app.delete('/accounts/:id', authenticate, requireRole('admin', 'ops'), deleteAccount);
```

Guidelines:

- **Small and single-purpose**: one concern per function, composed in a list.
- **Do not block the event loop**: no synchronous file or crypto work. Use the async versions or a worker ([never block the loop](lesson:node-runtime#runtime)).
- **Put results on `req` or `res.locals`**, with a documented name, not on global variables (requests overlap).
- **Return after responding** (`return res.status(...)`) so the function does not continue.
- **Failing fast:** cheap checks first (size limit, auth), expensive work (database lookup, validation) after.
- **Typing in TypeScript:**

```typescript
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';

declare global {
  namespace Express {
    interface Request { user?: { id: string; roles: string[] }; requestId?: string }
  }
}

export const requireRole = (...roles: string[]): RequestHandler => (req, res, next) => { /* ... */ };
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => { /* ... */ };
```

**Async middleware.**

- **Express 5**: an `async` middleware that throws or rejects is passed to `next(err)` **automatically**.
- **Express 4**: it is not. The rejection is unhandled, and the request hangs. Wrap it with a helper or call `next` yourself:

```javascript
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(asyncHandler(async (req, res, next) => {
  req.user = await verifyToken(req.get('authorization'));     // a rejection reaches the error handler
  next();
}));
```

- Do not mix the styles: an `async` function that also calls `next` in a callback can call it twice.

**Composition.** An array is a valid middleware list, so you can build reusable chains:

```javascript
const protect = [authenticate, requireRole('admin')];
app.use('/admin', protect, adminRouter);
```

## Context, hooks and logging {#context}

(The fourth scene.)

**Per-request data.** Three places, in order of preference:

1. **`req` properties** (`req.user`, `req.account`) for data the next handlers need.
2. **`res.locals`** for data meant for the response or a template.
3. **`AsyncLocalStorage`** for data that code **without access to `req`** needs, such as a request id in a deep service or a repository's log line. It carries a store through `await`s and callbacks:

```javascript
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const requestStore = new AsyncLocalStorage();

export function requestContext(req, res, next) {
  const incoming = req.get('X-Request-Id');
  const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();   // never trust it blindly
  res.set('X-Request-Id', requestId);
  requestStore.run({ requestId, userId: null }, next);     // everything after this sees the store
}

// anywhere, even deep in a repository, without passing req around
export const log = (msg, extra) =>
  console.log(JSON.stringify({ msg, ...extra, requestId: requestStore.getStore()?.requestId }));
```

The `authenticate` middleware can later set `requestStore.getStore().userId`.

**Code after the handler.** A middleware cannot "wait for the handler" by awaiting `next()`, because `next()` returns before the response is sent. Listen to response events instead:

```javascript
export function accessLog(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {                                  // response fully handed to the network
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log('request', { method: req.method, url: req.originalUrl, status: res.statusCode, ms });
  });
  res.on('close', () => {                                   // connection closed, also when the client aborted
    if (!res.writableFinished) log('client aborted', { url: req.originalUrl });
  });
  next();
}
```

- **`finish`**: the response was fully sent. **`close`**: the underlying connection ended, which also happens when the client disconnects before the end (check `res.writableFinished`).
- Because the status code is known only at the end, **log in `finish`**.
- Avoid overriding `res.json` or `res.end` to intercept the body unless you must, because it is fragile.

## Error-handling middleware {#errors}

A function with **four parameters** `(err, req, res, next)` is an error handler. Express detects it by `fn.length === 4`, so keep all four even if you do not use `next`.

```javascript
export class AppError extends Error {
  constructor(status, code, message) { super(message); Object.assign(this, { status, code }); }
}

export function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);               // status line is already sent: let Express close the connection

  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) log('unhandled error', { err: err.stack });
  res.status(status).json({
    code: err.code ?? 'INTERNAL_ERROR',
    message: status >= 500 ? 'Something went wrong' : err.message,     // no internals in 5xx
    requestId: requestStore.getStore()?.requestId,
  });
}

app.use(notFound);
app.use(errorHandler);                                  // last
```

How the error flow works:

- `next(err)` or a throw makes Express **skip every normal layer** and go to the **next error handler** after the current position. A normal handler is skipped while an error is in flight.
- An error handler may call `next(err)` to pass to a later one (a chain: log, then format). Calling `next()` without an argument from an error handler **resumes the normal flow**, which is how you recover.
- If no error handler exists, Express uses its **default**: it logs the stack (outside production), sends the `err.status` (or 500) and, in production, a generic message. If headers were already sent, it closes the connection.
- **Where errors come from:** a sync throw, `next(err)`, a rejected promise in Express 5 (or a wrapped handler in 4), and errors emitted by body parsers (`entity.too.large`, `entity.parse.failed`).
- **Not caught by Express:** an exception in a `setTimeout` or event callback, and a rejected promise nobody awaited. They become process-level `uncaughtException` or `unhandledRejection` ([error handling in Node](lesson:node-runtime#errors)).
- You can have **different handlers per router** (an API error format versus an HTML one), registered after that router.

## Built-in and common middleware {#common}

| Middleware | Purpose | Notes |
| --- | --- | --- |
| `express.json()` | parse JSON bodies | `limit` (default 100 kb), `type`, `strict`, `verify`. Sets `req.body` |
| `express.urlencoded({ extended })` | parse HTML form bodies | |
| `express.raw()`, `express.text()` | body as a `Buffer` or string | needed for signature checks |
| `express.static(dir, opts)` | serve files | `maxAge`, `immutable`, `etag`, `fallthrough`. Mount before logging and auth |
| `helmet()` | security headers | HSTS, `X-Content-Type-Options`, CSP |
| `cors(opts)` | CORS headers and preflight | allow-list, before auth ([CORS](lesson:node-express#security)) |
| `compression()` | gzip or brotli responses | usually done by the reverse proxy instead |
| `pino-http`, `morgan` | request logging | with a request id |
| `cookie-parser`, `express-session` | cookies and server sessions | sessions need a shared store (Redis) with several instances |
| `express-rate-limit` | throttling | shared store across instances |
| `multer`, `busboy` | multipart uploads | stream to disk or storage, set limits |
| `express-validator`, zod middleware | input validation | [validation](lesson:node-express#validation) |
| `passport` | strategy-based login | |

**Settings that act like middleware:** `app.set('trust proxy', 1)` behind a load balancer, `app.disable('x-powered-by')`, `app.set('etag', ...)`.

**A typical production order:**

```javascript
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use('/assets', express.static('public', { maxAge: '1y', immutable: true }));   // static first: skip everything else
app.use(requestContext);                    // request id
app.use(accessLog);                         // sees every API request
app.use(helmet());
app.use(cors(corsOptions));                 // before auth, answers preflights
app.use('/webhooks', webhookRouter);        // needs the RAW body, so before express.json
app.use(express.json({ limit: '100kb' }));  // everything below gets parsed bodies
app.use('/api', rateLimiter);
app.use('/api', authenticate);
app.use('/api/accounts', accountsRouter);
app.use(notFound);
app.use(errorHandler);
```

## Body parsers and raw bodies {#bodies}

`express.json()` reads the request stream, parses it and stores the result in `req.body`. Options that matter:

- **`limit`**: reject bodies larger than this (413). Always set it.
- **`type`**: which content types to parse (default `application/json`).
- **`strict`**: accept only objects and arrays at the top level (default true).
- **`verify(req, res, buf, encoding)`**: runs with the **raw bytes** before parsing, so you can keep them or throw to reject.
- Parsing failures call `next(err)` with `entity.parse.failed` (400) or `entity.too.large` (413), handled by your error middleware.
- A body can be consumed **once**. Two parsers on the same request means the second sees nothing. If a stream was already read, you cannot read it again.

**Webhooks and signatures.** A payment provider signs the **exact bytes** it sends with an HMAC. If you parse the JSON and stringify it again, spacing and key order change and the signature no longer matches. So use the **raw body** for that route:

```javascript
import crypto from 'node:crypto';

export const verifySignature = (secret) => (req, res, next) => {
  const received = Buffer.from(req.get('X-Signature') ?? '', 'hex');
  const expected = crypto.createHmac('sha256', secret).update(req.body).digest();   // req.body is a Buffer here

  const valid = received.length === expected.length && crypto.timingSafeEqual(received, expected);
  if (!valid) return res.status(401).json({ code: 'INVALID_SIGNATURE' });           // constant-time compare

  try {
    req.body = JSON.parse(req.body.toString('utf8'));                               // now it is safe to parse
  } catch {
    return res.status(400).json({ code: 'INVALID_JSON' });
  }
  next();
};

app.post('/webhooks/payments',
  express.raw({ type: 'application/json', limit: '1mb' }),    // raw Buffer for this route only
  verifySignature(process.env.WEBHOOK_SECRET),
  (req, res) => { handleEvent(req.body); res.sendStatus(200); },
);
```

Also use a **timestamp** in the signed payload and reject old ones (replay protection), and respond quickly then process the event asynchronously.

## Authentication and authorisation layers {#auth}

Separate the two concerns and compose them:

```javascript
// 1. who is calling? (401 when unknown)
export async function authenticate(req, res, next) {
  const token = req.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ code: 'MISSING_TOKEN' });
  try {
    req.user = await verifyJwt(token);                        // signature, expiry, issuer, audience
    next();
  } catch {
    res.status(401).json({ code: 'INVALID_TOKEN' });
  }
}

// 2. what may they do? (403 when not allowed)
export const requireScope = (scope) => (req, res, next) =>
  req.user.scopes.includes(scope) ? next() : res.status(403).json({ code: 'FORBIDDEN' });

// 3. is it theirs? (object-level check, in router.param or the service)
accounts.param('id', ownedAccountLoader);

accounts.post('/:id/transfers', requireScope('transfers:write'), validate(transferSchema), makeTransfer);
```

**Public routes** are registered **before** `authenticate`, or authentication is mounted on `/api` only, so health checks and login are not blocked. A cleaner approach is to mount the protected routers behind it as a group. See [JWT validation](lesson:jwt#validation).

## Testing middleware {#testing}

Two levels:

```javascript
// 1. Unit test: call the function with fake req, res and next
test('requireRole rejects a missing role with 403', () => {
  const req = { user: { roles: ['user'] } };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();

  requireRole('admin')(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

// 2. Integration test: a tiny app with only the middleware under test, driven by supertest
test('the error handler formats AppError', async () => {
  const app = express();
  app.get('/boom', () => { throw new AppError(422, 'BAD', 'nope'); });
  app.use(errorHandler);

  const res = await request(app).get('/boom');
  expect(res.status).toBe(422);
  expect(res.body.code).toBe('BAD');
});
```

Test the **order-sensitive** behaviour with the real `createApp()` ([supertest](lesson:node-express#testing)): a request without a token gets 401, a preflight gets 204, an oversize body gets 413, an unknown path gets the JSON 404, and a thrown error gets the error format.

## Performance and pitfalls {#performance}

- Every request walks the layer list, so keep **global** layers few and fast, and attach the rest to the routers and routes that need them.
- Serve **static files first** (or from a CDN or proxy) so they skip logging, auth and parsing.
- Parse bodies only where needed (`express.json()` on write routes), and always set a **limit**.
- **No synchronous heavy work** in middleware, because it blocks every request. Hash passwords and compress with async or worker-based APIs.
- **Async middleware that forgets `next`** hangs the request. In Express 4, an unhandled rejection also hangs it.
- **Memory leaks:** storing data in module-level variables per request, or adding event listeners to a shared object on each request.
- Keep **error middleware last**, and make sure the 404 layer is before it.
- **Do not trust** headers you use for identity or logging (`X-Request-Id`, `X-Forwarded-For`) without validating or configuring `trust proxy`.

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| calling `next()` after sending a response | `return res...` and stop |
| neither responding nor calling `next` | every path ends the cycle or continues |
| error handler with three parameters | keep all four, or Express treats it as normal middleware |
| error middleware registered before the routes | register it last |
| body parser after the routes, or before a route that needs the raw body | order, and a route-level `express.raw` |
| auth before CORS | CORS first so preflights work |
| using `req.url` for logs inside a router | log `req.originalUrl` |
| a global variable for per-request data | `req`, `res.locals` or `AsyncLocalStorage` |
| `async` middleware in Express 4 without a wrapper | wrap it or upgrade to Express 5 |
| stringifying parsed JSON to verify a signature | verify the raw bytes |
| comparing signatures with `===` | `crypto.timingSafeEqual` |
| a heavy synchronous operation in a layer | async or a worker |
| the same body parsed twice | one parser per request path |
| one giant file of global middleware | routers with their own layers |

## For a Java developer {#java}

| Spring and Servlet | Express |
| --- | --- |
| `Filter` and `FilterChain.doFilter(req, res)` | middleware and `next()` |
| the servlet filter chain, ordered by `@Order` or registration | the layer stack, ordered by registration |
| `HandlerInterceptor.preHandle`, `postHandle`, `afterCompletion` | code before `next()`, and `res.on('finish')` for after |
| `OncePerRequestFilter` | an application-level layer |
| Spring Security `SecurityFilterChain` | `authenticate` and `requireRole` layers in a router |
| `@ControllerAdvice` and `@ExceptionHandler` | error-handling middleware |
| `HandlerMethodArgumentResolver`, `@RequestBody` binding | `express.json()` and a validation layer |
| `RequestContextHolder`, `ThreadLocal`, MDC | `AsyncLocalStorage` (thread locals do not exist, because there is one thread) |
| `@PathVariable` pre-loading with a `@ModelAttribute` | `router.param` |
| `@RequestMapping("/api/accounts")` on a controller | `app.use('/api/accounts', router)` |
| `ContentCachingRequestWrapper` for the raw body | `express.raw` or the `verify` option |
| `chain.doFilter` not called short-circuits | not calling `next()` ends the chain |

Try it in the lab: [The Express middleware chain and why order matters](lab:express-middleware-chain).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| middleware | `(req, res, next)`: act, then respond or call `next` |
| engine | ordered layers, first matching layer runs, `next` resumes the scan |
| `use` vs `get` | `use` matches any method and a path prefix, `get` one method and an exact path |
| `next()` | continue |
| `next(err)` | skip to the four-argument error handlers |
| `next('route')` | skip the rest of this route's handlers |
| `next('router')` | leave this router |
| levels | app, router, route, built-in, third-party, error |
| mounting | `req.url` loses the mount path, `req.originalUrl` and `req.baseUrl` keep it |
| `mergeParams` | child router sees parent params |
| `router.param` | load a resource once per parameter |
| factory | `(config) => (req, res, next) => ...` |
| async | Express 5 forwards rejections, Express 4 needs a wrapper |
| after the handler | `res.on('finish')` and `res.on('close')` |
| request context | `req`, `res.locals`, `AsyncLocalStorage` |
| error handler | four parameters, last, `res.headersSent` check |
| raw body | `express.raw` or `verify`, HMAC with `timingSafeEqual` |
| order | static, context, log, helmet, cors, webhooks, json, rate limit, auth, routes, 404, errors |

## Interview questions {#questions}

### [basic] What is middleware in Express? {#what-q}

A function `(req, res, next)` that runs in the request pipeline. It can run any code, change `req` and `res`, end the cycle by sending a response, or call `next()` to pass control to the next matching layer. Parsing, logging, authentication and even route handlers are all middleware, registered in a list that Express walks in order.

### [basic] What does `next()` do and what happens if you forget it? {#next-q}

`next()` tells Express to continue with the next matching layer in the list. If a middleware neither sends a response nor calls `next`, the request is never finished and hangs until a timeout. Calling it after responding is also wrong, because later layers then run against a finished response and cause `headers already sent` errors.

### [basic] What is the difference between `app.use` and `app.get`? {#use-get-q}

`app.use(path?, fn)` matches every HTTP method and any URL that starts with the path (default `/`), so it is used for cross-cutting layers and for mounting routers. `app.get(path, handler)` matches only `GET` requests for that exact path. Inside a `use` layer the matched prefix is removed from `req.url`.

### [basic] Why does the order of middleware matter? {#order-q}

Layers run in registration order and the first one that ends the response wins. A body parser must come before the routes that read `req.body`, CORS before authentication so preflights are answered, authentication before protected routes, `express.static` early so files skip everything else, and the 404 and error handlers last. Wrong order silently changes behaviour, such as unauthenticated access or empty bodies.

### [basic] How does Express recognise an error-handling middleware? {#error-mw-q}

By its arity: a function declared with four parameters `(err, req, res, next)`. Express calls it only after `next(err)` or a throw, skipping normal layers on the way, and it must be registered after the layers that may fail. If you declare only three parameters it is treated as ordinary middleware, even if you meant it as an error handler.

### [intermediate] What are the differences between `next()`, `next(err)`, `next('route')` and `next('router')`? {#next-family-q}

`next()` continues to the next matching layer. `next(err)` signals an error: Express skips all normal layers and goes to the next error-handling middleware. `next('route')` skips the rest of the handlers of the current route and continues with the next matching route, useful when one of several handlers decides the route does not apply. `next('router')` exits the current router and returns to its parent, useful for a guard at the top of a router.

### [intermediate] How does mounting a router change `req.url`, and what are `baseUrl` and `originalUrl`? {#mount-q}

Inside middleware or a router mounted at `/api/accounts`, Express removes the mount path from `req.url`, so a request for `/api/accounts/42` shows `req.url = '/42'`. `req.baseUrl` holds the mounted prefix (`/api/accounts`) and `req.originalUrl` always holds the full original URL. The router can therefore declare routes relative to itself. Use `originalUrl` for logging and `baseUrl` when building links.

### [intermediate] How do you share data from a middleware with later handlers, and with code that does not receive `req`? {#share-q}

For later handlers, set a property on `req` (`req.user`) or `res.locals`, and declare the type in TypeScript. For code that does not receive `req` (a repository or logger deep in the call stack), use `AsyncLocalStorage`: a middleware calls `als.run(store, next)` and any code in that request, including after `await`s, reads `als.getStore()`. Do not use module-level variables, because concurrent requests would overwrite each other.

### [intermediate] How do you run code after the handler has finished, for example to log the status code and duration? {#after-q}

Record the start time before calling `next()` and listen to the response events: `res.on('finish')` fires when the response has been fully handed to the network, which is when the status code and duration are known, and `res.on('close')` fires when the connection ends, including when the client aborts before the end (check `res.writableFinished`). You cannot await `next()`, because it returns before the response is sent.

### [intermediate] How do you handle async errors in Express 4 versus Express 5? {#async-q}

In Express 5 a rejected promise (or a throw) from an async middleware or handler is passed to `next(err)` automatically. In Express 4 it is not, so the rejection is unhandled and the request hangs; you wrap handlers with a helper such as `fn(req, res, next).catch(next)` or use a package like `express-async-errors`. Errors in timer or event callbacks are not caught by Express in either version.

### [intermediate] Why do webhook signature checks need `express.raw` and how do you compare the signature? {#webhook-q}

The provider signs the exact bytes it sent. Parsing the JSON and serialising it again can change whitespace and key order, so the HMAC no longer matches. Capture the raw `Buffer` for that route with `express.raw({ type: 'application/json' })` (or the `verify` option of `express.json`), compute `HMAC-SHA256` with the shared secret, compare with `crypto.timingSafeEqual` (after checking equal lengths) to avoid timing attacks, check a timestamp against replays, and only then parse the JSON. Register the webhook route before the global JSON parser.

### [intermediate] What does `router.param` do? {#param-q}

It registers a callback that runs once per request for a named route parameter, before the route handlers, wherever the parameter appears in that router. It is used to load a resource (an account by `:id`), verify ownership, attach it to `req` and call `next(err)` when missing, so handlers do not repeat the lookup.

### [deep] How does Express route a request internally? {#internals-q}

Each application and router holds an array of layers, each with a path matcher, an optional method and a handler function. On a request, Express calls a `next` function that loops through the array: it takes the next layer, skips it if the path or method does not match, otherwise calls its function with `(req, res, next)`. While an error is in flight it only calls layers whose function has four parameters, and without an error it skips those. Mounted routers do the same with their own array and strip the mount path from `req.url`, restoring it afterwards. If the array is exhausted the final handler responds with 404, or 500 for an error.

### [deep] Compare Express middleware with Java servlet filters and Spring interceptors. {#java-q}

A servlet `Filter` wraps the rest of the chain: code before `chain.doFilter` runs on the way in and code after it on the way out, in the same stack frame, so a filter can time the full request. Express middleware has no "after" in the same function, because `next()` returns immediately and the response is sent later, so you use `res.on('finish')`. Spring interceptors split into `preHandle`, `postHandle` and `afterCompletion`. Express also unifies filters, routing and error handling in one list, uses arity to find error handlers instead of `@ControllerAdvice`, and uses `AsyncLocalStorage` where Java uses `ThreadLocal` and MDC, since Node has no thread per request.

### [deep] How would you order the global middleware of a production API, and why? {#prod-order-q}

Static files first so they skip everything else, then a request-context layer (request id), the access logger (so every API request is logged, even rejected ones), `helmet`, then CORS before authentication so preflights succeed, webhook routes with their raw body parser, `express.json` with a size limit, rate limiting, authentication on the protected routers, the feature routers (each with their own authorisation and validation), a 404 layer, and the error handler last. Each choice follows from what must see the request before the next layer can do its job.

### [coding] Implement a minimal Express-like app with `use`, `get`, `next`, error-handling middleware (detected by arity) and async support. {#coding-mini}

```javascript
class MiniApp {
  #layers = [];

  use(...args) {
    const path = typeof args[0] === 'string' ? args.shift() : '/';
    for (const fn of args) this.#layers.push({ path, fn, method: null, exact: false });
    return this;
  }

  get(path, ...fns) {
    for (const fn of fns) this.#layers.push({ path, fn, method: 'GET', exact: true });
    return this;
  }

  handle(req, res, done = finalHandler) {
    let i = 0;

    const next = (err) => {
      if (err === 'route' || err === 'router') err = undefined;      // simplified: treat like next()
      const layer = this.#layers[i++];
      if (!layer) return done(err, req, res);                        // end of the list

      const pathOk = layer.exact ? req.url === layer.path
        : layer.path === '/' || req.url === layer.path || req.url.startsWith(layer.path + '/');
      const methodOk = !layer.method || layer.method === req.method;
      if (!pathOk || !methodOk) return next(err);                    // not for this request

      const isErrorHandler = layer.fn.length === 4;                  // detected by arity
      if (err && !isErrorHandler) return next(err);                  // skip normal layers during an error
      if (!err && isErrorHandler) return next();                     // skip error handlers in normal flow

      try {
        const result = err ? layer.fn(err, req, res, next) : layer.fn(req, res, next);
        if (result && typeof result.then === 'function') result.catch(next);   // Express 5 behaviour
      } catch (e) {
        next(e);                                                     // a sync throw becomes next(err)
      }
    };

    next();
  }
}

function finalHandler(err, req, res) {
  res.statusCode = err ? (err.status ?? 500) : 404;
  res.end(err ? 'Internal Server Error' : 'Not Found');
}

// usage
const app = new MiniApp();
app.use((req, res, next) => { req.startedAt = Date.now(); next(); });
app.get('/ok', (req, res) => res.end('ok'));
app.get('/boom', () => { throw new Error('boom'); });
app.get('/async-boom', async () => { throw new Error('async boom'); });
app.use((err, req, res, next) => { res.statusCode = 500; res.end(`handled: ${err.message}`); });
```

The core idea is the recursive `next` over an array: it skips layers that do not match, skips error handlers while there is no error and normal layers while there is one, turns sync throws and rejected promises into `next(err)`, and falls through to a final 404 or 500. A real Express also strips mount paths, supports path parameters and `next('route')` with route-level stacks.

### [coding] Write middleware that gives every request an id, stores it in `AsyncLocalStorage`, and logs method, URL, status and duration when the response finishes. {#coding-context}

```javascript
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const als = new AsyncLocalStorage();

export const getRequestId = () => als.getStore()?.requestId;

export function requestContext(req, res, next) {
  const incoming = req.get('X-Request-Id');
  const requestId = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', requestId);                      // return it, so support can quote it
  als.run({ requestId }, next);                                  // the store follows this request's async calls
}

export function accessLog(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(JSON.stringify({
      requestId: getRequestId(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms: Math.round(ms),
    }));
  });

  res.on('close', () => {
    if (!res.writableFinished) {                                  // the client left early
      console.log(JSON.stringify({ requestId: getRequestId(), url: req.originalUrl, aborted: true }));
    }
  });

  next();
}

// a repository deep in the code logs with the same id, without receiving req
export async function findAccount(id) {
  console.log(JSON.stringify({ requestId: getRequestId(), msg: 'loading account', id }));
  /* ... */
}

app.use(requestContext);
app.use(accessLog);
```

`als.run(store, next)` starts the store for everything that runs after it, including across `await`s, so `findAccount` and every other function can read the id without it being passed down. The incoming id is validated before it is reused, so a client cannot inject odd characters or huge strings into logs.

### [coding] Write middleware that verifies a payment-provider webhook (HMAC SHA-256 of the raw body, with a timestamp tolerance) and mount it correctly. {#coding-webhook}

```javascript
import crypto from 'node:crypto';
import express from 'express';

const TOLERANCE_SECONDS = 300;

export function verifyWebhook(secret) {
  return (req, res, next) => {
    // header: X-Signature: t=1731900000,v1=<hex hmac of "t.body">
    const header = req.get('X-Signature') ?? '';
    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
    const timestamp = Number(parts.t);

    if (!Buffer.isBuffer(req.body) || !timestamp || !parts.v1) {
      return res.status(400).json({ code: 'BAD_SIGNATURE_HEADER' });
    }
    if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
      return res.status(401).json({ code: 'STALE_TIMESTAMP' });          // replay protection
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(req.body)                                                   // the exact raw bytes
      .digest();
    const received = Buffer.from(parts.v1, 'hex');

    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return res.status(401).json({ code: 'INVALID_SIGNATURE' });
    }

    try {
      req.body = JSON.parse(req.body.toString('utf8'));                   // only now parse
    } catch {
      return res.status(400).json({ code: 'INVALID_JSON' });
    }
    next();
  };
}

const app = express();

// webhook route BEFORE the global JSON parser, with its own raw parser
app.post(
  '/webhooks/payments',
  express.raw({ type: 'application/json', limit: '1mb' }),
  verifyWebhook(process.env.WEBHOOK_SECRET),
  (req, res) => {
    queue.add(req.body);          // acknowledge fast, process asynchronously
    res.sendStatus(200);
  },
);

app.use(express.json({ limit: '100kb' }));   // everything else gets parsed JSON
```

The signature covers the timestamp and the exact bytes, the comparison is constant-time after a length check, old timestamps are rejected, and the raw parser is route-level and mounted before `express.json`, which would otherwise consume the stream first and leave nothing to hash.
