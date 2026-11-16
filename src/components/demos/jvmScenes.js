// Frame data for the "JVM troubleshooting" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JVM_SCENES = [
  {
    id: 'triage',
    label: 'Symptom to tool',
    title: 'Start from the symptom, then pick the tool',
    frames: [
      {
        note: 'High CPU. Do not guess: find which thread is busy (top -H shows CPU per thread), then take a thread dump and look at that thread\'s stack. The stack usually names the loop, the regular expression or the hot method.',
        boxes: [b('s', 'High CPU', ['one core at 100%'], 'bad'), b('t', 'Busy thread', ['top -H -p pid'], 'warn'), b('d', 'Thread dump', ['jcmd pid Thread.print'], 'new'), b('c', 'Hot code', ['the stack names it'], 'ok')],
        deps: [d('High CPU', 'Busy thread', 'find', 'warn'), d('Busy thread', 'Thread dump', 'match its id', 'ok'), d('Thread dump', 'Hot code', 'read the stack', 'ok')],
      },
      {
        note: 'Memory keeps growing. The GC log tells a leak from a busy allocator: if the heap after a full GC is higher each time, objects are being kept. Then a heap dump shows what holds them.',
        boxes: [b('s', 'Heap keeps growing', ['OutOfMemoryError soon'], 'bad'), b('g', 'GC log', ['old gen stays high'], 'warn'), b('h', 'Heap dump', ['jcmd pid GC.heap_dump'], 'new'), b('c', 'Leaking collection', ['dominator tree'], 'ok')],
        deps: [d('Heap keeps growing', 'GC log', 'check', 'warn'), d('GC log', 'Heap dump', 'if it never falls', 'ok'), d('Heap dump', 'Leaking collection', 'analyse', 'ok')],
      },
      {
        note: 'Requests hang while CPU is low. Threads are waiting, not working. Take three thread dumps ten seconds apart: threads stuck in the same place in every dump are blocked on a lock, a full connection pool or a slow downstream call.',
        boxes: [b('s', 'Requests hang', ['CPU is low'], 'bad'), b('d', 'Thread dump', ['three, 10 s apart'], 'new'), b('t', 'Blocked threads', ['same place each time'], 'warn'), b('c', 'Root cause', ['deadlock or full pool'], 'ok')],
        deps: [d('Requests hang', 'Thread dump', 'take', 'warn'), d('Thread dump', 'Blocked threads', 'compare', 'ok'), d('Blocked threads', 'Root cause', 'follow the lock', 'ok')],
      },
      {
        note: 'The pod is OOMKilled but the heap looks fine. The kernel counts the whole process, not just the heap: Metaspace, thread stacks, direct buffers and the code cache. Native Memory Tracking breaks the total down by area.',
        boxes: [b('s', 'Pod OOMKilled', ['exit code 137'], 'bad'), b('h', 'Heap vs process', ['heap is only part'], 'warn'), b('n', 'Native memory tracking', ['VM.native_memory'], 'new'), b('c', 'Off-heap growth', ['threads or buffers'], 'ok')],
        deps: [d('Pod OOMKilled', 'Heap vs process', 'compare', 'warn'), d('Heap vs process', 'Native memory tracking', 'measure', 'ok'), d('Native memory tracking', 'Off-heap growth', 'by area', 'ok')],
      },
    ],
  },
  {
    id: 'leak',
    label: 'Heap dump',
    title: 'Finding a memory leak with a heap dump',
    frames: [
      {
        note: 'The GC log shows the pattern of a leak: each full GC frees almost nothing, because the old generation is full of objects that are still reachable. Sooner or later the JVM throws OutOfMemoryError.',
        boxes: [b('o', 'Old generation', ['3.8 of 4 GB after GC'], 'bad'), b('f', 'Full GC', ['frees almost nothing'], 'warn'), b('e', 'OutOfMemoryError', ['Java heap space'], 'bad')],
        deps: [d('Full GC', 'Old generation', 'cannot free it', 'warn'), d('Old generation', 'OutOfMemoryError', 'fills up', 'bad')],
      },
      {
        note: 'Capture a heap dump while the problem is present. Start the JVM with -XX:+HeapDumpOnOutOfMemoryError so one is written automatically at the failure, or ask a running JVM with jcmd GC.heap_dump. The file lists every object and every reference.',
        boxes: [b('j', 'jcmd GC.heap_dump', ['on a running JVM'], 'new'), b('v', 'JVM process', ['or HeapDumpOnOutOfMemoryError'], 'none'), b('h', 'Heap dump file', ['.hprof, size of the heap'], 'ok')],
        deps: [d('jcmd GC.heap_dump', 'JVM process', 'asks', 'ok'), d('JVM process', 'Heap dump file', 'writes', 'ok')],
      },
      {
        note: 'Open the file in Eclipse MAT (or VisualVM, or IntelliJ). Its first view is the dominator tree: objects sorted by retained size, which is the memory that would be freed if that object were gone. The top entry is usually the leak.',
        boxes: [b('h', 'Heap dump file', ['.hprof'], 'none'), b('m', 'Eclipse MAT', ['parses the dump'], 'new'), b('t', 'Dominator tree', ['sorted by retained size'], 'ok')],
        deps: [d('Heap dump file', 'Eclipse MAT', 'open', 'ok'), d('Eclipse MAT', 'Dominator tree', 'shows', 'ok')],
      },
      {
        note: 'Follow the path to the GC roots from the biggest object. Here a static field in PaymentCache holds a ConcurrentHashMap with 1.2 million entries and nothing ever removes them. A GC root is something the collector must treat as alive, such as a static field, a thread or a stack variable.',
        boxes: [b('r', 'GC root', ['static PaymentCache.ALL'], 'warn'), b('c', 'ConcurrentHashMap', ['1.2 M entries'], 'bad'), b('e', 'PaymentEvent objects', ['3.1 GB retained'], 'bad')],
        deps: [d('GC root', 'ConcurrentHashMap', 'holds', 'warn'), d('ConcurrentHashMap', 'PaymentEvent objects', 'holds', 'bad')],
      },
      {
        note: 'Fix the cause, not the heap size: bound the cache with a maximum size and an expiry. After the change the old generation stays flat after each full GC, which is the proof that the leak is gone.',
        boxes: [b('c', 'Bounded cache', ['maximumSize 10 000', 'expire after 10 min'], 'ok'), b('o', 'Old generation', ['flat after each GC'], 'ok')],
        deps: [d('Bounded cache', 'Old generation', 'stays small', 'ok')],
      },
    ],
  },
  {
    id: 'cpu',
    label: 'High CPU',
    title: 'Which thread burns the CPU?',
    frames: [
      {
        note: 'The process is at 97% CPU. Run top -H -p with the process id: -H lists threads, so you see that one thread, id 4377, owns almost all of it. That id is a decimal operating-system thread id.',
        boxes: [b('p', 'top -H -p 4212', ['threads of the process'], 'new'), b('t', 'Thread 4377', ['97% CPU'], 'bad')],
        deps: [d('top -H -p 4212', 'Thread 4377', 'shows', 'bad')],
      },
      {
        note: 'A thread dump prints the thread id in hexadecimal, as nid. Convert the number: printf "%x" 4377 gives 1119, so the thread is nid=0x1119.',
        boxes: [b('t', 'Thread 4377', ['decimal id'], 'bad'), b('c', 'printf %x', ['convert to hex'], 'new'), b('n', 'nid 0x1119', ['hex id'], 'warn')],
        deps: [d('Thread 4377', 'printf %x', 'convert', 'ok'), d('printf %x', 'nid 0x1119', 'gives', 'ok')],
      },
      {
        note: 'Take a thread dump with jcmd 4212 Thread.print and search it for nid=0x1119. Take two or three, a few seconds apart, to confirm the thread is in the same code every time.',
        boxes: [b('j', 'jcmd 4212 Thread.print', ['dump every stack'], 'new'), b('n', 'nid 0x1119', ['search for it'], 'warn'), b('s', 'Stack trace', ['RUNNABLE in Pattern.match'], 'bad')],
        deps: [d('jcmd 4212 Thread.print', 'nid 0x1119', 'contains', 'ok'), d('nid 0x1119', 'Stack trace', 'has', 'bad')],
      },
      {
        note: 'The stack points at a regular expression applied to user input. A pattern with nested repetition can backtrack for exponential time on a long string, which pins a core. That is a denial-of-service risk, so it is both a performance and a security fix.',
        boxes: [b('s', 'Stack trace', ['regex on the request body'], 'bad'), b('r', 'Catastrophic backtracking', ['nested repetition'], 'warn'), b('x', 'Fix', ['simpler pattern, input limit'], 'ok')],
        deps: [d('Stack trace', 'Catastrophic backtracking', 'caused by', 'warn'), d('Catastrophic backtracking', 'Fix', 'remove', 'ok')],
      },
    ],
  },
  {
    id: 'deadlock',
    label: 'Deadlock',
    title: 'Two transfers wait for each other',
    frames: [
      {
        note: 'Two threads transfer money between the same two accounts in opposite directions. Each takes the lock of its source account first: transfer-1 holds account A and transfer-2 holds account B.',
        boxes: [b('t1', 'Thread transfer-1', ['A to B'], 'none'), b('t2', 'Thread transfer-2', ['B to A'], 'none'), b('a', 'Account A lock', [], 'none'), b('c', 'Account B lock', [], 'none')],
        deps: [d('Thread transfer-1', 'Account A lock', 'holds', 'ok'), d('Thread transfer-2', 'Account B lock', 'holds', 'ok')],
      },
      {
        note: 'Each thread now needs the lock the other one holds, and neither will release its own lock while it waits. That cycle is a deadlock: the threads wait forever, CPU stays low, and requests that need those accounts hang.',
        boxes: [b('t1', 'Thread transfer-1', ['BLOCKED, wants B'], 'bad'), b('t2', 'Thread transfer-2', ['BLOCKED, wants A'], 'bad'), b('a', 'Account A lock', [], 'none'), b('c', 'Account B lock', [], 'none')],
        deps: [d('Thread transfer-1', 'Account A lock', 'holds', 'ok'), d('Thread transfer-2', 'Account B lock', 'holds', 'ok'), d('Thread transfer-1', 'Account B lock', '', 'bad'), d('Thread transfer-2', 'Account A lock', '', 'bad')],
      },
      {
        note: 'A thread dump finds it for you. The JVM checks for cycles of monitors and prints "Found one Java-level deadlock" at the end of the dump, with each thread, the lock it holds and the lock it waits for.',
        boxes: [b('d', 'Thread dump', ['Found one Java-level deadlock'], 'new'), b('t1', 'Thread transfer-1', ['waits for B, holds A'], 'bad'), b('t2', 'Thread transfer-2', ['waits for A, holds B'], 'bad')],
        deps: [d('Thread dump', 'Thread transfer-1', 'reports', 'bad'), d('Thread dump', 'Thread transfer-2', 'reports', 'bad')],
      },
      {
        note: 'Fix it by taking the locks in one global order, for example the lower account id first. Both threads then lock A before B, so one of them simply waits its turn and no cycle can form. Another option is tryLock with a timeout.',
        boxes: [b('r', 'Lock ordering', ['lower account id first'], 'ok'), b('t1', 'Thread transfer-1', ['A then B'], 'ok'), b('t2', 'Thread transfer-2', ['A then B'], 'ok'), b('a', 'Account A lock', [], 'none')],
        deps: [d('Lock ordering', 'Thread transfer-1', 'rule', 'ok'), d('Lock ordering', 'Thread transfer-2', 'rule', 'ok'), d('Thread transfer-1', 'Account A lock', 'first', 'ok'), d('Thread transfer-2', 'Account A lock', 'waits its turn', 'ok')],
      },
    ],
  },
];
