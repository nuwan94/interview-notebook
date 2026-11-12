// Frame data for the concurrency walk-through demo.
// A frame is the whole picture after one step: what each thread is doing, and the shared things they touch.
// thread.state: running | blocked | waiting | idle | done. item.tone: ok | bad | warn | (none).

const T = (name, state, doing, locals) => ({ name, state, doing, locals });
const box = (title, items, sub) => ({ title, items, sub });
const i = (label, tone) => ({ label, tone });

export const CONCURRENCY_SCENES = [
  {
    id: 'race',
    label: 'Lost update',
    title: 'Two threads run count++ with no lock',
    frames: [
      {
        note: 'count++ looks like one step, but it is three: read the value, add one, write it back. Two threads A and B each run it once. The correct final value is 2.',
        threads: [T('Thread A', 'idle', 'about to run count++'), T('Thread B', 'idle', 'about to run count++')],
        boxes: [box('Shared field', [i('count = 0')])],
      },
      {
        note: 'A reads count and keeps 0 in its own local variable.',
        threads: [T('Thread A', 'running', 'read count', 'tmp = 0'), T('Thread B', 'idle', 'waiting for its turn')],
        boxes: [box('Shared field', [i('count = 0')])],
      },
      {
        note: 'The scheduler switches to B before A has written anything. B also reads 0.',
        threads: [T('Thread A', 'idle', 'paused after the read', 'tmp = 0'), T('Thread B', 'running', 'read count', 'tmp = 0')],
        boxes: [box('Shared field', [i('count = 0')])],
      },
      {
        note: 'A adds one and writes 1 back.',
        threads: [T('Thread A', 'running', 'write count = tmp + 1', 'tmp = 0'), T('Thread B', 'idle', 'paused', 'tmp = 0')],
        boxes: [box('Shared field', [i('count = 1')])],
      },
      {
        note: 'B resumes with its stale value and also writes 1. A\'s update is overwritten. The result is 1, not 2, with no error and no exception: a lost update. It is a race condition because the outcome depends on timing.',
        threads: [T('Thread A', 'done', 'finished', 'tmp = 0'), T('Thread B', 'running', 'write count = tmp + 1', 'tmp = 0')],
        boxes: [box('Shared field', [i('count = 1', 'bad'), i('expected 2', 'warn')])],
      },
    ],
  },
  {
    id: 'lock',
    label: 'With a lock',
    title: 'The same code inside synchronized',
    frames: [
      {
        note: 'Now the increment is inside synchronized (or uses AtomicInteger). Only the thread holding the lock may run the three steps.',
        threads: [T('Thread A', 'idle', 'about to enter the block'), T('Thread B', 'idle', 'about to enter the block')],
        boxes: [box('Lock', [i('free')]), box('Shared field', [i('count = 0')])],
      },
      {
        note: 'A takes the lock and reads the value. B arrives at the same moment and has to wait: it is BLOCKED.',
        threads: [T('Thread A', 'running', 'holds the lock, read count', 'tmp = 0'), T('Thread B', 'blocked', 'waiting for the lock')],
        boxes: [box('Lock', [i('held by A', 'warn')]), box('Shared field', [i('count = 0')])],
      },
      {
        note: 'A writes 1 and leaves the block, releasing the lock. Leaving the block also makes A\'s write visible to the next thread that takes the same lock (a happens-before edge).',
        threads: [T('Thread A', 'done', 'released the lock', 'tmp = 0'), T('Thread B', 'blocked', 'waiting for the lock')],
        boxes: [box('Lock', [i('free')]), box('Shared field', [i('count = 1')])],
      },
      {
        note: 'B gets the lock and reads 1, the up-to-date value.',
        threads: [T('Thread A', 'done', 'finished'), T('Thread B', 'running', 'holds the lock, read count', 'tmp = 1')],
        boxes: [box('Lock', [i('held by B', 'warn')]), box('Shared field', [i('count = 1')])],
      },
      {
        note: 'B writes 2. The result is correct. The price is that the two threads took turns for this short section: keep the locked section small.',
        threads: [T('Thread A', 'done', 'finished'), T('Thread B', 'done', 'released the lock', 'tmp = 1')],
        boxes: [box('Lock', [i('free')]), box('Shared field', [i('count = 2', 'ok')])],
      },
    ],
  },
  {
    id: 'deadlock',
    label: 'Deadlock',
    title: 'Two threads take two locks in opposite order',
    frames: [
      {
        note: 'Transfer money between two accounts: each thread must lock both. Thread 1 locks the source then the target. Thread 2 does a transfer the other way, so it locks them in the opposite order.',
        threads: [T('Thread 1', 'idle', 'transfer(A to B)'), T('Thread 2', 'idle', 'transfer(B to A)')],
        boxes: [box('Locks', [i('account A: free'), i('account B: free')])],
      },
      {
        note: 'Thread 1 locks account A. Thread 2 locks account B. So far nothing is wrong.',
        threads: [T('Thread 1', 'running', 'holds A', ''), T('Thread 2', 'running', 'holds B', '')],
        boxes: [box('Locks', [i('account A: Thread 1', 'warn'), i('account B: Thread 2', 'warn')])],
      },
      {
        note: 'Thread 1 now wants B, which Thread 2 holds, so it blocks. Thread 2 wants A, which Thread 1 holds, so it blocks. Each waits for the other to let go.',
        threads: [T('Thread 1', 'blocked', 'holds A, waiting for B'), T('Thread 2', 'blocked', 'holds B, waiting for A')],
        boxes: [box('Locks', [i('account A: Thread 1', 'bad'), i('account B: Thread 2', 'bad')])],
      },
      {
        note: 'This is a deadlock: neither can ever continue, and the program just hangs with no error. Four conditions must all hold: mutual exclusion, hold and wait, no preemption, and a circular wait. Breaking any one prevents it.',
        threads: [T('Thread 1', 'blocked', 'stuck forever'), T('Thread 2', 'blocked', 'stuck forever')],
        boxes: [box('Locks', [i('circular wait', 'bad')])],
      },
      {
        note: 'The usual fix is a global lock order: always lock the account with the lower id first. Then both threads try A first, one of them gets it, the other waits, and a cycle cannot form. Alternatives: tryLock with a timeout, or avoid holding two locks at once.',
        threads: [T('Thread 1', 'running', 'locks A, then B'), T('Thread 2', 'blocked', 'waits for A (same order)')],
        boxes: [box('Locks', [i('always A before B', 'ok')])],
      },
    ],
  },
  {
    id: 'pool',
    label: 'Thread pool',
    title: 'A pool with 2 core threads, 3 maximum and a queue of 2',
    frames: [
      {
        note: 'new ThreadPoolExecutor(2, 3, 60s, new ArrayBlockingQueue<>(2)). The rules for each submitted task: below the core size, start a thread; otherwise queue it; if the queue is full and the maximum has not been reached, start an extra thread; otherwise reject it.',
        threads: [T('worker 1', 'idle', 'not started'), T('worker 2', 'idle', 'not started'), T('worker 3', 'idle', 'not started')],
        boxes: [box('Queue (capacity 2)', []), box('Rejected', [])],
      },
      {
        note: 'Tasks 1 and 2 arrive. Fewer than 2 threads exist, so each gets a new thread.',
        threads: [T('worker 1', 'running', 'running task 1'), T('worker 2', 'running', 'running task 2'), T('worker 3', 'idle', 'not started')],
        boxes: [box('Queue (capacity 2)', []), box('Rejected', [])],
      },
      {
        note: 'Tasks 3 and 4 arrive. The core threads are busy, so they wait in the queue. Note that the pool prefers queuing to creating a third thread.',
        threads: [T('worker 1', 'running', 'running task 1'), T('worker 2', 'running', 'running task 2'), T('worker 3', 'idle', 'not started')],
        boxes: [box('Queue (capacity 2)', [i('task 3', 'warn'), i('task 4', 'warn')]), box('Rejected', [])],
      },
      {
        note: 'Task 5 arrives and the queue is full, but the maximum (3) is not reached, so a third worker starts for it.',
        threads: [T('worker 1', 'running', 'running task 1'), T('worker 2', 'running', 'running task 2'), T('worker 3', 'running', 'running task 5')],
        boxes: [box('Queue (capacity 2)', [i('task 3', 'warn'), i('task 4', 'warn')]), box('Rejected', [])],
      },
      {
        note: 'Task 6 arrives: all three threads are busy, the queue is full and the maximum is reached, so the pool applies its rejection policy. The default throws RejectedExecutionException. Other policies run it on the caller\'s thread, drop it, or drop the oldest.',
        threads: [T('worker 1', 'running', 'running task 1'), T('worker 2', 'running', 'running task 2'), T('worker 3', 'running', 'running task 5')],
        boxes: [box('Queue (capacity 2)', [i('task 3', 'warn'), i('task 4', 'warn')]), box('Rejected', [i('task 6', 'bad')])],
      },
      {
        note: 'Workers finish and pull the next task from the queue: worker 1 takes task 3 and worker 2 takes task 4. Extra threads above the core size die after the keep-alive time when idle.',
        threads: [T('worker 1', 'running', 'running task 3'), T('worker 2', 'running', 'running task 4'), T('worker 3', 'idle', 'idle (will time out)')],
        boxes: [box('Queue (capacity 2)', []), box('Rejected', [i('task 6', 'bad')])],
      },
    ],
  },
];
