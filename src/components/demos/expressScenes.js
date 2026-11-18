// Frame data for the "Express and REST" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const EXPRESS_SCENES = [
  {
    id: 'pipeline',
    label: 'Middleware pipeline',
    title: 'A request passes through a chain',
    frames: [
      {
        note: 'An Express app is a chain of functions with the signature (req, res, next). Each middleware can read or change the request, end the response, or call next() to pass control on. Order matters: they run in the order they were registered.',
        boxes: [b('r', 'HTTP request', ['POST /transfers'], 'none'), b('m', 'Middleware chain', ['(req, res, next)'], 'new'), b('h', 'Route handler', ['sends the response'], 'ok')],
        deps: [d('HTTP request', 'Middleware chain', 'enters', 'ok'), d('Middleware chain', 'Route handler', 'next()', 'ok')],
      },
      {
        note: 'A typical order: security headers and CORS first, then request logging with an id, then body parsing with a size limit, then authentication, then the routers. Things that must happen for every request go before the routes that need them.',
        boxes: [b('a', 'helmet + cors', ['headers, origins'], 'ok'), b('b', 'logger + request id', ['trace each call'], 'ok'), b('c', 'express.json(limit)', ['parse the body'], 'ok'), b('d', 'authenticate', ['who is calling?'], 'new')],
        deps: [d('helmet + cors', 'logger + request id', 'next()', 'ok'), d('logger + request id', 'express.json(limit)', 'next()', 'ok'), d('express.json(limit)', 'authenticate', 'next()', 'ok')],
      },
      {
        note: 'A middleware can stop the chain by sending a response and not calling next(). The authentication middleware answers 401 when the token is missing, so the route handler never runs. If you forget both, the request hangs until it times out.',
        boxes: [b('m', 'authenticate', ['no token'], 'warn'), b('r', '401 Unauthorized', ['response ends here'], 'bad'), b('h', 'Route handler', ['never runs'], 'none')],
        deps: [d('authenticate', '401 Unauthorized', 'res.status(401)', 'bad')],
      },
    ],
  },
  {
    id: 'validation',
    label: 'Validation and errors',
    title: 'Bad input and failures become clean responses',
    frames: [
      {
        note: 'Never trust the body, params or query string. A validation middleware parses them with a schema (zod, joi). If they do not match, it responds 400 with the field errors. If they do, the handler receives typed, trusted data.',
        boxes: [b('r', 'POST /transfers', ['{ amount: "abc" }'], 'none'), b('v', 'Validate with schema', ['zod parse'], 'new'), b('e', '400 Bad Request', ['amount must be a number'], 'bad')],
        deps: [d('POST /transfers', 'Validate with schema', 'body', 'ok'), d('Validate with schema', '400 Bad Request', 'invalid', 'bad')],
      },
      {
        note: 'When the input is valid, the handler calls a service, which holds the business rules and talks to the database. The handler only translates between HTTP and the service: read input, call, choose the status code, send the result.',
        boxes: [b('v', 'Valid input', ['typed data'], 'ok'), b('h', 'Handler', ['HTTP in, HTTP out'], 'new'), b('s', 'TransferService', ['rules + database'], 'ok')],
        deps: [d('Valid input', 'Handler', 'passes', 'ok'), d('Handler', 'TransferService', 'calls', 'ok')],
      },
      {
        note: 'Errors in async handlers must reach Express. Express 5 forwards a rejected promise to the error handler automatically. In Express 4 you wrap handlers or call next(err). A single error middleware with four arguments (err, req, res, next) maps errors to status codes and a consistent JSON body.',
        boxes: [b('s', 'Service throws', ['InsufficientFunds'], 'bad'), b('e', 'Error middleware', ['(err, req, res, next)'], 'new'), b('r', '422 + JSON body', ['code, message, requestId'], 'ok')],
        deps: [d('Service throws', 'Error middleware', 'rejected promise', 'bad'), d('Error middleware', '422 + JSON body', 'maps to', 'ok')],
      },
    ],
  },
  {
    id: 'auth',
    label: 'CORS and authentication',
    title: 'Browser rules, then identity',
    frames: [
      {
        note: 'A browser on app.bank.com calling api.bank.com is a cross-origin request. For a non-simple call (JSON body, Authorization header, PUT or DELETE) the browser first sends an OPTIONS preflight asking if it is allowed. The server answers with the allowed origin, methods and headers.',
        boxes: [b('b', 'Browser app', ['app.bank.com'], 'none'), b('p', 'OPTIONS preflight', ['may I send this?'], 'warn'), b('c', 'cors middleware', ['allow listed origins'], 'new')],
        deps: [d('Browser app', 'OPTIONS preflight', 'first', 'warn'), d('OPTIONS preflight', 'cors middleware', 'answered by', 'ok')],
      },
      {
        note: 'Then the real request carries a bearer JWT. The authenticate middleware verifies the signature, expiry, issuer and audience, and puts the user on req.user. Invalid or missing means 401. Authenticated but not allowed means 403, which an authorize middleware checks by role or scope.',
        boxes: [b('j', 'Bearer token', ['Authorization header'], 'none'), b('a', 'Verify JWT', ['signature, exp, iss, aud'], 'new'), b('u', 'req.user', ['id, roles'], 'ok')],
        deps: [d('Bearer token', 'Verify JWT', 'checked', 'ok'), d('Verify JWT', 'req.user', 'attached', 'ok')],
      },
      {
        note: 'Add rate limiting per client or token so one caller cannot exhaust the service, and keep the secret and allowed origins in configuration. CORS protects browsers only. It does not replace authentication, because curl ignores it.',
        boxes: [b('l', 'Rate limiter', ['100 requests per minute'], 'warn'), b('t', '429 Too Many Requests', ['Retry-After header'], 'bad'), b('o', 'Within limit', ['request continues'], 'ok')],
        deps: [d('Rate limiter', '429 Too Many Requests', 'over the limit', 'bad'), d('Rate limiter', 'Within limit', 'under the limit', 'ok')],
      },
    ],
  },
  {
    id: 'layers',
    label: 'Layers and testing',
    title: 'Keep HTTP thin and test the app',
    frames: [
      {
        note: 'Keep layers separate. The router maps URLs to handlers, the handler deals with HTTP, the service holds business rules and knows nothing about Express, and the repository holds the SQL. This keeps rules testable without a server.',
        boxes: [b('r', 'Router', ['URL to handler'], 'ok'), b('c', 'Handler', ['HTTP only'], 'ok'), b('s', 'Service', ['business rules'], 'new'), b('p', 'Repository', ['SQL'], 'ok')],
        deps: [d('Router', 'Handler', 'calls', 'ok'), d('Handler', 'Service', 'calls', 'ok'), d('Service', 'Repository', 'calls', 'ok')],
      },
      {
        note: 'Create the app in a function that does not call listen(). Tests import the app and use supertest to send requests in memory, with no open port. Assert on the status, headers and body, and replace the repository with a test double or a test database.',
        boxes: [b('a', 'createApp()', ['no listen() inside'], 'new'), b('t', 'supertest', ['request(app).post(...)'], 'ok'), b('x', 'Assertions', ['status, body, headers'], 'ok')],
        deps: [d('createApp()', 'supertest', 'imported by', 'ok'), d('supertest', 'Assertions', 'response', 'ok')],
      },
    ],
  },
];
