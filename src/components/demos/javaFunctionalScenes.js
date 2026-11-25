// Frame data for the lambdas, functional interfaces and Optional walk-through.
// 'lambda' shows the code shrinking (CodePanelStage). The other scenes show values moving between steps
// (ChipColumnsStage): what goes in and out of each interface, an Optional through a map chain, and a lambda
// object holding a copy of a local variable.

import { CodePanelStage } from './CodePanelStage.jsx';
import { ChipColumnsStage } from './ChipColumnsStage.jsx';

const row = (id, text, sub, tone) => ({ id, text, sub, tone });

export const JAVA_FUNCTIONAL_SCENES = [
  {
    id: 'lambda',
    label: 'From class to lambda',
    title: 'A lambda is a short way to write an object that implements one method',
    stage: CodePanelStage,
    frames: [
      {
        line: 'accounts.sort(new Comparator<Account>() { ... });',
        result: { text: 'six lines for one comparison', tone: 'warn' },
        panels: [
          {
            title: 'Before Java 8: an anonymous class',
            lines: [
              { t: 'accounts.sort(new Comparator<Account>() {' },
              { t: '    @Override' },
              { t: '    public int compare(Account a, Account b) {' },
              { t: '        return a.balance().compareTo(b.balance());', mark: 'ok', tag: 'the only line that says what you want' },
              { t: '    }' },
              { t: '});' },
            ],
          },
        ],
        note: 'Before Java 8, you passed behaviour by writing an anonymous class. To sort accounts by balance, you wrote a whole Comparator class body, with the method signature, just to say "compare the balances".',
      },
      {
        line: 'accounts.sort((a, b) -> a.balance().compareTo(b.balance()));',
        result: { text: 'same meaning, one line', tone: 'ok' },
        arrow: 'lambda',
        panels: [
          {
            title: 'Anonymous class',
            lines: [
              { t: 'new Comparator<Account>() {', mark: 'gone' },
              { t: '  public int compare(', mark: 'gone' },
              { t: '      Account a, Account b) {', mark: 'gone' },
              { t: '    return a.balance()', mark: 'ok' },
              { t: '        .compareTo(b.balance());', mark: 'ok' },
              { t: '  }', mark: 'gone' },
              { t: '}', mark: 'gone' },
            ],
          },
          {
            title: 'Lambda',
            lines: [
              { t: '(a, b) ->', mark: 'new', tag: 'only the parameter names are left' },
              { t: '    a.balance()', mark: 'ok' },
              { t: '        .compareTo(b.balance())', mark: 'ok' },
            ],
          },
        ],
        note: 'Comparator has exactly one abstract method, so it is a functional interface. The compiler already knows the method name and the parameter types from the target type, Comparator<Account>. So the lambda only needs the parameter names and the body.',
      },
      {
        line: 'accounts.sort(comparing(Account::balance));',
        result: { text: 'shortest: a method reference', tone: 'ok' },
        arrow: 'shorter',
        panels: [
          {
            title: 'Lambda',
            lines: [
              { t: '(a, b) ->', mark: 'gone' },
              { t: '    a.balance()', mark: 'gone' },
              { t: '        .compareTo(b.balance())', mark: 'gone' },
            ],
          },
          {
            title: 'Method reference',
            lines: [
              { t: 'comparing(Account::balance)', mark: 'ok', tag: 'compare by this key' },
              { t: 'Integer::parseInt   // static', mark: 'new' },
              { t: 'logger::info        // one object', mark: 'new' },
              { t: 'String::length      // any String', mark: 'new' },
              { t: 'ArrayList::new      // constructor', mark: 'new' },
            ],
          },
        ],
        note: 'When a lambda only calls an existing method, a method reference is shorter still. Comparator.comparing takes a key, so the whole sort becomes one readable line. The right panel shows the four kinds of method reference.',
      },
      {
        line: 'this inside a lambda',
        result: { text: 'not just a shorter anonymous class', tone: 'new' },
        panels: [
          {
            title: 'Anonymous class',
            lines: [
              { t: '// its own class file: Main$1.class', mark: 'warn' },
              { t: '// this = the anonymous object', mark: 'warn' },
              { t: '// can have fields (state)', mark: 'warn' },
              { t: '// can reuse a local variable name', mark: 'warn' },
            ],
          },
          {
            title: 'Lambda',
            lines: [
              { t: '// invokedynamic: no extra class file', mark: 'ok' },
              { t: '// this = the enclosing object', mark: 'ok' },
              { t: '// no fields of its own', mark: 'ok' },
              { t: '// locals it uses: effectively final', mark: 'ok' },
            ],
          },
        ],
        note: 'A lambda is not simply an anonymous class. It compiles to an invokedynamic call with no separate class file, and "this" inside it means the enclosing object. It can use local variables of the method around it only if they are effectively final.',
      },
    ],
  },
  {
    id: 'interfaces',
    label: 'Core functional interfaces',
    title: 'Four shapes cover most of what you will write: take, return, both, or neither',
    stage: ChipColumnsStage,
    frames: [
      {
        line: 'java.util.function',
        columns: [
          { id: 'in', title: 'Takes', items: [row('i1', 'Account', 'one value'), row('i2', 'Account', 'one value'), row('i3', 'Account', 'one value'), row('i4', 'nothing', '()')] },
          {
            id: 'fi',
            title: 'Interface and method',
            flex: 1.4,
            items: [
              row('p', 'Predicate<T>', 'test: a -> a.balance() > 0', 'new'),
              row('f', 'Function<T,R>', 'apply: Account::owner', 'new'),
              row('c', 'Consumer<T>', 'accept: System.out::println', 'new'),
              row('s', 'Supplier<T>', 'get: ArrayList::new', 'new'),
            ],
          },
          { id: 'out', title: 'Returns', items: [row('o1', 'boolean', 'true or false', 'ok'), row('o2', 'Customer', 'another value', 'ok'), row('o3', 'nothing', 'void', 'ok'), row('o4', 'ArrayList', 'a new value', 'ok')] },
        ],
        links: [
          { from: 'i1', to: 'p' }, { from: 'i2', to: 'f' }, { from: 'i3', to: 'c' }, { from: 'i4', to: 's' },
          { from: 'p', to: 'o1' }, { from: 'f', to: 'o2' }, { from: 'c', to: 'o3' }, { from: 's', to: 'o4' },
        ],
        note: 'Four interfaces cover most cases. A Predicate takes a value and returns a boolean. A Function takes a value and returns another value. A Consumer takes a value and returns nothing. A Supplier takes nothing and returns a value.',
      },
      {
        line: 'BiFunction, UnaryOperator, BinaryOperator, IntPredicate',
        columns: [
          { id: 'in', title: 'Takes', items: [row('i1', 'A and B', 'two values'), row('i2', 'T', 'one value'), row('i3', 'T and T', 'two of one type'), row('i4', 'int', 'a primitive')] },
          {
            id: 'fi',
            title: 'Variant',
            flex: 1.4,
            items: [
              row('bf', 'BiFunction<A,B,R>', '(a, b) -> a.add(b)', 'new'),
              row('uo', 'UnaryOperator<T>', 'String::trim', 'new'),
              row('bo', 'BinaryOperator<T>', 'BigDecimal::add', 'new'),
              row('ip', 'IntPredicate', 'n -> n > 0', 'new'),
            ],
          },
          { id: 'out', title: 'Returns', items: [row('o1', 'R', 'a result', 'ok'), row('o2', 'T', 'the same type', 'ok'), row('o3', 'T', 'the same type', 'ok'), row('o4', 'boolean', 'no boxing of int', 'ok')] },
        ],
        links: [
          { from: 'i1', to: 'bf' }, { from: 'i2', to: 'uo' }, { from: 'i3', to: 'bo' }, { from: 'i4', to: 'ip' },
          { from: 'bf', to: 'o1' }, { from: 'uo', to: 'o2' }, { from: 'bo', to: 'o3' }, { from: 'ip', to: 'o4' },
        ],
        note: 'There are variants. BiFunction and BiPredicate take two arguments. UnaryOperator and BinaryOperator return the same type they take. IntPredicate, IntFunction and ToIntFunction work with primitives, so no int is wrapped in an Integer object.',
      },
      {
        line: 'Predicate<Account> usable = isActive.and(hasFunds);',
        result: { text: 'one combined Predicate', tone: 'ok' },
        columns: [
          { id: 'small', title: 'Small pieces', items: [row('a', 'isActive', 'Predicate<Account>', 'ok'), row('h', 'hasFunds', 'Predicate<Account>', 'ok')] },
          { id: 'op', title: 'Combine', items: [row('and', 'and', 'both must be true', 'new')] },
          { id: 'res', title: 'Result', flex: 1.2, items: [row('u', 'usable', 'isActive.and(hasFunds)', 'ok')] },
        ],
        links: [{ from: 'a', to: 'and' }, { from: 'h', to: 'and' }, { from: 'and', to: 'u' }],
        note: 'Many of these interfaces can be combined. Predicate has and, or and negate. Function has andThen and compose. You build bigger behaviour from small named pieces, instead of writing one long lambda.',
      },
      {
        line: 'FeeRule flat = t -> TEN;',
        result: { text: 'a lambda is a FeeRule', tone: 'ok' },
        columns: [
          { id: 'lam', title: 'A lambda', items: [row('l', 't -> TEN', 'FeeRule flat', 'new')] },
          {
            id: 'fi',
            title: 'Your interface',
            flex: 1.5,
            groups: { fee: '@FunctionalInterface FeeRule' },
            items: [
              { id: 'm', text: 'BigDecimal fee(Txn t);', sub: 'the one abstract method', tone: 'ok', group: 'fee' },
              { id: 'd', text: 'default cappedAt(max)', sub: 'default: does not count', group: 'fee' },
            ],
          },
        ],
        links: [{ from: 'l', to: 'm', label: 'fills' }],
        note: 'Your own interface is a functional interface when it has exactly one abstract method. Add @FunctionalInterface so the compiler checks it. Default and static methods do not count, so the lambda fills in fee.',
      },
    ],
  },
  {
    id: 'optional',
    label: 'Optional',
    title: 'Optional makes "might be absent" part of the method signature',
    stage: ChipColumnsStage,
    frames: [
      {
        line: 'Optional<Account> find(String id)',
        result: { text: 'the type says: handle "not found"', tone: 'ok' },
        columns: [
          {
            id: 'ret',
            title: 'find(id) returns',
            groups: { old: 'Account find(id)', opt: 'Optional<Account> find(id)' },
            items: [
              { id: 'a1', text: 'ACC-1', sub: 'found', tone: 'ok', group: 'old' },
              { id: 'n1', text: 'null', sub: 'not found', tone: 'bad', group: 'old' },
              { id: 'a2', text: 'Optional[ACC-1]', sub: 'found', tone: 'ok', group: 'opt' },
              { id: 'e2', text: 'Optional.empty', sub: 'not found', tone: 'warn', group: 'opt' },
            ],
          },
          {
            id: 'use',
            title: 'The caller',
            groups: { oc: 'a.owner()', pc: 'find(id).map(Account::owner)' },
            items: [
              { id: 'u1', text: 'works', sub: 'returns the owner', tone: 'ok', group: 'oc' },
              { id: 'u2', text: 'NullPointerException', sub: 'the check was forgotten', tone: 'bad', group: 'oc' },
              { id: 'u3', text: 'works', sub: 'Optional[owner]', tone: 'ok', group: 'pc' },
              { id: 'u4', text: 'skipped safely', sub: 'still Optional.empty', tone: 'ok', group: 'pc' },
            ],
          },
        ],
        links: [{ from: 'a1', to: 'u1' }, { from: 'n1', to: 'u2', tone: 'bad' }, { from: 'a2', to: 'u3' }, { from: 'e2', to: 'u4' }],
        note: 'A method that finds nothing used to return null. If the caller forgets the check once, it gets a NullPointerException far away. Optional<T> is a box that holds a value or is empty, and the return type tells the caller to handle both cases.',
      },
      {
        line: 'find(id).map(Account::owner).map(Customer::email).orElse("none")',
        result: { text: 'a String, never null', tone: 'ok' },
        columns: [
          { id: 'f', title: 'find(id)', sub: 'Optional<Account>', items: [row('f1', 'ACC-1', 'present', 'ok'), row('f2', 'empty', 'nothing found', 'warn')] },
          { id: 'm1', title: 'map(owner)', sub: 'Account::owner', items: [row('m1', 'Ana', 'present', 'ok'), row('m2', 'empty', 'map skipped', 'off')] },
          { id: 'm2', title: 'map(email)', sub: 'Customer::email', items: [row('e1', 'ana@bank.lk', 'present', 'ok'), row('e2', 'empty', 'map skipped', 'off')] },
          { id: 'o', title: 'orElse', sub: '"none"', items: [row('r1', 'ana@bank.lk', 'the value', 'ok'), row('r2', 'none', 'the default', 'warn')] },
        ],
        links: [
          { from: 'f1', to: 'm1' }, { from: 'm1', to: 'e1' }, { from: 'e1', to: 'r1' },
          { from: 'f2', to: 'm2', tone: 'off' }, { from: 'm2', to: 'e2', tone: 'off' }, { from: 'e2', to: 'r2', tone: 'warn' },
        ],
        note: 'You work with the value through map, filter and flatMap. Each step runs only when there is a value. The top row finds an account and gets its owner and email. In the bottom row nothing was found, so both map steps are skipped and orElse gives the default.',
      },
      {
        line: 'orElse(createDefault())  vs  orElseGet(this::createDefault)',
        result: { text: 'orElse always builds the default', tone: 'warn' },
        columns: [
          { id: 'opt', title: 'The Optional', flex: 0.75, items: [row('p', 'ACC-1', 'present', 'ok'), row('e', 'empty', 'nothing', 'warn')] },
          { id: 'oe', title: 'orElse(x)', sub: 'x always runs', items: [row('oe1', 'ACC-1', 'default wasted', 'warn'), row('oe2', 'new default', 'built now', 'ok')] },
          { id: 'og', title: 'orElseGet(s)', sub: 's runs if empty', items: [row('og1', 'ACC-1', 'supplier skipped', 'ok'), row('og2', 'new default', 'supplier runs', 'ok')] },
          { id: 'ot', title: 'orElseThrow()', sub: 'empty = error', items: [row('ot1', 'ACC-1', 'returns it', 'ok'), row('ot2', 'exception', 'nothing to return', 'bad')] },
        ],
        note: 'Unwrap on purpose. orElse(x) always evaluates x, even when there is a value. orElseGet runs its supplier only when the Optional is empty. orElseThrow throws when it is empty. Avoid get() without a check: it throws NoSuchElementException and brings the null problem back.',
      },
      {
        line: 'Optional<Account> find(String id)',
        result: { text: 'use it for return values only', tone: 'new' },
        columns: [
          { id: 'good', title: 'Good use', items: [row('g1', 'Optional<Account> find(id)', 'a return type', 'ok')] },
          {
            id: 'bad',
            title: 'Bad use',
            items: [
              row('b1', 'private Optional<X> x;', 'a field', 'bad'),
              row('b2', 'void pay(Optional<X> x)', 'a parameter', 'bad'),
              row('b3', 'Optional<List<X>>', 'return an empty list instead', 'bad'),
              row('b4', 'return null;', 'in a method that returns Optional', 'bad'),
            ],
          },
        ],
        note: 'Use Optional for return values. Do not use it for fields, method parameters or collection elements, and never return a null Optional. For "no results", return an empty collection, not an Optional<List>.',
      },
    ],
  },
  {
    id: 'capture',
    label: 'Captured variables',
    title: 'A lambda can read local variables, but only if they never change',
    stage: ChipColumnsStage,
    frames: [
      {
        line: 'BigDecimal limit = new BigDecimal("1000");  list.removeIf(t -> t.amount().compareTo(limit) > 0);',
        result: { text: 'the lambda keeps a copy', tone: 'ok' },
        columns: [
          { id: 'stack', title: 'Stack: the method', items: [row('v', 'limit = 1000', 'local variable', 'new')] },
          { id: 'heap', title: 'Heap: the lambda object', flex: 1.3, items: [row('l', 'copy: limit = 1000', 't -> t.amount() > limit', 'ok')] },
        ],
        links: [{ from: 'v', to: 'l', label: 'copy' }],
        note: 'A lambda can use the local variables of the method around it. When the lambda is created, it gets a copy of each value it uses. Here the lambda object holds its own copy of limit.',
      },
      {
        line: 'return byLimit;   // the method ends, the lambda lives on',
        result: { text: 'the copy is still there', tone: 'ok' },
        columns: [
          { id: 'stack', title: 'Stack: the method', empty: '(gone: the method returned)', items: [] },
          { id: 'heap', title: 'Heap: the lambda object', flex: 1.3, items: [row('l', 'copy: limit = 1000', 'can still run later', 'ok')] },
        ],
        note: 'The lambda may run later, maybe on another thread, after the method has returned and its local variables are gone. That is why it needs its own copy of the value.',
      },
      {
        line: 'int count = 0;  list.forEach(t -> count++);',
        result: { text: 'compile error', tone: 'bad' },
        columns: [
          { id: 'stack', title: 'Stack: the method', items: [row('c', 'count = 0', 'local variable', 'new')] },
          { id: 'heap', title: 'Heap: the lambda object', flex: 1.3, items: [row('l2', 'count++', 'would change only a copy', 'bad')] },
        ],
        links: [{ from: 'c', to: 'l2', label: 'copy', tone: 'bad' }],
        note: 'Because the lambda has a copy, the original must never change, or the two would disagree. So Java requires the variable to be final or effectively final, which means assigned only once. A counter that you increment inside the lambda does not compile.',
      },
      {
        line: 'long n = list.stream().filter(p).count();',
        result: { text: 'produce a result, do not change state', tone: 'ok' },
        columns: [
          {
            id: 'do',
            title: 'Do this instead',
            items: [row('a', 'stream().filter(p).count()', 'no shared state: best', 'ok'), row('b', 'AtomicInteger counter', 'safe when many threads count', 'ok')],
          },
          { id: 'avoid', title: 'Avoid', items: [row('h', 'int[] holder = {0};', 'a trick that hides a data race', 'bad')] },
        ],
        note: 'Do not work around the rule with a one-element array or another holder object. In parallel code it hides a data race. Let the stream produce the result, with count() or a reduction, or use an AtomicInteger when threads must share a counter.',
      },
    ],
  },
];
