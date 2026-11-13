// Frame data for the Java Streams walk-through.
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JAVA_STREAMS_SCENES = [
  {
    id: 'pipeline',
    label: 'The pipeline',
    title: 'A stream is a recipe: source, intermediate steps, one terminal step',
    frames: [
      {
        note: 'A pipeline has three parts. A source (a collection, array or generator), zero or more intermediate operations such as filter and map that each return a new stream, and exactly one terminal operation such as collect, count or forEach that produces the result.',
        boxes: [b('s', 'Source', ['transactions.stream()'], 'new'), b('i', 'Intermediate', ['filter(Txn::isDebit)', 'map(Txn::amount)'], 'ok', 'lazy'), b('t', 'Terminal', ['reduce(ZERO, BigDecimal::add)'], 'warn', 'runs it')],
        deps: [d('Source', 'Intermediate', 'elements flow', 'ok'), d('Intermediate', 'Terminal', 'elements flow', 'ok')],
      },
      {
        note: 'Intermediate operations are lazy: writing them does nothing. No element is touched until the terminal operation starts the pipeline. If you build a stream and never call a terminal operation, the code in the lambdas never runs.',
        boxes: [b('a', 'filter(...).map(...)', ['no terminal operation', 'nothing executed, nothing printed'], 'warn', 'lazy'), b('b', '.collect(toList())', ['terminal call', 'now the work happens'], 'ok')],
        deps: [d('filter(...).map(...)', '.collect(toList())', 'start', 'ok')],
      },
      {
        note: 'Elements move through the whole pipeline one at a time, not stage by stage. The first element goes through filter and then map before the second element is even read. That is why findFirst and limit can stop early without processing the rest.',
        boxes: [b('e1', 'Element 1', ['filter passes', 'map runs', 'collected'], 'ok'), b('e2', 'Element 2', ['filter rejects', 'stops here'], 'warn'), b('e3', 'Element 3', ['filter passes', 'map runs', 'collected'], 'ok')],
        deps: [],
      },
      {
        note: 'A stream can be consumed only once. After a terminal operation it is closed, and reusing it throws IllegalStateException. Keep the source collection and create a new stream when you need another pass. Streams do not change the source collection.',
        boxes: [b('s', 'Stream', ['count() already called'], 'bad', 'closed'), b('x', 'second terminal call', ['IllegalStateException:', 'stream has already been operated upon'], 'bad'), b('c', 'Source list', ['unchanged, can stream() again'], 'ok')],
        deps: [d('second terminal call', 'Stream', 'reuse', 'bad')],
      },
    ],
  },
  {
    id: 'collectors',
    label: 'Collectors',
    title: 'collect() turns a stream into a list, a map or a summary in one step',
    frames: [
      {
        note: 'Collectors.toList(), toSet() and toMap() gather the elements. Since Java 16 stream.toList() is the shortest way to an unmodifiable list. toMap needs a key function and a value function, and throws if two elements produce the same key unless you give a merge function.',
        boxes: [b('l', 'toList()', ['stream.toList() in Java 16+'], 'ok'), b('s', 'toSet()', ['no duplicates'], 'ok'), b('m', 'toMap(key, value, merge)', ['duplicate key without merge:', 'IllegalStateException'], 'warn')],
        deps: [],
      },
      {
        note: 'groupingBy splits the stream into groups by a classifier and gives a Map of key to list. Here accounts are grouped by branch. A downstream collector changes what each group holds, for example counting or summing instead of listing.',
        boxes: [b('a', 'accounts.stream()', ['10 accounts'], 'new'), b('g', 'groupingBy(Account::branch)', ['Map<String, List<Account>>'], 'ok'), b('r', 'Result', ['"Colombo" -> [A1, A4, A7]', '"Kandy" -> [A2, A5]', '"Galle" -> [A3, A6, A8]'], 'ok')],
        deps: [d('accounts.stream()', 'groupingBy(Account::branch)', 'classify', 'ok'), d('groupingBy(Account::branch)', 'Result', 'collect', 'ok')],
      },
      {
        note: 'Downstream collectors go in the second argument: counting() gives a count per group, summingInt or summarizingDouble give totals, mapping and averagingDouble transform each group, and partitioningBy splits into exactly two groups, true and false.',
        boxes: [b('c', 'groupingBy(branch, counting())', ['Map<String, Long>'], 'ok'), b('s', 'groupingBy(branch, summingDouble(balance))', ['Map<String, Double>'], 'ok'), b('p', 'partitioningBy(Account::isActive)', ['Map<Boolean, List<Account>>'], 'ok')],
        deps: [],
      },
      {
        note: 'joining(", ") concatenates strings, and teeing runs two collectors at once. For custom needs, Collector.of builds your own. Prefer the built-in collectors: they are tested, readable and parallel-safe.',
        boxes: [b('j', 'joining(", ")', ['"A1, A2, A3"'], 'ok'), b('t', 'teeing(min, max, combine)', ['two results in one pass'], 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'flatmap',
    label: 'map vs flatMap',
    title: 'map transforms each element one to one, flatMap flattens a stream of streams',
    frames: [
      {
        note: 'map turns each element into exactly one other element. Mapping each customer to their list of accounts gives a stream of lists, which is rarely what you want: Stream<List<Account>>.',
        boxes: [b('c', 'Stream<Customer>', ['Ana, Ben'], 'new'), b('m', '.map(Customer::accounts)', ['Stream<List<Account>>', '[[A1, A2], [A3]]'], 'warn', 'nested')],
        deps: [d('Stream<Customer>', '.map(Customer::accounts)', 'one to one', 'warn')],
      },
      {
        note: 'flatMap takes a function that returns a stream for each element and flattens all those streams into one. The nested lists become one flat stream of accounts.',
        boxes: [b('c', 'Stream<Customer>', ['Ana, Ben'], 'new'), b('f', '.flatMap(c -> c.accounts().stream())', ['Stream<Account>', 'A1, A2, A3'], 'ok', 'flat')],
        deps: [d('Stream<Customer>', '.flatMap(c -> c.accounts().stream())', 'one to many', 'ok')],
      },
      {
        note: 'Typical uses: all words from a list of lines, all order lines from a list of orders, and Optional chains where the inner call also returns an Optional (so map would give Optional<Optional<T>>).',
        boxes: [b('a', 'lines -> words', ['flatMap(l -> Arrays.stream(l.split(" ")))'], 'ok'), b('b', 'orders -> lines', ['flatMap(o -> o.lines().stream())'], 'ok'), b('c', 'Optional chains', ['flatMap(this::findBranch)'], 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'parallel',
    label: 'Parallel streams',
    title: 'parallel() splits the work across threads, but it is not free and not always faster',
    frames: [
      {
        note: 'Calling parallelStream() or parallel() splits the source into chunks that the common ForkJoinPool processes on several threads, then combines the results. For a large, CPU-bound, stateless computation on an array or ArrayList this can speed things up.',
        boxes: [b('s', 'Source', ['ArrayList with 5 million numbers'], 'new'), b('p', 'ForkJoinPool.commonPool', ['thread 1: chunk 1', 'thread 2: chunk 2', 'thread 3: chunk 3'], 'ok', 'parallel'), b('r', 'Combine', ['merge partial results'], 'ok')],
        deps: [d('Source', 'ForkJoinPool.commonPool', 'split', 'ok'), d('ForkJoinPool.commonPool', 'Combine', 'merge', 'ok')],
      },
      {
        note: 'It is wrong or slower in many cases. Shared mutable state from a lambda causes data races. Blocking I/O inside the lambda starves the common pool for the whole JVM. Small data, LinkedList or Stream.iterate sources, and cheap operations cost more to split than to run. Ordered operations such as limit and findFirst limit the gain.',
        boxes: [b('a', 'Shared ArrayList.add()', ['data race, lost elements'], 'bad'), b('b', 'Remote call in a lambda', ['blocks the common pool for everyone'], 'bad'), b('c', 'Small list or cheap map', ['overhead is larger than the gain'], 'warn')],
        deps: [],
      },
      {
        note: 'Rule of thumb: measure first, keep the lambdas pure (no side effects), and use parallel streams only for CPU-bound work on large, easily split data. In a Spring service handling many requests, prefer virtual threads or an executor you control instead of the shared common pool.',
        boxes: [b('m', 'Measure', ['benchmark with JMH'], 'ok'), b('p', 'Pure functions', ['no shared state'], 'ok'), b('e', 'Your own executor', ['predictable, isolated'], 'ok', 'for I/O')],
        deps: [],
      },
    ],
  },
];
