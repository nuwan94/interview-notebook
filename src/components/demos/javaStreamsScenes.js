// Frame data for the Java Streams walk-through. Every scene uses ChipColumnsStage: each column is one step of
// the pipeline (or one collector), and the chips are the elements, so you can see where each element is.

import { ChipColumnsStage } from './ChipColumnsStage.jsx';

const c = (id, text, sub, tone, group) => ({ id, text, sub, tone, group });

// --- the pipeline scene: three transactions go through filter(isDebit), map(amount) and reduce(add) ---
const PIPE = 'txns.stream().filter(Txn::isDebit).map(Txn::amount).reduce(ZERO, BigDecimal::add)';
const T1 = 'T1 debit 50';
const T2 = 'T2 credit 20';
const T3 = 'T3 debit 30';
const pipe = (src, flt, mp, red, emptyText = '(nothing yet)') => [
  { id: 'src', title: 'Source', sub: 'txns.stream()', items: src },
  { id: 'flt', title: 'filter', sub: 'Txn::isDebit', empty: emptyText, items: flt },
  { id: 'map', title: 'map', sub: 'Txn::amount', empty: emptyText, items: mp },
  { id: 'red', title: 'reduce', sub: 'BigDecimal::add', empty: emptyText, items: red },
];
const waiting = [c('s1', T1), c('s2', T2), c('s3', T3)];

// --- the collectors scene: six accounts in three branches ---
const accounts = [
  c('a1', 'A1 Colombo'), c('a2', 'A2 Kandy'), c('a3', 'A3 Galle'),
  c('a4', 'A4 Colombo'), c('a5', 'A5 Kandy'), c('a6', 'A6 Galle'),
];

// --- the flatMap scene: two customers with their accounts ---
const customers = [
  c('ca1', 'A1', null, 'none', 'ana'), c('ca2', 'A2', null, 'none', 'ana'),
  c('cb3', 'A3', null, 'none', 'ben'),
];
const customerCol = { id: 'cust', title: 'Stream<Customer>', sub: '2 elements', groups: { ana: 'Ana', ben: 'Ben' }, items: customers };

export const JAVA_STREAMS_SCENES = [
  {
    id: 'pipeline',
    label: 'The pipeline',
    title: 'A stream is a recipe: source, intermediate steps, one terminal step',
    stage: ChipColumnsStage,
    frames: [
      {
        line: PIPE,
        columns: pipe(waiting, [], [], []),
        flow: true,
        note: 'A pipeline has three parts. The source gives the elements. Intermediate operations, such as filter and map, each add a step. Exactly one terminal operation, such as reduce, collect or count, produces the result.',
      },
      {
        line: 'txns.stream().filter(Txn::isDebit).map(Txn::amount);   // no terminal operation',
        result: { text: 'nothing runs', tone: 'warn' },
        columns: pipe(waiting, [], [], [], '(waiting)'),
        flow: true,
        flowTone: 'off',
        note: 'Intermediate operations are lazy: writing them does nothing. No element moves until a terminal operation starts the pipeline. Without a terminal operation, the code in the lambdas never runs.',
      },
      {
        line: PIPE,
        result: { text: 'reduce starts the pipeline: T1 first', tone: 'new' },
        columns: pipe([c('s1', T1, null, 'off'), c('s2', T2), c('s3', T3)], [c('f1', T1, null, 'ok')], [], [c('r', 'total = 0', null, 'new')]),
        links: [{ from: 's1', to: 'f1' }],
        focus: ['s1', 'f1'],
        note: 'reduce is the terminal operation, so now the work starts. The pipeline pulls the first element, T1, from the source. T1 is a debit, so filter lets it through.',
      },
      {
        line: PIPE,
        result: { text: 'T1 goes all the way: total = 50', tone: 'ok' },
        columns: pipe([c('s1', T1, null, 'off'), c('s2', T2), c('s3', T3)], [c('f1', T1, null, 'off')], [c('m1', '50', null, 'ok')], [c('r', 'total = 50', null, 'ok')]),
        links: [{ from: 'f1', to: 'm1' }, { from: 'm1', to: 'r' }],
        focus: ['f1', 'm1', 'r'],
        note: 'T1 goes through the whole pipeline before T2 is even read. map turns it into its amount, 50, and reduce adds that to the total. Elements move one at a time, not step by step.',
      },
      {
        line: PIPE,
        result: { text: 'T2 is rejected by filter', tone: 'bad' },
        columns: pipe([c('s1', T1, null, 'off'), c('s2', T2, null, 'off'), c('s3', T3)], [c('f1', T1, null, 'off'), c('f2', T2, 'not a debit', 'bad')], [c('m1', '50', null, 'off')], [c('r', 'total = 50', null, 'ok')]),
        links: [{ from: 's2', to: 'f2', tone: 'bad' }],
        focus: ['s2', 'f2'],
        note: 'Next the pipeline pulls T2. It is a credit, so filter stops it. map and reduce never see it, and the total stays 50.',
      },
      {
        line: PIPE,
        result: { text: 'done: total = 80', tone: 'ok' },
        columns: pipe(
          [c('s1', T1, null, 'off'), c('s2', T2, null, 'off'), c('s3', T3, null, 'off')],
          [c('f1', T1, null, 'off'), c('f2', T2, 'not a debit', 'off'), c('f3', T3, null, 'ok')],
          [c('m1', '50', null, 'off'), c('m3', '30', null, 'ok')],
          [c('r', 'total = 80', null, 'ok')],
        ),
        links: [{ from: 's3', to: 'f3' }, { from: 'f3', to: 'm3' }, { from: 'm3', to: 'r' }],
        focus: ['s3', 'f3', 'm3', 'r'],
        note: 'T3 is a debit. It passes filter, becomes 30 in map, and reduce adds it: the total is 80. Because elements move one at a time, findFirst and limit can stop early without reading the rest.',
      },
      {
        line: 'stream.count();   // a second terminal call on the same stream',
        result: { text: 'IllegalStateException', tone: 'bad' },
        columns: pipe([c('s1', T1, 'still in the list', 'ok'), c('s2', T2, 'still in the list', 'ok'), c('s3', T3, 'still in the list', 'ok')], [], [], [c('x', 'stream closed', 'already used', 'bad')], '(stream closed)'),
        note: 'A stream can be used only once. After the terminal operation it is closed, and using it again throws IllegalStateException. The source list is unchanged, so call stream() on it again for another pass.',
      },
    ],
  },
  {
    id: 'collectors',
    label: 'Collectors',
    title: 'collect() turns a stream into a list, a map or a summary in one step',
    stage: ChipColumnsStage,
    frames: [
      {
        line: 'ids.stream().collect(...)   // three different collectors',
        result: { text: 'toMap fails on a duplicate key', tone: 'warn' },
        columns: [
          { id: 'src', title: 'Stream', sub: '3 ids', flex: 0.8, items: [c('i1', 'ACC-1'), c('i2', 'ACC-2'), c('i3', 'ACC-1')] },
          { id: 'tl', title: 'toList()', sub: 'keeps all', items: [c('l1', 'ACC-1', null, 'ok'), c('l2', 'ACC-2', null, 'ok'), c('l3', 'ACC-1', null, 'ok')] },
          { id: 'ts', title: 'toSet()', sub: 'no duplicates', items: [c('t1', 'ACC-1', null, 'ok'), c('t2', 'ACC-2', null, 'ok')] },
          { id: 'tm', title: 'toMap(k, v)', sub: 'one value per key', items: [c('m1', 'Duplicate key', 'ACC-1 twice', 'bad')] },
        ],
        note: 'Each column is a separate collect call on the same three ids. toList keeps every element, and since Java 16 stream.toList() is the shortest way. toSet drops duplicates. toMap throws IllegalStateException on a duplicate key, unless you pass a merge function.',
      },
      {
        line: 'accounts.stream().collect(groupingBy(Account::branch))',
        result: { text: 'Map<String, List<Account>>', tone: 'ok' },
        columns: [
          { id: 'src', title: 'Stream<Account>', sub: '6 accounts', items: accounts },
          {
            id: 'res',
            title: 'groupingBy(branch)',
            sub: 'one list per branch',
            groups: { col: '"Colombo"', kan: '"Kandy"', gal: '"Galle"' },
            items: [
              c('g1', 'A1', null, 'ok', 'col'), c('g4', 'A4', null, 'ok', 'col'),
              c('g2', 'A2', null, 'ok', 'kan'), c('g5', 'A5', null, 'ok', 'kan'),
              c('g3', 'A3', null, 'ok', 'gal'), c('g6', 'A6', null, 'ok', 'gal'),
            ],
          },
        ],
        flow: true,
        note: 'groupingBy splits the stream into groups by a key, here the branch. The result is a map from each branch to the list of its accounts.',
      },
      {
        line: 'groupingBy(Account::branch, counting())   and   partitioningBy(Account::isActive)',
        result: { text: 'a count per group, and two groups', tone: 'ok' },
        columns: [
          {
            id: 'src',
            title: 'Stream<Account>',
            items: [
              c('a1', 'A1 Colombo', 'active'), c('a2', 'A2 Kandy', 'active'), c('a3', 'A3 Galle', 'inactive', 'warn'),
              c('a4', 'A4 Colombo', 'active'), c('a5', 'A5 Kandy', 'active'), c('a6', 'A6 Galle', 'inactive', 'warn'),
            ],
          },
          { id: 'cnt', title: 'counting()', sub: 'Map<String, Long>', items: [c('n1', 'Colombo = 2', null, 'ok'), c('n2', 'Kandy = 2', null, 'ok'), c('n3', 'Galle = 2', null, 'ok')] },
          {
            id: 'part',
            title: 'partitioningBy',
            sub: 'Map<Boolean, List>',
            groups: { yes: 'true', no: 'false' },
            items: [
              c('p1', 'A1', null, 'ok', 'yes'), c('p2', 'A2', null, 'ok', 'yes'), c('p4', 'A4', null, 'ok', 'yes'), c('p5', 'A5', null, 'ok', 'yes'),
              c('p3', 'A3', null, 'warn', 'no'), c('p6', 'A6', null, 'warn', 'no'),
            ],
          },
        ],
        note: 'A second collector, the downstream collector, changes what each group holds. counting() gives a count per branch. summingDouble, averagingDouble and mapping work the same way. partitioningBy always splits into exactly two groups, true and false.',
      },
      {
        line: 'collect(joining(", "))   and   collect(teeing(minBy(...), maxBy(...), ...))',
        result: { text: 'one result string, two results in one pass', tone: 'ok' },
        columns: [
          { id: 'src', title: 'Stream<Account>', items: [c('a1', 'A1', 'balance 900'), c('a2', 'A2', 'balance 100'), c('a3', 'A3', 'balance 400')] },
          { id: 'join', title: 'joining(", ")', sub: 'one String', items: [c('j', '"A1, A2, A3"', null, 'ok')] },
          { id: 'tee', title: 'teeing', sub: 'two collectors at once', items: [c('t', 'min 100, max 900', 'one pass over the data', 'ok')] },
        ],
        note: 'joining(", ") joins strings with a separator. teeing runs two collectors at once and combines their results. Collector.of lets you build your own, but prefer the built-in collectors: they are tested, readable and safe in parallel.',
      },
    ],
  },
  {
    id: 'flatmap',
    label: 'map vs flatMap',
    title: 'map transforms each element one to one, flatMap flattens a stream of streams',
    stage: ChipColumnsStage,
    frames: [
      {
        line: 'customers.stream().map(Customer::accounts)',
        result: { text: 'Stream<List<Account>>: nested', tone: 'warn' },
        columns: [
          customerCol,
          {
            id: 'out',
            title: 'map(Customer::accounts)',
            sub: '2 elements, each a List',
            groups: { l1: 'List [A1, A2]', l2: 'List [A3]' },
            items: [c('la1', 'A1', null, 'warn', 'l1'), c('la2', 'A2', null, 'warn', 'l1'), c('lb3', 'A3', null, 'warn', 'l2')],
          },
        ],
        links: [{ from: 'ana', to: 'l1', tone: 'warn' }, { from: 'ben', to: 'l2', tone: 'warn' }],
        note: 'map turns each element into exactly one new element. Each customer becomes one list of accounts, so you get a stream of two lists. That is rarely what you want.',
      },
      {
        line: 'customers.stream().flatMap(c -> c.accounts().stream())',
        result: { text: 'Stream<Account>: flat', tone: 'ok' },
        columns: [
          customerCol,
          { id: 'out', title: 'flatMap(...)', sub: '3 elements', items: [c('f1', 'A1', null, 'ok'), c('f2', 'A2', null, 'ok'), c('f3', 'A3', null, 'ok')] },
        ],
        links: [{ from: 'ana', to: 'f1' }, { from: 'ana', to: 'f2' }, { from: 'ben', to: 'f3' }],
        note: 'flatMap takes a function that returns a stream for each element. Then it joins all those streams into one. The nested lists become one flat stream of three accounts.',
      },
      {
        line: 'lines.stream().flatMap(l -> Arrays.stream(l.split(" ")))',
        result: { text: '2 lines become 4 words', tone: 'ok' },
        columns: [
          { id: 'lines', title: 'Stream<String>', sub: 'lines', items: [c('l1', '"pay rent"'), c('l2', '"save more"')] },
          { id: 'words', title: 'flatMap(split)', sub: 'words', items: [c('w1', '"pay"', null, 'ok'), c('w2', '"rent"', null, 'ok'), c('w3', '"save"', null, 'ok'), c('w4', '"more"', null, 'ok')] },
        ],
        links: [{ from: 'l1', to: 'w1' }, { from: 'l1', to: 'w2' }, { from: 'l2', to: 'w3' }, { from: 'l2', to: 'w4' }],
        note: 'Typical uses: all the words in a list of lines, all the order lines in a list of orders, and Optional chains where the next call also returns an Optional. With map, that last case would give an Optional<Optional<T>>.',
      },
    ],
  },
  {
    id: 'parallel',
    label: 'Parallel streams',
    title: 'parallel() splits the work across threads, but it is not free and not always faster',
    stage: ChipColumnsStage,
    frames: [
      {
        line: 'numbers.parallelStream().mapToInt(n -> n).sum()',
        result: { text: 'sum = 210', tone: 'ok' },
        columns: [
          {
            id: 'src',
            title: 'ArrayList, split',
            sub: 'into chunks',
            groups: { k1: 'chunk 1', k2: 'chunk 2', k3: 'chunk 3' },
            items: [
              c('n1', '10', null, 'none', 'k1'), c('n2', '20', null, 'none', 'k1'),
              c('n3', '30', null, 'none', 'k2'), c('n4', '40', null, 'none', 'k2'),
              c('n5', '50', null, 'none', 'k3'), c('n6', '60', null, 'none', 'k3'),
            ],
          },
          {
            id: 'pool',
            title: 'ForkJoinPool',
            sub: 'common pool threads',
            items: [c('t1', 'thread 1: 30', '10 + 20', 'new'), c('t2', 'thread 2: 70', '30 + 40', 'new'), c('t3', 'thread 3: 110', '50 + 60', 'new')],
          },
          { id: 'sum', title: 'Combine', sub: 'merge the parts', items: [c('r', '210', '30 + 70 + 110', 'ok')] },
        ],
        links: [{ from: 'k1', to: 't1' }, { from: 'k2', to: 't2' }, { from: 'k3', to: 't3' }, { from: 't1', to: 'r' }, { from: 't2', to: 'r' }, { from: 't3', to: 'r' }],
        note: 'parallelStream() splits the source into chunks. Threads of the common ForkJoinPool work on the chunks at the same time, and the partial results are combined. For a large, CPU-bound job on an array or ArrayList, this can be faster.',
      },
      {
        line: 'list.parallelStream()...',
        result: { text: 'often wrong or slower', tone: 'bad' },
        columns: [
          {
            id: 'mistake',
            title: 'What you do',
            items: [
              c('m1', 'results.add(x)', 'in forEach, shared ArrayList', 'warn'),
              c('m2', 'callBank(id)', 'a blocking call in map', 'warn'),
              c('m3', 'a list of 10 items', 'with cheap work', 'warn'),
              c('m4', 'LinkedList source', 'or Stream.iterate', 'warn'),
            ],
          },
          {
            id: 'effect',
            title: 'What goes wrong',
            items: [
              c('e1', 'lost elements', 'a data race', 'bad'),
              c('e2', 'common pool blocked', 'for the whole JVM', 'bad'),
              c('e3', 'slower than sequential', 'splitting costs more', 'bad'),
              c('e4', 'little gain', 'it splits badly', 'bad'),
            ],
          },
        ],
        links: [{ from: 'm1', to: 'e1', tone: 'bad' }, { from: 'm2', to: 'e2', tone: 'bad' }, { from: 'm3', to: 'e3', tone: 'bad' }, { from: 'm4', to: 'e4', tone: 'bad' }],
        note: 'Parallel streams are wrong or slower in many cases. Shared changeable state causes data races. A blocking call starves the common pool, which the whole JVM shares. Small data, cheap work and sources that split badly cost more to split than to run.',
      },
      {
        line: 'measure first',
        result: { text: 'rule of thumb', tone: 'new' },
        columns: [
          {
            id: 'yes',
            title: 'Use parallel only when',
            items: [
              c('y1', 'the data is large', null, 'ok'),
              c('y2', 'the work is CPU-bound', null, 'ok'),
              c('y3', 'lambdas are pure', 'no shared state', 'ok'),
              c('y4', 'the source splits well', 'ArrayList, array, range', 'ok'),
            ],
          },
          {
            id: 'else',
            title: 'Otherwise',
            items: [
              c('o1', 'measure with JMH', 'before and after', 'new'),
              c('o2', 'your own executor', 'or virtual threads for I/O', 'new'),
            ],
          },
        ],
        note: 'Measure first. Keep the lambdas pure, with no side effects. Use parallel streams only for CPU-bound work on large data that splits easily. In a Spring service that handles many requests, use virtual threads or an executor you control, not the shared common pool.',
      },
    ],
  },
];
