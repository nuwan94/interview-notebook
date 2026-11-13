// Frame data for the lambdas / functional interfaces / Optional walk-through.
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JAVA_FUNCTIONAL_SCENES = [
  {
    id: 'lambda',
    label: 'From class to lambda',
    title: 'A lambda is a short way to write an object that implements one method',
    frames: [
      {
        note: 'Before Java 8 you passed behaviour by writing an anonymous inner class. To sort accounts by balance you had to write a whole Comparator class body with its method signature just to say "compare the balances".',
        boxes: [b('c', 'Anonymous class', ['new Comparator<Account>() {', '  public int compare(Account a, Account b) {', '    return a.balance().compareTo(b.balance()); } }'], 'warn', 'verbose')],
        deps: [],
      },
      {
        note: 'Comparator has exactly one abstract method, so it is a functional interface. The compiler already knows the method name and parameter types from the target type, so a lambda only needs the parameter names and the body.',
        boxes: [b('l', 'Lambda', ['(a, b) -> a.balance().compareTo(b.balance())'], 'ok', 'same meaning'), b('t', 'Target type', ['Comparator<Account>', 'one abstract method: compare'], 'new')],
        deps: [d('Lambda', 'Target type', 'implements compare', 'ok')],
      },
      {
        note: 'When the lambda only calls an existing method, a method reference is shorter still. Comparator.comparing takes a key extractor, so the whole thing becomes one readable line.',
        boxes: [b('m', 'Method reference', ['Comparator.comparing(Account::balance)'], 'ok', 'shortest'), b('k', 'Four kinds', ['Type::staticMethod', 'instance::method', 'Type::instanceMethod', 'Type::new'], 'new')],
        deps: [d('Method reference', 'Four kinds', 'one of', 'ok')],
      },
      {
        note: 'A lambda is not simply an anonymous class. It compiles to an invokedynamic call and has no separate .class file, and "this" inside a lambda means the enclosing object, not the lambda. A lambda can use local variables from the surrounding method only if they are effectively final.',
        boxes: [b('x', 'Anonymous class', ['own class file', '"this" is the anonymous object'], 'warn'), b('y', 'Lambda', ['invokedynamic, no class file', '"this" is the enclosing object'], 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'interfaces',
    label: 'Core functional interfaces',
    title: 'Four shapes cover most of what you will write: take, return, both, or neither',
    frames: [
      {
        note: 'Predicate<T> takes a value and returns a boolean: test(t). Function<T,R> takes a value and returns another: apply(t). Consumer<T> takes a value and returns nothing: accept(t). Supplier<T> takes nothing and returns a value: get().',
        boxes: [b('p', 'Predicate<T>', ['T -> boolean', 'a.balance() > 0'], 'new'), b('f', 'Function<T,R>', ['T -> R', 'Account::owner'], 'new'), b('c', 'Consumer<T>', ['T -> void', 'System.out::println'], 'new'), b('s', 'Supplier<T>', ['() -> T', 'ArrayList::new'], 'new')],
        deps: [],
      },
      {
        note: 'There are variants: BiFunction and BiPredicate take two arguments, UnaryOperator<T> is Function<T,T>, BinaryOperator<T> is BiFunction<T,T,T>, and IntPredicate, IntFunction, ToIntFunction and friends avoid boxing for primitives.',
        boxes: [b('b', 'BiFunction<A,B,R>', ['two inputs, one result'], 'ok'), b('u', 'UnaryOperator<T>', ['T -> T'], 'ok'), b('i', 'IntPredicate, ToIntFunction', ['no boxing of int'], 'ok', 'primitives')],
        deps: [],
      },
      {
        note: 'Many of them compose. Predicate has and, or and negate; Function has andThen and compose. You build bigger behaviour from small named pieces instead of writing one long lambda.',
        boxes: [b('a', 'isActive', ['Predicate<Account>'], 'ok'), b('h', 'hasFunds', ['Predicate<Account>'], 'ok'), b('r', 'isActive.and(hasFunds)', ['one combined Predicate'], 'new', 'compose')],
        deps: [d('isActive', 'isActive.and(hasFunds)', 'and', 'ok'), d('hasFunds', 'isActive.and(hasFunds)', 'and', 'ok')],
      },
      {
        note: 'Your own interface becomes a functional interface when it has exactly one abstract method. Add @FunctionalInterface so the compiler checks it. Default and static methods do not count.',
        boxes: [b('i', 'interface FeeRule', ['BigDecimal fee(Txn t);', 'default FeeRule cap(...)'], 'new', '@FunctionalInterface'), b('l', 'FeeRule flat = t -> TEN;', ['a lambda is a FeeRule'], 'ok')],
        deps: [d('FeeRule flat = t -> TEN;', 'interface FeeRule', 'implements', 'ok')],
      },
    ],
  },
  {
    id: 'optional',
    label: 'Optional',
    title: 'Optional makes "might be absent" part of the method signature',
    frames: [
      {
        note: 'A method that can find nothing used to return null. The caller forgets the check once and gets a NullPointerException far away. Optional<T> is a box that either holds a value or is empty, and the type tells the caller to handle both.',
        boxes: [b('n', 'Account find(String id)', ['returns null when missing', 'caller must remember to check'], 'bad', 'easy to forget'), b('o', 'Optional<Account> find(String id)', ['Optional.of(a) or Optional.empty()'], 'ok', 'explicit')],
        deps: [],
      },
      {
        note: 'You work with the value through map, filter and flatMap, and each step is skipped when the Optional is empty. This chain finds an account, takes its owner and gets the owner email in one expression, with no null checks.',
        boxes: [b('a', 'find(id)', ['Optional<Account>'], 'new'), b('m', '.map(Account::owner)', ['Optional<Customer>'], 'ok'), b('e', '.map(Customer::email)', ['Optional<String>'], 'ok'), b('r', '.orElse("none")', ['String, never null'], 'ok', 'unwrap')],
        deps: [d('find(id)', '.map(Account::owner)', 'if present', 'ok'), d('.map(Account::owner)', '.map(Customer::email)', 'if present', 'ok'), d('.map(Customer::email)', '.orElse("none")', 'default', 'ok')],
      },
      {
        note: 'Unwrap deliberately. orElse(x) always evaluates x, orElseGet(supplier) only runs the supplier when empty, and orElseThrow throws when missing. Avoid get() without a check, because it throws NoSuchElementException and brings the null problem back.',
        boxes: [b('x', 'orElse(createDefault())', ['createDefault() runs every time'], 'warn'), b('y', 'orElseGet(this::createDefault)', ['runs only when empty'], 'ok'), b('z', 'orElseThrow(NotFoundException::new)', ['empty means an error'], 'ok')],
        deps: [],
      },
      {
        note: 'Use Optional for return values. Do not use it for fields, method parameters or collection elements, and never return a null Optional. Return an empty collection, not Optional<List>, for "no results".',
        boxes: [b('g', 'Good', ['return type of a find method'], 'ok'), b('b1', 'Bad', ['field: private Optional<X> x', 'parameter: foo(Optional<X>)'], 'bad'), b('b2', 'Bad', ['Optional<List<X>> for no results'], 'bad')],
        deps: [],
      },
    ],
  },
  {
    id: 'capture',
    label: 'Captured variables',
    title: 'A lambda can read local variables, but only if they never change',
    frames: [
      {
        note: 'A lambda can use variables from the method around it. The lambda may run later, on another thread, after the method has returned, so it gets a copy of the value at the moment it was created.',
        boxes: [b('m', 'Method', ['BigDecimal limit = new BigDecimal("1000");'], 'new'), b('l', 'Lambda', ['t -> t.amount().compareTo(limit) > 0', 'captures a copy of limit'], 'ok')],
        deps: [d('Lambda', 'Method', 'captures limit', 'ok')],
      },
      {
        note: 'Because it is a copy, the variable must not change afterwards. Java requires such variables to be final or effectively final (assigned only once). A counter that you try to increment from inside the lambda does not compile.',
        boxes: [b('x', 'int count = 0;', ['list.forEach(t -> count++);'], 'bad', 'compile error'), b('e', 'Error message', ['local variables referenced from a lambda', 'must be final or effectively final'], 'bad')],
        deps: [d('int count = 0;', 'Error message', 'rejected', 'bad')],
      },
      {
        note: 'Do not work around it with a one-element array or a mutable holder in parallel code: it hides a race condition. Prefer a result-producing operation instead of mutating state from a lambda: count with stream.count(), sum with a reduction, or use an AtomicInteger when you must share a counter between threads.',
        boxes: [b('a', 'long n = list.stream().filter(p).count();', ['no mutation at all'], 'ok', 'best'), b('b', 'AtomicInteger counter', ['safe when lambdas run on many threads'], 'ok'), b('c', 'int[] holder = {0};', ['hides a data race'], 'bad', 'avoid')],
        deps: [],
      },
    ],
  },
];
