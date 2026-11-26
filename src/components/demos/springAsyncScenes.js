// Frame data for the caching, async and scheduling walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- cache-aside ---------- */
const client = (lines, o = {}) => ({ id: 'client', x: 14, y: 52, w: 130, title: 'Controller', lines, tone: 'new', ...o });
const proxy = (lines, o = {}) => ({ id: 'proxy', x: 176, y: 44, w: 160, title: 'Caching proxy', lines, tone: 'none', ...o });
const method = (lines, o = {}) => ({ id: 'method', x: 370, y: 52, w: 120, title: 'rate(pair)', lines, tone: 'none', ...o });
const cdb = (lines, o = {}) => ({ id: 'db', x: 520, y: 52, w: 106, title: 'Database', lines, tone: 'none', ...o });
const cache = (lines, o = {}) => ({ id: 'cache', x: 176, y: 160, w: 314, title: 'Cache "rates"', lines, mono: true, tone: 'none', ...o });

const cacheFrames = [
  {
    h: 240,
    line: 'rateService.rate("SGD/USD")   // @Cacheable("rates")',
    result: { text: 'miss', tone: 'warn' },
    cards: [client(['rate("SGD/USD")']), proxy(['key = "SGD/USD"', 'look in the cache first'], { tone: 'new' }), method(['not called yet'], { dim: true }), cdb(['rates table'], { dim: true }), cache(['(empty)'], { tone: 'warn', badge: 'miss' })],
    arrows: [{ from: 'client', to: 'proxy', fs: 'r', ts: 'l', tone: 'new' }, { from: 'proxy', to: 'cache', fs: 'b', ts: 't', tone: 'warn' }],
    note: 'rate() has @Cacheable("rates"). The call goes through the caching proxy, which builds the key "SGD/USD" and looks in the cache first. The cache is empty.',
  },
  {
    h: 240,
    line: 'miss  →  run the method, store the result',
    result: { text: '40 ms', tone: 'warn' },
    cards: [client(['rate("SGD/USD")']), proxy(['calls the real method', 'then stores the result'], { tone: 'ok' }), method(['runs'], { tone: 'ok' }), cdb(['select rate…', '40 ms'], { tone: 'ok' }), cache(['SGD/USD = 0.74   ttl 60 s'], { tone: 'ok', badge: 'stored' })],
    arrows: [{ from: 'proxy', to: 'method', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'method', to: 'db', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'proxy', to: 'cache', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'On a miss, the proxy calls the real method, which queries the database. That is slow. The proxy stores the result under the key, with a time to live, and returns it.',
  },
  {
    h: 240,
    line: 'rateService.rate("SGD/USD")   // again',
    result: { text: 'hit: under 1 ms', tone: 'ok' },
    cards: [client(['rate("SGD/USD")']), proxy(['returns the cached value'], { tone: 'ok' }), method(['skipped'], { dim: true }), cdb(['not touched'], { dim: true }), cache(['SGD/USD = 0.74   ttl 41 s'], { tone: 'ok', badge: 'hit' })],
    arrows: [{ from: 'client', to: 'proxy', fs: 'r', ts: 'l', tone: 'new' }, { from: 'cache', to: 'proxy', fs: 't', ts: 'b', tone: 'ok' }],
    note: 'The next call with the same key is answered from the cache. The real method and the database are not touched, so the call takes a fraction of a millisecond.',
  },
  {
    h: 240,
    line: 'update("SGD/USD", 0.75)   // @CacheEvict',
    result: { text: 'stale entry removed', tone: 'ok' },
    cards: [
      client(['update(…, 0.75)']),
      proxy(['@CacheEvict', 'removes the entry'], { tone: 'warn' }),
      method(['saves 0.75'], { tone: 'ok' }),
      cdb(['rate = 0.75'], { tone: 'ok' }),
      cache([{ t: 'SGD/USD = 0.74   ttl 30 s', strike: true }], { tone: 'warn', badge: 'evicted' }),
    ],
    arrows: [{ from: 'proxy', to: 'method', fs: 'r', ts: 'l' }, { from: 'method', to: 'db', fs: 'r', ts: 'l' }, { from: 'proxy', to: 'cache', fs: 'b', ts: 't', tone: 'warn' }],
    note: 'When the rate changes, the cached value is stale. @CacheEvict (or @CachePut) on the update method removes or replaces the entry. The TTL limits how long stale data can survive. Redis keeps all instances in agreement; a local Caffeine cache is faster, but each instance has its own copy.',
  },
];

/* ---------- @Async: thread timelines ---------- */
const X0 = 120;
const SCALE = 0.55; // px per ms
const tx = (ms) => X0 + ms * SCALE;
let uid = 0;
const bar = (y, t0, t1, title, tone = 'ok', o = {}) => ({ id: `a${uid++}`, x: tx(t0), y, w: (t1 - t0) * SCALE, h: 30, title, tone, ...o });
const lane = (y, t) => ({ x: 14, y: y + 20, t });
const timeArrow = (y) => ({ x: 540, y, t: 'time  →' });
const RQ = 40, P1 = 96;

const asyncFrames = [
  {
    h: 200,
    line: 'save(..); mailer.send(..);   // inline',
    result: { text: 'request takes 820 ms', tone: 'warn' },
    texts: [lane(RQ, 'request thread'), timeArrow(176)],
    cards: [bar(RQ, 0, 80, 'save', 'new'), bar(RQ, 80, 880, 'send email: waits for the mail server', 'warn')],
    note: 'A request thread handles POST /transfers. Saving takes 20 ms. Then it sends a confirmation email, which takes 800 ms. Done inline, every request waits for the mail server.',
  },
  {
    h: 200,
    line: '@Async("emailExecutor")  void send(Email e)',
    result: { text: 'request takes 30 ms', tone: 'ok' },
    texts: [lane(RQ, 'request thread'), lane(P1, 'email-1'), timeArrow(176)],
    cards: [bar(RQ, 0, 80, 'save', 'new'), bar(RQ, 80, 110, '', 'ok', { id: 'submit' }), bar(P1, 110, 910, 'send email, in the background', 'ok', { id: 'work' })],
    arrows: [{ from: 'submit', to: 'work', fs: 'b', ts: 'l', tone: 'ok' }],
    note: 'Mark the email method @Async and call it through another bean. The proxy hands the call to a thread pool and returns at once. The request finishes in about 30 ms, and a pool thread sends the email.',
  },
  {
    h: 250,
    line: 'a different thread: ThreadLocals do not follow',
    result: { text: 'context lost', tone: 'warn' },
    texts: [lane(RQ, 'request thread'), lane(P1, 'email-1'), timeArrow(226)],
    cards: [
      bar(RQ, 0, 80, 'save', 'new'), bar(RQ, 80, 110, '', 'ok'), bar(P1, 110, 910, 'send email, in the background', 'ok'),
      { id: 'has', x: 14, y: 150, w: 290, title: 'request thread has', lines: ['transaction, SecurityContext, MDC'], tone: 'ok' },
      { id: 'lacks', x: 336, y: 150, w: 290, title: 'pool thread has', lines: ['none of them, unless you copy them'], tone: 'warn' },
    ],
    note: 'The pool thread is a different thread. The caller\'s transaction, security context and MDC (log correlation) do not come along. An exception in a void method never reaches the caller: use an AsyncUncaughtExceptionHandler, or return a CompletableFuture.',
  },
  {
    h: 250,
    line: '2 threads, queue of 2: all full',
    result: { text: 'TaskRejectedException', tone: 'bad' },
    texts: [lane(RQ, 'email-1'), lane(RQ + 46, 'email-2'), timeArrow(226)],
    cards: [
      bar(RQ, 0, 900, 'busy', 'warn'), bar(RQ + 46, 0, 900, 'busy', 'warn'),
      { id: 'q', x: 14, y: 150, w: 290, title: 'queue (capacity 2)', lines: ['task 3, task 4'], mono: true, tone: 'warn', badge: 'full' },
      { id: 'rej', x: 336, y: 150, w: 290, title: 'task 5', lines: ['rejected: the caller sees it'], tone: 'bad' },
    ],
    note: 'Always configure the pool: core size, max size and a bounded queue. When everything is full, a bounded queue rejects work, so overload is visible. An unbounded queue hides it until memory runs out. Work that must never be lost belongs in a message queue or an outbox, not @Async.',
  },
];

/* ---------- scheduling in a cluster ---------- */
const inst = (n, lines, o = {}) => ({ id: `i${n}`, x: 14, y: 30 + (n - 1) * 76, w: 210, title: `instance ${n}`, lines, tone: 'none', ...o });
const lock = (lines, o = {}) => ({ id: 'lock', x: 380, y: 86, w: 246, title: 'shedlock table', lines, mono: true, tone: 'none', ...o });

const scheduleFrames = [
  {
    h: 260,
    line: '@Scheduled(cron = "0 0 2 * * *")',
    result: { text: 'runs once', tone: 'ok' },
    cards: [inst(1, ['02:00: generates statements'], { tone: 'ok' }), { id: 'out', x: 380, y: 30, w: 246, title: 'statements sent', lines: ['once per customer'], tone: 'ok' }],
    arrows: [{ from: 'i1', to: 'out', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A @Scheduled method generates the daily statements at 02:00. With one instance, it runs once a night.',
  },
  {
    h: 260,
    line: 'scaled to 3 replicas',
    result: { text: 'statements sent 3 times', tone: 'bad' },
    cards: [
      inst(1, ['02:00: runs the job'], { tone: 'bad' }), inst(2, ['02:00: runs the job'], { tone: 'bad' }), inst(3, ['02:00: runs the job'], { tone: 'bad' }),
      { id: 'out', x: 380, y: 106, w: 246, title: 'statements sent', lines: ['three times per customer'], tone: 'bad' },
    ],
    arrows: [{ from: 'i1', to: 'out', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'i2', to: 'out', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'i3', to: 'out', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'The service is scaled to three instances. Each has its own scheduler, and each fires at 02:00. The job runs three times, and every customer gets three statements.',
  },
  {
    h: 260,
    line: '@SchedulerLock(name = "dailyStatements")',
    result: { text: 'runs once', tone: 'ok' },
    cards: [
      inst(1, ['lock taken: skips'], { dim: true }), inst(2, ['got the lock: runs'], { tone: 'ok' }), inst(3, ['lock taken: skips'], { dim: true }),
      lock(['dailyStatements', 'locked_by  instance 2', 'lock_until 02:30'], { tone: 'ok', badge: 'ShedLock' }),
    ],
    arrows: [{ from: 'i2', to: 'lock', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The fix is a distributed lock for the duration of the job. ShedLock writes a lock row (or a Redis key) with a name and a lock-until time. Only the instance that gets the lock runs the job; the others skip it.',
  },
  {
    h: 260,
    line: 'instance 2 crashes at 02:03',
    result: { text: 'safe retry', tone: 'ok' },
    cards: [
      inst(1, ['waits'], { dim: true }), inst(2, ['crashed mid-run'], { tone: 'bad' }), inst(3, ['next run: gets the lock', 'idempotent job'], { tone: 'ok' }),
      lock(['dailyStatements', 'locked_by  instance 2', { t: 'lock_until 02:30', strike: true }], { tone: 'warn', badge: 'expired' }),
    ],
    arrows: [{ from: 'i3', to: 'lock', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Make the job idempotent and time-bounded. If an instance crashes mid-run, the lock expires and another instance retries, so reprocessing must be safe. For heavy, retried or audited work, use Spring Batch, Quartz with a clustered job store, or a Kubernetes CronJob.',
  },
];

export const SPRING_ASYNC_SCENES = [
  { id: 'cache', label: 'Cache-aside', title: '@Cacheable: the first call hits the database, later calls hit the cache', stage: BoardStage, frames: cacheFrames },
  { id: 'async', label: '@Async and thread pools', title: '@Async returns immediately and runs the work on another thread', stage: BoardStage, frames: asyncFrames },
  { id: 'schedule', label: 'Scheduling in a cluster', title: '@Scheduled runs on every instance unless you coordinate it', stage: BoardStage, frames: scheduleFrames },
];
