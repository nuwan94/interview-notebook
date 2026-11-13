// Frame data for the Spring MVC and REST walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_MVC_SCENES = [
  {
    id: 'flow',
    label: 'Request flow',
    title: 'How one HTTP request travels through Spring MVC',
    frames: [
      {
        note: 'The client sends POST /api/transfers with a JSON body. The embedded server (Tomcat) receives it and hands it to the servlet container, which runs the servlet filter chain before any Spring controller is involved.',
        boxes: [b('c', 'Client', ['POST /api/transfers', 'Content-Type: application/json'], 'new'), b('f', 'Servlet filter', ['security, CORS, logging, encoding'], 'ok', 'first')],
        deps: [d('Client', 'Servlet filter', 'HTTP request', 'ok')],
      },
      {
        note: 'After the filters the request reaches the DispatcherServlet, the single front controller of Spring MVC. It is the entry point for every request and coordinates the rest of the work.',
        boxes: [b('f', 'Servlet filter', ['passed'], 'ok'), b('d', 'Dispatcher servlet', ['front controller', 'one per application'], 'new', 'front controller')],
        deps: [d('Servlet filter', 'Dispatcher servlet', 'doFilter chain', 'ok')],
      },
      {
        note: 'The DispatcherServlet asks the handler mappings which controller method handles POST /api/transfers (from @PostMapping annotations), and finds the matching handler plus any interceptors. An interceptor preHandle can stop the request here.',
        boxes: [b('d', 'Dispatcher servlet', ['HandlerMapping lookup', 'finds TransferController.create()'], 'ok'), b('i', 'Interceptor', ['preHandle: auth context, rate check'], 'warn', 'may stop')],
        deps: [d('Dispatcher servlet', 'Interceptor', 'preHandle', 'ok')],
      },
      {
        note: 'Argument resolvers prepare the method parameters. The message converter (Jackson) reads the JSON body into a TransferRequest object, @PathVariable and @RequestParam are bound, and @Valid runs Bean Validation on the request.',
        boxes: [b('m', 'Message converter', ['Jackson: JSON body to TransferRequest'], 'ok', 'deserialise'), b('v', 'Validator', ['@Valid: amount > 0, iban not blank'], 'ok', 'validated')],
        deps: [d('Dispatcher servlet', 'Message converter', 'read body', 'ok'), d('Message converter', 'Validator', 'validate', 'ok')],
      },
      {
        note: 'The controller method runs. It should stay thin: delegate to a service, which does the transactional work, and return a result object or ResponseEntity.',
        boxes: [b('c', 'Controller', ['TransferController.create(request)', 'calls transferService.transfer()'], 'ok', 'your code'), b('s', 'Service bean', ['@Transactional business logic'], 'ok')],
        deps: [d('Dispatcher servlet', 'Controller', 'invoke', 'ok'), d('Controller', 'Service bean', 'delegate', 'ok')],
      },
      {
        note: 'The return value goes back through the message converter (Jackson writes JSON, content negotiation picks the format), the interceptor postHandle and afterCompletion run, the response leaves through the filters, and the client receives 201 Created with a body and a Location header.',
        boxes: [b('m', 'Message converter', ['Jackson: TransferResponse to JSON'], 'ok', 'serialise'), b('f', 'Servlet filter', ['response passes back out'], 'ok'), b('c', 'Client', ['201 Created', 'Location: /api/transfers/42'], 'new', 'response')],
        deps: [d('Message converter', 'Servlet filter', 'write response', 'ok'), d('Servlet filter', 'Client', '201 Created', 'ok')],
      },
    ],
  },
  {
    id: 'errors',
    label: 'Validation and errors',
    title: 'From a bad request to a clean 400 response with one global handler',
    frames: [
      {
        note: 'The client posts an amount of -50 and a blank IBAN. The message converter builds the TransferRequest from the JSON; the @Valid annotation on the controller parameter triggers Bean Validation.',
        boxes: [b('c', 'Client', ['POST amount = -50, iban = ""'], 'new'), b('v', 'Validator', ['@Positive amount: violated', '@NotBlank iban: violated'], 'bad', '2 violations')],
        deps: [d('Client', 'Validator', 'request body', 'ok')],
      },
      {
        note: 'Validation fails before the controller method runs, and Spring throws MethodArgumentNotValidException carrying every field error. Without a handler this would be a generic 400 or, for other exceptions, a 500 with an unhelpful error page.',
        boxes: [b('v', 'Validator', ['throws MethodArgumentNotValidException'], 'bad'), b('c', 'Controller', ['never called'], 'none', 'skipped')],
        deps: [d('Validator', 'Dispatcher servlet', 'exception', 'bad')],
      },
      {
        note: 'A @RestControllerAdvice class with @ExceptionHandler methods catches exceptions from every controller in one place. The DispatcherServlet delegates the exception to it instead of letting it escape.',
        boxes: [b('a', 'Controller advice', ['@RestControllerAdvice', '@ExceptionHandler(MethodArgumentNotValidException)'], 'new', 'global handler'), b('d', 'Dispatcher servlet', ['delegates the exception'], 'ok')],
        deps: [d('Dispatcher servlet', 'Controller advice', 'handle exception', 'ok')],
      },
      {
        note: 'The handler returns a consistent error body, preferably RFC 9457 ProblemDetail (type, title, status, detail, plus a list of field errors), with the right status: 400 for validation, 404 for missing resources, 409 for conflicts, 422 for business rule violations. The client always gets the same error shape and never a stack trace.',
        boxes: [b('a', 'Controller advice', ['returns ProblemDetail', 'status 400', 'errors: amount, iban'], 'ok', 'consistent'), b('c', 'Client', ['400 Bad Request', 'application/problem+json'], 'ok', 'clear error')],
        deps: [d('Controller advice', 'Client', '400 with field errors', 'ok')],
      },
    ],
  },
  {
    id: 'layers',
    label: 'Filter, interceptor, advice',
    title: 'Filter, interceptor and advice run at different layers of the request',
    frames: [
      {
        note: 'Three kinds of cross-cutting hooks sit at different layers. A servlet filter belongs to the servlet container and sees raw requests and responses, before Spring MVC. An interceptor belongs to Spring MVC and knows the chosen handler. A controller advice handles exceptions and response bodies.',
        boxes: [b('f', 'Servlet filter', ['servlet container layer', 'OncePerRequestFilter'], 'new'), b('d', 'Dispatcher servlet', ['Spring MVC layer'], 'new'), b('i', 'Interceptor', ['HandlerInterceptor', 'knows the handler method'], 'new'), b('a', 'Controller advice', ['exceptions and response bodies'], 'new')],
        deps: [],
      },
      {
        note: 'On the way in the order is: filter, then DispatcherServlet, then interceptor preHandle, then the controller. A filter can wrap or replace the request and response (compression, authentication tokens, request ids); Spring Security is a filter chain.',
        boxes: [b('f', 'Servlet filter', ['1st: before the servlet'], 'ok'), b('d', 'Dispatcher servlet', ['2nd'], 'ok'), b('i', 'Interceptor', ['3rd: preHandle'], 'ok'), b('c', 'Controller', ['4th: your method'], 'ok')],
        deps: [d('Servlet filter', 'Dispatcher servlet', 'next', 'ok'), d('Dispatcher servlet', 'Interceptor', 'next', 'ok'), d('Interceptor', 'Controller', 'next', 'ok')],
      },
      {
        note: 'On the way out: postHandle runs after the controller (before rendering), afterCompletion always runs when the request ends (good for cleanup and timing), then the response flows back through the filters.',
        boxes: [b('c', 'Controller', ['returns result'], 'ok'), b('i', 'Interceptor', ['postHandle, then afterCompletion'], 'ok', 'always runs'), b('f', 'Servlet filter', ['response leaves'], 'ok')],
        deps: [d('Controller', 'Interceptor', 'result', 'ok'), d('Interceptor', 'Servlet filter', 'response', 'ok')],
      },
      {
        note: 'Choosing: use a filter for low-level, framework-independent concerns that must run for every request including static resources and errors (security, CORS, request ids, compression). Use an interceptor for Spring-aware concerns tied to handlers (per-endpoint rate limits, locale). Use controller advice for error mapping, and AOP for service-layer concerns.',
        boxes: [b('f', 'Servlet filter', ['security, CORS, request id'], 'ok', 'everything'), b('i', 'Interceptor', ['handler-aware checks'], 'ok', 'MVC only'), b('a', 'Controller advice', ['error mapping'], 'ok', 'exceptions')],
        deps: [],
      },
    ],
  },
];
