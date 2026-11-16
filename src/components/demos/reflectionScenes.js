// Frame data for the "Reflection, annotations and dynamic proxies" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const REFLECTION_SCENES = [
  {
    id: 'class',
    label: 'Reflection',
    title: 'From a class name to a method call',
    frames: [
      {
        note: 'Reflection lets a program inspect and use types it did not know when it was compiled. Start from a name that arrives as a string, for example from a configuration file. Class.forName finds the class and loads it, and gives you its Class object.',
        boxes: [b('n', 'Class name', ['"com.bank.Account"'], 'none'), b('f', 'Class.forName', ['find, load, link'], 'new'), b('c', 'Class object', ['metadata of the type'], 'ok')],
        deps: [d('Class name', 'Class.forName', 'input', 'ok'), d('Class.forName', 'Class object', 'returns', 'ok')],
      },
      {
        note: 'The Class object describes the type: its fields, methods and constructors, plus modifiers, annotations, the superclass and the interfaces. getDeclaredFields, getDeclaredMethods and getDeclaredConstructors return what this class declares, private members included, and getAnnotations returns its annotations.',
        boxes: [b('c', 'Class object', ['Account'], 'ok'), b('f', 'Fields', ['balance, owner'], 'none'), b('m', 'Methods', ['deposit, close'], 'none'), b('k', 'Constructors', ['Account(String)'], 'none'), b('n', 'Annotations', ['@Entity, @Table'], 'none')],
        deps: [d('Class object', 'Fields', 'fields', 'ok'), d('Class object', 'Methods', 'methods', 'ok'), d('Class object', 'Constructors', 'constructors', 'ok'), d('Class object', 'Annotations', 'annotations', 'ok')],
      },
      {
        note: 'Use them. A Constructor creates an instance with newInstance, and a Method runs on an instance with invoke. This is how Spring creates beans and how Jackson calls setters: by looking them up at run time instead of calling them in source code.',
        boxes: [b('c', 'Class object', ['Account'], 'none'), b('k', 'Constructor', ['Account(String)'], 'new'), b('m', 'Method', ['deposit(long)'], 'new'), b('i', 'Account instance', ['created at run time'], 'ok')],
        deps: [d('Class object', 'Constructor', 'constructor', 'ok'), d('Class object', 'Method', 'method', 'ok'), d('Constructor', 'Account instance', 'newInstance', 'ok'), d('Method', 'Account instance', 'invoke', 'ok')],
      },
      {
        note: 'Private members need setAccessible(true). Since Java 9 the module system decides: if the package is not opened to your code, the JVM throws InaccessibleObjectException. This is why old libraries needed --add-opens on Java 17 and later.',
        boxes: [b('f', 'Field balance', ['private'], 'warn'), b('s', 'setAccessible', ['true'], 'new'), b('m', 'Module check', ['is the package open?'], 'warn'), b('e', 'Access denied', ['InaccessibleObject-', 'Exception'], 'bad')],
        deps: [d('Field balance', 'setAccessible', 'asks', 'ok'), d('setAccessible', 'Module check', 'checks', 'warn'), d('Module check', 'Access denied', 'if closed', 'bad')],
      },
    ],
  },
  {
    id: 'annotation',
    label: 'Annotations',
    title: 'An annotation is data; a framework gives it meaning',
    frames: [
      {
        note: 'An annotation such as @NotBlank does nothing by itself: it is metadata attached to code. Its retention says how long it lives. SOURCE annotations vanish after compiling, CLASS ones (the default) stay in the class file only, and RUNTIME ones can be read while the program runs.',
        boxes: [b('s', 'Source code', ['@NotBlank String owner'], 'new'), b('j', 'javac', ['keeps RUNTIME annotations'], 'none'), b('c', 'Class file', ['annotation stored'], 'ok')],
        deps: [d('Source code', 'javac', 'compile', 'ok'), d('javac', 'Class file', 'writes', 'ok')],
      },
      {
        note: 'When the class is loaded, its annotations are available through the Class object. A RUNTIME annotation is therefore readable by reflection, which is how every framework finds out what you meant.',
        boxes: [b('c', 'Class file', ['annotation stored'], 'none'), b('l', 'Class loader', ['loads the class'], 'none'), b('o', 'Class object', ['annotations readable'], 'ok')],
        deps: [d('Class file', 'Class loader', 'read', 'ok'), d('Class loader', 'Class object', 'defines', 'ok')],
      },
      {
        note: 'A validator is ordinary framework code. It takes the Class object, walks its fields with getDeclaredFields, and asks each field whether the annotation is present with isAnnotationPresent or getAnnotation.',
        boxes: [b('v', 'Validator', ['framework code'], 'new'), b('o', 'Class object', ['Account'], 'none'), b('f', 'Field owner', ['has @NotBlank'], 'warn')],
        deps: [d('Validator', 'Class object', 'fields', 'ok'), d('Validator', 'Field owner', 'isAnnotationPresent', 'ok')],
      },
      {
        note: 'The validator reads the field value (with setAccessible and Field.get), applies the rule the annotation stands for, and reports a violation. Change the rule and the annotation, not the call sites. Bean Validation, JPA, Jackson and Spring all work like this.',
        boxes: [b('v', 'Validator', ['applies the rule'], 'ok'), b('f', 'Field owner', ['value is blank'], 'bad'), b('x', 'Violation', ['owner must not be blank'], 'bad')],
        deps: [d('Validator', 'Field owner', 'reads value', 'ok'), d('Field owner', 'Violation', 'breaks the rule', 'bad')],
      },
    ],
  },
  {
    id: 'proxy',
    label: 'Dynamic proxy',
    title: 'A dynamic proxy intercepts every call',
    frames: [
      {
        note: 'Normally the caller uses the interface, and the real implementation does the work. There is no place to add logging, security or transactions without editing the implementation.',
        boxes: [b('c', 'Caller', ['uses the interface'], 'none'), b('i', 'AccountService', ['interface'], 'none'), b('t', 'AccountImpl', ['the real work'], 'ok')],
        deps: [d('Caller', 'AccountService', 'calls', 'ok'), d('AccountImpl', 'AccountService', 'implements', 'ok')],
      },
      {
        note: 'Proxy.newProxyInstance generates a class at run time that implements the interface. Every method of that class forwards to one InvocationHandler, a single method of your own, invoke(proxy, method, args).',
        boxes: [b('n', 'Proxy.newProxyInstance', ['interfaces + handler'], 'new'), b('p', 'Proxy object', ['generated, implements it'], 'ok'), b('h', 'InvocationHandler', ['your code'], 'warn')],
        deps: [d('Proxy.newProxyInstance', 'Proxy object', 'generates', 'ok'), d('Proxy object', 'InvocationHandler', 'forwards every call', 'warn')],
      },
      {
        note: 'The caller holds the proxy and does not notice. A call goes to the handler, which can do something before, call the real object with method.invoke, and do something after: log, time it, check permissions, open a transaction.',
        boxes: [b('c', 'Caller', ['uses the proxy'], 'none'), b('p', 'Proxy object', ['same interface'], 'ok'), b('h', 'InvocationHandler', ['log, check, time'], 'warn'), b('t', 'AccountImpl', ['target'], 'ok')],
        deps: [d('Caller', 'Proxy object', 'calls', 'ok'), d('Proxy object', 'InvocationHandler', 'invoke', 'warn'), d('InvocationHandler', 'AccountImpl', 'method.invoke', 'ok')],
      },
      {
        note: 'A JDK proxy needs an interface. For a class with none, CGLIB or ByteBuddy generates a subclass that overrides the methods and calls an interceptor. That is why a final class or a final method cannot be proxied. Spring Boot uses this by default.',
        boxes: [b('c', 'Caller', ['uses the class'], 'none'), b('s', 'CGLIB subclass', ['extends the class'], 'new'), b('m', 'MethodInterceptor', ['your code'], 'warn'), b('t', 'AccountImpl', ['class, no interface'], 'ok')],
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
        note: 'At start-up Spring scans the class path, reads each class with reflection and looks for annotations such as @Service and @Component. For each match it records a BeanDefinition: a recipe saying which class to create and how.',
        boxes: [b('s', 'Classpath scan', ['finds @Service classes'], 'new'), b('c', 'Class object', ['reads annotations'], 'none'), b('d', 'BeanDefinition', ['recipe for a bean'], 'ok')],
        deps: [d('Classpath scan', 'Class object', 'loads', 'ok'), d('Class object', 'BeanDefinition', 'registers', 'ok')],
      },
      {
        note: 'To build the bean Spring picks a constructor, resolves each parameter from the container and calls it by reflection. Fields and setters marked @Autowired or @Value are filled in the same way.',
        boxes: [b('d', 'BeanDefinition', ['recipe'], 'none'), b('k', 'Constructor', ['newInstance with parameters'], 'new'), b('r', 'Raw bean', ['fields injected'], 'ok')],
        deps: [d('BeanDefinition', 'Constructor', 'chooses', 'ok'), d('Constructor', 'Raw bean', 'creates', 'ok')],
      },
      {
        note: 'After initialisation, each BeanPostProcessor may replace the bean. One sees @Transactional on a method of the raw bean and returns a proxy that wraps it. From now on the container holds the proxy under the bean name.',
        boxes: [b('r', 'Raw bean', ['has @Transactional'], 'none'), b('p', 'BeanPostProcessor', ['sees the annotation'], 'new'), b('x', 'Proxy bean', ['wraps the raw bean'], 'ok')],
        deps: [d('Raw bean', 'BeanPostProcessor', 'passes through', 'ok'), d('BeanPostProcessor', 'Proxy bean', 'returns', 'ok')],
      },
      {
        note: 'A call from another bean reaches the proxy, which begins the transaction, delegates to the raw bean and commits. But when the raw bean calls this.other() on itself, the call skips the proxy, so the annotation is ignored. This is the self-invocation trap.',
        boxes: [b('c', 'Caller bean', ['injected the proxy'], 'none'), b('x', 'Proxy bean', ['begin, commit'], 'ok'), b('r', 'Raw bean', ['the real code'], 'ok'), b('t', 'this.other()', ['no proxy, no transaction'], 'bad')],
        deps: [d('Caller bean', 'Proxy bean', 'call', 'ok'), d('Proxy bean', 'Raw bean', 'delegates', 'ok'), d('Raw bean', 'this.other()', 'self-call', 'bad')],
      },
    ],
  },
];
