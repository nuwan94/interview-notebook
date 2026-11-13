// Frame data for the caching, async and scheduling walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_ASYNC_SCENES = [
  {
    id: 'cache',
    label: 'Cache-aside',
    title: '@Cacheable: the first call hits the database, later calls hit the cache',
    frames: [
      {
        note: 'getRate("SGD/USD") is annotated @Cacheable("rates"). The call goes through the caching proxy, which first looks in the cache for the key "SGD/USD". It is empty.',
        boxes: [b('c', 'Client', ['getRate("SGD/USD")'], 'new'), b('p', 'Rate proxy', ['@Cacheable("rates")', 'key = SGD/USD'], 'new'), b('k', 'Cache', ['rates: empty'], 'none', 'miss')],
        deps: [d('Client', 'Rate proxy', 'call', 'ok'), d('Rate proxy', 'Cache', 'lookup', 'warn')],
      },
      {
        note: 'Cache miss: the proxy calls the real method, which queries the database (slow). The result is stored in the cache under the key, with a time to live, and returned to the caller.',
        boxes: [b('p', 'Rate proxy', ['calls the real method'], 'ok'), b('d', 'Database', ['SELECT rate ... (40 ms)'], 'ok'), b('k', 'Cache', ['SGD/USD = 0.74', 'TTL 60 seconds'], 'ok', 'stored')],
        deps: [d('Rate proxy', 'Database', 'query', 'ok'), d('Rate proxy', 'Cache', 'put', 'ok')],
      },
      {
        note: 'Cache hit: the next call with the same key is answered from the cache. The real method and the database are not touched, so the call takes a fraction of a millisecond.',
        boxes: [b('c', 'Client', ['getRate("SGD/USD")'], 'new'), b('p', 'Rate proxy', ['returns the cached value'], 'ok'), b('k', 'Cache', ['SGD/USD = 0.74'], 'ok', 'hit')],
        deps: [d('Client', 'Rate proxy', 'call', 'ok'), d('Cache', 'Rate proxy', '0.74', 'ok')],
      },
      {
        note: 'When the rate changes, the data in the cache is stale. @CacheEvict (or @CachePut) on the update method removes or replaces the entry, and the TTL bounds how long stale data can live. A shared cache such as Redis keeps all instances consistent; a local cache (Caffeine) is faster but each instance has its own copy.',
        boxes: [b('u', 'Rate proxy', ['@CacheEvict("rates") on update'], 'warn'), b('k', 'Cache', ['SGD/USD entry removed'], 'warn', 'evicted'), b('d', 'Database', ['rate updated to 0.75'], 'ok')],
        deps: [d('Rate proxy', 'Cache', 'evict', 'warn')],
      },
    ],
  },
  {
    id: 'async',
    label: '@Async and thread pools',
    title: '@Async returns immediately and runs the work on another thread',
    frames: [
      {
        note: 'A request thread handles POST /transfers. After saving the transfer it must send a confirmation email, which takes 800 ms. Doing it inline makes every request wait for the mail server.',
        boxes: [b('c', 'Client', ['POST /transfers'], 'new'), b('r', 'Request thread', ['save transfer (20 ms)', 'send email (800 ms)'], 'warn', 'blocked'), b('m', 'Mail server', ['slow'], 'warn')],
        deps: [d('Request thread', 'Mail server', 'wait 800 ms', 'warn')],
      },
      {
        note: 'Mark the email method @Async and call it through another bean. The proxy submits the call to a TaskExecutor (a thread pool) and returns at once. The request thread finishes in 20 ms.',
        boxes: [b('r', 'Request thread', ['save transfer', 'notifier.send(...) returns immediately'], 'ok', 'free again'), b('e', 'Executor', ['task queue', 'pool: 4 threads'], 'new')],
        deps: [d('Request thread', 'Executor', 'submit task', 'ok')],
      },
      {
        note: 'A pool thread runs the email method in the background. Because it is on a different thread, the caller\'s transaction and security context are not available, and an exception does not reach the caller: use an AsyncUncaughtExceptionHandler, or return a CompletableFuture.',
        boxes: [b('e', 'Executor', ['pool thread 2 runs send()'], 'ok'), b('m', 'Mail server', ['email sent'], 'ok')],
        deps: [d('Executor', 'Mail server', 'send', 'ok')],
      },
      {
        note: 'Always configure the executor: the default in Boot is a bounded pool, but a custom ThreadPoolTaskExecutor lets you set core size, max size and queue capacity. An unbounded queue hides overload until memory runs out; a bounded queue with a rejection policy shows backpressure. For must-not-lose work, use a message queue or outbox instead.',
        boxes: [b('e', 'Executor', ['core 4, max 8, queue 100', 'rejects when full'], 'ok', 'bounded'), b('r', 'Request thread', ['gets TaskRejectedException when overloaded'], 'warn')],
        deps: [],
      },
    ],
  },
  {
    id: 'schedule',
    label: 'Scheduling in a cluster',
    title: '@Scheduled runs on every instance unless you coordinate it',
    frames: [
      {
        note: 'A @Scheduled(cron = "0 0 2 * * *") method generates the daily statements. With one instance it runs once a night.',
        boxes: [b('s', 'Scheduler', ['02:00 trigger'], 'new'), b('i1', 'Worker instance 1', ['generates statements'], 'ok')],
        deps: [d('Scheduler', 'Worker instance 1', 'run job', 'ok')],
      },
      {
        note: 'The service is scaled to three instances. Each has its own scheduler, and each fires at 02:00. The job runs three times: statements are generated and emailed in triplicate.',
        boxes: [b('s', 'Scheduler', ['02:00 on every instance'], 'bad'), b('i1', 'Worker instance 1', ['runs job'], 'bad'), b('i2', 'Worker instance 2', ['runs job'], 'bad'), b('i3', 'Worker instance 3', ['runs job'], 'bad')],
        deps: [d('Scheduler', 'Worker instance 1', 'run', 'bad'), d('Scheduler', 'Worker instance 2', 'run', 'bad'), d('Scheduler', 'Worker instance 3', 'run', 'bad')],
      },
      {
        note: 'Fix: take a distributed lock for the duration of the job. ShedLock (@SchedulerLock) writes a lock row (or Redis key) with a name and a lock-until time. Only the instance that acquires it runs the job.',
        boxes: [b('l', 'Lock table', ['statements: locked by instance 2', 'until 02:05'], 'ok', 'ShedLock'), b('i2', 'Worker instance 2', ['acquired the lock: runs'], 'ok'), b('i1', 'Worker instance 1', ['lock taken: skips'], 'none'), b('i3', 'Worker instance 3', ['lock taken: skips'], 'none')],
        deps: [d('Worker instance 2', 'Lock table', 'acquire', 'ok'), d('Worker instance 1', 'Lock table', 'refused', 'warn')],
      },
      {
        note: 'Also make the job idempotent and time-bounded: if the instance crashes mid-run the lock expires and another instance retries, so reprocessing must be safe. For heavy, retried or audited work use Spring Batch or Quartz with a clustered job store, or the dedicated distributed scheduler design.',
        boxes: [b('i2', 'Worker instance 2', ['crashed at 02:03'], 'bad'), b('l', 'Lock table', ['lock expires at 02:05'], 'warn', 'expires'), b('i3', 'Worker instance 3', ['next run takes over, idempotent'], 'ok', 'safe retry')],
        deps: [d('Worker instance 3', 'Lock table', 'acquire after expiry', 'ok')],
      },
    ],
  },
];
