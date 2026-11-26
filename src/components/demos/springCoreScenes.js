// Frame data for the Spring core walk-through, drawn by BoardStage (hand-placed cards and arrows).

import { BoardStage } from './BoardStage.jsx';

/* ---------- container startup ---------- */
const classesRegion = { x: 8, y: 8, w: 186, h: 284, title: 'Your classes' };
const ctxRegion = { x: 212, y: 8, w: 420, h: 284, title: 'ApplicationContext', tone: 'new' };
const repoClass = (o = {}) => ({ id: 'repoClass', x: 20, y: 52, w: 162, title: 'AccountRepository', lines: ['@Repository'], dashed: true, ...o });
const svcClass = (o = {}) => ({ id: 'svcClass', x: 20, y: 132, w: 162, title: 'TransferService', lines: ['@Service', 'needs AccountRepository'], dashed: true, ...o });
const repoBean = (o = {}) => ({ id: 'repoBean', x: 440, y: 52, w: 176, title: 'accountRepository', lines: ['one instance (singleton)'], tone: 'ok', ...o });
const svcBean = (o = {}) => ({ id: 'svcBean', x: 440, y: 150, w: 176, title: 'transferService', lines: ['new TransferService(repo)'], tone: 'ok', ...o });

const containerFrames = [
  {
    line: 'SpringApplication.run(BankApp.class)',
    regions: [classesRegion, ctxRegion],
    cards: [
      repoClass(),
      svcClass(),
      { id: 'defs', x: 228, y: 52, w: 186, title: 'Bean definitions', lines: ['AccountRepository: singleton', 'TransferService: singleton'], tone: 'new', badge: 'recipes' },
    ],
    arrows: [
      { from: 'repoClass', to: 'defs', label: 'scan', tone: 'new', ts: 'l', toff: -8 },
      { from: 'svcClass', to: 'defs', tone: 'new', fs: 'r', ts: 'l', toff: 10 },
    ],
    note: 'At startup the context scans your packages for stereotype annotations such as @Service and @Repository. For each class it records a bean definition: which class, which scope and what it needs. No object exists yet.',
  },
  {
    line: 'TransferService(AccountRepository accounts)',
    regions: [classesRegion, ctxRegion],
    cards: [
      repoClass(),
      svcClass(),
      { id: 'defs', x: 228, y: 52, w: 186, title: 'Bean definitions', lines: ['1. AccountRepository (needs nothing)', '2. TransferService (needs 1)'], tone: 'new', badge: 'order' },
    ],
    arrows: [
      { from: 'repoClass', to: 'defs', label: 'scan', tone: 'new', ts: 'l', toff: -8 },
      { from: 'svcClass', to: 'defs', tone: 'new', fs: 'r', ts: 'l', toff: 10 },
    ],
    note: 'The container works out the order. TransferService asks for an AccountRepository in its constructor, so the repository has to be created first.',
  },
  {
    line: 'new TransferService(accountRepository)',
    regions: [classesRegion, ctxRegion],
    cards: [
      repoClass({ dim: true }),
      svcClass({ dim: true }),
      { id: 'defs', x: 228, y: 52, w: 186, title: 'Bean definitions', lines: ['1. AccountRepository (needs nothing)', '2. TransferService (needs 1)'], tone: 'new', dim: true },
      repoBean(),
      svcBean(),
    ],
    arrows: [
      { from: 'defs', to: 'repoBean', label: '1. create', tone: 'ok', fs: 'r', ts: 'l', fo: -10 },
      { from: 'defs', to: 'svcBean', label: '2. create', tone: 'ok', fs: 'r', ts: 'l', fo: 12, ly: 30 },
      { from: 'repoBean', to: 'svcBean', label: 'injected', tone: 'new', fs: 'b', ts: 't', lx: 34 },
    ],
    note: 'Now the objects are made. The repository comes first. Then the container calls new TransferService(accountRepository) and passes in the existing repository. The service never creates its own collaborator: that is inversion of control.',
  },
  {
    line: '@Transactional public void transfer(...)',
    regions: [classesRegion, ctxRegion],
    cards: [
      repoClass({ dim: true }),
      svcClass({ dim: true }),
      { id: 'defs', x: 228, y: 52, w: 186, title: 'Bean definitions', lines: ['1. AccountRepository (needs nothing)', '2. TransferService (needs 1)'], tone: 'new', dim: true },
      repoBean(),
      svcBean({ lines: ['new TransferService(repo)', '@PostConstruct ran'], h: 62 }),
    ],
    wraps: [{ around: 'svcBean', label: 'proxy: adds transactions' }],
    arrows: [{ from: 'repoBean', to: 'wrap:svcBean', label: 'injected', tone: 'new', fs: 'b', ts: 't', fo: -62, toff: -62, lx: 34 }],
    note: 'Post-processors run on each bean. They call @PostConstruct. Because TransferService has @Transactional, the container also wraps it in a proxy that adds transaction handling around the real object.',
  },
  {
    line: 'PaymentController(TransferService transfers)',
    result: { text: 'callers get the proxy', tone: 'warn' },
    regions: [classesRegion, ctxRegion],
    cards: [
      repoClass({ dim: true }),
      svcClass({ dim: true }),
      repoBean(),
      svcBean({ lines: ['new TransferService(repo)', '@PostConstruct ran'], h: 62 }),
      { id: 'ctrl', x: 228, y: 232, w: 186, title: 'PaymentController', lines: ['needs TransferService'], tone: 'new' },
    ],
    wraps: [{ around: 'svcBean', label: 'proxy: adds transactions' }],
    arrows: [
      { from: 'repoBean', to: 'wrap:svcBean', label: 'injected', tone: 'new', fs: 'b', ts: 't', fo: -62, toff: -62, lx: 34 },
      { from: 'ctrl', to: 'wrap:svcBean', tone: 'warn', fs: 'r', ts: 'b' },
    ],
    note: 'The context is ready. When the controller asks for TransferService, it receives the proxy, the same one every other bean gets. Your code never wrote new for any of these objects.',
  },
];

/* ---------- scopes ---------- */
const container = { x: 360, y: 8, w: 272, h: 284, title: 'Container' };
const clientA = (o = {}) => ({ id: 'a', x: 20, y: 52, w: 160, title: 'Client A', lines: ['getBean(...)'], tone: 'new', ...o });
const clientB = (o = {}) => ({ id: 'b', x: 20, y: 192, w: 160, title: 'Client B', lines: ['getBean(...)'], tone: 'new', ...o });

const scopeFrames = [
  {
    line: '@Service class RateService   // singleton by default',
    regions: [container],
    cards: [clientA({ lines: ['getBean(RateService)'] }), clientB({ lines: ['getBean(RateService)'] }), { id: 's', x: 390, y: 118, w: 220, title: 'RateService @1a2b', lines: ['created once at startup'], tone: 'ok', badge: 'shared' }],
    arrows: [
      { from: 'a', to: 's', label: 'same object', fs: 'r', ts: 'l', toff: -8 },
      { from: 'b', to: 's', label: 'same object', fs: 'r', ts: 'l', toff: 8, ly: 30 },
    ],
    note: 'Singleton is the default: one instance per container. Both clients get the very same object, @1a2b. Every thread shares it, so it must hold no changing state, or be thread-safe.',
  },
  {
    line: '@Scope("prototype") class QuoteBuilder',
    regions: [container],
    cards: [
      clientA({ lines: ['getBean(QuoteBuilder)'] }),
      clientB({ lines: ['getBean(QuoteBuilder)'] }),
      { id: 'p1', x: 390, y: 52, w: 220, title: 'QuoteBuilder @3c4d', lines: ['made for client A'], tone: 'ok' },
      { id: 'p2', x: 390, y: 192, w: 220, title: 'QuoteBuilder @5e6f', lines: ['made for client B'], tone: 'ok' },
    ],
    arrows: [
      { from: 'a', to: 'p1', label: 'new object' },
      { from: 'b', to: 'p2', label: 'new object' },
    ],
    note: 'Prototype: a new instance every time the bean is asked for. It suits objects that hold state. The container creates it and injects its dependencies, but it does not call its destroy callbacks.',
  },
  {
    line: 'QuoteService(QuoteBuilder builder)   // injected once',
    result: { text: 'trap: one builder forever', tone: 'bad' },
    regions: [container],
    cards: [
      { id: 'svc', x: 20, y: 52, w: 200, title: 'QuoteService', lines: ['singleton', 'field: QuoteBuilder builder'], tone: 'bad', badge: 'trap' },
      { id: 'p1', x: 390, y: 60, w: 220, title: 'QuoteBuilder @3c4d', lines: ['call 1, call 2, call 3 ...'], tone: 'warn' },
      { id: 'svc2', x: 20, y: 186, w: 200, title: 'QuoteService', lines: ['ObjectProvider<QuoteBuilder>', 'builders.getObject()'], tone: 'ok', badge: 'fix' },
      { id: 'p2', x: 390, y: 170, w: 220, title: 'QuoteBuilder @5e6f', lines: ['call 1'], tone: 'ok', h: 40 },
      { id: 'p3', x: 390, y: 232, w: 220, title: 'QuoteBuilder @7a8b', lines: ['call 2'], tone: 'ok', h: 40 },
    ],
    arrows: [
      { from: 'svc', to: 'p1', label: 'same one every call', tone: 'bad' },
      { from: 'svc2', to: 'p2', label: 'call 1', fs: 'r', ts: 'l', fo: -8 },
      { from: 'svc2', to: 'p3', label: 'call 2', fs: 'r', ts: 'l', fo: 10, ly: 26 },
    ],
    note: 'The classic trap: a singleton that injects a prototype gets one prototype, made when the singleton was wired, and keeps it forever. The fix is to inject an ObjectProvider and call getObject() each time. Then every call gets a new builder.',
  },
  {
    line: '@RequestScope class RequestContext',
    regions: [container],
    cards: [
      clientA({ lines: ['HTTP request 1'] }),
      clientB({ lines: ['HTTP request 2'] }),
      { id: 'ctrl', x: 200, y: 112, w: 140, title: 'OrderController', lines: ['singleton', 'scoped proxy'], tone: 'ok', h: 58 },
      { id: 'r1', x: 390, y: 52, w: 220, title: 'RequestContext #1', lines: ['lives for request 1'], tone: 'ok' },
      { id: 'r2', x: 390, y: 192, w: 220, title: 'RequestContext #2', lines: ['lives for request 2'], tone: 'ok' },
    ],
    arrows: [
      { from: 'a', to: 'ctrl', fs: 'r', ts: 'l', toff: -10 },
      { from: 'b', to: 'ctrl', fs: 'r', ts: 'l', toff: 10 },
      { from: 'ctrl', to: 'r1', label: 'request 1', fs: 'r', ts: 'l', fo: -10 },
      { from: 'ctrl', to: 'r2', label: 'request 2', fs: 'r', ts: 'l', fo: 10, ly: 26 },
    ],
    note: 'Web scopes: request gives one bean per HTTP request, and session gives one per user session. A singleton holds a scoped proxy instead of the bean itself. On each call, the proxy finds the instance that belongs to the current request.',
  },
];

/* ---------- lifecycle ---------- */
const STEPS = ['constructor', 'inject', 'Aware', 'before init', '@PostConstruct', 'after init', 'in use', '@PreDestroy'];
const bean = (lines, o = {}) => ({ id: 'bean', x: 228, y: 74, w: 196, title: 'AccountService', lines, tone: 'new', ...o });

const lifecycleFrames = [
  {
    h: 310,
    line: 'new AccountService(repository)',
    cards: [bean(['constructor called', 'repository passed in'])],
    steps: { items: STEPS, at: 0 },
    note: 'Step 1: the container calls the constructor and passes in the constructor dependencies. With constructor injection the object can be used as soon as it exists.',
  },
  {
    h: 310,
    line: 'setNotifier(...)  ·  setBeanName("accountService")',
    cards: [
      bean(['constructor called', 'setters and fields set', 'Aware callbacks ran']),
      { id: 'ctx', x: 470, y: 88, w: 152, title: 'ApplicationContext', lines: ['injects'], tone: 'ok' },
    ],
    arrows: [{ from: 'ctx', to: 'bean', tone: 'ok', fs: 'l', ts: 'r' }],
    steps: { items: STEPS, at: 2 },
    note: 'Steps 2 and 3: setter and field injection happen now. Then come the Aware callbacks, such as BeanNameAware, if the bean implements them.',
  },
  {
    h: 310,
    line: '@PostConstruct void checkConfig()',
    cards: [
      bean(['constructor called', 'setters and fields set', 'Aware callbacks ran', '@PostConstruct ran'], { tone: 'ok' }),
      { id: 'pp', x: 20, y: 88, w: 170, title: 'BeanPostProcessor', lines: ['before init'], tone: 'warn' },
    ],
    arrows: [{ from: 'pp', to: 'bean', tone: 'warn', fs: 'r', ts: 'l' }],
    steps: { items: STEPS, at: 4 },
    note: 'Steps 4 and 5: the "before initialisation" post-processors run. Then the init callbacks run: @PostConstruct, afterPropertiesSet and any custom init method. This is the place to check configuration or warm up a cache.',
  },
  {
    h: 310,
    line: 'postProcessAfterInitialization(bean)',
    result: { text: 'the proxy is stored', tone: 'warn' },
    cards: [
      bean(['constructor called', 'setters and fields set', 'Aware callbacks ran', '@PostConstruct ran'], { tone: 'ok' }),
      { id: 'pp', x: 20, y: 88, w: 170, title: 'BeanPostProcessor', lines: ['after init: wrap it'], tone: 'warn' },
    ],
    wraps: [{ around: 'bean', label: 'proxy: @Transactional', pad: 9 }],
    arrows: [{ from: 'pp', to: 'wrap:bean', tone: 'warn', fs: 'r', ts: 'l' }],
    steps: { items: STEPS, at: 5 },
    note: 'Step 6: the "after initialisation" post-processors run last. This is where the bean is wrapped in an AOP proxy for @Transactional and similar annotations. The context stores the proxy, not the original object.',
  },
  {
    h: 310,
    line: 'context.close()  →  @PreDestroy void releasePool()',
    cards: [
      bean(['in use for the life of the app', '@PreDestroy ran on close()'], { tone: 'ok' }),
      { id: 'ctx', x: 470, y: 88, w: 152, title: 'ApplicationContext', lines: ['close()'], tone: 'warn' },
    ],
    wraps: [{ around: 'bean', label: 'proxy: @Transactional', pad: 9 }],
    arrows: [{ from: 'ctx', to: 'wrap:bean', tone: 'warn', fs: 'l', ts: 'r' }],
    steps: { items: STEPS, at: 7 },
    note: 'Steps 7 and 8: the bean serves requests for as long as the app runs. On shutdown the container calls @PreDestroy, DisposableBean.destroy and any destroy method on singletons, so you can close pools and flush data.',
  },
];

/* ---------- circular dependency ---------- */
const acc = (o = {}) => ({ id: 'acc', x: 40, y: 96, w: 210, title: 'AccountService', lines: ['constructor needs LedgerService'], tone: 'new', ...o });
const led = (o = {}) => ({ id: 'led', x: 390, y: 96, w: 210, title: 'LedgerService', lines: ['constructor needs AccountService'], tone: 'new', ...o });

const circularFrames = [
  {
    line: 'AccountService(LedgerService l)  ·  LedgerService(AccountService a)',
    cards: [acc(), led()],
    arrows: [
      { from: 'acc', to: 'led', label: 'needs', fs: 'r', ts: 'l', fo: -10, toff: -10, tone: 'new' },
      { from: 'led', to: 'acc', label: 'needs', fs: 'l', ts: 'r', fo: 10, toff: 10, tone: 'new', ly: 30 },
    ],
    note: 'AccountService needs LedgerService, and LedgerService needs AccountService. Both get their dependency through the constructor.',
  },
  {
    line: 'BeanCurrentlyInCreationException',
    result: { text: 'startup fails', tone: 'bad' },
    cards: [
      acc({ tone: 'bad', badge: 'in creation', lines: ['waiting for LedgerService'] }),
      led({ tone: 'bad', badge: 'in creation', lines: ['waiting for AccountService'] }),
      { id: 'ctx', x: 190, y: 216, w: 260, title: 'ApplicationContext', lines: ['cannot finish either bean'], tone: 'bad' },
    ],
    arrows: [
      { from: 'acc', to: 'led', label: 'needs', fs: 'r', ts: 'l', fo: -10, toff: -10, tone: 'bad' },
      { from: 'led', to: 'acc', label: 'needs', fs: 'l', ts: 'r', fo: 10, toff: 10, tone: 'bad', ly: 30 },
    ],
    note: 'To create AccountService, the container must first create LedgerService. But LedgerService needs AccountService, which is still being created. With constructor injection this cannot work, so startup fails. Spring Boot 2.6 and later forbids circular references by default.',
  },
  {
    line: 'AccountService(BalanceService b)  ·  LedgerService(BalanceService b)',
    result: { text: 'no cycle', tone: 'ok' },
    cards: [
      acc({ y: 56, tone: 'ok', lines: ['needs BalanceService'] }),
      led({ y: 56, tone: 'ok', lines: ['needs BalanceService'] }),
      { id: 'bal', x: 215, y: 196, w: 210, title: 'BalanceService', lines: ['the shared logic, moved out'], tone: 'new', badge: 'new bean' },
    ],
    arrows: [
      { from: 'acc', to: 'bal', label: 'needs', fs: 'b', ts: 'l' },
      { from: 'led', to: 'bal', label: 'needs', fs: 'b', ts: 'r' },
    ],
    note: 'The real fix is in the design. Move the logic both beans share into a third bean, or publish an event instead of calling back. Setter injection or @Lazy on one dependency also start the app, but they only hide the design problem.',
  },
];

export const SPRING_CORE_SCENES = [
  { id: 'container', label: 'Container startup', title: 'The container scans, creates, connects and hands out beans', stage: BoardStage, frames: containerFrames },
  { id: 'scopes', label: 'Bean scopes', title: 'Singleton gives everyone the same bean, prototype gives each caller a new one', stage: BoardStage, frames: scopeFrames },
  { id: 'lifecycle', label: 'Bean lifecycle', title: 'The steps a singleton bean goes through, from constructor to destruction', stage: BoardStage, frames: lifecycleFrames },
  { id: 'circular', label: 'Circular dependency', title: 'Two beans that need each other cannot both be built by constructors', stage: BoardStage, frames: circularFrames },
];
