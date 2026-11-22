---
title: AWS databases — RDS, Aurora, DynamoDB and ElastiCache
nav: AWS databases
slug: aws-databases
summary: How to choose and run databases on AWS for Java and Spring Boot, the purpose-built database families, RDS engines with Multi-AZ, read replicas, backups and encryption, Aurora with shared storage, readers, failover, Serverless v2 and Global Database, DynamoDB keys, indexes, capacity modes, conditional writes, streams and global tables, ElastiCache and MemoryDB patterns, RDS Proxy and connection pooling, migration with DMS, disaster recovery, cost, and what a bank adds, with examples and interview questions.
tags: [AWS, RDS, Aurora, DynamoDB, ElastiCache, Database, Java, Spring Boot, High availability]
order: 57
topic: Cloud / AWS
updated: 2026-11-17
subnav: true
---

AWS does not offer one database but a family of them, each built for a kind of data and a kind of question. Interviews ask *how you choose between RDS, Aurora and DynamoDB, what Multi-AZ and a read replica are and how they differ, how Aurora is built, how DynamoDB tables and indexes are designed, how you scale and protect a database from too many connections, how caching fits in, how you fail over and recover, and how a bank secures and audits it.* This lesson follows the [service map](lesson:aws-service-map#databases) and builds on [SQL and NoSQL](lesson:sql-vs-nosql) and [ACID](lesson:acid-base). Play the four scenes: RDS high availability, Aurora, DynamoDB, and caching and connections.

```demo
name: aws-database-walk
```

*The AWS service icons in the diagrams are the official AWS Architecture Icons, shown unmodified. This site is not affiliated with, endorsed by or sponsored by Amazon Web Services.*

> **One sentence to remember:** *Use a managed relational database (RDS or Aurora) for transactions and queries, DynamoDB for key-based access at any scale, a cache in front of hot reads, and protect all of them with Multi-AZ, encryption, pooled connections and backups you have tested.*

```demo
name: aws-map-databases
```

## Choosing a database {#choosing}

AWS offers **purpose-built** databases, so the first question is what the data and the access pattern look like:

| Need | Service | Notes |
| --- | --- | --- |
| relational, transactions, joins, SQL | **RDS** (PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, Db2) | managed servers, familiar engines |
| relational at higher scale, fast failover | **Aurora** (MySQL and PostgreSQL compatible) | cloud-built storage, up to 15 readers |
| key-value or document at any scale, single-digit millisecond | **DynamoDB** | serverless, designed around access patterns |
| in-memory cache, sessions, counters | **ElastiCache** (Redis OSS, Valkey, Memcached) | microsecond reads, not durable by default |
| durable in-memory primary database | **MemoryDB** | Redis-compatible with a multi-AZ transaction log |
| MongoDB workloads | **DocumentDB** | MongoDB API compatible |
| relationships and graphs | **Neptune** | property graph and RDF |
| Cassandra workloads | **Keyspaces** | serverless, Cassandra compatible |
| time series | **Timestream** | ingestion and queries by time |
| analytics and warehouse | **Redshift** | columnar, large analytical queries |
| search and log analytics | **OpenSearch Service** | full-text search |

A sensible default for a banking service: **Aurora or RDS PostgreSQL for the system of record**, **DynamoDB** for high-volume key-based data such as idempotency records, sessions or event stores, and **ElastiCache** for hot reads. Do not use one database for everything, and do not use DynamoDB as a relational database ([ACID and BASE](lesson:acid-base)).

## Amazon RDS {#rds}

RDS runs a standard engine for you: provisioning, patching, backups, failover and monitoring are handled. You keep the schema, queries and tuning.

- **Instances and storage:** you choose an **instance class** (memory optimised `r`, general `m`, burstable `t`, Graviton `g`), and **storage** (gp3 by default, io2 for high IOPS) with **storage autoscaling**. You cannot log in to the host (except with RDS Custom).
- **Multi-AZ** (the first scene): a **synchronous standby** in another zone. Writes are acknowledged only after the standby has them, so a failure loses no committed data. On failure RDS **promotes the standby and moves the endpoint's DNS name**, which takes about one to two minutes. The standby cannot serve reads in the classic *Multi-AZ instance* mode. The newer **Multi-AZ DB cluster** has **two readable standbys** and faster failover.
- **Read replicas:** **asynchronous** copies that serve reads, to scale read traffic. They can be in another region, can be **promoted** to a standalone database (a migration and a disaster recovery tool), and they **lag**, so a read right after a write may not see it. A replica is **not** a high-availability mechanism for the primary, and Multi-AZ is not a read-scaling mechanism. They solve different problems.
- **Backups:** **automated backups** with **point-in-time recovery** to any second within the retention period (up to **35 days**), plus manual **snapshots** that stay until you delete them. A restore always creates a **new instance**. Test it.
- **Encryption:** at rest with KMS, chosen **when the instance is created**. An existing unencrypted instance is encrypted by restoring a copied, encrypted snapshot. In transit, require TLS (`rds.force_ssl`).
- **Access:** put the instance in **private subnets** with a security group that admits only the application, never publicly accessible. Use **IAM database authentication** (a short-lived token instead of a password) or a master password that **Secrets Manager** stores and **rotates**.
- **Operations:** a **maintenance window** for patching, **parameter groups** for settings, **Performance Insights** and **Enhanced Monitoring** for diagnosis, **Blue/Green Deployments** for safe major upgrades and schema changes (a synchronised copy you switch to), and **deletion protection**.
- **Licensing:** Oracle and SQL Server can be *license included* or *bring your own license*. Heavy licence costs are a reason to move to PostgreSQL or Aurora.

## Amazon Aurora {#aurora}

Aurora keeps the MySQL or PostgreSQL interface but replaces the storage layer (the second scene):

- **Shared cluster storage:** one volume per cluster, stored as **six copies across three zones**, in 10 GB pieces that grow automatically up to 128 TiB, with self-healing. Compute instances do not own the data, so adding or replacing one is quick.
- **Writer and readers:** one **writer** and up to **15 readers**, all on the same storage, with replica lag typically in the **milliseconds**. A **cluster endpoint** always points to the writer and a **reader endpoint** load-balances over the readers.
- **Failover:** a reader is promoted, usually in **under a minute** (about 30 seconds), because no data has to be copied.
- **Aurora Serverless v2:** capacity scales in small steps in **ACUs** (Aurora capacity units), so a cluster follows a variable load and can scale down to a minimum. Good for spiky or unpredictable workloads and for development.
- **Global Database:** storage-level replication to up to several other regions with typically **under one second** of lag, a managed **cross-region failover** with an RTO of about a minute, and local reads in each region ([disaster recovery](lesson:cloud-basics#availability)).
- **Other features:** **cloning** (a copy-on-write copy in minutes, great for test data), **Backtrack** (rewind a MySQL cluster without a restore), parallel query, **I/O-Optimized** pricing, and encryption and IAM authentication as in RDS.
- **RDS or Aurora?** Aurora costs more per instance but gives faster failover, more readers, shared storage and better scaling. Plain RDS is simpler and cheaper for a modest, steady database or an engine Aurora does not offer.

## Amazon DynamoDB {#dynamodb}

DynamoDB is a **serverless key-value and document store** that gives single-digit millisecond reads and writes at any scale (the third scene). It is not a relational database in a new place: you **design the table around the questions you will ask**.

- **Keys:** a **partition key** (hashed to spread items over partitions) and an optional **sort key** (items with the same partition key are stored in order, so you can query a range). Together they identify an item. Choose a partition key with **many distinct, evenly used values**.
- **Items:** up to **400 KB**, with flexible attributes. A `Query` reads one partition by key (and a sort key condition), efficiently. A `Scan` reads everything and should be avoided in production paths.
- **Access patterns first:** list every question (by customer, by status, by date) and design keys and indexes to answer each one. **Single-table design** puts several entity types in one table to answer related questions in one call: powerful, but harder to understand and change, so use it deliberately.
- **Secondary indexes:** a **global secondary index (GSI)** has its own partition and sort key and spans the table, with eventually consistent reads and its own capacity. A **local secondary index (LSI)** shares the partition key and must be created with the table.
- **Capacity modes:** **on-demand** (pay per request, instant scale, no planning, best for spiky or unknown traffic) or **provisioned** (set read and write capacity units, with **auto scaling**, cheaper for steady load). Throttling happens when one partition exceeds its share: a **hot partition** from a skewed key such as today's date, or a few customers dominating.
- **Consistency:** reads are **eventually consistent** by default (cheaper), with **strongly consistent** reads as an option on the base table (not on a GSI). **Transactions** (`TransactWriteItems`) give all-or-nothing across up to 100 items.
- **Conditional writes:** `attribute_not_exists(id)` makes a repeated request harmless (**idempotency**), and a **version attribute** gives **optimistic locking**. These are how you get safe concurrency without locks.
- **TTL:** items expire automatically at a timestamp (sessions, idempotency keys).
- **Streams:** an ordered log of item changes for 24 hours, consumed by **Lambda** or Kinesis, for change data capture, projections and event publishing (an outbox without a polling job).
- **DAX:** an in-memory cache in front of DynamoDB for microsecond reads of hot items.
- **Global Tables:** multi-region, **active-active** replication, with last-writer-wins conflict resolution, for local latency and regional resilience.
- **Backups:** **point-in-time recovery** (35 days) and on-demand backups, with AWS Backup for policy and copies.
- **Java:** the **Enhanced Client** maps annotated beans to items, with `@DynamoDbPartitionKey`, `@DynamoDbSortKey`, `@DynamoDbSecondaryPartitionKey` and `@DynamoDbVersionAttribute` (see the coding questions).
- **When not to use it:** ad hoc queries, many-to-many joins, reporting across arbitrary fields, or when the team cannot yet list the access patterns.

## ElastiCache and MemoryDB {#cache}

In-memory stores answer in microseconds and take load off the database (the fourth scene). The patterns and Spring integration are in the [Redis caching lesson](lesson:redis-caching):

- **ElastiCache** runs **Redis OSS or Valkey** (with replication, Multi-AZ automatic failover and optional cluster mode for sharding) or **Memcached** (simple, multi-threaded, no persistence). The cache is a **copy**, and the database stays the source of truth.
- **Patterns:** **cache-aside** (read the cache, on a miss read the database and fill the cache), **write-through**, and **TTLs** with explicit invalidation. Decide the staleness the business can accept for each entity.
- **Uses:** session stores, rate limiting, leaderboards, distributed locks (with care), idempotency keys, and hot lookups.
- **Pitfalls:** a **cache stampede** when a popular key expires and thousands of requests hit the database (use jitter, locking or early refresh), **stale data**, a **cold cache** after a restart, and unbounded memory (set a max memory and an eviction policy).
- **MemoryDB** is Redis-compatible but **durable**, with a multi-AZ transaction log, so it can be a primary database for data that fits in memory, not just a cache.

## Connections and Java {#connections}

Databases have limited connections, and cloud workloads create many (the last scene):

- **Pool sizing:** use **HikariCP** (Spring Boot's default) with a **small pool**: a few dozen connections can serve thousands of requests. A pool of 20 per instance times 100 instances is 2,000 connections, which can overwhelm a database. Size the pool from the database's `max_connections` and the number of application instances.
- **RDS Proxy:** a managed **connection pool** between application and database. It multiplexes many client connections onto fewer database connections, **preserves connections during a failover** (cutting the recovery time), and can use IAM authentication and Secrets Manager. It is especially useful for **Lambda**, where each environment would otherwise open its own connection.
- **Failover handling:** a failover changes where the DNS name points, so cached DNS entries and long-lived connections break for a while. Keep the **JVM DNS TTL** short (`networkaddress.cache.ttl`), set connection **validation and timeouts**, and consider the **AWS Advanced JDBC Wrapper**, which understands the cluster topology and fails over faster.
- **Read/write splitting:** send writes to the cluster (writer) endpoint and read-only transactions to the reader endpoint, in Spring with a routing `DataSource` selected by `@Transactional(readOnly = true)` (see the coding questions). Keep reads that must see their own write on the writer ([replica lag](lesson:distributed-systems)).
- **Authentication:** an **IAM token** (valid 15 minutes) replaces the password, the application role signs it, and Spring refreshes the connection's credentials. Or read the password from **Secrets Manager** at start-up, with rotation handled by the Proxy or a reload.
- **Transactions and migrations:** keep schema changes in Flyway or Liquibase and make them **backward compatible** for rolling releases ([expand and contract](lesson:deployment-strategies#database)).

## Migration to AWS {#migration}

- **DMS (Database Migration Service):** copies a database to AWS with **full load plus change data capture**, so the source stays live until the cut-over. For a different engine (Oracle to PostgreSQL) the **Schema Conversion Tool** converts the schema and code first, and the application code needs testing.
- **Homogeneous** (same engine) can use native tools: a backup and restore, logical replication, or an RDS read replica promoted at cut-over.
- **Steps:** assess and choose the target, build the landing zone, run a full load, replicate changes, **validate** data and performance, switch the application during a short window, keep the source read-only for a time as a fallback.
- **Modernisation** (to Aurora or DynamoDB) is a separate, larger change than rehosting, so decide whether to move first and refactor later.

## Disaster recovery and backup {#dr}

| Level | RDS | Aurora | DynamoDB |
| --- | --- | --- | --- |
| failure of a zone | Multi-AZ failover, 1 to 2 minutes | reader promoted, under a minute | built in, no action |
| accidental delete or bad deploy | point-in-time recovery to a new instance | PITR, Backtrack (MySQL), clones | point-in-time recovery to a new table |
| loss of a region | cross-region read replica or snapshot copy | Global Database, about a minute | Global Tables, active-active |
| protection of backups | AWS Backup, locked vault, copy to another account | the same | the same |

Set the **RTO and RPO** with the business, choose the cheapest design that meets them, and **test the failover and the restore** on a schedule, measuring the real times ([RTO and RPO](lesson:cloud-basics#availability), [AWS Backup](lesson:aws-storage#backup)).

## Cost levers {#cost}

- **Right-size** instances by actual CPU, memory and connections, prefer **Graviton**, and buy **Reserved Instances or Savings Plans** for steady databases.
- **Aurora Serverless v2** for variable load and development, and **stop or scale down** non-production at night.
- **Storage and I/O:** pick the storage type for the need, watch **Aurora I/O charges** (I/O-Optimized helps heavy workloads), and expire old snapshots and backups.
- **Read replicas and caches** cost money too: add them for a measured reason.
- **DynamoDB:** on-demand for spiky loads, provisioned with auto scaling or reserved capacity for steady ones, **TTL** to remove old items, and the Standard-IA table class for rarely read data. Avoid scans and over-indexing, because every GSI multiplies the write cost.
- **Data transfer** across zones and regions (replicas, Global Database) and **backup retention** add to the bill.

## In a bank {#bank}

- **System of record in a relational database,** Multi-AZ at least, with **encryption using customer-managed KMS keys**, TLS enforced, no public access, and the database reachable only from the application subnets.
- **No stored passwords:** IAM authentication or Secrets Manager with rotation, and administrative access through audited, time-limited roles.
- **Audit and monitoring:** database audit logging (pgaudit or the engine's audit plugin) exported to CloudWatch and a protected log account, CloudTrail for the control plane, and alarms on connections, replica lag, failovers and storage.
- **Data protection:** column-level protection or tokenisation for card and personal data, data classification and masking in non-production, and clones or snapshots restored only into approved accounts.
- **Resilience and DR:** documented RTO and RPO per system, tested failover and restore, cross-region copies in a permitted jurisdiction, and backups in a locked vault in a separate account.
- **Change control:** schema changes through a pipeline with approvals and backward-compatible migrations, Blue/Green Deployments for upgrades, and no direct production changes by individuals.
- **Residency and exit:** the region choice follows data residency rules, and an exit plan covers how the data would be exported and the dependency on engine-specific features.

Try it in the lab: [RDS: Multi-AZ failover and read replicas](lab:aws-rds-multi-az).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| relational | RDS (standard engines) or Aurora (cloud-built, faster failover, up to 15 readers) |
| Multi-AZ | synchronous standby, automatic failover in 1 to 2 minutes, for availability |
| read replica | asynchronous, scales reads, lags, can be promoted, for scale |
| Aurora | shared storage across 3 zones, writer plus readers, Serverless v2, Global Database |
| DynamoDB | design for access patterns, partition key with an even spread, GSIs, no joins |
| capacity | on-demand for spiky, provisioned with auto scaling for steady |
| safe writes | conditional put (idempotency), version attribute (optimistic lock), transactions |
| streams | change events to Lambda |
| cache | ElastiCache, cache-aside with TTL, watch stampedes and staleness |
| connections | small Hikari pool, RDS Proxy for Lambda and bursts, short DNS TTL |
| auth | IAM token or Secrets Manager rotation, never a stored password |
| backup | PITR up to 35 days, snapshots, restore to a new instance, test it |
| DR | Multi-AZ, Aurora Global Database, DynamoDB Global Tables, AWS Backup |
| migration | DMS full load plus CDC, SCT for different engines |

## Interview questions {#questions}

### [basic] How do you choose between RDS, Aurora and DynamoDB? {#choose-q}

RDS for a standard relational workload on a familiar engine with managed operations. Aurora when you need relational with higher throughput, quicker failover, more read replicas or cross-region replication, at a higher price. DynamoDB for key-based access at very large scale with predictable low latency, when you can design for the access patterns and do not need joins or ad hoc queries. Many systems use more than one: a relational system of record plus DynamoDB for specific high-volume data.

### [basic] What is the difference between Multi-AZ and a read replica? {#multi-az-q}

Multi-AZ is for availability: a standby in another zone receives every write synchronously and takes over automatically on a failure, with no data loss, and in the classic mode it does not serve reads. A read replica is for scaling reads: an asynchronous copy that serves queries, lags behind the primary, and can be promoted manually or placed in another region. Use Multi-AZ for resilience, replicas for read load, and often both.

### [basic] What is Amazon Aurora? {#aurora-q}

A MySQL and PostgreSQL compatible relational database built for the cloud, where the storage is a shared cluster volume with six copies across three zones that grows automatically. A writer and up to 15 readers share that storage, so replicas lag by milliseconds and failover promotes a reader in under a minute. It adds Serverless v2 for variable load, Global Database for cross-region replication, and cloning.

### [basic] What are the partition key and the sort key in DynamoDB? {#keys-q}

The partition key is hashed to decide which partition stores an item, so it spreads the load and is required. The optional sort key orders the items that share a partition key, which allows range queries and several items per key. Together they uniquely identify an item. A good partition key has many evenly used values, to avoid a hot partition.

### [basic] What is ElastiCache and when would you use it? {#elasticache-q}

A managed in-memory data store (Redis OSS or Valkey, and Memcached) used to cache hot reads, store sessions, count and rate-limit, and hold short-lived data, with microsecond latency. It reduces load on the database and speeds up responses. It is a copy, so you must handle staleness with TTLs and invalidation, and the database stays the source of truth. MemoryDB is the durable alternative when the in-memory store is the primary database.

### [basic] How are backups and recovery handled in RDS? {#rds-backup-q}

Automated backups take daily snapshots and keep transaction logs, so you can restore to any second within the retention period, up to 35 days (point-in-time recovery). Manual snapshots are kept until you delete them. A restore creates a new instance with a new endpoint, so the application must be pointed at it. Back up across accounts and regions with AWS Backup, and test the restore regularly.

### [intermediate] A read right after a write returns old data from a read replica. Why, and what do you do? {#lag-q}

Replication to a replica is asynchronous, so the replica can lag the primary by milliseconds or more under load. For reads that must see the user's own write, read from the writer, for example within the same transaction or for a short time after a write, or use a strongly consistent store. Use replicas for reports and read-heavy queries that tolerate staleness, monitor the replica lag metric, and in Aurora the lag is usually small because the storage is shared.

### [intermediate] How do you design a DynamoDB table for a payments service? {#dynamodb-design-q}

List the access patterns first: get a payment by id, list a customer's payments by time, list payments by status. Use the payment id as the partition key for the base table, add a global secondary index on customerId with createdAt as the sort key, and another on status if needed. Make the keys evenly distributed, use conditional puts for idempotency, a version attribute for optimistic locking, TTL for temporary items, and Streams to publish changes. Avoid scans, and remember that every index adds write cost.

### [intermediate] What causes DynamoDB throttling and how do you fix it? {#throttling-q}

Throttling happens when requests exceed the provisioned or burst capacity of the table, an index, or a single partition. Common causes are a hot partition from a skewed key (all traffic on today's date or one big customer), too little provisioned capacity or slow auto scaling, and a GSI with less capacity than the writes it must absorb. Fix by choosing a better-distributed key (for example adding a suffix to spread a hot key), using on-demand mode or higher capacity, adding DAX or a cache for hot reads, batching, and retrying with exponential backoff and jitter, which the SDK does by default.

### [intermediate] How do you implement idempotency and optimistic locking with DynamoDB? {#conditional-q}

Use conditional writes. For idempotency, put the item with the condition `attribute_not_exists(requestId)`: the first request succeeds and a repeat fails the condition, which you treat as already processed. For optimistic locking, store a version number and update with the condition that the version equals the value you read, incrementing it. If the condition fails, someone else changed the item, so reload and retry. The Java Enhanced Client does this with `@DynamoDbVersionAttribute`.

### [intermediate] How do you protect a database from too many connections when using Lambda? {#proxy-q}

Each Lambda environment can open its own connection, so a burst of hundreds can exhaust the database. Use RDS Proxy to pool and multiplex connections and keep them across a failover, cap the function with reserved concurrency, create the connection outside the handler so warm calls reuse it, use short timeouts and a tiny pool per environment, or use a data API or DynamoDB for the highest fan-out. Monitor connection counts and use IAM authentication with the proxy.

### [intermediate] What happens during an RDS Multi-AZ failover and how should the application behave? {#failover-q}

RDS detects the failure, promotes the standby and moves the endpoint's DNS name to it, taking one to two minutes, and open connections drop. The application should use the endpoint name, not an IP, keep a short DNS cache TTL, validate connections in the pool, set connection and query timeouts, retry transient errors for idempotent operations with backoff, and fail health checks gracefully. RDS Proxy or the AWS JDBC wrapper shortens the disruption. Test it by forcing a failover in a non-production environment.

### [intermediate] How would you cache data in front of a database and keep it correct? {#cache-q}

Use cache-aside: read the cache, on a miss read the database and store the value with a TTL, and on a write update the database and then delete or update the cache entry. Choose the TTL from the staleness the business accepts, add jitter to avoid many keys expiring together, protect a popular key from a stampede with locking or early refresh, and bound memory with an eviction policy. Do not cache data where staleness is unacceptable, such as an account balance used to authorise a payment.

### [intermediate] How do you encrypt an existing unencrypted RDS instance? {#encrypt-q}

Encryption can only be enabled when a database is created, so take a snapshot, copy it with encryption enabled using a KMS key, and restore the copy to a new encrypted instance. Then switch the application to the new endpoint (or promote an encrypted read replica approach for a lower downtime), validate, and delete the old instance after a retention period. Enforce encryption by default for new databases with a service control policy or an AWS Config rule.

### [deep] Design the database layer for a bank's payment platform. {#design-q}

An Aurora PostgreSQL cluster as the system of record, in private subnets across three zones, with a writer and at least two readers, encrypted with a customer-managed KMS key, TLS enforced and IAM authentication through RDS Proxy. Payments are written in ACID transactions with idempotency keys in a unique-constrained table, and read-only reports use the reader endpoint. DynamoDB holds high-volume key-based data such as idempotency records and sessions, with conditional writes, TTL and Streams to publish events. ElastiCache caches reference data only. Aurora Global Database replicates to a second permitted region for DR with a tested RTO of about a minute, and AWS Backup keeps point-in-time and copied backups in a locked vault in a separate account. Audit logs go to a protected account, schema changes run through a pipeline with backward-compatible migrations, and monitoring watches latency, connections, replica lag and failover events.

### [deep] How would you migrate a 2 TB Oracle database to AWS with minimal downtime? {#oracle-q}

Decide the target: RDS Oracle if the application depends on Oracle features and licences, or Aurora PostgreSQL to remove licence costs, which needs a schema and code conversion. For the heterogeneous path, use the Schema Conversion Tool to convert the schema and assess PL/SQL, fix the incompatibilities, run DMS with a full load and then change data capture so the target follows the source, and test the application and performance against the replica. Validate the data with row counts and checksums, rehearse the cut-over, then stop writes, let replication drain, switch the application and keep the source as a fallback for a time. Network throughput (Direct Connect) and the transaction rate set the schedule.

### [deep] Compare DynamoDB Global Tables with Aurora Global Database. {#global-q}

Both replicate across regions, but differently. Aurora Global Database has one writer region and read-only secondary regions, replicates at the storage layer in typically under a second, keeps strong relational semantics, and fails over to a secondary region in about a minute, so it suits a relational system of record that needs fast regional DR and local reads. DynamoDB Global Tables are multi-region active-active: every region accepts writes, conflicts are resolved by last-writer-wins, and replication is asynchronous, so they suit data where eventual consistency across regions is acceptable and local low-latency writes matter. The application must tolerate conflicts and lag in the DynamoDB case.

### [coding] Write a DynamoDB Enhanced Client bean and code for an idempotent insert, an optimistic update and a query by customer. {#coding-dynamodb}

```java
@DynamoDbBean
public class Payment {
    private String paymentId;
    private String customerId;
    private Instant createdAt;
    private String status;
    private Long version;

    @DynamoDbPartitionKey
    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

    @DynamoDbSecondaryPartitionKey(indexNames = "customer-index")
    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    @DynamoDbSecondarySortKey(indexNames = "customer-index")
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    @DynamoDbVersionAttribute          // enables optimistic locking
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
```

```java
@Repository
public class PaymentRepository {

    private final DynamoDbTable<Payment> table;

    public PaymentRepository(DynamoDbEnhancedClient client) {
        this.table = client.table("payments", TableSchema.fromBean(Payment.class));
    }

    /** Insert only if the id is new: a repeated request is rejected, not duplicated. */
    public boolean insertOnce(Payment p) {
        try {
            table.putItem(PutItemEnhancedRequest.builder(Payment.class)
                    .item(p)
                    .conditionExpression(Expression.builder().expression("attribute_not_exists(paymentId)").build())
                    .build());
            return true;
        } catch (ConditionalCheckFailedException duplicate) {
            return false;
        }
    }

    /** Read, change, write back: fails if someone updated the item in between (version mismatch). */
    public void markSettled(String paymentId) {
        Payment p = table.getItem(Key.builder().partitionValue(paymentId).build());
        p.setStatus("SETTLED");
        table.updateItem(p);               // the version attribute makes this conditional and increments it
    }

    /** All payments of a customer, newest first, through the secondary index. */
    public List<Payment> forCustomer(String customerId) {
        return table.index("customer-index")
                .query(QueryEnhancedRequest.builder()
                        .queryConditional(QueryConditional.keyEqualTo(Key.builder().partitionValue(customerId).build()))
                        .scanIndexForward(false)
                        .limit(50)
                        .build())
                .stream().flatMap(page -> page.items().stream()).limit(50).toList();
    }
}
```

Explain: `insertOnce` uses a **conditional put**, so the same request twice creates one item (idempotency), and the caller learns that it was a duplicate; `markSettled` relies on the **version attribute**, so a concurrent update makes `updateItem` throw a `ConditionalCheckFailedException` and the caller reloads and retries (optimistic locking); the customer query uses a **global secondary index**, the right tool for a second access pattern, and never a scan; and credentials come from the task role. Remember that a GSI is eventually consistent and that every index adds write cost.

### [coding] Configure Spring Boot to send writes to the Aurora writer endpoint and read-only transactions to the reader endpoint. {#coding-routing}

```java
public class ReplicaRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly() ? "reader" : "writer";
    }
}

@Configuration
public class DataSourceConfig {

    @Bean
    DataSource writerDataSource(@Value("${db.writer.url}") String url, @Value("${db.user}") String user,
                                @Value("${db.password}") String password) {
        return pool(url, user, password, 10);
    }

    @Bean
    DataSource readerDataSource(@Value("${db.reader.url}") String url, @Value("${db.user}") String user,
                                @Value("${db.password}") String password) {
        return pool(url, user, password, 10);
    }

    @Bean
    @Primary
    DataSource routingDataSource(DataSource writerDataSource, DataSource readerDataSource) {
        ReplicaRoutingDataSource routing = new ReplicaRoutingDataSource();
        routing.setTargetDataSources(Map.of("writer", writerDataSource, "reader", readerDataSource));
        routing.setDefaultTargetDataSource(writerDataSource);
        // the lookup must happen after the transaction is started, so defer the real connection
        return new LazyConnectionDataSourceProxy(routing);
    }

    private HikariDataSource pool(String url, String user, String password, int size) {
        HikariConfig c = new HikariConfig();
        c.setJdbcUrl(url);                    // cluster endpoint for the writer, reader endpoint for the reader
        c.setUsername(user);
        c.setPassword(password);              // in production from Secrets Manager or an IAM token
        c.setMaximumPoolSize(size);           // small pool: many instances times this must stay under max_connections
        c.setConnectionTimeout(3000);
        c.setMaxLifetime(Duration.ofMinutes(10).toMillis());   // recycle connections so failovers are picked up
        return new HikariDataSource(c);
    }
}
```

```java
@Service
public class StatementService {
    @Transactional(readOnly = true)       // routed to the reader endpoint
    public List<Entry> history(String accountId) { /* ... */ return List.of(); }

    @Transactional                        // routed to the writer endpoint
    public void post(Entry entry) { /* ... */ }
}
```

Explain: the writer URL is the **cluster endpoint** and the reader URL is the **reader endpoint**, so a failover or a new replica needs no change in the application; `readOnly = true` sends the query to a reader, and everything else goes to the writer; the `LazyConnectionDataSourceProxy` delays picking the connection until the transaction's read-only flag is known; the pools are **small** and recycle their connections, which keeps the total below the database limit and lets the application follow a failover; and reads that must see their own write should not be marked read-only, because of replica lag. Use the AWS JDBC Wrapper or RDS Proxy for faster failover handling.

### [coding] Write a CloudFormation RDS PostgreSQL instance that is Multi-AZ, encrypted, private, with 35-day backups and no stored password. {#coding-rds}

```yaml
Resources:
  PaymentsDb:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    UpdateReplacePolicy: Snapshot
    Properties:
      DBInstanceIdentifier: payments-db
      Engine: postgres
      EngineVersion: '16.4'
      DBInstanceClass: db.m7g.large                    # Graviton
      AllocatedStorage: '100'
      MaxAllocatedStorage: 500                         # storage autoscaling
      StorageType: gp3
      StorageEncrypted: true
      KmsKeyId: !Ref DatabaseKey                       # customer-managed key
      MultiAZ: true
      PubliclyAccessible: false
      DBSubnetGroupName: !Ref PrivateDbSubnets
      VPCSecurityGroups: [!Ref DatabaseSecurityGroup]  # only the application security group may connect
      ManageMasterUserPassword: true                   # the password lives in Secrets Manager and is rotated
      MasterUsername: dbadmin
      EnableIAMDatabaseAuthentication: true
      BackupRetentionPeriod: 35                        # point-in-time recovery window
      PreferredBackupWindow: '17:00-18:00'
      PreferredMaintenanceWindow: sun:18:30-sun:19:30
      DeletionProtection: true
      CopyTagsToSnapshot: true
      EnablePerformanceInsights: true
      MonitoringInterval: 60
      MonitoringRoleArn: !GetAtt MonitoringRole.Arn
      EnableCloudwatchLogsExports: [postgresql, upgrade]
      DBParameterGroupName: !Ref ForceSslParameterGroup   # rds.force_ssl = 1
```

Explain: `MultiAZ` gives the synchronous standby and automatic failover; the instance is **encrypted with a customer-managed key** and **not publicly accessible**, in private subnets and behind a security group that admits only the application; `ManageMasterUserPassword` lets RDS keep the master password in **Secrets Manager** with rotation, so no password appears in the template, and IAM authentication is enabled for the application; 35 days of automated backups allow **point-in-time recovery**; `DeletionProtection` and the `Snapshot` deletion policies stop an accidental stack deletion from destroying the data; a parameter group forces TLS; and Performance Insights and exported logs support diagnosis and audit. Backups would also be copied to a locked vault in another account with AWS Backup.
