---
title: Testing Spring Boot applications — unit tests, slices, MockMvc and Testcontainers
nav: Testing Spring apps
slug: spring-testing
summary: The testing pyramid for Spring Boot, plain unit tests with JUnit 5 and Mockito, test slices (@WebMvcTest, @DataJpaTest), @SpringBootTest, MockMvc, Testcontainers, test configuration and context caching, security and transaction testing, and contract tests, with Java examples and interview questions.
tags: [Spring, Testing, JUnit, Mockito, MockMvc, Testcontainers]
order: 55
topic: Spring / Production and quality
updated: 2026-11-13
subnav: true
---

Interviewers want to hear that you test at the right level: *what is the difference between `@SpringBootTest` and `@WebMvcTest`, how do you mock a bean, how do you test a repository, why not H2, and how do you keep tests fast?* The answer is the **test pyramid** with Spring's slices. It builds on [Spring core](lesson:spring-core) (constructor injection makes unit tests trivial), [Spring MVC](lesson:spring-mvc) (what a controller test exercises), [Spring Data JPA](lesson:spring-data-jpa) and [transactions](lesson:spring-transactions). Play the three scenes: the test slices, testing a controller, and Testcontainers.

```demo
name: spring-testing-walk
```

> **One sentence to remember:** *test business logic with fast plain unit tests, use slice tests for each layer's wiring, run repositories against a real database in a container, and keep full `@SpringBootTest` runs for a few end-to-end flows.*

## The pyramid {#pyramid}

| Level | Tool | Speed | What it proves |
| --- | --- | --- | --- |
| **Unit** | JUnit 5, Mockito, AssertJ, no Spring | milliseconds | business logic in one class |
| **Slice** | `@WebMvcTest`, `@DataJpaTest`, `@JsonTest`, `@RestClientTest` | about a second | one layer's wiring, mapping and configuration |
| **Integration** | `@SpringBootTest`, Testcontainers | seconds | components together with real infrastructure |
| **Contract** | Spring Cloud Contract, Pact | seconds | provider and consumer agree on the API |
| **End to end** | few, through the deployed system | slowest | critical user journeys |

Many unit tests, fewer slices, few integration tests. A test that needs the Spring context to check an `if` statement is testing at the wrong level.

## Unit tests {#unit}

Because beans use **constructor injection**, a unit test needs no container:

```java
@ExtendWith(MockitoExtension.class)
class TransferServiceTest {

    @Mock AccountRepository accounts;
    @Mock Clock clock;
    @InjectMocks TransferService service;

    @Test
    void rejects_transfer_when_balance_is_too_low() {
        given(accounts.findById(1L)).willReturn(Optional.of(new Account(1L, new BigDecimal("50"))));

        assertThatThrownBy(() -> service.transfer(1L, 2L, new BigDecimal("80")))
                .isInstanceOf(InsufficientFundsException.class);

        verify(accounts, never()).save(any());
    }
}
```

- **JUnit 5** (`@Test`, `@ParameterizedTest`, `@Nested`, `@BeforeEach`), **Mockito** (`@Mock`, `given/when`, `verify`, `ArgumentCaptor`), **AssertJ** (`assertThat`, fluent assertions).
- Mock the **boundaries** (repositories, clients), not the class under test or simple value objects. Inject a `Clock` and ID generators so time and randomness are controllable.
- Name tests by behaviour, use the Arrange-Act-Assert shape, and assert outcomes rather than internal calls where possible; over-verifying couples the test to the implementation.

## Slice tests {#slices}

A slice test starts a **partial** context with only the beans a layer needs, plus matching auto-configuration.

### Web layer {#webmvc}

```java
@WebMvcTest(AccountController.class)
class AccountControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean AccountService service;                     // Spring Boot 3.4+ (was @MockBean)

    @Test
    void returns_the_account() throws Exception {
        given(service.find(42L)).willReturn(new AccountDto(42L, "SG123", new BigDecimal("100")));

        mvc.perform(get("/api/accounts/42"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.balance").value(100));
    }

    @Test
    void maps_missing_account_to_404() throws Exception {
        given(service.find(7L)).willThrow(new AccountNotFoundException(7L));

        mvc.perform(get("/api/accounts/7"))
           .andExpect(status().isNotFound())
           .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void rejects_an_invalid_body() throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON).content("{\"iban\":\"\"}"))
           .andExpect(status().isBadRequest());
    }
}
```

`@WebMvcTest` loads controllers, `@ControllerAdvice`, converters, filters and security configuration, **not** `@Service` or `@Repository` beans, so dependencies must be mocked. `MockMvc` runs the full `DispatcherServlet` machinery (mapping, binding, validation, serialisation) without opening a port. Test validation failures, error mapping and status codes here, not just the happy path.

### Data layer {#datajpa}

```java
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)    // use the real database, not embedded H2
class AccountRepositoryTest {

    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired AccountRepository repository;
    @Autowired TestEntityManager em;

    @Test
    void finds_active_accounts_by_customer() {
        em.persist(new Account("SG1", 7L, Status.ACTIVE));
        em.persist(new Account("SG2", 7L, Status.CLOSED));
        em.flush(); em.clear();                                        // force SQL, then reload from the database

        assertThat(repository.findByCustomerIdAndStatus(7L, Status.ACTIVE)).extracting(Account::getIban).containsExactly("SG1");
    }
}
```

`@DataJpaTest` loads entities and repositories only, and each test runs in a **transaction that rolls back**. Call `flush()` (and `clear()`) so the SQL really executes: otherwise the test reads from the persistence context and proves nothing about the query. Other slices: `@JsonTest` (serialisation shapes), `@RestClientTest` (a client against a mock server), `@DataJdbcTest`, `@WebFluxTest`.

## Integration tests {#integration}

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class TransferFlowIT {

    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired TestRestTemplate rest;

    @Test
    void transfers_money_end_to_end() {
        var response = rest.postForEntity("/api/transfers", new TransferRequest(1L, 2L, new BigDecimal("25")), TransferDto.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }
}
```

`@SpringBootTest` loads the whole application. `webEnvironment`: `MOCK` (default, MockMvc), `RANDOM_PORT` (real server, use `TestRestTemplate`, `WebTestClient` or `RestClient`), `DEFINED_PORT`, `NONE`. Use it for the main flows and for things only the full context proves (security configuration, filters, messaging wiring, migrations).

### Testcontainers instead of H2 {#testcontainers}

Embedded H2 differs from production (SQL dialect, types, JSON, locking, sequences, constraints), so tests can pass while production fails. **Testcontainers** starts the real PostgreSQL, Kafka, Redis or RabbitMQ in Docker for the test. Since Boot 3.1 `@ServiceConnection` wires the container's address into the application automatically (earlier: `@DynamicPropertySource`). Make containers `static` (one per class) or share one across classes, and apply real **Flyway** migrations with `ddl-auto=validate` so schema and mappings are tested together. CI needs a Docker daemon.

## Configuration, mocks and speed {#config}

- **`@MockitoBean` / `@MockBean`** replaces a bean in the context with a Mockito mock; **`@SpyBean`** wraps the real one. Each distinct combination of mocks and properties creates a **new cached context**, so many variants slow the build: prefer one shared base configuration, and put mocks in a base class.
- **Context caching:** Spring reuses a context across tests with the same configuration. `@DirtiesContext` discards it (and costs a restart): avoid it.
- **`@TestPropertySource`, `@ActiveProfiles("test")`**, `@TestConfiguration` (extra beans for a test, such as a fixed `Clock`) and `@Import`.
- **Awaiting async work:** use **Awaitility** (`await().atMost(5, SECONDS).untilAsserted(...)`), never `Thread.sleep`.
- **Test data:** builders or object mothers, not shared mutable fixtures; reset state between tests (transaction rollback, `@Sql`, container reuse with cleanup).

### Transactions in tests {#tx}

`@Transactional` on a test (or `@DataJpaTest`) **rolls back after each test**, which keeps them independent but can hide problems: nothing is committed, so `AFTER_COMMIT` listeners and the outbox do not fire, flush errors appear late, and lazy loading works because the transaction stays open. For flows that depend on commit, make the test non-transactional (or `@Commit`) and clean up explicitly. See [Spring transactions](lesson:spring-transactions).

## Security and other areas {#security}

- **Spring Security:** `@WithMockUser(roles = "ADMIN")` for a ready authentication, `jwt()` or `opaqueToken()` post-processors from `SecurityMockMvcRequestPostProcessors`, `csrf()` for form posts; test that **unauthenticated gets 401, wrong role gets 403** ([Spring Security](lesson:spring-security)).
- **Messaging:** test consumers with Testcontainers Kafka/RabbitMQ or an in-memory test binder, assert idempotency by delivering the same message twice ([messaging](lesson:messaging)).
- **External HTTP services:** **WireMock** or `MockRestServiceServer` stub the other system, including failures and slow responses (to exercise timeouts and circuit breakers, see [Spring Cloud](lesson:spring-cloud)).
- **Contract tests:** Spring Cloud Contract or Pact verify that a provider still satisfies what its consumers expect, without deploying both.
- **Architecture tests:** ArchUnit rules (no controller calls a repository, packages free of cycles).
- **Coverage is a guide, not a goal:** mutation testing (PIT) shows whether tests really detect changes.

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Pyramid | many unit, some slice, few integration and end-to-end |
| Unit test | JUnit 5 + Mockito + AssertJ, constructor injection, no Spring |
| `@WebMvcTest` | web layer only, `MockMvc`, services mocked with `@MockitoBean` |
| `@DataJpaTest` | JPA layer only, transactional rollback, real DB with Testcontainers |
| `@SpringBootTest` | whole application; `RANDOM_PORT` for real HTTP |
| Testcontainers | real PostgreSQL, Kafka and so on; `@ServiceConnection` (Boot 3.1+) |
| Why not H2 | dialect and behaviour differ from production |
| Context cache | same config reuses the context; many mocks or properties slow the build |
| `@DirtiesContext` | forces a new context: avoid |
| Async | Awaitility, not `sleep` |
| Transactional tests | roll back: hide commit-time behaviour |
| Security tests | `@WithMockUser`, `jwt()`; 401 vs 403 |

## Interview questions {#questions}

### [basic] What is the difference between @SpringBootTest and @WebMvcTest? {#sbt-vs-web-q}

`@SpringBootTest` loads the entire application context (all beans, auto-configuration, optionally a real server), so it is slow but tests everything together. `@WebMvcTest` loads only the web layer (controllers, advice, converters, filters) with services mocked, so it is fast and focused on request mapping, validation, serialisation and error handling.

### [basic] What is MockMvc? {#mockmvc-q}

A Spring test utility that sends requests through the Spring MVC infrastructure (`DispatcherServlet`, mappings, converters, validation, filters) without starting a server or opening a port. You perform a request and assert on status, headers and body with `andExpect`. It is used with `@WebMvcTest` or `@AutoConfigureMockMvc`.

### [basic] What is the difference between @Mock and @MockBean (@MockitoBean)? {#mock-q}

`@Mock` (Mockito) creates a mock object for a plain unit test with no Spring. `@MockBean` (replaced by `@MockitoBean` in Spring Boot 3.4+) creates a Mockito mock and **registers it in the Spring context**, replacing any bean of that type, so slice and integration tests can inject a fake dependency.

### [basic] How do you unit test a service without Spring? {#unit-q}

Use constructor injection so the class can be created with `new` (or `@InjectMocks`), mock its collaborators with Mockito, and assert results and key interactions with AssertJ and `verify`. No application context is started, so the test runs in milliseconds.

### [intermediate] What are test slices? {#slice-q}

Annotations such as `@WebMvcTest`, `@DataJpaTest`, `@JsonTest` and `@RestClientTest` that start only the beans and auto-configuration relevant to one layer. They are faster than `@SpringBootTest`, and they catch layer-specific wiring and configuration errors that plain unit tests miss.

### [intermediate] Why use Testcontainers instead of H2? {#testcontainers-q}

H2 emulates a database with a different SQL dialect, type system, locking and function set, so queries, migrations and constraints can behave differently from production PostgreSQL or MySQL; tests pass and production breaks. Testcontainers runs the real database (and brokers, caches) in Docker, so tests exercise real behaviour, including Flyway migrations and native queries, at the cost of needing Docker and slightly slower startup.

### [intermediate] How do you test a repository query? {#repository-q}

With `@DataJpaTest` against a real database container: persist test entities, call `flush()` and `clear()` so the SQL executes and entities reload from the database, then assert the result. Test derived and `@Query` methods, pagination and constraints (unique violations), not Spring Data's own CRUD.

### [intermediate] Why can Spring tests be slow, and how do you speed them up? {#slow-q}

Starting contexts is expensive. Reduce by writing more plain unit tests and slices, sharing one cached context (avoid distinct `@MockitoBean` or property combinations per test and `@DirtiesContext`), reusing containers across classes, avoiding `Thread.sleep` (use Awaitility), and running tests in parallel where safe.

### [intermediate] How do you test Spring Security rules? {#security-q}

In a `@WebMvcTest` with the security configuration imported, use `@WithMockUser(roles = ...)` or the `jwt()` request post-processor, and assert 401 without credentials, 403 with the wrong role and 200 with the right one; add `csrf()` for state-changing form requests. Test method security with a `@SpringBootTest` or slice that includes the proxies.

### [intermediate] What is the downside of @Transactional on tests? {#tx-test-q}

It rolls back after each test, which isolates tests but hides behaviour that depends on a real commit: `AFTER_COMMIT` listeners and outbox relays do not run, flush-time constraint errors surface late or never, and lazy loading works because the transaction is still open. For commit-dependent flows run the test without a surrounding transaction and clean data explicitly.

### [intermediate] How do you test asynchronous or event-driven code? {#async-q}

Do not sleep. Use Awaitility to poll until an assertion holds within a timeout, use a test executor or a latch where available, and for messaging use a real broker in Testcontainers or an in-memory test binder. Make consumers idempotent and test the duplicate-delivery case.

### [intermediate] How do you test calls to an external HTTP service? {#external-q}

Stub it with WireMock (or `MockRestServiceServer` for `RestTemplate`/`RestClient` and `@RestClientTest`), returning success, error statuses, delays and malformed bodies, so you can verify timeouts, retries, circuit breaker fallbacks and error mapping without the real dependency. Consumer-driven contract tests make sure the stubs match reality.

### [deep] What is context caching and what breaks it? {#cache-q}

The Spring TestContext framework keeps application contexts in a cache keyed by the full configuration (classes, profiles, properties, `@MockitoBean` definitions, initialisers). Tests with the same key share a context. Different mocks, property overrides, `@DirtiesContext` or `@TestPropertySource` per class produce many keys and many startups. Consolidate configuration into a few shared bases.

### [deep] What are consumer-driven contract tests and why use them? {#contract-q}

The consumer states what it expects from an API (requests and responses) as a contract; the provider's build verifies it still satisfies every consumer contract, and stubs generated from the contract let consumers test against the agreed behaviour. It catches breaking changes between independently deployed services without a shared end-to-end environment (Spring Cloud Contract, Pact).

### [coding] Test a service that depends on time and a repository. {#coding-unit}

```java
@Service
class FeeService {
    private final AccountRepository accounts;
    private final Clock clock;
    FeeService(AccountRepository accounts, Clock clock) { this.accounts = accounts; this.clock = clock; }

    BigDecimal monthlyFee(long id) {
        Account a = accounts.findById(id).orElseThrow();
        return LocalDate.now(clock).getDayOfWeek() == DayOfWeek.SATURDAY ? BigDecimal.ZERO : a.getTier().fee();
    }
}

@ExtendWith(MockitoExtension.class)
class FeeServiceTest {
    @Mock AccountRepository accounts;

    @Test
    void waives_the_fee_on_saturdays() {
        Clock saturday = Clock.fixed(Instant.parse("2026-11-14T10:00:00Z"), ZoneOffset.UTC);
        given(accounts.findById(1L)).willReturn(Optional.of(new Account(1L, Tier.GOLD)));

        assertThat(new FeeService(accounts, saturday).monthlyFee(1L)).isZero();
    }
}
```

Explain that the injected `Clock` makes time deterministic, the constructor allows `new` in the test, and no Spring context is needed.

### [coding] Write a MockMvc test for validation and error mapping. {#coding-mockmvc}

```java
@WebMvcTest(TransferController.class)
class TransferControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean TransferService service;

    @Test
    void bad_amount_returns_400_with_field_errors() throws Exception {
        mvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"from":"SG1","to":"SG2","amount":-5}
                        """))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.errors.amount").exists());
        verifyNoInteractions(service);
    }

    @Test
    void insufficient_funds_returns_422() throws Exception {
        willThrow(new InsufficientFundsException("SG1")).given(service).transfer(any());
        mvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON)
                .content("{\"from\":\"SG1\",\"to\":\"SG2\",\"amount\":500}"))
           .andExpect(status().isUnprocessableEntity());
    }
}
```

Explain that the service is mocked so only the web layer is tested, validation must reject before the service is called, and exception mapping in the advice is part of the contract.

### [coding] Share one PostgreSQL container across integration tests. {#coding-shared}

```java
abstract class AbstractIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    static { POSTGRES.start(); }                    // started once for the whole test run, stopped by Ryuk at JVM exit
}

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TransferFlowIT extends AbstractIntegrationTest { ... }

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AccountFlowIT extends AbstractIntegrationTest { ... }
```

Explain that a singleton container removes per-class startup cost, tests must clean their own data, and the shared base keeps the Spring context configuration identical so the context cache is reused too.
