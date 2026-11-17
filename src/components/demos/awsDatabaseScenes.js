// Frame data for the "AWS databases" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const AWS_DATABASE_SCENES = [
  {
    id: 'rds',
    label: 'RDS high availability',
    title: 'Multi-AZ and read replicas',
    frames: [
      {
        note: 'An RDS Multi-AZ instance has a primary in zone A and a standby in zone B. Every write is copied to the standby synchronously, before it is acknowledged, so the standby has all the committed data. The application connects to one endpoint name.',
        boxes: [b('a', 'Payments service', ['one endpoint name'], 'none'), b('p', 'RDS primary', ['zone A, takes the writes'], 'ok'), b('s', 'RDS standby', ['zone B, synchronous copy'], 'new')],
        deps: [d('Payments service', 'RDS primary', 'reads and writes', 'ok'), d('RDS primary', 'RDS standby', 'sync replication', 'ok')],
      },
      {
        note: 'Zone A fails. RDS detects it, promotes the standby to primary and points the endpoint DNS name at it. The failover takes one to two minutes. The application reconnects with its connection pool, and no committed data is lost.',
        boxes: [b('p', 'RDS primary', ['zone A, failed'], 'bad'), b('s', 'RDS standby', ['promoted to primary'], 'ok'), b('a', 'Payments service', ['reconnects'], 'warn')],
        deps: [d('RDS primary', 'RDS standby', 'failover', 'bad'), d('Payments service', 'RDS standby', 'same endpoint name', 'ok')],
      },
      {
        note: 'A read replica is a different thing: an asynchronous copy that serves reads. Reports and read-heavy queries go to the replica and take the load off the primary. It lags a little behind, so it is not a place for reads that must see the latest write.',
        boxes: [b('a', 'Payments service', ['writes to the primary'], 'none'), b('p', 'RDS primary', ['takes the writes'], 'ok'), b('r', 'Read replica', ['async, may lag'], 'new')],
        deps: [d('Payments service', 'RDS primary', 'writes', 'ok'), d('RDS primary', 'Read replica', 'async replication', 'warn')],
      },
    ],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    title: 'One cluster, shared storage',
    frames: [
      {
        note: 'Aurora separates compute from storage. The data lives in one cluster volume that is copied six times across three zones and grows by itself. The instances in front of it, a writer and up to fifteen readers, share that volume.',
        boxes: [b('w', 'Aurora writer', ['takes the writes'], 'ok'), b('r', 'Aurora readers', ['up to 15, share the data'], 'new'), b('v', 'Cluster storage', ['6 copies, 3 zones'], 'ok')],
        deps: [d('Aurora writer', 'Cluster storage', 'writes', 'ok'), d('Aurora readers', 'Cluster storage', 'read the same data', 'ok')],
      },
      {
        note: 'The cluster has a writer endpoint and a reader endpoint. The application sends writes to the first and read-only queries to the second, which spreads them over the readers. Replica lag is usually in milliseconds because the storage is shared.',
        boxes: [b('a', 'Payments service', ['read and write pools'], 'none'), b('w', 'Aurora writer', ['writer endpoint'], 'ok'), b('r', 'Aurora readers', ['reader endpoint'], 'ok')],
        deps: [d('Payments service', 'Aurora writer', 'writes', 'ok'), d('Payments service', 'Aurora readers', 'read-only queries', 'ok')],
      },
      {
        note: 'If the writer fails, Aurora promotes a reader to writer, usually within about thirty seconds, because the data is already in the shared storage and nothing has to be copied. The cluster endpoint follows the new writer.',
        boxes: [b('w', 'Aurora writer', ['failed'], 'bad'), b('r', 'Aurora readers', ['one is promoted'], 'ok'), b('v', 'Cluster storage', ['unchanged'], 'ok')],
        deps: [d('Aurora writer', 'Aurora readers', 'failover', 'bad'), d('Aurora readers', 'Cluster storage', 'same volume', 'ok')],
      },
      {
        note: 'For disaster recovery, an Aurora Global Database replicates the storage to a second region, normally in under a second. If the primary region is lost, the secondary cluster is promoted, with a recovery time of about a minute.',
        boxes: [b('p', 'Primary region', ['writer and readers'], 'ok'), b('g', 'Aurora Global Database', ['storage replication'], 'new'), b('s', 'Second region', ['secondary cluster'], 'ok')],
        deps: [d('Primary region', 'Aurora Global Database', 'replicates', 'ok'), d('Aurora Global Database', 'Second region', 'under 1 second', 'ok')],
      },
    ],
  },
  {
    id: 'dynamodb',
    label: 'DynamoDB',
    title: 'Design the table around the questions',
    frames: [
      {
        note: 'A DynamoDB table is keyed by a partition key, here customerId, and optionally a sort key, here the payment time. DynamoDB spreads the items over partitions by a hash of the partition key. Reads and writes by key take a few milliseconds at any size.',
        boxes: [b('a', 'Payments service', ['GetItem, Query'], 'none'), b('t', 'DynamoDB table', ['key: customerId + time'], 'new'), b('q', 'Query by key', ['one partition, sorted'], 'ok')],
        deps: [d('Payments service', 'Query by key', 'asks by key', 'ok'), d('Query by key', 'DynamoDB table', 'reads', 'ok')],
      },
      {
        note: 'There are no joins and no ad hoc queries, so you design the table for the questions you will ask. To find a payment by its status you add a global secondary index with another key. It is a second copy of the data, kept in step by DynamoDB.',
        boxes: [b('t', 'DynamoDB table', ['key: customerId + time'], 'ok'), b('i', 'Global secondary index', ['key: status + time'], 'new'), b('a', 'Payments service', ['Query on the index'], 'none')],
        deps: [d('DynamoDB table', 'Global secondary index', 'copies to', 'ok'), d('Payments service', 'Global secondary index', 'queries', 'ok')],
      },
      {
        note: 'Capacity can be on demand, which pays per request and scales without planning, or provisioned with auto scaling, which is cheaper for steady load. A partition key that most requests share, such as a date, makes one hot partition that throttles.',
        boxes: [b('c', 'On-demand capacity', ['pay per request'], 'ok'), b('t', 'DynamoDB table', ['even key spread'], 'ok'), b('h', 'Hot partition', ['one key gets most traffic'], 'bad')],
        deps: [d('On-demand capacity', 'DynamoDB table', 'serves', 'ok'), d('Hot partition', 'DynamoDB table', 'throttles', 'bad')],
      },
      {
        note: 'Conditional writes protect the data. A put with attribute_not_exists makes a repeated request harmless, which gives idempotency. A version attribute gives optimistic locking. Streams send every change to a Lambda function for downstream work.',
        boxes: [b('a', 'Payments service', ['conditional put'], 'none'), b('t', 'DynamoDB table', ['rejects a duplicate'], 'ok'), b('s', 'DynamoDB Streams', ['every change'], 'new'), b('l', 'Lambda function', ['reacts to changes'], 'ok')],
        deps: [d('Payments service', 'DynamoDB table', 'put if not exists', 'ok'), d('DynamoDB table', 'DynamoDB Streams', 'emits', 'ok'), d('DynamoDB Streams', 'Lambda function', 'triggers', 'ok')],
      },
    ],
  },
  {
    id: 'cache',
    label: 'Caching and connections',
    title: 'ElastiCache and RDS Proxy',
    frames: [
      {
        note: 'With cache-aside the service reads from ElastiCache first. On a miss it reads the database, stores the result in the cache with a time to live, and returns it. Hot reads then skip the database and answer in under a millisecond.',
        boxes: [b('a', 'Payments service', ['cache-aside'], 'none'), b('c', 'ElastiCache', ['Redis, miss on first read'], 'warn'), b('d', 'Aurora database', ['read on a miss'], 'ok')],
        deps: [d('Payments service', 'ElastiCache', 'get', 'ok'), d('ElastiCache', 'Aurora database', 'on a miss', 'warn')],
      },
      {
        note: 'The next requests find the value in the cache. The database sees a fraction of the reads. The cost is staleness, so set a TTL that the business accepts and remove the entry when the data changes.',
        boxes: [b('a', 'Payments service', ['same request'], 'none'), b('c', 'ElastiCache', ['hit, 0.3 ms'], 'ok'), b('d', 'Aurora database', ['not touched'], 'none')],
        deps: [d('Payments service', 'ElastiCache', 'get, hit', 'ok')],
      },
      {
        note: 'Hundreds of Lambda functions each open their own database connection, and the database runs out of connections. RDS Proxy keeps a pool of connections and shares it. The functions connect to the proxy, which also speeds up failover.',
        boxes: [b('l', 'Lambda function', ['hundreds at once'], 'warn'), b('p', 'RDS Proxy', ['pools the connections'], 'new'), b('d', 'Aurora database', ['a few steady connections'], 'ok')],
        deps: [d('Lambda function', 'RDS Proxy', 'many short connections', 'warn'), d('RDS Proxy', 'Aurora database', 'few pooled ones', 'ok')],
      },
      {
        note: 'The proxy reads the database password from Secrets Manager, which rotates it. The application can also sign in with IAM, using a short-lived token instead of a password, so no database password is stored in the code or the configuration.',
        boxes: [b('l', 'Lambda function', ['IAM role, token sign-in'], 'ok'), b('p', 'RDS Proxy', ['checks the IAM token'], 'new'), b('s', 'Secrets Manager', ['rotates the password'], 'ok')],
        deps: [d('Lambda function', 'RDS Proxy', 'IAM token', 'ok'), d('RDS Proxy', 'Secrets Manager', 'reads the secret', 'ok')],
      },
    ],
  },
];
