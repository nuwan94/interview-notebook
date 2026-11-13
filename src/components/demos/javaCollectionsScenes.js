// Frame data for the Java Collections walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JAVA_COLLECTIONS_SCENES = [
  {
    id: 'choose',
    label: 'Choosing a collection',
    title: 'Start from the question you need to answer, not from the class name',
    frames: [
      {
        note: 'Collections answer different questions. Do you need an ordered sequence you read by position? That is a List. Do you only need to know whether something is already there, with no duplicates? That is a Set. Do you look values up by a key? That is a Map. Do you take items in a particular order, such as first in first out? That is a Queue or Deque.',
        boxes: [b('l', 'List', ['ordered, by index', 'duplicates allowed'], 'new'), b('s', 'Set', ['no duplicates', 'contains() is the point'], 'new'), b('m', 'Map', ['key to value', 'get(key) is the point'], 'new'), b('q', 'Queue / Deque', ['take from the ends', 'FIFO, LIFO, priority'], 'new')],
        deps: [],
      },
      {
        note: 'Pick the implementation by the access pattern. ArrayList for almost every List. HashSet when order does not matter, LinkedHashSet to keep insertion order, TreeSet to keep sorted order. HashMap, LinkedHashMap and TreeMap follow the same pattern. ArrayDeque for stacks and queues, PriorityQueue when the next item is the smallest or largest.',
        boxes: [b('l', 'List', ['ArrayList (default)'], 'ok', 'default'), b('s', 'Set', ['HashSet: fastest', 'LinkedHashSet: insertion order', 'TreeSet: sorted'], 'ok'), b('m', 'Map', ['HashMap: fastest', 'LinkedHashMap: insertion or access order', 'TreeMap: sorted keys'], 'ok'), b('q', 'Queue / Deque', ['ArrayDeque', 'PriorityQueue'], 'ok')],
        deps: [d('List', 'Set', 'same idea, no index', 'none')],
      },
      {
        note: 'A banking example. Account numbers you have already processed today: a HashSet, because the only question is "have I seen this?". The last 20 transactions in order: an ArrayDeque used as a bounded queue. A balance per account number: a HashMap. Statements sorted by date: a TreeMap keyed by date.',
        boxes: [b('a', 'Processed account numbers', ['HashSet<String>', 'contains in O(1)'], 'ok'), b('b', 'Recent transactions', ['ArrayDeque<Txn>', 'addLast, pollFirst'], 'ok'), c('Balance per account', 'HashMap<String, BigDecimal>', 'ok'), c('Statements by date', 'TreeMap<LocalDate, Statement>', 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'arraylist',
    label: 'ArrayList growth',
    title: 'ArrayList is an array that copies itself into a bigger one when it fills up',
    frames: [
      {
        note: 'An ArrayList keeps its elements in a plain Object array. size is how many slots are used, capacity is how many exist. A new ArrayList starts empty and allocates 10 slots on the first add.',
        boxes: [b('a', 'ArrayList', ['size = 3', 'capacity = 10'], 'new'), b('r', 'Backing array', ['[A, B, C, _, _, _, _, _, _, _]', 'index 0..9'], 'ok')],
        deps: [d('ArrayList', 'Backing array', 'elementData', 'ok')],
      },
      {
        note: 'get(i) and set(i) are direct array accesses, O(1). add(x) at the end writes the next free slot, also O(1) most of the time.',
        boxes: [b('a', 'ArrayList', ['add("D")', 'size 3 -> 4'], 'new'), b('r', 'Backing array', ['[A, B, C, D, _, _, _, _, _, _]', 'write at index size'], 'ok', 'O(1)')],
        deps: [d('ArrayList', 'Backing array', 'write at size', 'ok')],
      },
      {
        note: 'When the array is full the list allocates a new array about 1.5 times larger and copies every element across. That one add costs O(n), but it happens rarely, so the average cost of add is still O(1) (amortised).',
        boxes: [b('a', 'ArrayList', ['size = 10, capacity = 10', 'add("K") needs room'], 'warn'), b('r', 'Old array', ['10 slots, full'], 'bad', 'discarded'), b('n', 'New array', ['15 slots', 'elements copied over'], 'ok', 'x1.5')],
        deps: [d('ArrayList', 'New array', 'Arrays.copyOf', 'ok')],
      },
      {
        note: 'Inserting or removing in the middle shifts every later element by one slot with System.arraycopy, so it is O(n). Removing the first element of a large ArrayList in a loop is a classic performance bug. A LinkedList does not shift, but it must walk node by node to reach the position, so it is rarely faster in practice.',
        boxes: [b('a', 'ArrayList', ['remove(0)'], 'warn'), b('r', 'Backing array', ['[B, C, D, E, ...] all shifted left', 'n - 1 elements moved'], 'bad', 'O(n)')],
        deps: [d('ArrayList', 'Backing array', 'shift left', 'bad')],
      },
    ],
  },
  {
    id: 'failfast',
    label: 'Fail-fast iteration',
    title: 'Changing a list while you loop over it throws ConcurrentModificationException',
    frames: [
      {
        note: 'Every ArrayList counts its structural changes in a field called modCount. When you start a for-each loop the iterator remembers the current modCount as its expected value.',
        boxes: [b('l', 'ArrayList', ['modCount = 4', '[A, B, C, D]'], 'new'), b('i', 'Iterator', ['expectedModCount = 4', 'cursor = 0'], 'ok')],
        deps: [d('Iterator', 'ArrayList', 'iterates', 'ok')],
      },
      {
        note: 'Inside the loop the code calls list.remove(item). The list changes its structure and modCount becomes 5, but the iterator still expects 4.',
        boxes: [b('l', 'ArrayList', ['list.remove("B")', 'modCount = 5'], 'warn'), b('i', 'Iterator', ['expectedModCount = 4'], 'warn', 'out of date')],
        deps: [d('Iterator', 'ArrayList', 'still expects 4', 'warn')],
      },
      {
        note: 'On the next call to next() the iterator compares the two counters, sees they differ and throws ConcurrentModificationException. This is "fail-fast": the iterator detects the problem immediately instead of returning wrong data. It is a best-effort check, not a thread-safety guarantee.',
        boxes: [b('i', 'Iterator.next()', ['modCount != expectedModCount'], 'bad', 'throws'), b('e', 'ConcurrentModificationException', ['the loop is aborted'], 'bad')],
        deps: [d('Iterator.next()', 'ConcurrentModificationException', 'throws', 'bad')],
      },
      {
        note: 'Remove through the iterator itself with it.remove(), or use list.removeIf(predicate), which is the shortest and fastest option. Both keep the expected count in step, so nothing is thrown. Alternatively collect the items to remove and call removeAll after the loop.',
        boxes: [b('r', 'removeIf(t -> t.isExpired())', ['one pass, no exception'], 'ok', 'preferred'), b('i', 'Iterator.remove()', ['updates expectedModCount'], 'ok'), b('x', 'list.remove() in for-each', ['throws'], 'bad', 'avoid')],
        deps: [],
      },
    ],
  },
  {
    id: 'ordering',
    label: 'Sorting with Comparator',
    title: 'Comparable is the natural order, Comparator is any order you pass in',
    frames: [
      {
        note: 'Comparable is implemented by the class itself and defines its single natural order through compareTo. String, Integer and LocalDate already have one. TreeSet, TreeMap and Collections.sort use it when you do not pass anything else.',
        boxes: [b('c', 'Transaction implements Comparable', ['compareTo compares the date', 'one natural order only'], 'new'), b('s', 'TreeSet<Transaction>', ['sorted by date', 'no extra argument'], 'ok')],
        deps: [d('TreeSet<Transaction>', 'Transaction implements Comparable', 'calls compareTo', 'ok')],
      },
      {
        note: 'A Comparator is a separate object that compares two items. You can have as many as you like: by amount, by merchant, by date then amount. It does not touch the class, so it also works on classes you cannot edit.',
        boxes: [b('a', 'byAmount', ['Comparator.comparing(Txn::amount)'], 'ok'), b('m', 'byMerchant', ['Comparator.comparing(Txn::merchant)'], 'ok'), b('d', 'list.sort(byAmount)', ['sorts any List in place'], 'new')],
        deps: [d('list.sort(byAmount)', 'byAmount', 'uses', 'ok')],
      },
      {
        note: 'Comparators compose. thenComparing breaks ties, reversed flips the direction, and nullsFirst or nullsLast handle missing values. Here: newest first, and for the same date the largest amount first.',
        boxes: [b('c', 'Combined comparator', ['comparing(Txn::date).reversed()', '.thenComparing(Txn::amount, reverseOrder())'], 'ok'), b('r', 'Result', ['newest date first', 'ties: biggest amount first'], 'ok')],
        deps: [d('Combined comparator', 'Result', 'orders', 'ok')],
      },
      {
        note: 'The comparator must be consistent: if a is before b and b is before c then a must be before c, and compare(a, b) must never be the negative of a different answer. Subtracting ints (a - b) can overflow and break this. Use Integer.compare or Comparator.comparingInt.',
        boxes: [b('x', 'return a.amount - b.amount', ['can overflow for large values'], 'bad', 'bug'), b('y', 'Integer.compare(a, b)', ['never overflows'], 'ok', 'correct')],
        deps: [],
      },
    ],
  },
];

function c(title, line, tone) {
  return b(title.toLowerCase().replace(/\s+/g, '-'), title, [line], tone);
}
