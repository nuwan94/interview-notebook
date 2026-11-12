// Frame data for the distributed scheduler walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SCHEDULER_SCENES = [
  {
    id: 'duplicate',
    label: 'Duplicate runs and a lock',
    title: 'Every instance has @Scheduled, so the job runs once per instance unless something coordinates them',
    frames: [
      {
        note: 'The service runs as three instances behind a load balancer. Each one contains the same @Scheduled(cron = "0 0 2 * * *") method that sends the daily statement run. At 02:00 each instance has its own timer and does not know about the others.',
        boxes: [b('a', 'Scheduler instance A', ['timer: 02:00'], 'new'), b('b', 'Scheduler instance B', ['timer: 02:00'], 'new'), b('c', 'Scheduler instance C', ['timer: 02:00'], 'new')],
        deps: [],
      },
      {
        note: 'All three fire at the same time and run the job. The statements are generated and sent three times. Scaling out the service made the scheduled work wrong. The fix is to let only one instance run each tick.',
        boxes: [b('a', 'Scheduler instance A', ['runs the job'], 'bad', 'run 1'), b('b', 'Scheduler instance B', ['runs the job'], 'bad', 'run 2'), b('c', 'Scheduler instance C', ['runs the job'], 'bad', 'run 3')],
        deps: [],
      },
      {
        note: 'With a distributed lock (for example ShedLock) each instance first tries to take a named lock in a shared store with one atomic statement: update the lock row only if lock_until is in the past. The database guarantees that exactly one of them succeeds.',
        boxes: [b('a', 'Scheduler instance A', ['lock acquired until 02:05'], 'ok', 'winner'), b('b', 'Scheduler instance B', ['lock held by A: skip'], 'warn', 'skipped'), b('c', 'Scheduler instance C', ['lock held by A: skip'], 'warn', 'skipped'), b('l', 'Lock table', ['name: daily-statements', 'locked_by: A', 'lock_until: 02:05'], 'new')],
        deps: [d('Scheduler instance A', 'Lock table', 'UPDATE ... WHERE lock_until < now()  (1 row)', 'ok'), d('Scheduler instance B', 'Lock table', 'same UPDATE (0 rows)', 'bad')],
      },
      {
        note: 'Only A runs the job. lockAtMostFor protects against a crash (the lock expires by itself), and lockAtLeastFor stops a fast job from being run again by an instance with a slightly early clock. The job itself should still be idempotent.',
        boxes: [b('a', 'Scheduler instance A', ['job done in 40 s', 'releases or lets the lock expire'], 'ok', 'ran once'), b('l', 'Lock table', ['lock_until: 02:01 (lockAtLeastFor)'], 'ok')],
        deps: [d('Scheduler instance A', 'Lock table', 'unlock', 'ok')],
      },
    ],
  },
  {
    id: 'failover',
    label: 'Leader failover and fencing',
    title: 'Leader election with a lease: failover without two leaders',
    frames: [
      {
        note: 'Instead of locking each run, the instances elect one leader that does all scheduling. The leader holds a lease in a coordination store (etcd, ZooKeeper, Consul or a Kubernetes Lease) and must renew it every few seconds. The others stand by.',
        boxes: [b('a', 'Scheduler instance A', ['leader', 'renews the lease every 5 s'], 'ok', 'leader'), b('b', 'Scheduler instance B', ['standby'], 'none'), b('c', 'Scheduler instance C', ['standby'], 'none'), b('s', 'Coordination store', ['lease: A', 'fencing token 33', 'ttl 15 s'], 'new')],
        deps: [d('Scheduler instance A', 'Coordination store', 'renew lease', 'ok')],
      },
      {
        note: 'A freezes (a long garbage collection pause, a network partition or a crash) and stops renewing. Nobody can tell the difference between "dead" and "slow", so the others wait for the lease to expire.',
        boxes: [b('a', 'Scheduler instance A', ['frozen, no renewals'], 'bad', 'paused'), b('s', 'Coordination store', ['lease: A', 'ttl running out: 3 s left'], 'warn')],
        deps: [d('Scheduler instance A', 'Coordination store', 'no renewal arrives', 'bad')],
      },
      {
        note: 'The lease expires. B acquires it and receives a higher fencing token, 34. B is the new leader and starts scheduling. Failover took about one TTL.',
        boxes: [b('b', 'Scheduler instance B', ['new leader', 'fencing token 34'], 'ok', 'leader'), b('c', 'Scheduler instance C', ['standby'], 'none'), b('s', 'Coordination store', ['lease: B', 'fencing token 34'], 'new')],
        deps: [d('Scheduler instance B', 'Coordination store', 'acquire expired lease', 'ok')],
      },
      {
        note: 'A wakes up, still believing it is the leader, and tries to start a task. Its writes carry the old token 33, and the resource rejects any token lower than the highest it has seen. A fencing token makes the old leader harmless, which a lease alone cannot guarantee.',
        boxes: [b('a', 'Scheduler instance A', ['thinks it is leader', 'sends token 33'], 'bad', 'stale'), b('d', 'Task database', ['highest token seen: 34', 'rejects 33'], 'ok', 'fenced')],
        deps: [d('Scheduler instance A', 'Task database', 'write with token 33', 'bad')],
      },
    ],
  },
  {
    id: 'claim',
    label: 'Workers claim tasks',
    title: 'Database-backed task queue: workers claim due tasks safely and recover from crashes',
    frames: [
      {
        note: 'Tasks are rows in a table with a due time. Several workers poll the table. The scheduling state lives in the database, so any worker can run any task and there is no leader to fail.',
        boxes: [b('t', 'Task table', ['T1 due 02:00 NEW', 'T2 due 02:00 NEW', 'T3 due 02:05 NEW'], 'new'), b('w1', 'Worker 1', ['polling'], 'ok'), b('w2', 'Worker 2', ['polling'], 'ok')],
        deps: [d('Worker 1', 'Task table', 'poll', 'ok'), d('Worker 2', 'Task table', 'poll', 'ok')],
      },
      {
        note: 'Each worker runs SELECT ... WHERE due <= now() ... FOR UPDATE SKIP LOCKED LIMIT 1 and marks the row RUNNING with a lease (locked_until). SKIP LOCKED means a worker ignores rows another worker has locked, so they never block or double-claim.',
        boxes: [b('w1', 'Worker 1', ['claimed T1', 'locked_until 02:05'], 'ok', 'T1'), b('w2', 'Worker 2', ['claimed T2 (skipped locked T1)', 'locked_until 02:05'], 'ok', 'T2'), b('t', 'Task table', ['T1 RUNNING by W1', 'T2 RUNNING by W2', 'T3 NEW'], 'new')],
        deps: [d('Worker 1', 'Task table', 'claim: FOR UPDATE SKIP LOCKED', 'ok'), d('Worker 2', 'Task table', 'claim: skips the locked row', 'ok')],
      },
      {
        note: 'Worker 2 crashes halfway through T2. Nothing tells the table, so T2 stays RUNNING, but its lease will run out.',
        boxes: [b('w2', 'Worker 2', ['crashed'], 'bad', 'dead'), b('t', 'Task table', ['T2 RUNNING by W2', 'locked_until 02:05'], 'warn')],
        deps: [],
      },
      {
        note: 'After 02:05 the lease has expired. Worker 1 polls again, sees T2 RUNNING with an expired lease and reclaims it. The task runs a second time from the start, so tasks are delivered at least once and must be idempotent (keyed by task id and scheduled time).',
        boxes: [b('w1', 'Worker 1', ['reclaims T2 (lease expired)', 'runs it again'], 'ok', 'recovery'), b('t', 'Task table', ['T1 DONE', 'T2 RUNNING by W1', 'attempts: 2'], 'new')],
        deps: [d('Worker 1', 'Task table', 'reclaim expired lease', 'ok')],
      },
      {
        note: 'Workers also retry failed tasks with backoff and move tasks that fail too often to a dead state for a person to inspect. Adding workers adds throughput, because the database hands out different rows to each.',
        boxes: [b('t', 'Task table', ['T1 DONE', 'T2 DONE', 'T3 DONE at 02:05'], 'ok', 'all done'), b('w1', 'Worker 1', ['idle'], 'none'), b('w2', 'Worker 2', ['restarted, idle'], 'none')],
        deps: [],
      },
    ],
  },
];
