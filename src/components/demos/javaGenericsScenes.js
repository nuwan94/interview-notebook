// Frame data for the Java Generics walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JAVA_GENERICS_SCENES = [
  {
    id: 'why',
    label: 'Why generics',
    title: 'Generics move type errors from run time to compile time and remove casts',
    frames: [
      {
        note: 'Before generics a List held Objects. You could put anything in, and every read needed a cast. A wrong cast compiled fine and failed later with a ClassCastException, possibly far from the real mistake.',
        boxes: [b('a', 'List accounts = new ArrayList()', ['raw type: holds any Object'], 'warn'), b('b', 'accounts.add("oops")', ['compiles, no complaint'], 'bad', 'wrong type'), b('c', 'Account a = (Account) accounts.get(0)', ['ClassCastException at run time'], 'bad', 'late failure')],
        deps: [d('List accounts = new ArrayList()', 'accounts.add("oops")', 'allows', 'bad'), d('accounts.add("oops")', 'Account a = (Account) accounts.get(0)', 'later', 'bad')],
      },
      {
        note: 'With List<Account> the compiler knows the element type. Adding a String is a compile error, and get returns an Account with no cast. The mistake is caught immediately, in the editor.',
        boxes: [b('a', 'List<Account> accounts', ['typed collection'], 'ok'), b('b', 'accounts.add("oops")', ['compile error'], 'ok', 'caught early'), b('c', 'Account a = accounts.get(0)', ['no cast needed'], 'ok')],
        deps: [d('List<Account> accounts', 'Account a = accounts.get(0)', 'typed result', 'ok')],
      },
      {
        note: 'You can write your own generic classes and methods the same way. A type parameter such as T is a placeholder filled in by the caller. One Result<T> or Pair<K, V> class then works for any type, still type-checked.',
        boxes: [b('c', 'class Result<T>', ['T value; boolean ok'], 'new'), b('x', 'Result<Account>', ['T = Account'], 'ok'), b('y', 'Result<BigDecimal>', ['T = BigDecimal'], 'ok')],
        deps: [d('class Result<T>', 'Result<Account>', 'instantiated', 'ok'), d('class Result<T>', 'Result<BigDecimal>', 'instantiated', 'ok')],
      },
    ],
  },
  {
    id: 'erasure',
    label: 'Type erasure',
    title: 'The compiler checks the types and then erases them: at run time List<String> is just List',
    frames: [
      {
        note: 'Generics exist only in source code and the compiler. For compatibility with old code, javac type-checks your generic code and then erases the type parameters: T becomes its bound (or Object) and casts are inserted where needed.',
        boxes: [b('s', 'Source', ['List<String> names', 'String n = names.get(0)'], 'new'), b('c', 'Compiler', ['checks types', 'erases type arguments'], 'ok', 'javac'), b('b', 'Bytecode', ['List names', 'String n = (String) names.get(0)'], 'ok', 'erased')],
        deps: [d('Source', 'Compiler', 'compile', 'ok'), d('Compiler', 'Bytecode', 'erase and cast', 'ok')],
      },
      {
        note: 'So at run time a List<String> and a List<Integer> are the same class. This is why you cannot write instanceof List<String>, new T(), new T[10] or catch a generic exception, and why two methods that differ only in their generic argument clash.',
        boxes: [b('a', 'list instanceof List<String>', ['not allowed: type is erased'], 'bad'), b('b', 'new T()', ['not allowed: T unknown at run time'], 'bad'), b('c', 'void f(List<String>) and void f(List<Integer>)', ['same erasure: name clash'], 'bad')],
        deps: [],
      },
      {
        note: 'A common workaround is a type token: pass a Class<T> so the code has a real runtime type, for example clazz.getDeclaredConstructor().newInstance() or clazz.cast(obj). Libraries such as Jackson use a TypeReference for List<Account> for the same reason.',
        boxes: [b('t', 'Class<T> token', ['carries a real Class object'], 'ok'), b('c', 'clazz.cast(obj)', ['checked cast at run time'], 'ok'), b('j', 'TypeReference<List<Account>>', ['keeps the generic type for Jackson'], 'ok')],
        deps: [d('Class<T> token', 'clazz.cast(obj)', 'enables', 'ok')],
      },
      {
        note: 'Because of erasure, generics and arrays mix badly. Arrays remember their element type at run time and are covariant, so a String[] can be treated as Object[] and storing an Integer fails with ArrayStoreException. Generic collections are invariant and checked at compile time instead, which is safer.',
        boxes: [b('a', 'Object[] o = new String[1]', ['allowed: arrays are covariant'], 'warn'), b('b', 'o[0] = 42', ['ArrayStoreException at run time'], 'bad'), b('c', 'List<Object> l = new ArrayList<String>()', ['compile error: generics are invariant'], 'ok', 'safe')],
        deps: [d('Object[] o = new String[1]', 'o[0] = 42', 'then', 'bad')],
      },
    ],
  },
  {
    id: 'wildcards',
    label: 'Wildcards and PECS',
    title: 'Producer extends, Consumer super: choose the wildcard by whether you read or write',
    frames: [
      {
        note: 'List<Integer> is not a List<Number>, even though Integer is a Number. If it were, you could add a Double to a list of Integers. Generics are invariant, so a method taking List<Number> rejects List<Integer>. Wildcards give flexibility safely.',
        boxes: [b('a', 'List<Integer>', ['list of Integers'], 'new'), b('b', 'List<Number>', ['list of Numbers'], 'new'), b('c', 'sum(List<Number>) with List<Integer>', ['compile error'], 'bad', 'not a subtype')],
        deps: [d('List<Integer>', 'sum(List<Number>) with List<Integer>', 'passed to', 'bad')],
      },
      {
        note: '? extends Number means "a list of some unknown subtype of Number". You can read from it and get Numbers, but you cannot add anything (except null) because you do not know the exact element type. Use it for a producer: the list gives you values.',
        boxes: [b('a', 'List<? extends Number> src', ['accepts List<Integer>, List<Double>'], 'ok'), b('r', 'Number n = src.get(0)', ['reading is safe'], 'ok', 'producer'), b('w', 'src.add(1)', ['compile error'], 'bad', 'cannot write')],
        deps: [d('List<? extends Number> src', 'Number n = src.get(0)', 'read', 'ok'), d('List<? extends Number> src', 'src.add(1)', 'write', 'bad')],
      },
      {
        note: '? super Integer means "a list of Integer or any supertype of Integer". You can add Integers to it, but anything you read is only an Object. Use it for a consumer: the list receives your values.',
        boxes: [b('a', 'List<? super Integer> dst', ['accepts List<Integer>, List<Number>, List<Object>'], 'ok'), b('w', 'dst.add(1)', ['writing is safe'], 'ok', 'consumer'), b('r', 'Integer x = dst.get(0)', ['compile error: only Object'], 'bad', 'cannot read')],
        deps: [d('List<? super Integer> dst', 'dst.add(1)', 'write', 'ok'), d('List<? super Integer> dst', 'Integer x = dst.get(0)', 'read', 'bad')],
      },
      {
        note: 'PECS: Producer Extends, Consumer Super. A copy method reads from a source (producer) and writes to a destination (consumer): copy(List<? super T> dst, List<? extends T> src). Collections.copy and Comparator<? super T> in the standard library follow it.',
        boxes: [b('p', 'List<? extends T> src', ['producer: extends'], 'ok'), b('c', 'List<? super T> dst', ['consumer: super'], 'ok'), b('m', 'copy(dst, src)', ['most flexible signature'], 'new', 'PECS')],
        deps: [d('List<? extends T> src', 'copy(dst, src)', 'reads from', 'ok'), d('copy(dst, src)', 'List<? super T> dst', 'writes to', 'ok')],
      },
    ],
  },
  {
    id: 'bounds',
    label: 'Bounded type parameters',
    title: 'A bound tells the compiler what a type parameter can do',
    frames: [
      {
        note: 'Without a bound the compiler only knows T is an Object, so a generic max method cannot call compareTo. The method will not compile.',
        boxes: [b('a', '<T> T max(T a, T b)', ['T is just an Object'], 'warn'), b('b', 'a.compareTo(b)', ['compile error: no such method'], 'bad')],
        deps: [d('<T> T max(T a, T b)', 'a.compareTo(b)', 'tries', 'bad')],
      },
      {
        note: 'An upper bound, T extends Comparable<T>, promises that T has compareTo. The method compiles and works for Integer, String, LocalDate or any other Comparable. Several bounds are joined with &, for example T extends Number & Comparable<T>.',
        boxes: [b('a', '<T extends Comparable<T>> T max(T a, T b)', ['T can be compared with itself'], 'ok', 'bounded'), b('b', 'a.compareTo(b) > 0 ? a : b', ['compiles'], 'ok')],
        deps: [d('<T extends Comparable<T>> T max(T a, T b)', 'a.compareTo(b) > 0 ? a : b', 'allows', 'ok')],
      },
      {
        note: 'The standard library uses the more flexible form <T extends Comparable<? super T>>: a java.sql.Timestamp can be compared using its parent class Date\'s compareTo. It is the PECS rule applied to a type bound: Comparable consumes T, so it is "super".',
        boxes: [b('a', 'T extends Comparable<? super T>', ['also accepts subclasses of comparable parents'], 'ok', 'most general'), b('b', 'Collections.max(coll)', ['declared with this bound'], 'new')],
        deps: [d('Collections.max(coll)', 'T extends Comparable<? super T>', 'uses', 'ok')],
      },
      {
        note: 'Generic methods infer T from the arguments, so you rarely write it: max(3, 7) gives Integer, max("a", "b") gives String. The diamond new ArrayList<>() lets the compiler infer the type on the right side from the left.',
        boxes: [b('a', 'max(3, 7)', ['T inferred: Integer'], 'ok'), b('b', 'max("a", "b")', ['T inferred: String'], 'ok'), b('c', 'new ArrayList<>()', ['diamond: type inferred'], 'ok')],
        deps: [],
      },
    ],
  },
];
