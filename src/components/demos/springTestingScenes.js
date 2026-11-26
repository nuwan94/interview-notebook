// Frame data for the Spring testing walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- test slices ---------- */
// The application is drawn as three layers inside a context box, with the database outside it.
// Each frame shows which layers a kind of test loads for real, which it mocks, and which it leaves out.
const appRegion = (title, tone) => ({ x: 220, y: 24, w: 252, h: 242, title, tone });
const layer = (id, y, title, lines, o = {}) => ({ id, x: 236, y, w: 220, title, lines, tone: 'ok', ...o });
const web = (lines, o) => layer('web', 64, 'Controller + advice', lines, o);
const svc = (lines, o) => layer('svc', 134, 'TransferService', lines, o);
const repo = (lines, o) => layer('repo', 204, 'AccountRepository', lines, o);
const db = (lines, o = {}) => ({ id: 'db', x: 498, y: 204, w: 128, title: 'Database', lines, tone: 'ok', ...o });
const test = (title, lines, o = {}) => ({ id: 'test', x: 14, y: 64, w: 180, title, lines, mono: true, tone: 'new', ...o });
const off = { dim: true };
const mocked = { tone: 'warn', badge: 'mock' };

const sliceFrames = [
  {
    h: 284,
    line: 'new TransferService(mockRepo, clock)',
    result: { text: 'milliseconds', tone: 'ok' },
    regions: [appRegion('no Spring context at all', 'none')],
    cards: [test('Unit test', ['JUnit 5', 'Mockito']), web(['not involved'], off), svc(['created with new'], { badge: 'real' }), repo(['Mockito mock'], mocked), db(['not used'], off)],
    arrows: [{ from: 'test', to: 'svc', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'A plain unit test creates the class with new and passes mocks. There is no Spring at all, so it runs in milliseconds. Most business logic should be tested here, with many tests like this.',
  },
  {
    h: 284,
    line: '@WebMvcTest(AccountController.class)',
    result: { text: 'about a second', tone: 'ok' },
    regions: [appRegion('small context: web layer only', 'new')],
    cards: [test('Web slice test', ['MockMvc', 'no server, no port']), web(['real: mapping, JSON,', 'validation, errors'], { badge: 'real' }), svc(['@MockitoBean'], mocked), repo(['not loaded'], off), db(['not used'], off)],
    arrows: [{ from: 'test', to: 'web', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'A web slice test starts a small Spring context with only the web layer: controllers, advice, JSON converters and validation. Services are replaced by mocks. MockMvc sends requests through it, with no server and no database.',
  },
  {
    h: 284,
    line: '@DataJpaTest',
    result: { text: 'proves real SQL', tone: 'ok' },
    regions: [appRegion('small context: JPA layer only', 'new')],
    cards: [test('Data slice test', ['save, flush, query', 'rolled back after']), web(['not loaded'], off), svc(['not loaded'], off), repo(['real repositories', 'and Hibernate'], { badge: 'real' }), db(['PostgreSQL', 'in a container'], { badge: 'real' })],
    arrows: [{ from: 'test', to: 'repo', fs: 'r', ts: 'l', tone: 'new' }, { from: 'repo', to: 'db', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A data slice test loads only the JPA layer: entities, repositories, a DataSource and Hibernate. It runs against a real database and rolls back after each test. It proves your queries and mappings, which mocks cannot.',
  },
  {
    h: 284,
    line: '@SpringBootTest(webEnvironment = RANDOM_PORT)',
    result: { text: 'seconds: write few', tone: 'warn' },
    regions: [appRegion('the whole application', 'new')],
    cards: [test('Integration test', ['real HTTP calls', 'TestRestTemplate']), web(['real'], { badge: 'real' }), svc(['real'], { badge: 'real' }), repo(['real'], { badge: 'real' }), db(['PostgreSQL', 'in a container'], { badge: 'real' })],
    arrows: [{ from: 'test', to: 'web', fs: 'r', ts: 'l', tone: 'new' }, { from: 'web', to: 'svc', fs: 'b', ts: 't' }, { from: 'svc', to: 'repo', fs: 'b', ts: 't' }, { from: 'repo', to: 'db', fs: 'r', ts: 'l' }],
    note: 'A full integration test starts the whole application, often on a random port with a real HTTP client. It proves wiring, configuration and security end to end. It is slower, so write only a few, for the main flows.',
  },
  {
    h: 284,
    line: 'Spring caches contexts by their configuration',
    result: { text: 'one new mock = one more startup', tone: 'warn' },
    cards: [
      { id: 't1', x: 14, y: 30, w: 220, title: 'TransferFlowIT', lines: ['base config X'], tone: 'ok' },
      { id: 't2', x: 14, y: 110, w: 220, title: 'AccountFlowIT', lines: ['base config X'], tone: 'ok' },
      { id: 't3', x: 14, y: 190, w: 220, title: 'FeeFlowIT', lines: ['config X + @MockitoBean Clock'], tone: 'warn' },
      { id: 'c1', x: 406, y: 66, w: 220, title: 'Context #1', lines: ['started once, reused'], tone: 'ok', badge: 'cache hit' },
      { id: 'c2', x: 406, y: 190, w: 220, title: 'Context #2', lines: ['a second full startup'], tone: 'warn', badge: 'cache miss' },
    ],
    arrows: [
      { from: 't1', to: 'c1', fs: 'r', ts: 'l', fo: 0, toff: -8, tone: 'ok' },
      { from: 't2', to: 'c1', fs: 'r', ts: 'l', fo: 0, toff: 8, tone: 'ok' },
      { from: 't3', to: 'c2', fs: 'r', ts: 'l', tone: 'warn' },
    ],
    note: 'Spring keeps a started context and reuses it for every test with the same configuration, so the startup cost is paid once. Adding a @MockitoBean or different properties to one test creates a new context. Keep configurations few and shared.',
  },
];

/* ---------- testing a controller with MockMvc ---------- */
const mtest = (lines, o = {}) => ({ id: 'test', x: 14, y: 30, w: 250, title: 'AccountControllerTest', lines, mono: true, tone: 'new', ...o });
const mds = (o = {}) => ({ id: 'ds', x: 330, y: 30, w: 150, title: 'DispatcherServlet', lines: ['real, but no port'], tone: 'none', ...o });
const mctrl = (lines, o = {}) => ({ id: 'ctrl', x: 330, y: 140, w: 150, title: 'AccountController', lines, tone: 'none', ...o });
const msvc = (lines, o = {}) => ({ id: 'svc', x: 506, y: 140, w: 120, title: 'AccountService', lines, tone: 'warn', badge: 'mock', ...o });

const mockmvcFrames = [
  {
    h: 230,
    line: 'given(service.find(42)).willReturn(dto);',
    result: { text: 'arrange', tone: 'new' },
    cards: [mtest(['// arrange', 'given(service.find(42))', '  .willReturn(dto);']), mds({ dim: true }), mctrl(['not called yet'], { dim: true }), msvc(['find(42) returns', 'balance 100'], { badge: 'stubbed' })],
    note: 'Arrange: the service is a mock, so the test decides what it returns. Here account 42 exists with a balance of 100. No database is involved.',
  },
  {
    h: 230,
    line: 'mvc.perform(get("/api/accounts/42"))',
    result: { text: 'act', tone: 'new' },
    cards: [mtest(['// act', 'mvc.perform(', '  get("/api/accounts/42"))']), mds(), mctrl(['get(42)'], { tone: 'ok' }), msvc(['find(42) called'])],
    arrows: [{ from: 'test', to: 'ds', fs: 'r', ts: 'l', tone: 'new' }, { from: 'ds', to: 'ctrl', fs: 'b', ts: 't' }, { from: 'ctrl', to: 'svc', fs: 'r', ts: 'l' }],
    note: 'Act: MockMvc sends GET /api/accounts/42 through the real DispatcherServlet: mapping, argument binding, the controller and JSON serialisation. No port is opened.',
  },
  {
    h: 230,
    line: 'andExpect(status().isOk())',
    result: { text: 'assert', tone: 'ok' },
    cards: [mtest(['// assert', '.andExpect(status().isOk())', '.andExpect(jsonPath("$.balance")', '    .value(100));'], { tone: 'ok' }), mds({ tone: 'ok' }), mctrl(['returned the DTO'], { tone: 'ok' }), msvc(['verify: called'])],
    arrows: [{ from: 'ds', to: 'test', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'Assert: check the status, the content type and the JSON fields, then verify the call. Assert on what the caller sees (the response), not on private details, so refactoring does not break the test.',
  },
  {
    h: 230,
    line: 'willThrow(new AccountNotFoundException(7))',
    result: { text: 'error path tested', tone: 'ok' },
    cards: [mtest(['.andExpect(status().isNotFound())', '.andExpect(content()', '  .contentType(PROBLEM_JSON))'], { tone: 'ok' }), mds({ tone: 'ok' }), mctrl(['advice maps it to 404'], { tone: 'ok' }), msvc(['throws not found'], { tone: 'bad' })],
    arrows: [{ from: 'svc', to: 'ctrl', fs: 'l', ts: 'r', tone: 'bad' }, { from: 'ds', to: 'test', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'Test the error paths too. Stub the service to throw AccountNotFoundException, and assert a 404 with a ProblemDetail body. This proves the @RestControllerAdvice mapping works, which a plain unit test of the controller cannot.',
  },
];

/* ---------- Testcontainers ---------- */
const ctest = (lines, o = {}) => ({ id: 'test', x: 14, y: 30, w: 210, title: 'AccountRepositoryTest', lines, mono: true, tone: 'new', ...o });
const cctx = (lines, o = {}) => ({ id: 'ctx', x: 14, y: 150, w: 210, title: 'Spring test context', lines, mono: true, tone: 'none', ...o });
const docker = (tone = 'none') => ({ x: 270, y: 24, w: 356, h: 210, title: 'Docker', tone });
const pg = (lines, o = {}) => ({ id: 'pg', x: 290, y: 70, w: 316, title: 'postgres:16 container', lines, mono: true, tone: 'none', ...o });

const containerFrames = [
  {
    h: 250,
    line: '@Container static PostgreSQLContainer<?> postgres',
    regions: [docker('new')],
    cards: [ctest(['@Testcontainers', '@Container @ServiceConnection']), cctx(['not started yet'], { dim: true }), pg(['starting…', 'port: random (55012)'], { tone: 'new', badge: 'real database' })],
    arrows: [{ from: 'test', to: 'pg', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'H2 behaves differently from PostgreSQL: types, locking, SQL dialect, JSON and sequences. Tests can pass on H2 and fail in production. Testcontainers starts the real database in a Docker container for the test.',
  },
  {
    h: 250,
    line: '@ServiceConnection   (Boot 3.1+)',
    regions: [docker()],
    cards: [ctest(['@Testcontainers', '@Container @ServiceConnection']), cctx(['datasource.url =', ' jdbc:postgresql://', ' localhost:55012/test'], { tone: 'ok', badge: 'wired' }), pg(['running', 'port: 55012'], { tone: 'ok' })],
    arrows: [{ from: 'pg', to: 'ctx', fs: 'l', ts: 'r', tone: 'ok' }],
    note: '@ServiceConnection reads the container\'s address and sets the DataSource properties for you. Older code uses @DynamicPropertySource to set spring.datasource.url. There are no hard-coded ports.',
  },
  {
    h: 250,
    line: 'Flyway: V1__create_account.sql, V2__add_ledger.sql',
    result: { text: 'schema verified', tone: 'ok' },
    regions: [docker()],
    cards: [ctest(['@Testcontainers', '@Container @ServiceConnection']), cctx(['Flyway migrate', 'ddl-auto=validate'], { tone: 'ok' }), pg(['tables: account, ledger', 'created by the real scripts'], { tone: 'ok', badge: 'migrated' })],
    arrows: [{ from: 'ctx', to: 'pg', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'On startup Flyway runs the real migrations on the empty database. With ddl-auto=validate, the test also checks that the migration scripts and the entity mappings agree.',
  },
  {
    h: 250,
    line: 'each test: save, flush, query, assert, roll back',
    result: { text: 'real SQL, still isolated', tone: 'ok' },
    regions: [docker()],
    cards: [ctest(['finds_active_accounts()', 'rejects_duplicate_iban()'], { tone: 'ok' }), cctx(['shared by all tests'], { tone: 'ok' }), pg(['one container for the class', 'or for the whole build'], { tone: 'ok', badge: 'reused' })],
    arrows: [{ from: 'test', to: 'pg', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The tests run against it. Each runs in a transaction that rolls back, so they stay independent. Make the container static, or share it, so it starts once per class or once per build. In CI, Docker must be available.',
  },
];

export const SPRING_TESTING_SCENES = [
  { id: 'slices', label: 'Test slices', title: 'Load only as much of the application as the test needs', stage: BoardStage, frames: sliceFrames },
  { id: 'mockmvc', label: 'Testing a controller', title: 'Arrange, act, assert with MockMvc and a mocked service', stage: BoardStage, frames: mockmvcFrames },
  { id: 'containers', label: 'Testcontainers', title: 'Test against a real database started on demand', stage: BoardStage, frames: containerFrames },
];
