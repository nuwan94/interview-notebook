// Frame data for the "Exceptions and error handling" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const EXCEPTION_SCENES = [
  {
    id: 'hierarchy',
    label: 'Hierarchy',
    title: 'Everything that can be thrown is a Throwable',
    frames: [
      {
        note: 'Only objects of type Throwable can be thrown and caught. It has two direct subclasses with very different meanings: Error and Exception. Everything you write a catch block for sits under one of them.',
        boxes: [b('t', 'Throwable', ['can be thrown and caught'], 'none'), b('e', 'Error', ['the JVM is in trouble'], 'bad'), b('x', 'Exception', ['your program\'s problems'], 'ok')],
        deps: [d('Throwable', 'Error', 'subclass', 'ok'), d('Throwable', 'Exception', 'subclass', 'ok')],
      },
      {
        note: 'An Error reports a failure of the JVM or the environment: the heap is full, the stack is full, a class cannot be loaded. The program usually cannot recover, so you normally do not catch an Error. Fix the cause instead.',
        boxes: [b('e', 'Error', ['do not catch'], 'bad'), b('o', 'OutOfMemory', ['Error: heap is full'], 'bad'), b('s', 'StackOverflow', ['Error: stack is full'], 'bad')],
        deps: [d('Error', 'OutOfMemory', 'for example', 'bad'), d('Error', 'StackOverflow', 'for example', 'bad')],
      },
      {
        note: 'Exception splits in two. A checked exception such as IOException or SQLException must be caught or declared with throws, and the compiler enforces it. RuntimeException and its subclasses are unchecked: the compiler does not force you to handle them.',
        boxes: [b('x', 'Exception', ['checked unless a RuntimeException'], 'none'), b('i', 'IOException', ['checked: catch or declare'], 'warn', 'checked'), b('r', 'RuntimeException', ['unchecked: no compiler check'], 'ok', 'unchecked')],
        deps: [d('Exception', 'IOException', 'checked', 'warn'), d('Exception', 'RuntimeException', 'unchecked', 'ok')],
      },
      {
        note: 'Most unchecked exceptions mean a bug in the calling code: null where a value was required, a bad argument, an object in the wrong state. Custom business exceptions in modern code, for example InsufficientFundsException, usually extend RuntimeException too.',
        boxes: [b('r', 'RuntimeException', ['unchecked'], 'ok'), b('n', 'NullPointer', ['Exception: null used'], 'warn'), b('a', 'IllegalArgument', ['Exception: bad input'], 'warn'), b('t', 'IllegalState', ['Exception: wrong moment'], 'warn')],
        deps: [d('RuntimeException', 'NullPointer', 'for example', 'warn'), d('RuntimeException', 'IllegalArgument', '', 'warn'), d('RuntimeException', 'IllegalState', '', 'warn')],
      },
    ],
  },
  {
    id: 'flow',
    label: 'try, catch, finally',
    title: 'What runs when',
    frames: [
      {
        note: 'No exception: the try block runs to its end, every catch block is skipped, and the finally block runs. Finally is for clean-up that must happen whatever else occurs.',
        boxes: [b('t', 'try block', ['runs to the end'], 'ok'), b('c', 'catch block', ['skipped'], 'none'), b('f', 'finally block', ['always runs'], 'new')],
        deps: [d('try block', 'finally block', 'no exception', 'ok')],
      },
      {
        note: 'An exception is thrown on one line. The rest of the try block is skipped, the JVM looks for the first catch whose type matches, runs it, and then runs the finally block. Execution continues after the whole statement.',
        boxes: [b('t', 'try block', ['credit() throws'], 'bad'), b('c', 'catch block', ['first matching type'], 'warn'), b('f', 'finally block', ['always runs'], 'new')],
        deps: [d('try block', 'catch block', 'exception', 'bad'), d('catch block', 'finally block', 'then', 'ok')],
      },
      {
        note: 'No catch block matches. The finally block still runs, and then the exception continues up the call stack to the caller. If nothing ever catches it, the thread ends and the stack trace is printed.',
        boxes: [b('t', 'try block', ['throws IOException'], 'bad'), b('c', 'catch block', ['no matching type'], 'none'), b('f', 'finally block', ['still runs'], 'new'), b('k', 'Caller', ['receives the exception'], 'bad')],
        deps: [d('try block', 'finally block', 'exception', 'bad'), d('finally block', 'Caller', 'propagates', 'bad')],
      },
      {
        note: 'A trap: a return (or a throw) inside finally replaces whatever the try block was doing. Here the method would return 1, but finally returns 2, and an exception thrown in the try block would vanish without a trace. Never return from finally.',
        boxes: [b('t', 'try block', ['return 1'], 'none'), b('f', 'finally block', ['return 2'], 'bad'), b('r', 'Result', ['2, and any exception is lost'], 'bad')],
        deps: [d('try block', 'finally block', 'before returning', 'warn'), d('finally block', 'Result', 'wins', 'bad')],
      },
    ],
  },
  {
    id: 'resources',
    label: 'try-with-resources',
    title: 'Closing resources safely',
    frames: [
      {
        note: 'Resources declared in the try header are opened from top to bottom. Each must implement AutoCloseable. Here a connection is opened first and a statement second.',
        boxes: [b('c', 'Connection', ['opened first'], 'ok'), b('s', 'Statement', ['opened second'], 'ok'), b('t', 'try body', ['uses both'], 'new')],
        deps: [d('Connection', 'Statement', 'then', 'ok'), d('Statement', 'try body', 'then', 'ok')],
      },
      {
        note: 'When the body ends, normally or with an exception, the resources are closed in reverse order: the statement first, then the connection. No finally block is needed and nothing is left open.',
        boxes: [b('t', 'try body', ['ends or throws'], 'none'), b('s', 'Statement', ['closed first'], 'ok'), b('c', 'Connection', ['closed second'], 'ok')],
        deps: [d('try body', 'Statement', 'then close', 'ok'), d('Statement', 'Connection', 'then close', 'ok')],
      },
      {
        note: 'Suppose the body throws and close() throws as well. A hand-written finally would let the second exception replace the first, hiding the real cause. Try-with-resources keeps the body\'s exception as the primary one.',
        boxes: [b('p', 'Primary', ['SQLException from the body'], 'bad'), b('f', 'close failure', ['a second exception'], 'warn'), b('u', 'Suppressed', ['attached to the primary'], 'ok')],
        deps: [d('close failure', 'Suppressed', 'recorded', 'ok'), d('Suppressed', 'Primary', 'added to', 'ok')],
      },
      {
        note: 'The caller catches the primary exception, the real problem, and can still read the close failures with getSuppressed(). Nothing is lost and the cause is not masked.',
        boxes: [b('k', 'Caller', ['catches the primary'], 'ok'), b('p', 'Primary', ['the real cause'], 'bad'), b('g', 'getSuppressed()', ['the close failures'], 'new')],
        deps: [d('Caller', 'Primary', 'catch', 'ok'), d('Primary', 'getSuppressed()', 'has', 'ok')],
      },
    ],
  },
  {
    id: 'spring',
    label: 'In a Spring service',
    title: 'From a failure to an HTTP response and a rollback',
    frames: [
      {
        note: 'A transfer request reaches the service, and the account does not have enough money. The service throws an InsufficientFundsException (an unchecked business exception) and does not catch it: it has no sensible way to fix the problem here.',
        boxes: [b('c', 'Controller', ['POST /transfers'], 'none'), b('s', 'Service', ['transfer()'], 'none'), b('x', 'InsufficientFunds', ['Exception thrown'], 'bad')],
        deps: [d('Controller', 'Service', 'calls', 'ok'), d('Service', 'InsufficientFunds', 'throws', 'bad')],
      },
      {
        note: 'The exception travels up through the controller to Spring MVC. The controller has no try and catch. Spring looks for an @ExceptionHandler, first in the controller and then in any @RestControllerAdvice, and finds the one for this type.',
        boxes: [b('x', 'InsufficientFunds', ['propagates up'], 'bad'), b('d', 'DispatcherServlet', ['looks for a handler'], 'none'), b('a', 'ControllerAdvice', ['@ExceptionHandler'], 'new')],
        deps: [d('InsufficientFunds', 'DispatcherServlet', 'arrives at', 'bad'), d('DispatcherServlet', 'ControllerAdvice', 'finds', 'ok')],
      },
      {
        note: 'The handler turns the exception into a clean response: a ProblemDetail with a status (422 or 409), a type, a title and a message the client can use, and a correlation id. The stack trace stays in the log. The client never sees it.',
        boxes: [b('a', 'ControllerAdvice', ['maps the exception'], 'ok'), b('p', 'ProblemDetail', ['status 422, type, detail'], 'ok'), b('l', 'Log', ['stack trace, correlation id'], 'new'), b('k', 'Client', ['clean JSON, no trace'], 'ok')],
        deps: [d('ControllerAdvice', 'ProblemDetail', 'builds', 'ok'), d('ControllerAdvice', 'Log', 'writes', 'ok'), d('ProblemDetail', 'Client', 'response', 'ok')],
      },
      {
        note: 'On the way out, @Transactional decides commit or rollback. By default it rolls back for unchecked exceptions and errors, but it commits when the method throws a checked exception unless you add rollbackFor. A wrong guess here leaves half-finished money movements.',
        boxes: [b('s', 'Service', ['@Transactional'], 'none'), b('r', 'RuntimeException', ['unchecked'], 'bad'), b('i', 'IOException', ['checked'], 'warn'), b('b', 'Rollback', ['by default'], 'ok'), b('m', 'Commit', ['by default'], 'warn')],
        deps: [d('Service', 'RuntimeException', 'throws', 'bad'), d('Service', 'IOException', 'throws', 'warn'), d('RuntimeException', 'Rollback', 'leads to', 'ok'), d('IOException', 'Commit', 'leads to', 'warn')],
      },
    ],
  },
];
