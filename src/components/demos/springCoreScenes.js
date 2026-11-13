// Frame data for the Spring core walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_CORE_SCENES = [
  {
    id: 'container',
    label: 'Container startup',
    title: 'The container scans, creates, wires and hands out beans',
    frames: [
      {
        note: 'On startup the application context scans the packages for stereotype annotations (@Component, @Service, @Repository) and @Configuration classes. For each one it records a bean definition: what class, what scope, what it depends on. Nothing is created yet.',
        boxes: [b('c', 'Application context', ['component scan', 'reads annotations and @Bean methods'], 'new'), b('r', 'Repository bean', ['definition: AccountRepository', 'scope: singleton'], 'none', 'defined'), b('s', 'Service bean', ['definition: TransferService', 'needs AccountRepository'], 'none', 'defined')],
        deps: [d('Application context', 'Repository bean', 'register definition', 'ok'), d('Application context', 'Service bean', 'register definition', 'ok')],
      },
      {
        note: 'The container works out the dependency graph. TransferService needs AccountRepository, so the repository must be created first. Constructor arguments are the dependencies the container has to supply.',
        boxes: [b('c', 'Application context', ['resolve dependency order'], 'new'), b('r', 'Repository bean', ['create first: no dependencies'], 'ok', 'step 1'), b('s', 'Service bean', ['create second: needs the repository'], 'warn', 'step 2')],
        deps: [d('Service bean', 'Repository bean', 'depends on', 'warn')],
      },
      {
        note: 'Dependency injection: the container calls new TransferService(accountRepository), passing the existing singleton. The class never creates or looks up its collaborator, which is Inversion of Control: the framework controls object creation and wiring.',
        boxes: [b('r', 'Repository bean', ['instance #1 (singleton)'], 'ok'), b('s', 'Service bean', ['new TransferService(repository)', 'dependency injected'], 'ok', 'wired')],
        deps: [d('Application context', 'Service bean', 'inject repository', 'ok')],
      },
      {
        note: 'Bean post-processors then run on each bean: @PostConstruct callbacks, and for beans with @Transactional, @Async or @Cacheable the container replaces the bean with a proxy that adds that behaviour around the real object.',
        boxes: [b('s', 'Service bean', ['@PostConstruct runs'], 'ok'), b('p', 'Service proxy', ['wraps the real bean', 'adds transaction handling'], 'new', 'what callers get')],
        deps: [d('Application context', 'Service proxy', 'post-process', 'ok')],
      },
      {
        note: 'The context is ready and all singletons live in it. When another bean asks for TransferService, it receives the proxy. The application code never wrote new for any of these objects.',
        boxes: [b('c', 'Client', ['controller needs TransferService'], 'new'), b('p', 'Service proxy', ['same instance for everyone'], 'ok'), b('r', 'Repository bean', ['same instance for everyone'], 'ok')],
        deps: [d('Client', 'Service proxy', 'uses', 'ok'), d('Service proxy', 'Repository bean', 'delegates', 'ok')],
      },
    ],
  },
  {
    id: 'scopes',
    label: 'Bean scopes',
    title: 'Singleton gives everyone the same bean, prototype gives each request a new one',
    frames: [
      {
        note: 'Singleton (the default): one instance per container. Two clients asking for the bean get the very same object. It must be stateless or thread-safe because every thread shares it.',
        boxes: [b('a', 'Client A', ['getBean(RateService)'], 'new'), b('b', 'Client B', ['getBean(RateService)'], 'new'), b('s', 'Singleton bean', ['RateService @1a2b', 'created once at startup'], 'ok', 'shared')],
        deps: [d('Client A', 'Singleton bean', 'same instance', 'ok'), d('Client B', 'Singleton bean', 'same instance', 'ok')],
      },
      {
        note: 'Prototype: a new instance every time the bean is requested. Useful for stateful objects. The container creates it and injects dependencies but does not manage its destruction.',
        boxes: [b('a', 'Client A', ['getBean(QuoteBuilder)'], 'new'), b('b', 'Client B', ['getBean(QuoteBuilder)'], 'new'), b('p1', 'Prototype bean 1', ['QuoteBuilder @3c4d'], 'ok'), b('p2', 'Prototype bean 2', ['QuoteBuilder @5e6f'], 'ok')],
        deps: [d('Client A', 'Prototype bean 1', 'new instance', 'ok'), d('Client B', 'Prototype bean 2', 'new instance', 'ok')],
      },
      {
        note: 'The classic trap: a singleton that injects a prototype gets only one prototype, created at wiring time, and keeps it forever. To get a fresh one on each call, inject an ObjectProvider or a scoped proxy and ask it each time.',
        boxes: [b('s', 'Singleton bean', ['holds one QuoteBuilder forever'], 'bad', 'trap'), b('p1', 'Prototype bean 1', ['injected once at startup'], 'warn'), b('o', 'Provider bean', ['ObjectProvider.getObject()', 'returns a new one per call'], 'ok', 'fix')],
        deps: [d('Singleton bean', 'Prototype bean 1', 'same one every call', 'bad'), d('Provider bean', 'Prototype bean 1', 'fresh per call', 'ok')],
      },
      {
        note: 'Web scopes: request (one bean per HTTP request) and session (one per user session). They are injected into singletons through a scoped proxy, which looks up the right instance for the current request each time.',
        boxes: [b('a', 'Client A', ['request 1'], 'new'), b('b', 'Client B', ['request 2'], 'new'), b('r1', 'Request bean 1', ['RequestContext for A'], 'ok'), b('r2', 'Request bean 2', ['RequestContext for B'], 'ok')],
        deps: [d('Client A', 'Request bean 1', 'own bean', 'ok'), d('Client B', 'Request bean 2', 'own bean', 'ok')],
      },
    ],
  },
  {
    id: 'lifecycle',
    label: 'Bean lifecycle',
    title: 'The steps a singleton bean goes through from definition to destruction',
    frames: [
      {
        note: 'Instantiate: the container calls the constructor (with constructor-injected dependencies). With constructor injection the object is fully usable as soon as it exists.',
        boxes: [b('b', 'Account bean', ['1. constructor called'], 'new', 'instantiate')],
        deps: [],
      },
      {
        note: 'Populate: setter and field injection happen now, then the Aware callbacks (BeanNameAware, ApplicationContextAware) if the bean implements them.',
        boxes: [b('b', 'Account bean', ['2. setters and @Autowired fields set', '3. Aware callbacks'], 'new', 'populate')],
        deps: [d('Application context', 'Account bean', 'inject', 'ok')],
      },
      {
        note: 'Before-initialisation post-processors run, then @PostConstruct, InitializingBean.afterPropertiesSet and the custom init-method. This is where you validate configuration or warm caches.',
        boxes: [b('pp', 'Bean post-processor', ['postProcessBeforeInitialization'], 'warn'), b('b', 'Account bean', ['4. @PostConstruct', '5. afterPropertiesSet'], 'ok', 'initialise')],
        deps: [d('Bean post-processor', 'Account bean', 'before init', 'warn')],
      },
      {
        note: 'After-initialisation post-processors run last. This is the step that wraps the bean in an AOP proxy for @Transactional and friends. The proxy, not the original, is what is stored in the context.',
        boxes: [b('pp', 'Bean post-processor', ['postProcessAfterInitialization'], 'warn'), b('p', 'Account proxy', ['6. wraps the bean'], 'new', 'proxy created')],
        deps: [d('Bean post-processor', 'Account proxy', 'wrap', 'ok')],
      },
      {
        note: 'The bean is ready and serves requests for the life of the application. On shutdown the container calls @PreDestroy, DisposableBean.destroy and the destroy-method on singletons, so you can release pools and flush state.',
        boxes: [b('b', 'Account bean', ['7. in use', '8. @PreDestroy on shutdown'], 'ok', 'destroy'), b('c', 'Application context', ['close()'], 'warn')],
        deps: [d('Application context', 'Account bean', 'destroy callbacks', 'warn')],
      },
    ],
  },
  {
    id: 'circular',
    label: 'Circular dependency',
    title: 'Two beans that need each other cannot both be built by constructors',
    frames: [
      {
        note: 'AccountService needs LedgerService and LedgerService needs AccountService. Each is created through its constructor.',
        boxes: [b('a', 'Account service bean', ['constructor needs LedgerService'], 'new'), b('l', 'Ledger service bean', ['constructor needs AccountService'], 'new')],
        deps: [d('Account service bean', 'Ledger service bean', 'needs', 'ok'), d('Ledger service bean', 'Account service bean', 'needs', 'ok')],
      },
      {
        note: 'To create AccountService the container must first create LedgerService, which needs AccountService, which is still being created. With constructor injection this is impossible and startup fails with a BeanCurrentlyInCreationException. Spring Boot 2.6 and later forbids circular references by default.',
        boxes: [b('a', 'Account service bean', ['waiting for Ledger'], 'bad', 'in creation'), b('l', 'Ledger service bean', ['waiting for Account'], 'bad', 'in creation'), b('c', 'Application context', ['BeanCurrentlyInCreationException'], 'bad', 'startup fails')],
        deps: [],
      },
      {
        note: 'The real fix is design: extract the shared logic into a third bean both depend on, or publish an event instead of calling back. Workarounds exist (setter injection, @Lazy on one dependency) but they hide a design problem.',
        boxes: [b('a', 'Account service bean', ['depends on Balance bean'], 'ok'), b('l', 'Ledger service bean', ['depends on Balance bean'], 'ok'), b('x', 'Balance bean', ['shared logic extracted'], 'new', 'no cycle')],
        deps: [d('Account service bean', 'Balance bean', 'uses', 'ok'), d('Ledger service bean', 'Balance bean', 'uses', 'ok')],
      },
    ],
  },
];
