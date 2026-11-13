// Frame data for the Java concurrent collections walk-through.
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JAVA_CONCURRENT_COLLECTIONS_SCENES = [
  {
    id: 'unsafe',
    label: 'Why plain collections fail',
    title: 'Two threads writing to a HashMap or ArrayList can lose data or corrupt it',
    frames: [
      {
        note: 'A HashMap or ArrayList is not thread-safe. Two threads calling put or add at the same time can read the same size, write to the same slot and one of the writes is lost. A resize at the same moment can even corrupt the internal structure.',
        boxes: [b('a', 'Thread A', ['balances.put("A1", 100)'], 'new'), b('b', 'Thread B', ['balances.put("A2", 200)'], 'new'), b('m', 'HashMap', ['size read as 5 by both', 'one entry overwritten', 'result is undefined'], 'bad', 'unsafe')],
        deps: [d('Thread A', 'HashMap', 'write', 'bad'), d('Thread B', 'HashMap', 'write', 'bad')],
      },
      {
        note: 'The old fix was Collections.synchronizedMap or Hashtable: every method takes one lock on the whole object, so only one thread can use the map at a time. It is safe but slow under contention, and you still must lock manually to iterate or do check-then-act.',
        boxes: [b('a', 'Thread A', ['waits for the lock'], 'warn'), b('b', 'Thread B', ['holds the lock'], 'ok'), b('m', 'synchronizedMap', ['one lock for everything', 'safe but a bottleneck'], 'warn')],
        deps: [d('Thread A', 'synchronizedMap', 'blocked', 'warn'), d('Thread B', 'synchronizedMap', 'inside', 'ok')],
      },
      {
        note: 'The concurrent collections in java.util.concurrent are built for this. They use finer-grained locks, compare-and-swap (CAS) or copying, so many threads can read and write at once while each operation stays atomic.',
        boxes: [b('c', 'ConcurrentHashMap', ['many writers, no global lock'], 'ok'), b('w', 'CopyOnWriteArrayList', ['readers never block'], 'ok'), b('q', 'BlockingQueue', ['hand-over between threads'], 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'chm',
    label: 'ConcurrentHashMap',
    title: 'ConcurrentHashMap locks one bucket at a time, and reads take no lock',
    frames: [
      {
        note: 'Since Java 8 a ConcurrentHashMap has no global lock. Each bucket is protected on its own. Two threads writing to different buckets proceed in parallel; only writers to the same bucket wait for each other.',
        boxes: [b('a', 'Thread A', ['put("A1") -> bucket 3'], 'new'), b('b', 'Thread B', ['put("A2") -> bucket 9'], 'new'), b('t', 'Table', ['bucket 3: locked by A', 'bucket 9: locked by B', 'others: free'], 'ok', 'parallel')],
        deps: [d('Thread A', 'Table', 'bucket 3', 'ok'), d('Thread B', 'Table', 'bucket 9', 'ok')],
      },
      {
        note: 'Inserting into an empty bucket uses a lock-free CAS (compare-and-swap): "set this slot to my node only if it is still empty". Only when the bucket already has entries does the writer synchronize on the bucket head. Reads use volatile reads and never lock.',
        boxes: [b('c', 'Empty bucket', ['CAS the new node in', 'no lock'], 'ok', 'lock-free'), b('l', 'Occupied bucket', ['synchronized on the first node'], 'warn'), b('r', 'get()', ['volatile read, never blocks'], 'ok')],
        deps: [],
      },
      {
        note: 'Single calls are atomic, but a sequence of calls is not. "if (!map.containsKey(k)) map.put(k, v)" is a check-then-act race: two threads can both see it missing. Use the atomic methods instead: putIfAbsent, computeIfAbsent, compute, merge.',
        boxes: [b('x', 'containsKey, then put', ['two threads can both pass the check'], 'bad', 'race'), b('y', 'map.merge(k, 1, Integer::sum)', ['atomic read-modify-write'], 'ok', 'safe'), b('z', 'map.computeIfAbsent(k, f)', ['f runs at most once per key'], 'ok')],
        deps: [],
      },
      {
        note: 'Iterators are weakly consistent: they never throw ConcurrentModificationException and reflect the state at some point during iteration, possibly including later changes. size() is an estimate under concurrent updates. ConcurrentHashMap rejects null keys and values so that get() returning null always means "absent".',
        boxes: [b('i', 'Iterator', ['no ConcurrentModificationException', 'weakly consistent view'], 'ok'), b('s', 'size()', ['approximate while writers run'], 'warn'), b('n', 'null keys and values', ['NullPointerException'], 'bad', 'not allowed')],
        deps: [],
      },
    ],
  },
  {
    id: 'cow',
    label: 'CopyOnWriteArrayList',
    title: 'Every write copies the whole array, so reads never wait',
    frames: [
      {
        note: 'CopyOnWriteArrayList keeps its elements in an array that is never changed in place. Readers just read the current array reference, with no lock, and an iterator works on a snapshot of the array at the moment it was created.',
        boxes: [b('r', 'Reader thread', ['for (L l : listeners)', 'iterates a snapshot'], 'new'), b('a', 'Array v1', ['[L1, L2, L3]'], 'ok', 'current')],
        deps: [d('Reader thread', 'Array v1', 'reads', 'ok')],
      },
      {
        note: 'A write (add, set, remove) takes a lock, copies the entire array into a new one, applies the change to the copy, and publishes the copy as the new current array. The old array is untouched, so a reader that was iterating it keeps going safely.',
        boxes: [b('w', 'Writer thread', ['add(L4)', 'copies 3 elements'], 'warn'), b('o', 'Array v1', ['[L1, L2, L3]', 'still used by the reader'], 'none'), b('n', 'Array v2', ['[L1, L2, L3, L4]', 'new current array'], 'ok', 'published')],
        deps: [d('Writer thread', 'Array v2', 'copy and swap', 'ok')],
      },
      {
        note: 'That makes it excellent for data that is read all the time and changed rarely, like event listeners or a list of allowed IP addresses. It is a poor choice for lists that change often or are large, because every write costs O(n) time and creates garbage.',
        boxes: [b('g', 'Good fit', ['listeners', 'configuration lists', 'read 1000x, written 1x'], 'ok'), b('b', 'Bad fit', ['a growing transaction log', 'frequent writes', 'large lists'], 'bad')],
        deps: [],
      },
    ],
  },
  {
    id: 'blocking',
    label: 'BlockingQueue',
    title: 'A bounded queue lets producers and consumers run at different speeds',
    frames: [
      {
        note: 'A BlockingQueue is the standard tool for producer-consumer designs. Producers call put and consumers call take. The queue does the waiting and the locking, so your code has no wait and notify.',
        boxes: [b('p', 'Producer', ['accepts payment requests', 'queue.put(request)'], 'new'), b('q', 'ArrayBlockingQueue', ['capacity 100', '[r1, r2, r3, ...]'], 'ok'), b('c', 'Consumer', ['worker threads', 'queue.take()'], 'new')],
        deps: [d('Producer', 'ArrayBlockingQueue', 'put', 'ok'), d('ArrayBlockingQueue', 'Consumer', 'take', 'ok')],
      },
      {
        note: 'When the queue is full, put blocks the producer until a consumer makes room. That is backpressure: a fast producer cannot overwhelm slow consumers or fill the heap. When the queue is empty, take blocks the consumer until something arrives.',
        boxes: [b('p', 'Producer', ['put() waits: queue is full'], 'warn', 'blocked'), b('q', 'ArrayBlockingQueue', ['100 of 100 slots used'], 'bad', 'full'), b('c', 'Consumer', ['drains slowly'], 'ok')],
        deps: [d('Producer', 'ArrayBlockingQueue', 'blocked', 'warn')],
      },
      {
        note: 'Pick the right variant. ArrayBlockingQueue is bounded and array based. LinkedBlockingQueue is optionally bounded (unbounded by default, which can hide an overload until memory runs out). PriorityBlockingQueue orders by priority. DelayQueue releases items after a delay. SynchronousQueue hands over directly with no storage. Use offer with a timeout when waiting forever is not acceptable.',
        boxes: [b('a', 'ArrayBlockingQueue', ['bounded, fair option'], 'ok'), b('l', 'LinkedBlockingQueue', ['unbounded by default'], 'warn'), b('s', 'SynchronousQueue', ['direct hand-off'], 'ok'), b('d', 'offer(item, 1, SECONDS)', ['give up after a timeout'], 'ok')],
        deps: [],
      },
      {
        note: 'Thread pools are built on this idea: an ExecutorService owns a BlockingQueue of tasks and a set of worker threads that take from it. Choosing the queue (bounded or not) and the rejection policy is how you protect a service from overload.',
        boxes: [b('e', 'ThreadPoolExecutor', ['core and max threads'], 'new'), b('q', 'Work queue', ['BlockingQueue<Runnable>', 'bounded = backpressure'], 'ok'), b('r', 'Rejection policy', ['AbortPolicy, CallerRunsPolicy'], 'ok')],
        deps: [d('ThreadPoolExecutor', 'Work queue', 'takes tasks', 'ok'), d('ThreadPoolExecutor', 'Rejection policy', 'when full', 'warn')],
      },
    ],
  },
];
