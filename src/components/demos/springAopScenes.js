// Frame data for the Spring AOP and proxies walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_AOP_SCENES = [
  {
    id: 'proxy',
    label: 'Call through a proxy',
    title: 'The caller talks to a proxy, which adds behaviour around the real bean',
    frames: [
      {
        note: 'TransferService is annotated @Transactional. At startup Spring did not keep the plain object in the context: a post-processor wrapped it in a proxy. The proxy has the same methods and holds a reference to the real bean (the target).',
        boxes: [b('c', 'Client', ['controller bean calls transfer()'], 'new'), b('p', 'Transfer proxy', ['same interface or subclass', 'holds the target'], 'new', 'what is injected'), b('t', 'Transfer bean', ['the real object', 'contains your business code'], 'none', 'target')],
        deps: [d('Client', 'Transfer proxy', 'transfer()', 'ok')],
      },
      {
        note: 'The proxy intercepts the call. Before delegating it runs the advice: here the transaction advice asks the transaction manager to begin a transaction and bind it to the current thread.',
        boxes: [b('p', 'Transfer proxy', ['before advice', 'begin transaction'], 'ok'), b('m', 'Transaction manager', ['begin: connection bound to the thread'], 'ok', 'started')],
        deps: [d('Transfer proxy', 'Transaction manager', 'begin', 'ok')],
      },
      {
        note: 'The proxy then calls the real method on the target. Your code runs exactly as written, with no transaction code in it.',
        boxes: [b('p', 'Transfer proxy', ['proceed()'], 'ok'), b('t', 'Transfer bean', ['debit(), credit()', 'business logic only'], 'ok', 'runs')],
        deps: [d('Transfer proxy', 'Transfer bean', 'invoke target', 'ok')],
      },
      {
        note: 'Normal return: the advice commits the transaction. If the method had thrown a RuntimeException, the same advice would roll back instead. Either way the cross-cutting concern lived in one place, not in every service method.',
        boxes: [b('t', 'Transfer bean', ['returns normally'], 'ok'), b('p', 'Transfer proxy', ['after returning advice'], 'ok'), b('m', 'Transaction manager', ['commit (or rollback on RuntimeException)'], 'ok', 'committed')],
        deps: [d('Transfer proxy', 'Transaction manager', 'commit', 'ok'), d('Transfer proxy', 'Client', 'result', 'ok')],
      },
    ],
  },
  {
    id: 'self',
    label: 'Self-invocation trap',
    title: 'A call from inside the bean skips the proxy, so the advice never runs',
    frames: [
      {
        note: 'TransferService.process() is called from a controller. The controller holds the proxy, so the call passes through it and any advice on process() applies. So far everything works.',
        boxes: [b('c', 'Client', ['calls process()'], 'new'), b('p', 'Transfer proxy', ['advice applied to process()'], 'ok'), b('t', 'Transfer bean', ['process() running'], 'ok')],
        deps: [d('Client', 'Transfer proxy', 'process()', 'ok'), d('Transfer proxy', 'Transfer bean', 'invoke target', 'ok')],
      },
      {
        note: 'Inside process() the code calls this.audit(), a method annotated @Transactional(REQUIRES_NEW). That call goes straight from the target to itself. It never passes through the proxy, because "this" is the real object, not the proxy.',
        boxes: [b('t', 'Transfer bean', ['process() calls this.audit()', 'direct method call'], 'warn'), b('p', 'Transfer proxy', ['not involved'], 'none', 'bypassed')],
        deps: [d('Transfer bean', 'Transfer bean', 'this.audit()', 'bad')],
      },
      {
        note: 'Result: audit() runs without its own transaction, so REQUIRES_NEW, @Async, @Cacheable or @PreAuthorize on it are silently ignored. No error is raised, which is why the bug is so easy to miss. The same happens with private methods and with final classes or methods under CGLIB.',
        boxes: [b('t', 'Transfer bean', ['audit() ran inside the outer transaction', 'or with no transaction at all'], 'bad', 'advice skipped')],
        deps: [],
      },
      {
        note: 'Fix: move audit() to another bean and inject it, so the call crosses a proxy: transferService to auditService. Alternatives are injecting the proxy into itself (a smell), using AopContext.currentProxy(), or AspectJ weaving, which changes the bytecode and needs no proxy.',
        boxes: [b('t', 'Transfer bean', ['calls auditService.audit()'], 'ok'), b('a', 'Audit proxy', ['advice applies: REQUIRES_NEW'], 'new', 'works'), b('u', 'Audit bean', ['audit() in its own transaction'], 'ok')],
        deps: [d('Transfer bean', 'Audit proxy', 'audit()', 'ok'), d('Audit proxy', 'Audit bean', 'invoke target', 'ok')],
      },
    ],
  },
  {
    id: 'chain',
    label: 'Advice chain',
    title: 'Several aspects wrap one method in a defined order',
    frames: [
      {
        note: 'Three concerns apply to TransferService.transfer(): security, logging and the transaction. Each is an aspect. They are not mixed into the method; the proxy applies them around the target as a chain.',
        boxes: [b('c', 'Client', ['calls transfer()'], 'new'), b('p', 'Transfer proxy', ['security, logging, transaction'], 'new'), b('t', 'Transfer bean', ['business logic only'], 'none')],
        deps: [d('Client', 'Transfer proxy', 'transfer()', 'ok')],
      },
      {
        note: 'The call enters the outermost aspect first. Order is set with @Order (lower number is outer). Security should run first, so an unauthorised caller never opens a transaction.',
        boxes: [b('s', 'Security aspect', ['@Order(1)', 'check permission, else 403'], 'ok', 'outermost'), b('l', 'Logging aspect', ['@Order(2)'], 'none'), b('x', 'Transaction manager', ['@Order(3)'], 'none')],
        deps: [d('Security aspect', 'Logging aspect', 'proceed()', 'ok')],
      },
      {
        note: 'Each around advice calls proceed() to pass control inward. The logging aspect records the start time, the transaction advice begins the transaction, and only then does the target method run.',
        boxes: [b('l', 'Logging aspect', ['log start, start timer'], 'ok'), b('x', 'Transaction manager', ['begin transaction'], 'ok'), b('t', 'Transfer bean', ['target runs'], 'ok', 'innermost')],
        deps: [d('Logging aspect', 'Transaction manager', 'proceed()', 'ok'), d('Transaction manager', 'Transfer bean', 'proceed()', 'ok')],
      },
      {
        note: 'On the way out the order reverses: the transaction commits (or rolls back), then logging records the duration and outcome, then security returns the result. An exception thrown by the target travels back out through the same chain, so each aspect can react to it.',
        boxes: [b('x', 'Transaction manager', ['commit or rollback'], 'ok', '1st out'), b('l', 'Logging aspect', ['log duration and result or exception'], 'ok', '2nd out'), b('s', 'Security aspect', ['return result'], 'ok', '3rd out')],
        deps: [d('Transaction manager', 'Logging aspect', 'return', 'ok'), d('Logging aspect', 'Security aspect', 'return', 'ok')],
      },
    ],
  },
];
