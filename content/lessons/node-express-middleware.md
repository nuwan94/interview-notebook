---
title: Express middleware in depth — the layer stack, next(), routers, context and error flow
nav: Express middleware
slug: node-express-middleware
summary: Express middleware in depth, how Express stores and runs layers, the (req, res, next) contract, ordering and mount paths, next(), next(err), next('route') and next('router'), application, router and route-level middleware, req.url, baseUrl and originalUrl, Router, mergeParams and router.param, writing middleware factories, async middleware in Express 4 and 5, error-handling middleware and the default handler, built-in and common third-party middleware, body parsers and raw bodies for webhook signatures, request context with AsyncLocalStorage, timing and logging with res finish and close events, authentication and authorisation middleware, testing middleware, performance, and a minimal Express-like runner, compared with Java servlet filters and Spring interceptors, with examples and interview questions.
tags: [Express, Node.js, Middleware, Routing, Error handling, AsyncLocalStorage, Backend, Full stack]
order: 71
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

[The Express lesson](lesson:node-express#middleware) introduced middleware and why its order matters. Interviews go deeper. They ask:

- What exactly does `next` do?
- How does Express decide which layer runs?
- What is the difference between `next()`, `next(err)`, `next('route')` and `next('router')`?
- How does mounting a router change `req.url`?
- How do you write middleware that takes settings?
- How are errors from async code handled?
- How do you check a webhook signature that needs the raw body?
- How do you keep a request id available in deep code?
- Could you write the middleware engine yourself?

The examples are JavaScript and TypeScript, with banking APIs. Play the four scenes: the layer stack, the `next()` family, routers and mount paths, and context, hooks and raw bodies.

```demo
name: middleware-walk
```

> **One sentence to remember:** *Express walks a list of layers in the order you registered them.*

`next` moves on to the next matching layer. An error skips ahead to the error handlers, which take four arguments. Everything else, such as routing, parsing and auth, is just another layer.

## What middleware is {#what}

A **middleware** is a function that receives three things: the request, the response and a function called `next`.

```javascript
function middleware(req, res, next) {
  // 1. do something with req or res
  // 2. then EITHER end the response, OR call next()
}
```

It can do four things:

- **Run any code.**
- **Change `req` and `res`.** For example, it adds `req.user` or parses the body.
- **End the request.** It sends a response, and nothing after it runs.
- **Call `next`.** This passes control to the next layer.

Routing is middleware too. A route handler is simply a layer that matches one method and one path.

## How Express runs it {#stack}

Inside, an application holds an **ordered array of layers**. Every `Router` holds one too. Each layer has three parts:

- a **path matcher**, which checks the URL;
- an optional **HTTP method**, such as `GET`;
- a **function** to call.

Every `app.use(...)`, `app.get(...)` and `router.use(...)` adds one layer to the array. The first scene shows this.

When a request arrives, Express runs a loop:

1. Take the next layer in the array.
2. Check whether its path and method match the request. If not, go back to step 1.
3. Call the layer's function with `(req, res, next)`.
4. The function now does one of three things. It calls `next()`, which goes back to step 1. It ends the response. Or it throws, or calls `next(err)`.
5. If the array runs out and nobody responded, Express calls its **final handler**. This sends a 404, or a 500 if there was an error.

So `next` just means "continue the loop from here". There is no separate route table. The order you register layers is the order they run. **The first layer that ends the response wins.**

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

- `app.use([path], fn)` matches **any method**. It matches any URL that **starts with** `path`, which defaults to `/`. Use it for layers that apply to many routes, and for mounting routers.
- `app.get('/x', fn)` matches **one method and the whole path**. The same goes for `post`, `put`, `patch` and `delete`.
- `app.all('/x', fn)` matches any method on one exact path.
- `app.route('/x').get(a).post(b)` chains several methods on one path.
- You can pass **several handlers**, or an **array** of them: `app.post('/transfers', authenticate, validate(schema), handler)`.

**Order is a design decision.** The last frame of the first scene shows what goes wrong:

| Problem | Cause |
| --- | --- |
| `req.body` is `undefined` in a route | the body parser is registered after the route |
| a "public" endpoint is open or an "admin" one needs no token | auth registered after (or not on) the route |
| CORS preflight fails with 401 | auth runs before the CORS layer, and `OPTIONS` carries no token |
| logs miss rejected requests | the logger is registered after the layer that rejects them |
| static files pass through auth and logging | `express.static` registered after them |
| errors are not formatted | the error middleware is not last |

## The next() family {#next}

This is the second scene. There are four ways to pass control on:

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

- **Respond or call `next`, never both.** If you send a response and then call `next()`, later layers run on a finished response. That causes `ERR_HTTP_HEADERS_SENT`. Write `return res.status(401).json(...)`, so the function stops there.
- **If you do neither, the request hangs** until it times out.
- If a layer **throws synchronously**, Express catches it and treats it as `next(err)`.
- If you call `next` **twice**, the rest of the chain runs twice.
- `next(err)` starts the error flow when you pass an **`Error`**. Any other truthy value does the same, except `'route'` and `'router'`.

## Levels of middleware {#levels}

| Level | How | Runs for |
| --- | --- | --- |
| **application** | `app.use(fn)` | every request that matches, for the whole app |
| **router** | `router.use(fn)` | requests reaching that router |
| **route** | `app.post('/x', fn1, fn2, handler)` | only that route |
| **built-in** | `express.json()`, `express.static()` | shipped with Express |
| **third-party** | `helmet()`, `cors()`, `compression()` | npm packages |
| **error-handling** | `(err, req, res, next)` | only after `next(err)` or a throw |

Use the **narrowest level** that works. Then a public endpoint does not pay for admin checks. And a heavy body parser does not run for a `GET`.

## Mount paths, routers and req.url {#mount}

This is the third scene. A **`Router`** is a small application. It has its own stack of layers, and you mount it under a prefix.

```javascript
const accounts = express.Router();
accounts.get('/', list);              // GET  /api/accounts
accounts.get('/:id', getOne);         // GET  /api/accounts/42
app.use('/api/accounts', accounts);
```

Inside a mounted router or middleware, Express **removes the mount path** from `req.url`. So the code does not depend on where it is mounted.

| For `GET /api/accounts/42?x=1` inside the router | Value |
| --- | --- |
| `req.originalUrl` | `/api/accounts/42?x=1` (never changes) |
| `req.baseUrl` | `/api/accounts` (the mounted part) |
| `req.url` | `/42?x=1` (relative to the mount) |
| `req.path` | `/42` |

This has three results:

- Log `req.originalUrl`, not `req.url`.
- Build links with `req.baseUrl`.
- A middleware mounted with `app.use('/static', ...)` sees paths without `/static`.

**Params in nested routers.** A child router does not see its parent's path parameters. To see them, create it with `mergeParams`:

```javascript
const transfers = express.Router({ mergeParams: true });      // gets :accountId from the parent path
transfers.get('/', (req, res) => res.json(loadTransfers(req.params.accountId)));
app.use('/accounts/:accountId/transfers', transfers);
```

**`router.param`** registers a function for one named parameter. It runs once per request, wherever that parameter appears in the router. So it is a good place to load the resource and check who owns it:

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

In Express 5, wildcard paths need a name, such as `/*splat`. Path syntax is also stricter than in Express 4.

## Writing middleware {#writing}

Write **plain middleware** when the behaviour is fixed. Write a **factory** when it needs settings. A factory is a function that takes the settings and returns the middleware.

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

- **Keep each one small.** One job per function, and combine them in a list.
- **Do not block the event loop.** Avoid synchronous file or crypto work. Use the async versions, or a worker thread ([never block the loop](lesson:node-runtime#runtime)).
- **Put results on `req` or `res.locals`**, under a documented name. Never use global variables, because requests overlap.
- **Return after responding** (`return res.status(...)`), so the function does not carry on.
- **Fail fast.** Run cheap checks first, such as the size limit and auth. Run expensive work after, such as a database lookup or validation.
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

- **Express 5:** if an `async` middleware throws or rejects, Express passes the error to `next(err)` **for you**.
- **Express 4:** it does not. The rejection goes unhandled, and the request hangs. Wrap the function with a helper, or call `next` yourself:

```javascript
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(asyncHandler(async (req, res, next) => {
  req.user = await verifyToken(req.get('authorization'));     // a rejection reaches the error handler
  next();
}));
```

- Do not mix the two styles. An `async` function that also calls `next` from a callback can end up calling it twice.

**Composition.** An array is a valid middleware list. So you can build chains and reuse them:

```javascript
const protect = [authenticate, requireRole('admin')];
app.use('/admin', protect, adminRouter);
```

## Context, hooks and logging {#context}

This is the fourth scene.

**Per-request data.** There are three places to keep it. Prefer them in this order:

1. **Properties on `req`**, such as `req.user` or `req.account`. Use these for data the next handlers need.
2. **`res.locals`**, for data meant for the response or a template.
3. **`AsyncLocalStorage`**, for code that **cannot see `req`**. A request id needed in a deep service, or in a repository's log line, is the usual case. It keeps a store that follows the request through every `await` and callback.

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

Later, the `authenticate` middleware can set `requestStore.getStore().userId`.

**Code after the handler.** A middleware cannot wait for the handler by awaiting `next()`. This is because `next()` returns before the response is sent. Listen to the response's events instead:

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

- **`finish`** fires when the response has been fully sent.
- **`close`** fires when the connection ends. That also happens when the client leaves before the end. Check `res.writableFinished` to tell the two apart.
- The status code is only known at the end, so **log in `finish`**.
- Avoid overriding `res.json` or `res.end` to catch the body. It is fragile, so do it only when you must.

## Error-handling middleware {#errors}

A function with **four parameters**, `(err, req, res, next)`, is an error handler. Express spots it by checking `fn.length === 4`. So keep all four, even if you never use `next`.

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

- `next(err)` or a throw makes Express **skip every normal layer**. It goes to the **next error handler** after the current position.
- An error handler can call `next(err)` to pass the error to a later one. This builds a chain, for example log first, then format. If an error handler calls `next()` with no argument, the **normal flow resumes**. That is how you recover.
- If there is no error handler, Express uses its **default** one. It logs the stack, except in production. It sends `err.status`, or 500. In production it sends a generic message. If headers were already sent, it closes the connection.
- **Where errors come from:**
  - a synchronous throw;
  - `next(err)`;
  - a rejected promise in Express 5, or in a wrapped handler in Express 4;
  - errors from body parsers, such as `entity.too.large` and `entity.parse.failed`.
- **What Express does not catch:** an exception inside a `setTimeout` or an event callback, and a rejected promise that nobody awaited. These become process-level `uncaughtException` or `unhandledRejection` events ([error handling in Node](lesson:node-runtime#errors)).
- Each router can have **its own error handler**, registered after that router. For example, one API router returns JSON errors and another returns HTML.

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

**Settings that act like middleware:**

- `app.set('trust proxy', 1)`, when the app runs behind a load balancer;
- `app.disable('x-powered-by')`;
- `app.set('etag', ...)`.

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

`express.json()` reads the request stream, parses it, and stores the result in `req.body`. These options matter:

- **`limit`:** reject bodies larger than this, with a 413. Always set it.
- **`type`:** which content types to parse. The default is `application/json`.
- **`strict`:** accept only objects and arrays at the top level. The default is true.
- **`verify(req, res, buf, encoding)`:** runs with the **raw bytes**, before parsing. You can keep the bytes, or throw to reject the request.
- When parsing fails, the parser calls `next(err)`. The error is `entity.parse.failed` (400) or `entity.too.large` (413). Your error middleware handles it.
- A body can be read **only once**. If two parsers run on the same request, the second sees nothing. Once a stream has been read, you cannot read it again.

**Webhooks and signatures.** A payment provider signs the **exact bytes** it sends, using an HMAC. An HMAC is a hash of the bytes mixed with a shared secret. If you parse the JSON and turn it back into a string, the spacing and key order change. Then the signature no longer matches. So that route must use the **raw body**:

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

Two more steps. Include a **timestamp** in the signed data, and reject old ones. This stops replays, where an attacker resends an old valid request. And respond quickly, then process the event in the background.

## Authentication and authorisation layers {#auth}

Keep the two concerns apart, and combine them:

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

**Public routes** must not be blocked by `authenticate`. Health checks and login are examples. Register them before `authenticate`, or mount `authenticate` on `/api` only. A cleaner way is to group the protected routers behind it. See [JWT validation](lesson:jwt#validation).

## Testing middleware {#testing}

Test at two levels:

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

Test the behaviour that depends on order with the real `createApp()` ([supertest](lesson:node-express#testing)). Check each of these:

- a request without a token gets 401;
- a preflight gets 204;
- a body that is too large gets 413;
- an unknown path gets the JSON 404;
- a thrown error gets the error format.

## Performance and pitfalls {#performance}

- Every request walks the layer list. So keep **global** layers few and fast. Attach the rest to the routers and routes that need them.
- Serve **static files first**, or from a CDN or proxy. Then they skip logging, auth and parsing.
- Parse bodies only where needed, such as `express.json()` on write routes. Always set a **limit**.
- **No heavy synchronous work** in middleware, because it blocks every request. Hash passwords and compress with async or worker-based APIs.
- **Async middleware that forgets `next`** hangs the request. In Express 4, an unhandled rejection hangs it too.
- **Memory leaks** come from two habits. One is storing per-request data in module-level variables. The other is adding event listeners to a shared object on each request.
- Keep the **error middleware last**, with the 404 layer just before it.
- **Do not trust** headers you use for identity or logging, such as `X-Request-Id` and `X-Forwarded-For`. Validate them, or configure `trust proxy`.

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

Middleware is a function `(req, res, next)` that runs in the request pipeline.

It can do four things. It can run any code. It can change `req` and `res`. It can end the request by sending a response. Or it can call `next()` to pass control to the next matching layer.

Parsing, logging, authentication and even route handlers are all middleware. They sit in one list, and Express walks that list in order.

### [basic] What does `next()` do and what happens if you forget it? {#next-q}

`next()` tells Express to continue with the next matching layer in the list.

If a middleware neither sends a response nor calls `next`, the request never finishes. It hangs until a timeout.

Calling `next()` after responding is also wrong. Later layers then run against a finished response, which causes `headers already sent` errors.

### [basic] What is the difference between `app.use` and `app.get`? {#use-get-q}

`app.use(path?, fn)` matches every HTTP method, and any URL that starts with the path. The path defaults to `/`. So it is used for layers that apply to many routes, and for mounting routers.

`app.get(path, handler)` matches only `GET` requests for that exact path.

Inside a `use` layer, the matched prefix is removed from `req.url`.

### [basic] Why does the order of middleware matter? {#order-q}

Layers run in the order you register them, and the first one that ends the response wins.

So each layer must come before the layers that depend on it:

- a body parser before the routes that read `req.body`;
- CORS before authentication, so preflights are answered;
- authentication before protected routes;
- `express.static` early, so files skip everything else;
- the 404 and error handlers last.

The wrong order changes behaviour without any error. For example, a route becomes open without auth, or a body arrives empty.

### [basic] How does Express recognise an error-handling middleware? {#error-mw-q}

By its arity, meaning the number of parameters it declares. An error handler declares four: `(err, req, res, next)`.

Express calls it only after `next(err)` or a throw, and skips normal layers on the way. It must be registered after the layers that may fail.

If you declare only three parameters, Express treats it as ordinary middleware, even if you meant it as an error handler.

### [intermediate] What are the differences between `next()`, `next(err)`, `next('route')` and `next('router')`? {#next-family-q}

- `next()` continues to the next matching layer.
- `next(err)` signals an error. Express skips all normal layers, and goes to the next error-handling middleware.
- `next('route')` skips the rest of the handlers on the current route, and continues with the next matching route. It is useful when one of several handlers decides the route does not apply.
- `next('router')` leaves the current router, and returns to its parent. It is useful for a guard at the top of a router.

### [intermediate] How does mounting a router change `req.url`, and what are `baseUrl` and `originalUrl`? {#mount-q}

Inside a router mounted at `/api/accounts`, Express removes the mount path from `req.url`. So a request for `/api/accounts/42` shows `req.url = '/42'`.

- `req.baseUrl` holds the mounted prefix, `/api/accounts`.
- `req.originalUrl` always holds the full original URL.

Because of this, the router can declare its routes relative to itself. Use `originalUrl` for logging, and `baseUrl` when building links.

### [intermediate] How do you share data from a middleware with later handlers, and with code that does not receive `req`? {#share-q}

For later handlers, set a property on `req`, such as `req.user`, or on `res.locals`. In TypeScript, declare its type.

For code that never receives `req`, such as a repository or a logger deep in the call stack, use `AsyncLocalStorage`. A middleware calls `als.run(store, next)`. After that, any code in the same request can read `als.getStore()`, even after `await`s.

Do not use module-level variables. Requests run at the same time, so they would overwrite each other's data.

### [intermediate] How do you run code after the handler has finished, for example to log the status code and duration? {#after-q}

Record the start time before calling `next()`. Then listen to the response's events.

- `res.on('finish')` fires when the response has been fully sent. At that point the status code and duration are known.
- `res.on('close')` fires when the connection ends. This includes a client that leaves before the end. Check `res.writableFinished` to tell the cases apart.

You cannot await `next()` instead, because it returns before the response is sent.

### [intermediate] How do you handle async errors in Express 4 versus Express 5? {#async-q}

In Express 5, a rejected promise or a throw from an async middleware goes to `next(err)` automatically.

In Express 4 it does not. The rejection is unhandled, and the request hangs. So you wrap each handler with a helper such as `fn(req, res, next).catch(next)`, or use a package like `express-async-errors`.

In both versions, Express does not catch errors inside timer or event callbacks.

### [intermediate] Why do webhook signature checks need `express.raw` and how do you compare the signature? {#webhook-q}

The provider signs the exact bytes it sent. If you parse the JSON and serialise it again, the whitespace and key order can change. Then the HMAC no longer matches.

So follow these steps:

1. Capture the raw `Buffer` for that route with `express.raw({ type: 'application/json' })`. The `verify` option of `express.json` also works.
2. Compute `HMAC-SHA256` with the shared secret.
3. Check the lengths are equal, then compare with `crypto.timingSafeEqual`. This avoids timing attacks.
4. Check a timestamp, to block replays.
5. Only then parse the JSON.

Register the webhook route before the global JSON parser.

### [intermediate] What does `router.param` do? {#param-q}

It registers a callback for one named route parameter. The callback runs once per request, before the route handlers, wherever that parameter appears in the router.

It is used to load a resource, such as an account by `:id`. It checks ownership, attaches the resource to `req`, and calls `next(err)` when it is missing. So the handlers do not repeat the lookup.

### [deep] How does Express route a request internally? {#internals-q}

Each application and router holds an array of layers. Each layer has a path matcher, an optional method and a handler function.

On a request, Express calls a `next` function that loops through the array:

1. It takes the next layer.
2. It skips the layer if the path or method does not match.
3. Otherwise it calls the layer's function with `(req, res, next)`.

While an error is in flight, it only calls layers whose function has four parameters. Without an error, it skips those layers.

Mounted routers do the same with their own array. They strip the mount path from `req.url`, and restore it afterwards.

If the array runs out, the final handler responds with a 404, or a 500 for an error.

### [deep] Compare Express middleware with Java servlet filters and Spring interceptors. {#java-q}

A servlet `Filter` wraps the rest of the chain. Code before `chain.doFilter` runs on the way in, and code after it runs on the way out, in the same stack frame. So one filter can time the whole request.

Express middleware has no "after" inside the same function. `next()` returns at once, and the response is sent later. So you use `res.on('finish')`.

Spring interceptors split the work into three methods: `preHandle`, `postHandle` and `afterCompletion`.

Express also differs in three more ways:

- It puts filters, routing and error handling in one list.
- It finds error handlers by arity, instead of `@ControllerAdvice`.
- It uses `AsyncLocalStorage` where Java uses `ThreadLocal` and MDC, because Node has no thread per request.

### [deep] How would you order the global middleware of a production API, and why? {#prod-order-q}

Each layer goes before the layers that need its work. The order is:

1. Static files, so they skip everything else.
2. A request-context layer, which sets the request id.
3. The access logger, so every API request is logged, even rejected ones.
4. `helmet`.
5. CORS, before authentication, so preflights succeed.
6. Webhook routes, with their own raw body parser.
7. `express.json`, with a size limit.
8. Rate limiting.
9. Authentication on the protected routers.
10. The feature routers, each with its own authorisation and validation.
11. A 404 layer.
12. The error handler, last.

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

Explain these points:

- The core is a recursive `next` function over an array of layers.
- It skips layers whose path or method does not match.
- It skips error handlers when there is no error, and normal layers when there is one.
- It turns synchronous throws and rejected promises into `next(err)`.
- When the array runs out, it falls through to a final 404 or 500.
- Real Express does more. It strips mount paths, supports path parameters, and supports `next('route')` with a stack per route.

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

Explain these points:

- `als.run(store, next)` starts the store for everything that runs after it, including across `await`s.
- So `findAccount`, and every other function, can read the id without it being passed down.
- The incoming id is validated before it is reused. A client cannot inject odd characters or huge strings into the logs.
- The log line is written on `finish`, when the status and duration are known.
- `close` without `writableFinished` records a client that left early.

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

Explain these points:

- The signature covers the timestamp and the exact raw bytes.
- The comparison is constant-time, after a length check.
- Old timestamps are rejected, which blocks replays.
- The raw parser is set on this route only, and mounted before `express.json`.
- Otherwise `express.json` would read the stream first, and leave nothing to hash.
- The handler acknowledges fast, and a queue processes the event later.
