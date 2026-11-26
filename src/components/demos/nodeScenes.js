// Frame data for the "Node.js runtime" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

/* ---------- what Node is: the layers ---------- */
const js = (o = {}) => ({ id: 'js', x: 14, y: 40, w: 300, title: 'Your JavaScript', lines: ['server.js'], tone: 'none', ...o });
const v8 = (o = {}) => ({ id: 'v8', x: 14, y: 104, w: 300, title: 'V8 engine: one main thread', lines: ['compiles and runs JS, one call stack'], tone: 'none', ...o });
const core = (o = {}) => ({ id: 'core', x: 14, y: 168, w: 300, title: 'Node core modules + C++ bindings', lines: ['fs, http, net, crypto, stream'], tone: 'none', ...o });
const uv = (o = {}) => ({ id: 'uv', x: 14, y: 232, w: 300, title: 'libuv', lines: ['event loop, timers, async I/O'], tone: 'none', ...o });
const pool = (lines, o = {}) => ({ id: 'pool', x: 380, y: 40, w: 246, title: 'libuv thread pool (4)', lines, mono: true, tone: 'none', ...o });
const os = (lines, o = {}) => ({ id: 'os', x: 380, y: 232, w: 246, title: 'Operating system', lines, tone: 'none', ...o });
const IDLE_POOL = ['T1  idle', 'T2  idle', 'T3  idle', 'T4  idle'];

const X0 = 120;
let uid = 0;
// a thread-timeline bar factory: scale is px per ms
const timeline = (scale) => (y, t0, t1, title, tone = 'ok', o = {}) => ({ id: `b${uid++}`, x: X0 + t0 * scale, y, w: (t1 - t0) * scale, h: 30, title, tone, ...o });
const bar = timeline(0.24);
const wbar = timeline(0.26);
const lane = (y, t) => ({ x: 14, y: y + 20, t });

const runtimeFrames = [
  {
    h: 290,
    line: 'node server.js',
    result: { text: 'one JS thread', tone: 'ok' },
    cards: [js(), v8({ tone: 'new', badge: 'main thread' }), core(), uv(), pool(IDLE_POOL, { dim: true }), os(['epoll, kqueue, IOCP'], { dim: true })],
    note: 'Node.js is not a language or a framework. It is a runtime that runs JavaScript outside the browser. Your code runs on one main thread, in the V8 engine (the same engine as Chrome).',
  },
  {
    h: 290,
    line: 'await readFile("accounts.json")',
    result: { text: 'main thread stays free', tone: 'ok' },
    cards: [js({ tone: 'new' }), v8({ tone: 'ok' }), core({ tone: 'ok' }), uv({ tone: 'ok' }), pool(['T1  reading accounts.json', 'T2  idle', 'T3  idle', 'T4  idle'], { tone: 'new', badge: 'fs' }), os(['epoll, kqueue, IOCP'], { dim: true })],
    arrows: [{ from: 'js', to: 'v8', fs: 'b', ts: 't' }, { from: 'v8', to: 'core', fs: 'b', ts: 't' }, { from: 'core', to: 'uv', fs: 'b', ts: 't' }, { from: 'uv', to: 'pool', fs: 'r', ts: 'l', tone: 'new' }],
    note: 'readFile is not done by V8. Node passes it through its C++ bindings to libuv, a C library. The file system has no good async API in the OS, so libuv runs the read on one of its 4 pool threads. When it finishes, the callback is queued for the main thread.',
  },
  {
    h: 290,
    line: '10,000 sockets + 5 pbkdf2 calls',
    result: { text: '5th hash waits', tone: 'warn' },
    cards: [js(), v8({ tone: 'ok' }), core(), uv({ tone: 'ok' }), pool(['T1  pbkdf2', 'T2  pbkdf2', 'T3  pbkdf2', 'T4  pbkdf2', 'queue: pbkdf2 #5'], { tone: 'warn', badge: 'full' }), os(['epoll: 10,000 sockets', 'no thread per socket'], { tone: 'ok', badge: 'network' })],
    arrows: [{ from: 'uv', to: 'pool', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'uv', to: 'os', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Network I/O uses the OS readiness APIs (epoll, kqueue, IOCP), so one thread watches thousands of sockets. File system, dns.lookup, crypto and zlib use the pool. With 4 threads, a fifth crypto call waits in a queue.',
  },
  {
    h: 230,
    line: 'GET /report   // buildHugeReportSync()',
    result: { text: 'everyone waits', tone: 'bad' },
    texts: [lane(50, 'main thread'), lane(100, 'request B'), lane(150, 'request C'), { x: 560, y: 210, t: 'time  →' }],
    cards: [
      bar(50, 0, 1600, 'request A: CPU loop, 1600 ms', 'bad'),
      bar(100, 100, 1600, 'B waits for the thread', 'warn'),
      bar(100, 1600, 1800, 'B', 'ok'),
      bar(150, 300, 1800, 'C waits', 'warn'),
      bar(150, 1800, 2000, 'C', 'ok'),
    ],
    note: 'So Node is good at I/O and weak at CPU work. Waiting requests cost almost nothing. But a long loop or a huge JSON parse on the main thread blocks every other request, even health checks, until it ends.',
  },
];

/* ---------- event loop phases ---------- */
const PHASES = ['timers', 'pending', 'poll', 'check', 'close'];
const q = (id, x, y, title, lines, o = {}) => ({ id, x, y, w: 196, title, lines, mono: true, tone: 'none', ...o });
const out = (lines, o = {}) => ({ id: 'out', x: 446, y: 40, w: 180, title: 'console output', lines, mono: true, tone: 'ok', ...o });
const MICRO = { x: 14, y: 26, w: 216, h: 168, title: 'between every callback' };

const loopFrames = [
  {
    h: 290,
    line: 'setTimeout · setImmediate · then · nextTick · log',
    result: { text: 'main script runs first', tone: 'ok' },
    regions: [MICRO],
    cards: [
      q('nt', 24, 60, 'process.nextTick', ['nextTick']),
      q('pr', 24, 126, 'promise microtasks', ['promise']),
      q('tm', 244, 60, 'timers queue', ['timeout']),
      q('ck', 244, 126, 'check queue', ['immediate']),
      out(['sync']),
    ],
    steps: { items: PHASES, at: -1 },
    note: 'The script schedules four callbacks, then logs "sync". Synchronous code always runs to the end first. Each callback waits in its own queue.',
  },
  {
    h: 290,
    line: 'stack empty: drain nextTick, then promises',
    result: { text: 'nextTick before promise', tone: 'ok' },
    regions: [MICRO],
    cards: [
      q('nt', 24, 60, 'process.nextTick', [{ t: 'nextTick', strike: true }], { tone: 'new', badge: '1st' }),
      q('pr', 24, 126, 'promise microtasks', [{ t: 'promise', strike: true }], { tone: 'new', badge: '2nd' }),
      q('tm', 244, 60, 'timers queue', ['timeout']),
      q('ck', 244, 126, 'check queue', ['immediate']),
      out(['sync', 'nextTick', 'promise']),
    ],
    steps: { items: PHASES, at: -1 },
    note: 'Before the loop moves on, Node empties the process.nextTick queue, then the promise microtasks (.then, await). It does this after every callback. A recursive nextTick would never let the loop move on.',
  },
  {
    h: 290,
    line: 'loop: timers phase, then check phase',
    result: { text: 'order not guaranteed here', tone: 'warn' },
    regions: [MICRO],
    cards: [
      q('nt', 24, 60, 'process.nextTick', ['(empty)'], { dim: true }),
      q('pr', 24, 126, 'promise microtasks', ['(empty)'], { dim: true }),
      q('tm', 244, 60, 'timers queue', [{ t: 'timeout', strike: true }], { tone: 'ok' }),
      q('ck', 244, 126, 'check queue', [{ t: 'immediate', strike: true }], { tone: 'ok' }),
      out(['sync', 'nextTick', 'promise', 'timeout', 'immediate']),
    ],
    steps: { items: PHASES, at: 3 },
    note: 'The loop runs its phases in order: timers (setTimeout), pending, poll (I/O), check (setImmediate), close. From the main module, setTimeout(0) and setImmediate can come in either order, depending on how fast the process started.',
  },
  {
    h: 290,
    line: 'inside a readFile callback',
    result: { text: 'setImmediate always first', tone: 'ok' },
    regions: [MICRO],
    cards: [
      q('nt', 24, 60, 'process.nextTick', ['(empty)'], { dim: true }),
      q('pr', 24, 126, 'promise microtasks', ['(empty)'], { dim: true }),
      q('tm', 244, 60, 'timers queue', ['timeout'], { tone: 'warn', badge: 'next loop' }),
      q('ck', 244, 126, 'check queue', [{ t: 'immediate', strike: true }], { tone: 'ok', badge: 'now' }),
      out(['immediate', 'timeout']),
    ],
    steps: { items: PHASES, at: 3 },
    note: 'Inside an I/O callback, the loop is in the poll phase. Check comes right after poll, so setImmediate runs before setTimeout(0), every time. Use setImmediate to run code after the current I/O events.',
  },
];

/* ---------- streams and backpressure ---------- */
const file = (o = {}) => ({ id: 'file', x: 14, y: 60, w: 150, title: 'export.csv', lines: ['2 GB on disk'], tone: 'none', ...o });
const res = (lines, o = {}) => ({ id: 'res', x: 476, y: 60, w: 150, title: 'HTTP response', lines, tone: 'none', ...o });

const streamFrames = [
  {
    h: 230,
    line: 'res.send(await readFile("export.csv"))',
    result: { text: '10 requests = 20 GB', tone: 'bad' },
    cards: [file(), { id: 'mem', x: 230, y: 52, w: 180, title: 'process memory', lines: ['whole file: 2 GB', 'per request'], tone: 'bad', badge: 'heap' }, res(['nothing sent until', 'the read ends'], { dim: true })],
    arrows: [{ from: 'file', to: 'mem', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'mem', to: 'res', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'readFile loads the whole file into memory before responding. A 2 GB statement export uses 2 GB per request. Ten requests at once crash the server.',
  },
  {
    h: 230,
    line: 'pipeline(createReadStream(file), res)',
    result: { text: 'memory stays at 64 KB', tone: 'ok' },
    cards: [file({ tone: 'ok' }), { id: 'c1', x: 230, y: 64, w: 56, h: 34, title: '64K', mono: true, tone: 'new' }, { id: 'c2', x: 292, y: 64, w: 56, h: 34, title: '64K', mono: true, tone: 'new' }, { id: 'c3', x: 354, y: 64, w: 56, h: 34, title: '64K', mono: true, tone: 'new' }, res(['first bytes at once', 'chunk by chunk'], { tone: 'ok' })],
    arrows: [{ from: 'file', to: 'c1', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'c3', to: 'res', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A stream reads and sends the data in small chunks. Memory stays flat whatever the file size, and the client gets the first bytes immediately.',
  },
  {
    h: 230,
    line: 'pipeline(read, parseRows, gzip, res)',
    result: { text: 'one chunk at a time', tone: 'ok' },
    cards: [
      { id: 'r', x: 14, y: 60, w: 130, title: 'Readable', lines: ['file'], tone: 'ok' },
      { id: 't1', x: 174, y: 60, w: 130, title: 'Transform', lines: ['parse rows'], tone: 'new' },
      { id: 't2', x: 334, y: 60, w: 130, title: 'Transform', lines: ['gzip'], tone: 'new' },
      { id: 'w', x: 496, y: 60, w: 130, title: 'Writable', lines: ['response'], tone: 'ok' },
    ],
    arrows: [{ from: 'r', to: 't1', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't1', to: 't2', fs: 'r', ts: 'l', tone: 'ok' }, { from: 't2', to: 'w', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Streams connect into a pipeline: a readable source, optional transforms, and a writable destination. Here: read a CSV, parse each row, compress, and write to the response.',
  },
  {
    h: 230,
    line: 'slow client: res.write() returns false',
    result: { text: 'source paused until drain', tone: 'warn' },
    cards: [
      file({ tone: 'warn', badge: 'paused' }),
      { id: 'buf', x: 230, y: 52, w: 180, title: 'write buffer', lines: ['highWaterMark: full', 'write() → false'], tone: 'warn', badge: 'full' },
      res(['slow mobile client'], { tone: 'warn' }),
    ],
    arrows: [{ from: 'buf', to: 'res', fs: 'r', ts: 'l', tone: 'warn', dash: true }, { from: 'buf', to: 'file', fs: 'l', ts: 'r', tone: 'warn', label: 'pause' }],
    texts: [{ x: 230, y: 160, t: '"drain" event  →  the source resumes' }],
    note: 'The client reads slower than the disk. Without control, chunks pile up in memory. With backpressure, write() returns false when the buffer is full, and the source pauses until "drain". stream.pipeline does this, and cleans up on error.',
  },
];

/* ---------- scaling and shutdown ---------- */
const cores = (busy, o = {}) => Array.from({ length: 8 }, (_, i) => ({ id: `core${i}`, x: 14 + i * 78, y: 160, w: 70, h: 34, title: `cpu ${i + 1}`, mono: true, tone: i < busy ? 'ok' : 'none', dim: i >= busy, ...o }));
const SHUT = ['SIGTERM', 'not ready', 'close()', 'drain', 'pool.end()', 'exit 0'];

const scaleFrames = [
  {
    h: 250,
    line: 'node server.js   // on an 8-core machine',
    result: { text: '1 of 8 cores used', tone: 'warn' },
    cards: [{ id: 'p1', x: 14, y: 52, w: 200, title: 'node process', lines: ['one JS thread'], tone: 'ok' }, ...cores(1)],
    arrows: [{ from: 'p1', to: 'core0', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'One Node process runs JavaScript on one core. On an eight-core machine, seven cores sit idle for your JavaScript.',
  },
  {
    h: 250,
    line: 'replicas: 4   // or the cluster module',
    result: { text: '4 processes, 4 cores', tone: 'ok' },
    cards: [{ id: 'lb', x: 214, y: 30, w: 212, title: 'load balancer', lines: ['spreads requests'], tone: 'new' }, ...cores(4)],
    arrows: [0, 1, 2, 3].map((i) => ({ from: 'lb', to: `core${i}`, fs: 'b', ts: 't', tone: 'ok' })),
    note: 'Run several processes behind a load balancer. In containers, run one process per container and scale the containers. Or use the cluster module: a primary forks workers that share one port. Processes share nothing, so sessions and caches live in a shared store such as Redis.',
  },
  {
    h: 230,
    line: 'pool.run(hashJob)   // worker_threads',
    result: { text: 'main thread stays free', tone: 'ok' },
    texts: [lane(50, 'main thread'), lane(110, 'worker thread'), { x: 560, y: 210, t: 'time  →' }],
    cards: [
      wbar(50, 0, 250, 'req A', 'ok'),
      wbar(50, 270, 520, 'req B', 'ok'),
      wbar(50, 540, 790, 'req C', 'ok'),
      wbar(50, 1640, 1900, 'reply A', 'new'),
      wbar(110, 250, 1640, 'hashing for request A (CPU)', 'warn'),
    ],
    note: 'For CPU-heavy work inside a service, worker_threads runs JavaScript on another thread, with its own event loop and memory. The main thread posts a message and keeps serving requests. The result comes back as a message.',
  },
  {
    h: 250,
    line: 'kubectl rollout   // sends SIGTERM',
    result: { text: 'no request lost', tone: 'ok' },
    cards: [
      { id: 'k8s', x: 14, y: 40, w: 180, title: 'Kubernetes', lines: ['SIGTERM, then', 'SIGKILL after 30 s'], tone: 'warn' },
      { id: 'srv', x: 236, y: 40, w: 200, title: 'process.on("SIGTERM")', lines: ['readiness → 503', 'server.close()', 'await pool.end()'], tone: 'new', mono: true },
      { id: 'ex', x: 476, y: 40, w: 150, title: 'process.exit(0)', lines: ['in-flight done'], tone: 'ok' },
    ],
    arrows: [{ from: 'k8s', to: 'srv', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'srv', to: 'ex', fs: 'r', ts: 'l', tone: 'ok' }],
    steps: { items: SHUT, at: 5 },
    note: 'An orchestrator stops a service with SIGTERM, and kills it with SIGKILL after a grace period. A good server fails readiness, stops new connections, lets in-flight requests finish, closes the database pool, then exits.',
  },
];

export const NODE_SCENES = [
  { id: 'runtime', label: 'What Node.js is', title: 'V8, libuv and the thread pool', stage: BoardStage, frames: runtimeFrames },
  { id: 'loop', label: 'The event loop phases', title: 'Queues and phases decide the order', stage: BoardStage, frames: loopFrames },
  { id: 'streams', label: 'Streams and backpressure', title: 'Process data in chunks', stage: BoardStage, frames: streamFrames },
  { id: 'scale', label: 'Scaling and shutdown', title: 'Use all cores, stop gracefully', stage: BoardStage, frames: scaleFrames },
];
