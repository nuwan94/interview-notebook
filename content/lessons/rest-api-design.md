---
title: REST API design — resources, idempotency, pagination, versioning and concurrency
nav: REST API design
slug: rest-api-design
summary: Designing REST APIs that survive retries and change, resource modelling and HTTP semantics, idempotency keys, pagination (offset versus cursor), filtering, versioning, conditional requests with ETags, error contracts, long-running operations and rate limiting, with Spring examples and interview questions.
tags: [REST, API Design, Idempotency, Pagination, HTTP, Spring]
order: 31
topic: Spring / Web
updated: 2026-11-13
subnav: true
---

Beyond the Spring annotations in [Spring MVC and REST](lesson:spring-mvc), interviewers test API *design judgement*: *how do you make a payment API safe to retry, how do you paginate, how do you version, how do you prevent lost updates, and what status code do you return?* This is especially important in banking, where a duplicated POST means money moves twice. It connects to [ACID and BASE](lesson:acid-base#lost-update) (lost updates), [messaging](lesson:messaging) (idempotent consumers) and [Spring Cloud](lesson:spring-cloud) (retries and rate limiting). Play the three scenes: idempotency keys, offset versus cursor paging, and ETag with If-Match.

```demo
name: rest-api-walk
```

> **One sentence to remember:** *design every API assuming the network will lose, duplicate and reorder requests: make writes safe to retry, make pages stable, and make concurrent edits detectable.*

## Resource design {#resources}

- **Model resources (nouns), not operations:** `/accounts/{id}`, `/accounts/{id}/transactions`, not `/getAccount` or `/doTransfer`. Collections are plural; nesting shows ownership but stay shallow (two levels).
- **HTTP methods carry the verb:** `GET` read, `POST` create (or a non-idempotent action), `PUT` replace, `PATCH` partial update, `DELETE` remove.
- **Actions that do not fit CRUD** become sub-resources or events: `POST /transfers` (a transfer is a thing with a state), `POST /accounts/{id}/freeze` or a state change on the resource. Prefer representing a long-lived process as a resource you can GET.
- **Representations:** stable, documented JSON (ISO 8601 timestamps, amounts as strings or integer minor units plus currency, never floating point), consistent naming, additive evolution.
- **Richardson maturity:** level 0 one endpoint, level 1 resources, level 2 HTTP verbs and status codes (what most "REST" APIs are), level 3 hypermedia links (HATEOAS, rarely worth it outside public APIs).

| Method | Safe | Idempotent | Typical success |
| --- | --- | --- | --- |
| GET, HEAD, OPTIONS | yes | yes | 200 |
| PUT | no | yes | 200 or 204 |
| DELETE | no | yes | 204 (a repeat may return 404, the state is the same) |
| PATCH | no | not guaranteed | 200 |
| POST | no | **no** | 201 with `Location`, or 202 |

## Idempotency {#idempotency}

**Idempotent** means repeating a request has the same effect as sending it once. Networks force clients to retry (timeouts, dropped responses), so any write that must not happen twice needs an idempotency mechanism.

### Idempotency keys {#keys}

The client generates a unique key (a UUID) per logical operation and sends it in an `Idempotency-Key` header. The server:

1. looks up the key; if a completed result exists, **replays the stored response** without repeating the work;
2. otherwise records the key as *in progress*, performs the operation, and stores the response **in the same database transaction** as the business change;
3. answers `409 Conflict` if the same key is still in progress, and `422` if the key is reused with a **different request body** (compare a hash).

```java
@PostMapping("/payments")
ResponseEntity<PaymentDto> pay(@RequestHeader("Idempotency-Key") String key, @Valid @RequestBody PaymentRequest request) {
    return service.pay(key, request);          // service: insert key row (unique), perform, store response, all in one transaction
}

// table: idempotency(key PRIMARY KEY, request_hash, status, response_body, created_at)
// a duplicate concurrent request fails the unique insert: catch DuplicateKeyException and return the stored or in-progress result
```

Keys expire after a retention window (for example 24 hours). A **natural unique constraint** (a client-supplied payment reference with a unique index, answered with 409 or the existing resource) achieves the same for many cases. Idempotent consumers of messages use the same trick ([idempotent consumer](lesson:messaging#idempotent)).

### Making retries safe {#retries}

Clients retry only idempotent requests (or POSTs with a key), with **exponential backoff and jitter**, honouring `Retry-After`, and a retry budget. Servers return `503` or `429` with `Retry-After` when shedding load. The server never assumes that a request it processed was acknowledged.

## Pagination, filtering and sorting {#pagination}

| | Offset (`page`, `size`) | Cursor (keyset) |
| --- | --- | --- |
| Request | `?page=3&size=20` | `?after=<cursor>&size=20` |
| Stable when data changes | no: inserts and deletes cause duplicates or gaps | yes |
| Deep pages | slow (`OFFSET` scans and discards) | fast (index range scan) |
| Jump to page N | yes | no |
| Total count | possible (extra query) | usually omitted or approximate |

Use **cursor pagination** for large, changing or infinite lists (transactions, events); offset for small admin tables. The cursor is an opaque token (encoded last key plus sort values). Return the next cursor in the body or a `Link` header, a stable unique sort order, and a maximum page size. Filtering and sorting go in query parameters (`?status=ACTIVE&sort=-createdAt`), whitelisted and indexed, never raw SQL fragments ([Spring Data pagination](lesson:spring-data-jpa#paging)).

## Concurrency control {#concurrency}

Two clients editing the same resource cause the **lost update** problem over HTTP. Use **conditional requests**:

- the server sends a validator: `ETag: "v3"` (from a version column or a hash) and `Last-Modified`;
- updates send `If-Match: "v3"`; if the current version differs the server answers **`412 Precondition Failed`**, and the client refetches and merges;
- requiring the header (`428 Precondition Required`) forces clients to participate;
- reads send `If-None-Match` and get **`304 Not Modified`** for unchanged data (saves bandwidth, also usable for caching).

```java
@PutMapping("/customers/{id}")
ResponseEntity<CustomerDto> update(@PathVariable long id, @RequestHeader("If-Match") String ifMatch, @Valid @RequestBody UpdateCustomer body) {
    CustomerDto updated = service.update(id, parseVersion(ifMatch), body);          // @Version column: optimistic locking
    return ResponseEntity.ok().eTag("\"" + updated.version() + "\"").body(updated);
}
// ObjectOptimisticLockingFailureException is mapped to 412 (or 409) in the @RestControllerAdvice
```

This is [optimistic locking](lesson:acid-base#lost-update) exposed over HTTP.

## Errors, versioning and evolution {#evolution}

- **Errors:** a consistent body, ideally RFC 9457 `application/problem+json` ([ProblemDetail](lesson:spring-mvc#errors)), with a machine-readable `type` or code, human `detail`, field errors and a correlation id. Status codes: 400 malformed or invalid, 401 not authenticated, 403 not allowed, 404 missing, 409 conflict or duplicate, 412 stale precondition, 422 business rule, 429 too many requests.
- **Versioning:** path (`/v1/...`, simplest to route and cache), header or media type (`Accept: application/vnd.bank.v2+json`), or none with strict **backward-compatible** evolution. Rules: adding optional fields or endpoints is compatible; removing or renaming fields, changing types or semantics is breaking. Clients must **ignore unknown fields** (the tolerant-reader principle). Deprecate with notice (`Deprecation`, `Sunset` headers) and keep few versions alive.
- **Contracts:** describe the API with **OpenAPI** (springdoc generates it), review it as a design artifact, and verify compatibility with contract tests.

## Long-running work, bulk and limits {#long-running}

- **Asynchronous operations:** return `202 Accepted` with a `Location` of a **status resource** (`/exports/77`); the client polls it (`200` running or done, with a link to the result), or receives a webhook or event. Never hold an HTTP request open for minutes.
- **Bulk operations:** accept arrays with per-item results (`207 Multi-Status` style) or provide a job resource; define atomicity (all or nothing versus partial) and make items individually idempotent.
- **Rate limiting:** `429 Too Many Requests` with `Retry-After` and limit headers (`RateLimit-Limit`, `-Remaining`, `-Reset`), per client or token, enforced at the [gateway](lesson:spring-cloud#gateway).
- **Caching:** `Cache-Control`, `ETag`; never cache personalised or sensitive responses publicly (`private, no-store`).
- **Security basics:** HTTPS only, authenticate and authorise every request and every object (prevent broken object-level authorisation: check that the caller owns `{id}`), validate input, limit payload size, no sensitive data in URLs ([JWT](lesson:jwt), [Spring Security](lesson:spring-security)).
- **Money:** amounts as decimal strings or minor units with a currency code; never floats.

### REST, GraphQL and gRPC {#alternatives}

| | REST | GraphQL | gRPC |
| --- | --- | --- | --- |
| Fit | public and CRUD-style APIs, caching | clients needing flexible shapes (mobile, many views) | internal service-to-service, streaming, low latency |
| Typing | OpenAPI | schema | Protocol Buffers |
| Caching | HTTP caching works | harder (single endpoint) | not HTTP-cache friendly |
| Costs | over- and under-fetching | complexity, N+1 resolvers, query cost limits | browser support, tooling |

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Resources | nouns, plural collections, verbs from HTTP methods |
| Idempotent methods | GET, PUT, DELETE; POST is not |
| Idempotency key | client UUID; server stores and replays the result, same transaction |
| Same key, different body | 422; in progress: 409 |
| Pagination | cursor for large or changing lists; offset for small ones |
| ETag + If-Match | detect lost updates: 412 on mismatch; If-None-Match gives 304 |
| Errors | `application/problem+json`, stable codes, correlation id |
| Versioning | path or header; additive changes; tolerant readers |
| Long operations | 202 + status resource, not an open request |
| Rate limits | 429 + Retry-After |
| Money | decimal string or minor units + currency |

## Interview questions {#questions}

### [basic] What makes an API RESTful? {#restful-q}

Resources identified by URIs, manipulated through a uniform interface of HTTP methods with standard status codes, stateless requests (each carries what the server needs), representations such as JSON, cacheability and a layered system. In practice most "REST" APIs are Richardson level 2: resources, verbs and status codes, without hypermedia.

### [basic] What does idempotent mean and which HTTP methods are idempotent? {#idempotent-q}

Repeating the request leaves the server in the same state as sending it once. GET, PUT, DELETE (and HEAD, OPTIONS) are idempotent; POST is not, and PATCH is not guaranteed. Idempotency matters because clients retry after timeouts, and it is what makes retries safe.

### [basic] PUT versus PATCH versus POST? {#put-patch-q}

POST creates a resource (server picks the id) or triggers a non-idempotent action. PUT replaces the whole resource at a known URI and is idempotent. PATCH applies a partial change (JSON Patch or JSON Merge Patch) and is not necessarily idempotent. Use PUT for full updates, PATCH for small changes.

### [basic] Which status codes would you return for common outcomes? {#status-q}

200 for a successful read or update, 201 with `Location` for creation, 202 for accepted asynchronous work, 204 for no content, 400 for malformed input, 401 not authenticated, 403 forbidden, 404 not found, 409 conflict, 412 failed precondition, 422 business rule violation, 429 rate limited, 500 server error, 503 unavailable with `Retry-After`.

### [intermediate] How do you make a payment API safe against duplicate requests? {#payment-q}

Require an `Idempotency-Key` header. The server stores the key with the request hash and, in the same transaction as the payment, the response. A retry with the same key returns the stored response without paying again; the same key with a different body is rejected (422) and a concurrent duplicate gets 409. A unique constraint on the key guarantees only one request wins.

### [intermediate] Offset versus cursor pagination? {#paging-q}

Offset is simple and allows jumping to a page, but under concurrent inserts and deletes it duplicates or skips rows and gets slower for deep pages because the database scans skipped rows. Cursor (keyset) pagination continues after the last seen key (`WHERE id < :last`), so it is stable and fast with an index, at the cost of no random page access and often no total count.

### [intermediate] How do you prevent lost updates in a REST API? {#lost-update-q}

Optimistic concurrency with ETags: the server returns an `ETag` (the version) with the resource; the client sends `If-Match` on update; if the version changed the server returns 412 Precondition Failed and the client must refetch and merge. Behind it, a version column with `@Version` gives atomic checks in the database.

### [intermediate] How do you version a REST API without breaking clients? {#versioning-q}

Prefer backward-compatible evolution (add optional fields and endpoints, never remove or change meaning), tolerant readers on the client (ignore unknown fields), and an explicit version (path or media type) only for breaking changes. Announce deprecations (`Deprecation`, `Sunset` headers), run old and new versions side by side, and check compatibility with contract tests.

### [intermediate] How would you design an endpoint for a long-running export? {#async-q}

`POST /exports` returns `202 Accepted` with `Location: /exports/77`. The client polls `GET /exports/77`, which reports `running`, `failed` or `done` with a link to the result file; optionally a webhook or event notifies completion. The job runs on a worker or queue, is idempotent, and results expire.

### [intermediate] How do you handle rate limiting in an API? {#rate-limit-q}

Limit per client or token at the gateway (token bucket, Redis-backed), return `429 Too Many Requests` with `Retry-After` and rate-limit headers, document the limits, and distinguish bursts from sustained rates. Clients back off with jitter. Protect expensive endpoints with stricter or separate limits.

### [intermediate] What is HATEOAS and is it worth it? {#hateoas-q}

Hypermedia as the engine of application state: responses contain links to the available next actions, so clients follow links instead of hard-coding URLs. It reduces coupling in theory, but adds payload and effort and few clients use it, so it is mostly used in public or highly evolving APIs; most internal APIs stop at level 2.

### [deep] What are the pitfalls of idempotency key implementations? {#pitfalls-q}

Not storing the response in the same transaction as the business change (a crash leaves a key with no result or a result with no key), no unique constraint (concurrent duplicates both proceed), not binding the key to the request body or the caller (a key from user A replayed by user B), no expiry, and not defining behaviour for in-progress requests. Scope keys per client and operation.

### [deep] How do you avoid broken object-level authorisation? {#bola-q}

Never rely on the id being hard to guess. On every request check that the authenticated principal is allowed to access that specific object (ownership, tenant, role) in the service or with method security (`@PreAuthorize("@access.canView(#id, principal)")`), return 404 or 403 consistently, and test authorisation per endpoint with different users. It is the most common API vulnerability.

### [deep] When would you choose GraphQL or gRPC over REST? {#alternatives-q}

GraphQL when many clients need flexible, nested data and you want to avoid over- and under-fetching (accepting resolver N+1 handling, query cost limits and weaker HTTP caching). gRPC for internal low-latency service calls with strong typed contracts and streaming. REST for public, cache-friendly, CRUD-oriented APIs with the widest tooling.

### [coding] Implement idempotent payment creation in Spring. {#coding-idempotent}

```java
@Service
class PaymentService {
    private final IdempotencyRepository keys;
    private final PaymentRepository payments;

    @Transactional
    public PaymentDto pay(String key, PaymentRequest req) {
        String hash = sha256(req);
        Optional<IdempotencyRecord> existing = keys.findById(key);
        if (existing.isPresent()) {
            IdempotencyRecord r = existing.get();
            if (!r.requestHash().equals(hash)) throw new IdempotencyKeyReusedException(key);        // 422
            return r.response();                                                                    // replay, no second payment
        }
        try {
            keys.saveAndFlush(new IdempotencyRecord(key, hash));                                    // unique key: concurrent duplicate fails
        } catch (DataIntegrityViolationException e) {
            throw new RequestInProgressException(key);                                              // 409
        }
        Payment p = payments.save(Payment.from(req));
        PaymentDto dto = PaymentDto.of(p);
        keys.complete(key, dto);                                                                    // store the response in the same transaction
        return dto;
    }
}
```

Explain that the key row and the payment commit together, so a crash leaves neither, that the hash catches key reuse with a different body, and that the unique constraint serialises concurrent duplicates.

### [coding] Implement cursor pagination for a transaction history endpoint. {#coding-cursor}

```java
record Page<T>(List<T> items, String nextCursor) {}

@GetMapping("/accounts/{id}/transactions")
Page<TxDto> list(@PathVariable long id, @RequestParam(required = false) String after, @RequestParam(defaultValue = "20") @Max(100) int size) {
    long lastId = after == null ? Long.MAX_VALUE : decode(after);
    List<Tx> rows = repo.findByAccountIdAndIdLessThanOrderByIdDesc(id, lastId, PageRequest.of(0, size + 1));
    boolean more = rows.size() > size;
    List<Tx> page = more ? rows.subList(0, size) : rows;
    return new Page<>(page.stream().map(TxDto::of).toList(), more ? encode(page.get(page.size() - 1).getId()) : null);
}
```

Explain fetching size + 1 to know whether another page exists without a count query, that the cursor is an opaque encoded id, and that an index on `(account_id, id)` keeps every page fast.

### [coding] Return an ETag and enforce If-Match on update. {#coding-etag}

```java
@GetMapping("/customers/{id}")
ResponseEntity<CustomerDto> get(@PathVariable long id) {
    CustomerDto c = service.find(id);
    return ResponseEntity.ok().eTag("\"" + c.version() + "\"").body(c);
}

@PutMapping("/customers/{id}")
ResponseEntity<CustomerDto> put(@PathVariable long id, @RequestHeader(value = "If-Match", required = false) String ifMatch, @RequestBody @Valid UpdateCustomer body) {
    if (ifMatch == null) return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED).build();      // 428
    CustomerDto updated = service.update(id, Long.parseLong(ifMatch.replace("\"", "")), body);       // throws on version mismatch
    return ResponseEntity.ok().eTag("\"" + updated.version() + "\"").body(updated);
}

@ExceptionHandler(ObjectOptimisticLockingFailureException.class)
ResponseEntity<ProblemDetail> stale() {
    return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED).body(ProblemDetail.forStatusAndDetail(HttpStatus.PRECONDITION_FAILED, "The resource was modified by someone else"));
}
```

Explain that the version comes from a `@Version` column, 428 forces clients to send the precondition, and 412 tells the client to refetch and merge.
