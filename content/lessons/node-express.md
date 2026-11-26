---
title: Express and REST APIs — middleware, routing, validation, errors, auth and testing
nav: Express and REST
slug: node-express
summary: Building REST APIs with Express on Node.js, the middleware chain and ordering, routers and route parameters, request and response, JSON bodies and size limits, validation with zod, async handlers and central error handling in Express 4 and 5, status codes, CORS and preflight, JWT authentication and authorisation middleware, rate limiting and helmet, layered structure with services and repositories, pagination and idempotency, configuration, structured logging and request ids, graceful shutdown, testing with supertest, and comparisons with Fastify, NestJS and Spring MVC, with banking examples and interview questions.
tags: [Express, Node.js, REST, Middleware, Validation, CORS, JWT, supertest, Backend, Full stack]
order: 70
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

Express questions test whether you can build a real API, not just a hello world. Interviewers ask:

- What is middleware, and why does order matter?
- How does routing work?
- How do you validate input?
- How do errors in async code reach the error handler?
- What are CORS and a preflight request?
- How do you authenticate with a JWT?
- How do you structure a service, and how do you test it?

This lesson builds on the [Node.js runtime](lesson:node-runtime#core) and on [REST API design](lesson:rest-api-design#resources), which covers resource naming, idempotency, pagination and versioning in detail. The examples are TypeScript-style JavaScript with banking endpoints.

The demo has four scenes: the middleware pipeline, validation and errors, CORS and authentication, and layers and testing.

```demo
name: express-walk
```

> **One sentence to remember:** *An Express app is an ordered chain of middleware, and order is design.*

Put security, parsing and authentication before the routes. Validate every input. Send all errors to one error handler. Keep HTTP code thin, so the business rules are easy to test.

## What Express is {#what}

**Express** is a minimal web framework for Node.js, on top of the built-in `http` module. It gives you **routing**, **middleware** and helpers for the request and response. Nothing else: no ORM, no validation, no dependency injection. You choose those libraries yourself.

That freedom is why Express is everywhere. It is also why a project needs conventions.

```js
import express from 'express';

const app = express();
app.use(express.json({ limit: '100kb' }));       // parse JSON bodies

app.get('/health', (req, res) => res.json({ status: 'UP' }));

app.get('/accounts/:id', async (req, res) => {
  const account = await accounts.findById(req.params.id);
  if (!account) return res.status(404).json({ code: 'ACCOUNT_NOT_FOUND' });
  res.json(account);
});

app.listen(3000);
```

**Express 5** is the current major version (Node 18+). The main changes from 4:

- **Rejected promises and thrown errors in async handlers go to the error handler automatically.**
- The path syntax is stricter: `/*` becomes `/*splat`.
- `req.body` is `undefined` unless a body parser ran.
- Some deprecated methods were removed.

Many existing projects still run Express 4, so know both.

**Alternatives:**

- **Fastify**: faster, with built-in schema validation and serialisation, and a plugin system.
- **NestJS**: Angular-style, with decorators, dependency injection and modules. It runs on Express or Fastify, and is the closest to Spring.
- **Koa** and **Hono**: small and modern.
- Meta-frameworks (Next.js route handlers) for full-stack apps.

## Middleware {#middleware}

**Middleware** is a function `(req, res, next)`. It runs between the request arriving and the response leaving. It can:

1. **change** `req` or `res` (parse a body, attach `req.user`),
2. **end** the response (`res.status(401).json(...)`),
3. **pass on** with `next()`, or pass an error with `next(err)`.

The first scene shows the chain. Middleware runs **in the order it was registered**, so order is design.

```js
app.use(helmet());                       // 1. security headers
app.use(cors(corsOptions));              // 2. CORS (before auth, so preflights are answered)
app.use(requestId());                    // 3. request id, logger
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: '100kb' }));   // 4. body parser with a size limit
app.use('/api', rateLimiter);            // 5. throttling
app.use('/api', authenticate);           // 6. identity
app.use('/api/accounts', accountsRouter);// 7. routes
app.use(notFound);                       // 8. unmatched request -> 404
app.use(errorHandler);                   // 9. errors, always last
```

Kinds of middleware:

- **application-level**: `app.use`,
- **router-level**: `router.use`,
- **route-level**: passed to one route, as in `app.post('/x', authenticate, handler)`,
- **built-in**: `express.json`, `express.static`,
- **third-party**: `cors`, `helmet`, `morgan`, `compression`,
- **error-handling**: with four arguments.

Common mistakes:

- forgetting both `next()` and a response: the request **hangs**,
- calling `next()` **and** sending a response: the error "headers already sent",
- registering a parser **after** the routes that need it.

```js
// Writing your own: log how long each request takes
function timing(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    req.log.info({ method: req.method, url: req.originalUrl, status: res.statusCode, ms });
  });
  next();
}
```

## Routing {#routing}

A route maps a **method and a path** to handlers. Group routes with a **`Router`**, mounted under a prefix, so each feature owns its file.

```js
// routes/accounts.js
import { Router } from 'express';
export const accountsRouter = Router();

accountsRouter.get('/', listAccounts);                       // GET  /api/accounts?limit=20&cursor=...
accountsRouter.post('/', validate(createAccountSchema), createAccount);
accountsRouter.get('/:id', getAccount);                      // req.params.id
accountsRouter.post('/:id/transfers', validate(transferSchema), makeTransfer);
```

- **Request parts:**
  - `req.params`: path segments,
  - `req.query`: the query string (strings or arrays; always validate and convert),
  - `req.body`: the parsed body,
  - `req.headers`: the headers.
- **Matching order:** the first match wins. Register specific routes before ones with parameters (`/accounts/summary` before `/accounts/:id`).
- **`res` helpers:** `res.status(201).json(body)`, `res.set('Location', url)`, `res.sendStatus(204)`, `res.redirect(...)`, `res.download(...)`, `res.send(...)`. Send **exactly one response** per request.
- **Static files:** `express.static('public')`. In production, serve them from a CDN or reverse proxy instead.
- **Behind a proxy** (a load balancer, nginx), set `app.set('trust proxy', 1)`, so `req.ip` and `req.protocol` use the forwarded values.

## REST conventions in Express {#rest}

See [REST API design](lesson:rest-api-design#resources) for the full rules. The points specific to Express:

| Concern | Do |
| --- | --- |
| Create | `POST /accounts` returns **201**, with a `Location` header and the new resource. |
| Read | `GET` returns **200**, or **404** when missing. |
| Update | `PUT` replaces, `PATCH` changes some fields. Return 200 or 204. |
| Delete | `DELETE` returns **204** with no body. Repeated deletes stay safe. |
| Bad input | **400** (malformed) or **422** (well-formed but invalid), with field errors. |
| Unauthenticated, forbidden | **401**, **403**. |
| Conflict | **409**: a duplicate, or a stale version with `If-Match` and an ETag. |
| Too many requests | **429** with `Retry-After`. |
| Server error | **500** with a generic message and a request id. Never a stack trace. |
| Money | Send amounts as **integers in minor units** (cents) or decimal strings. Never floating point. |
| Retries | Accept an **`Idempotency-Key`** header on `POST /transfers` ([idempotency](lesson:rest-api-design#idempotency)). |
| Lists | **Cursor or page-based pagination**, with a maximum page size ([pagination](lesson:rest-api-design#pagination)). |

Use one JSON error shape, such as RFC 9457 **problem details**:

```json
{ "type": "https://api.bank.example/errors/insufficient-funds", "title": "Insufficient funds",
  "status": 422, "detail": "Balance 50.00 is below 120.00", "requestId": "b3f1c2" }
```

## Validation {#validation}

Never trust `req.body`, `req.query` or `req.params`. Validate at the edge with a **schema library** (**zod**, joi, ajv, valibot). The schema can also give you **TypeScript types**.

```js
import { z } from 'zod';

export const transferSchema = z.object({
  body: z.object({
    toAccount: z.string().regex(/^[A-Z]{2}\d{10}$/),
    amount: z.number().int().positive().max(1_000_000_00),   // minor units
    currency: z.enum(['SGD', 'USD', 'EUR']),
    reference: z.string().max(140).optional(),
  }).strict(),                                                // reject unknown fields
  params: z.object({ id: z.string().uuid() }),
});

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
  if (!result.success) {
    return res.status(400).json({
      title: 'Validation failed',
      errors: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  Object.assign(req, result.data);                            // use the parsed, typed values
  next();
};
```

- Validation checks **shape and format**: types, ranges, lengths.
- **Business rules** (enough balance, account not frozen) belong in the service, and produce 422 or 409.
- Whitelist fields (`strict()` or `pick`) to prevent **mass assignment**: a client setting fields it should not, such as `role: "admin"` or `balance`.

## Error handling {#errors}

All errors should end in **one error-handling middleware**, registered last, with **four parameters**. Express recognises it by the number of parameters.

```js
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
export class InsufficientFunds extends AppError {
  constructor(balance, requested) {
    super(422, 'INSUFFICIENT_FUNDS', `Balance ${balance} is below ${requested}`);
  }
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);                       // too late to change the response

  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code, message: err.message, requestId: req.id });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE' });
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ code: 'INVALID_JSON' });

  req.log.error({ err }, 'unhandled error');                   // log the details
  res.status(500).json({ code: 'INTERNAL_ERROR', requestId: req.id });   // reveal nothing else
}
```

**Async handlers.**

- **Express 5:** a rejected promise, or an error thrown in an `async` handler, is passed to the error handler automatically.
- **Express 4:** it is not. The request hangs, and you get an unhandled rejection. Wrap each handler with a small helper, or use the `express-async-errors` package:

```js
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
app.get('/accounts/:id', asyncHandler(getAccount));
```

- Express does **not** catch errors thrown in a `setTimeout` callback, in an event handler, or after the response ended. They become `uncaughtException` ([error handling in Node](lesson:node-runtime#errors)).
- Add a **404 middleware** before the error handler, for unmatched routes. Never send stack traces to clients.

## CORS, security headers and rate limiting {#security}

**CORS** (cross-origin resource sharing) is a **browser** rule. A page from `app.bank.com` may read responses from `api.bank.com` only if the API allows it, with response headers.

For non-simple requests (a JSON body, an `Authorization` header, `PUT`, `PATCH`, `DELETE`), the browser first sends an **`OPTIONS` preflight** (the third scene). The real request goes ahead only if the answer allows it.

```js
import cors from 'cors';
app.use(cors({
  origin: ['https://app.bank.example'],        // an allow-list, never '*' together with credentials
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  credentials: true,                           // allow cookies
  maxAge: 600,                                 // cache the preflight for 10 minutes
}));
```

CORS does **not** protect the API. `curl` and server code ignore it. It only stops other websites from reading responses in a user's browser. Authentication still protects the data.

Other basics:

- **`helmet`** sets security headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `Content-Security-Policy` and more.
- **Rate limiting** with `express-rate-limit`. Use a **Redis store** when you have several instances. Set stricter limits on login and transfer endpoints.
- **Body limits**: `express.json({ limit })` and timeouts, so one client cannot send gigabytes.
- **`app.disable('x-powered-by')`** (helmet does it) hides the framework.
- **HTTPS** ends at the load balancer or reverse proxy. Set `trust proxy`, and use secure cookies.
- **CSRF** matters when the API uses **cookies** for auth. A cross-site request cannot attach a bearer token in the `Authorization` header, so CSRF does not apply there. With cookie sessions, use `SameSite` cookies and a CSRF token.

## Authentication and authorisation {#auth}

**Authentication** answers "who is calling?". **Authorisation** answers "what may they do?" (see [JWT](lesson:jwt#what) and [OAuth 2.0](lesson:oauth2#tokens)). A typical API checks a **bearer JWT** issued by an identity provider.

```js
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = createRemoteJWKSet(new URL(process.env.JWKS_URL));   // the provider's public keys, cached

export async function authenticate(req, res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ code: 'MISSING_TOKEN' });

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: process.env.JWT_ISSUER,
      audience: 'accounts-api',                                   // reject tokens meant for other APIs
    });
    req.user = { id: payload.sub, roles: payload.roles ?? [], scopes: String(payload.scope ?? '').split(' ') };
    next();
  } catch {
    res.status(401).json({ code: 'INVALID_TOKEN' });
  }
}

export const requireScope = (scope) => (req, res, next) =>
  req.user.scopes.includes(scope) ? next() : res.status(403).json({ code: 'FORBIDDEN' });

accountsRouter.post('/:id/transfers', requireScope('transfers:write'), validate(transferSchema), makeTransfer);
```

Rules:

- Verify the **signature, algorithm, expiry, issuer and audience**. Never decode without verifying.
- Keep access tokens short-lived.
- Check **object-level access** in the service: does the caller own this account? The role alone is not enough. Broken object-level authorisation (changing the id in the URL to read someone else's account) is the top API vulnerability.
- For passwords, use **argon2** or **bcrypt**, never a fast hash.

Passport.js is a strategy-based library that wraps many login methods. You meet it in older code.

## Structure the project {#structure}

Keep HTTP thin (the fourth scene):

```text
src/
  app.js              createApp(): middleware and routers, no listen()
  server.js           loads config, creates the app, listen(), graceful shutdown
  config.js           validated environment variables
  routes/accounts.js  URLs to handlers
  controllers/        read input, call the service, choose the status code
  services/           business rules, no Express objects, throws AppError
  repositories/       SQL or ORM calls
  middleware/         authenticate, validate, errorHandler, rateLimiter
  schemas/            zod schemas
```

```js
// controllers/accounts.js: HTTP in, HTTP out
export async function makeTransfer(req, res) {
  const key = req.get('Idempotency-Key');
  const result = await transferService.transfer({
    from: req.params.id,
    ...req.body,
    userId: req.user.id,
    idempotencyKey: key,
  });
  res.status(result.replayed ? 200 : 201).location(`/transfers/${result.id}`).json(result);
}

// services/transfers.js: rules, no req or res
export async function transfer({ from, toAccount, amount, currency, userId, idempotencyKey }) {
  const account = await accounts.findOwned(from, userId);              // object-level authorisation
  if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND');
  if (account.balance < amount) throw new InsufficientFunds(account.balance, amount);
  return db.tx((t) => ledger.post(t, { from, toAccount, amount, currency, idempotencyKey }));
}
```

The service can be unit tested without HTTP. A queue consumer or a CLI can call the same service.

**Database:**

- Use a connection **pool** (`pg`, `mysql2`), created once per process.
- Use **parameterised queries**, and transactions for changes with several steps.
- ORMs and query builders: Prisma, Drizzle, TypeORM, Sequelize, Knex.
- Close the pool on shutdown ([graceful shutdown](lesson:node-runtime#shutdown)).

## Configuration, logging and operations {#ops}

- **Config:** environment variables, validated at startup ([process and config](lesson:node-runtime#process)). No secrets in the repository.
- **Logging:** a structured JSON logger (**pino**, `pino-http`), with a **request id** on every line (from `X-Request-Id`, or generated). No passwords, tokens or full card numbers in logs. Return the request id to the client in error responses, so support can find the log line.
- **Health endpoints:** `/health/live` (the process is up) and `/health/ready` (dependencies are reachable; fails during shutdown).
- **Metrics and tracing:** Prometheus metrics (`prom-client`), and **OpenTelemetry** auto-instrumentation for Express.
- **Compression:** `compression`, or better, let the reverse proxy do it.
- **Timeouts:** set `server.requestTimeout`, `headersTimeout` and `keepAliveTimeout`. Keep the last one above the load balancer's idle timeout. Put timeouts on outgoing calls too, with `AbortSignal.timeout(3000)`.
- **Process model:** one Node process per container, scaled by the orchestrator, with SIGTERM handled.
- **Streaming responses:** pipe large exports ([streams](lesson:node-runtime#streams)) instead of building arrays in memory, and paginate lists.

## Testing {#testing}

Create the app in a function that **does not call `listen()`**. Tests import it, and use **supertest** to send requests in memory, with no port.

```js
// app.js
export function createApp({ transferService }) {
  const app = express();
  app.use(express.json());
  app.post('/transfers', authenticateForTests, validate(transferSchema), makeTransfer(transferService));
  app.use(errorHandler);
  return app;
}

// transfers.test.js (Vitest or node:test)
import request from 'supertest';

test('creates a transfer and returns 201 with Location', async () => {
  const transferService = { transfer: vi.fn().mockResolvedValue({ id: 't1', replayed: false }) };
  const app = createApp({ transferService });

  const res = await request(app)
    .post('/transfers')
    .set('Authorization', 'Bearer test')
    .send({ toAccount: 'SG0123456789', amount: 12000, currency: 'SGD' });

  expect(res.status).toBe(201);
  expect(res.headers.location).toBe('/transfers/t1');
});

test('rejects a negative amount with 400', async () => {
  const res = await request(createApp({ transferService: {} }))
    .post('/transfers').set('Authorization', 'Bearer test')
    .send({ toAccount: 'SG0123456789', amount: -5, currency: 'SGD' });
  expect(res.status).toBe(400);
  expect(res.body.errors[0].field).toBe('body.amount');
});
```

Test the layers separately:

- services as plain unit tests,
- the HTTP layer with supertest and a fake service,
- a few **integration tests** against a real database (Testcontainers, or a Docker Compose database) for repositories and transactions.

See [React performance and testing](lesson:react-performance#testing) for the same pyramid on the front end.

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| Forgetting `next()` or a response | Every path ends the response, or calls `next`. |
| Body parser registered after the routes | Register parsers first. |
| Async error in Express 4 not handled | Wrap handlers, or use Express 5. |
| Sending a response twice | `return res...`, and check `res.headersSent` in the error handler. |
| Trusting `req.body` | Validate with a schema, and reject unknown fields. |
| `cors({ origin: '*', credentials: true })`, or reflecting any origin | Use an allow-list. |
| Stack traces in responses | Log them. Return a code and a request id. |
| No body size limit | `express.json({ limit })` |
| SQL built from strings | Parameterised queries. |
| Checking only the role | Also check that the caller owns the object. |
| Business rules inside the handler | Move them to a service. |
| `app.listen` inside `app.js` | Separate `createApp` from `server.js`. |
| Float money, no idempotency on payments | Integer minor units, `Idempotency-Key`. |
| A new database connection per request | One pool per process. |
| Ignoring SIGTERM | Drain and close on shutdown. |

## For a Java developer {#java}

| Spring MVC | Express |
| --- | --- |
| `DispatcherServlet` and the filter chain | The middleware chain |
| `@RestController`, `@GetMapping` | `Router`, `router.get(path, handler)` |
| `@PathVariable`, `@RequestParam`, `@RequestBody` | `req.params`, `req.query`, `req.body` |
| `@Valid` and Bean Validation | zod or joi in a validation middleware |
| `@ControllerAdvice` and `@ExceptionHandler` | The four-argument error middleware |
| `Filter`, `HandlerInterceptor` | Application-level and router-level middleware |
| Spring Security filter chain | `authenticate` and `authorize` middleware, Passport |
| `@CrossOrigin` | The `cors` middleware |
| Dependency injection | Functions and factories (`createApp({ service })`), or NestJS |
| `@Service`, `@Repository` | Plain modules and classes |
| `application.yml` and profiles | Validated environment variables |
| Actuator | Health routes, `prom-client`, OpenTelemetry |
| `MockMvc` | supertest |
| One thread per request | One event loop: never block it |

Try it in the lab: [Express: routes, async handlers and errors](lab:express-routing-errors).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| Middleware | `(req, res, next)`, ordered. End the response, or call `next()`. |
| Order | helmet, cors, request id and logger, body parser, rate limit, auth, routes, 404, error handler. |
| Routing | `Router`. The first match wins. `params`, `query`, `body`. |
| Response | One response per request, with the correct status code. |
| Validation | A schema at the edge, strict. 400 or 422. |
| Errors | One error middleware with 4 arguments, last. No stack traces. |
| Async | Express 5 forwards rejections. Express 4 needs a wrapper. |
| CORS | A browser rule. Preflight `OPTIONS`. An allow-list. Not a security control. |
| Auth | Verify the JWT signature, exp, iss, aud. 401 versus 403. Check object ownership. |
| Protection | helmet, rate limit, body limit, timeouts. |
| Structure | Router, controller, service, repository. `createApp` without `listen`. |
| Ops | pino with a request id, health routes, graceful shutdown. |
| Testing | supertest on `createApp`, service unit tests, a few integration tests. |

## Interview questions {#questions}

### [basic] What is Express and what does it give you? {#what-q}

It is a minimal web framework on top of Node's `http` module. It provides routing, the middleware mechanism, and helpers on the request and response objects.

It does not include an ORM, validation or dependency injection, so you pick libraries for those. It is flexible and used everywhere. But a team has to agree on conventions for structure, errors and validation.

### [basic] What is middleware and why does order matter? {#middleware-q}

A middleware is a function `(req, res, next)` that runs in the request pipeline. It can change the request or response, end the response, or call `next()` to continue.

Middleware runs in the order it was registered. So:

- a body parser must come before the routes that read `req.body`,
- authentication must come before protected routes,
- CORS must come before authentication, so preflights are answered,
- the error handler must come last.

### [basic] What is the difference between `app.use` and `app.get`? {#use-get-q}

- `app.use(path?, fn)` mounts middleware for **all methods**, and for any path that starts with the prefix. Use it for concerns that cut across requests: parsing, logging, auth, routers.
- `app.get(path, handler)` handles only `GET` requests whose path matches. Use method routes for endpoints.

### [basic] How do you read path parameters, query parameters and the body? {#params-q}

- `req.params.id` for `/accounts/:id`.
- `req.query.limit` for `?limit=20`. These are always strings, so convert and validate them.
- `req.body` for the payload, after `express.json()` has parsed it. In Express 5, `req.body` is `undefined` if no parser ran.

Validate all three with a schema.

### [basic] Which HTTP status codes would you return for create, validation failure, missing and conflicting resources? {#status-q}

- Create: **201**, with a `Location` header.
- Malformed or invalid input: **400**. Use **422** when the request is well-formed but breaks a rule.
- Missing resource: **404**.
- Duplicate, or an update with a stale version: **409**.
- Missing or invalid credentials: **401**. An authenticated caller without permission: **403**.
- Too many requests: **429**.
- Unexpected failure: **500**, with no internal details.

### [intermediate] How does error handling work in Express, including async handlers? {#errors-q}

An error-handling middleware has four arguments, `(err, req, res, next)`, and is registered last. Synchronous throws and `next(err)` reach it.

- In **Express 5**, a rejected promise from an async handler is forwarded automatically.
- In **Express 4**, it is not. The request hangs and an unhandled rejection occurs, unless you wrap the handler (`.catch(next)`) or use `express-async-errors`.

The handler maps known errors (an `AppError` with a status and code) to responses. It logs the rest, and returns a generic 500 with a request id. Errors thrown in timers or event handlers bypass Express.

### [intermediate] How do you validate input in an Express API? {#validation-q}

Use a schema library such as zod or joi, in a reusable middleware.

1. It parses `body`, `params` and `query`.
2. On failure, it returns 400 with the field errors.
3. On success, it replaces the raw values with the parsed ones.

Use strict objects to reject unknown fields, which prevents mass assignment. Set size limits on the body. Keep business-rule checks in the service. With TypeScript, zod also gives you the inferred types.

### [intermediate] What is CORS, what is a preflight, and does CORS secure an API? {#cors-q}

CORS lets a browser page from one origin read responses from another origin, if the server allows it with `Access-Control-Allow-*` headers.

For non-simple requests (a JSON content type, custom headers such as `Authorization`, methods other than GET, POST and HEAD), the browser first sends an `OPTIONS` preflight. It sends the real request only if the answer allows the origin, method and headers.

CORS does not secure the API. Only browsers enforce it, so `curl` or another server ignores it. You still need authentication and authorisation. Set the origin from an allow-list, especially with credentials.

### [intermediate] How do you authenticate requests with a JWT in Express? {#jwt-q}

A middleware:

1. reads the `Authorization: Bearer` header,
2. verifies the token with the identity provider's public keys (JWKS),
3. checks the signature, algorithm, expiry, issuer and audience,
4. puts the claims on `req.user`.

It returns 401 when the token is missing or invalid.

A second middleware, or the service, checks authorisation: a required scope or role (403), and that the user owns the object being accessed. Keep tokens short-lived, and never decode without verifying.

### [intermediate] What is the difference between 401 and 403, and where do you check each? {#401-403-q}

- **401** means the caller is not authenticated: no valid credentials. The authentication middleware checks it.
- **403** means the caller is authenticated, but not allowed. An authorisation middleware checks roles and scopes, and the service checks object ownership.

Some APIs return 404 instead of 403 for objects the caller must not know exist.

### [intermediate] How do you structure an Express project so it is testable? {#structure-q}

Separate `createApp()` (which builds the middleware and routers) from `server.js` (which listens and handles signals).

Layer the code:

- routers map URLs,
- controllers handle HTTP,
- services hold business rules, and know nothing about `req` and `res`,
- repositories hold the SQL.

Pass dependencies in as arguments (a factory, or a small container). Then you unit test services directly, test the HTTP layer with supertest and fake services, and run a few integration tests against a real database.

### [intermediate] How do you protect an Express API from abuse? {#abuse-q}

- `helmet` for headers.
- A strict CORS allow-list.
- Body size limits and server timeouts.
- Rate limiting per client or token, with a shared Redis store across instances, and stricter limits on login and money movement.
- Schema validation and parameterised queries.
- Audited dependencies.
- A reverse proxy or API gateway in front.

Return generic errors, log with request ids, and alert on spikes of 401, 403 and 429.

### [deep] How would you make `POST /transfers` safe against client retries? {#idempotency-q}

Require an `Idempotency-Key` header. Then, in one database transaction:

1. insert the key, with a unique constraint, together with a fingerprint of the request,
2. perform the transfer,
3. store the result with the key.

On a retry:

- if the key exists with the same fingerprint, return the stored response (200, not 201),
- if it exists with a different payload, return 422.

Expire keys after a period. The ledger entry and the key insert must be atomic, so a retry after a timeout never debits twice. See [idempotency](lesson:rest-api-design#idempotency).

### [deep] Compare Express, Fastify and NestJS. {#compare-q}

- **Express** is minimal and has the largest ecosystem. It leaves structure, validation and typing to you, and is slower.
- **Fastify** has a plugin system, built-in JSON-schema validation, fast serialisation and better throughput. Its ecosystem is smaller, but strong.
- **NestJS** is an opinionated framework with modules, decorators, dependency injection and built-in patterns (guards, pipes, interceptors). It runs on Express or Fastify, and feels like Spring Boot, which suits large teams and Java developers.

Choose Express for small services and teams who know it, Fastify for performance and schema-first APIs, and NestJS for large, structured codebases.

### [deep] How would you take an Express service to production on Kubernetes? {#production-q}

- One Node process per container, in a small image running as a non-root user.
- Configuration from environment variables, validated at start. Secrets from the platform's secret store.
- Liveness and readiness probes. Readiness fails during shutdown.
- SIGTERM handling that drains requests and closes the pool.
- A keep-alive timeout above the load balancer's.
- Structured logs with request ids, plus metrics and traces.
- Resource limits sized from load tests, with event loop lag monitored.
- Horizontal pod autoscaling.
- Shared rate-limit and session state in Redis.
- Graceful rolling deployments.

See [graceful shutdown](lesson:node-runtime#shutdown).

### [coding] Write Express middleware that validates the body of `POST /accounts/:id/transfers` with zod and returns field-level 400 errors. {#coding-validate}

```js
import express from 'express';
import { z } from 'zod';

const transferBody = z.object({
  toAccount: z.string().regex(/^[A-Z]{2}\d{10}$/, 'must be 2 letters and 10 digits'),
  amount: z.number().int('must be in minor units').positive().max(100_000_000),
  currency: z.enum(['SGD', 'USD', 'EUR']),
  reference: z.string().max(140).optional(),
}).strict();                                          // unknown fields are errors

const transferParams = z.object({ id: z.string().uuid() });

export const validate = ({ body, params, query }) => (req, res, next) => {
  const errors = [];
  for (const [where, schema] of Object.entries({ body, params, query })) {
    if (!schema) continue;
    const result = schema.safeParse(req[where]);
    if (result.success) {
      if (where === 'body') req.body = result.data;           // replace with the parsed value
      else req.validated = { ...req.validated, [where]: result.data };   // req.query is read-only in Express 5
    } else {
      errors.push(...result.error.issues.map((i) => ({
        field: [where, ...i.path].join('.'),
        message: i.message,
      })));
    }
  }
  if (errors.length) return res.status(400).json({ title: 'Validation failed', errors });
  next();
};

const app = express();
app.use(express.json({ limit: '100kb' }));
app.post(
  '/accounts/:id/transfers',
  validate({ body: transferBody, params: transferParams }),
  (req, res) => res.status(201).json({ id: 't1', ...req.body }),
);
```

Explain these points:

- A request with `{ "amount": -5 }` gets `400`, with `errors: [{ field: "body.toAccount", ... }, { field: "body.amount", message: "Number must be greater than 0" }, ...]`, all in one response.
- Extra fields are rejected, so a client cannot set fields it should not.
- The handler only sees parsed, typed data.

### [coding] Write a central error handler with `AppError` classes that works in Express 4 and 5, including async handlers. {#coding-errors}

```js
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export class NotFound extends AppError {
  constructor(what) { super(404, 'NOT_FOUND', `${what} not found`); }
}
export class Conflict extends AppError {
  constructor(message) { super(409, 'CONFLICT', message); }
}

// Express 4 compatible wrapper (harmless in Express 5)
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(req, res, next) {
  next(new NotFound(`${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, next) {      // four parameters: Express treats it as an error handler
  if (res.headersSent) return next(err);                 // let Express close the connection

  let status = 500;
  let body = { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: req.id };

  if (err instanceof AppError) {
    status = err.status;
    body = { code: err.code, message: err.message, requestId: req.id };
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'INVALID_JSON', message: 'Body is not valid JSON', requestId: req.id };
  } else if (err.type === 'entity.too.large') {
    status = 413;
    body = { code: 'PAYLOAD_TOO_LARGE', message: 'Body is too large', requestId: req.id };
  }

  if (status >= 500) req.log.error({ err }, 'request failed');   // full detail only in the logs
  res.status(status).json(body);
}

// usage
app.get('/accounts/:id', asyncHandler(async (req, res) => {
  const account = await accounts.findById(req.params.id);
  if (!account) throw new NotFound('Account');           // reaches errorHandler
  res.json(account);
}));
app.use(notFound);
app.use(errorHandler);                                   // always last
```

Explain these points:

- Known errors become precise status codes.
- Unknown errors become a generic 500 with only a request id.
- Stack traces stay in the logs.
- A response that has already started is handed to Express, instead of being sent twice.

### [coding] Implement a fixed-window rate limiter middleware keyed by client, and explain what must change to run it on several instances. {#coding-ratelimit}

```js
export function rateLimit({ limit = 100, windowMs = 60_000, keyFn = (req) => req.user?.id ?? req.ip } = {}) {
  const hits = new Map();                                   // key -> { count, resetAt }

  setInterval(() => {                                       // clean expired entries
    const now = Date.now();
    for (const [key, v] of hits) if (v.resetAt <= now) hits.delete(key);
  }, windowMs).unref();                                     // do not keep the process alive

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.set('RateLimit-Limit', String(limit));
    res.set('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));

    if (entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ code: 'RATE_LIMITED' });
    }
    next();
  };
}

app.use('/api', rateLimit({ limit: 100 }));
app.use('/api/auth/login', rateLimit({ limit: 5, windowMs: 15 * 60_000, keyFn: (req) => req.ip }));
```

Explain these points:

- This version keeps the counters in memory. Each instance counts separately, so a client gets `limit × instances` requests, and a restart resets the counts.
- For several instances, store the counters in **Redis** with an atomic `INCR` and `EXPIRE` (or a Lua script). That is what `express-rate-limit` with `rate-limit-redis` does.
- Set `trust proxy`, so `req.ip` is the real client address, not the load balancer's.
- A fixed window allows a burst at the boundary. Use a sliding window or a token bucket when that matters.
