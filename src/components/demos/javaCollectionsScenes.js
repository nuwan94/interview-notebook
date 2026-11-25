// Frame data for the Java Collections walk-through.
// Every scene is drawn by a custom stage from CollectionsStage.jsx, because each one is about the shape of the data.

import { ChooseStage, ArrayListStage, FailFastStage, SortStage } from './CollectionsStage.jsx';

// --- ArrayList helpers -------------------------------------------------------------------------------
const LETTERS = 'ABCDEFGHIJK'.split('');
// n filled slots (A, B, C ...) followed by empty slots up to `cap`; `tones` maps an index to a tone
const slots = (n, cap, tones = {}) => Array.from({ length: cap }, (_, i) => ({ t: i < n ? LETTERS[i] : '', tone: tones[i] }));

// --- fail-fast helpers -------------------------------------------------------------------------------
const cells = (list, tones = {}) => list.map((t, i) => ({ t, tone: tones[i] }));

export const JAVA_COLLECTIONS_SCENES = [
  {
    id: 'choose',
    label: 'Choosing a collection',
    title: 'Start from the question you need to answer, not from the class name',
    stage: ChooseStage,
    frames: [
      {
        panels: {
          list: { q: 'What is the third transaction?', op: 'list.get(2)', hl: true, lines: ['Keeps the order. Duplicates allowed.'] },
          set: { q: 'Have I seen this account number?', op: 'set.contains("ACC-7")', hl: true, lines: ['No duplicates are allowed.'] },
          map: { q: 'What is the balance of ACC-2?', op: 'map.get("ACC-2")', hl: true, lines: ['Each key is unique.', 'Values may repeat.'] },
          queue: { q: 'What should I process next?', op: 'queue.poll()', hl: true, lines: ['Take items from the ends.', 'FIFO, LIFO (a stack) or by priority.'] },
        },
        note: 'Each kind of collection answers a different question. A List gives you items by position. A Set tells you whether an item is already there, and it refuses duplicates. A Map finds a value by its key. A Queue or Deque hands out items from its ends, for example first in, first out.',
      },
      {
        panels: {
          list: { q: 'Which class?', lines: ['ArrayList: the default.'] },
          set: { q: 'Which class?', lines: ['HashSet: fastest, no order.', 'LinkedHashSet: insertion order.', 'TreeSet: sorted.'] },
          map: { q: 'Which class?', lines: ['HashMap: fastest, no order.', 'LinkedHashMap: insertion or access.', 'TreeMap: sorted keys.'] },
          queue: { q: 'Which class?', lines: ['ArrayDeque: a stack or FIFO queue.', 'PriorityQueue: smallest first.'] },
        },
        note: 'Then pick the class by the order you need. Use ArrayList for almost every List. For a Set, HashSet has no order, LinkedHashSet keeps insertion order and TreeSet keeps sorted order. Maps follow the same pattern. Use ArrayDeque for stacks and queues, and PriorityQueue when the next item must be the smallest or largest.',
      },
      {
        panels: {
          list: { q: "Today's transactions, in order.", lines: ['ArrayList<Txn>'] },
          set: { q: 'Account numbers processed today.', hl: true, lines: ['HashSet<String>', 'contains() is O(1).'] },
          map: { q: 'Balances, and statements by date.', hl: true, lines: ['HashMap<String, BigDecimal>', 'TreeMap<LocalDate, Statement>'] },
          queue: { q: 'The last 20 transactions.', lines: ['ArrayDeque<Txn>', 'addLast() and pollFirst().'] },
        },
        note: 'A banking example. The account numbers already processed today go in a HashSet, because the only question is "have I seen this one?". The balance of each account goes in a HashMap. Statements sorted by date go in a TreeMap. The last 20 transactions go in an ArrayDeque used as a queue with a size limit.',
      },
    ],
  },
  {
    id: 'arraylist',
    label: 'ArrayList growth',
    title: 'An ArrayList is an array that copies itself into a bigger one when it is full',
    stage: ArrayListStage,
    frames: [
      {
        line: 'list.add("A"); list.add("B"); list.add("C");',
        size: 3,
        cap: 10,
        rows: [{ label: 'backing array (elementData)', cells: slots(3, 10) }],
        note: 'An ArrayList keeps its elements in a plain array. size is the number of slots in use, and capacity is the number of slots that exist. A new ArrayList creates 10 slots on the first add.',
      },
      {
        line: 'list.get(1)',
        result: { text: '"B" in O(1)', tone: 'ok' },
        size: 3,
        cap: 10,
        rows: [{ label: 'backing array (elementData)', cells: slots(3, 10, { 1: 'ok' }) }],
        note: 'get(1) reads slot 1 directly. It does not look at any other slot, so it takes the same time however long the list is: O(1). set(i) works the same way.',
      },
      {
        line: 'list.add("D")',
        result: { text: 'O(1): one write', tone: 'ok' },
        size: 4,
        cap: 10,
        rows: [{ label: 'backing array (elementData)', cells: slots(4, 10, { 3: 'new' }) }],
        note: 'add("D") writes into the next free slot, at index size. It is one write, so it is also O(1). The size grows from 3 to 4, and the capacity stays 10.',
      },
      {
        line: 'list.add("K")  // the array is full',
        result: { text: 'O(n) this time, O(1) on average', tone: 'warn' },
        size: 11,
        cap: 15,
        links: 'copy',
        rows: [
          { label: 'new array: 15 slots (1.5 times bigger)', cells: slots(11, 15, { 10: 'new' }) },
          { label: 'old array: full, thrown away', cells: slots(10, 10), dim: true, noIndex: true },
        ],
        note: 'All 10 slots are used, so there is no room for "K". The list creates a new array about 1.5 times bigger (15 slots) and copies every element across. This one add costs O(n). It happens rarely, so the average cost of add is still O(1). This is called amortised O(1).',
      },
      {
        line: 'list.remove(0)   // a list of six: A to F',
        result: { text: 'O(n): n - 1 elements move', tone: 'bad' },
        size: 5,
        cap: 10,
        links: 'shift',
        rows: [
          { label: 'before: remove "A" at index 0', cells: slots(6, 10, { 0: 'bad' }) },
          { label: 'after: all moved one slot left', cells: slots(6, 10).map((c, i) => ({ t: LETTERS[i + 1] && i < 5 ? LETTERS[i + 1] : '' })), noIndex: true },
        ],
        note: 'Here the list holds six elements, A to F. Removing the first one leaves a gap, so every later element moves one slot to the left (System.arraycopy). That is O(n). Removing the first element of a big ArrayList inside a loop is a classic performance bug. A LinkedList does not shift, but it must walk node by node to reach a position, so it is rarely faster in practice.',
      },
    ],
  },
  {
    id: 'failfast',
    label: 'Fail-fast iteration',
    title: 'Changing a list while you loop over it throws ConcurrentModificationException',
    stage: FailFastStage,
    frames: [
      {
        line: 'for (String s : list) {   // reads "A"',
        cells: cells(['A', 'B', 'C', 'D'], { 0: 'ok' }),
        cursor: 1,
        mod: 4,
        expected: 4,
        check: 'The counters match, so the loop goes on.',
        note: 'Every ArrayList counts its structural changes (adds and removes) in a field called modCount. When a for-each loop starts, its iterator copies the current modCount into expectedModCount. Here both are 4.',
      },
      {
        line: 'if (s.equals("B")) list.remove("B");',
        result: { text: 'modCount is now 5', tone: 'warn' },
        cells: cells(['A', 'C', 'D', ''], {}),
        cursor: 2,
        mod: 5,
        expected: 4,
        check: 'The list changed behind the iterator.',
        note: 'Inside the loop, the code calls list.remove("B") directly on the list. The list removes B, shifts C and D left, and adds one to modCount, which becomes 5. The iterator was not told, so it still expects 4.',
      },
      {
        line: '}  // the loop calls it.next()',
        result: { text: 'throws', tone: 'bad' },
        cells: cells(['A', 'C', 'D', ''], {}),
        cursor: 2,
        mod: 5,
        expected: 4,
        check: 'next() compares them: 5 is not 4.',
        banner: { text: 'ConcurrentModificationException: the loop stops', tone: 'bad' },
        note: 'On the next step, the iterator compares the two counters. They differ, so it throws ConcurrentModificationException. This is called "fail-fast": the iterator stops at once instead of returning wrong data. It is a best-effort check, not a thread-safety guarantee.',
      },
      {
        line: 'it.remove();   // or list.removeIf(s -> s.equals("B"))',
        result: { text: 'no exception', tone: 'ok' },
        cells: cells(['A', 'C', 'D', ''], {}),
        cursor: 1,
        mod: 5,
        expected: 5,
        check: 'it.remove() updated both counters.',
        options: [
          { text: 'list.removeIf(predicate): one pass, no iterator. This is the best option.', tone: 'ok' },
          { text: 'it.remove() on an explicit Iterator: it keeps expectedModCount in step.', tone: 'ok' },
          { text: 'list.remove(...) inside a for-each loop: it throws. Avoid it.', tone: 'bad' },
        ],
        note: 'Remove through the iterator with it.remove(), or call list.removeIf(predicate), which is the shortest and fastest option. Both keep the counters in step, so nothing is thrown. You can also collect the items to remove and call removeAll after the loop.',
      },
    ],
  },
  {
    id: 'ordering',
    label: 'Sorting with Comparator',
    title: 'Comparable is the natural order, and a Comparator is any order you pass in',
    stage: SortStage,
    frames: [
      {
        line: 'List<Txn> txns = loadTransactions();',
        order: ['t1', 't2', 't3', 't4', 't5'],
        key: null,
        note: 'Five transactions arrive in the order they were loaded. Each one has a date, a merchant and an amount. Each step below sorts the same list in a different way.',
      },
      {
        line: 'Collections.sort(txns);   // Txn implements Comparable',
        result: { text: 'sorted by date', tone: 'ok' },
        order: ['t1', 't3', 't4', 't2', 't5'],
        key: 'date',
        note: 'Comparable is implemented by the class itself. Its compareTo method defines one natural order, here by date. String, Integer and LocalDate already have one. TreeSet, TreeMap and Collections.sort use the natural order when you do not pass anything else.',
      },
      {
        line: 'txns.sort(Comparator.comparing(Txn::amount));',
        result: { text: 'sorted by amount', tone: 'ok' },
        order: ['t4', 't5', 't1', 't3', 't2'],
        key: 'amount',
        note: 'A Comparator is a separate object that compares two items. You can have as many as you like: by amount, by merchant, or by date and then amount. It does not change the class, so it also works on classes you cannot edit.',
      },
      {
        line: 'comparing(Txn::date).reversed().thenComparing(Txn::amount, reverseOrder())',
        result: { text: 'newest first, then biggest', tone: 'ok' },
        order: ['t2', 't5', 't4', 't3', 't1'],
        key: 'both',
        hl: ['t2', 't5', 't3', 't1'],
        note: 'Comparators combine. reversed() flips the direction, and thenComparing breaks ties. Here the newest date comes first. The four highlighted rows are two pairs that share a date. Within each pair, the bigger amount comes first. nullsFirst and nullsLast handle missing values.',
      },
      {
        line: '(a, b) -> a.amount - b.amount   // amounts as int',
        result: { text: 'wrong answer', tone: 'bad' },
        order: ['t2', 't5', 't4', 't3', 't1'],
        key: null,
        calc: [
          { code: 'a = 2 000 000 000,  b = -2 000 000 000', says: 'a is clearly bigger, so compare(a, b) must be positive.', tone: 'new' },
          { code: 'a - b  =  -294 967 296', says: 'The true result, 4 000 000 000, does not fit in an int. It wraps round to a negative number.', tone: 'bad' },
          { code: 'Integer.compare(a, b)  =  1', says: 'Integer.compare never overflows, so it gives the right answer.', tone: 'ok' },
        ],
        note: 'A comparator must be consistent. If a comes before b and b comes before c, then a must come before c. Subtracting ints (a - b) can overflow and break this rule. Use Integer.compare or Comparator.comparingInt instead.',
      },
    ],
  },
];
