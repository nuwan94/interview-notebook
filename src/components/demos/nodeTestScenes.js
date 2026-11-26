// Frame data for the "Node.js testing" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;

/* ---------- the pyramid: one row per level, width = how many tests ---------- */
const LEVELS = [
  ['e2e', 'end to end', 'login, transfer: seconds', 160],
  ['ct', 'contract', 'consumer needs, provider proves', 280],
  ['it', 'integration', 'HTTP routes, real PostgreSQL', 420],
  ['u', 'unit', 'rules and services with fakes: ms', 600],
];
const pyramid = (focus) => LEVELS.map(([id, title, line, w], i) => ({
  id, x: 320 - w / 2, y: 40 + i * 52, w, h: 40, title, lines: [line], tone: focus.includes(id) ? 'new' : 'none', dim: !focus.includes(id),
}));

const pyramidFrames = [
  {
    h: 290,
    line: 'node --test   # unit tests',
    result: { text: 'many, fast, precise', tone: 'ok' },
    cards: pyramid(['u']),
    texts: [{ x: 14, y: 268, t: 'width = how many tests at that level' }],
    note: 'Unit tests cover pure rules and services, with fake collaborators. They run in milliseconds and need no network or database. There are many of them, and a failure names the exact function that broke.',
  },
  {
    h: 290,
    line: 'listen(0) + fetch, Testcontainers',
    result: { text: 'finds wiring bugs fakes hide', tone: 'ok' },
    cards: pyramid(['it']),
    note: 'Integration tests run real parts together: routes with their middleware, and repositories against real PostgreSQL. They catch SQL, wiring and serialisation mistakes. There are fewer, and they are slower.',
  },
  {
    h: 290,
    line: 'Pact verify, Playwright',
    result: { text: 'few, slow, keep them stable', tone: 'warn' },
    cards: pyramid(['ct', 'e2e']),
    note: 'Contract tests check that two services still agree. A few end-to-end tests drive key journeys through the deployed system. They are the slowest and most fragile, so keep them few.',
  },
];

/* ---------- test doubles ---------- */
const sut = (lines) => box('s', C1, 80, W, 'TransferService', lines, 'new', { badge: 'under test' });

const doubleFrames = [
  {
    h: 230,
    line: 'authorise: mock.fn(async () => ({ approved: true }))',
    result: { text: 'stub: canned answer', tone: 'ok' },
    cards: [sut(['transfer(200)']), box('g', C2, 80, W, 'stub gateway', ['always approves'], 'ok'), box('a', C3, 80, W, 'assert the result', ['status === "POSTED"'], 'ok')],
    arrows: [{ from: 's', to: 'g', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'g', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The service depends on a payment gateway you do not control. A stub replaces it with a canned answer, so the code under test can run. You then check the result.',
  },
  {
    h: 230,
    line: 'gateway.authorise.mock.callCount()',
    result: { text: 'spy: the call is the requirement', tone: 'warn' },
    cards: [sut(['transfer(501)', 'balance is 500']), box('g', C2, 80, W, 'spy gateway', ['records every call'], 'warn'), box('a', C3, 80, W, 'assert the calls', ['callCount() === 0'], 'ok')],
    arrows: [{ from: 'g', to: 'a', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'A spy records each call and its arguments. A mock is a spy with expectations built in. Assert on calls only when the call is the rule, such as "no gateway call when funds are short".',
  },
  {
    h: 250,
    line: 'createFakeAccounts([…])',
    result: { text: 'fake: real behaviour, in memory', tone: 'ok' },
    cards: [
      sut(['transfer, then read']),
      box('f', C2, 80, W, 'in-memory fake', ['Map of accounts', 'really stores data'], 'ok'),
      box('c', C3, 44, W, 'contract tests', ['run on the fake'], 'new'),
      box('p', C3, 140, W, 'contract tests', ['run on PostgreSQL'], 'new'),
    ],
    arrows: [{ from: 's', to: 'f', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'f', to: 'c', fs: 'r', ts: 'l' }],
    note: 'A fake is a simple working version, such as a repository kept in a Map. It lets you test behaviour over several steps. Run the same contract tests against the fake and the real database, so they cannot drift apart.',
  },
  {
    h: 250,
    line: 'every collaborator mocked, every call asserted',
    result: { text: 'breaks on each refactor', tone: 'bad' },
    cards: [
      box('m1', C1, 44, W, 'mock repository', ['expect find() first'], 'bad'),
      box('m2', C2, 44, W, 'mock validator', ['expect check() once'], 'bad'),
      box('m3', C3, 44, W, 'mock mapper', ['expect toDto() last'], 'bad'),
      box('g', C1, 160, 612, 'mock only the edges you do not control', ['network, clock, randomness: real objects for your own code'], 'ok'),
    ],
    note: 'Over-mocking repeats the implementation. The test breaks when you refactor, even though behaviour is unchanged. And it passes while the real wiring is broken. Mock the edges, and use real objects for the rest.',
  },
];

/* ---------- design for testability ---------- */
const designFrames = [
  {
    h: 230,
    line: 'import { pool } from "./db.js"',
    result: { text: 'hidden dependencies', tone: 'bad' },
    cards: [
      box('f', C2, 50, W, 'transfer()', ['reaches out by itself'], 'bad'),
      box('d', C1, 150, W, 'pool.query', ['a real database'], 'warn'),
      box('t', C2, 150, W, 'Date.now()', ['the real time'], 'warn'),
      box('r', C3, 150, W, 'randomUUID()', ['a new id each run'], 'warn'),
    ],
    arrows: [{ from: 'f', to: 'd', fs: 'b', ts: 't', tone: 'warn' }, { from: 'f', to: 't', fs: 'b', ts: 't', tone: 'warn' }, { from: 'f', to: 'r', fs: 'b', ts: 't', tone: 'warn' }],
    note: 'This function creates its own connection, reads the clock and makes ids. The result depends on the world. A test cannot control the time, and would have to touch a real database.',
  },
  {
    h: 250,
    line: 'createTransferService({ accounts, gateway, clock })',
    result: { text: 'pass dependencies in', tone: 'ok' },
    cards: [
      box('p', C1, 44, W, 'main.js', ['real db, gateway', 'Date.now clock'], 'ok', { badge: 'production' }),
      box('t', C1, 160, W, 'the test', ['fakes, stub gateway', 'fixed clock'], 'ok', { badge: 'test' }),
      box('s', C3, 100, W, 'createTransferService', ['takes its', 'dependencies'], 'new'),
    ],
    arrows: [{ from: 'p', to: 's', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Pass the dependencies in through a factory. Production passes the real ones, in one place called the composition root. A test passes fakes. No framework and no module patching are needed.',
  },
  {
    h: 230,
    line: 'arrange → act → assert',
    result: { text: 'one reason to fail', tone: 'ok' },
    cards: [
      box('a', C1, 70, W, 'arrange', ['build fakes and data'], 'none'),
      box('b', C2, 70, W, 'act', ['call it once'], 'new'),
      box('c', C3, 70, W, 'assert', ['check the outcome'], 'ok'),
    ],
    arrows: [{ from: 'a', to: 'b', fs: 'r', ts: 'l' }, { from: 'b', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Every test has three steps. Build the fakes and data, call the code once, then check the visible result. A good name states the behaviour. The test has no logic of its own.',
  },
];

/* ---------- real database tests ---------- */
const dbFrames = [
  {
    h: 250,
    line: 'INSERT … ON CONFLICT DO NOTHING',
    result: { text: 'passes on SQLite, fails on PostgreSQL', tone: 'bad' },
    cards: [
      box('m', C1, 60, 290, 'SQLite in memory or a mocked client', ['test passes'], 'bad'),
      box('p', 336, 60, 290, 'PostgreSQL in production', ['different SQL, types, locks'], 'warn'),
      box('c', C1, 170, 612, 'Testcontainers: real postgres:16-alpine in Docker', ['started for the test run, removed afterwards'], 'ok'),
    ],
    note: 'A different engine has a different dialect, types and constraints. So a test passes while the real query fails. Testcontainers starts the real engine in a throwaway container.',
  },
  {
    h: 250,
    line: 'beforeEach(): TRUNCATE',
    result: { text: 'clean state for every test', tone: 'ok' },
    cards: [
      box('s', C1, 60, W, 'start once', ['container', '+ real migrations'], 'new', { badge: 'per file' }),
      box('t1', C2, 44, W, 'test 1', ['own rows'], 'ok'),
      box('t2', C2, 120, W, 'test 2', ['own rows'], 'ok'),
      box('c', C3, 80, W, 'between tests', ['TRUNCATE or', 'ROLLBACK'], 'ok'),
    ],
    arrows: [{ from: 's', to: 't1', fs: 'r', ts: 'l' }, { from: 't1', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Start the container once per file, and apply the real migrations. That tests the migrations too. Then give each test a clean state, by truncating tables or rolling back a transaction.',
  },
  {
    h: 230,
    line: 'node --test   # files run in parallel',
    result: { text: 'independent: any order, in parallel', tone: 'ok' },
    cards: [
      box('a', C1, 70, W, 'own data', ['unique ids per test'], 'ok'),
      box('b', C2, 70, W, 'listen(0)', ['the OS picks a free port'], 'ok'),
      box('c', C3, 70, W, 'shared state', ['order-dependent, flaky'], 'bad', { badge: 'avoid' }),
    ],
    note: 'Tests must not depend on each other, so they can run in any order and in parallel. Each creates its own data. Servers use port 0. Shared state is the main cause of flaky tests.',
  },
];

export const NODE_TEST_SCENES = [
  { id: 'pyramid', label: 'What to test where', title: 'A pyramid for a Node API', stage: BoardStage, frames: pyramidFrames },
  { id: 'doubles', label: 'Test doubles', title: 'Replace what you do not control', stage: BoardStage, frames: doubleFrames },
  { id: 'design', label: 'Design for testability', title: 'Pass dependencies in', stage: BoardStage, frames: designFrames },
  { id: 'database', label: 'Real database tests', title: 'Fast, isolated and realistic', stage: BoardStage, frames: dbFrames },
];
