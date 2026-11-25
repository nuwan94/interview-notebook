// Frame data for the Java concurrent collections walk-through. Every scene brings its own picture (stage):
// BinMapStage for the plain map and ConcurrentHashMap, CowStage for CopyOnWriteArrayList, and
// BlockingQueueStage for the queue.

import { BinMapStage } from './BinMapStage.jsx';
import { CowStage } from './CowStage.jsx';
import { BlockingQueueStage } from './BlockingQueueStage.jsx';

const node = (k, v, tone) => ({ k, v, tone });
const th = (name, slot, call, state, status, to, how, label) => ({ name, slot, call, state, status, to, how, label });

// entries that are already in the map before each scene starts
const BASE = { 0: [node('A7', 50)], 5: [node('A4', 90)], 6: [node('A9', 10)] };
// the map after the first three ConcurrentHashMap steps
const LATER = { ...BASE, 0: [node('A7', 50), node('A8', 60)], 3: [node('A1', 100)], 5: [node('A4', 95)] };

export const JAVA_CONCURRENT_COLLECTIONS_SCENES = [
  {
    id: 'unsafe',
    label: 'Why plain collections fail',
    title: 'Two threads write to a HashMap at once, and one write is lost',
    stage: BinMapStage,
    frames: [
      {
        line: 'Thread A: put("A1", 100)    Thread B: put("A2", 200)',
        kind: 'HashMap: 8 bins',
        threads: [
          th('Thread A', 0, 'put("A1", 100)', 'running', 'sees bin 3 empty', 3, 'read', 'empty?'),
          th('Thread B', 1, 'put("A2", 200)', 'running', 'sees bin 3 empty', 3, 'read', 'empty?'),
        ],
        bins: BASE,
        note: 'A HashMap is an array of bins. Each bin points to a short chain of entries. The keys "A1" and "A2" both land in bin 3. Both threads look at bin 3 at the same time, and both see that it is empty.',
      },
      {
        line: 'Thread A: tab[3] = new Node("A1", 100)',
        kind: 'HashMap: 8 bins',
        threads: [
          th('Thread A', 0, 'put("A1", 100)', 'running', 'writes its node', 3, 'write', 'write'),
          th('Thread B', 1, 'put("A2", 200)', 'paused', 'still thinks bin 3 is empty'),
        ],
        bins: { ...BASE, 3: [node('A1', 100, 'new')] },
        note: 'Thread A puts its new entry into bin 3.',
      },
      {
        line: 'Thread B: tab[3] = new Node("A2", 200)',
        result: { text: 'A1 is lost, and there is no error', tone: 'bad' },
        kind: 'HashMap: 8 bins',
        threads: [
          th('Thread A', 0, 'put("A1", 100)', 'done', 'thinks A1 is stored'),
          th('Thread B', 1, 'put("A2", 200)', 'running', 'overwrites bin 3', 3, 'fail', 'write'),
        ],
        bins: { ...BASE, 3: [node('A2', 200, 'new'), node('A1', 100, 'lost')] },
        note: 'Thread B still believes bin 3 is empty, so it writes its own entry there. A\'s entry is overwritten and lost. A resize at the same moment can even break the structure inside the map. HashMap and ArrayList are not thread-safe.',
      },
      {
        line: 'Map<String, Integer> balances = Collections.synchronizedMap(new HashMap<>());',
        result: { text: 'safe, but only one thread at a time', tone: 'warn' },
        kind: 'synchronizedMap',
        globalLock: { owner: 'A' },
        threads: [
          th('Thread A', 0, 'put("A1", 100)', 'running', 'holds the map lock', 3, 'write', 'write'),
          th('Thread B', 1, 'put("A8", 70)', 'blocked', 'wants bin 6, still waits', 6, 'wait', 'waits'),
        ],
        bins: { ...BASE, 3: [node('A1', 100, 'new')] },
        note: 'The old fix is Collections.synchronizedMap or Hashtable. Every method takes one lock on the whole map. It is safe, but only one thread can use the map at a time, even when the threads want different bins. You also still need your own lock to loop over it or to do check-then-act.',
      },
      {
        line: 'ConcurrentMap<String, Integer> balances = new ConcurrentHashMap<>();',
        result: { text: 'both writes run at the same time', tone: 'ok' },
        kind: 'ConcurrentHashMap',
        locks: { 6: 'B' },
        threads: [
          th('Thread A', 0, 'put("A1", 100)', 'running', 'bin 3 is empty: CAS', 3, 'cas', 'CAS'),
          th('Thread B', 1, 'put("A8", 70)', 'running', 'locks only bin 6', 6, 'lock', 'lock bin 6'),
        ],
        bins: { ...BASE, 3: [node('A1', 100, 'new')], 6: [node('A9', 10), node('A8', 70, 'new')] },
        note: 'The collections in java.util.concurrent are built for this. ConcurrentHashMap locks one bin at a time, so both writes run at once (next scene). CopyOnWriteArrayList and BlockingQueue follow in the later scenes.',
      },
    ],
  },
  {
    id: 'chm',
    label: 'ConcurrentHashMap',
    title: 'ConcurrentHashMap locks one bin at a time, and reads take no lock',
    stage: BinMapStage,
    frames: [
      {
        line: 'map.put("A1", 100)   // bin 3 is empty',
        result: { text: 'CAS succeeded: no lock taken', tone: 'ok' },
        kind: 'ConcurrentHashMap',
        threads: [th('Thread A', 0, 'put("A1", 100)', 'running', 'bin 3 is empty', 3, 'cas', 'CAS')],
        bins: { ...BASE, 3: [node('A1', 100, 'new')] },
        note: 'Since Java 8 a ConcurrentHashMap has no lock for the whole map. To put an entry into an empty bin, a thread uses CAS (compare-and-swap): "set this bin to my node, but only if it is still empty". If another thread got there first, the CAS fails and the thread tries again.',
      },
      {
        line: 'A: put("A8", 60)   B: put("A4", 95)   C: get("A9")',
        result: { text: 'different bins: all three run at once', tone: 'ok' },
        kind: 'ConcurrentHashMap',
        locks: { 0: 'A', 5: 'B' },
        threads: [
          th('Thread A', 0, 'put("A8", 60)', 'running', 'locks only bin 0', 0, 'lock', 'lock bin 0'),
          th('Thread B', 1, 'put("A4", 95)', 'running', 'locks only bin 5', 5, 'lock', 'lock bin 5'),
          th('Thread C', 2, 'get("A9")', 'running', 'reads, takes no lock', 6, 'read', 'read'),
        ],
        bins: { ...BASE, 0: [node('A7', 50), node('A8', 60, 'new')], 3: [node('A1', 100)], 5: [node('A4', 95, 'new')] },
        note: 'A bin that already has entries is changed under a lock on its first node (synchronized). That lock covers this one bin only. So writers to different bins run in parallel. Reads use volatile reads, which see the latest published value, and never lock.',
      },
      {
        line: 'B: put("A4", 95)   C: put("A12", 30)   // both in bin 5',
        result: { text: 'same bin: only these two take turns', tone: 'warn' },
        kind: 'ConcurrentHashMap',
        locks: { 5: 'B' },
        threads: [
          th('Thread B', 1, 'put("A4", 95)', 'running', 'holds the lock of bin 5', 5, 'lock', 'lock bin 5'),
          th('Thread C', 2, 'put("A12", 30)', 'blocked', 'waits for bin 5', 5, 'wait', 'waits'),
        ],
        bins: { ...BASE, 0: [node('A7', 50), node('A8', 60)], 3: [node('A1', 100)], 5: [node('A4', 95, 'new')] },
        note: 'Only writers to the same bin wait for each other. Thread C must wait until B releases bin 5. Every other bin stays free for other threads.',
      },
      {
        line: 'if (!map.containsKey("A6")) map.put("A6", new Account());',
        result: { text: 'both threads see: absent', tone: 'warn' },
        kind: 'ConcurrentHashMap',
        threads: [
          th('Thread A', 0, 'containsKey("A6")', 'running', 'returns false', 2, 'read', 'absent?'),
          th('Thread B', 1, 'containsKey("A6")', 'running', 'returns false', 2, 'read', 'absent?'),
        ],
        bins: LATER,
        note: 'Each single call is atomic, but two calls in a row are not. Here both threads check whether account "A6" exists. Both see that it does not, so both decide to create it. This is a check-then-act race.',
      },
      {
        line: 'A: put("A6", acct#1)   then   B: put("A6", acct#2)',
        result: { text: 'two accounts created, and one is lost', tone: 'bad' },
        kind: 'ConcurrentHashMap',
        threads: [
          th('Thread A', 0, 'put("A6", #1)', 'done', 'uses account #1'),
          th('Thread B', 1, 'put("A6", #2)', 'running', 'replaces it with #2', 2, 'fail', 'put'),
        ],
        bins: { ...LATER, 2: [node('A6', '#2', 'bad'), node('A6', '#1', 'lost')] },
        note: 'Thread A puts account #1. Then Thread B puts account #2 for the same key and replaces it. Thread A is still working with account #1, which is no longer in the map.',
      },
      {
        line: 'map.computeIfAbsent("A6", k -> new Account(k))',
        kind: 'ConcurrentHashMap',
        locks: { 2: 'A' },
        threads: [
          th('Thread A', 0, 'computeIfAbsent("A6")', 'running', 'creates #1 under the lock', 2, 'lock', 'lock bin 2'),
          th('Thread B', 1, 'computeIfAbsent("A6")', 'blocked', 'waits for bin 2', 2, 'wait', 'waits'),
        ],
        bins: { ...LATER, 2: [node('A6', '#1', 'new')] },
        note: 'The fix is one atomic call: computeIfAbsent (or putIfAbsent, compute, merge). Thread A runs the check and the create as one step, while it holds the lock of bin 2. Thread B waits.',
      },
      {
        line: 'map.computeIfAbsent("A6", k -> new Account(k))',
        result: { text: 'both threads get account #1', tone: 'ok' },
        kind: 'ConcurrentHashMap',
        threads: [
          th('Thread A', 0, 'computeIfAbsent("A6")', 'done', 'returned #1'),
          th('Thread B', 1, 'computeIfAbsent("A6")', 'running', 'key exists: returns #1', 2, 'read', 'read'),
        ],
        bins: { ...LATER, 2: [node('A6', '#1', 'ok')] },
        note: 'When Thread B gets its turn, the key already exists, so it gets the same account #1. The function ran at most once for the key. Keep that function short, and never update the same map inside it, because it runs while the bin is locked.',
      },
      {
        line: 'for (var e : map.entrySet()) { ... }   // while others write',
        result: { text: 'no ConcurrentModificationException', tone: 'ok' },
        kind: 'ConcurrentHashMap',
        cursor: 4,
        threads: [
          th('Thread A', 0, 'put("A2", 40)', 'running', 'bin 1: behind the iterator', 1, 'cas', 'CAS'),
          th('Thread C', 1, 'iterator.next()', 'running', 'walks the bins in order'),
          th('Thread B', 2, 'put("A3", 75)', 'running', 'bin 7: ahead of it', 7, 'cas', 'CAS'),
        ],
        bins: { ...LATER, 1: [node('A2', 40, 'new')], 2: [node('A6', '#1')], 7: [node('A3', 75, 'new')] },
        note: 'Iterators are weakly consistent. They never throw ConcurrentModificationException. The iterator has passed bin 1, so it will not see A2. It may still see A3 in bin 7. It is not a frozen snapshot.',
      },
      {
        line: 'map.put("A5", null);   map.size();',
        result: { text: 'NullPointerException', tone: 'bad' },
        kind: 'ConcurrentHashMap',
        threads: [
          th('Thread A', 0, 'put("A5", null)', 'error', 'null is not allowed'),
          th('Thread B', 1, 'size()', 'running', 'only an estimate now'),
          th('Thread C', 2, 'put("A10", 5)', 'running', 'still writing', 6, 'lock', 'lock bin 6'),
        ],
        locks: { 6: 'C' },
        bins: { ...LATER, 1: [node('A2', 40)], 2: [node('A6', '#1')], 6: [node('A9', 10), node('A10', 5, 'new')], 7: [node('A3', 75)] },
        note: 'ConcurrentHashMap does not allow null keys or values. So get() returning null always means "absent". And while other threads write, size() is only an estimate.',
      },
    ],
  },
  {
    id: 'cow',
    label: 'CopyOnWriteArrayList',
    title: 'Every write copies the whole array, so readers never wait',
    stage: CowStage,
    frames: [
      {
        line: 'for (Listener l : listeners) l.onPayment(p);',
        list: 'v1',
        reader: { state: 'running', status: 'reads L1, takes no lock', on: 'v1', at: 0 },
        writer: { state: 'idle', call: 'listeners.add(L4)', status: 'not started yet', to: null },
        arrays: { v1: { cells: ['L1', 'L2', 'L3'] }, v2: null },
        note: 'A CopyOnWriteArrayList keeps its elements in an array that is never changed in place. The list holds one volatile reference to it. A reader takes no lock. Its iterator keeps the array it saw when the loop started: its snapshot.',
      },
      {
        line: 'listeners.add(L4);   // lock, copy, add to the copy',
        list: 'v1',
        reader: { state: 'running', status: 'reads L2 in v1', on: 'v1', at: 1 },
        writer: { state: 'running', call: 'listeners.add(L4)', status: 'holds the write lock', to: 'v2' },
        arrays: { v1: { cells: ['L1', 'L2', 'L3'] }, v2: { cells: ['L1', 'L2', 'L3', 'L4'], fresh: 3 } },
        copy: true,
        note: 'A write (add, set or remove) takes a lock. It copies the whole array into a new one and makes the change in the copy. The old array is not touched, so the reader keeps going safely.',
      },
      {
        line: 'array = newArray;   // publish the copy',
        result: { text: 'the reader never sees L4, and never fails', tone: 'ok' },
        list: 'v2',
        reader: { state: 'running', status: 'reads L3, still in v1', on: 'v1', at: 2 },
        writer: { state: 'done', call: 'listeners.add(L4)', status: 'released the lock', to: null },
        arrays: { v1: { cells: ['L1', 'L2', 'L3'] }, v2: { cells: ['L1', 'L2', 'L3', 'L4'], fresh: 3 } },
        note: 'The writer points the list at the new array. New readers see L4. The old reader still walks its snapshot, so it never sees L4 and never throws an exception. Its iterator does not support remove.',
      },
      {
        line: 'the loop ends',
        result: { text: 'each write copies every element: O(n)', tone: 'warn' },
        list: 'v2',
        reader: { state: 'done', status: 'finished its snapshot', on: null, at: null },
        writer: { state: 'done', call: 'listeners.add(L4)', status: 'finished', to: null },
        arrays: { v1: { cells: ['L1', 'L2', 'L3'], garbage: true }, v2: { cells: ['L1', 'L2', 'L3', 'L4'] } },
        note: 'Nothing points to the old array any more, so the garbage collector removes it. This design is great for data that is read all the time and changed rarely, such as event listeners or a list of allowed IP addresses. It is a poor choice for large lists or lists that change often, such as a growing transaction log, because every write costs O(n) time and creates garbage.',
      },
    ],
  },
  {
    id: 'blocking',
    label: 'BlockingQueue',
    title: 'A bounded queue lets producers and consumers run at different speeds',
    stage: BlockingQueueStage,
    frames: (() => {
      const r = (n) => ({ id: `r${n}`, text: `r${n}` });
      const Q = 'new ArrayBlockingQueue<>(4)';
      return [
        {
          line: 'producer: queue.put(r3)     consumer: process(r0)',
          producer: { name: 'Producer', call: 'queue.put(r3)', status: 'accepts payments', state: 'running', arrow: 'put' },
          queue: { title: Q, cap: 4, items: [r(1), r(2), r(3)] },
          consumers: [{ name: 'Consumer', call: 'process(r0)', status: 'works on a request', state: 'running', arrow: null }],
          note: 'A BlockingQueue is the standard tool for producer-consumer designs. The producer calls put, and the consumer calls take. The queue does the waiting and the locking, so your code needs no wait and notify.',
        },
        {
          line: 'producer: queue.put(r5)   // the queue is full',
          result: { text: 'put waits: this is backpressure', tone: 'warn' },
          producer: { name: 'Producer', call: 'queue.put(r5)', status: 'waits for a free slot', state: 'waiting', arrow: 'wait' },
          queue: { title: Q, cap: 4, items: [r(1), r(2), r(3), r(4)] },
          consumers: [{ name: 'Consumer', call: 'process(r0)', status: 'slow, still busy', state: 'running', arrow: null }],
          note: 'The queue is full, so put makes the producer wait until a consumer frees a slot. This is backpressure: a fast producer cannot overwhelm slow consumers or fill the heap.',
        },
        {
          line: 'consumer: queue.take()   // returns r1, then put(r5) continues',
          result: { text: 'a slot opened, so put went ahead', tone: 'ok' },
          producer: { name: 'Producer', call: 'queue.put(r5)', status: 'done waiting', state: 'running', arrow: 'put' },
          queue: { title: Q, cap: 4, items: [r(2), r(3), r(4), r(5)] },
          consumers: [{ name: 'Consumer', call: 'queue.take()', status: 'got r1', state: 'running', arrow: 'take', label: 'take r1' }],
          note: 'The consumer takes r1 from the head of the queue. That frees a slot, so the producer\'s put(r5) finishes.',
        },
        {
          line: 'consumer: queue.take()   // the queue is empty',
          result: { text: 'take waits until an item arrives', tone: 'warn' },
          producer: { name: 'Producer', call: 'no new payments', status: 'quiet for now', state: 'idle', arrow: null },
          queue: { title: Q, cap: 4, items: [] },
          consumers: [{ name: 'Consumer', call: 'queue.take()', status: 'waits for work', state: 'waiting', arrow: 'wait' }],
          note: 'Later the consumer has handled everything and the queue is empty. Now take makes the consumer wait until something arrives. No CPU is spent while it waits.',
        },
        {
          line: 'producer: queue.offer(r9, 1, SECONDS)   // full again',
          result: { text: 'false after 1 second: the caller decides', tone: 'warn' },
          producer: { name: 'Producer', call: 'offer(r9, 1, SECONDS)', status: 'gave up after 1 s', state: 'running', arrow: 'wait', label: '1 s' },
          queue: { title: Q, cap: 4, items: [r(5), r(6), r(7), r(8)] },
          consumers: [{ name: 'Consumer', call: 'process(r4)', status: 'busy', state: 'running', arrow: null }],
          note: 'When waiting for ever is not acceptable, use offer with a timeout. It returns false if no slot frees up in time. Pick the variant that fits: ArrayBlockingQueue is bounded and array based. LinkedBlockingQueue is unbounded by default, which can hide an overload until memory runs out. PriorityBlockingQueue orders by priority, DelayQueue releases items after a delay, and SynchronousQueue hands each item over directly with no storage.',
        },
        {
          line: 'pool.execute(task)   // a ThreadPoolExecutor works the same way',
          producer: { name: 'Caller', call: 'pool.execute(t5)', status: 'adds to the work queue', state: 'running', arrow: 'put', label: 'offer' },
          queue: { title: 'BlockingQueue<Runnable>', cap: 4, items: [{ id: 't3', text: 't3' }, { id: 't4', text: 't4' }, { id: 't5', text: 't5' }] },
          consumers: [
            { name: 'Worker 1', call: 'queue.take()', status: 'runs t1, then t3', state: 'running', arrow: 'take' },
            { name: 'Worker 2', call: 'queue.take()', status: 'runs t2, then t4', state: 'running', arrow: 'take' },
          ],
          note: 'A thread pool is built on this idea. An ExecutorService owns a BlockingQueue of tasks and a set of worker threads that take from it. Choosing the queue (bounded or not) and the rejection policy (for example AbortPolicy or CallerRunsPolicy) is how you protect a service from overload.',
        },
      ];
    })(),
  },
];
