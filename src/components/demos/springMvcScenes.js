// Frame data for the Spring MVC and REST walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- request flow ---------- */
const FLOW = ['filters', 'dispatch', 'find method', 'read body', 'controller', 'response'];
const client = (lines = ['POST /api/transfers', 'JSON body'], o = {}) => ({ id: 'client', x: 14, y: 100, w: 134, title: 'Client', lines, tone: 'new', ...o });
const filter = (lines = ['security, CORS'], o = {}) => ({ id: 'filter', x: 176, y: 100, w: 128, title: 'Filters', lines, tone: 'none', ...o });
const ds = (lines = ['front controller'], o = {}) => ({ id: 'ds', x: 332, y: 100, w: 148, title: 'DispatcherServlet', lines, tone: 'none', ...o });
const hm = (o = {}) => ({ id: 'hm', x: 506, y: 14, w: 120, title: 'HandlerMapping', lines: ['finds create()'], tone: 'ok', ...o });
const conv = (lines, o = {}) => ({ id: 'conv', x: 506, y: 100, w: 120, title: 'Converter', lines, tone: 'ok', ...o });
const ctrl = (lines, o = {}) => ({ id: 'ctrl', x: 506, y: 186, w: 120, title: 'Controller', lines, tone: 'ok', ...o });

const flowFrames = [
  {
    h: 320,
    line: 'POST /api/transfers   {"amount": 250, ...}',
    cards: [client(), filter(undefined, { tone: 'warn', badge: 'first' })],
    arrows: [{ from: 'client', to: 'filter', tone: 'new' }],
    steps: { items: FLOW, at: 0 },
    note: 'The client sends POST /api/transfers with a JSON body. The embedded Tomcat server receives it. Servlet filters run first, before any Spring MVC code. They handle security, CORS, logging and encoding.',
  },
  {
    h: 320,
    line: 'chain.doFilter(request, response)',
    cards: [client(), filter(['passed']), ds(['front controller', 'every request'], { tone: 'new', badge: 'one servlet' })],
    arrows: [{ from: 'filter', to: 'ds', tone: 'new' }],
    steps: { items: FLOW, at: 1 },
    note: 'After the filters, the request reaches the DispatcherServlet. It is the front controller: one servlet that receives every request and coordinates the rest of the work.',
  },
  {
    h: 320,
    line: '@PostMapping  →  TransferController.create()',
    cards: [client(), filter(['passed']), ds(['which method?'], { tone: 'new' }), hm({ badge: 'found' })],
    arrows: [{ from: 'ds', to: 'hm', fs: 'r', ts: 'l' }],
    steps: { items: FLOW, at: 2 },
    note: 'The DispatcherServlet asks the handler mappings which method handles POST /api/transfers. They read the @PostMapping annotations and return the matching method, plus any interceptors. An interceptor\'s preHandle can stop the request here.',
  },
  {
    h: 320,
    line: '@Valid @RequestBody TransferRequest request',
    cards: [client(), filter(['passed']), ds(['builds arguments'], { tone: 'new' }), hm({ dim: true }), conv(['JSON → object', '@Valid check'], { badge: 'read' })],
    arrows: [{ from: 'ds', to: 'conv' }],
    steps: { items: FLOW, at: 3 },
    note: 'Next the method\'s arguments are prepared. The message converter (Jackson) reads the JSON body into a TransferRequest object. Path variables and query parameters are bound, and @Valid runs Bean Validation on the request.',
  },
  {
    h: 320,
    line: 'transferService.transfer(request)',
    cards: [client(), filter(['passed']), ds(['calls the method'], { tone: 'new' }), hm({ dim: true }), conv(['JSON → object'], { dim: true }), ctrl(['create(req)', 'calls service'], { badge: 'your code', tone: 'new' })],
    arrows: [{ from: 'ds', to: 'ctrl', fs: 'r', ts: 'l' }],
    steps: { items: FLOW, at: 4 },
    note: 'Now your controller method runs. It should stay thin: it hands the work to a service, which does the transactional business logic, and returns a result object or a ResponseEntity.',
  },
  {
    h: 320,
    line: '201 Created   Location: /api/transfers/42',
    result: { text: 'done', tone: 'ok' },
    cards: [
      client(['201 Created', 'Location header'], { tone: 'ok' }),
      filter(['passes out']),
      ds(['writes response']),
      hm({ dim: true }),
      conv(['object → JSON'], { badge: 'write' }),
      ctrl(['returned'], { dim: true }),
    ],
    arrows: [
      { from: 'conv', to: 'ds', fs: 'l', ts: 'r', tone: 'ok' },
      { from: 'ds', to: 'filter', fs: 'l', ts: 'r', tone: 'ok' },
      { from: 'filter', to: 'client', fs: 'l', ts: 'r', tone: 'ok' },
    ],
    steps: { items: FLOW, at: 5 },
    note: 'The return value goes back through the message converter, which writes JSON (content negotiation picks the format). Interceptors run postHandle and afterCompletion. The response leaves through the filters, and the client gets 201 Created with a Location header.',
  },
];

/* ---------- validation and errors ---------- */
const eClient = (lines = ['POST amount = -50', 'iban = ""'], o = {}) => ({ id: 'client', x: 14, y: 40, w: 160, title: 'Client', lines, tone: 'new', ...o });
const validator = (lines, o = {}) => ({ id: 'val', x: 232, y: 40, w: 190, title: 'Validator (@Valid)', lines, tone: 'bad', ...o });
const eCtrl = (o = {}) => ({ id: 'ctrl', x: 480, y: 40, w: 146, title: 'Controller', lines: ['create(request)'], tone: 'none', ...o });
const advice = (lines, o = {}) => ({ id: 'adv', x: 232, y: 170, w: 190, title: '@RestControllerAdvice', lines, tone: 'new', ...o });

const errorFrames = [
  {
    h: 240,
    line: '{"amount": -50, "iban": ""}',
    result: { text: '2 violations', tone: 'bad' },
    cards: [eClient(), validator(['@Positive amount: fails', '@NotBlank iban: fails']), eCtrl()],
    arrows: [{ from: 'client', to: 'val', tone: 'new' }],
    note: 'The client posts an amount of -50 and a blank IBAN. The converter builds a TransferRequest from the JSON. The @Valid on the controller parameter then runs Bean Validation, and two rules fail.',
  },
  {
    h: 240,
    line: 'throw MethodArgumentNotValidException',
    result: { text: 'controller skipped', tone: 'bad' },
    cards: [eClient(), validator(['throws an exception', 'with both field errors']), eCtrl({ dim: true, badge: 'never called', badgeTone: 'none' })],
    arrows: [{ from: 'val', to: 'ctrl', cross: true, tone: 'bad' }],
    note: 'Validation fails before the controller method runs. Spring throws MethodArgumentNotValidException, which carries every field error. Without a handler, the client would get a generic error page.',
  },
  {
    h: 240,
    line: '@ExceptionHandler(MethodArgumentNotValidException.class)',
    cards: [eClient(), validator(['throws an exception']), eCtrl({ dim: true }), advice(['one class', 'handles every controller'], { badge: 'global handler' })],
    arrows: [{ from: 'val', to: 'adv', fs: 'b', ts: 't', label: 'exception', tone: 'bad' }],
    note: 'A @RestControllerAdvice class holds @ExceptionHandler methods for every controller in one place. The DispatcherServlet hands the exception to it instead of letting it escape.',
  },
  {
    h: 240,
    line: '400  application/problem+json',
    result: { text: 'clear error', tone: 'ok' },
    cards: [
      eClient(['400 Bad Request', 'errors: amount, iban'], { tone: 'ok' }),
      validator(['throws an exception'], { dim: true }),
      eCtrl({ dim: true }),
      advice(['returns ProblemDetail', 'status 400 + field errors'], { tone: 'ok' }),
    ],
    arrows: [{ from: 'adv', to: 'client', fs: 'l', ts: 'b', label: 'ProblemDetail', tone: 'ok' }],
    note: 'The handler returns a ProblemDetail (RFC 9457) with the right status: 400 for validation, 404 when something is missing, 409 for a conflict, 422 when a business rule fails. The client always gets the same error shape, and never a stack trace.',
  },
];

/* ---------- filter, interceptor, advice ---------- */
const layerRegions = (c = 'none', m = 'none') => [
  { x: 14, y: 24, w: 612, h: 172, title: 'servlet container (Tomcat)', tone: c },
  { x: 168, y: 60, w: 446, h: 124, title: 'DispatcherServlet (Spring MVC)', tone: m, solid: true },
];
const lFilter = (lines = ['OncePerRequestFilter'], o = {}) => ({ id: 'filter', x: 28, y: 110, w: 126, title: 'Filter', lines, tone: 'none', ...o });
const lInt = (lines = ['HandlerInterceptor'], o = {}) => ({ id: 'int', x: 184, y: 110, w: 134, title: 'Interceptor', lines, tone: 'none', ...o });
const lCtrl = (lines = ['your method'], o = {}) => ({ id: 'ctrl', x: 344, y: 110, w: 118, title: 'Controller', lines, tone: 'none', ...o });
const lAdv = (lines = ['handles errors'], o = {}) => ({ id: 'adv', x: 484, y: 110, w: 122, title: 'Advice', lines, tone: 'none', ...o });

const layerFrames = [
  {
    h: 210,
    line: 'three hooks, three layers',
    regions: layerRegions(),
    cards: [lFilter(undefined, { tone: 'new' }), lInt(undefined, { tone: 'new' }), lCtrl(), lAdv(undefined, { tone: 'new' })],
    note: 'Three kinds of hooks sit at different layers. A filter belongs to the servlet container and sees the raw request before Spring MVC. An interceptor belongs to Spring MVC and knows which handler was chosen. A controller advice handles exceptions.',
  },
  {
    h: 210,
    line: 'filter  →  preHandle  →  controller',
    result: { text: 'on the way in', tone: 'new' },
    regions: layerRegions('new', 'new'),
    cards: [lFilter(['1st: before Spring'], { tone: 'ok' }), lInt(['2nd: preHandle'], { tone: 'ok' }), lCtrl(['3rd: runs'], { tone: 'ok' }), lAdv(undefined, { dim: true })],
    arrows: [{ from: 'filter', to: 'int', tone: 'new' }, { from: 'int', to: 'ctrl', tone: 'new' }],
    note: 'On the way in, the order is: filter, then DispatcherServlet, then the interceptor\'s preHandle, then the controller. A filter can wrap or replace the request and response. Spring Security is a chain of filters.',
  },
  {
    h: 210,
    line: 'postHandle  ·  afterCompletion  ·  filter',
    result: { text: 'on the way out', tone: 'ok' },
    regions: layerRegions('ok', 'ok'),
    cards: [lFilter(['response leaves'], { tone: 'ok' }), lInt(['postHandle', 'afterCompletion'], { tone: 'ok', badge: 'always runs' }), lCtrl(['returns result'], { tone: 'ok' }), lAdv(undefined, { dim: true })],
    arrows: [{ from: 'ctrl', to: 'int', fs: 'l', ts: 'r', tone: 'ok' }, { from: 'int', to: 'filter', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'On the way out, postHandle runs after the controller. afterCompletion always runs when the request ends, so it suits cleanup and timing. Then the response flows back out through the filters.',
  },
  {
    h: 210,
    line: 'throw new AccountNotFoundException(42)',
    result: { text: '404 ProblemDetail', tone: 'ok' },
    regions: layerRegions(),
    cards: [lFilter(['response leaves']), lInt(['afterCompletion']), lCtrl(['throws'], { tone: 'bad' }), lAdv(['maps it to 404'], { tone: 'ok', badge: 'handles it' })],
    arrows: [{ from: 'ctrl', to: 'adv', tone: 'bad' }],
    note: 'If the controller throws, the DispatcherServlet passes the exception to the controller advice. The advice turns it into a proper response, here a 404 ProblemDetail. afterCompletion still runs.',
  },
  {
    h: 210,
    line: 'which one to use?',
    cards: [
      { id: 'f', x: 14, y: 30, w: 198, title: 'Filter', lines: ['every request, even errors', 'security, CORS, request ID', 'compression'], tone: 'ok' },
      { id: 'i', x: 222, y: 30, w: 198, title: 'Interceptor', lines: ['needs to know the handler', 'per-endpoint limits', 'locale, timing'], tone: 'ok' },
      { id: 'a', x: 430, y: 30, w: 196, title: 'Advice', lines: ['turns errors into responses', 'one place for all controllers'], tone: 'ok' },
    ],
    note: 'Use a filter for low-level concerns that must run for every request, including static files and errors. Use an interceptor when the concern depends on the handler, such as per-endpoint rate limits. Use controller advice to map errors, and AOP for service-layer concerns.',
  },
];

export const SPRING_MVC_SCENES = [
  { id: 'flow', label: 'Request flow', title: 'How one HTTP request travels through Spring MVC', stage: BoardStage, frames: flowFrames },
  { id: 'errors', label: 'Validation and errors', title: 'From a bad request to a clean 400 response with one global handler', stage: BoardStage, frames: errorFrames },
  { id: 'layers', label: 'Filter, interceptor, advice', title: 'Filter, interceptor and advice run at different layers of the request', stage: BoardStage, frames: layerFrames },
];
