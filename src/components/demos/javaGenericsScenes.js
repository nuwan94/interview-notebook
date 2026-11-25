// Frame data for the Java Generics walk-through.
// 'why' and 'erasure' show code before and after (CodePanelStage); 'wildcards' and 'bounds' show the type
// hierarchy and what the compiler allows (TypeTreeStage).

import { CodePanelStage } from './CodePanelStage.jsx';
import { TypeTreeStage } from './TypeTreeStage.jsx';

// the number types used by the wildcard frames: Object above Number, Integer and Double below it
const numbers = (tones = {}, tags = {}, dim = []) => [
  { id: 'object', text: 'Object', col: 1, row: 0, tone: tones.object, tag: tags.object, dim: dim.includes('object') },
  { id: 'number', text: 'Number', col: 1, row: 1, tone: tones.number, tag: tags.number, dim: dim.includes('number') },
  { id: 'integer', text: 'Integer', col: 0, row: 2, tone: tones.integer, tag: tags.integer, dim: dim.includes('integer') },
  { id: 'double', text: 'Double', col: 2, row: 2, tone: tones.double, tag: tags.double, dim: dim.includes('double') },
];
const numberEdges = [
  { from: 'number', to: 'object' },
  { from: 'integer', to: 'number' },
  { from: 'double', to: 'number' },
];

export const JAVA_GENERICS_SCENES = [
  {
    id: 'why',
    label: 'Why generics',
    title: 'Generics move type errors from run time to compile time and remove casts',
    stage: CodePanelStage,
    frames: [
      {
        line: 'List accounts = new ArrayList();',
        result: { text: 'fails late, at run time', tone: 'bad' },
        panels: [
          {
            title: 'Before generics: a raw List holds any Object',
            lines: [
              { t: 'List accounts = new ArrayList();', mark: 'warn', tag: 'raw type: the compiler does not know the element type' },
              { t: 'accounts.add("oops");', mark: 'warn', tag: 'compiles: a String gets into a list of accounts' },
              { t: 'Account a = (Account) accounts.get(0);', mark: 'bad', tag: 'ClassCastException while the program runs' },
            ],
          },
        ],
        note: 'Before Java 5, a List held plain Objects. You could add anything to it, and every read needed a cast. A wrong cast compiled fine and failed later with a ClassCastException, sometimes far from the real mistake.',
      },
      {
        line: 'List<Account> accounts = new ArrayList<>();',
        result: { text: 'caught early, at compile time', tone: 'ok' },
        arrow: 'add <T>',
        panels: [
          {
            title: 'Raw List',
            lines: [
              { t: 'List accounts = ...;', mark: 'warn' },
              { t: 'accounts.add("oops");', mark: 'warn', tag: 'compiles' },
              { t: '(Account) accounts.get(0)', mark: 'bad', tag: 'fails at run time' },
            ],
          },
          {
            title: 'List<Account>',
            lines: [
              { t: 'List<Account> accounts = ...;', mark: 'new' },
              { t: 'accounts.add("oops");', mark: 'ok', tag: 'compile error: caught at once' },
              { t: 'Account a = accounts.get(0);', mark: 'ok', tag: 'no cast needed' },
            ],
          },
        ],
        note: 'With List<Account>, the compiler knows the element type. Adding a String is now a compile error, so you see the mistake in the editor. And get returns an Account, so you need no cast.',
      },
      {
        line: 'class Result<T> { T value; }',
        result: { text: 'one class, any type', tone: 'ok' },
        panels: [
          {
            title: 'Your own generic class: T is a placeholder',
            lines: [
              { t: 'class Result<T> {', mark: 'new', tag: 'T is filled in by the code that uses the class' },
              { t: '    private final T value;' },
              { t: '    public T get() { return value; }' },
              { t: '}' },
              { t: 'Result<Account> r1 = Result.ok(account);', mark: 'ok', tag: 'here T = Account, so r1.get() returns an Account' },
              { t: 'Result<BigDecimal> r2 = Result.ok(fee);', mark: 'ok', tag: 'here T = BigDecimal' },
            ],
          },
        ],
        note: 'You can write your own generic classes too. The type parameter T is a placeholder. The code that uses the class fills it in, so one Result<T> class works for accounts, amounts or anything else, and is still type-checked.',
      },
    ],
  },
  {
    id: 'erasure',
    label: 'Type erasure',
    title: 'The compiler checks the types and then erases them: at run time List<String> is just List',
    stage: CodePanelStage,
    frames: [
      {
        line: 'javac Names.java',
        result: { text: 'types checked, then erased', tone: 'ok' },
        arrow: 'javac',
        panels: [
          {
            title: 'Your source code',
            lines: [
              { t: 'List<String> names = load();', mark: 'new', tag: 'the compiler checks every use' },
              { t: 'String n = names.get(0);' },
            ],
          },
          {
            title: 'The bytecode the JVM runs',
            lines: [
              { t: 'List names = load();', mark: 'warn', tag: '<String> is erased' },
              { t: 'String n = (String) names.get(0);', mark: 'new', tag: 'the compiler added this cast' },
            ],
          },
        ],
        note: 'Generics exist only in the source code and the compiler. The compiler checks the types, then erases them: T becomes its bound, or Object, and casts are added where needed. Old code without generics keeps working with the same classes.',
      },
      {
        line: 'new T()',
        result: { text: 'compile errors', tone: 'bad' },
        panels: [
          {
            title: 'Not allowed, because the type is gone at run time',
            lines: [
              { t: 'list instanceof List<String>', mark: 'bad', tag: 'the JVM only sees List: use List<?>' },
              { t: 'new T()   or   new T[10]', mark: 'bad', tag: 'the JVM does not know which class T is' },
              { t: 'void f(List<String> a)', mark: 'bad' },
              { t: 'void f(List<Integer> b)', mark: 'bad', tag: 'both become f(List): the names clash' },
              { t: 'catch (MyException<T> e)', mark: 'bad', tag: 'exception types must be known at run time' },
            ],
          },
        ],
        note: 'So at run time a List<String> and a List<Integer> are the same class. That is why these lines do not compile. Each one would need the type argument at run time, and it is no longer there.',
      },
      {
        line: '<T> T create(Class<T> type)',
        result: { text: 'a real Class object at run time', tone: 'ok' },
        panels: [
          {
            title: 'Workaround: pass the type in as a value',
            lines: [
              { t: '<T> T create(Class<T> type) throws Exception {', mark: 'new', tag: 'a type token: a real Class object' },
              { t: '    return type.getDeclaredConstructor().newInstance();' },
              { t: '}' },
              { t: 'Account a = create(Account.class);', mark: 'ok' },
              { t: 'Account b = type.cast(obj);', mark: 'ok', tag: 'a checked cast at run time' },
              { t: 'new TypeReference<List<Account>>() {}', mark: 'ok', tag: 'Jackson keeps the full generic type this way' },
            ],
          },
        ],
        note: 'The usual workaround is a type token. You pass a Class<T>, so the code has a real type at run time. Jackson uses a TypeReference for the same reason: it keeps the full type List<Account>, which a Class object cannot hold.',
      },
      {
        line: 'Object[] o = new String[1];',
        result: { text: 'arrays fail late, generics fail early', tone: 'warn' },
        panels: [
          {
            title: 'Arrays: covariant',
            lines: [
              { t: 'Object[] o = new String[1];', mark: 'warn', tag: 'allowed: a String[] is an Object[]' },
              { t: 'o[0] = 42;', mark: 'bad', tag: 'ArrayStoreException at run time' },
            ],
          },
          {
            title: 'Generics: invariant',
            lines: [
              { t: 'List<Object> l = new ArrayList<String>();', mark: 'ok', tag: 'compile error: the mistake is stopped here' },
            ],
          },
        ],
        note: 'Arrays and generics behave differently. An array remembers its element type at run time, and a String[] can be used as an Object[], so a wrong store fails while the program runs. Generic types are checked by the compiler instead, which is safer.',
      },
    ],
  },
  {
    id: 'wildcards',
    label: 'Wildcards and PECS',
    title: 'Producer extends, consumer super: choose the wildcard by whether you read or write',
    stage: TypeTreeStage,
    frames: [
      {
        line: 'List<Number> nums = ints;',
        result: { text: 'compile error: not a subtype', tone: 'bad' },
        treeTitle: 'Element types',
        caption: 'ints holds Integers only',
        nodes: numbers({ integer: 'new', double: 'bad' }, { integer: 'ints', double: 'danger' }, ['object']),
        edges: numberEdges,
        ops: [
          { code: 'List<Integer> ints = new ArrayList<>();', verdict: 'fine', tone: 'ok' },
          { code: 'List<Number> nums = ints;', verdict: 'compile error', tone: 'bad' },
          { code: 'nums.add(3.14);', verdict: 'if it were allowed: a Double in ints', tone: 'bad' },
        ],
        note: 'Integer is a Number, but List<Integer> is not a List<Number>. If it were, you could add a Double through nums, and the list of Integers would hold a Double. So generic types are invariant. Wildcards give you flexibility in a safe way.',
      },
      {
        line: 'double sum(List<? extends Number> src)',
        result: { text: 'producer: read only', tone: 'ok' },
        treeTitle: 'Element types',
        caption: '? extends Number accepts lists of the green types',
        nodes: numbers({ number: 'ok', integer: 'ok', double: 'ok' }, {}, ['object']),
        edges: numberEdges,
        ops: [
          { code: 'sum(listOfIntegers)\nsum(listOfDoubles)', verdict: 'both allowed', tone: 'ok' },
          { code: 'Number n = src.get(0);', verdict: 'allowed: every element is a Number', tone: 'ok' },
          { code: 'src.add(1);', verdict: 'compile error: src may be a List<Double>', tone: 'bad' },
        ],
        note: '? extends Number means "a list of some subtype of Number". It accepts a List<Integer> or a List<Double>. Every element is a Number, so reading is safe. But you cannot add, because the list might really be a List<Double>. Use it for a producer: a list that gives you values.',
      },
      {
        line: 'void fill(List<? super Integer> dst)',
        result: { text: 'consumer: write only', tone: 'ok' },
        treeTitle: 'Element types',
        caption: '? super Integer accepts lists of the green types',
        nodes: numbers({ object: 'ok', number: 'ok', integer: 'ok' }, {}, ['double']),
        edges: numberEdges,
        ops: [
          { code: 'fill(listOfIntegers)\nfill(listOfNumbers)\nfill(listOfObjects)', verdict: 'all allowed', tone: 'ok' },
          { code: 'dst.add(1);', verdict: 'allowed: every such list takes an Integer', tone: 'ok' },
          { code: 'Integer x = dst.get(0);', verdict: 'compile error: you only get an Object', tone: 'bad' },
        ],
        note: '? super Integer means "a list of Integer or of a supertype of Integer". Each of those lists can take an Integer, so adding is safe. But an element you read could be any Object. Use it for a consumer: a list that receives your values.',
      },
      {
        line: 'copy(List<? super T> dst, List<? extends T> src)',
        result: { text: 'PECS: Producer Extends, Consumer Super', tone: 'ok' },
        treeTitle: 'Element types, with T = Integer',
        caption: 'src may hold T or below; dst may hold T or above',
        nodes: numbers({ object: 'new', number: 'new', integer: 'ok' }, { object: 'dst', number: 'dst', integer: 'T' }, ['double']),
        edges: numberEdges,
        ops: [
          { code: 'static <T> void copy(\n  List<? super T> dst,\n  List<? extends T> src)', verdict: 'reads from src, writes to dst', tone: 'new' },
          { code: 'copy(numbers, integers);', verdict: 'allowed: Integers into a List<Number>', tone: 'ok' },
          { code: 'Collections.copy\nComparator<? super T>', verdict: 'the library uses the same rule', tone: 'ok' },
        ],
        note: 'PECS means Producer Extends, Consumer Super. A copy method reads from a source, the producer, and writes to a destination, the consumer. With this signature you can copy a List<Integer> into a List<Number> or a List<Object>.',
      },
    ],
  },
  {
    id: 'bounds',
    label: 'Bounded type parameters',
    title: 'A bound tells the compiler what a type parameter can do',
    stage: TypeTreeStage,
    frames: [
      {
        line: '<T> T max(T a, T b)',
        result: { text: 'compile error', tone: 'bad' },
        treeTitle: 'What the compiler knows about T',
        caption: 'No bound: T is only an Object',
        nodes: [{ id: 'object', text: 'Object', sub: 'equals, hashCode', col: 1, row: 0, tone: 'warn', tag: 'T' }],
        edges: [],
        ops: [
          { code: 'a.equals(b)', verdict: 'allowed: every Object has it', tone: 'ok' },
          { code: 'a.compareTo(b)', verdict: 'compile error: Object has no compareTo', tone: 'bad' },
        ],
        note: 'Without a bound, the compiler only knows that T is an Object. Object has no compareTo method, so a generic max method cannot compare a and b, and it does not compile.',
      },
      {
        line: '<T extends Comparable<T>> T max(T a, T b)',
        result: { text: 'compiles', tone: 'ok' },
        treeTitle: 'Types that fit T extends Comparable<T>',
        caption: 'The bound promises a compareTo method',
        nodes: [
          { id: 'cmp', text: 'Comparable<T>', sub: 'interface: compareTo', col: 1, row: 0, iface: true, tone: 'new' },
          { id: 'integer', text: 'Integer', col: 0, row: 1, tone: 'ok' },
          { id: 'string', text: 'String', col: 1, row: 1, tone: 'ok' },
          { id: 'date', text: 'LocalDate', col: 2, row: 1, tone: 'ok' },
        ],
        edges: [
          { from: 'integer', to: 'cmp', iface: true },
          { from: 'string', to: 'cmp', iface: true },
          { from: 'date', to: 'cmp', iface: true },
        ],
        ops: [
          { code: 'return a.compareTo(b) >= 0 ? a : b;', verdict: 'allowed: T has compareTo', tone: 'ok' },
          { code: 'max(3, 7)\nmax("a", "b")', verdict: 'both work', tone: 'ok' },
          { code: '<T extends Number & Comparable<T>>', verdict: 'several bounds: join them with &', tone: 'new' },
        ],
        note: 'An upper bound, T extends Comparable<T>, promises that T has compareTo. Now the method compiles, and it works for Integer, String, LocalDate or any other Comparable type. You can join several bounds with &. Only the first one may be a class.',
      },
      {
        line: '<T extends Comparable<? super T>> T max(...)',
        result: { text: 'Timestamp is accepted', tone: 'ok' },
        treeTitle: 'A subclass that inherits compareTo',
        caption: 'Timestamp is Comparable<Date>, not Comparable<Timestamp>',
        nodes: [
          { id: 'cmp', text: 'Comparable<Date>', sub: 'interface', col: 1, row: 0, iface: true, tone: 'new' },
          { id: 'date', text: 'Date', sub: 'has compareTo(Date)', col: 1, row: 1 },
          { id: 'ts', text: 'Timestamp', sub: 'extends Date', col: 1, row: 2, tone: 'ok', tag: 'T' },
        ],
        edges: [
          { from: 'date', to: 'cmp', iface: true },
          { from: 'ts', to: 'date' },
        ],
        ops: [
          { code: 'T extends Comparable<T>', verdict: 'rejects Timestamp', tone: 'bad' },
          { code: 'T extends Comparable<? super T>', verdict: 'accepts Timestamp: Date is a supertype', tone: 'ok' },
          { code: 'Collections.max(coll)', verdict: 'is declared with this bound', tone: 'new' },
        ],
        note: 'The library uses the more flexible form, Comparable<? super T>. A Timestamp is compared with the compareTo it inherits from Date. This is the PECS rule on a bound: the Comparable consumes T values, so it uses super.',
      },
      {
        line: 'max(3, 7)',
        result: { text: 'T inferred: Integer', tone: 'ok' },
        treeTitle: 'The compiler picks T from the arguments',
        caption: 'You rarely write T yourself',
        nodes: [
          { id: 'cmp', text: 'Comparable<T>', sub: 'interface', col: 1, row: 0, iface: true, dim: true },
          { id: 'integer', text: 'Integer', col: 0, row: 1, tone: 'ok', tag: 'T' },
          { id: 'string', text: 'String', col: 2, row: 1, tone: 'new', tag: 'T' },
        ],
        edges: [
          { from: 'integer', to: 'cmp', iface: true },
          { from: 'string', to: 'cmp', iface: true },
        ],
        ops: [
          { code: 'max(3, 7)', verdict: 'T = Integer', tone: 'ok' },
          { code: 'max("a", "b")', verdict: 'T = String', tone: 'new' },
          { code: 'List<Account> l = new ArrayList<>();', verdict: 'the diamond: the type comes from the left', tone: 'ok' },
        ],
        note: 'A generic method works out T from its arguments. This is called type inference. So max(3, 7) gives an Integer and max("a", "b") gives a String. The diamond, new ArrayList<>(), takes its type from the variable on the left.',
      },
    ],
  },
];
