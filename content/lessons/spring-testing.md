---
title: Testing Spring Boot applications — unit tests, slices, MockMvc and Testcontainers
nav: Testing Spring apps
slug: spring-testing
summary: The testing pyramid for Spring Boot, plain unit tests with JUnit 5 and Mockito, test slices (@WebMvcTest, @DataJpaTest), @SpringBootTest, MockMvc, Testcontainers, test configuration and context caching, security and transaction testing, and contract tests, with Java examples and interview questions.
tags: [Spring, Testing, JUnit, Mockito, MockMvc, Testcontainers]
order: 90
topic: Spring / Production and quality
updated: 2026-11-26
subnav: true
---

Interviewers want to hear that you test at the right level. Expect:

- What is the difference between `@SpringBootTest` and `@WebMvcTest`?
- How do you mock a bean?
- How do you test a repository, and why not with H2?
- How do you keep tests fast?

The answer is the **test pyramid**, built with Spring's *test slices*. It builds on [Spring core](lesson:spring-core) (constructor injection makes unit tests easy), [Spring MVC](lesson:spring-mvc) (what a controller test covers), [Spring Data JPA](lesson:spring-data-jpa) and [transactions](lesson:spring-transactions).

The demo has three scenes: the test slices, testing a controller, and Testcontainers.

```demo
name: spring-testing-walk
```

> **One sentence to remember:** *Test each thing at the cheapest level that can prove it.*

In practice: business logic in fast plain unit tests, each layer's wiring in a slice test, repositories against a real database in a container, and only a few full `@SpringBootTest` runs for the end-to-end flows.

## The pyramid {#pyramid}

| Level | Tool | Speed | What it proves |
| --- | --- | --- | --- |
| **Unit** | JUnit 5, Mockito, AssertJ, no Spring. | Milliseconds. | The business logic in one class. |
| **Slice** | `@WebMvcTest`, `@DataJpaTest`, `@JsonTest`, `@RestClientTest`. | About a second. | One layer's wiring, mapping and configuration. |
| **Integration** | `@SpringBootTest`, Testcontainers. | Seconds. | Components working together with real infrastructure. |
| **Contract** | Spring Cloud Contract, Pact. | Seconds. | The provider and its consumers agree on the API. |
| **End to end** | A few tests through the deployed system. | Slowest. | The critical user journeys. |

Write many unit tests, fewer slice tests, and few integration tests. A test that needs the Spring context to check an `if` statement is testing at the wrong level.

## Unit tests {#unit}

Beans use **constructor injection**, so a unit test needs no container:

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

- The tools:
  - **JUnit 5**: `@Test`, `@ParameterizedTest`, `@Nested`, `@BeforeEach`.
  - **Mockito**: `@Mock`, `given`/`when`, `verify`, `ArgumentCaptor`.
  - **AssertJ**: `assertThat` and other fluent assertions.
- Mock the **boundaries**, such as repositories and clients. Do not mock the class under test, or simple value objects. Inject a `Clock` and ID generators, so the test controls time and randomness.
- Name tests by behaviour, and use the Arrange-Act-Assert shape.
- Assert outcomes rather than internal calls where you can. Verifying too many calls ties the test to the implementation.

## Slice tests {#slices}

A slice test starts a **partial** context. It contains only the beans one layer needs, plus the matching auto-configuration.

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

`@WebMvcTest` loads controllers, `@ControllerAdvice`, converters, filters and the security configuration. It does **not** load `@Service` or `@Repository` beans, so you must mock those dependencies.

`MockMvc` runs the full `DispatcherServlet` machinery (mapping, binding, validation, serialisation) without opening a port.

Test validation failures, error mapping and status codes here, not just the happy path.

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

`@DataJpaTest` loads only entities and repositories. Each test runs in a **transaction that rolls back** at the end.

Call `flush()` (and `clear()`) so the SQL really runs. Otherwise the test reads from the persistence context and proves nothing about the query.

Other slices:

- `@JsonTest` checks the shape of serialised JSON.
- `@RestClientTest` tests a client against a mock server.
- `@DataJdbcTest` and `@WebFluxTest` cover Spring Data JDBC and WebFlux.

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

`@SpringBootTest` loads the whole application. Its `webEnvironment` can be:

- `MOCK` (the default): no real server, use MockMvc.
- `RANDOM_PORT`: a real server. Call it with `TestRestTemplate`, `WebTestClient` or `RestClient`.
- `DEFINED_PORT` or `NONE`.

Use it for the main flows, and for things only the full context proves: the security configuration, filters, messaging wiring and migrations.

### Testcontainers instead of H2 {#testcontainers}

Embedded H2 differs from production in its SQL dialect, types, JSON support, locking, sequences and constraints. So tests can pass while production fails.

**Testcontainers** starts the real PostgreSQL, Kafka, Redis or RabbitMQ in Docker for the test.

- Since Boot 3.1, `@ServiceConnection` passes the container's address into the application automatically. Earlier code used `@DynamicPropertySource`.
- Make containers `static` (one per class), or share one across classes.
- Apply the real **Flyway** migrations with `ddl-auto=validate`, so the schema and the mappings are tested together.
- CI needs a Docker daemon.

## Configuration, mocks and speed {#config}

- **`@MockitoBean` / `@MockBean`** replaces a bean in the context with a Mockito mock. **`@SpyBean`** wraps the real bean instead. Each different combination of mocks and properties creates a **new cached context**, and many variants slow the build. Prefer one shared base configuration, with the mocks in a base class.
- **Context caching:** Spring reuses a context across tests that have the same configuration. `@DirtiesContext` throws it away and forces a restart, so avoid it.
- **Test configuration:** `@TestPropertySource`, `@ActiveProfiles("test")`, `@TestConfiguration` (extra beans for a test, such as a fixed `Clock`) and `@Import`.
- **Waiting for async work:** use **Awaitility**, as in `await().atMost(5, SECONDS).untilAsserted(...)`. Never use `Thread.sleep`.
- **Test data:** use builders or object mothers, not shared mutable fixtures. Reset state between tests with a transaction rollback, `@Sql`, or container reuse with cleanup.

### Transactions in tests {#tx}

`@Transactional` on a test (and `@DataJpaTest`) **rolls back after each test**. This keeps tests independent, but it can hide problems, because nothing is ever committed:

- `AFTER_COMMIT` listeners and the outbox do not fire,
- flush errors appear late, or never,
- lazy loading works, because the transaction stays open.

For flows that depend on a commit, make the test non-transactional (or use `@Commit`) and clean up yourself. See [Spring transactions](lesson:spring-transactions).

## Security and other areas {#security}

- **Spring Security:** use `@WithMockUser(roles = "ADMIN")` for a ready-made login, the `jwt()` or `opaqueToken()` post-processors from `SecurityMockMvcRequestPostProcessors`, and `csrf()` for form posts. Test that **an anonymous user gets 401 and the wrong role gets 403** ([Spring Security](lesson:spring-security)).
- **Messaging:** test consumers with Kafka or RabbitMQ in Testcontainers, or with an in-memory test binder. Check idempotency by delivering the same message twice ([messaging](lesson:messaging)).
- **External HTTP services:** **WireMock** or `MockRestServiceServer` stand in for the other system. Include failures and slow responses, to exercise timeouts and circuit breakers (see [Spring Cloud](lesson:spring-cloud)).
- **Contract tests:** Spring Cloud Contract or Pact check that a provider still gives its consumers what they expect, without deploying both.
- **Architecture tests:** ArchUnit rules, such as "no controller calls a repository" or "packages have no cycles".
- **Coverage is a guide, not a goal.** Mutation testing (PIT) shows whether your tests really detect changes.

Try it in the lab: [Test slices: load only what you need](lab:testing-slices-cost).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| Pyramid | Many unit tests, some slice tests, few integration and end-to-end tests. |
| Unit test | JUnit 5, Mockito and AssertJ, with constructor injection and no Spring. |
| `@WebMvcTest` | The web layer only, with `MockMvc`. Services are mocked with `@MockitoBean`. |
| `@DataJpaTest` | The JPA layer only, rolled back after each test, against a real database in Testcontainers. |
| `@SpringBootTest` | The whole application. `RANDOM_PORT` for real HTTP. |
| Testcontainers | Real PostgreSQL, Kafka and so on, wired with `@ServiceConnection` (Boot 3.1+). |
| Why not H2 | Its dialect and behaviour differ from production. |
| Context cache | The same configuration reuses the context. Many mocks or property sets slow the build. |
| `@DirtiesContext` | Forces a new context, so avoid it. |
| Async | Awaitility, not `sleep`. |
| Transactional tests | They roll back, which hides behaviour at commit time. |
| Security tests | `@WithMockUser` and `jwt()`. Check 401 and 403. |

## Interview questions {#questions}

### [basic] What is the difference between @SpringBootTest and @WebMvcTest? {#sbt-vs-web-q}

`@SpringBootTest` loads the entire application context: all beans, all auto-configuration, and optionally a real server. It is slow, but it tests everything together.

`@WebMvcTest` loads only the web layer (controllers, advice, converters, filters), with the services mocked. It is fast, and it focuses on request mapping, validation, serialisation and error handling.

### [basic] What is MockMvc? {#mockmvc-q}

It is a Spring test utility that sends requests through the Spring MVC machinery (`DispatcherServlet`, mappings, converters, validation, filters) without starting a server or opening a port.

You perform a request, then assert on the status, headers and body with `andExpect`. It is used with `@WebMvcTest` or `@AutoConfigureMockMvc`.

### [basic] What is the difference between @Mock and @MockBean (@MockitoBean)? {#mock-q}

`@Mock` (from Mockito) creates a mock object for a plain unit test, with no Spring.

`@MockBean` (replaced by `@MockitoBean` in Spring Boot 3.4+) creates a Mockito mock and **registers it in the Spring context**, replacing any bean of that type. Slice and integration tests can then inject the fake dependency.

### [basic] How do you unit test a service without Spring? {#unit-q}

Use constructor injection, so you can create the class with `new` (or `@InjectMocks`). Mock its collaborators with Mockito. Assert the results and the key interactions with AssertJ and `verify`.

No application context starts, so the test runs in milliseconds.

### [intermediate] What are test slices? {#slice-q}

They are annotations such as `@WebMvcTest`, `@DataJpaTest`, `@JsonTest` and `@RestClientTest`. Each one starts only the beans and auto-configuration for one layer.

They are faster than `@SpringBootTest`. They also catch wiring and configuration errors in that layer, which plain unit tests miss.

### [intermediate] Why use Testcontainers instead of H2? {#testcontainers-q}

H2 only imitates your database. Its SQL dialect, types, locking and functions differ, so queries, migrations and constraints can behave differently from production PostgreSQL or MySQL. Tests pass, and production breaks.

Testcontainers runs the real database (and brokers and caches) in Docker. Tests then exercise real behaviour, including Flyway migrations and native queries. The costs are needing Docker and a slightly slower start.

### [intermediate] How do you test a repository query? {#repository-q}

Use `@DataJpaTest` against a real database container:

1. Persist some test entities.
2. Call `flush()` and `clear()`, so the SQL runs and entities reload from the database.
3. Run the query and assert the result.

Test your derived and `@Query` methods, pagination and constraints (such as unique violations). Do not test Spring Data's own CRUD methods.

### [intermediate] Why can Spring tests be slow, and how do you speed them up? {#slow-q}

Starting contexts is expensive. To reduce the cost:

- write more plain unit tests and slice tests,
- share one cached context: avoid giving each test its own `@MockitoBean` or property combination, and avoid `@DirtiesContext`,
- reuse containers across classes,
- avoid `Thread.sleep` and use Awaitility,
- run tests in parallel where it is safe.

### [intermediate] How do you test Spring Security rules? {#security-q}

In a `@WebMvcTest` that imports the security configuration:

- use `@WithMockUser(roles = ...)` or the `jwt()` request post-processor,
- assert 401 with no credentials, 403 with the wrong role, and 200 with the right one,
- add `csrf()` for form requests that change state.

Test method security with a `@SpringBootTest`, or a slice that includes the proxies.

### [intermediate] What is the downside of @Transactional on tests? {#tx-test-q}

It rolls back after each test. That isolates tests, but hides behaviour that depends on a real commit:

- `AFTER_COMMIT` listeners and outbox relays do not run,
- constraint errors at flush time appear late, or never,
- lazy loading works, because the transaction is still open.

For flows that depend on a commit, run the test without a surrounding transaction and clean up the data yourself.

### [intermediate] How do you test asynchronous or event-driven code? {#async-q}

Do not sleep. Instead:

- use Awaitility to poll until an assertion holds, within a timeout,
- use a test executor or a latch where available,
- for messaging, use a real broker in Testcontainers, or an in-memory test binder.

Make consumers idempotent, and test the case where a message is delivered twice.

### [intermediate] How do you test calls to an external HTTP service? {#external-q}

Replace the service with a stub: WireMock, or `MockRestServiceServer` for `RestTemplate` and `RestClient` with `@RestClientTest`.

Make the stub return successes, error statuses, delays and malformed bodies. You can then check timeouts, retries, circuit-breaker fallbacks and error mapping without the real dependency.

Consumer-driven contract tests make sure the stubs match reality.

### [deep] What is context caching and what breaks it? {#cache-q}

The Spring TestContext framework keeps application contexts in a cache. The key is the full configuration: classes, profiles, properties, `@MockitoBean` definitions and initialisers. Tests with the same key share one context.

Different mocks, property overrides, `@DirtiesContext` or a `@TestPropertySource` per class each create a new key, and another startup. Gather the configuration into a few shared base classes.

### [deep] What are consumer-driven contract tests and why use them? {#contract-q}

The consumer writes down what it expects from an API (requests and responses) as a contract.

- The provider's build checks that it still satisfies every consumer's contract.
- Stubs generated from the contract let consumers test against the agreed behaviour.

This catches breaking changes between services that are deployed separately, without a shared end-to-end environment. Tools: Spring Cloud Contract and Pact.

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

Explain these points:

- The injected `Clock` makes time predictable.
- The constructor lets the test create the service with `new`.
- No Spring context is needed.

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

Explain these points:

- The service is mocked, so only the web layer is tested.
- Validation must reject the request before the service is called.
- The advice's exception mapping is part of the API contract, so it deserves a test.

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

Explain these points:

- A single shared container removes the startup cost for each class.
- Tests must clean up their own data.
- The shared base keeps the Spring configuration identical, so the context cache is reused too.
