// Frame data for the "Exceptions and error handling" walk-through.
// hierarchy: ThrowableTreeStage (the class tree); flow and resources: TryStage (code that runs line by line);
// spring: the icon graph, because there the real mechanism is parts of the application calling each other.
// box.tone: ok | bad | warn | new | none.

import { ThrowableTreeStage } from './ThrowableTreeStage.jsx';
import { TryStage } from './TryStage.jsx';

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

// ---- the class tree ----
const TREE = [
  { id: 'throwable', name: 'Throwable', depth: 0, kind: 'base' },
  { id: 'error', name: 'Error', depth: 1, kind: 'error', parent: 'throwable' },
  { id: 'oom', name: 'OutOfMemoryError', depth: 2, kind: 'error', parent: 'error' },
  { id: 'soe', name: 'StackOverflowError', depth: 2, kind: 'error', parent: 'error' },
  { id: 'exception', name: 'Exception', depth: 1, kind: 'checked', parent: 'throwable' },
  { id: 'io', name: 'IOException', depth: 2, kind: 'checked', parent: 'exception' },
  { id: 'sql', name: 'SQLException', depth: 2, kind: 'checked', parent: 'exception' },
  { id: 'rte', name: 'RuntimeException', depth: 2, kind: 'unchecked', parent: 'exception' },
  { id: 'npe', name: 'NullPointerException', depth: 3, kind: 'unchecked', parent: 'rte' },
  { id: 'iae', name: 'IllegalArgumentException', depth: 3, kind: 'unchecked', parent: 'rte' },
  { id: 'ise', name: 'IllegalStateException', depth: 3, kind: 'unchecked', parent: 'rte' },
  { id: 'ife', name: 'InsufficientFundsException', depth: 3, kind: 'yours', parent: 'rte', tag: 'your own' },
];
const GROUPS = [
  { id: 'error', members: ['error', 'oom', 'soe'], title: 'Errors', lines: ['The JVM is in trouble.', 'Do not catch them.'], tone: 'bad' },
  { id: 'checked', members: ['exception', 'io', 'sql'], title: 'Checked', lines: ['Catch them, or declare', 'them with throws.'], tone: 'warn' },
  { id: 'unchecked', members: ['rte', 'npe', 'iae', 'ise', 'ife'], title: 'Unchecked', lines: ['The compiler does not check', 'them. Most of them mean a', 'bug in the calling code.'], tone: 'ok' },
];
const tree = (frame) => ({ tree: TREE, groupDefs: GROUPS, ...frame });

// ---- the transfer code for the try / catch / finally scene ----
const TRANSFER = [
  'try {',
  '    ledger.debit(from, cents);',
  '    ledger.credit(to, cents);',
  '} catch (InsufficientFundsException e) {',
  '    audit.rejected(from, cents);',
  '} finally {',
  '    metrics.count("transfer.attempted");',
  '}',
  'nextStep();',
];
const run = (code, states) => code.map((t, i) => ({ t, s: { r: 'run', s: 'skip', x: 'throw', w: 'wait' }[states[i]] }));

const BROKEN = ['static int broken() {', '  try {', '    throw new IllegalStateException("lost");', '  } finally {', '    return 2;', '  }', '}'];

const LOAD = [
  'try (Connection con = ds.getConnection();',
  '     var ps = con.prepareStatement(sql)) {',
  '    ResultSet rs = ps.executeQuery();',
  '}   // Java closes ps, then con',
  'catch (SQLException e) {',
  '    e.getSuppressed();   // close failures',
  '}',
];

export const EXCEPTION_SCENES = [
  {
    id: 'hierarchy',
    label: 'Hierarchy',
    title: 'Everything that can be thrown is a Throwable',
    stage: ThrowableTreeStage, // the class tree with group brackets
    frames: [
      tree({
        line: 'class Exception extends Throwable',
        show: ['throwable', 'error', 'exception'],
        groups: [],
        note: 'Only a Throwable can be thrown and caught. It has two direct subclasses with very different meanings: Error and Exception. Every catch block you write is for a class somewhere under one of them.',
      }),
      tree({
        line: 'class OutOfMemoryError extends Error',
        show: ['throwable', 'error', 'oom', 'soe', 'exception'],
        focus: ['error', 'oom', 'soe'],
        groups: ['error'],
        note: 'An Error reports a problem in the JVM or its environment. The heap is full, the stack is full, or a class cannot be loaded. The program usually cannot recover, so you do not catch an Error. You fix the cause instead.',
      }),
      tree({
        line: 'void load() throws IOException',
        show: ['throwable', 'error', 'oom', 'soe', 'exception', 'io', 'sql', 'rte'],
        focus: ['exception', 'io', 'sql', 'rte'],
        groups: ['error', 'checked', 'unchecked'],
        note: 'Exception splits in two. A checked exception, such as IOException or SQLException, must be caught or declared with throws, and the compiler checks this. RuntimeException and its subclasses are unchecked, so the compiler does not force you to handle them.',
      }),
      tree({
        line: 'class InsufficientFundsException extends RuntimeException',
        show: TREE.map((n) => n.id),
        focus: ['rte', 'npe', 'iae', 'ise', 'ife'],
        groups: ['error', 'checked', 'unchecked'],
        note: 'Most unchecked exceptions mean a bug in the calling code: a null where a value was needed, a bad argument, or a call at the wrong moment. In modern code, your own business exceptions, such as InsufficientFundsException, usually extend RuntimeException too.',
      }),
    ],
  },
  {
    id: 'flow',
    label: 'try, catch, finally',
    title: 'Which lines run when nothing fails, when a catch matches, and when none does',
    stage: TryStage, // the code with run / skip / throw markers and jump arrows
    frames: [
      {
        case: 'Case 1: no exception',
        result: { text: 'finally runs', tone: 'ok' },
        lines: run(TRANSFER, 'rrrssrrrr'),
        jumps: [{ from: 2, to: 5, tone: 'ok' }],
        cards: [{ title: 'No exception', lines: ['The try block ran to its end.', 'The catch block was skipped.', 'The finally block ran.'], tone: 'ok' }],
        note: 'Nothing fails. The try block runs to its end, the catch block is skipped, and the finally block runs. Then the program continues with nextStep(). Use finally for clean-up that must always happen.',
      },
      {
        case: 'Case 2: a catch matches',
        result: { text: 'caught, then finally runs', tone: 'ok' },
        lines: run(TRANSFER, 'rxsrrrrrr'),
        jumps: [{ from: 1, to: 3, tone: 'bad' }],
        cards: [{ title: 'Caught', lines: ['debit() threw an', 'InsufficientFundsException.', 'The catch type matches it.'], tone: 'warn' }],
        note: 'debit() throws an InsufficientFundsException. The rest of the try block is skipped, so credit() never runs. Java jumps to the first catch whose type matches, runs it, and then runs finally. The program continues after the whole statement.',
      },
      {
        case: 'Case 3: no catch matches',
        result: { text: 'finally runs, then the exception leaves', tone: 'bad' },
        lines: run(TRANSFER, 'rxsssrrrs'),
        jumps: [
          { from: 1, to: 5, tone: 'bad' },
          { from: 7, to: 9, tone: 'bad' },
        ],
        exit: 'out of the method, to the caller',
        cards: [{ title: 'Not caught', lines: ['debit() threw a', 'LedgerUnavailableException.', 'No catch matches it.', 'finally still runs, and then', 'the exception goes up to', 'the caller.'], tone: 'bad' }],
        note: 'This time debit() throws an exception that no catch block matches. The finally block still runs. Then the exception leaves the method and goes up to the caller, so nextStep() never runs. If nothing ever catches it, the thread ends and the stack trace is printed.',
      },
      {
        case: 'The trap: return in finally',
        result: { text: 'returns 2, the exception is lost', tone: 'bad' },
        lines: run(BROKEN, 'rrxrrss'),
        jumps: [{ from: 2, to: 3, tone: 'bad' }],
        cards: [
          { title: 'IllegalStateException', lines: ['Thrown on line 3,', 'then silently thrown away.'], tone: 'bad' },
          { title: 'The caller gets 2', lines: ['as if nothing went wrong.'], tone: 'bad' },
        ],
        note: 'A return (or a throw) inside finally replaces whatever the try block was doing. Here the try block throws, but finally returns 2, so the exception disappears without a trace. The same happens to a value returned from try. Never return from finally.',
      },
    ],
  },
  {
    id: 'resources',
    label: 'try-with-resources',
    title: 'Resources are closed in reverse order, and a failure while closing does not hide the real error',
    stage: TryStage,
    frames: [
      {
        case: 'Opening: top to bottom',
        result: { text: 'con first, then ps', tone: 'new' },
        lines: run(LOAD, 'rrwwwww'),
        sideTitle: 'Open resources',
        cards: [
          { title: 'ps (PreparedStatement)', lines: ['Opened 2nd.'], tone: 'new' },
          { title: 'con (Connection)', lines: ['Opened 1st.'], tone: 'new' },
        ],
        note: 'The resources in the try header open from top to bottom: first the connection, then the statement. Each one must implement AutoCloseable, so Java knows how to close it.',
      },
      {
        case: 'Closing: reverse order',
        result: { text: 'nothing is left open', tone: 'ok' },
        lines: run(LOAD, 'rrrrsss'),
        sideTitle: 'Closed in reverse order',
        cards: [
          { title: 'ps (PreparedStatement)', lines: ['Closed 1st.'], tone: 'ok' },
          { title: 'con (Connection)', lines: ['Closed 2nd.'], tone: 'ok' },
        ],
        note: 'When the body ends, Java closes the resources in reverse order: first the statement, then the connection. This happens whether the body ends normally or with an exception. No finally block is needed.',
      },
      {
        case: 'The body fails, and close() fails too',
        result: { text: 'the real error stays primary', tone: 'ok' },
        lines: run(LOAD, 'rrxrwww'),
        sideTitle: 'Closing after a failure',
        cards: [
          { title: 'ps.close()', lines: ['Fails: a second exception.'], tone: 'bad' },
          { title: 'con.close()', lines: ['Closes normally.'], tone: 'ok' },
          { title: 'SQLException (primary)', lines: ['Thrown by executeQuery().'], tone: 'bad', inner: { title: 'suppressed', lines: ['The ps.close() failure.'], tone: 'warn' } },
        ],
        note: 'executeQuery() throws, and then ps.close() throws as well. Java keeps the body\'s exception as the primary one. The close failure is attached to it as a suppressed exception, so it is recorded but cannot replace the real error.',
      },
      {
        case: 'The caller catches the primary exception',
        result: { text: 'nothing is lost', tone: 'ok' },
        lines: run(LOAD, 'rrxrrrr'),
        sideTitle: 'What the catch sees',
        cards: [
          { title: 'e: the SQLException', lines: ['The real cause.'], tone: 'ok', inner: { title: 'e.getSuppressed()', lines: ['The close failure.'], tone: 'warn' } },
          { title: 'Hand-written finally', lines: ['The close failure would be', 'thrown instead, and the', 'real cause would be lost.'], tone: 'bad' },
        ],
        note: 'The catch block receives the real problem. It can still read the close failures with getSuppressed(). With a hand-written finally, the second exception would replace the first, and the real cause would be lost.',
      },
    ],
  },
  {
    id: 'spring',
    label: 'In a Spring service',
    title: 'From a failure to an HTTP response and a rollback',
    frames: [
      {
        note: 'A transfer request reaches the service, and the account does not have enough money. The service throws an InsufficientFundsException, an unchecked business exception. It does not catch it, because it cannot fix the problem here.',
        boxes: [b('c', 'Controller', ['POST /transfers'], 'none'), b('s', 'Service', ['transfer()'], 'none'), b('x', 'InsufficientFunds', ['Exception thrown'], 'bad')],
        deps: [d('Controller', 'Service', 'calls', 'ok'), d('Service', 'InsufficientFunds', 'throws', 'bad')],
      },
      {
        note: 'The exception travels up through the controller to Spring MVC. The controller has no try and catch. Spring looks for an @ExceptionHandler, first in the controller and then in any @RestControllerAdvice, and finds the one for this type.',
        boxes: [b('x', 'InsufficientFunds', ['travels up'], 'bad'), b('d', 'DispatcherServlet', ['looks for a handler'], 'none'), b('a', 'ControllerAdvice', ['@ExceptionHandler'], 'new')],
        deps: [d('InsufficientFunds', 'DispatcherServlet', 'arrives at', 'bad'), d('DispatcherServlet', 'ControllerAdvice', 'finds', 'ok')],
      },
      {
        note: 'The handler turns the exception into a clean response. It is a ProblemDetail with a status (422 or 409), a type, a title, a message the client can use, and a correlation id. The stack trace goes only to the log. The client never sees it.',
        boxes: [b('a', 'ControllerAdvice', ['maps the exception'], 'ok'), b('p', 'ProblemDetail', ['status 422, type, detail'], 'ok'), b('l', 'Log', ['stack trace, correlation id'], 'new'), b('k', 'Client', ['clean JSON, no trace'], 'ok')],
        deps: [d('ControllerAdvice', 'ProblemDetail', 'builds', 'ok'), d('ControllerAdvice', 'Log', 'writes', 'ok'), d('ProblemDetail', 'Client', 'response', 'ok')],
      },
      {
        note: 'On the way out, @Transactional decides between commit and rollback. By default it rolls back for unchecked exceptions and errors. It commits after a checked exception, unless you add rollbackFor. A wrong guess here leaves half-finished money transfers.',
        boxes: [b('s', 'Service', ['@Transactional'], 'none'), b('r', 'RuntimeException', ['unchecked'], 'bad'), b('i', 'IOException', ['checked'], 'warn'), b('b', 'Rollback', ['by default'], 'ok'), b('m', 'Commit', ['by default'], 'warn')],
        deps: [d('Service', 'RuntimeException', 'throws', 'bad'), d('Service', 'IOException', 'throws', 'warn'), d('RuntimeException', 'Rollback', 'leads to', 'ok'), d('IOException', 'Commit', 'leads to', 'warn')],
      },
    ],
  },
];
