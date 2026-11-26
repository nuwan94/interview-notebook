---
title: Spring Data JPA and Hibernate — entities, repositories, fetching and the persistence context
nav: Spring Data JPA
slug: spring-data-jpa
summary: How Spring Data repositories, JPA and Hibernate fit together, entity mapping and relationships, the persistence context and entity states, lazy loading, the N+1 problem, queries, projections, pagination and locking, with Java examples and interview questions.
tags: [Spring, JPA, Hibernate, Spring Data, ORM, Database]
order: 88
topic: Spring / Data
updated: 2026-11-26
subnav: true
---

For a Spring Boot role, a persistence round is almost certain. Expect:

- What is the difference between JPA, Hibernate and Spring Data JPA?
- How do entity states and the persistence context work?
- What is the N+1 problem?
- Why do I get `LazyInitializationException`?
- How do you do pagination and locking?

It builds on [Spring Boot](lesson:spring-boot) (which sets up the `DataSource` and `EntityManager`), [AOP](lesson:spring-aop) (repository and `@Transactional` proxies), [normalization](lesson:normalization) (the schema you map) and [ACID and BASE](lesson:acid-base) (transactions and locking).

The demo has three scenes: entity states, the N+1 problem, and the lazy-loading error.

```demo
name: spring-jpa-walk
```

> **One sentence to remember:** *Inside a transaction, Hibernate tracks your entities and writes their changes for you.*

The pieces: JPA is the standard, Hibernate implements it, and Spring Data writes the repository code for you. The *persistence context* tracks your entities and writes changes at flush. Most JPA bugs come from not knowing its states and how it fetches data.

## The stack {#stack}

| Layer | Role |
| --- | --- |
| **JDBC** | The low-level API: connections, statements and result sets. |
| **JPA** (Jakarta Persistence) | The **specification**: annotations (`@Entity`), `EntityManager` and JPQL. |
| **Hibernate** | The most common JPA **implementation**. It also has its own API (`Session`), caching and extra features. |
| **Spring Data JPA** | Generates repository implementations on top of JPA, with query derivation, paging and auditing. |
| **HikariCP** | The connection pool that Boot configures. |

Spring Boot's `spring-boot-starter-data-jpa` wires all of it together.

**ORM** (object-relational mapping) maps classes to tables and rows to objects. It saves a lot of boilerplate. The price is SQL you do not see, and the **object-relational impedance mismatch**: objects form graphs, but tables are joined rows.

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

- Store money as `BigDecimal`, never `double`. Store enums as `STRING`. Store time as `Instant` or `LocalDateTime`.
- **ID generation** has four options:
  - `IDENTITY`: the database auto-increments. Simple, but it disables JDBC insert batching, because the ID only exists after the insert.
  - `SEQUENCE`: preferred where available. IDs are reserved in blocks, so batching works.
  - `UUID`.
  - Assigned by your code.
- **Embeddables** (`@Embedded`, `@Embeddable`) group columns into a value object, such as `Money` or `Address`.
- Keep entities out of the API layer. Expose **DTOs** instead.

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
| **Owning side** | The side with the foreign key (`@ManyToOne`, `@JoinColumn`). The other side uses `mappedBy`. |
| **Cascade** | Passes operations (persist, merge, remove) on to the children. Use `ALL` only when the children truly belong to the parent. |
| **orphanRemoval** | Deletes a child that you remove from the parent's collection. |
| **Fetch type** | `LAZY` loads on first access. `EAGER` loads together with the parent. |
| Defaults | `@ManyToOne` and `@OneToOne` are **EAGER**. `@OneToMany` and `@ManyToMany` are **LAZY**. |

Good practice:

- Make every association `LAZY`, including `@ManyToOne(fetch = LAZY)`, and fetch what you need in each query.
- Choose `Set` or `List` carefully for `@ManyToMany`. If the link has its own attributes, model it as an entity.
- Avoid two-way (bidirectional) associations unless you need them.
- Never use `CascadeType.REMOVE` on references that other entities share.

### equals and hashCode {#equals}

Entities live in collections and in the persistence context, so how you define equality matters.

- Do not compare all fields: they change, and lazy proxies break the comparison.
- Use a stable **business key** (the IBAN), or the ID with a null-safe check.
- Implement `equals` with `instanceof`, because proxies are subclasses.
- Make `hashCode` a constant, or base it on the business key.

## The persistence context {#context}

### Entity states and flush {#states}

The **persistence context** is a map of entities by ID that Hibernate tracks. It is also called the *first-level cache*. There is one per `EntityManager`, which normally means one per transaction.

| State | Meaning |
| --- | --- |
| **Transient (new)** | Created with `new`. The context does not know it, and it has no row. |
| **Managed (persistent)** | Tracked by the context. Changes are detected and written. |
| **Detached** | Has an ID, but its context is closed. Changes are ignored. |
| **Removed** | Scheduled for deletion at flush. |

- **Dirty checking:** at **flush**, Hibernate compares each managed entity with the snapshot it took when loading it, and sends an `UPDATE` for each change. So inside a transaction you usually do not call `save()` for updates: you just change the managed entity.
- **Flush** happens at commit, before a JPQL query whose result it could affect (`FlushModeType.AUTO`), or when you call `flush()`. The SQL runs at flush, not at your Java call.
- **First-level cache:** calling `findById` twice in one context returns the same instance, with one query. This cache belongs to one transaction and is not shared. The **second-level cache** (optional and shared) is a separate feature.
- `save()` on a new entity persists it. On an entity with an ID, it calls `merge`: Hibernate loads the row, copies your state onto it, and returns the managed instance.

### Lazy loading {#lazy}

A lazy association is a **proxy placeholder**. It loads on first access, which needs an open persistence context. Accessing it after the transaction ends throws **`LazyInitializationException`**.

The remedies:

- fetch the data inside the transaction (fetch join, entity graph),
- return DTOs from the service,
- or map to DTOs inside the transaction.

`spring.jpa.open-in-view=true` is the Boot default. It keeps the session open through the web layer. That hides the problem, but it holds a database connection for the whole request and allows queries while the view renders. Many teams turn it off.

### The N+1 problem {#n-plus-one}

Loading N parents, then lazily loading each parent's children, runs 1 + N queries. The fixes:

```java
@Query("select distinct c from Customer c left join fetch c.accounts where c.status = :status")
List<Customer> findWithAccounts(@Param("status") Status status);          // fetch join: one query

@EntityGraph(attributePaths = "accounts")                                    // same without writing JPQL
List<Customer> findByStatus(Status status);

// batch fetching for paged lists, in properties:
// spring.jpa.properties.hibernate.default_batch_fetch_size=50
```

- A `join fetch` of a **collection** repeats each parent row once per child. It also cannot be combined with paging in the database: Hibernate pages in memory and logs a warning. Page the parent IDs first, or use batch fetching.
- Never fetch two `List` collections in one query. You get a `MultipleBagFetchException`, and a cartesian product.
- To detect N+1, use `spring.jpa.show-sql` or `logging.level.org.hibernate.SQL=DEBUG`, count statements in tests, or turn on Hibernate statistics.

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
| `Repository` | Nothing. It is a marker. |
| `CrudRepository` | `save`, `findById`, `findAll`, `delete`, `count`. |
| `PagingAndSortingRepository` | `findAll(Pageable)` and `findAll(Sort)`. |
| `JpaRepository` | `flush`, `saveAllAndFlush`, batch deletes, `getReferenceById`. |

Spring creates the implementation as a **proxy** at startup.

- It builds derived queries from the method name: `findBy`, `existsBy`, `countBy`, `And`, `Or`, `OrderBy`, `Top`, `Between`, `In`, `IgnoreCase`.
- If a property in the name does not exist, startup fails.
- Repository methods are already `@Transactional`: reads are `readOnly`, and writes run in a transaction.

**Bulk `@Modifying` queries** run directly as SQL and **do not update the persistence context**. Entities you already loaded become stale. `clearAutomatically = true` clears the context afterwards.

### Projections {#projections}

Select only what you need, instead of full entities:

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
| Extra count query | Yes. | No. It fetches size + 1 rows. | No. |
| Knows the total | Yes. | No. | No. |
| Deep pages | Slow, because `OFFSET` scans the skipped rows. | Slow. | Fast: `WHERE id < :last ORDER BY id DESC LIMIT n`. |

Always sort by a **unique, stable** column, so pages do not overlap. Use keyset pagination for large or endless lists.

## Transactions and locking {#tx}

Put `@Transactional` on **service** methods, which are the units of business work, not on repositories. `readOnly = true` lets Hibernate skip dirty checking and lets the driver optimise.

Handle concurrent updates with:

- `@Version` for optimistic locking, and retry on `ObjectOptimisticLockingFailureException`,
- or `@Lock(PESSIMISTIC_WRITE)`, which runs `SELECT ... FOR UPDATE`.

[ACID and BASE](lesson:acid-base#jpa-locks) shows both with examples. Propagation, rollback rules and pitfalls are in [Spring transactions](lesson:spring-transactions).

## Practical points {#practical}

- **Schema management:** use **Flyway** or **Liquibase** migrations ([lesson](lesson:flyway-liquibase)). In production set `spring.jpa.hibernate.ddl-auto=validate` (or `none`), never `update` or `create`.
- **Batching inserts:** set `spring.jpa.properties.hibernate.jdbc.batch_size=50` and `order_inserts=true`, and use a `SEQUENCE` ID strategy, because `IDENTITY` turns batching off. For millions of rows, use `JdbcTemplate` batches, `COPY` or Spring Batch.
- **Auditing:** `@EnableJpaAuditing` with `@CreatedDate`, `@LastModifiedDate` and `@CreatedBy` on a `@MappedSuperclass`.
- **More tools:** soft delete, multi-tenancy, and specifications (`JpaSpecificationExecutor`) for dynamic filters. Use **Querydsl** or **jOOQ** when queries get complex.
- **When not to use JPA:** reporting and heavy set-based SQL are clearer with native SQL, `JdbcTemplate` or jOOQ. JPA suits aggregates that you read and write as objects.
- **Test with a real database** (Testcontainers) rather than H2 when you use vendor-specific features.

Try it in the lab: [The N+1 queries problem](lab:jpa-n-plus-one).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| JPA, Hibernate, Spring Data | The specification, the implementation, and the repository layer. |
| Entity states | Transient, managed, detached, removed. |
| Dirty checking | Managed entities are updated at flush, without `save()`. |
| Flush | At commit, before affected queries, or when called. |
| Defaults | `@ManyToOne` is eager and `@OneToMany` is lazy. Prefer lazy everywhere. |
| Owning side | The side with the foreign key. `mappedBy` goes on the other side. |
| `LazyInitializationException` | Lazy access after the context closed. Fetch inside the transaction, or use DTOs. |
| N+1 | Fetch join, `@EntityGraph`, batch fetching, projections. |
| IDs | `SEQUENCE` allows batching. `IDENTITY` does not. |
| Bulk `@Modifying` | Bypasses the context, so clear it. |
| Pagination | `Page` counts, `Slice` does not, keyset for deep pages. |
| Locking | `@Version` for optimistic locking, `PESSIMISTIC_WRITE` for busy rows. |
| Schema | Migrations (Flyway) and `ddl-auto=validate`. |

## Interview questions {#questions}

### [basic] What is the difference between JPA, Hibernate and Spring Data JPA? {#difference-q}

- **JPA** is the Jakarta Persistence specification: annotations, `EntityManager` and JPQL.
- **Hibernate** is the most popular implementation of JPA.
- **Spring Data JPA** is a Spring layer on top of JPA. It generates repository implementations from interfaces, with derived queries, paging and auditing.

You write entities and repository interfaces, and Hibernate runs the SQL.

### [basic] What is an ORM and what are its drawbacks? {#orm-q}

Object-relational mapping converts between objects and relational rows. It saves boilerplate and makes code more portable between databases.

The drawbacks:

- SQL is hidden and sometimes inefficient (N+1).
- Objects and tables do not map perfectly (the impedance mismatch).
- The persistence context and lazy loading take time to learn.
- You have less control over complex set-based queries.

### [basic] What are the entity states in JPA? {#states-q}

- **Transient:** new, not tracked, no row.
- **Managed (persistent):** tracked by the persistence context. Changes are written at flush.
- **Detached:** has an ID, but the context is closed, so changes are ignored.
- **Removed:** scheduled for deletion.

The calls `persist`, `merge`, `detach` and `remove` move entities between these states.

### [basic] What is the difference between LAZY and EAGER fetching? {#fetch-q}

**LAZY** loads an association on first access, through a proxy, and needs an open persistence context. **EAGER** always loads it together with the parent.

JPA's defaults are eager for `@ManyToOne` and `@OneToOne`, and lazy for collections.

Prefer lazy everywhere and fetch explicitly for each use case. You cannot turn eager loading off for a single query, and it causes extra joins and queries.

### [basic] What do save(), saveAll(), findById() and getReferenceById() do? {#crud-q}

- `save` persists a new entity, or merges one that has an ID, and returns the managed instance.
- `saveAll` does the same for a collection.
- `findById` loads immediately and returns an `Optional`.
- `getReferenceById` returns a lazy proxy without running a query. It is useful to set a foreign key without loading the row. But if the row does not exist, it fails later, when the proxy is used.

### [basic] What are derived query methods? {#derived-q}

They are repository methods whose names Spring Data turns into queries: `findByIbanAndStatus`, `countByStatus`, `existsByIban`, `findTop10ByOrderByBalanceDesc`. The property names are checked at startup.

For anything more complex, use `@Query`, a specification or a projection. Long method names become unreadable.

### [intermediate] What is the persistence context and dirty checking? {#context-q}

The persistence context is the first-level cache of managed entities for one `EntityManager`, usually one transaction.

When Hibernate loads an entity, it keeps a snapshot. At flush it compares the entity with that snapshot and sends `UPDATE` statements for the changes.

So inside a transaction you can change a managed entity without calling `save()`. The change is saved at commit.

### [intermediate] What is the N+1 problem and how do you fix it? {#n1-q}

Loading N parents and then touching a lazy association on each one runs 1 + N queries.

Fixes:

- a `join fetch` query or `@EntityGraph`, which uses one query,
- batch fetching (`@BatchSize` or `default_batch_fetch_size`), so each query loads the children of many parents,
- a projection or DTO query that selects exactly the data needed.

Detect it by logging SQL or counting statements in tests.

### [intermediate] Why do you get LazyInitializationException and how do you avoid it? {#lazy-q}

A lazy association was accessed after the persistence context closed, when the transaction had ended. The proxy can no longer load its data.

Avoid it by:

- loading what the use case needs inside the transaction (fetch join, entity graph),
- mapping to DTOs in the service,
- or using projections.

Open-in-view hides the error by keeping the session open while the web layer renders. But it holds a connection longer and hides queries. Making everything eager is not a fix.

### [intermediate] What is the difference between persist, merge, save and saveAndFlush? {#merge-q}

- `persist` makes a new, transient entity managed. The instance you pass in becomes the managed one.
- `merge` copies the state of a detached or new instance onto a managed instance, and returns that managed instance. The argument stays detached.
- Spring Data's `save` calls `persist` if the entity is new (null ID, or `Persistable.isNew`), and `merge` otherwise.
- `saveAndFlush` also flushes to the database immediately.

### [intermediate] How do you implement pagination and what is the cost of deep pages? {#paging-q}

Pass a `Pageable`, and return a `Page` (which runs a count query) or a `Slice` (which does not). Sort by a unique, stable column.

Pages based on `OFFSET` get slower as the offset grows, because the database scans the rows it skips and throws them away. For large datasets, use keyset pagination: `WHERE id < :lastId ORDER BY id DESC LIMIT n`.

### [intermediate] What are cascade types and orphanRemoval? {#cascade-q}

**Cascade** passes entity operations from a parent on to its children: `PERSIST`, `MERGE`, `REMOVE`, `ALL` and others.

**`orphanRemoval = true`** deletes a child that is removed from the parent's collection.

Use them only when the child cannot exist without the parent, such as order lines. Never use them for shared or independent entities: `CascadeType.REMOVE` on a `@ManyToOne` could delete shared data.

### [intermediate] Who is the owning side of a bidirectional relationship? {#owning-q}

The side that holds the foreign key column: the `@ManyToOne` side, or the side without `mappedBy`.

Only changes on the owning side are written to the database. The other side uses `mappedBy`. You must keep both sides in sync in your code, usually with helper methods.

### [intermediate] Why is IDENTITY a poor choice for batch inserts? {#identity-q}

With `IDENTITY`, the database creates the ID during the `INSERT`. Hibernate must run each insert immediately to learn the ID, which disables JDBC batching.

With `SEQUENCE`, Hibernate fetches IDs in blocks and can hold the inserts until flush. Then the statements can be batched, using `hibernate.jdbc.batch_size` and `order_inserts`.

### [intermediate] What does @Transactional(readOnly = true) do? {#readonly-q}

It signals that the method makes no writes.

- Hibernate skips dirty checking and sets the flush mode to manual.
- The JDBC driver or database may optimise, or send the query to a replica.

It does not block writes on every database, and it is not a security mechanism. Use it on read-only service methods.

### [deep] How do first-level and second-level caches differ? {#cache-q}

The **first-level cache** is the persistence context. It belongs to one `EntityManager` or transaction, is always on, and guarantees one instance per ID within that context.

The **second-level cache** (Ehcache, Infinispan, or Redis through a provider) is shared across sessions in the application. You opt in per entity, and you must think about invalidation and clustering. A query cache can store result IDs on top of it.

In microservices, a cache at the application level is often simpler.

### [deep] What happens with bulk @Modifying updates and the persistence context? {#modifying-q}

Bulk JPQL or native updates run directly in the database and bypass the persistence context. So:

- entities already loaded keep stale values,
- version checks and lifecycle callbacks are skipped.

Use `@Modifying(clearAutomatically = true, flushAutomatically = true)`, or call `entityManager.clear()`. Use bulk statements only for set-based changes.

### [deep] How do you avoid lost updates with JPA? {#lost-update-q}

Add a `@Version` field for optimistic locking. Updates then become `WHERE id = ? AND version = ?`. A conflict raises `ObjectOptimisticLockingFailureException`, and you retry with fresh data.

For rows many transactions fight over, use `@Lock(LockModeType.PESSIMISTIC_WRITE)` (`SELECT FOR UPDATE`), or an atomic update query. See [lost update](lesson:acid-base#lost-update).

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

Explain these points:

- All three avoid N+1.
- The DTO is best for read-only lists.
- Fetch joins on collections repeat rows (hence `distinct`), and do not work with paging in the database.

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

Explain these points:

- Without `mappedBy`, the original creates two unrelated mappings, plus an extra join table.
- The eager collection becomes lazy, with explicit fetching where needed.
- `@ManyToOne` is eager by default, so it is set to lazy.
- Helper methods keep both sides consistent.

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

Explain these points:

- Each page reads an index range starting from the last ID seen, so the cost stays flat.
- There is no total count.
- The sort key must be unique and indexed, here on `(account_id, id)`.
