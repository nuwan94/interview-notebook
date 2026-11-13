// Frame data for the Spring testing walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_TESTING_SCENES = [
  {
    id: 'slices',
    label: 'Test slices',
    title: 'Load only as much of the application as the test needs',
    frames: [
      {
        note: 'A plain unit test creates the class with new and passes mocks. No Spring at all, so it runs in milliseconds. This is where most business logic should be tested: many of these.',
        boxes: [b('t', 'Unit test', ['new TransferService(mockRepo, clock)', 'JUnit 5 + Mockito'], 'ok', 'milliseconds'), b('m', 'Mock bean', ['mockRepo returns canned data'], 'none')],
        deps: [d('Unit test', 'Mock bean', 'stub and verify', 'ok')],
      },
      {
        note: 'A web slice test (@WebMvcTest) starts a small Spring context with only the web layer: controllers, advice, JSON converters and validation. Services are replaced by mocks. MockMvc sends fake requests, with no server and no database.',
        boxes: [b('t', 'Web slice test', ['@WebMvcTest(AccountController.class)', 'MockMvc'], 'new', 'web layer only'), b('c', 'Controller', ['real controller + advice'], 'ok'), b('s', 'Mock service bean', ['@MockitoBean AccountService'], 'none')],
        deps: [d('Web slice test', 'Controller', 'mockMvc.perform(get)', 'ok'), d('Controller', 'Mock service bean', 'calls', 'ok')],
      },
      {
        note: 'A data slice test (@DataJpaTest) loads only the JPA layer: entities, repositories, a DataSource and Hibernate. It runs against a real database (Testcontainers) and rolls back after each test. It proves your queries and mappings, which mocks cannot.',
        boxes: [b('t', 'Data slice test', ['@DataJpaTest', 'transactional, rolled back'], 'new', 'JPA layer only'), b('r', 'Repository bean', ['real repositories'], 'ok'), b('d', 'Database', ['PostgreSQL in a container'], 'ok', 'real SQL')],
        deps: [d('Data slice test', 'Repository bean', 'save and query', 'ok'), d('Repository bean', 'Database', 'SQL', 'ok')],
      },
      {
        note: 'A full integration test (@SpringBootTest) starts the whole application context, often with a random port and a real HTTP client. It proves the wiring, configuration and security end to end, but it is slower, so write few of them for the main flows.',
        boxes: [b('t', 'Full integration test', ['@SpringBootTest(webEnvironment = RANDOM_PORT)', 'TestRestTemplate or WebTestClient'], 'new', 'everything'), b('a', 'Application context', ['all beans, auto-configuration, security'], 'ok'), b('d', 'Database', ['real database container'], 'ok')],
        deps: [d('Full integration test', 'Application context', 'HTTP request', 'ok'), d('Application context', 'Database', 'SQL', 'ok')],
      },
      {
        note: 'Spring caches an application context between tests that have the same configuration, so the startup cost is paid once. Using @MockitoBean or different properties in many tests creates many different contexts and slows the build. Keep configurations few and consistent.',
        boxes: [b('a', 'Application context', ['cached by configuration key', 'reused by tests with the same setup'], 'ok', 'cache hit'), b('t', 'Full integration test', ['new @MockitoBean = new context'], 'warn', 'cache miss')],
        deps: [],
      },
    ],
  },
  {
    id: 'mockmvc',
    label: 'Testing a controller',
    title: 'Arrange, act, assert with MockMvc and a mocked service',
    frames: [
      {
        note: 'Arrange: the service is a mock, so the test controls what it returns. Here the account 42 exists with a balance of 100. No database is involved.',
        boxes: [b('t', 'Web slice test', ['given(service.find(42)).willReturn(dto)'], 'new', 'arrange'), b('s', 'Mock service bean', ['find(42) returns AccountDto(42, 100)'], 'ok')],
        deps: [d('Web slice test', 'Mock service bean', 'stub', 'ok')],
      },
      {
        note: 'Act: MockMvc performs GET /api/accounts/42 through the real DispatcherServlet infrastructure: mapping, argument binding, the controller, and JSON serialisation. No port is opened.',
        boxes: [b('t', 'Web slice test', ['mockMvc.perform(get("/api/accounts/42"))'], 'new', 'act'), b('c', 'Controller', ['AccountController.get(42)'], 'ok'), b('s', 'Mock service bean', ['find(42) called once'], 'ok')],
        deps: [d('Web slice test', 'Controller', 'GET request', 'ok'), d('Controller', 'Mock service bean', 'find(42)', 'ok')],
      },
      {
        note: 'Assert: check the status, the content type and the JSON fields. Then verify the interaction. Assert on observable behaviour (the response), not on private details, so refactoring does not break the test.',
        boxes: [b('t', 'Web slice test', ['status().isOk()', 'jsonPath("$.balance").value(100)', 'verify(service).find(42)'], 'ok', 'assert')],
        deps: [],
      },
      {
        note: 'Error paths matter too: stub the service to throw AccountNotFoundException and assert a 404 with a ProblemDetail body. This proves the @RestControllerAdvice mapping works, which a unit test of the controller alone cannot.',
        boxes: [b('s', 'Mock service bean', ['willThrow(AccountNotFoundException)'], 'warn'), b('c', 'Controller', ['advice maps it'], 'ok'), b('t', 'Web slice test', ['status().isNotFound()', 'content type problem+json'], 'ok', 'error path')],
        deps: [d('Mock service bean', 'Controller', 'exception', 'warn'), d('Controller', 'Web slice test', '404', 'ok')],
      },
    ],
  },
  {
    id: 'containers',
    label: 'Testcontainers',
    title: 'Test against a real database started on demand',
    frames: [
      {
        note: 'H2 behaves differently from PostgreSQL (types, locking, SQL dialect, JSON, sequences), so tests can pass on H2 and fail in production. Testcontainers runs the real database in a Docker container for the test.',
        boxes: [b('t', 'Data slice test', ['@Testcontainers', '@Container PostgreSQLContainer'], 'new'), b('x', 'Postgres container', ['postgres:16 image', 'starts on a random port'], 'ok', 'real database')],
        deps: [d('Data slice test', 'Postgres container', 'start', 'ok')],
      },
      {
        note: '@ServiceConnection (Spring Boot 3.1 and later) reads the container address and creates the DataSource properties automatically. Older code uses @DynamicPropertySource to set spring.datasource.url. No hard-coded ports.',
        boxes: [b('x', 'Postgres container', ['jdbc:postgresql://localhost:55012/test'], 'ok'), b('a', 'Application context', ['@ServiceConnection', 'DataSource wired to the container'], 'ok', 'auto-wired')],
        deps: [d('Postgres container', 'Application context', 'connection details', 'ok')],
      },
      {
        note: 'On startup Flyway applies the real migrations to the empty database, so the test also verifies that the migration scripts and the entity mappings agree (ddl-auto=validate).',
        boxes: [b('f', 'Config: Flyway migrations', ['V1__create_account.sql', 'V2__add_ledger.sql'], 'ok', 'applied'), b('x', 'Postgres container', ['schema created'], 'ok')],
        deps: [d('Config: Flyway migrations', 'Postgres container', 'migrate', 'ok')],
      },
      {
        note: 'Tests run against it, each in a transaction that rolls back so they stay independent. Make the container static or reuse it so it starts once per test class (or once per build) instead of per test. In CI the Docker daemon must be available.',
        boxes: [b('t', 'Data slice test', ['save, query, assert', 'rollback after each test'], 'ok', 'isolated'), b('x', 'Postgres container', ['shared by all tests in the class'], 'ok', 'reused')],
        deps: [d('Data slice test', 'Postgres container', 'SQL', 'ok')],
      },
    ],
  },
];
