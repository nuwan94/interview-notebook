// Frame data for the "JVM troubleshooting" walk-through.
// triage: the icon graph (each symptom leads through a chain of tools, so boxes and arrows are the real picture).
// leak: LeakStage (the GC log chart and the heap dump). cpu: CpuStage (the terminal output of each step).
// deadlock: LockStage (threads and locks on a ring, so the wait-for cycle is visible).
// box.tone: ok | bad | warn | new | none.

import { LeakStage } from './LeakStage.jsx';
import { CpuStage } from './CpuStage.jsx';
import { LockStage } from './LockStage.jsx';

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

const REPORT = [
  'Found one Java-level deadlock:',
  '"transfer-1": waiting to lock monitor 0x...0a10 (a Account),',
  '  which is held by "transfer-2"',
  '"transfer-2": waiting to lock monitor 0x...0b28 (a Account),',
  '  which is held by "transfer-1"',
];

export const JVM_SCENES = [
  {
    id: 'triage',
    label: 'Symptom to tool',
    title: 'Start from the symptom, then pick the tool',
    frames: [
      {
        note: 'High CPU. Do not guess. First find the busy thread: top -H shows the CPU used by each thread. Then take a thread dump and read that thread\'s stack. The stack usually names the loop, the regular expression or the hot method.',
        boxes: [b('s', 'High CPU', ['one core at 100%'], 'bad'), b('t', 'Busy thread', ['top -H -p pid'], 'warn'), b('d', 'Thread dump', ['jcmd pid Thread.print'], 'new'), b('c', 'Hot code', ['the stack names it'], 'ok')],
        deps: [d('High CPU', 'Busy thread', 'find', 'warn'), d('Busy thread', 'Thread dump', 'match its id', 'ok'), d('Thread dump', 'Hot code', 'read the stack', 'ok')],
      },
      {
        note: 'Memory keeps growing. The GC log tells a leak apart from a program that just creates many objects. If the heap after each full GC is higher every time, objects are being kept. Then a heap dump shows what holds them.',
        boxes: [b('s', 'Heap keeps growing', ['OutOfMemoryError soon'], 'bad'), b('g', 'GC log', ['old gen stays high'], 'warn'), b('h', 'Heap dump', ['jcmd pid GC.heap_dump'], 'new'), b('c', 'Leaking collection', ['dominator tree'], 'ok')],
        deps: [d('Heap keeps growing', 'GC log', 'check', 'warn'), d('GC log', 'Heap dump', 'if it never falls', 'ok'), d('Heap dump', 'Leaking collection', 'analyse', 'ok')],
      },
      {
        note: 'Requests hang while CPU is low. The threads are waiting, not working. Take three thread dumps ten seconds apart. Threads stuck in the same place in every dump wait for a lock, a full connection pool or a slow downstream call.',
        boxes: [b('s', 'Requests hang', ['CPU is low'], 'bad'), b('d', 'Thread dump', ['three, 10 s apart'], 'new'), b('t', 'Blocked threads', ['same place each time'], 'warn'), b('c', 'Root cause', ['deadlock or full pool'], 'ok')],
        deps: [d('Requests hang', 'Thread dump', 'take', 'warn'), d('Thread dump', 'Blocked threads', 'compare', 'ok'), d('Blocked threads', 'Root cause', 'follow the lock', 'ok')],
      },
      {
        note: 'The pod is OOMKilled, but the heap looks fine. The kernel counts the whole process, not just the heap: Metaspace, thread stacks, direct buffers and the code cache count too. Native Memory Tracking splits the total by area.',
        boxes: [b('s', 'Pod OOMKilled', ['exit code 137'], 'bad'), b('h', 'Heap vs process', ['heap is only part'], 'warn'), b('n', 'Native memory tracking', ['VM.native_memory'], 'new'), b('c', 'Off-heap growth', ['threads or buffers'], 'ok')],
        deps: [d('Pod OOMKilled', 'Heap vs process', 'compare', 'warn'), d('Heap vs process', 'Native memory tracking', 'measure', 'ok'), d('Native memory tracking', 'Off-heap growth', 'by area', 'ok')],
      },
    ],
  },
  {
    id: 'leak',
    label: 'Heap dump',
    title: 'Finding a memory leak: the GC log first, then a heap dump',
    stage: LeakStage,
    frames: [
      {
        chart: 'leak',
        dump: 'none',
        note: 'The GC log shows the pattern of a leak. Each drop is a garbage collection. The red dots show the heap after each GC, and they climb every time, because the old generation is full of objects that are still reachable. Soon the heap hits its limit and the JVM throws OutOfMemoryError.',
      },
      {
        chart: 'leak',
        dump: 'file',
        note: 'Take a heap dump while the problem is there. jcmd GC.heap_dump asks a running JVM for one. The flag -XX:+HeapDumpOnOutOfMemoryError writes one automatically when the error happens. The file lists every object and every reference.',
      },
      {
        chart: 'leak',
        dump: 'tree',
        note: 'Open the file in Eclipse MAT (or VisualVM, or IntelliJ). The dominator tree sorts objects by retained size: the memory that would be freed if that object were gone. The top entry is usually the leak. Here one map keeps 3.1 GB alive.',
      },
      {
        chart: 'leak',
        dump: 'path',
        note: 'Run "path to GC roots" on the biggest object. A GC root is something the collector must treat as alive, such as a static field, a thread or a stack variable. Here the static field PaymentCache.ALL holds a map with 1.2 million entries, and nothing ever removes them.',
      },
      {
        chart: 'fixed',
        dump: 'fixed',
        note: 'Fix the cause, not the heap size. The cache now has a size limit and an expiry. After the change, the heap after each GC stays flat. That is the proof that the leak is gone.',
      },
    ],
  },
  {
    id: 'cpu',
    label: 'High CPU',
    title: 'Which thread is using the CPU?',
    stage: CpuStage,
    frames: [
      {
        step: 1,
        note: 'The process is at 97% CPU. Run top -H -p with the process id. The -H flag lists threads, so you see that one thread, id 4377, uses almost all of it. top shows this id in decimal.',
      },
      {
        step: 2,
        note: 'A thread dump shows the same id in hexadecimal, as nid. So convert the number: printf "%x" 4377 gives 1119, and the thread is nid=0x1119.',
      },
      {
        step: 3,
        note: 'Take a thread dump with jcmd 4212 Thread.print and search it for nid=0x1119. Take two or three dumps a few seconds apart, to check the thread is in the same code every time. Here it is RUNNABLE inside a regular expression.',
      },
      {
        step: 4,
        note: 'The stack points to a regular expression run on user input. A pattern with nested repetition can backtrack for exponential time on a long string, which keeps a core busy. That is also a denial-of-service risk, so the fix is both a speed fix and a security fix.',
      },
    ],
  },
  {
    id: 'deadlock',
    label: 'Deadlock',
    title: 'Two transfers wait for each other forever',
    stage: LockStage,
    frames: [
      {
        nodes: { t1: { sub: 'moving money A to B', tone: 'none' }, t2: { sub: 'moving money B to A', tone: 'none' }, a: { sub: 'held by transfer-1' }, b: { sub: 'held by transfer-2' } },
        edges: [d('a', 't1', 'held by', 'ok'), d('b', 't2', 'held by', 'ok')],
        note: 'Two threads move money between the same two accounts, in opposite directions. Each one locks its source account first. So transfer-1 holds the lock of account A, and transfer-2 holds the lock of account B.',
      },
      {
        nodes: { t1: { sub: 'BLOCKED: wants B', tone: 'bad' }, t2: { sub: 'BLOCKED: wants A', tone: 'bad' }, a: { sub: 'held by transfer-1' }, b: { sub: 'held by transfer-2' } },
        edges: [d('a', 't1', 'held by', 'ok'), d('t1', 'b', 'waits for', 'bad'), d('b', 't2', 'held by', 'ok'), d('t2', 'a', 'waits for', 'bad')],
        center: { text: 'A cycle: nobody can move', tone: 'bad' },
        note: 'Now each thread needs the lock that the other one holds. Neither releases its own lock while it waits. The arrows form a closed loop, and that loop is a deadlock: the threads wait forever, CPU stays low, and requests for those accounts hang.',
      },
      {
        nodes: { t1: { sub: 'BLOCKED: wants B', tone: 'bad' }, t2: { sub: 'BLOCKED: wants A', tone: 'bad' }, a: { sub: 'held by transfer-1' }, b: { sub: 'held by transfer-2' } },
        edges: [d('a', 't1', 'held by', 'ok'), d('t1', 'b', 'waits for', 'bad'), d('b', 't2', 'held by', 'ok'), d('t2', 'a', 'waits for', 'bad')],
        center: { text: 'A cycle: nobody can move', tone: 'bad' },
        report: REPORT,
        note: 'A thread dump finds it for you. The JVM looks for cycles of locks and prints "Found one Java-level deadlock" at the end of the dump. For each thread it names the lock it holds and the lock it waits for.',
      },
      {
        nodes: { t1: { sub: 'has A, now takes B', tone: 'ok' }, t2: { sub: 'waits for A first', tone: 'warn' }, a: { sub: 'held by transfer-1' }, b: { sub: 'free' } },
        edges: [d('a', 't1', 'held by', 'ok'), d('t1', 'b', 'locks next', 'ok'), d('t2', 'a', 'waits its turn', 'warn')],
        center: { text: 'Rule: lower account id first', tone: 'ok' },
        note: 'The fix is to take the locks in one fixed order, for example the lower account id first. Both threads now lock A before B. transfer-2 waits for A while holding nothing, so no loop can form. Another option is tryLock with a timeout.',
      },
    ],
  },
];
