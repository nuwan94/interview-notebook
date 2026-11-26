// Frame data for the Spring AOP and proxies walk-through, drawn by BoardStage (hand-placed cards and arrows).

import { BoardStage } from './BoardStage.jsx';

/* ---------- a call through a proxy ---------- */
const client = (o = {}) => ({ id: 'client', x: 14, y: 96, w: 150, title: 'Controller', lines: ['transfer(from, to, 250)'], tone: 'new', ...o });
const proxy = (lines, o = {}) => ({ id: 'proxy', x: 224, y: 86, w: 190, title: 'TransferService proxy', lines, tone: 'warn', badge: 'injected', ...o });
const target = (lines, o = {}) => ({ id: 'target', x: 474, y: 96, w: 152, title: 'TransferService', lines, tone: 'none', badge: 'target', badgeTone: 'none', ...o });
const tm = (lines, o = {}) => ({ id: 'tm', x: 224, y: 218, w: 190, title: 'TransactionManager', lines, tone: 'ok', ...o });

const proxyFrames = [
  {
    line: 'transferService.transfer(from, to, 250)',
    cards: [client(), proxy(['same methods as the bean', 'holds the target']), target(['the real object'])],
    arrows: [{ from: 'client', to: 'proxy', label: 'transfer()', tone: 'new' }],
    note: 'TransferService has @Transactional. At startup Spring did not put the plain object into the context. A post-processor wrapped it in a proxy. The controller was given the proxy, and the proxy holds a reference to the real bean, called the target.',
  },
  {
    line: '@Transactional  →  begin',
    cards: [client(), proxy(['advice: before the call', 'begin a transaction']), target(['the real object']), tm(['connection bound to the thread'], { badge: 'begin' })],
    arrows: [
      { from: 'client', to: 'proxy', label: 'transfer()', tone: 'new' },
      { from: 'proxy', to: 'tm', label: 'begin', fs: 'b', ts: 't' },
    ],
    note: 'The proxy catches the call. Before passing it on, it runs the transaction advice. The advice asks the transaction manager to begin a transaction and bind it to the current thread.',
  },
  {
    line: 'debit(from, 250); credit(to, 250);',
    cards: [client(), proxy(['proceed()', 'call the real method']), target(['debit(), credit()', 'business code only'], { tone: 'ok' }), tm(['transaction open'])],
    arrows: [
      { from: 'client', to: 'proxy', label: 'transfer()', tone: 'new' },
      { from: 'proxy', to: 'target', label: 'proceed()' },
    ],
    note: 'Then the proxy calls the real method on the target. Your code runs exactly as written. It contains no transaction code at all.',
  },
  {
    line: 'return  →  commit',
    result: { text: 'committed', tone: 'ok' },
    cards: [client({ tone: 'ok', lines: ['gets the result'] }), proxy(['advice: after the call', 'commit']), target(['returned normally'], { tone: 'ok' }), tm(['commit'], { badge: 'commit' })],
    arrows: [
      { from: 'proxy', to: 'tm', label: 'commit', fs: 'b', ts: 't' },
      { from: 'proxy', to: 'client', label: 'result', tone: 'ok' },
    ],
    note: 'The method returned normally, so the advice commits the transaction. If it had thrown a RuntimeException, the same advice would roll back instead. The concern lives in one place, not in every service method.',
  },
];

/* ---------- the self-invocation trap ---------- */
const proxyRegion = (x, title = 'proxy', tone = 'warn') => ({ x, y: 40, w: 250, h: 216, title, tone });
const realRegion = (x, title = 'real object') => ({ x: x + 14, y: 76, w: 222, h: 168, title, solid: true });
const process = (o = {}) => ({ id: 'process', x: 220, y: 116, w: 196, title: 'process()', lines: ['@Transactional'], tone: 'ok', ...o });
const audit = (o = {}) => ({ id: 'audit', x: 220, y: 186, w: 196, title: 'audit()', lines: ['@Transactional(REQUIRES_NEW)'], tone: 'none', ...o });
const ctrl = (o = {}) => ({ id: 'ctrl', x: 14, y: 110, w: 140, title: 'Controller', lines: ['process(t)'], tone: 'new', ...o });

const selfFrames = [
  {
    line: 'transferService.process(t)',
    regions: [proxyRegion(192, 'TransferService proxy'), realRegion(192)],
    cards: [ctrl(), process(), audit()],
    arrows: [{ from: 'ctrl', to: 'process', label: 'through the proxy', tone: 'new', ly: 30, lx: -8 }],
    note: 'The controller calls process(). It holds the proxy, so the call crosses the proxy and the transaction advice on process() runs. So far everything works.',
  },
  {
    line: 'this.audit(t)   // inside process()',
    result: { text: 'skips the proxy', tone: 'bad' },
    regions: [proxyRegion(192, 'TransferService proxy'), realRegion(192)],
    cards: [ctrl({ dim: true }), process({ tone: 'warn' }), audit({ tone: 'warn' })],
    arrows: [{ from: 'process', to: 'audit', label: 'this.audit()', tone: 'bad', fs: 'b', ts: 't', lx: 50, ly: 8 }],
    note: 'Inside process(), the code calls audit(). That call goes from the real object straight to itself. It never leaves the inner box, so it never passes through the proxy. "this" is the real object, not the proxy.',
  },
  {
    line: 'audit() ran without REQUIRES_NEW',
    result: { text: 'annotation ignored, no error', tone: 'bad' },
    regions: [proxyRegion(192, 'TransferService proxy'), realRegion(192)],
    cards: [ctrl({ dim: true }), process({ tone: 'warn' }), audit({ tone: 'bad', badge: 'advice skipped', lines: [{ t: '@Transactional(REQUIRES_NEW)', strike: true }] })],
    arrows: [{ from: 'process', to: 'audit', label: 'this.audit()', tone: 'bad', fs: 'b', ts: 't', lx: 50, ly: 8 }],
    note: 'So audit() runs inside the outer transaction, not its own. REQUIRES_NEW, @Async, @Cacheable or @PreAuthorize on it are silently ignored. Nothing fails, which is why this bug is easy to miss. Private methods and final methods behave the same way.',
  },
  {
    line: 'auditService.audit(t)   // a second bean',
    result: { text: 'works', tone: 'ok' },
    regions: [
      { x: 180, y: 40, w: 214, h: 216, title: 'TransferService proxy', tone: 'warn' },
      { x: 192, y: 76, w: 190, h: 168, title: 'real object', solid: true },
      { x: 412, y: 40, w: 220, h: 216, title: 'AuditService proxy', tone: 'warn' },
      { x: 424, y: 76, w: 196, h: 168, title: 'real object', solid: true },
    ],
    cards: [
      ctrl(),
      { id: 'process', x: 204, y: 120, w: 166, title: 'process()', lines: ['@Transactional'], tone: 'ok' },
      { id: 'audit2', x: 436, y: 150, w: 172, title: 'audit()', lines: ['REQUIRES_NEW'], tone: 'ok', badge: 'own transaction' },
    ],
    arrows: [
      { from: 'ctrl', to: 'process', tone: 'new' },
      { from: 'process', to: 'audit2', label: 'crosses a proxy', fs: 'r', ts: 'l', ly: -12 },
    ],
    note: 'The fix: move audit() into another bean and inject it. Now the call leaves TransferService and enters AuditService through its proxy, so the advice runs. Other options are injecting the bean into itself, AopContext.currentProxy(), or AspectJ weaving.',
  },
];

/* ---------- the advice chain ---------- */
const ring = (tone) => ({
  sec: { x: 176, y: 24, w: 450, h: 266, title: 'SecurityAspect  @Order(1)', tone: tone.sec || 'none' },
  log: { x: 194, y: 60, w: 414, h: 214, title: 'LoggingAspect  @Order(2)', tone: tone.log || 'none' },
  tx: { x: 212, y: 96, w: 378, h: 162, title: 'Transaction advice  @Order(3)', tone: tone.tx || 'none' },
});
const rings = (tone) => {
  const r = ring(tone);
  return [r.sec, r.log, r.tx];
};
const tgt = (o = {}) => ({ id: 'tgt', x: 316, y: 152, w: 172, title: 'transfer()', lines: ['business code only'], tone: 'none', ...o });
const caller = (o = {}) => ({ id: 'caller', x: 12, y: 132, w: 134, title: 'Controller', lines: ['transfer()'], tone: 'new', ...o });

const chainFrames = [
  {
    h: 300,
    line: 'transferService.transfer(...)',
    regions: rings({}),
    cards: [caller(), tgt()],
    note: 'Three concerns apply to transfer(): security, logging and the transaction. Each is an aspect. None of them is written inside the method. The proxy wraps them around the target like layers of an onion.',
  },
  {
    h: 300,
    line: '@PreAuthorize("hasRole(\'TELLER\')")',
    regions: rings({ sec: 'new' }),
    cards: [caller(), tgt()],
    texts: [{ x: 190, y: 62, t: '' }],
    arrows: [{ from: 'caller', to: 'tgt', label: '1. security check', tone: 'new', fs: 'r', ts: 'l', toff: -12 }],
    note: 'The call enters the outermost layer first. @Order sets the layers: a lower number is further out. Security runs first, so a caller without permission is rejected before any transaction is opened.',
  },
  {
    h: 300,
    line: 'log start  ·  begin transaction  ·  run transfer()',
    regions: rings({ sec: 'ok', log: 'new', tx: 'new' }),
    cards: [caller(), tgt({ tone: 'ok', badge: 'runs' })],
    arrows: [{ from: 'caller', to: 'tgt', label: '2. log, 3. begin', tone: 'new', fs: 'r', ts: 'l', toff: -12 }],
    note: 'Each around advice calls proceed() to pass control one layer inward. Logging starts a timer, the transaction advice begins a transaction, and only then does the target method run.',
  },
  {
    h: 300,
    line: 'commit  ·  log 42 ms  ·  return',
    result: { text: 'unwinds in reverse', tone: 'ok' },
    regions: rings({ sec: 'ok', log: 'ok', tx: 'ok' }),
    cards: [caller({ tone: 'ok', lines: ['gets the result'] }), tgt({ tone: 'ok' })],
    arrows: [{ from: 'tgt', to: 'caller', label: 'commit, log, return', tone: 'ok', fs: 'l', ts: 'r', fo: 14, toff: 14 }],
    note: 'On the way out the order reverses: the transaction commits (or rolls back), then logging records the time and the outcome, then security hands back the result. An exception travels out through the same layers, so each aspect can react to it.',
  },
];

export const SPRING_AOP_SCENES = [
  { id: 'proxy', label: 'Call through a proxy', title: 'The caller talks to a proxy, which adds behaviour around the real bean', stage: BoardStage, frames: proxyFrames },
  { id: 'self', label: 'Self-invocation trap', title: 'A call from inside the bean never leaves it, so it skips the proxy', stage: BoardStage, frames: selfFrames },
  { id: 'chain', label: 'Advice chain', title: 'Several aspects wrap one method in layers, in a set order', stage: BoardStage, frames: chainFrames },
];
