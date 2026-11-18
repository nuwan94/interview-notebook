// Frame data for the "Node.js testing" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const NODE_TEST_SCENES = [
  {
    id: 'pyramid',
    label: 'What to test where',
    title: 'A pyramid for a Node API',
    frames: [
      {
        note: 'Unit tests cover pure logic and services with fake collaborators: interest calculation, validation, the transfer rules. They run in milliseconds, need no network or database, and there are many of them. They tell you exactly which function broke.',
        boxes: [b('l', 'Pure logic', ['interest, fees, rules'], 'ok'), b('s', 'Service with fakes', ['fake repository, fake clock'], 'new'), b('r', 'Fast feedback', ['milliseconds each'], 'ok')],
        deps: [d('Pure logic', 'Fast feedback', 'gives', 'ok'), d('Service with fakes', 'Fast feedback', 'gives', 'ok')],
      },
      {
        note: 'Integration tests run several real parts together: the HTTP routes with middleware and error handling, and the repository against a real database. They find wiring, SQL, serialisation and migration mistakes that unit tests with fakes cannot see. There are fewer of them and they are slower.',
        boxes: [b('h', 'HTTP route test', ['real app, real middleware'], 'new'), b('d', 'Real database test', ['SQL, constraints, migrations'], 'new'), b('f', 'Wiring bugs found', ['what fakes hide'], 'ok')],
        deps: [d('HTTP route test', 'Wiring bugs found', 'finds', 'ok'), d('Real database test', 'Wiring bugs found', 'finds', 'ok')],
      },
      {
        note: 'Contract tests check the agreement between services: the consumer states which fields it needs, and the provider proves it still supplies them. A few end-to-end tests drive the whole deployed system through key journeys. They are the slowest and the most fragile, so keep them few.',
        boxes: [b('c', 'Consumer contract', ['fields I rely on'], 'new'), b('p', 'Provider verification', ['still true after a change'], 'ok'), b('e', 'Few end-to-end tests', ['login and transfer'], 'warn')],
        deps: [d('Consumer contract', 'Provider verification', 'verified by', 'ok'), d('Provider verification', 'Few end-to-end tests', 'then', 'warn')],
      },
    ],
  },
  {
    id: 'doubles',
    label: 'Test doubles',
    title: 'Replace what you do not control',
    frames: [
      {
        note: 'The service under test depends on a payment gateway. In a test you replace it with a double. A stub returns canned answers, for example always approve. It exists only to let the code under test run.',
        boxes: [b('t', 'Service under test', ['TransferService'], 'new'), b('s', 'Stub gateway', ['always returns approved'], 'ok'), b('a', 'Assert on the result', ['status is POSTED'], 'ok')],
        deps: [d('Service under test', 'Stub gateway', 'calls', 'ok'), d('Stub gateway', 'Assert on the result', 'lets us check', 'ok')],
      },
      {
        note: 'A spy records how it was used: how many calls and with which arguments. A mock is a spy with built-in expectations. Use them when the interaction itself is the behaviour, for example the gateway must be called exactly once with the right amount, even after a retry.',
        boxes: [b('t', 'Service under test', ['transfer(100)'], 'new'), b('s', 'Spy gateway', ['records every call'], 'ok'), b('a', 'Assert on calls', ['once, with 100'], 'warn')],
        deps: [d('Service under test', 'Spy gateway', 'calls', 'ok'), d('Spy gateway', 'Assert on calls', 'reports', 'warn')],
      },
      {
        note: 'A fake is a working but simple implementation, such as an in-memory repository that really stores and finds accounts. Fakes keep tests readable and let you test behaviour over several steps. Run the same contract tests against the fake and the real one so they cannot drift apart.',
        boxes: [b('t', 'Service under test', ['uses a repository'], 'new'), b('f', 'In-memory fake', ['real behaviour, simple'], 'ok'), b('c', 'Same contract tests', ['fake and real database'], 'new')],
        deps: [d('Service under test', 'In-memory fake', 'uses', 'ok'), d('In-memory fake', 'Same contract tests', 'checked by', 'ok')],
      },
      {
        note: 'Over-mocking is the main trap. A test that mocks every collaborator and asserts the exact calls repeats the implementation, breaks on every refactor and proves little. Mock the boundaries you do not control, such as the network, the clock and randomness, and use real objects for your own code.',
        boxes: [b('x', 'Mocks everywhere', ['asserts each call'], 'bad'), b('r', 'Breaks on refactor', ['behaviour unchanged'], 'bad'), b('g', 'Mock only the edges', ['network, clock, random'], 'ok')],
        deps: [d('Mocks everywhere', 'Breaks on refactor', 'causes', 'bad')],
      },
    ],
  },
  {
    id: 'design',
    label: 'Design for testability',
    title: 'Pass dependencies in',
    frames: [
      {
        note: 'A function that creates its own database connection, calls Date.now() and uses Math.random() inside is hard to test: the result depends on the world. You cannot control the time, and the test would touch a real database.',
        boxes: [b('f', 'Hidden dependencies', ['db, Date.now, random'], 'bad'), b('h', 'Hard to test', ['slow, flaky, global state'], 'bad')],
        deps: [d('Hidden dependencies', 'Hard to test', 'makes it', 'bad')],
      },
      {
        note: 'Pass dependencies in as arguments or through a factory: createTransferService({ accounts, gateway, clock }). Production code passes the real ones, and a test passes fakes. No special framework is needed, and there is no need to patch modules.',
        boxes: [b('p', 'Production wiring', ['real db, gateway, clock'], 'ok'), b('s', 'createTransferService', ['takes its dependencies'], 'new'), b('t', 'Test wiring', ['fakes and fixed clock'], 'ok')],
        deps: [d('Production wiring', 'createTransferService', 'passes real', 'ok'), d('Test wiring', 'createTransferService', 'passes fakes', 'ok')],
      },
      {
        note: 'Arrange, act, assert. Arrange the fakes and the data, act by calling the function once, assert on the visible result. A good test has one reason to fail, a name that states the behaviour, and no logic of its own. Test data builders keep the arrange step short.',
        boxes: [b('a', 'Arrange', ['build fakes and data'], 'ok'), b('b', 'Act', ['call it once'], 'new'), b('c', 'Assert', ['check the outcome'], 'ok')],
        deps: [d('Arrange', 'Act', 'then', 'ok'), d('Act', 'Assert', 'then', 'ok')],
      },
    ],
  },
  {
    id: 'database',
    label: 'Real database tests',
    title: 'Fast, isolated and realistic',
    frames: [
      {
        note: 'A repository test against SQLite in memory or a mocked client passes while the real PostgreSQL query fails. Use the same engine as production. Testcontainers starts a throwaway PostgreSQL container for the test run and removes it afterwards.',
        boxes: [b('m', 'Mocked client', ['passes, proves little'], 'bad'), b('c', 'Testcontainers', ['real PostgreSQL in Docker'], 'new'), b('r', 'Removed after the run', ['no shared state'], 'ok')],
        deps: [d('Testcontainers', 'Removed after the run', 'cleans up', 'ok')],
      },
      {
        note: 'Start the container once per test file or run and apply the real migrations to it. That tests the migrations too. Then give every test a clean state quickly, either by wrapping it in a transaction that is rolled back, or by truncating the tables between tests.',
        boxes: [b('s', 'Start once', ['container + migrations'], 'new'), b('t', 'Transaction per test', ['begin, test, rollback'], 'ok'), b('c', 'Clean state each time', ['order does not matter'], 'ok')],
        deps: [d('Start once', 'Transaction per test', 'then', 'ok'), d('Transaction per test', 'Clean state each time', 'gives', 'ok')],
      },
      {
        note: 'Tests must be independent so they can run in parallel and in any order. Each test creates the data it needs, uses unique ids, never relies on another test, and uses port 0 for servers so the operating system picks a free port. Shared state is the main cause of flaky tests.',
        boxes: [b('i', 'Independent tests', ['own data, own ids'], 'ok'), b('p', 'Port 0', ['free port from the OS'], 'ok'), b('s', 'Shared state', ['order-dependent, flaky'], 'bad')],
        deps: [d('Shared state', 'Independent tests', 'avoid by', 'warn')],
      },
    ],
  },
];
