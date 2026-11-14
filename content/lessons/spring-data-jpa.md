---
title: Spring Data JPA and Hibernate — entities, repositories, fetching and the persistence context
nav: Spring Data JPA
slug: spring-data-jpa
summary: How Spring Data repositories, JPA and Hibernate fit together, entity mapping and relationships, the persistence context and entity states, lazy loading, the N+1 problem, queries, projections, pagination and locking, with Java examples and interview questions.
tags: [Spring, JPA, Hibernate, Spring Data, ORM, Database]
order: 44
topic: Spring / Data
updated: 2026-11-13
subnav: true
---

For a Spring Boot role the persistence round is almost certain: *what is the difference between JPA, Hibernate and Spring Data JPA, how do entity states and the persistence context work, what is the N+1 problem, why do I get `LazyInitializationException`, and how do you do pagination and locking?* It builds on [Spring Boot](lesson:spring-boot) (auto-configured `DataSource` and `EntityManager`), [AOP](lesson:spring-aop) (repository and `@Transactional` proxies), [normalization](lesson:normalization) (the schema you map) and [ACID and BASE](lesson:acid-base) (transactions, locking). Play the three scenes: entity states, the N+1 problem, and the lazy-loading error.

```demo
name: spring-jpa-walk
```

> **One sentence to remember:** *JPA is the standard, Hibernate is the implementation, Spring Data removes the repository boilerplate; inside a transaction the persistence context tracks your entities and writes changes at flush, so understand its states and fetching.*

## The stack {#stack}

| Layer | Role |
| --- | --- |
| **JDBC** | low-level API: connections, statements, result sets |
| **JPA** (Jakarta Persistence) | the **specification**: annotations (`@Entity`), `EntityManager`, JPQL |
| **Hibernate** | the most common JPA **implementation** (also its own API: `Session`, caching, extra features) |
| **Spring Data JPA** | generates repository implementations on top of JPA; query derivation, paging, auditing |
| **HikariCP** | the connection pool Boot configures |

Spring Boot's `spring-boot-starter-data-jpa` wires all of it. **ORM** (object-relational mapping) maps classes to tables and rows to objects, saving boilerplate at the price of hidden SQL and the **object-relational impedance mismatch** (graphs of objects versus tables with joins).

## Mapping entities {#mapping}

### Entities {#entities}

```java
@Entity
@Table(name = "account")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)       // or SEQUENCE (PostgreSQL, Oracle)
    private Long id;

    @Column(nullable = false, unique = true, length = 34)
    private String iban;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance;

    @Enumerated(EnumType.STRING)                               // never ORDINAL: reordering breaks data
    private Status status;

    @Version
    private Long version;                                      // optimistic locking

    protected Account() {}                                     // JPA needs a no-arg constructor
}
```

- Money is `BigDecimal` (never `double`), enums are stored as `STRING`, time as `Instant` or `LocalDateTime`.
- **ID generation:** `IDENTITY` (database auto-increment: simple, but disables JDBC insert batching because the id comes from the insert), `SEQUENCE` (preferred where available: ids pre-allocated in blocks, batching works), `UUID`, or assigned.
- **Embeddables** (`@Embedded`, `@Embeddable`) group columns into a value object (`Money`, `Address`).
- Keep entities out of the API layer: expose **DTOs**.

### Relationships {#relationships}

```java
@Entity
class Customer {
    @Id @GeneratedValue Long id;

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Account> accounts = new ArrayList<>();

    void addAccount(Account a) { accounts.add(a); a.setCustomer(this); }      // keep both sides in sync
}

@Entity
class Account {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")                                          // owning side holds the foreign key
    private Customer customer;
}
```

| Concept | Meaning |
| --- | --- |
| **Owning side** | the side with the foreign key (`@ManyToOne`, `@JoinColumn`); the other side uses `mappedBy` |
| **Cascade** | propagate operations (persist, merge, remove) to children; `ALL` for true compositions only |
| **orphanRemoval** | delete a child removed from the parent's collection |
| **Fetch type** | `LAZY` (load on first access) or `EAGER` (load with the parent) |
| Defaults | `@ManyToOne`, `@OneToOne` are **EAGER**; `@OneToMany`, `@ManyToMany` are **LAZY** |

Practice: make every association `LAZY` (set `@ManyToOne(fetch = LAZY)`), fetch what you need per query, prefer `Set` or `List` carefully for `@ManyToMany` (and model the join as its own entity when it has attributes), avoid bidirectional associations unless needed, and never use `CascadeType.REMOVE` on shared references.

### equals and hashCode {#equals}

Entities live in collections and the persistence context, so identity matters. Do not use all fields (they change, and lazy proxies break it). Use a stable **business key** (the IBAN) or the id with a null-safe check, and implement `equals` with `instanceof` (proxies are subclasses), `hashCode` as a constant or based on the business key.

## The persistence context {#context}

### Entity states and flush {#states}

The **persistence context** (first-level cache, one per `EntityManager`, normally one per transaction) is a map of entities by id that Hibernate tracks.

| State | Meaning |
| --- | --- |
| **Transient (new)** | created with `new`, not known to the context, no row |
| **Managed (persistent)** | tracked by the context; changes are detected and written |
| **Detached** | has an id but the context is closed; changes are ignored |
| **Removed** | scheduled for deletion at flush |

- **Dirty checking:** at **flush** Hibernate compares each managed entity with its loaded snapshot and issues `UPDATE` for changes. Inside a transaction you usually do not call `save()` for updates: modify the managed entity.
- **Flush** happens at commit, before a JPQL query that could be affected (`FlushModeType.AUTO`), or on an explicit `flush()`. SQL runs at flush, not at the Java call.
- **First-level cache:** `findById` twice in one context returns the same instance with one query. It is per transaction, not shared; the **second-level cache** (optional, shared) is a separate feature.
- `save()` on a new entity persists; on an entity with an id it calls `merge` (loads and copies state, returning the managed instance).

### Lazy loading {#lazy}

A lazy association is a **proxy placeholder** that loads on first access, which requires an open persistence context. Access after the transaction ends throws **`LazyInitializationException`**. Remedies: fetch inside the transaction (fetch join, entity graph), return DTOs from the service, or map inside the transaction. `spring.jpa.open-in-view=true` (Boot default) keeps the session open through the web layer, which hides the problem but holds a connection per request and allows queries in views; many teams switch it off.

### The N+1 problem {#n-plus-one}

Loading N parents and then lazily loading each one's children runs 1 + N queries. Fixes:

```java
@Query("select distinct c from Customer c left join fetch c.accounts where c.status = :status")
List<Customer> findWithAccounts(@Param("status") Status status);          // fetch join: one query

@EntityGraph(attributePaths = "accounts")                                    // same without writing JPQL
List<Customer> findByStatus(Status status);

// batch fetching for paged lists, in properties:
// spring.jpa.properties.hibernate.default_batch_fetch_size=50
```

- Fetching a **collection** with `join fetch` multiplies parent rows and cannot be combined with pagination in the database (Hibernate pages in memory and warns). Page the parent ids first, or use batch fetching.
- Never fetch two `List` collections in one query (`MultipleBagFetchException`, plus a cartesian product).
- Detect it: `spring.jpa.show-sql` or `logging.level.org.hibernate.SQL=DEBUG`, statement counting in tests, or Hibernate statistics.

## Spring Data repositories {#repositories}

### Repository interfaces {#repo}

```java
public interface AccountRepository extends JpaRepository<Account, Long> {

    Optional<Account> findByIban(String iban);                               // derived query
    List<Account> findByCustomerIdAndStatusOrderByBalanceDesc(Long customerId, Status status);
    boolean existsByIban(String iban);
    long countByStatus(Status status);

    @Query("select a from Account a where a.balance > :min")                 // JPQL
    List<Account> richerThan(@Param("min") BigDecimal min);

    @Query(value = "select * from account where status = ?1", nativeQuery = true)
    List<Account> findNative(String status);

    @Modifying
    @Query("update Account a set a.status = :s where a.lastActivity < :before")
    int deactivateOlderThan(@Param("s") Status s, @Param("before") Instant before);   // bulk update bypasses the context
}
```

| Interface | Adds |
| --- | --- |
| `Repository` | marker |
| `CrudRepository` | save, findById, findAll, delete, count |
| `PagingAndSortingRepository` | `findAll(Pageable)`, `findAll(Sort)` |
| `JpaRepository` | flush, `saveAllAndFlush`, batch deletes, `getReferenceById` |

Spring creates the implementation as a **proxy** at startup: derived methods are parsed from the name (`findBy`, `existsBy`, `countBy`, `And`, `Or`, `OrderBy`, `Top`, `Between`, `In`, `IgnoreCase`) and fail at startup if a property does not exist. Repositories are `@Transactional` for you: reads `readOnly`, writes in a transaction.

**Bulk `@Modifying` queries** run directly in SQL and **do not update the persistence context**: entities already loaded become stale (`clearAutomatically = true` clears it).

### Projections {#projections}

Select only what you need instead of full entities:

```java
interface AccountSummary { String getIban(); BigDecimal getBalance(); }          // interface projection
record AccountView(String iban, BigDecimal balance) {}                            // class (DTO) projection

List<AccountSummary> findByStatus(Status status);
@Query("select new com.bank.AccountView(a.iban, a.balance) from Account a where a.status = :s")
List<AccountView> views(@Param("s") Status s);
```

### Pagination {#paging}

```java
Page<Account> page = repository.findByStatus(Status.ACTIVE, PageRequest.of(0, 20, Sort.by("createdAt").descending()));
// page.getContent(), page.getTotalElements(), page.getTotalPages()
```

| | `Page` | `Slice` | Keyset (seek) |
| --- | --- | --- | --- |
| Extra count query | yes | no (fetches size + 1) | no |
| Knows total | yes | no | no |
| Deep pages | slow (`OFFSET` scans skipped rows) | slow | fast (`WHERE id < :last ORDER BY id DESC LIMIT n`) |

Always sort by a **unique, stable** column so pages do not overlap, and use keyset pagination for large or infinite lists.

## Transactions and locking {#tx}

Put `@Transactional` on **service** methods (the unit of business work), not on repositories. `readOnly = true` lets Hibernate skip dirty checking and the driver optimise. Concurrency is handled with `@Version` (optimistic locking; retry on `ObjectOptimisticLockingFailureException`) or `@Lock(PESSIMISTIC_WRITE)` (`SELECT ... FOR UPDATE`), covered with examples in [ACID and BASE](lesson:acid-base#jpa-locks). Propagation, rollback rules and pitfalls are in [Spring transactions](lesson:spring-transactions).

## Practical points {#practical}

- **Schema management:** use **Flyway** or **Liquibase** migrations, `spring.jpa.hibernate.ddl-auto=validate` (or `none`) in production, never `update` or `create`.
- **Batching inserts:** `spring.jpa.properties.hibernate.jdbc.batch_size=50`, `order_inserts=true`, and a `SEQUENCE` id strategy; `IDENTITY` disables batching. For millions of rows use `JdbcTemplate` batch, `COPY` or Spring Batch.
- **Auditing:** `@EnableJpaAuditing` with `@CreatedDate`, `@LastModifiedDate`, `@CreatedBy` on a `@MappedSuperclass`.
- **Soft delete, multi-tenancy, specifications** (`JpaSpecificationExecutor`) for dynamic filters, and **Querydsl** or **jOOQ** when queries get complex.
- **When not to use JPA:** reporting and heavy set-based SQL are clearer with native SQL, `JdbcTemplate` or jOOQ. JPA suits aggregates read and written as objects.
- **Test with a real database** (Testcontainers) rather than H2 when you use vendor features.

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| JPA, Hibernate, Spring Data | specification, implementation, repository abstraction |
| Entity states | transient, managed, detached, removed |
| Dirty checking | managed entities are updated at flush without `save()` |
| Flush | at commit, before affected queries, or explicitly |
| Defaults | `@ManyToOne` eager, `@OneToMany` lazy; prefer lazy everywhere |
| Owning side | the side with the foreign key; `mappedBy` on the other |
| `LazyInitializationException` | lazy access after the context closed; fetch in the transaction or use DTOs |
| N+1 | fetch join, `@EntityGraph`, batch fetch, projections |
| IDs | `SEQUENCE` enables batching, `IDENTITY` does not |
| Bulk `@Modifying` | bypasses the context; clear it |
| Pagination | `Page` counts, `Slice` does not, keyset for deep pages |
| Locking | `@Version` optimistic, `PESSIMISTIC_WRITE` for hot rows |
| Schema | migrations (Flyway) and `ddl-auto=validate` |

## Interview questions {#questions}

### [basic] What is the difference between JPA, Hibernate and Spring Data JPA? {#difference-q}

JPA is the Jakarta Persistence specification (annotations, `EntityManager`, JPQL). Hibernate is the most popular implementation of it. Spring Data JPA is a Spring layer on top of JPA that generates repository implementations from interfaces, with derived queries, paging and auditing. You write entities and repository interfaces; Hibernate runs the SQL.

### [basic] What is an ORM and what are its drawbacks? {#orm-q}

Object-relational mapping converts between objects and relational rows, saving boilerplate and giving portability. Drawbacks: hidden and sometimes inefficient SQL (N+1), the object-relational impedance mismatch, a learning curve around the persistence context and lazy loading, and less control for complex set-based queries.

### [basic] What are the entity states in JPA? {#states-q}

Transient (new, untracked, no row), managed or persistent (tracked by the persistence context, changes written at flush), detached (has an id but the context is closed, changes ignored) and removed (scheduled for deletion). Calls like `persist`, `merge`, `detach` and `remove` move entities between them.

### [basic] What is the difference between LAZY and EAGER fetching? {#fetch-q}

LAZY loads an association on first access (through a proxy) and needs an open persistence context; EAGER loads it together with the parent, always. JPA defaults are eager for `@ManyToOne` and `@OneToOne` and lazy for collections. Prefer lazy everywhere and fetch explicitly per use case, because eager loading cannot be turned off per query and causes extra joins and queries.

### [basic] What do save(), saveAll(), findById() and getReferenceById() do? {#crud-q}

`save` persists a new entity or merges one with an id and returns the managed instance; `saveAll` does it for a collection; `findById` returns an `Optional` (loading immediately); `getReferenceById` returns a lazy proxy without querying, useful for setting a foreign key without loading the row but failing later if it does not exist.

### [basic] What are derived query methods? {#derived-q}

Repository methods whose names Spring Data parses into queries (`findByIbanAndStatus`, `countByStatus`, `existsByIban`, `findTop10ByOrderByBalanceDesc`). Properties are validated at startup. For anything more complex use `@Query`, a specification or a projection, since long method names become unreadable.

### [intermediate] What is the persistence context and dirty checking? {#context-q}

The persistence context is the first-level cache of managed entities for one `EntityManager` (usually one transaction). When an entity is loaded Hibernate keeps a snapshot; at flush it compares the entity with it and issues `UPDATE` statements for changes. So inside a transaction you can modify a managed entity and not call `save()`; the change is persisted at commit.

### [intermediate] What is the N+1 problem and how do you fix it? {#n1-q}

Loading N parents and then lazily touching an association on each runs 1 + N queries. Fix with a `join fetch` query or `@EntityGraph` (one query), batch fetching (`@BatchSize` or `default_batch_fetch_size`) so many parents load their children per query, or a projection or DTO query that selects exactly the data needed. Detect by logging SQL or counting statements in tests.

### [intermediate] Why do you get LazyInitializationException and how do you avoid it? {#lazy-q}

A lazy association was accessed after the persistence context closed (the transaction ended), so the proxy cannot load data. Avoid by loading what the use case needs inside the transaction (fetch join, entity graph), mapping to DTOs in the service, or using projections. Open-in-view hides it by keeping the session open during web rendering but costs a held connection and hides queries; fetching eagerly everywhere is not a fix.

### [intermediate] What is the difference between persist, merge, save and saveAndFlush? {#merge-q}

`persist` makes a new transient entity managed (the instance passed becomes managed). `merge` copies the state of a detached or new instance onto a managed instance and returns that one (the argument stays detached). Spring Data `save` calls `persist` if the entity is new (null id or `Persistable.isNew`) and `merge` otherwise. `saveAndFlush` also forces the flush to the database immediately.

### [intermediate] How do you implement pagination and what is the cost of deep pages? {#paging-q}

Pass a `Pageable` and return a `Page` (with a count query) or `Slice`. Sort by a unique, stable column. `OFFSET`-based pages get slower as the offset grows because the database scans and discards rows; for large datasets use keyset pagination (`WHERE id < :lastId ORDER BY id DESC LIMIT n`).

### [intermediate] What are cascade types and orphanRemoval? {#cascade-q}

Cascade propagates entity operations from parent to children (`PERSIST`, `MERGE`, `REMOVE`, `ALL` ...). `orphanRemoval = true` deletes a child removed from the parent's collection. Use them only for true composition where the child cannot exist without the parent (order lines), never for shared or independent entities (`CascadeType.REMOVE` on a `@ManyToOne` could delete shared data).

### [intermediate] Who is the owning side of a bidirectional relationship? {#owning-q}

The side that holds the foreign key column (the `@ManyToOne` side, or the side without `mappedBy`). Only changes on the owning side are written to the database. The inverse side uses `mappedBy`; you must keep both sides in sync in code with helper methods.

### [intermediate] Why is IDENTITY a poor choice for batch inserts? {#identity-q}

With `IDENTITY` the database generates the id during the `INSERT`, so Hibernate must execute each insert immediately to learn the id, which disables JDBC batching. `SEQUENCE` lets Hibernate fetch ids in blocks and defer inserts to flush, so statements can be batched (with `hibernate.jdbc.batch_size` and `order_inserts`).

### [intermediate] What does @Transactional(readOnly = true) do? {#readonly-q}

It hints that no writes occur: Hibernate skips dirty checking and sets flush mode to manual, and the JDBC driver or database may optimise or route to a replica. It does not forbid writes on every database and is not a security mechanism. Use it on read-only service methods.

### [deep] How do first-level and second-level caches differ? {#cache-q}

The first-level cache is the persistence context: per `EntityManager` or transaction, always on, guarantees one instance per id in that context. The second-level cache (Ehcache, Infinispan, Redis through a provider) is shared across sessions in the application, opt-in per entity, and requires care about invalidation and clustering. A query cache stores result ids on top of it. In microservices an application-level cache is often simpler.

### [deep] What happens with bulk @Modifying updates and the persistence context? {#modifying-q}

Bulk JPQL or native updates run directly in the database and bypass the persistence context, so already-loaded entities keep stale values and version and lifecycle callbacks are skipped. Use `@Modifying(clearAutomatically = true, flushAutomatically = true)` or call `entityManager.clear()`, and prefer bulk statements only for set-based changes.

### [deep] How do you avoid lost updates with JPA? {#lost-update-q}

Add a `@Version` field for optimistic locking: updates become `WHERE id = ? AND version = ?`, a conflict raises `ObjectOptimisticLockingFailureException`, and you retry with fresh data. For contended rows use `@Lock(LockModeType.PESSIMISTIC_WRITE)` (`SELECT FOR UPDATE`), or an atomic update query. See [lost update](lesson:acid-base#lost-update).

### [coding] Show a fetch join, an entity graph and a DTO projection for the same need. {#coding-fetch}

```java
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    @Query("select distinct c from Customer c left join fetch c.accounts where c.id = :id")
    Optional<Customer> findWithAccounts(@Param("id") Long id);                     // fetch join

    @EntityGraph(attributePaths = {"accounts"})
    Optional<Customer> findById(Long id);                                           // entity graph on the standard method

    @Query("select new com.bank.CustomerRow(c.id, c.name, count(a)) from Customer c left join c.accounts a group by c.id, c.name")
    List<CustomerRow> rows();                                                       // DTO projection: no entities, no lazy loading
}
record CustomerRow(Long id, String name, long accounts) {}
```

Explain that all three avoid N+1, that the DTO is best for read-only lists, and that fetch joins on collections multiply rows (hence `distinct`) and do not combine with database paging.

### [coding] Fix the entity relationship mapping. {#coding-mapping}

```java
@Entity class Customer {
    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    List<Account> accounts;
}
@Entity class Account {
    @ManyToOne
    Customer customer;
}
```

```java
@Entity class Customer {
    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Account> accounts = new ArrayList<>();
    void addAccount(Account a) { accounts.add(a); a.setCustomer(this); }
}
@Entity class Account {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;
}
```

Explain that without `mappedBy` the original creates two unrelated mappings (an extra join table), that eager loading of the collection is replaced by lazy plus explicit fetching, that `@ManyToOne` is eager by default so it is set lazy, and that helper methods keep both sides consistent.

### [coding] Implement keyset pagination for transactions. {#coding-keyset}

```java
public interface LedgerRepository extends JpaRepository<LedgerEntry, Long> {

    @Query("select e from LedgerEntry e where e.accountId = :acc and (:lastId is null or e.id < :lastId) order by e.id desc")
    List<LedgerEntry> page(@Param("acc") Long accountId, @Param("lastId") Long lastId, Pageable limit);
}

List<LedgerEntry> first = repo.page(7L, null, PageRequest.of(0, 20));
Long next = first.isEmpty() ? null : first.get(first.size() - 1).getId();
List<LedgerEntry> second = repo.page(7L, next, PageRequest.of(0, 20));
```

Explain that each page is an index range scan from the last seen id (cost stays flat), that there is no total count, and that the sort key must be unique and indexed (`(account_id, id)`).
