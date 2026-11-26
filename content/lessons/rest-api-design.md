---
title: REST API design — resources, idempotency, pagination, versioning and concurrency
nav: REST API design
slug: rest-api-design
summary: Designing REST APIs that survive retries and change, resource modelling and HTTP semantics, idempotency keys, pagination (offset versus cursor), filtering, versioning, conditional requests with ETags, error contracts, long-running operations and rate limiting, with Spring examples and interview questions.
tags: [REST, API Design, Idempotency, Pagination, HTTP, Spring]
order: 85
topic: Spring / Web and security
updated: 2026-11-26
subnav: true
---

[Spring MVC and REST](lesson:spring-mvc) covers the Spring annotations. Interviewers also test your API *design judgement*:

- How do you make a payment API safe to retry?
- How do you paginate?
- How do you version?
- How do you prevent lost updates?
- Which status code do you return?

This matters most in banking, where a duplicated POST means money moves twice. The lesson connects to [ACID and BASE](lesson:acid-base#lost-update) (lost updates), [messaging](lesson:messaging) (idempotent consumers) and [Spring Cloud](lesson:spring-cloud) (retries and rate limiting).

The demo has three scenes: idempotency keys, offset versus cursor paging, and ETag with If-Match.

```demo
name: rest-api-walk
```

> **One sentence to remember:** *Assume every request can be lost, repeated or reordered, and design for it.*

In practice that means three things: writes are safe to retry, pages stay stable, and two people editing the same thing are noticed.

## Resource design {#resources}

- **Model resources (nouns), not operations.** Use `/accounts/{id}` and `/accounts/{id}/transactions`, not `/getAccount` or `/doTransfer`. Collections are plural. Nesting shows ownership, but keep it shallow (two levels at most).
- **HTTP methods carry the verb:** `GET` reads, `POST` creates (or runs an action that is not idempotent), `PUT` replaces, `PATCH` changes part of a resource, `DELETE` removes.
- **Actions that do not fit create, read, update and delete** become sub-resources or events. For example, `POST /transfers` works because a transfer is a thing with a state. `POST /accounts/{id}/freeze`, or a state change on the account, also works. A long-running process is best shown as a resource you can GET.
- **Representations:** stable, documented JSON. Use ISO 8601 timestamps. Send amounts as strings, or as whole numbers of the smallest unit (cents) plus a currency, never as floating point. Name things consistently, and change them only by adding.
- **Richardson maturity model**, a scale of how "RESTful" an API is:
  - level 0: one endpoint for everything,
  - level 1: separate resources,
  - level 2: HTTP verbs and status codes (most "REST" APIs stop here),
  - level 3: hypermedia links (HATEOAS), rarely worth it outside public APIs.

| Method | Safe | Idempotent | Typical success |
| --- | --- | --- | --- |
| GET, HEAD, OPTIONS | Yes. | Yes. | 200 |
| PUT | No. | Yes. | 200 or 204 |
| DELETE | No. | Yes. | 204. A repeat may return 404, but the state is the same. |
| PATCH | No. | Not guaranteed. | 200 |
| POST | No. | **No.** | 201 with `Location`, or 202 |

## Idempotency {#idempotency}

**Idempotent** means that repeating a request has the same effect as sending it once.

Networks force clients to retry: requests time out and responses get lost. So any write that must not happen twice needs a way to be idempotent.

### Idempotency keys {#keys}

The client creates a unique key (a UUID) for each logical operation. It sends the key in an `Idempotency-Key` header. The server then:

1. Looks up the key. If a finished result exists, it **sends back the stored response** and does not repeat the work.
2. Otherwise it records the key as *in progress*, does the work, and stores the response **in the same database transaction** as the business change.
3. Answers `409 Conflict` if the same key is still in progress. Answers `422` if the key is reused with a **different request body**, which it detects by comparing a hash of the body.

```java
@PostMapping("/payments")
ResponseEntity<PaymentDto> pay(@RequestHeader("Idempotency-Key") String key, @Valid @RequestBody PaymentRequest request) {
    return service.pay(key, request);          // service: insert key row (unique), perform, store response, all in one transaction
}

// table: idempotency(key PRIMARY KEY, request_hash, status, response_body, created_at)
// a duplicate concurrent request fails the unique insert: catch DuplicateKeyException and return the stored or in-progress result
```

Keys expire after a retention window, for example 24 hours.

In many cases a **natural unique constraint** does the same job. For example, the client sends its own payment reference, a unique index protects it, and a duplicate gets 409 or the existing resource. Message consumers use the same trick ([idempotent consumer](lesson:messaging#idempotent)).

### Making retries safe {#retries}

Clients follow these rules:

- Retry only idempotent requests, or POSTs that carry a key.
- Wait longer between each retry (**exponential backoff**), with some randomness (**jitter**) so clients do not all retry at once.
- Respect the `Retry-After` header.
- Stop after a fixed retry budget.

Servers return `503` or `429` with `Retry-After` when they are overloaded. A server never assumes that the client received a response just because the request was processed.

## Pagination, filtering and sorting {#pagination}

| | Offset (`page`, `size`) | Cursor (keyset) |
| --- | --- | --- |
| Request | `?page=3&size=20` | `?after=<cursor>&size=20` |
| Stable when data changes | No. Inserts and deletes cause duplicates or gaps. | Yes. |
| Deep pages | Slow, because `OFFSET` scans rows and throws them away. | Fast, because it reads a range from the index. |
| Jump to page N | Yes. | No. |
| Total count | Possible, with an extra query. | Usually left out, or only approximate. |

Use **cursor pagination** for large, changing or endless lists, such as transactions and events. Use offset for small admin tables.

How to do cursor pagination well:

- The cursor is an opaque token: the last key and sort values, encoded.
- Return the next cursor in the body or in a `Link` header.
- Sort by a stable, unique order.
- Set a maximum page size.

Filtering and sorting go in query parameters, such as `?status=ACTIVE&sort=-createdAt`. Allow only a fixed list of fields, make sure they are indexed, and never accept raw SQL fragments ([Spring Data pagination](lesson:spring-data-jpa#paging)).

## Concurrency control {#concurrency}

When two clients edit the same resource, one can silently overwrite the other. This is the **lost update** problem, and it happens over HTTP too. The fix is **conditional requests**:

- The server sends a *validator* that identifies the version: `ETag: "v3"` (from a version column or a hash), and `Last-Modified`.
- Updates send `If-Match: "v3"`. If the current version is different, the server answers **`412 Precondition Failed`**. The client then fetches the resource again and merges its change.
- The server can require the header by answering `428 Precondition Required` when it is missing. This forces every client to take part.
- Reads can send `If-None-Match` and get **`304 Not Modified`** when nothing changed. This saves bandwidth and also helps caching.

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

- **Errors:** use one consistent body, ideally RFC 9457 `application/problem+json` ([ProblemDetail](lesson:spring-mvc#errors)). Include a machine-readable `type` or code, a human-readable `detail`, field errors and a correlation ID. Status codes:
  - 400 for malformed or invalid input, 401 when not authenticated, 403 when not allowed, 404 when missing,
  - 409 for a conflict or duplicate, 412 for a stale precondition, 422 when a business rule fails, 429 for too many requests.
- **Versioning:** put the version in the path (`/v1/...`, simplest to route and cache) or in a header or media type (`Accept: application/vnd.bank.v2+json`). Or use no version at all and evolve only in **backward-compatible** ways.
  - Adding optional fields or new endpoints is compatible.
  - Removing or renaming fields, or changing a type or a meaning, is breaking.
  - Clients must **ignore fields they do not know** (the *tolerant reader* principle).
  - Announce deprecations with the `Deprecation` and `Sunset` headers, and keep few versions alive.
- **Contracts:** describe the API with **OpenAPI** (springdoc generates it). Review it as a design document, and check compatibility with contract tests.

## Long-running work, bulk and limits {#long-running}

- **Asynchronous operations:** return `202 Accepted` with a `Location` pointing to a **status resource** (`/exports/77`). The client polls it, and gets `200` with "running" or "done" plus a link to the result. Or the client gets a webhook or an event. Never hold an HTTP request open for minutes.
- **Bulk operations:** accept an array and return a result for each item (in the style of `207 Multi-Status`), or provide a job resource. Decide whether the batch is all-or-nothing or can partly succeed, and make each item idempotent on its own.
- **Rate limiting:** return `429 Too Many Requests` with `Retry-After` and the limit headers (`RateLimit-Limit`, `-Remaining`, `-Reset`). Limit per client or token, and enforce it at the [gateway](lesson:spring-cloud#gateway).
- **Caching:** use `Cache-Control` and `ETag`. Never let a shared cache store personal or sensitive responses: mark them `private, no-store`.
- **Security basics:**
  - HTTPS only.
  - Authenticate and authorise every request, and every object. This prevents *broken object-level authorisation*: always check that the caller owns `{id}`.
  - Validate input and limit the payload size.
  - Never put sensitive data in URLs ([JWT](lesson:jwt), [Spring Security](lesson:spring-security)).
- **Money:** send amounts as decimal strings or in the smallest unit, with a currency code. Never use floats.

### REST, GraphQL and gRPC {#alternatives}

| | REST | GraphQL | gRPC |
| --- | --- | --- | --- |
| Fits | Public APIs, CRUD-style APIs, and anything that benefits from HTTP caching. | Clients that need flexible data shapes, such as mobile apps with many views. | Internal calls between services, streaming, and low latency. |
| Typing | OpenAPI. | A schema. | Protocol Buffers. |
| Caching | HTTP caching works. | Harder, because there is a single endpoint. | Does not work with HTTP caches. |
| Costs | Clients get too much or too little data per call. | Complexity, N+1 problems in resolvers, and the need to limit query cost. | Limited browser support, and more tooling. |

Try it in the lab: [ETags: 304 Not Modified and lost-update protection](lab:rest-conditional-requests).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Resources | Nouns and plural collections. The HTTP method is the verb. |
| Idempotent methods | GET, PUT and DELETE are. POST is not. |
| Idempotency key | The client sends a UUID. The server stores the result in the same transaction and replays it. |
| Same key, different body | 422. Still in progress: 409. |
| Pagination | Cursor for large or changing lists, offset for small ones. |
| ETag + If-Match | Detects lost updates with 412. If-None-Match gives 304. |
| Errors | `application/problem+json`, stable codes, a correlation ID. |
| Versioning | Path or header. Change by adding. Clients ignore unknown fields. |
| Long operations | 202 and a status resource, not an open request. |
| Rate limits | 429 with Retry-After. |
| Money | A decimal string, or the smallest unit, plus a currency. |

## Interview questions {#questions}

### [basic] What makes an API RESTful? {#restful-q}

A RESTful API has:

- resources identified by URIs,
- one uniform interface: the HTTP methods, with standard status codes,
- stateless requests, so each request carries everything the server needs,
- representations such as JSON,
- responses that can be cached, and a layered system.

In practice most "REST" APIs are at Richardson level 2: resources, verbs and status codes, but no hypermedia links.

### [basic] What does idempotent mean and which HTTP methods are idempotent? {#idempotent-q}

A request is idempotent if repeating it leaves the server in the same state as sending it once.

GET, PUT and DELETE (and HEAD and OPTIONS) are idempotent. POST is not, and PATCH is not guaranteed to be.

It matters because clients retry after timeouts. Idempotency is what makes those retries safe.

### [basic] PUT versus PATCH versus POST? {#put-patch-q}

- **POST** creates a resource, and the server picks the ID. It is also used for actions that are not idempotent.
- **PUT** replaces the whole resource at a known URI. It is idempotent.
- **PATCH** applies a partial change, written as JSON Patch or JSON Merge Patch. It is not necessarily idempotent.

Use PUT for full updates and PATCH for small changes.

### [basic] Which status codes would you return for common outcomes? {#status-q}

- **Success:** 200 for a read or update, 201 with `Location` for a create, 202 for accepted asynchronous work, 204 when there is no content.
- **Client errors:** 400 for malformed input, 401 when not authenticated, 403 when forbidden, 404 when not found, 409 for a conflict, 412 for a failed precondition, 422 when a business rule fails, 429 when rate limited.
- **Server errors:** 500 for an error, 503 when unavailable (with `Retry-After`).

### [intermediate] How do you make a payment API safe against duplicate requests? {#payment-q}

Require an `Idempotency-Key` header.

- The server stores the key with a hash of the request. In the same transaction as the payment, it also stores the response.
- A retry with the same key gets the stored response, and nothing is paid again.
- The same key with a different body is rejected with 422.
- A duplicate that arrives while the first is still running gets 409.

A unique constraint on the key guarantees that only one request wins.

### [intermediate] Offset versus cursor pagination? {#paging-q}

**Offset** is simple and lets you jump to any page. But when rows are inserted or deleted between requests, it shows some rows twice or skips them. It also gets slower on deep pages, because the database scans all the rows it skips.

**Cursor (keyset)** pagination continues after the last key seen (`WHERE id < :last`). With an index it is stable and fast. The cost is that you cannot jump to a random page, and there is often no total count.

### [intermediate] How do you prevent lost updates in a REST API? {#lost-update-q}

Use optimistic concurrency with ETags:

1. The server returns an `ETag` (the version) with the resource.
2. The client sends it back in `If-Match` when it updates.
3. If the version has changed, the server returns 412 Precondition Failed. The client must fetch again and merge.

Behind this, a version column with `@Version` makes the check atomic in the database.

### [intermediate] How do you version a REST API without breaking clients? {#versioning-q}

- Prefer backward-compatible changes: add optional fields and endpoints, and never remove things or change their meaning.
- Make clients tolerant readers that ignore unknown fields.
- Add an explicit version (path or media type) only for breaking changes.
- Announce deprecations with the `Deprecation` and `Sunset` headers.
- Run old and new versions side by side.
- Check compatibility with contract tests.

### [intermediate] How would you design an endpoint for a long-running export? {#async-q}

1. `POST /exports` returns `202 Accepted` with `Location: /exports/77`.
2. The client polls `GET /exports/77`. It reports `running`, `failed`, or `done` with a link to the result file.
3. Optionally, a webhook or an event tells the client when it is done.

The job runs on a worker or a queue. It is idempotent, and its results expire.

### [intermediate] How do you handle rate limiting in an API? {#rate-limit-q}

- Limit per client or token at the gateway, for example with a token bucket stored in Redis.
- Return `429 Too Many Requests` with `Retry-After` and the rate-limit headers.
- Document the limits, and treat short bursts differently from sustained rates.
- Clients back off with jitter.
- Give expensive endpoints stricter or separate limits.

### [intermediate] What is HATEOAS and is it worth it? {#hateoas-q}

HATEOAS stands for "hypermedia as the engine of application state". Responses contain links to the actions available next, so clients follow links instead of hard-coding URLs.

In theory this reduces coupling. But it adds payload and effort, and few clients use the links. So it is mostly found in public APIs or APIs that change a lot. Most internal APIs stop at level 2.

### [deep] What are the pitfalls of idempotency key implementations? {#pitfalls-q}

- **The response is not stored in the same transaction as the business change.** A crash then leaves a key with no result, or a result with no key.
- **There is no unique constraint.** Two duplicates that arrive together both go through.
- **The key is not tied to the request body or the caller.** User B could replay user A's key.
- **Keys never expire.**
- **Nobody decided what happens to requests still in progress.**

Scope keys per client and per operation.

### [deep] How do you avoid broken object-level authorisation? {#bola-q}

Never rely on an ID being hard to guess.

- On every request, check that the logged-in user may access that specific object: ownership, tenant or role.
- Do this in the service or with method security (`@PreAuthorize("@access.canView(#id, principal)")`).
- Return 404 or 403 consistently.
- Test authorisation on each endpoint with different users.

It is the most common API vulnerability.

### [deep] When would you choose GraphQL or gRPC over REST? {#alternatives-q}

- **GraphQL** when many clients need flexible, nested data and you want to avoid getting too much or too little per call. You accept handling N+1 problems in resolvers, limits on query cost, and weaker HTTP caching.
- **gRPC** for low-latency calls between internal services, with strongly typed contracts and streaming.
- **REST** for public APIs that are cache-friendly and CRUD-oriented, with the widest tooling.

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

Explain these points:

- The key row and the payment commit together, so a crash leaves neither.
- The hash catches a key reused with a different body.
- The unique constraint lets only one of two concurrent duplicates through.

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

Explain these points:

- It fetches size + 1 rows, so it knows whether another page exists without a count query.
- The cursor is an opaque, encoded ID.
- An index on `(account_id, id)` keeps every page fast.

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

Explain these points:

- The version comes from a `@Version` column.
- 428 forces clients to send the precondition.
- 412 tells the client to fetch again and merge.
