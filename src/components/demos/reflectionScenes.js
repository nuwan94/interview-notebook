// Frame data for the "Reflection, annotations and dynamic proxies" walk-through.
// 'class' and 'annotation' show data (ChipColumnsStage): the Class object and its members, and which
// annotations survive each stage. 'proxy' and 'spring' are calls between objects, so they stay box-and-arrow
// graphs (GraphStage). box.tone: ok | bad | warn | new | none.

import { ChipColumnsStage } from './ChipColumnsStage.jsx';

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });
const c = (id, text, sub, tone, group) => ({ id, text, sub, tone, group });

// the three annotations followed by the 'annotation' scene, one per retention policy
const kept = (col, gone) => [
  c(`${col}o`, '@Override', gone.includes('o') ? 'gone' : 'SOURCE', gone.includes('o') ? 'off' : 'warn'),
  c(`${col}a`, '@Audit', gone.includes('a') ? 'gone' : 'CLASS (default)', gone.includes('a') ? 'off' : 'new'),
  c(`${col}n`, '@NotBlank', 'RUNTIME', 'ok'),
];

export const REFLECTION_SCENES = [
  {
    id: 'class',
    label: 'Reflection',
    title: 'From a class name to a method call',
    stage: ChipColumnsStage,
    frames: [
      {
        line: 'Class<?> type = Class.forName("com.bank.Account");',
        result: { text: 'a Class object', tone: 'ok' },
        columns: [
          { id: 'name', title: 'A name, as text', items: [c('n', '"com.bank.Account"', 'from a config file', 'new')] },
          { id: 'forName', title: 'Class.forName', flex: 0.9, items: [c('f', 'find and load', 'then run static blocks', 'none')] },
          { id: 'cls', title: 'Class object', flex: 0.9, items: [c('k', 'Account.class', 'one per class loader', 'ok')] },
        ],
        links: [{ from: 'n', to: 'f' }, { from: 'f', to: 'k' }],
        note: 'Reflection lets a program inspect and use a class that it did not know when it was compiled. Here the class name arrives as text, for example from a configuration file. Class.forName finds and loads the class, and returns its Class object.',
      },
      {
        line: 'type.getDeclaredFields()   type.getDeclaredMethods()   ...',
        result: { text: 'private members included', tone: 'ok' },
        columns: [
          { id: 'cls', title: 'Class object', flex: 0.8, items: [c('k', 'Account.class', null, 'ok')] },
          {
            id: 'parts',
            title: 'What it describes',
            flex: 1.3,
            groups: { fld: 'Fields', mth: 'Methods', ctor: 'Constructors', ann: 'Annotations' },
            items: [
              c('f1', 'private long balance', null, 'none', 'fld'), c('f2', 'String owner', null, 'none', 'fld'),
              c('m1', 'deposit(long)', null, 'none', 'mth'), c('m2', 'close()', null, 'none', 'mth'),
              c('c1', 'Account(String)', null, 'none', 'ctor'),
              c('a1', '@Entity  @Table', null, 'none', 'ann'),
            ],
          },
        ],
        links: [{ from: 'k', to: 'fld' }, { from: 'k', to: 'mth' }, { from: 'k', to: 'ctor' }, { from: 'k', to: 'ann' }],
        note: 'The Class object describes the type: its fields, methods, constructors and annotations, and also its modifiers, superclass and interfaces. getDeclaredFields, getDeclaredMethods and getDeclaredConstructors return what this class declares, private members included.',
      },
      {
        line: 'Object acc = ctor.newInstance("ACC-1001");  deposit.invoke(acc, 500L);',
        result: { text: 'created and called by reflection', tone: 'ok' },
        columns: [
          {
            id: 'parts',
            title: 'Members found',
            groups: { ctor: 'Constructor', mth: 'Method' },
            items: [c('c1', 'Account(String)', null, 'new', 'ctor'), c('m1', 'deposit(long)', null, 'new', 'mth')],
          },
          {
            id: 'heap',
            title: 'Heap: the Account object',
            flex: 1.2,
            items: [c('o1', 'new Account("ACC-1001")', 'made by newInstance', 'ok'), c('o2', 'balance = 500', 'after deposit.invoke(acc, 500)', 'ok')],
          },
        ],
        links: [{ from: 'ctor', to: 'o1', label: 'new' }, { from: 'mth', to: 'o2', label: 'invoke' }],
        note: 'Now use the members. A Constructor creates an object with newInstance, and a Method runs on an object with invoke. Spring creates beans and Jackson calls setters this way: they look the members up while the program runs instead of calling them in source code.',
      },
      {
        line: 'balance.setAccessible(true);',
        result: { text: 'depends on the module system', tone: 'warn' },
        columns: [
          { id: 'fld', title: 'Private field', flex: 0.9, items: [c('f', 'balance', 'private long', 'warn')] },
          { id: 'sa', title: 'setAccessible(true)', items: [c('s', 'skip access check', 'for this one Field', 'new')] },
          {
            id: 'mod',
            title: 'Module check',
            flex: 1.2,
            groups: { open: 'package is open', closed: 'package is closed' },
            items: [c('ok', 'works', 'your code, class path', 'ok', 'open'), c('no', 'InaccessibleObjectException', 'JDK internals, Java 17+', 'bad', 'closed')],
          },
        ],
        links: [{ from: 'f', to: 's' }, { from: 's', to: 'ok' }, { from: 's', to: 'no', tone: 'bad' }],
        note: 'Private members need setAccessible(true). Since Java 9 the module system also decides. If the package is not opened to your code, the JVM throws InaccessibleObjectException. That is why old libraries needed --add-opens on Java 17 and later.',
      },
    ],
  },
  {
    id: 'annotation',
    label: 'Annotations',
    title: 'An annotation is data; a framework gives it meaning',
    stage: ChipColumnsStage,
    frames: [
      {
        line: '@Retention(RetentionPolicy.RUNTIME)',
        result: { text: 'only RUNTIME annotations reach reflection', tone: 'ok' },
        columns: [
          { id: 'src', title: 'Source (.java)', items: kept('s', []) },
          { id: 'cls', title: 'Class file (.class)', items: kept('c', ['o']) },
          { id: 'run', title: 'Loaded, at run time', items: kept('r', ['o', 'a']) },
        ],
        links: [{ from: 'sa', to: 'ca' }, { from: 'sn', to: 'cn' }, { from: 'cn', to: 'rn' }],
        note: 'An annotation does nothing by itself: it is data attached to code. Its retention says how long it is kept. A SOURCE annotation is gone after compiling. A CLASS annotation, the default, stays in the class file but is not loaded. Only a RUNTIME annotation can be read while the program runs.',
      },
      {
        line: 'for (Field f : request.getClass().getDeclaredFields())',
        result: { text: 'the validator walks the fields', tone: 'new' },
        columns: [
          { id: 'val', title: 'Validator', flex: 0.8, items: [c('v', 'validate(request)', 'ordinary framework code', 'new')] },
          {
            id: 'cls',
            title: 'Class object: TransferRequest',
            flex: 1.3,
            groups: { flds: 'getDeclaredFields()' },
            items: [c('f1', 'fromAccount', '@NotBlank', 'none', 'flds'), c('f2', 'toAccount', '@NotBlank', 'none', 'flds'), c('f3', 'cents', 'no annotation', 'none', 'flds')],
          },
        ],
        links: [{ from: 'v', to: 'flds' }],
        note: 'A validator is ordinary framework code. It takes the Class object of the request and walks its fields with getDeclaredFields.',
      },
      {
        line: 'NotBlank rule = f.getAnnotation(NotBlank.class);  Object value = f.get(request);',
        result: { text: 'fromAccount is blank', tone: 'bad' },
        columns: [
          { id: 'flds', title: 'Field', items: [c('f1', 'fromAccount', null, 'none'), c('f2', 'toAccount', null, 'none'), c('f3', 'cents', null, 'none')] },
          { id: 'ann', title: 'getAnnotation', items: [c('a1', '@NotBlank', null, 'new'), c('a2', '@NotBlank', null, 'new'), c('a3', 'null: skip', null, 'off')] },
          { id: 'val', title: 'Field.get', items: [c('v1', '"" (blank)', null, 'bad'), c('v2', '"ACC-2"', null, 'ok'), c('v3', 'not read', null, 'off')] },
        ],
        links: [{ from: 'f1', to: 'a1' }, { from: 'f2', to: 'a2' }, { from: 'f3', to: 'a3', tone: 'off' }, { from: 'a1', to: 'v1', tone: 'bad' }, { from: 'a2', to: 'v2' }],
        note: 'For each field the validator asks getAnnotation(NotBlank.class). If the annotation is there, it calls setAccessible and Field.get to read the value. Here fromAccount holds an empty string.',
      },
      {
        line: 'result.add(new Violation(f.getName(), rule.message()));',
        result: { text: '1 violation', tone: 'bad' },
        columns: [
          { id: 'val', title: 'Value', flex: 0.8, items: [c('v1', '"" (blank)', 'fromAccount', 'bad'), c('v2', '"ACC-2"', 'toAccount', 'ok')] },
          { id: 'out', title: 'Result', flex: 1.3, items: [c('x1', 'fromAccount must not be blank', 'a Violation', 'bad'), c('x2', 'passes', 'no violation', 'ok')] },
        ],
        links: [{ from: 'v1', to: 'x1', tone: 'bad' }, { from: 'v2', to: 'x2' }],
        note: 'The validator applies the rule that the annotation stands for and reports a violation. To change a rule, you change the annotation, not every caller. Bean Validation, JPA, Jackson and Spring all work like this.',
      },
    ],
  },
  {
    id: 'proxy',
    label: 'Dynamic proxy',
    title: 'A dynamic proxy intercepts every call',
    frames: [
      {
        note: 'Normally the caller uses the interface, and the real class does the work. There is no place to add logging, security or transactions without changing that class.',
        boxes: [b('c', 'Caller', ['uses the interface'], 'none'), b('i', 'AccountService', ['interface'], 'none'), b('t', 'AccountImpl', ['does the real work'], 'ok')],
        deps: [d('Caller', 'AccountService', 'calls', 'ok'), d('AccountImpl', 'AccountService', 'implements', 'ok')],
      },
      {
        note: 'Proxy.newProxyInstance generates a class while the program runs. The class implements the interface, and every method of it calls one InvocationHandler: a single method of your own, invoke(proxy, method, args).',
        boxes: [b('n', 'Proxy.newProxyInstance', ['interfaces + handler'], 'new'), b('p', 'Proxy object', ['generated class', 'implements the interface'], 'ok'), b('h', 'InvocationHandler', ['your code'], 'warn')],
        deps: [d('Proxy.newProxyInstance', 'Proxy object', 'generates', 'ok'), d('Proxy object', 'InvocationHandler', 'every call', 'warn')],
      },
      {
        note: 'The caller holds the proxy and does not notice the difference. A call goes to the handler. The handler can do something first, call the real object with method.invoke, and do something after: log, time the call, check permissions or run a transaction.',
        boxes: [b('c', 'Caller', ['holds the proxy'], 'none'), b('p', 'Proxy object', ['same interface'], 'ok'), b('h', 'InvocationHandler', ['log, check, time'], 'warn'), b('t', 'AccountImpl', ['the target'], 'ok')],
        deps: [d('Caller', 'Proxy object', 'calls', 'ok'), d('Proxy object', 'InvocationHandler', 'invoke', 'warn'), d('InvocationHandler', 'AccountImpl', 'method.invoke', 'ok')],
      },
      {
        note: 'A JDK proxy needs an interface. For a class without one, CGLIB or ByteBuddy generates a subclass that overrides the methods and calls an interceptor. So a final class or a final method cannot be proxied. Spring Boot uses this kind of proxy by default.',
        boxes: [b('c', 'Caller', ['uses the class'], 'none'), b('s', 'CGLIB subclass', ['extends the class'], 'new'), b('m', 'MethodInterceptor', ['your code'], 'warn'), b('t', 'AccountImpl', ['a class, no interface'], 'ok')],
        deps: [d('Caller', 'CGLIB subclass', 'calls', 'ok'), d('CGLIB subclass', 'MethodInterceptor', 'intercept', 'warn'), d('MethodInterceptor', 'AccountImpl', 'proceed', 'ok')],
      },
    ],
  },
  {
    id: 'spring',
    label: 'In Spring',
    title: 'Where Spring uses all three',
    frames: [
      {
        note: 'At start-up, Spring scans the class path. It reads each class with reflection and looks for annotations such as @Service and @Component. For each match it stores a BeanDefinition: a recipe that says which class to create and how.',
        boxes: [b('s', 'Classpath scan', ['finds @Service classes'], 'new'), b('c', 'Class object', ['annotations read'], 'none'), b('d', 'BeanDefinition', ['a recipe for a bean'], 'ok')],
        deps: [d('Classpath scan', 'Class object', 'loads', 'ok'), d('Class object', 'BeanDefinition', 'registers', 'ok')],
      },
      {
        note: 'To build the bean, Spring picks a constructor, finds each parameter in the container and calls the constructor by reflection. Fields and setters marked @Autowired or @Value are filled in the same way.',
        boxes: [b('d', 'BeanDefinition', ['the recipe'], 'none'), b('k', 'Constructor', ['newInstance with parameters'], 'new'), b('r', 'Raw bean', ['dependencies filled in'], 'ok')],
        deps: [d('BeanDefinition', 'Constructor', 'chooses', 'ok'), d('Constructor', 'Raw bean', 'creates', 'ok')],
      },
      {
        note: 'After the bean is set up, each BeanPostProcessor may replace it. One of them sees @Transactional on a method and returns a proxy that wraps the raw bean. From now on, the container hands out the proxy under the bean name.',
        boxes: [b('r', 'Raw bean', ['has @Transactional'], 'none'), b('p', 'BeanPostProcessor', ['sees the annotation'], 'new'), b('x', 'Proxy bean', ['wraps the raw bean'], 'ok')],
        deps: [d('Raw bean', 'BeanPostProcessor', 'passes through', 'ok'), d('BeanPostProcessor', 'Proxy bean', 'returns', 'ok')],
      },
      {
        note: 'A call from another bean reaches the proxy. The proxy starts the transaction, calls the raw bean and commits. But when the raw bean calls this.other() on itself, the call skips the proxy, so the annotation is ignored. This is the self-invocation trap.',
        boxes: [b('c', 'Caller bean', ['was given the proxy'], 'none'), b('x', 'Proxy bean', ['begin, commit'], 'ok'), b('r', 'Raw bean', ['the real code'], 'ok'), b('t', 'this.other()', ['no proxy, no transaction'], 'bad')],
        deps: [d('Caller bean', 'Proxy bean', 'call', 'ok'), d('Proxy bean', 'Raw bean', 'delegates', 'ok'), d('Raw bean', 'this.other()', 'self-call', 'bad')],
      },
    ],
  },
];
