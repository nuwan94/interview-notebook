---
title: Testing Node.js services — node:test, test doubles, HTTP and database tests, contracts and flaky tests
nav: Node.js testing
slug: node-testing
summary: Testing a Node.js API with the built-in node:test runner (test, describe, hooks, subtests, assert, mock.fn, mock.method, fake timers, coverage, watch mode) and how Vitest and Jest compare, the test pyramid for a backend, test doubles (dummy, stub, spy, mock, fake) and over-mocking, designing for testability with dependency injection, arrange act assert, table-driven tests and data builders, testing async code, errors, events, streams and retries with fake timers, HTTP route tests with an ephemeral server on port 0, real database tests with Testcontainers, migrations, transaction rollback and repository contract tests, module mocking limits, consumer-driven contract tests with Pact, coverage, snapshots, property-based and mutation testing, flaky tests and CI, compared with JUnit, Mockito and Spring tests, with banking examples and interview questions.
tags: [Node.js, Testing, node:test, Mocking, Integration tests, Testcontainers, Contract tests, Backend, Full stack]
order: 73
topic: Full stack / Node.js
updated: 2026-11-18
subnav: true
---

Testing questions in a Node.js interview are about judgement. They ask *what you test at which level, what a mock is and when mocking goes wrong, how you make code testable without a framework, how you test an HTTP API and a database, how you test time and retries without waiting, how you stop tests being flaky, and what you run in CI.* This lesson uses Node's built-in test runner, so every example runs with `node --test` and no packages, and shows the Vitest and Jest equivalents. It builds on [Express testing](lesson:node-express#testing), [testing middleware](lesson:node-express-middleware#testing) and [testing streams](lesson:node-streams#testing). The front end side is in [React performance and testing](lesson:react-performance#testing). Examples use banking transfers. Play the four scenes: what to test where, test doubles, design for testability, and real database tests.

```demo
name: node-test-walk
```

> **One sentence to remember:** *Test behaviour through the public interface, pass dependencies in so you can replace the ones you do not control (network, clock, randomness) and use real objects for the rest, run the database tests against the real engine, keep every test independent, and treat a flaky test as a bug.*

## What to test, and where {#why}

A test is worth writing when it can fail for a reason you care about, cheaply. A backend has layers, and each is best tested one way:

| Level | What it covers | Collaborators | Speed | Count |
| --- | --- | --- | --- | --- |
| **unit** | pure functions, rules, a service | fakes, a fixed clock | milliseconds | many |
| **integration (HTTP)** | routes, middleware, validation, error format | real app, fake or real service | tens of ms | some |
| **integration (database)** | SQL, constraints, migrations, transactions | real PostgreSQL | 100 ms to seconds | some |
| **contract** | the agreement between two services | stubbed counterpart | fast | per integration |
| **end to end** | a journey through the deployed system | everything | seconds to minutes | few |

This is the **test pyramid**: many fast tests at the bottom, few slow ones at the top. For services that mostly glue things together (a controller, a repository, a queue), a **testing trophy** shape is also common: fewer isolated unit tests and more integration tests that exercise real wiring. Either way the rule is the same: **the lower the level, the faster and more precise a failure is, the higher the level, the more realistic the test is**. Use both.

What *not* to test: the framework (Express already parses JSON), getters and setters, and private functions. Test through the public interface, so refactoring does not break the tests.

## The node:test runner {#runner}

Node has a built-in runner and an assertion library. No installation, no configuration:

```javascript
import { test, describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';          // strict mode: === and deep equality by default

describe('fee calculator', () => {
  it('charges 1% with a minimum of 2', () => {
    assert.equal(fee(100), 2);
    assert.equal(fee(1000), 10);
  });
});
```

Run it:

```bash
node --test                          # finds *.test.js, *.spec.js and files in test/ folders
node --test --watch                  # rerun on change
node --test --test-name-pattern="idempotent"
node --test --experimental-test-coverage
node --test --test-reporter=spec     # or dot, tap, junit, lcov
```

| Feature | `node:test` | Vitest | Jest |
| --- | --- | --- | --- |
| suites and tests | `describe`, `it`, `test` | the same | the same |
| hooks | `before`, `after`, `beforeEach`, `afterEach` | `beforeAll`, `afterAll`, `beforeEach`, `afterEach` | the same as Vitest |
| assertions | `node:assert` | `expect(...)` | `expect(...)` |
| spy or stub | `mock.fn`, `mock.method` | `vi.fn`, `vi.spyOn` | `jest.fn`, `jest.spyOn` |
| fake timers | `mock.timers` | `vi.useFakeTimers` | `jest.useFakeTimers` |
| module mocking | `mock.module` (experimental) | `vi.mock` | `jest.mock` |
| snapshots | `t.assert.snapshot` | built in | built in |
| TypeScript, JSX | needs a loader or Node's type stripping | built in | needs Babel or `ts-jest` |
| watch, UI, coverage | basic | very good | good |

Which to pick? `node:test` has no dependencies and starts fast, which suits a service or a library. **Vitest** is the usual choice when you share a toolchain with a Vite and React project and want module mocking and a great watch mode. **Jest** is the incumbent in many codebases. The concepts below are identical in all three, and an interviewer cares that you know them, not the syntax.

Useful details:

- Tests in one file run **in order**, test files run **in parallel in separate processes** (so they do not share memory).
- A test is a promise: return it or `await` it. A test that finishes before its async work is a false pass.
- `t.mock` (the test context) **restores mocks automatically** when the test ends. Prefer it to the global `mock`.
- `it.skip`, `it.todo` and `it.only` (with `--test-only`) help while developing. Never commit `only`.
- Subtests: `await t.test('name', ...)` inside a test, useful for tables of cases and shared setup.

## Test doubles {#doubles}

A **test double** replaces a real collaborator in a test, like a stunt double. Gerard Meszaros' vocabulary is worth knowing because interviews use it:

| Double | What it does | Use it for |
| --- | --- | --- |
| **dummy** | passed in but never used | filling a required argument |
| **stub** | returns canned answers | making the code under test run: "the gateway approves" |
| **spy** | records calls (count, arguments) and may call through | checking an interaction happened |
| **mock** | a spy with expectations built in (fails if not used as expected) | when the interaction *is* the behaviour |
| **fake** | a working, simplified implementation | an in-memory repository, a fake clock, a fake queue |

Tools blur the words (`mock.fn` is a stub, a spy and a mock at once), but the **ideas** differ: a stub is about *inputs* to the code under test, a spy or mock is about its *outputs to others*.

```javascript
const gateway = { authorise: mock.fn(async () => ({ approved: true })) };   // stub that is also a spy

gateway.authorise.mock.callCount();                      // 1
gateway.authorise.mock.calls[0].arguments;               // [{ from: 'A', to: 'B', amount: 100 }]
gateway.authorise.mock.mockImplementation(async () => ({ approved: false })); // change the answer in one test
```

`mock.method(object, 'name', impl)` replaces a method on an existing object and restores it afterwards, which suits a logger or `Date`-like global:

```javascript
test('warns on a low balance', (t) => {
  const warn = t.mock.method(logger, 'warn', () => {});    // replaced, recorded, restored after the test
  checkBalance(logger, 5);
  assert.equal(warn.mock.callCount(), 1);
  assert.deepEqual(warn.mock.calls[0].arguments, ['low balance']);
});
```

### Prefer fakes over mocks for your own code

A fake keeps tests short and readable and lets you test **behaviour across several steps** (transfer, then read the balances) instead of the order of calls:

```javascript
// fake-accounts.js: an in-memory fake that really stores and finds data
export function createFakeAccounts(initial = []) {
  const accounts = new Map(initial.map((a) => [a.id, { ...a }]));
  const transfers = new Map();

  return {
    async find(id) {
      const a = accounts.get(id);
      return a ? { ...a } : null;                        // return a copy, like a database row
    },
    async findTransferByKey(key) {
      return transfers.get(key) ?? null;
    },
    async saveTransfer(t) {
      accounts.get(t.from).balance -= t.amount;
      const target = accounts.get(t.to) ?? { id: t.to, balance: 0 };
      target.balance += t.amount;
      accounts.set(t.to, target);
      transfers.set(t.key, t);
    },
  };
}
```

A fake can drift away from the real database (for example, it forgets a unique constraint). Prevent that with **contract tests that run against both** (see [real database tests](#database)).

### Over-mocking

The most common testing mistake. A test that mocks every collaborator and asserts every call sequence:

- repeats the implementation, so it **breaks on every refactor** although behaviour is unchanged,
- passes while the real wiring is broken (it proved only that you called your mocks),
- is hard to read.

Rules of thumb: **mock at the edges you do not control** (network calls, the clock, randomness, a payment provider), **use real objects for your own code**, **assert on outcomes** (state, return values, responses) and only assert on calls when the call is itself the requirement ("the gateway is called exactly once", "no gateway call when funds are insufficient").

## Design for testability {#design}

Code is hard to test when it reaches out to the world by itself:

```javascript
// hard to test: hidden dependencies
import { pool } from './db.js';

export async function transfer(from, to, amount) {
  const { rows } = await pool.query('SELECT balance FROM accounts WHERE id = $1', [from]);
  ...
  await pool.query('INSERT INTO transfers ... VALUES ($1, $2, $3, $4)', [from, to, amount, Date.now()]);
}
```

It needs a database, depends on the real time, and cannot be run twice in parallel without clashes. Instead **pass the dependencies in**, with a factory (or a class constructor):

```javascript
// transfer-service.js
export class InsufficientFunds extends Error {
  code = 'INSUFFICIENT_FUNDS';
  constructor(balance, amount) {
    super(`Balance ${balance} is below ${amount}`);
  }
}

export function createTransferService({ accounts, gateway, clock = { now: () => Date.now() } }) {
  return {
    async transfer({ from, to, amount, key }) {
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new RangeError('amount must be a positive integer');
      }
      const existing = await accounts.findTransferByKey(key);
      if (existing) return { ...existing, replayed: true };           // idempotent replay

      const source = await accounts.find(from);
      if (!source) throw Object.assign(new Error('Account not found'), { code: 'ACCOUNT_NOT_FOUND' });
      if (source.balance < amount) throw new InsufficientFunds(source.balance, amount);

      const approval = await gateway.authorise({ from, to, amount });
      if (!approval.approved) throw Object.assign(new Error('Declined'), { code: 'DECLINED' });

      const transfer = { key, from, to, amount, status: 'POSTED', at: clock.now() };
      await accounts.saveTransfer(transfer);
      return { ...transfer, replayed: false };
    },
  };
}
```

Production passes the real `accounts`, `gateway` and clock in one place (the **composition root**, usually `main.js`), a test passes fakes. This is plain **dependency injection**: no container and no module patching. It is the same idea as constructor injection in Spring, without the framework. Three dependencies that are always worth injecting: **the clock** (`Date.now()`), **randomness and ids** (`randomUUID`), and **I/O clients** (HTTP, database, queue).

### Arrange, act, assert

Every test has the same shape:

1. **Arrange**: build the fakes and the data.
2. **Act**: call the thing under test, once.
3. **Assert**: check the visible result.

A good test has **one reason to fail**, a **name that states the behaviour** ("rejects a transfer above the balance", not "test2"), and **no logic of its own** (no loops and ifs that need their own tests). **Test data builders** keep the arrange step short and hide the irrelevant fields:

```javascript
const anAccount = (overrides = {}) => ({ id: 'A', balance: 1000, ...overrides });

const accounts = createFakeAccounts([anAccount({ balance: 500 }), anAccount({ id: 'B', balance: 0 })]);
```

## Unit-testing a service {#unit}

All together. This file passes with `node --test`:

```javascript
// transfer-service.test.js
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createTransferService } from './transfer-service.js';
import { createFakeAccounts } from './fake-accounts.js';

const anAccount = (overrides = {}) => ({ id: 'A', balance: 1000, ...overrides });

describe('TransferService', () => {
  let accounts, gateway, service;
  const clock = { now: () => 1_700_000_000_000 };                                    // a fixed clock

  beforeEach(() => {                                                                  // fresh state for every test
    accounts = createFakeAccounts([anAccount({ balance: 500 }), anAccount({ id: 'B', balance: 0 })]);
    gateway = { authorise: mock.fn(async () => ({ approved: true })) };
    service = createTransferService({ accounts, gateway, clock });
  });

  it('moves the money and returns a POSTED transfer', async () => {
    const result = await service.transfer({ from: 'A', to: 'B', amount: 200, key: 'k1' });

    assert.equal(result.status, 'POSTED');
    assert.equal(result.at, 1_700_000_000_000);
    assert.equal((await accounts.find('A')).balance, 300);
    assert.equal((await accounts.find('B')).balance, 200);
  });

  it('rejects insufficient funds and never calls the gateway', async () => {
    await assert.rejects(
      service.transfer({ from: 'A', to: 'B', amount: 501, key: 'k2' }),
      { code: 'INSUFFICIENT_FUNDS' },
    );
    assert.equal(gateway.authorise.mock.callCount(), 0);                              // the interaction is the requirement
    assert.equal((await accounts.find('A')).balance, 500);                            // and nothing changed
  });

  it('is idempotent: the same key returns the first result and moves money once', async () => {
    const first = await service.transfer({ from: 'A', to: 'B', amount: 100, key: 'same' });
    const second = await service.transfer({ from: 'A', to: 'B', amount: 100, key: 'same' });

    assert.equal(second.replayed, true);
    assert.equal(second.at, first.at);
    assert.equal((await accounts.find('A')).balance, 400);                            // debited once
    assert.equal(gateway.authorise.mock.callCount(), 1);                              // gateway called once
  });

  it('does not change balances when the gateway declines', async () => {
    gateway.authorise.mock.mockImplementation(async () => ({ approved: false }));
    await assert.rejects(service.transfer({ from: 'A', to: 'B', amount: 50, key: 'k3' }), { code: 'DECLINED' });
    assert.equal((await accounts.find('A')).balance, 500);
  });

  for (const amount of [0, -5, 1.5, '10']) {                                          // table-driven tests
    it(`rejects the invalid amount ${JSON.stringify(amount)}`, async () => {
      await assert.rejects(service.transfer({ from: 'A', to: 'B', amount, key: 'x' }), RangeError);
    });
  }
});
```

Points to notice: `beforeEach` gives **every test its own state**, so order does not matter. Errors are asserted with `assert.rejects` and a **matcher object** (`{ code: ... }`), which checks the contract and not the message text. **Table-driven tests** (a loop over cases that creates one `it` each) give one clear failure per case. Money is checked with the fake's state, not by counting calls.

Useful assertions: `assert.equal` (strict equality), `assert.deepEqual` (structure), `assert.throws` and `assert.rejects` (errors, sync and async), `assert.match(string, /regex/)`, `assert.ok`. A floating point comparison needs a tolerance, so keep money in integers (cents), as the example does.

## Async code, errors, events, streams and time {#async}

**Async functions**: `await` them, and for errors use `assert.rejects`, never a `try`/`catch` that silently passes when nothing is thrown (if the function does not throw, the `catch` assertion never runs and the test passes). Do not use `setTimeout` to wait for something. Wait for the thing itself:

```javascript
import { once } from 'node:events';

test('emits posted when a transfer completes', async () => {
  const bus = new EventEmitter();
  setImmediate(() => bus.emit('posted', { id: 1 }));          // stand-in for the code under test
  const [payload] = await once(bus, 'posted');                // resolves when it happens: no sleep, no flake
  assert.deepEqual(payload, { id: 1 });
});
```

**Streams**: collect with `for await`, or use `pipeline` and assert on the output (see [testing streams](lesson:node-streams#testing)).

```javascript
const out = [];
for await (const chunk of Readable.from(['a', 'b', 'c']).pipe(upperCaseTransform)) out.push(chunk);
assert.deepEqual(out, ['A', 'B', 'C']);
```

**Time**: a test that really waits for 3 seconds is slow and flaky. Use **fake timers**, which let you move time by hand:

```javascript
// retry.js
export async function withRetry(fn, { attempts = 3, delayMs = 1000 } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
      if (i < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** (i - 1)));
    }
  }
  throw lastError;
}
```

```javascript
// retry.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from './retry.js';

test('retries with exponential backoff, without real waiting', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });                  // fake timers, restored after the test

  const fn = t.mock.fn(async (attempt) => {
    if (attempt < 3) throw new Error(`fail ${attempt}`);
    return 'ok';
  });

  const promise = withRetry(fn, { attempts: 3, delayMs: 1000 });

  await Promise.resolve();                                         // let the first attempt fail
  assert.equal(fn.mock.callCount(), 1);

  t.mock.timers.tick(1000);                                        // first backoff: 1 s
  await new Promise(setImmediate);                                 // let the promise callbacks run
  assert.equal(fn.mock.callCount(), 2);

  t.mock.timers.tick(2000);                                        // second backoff: 2 s
  assert.equal(await promise, 'ok');
  assert.equal(fn.mock.callCount(), 3);
});
```

`mock.timers` can fake `setTimeout`, `setInterval`, `setImmediate` and `Date` (`enable({ apis: ['Date'], now: 1_700_000_000_000 })`), and `tick(ms)` moves the clock. Fake timers do not flush promise callbacks, so after `tick` you often need `await` or a `setImmediate` turn, as above. When you only need a fixed "now", **inject a clock** instead (as `createTransferService` does): it needs no fake timers at all.

**Do not leave timers or handles open**: a test file that never ends usually has a server, a database pool or a timer that was not closed in `after`.

## Testing an HTTP API {#http}

Export the app from a function that does **not** call `listen()` (see [Express testing](lesson:node-express#testing)). A test then has two options:

1. **supertest** sends the request to the app in memory (`await request(app).post('/transfers')`). It is concise and common.
2. **An ephemeral real server** on **port 0** with the built-in `fetch`. No extra package, and it tests real HTTP, including headers and `fetch` behaviour.

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';

describe('GET /accounts/:id', () => {
  let server, baseUrl;

  before(async () => {
    const accounts = createFakeAccounts([{ id: 'A', balance: 500 }]);
    server = createApp({ accounts }).listen(0);                  // port 0: the OS picks a free port
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => server.close());

  it('returns the account', async () => {
    const res = await fetch(`${baseUrl}/accounts/A`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { id: 'A', balance: 500 });
  });

  it('returns 404 for an unknown account', async () => {
    const res = await fetch(`${baseUrl}/accounts/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'not_found' });
  });
});
```

(`createApp` returns an Express app, `app.listen(0)` returns the Node server. The pattern was run with a plain `http.createServer` handler, which behaves the same.)

What an HTTP-level test should cover that a unit test cannot: **status codes and the error format** (including the central error handler), **validation** (bad bodies give 400 or 422 with details), **authentication and authorisation** (no token gives 401, wrong role gives 403), **headers** (`Location`, `Cache-Control`, `Retry-After`), **content negotiation** and body limits. Replace the *service* with a fake or stub when you test the route, and the *route* is exercised with the real middleware stack.

**Port 0** is important: a fixed port such as 3000 makes two test files running in parallel fail with `EADDRINUSE`.

## Testing against a real database {#database}

A repository test against **SQLite in memory** or a mocked `pg` client can pass while the real PostgreSQL query fails: different SQL dialect, different types, no `FOR UPDATE`, no `ON CONFLICT`, no JSONB, no real constraints. The advice is to **test against the same engine as production**. **Testcontainers** starts a throwaway container (PostgreSQL, Redis, Kafka) for the test run and removes it afterwards:

```javascript
// repository.test.js (needs Docker and the packages testcontainers and pg)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { migrate } from './migrate.js';
import { createAccountRepository } from './account-repository.js';

describe('AccountRepository (real PostgreSQL)', () => {
  let container, pool, repo;

  before(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();   // once per file
    pool = new pg.Pool({ connectionString: container.getConnectionUri() });
    await migrate(pool);                                                       // the real migrations: tests them too
  });
  after(async () => {
    await pool.end();
    await container.stop();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE accounts, transfers RESTART IDENTITY CASCADE');  // clean state for every test
    repo = createAccountRepository(pool);
  });

  it('enforces a unique idempotency key', async () => {
    await repo.saveTransfer({ key: 'k1', from: 'A', to: 'B', amount: 10 });
    await assert.rejects(repo.saveTransfer({ key: 'k1', from: 'A', to: 'B', amount: 10 }), { code: '23505' });
  });
});
```

Notes:

- **Start the container once** (per file or per run) and apply the migrations, because starting one per test is far too slow. Then give each test a **clean state**: truncate the tables (simple, works with any code), or wrap the test in a **transaction that is rolled back** (fast, but the code under test must use the same connection).
- A global setup that starts one container for the whole run is faster still. Make each test file use its own database or schema if files run in parallel.
- Tests that run Docker need Docker in CI (GitHub Actions and most runners have it). Mark them as a separate step or folder (`test:integration`) so developers can still run unit tests alone.
- **Migrations** are code: running them in the tests catches a broken migration before production.

### Contract tests for fakes

To stop the in-memory fake from drifting away from the real repository, write the tests **once** and run them against both:

```javascript
export function accountRepositoryContract(name, makeRepo) {
  describe(`${name} behaves like an account repository`, () => {
    it('returns null for an unknown account', async () => {
      assert.equal(await makeRepo().find('nope'), null);
    });
    it('finds a saved transfer by its key', async () => { ... });
  });
}

accountRepositoryContract('fake', () => createFakeAccounts());
accountRepositoryContract('PostgreSQL', () => createAccountRepository(pool));
```

The fast tests then rely on a fake that is **proven to behave like the real thing**.

## Mocking modules {#modules}

In Jest and Vitest you can replace an imported module (`vi.mock('./gateway.js')`). In ES modules, imports are bound at load time, so this needs support from the runner. Node has `mock.module()` (experimental, behind `--experimental-test-module-mocks`), and its use is more restricted than in Jest.

```javascript
// Vitest
vi.mock('./gateway.js', () => ({ authorise: vi.fn().mockResolvedValue({ approved: true }) }));
```

Prefer **injection over module mocking**: if a function takes the gateway as an argument or from a factory, no patching is needed and the test is plain code. Reserve module mocks for code you cannot change (a third-party SDK used deep inside) and for process-wide things such as `fs` or `child_process`, ideally wrapped in your own small module so that only one place is mocked.

For HTTP calls to other services, an alternative to mocking your client is **intercepting the network**: `nock` or **MSW** (Mock Service Worker) fake the server, and your real client code, including its serialisation and retries, runs unchanged. `undici`'s `MockAgent` does the same for `fetch`.

## Contract and end-to-end tests {#contract}

Services agree on message shapes. A **consumer-driven contract test** (Pact) catches a breaking change before deployment:

1. The **consumer** (the front end or another service) writes a test saying "when I call `GET /accounts/A`, I need `id` and `balance` as a number". Running it against a Pact mock produces a **contract file**.
2. The **provider** runs that contract against its real code in CI (provider verification) and fails if it no longer returns those fields.

It is cheaper than running both services together, and it finds "I renamed a field" the moment it happens. For events, the same idea applies to message schemas (JSON Schema or Avro, with compatibility rules in the schema registry). Compare [microservices communication](lesson:microservice-communication#contracts).

**End-to-end tests** (Playwright, Cypress, or an API-level suite against a staging environment) cover a few critical journeys only: log in, make a transfer, see it in the history. They are slow, depend on every system, and fail for reasons unrelated to your change, so keep them **few and stable**, and let the lower levels carry most of the coverage.

## Coverage, snapshots, property and mutation tests {#quality}

- **Coverage** (`--experimental-test-coverage`, `c8`, Vitest `--coverage`) shows which lines **ran**, not whether they were **checked**. It finds untested code, but 100% coverage can still contain tests with no assertions. Use it as a floor (for example 80% on new code), not a target to game.
- **Snapshot tests** store output (a response body, a rendered string) and compare it on later runs. They are quick for large stable output but easy to approve without reading. Keep snapshots small and review their diffs.
- **Property-based testing** (**fast-check**) states a rule and the library tries hundreds of generated inputs and **shrinks** a failure to a minimal example. Good for rules such as "transfer then reverse leaves the balances unchanged" or "serialising then parsing returns the same value".
- **Mutation testing** (**Stryker**) changes your code (`>` becomes `>=`, `+` becomes `-`) and checks that a test fails. Surviving mutants show tests that run the code but do not check it. It is slow, so run it on important modules or nightly.
- **Linting tests**: `eslint-plugin-jest` or Vitest's equivalent catch `only`, missing assertions and duplicated titles.

## Flaky tests {#flaky}

A **flaky test** passes and fails on the same code. It destroys trust, so people re-run and ignore red builds. Typical causes and cures:

| Cause | Cure |
| --- | --- |
| shared state between tests (a global, a shared table, a singleton) | fresh state per test, no cross-test dependency, random order locally |
| real time (`setTimeout`, `Date.now()`, time zones) | inject a clock or use fake timers |
| waiting with `sleep` | wait for the condition or event, with a timeout |
| randomness and ids | inject a seeded generator, or assert on shape |
| fixed ports and files | port 0, temporary directories (`fs.mkdtemp`) |
| unawaited promises, floating async work | `await` everything, fail on unhandled rejections |
| network and external services | fakes, MSW, containers |
| test order and parallel runs | independent data (unique ids), isolated databases |
| slow CI machines | generous timeouts only as a last step, never hide a race |

When a test is flaky: **reproduce it** (run it in a loop, with a CPU limit), find the cause, and fix it. If you cannot fix it now, **quarantine** it (skip with a ticket) so it does not block everyone, but do not delete the signal.

## Tests in CI {#ci}

Run on every pull request: lint, unit tests, integration tests (with Docker), then build. Typical choices:

- **Fast feedback first**: unit tests before integration tests, and fail fast.
- **Parallelism**: the runner runs files in parallel (`--test-concurrency`). Split slow suites across CI jobs (sharding).
- **Deterministic environment**: pin the Node version (`.nvmrc`), use `pnpm install --frozen-lockfile`, set `TZ=UTC`.
- **Reports**: JUnit XML for the CI dashboard (`--test-reporter=junit`), and a coverage report.
- **A quality gate**: tests must pass and coverage on new code must not drop. See [CI/CD fundamentals](lesson:cicd-fundamentals#gates).
- **Smoke tests after deploy** and the contract verification step before it.

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| forgetting to `await` or return a promise in a test | `await` everything, a lint rule for floating promises |
| `try`/`catch` around a call that may not throw | `assert.rejects` and `assert.throws` |
| mocking every collaborator and asserting every call | fakes for your own code, mocks only for the edges |
| asserting on error message text | assert on the error class or code |
| tests that depend on each other or on order | independent data, `beforeEach` |
| a shared database between test files | one container or schema per file, or truncate per test |
| fixed ports | port 0 |
| `sleep(1000)` to wait | wait for the event, or fake the clock |
| real clock, `Math.random()` and `randomUUID()` inside the code | inject them |
| SQLite in tests and PostgreSQL in production | the real engine in a container |
| testing private functions and implementation details | test the public behaviour |
| a snapshot approved without reading | small snapshots, review the diff |
| chasing 100% coverage | meaningful assertions, mutation testing on key code |
| `it.only` committed | lint rule, CI flag |
| ignoring a flaky test | fix or quarantine it |
| unclosed servers, pools and timers keep the process alive | close them in `after` |

## For a Java developer {#java}

| Java and Spring | Node.js |
| --- | --- |
| JUnit 5 `@Test`, `@Nested`, `@ParameterizedTest` | `node:test` `it`, `describe`, loops or `t.test` for tables |
| `@BeforeEach`, `@AfterAll` | `beforeEach`, `after` |
| AssertJ, Hamcrest, `assertThrows` | `node:assert`, `assert.rejects`, `expect` in Vitest and Jest |
| Mockito `mock`, `when(...).thenReturn`, `verify` | `mock.fn`, `mockImplementation`, `mock.callCount()` |
| `@MockBean`, `@Mock` | pass fakes in a factory, or module mocks |
| Mockito and the "do not mock what you do not own" advice | the same advice applies |
| `MockMvc` and `@WebMvcTest` | supertest, or an ephemeral server with `fetch` |
| `@DataJpaTest`, `@SpringBootTest` | repository tests with Testcontainers and the real migrations |
| Testcontainers for Java | `testcontainers` for Node, same containers |
| WireMock | MSW, nock, undici `MockAgent` |
| Spring Cloud Contract, Pact JVM | Pact JS |
| JaCoCo | `c8`, built-in coverage |
| PIT mutation testing | Stryker |
| Awaitility | wait on events and conditions, `once`, polling helper with a timeout |
| parallel test forks | files run in parallel processes by default |

See [Spring testing](lesson:spring-testing#pyramid) for the Java side of the same pyramid.

Try it in the lab: [Testing a Node service in layers](lab:node-testing-layers).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| runner | `node --test`, `--watch`, `--test-name-pattern`, `--experimental-test-coverage` |
| structure | `describe` and `it`, hooks `before`, `after`, `beforeEach`, `afterEach` |
| shape | arrange, act, assert, one reason to fail, a name that states behaviour |
| doubles | dummy, stub (inputs), spy (records), mock (expects), fake (works) |
| rule | mock the edges (network, clock, random), use real objects for your own code |
| design | pass dependencies in, composition root in `main.js`, inject clock and ids |
| async | `await`, `assert.rejects`, `once(emitter, 'event')`, never `sleep` |
| time | inject a clock, or `mock.timers.enable` and `tick` |
| HTTP | export the app without `listen`, supertest or `listen(0)` plus `fetch` |
| database | the real engine in Testcontainers, run migrations, truncate or roll back per test |
| fakes | run the same contract tests against the fake and the real one |
| contracts | Pact: consumer states needs, provider verifies |
| e2e | few, stable, critical journeys only |
| quality | coverage is a floor, mutation tests check the assertions |
| flaky | shared state, time, sleep, ports, unawaited promises |
| CI | fast first, parallel, pinned versions, reports, gates |

## Interview questions {#questions}

### [basic] What is the test pyramid and why does the shape matter? {#pyramid-q}

Many fast, cheap unit tests at the bottom, fewer integration tests (HTTP, database) in the middle, and a few slow end-to-end tests at the top. Lower tests fail fast and point at the exact function, higher tests are more realistic but slower, more fragile and harder to diagnose. An inverted pyramid (mostly end-to-end tests) gives a slow, flaky suite. For glue-heavy services a "trophy" with more integration tests is also reasonable, but the principle is the same: choose the cheapest level that can catch the bug.

### [basic] What is the difference between a stub, a spy, a mock and a fake? {#doubles-q}

A stub returns canned answers so the code under test can run. A spy records how it was called (count, arguments). A mock is a spy with expectations that fail the test if they are not met. A fake is a working but simplified implementation, such as an in-memory repository. Stubs are about inputs, spies and mocks are about outputs to other objects, and fakes support behaviour tests over several steps. Tools such as `mock.fn` or `vi.fn` combine all three.

### [basic] How do you test an async function and an error it throws? {#async-q}

Make the test `async` (or return the promise) and `await` the call, so the runner waits. For an error use `await assert.rejects(promise, { code: 'X' })` or `expect(promise).rejects`. A `try`/`catch` that asserts inside the `catch` is a trap, because when the function wrongly succeeds the assertion never runs and the test passes. Do not wait with `setTimeout`: wait for the event or the promise itself.

### [basic] How do you run Node's built-in tests and what do they give you? {#runner-q}

`node --test` finds `*.test.js` files and runs them, with `describe`, `it`, hooks, subtests, `node:assert`, mocking (`mock.fn`, `mock.method`, `mock.timers`), watch mode (`--watch`), name filtering and coverage (`--experimental-test-coverage`). Files run in parallel processes, tests inside a file run in order. It has no dependencies, which is good for services and libraries, while Vitest adds a richer watch mode, module mocking and TypeScript support.

### [basic] Why should tests be independent and how do you achieve it? {#independent-q}

So they can run alone, in any order and in parallel, and a failure points at one cause. Create the data each test needs in the test or in `beforeEach`, never rely on another test's leftovers, use unique ids, use port 0 for servers, reset fakes and databases between tests, and avoid mutable module-level state. Shared state is the main cause of flaky tests.

### [intermediate] What is over-mocking and what is the alternative? {#overmock-q}

Mocking every collaborator and asserting each call repeats the implementation. The test breaks on refactors that keep behaviour, passes while the real wiring is broken, and is hard to read. Mock only what you do not control (network, clock, randomness, a payment provider), use real objects or fakes for your own code, and assert on outcomes (return values, stored state, HTTP response). Assert on a call only when the call is the requirement, for example "the gateway is not called when funds are insufficient".

### [intermediate] How do you make Node.js code testable without a mocking framework? {#di-q}

Pass dependencies in instead of importing and creating them inside: a factory such as `createTransferService({ accounts, gateway, clock })`, or a constructor. Production wires real implementations in one composition root, tests pass fakes. Inject the clock, id generation and I/O clients. This avoids module patching, keeps tests plain code, and is the same idea as constructor injection in Spring.

### [intermediate] How do you test code that uses timers, retries or `Date.now()` without waiting? {#time-q}

Either inject a clock (`{ now: () => fixed }`) so no timers are involved, or use fake timers: `mock.timers.enable({ apis: ['setTimeout'] })` and `tick(ms)` (Vitest `vi.useFakeTimers` and `advanceTimersByTime`). With fake timers, promise callbacks still need a turn of the event loop (`await` or `setImmediate`) after each tick. The test then runs in milliseconds and is deterministic. Real sleeps make tests slow and flaky.

### [intermediate] How do you test an Express route? What should an HTTP-level test check? {#http-q}

Export the app from a function that does not call `listen`, then use supertest, or start `app.listen(0)` and call it with `fetch`. Replace the service with a fake or stub so the test covers the route and the real middleware: status codes, error format from the central handler, validation failures (400 or 422), authentication and authorisation (401, 403), headers such as `Location`, and body limits. Business rules belong in the unit tests of the service.

### [intermediate] Why is SQLite or a mocked client a poor substitute for the database in tests, and what do you use? {#realdb-q}

The SQL dialect, types, constraints, locking and features (JSONB, `ON CONFLICT`, `FOR UPDATE`) differ, so tests pass while production queries fail, and a mocked client proves only that you called it. Use the production engine in a throwaway container with Testcontainers, apply the real migrations once, and give each test a clean state by truncating tables or rolling back a transaction. It is slower than a unit test, so keep these tests for repositories and queries.

### [intermediate] How do you keep an in-memory fake consistent with the real repository? {#fake-contract-q}

Write the repository tests once as a shared contract function that takes a factory (`accountRepositoryContract('fake', makeFake)`), and run it against the fake and against the real PostgreSQL repository. Whenever a behaviour is added or found wrong, it is added to the contract and both must pass. The service tests then use a fake that is proven to act like the real one.

### [intermediate] What causes flaky tests and how do you fix them? {#flaky-q}

Shared state and order dependence, real time, sleeps, fixed ports and files, randomness, unawaited promises, external services, and races on slow machines. Fix the cause: isolate state, inject the clock, wait for events and conditions instead of sleeping, use port 0 and temporary directories, await everything, and replace external services with fakes or containers. Reproduce by running the test in a loop, quarantine it with a ticket if the fix is not immediate, and never normalise re-running red builds.

### [intermediate] What is a consumer-driven contract test and when is it better than an end-to-end test? {#contract-q}

The consumer records what it needs from the provider (paths, fields, types) in a contract. The provider runs that contract against its real code in CI and fails if a change would break the consumer. It catches breaking API changes early, runs fast, and needs neither service deployed, so it is better than an end-to-end test for the question "do these two services still agree?". End-to-end tests are kept for a few critical journeys.

### [deep] What does code coverage tell you and what does it not? {#coverage-q}

It tells you which lines or branches ran during the tests, so it reveals untested code. It does not tell you whether the behaviour was checked: a test with no assertions gives full coverage. Use it as a minimum (for example on new code) and complement it with mutation testing (Stryker), which changes the code and shows which changes no test notices, so it measures the quality of the assertions. Chasing 100% leads to tests that check implementation details.

### [deep] How would you design the test strategy for a Node.js payments service? {#strategy-q}

Domain rules (limits, fees, idempotency, state transitions) as unit tests with fakes and a fixed clock, including table-driven and property-based tests for money arithmetic. Repository tests against a real PostgreSQL with Testcontainers and the real migrations, including constraint and concurrency cases (unique idempotency key, `FOR UPDATE`). HTTP tests for validation, authentication and the error format. Contract tests with the front end and with the payment gateway (or MSW stubs for the provider's sandbox responses). A handful of end-to-end tests for login and a transfer. In CI: unit tests first, integration tests in parallel jobs, coverage gate on new code, mutation tests nightly on the domain, and a smoke test after each deployment.

### [deep] When is mocking modules acceptable, and what are the drawbacks? {#module-mock-q}

When you cannot inject the dependency: a third-party SDK used deep in the code, or process-wide modules such as `fs` and `child_process`. The drawbacks are tight coupling to import paths and module internals, differing support in ES modules (Node's `mock.module` is experimental, `vi.mock` is hoisted), hidden global state between tests if mocks are not reset, and tests that pass although the real module behaves differently. Prefer injection, wrap the third-party module in your own thin adapter, and mock that adapter or intercept the network with MSW or nock instead.

### [coding] Write unit tests with `node:test` for a `transfer` service that depends on `accounts` and `gateway`: success, insufficient funds without a gateway call, idempotent replay and invalid amounts. {#coding-service}

```javascript
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createTransferService } from './transfer-service.js';
import { createFakeAccounts } from './fake-accounts.js';

const anAccount = (overrides = {}) => ({ id: 'A', balance: 1000, ...overrides });

describe('TransferService', () => {
  let accounts, gateway, service;
  const clock = { now: () => 1_700_000_000_000 };

  beforeEach(() => {
    accounts = createFakeAccounts([anAccount({ balance: 500 }), anAccount({ id: 'B', balance: 0 })]);
    gateway = { authorise: mock.fn(async () => ({ approved: true })) };
    service = createTransferService({ accounts, gateway, clock });
  });

  it('moves the money and returns a POSTED transfer', async () => {
    const result = await service.transfer({ from: 'A', to: 'B', amount: 200, key: 'k1' });
    assert.equal(result.status, 'POSTED');
    assert.equal((await accounts.find('A')).balance, 300);
    assert.equal((await accounts.find('B')).balance, 200);
  });

  it('rejects insufficient funds and never calls the gateway', async () => {
    await assert.rejects(
      service.transfer({ from: 'A', to: 'B', amount: 501, key: 'k2' }),
      { code: 'INSUFFICIENT_FUNDS' },
    );
    assert.equal(gateway.authorise.mock.callCount(), 0);
    assert.equal((await accounts.find('A')).balance, 500);
  });

  it('replays an idempotent request without moving money twice', async () => {
    await service.transfer({ from: 'A', to: 'B', amount: 100, key: 'same' });
    const second = await service.transfer({ from: 'A', to: 'B', amount: 100, key: 'same' });
    assert.equal(second.replayed, true);
    assert.equal((await accounts.find('A')).balance, 400);
    assert.equal(gateway.authorise.mock.callCount(), 1);
  });

  for (const amount of [0, -5, 1.5, '10']) {
    it(`rejects the invalid amount ${JSON.stringify(amount)}`, async () => {
      await assert.rejects(service.transfer({ from: 'A', to: 'B', amount, key: 'x' }), RangeError);
    });
  }
});
```

Each test builds fresh fakes in `beforeEach`, so they are independent. The service gets a fake repository, a stubbed gateway that doubles as a spy, and a fixed clock. Outcomes are checked through the fake's state, and the gateway call count is asserted only where the call is the requirement. The table-driven loop produces one test per invalid value.

### [coding] Test `withRetry(fn, { attempts, delayMs })` (exponential backoff) without waiting for real time. Cover success after two failures and giving up. {#coding-retry}

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from './retry.js';

test('retries with exponential backoff, without real waiting', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const fn = t.mock.fn(async (attempt) => {
    if (attempt < 3) throw new Error(`fail ${attempt}`);
    return 'ok';
  });

  const promise = withRetry(fn, { attempts: 3, delayMs: 1000 });

  await Promise.resolve();
  assert.equal(fn.mock.callCount(), 1);

  t.mock.timers.tick(1000);                    // first backoff
  await new Promise(setImmediate);
  assert.equal(fn.mock.callCount(), 2);

  t.mock.timers.tick(2000);                    // second backoff
  assert.equal(await promise, 'ok');
  assert.equal(fn.mock.callCount(), 3);
});

test('gives up after the last attempt and throws the last error', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fn = t.mock.fn(async () => { throw new Error('down'); });

  const promise = withRetry(fn, { attempts: 2, delayMs: 10 });
  const assertion = assert.rejects(promise, { message: 'down' });   // attach the handler before the promise rejects

  await new Promise(setImmediate);
  t.mock.timers.tick(10);
  await assertion;
  assert.equal(fn.mock.callCount(), 2);
});
```

`t.mock.timers` fakes `setTimeout` and is restored when the test ends. `tick` moves time, and a turn of the event loop lets the promise callbacks run before the next assertion. In the second test the rejection handler is attached early, so an unhandled rejection is never reported. The whole file runs in a few milliseconds instead of seconds.

### [coding] Write an HTTP integration test that starts the app on a random port, calls it with `fetch`, and checks a 200 response and a 404 with the error format. {#coding-http}

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { createFakeAccounts } from './fake-accounts.js';

describe('GET /accounts/:id', () => {
  let server, baseUrl;

  before(async () => {
    const accounts = createFakeAccounts([{ id: 'A', balance: 500 }]);
    server = createApp({ accounts }).listen(0);                 // port 0: free port chosen by the OS
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());                                   // otherwise the test process never exits

  it('returns the account', async () => {
    const res = await fetch(`${baseUrl}/accounts/A`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), { id: 'A', balance: 500 });
  });

  it('returns 404 and the error format for an unknown account', async () => {
    const res = await fetch(`${baseUrl}/accounts/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'not_found' });
  });
});
```

The app comes from a factory with its repository injected, so the test needs no database and no patching. Port 0 lets many test files run in parallel without `EADDRINUSE`. The server is started in `before` and closed in `after`, and the test uses real HTTP, so headers, status codes and JSON serialisation are all exercised.
