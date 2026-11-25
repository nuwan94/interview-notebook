// Frame data for the concurrency walk-through. Every scene brings its own picture (stage):
// ThreadRaceStage for the lost update and the lock, DeadlockStage, and ThreadPoolStage.

import { ThreadRaceStage } from './ThreadRaceStage.jsx';
import { DeadlockStage } from './DeadlockStage.jsx';
import { ThreadPoolStage } from './ThreadPoolStage.jsx';

const T = (name, state, at, tmp) => ({ name, state, at, tmp });
const step = (t, text) => ({ t, text });

const RACE_CODE = ['int tmp = count;   // read', 'tmp = tmp + 1;     // add', 'count = tmp;       // write'];
const LOCK_CODE = ['synchronized (lock) {', '  int tmp = count;', '  count = tmp + 1;', '}'];

export const CONCURRENCY_SCENES = [
  {
    id: 'race',
    label: 'Lost update',
    title: 'Two threads run count++ with no lock, and one update is lost',
    stage: ThreadRaceStage,
    frames: (() => {
      const s1 = [step(0, 'read 0')];
      const s2 = [...s1, step(1, 'read 0')];
      const s3 = [...s2, step(0, 'write 1')];
      const s4 = [...s3, step(1, 'write 1')];
      return [
        {
          line: 'count++;   // run once by Thread A and once by Thread B',
          code: RACE_CODE,
          threads: [T('Thread A', 'idle', null, null), T('Thread B', 'idle', null, null)],
          count: { value: 0 },
          arrow: null,
          steps: [],
          note: 'count++ looks like one step, but it is three: read the value, add one, write it back. Thread A and Thread B each run it once. Each thread keeps its own copy, tmp, on its own stack. The correct result is 2.',
        },
        {
          line: 'Thread A: int tmp = count;',
          code: RACE_CODE,
          threads: [T('Thread A', 'running', 0, 0), T('Thread B', 'idle', null, null)],
          count: { value: 0 },
          arrow: { thread: 0, dir: 'read', label: 'read 0' },
          steps: s1,
          note: 'Thread A reads count and keeps the value 0 in its own variable tmp.',
        },
        {
          line: 'Thread B: int tmp = count;',
          code: RACE_CODE,
          threads: [T('Thread A', 'paused', 1, 0), T('Thread B', 'running', 0, 0)],
          count: { value: 0 },
          arrow: { thread: 1, dir: 'read', label: 'read 0' },
          steps: s2,
          note: 'The scheduler switches to Thread B before A has written anything. So B also reads 0.',
        },
        {
          line: 'Thread A: count = tmp;   // tmp + 1 = 1',
          code: RACE_CODE,
          threads: [T('Thread A', 'running', 2, 1), T('Thread B', 'paused', 1, 0)],
          count: { value: 1 },
          arrow: { thread: 0, dir: 'write', label: 'write 1' },
          steps: s3,
          note: 'Thread A adds one and writes 1 back to count.',
        },
        {
          line: 'Thread B: count = tmp;   // tmp + 1 = 1',
          result: { text: 'count = 1, but 2 was expected', tone: 'bad' },
          code: RACE_CODE,
          threads: [T('Thread A', 'done', null, 1), T('Thread B', 'running', 2, 1)],
          count: { value: 1, tone: 'bad' },
          arrow: { thread: 1, dir: 'write', label: 'write 1' },
          steps: s4,
          note: 'Thread B continues with its old value and also writes 1. A\'s update is overwritten. The result is 1, not 2, and there is no error or exception. This is a lost update. It is a race condition, because the result depends on timing.',
        },
      ];
    })(),
  },
  {
    id: 'lock',
    label: 'With a lock',
    title: 'The same code inside synchronized: the threads take turns',
    stage: ThreadRaceStage,
    frames: (() => {
      const s1 = [step(0, 'locks'), step(0, 'read 0')];
      const s2 = [...s1, step(0, 'write 1'), step(0, 'unlocks')];
      const s3 = [...s2, step(1, 'locks'), step(1, 'read 1')];
      const s4 = [...s3, step(1, 'write 2'), step(1, 'unlocks')];
      return [
        {
          line: 'synchronized (lock) { count++; }',
          code: LOCK_CODE,
          threads: [T('Thread A', 'idle', null, null), T('Thread B', 'idle', null, null)],
          count: { value: 0 },
          lock: { owner: null, waiting: null },
          arrow: null,
          steps: [],
          note: 'Now the increment is inside a synchronized block. Only the thread that holds the lock may run the steps inside it. An AtomicInteger would also work.',
        },
        {
          line: 'Thread A takes the lock and reads count',
          code: LOCK_CODE,
          threads: [T('Thread A', 'running', 1, 0), T('Thread B', 'blocked', 0, null)],
          count: { value: 0 },
          lock: { owner: 0, waiting: 1 },
          arrow: { thread: 0, dir: 'read', label: 'read 0' },
          steps: s1,
          note: 'Thread A takes the lock and reads 0. Thread B arrives at the same moment and must wait. Its state is BLOCKED.',
        },
        {
          line: 'Thread A writes 1 and leaves the block',
          code: LOCK_CODE,
          threads: [T('Thread A', 'done', 3, 0), T('Thread B', 'blocked', 0, null)],
          count: { value: 1 },
          lock: { owner: null, waiting: 1 },
          arrow: { thread: 0, dir: 'write', label: 'write 1' },
          steps: s2,
          note: 'Thread A writes 1 and leaves the block, which releases the lock. Leaving the block also makes A\'s write visible to the next thread that takes the same lock. This is a happens-before edge.',
        },
        {
          line: 'Thread B takes the lock and reads count',
          code: LOCK_CODE,
          threads: [T('Thread A', 'done', null, 0), T('Thread B', 'running', 1, 1)],
          count: { value: 1 },
          lock: { owner: 1, waiting: null },
          arrow: { thread: 1, dir: 'read', label: 'read 1' },
          steps: s3,
          note: 'Thread B gets the lock and reads 1, the up-to-date value.',
        },
        {
          line: 'Thread B writes 2 and leaves the block',
          result: { text: 'count = 2, correct', tone: 'ok' },
          code: LOCK_CODE,
          threads: [T('Thread A', 'done', null, 0), T('Thread B', 'done', 3, 1)],
          count: { value: 2, tone: 'ok' },
          lock: { owner: null, waiting: null },
          arrow: { thread: 1, dir: 'write', label: 'write 2' },
          steps: s4,
          note: 'Thread B writes 2, and the result is correct. The price is that the two threads took turns for this section. So keep the locked section small.',
        },
      ];
    })(),
  },
  {
    id: 'deadlock',
    label: 'Deadlock',
    title: 'Two threads take two locks in opposite order, and both wait for ever',
    stage: DeadlockStage,
    frames: [
      {
        line: 'Thread 1: transfer(A → B)   Thread 2: transfer(B → A)',
        threads: [
          { name: 'Thread 1', state: 'idle', doing: 'transfer(A → B)', doing2: 'locks A, then B' },
          { name: 'Thread 2', state: 'idle', doing: 'transfer(B → A)', doing2: 'locks B, then A' },
        ],
        locks: { A: null, B: null },
        edges: [],
        note: 'Two threads move money between account A and account B. Each transfer must lock both accounts. Thread 1 locks the source first and then the target. Thread 2 transfers the other way, so it locks them in the opposite order.',
      },
      {
        line: 'Thread 1: synchronized (A)   Thread 2: synchronized (B)',
        threads: [
          { name: 'Thread 1', state: 'running', doing: 'transfer(A → B)', doing2: 'holds A' },
          { name: 'Thread 2', state: 'running', doing: 'transfer(B → A)', doing2: 'holds B' },
        ],
        locks: { A: 1, B: 2 },
        edges: [{ t: 1, lock: 'A', kind: 'hold' }, { t: 2, lock: 'B', kind: 'hold' }],
        note: 'Thread 1 locks account A. At the same time, Thread 2 locks account B. So far nothing is wrong.',
      },
      {
        line: 'Thread 1: synchronized (B)   Thread 2: synchronized (A)',
        threads: [
          { name: 'Thread 1', state: 'blocked', doing: 'transfer(A → B)', doing2: 'holds A, waits for B' },
          { name: 'Thread 2', state: 'blocked', doing: 'transfer(B → A)', doing2: 'holds B, waits for A' },
        ],
        locks: { A: 1, B: 2 },
        edges: [{ t: 1, lock: 'A', kind: 'hold' }, { t: 2, lock: 'B', kind: 'hold' }, { t: 1, lock: 'B', kind: 'wait' }, { t: 2, lock: 'A', kind: 'wait' }],
        note: 'Now Thread 1 wants B, but Thread 2 holds it, so Thread 1 blocks. Thread 2 wants A, but Thread 1 holds it, so Thread 2 blocks too. Each one waits for the other to let go.',
      },
      {
        line: 'Both threads wait for ever',
        result: { text: 'deadlock: the program hangs, with no error', tone: 'bad' },
        threads: [
          { name: 'Thread 1', state: 'blocked', doing: 'transfer(A → B)', doing2: 'stuck for ever' },
          { name: 'Thread 2', state: 'blocked', doing: 'transfer(B → A)', doing2: 'stuck for ever' },
        ],
        locks: { A: 1, B: 2 },
        edges: [{ t: 1, lock: 'A', kind: 'hold' }, { t: 2, lock: 'B', kind: 'hold' }, { t: 1, lock: 'B', kind: 'wait' }, { t: 2, lock: 'A', kind: 'wait' }],
        cycle: true,
        note: 'Follow the arrows: they form a circle. This is a deadlock. Neither thread can ever continue, and the program just hangs with no error. A deadlock needs four conditions: mutual exclusion, hold and wait, no preemption and a circular wait. Breaking any one of them prevents it.',
      },
      {
        line: 'Fix: always lock the lower account id first, so A before B',
        result: { text: 'no circle, so no deadlock', tone: 'ok' },
        threads: [
          { name: 'Thread 1', state: 'running', doing: 'transfer(A → B)', doing2: 'holds A and B' },
          { name: 'Thread 2', state: 'blocked', doing: 'transfer(B → A)', doing2: 'waits for A first' },
        ],
        locks: { A: 1, B: 1 },
        edges: [{ t: 1, lock: 'A', kind: 'hold' }, { t: 1, lock: 'B', kind: 'hold' }, { t: 2, lock: 'A', kind: 'wait', tone: 'warn' }],
        note: 'The usual fix is one global lock order: always lock the account with the lower id first. Now both threads try A first. Thread 1 gets it, and Thread 2 waits without holding anything. So a circle cannot form. Other fixes are tryLock with a timeout, or not holding two locks at once.',
      },
      {
        line: 'Thread 1 finishes; Thread 2 locks A, then B',
        result: { text: 'both transfers complete', tone: 'ok' },
        threads: [
          { name: 'Thread 1', state: 'done', doing: 'transfer(A → B)', doing2: 'released A and B' },
          { name: 'Thread 2', state: 'running', doing: 'transfer(B → A)', doing2: 'holds A and B' },
        ],
        locks: { A: 2, B: 2 },
        edges: [{ t: 2, lock: 'A', kind: 'hold' }, { t: 2, lock: 'B', kind: 'hold' }],
        note: 'Thread 1 finishes its transfer and releases both locks. Thread 2 then takes A and B in the same order, and both transfers complete.',
      },
    ],
  },
  {
    id: 'pool',
    label: 'Thread pool',
    title: 'A pool with 2 core threads, 3 at most and a queue of 2',
    stage: ThreadPoolStage,
    frames: (() => {
      const off = { state: 'off' };
      const run = (n) => ({ state: 'running', task: `task ${n}` });
      return [
        {
          line: 'new ThreadPoolExecutor(2, 3, 60s, new ArrayBlockingQueue<>(2))',
          submitted: 0,
          current: [],
          workers: [off, off, off],
          queue: [],
          rejected: [],
          rule: null,
          note: 'This pool has 2 core threads, at most 3 threads, and a queue that holds 2 tasks. For each new task it checks four rules in order, shown on the right. No thread exists yet.',
        },
        {
          line: 'pool.execute(task 1); pool.execute(task 2);',
          submitted: 2,
          current: [1, 2],
          workers: [run(1), run(2), off],
          queue: [],
          rejected: [],
          rule: 1,
          arrows: [{ n: 1, to: 'w0' }, { n: 2, to: 'w1' }],
          note: 'Tasks 1 and 2 arrive. Fewer than 2 threads exist, so the pool starts a new thread for each of them.',
        },
        {
          line: 'pool.execute(task 3); pool.execute(task 4);',
          submitted: 4,
          current: [3, 4],
          workers: [run(1), run(2), off],
          queue: ['task 3', 'task 4'],
          rejected: [],
          rule: 2,
          arrows: [{ n: 3, to: 'q0' }, { n: 4, to: 'q1' }],
          note: 'Tasks 3 and 4 arrive. Both core threads are busy, so the tasks wait in the queue. Note that the pool fills the queue before it starts a third thread.',
        },
        {
          line: 'pool.execute(task 5);',
          submitted: 5,
          current: [5],
          workers: [run(1), run(2), run(5)],
          queue: ['task 3', 'task 4'],
          rejected: [],
          rule: 3,
          arrows: [{ n: 5, to: 'w2' }],
          note: 'Task 5 arrives and the queue is full. But only 2 of the 3 allowed threads exist, so the pool starts an extra thread for task 5.',
        },
        {
          line: 'pool.execute(task 6);',
          result: { text: 'RejectedExecutionException (the default policy)', tone: 'bad' },
          submitted: 6,
          current: [6],
          workers: [run(1), run(2), run(5)],
          queue: ['task 3', 'task 4'],
          rejected: ['task 6'],
          rule: 4,
          arrows: [{ n: 6, to: 'rej' }],
          note: 'Task 6 arrives. All three threads are busy, the queue is full and the maximum is reached. So the pool applies its rejection policy. The default throws RejectedExecutionException. Other policies run the task on the caller\'s thread, drop it, or drop the oldest queued task.',
        },
        {
          line: 'Workers finish and take the next task from the queue',
          submitted: 6,
          current: [],
          workers: [run(3), run(4), { state: 'idle', task: 'times out' }],
          queue: [],
          rejected: ['task 6'],
          rule: null,
          note: 'Workers 1 and 2 finish and take the next tasks from the queue: task 3 and task 4. Worker 3 is above the core size, so it stops after 60 seconds without work (the keep-alive time).',
        },
      ];
    })(),
  },
];
