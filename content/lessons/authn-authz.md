---
title: Authentication and authorization — the map of methods
nav: AuthN vs AuthZ
slug: authn-authz
summary: Authentication vs authorization, 401 vs 403, and a comparison of the main methods (sessions, tokens, API keys, Basic, mTLS, OAuth 2.0, OIDC, SAML), plus MFA, RBAC vs ABAC and the common attacks. The overview that the separate OAuth, OIDC and JWT lessons hang from.
tags: [Security, Authentication, Authorization, OAuth, OIDC, JWT]
order: 20
topic: Security / Authentication
updated: 2026-11-13
subnav: true
---

This is the map for the security lessons that follow. Interviewers start with *"what is the difference between authentication and authorization?"* and then ask you to pick a method for a given system: a web app, a mobile app, a public API, service-to-service calls. This lesson gives the vocabulary and the comparison; each major method has its own lesson (OAuth 2.0, OpenID Connect, JWT, and so on). The encryption building blocks (hashes, signatures, TLS) are in the [cryptography lesson](lesson:cryptography). Press play to see four flows side by side: authN vs authZ, a server session, a signed token, and delegated access.

```demo
name: auth-walk
```

> **One sentence to remember:** *authentication proves who you are, authorization decides what you may do, and most modern designs authenticate once, then carry a short-lived proof (a session id or a token) on every request.*

## The two questions {#basics}

### Authentication vs authorization {#authn-vs-authz}

| | Authentication (authN) | Authorization (authZ) |
| --- | --- | --- |
| Question | who are you? | what are you allowed to do? |
| Happens | first | after authentication, on every access |
| Based on | credentials: something you know, have or are | roles, permissions, policies, resource ownership |
| Failure | **401 Unauthorized** (really "unauthenticated") | **403 Forbidden** |
| Examples | password, one-time code, passkey, certificate | admin can delete, a user can edit only their own profile |

Remember the status codes: **401** means "I do not know who you are" (missing or bad credentials); **403** means "I know who you are, and the answer is no". Some APIs return **404** instead of 403 so that an attacker cannot learn that a resource exists.

A third word you will hear is **accounting** or **auditing**: recording who did what. Together they are the classic triple **AAA**.

### Factors of authentication {#factors}

- **Something you know:** a password or PIN.
- **Something you have:** a phone with an authenticator app, a hardware key, a smart card, a certificate.
- **Something you are:** a fingerprint or face.

**Multi-factor authentication (MFA)** combines at least two *different* factors (a password plus a code, not two passwords). Weak spots: SMS codes can be intercepted or SIM-swapped, and one-time codes can be phished in real time. **Passkeys** (WebAuthn / FIDO2) use a per-site key pair held in the device: nothing secret is sent to the server and nothing can be phished, so they are the strongest common option. See [asymmetric encryption](lesson:cryptography#asymmetric) for the key-pair idea behind them.

### Identity, principal, claims {#vocab}

- **Principal / subject:** the authenticated user, device or service.
- **Credential:** what proves the identity (password, token, certificate).
- **Claim:** a statement about the subject (`sub=alice`, `role=analyst`, `email=...`).
- **Scope:** a named permission an app was granted (`photos.read`).
- **Identity provider (IdP):** the system that authenticates users and vouches for them (Keycloak, Auth0, Okta, Entra ID, Google).
- **Resource server:** the API that holds the protected data and decides, based on the token or session, whether to allow the call.

## Methods compared {#methods}

### Quick comparison {#comparison}

| Method | How it works | Good for | Watch out for |
| --- | --- | --- | --- |
| **HTTP Basic** | username and password in every request header (Base64, not encrypted) | scripts, internal tools, always over TLS | sends the password every time; no logout; no MFA |
| **Session cookie** | server stores the session, browser sends a session id cookie | classic server-rendered web apps | shared session store when scaling out; CSRF |
| **Bearer token** (opaque or JWT) | client sends a token in the `Authorization` header | SPAs, mobile apps, APIs | token theft; revocation; where to store it |
| **API key** | a long random string identifies the calling application | server-to-server, public developer APIs, quotas | identifies the app, not a user; must stay secret; rotate |
| **OAuth 2.0** | an app gets a scoped access token to act for a user, without the password | third-party access, delegated authorization | it is authorization, not login, and has many flows |
| **OpenID Connect (OIDC)** | OAuth 2.0 plus an ID token that says who logged in | login and single sign-on ("Sign in with Google") | validating the ID token correctly |
| **SAML 2.0** | XML assertions between an IdP and a service provider | enterprise single sign-on | verbose XML, signature-wrapping bugs |
| **mTLS** | client and server both present certificates | service-to-service, high-assurance APIs | certificate issue and rotation |
| **Passkey / WebAuthn** | challenge signed by a device-held private key | phishing-resistant login | account recovery |

### Sessions vs tokens {#session-vs-token}

This comparison comes up in most interviews.

| | Server session (cookie) | Signed token (JWT) |
| --- | --- | --- |
| State | **stateful**: server keeps a record | **stateless**: the token carries the claims |
| Sent as | cookie (automatic) | `Authorization: Bearer` header (script adds it) |
| Revocation | easy: delete the session | hard: valid until expiry, needs a deny list or short lifetimes |
| Scaling out | needs a shared store (Redis, database) or sticky sessions | any service with the public key can verify it |
| Size | a small id | larger, grows with claims |
| Browser risk | CSRF (cookies are sent automatically) | XSS if the token sits in `localStorage` |
| Works across domains and services | awkward | natural (microservices, mobile) |

Neither is "better". A server-rendered app with one backend is simplest and safest with sessions; a mobile client, an SPA and many microservices usually use tokens issued by an identity provider. Many systems combine them: short-lived access token plus a refresh token held in an `HttpOnly` cookie.

### Opaque tokens vs JWTs {#token-types}

An **opaque token** is a random string with no meaning to the client; the resource server asks the issuer (**token introspection**) what it stands for. It is easy to revoke but needs a call (or a cache) per request. A **JWT** is a signed, self-describing token that a service validates locally. A common middle path: JWT access tokens that live for minutes, plus revocation via short expiry and refresh tokens. See the [cryptography lesson on signatures](lesson:cryptography#signatures) for why the signature prevents tampering, and the separate JWT lesson for the structure and pitfalls.

### Which should you choose? {#choosing}

| Situation | Typical choice |
| --- | --- |
| Server-rendered web app, one backend | session cookie (`HttpOnly`, `Secure`, `SameSite`) |
| SPA or mobile app with its own users | OIDC (authorization code flow with PKCE) against an IdP, then access tokens |
| "Sign in with Google" or corporate single sign-on | OIDC (or SAML for older enterprise systems) |
| Third-party app needs limited access to a user's data | OAuth 2.0 with scopes |
| Public developer API with quotas | API keys (plus OAuth for user-level access) |
| Microservice to microservice | OAuth 2.0 client-credentials tokens, or mTLS, often both |
| Internal script calling an internal API | mTLS or a short-lived token, not a shared password |

## Authorization models {#authorization}

### RBAC, ABAC and others {#models}

- **Access control list (ACL):** a list on each resource of who can do what.
- **RBAC** (role-based): permissions are attached to **roles** (`ADMIN`, `ANALYST`), users get roles. Simple, auditable, can lead to "role explosion".
- **ABAC** (attribute-based): a policy evaluates attributes of the user, resource and context ("analysts can read reports of their own department during working hours"). Flexible, harder to reason about.
- **ReBAC** (relationship-based): permissions follow relationships ("the owner of a folder can edit everything in it"), as in document-sharing systems.
- **Scopes** (OAuth): what an *app* may do on behalf of a user, on top of what the user may do.

### Where to enforce {#enforcement}

Authorize **on the server, at every entry point**, and at the right granularity: endpoint-level (`/admin/**` needs `ADMIN`), method-level (`@PreAuthorize`), and **object-level** (this user may see *this* document). Hiding a button in the UI is not authorization. The most common real-world flaw is missing object-level checks, known as **IDOR** (insecure direct object reference) or **broken object-level authorization**: changing `/documents/42` to `/documents/43` returns someone else's data. Always check ownership, not just "logged in".

In microservices, authenticate **at the edge** (API gateway validates the token) *and* still authorize inside each service: never trust "it came from inside the network" (zero trust).

## Common attacks and defences {#attacks}

| Attack | What happens | Defence |
| --- | --- | --- |
| **Credential stuffing / brute force** | leaked or guessed passwords tried at scale | rate limits, lockout or delay, MFA, breached-password checks |
| **Phishing** | user is tricked into giving credentials or a code | passkeys / FIDO2, user education |
| **Session fixation** | attacker sets a known session id before login | issue a new session id on login |
| **Session or token theft (XSS)** | script steals the cookie or token | `HttpOnly` cookies, Content Security Policy, escape output, short-lived tokens |
| **CSRF** | another site makes the browser send your cookie to a state-changing request | `SameSite` cookies, CSRF tokens |
| **Replay** | a captured token or request is sent again | TLS, short expiry, nonces, `jti` ids |
| **Broken access control** (IDOR, privilege escalation) | a user reaches data or actions beyond their rights | server-side object-level checks, deny by default |
| **Man-in-the-middle** | traffic is read or changed in transit | TLS everywhere, certificate validation, HSTS |
| **Weak password storage** | database leak exposes passwords | salted slow hashes, see [storing passwords](lesson:cryptography#passwords) |

Cookie flags to remember: **`HttpOnly`** (scripts cannot read it), **`Secure`** (only over HTTPS), **`SameSite=Lax|Strict`** (limits cross-site sending).

## The series ahead {#series}

Each of these has its own lesson (links turn on as the lessons are added):

- [OAuth 2.0](lesson:oauth2): roles, grant types, scopes, PKCE, refresh tokens.
- [OpenID Connect](lesson:oidc): the identity layer on top of OAuth, the ID token and single sign-on.
- [JWT](lesson:jwt): structure, signing algorithms, validation and common pitfalls.
- [Spring Security](lesson:spring-security): the filter chain, method security, resource server and password encoding in Spring Boot.

## Cheat sheet {#cheatsheet}

| Need | Use |
| --- | --- |
| Prove identity | password + MFA, or passkey |
| Decide permissions | RBAC for simple, ABAC or ReBAC for rich rules, checked server-side |
| Browser app, one backend | session cookie with `HttpOnly`, `Secure`, `SameSite` |
| SPA, mobile, many services | OIDC + OAuth 2.0 access tokens (short-lived) |
| Let a third party act for the user | OAuth 2.0 with minimal scopes |
| Service-to-service | OAuth client-credentials or mTLS |
| Public API for apps | API keys with rate limits, rotate regularly |
| Wrong credentials / no permission | 401 / 403 |

## Interview questions {#questions}

### [basic] What is the difference between authentication and authorization? {#authn-vs-authz-q}

Authentication verifies **who** you are (password, code, certificate, passkey). Authorization decides **what** you may do once identified (roles, permissions, policies). Authentication comes first and gives an identity; authorization is then checked on each access against that identity and the resource. Failing the first is 401, failing the second is 403.

### [basic] What is the difference between 401 and 403? {#status-codes}

**401 Unauthorized** means the request lacks valid authentication (no, expired or wrong credentials); the response normally includes a `WWW-Authenticate` header. **403 Forbidden** means the server knows the identity but refuses the action because it lacks permission. Retrying 401 with valid credentials can succeed; retrying 403 with the same identity will not.

### [basic] What are the authentication factors, and what is MFA? {#mfa-q}

Something you **know** (password), **have** (phone, hardware key, certificate) and **are** (biometrics). MFA requires two or more factors from *different* categories. SMS is the weakest second factor (interception, SIM swap); authenticator apps and hardware keys are better, and passkeys (WebAuthn) are phishing-resistant because nothing reusable is typed or sent.

### [basic] What is the difference between a session and a token? {#session-vs-token-q}

A session is **server-side state** referenced by a random id in a cookie; revoking is easy but scaling needs a shared store. A token (often a JWT) is **self-contained and signed**, so any service can verify it without a lookup, which suits microservices and mobile clients, but it stays valid until it expires and is harder to revoke. Tokens avoid CSRF (not sent automatically) but need protection from XSS.

### [basic] What is an API key, and when is it enough? {#api-key-q}

A long random secret that identifies the **calling application**, not a user. It is enough for simple server-to-server access, metering and quotas. It is not suitable for user-level authorization or for browsers and mobile apps (it cannot be kept secret there). Send it in a header over TLS, store only a hash server-side, allow rotation, and scope its permissions.

### [basic] What are RBAC and ABAC? {#rbac-abac}

RBAC grants permissions to **roles** and assigns roles to users; simple and easy to audit. ABAC evaluates **attributes** of the user, resource and environment in policies (department, ownership, time, location); more flexible and fine-grained but harder to manage. Many systems use RBAC for coarse access and add ownership or attribute checks for specific resources.

### [intermediate] Where should authorization checks happen? {#authz-where}

On the **server**, for every request, **deny by default**, at multiple levels: endpoint (URL patterns), method (`@PreAuthorize`) and **object** (does this user own or may they access this record). UI hiding is only convenience. In microservices, authenticate at the gateway but each service must still authorize, because internal callers can be compromised.

### [intermediate] What is IDOR / broken object-level authorization? {#idor}

When an endpoint takes an object id from the client (`/documents/43`) and returns or changes it without verifying that the caller is allowed that object, so changing the id exposes other users' data. Fix by checking ownership or permission on every access (`WHERE id = ? AND owner_id = :currentUser`), not by hiding ids or using unguessable ids alone. It is the top item in the OWASP API Security list.

### [intermediate] Compare session cookies and JWT bearer tokens. {#compare-q}

Cookies are sent automatically (convenient, but need `SameSite` and CSRF protection) and point to server state; they are best for same-site browser apps. Bearer tokens are added by code in the `Authorization` header, are stateless to verify and fit cross-service and mobile use, but need short lifetimes and a revocation plan, and where you store them in a browser (memory vs `localStorage` vs `HttpOnly` cookie) decides your XSS exposure.

### [intermediate] How do you secure a REST API used by a single-page app? {#spa-q}

Use an identity provider with **OIDC authorization code flow + PKCE** (never the old implicit flow), receive short-lived access tokens (plus refresh tokens with rotation), keep tokens out of `localStorage` where possible (in memory, or handle them in a backend-for-frontend with an `HttpOnly` session cookie), validate tokens at the API (signature, issuer, audience, expiry), enforce scopes and object-level authorization, use TLS, CORS restricted to the app origin and a strict Content Security Policy.

### [intermediate] How is service-to-service authentication done in microservices? {#s2s}

Options: **OAuth 2.0 client-credentials** (each service gets a token for itself), **mTLS** (certificates, often automated by a service mesh), or both. To carry the *user's* identity across calls, forward the user's token or exchange it for a new one (token exchange) instead of trusting an internal header. Do not use long-lived shared secrets copied between services; use a secret manager and rotation.

### [intermediate] What are the cookie flags HttpOnly, Secure and SameSite for? {#cookie-flags}

`HttpOnly` stops JavaScript reading the cookie, limiting theft via XSS. `Secure` sends it only over HTTPS. `SameSite=Lax` or `Strict` stops the browser attaching it to cross-site requests, which is the main defence against CSRF. Also set a sensible expiry and path, and regenerate the session id on login to prevent fixation.

### [intermediate] What is CSRF and how do you prevent it? {#csrf-q}

Cross-site request forgery: a malicious page makes the victim's browser send a state-changing request to your site, and the browser attaches the victim's session cookie. Defences: `SameSite` cookies, anti-CSRF tokens (a secret value in the form or header that the attacker cannot read), checking `Origin`/`Referer`, and requiring a custom header. APIs authenticated purely with a bearer header are not exposed because the browser does not add it automatically.

### [intermediate] Why do tokens expire, and how do refresh tokens help? {#refresh-q}

If a token leaks, an expiry limits how long it works. So access tokens live for minutes and a longer-lived **refresh token** gets new ones without asking the user to log in again. Refresh tokens are sensitive: store them securely, rotate them on use (detect reuse), bind them to the client, and revoke them on logout. The authorization server can refuse to refresh, which is how access is cut off.

### [deep] Is OAuth 2.0 an authentication protocol? {#oauth-authn}

No. OAuth 2.0 is a **delegated authorization** framework: it lets an app obtain a scoped access token for an API. The token says what the app may do, not who the user is or whether they just logged in. **OpenID Connect** adds the missing layer: an **ID token** (a signed JWT with the user's identity, issuer, audience and nonce) and a standard `userinfo` endpoint, so use OIDC when you need login.

### [deep] How would you design logout and token revocation with stateless tokens? {#revocation}

Keep access tokens short (5 to 15 minutes) so natural expiry limits damage; revoke the **refresh token** on logout so no new access tokens are issued; for immediate cut-off of access tokens keep a small deny list keyed by token id (`jti`) or a per-user "not before" timestamp checked by services, or use opaque tokens with introspection for the most sensitive APIs. State the trade-off: every revocation check reintroduces some state.

### [deep] What is the confused deputy problem, and how do audience and scope help? {#confused-deputy}

A service with legitimate privileges is tricked into using them on behalf of a caller who lacks them, or a token meant for one API is accepted by another. Defences: validate the token **audience** (`aud`) so each API accepts only tokens issued for it, keep **scopes** narrow, use token exchange to get a token for the downstream audience, and never forward a broad token blindly to every internal service.

### [deep] How do you protect a login endpoint? {#login-protect}

Rate limit per account and per IP, add progressive delays or temporary lockout (without enabling denial of service against real users), require MFA, check passwords against breach lists, return the same message for unknown user and wrong password, hash passwords with Argon2 or bcrypt, log and alert on failures, use CAPTCHA only on suspicious traffic, and regenerate the session id after success.

### [coding] This endpoint checks the token but leaks data. What is wrong? {#coding-idor}

```java
@GetMapping("/documents/{id}")
public Document get(@PathVariable long id) {
    return documentRepository.findById(id).orElseThrow();     // any logged-in user can read any document
}
```

Authentication is present, but there is no **object-level authorization**: any authenticated user can read any id. Fix by scoping the query to the caller, or by checking after loading:

```java
@GetMapping("/documents/{id}")
public Document get(@PathVariable long id, Authentication auth) {
    return documentRepository.findByIdAndOwner(id, auth.getName())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));   // 404 avoids revealing that it exists
}
```

In Spring Security the same can be written declaratively with `@PostAuthorize("returnObject.owner == authentication.name")`.

### [coding] Set a safe session cookie in Spring Boot. {#coding-cookie}

```yaml
server:
  servlet:
    session:
      cookie:
        http-only: true
        secure: true
        same-site: lax
      timeout: 30m
```

With Spring Security, the default session fixation protection already creates a new session id on login (`sessionManagement.sessionFixation().migrateSession()`), and CSRF protection is on by default for form logins. For a stateless token API you would instead set `SessionCreationPolicy.STATELESS` and disable the session entirely.
