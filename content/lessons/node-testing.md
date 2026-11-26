---
title: Testing Node.js services — node:test, test doubles, HTTP and database tests, contracts and flaky tests
nav: Node.js testing
slug: node-testing
summary: Testing a Node.js API with the built-in node:test runner (test, describe, hooks, subtests, assert, mock.fn, mock.method, fake timers, coverage, watch mode) and how Vitest and Jest compare, the test pyramid for a backend, test doubles (dummy, stub, spy, mock, fake) and over-mocking, designing for testability with dependency injection, arrange act assert, table-driven tests and data builders, testing async code, errors, events, streams and retries with fake timers, HTTP route tests with an ephemeral server on port 0, real database tests with Testcontainers, migrations, transaction rollback and repository contract tests, module mocking limits, consumer-driven contract tests with Pact, coverage, snapshots, property-based and mutation testing, flaky tests and CI, compared with JUnit, Mockito and Spring tests, with banking examples and interview questions.
tags: [Node.js, Testing, node:test, Mocking, Integration tests, Testcontainers, Contract tests, Backend, Full stack]
order: 73
topic: Full stack / Node.js
updated: 2026-11-26
subnav: true
---

Testing questions in a Node.js interview test your judgement. Expect questions like these:

- What do you test at which level?
- What is a mock, and when does mocking go wrong?
- How do you make code testable without a framework?
- How do you test an HTTP API and a database?
- How do you test time and retries without waiting?
- How do you stop tests being flaky?
- What do you run in CI?

This lesson uses Node's built-in test runner. Every example runs with `node --test` and no packages. It also shows the Vitest and Jest versions.

It builds on [Express testing](lesson:node-express#testing), [testing middleware](lesson:node-express-middleware#testing) and [testing streams](lesson:node-streams#testing). The front end side is in [React performance and testing](lesson:react-performance#testing). The examples use bank transfers. Play the four scenes: what to test where, test doubles, design for testability, and real database tests.

```demo
name: node-test-walk
```

> **One sentence to remember:** *Test behaviour through the public interface, and fake only what you do not control.*

That means the network, the clock and randomness. Pass those in, so a test can replace them, and use real objects for the rest. Run database tests against the real engine. Keep every test independent. Treat a flaky test as a bug.

## What to test, and where {#why}

A test is worth writing when it can fail cheaply, for a reason you care about. A backend has layers, and each is best tested in its own way:

| Level | What it covers | Collaborators | Speed | Count |
| --- | --- | --- | --- | --- |
| **unit** | pure functions, rules, a service | fakes, a fixed clock | milliseconds | many |
| **integration (HTTP)** | routes, middleware, validation, error format | real app, fake or real service | tens of ms | some |
| **integration (database)** | SQL, constraints, migrations, transactions | real PostgreSQL | 100 ms to seconds | some |
| **contract** | the agreement between two services | stubbed counterpart | fast | per integration |
| **end to end** | a journey through the deployed system | everything | seconds to minutes | few |

This is the **test pyramid**: many fast tests at the bottom, and a few slow ones at the top.

Some services mostly glue parts together, such as a controller, a repository and a queue. For them, a **testing trophy** shape is also common. It has fewer isolated unit tests, and more integration tests that exercise the real wiring.

Either way, the rule is the same. **The lower the level, the faster and more precise a failure is. The higher the level, the more realistic the test is.** Use both.

What *not* to test:

- the framework, because Express already parses JSON;
- getters and setters;
- private functions.

Test through the public interface. Then refactoring does not break the tests.

## The node:test runner {#runner}

Node has a built-in test runner and an assertion library. There is nothing to install or configure:

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

Which should you pick?

- **`node:test`** has no dependencies and starts fast. It suits a service or a library.
- **Vitest** is the usual choice when you share tools with a Vite and React project. It has module mocking and a great watch mode.
- **Jest** is already in place in many codebases.

The ideas below are the same in all three. An interviewer cares that you know the ideas, not the syntax.

Useful details:

- Tests in one file run **in order**. Test files run **in parallel, in separate processes**, so they do not share memory.
- A test is a promise. Return it or `await` it. If a test finishes before its async work does, it passes falsely.
- `t.mock`, from the test context, **restores mocks automatically** when the test ends. Prefer it to the global `mock`.
- `it.skip`, `it.todo` and `it.only` (with `--test-only`) help while you develop. Never commit `only`.
- Subtests: call `await t.test('name', ...)` inside a test. This is useful for tables of cases and shared setup.

## Test doubles {#doubles}

A **test double** stands in for a real collaborator in a test, like a stunt double in a film. Interviews use Gerard Meszaros' names for them, so learn them:

| Double | What it does | Use it for |
| --- | --- | --- |
| **dummy** | passed in but never used | filling a required argument |
| **stub** | returns canned answers | making the code under test run: "the gateway approves" |
| **spy** | records calls (count, arguments) and may call through | checking an interaction happened |
| **mock** | a spy with expectations built in (fails if not used as expected) | when the interaction *is* the behaviour |
| **fake** | a working, simplified implementation | an in-memory repository, a fake clock, a fake queue |

Tools blur these words. `mock.fn` is a stub, a spy and a mock at once. But the **ideas** differ. A stub is about the *inputs* to the code under test. A spy or mock is about what that code *sends to others*.

```javascript
const gateway = { authorise: mock.fn(async () => ({ approved: true })) };   // stub that is also a spy

gateway.authorise.mock.callCount();                      // 1
gateway.authorise.mock.calls[0].arguments;               // [{ from: 'A', to: 'B', amount: 100 }]
gateway.authorise.mock.mockImplementation(async () => ({ approved: false })); // change the answer in one test
```

`mock.method(object, 'name', impl)` replaces a method on an existing object, and restores it afterwards. It suits a logger, or a global such as `Date`:

```javascript
test('warns on a low balance', (t) => {
  const warn = t.mock.method(logger, 'warn', () => {});    // replaced, recorded, restored after the test
  checkBalance(logger, 5);
  assert.equal(warn.mock.callCount(), 1);
  assert.deepEqual(warn.mock.calls[0].arguments, ['low balance']);
});
```

### Prefer fakes over mocks for your own code

A fake keeps tests short and readable. It lets you test **behaviour across several steps**, such as a transfer followed by reading the balances. You no longer test the order of calls.

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

A fake can drift away from the real database. For example, it may forget a unique constraint. Prevent that with **contract tests that run against both** (see [real database tests](#database)).

### Over-mocking

This is the most common testing mistake. Picture a test that mocks every collaborator and asserts every call in order. It has three problems:

- It repeats the implementation. So it **breaks on every refactor**, even when behaviour is unchanged.
- It passes while the real wiring is broken. It only proved that you called your mocks.
- It is hard to read.

Rules of thumb:

- **Mock the edges you do not control**: network calls, the clock, randomness, a payment provider.
- **Use real objects for your own code.**
- **Assert on outcomes**: state, return values and responses.
- Assert on calls only when the call is itself the requirement. Examples: "the gateway is called exactly once", or "no gateway call when funds are insufficient".

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

This needs a database, and depends on the real time. Two copies cannot run in parallel without clashing. Instead, **pass the dependencies in**, with a factory or a class constructor:

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

Production passes the real `accounts`, `gateway` and clock, in one place. That place is the **composition root**, usually `main.js`. A test passes fakes.

This is plain **dependency injection**. There is no container and no module patching. It is the same idea as constructor injection in Spring, without the framework.

Three dependencies are always worth injecting:

- **the clock**, meaning `Date.now()`;
- **randomness and ids**, such as `randomUUID`;
- **I/O clients**: HTTP, database and queue.

### Arrange, act, assert

Every test has the same three steps:

1. **Arrange**: build the fakes and the data.
2. **Act**: call the thing under test, once.
3. **Assert**: check the visible result.

A good test has:

- **one reason to fail**;
- a **name that states the behaviour**, such as "rejects a transfer above the balance", not "test2";
- **no logic of its own**, meaning no loops or ifs that would need their own tests.

**Test data builders** keep the arrange step short, and hide the fields that do not matter:

```javascript
const anAccount = (overrides = {}) => ({ id: 'A', balance: 1000, ...overrides });

const accounts = createFakeAccounts([anAccount({ balance: 500 }), anAccount({ id: 'B', balance: 0 })]);
```

## Unit-testing a service {#unit}

Here it is all together. This file passes with `node --test`:

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

Points to notice:

- `beforeEach` gives **every test its own state**, so the order does not matter.
- Errors are checked with `assert.rejects` and a **matcher object**, such as `{ code: ... }`. This checks the contract, not the message text.
- **Table-driven tests** loop over cases and create one `it` for each. Each case then fails on its own, with a clear name.
- Money is checked through the fake's state, not by counting calls.

Useful assertions:

- `assert.equal`, for strict equality;
- `assert.deepEqual`, for structure;
- `assert.throws` and `assert.rejects`, for sync and async errors;
- `assert.match(string, /regex/)`;
- `assert.ok`.

Comparing floating point numbers needs a tolerance. So keep money in integers (cents), as the example does.

## Async code, errors, events, streams and time {#async}

**Async functions.** `await` them. For errors, use `assert.rejects`. Never use a `try`/`catch` that asserts inside the `catch`. If the function does not throw, that assertion never runs, and the test passes.

Do not use `setTimeout` to wait for something. Wait for the thing itself:

```javascript
import { once } from 'node:events';

test('emits posted when a transfer completes', async () => {
  const bus = new EventEmitter();
  setImmediate(() => bus.emit('posted', { id: 1 }));          // stand-in for the code under test
  const [payload] = await once(bus, 'posted');                // resolves when it happens: no sleep, no flake
  assert.deepEqual(payload, { id: 1 });
});
```

**Streams.** Collect the output with `for await`, or use `pipeline`, then assert on the result (see [testing streams](lesson:node-streams#testing)).

```javascript
const out = [];
for await (const chunk of Readable.from(['a', 'b', 'c']).pipe(upperCaseTransform)) out.push(chunk);
assert.deepEqual(out, ['A', 'B', 'C']);
```

**Time.** A test that really waits 3 seconds is slow and flaky. Use **fake timers** instead, which let you move time forward by hand:

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

How fake timers work:

- `mock.timers` can fake `setTimeout`, `setInterval`, `setImmediate` and `Date`. For example: `enable({ apis: ['Date'], now: 1_700_000_000_000 })`.
- `tick(ms)` moves the clock forward.
- Fake timers do not run promise callbacks for you. So after `tick`, you often need an `await` or a `setImmediate` turn, as above.
- When you only need a fixed "now", **inject a clock** instead, as `createTransferService` does. Then you need no fake timers at all.

**Do not leave timers or handles open.** If a test file never ends, a server, database pool or timer was usually not closed in `after`.

## Testing an HTTP API {#http}

Export the app from a function that does **not** call `listen()` (see [Express testing](lesson:node-express#testing)). A test then has two options:

1. **supertest** sends the request to the app in memory: `await request(app).post('/transfers')`. It is short and common.
2. **A temporary real server** on **port 0**, called with the built-in `fetch`. It needs no extra package, and it tests real HTTP, including headers and `fetch` behaviour.

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

`createApp` returns an Express app, and `app.listen(0)` returns the Node server. The pattern was run with a plain `http.createServer` handler, which behaves the same.

An HTTP-level test should cover what a unit test cannot:

- **status codes and the error format**, including the central error handler;
- **validation**, where bad bodies get 400 or 422 with details;
- **authentication and authorisation**, where no token gets 401 and the wrong role gets 403;
- **headers**, such as `Location`, `Cache-Control` and `Retry-After`;
- **content negotiation** and body limits.

When you test the route, replace the *service* with a fake or a stub. The *route* then runs with the real middleware stack.

**Port 0** matters. With a fixed port such as 3000, two test files running in parallel fail with `EADDRINUSE`.

## Testing against a real database {#database}

A repository test can pass against **SQLite in memory**, or a mocked `pg` client, while the real PostgreSQL query fails. The SQL dialect and the types differ. There is no `FOR UPDATE`, no `ON CONFLICT`, no JSONB, and no real constraints.

So **test against the same engine as production**. **Testcontainers** starts a throwaway container, such as PostgreSQL, Redis or Kafka, for the test run. It removes it afterwards:

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

- **Start the container once**, per file or per run, and apply the migrations. Starting one per test is far too slow.
- Then give each test a **clean state**. There are two ways:
  - truncate the tables, which is simple and works with any code;
  - wrap the test in a **transaction that is rolled back**, which is fast, but the code under test must use the same connection.
- One global setup that starts one container for the whole run is faster still. If files run in parallel, give each test file its own database or schema.
- Tests that run Docker need Docker in CI. GitHub Actions and most runners have it. Put them in a separate step or folder, such as `test:integration`, so developers can still run the unit tests alone.
- **Migrations** are code. Running them in the tests catches a broken migration before production.

### Contract tests for fakes

The in-memory fake must not drift away from the real repository. So write the tests **once**, and run them against both:

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

Jest and Vitest can replace an imported module: `vi.mock('./gateway.js')`. In ES modules, imports are bound when the module loads, so this needs support from the runner. Node has `mock.module()`. It is experimental, behind `--experimental-test-module-mocks`, and more limited than Jest's.

```javascript
// Vitest
vi.mock('./gateway.js', () => ({ authorise: vi.fn().mockResolvedValue({ approved: true }) }));
```

Prefer **injection over module mocking**. If a function receives the gateway as an argument, or from a factory, nothing needs patching. The test is plain code.

Keep module mocks for two cases:

- code you cannot change, such as a third-party SDK used deep inside;
- process-wide modules, such as `fs` or `child_process`.

Ideally, wrap these in your own small module, so only one place is mocked.

For HTTP calls to other services, you can **intercept the network** instead of mocking your client. `nock` or **MSW** (Mock Service Worker) fake the server. Your real client code then runs unchanged, including its serialisation and retries. `undici`'s `MockAgent` does the same for `fetch`.

## Contract and end-to-end tests {#contract}

Services agree on the shape of their messages. A **consumer-driven contract test** (Pact) catches a breaking change before deployment:

1. The **consumer**, the front end or another service, writes a test. It says "when I call `GET /accounts/A`, I need `id`, and `balance` as a number". Running it against a Pact mock produces a **contract file**.
2. The **provider** runs that contract against its real code in CI. This is provider verification. It fails if the provider no longer returns those fields.

This is cheaper than running both services together. It finds "I renamed a field" the moment it happens. For events, the same idea applies to message schemas, such as JSON Schema or Avro, with compatibility rules in the schema registry. Compare [microservices communication](lesson:microservice-communication#contracts).

**End-to-end tests** cover a few critical journeys only: log in, make a transfer, see it in the history. Tools include Playwright, Cypress, or an API-level suite against a staging environment. These tests are slow, depend on every system, and fail for reasons unrelated to your change. So keep them **few and stable**, and let the lower levels carry most of the coverage.

## Coverage, snapshots, property and mutation tests {#quality}

- **Coverage** (`--experimental-test-coverage`, `c8`, Vitest `--coverage`) shows which lines **ran**. It does not show whether they were **checked**. It finds untested code, but a test with no assertions still counts. Use it as a floor, for example 80% on new code. Do not treat it as a target to game.
- **Snapshot tests** store output, such as a response body or a rendered string, and compare it on later runs. They are quick for large, stable output. But they are easy to approve without reading. Keep snapshots small, and review their diffs.
- **Property-based testing** (**fast-check**) states a rule. The library tries hundreds of generated inputs. When one fails, it **shrinks** it to the smallest failing example. It suits rules such as "a transfer then its reversal leaves the balances unchanged", or "serialising then parsing returns the same value".
- **Mutation testing** (**Stryker**) changes your code, for example `>` into `>=`, or `+` into `-`. Then it checks that some test fails. A change that no test notices is a "surviving mutant". It shows tests that run the code but do not check it. It is slow, so run it on important modules, or nightly.
- **Linting tests.** `eslint-plugin-jest`, or Vitest's equivalent, catches `only`, missing assertions and duplicated titles.

## Flaky tests {#flaky}

A **flaky test** passes and fails on the same code. It destroys trust: people re-run builds and ignore red ones. Typical causes and cures:

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

When a test is flaky:

1. **Reproduce it.** Run it in a loop, with a CPU limit.
2. Find the cause, and fix it.
3. If you cannot fix it now, **quarantine** it: skip it, with a ticket. Then it does not block everyone. But do not delete the signal.

## Tests in CI {#ci}

On every pull request, run lint, unit tests, integration tests (with Docker), then the build. Typical choices:

- **Fast feedback first.** Run unit tests before integration tests, and fail fast.
- **Parallelism.** The runner runs files in parallel (`--test-concurrency`). Split slow suites across CI jobs, which is called sharding.
- **A deterministic environment.** Pin the Node version (`.nvmrc`), use `pnpm install --frozen-lockfile`, and set `TZ=UTC`.
- **Reports.** Produce JUnit XML for the CI dashboard (`--test-reporter=junit`), and a coverage report.
- **A quality gate.** Tests must pass, and coverage on new code must not drop. See [CI/CD fundamentals](lesson:cicd-fundamentals#gates).
- **Smoke tests after deploy**, and the contract verification step before it.

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

The pyramid has many fast, cheap unit tests at the bottom. In the middle are fewer integration tests, for HTTP and the database. At the top are a few slow end-to-end tests.

Lower tests fail fast, and point at the exact function. Higher tests are more realistic, but slower, more fragile and harder to diagnose. An upside-down pyramid, with mostly end-to-end tests, gives a slow and flaky suite.

For services that mostly glue parts together, a "trophy" with more integration tests is also reasonable. The principle stays the same: choose the cheapest level that can catch the bug.

### [basic] What is the difference between a stub, a spy, a mock and a fake? {#doubles-q}

- A stub returns canned answers, so the code under test can run.
- A spy records how it was called: the count and the arguments.
- A mock is a spy with expectations. It fails the test if they are not met.
- A fake is a working but simplified implementation, such as an in-memory repository.

Stubs are about inputs. Spies and mocks are about what the code sends to other objects. Fakes support behaviour tests over several steps. Tools such as `mock.fn` or `vi.fn` combine all three.

### [basic] How do you test an async function and an error it throws? {#async-q}

Make the test `async`, or return the promise, and `await` the call. Then the runner waits for it.

For an error, use `await assert.rejects(promise, { code: 'X' })`, or `expect(promise).rejects`.

A `try`/`catch` that asserts inside the `catch` is a trap. If the function wrongly succeeds, the assertion never runs, and the test passes.

Do not wait with `setTimeout`. Wait for the event or the promise itself.

### [basic] How do you run Node's built-in tests and what do they give you? {#runner-q}

`node --test` finds `*.test.js` files and runs them. It gives you:

- `describe`, `it`, hooks and subtests;
- `node:assert`;
- mocking with `mock.fn`, `mock.method` and `mock.timers`;
- watch mode (`--watch`), name filtering, and coverage (`--experimental-test-coverage`).

Files run in parallel processes, and tests inside a file run in order. It has no dependencies, which is good for services and libraries. Vitest adds a richer watch mode, module mocking and TypeScript support.

### [basic] Why should tests be independent and how do you achieve it? {#independent-q}

So they can run alone, in any order and in parallel, and so a failure points at one cause.

To achieve it:

- create the data each test needs, in the test or in `beforeEach`;
- never rely on what another test left behind;
- use unique ids;
- use port 0 for servers;
- reset fakes and databases between tests;
- avoid module-level state that changes.

Shared state is the main cause of flaky tests.

### [intermediate] What is over-mocking and what is the alternative? {#overmock-q}

Over-mocking means mocking every collaborator and asserting each call. It repeats the implementation. The test breaks on refactors that keep the behaviour. It passes while the real wiring is broken. And it is hard to read.

The alternative:

- mock only what you do not control: the network, the clock, randomness, a payment provider;
- use real objects or fakes for your own code;
- assert on outcomes: return values, stored state, the HTTP response.

Assert on a call only when the call is the requirement. For example: "the gateway is not called when funds are insufficient".

### [intermediate] How do you make Node.js code testable without a mocking framework? {#di-q}

Pass dependencies in, instead of importing and creating them inside. Use a factory such as `createTransferService({ accounts, gateway, clock })`, or a constructor.

Production wires the real implementations in one composition root. Tests pass fakes. Inject the clock, id generation and I/O clients.

This avoids module patching, and keeps tests as plain code. It is the same idea as constructor injection in Spring.

### [intermediate] How do you test code that uses timers, retries or `Date.now()` without waiting? {#time-q}

There are two ways.

1. Inject a clock, such as `{ now: () => fixed }`. Then no timers are involved.
2. Use fake timers: `mock.timers.enable({ apis: ['setTimeout'] })` and `tick(ms)`. In Vitest, these are `vi.useFakeTimers` and `advanceTimersByTime`.

With fake timers, promise callbacks still need a turn of the event loop after each tick, such as an `await` or `setImmediate`.

Either way, the test runs in milliseconds and gives the same result every time. Real sleeps make tests slow and flaky.

### [intermediate] How do you test an Express route? What should an HTTP-level test check? {#http-q}

Export the app from a function that does not call `listen`. Then either use supertest, or start `app.listen(0)` and call it with `fetch`.

Replace the service with a fake or a stub. The test then covers the route and the real middleware. Check:

- status codes, and the error format from the central handler;
- validation failures (400 or 422);
- authentication and authorisation (401, 403);
- headers such as `Location`;
- body limits.

Business rules belong in the unit tests of the service.

### [intermediate] Why is SQLite or a mocked client a poor substitute for the database in tests, and what do you use? {#realdb-q}

The SQL dialect, types, constraints, locking and features all differ. JSONB, `ON CONFLICT` and `FOR UPDATE` are examples. So tests pass while production queries fail. A mocked client only proves that you called it.

Instead, run the production engine in a throwaway container with Testcontainers. Apply the real migrations once. Give each test a clean state, by truncating tables or rolling back a transaction.

This is slower than a unit test. So keep these tests for repositories and queries.

### [intermediate] How do you keep an in-memory fake consistent with the real repository? {#fake-contract-q}

Write the repository tests once, as a shared contract function that takes a factory: `accountRepositoryContract('fake', makeFake)`. Run it against the fake, and against the real PostgreSQL repository.

When you add a behaviour, or find one wrong, add it to the contract. Both must pass. The service tests then use a fake that is proven to act like the real one.

### [intermediate] What causes flaky tests and how do you fix them? {#flaky-q}

Common causes:

- shared state, and tests that depend on order;
- real time and sleeps;
- fixed ports and files;
- randomness;
- unawaited promises;
- external services;
- races on slow machines.

Fix the cause. Isolate state, and inject the clock. Wait for events and conditions instead of sleeping. Use port 0 and temporary directories. Await everything. Replace external services with fakes or containers.

To reproduce one, run the test in a loop. If you cannot fix it at once, quarantine it with a ticket. Never let re-running red builds become normal.

### [intermediate] What is a consumer-driven contract test and when is it better than an end-to-end test? {#contract-q}

The consumer records, in a contract, what it needs from the provider: paths, fields and types. The provider runs that contract against its real code in CI. It fails if a change would break the consumer.

It catches breaking API changes early, runs fast, and needs neither service deployed. So for the question "do these two services still agree?", it beats an end-to-end test. Keep end-to-end tests for a few critical journeys.

### [deep] What does code coverage tell you and what does it not? {#coverage-q}

It tells you which lines or branches ran during the tests. So it reveals untested code.

It does not tell you whether the behaviour was checked. A test with no assertions still gives full coverage.

Use coverage as a minimum, for example on new code. Add mutation testing with Stryker. It changes the code, and shows which changes no test notices. So it measures the quality of the assertions.

Chasing 100% leads to tests that check implementation details.

### [deep] How would you design the test strategy for a Node.js payments service? {#strategy-q}

Use each level for what it does best:

- **Domain rules** such as limits, fees, idempotency and state changes: unit tests with fakes and a fixed clock. Add table-driven and property-based tests for money arithmetic.
- **Repositories**: tests against real PostgreSQL with Testcontainers and the real migrations. Include constraint and concurrency cases, such as a unique idempotency key and `FOR UPDATE`.
- **HTTP**: tests for validation, authentication and the error format.
- **Contracts**: with the front end, and with the payment gateway. MSW can stub the provider's sandbox responses.
- **End to end**: a handful of tests for login and a transfer.

In CI, run unit tests first, then integration tests in parallel jobs. Add a coverage gate on new code, nightly mutation tests on the domain, and a smoke test after each deployment.

### [deep] When is mocking modules acceptable, and what are the drawbacks? {#module-mock-q}

It is acceptable when you cannot inject the dependency. Examples are a third-party SDK used deep in the code, or process-wide modules such as `fs` and `child_process`.

The drawbacks:

- tight coupling to import paths and module internals;
- uneven support in ES modules: Node's `mock.module` is experimental, and `vi.mock` is hoisted;
- hidden global state between tests, if mocks are not reset;
- tests that pass although the real module behaves differently.

Prefer injection. Wrap the third-party module in your own thin adapter, and mock that adapter. Or intercept the network with MSW or nock instead.

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

Explain these points:

- Each test builds fresh fakes in `beforeEach`, so the tests are independent.
- The service gets a fake repository, a stubbed gateway that also works as a spy, and a fixed clock.
- Outcomes are checked through the fake's state.
- The gateway call count is checked only where the call is the requirement.
- The table-driven loop creates one test for each invalid value.

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

Explain these points:

- `t.mock.timers` fakes `setTimeout`, and is restored when the test ends.
- `tick` moves time forward.
- A turn of the event loop lets the promise callbacks run before the next assertion.
- In the second test, the rejection handler is attached early. So Node never reports an unhandled rejection.
- The whole file runs in a few milliseconds instead of seconds.

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

Explain these points:

- The app comes from a factory, with its repository injected. So the test needs no database and no patching.
- Port 0 lets many test files run in parallel without `EADDRINUSE`.
- The server starts in `before` and closes in `after`.
- The test uses real HTTP. So headers, status codes and JSON serialisation are all exercised.
