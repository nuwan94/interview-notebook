---
title: Full-stack integration — React, Express and PostgreSQL end to end
nav: Full-stack integration
slug: fullstack-integration
summary: Putting a React front end, an Express API and a database together, the three-tier architecture, serving the SPA and the API from one origin or two, the Vite dev proxy, monorepo with pnpm workspaces and a shared zod schema, a typed API client with TanStack Query, login with OIDC authorization code and PKCE, BFF and httpOnly cookies versus tokens in memory, refresh and 401 handling, CSRF and XSS, a transfer feature end to end with idempotency and a database transaction, error contracts across layers, caching, real-time updates with polling, SSE and WebSockets, file upload with presigned URLs, observability with request and trace ids, Docker and CI/CD, static hosting on a CDN, expand and contract database migrations, and server rendering with Next.js, with banking examples and interview questions.
tags: [Full stack, React, Express, Node.js, PostgreSQL, Authentication, BFF, API contract, Deployment, Architecture]
order: 78
topic: Full stack / Integration
updated: 2026-11-18
subnav: true
---

A full-stack interview ends with the question that joins everything: *walk me through what happens when a user clicks Send on a transfer, from the browser to the database and back.* They also ask *where you store the token, how the front end and back end share types, how you handle CORS, how you deploy the two halves, and how you debug a failure that spans both.* This lesson connects the earlier ones: [React core](lesson:react-core#state), [React hooks](lesson:react-hooks#fetching), [Redux and RTK Query](lesson:react-redux#rtkquery), the [Node.js runtime](lesson:node-runtime#what) and [Express](lesson:node-express#middleware). Examples are TypeScript and use a banking transfer. Play the four scenes: the big picture, login and sessions, one feature end to end, and build and deploy.

```demo
name: fullstack-walk
```

> **One sentence to remember:** *The browser is untrusted and the API is the only place rules are enforced, so share the contract (types and schemas), keep tokens out of JavaScript, make every write idempotent and transactional, and ship the static front end and the API independently.*

## The architecture {#architecture}

Three tiers (the first scene):

| Tier | Runs | Responsibility |
| --- | --- | --- |
| **Presentation**: the React single-page app (SPA) | in the browser | UI, local state, calling the API, instant validation feedback |
| **Application**: the Express API | on servers or containers | authentication, authorisation, validation, business rules, transactions |
| **Data**: PostgreSQL (and Redis, object storage) | managed services | durable data, constraints, indexes |

The rules that follow:

- The **browser never talks to the database**, and everything it sends can be forged. All security decisions are made again on the server.
- The built SPA is **static files** (HTML, JavaScript, CSS). Serve them from a **CDN or object storage** with long caching, because file names contain a content hash. Only the API needs compute.
- A **reverse proxy or API gateway** routes `/api/*` to the API and everything else to the static files.
- **Stateless API instances**: no session in memory, so any instance can handle any request and you can scale out and replace them freely. Shared state lives in the database, Redis or a signed cookie.

**Same origin or two origins.**

| | One origin (`bank.example`) | Two origins (`app.` and `api.`) |
| --- | --- | --- |
| CORS | not needed | required, with an allow-list ([CORS](lesson:node-express#security)) |
| cookies | simple, `SameSite=Lax` or `Strict` | need `credentials`, `SameSite=None; Secure` if the sites differ |
| deployment | one proxy in front | independent hosts and domains |
| CSRF exposure | cookies sent automatically, so protect them | same, plus cross-site cookie rules |

Prefer **one origin** behind a proxy. In development the **Vite dev server proxies** `/api` to the local API, so the code behaves as it will in production:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
});
```

**Environment variables in the SPA are public.** `import.meta.env.VITE_API_URL` is replaced at **build time** and ends up in the bundle that every visitor downloads, so never put a secret there. Build once and configure the environment with a runtime `/config.json` or relative URLs, so the same artefact runs in test and production.

## Project structure and the shared contract {#structure}

A **monorepo** with **pnpm workspaces** keeps the front end, the API and shared code together, versioned as one:

```text
bank-app/
  pnpm-workspace.yaml
  apps/
    web/              React + Vite
    api/              Express
  packages/
    contracts/        zod schemas and TypeScript types shared by both
    eslint-config/
```

The key idea is a **single source of truth for the API contract**:

```ts
// packages/contracts/src/transfers.ts
import { z } from 'zod';

export const CreateTransfer = z.object({
  fromAccount: z.string().uuid(),
  toAccount: z.string().regex(/^[A-Z]{2}\d{10}$/),
  amount: z.number().int().positive().max(100_000_000),   // minor units
  currency: z.enum(['SGD', 'USD', 'EUR']),
  reference: z.string().max(140).optional(),
}).strict();
export type CreateTransfer = z.infer<typeof CreateTransfer>;

export const Transfer = CreateTransfer.extend({
  id: z.string().uuid(),
  status: z.enum(['POSTED', 'PENDING']),
  createdAt: z.string().datetime(),
});
export type Transfer = z.infer<typeof Transfer>;
```

The API imports `CreateTransfer` to validate requests, and the web app imports it for the form and for the types of the responses, so a change breaks the build on **both sides** instead of in production. Other ways to share a contract:

| Approach | Idea | Fits |
| --- | --- | --- |
| shared zod package (above) | one TypeScript monorepo | same team, all TypeScript |
| **OpenAPI** | a spec file, generate server stubs and clients (`openapi-typescript`, Orval) | several clients, other languages (a Java back end), public APIs |
| **tRPC** | call server functions from the client with inferred types, no schema file | a TypeScript monorepo, internal apps |
| **GraphQL** | typed schema, clients ask for the fields they need | many clients with different data needs |
| **contract tests** (Pact) | consumer states what it needs, provider verifies | separate teams and repositories |

With a Spring Boot back end, generate the TypeScript client from its **OpenAPI** document. Keep the date and money rules explicit: dates as ISO 8601 strings, money as **integers in minor units or decimal strings**, never floats, and enums as strings.

## Calling the API from React {#client}

Wrap `fetch` once, so every call gets the same base URL, credentials, error handling and typing, then use **TanStack Query** or **RTK Query** for caching and loading state ([server state](lesson:react-redux#rtkquery)).

```ts
// apps/web/src/api/client.ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('Content-Type', 'application/json');

  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    credentials: 'include',                       // send the session cookie
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code ?? 'UNKNOWN', data.message ?? res.statusText, data.requestId);
  return data as T;
}
```

```tsx
// queries and mutations
export const useAccounts = () =>
  useQuery({ queryKey: ['accounts'], queryFn: ({ signal }) => api<Account[]>('/accounts', { signal }) });

export function useSendTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: CreateTransfer; key: string }) =>
      api<Transfer>('/transfers', { method: 'POST', json: body, headers: { 'Idempotency-Key': key } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });         // balance changed
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
```

Points to remember:

- Pass the query's **`signal`** so navigating away **cancels** the request ([cancellation](lesson:js-async#cancellation)).
- `fetch` **does not reject on HTTP 4xx and 5xx**, so check `res.ok` yourself.
- Separate **server state** (accounts, transactions: owned by the server, cached and refetched) from **client state** (the open modal, form input). Do not copy server data into Redux or `useState`.
- Show all four states for every request: **loading, error, empty, success**. Use an [error boundary](lesson:react-hooks#suspense) for unexpected failures.
- Retry **idempotent reads**, not unsafe writes unless they carry an idempotency key.

## Authentication end to end {#auth}

Background: [OAuth 2.0](lesson:oauth2#grants), [OpenID Connect](lesson:oidc#flow) and [JWT](lesson:jwt#validation). A SPA is a **public client**: it cannot keep a secret, so it uses the **authorization code flow with PKCE** (the second scene).

1. The app creates a random **code verifier** and sends its hash (the **code challenge**) when it redirects the user to the identity provider (IdP).
2. The user signs in at the IdP (password, MFA). The app never sees the password.
3. The IdP redirects back with a one-time **authorization code**.
4. The code and the verifier are exchanged for tokens. PKCE proves that the party exchanging the code is the one that started the flow.

**Where do the tokens live?** This is the most asked integration question.

| Option | How | Risk | Verdict |
| --- | --- | --- | --- |
| `localStorage` or `sessionStorage` | `setItem('token', ...)` | any injected script (**XSS**, a compromised dependency) reads it | avoid for sensitive apps |
| **access token in memory** + refresh token in an **httpOnly cookie** | JS holds a short-lived token in a variable | lost on page reload (refresh silently), XSS can still use it while the page is open | acceptable |
| **BFF (backend for frontend)** with a **session cookie** | the server does the code exchange, keeps tokens, and gives the browser only an httpOnly, Secure, SameSite cookie | CSRF (handled with SameSite and tokens), the BFF is a stateful component | **best for banks** |

```ts
// BFF: set the session cookie after the code exchange
res.cookie('sid', sessionId, {
  httpOnly: true,           // JavaScript cannot read it, so XSS cannot steal it
  secure: true,             // HTTPS only
  sameSite: 'lax',          // not sent on cross-site sub-requests, blocks most CSRF
  maxAge: 15 * 60_000,
  path: '/',
});
```

- **CSRF** applies to **cookie** authentication, because the browser attaches cookies automatically. Defend with `SameSite=Lax` or `Strict`, a CSRF token or a custom header the API requires (`X-Requested-With`), and by never changing state on `GET`. Bearer tokens in the `Authorization` header are not sent automatically, so they are not CSRF-prone but are exposed to XSS if stored badly.
- **XSS** (injected script) is prevented by React's default escaping, never using `dangerouslySetInnerHTML` with untrusted input, a strict **Content Security Policy**, sanitising any HTML, and auditing dependencies.
- **Silent refresh and 401 handling:** when a call returns **401**, try **one** refresh, retry the original call, and if the refresh fails send the user to log in. Share one in-flight refresh between concurrent calls so ten failing requests trigger one refresh, not ten.

```ts
let refreshing: Promise<void> | null = null;

async function apiWithRefresh<T>(path: string, init?: Parameters<typeof api>[1]): Promise<T> {
  try {
    return await api<T>(path, init);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    refreshing ??= api<void>('/auth/refresh', { method: 'POST' }).finally(() => { refreshing = null; });
    await refreshing;                        // throws if the refresh failed, so the caller logs out
    return api<T>(path, init);               // retry once
  }
}
```

- **Route guards** in React Router hide screens from anonymous users, but they are **only UX**. The API must reject the call regardless.
- **Logout** must clear the server session, delete the cookie, clear the query cache (so the next user does not see old data) and optionally end the IdP session.
- **Authorisation:** show or hide buttons by role for a better experience, but enforce roles, scopes and **object ownership** on the server ([auth middleware](lesson:node-express#auth)).

## One feature end to end: sending a transfer {#transfer}

This is the walk-through question (the third scene). Each step:

1. **Form and validation.** A controlled form uses the shared `CreateTransfer` schema (React Hook Form with a zod resolver) and shows field errors at once. This is a convenience only.
2. **Idempotency key.** Create one UUID when the form opens (`useRef(crypto.randomUUID())`) and reuse it for every retry of this submission. Disable the button while the mutation is pending.
3. **Request.** `POST /api/transfers` with the JSON body, the session cookie and the `Idempotency-Key` header. A request id is generated or forwarded (`X-Request-Id`).
4. **Edge and middleware.** The proxy forwards to an API instance. Express runs helmet, the logger, the body parser with a size limit, rate limiting, authentication, then validates the body with the **same** schema.
5. **Service.** Business rules run in a **database transaction**:

```ts
export async function transfer(userId: string, input: CreateTransfer, key: string) {
  return db.transaction(async (tx) => {
    // 1. idempotency: unique (user_id, key). A retry returns the stored result.
    const existing = await tx.idempotency.find(userId, key);
    if (existing) return { transfer: existing.response, replayed: true };

    // 2. lock the source account row and check ownership and funds
    const from = await tx.accounts.lockForUpdate(input.fromAccount);
    if (!from || from.ownerId !== userId) throw new AppError(404, 'ACCOUNT_NOT_FOUND');
    if (from.balance < input.amount) throw new InsufficientFunds(from.balance, input.amount);

    // 3. write two ledger entries and the transfer
    const t = await tx.transfers.insert({ ...input, status: 'POSTED' });
    await tx.ledger.insert({ account: input.fromAccount, delta: -input.amount, transferId: t.id });
    await tx.ledger.insert({ account: input.toAccount, delta: +input.amount, transferId: t.id });

    // 4. remember the answer for retries
    await tx.idempotency.insert({ userId, key, response: t });
    return { transfer: t, replayed: false };
  });                                                      // commit, or roll back everything on error
}
```

6. **Response.** `201` with `Location: /transfers/{id}` and the body (or `200` for a replay). Errors use the shared error shape: `422 INSUFFICIENT_FUNDS`, `409`, `400 VALIDATION_FAILED`.
7. **Client.** On success the mutation **invalidates** the `accounts` and `transactions` queries, which refetch, so the screen shows the real balances. An error is mapped by its `code` to a message: field errors back onto the form, `INSUFFICIENT_FUNDS` on the amount, a network error with a retry that reuses the **same key**.
8. **Optional optimistic update:** show the transfer in the list at once and roll back on failure (see [optimistic updates](lesson:react-redux#optimistic-q)). For money, prefer to wait for the server and show a pending state, because the server decides.

Why each piece exists: validation on both sides (UX versus security), the idempotency key (network retries must not move money twice), the transaction (the two ledger entries and the key succeed or fail together), the row lock (two concurrent transfers cannot overdraw), and invalidation (the UI never invents balances). See [ACID](lesson:acid-base#acid) and [idempotency](lesson:rest-api-design#idempotency).

## The data layer {#data}

- **One connection pool per API process**, sized from the database limit divided by the number of instances. Too many instances times pool size exhausts PostgreSQL connections: use a pooler (PgBouncer, RDS Proxy) when you scale out.
- **Parameterised queries** always, through a query builder or ORM (**Prisma**, **Drizzle**, **Knex**, TypeORM). Learn the SQL the ORM generates.
- **N+1 queries:** loading a list and then querying per row. Fix with a join or an `IN` query, and look at query counts in logs.
- **Migrations** are versioned, reviewed scripts (`prisma migrate`, `drizzle-kit`, Flyway, node-pg-migrate) run by the pipeline, not by hand and not on random app start.
- **Constraints do the last line of defence:** `NOT NULL`, foreign keys, `CHECK (balance >= 0)`, unique keys. Application validation can have bugs, constraints cannot be bypassed.
- **Pagination** with cursors, **indexes** for the filters you use, and **read replicas** or Redis ([caching](lesson:redis-caching#patterns)) when reads dominate. See [SQL versus NoSQL](lesson:sql-vs-nosql#sql).

## Errors across the layers {#errors}

Agree one error contract (shared in `contracts`) and carry it through every layer:

```json
{ "code": "INSUFFICIENT_FUNDS", "message": "Balance 50.00 is below 120.00",
  "requestId": "b3f1c2", "fields": [{ "field": "amount", "message": "Too high" }] }
```

| Layer | Handles |
| --- | --- |
| database | constraint violation becomes a typed domain error (`23505` unique violation becomes `409`) |
| service | throws `AppError` subclasses with a code |
| Express error middleware | maps to a status and the JSON contract, logs details, hides internals |
| API client | throws `ApiError` with status, code and request id |
| React | form field errors, toast for transient errors, an error boundary for crashes, a "try again" for network failures |

The **request id** ties it together: the browser shows "Reference b3f1c2", support searches the logs and finds the full trace.

## Caching, real-time and files {#more}

- **Browser and CDN caching:** hashed static files `Cache-Control: public, max-age=31536000, immutable`, but **`index.html` with `no-cache`** so a new deployment is picked up. API responses: `Cache-Control: no-store` for personal data, `ETag` and `If-None-Match` for cheap revalidation.
- **Client cache:** TanStack Query `staleTime` and invalidation. **Server cache:** Redis for hot reads, with explicit invalidation on writes.
- **Real-time updates:** choose the simplest that works. **Polling** (`refetchInterval`) for a balance every 30 s. **Server-Sent Events** (one-way, over HTTP, auto-reconnect) for notifications and a live feed. **WebSockets** (two-way) for chat and trading screens, which need sticky or pub-sub scaling (Redis) across instances. Push an event that tells the client to refetch, rather than pushing full data, to keep one source of truth.
- **File upload:** do not stream big files through the API. The API checks permission and returns a **presigned URL**, and the browser uploads **directly to object storage** (S3), then tells the API it finished. See [S3 upload patterns](lesson:aws-storage#patterns). Validate type and size on both sides and scan for malware.
- **Pagination and forms:** use cursor pagination and infinite queries for long lists, and keep filters in the **URL** so a page is linkable and survives refresh.

## Observability {#observability}

- A **request id** (or the W3C **`traceparent`** header) is created at the edge, passed from the browser through the API to downstream calls, and included in every log line.
- **Structured logs** (pino) in JSON with the request id and user id (never tokens or full card numbers). **Metrics** (rate, errors, latency, event loop lag). **Traces** with **OpenTelemetry** from the browser (fetch instrumentation) through Express to the database.
- **Front end monitoring:** an error tracker (Sentry) with source maps, **Web Vitals** from real users ([performance](lesson:react-performance#loading)), and a log of failed API calls with the request id.
- **Health and readiness** endpoints, and alerts on error rate and latency, not on CPU alone.

## Build, test and deploy {#deploy}

**Testing across the stack** (the pyramid from [React testing](lesson:react-performance#testing)):

| Layer | Tool | Checks |
| --- | --- | --- |
| shared contract | TypeScript, zod | both sides compile against the same types |
| API unit and HTTP | Vitest, supertest | services and routes, with a fake or test database |
| UI component | Testing Library, MSW | screens against mocked network |
| contract | OpenAPI diff, Pact | the API did not break its clients |
| end-to-end | Playwright | login, transfer, history against a real deployment |

**Pipeline** (the fourth scene, [CI/CD](lesson:cicd-fundamentals#stages)): install with `pnpm install --frozen-lockfile`, lint, type-check all workspaces, test, build, run end-to-end smoke tests on a preview environment, publish artefacts, deploy.

**The two halves ship separately.**

- **API:** a **multi-stage Docker image** ([multi-stage builds](lesson:docker#multistage)), a small base image, non-root user, only production dependencies, `NODE_ENV=production`, health probes, a **rolling** or **blue-green** rollout ([deployment strategies](lesson:deployment-strategies#rolling)), graceful shutdown ([SIGTERM](lesson:node-runtime#shutdown)).
- **SPA:** `vite build` produces hashed files. Upload them to object storage first, then `index.html` last, and invalidate the CDN for `index.html` only. Keep the previous hashed files for a while, so users with an old `index.html` do not get 404s for chunks. Add client-side routing fallback (`/*` to `index.html`).
- **Version skew:** during a rollout a new front end may call an old API and the reverse. Keep API changes **backward compatible** (add fields, do not rename or remove), and version breaking changes (`/v2`).

**Database changes during a rollout** use **expand and contract** ([database changes in a release](lesson:deployment-strategies#database)):

1. **Expand:** add the new nullable column or table. Old code ignores it.
2. **Migrate:** deploy code that writes both and reads the new one, and backfill the old rows.
3. **Contract:** in a later release, drop the old column when no version uses it.

Run migrations as a separate pipeline step before the new code, and never as an automatic step that can run on ten instances at once.

**Alternatives to a pure SPA and a separate API:** **Next.js** or **Remix** render React on the server (better first paint and SEO) and can host the API routes and a BFF in the same project. The trade-off is a server to run and more concepts (server components, caching rules). For a logged-in banking dashboard, an SPA with a BFF is common, and for public pages server rendering helps.

## Security checklist {#security}

| Area | Do |
| --- | --- |
| transport | HTTPS everywhere, HSTS |
| tokens | httpOnly Secure SameSite cookie via BFF, or short-lived memory token. Never `localStorage` |
| XSS | React escaping, no `dangerouslySetInnerHTML` with user data, strict CSP, dependency audit |
| CSRF | `SameSite`, a CSRF token or custom header for cookie auth |
| CORS | allow-list, or same origin |
| input | validate on the server with a schema, strict objects, size limits |
| authorisation | roles, scopes **and** object ownership, on the server |
| data | parameterised SQL, least-privilege database user, encrypt sensitive columns, never log secrets |
| abuse | rate limit, lockout, idempotency keys, audit log for money movement |
| secrets | in a secret manager, not in the repo or in `VITE_*` variables |
| supply chain | lockfile, `pnpm audit`, automated updates, review new packages |

## For a Java developer {#java}

| Spring Boot plus a front end | This stack |
| --- | --- |
| Spring MVC REST API | Express (or Fastify, NestJS) |
| Bean Validation on DTOs | zod schemas shared with the client |
| DTO classes, OpenAPI generated client | shared `contracts` package, or `openapi-typescript` |
| Spring Security, session or JWT resource server | BFF with session cookie, or JWT middleware with `jose` |
| JPA and Hibernate, Flyway | Prisma or Drizzle, a migration tool |
| `@Transactional` | an explicit `db.transaction(async (tx) => ...)` |
| `HikariCP` | one `pg` pool per process, PgBouncer |
| Thymeleaf or JSP server rendering | React SPA, or Next.js |
| Actuator and Micrometer | health routes, `prom-client`, OpenTelemetry |
| Maven multi-module | pnpm workspaces monorepo |
| JUnit and `MockMvc`, Selenium | Vitest, supertest, Testing Library, Playwright |
| one deployable JAR | two artefacts: static files and an API image |

If the back end stays in Spring Boot, the React part is the same: generate a typed client from OpenAPI and keep the BFF or cookie rules.

Try it in the lab: [React to API across origins: CORS and preflight](lab:fullstack-cors-preflight).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| tiers | SPA in the browser, stateless API, database. The browser is untrusted |
| origin | one origin behind a proxy, no CORS. Vite proxies `/api` in development |
| config | `VITE_*` is public and build-time, no secrets |
| contract | one source: shared zod package, OpenAPI, or tRPC |
| client | one `api()` wrapper, TanStack Query for server state, pass `signal`, check `res.ok` |
| login | authorization code with PKCE, no passwords in the SPA |
| tokens | BFF with httpOnly cookie is best, memory otherwise, never `localStorage` |
| 401 | one shared refresh, retry once, then log out |
| CSRF and XSS | `SameSite` and tokens for cookies, escaping and CSP for scripts |
| writes | validate twice, idempotency key, one database transaction, constraints |
| errors | one error contract with a code and a request id through every layer |
| realtime | polling, SSE, WebSocket, push "refetch" signals |
| files | presigned URL, direct to object storage |
| deploy | static files to a CDN with `index.html` uncached, API as a container |
| database changes | expand and contract, migrations as a pipeline step |
| debug | request id and trace id across browser, API and database |

## Interview questions {#questions}

### [basic] What are the tiers of a full-stack application and what does each do? {#tiers-q}

The presentation tier is the React app in the browser (UI, local state, instant validation). The application tier is the API (authentication, authorisation, validation and business rules). The data tier is the database and its supporting stores. The browser is untrusted and never talks to the database, so every rule that matters is enforced again in the API.

### [basic] What is CORS and how do you avoid dealing with it? {#cors-q}

CORS is the browser rule that lets a page read responses from another origin only if the server allows it with headers. It appears when the front end and API have different origins. Avoid it by serving both from one origin behind a reverse proxy, and in development by proxying `/api` through the Vite dev server. When two origins are needed, configure an allow-list on the API and handle the preflight. See [CORS in Express](lesson:node-express#security).

### [basic] Why should you not put secrets in `VITE_` environment variables? {#env-q}

Vite replaces `import.meta.env.VITE_*` at **build time** and the values end up in the JavaScript bundle that every visitor downloads, so they are public. Only put non-secret configuration there (an API base URL, a public client id). Secrets stay on the server, and the SPA gets what it needs through the API.

### [basic] How do the front end and back end share types? {#types-q}

In a TypeScript monorepo, a shared package exports zod schemas and the inferred types, which the API uses to validate and the web app uses for forms and responses. With a non-TypeScript or multi-client back end, generate the types and a client from an OpenAPI spec. tRPC infers types directly from server functions. Contract tests (Pact) protect the boundary between separate teams.

### [basic] Why is `fetch` not enough on its own for a real app? {#fetch-q}

It does not reject on 4xx and 5xx responses, has no timeout by default, no caching, de-duplication, retries or loading state, and each call repeats the base URL, headers and error handling. So wrap it in one typed client that checks `res.ok` and throws a structured error, and use TanStack Query or RTK Query for server-state caching and loading flags.

### [intermediate] Where should a SPA store its authentication token? {#token-q}

Not in `localStorage` or `sessionStorage`, because any injected script (XSS or a compromised dependency) can read it. Best for a bank is a backend for frontend: the server completes the authorization code flow, keeps the tokens, and gives the browser only an httpOnly, Secure, SameSite session cookie that JavaScript cannot read. Otherwise keep a short-lived access token in memory and renew it with a refresh token in an httpOnly cookie. Cookie sessions need CSRF protection, and all setups need XSS prevention.

### [intermediate] How does the authorization code flow with PKCE work for a SPA? {#pkce-q}

The app creates a random code verifier and sends its hash (the code challenge) when redirecting the user to the identity provider. The user signs in there, and the provider redirects back with a one-time authorization code. The code and the original verifier are then exchanged for tokens, and the provider checks that the verifier matches the challenge. A stolen code is useless without the verifier, and a public client needs no secret. See [OIDC](lesson:oidc#flow).

### [intermediate] How do you handle an expired token without logging the user out? {#refresh-q}

On a 401, request a new access token once with the refresh token (a cookie or a BFF endpoint), then retry the original request. Share a single in-flight refresh promise so concurrent failing calls trigger one refresh. If the refresh fails, clear client state and redirect to login. Do not loop: retry only once, and never retry a refresh on 401.

### [intermediate] What is CSRF, and does it affect a SPA with a JWT? {#csrf-q}

CSRF tricks a logged-in user's browser into sending a request to your site, relying on the browser attaching cookies automatically. It affects cookie-based authentication, which is defended with `SameSite=Lax` or `Strict`, a CSRF token or a required custom header, and no state changes on GET. A JWT sent in the `Authorization` header is not attached automatically, so CSRF does not apply, but if the JWT is stored in `localStorage` an XSS attack can steal it, so the choice trades one risk for another.

### [intermediate] Walk through what happens when a user clicks Send on a transfer. {#walk-q}

The form validates with the shared schema and the mutation sends `POST /api/transfers` with the cookie and an `Idempotency-Key`. The proxy forwards it to an API instance, where middleware logs it with a request id, parses the body, rate limits, authenticates and validates it again. The service opens a transaction, checks idempotency, locks the source account, checks ownership and funds, writes the transfer and ledger entries and stores the key, then commits. The API returns 201 with `Location`. The client invalidates the accounts and transactions queries, which refetch, so the screen shows the true state. Errors return a coded body that the UI maps to a field error or a retry that reuses the same key.

### [intermediate] How do you stop a double-click or a retry from sending money twice? {#double-q}

Disable the button while pending, and make the request idempotent: the client creates one key per submission and sends it as `Idempotency-Key` on every retry. The server stores the key with a unique constraint in the same transaction as the transfer and, when it sees the key again, returns the saved result instead of repeating the work. A database transaction and a row lock stop concurrent requests from overdrawing the account.

### [intermediate] How do you deploy the front end and the API, and why separately? {#deploy-q}

The API is a container image rolled out gradually behind health checks. The SPA is static files uploaded to object storage and served by a CDN, with hashed file names cached for a year and `index.html` uncached. They change at different rates and need different infrastructure, so they deploy independently. Because versions overlap during a rollout, keep API changes backward compatible, keep the old hashed files available briefly, and use expand and contract for database changes.

### [deep] How do you change a database column used by a running API without downtime? {#migration-q}

Use expand and contract. Expand: add the new column as nullable, an additive change that old code ignores. Deploy code that writes both columns and reads the new one, and backfill existing rows in batches. Verify, then in a later release remove the old column and the dual-write code. Run migrations as a separate, reviewed pipeline step that executes once, not on each instance start, and make sure a rollback of the application is still possible at each stage.

### [deep] How would you make debugging a failure across the browser, API and database easy? {#debug-q}

Create a request id (or W3C `traceparent`) at the edge or in the browser, send it with every request, return it in error bodies and show it to the user as a reference. Include it in every log line through structured logging, and propagate it to downstream calls and database query comments. Use OpenTelemetry for traces from the browser through Express to the database, track front-end errors with source maps, and alert on error rate and latency. Then one id leads from a user's screenshot to the exact trace.

### [deep] When would you choose Next.js or server rendering over a React SPA with a separate API? {#ssr-q}

Choose server rendering when first paint and SEO matter (public marketing and content pages), when you want less client JavaScript, or when a BFF and the UI naturally live in one project. A logged-in dashboard that is not indexed gets less benefit from it, and a SPA with a separate API is simpler to host (a CDN plus containers) and lets other clients (mobile, partners) reuse the API. Server rendering adds a Node server to run and operate, and more rules for caching and data fetching. Many teams use both: server-rendered public pages and an SPA behind login.

### [coding] Write a typed `api()` client with a base path, timeout, structured error, and a single shared token refresh on 401. {#coding-client}

```ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, 'body'> & { json?: unknown; timeoutMs?: number };

let refreshing: Promise<void> | null = null;

async function raw<T>(path: string, { json, timeoutMs = 15_000, headers, signal, ...init }: Options): Promise<T> {
  const h = new Headers(headers);
  if (json !== undefined) h.set('Content-Type', 'application/json');

  const res = await fetch(`/api${path}`, {
    ...init,
    headers: h,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    credentials: 'include',
    signal: signal ?? AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.code ?? 'UNKNOWN', data.message ?? res.statusText, data.requestId);
  }
  return data as T;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  try {
    return await raw<T>(path, options);
  } catch (e) {
    const expired = e instanceof ApiError && e.status === 401 && path !== '/auth/refresh';
    if (!expired) throw e;

    // one refresh for all concurrent failures
    refreshing ??= raw<void>('/auth/refresh', { method: 'POST' }).finally(() => { refreshing = null; });
    try {
      await refreshing;
    } catch {
      window.location.assign('/login');                 // refresh failed: sign in again
      throw e;
    }
    return raw<T>(path, options);                       // retry exactly once
  }
}
```

The client sends cookies, times out, returns typed data, throws a structured `ApiError` with the server's code and request id, and refreshes once even when many calls fail together. Refresh calls never trigger another refresh, so there is no loop.

### [coding] Write the Express route and service for `POST /transfers` with idempotency and a database transaction, using the shared `CreateTransfer` schema. {#coding-transfer}

```ts
import { Router } from 'express';
import { CreateTransfer } from '@bank/contracts';
import { pool } from '../db';

export const transfers = Router();

transfers.post('/', async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key || key.length > 80) return res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED' });

  const parsed = CreateTransfer.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: 'VALIDATION_FAILED',
      fields: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const result = await makeTransfer(req.user.id, parsed.data, key);   // Express 5 forwards rejections
  res.status(result.replayed ? 200 : 201)
     .location(`/transfers/${result.transfer.id}`)
     .json(result.transfer);
});

async function makeTransfer(userId: string, input: CreateTransfer, key: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // a repeat of the same key returns the first result
    const prior = await client.query(
      'SELECT response FROM idempotency WHERE user_id = $1 AND key = $2', [userId, key]);
    if (prior.rowCount) {
      await client.query('COMMIT');
      return { transfer: prior.rows[0].response, replayed: true };
    }

    // lock the source account so concurrent transfers cannot overdraw it
    const from = await client.query(
      'SELECT id, owner_id, balance FROM accounts WHERE id = $1 FOR UPDATE', [input.fromAccount]);
    if (!from.rowCount || from.rows[0].owner_id !== userId) throw new AppError(404, 'ACCOUNT_NOT_FOUND');
    if (from.rows[0].balance < input.amount) throw new AppError(422, 'INSUFFICIENT_FUNDS');

    const t = (await client.query(
      `INSERT INTO transfers (from_account, to_account, amount, currency, status)
       VALUES ($1, $2, $3, $4, 'POSTED') RETURNING *`,
      [input.fromAccount, input.toAccount, input.amount, input.currency])).rows[0];

    await client.query(
      `INSERT INTO ledger (account_id, delta, transfer_id) VALUES ($1, $2, $4), ($3, $5, $4)`,
      [input.fromAccount, -input.amount, input.toAccount, t.id, input.amount]);

    await client.query(
      'INSERT INTO idempotency (user_id, key, response) VALUES ($1, $2, $3)', [userId, key, t]);

    await client.query('COMMIT');
    return { transfer: t, replayed: false };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;                                            // the error middleware maps it
  } finally {
    client.release();                                   // always return the connection to the pool
  }
}
```

The same schema validates here and in the browser. The row lock and the transaction stop double spending, the key has a unique constraint `(user_id, key)` that also protects against two simultaneous retries, parameterised queries prevent injection, and the connection is released in `finally`.

### [coding] Write the React transfer form: shared schema validation, a stable idempotency key, pending state, and server error mapping. {#coding-form}

```tsx
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateTransfer } from '@bank/contracts';
import { ApiError } from '../api/client';
import { useSendTransfer } from '../api/transfers';

export function TransferForm({ fromAccount }: { fromAccount: string }) {
  const keyRef = useRef(crypto.randomUUID());            // one key for this submission, reused on retry
  const send = useSendTransfer();

  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<CreateTransfer>({
    resolver: zodResolver(CreateTransfer),               // the same rules the server applies
    defaultValues: { fromAccount, currency: 'SGD' },
  });

  const onSubmit = handleSubmit((body) => {
    send.mutate({ body, key: keyRef.current }, {
      onSuccess: () => {
        keyRef.current = crypto.randomUUID();            // a new transfer gets a new key
        reset();
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'INSUFFICIENT_FUNDS') {
          setError('amount', { message: 'Not enough balance' });        // show next to the field
        } else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
          // server found something the client missed: map the fields back
          (err as any).fields?.forEach((f: { field: string; message: string }) =>
            setError(f.field as keyof CreateTransfer, { message: f.message }));
        }
        // network errors keep the same key, so pressing Send again is safe
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <label>
        To account
        <input {...register('toAccount')} aria-invalid={!!errors.toAccount} />
      </label>
      {errors.toAccount && <p role="alert">{errors.toAccount.message}</p>}

      <label>
        Amount (cents)
        <input type="number" {...register('amount', { valueAsNumber: true })} aria-invalid={!!errors.amount} />
      </label>
      {errors.amount && <p role="alert">{errors.amount.message}</p>}

      <button type="submit" disabled={send.isPending}>
        {send.isPending ? 'Sending…' : 'Send'}
      </button>

      {send.isError && !errors.amount && (
        <p role="alert">
          Could not send the transfer. Please try again.
          {send.error instanceof ApiError && send.error.requestId && ` Reference: ${send.error.requestId}`}
        </p>
      )}
    </form>
  );
}
```

The form reuses the contract schema, so browser and server agree. The idempotency key lives in a ref, so re-renders keep it, a retry after a network failure reuses it, and only a successful transfer creates a new one. The button is disabled while pending, and server error codes map to the right field or a message that includes the request id for support.
