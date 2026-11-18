// Frame data for the "Node.js runtime" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const NODE_SCENES = [
  {
    id: 'runtime',
    label: 'What Node.js is',
    title: 'V8, libuv and the thread pool',
    frames: [
      {
        note: 'Node.js is not a language or a framework. It is a runtime that runs JavaScript outside the browser. Your code runs on one main thread in the V8 engine, the same engine as Chrome, which compiles JavaScript to machine code.',
        boxes: [b('a', 'Your JavaScript', ['server.js'], 'none'), b('v', 'V8 engine', ['compiles and runs JS'], 'new'), b('m', 'Main thread', ['one call stack'], 'ok')],
        deps: [d('Your JavaScript', 'V8 engine', 'runs on', 'ok'), d('V8 engine', 'Main thread', 'executes on', 'ok')],
      },
      {
        note: 'When your code calls fs.readFile or a network function, V8 does not do the work. Node passes it through its C++ bindings to libuv, a C library that provides the event loop, sockets, timers and the file system access that works the same on Linux, macOS and Windows.',
        boxes: [b('j', 'fs.readFile(...)', ['JavaScript call'], 'none'), b('n', 'Node C++ bindings', ['bridge to the system'], 'ok'), b('l', 'libuv', ['event loop + I/O'], 'new')],
        deps: [d('fs.readFile(...)', 'Node C++ bindings', 'calls', 'ok'), d('Node C++ bindings', 'libuv', 'hands over', 'ok')],
      },
      {
        note: 'libuv does network I/O with the operating system readiness APIs (epoll, kqueue, IOCP), so one thread watches thousands of sockets. File system, DNS, crypto and zlib calls have no such API, so libuv runs them on a pool of 4 worker threads and returns the result to the main thread.',
        boxes: [b('s', 'Sockets', ['OS notifies when ready'], 'ok'), b('t', 'libuv thread pool', ['4 threads: fs, dns, crypto'], 'new'), b('c', 'Callback queued', ['result goes to the loop'], 'ok')],
        deps: [d('Sockets', 'Callback queued', 'no extra threads', 'ok'), d('libuv thread pool', 'Callback queued', 'when finished', 'ok')],
      },
      {
        note: 'That is why Node is good at I/O-heavy work and weak at CPU-heavy work. Many waiting requests cost almost nothing. But a long loop or a big JSON parse on the main thread blocks every other request until it ends.',
        boxes: [b('i', 'Many waiting requests', ['10,000 open sockets'], 'ok'), b('x', 'CPU-heavy loop', ['holds the main thread'], 'bad'), b('o', 'All other requests wait', ['no one is served'], 'bad')],
        deps: [d('CPU-heavy loop', 'All other requests wait', 'blocks', 'bad')],
      },
    ],
  },
  {
    id: 'loop',
    label: 'The event loop phases',
    title: 'Timers, poll, check, close',
    frames: [
      {
        note: 'The Node event loop runs in phases, in a fixed order. Timers runs due setTimeout and setInterval callbacks. Pending callbacks runs some system callbacks. Poll waits for new I/O events and runs their callbacks. Check runs setImmediate callbacks. Close runs close events such as socket.on("close").',
        boxes: [b('t', 'Timers phase', ['setTimeout, setInterval'], 'new'), b('p', 'Poll phase', ['I/O callbacks'], 'ok'), b('c', 'Check phase', ['setImmediate'], 'new')],
        deps: [d('Timers phase', 'Poll phase', 'then', 'ok'), d('Poll phase', 'Check phase', 'then', 'ok')],
      },
      {
        note: 'Between each callback, Node empties two queues. First process.nextTick callbacks, then promise microtasks. So an await continuation or a .then runs before the loop moves on, and nextTick runs even before promises. A recursive nextTick can starve the loop.',
        boxes: [b('c', 'One callback ends', ['any phase'], 'none'), b('n', 'process.nextTick queue', ['runs first'], 'warn'), b('m', 'Promise microtasks', ['then, await'], 'ok')],
        deps: [d('One callback ends', 'process.nextTick queue', 'drain', 'warn'), d('process.nextTick queue', 'Promise microtasks', 'then drain', 'ok')],
      },
      {
        note: 'Inside an I/O callback, setImmediate always runs before setTimeout(0), because the check phase comes right after poll. From the main module the order depends on process speed and is not guaranteed. Use setImmediate to run code after the current I/O events.',
        boxes: [b('r', 'Inside readFile callback', ['poll phase'], 'ok'), b('s', 'setImmediate', ['check phase, next'], 'ok'), b('o', 'setTimeout 0', ['next loop, timers'], 'warn')],
        deps: [d('Inside readFile callback', 'setImmediate', 'runs first', 'ok'), d('Inside readFile callback', 'setTimeout 0', 'runs second', 'warn')],
      },
    ],
  },
  {
    id: 'streams',
    label: 'Streams and backpressure',
    title: 'Process data in chunks',
    frames: [
      {
        note: 'readFile loads the whole file into memory before responding. A 2 GB statement export would use 2 GB of memory per request, and ten requests would crash the server. A stream reads and sends the data in small chunks, so memory stays flat whatever the size.',
        boxes: [b('f', 'readFile, whole file', ['2 GB in memory'], 'bad'), b('s', 'createReadStream', ['64 KB chunks'], 'ok'), b('r', 'HTTP response', ['receives chunk by chunk'], 'ok')],
        deps: [d('createReadStream', 'HTTP response', 'pipe', 'ok')],
      },
      {
        note: 'Streams connect into a pipeline: a readable source, optional transforms, and a writable destination. For example read a CSV file, parse each row, convert it, and write the result as compressed output. Each step handles one chunk at a time.',
        boxes: [b('a', 'Readable: file', ['source of chunks'], 'ok'), b('t', 'Transform: parse rows', ['change each chunk'], 'new'), b('g', 'Transform: gzip', ['compress'], 'new'), b('w', 'Writable: response', ['destination'], 'ok')],
        deps: [d('Readable: file', 'Transform: parse rows', 'chunks', 'ok'), d('Transform: parse rows', 'Transform: gzip', 'chunks', 'ok'), d('Transform: gzip', 'Writable: response', 'chunks', 'ok')],
      },
      {
        note: 'A slow client reads slower than the file is read. Without control, chunks pile up in memory. Backpressure fixes this: when the destination buffer is full, write returns false and the source pauses until the drain event. stream.pipeline handles this and cleans up on error.',
        boxes: [b('s', 'Fast source', ['reads quickly'], 'ok'), b('b', 'Full buffer', ['write returns false'], 'warn'), b('p', 'Source pauses', ['resumes on drain'], 'ok')],
        deps: [d('Fast source', 'Full buffer', 'fills', 'warn'), d('Full buffer', 'Source pauses', 'backpressure', 'ok')],
      },
    ],
  },
  {
    id: 'scale',
    label: 'Scaling and shutdown',
    title: 'Use all cores, stop gracefully',
    frames: [
      {
        note: 'One Node process uses one core for JavaScript. To use an eight-core machine, run several processes behind a load balancer, or use the cluster module, where a primary process forks workers that share one port. In containers, run one process per container and scale the containers.',
        boxes: [b('l', 'Load balancer', ['spreads requests'], 'new'), b('a', 'Worker process 1', ['one core'], 'ok'), b('b', 'Worker process 2', ['one core'], 'ok')],
        deps: [d('Load balancer', 'Worker process 1', 'requests', 'ok'), d('Load balancer', 'Worker process 2', 'requests', 'ok')],
      },
      {
        note: 'For CPU-heavy work inside a process, worker_threads runs JavaScript on another thread with its own event loop and memory. The main thread sends a message and receives the result, so the loop stays free to serve requests. Child processes run a separate program.',
        boxes: [b('m', 'Main thread', ['serves requests'], 'ok'), b('w', 'Worker thread', ['hashing, parsing, images'], 'new'), b('r', 'Result message', ['posted back'], 'ok')],
        deps: [d('Main thread', 'Worker thread', 'postMessage', 'ok'), d('Worker thread', 'Result message', 'sends', 'ok')],
      },
      {
        note: 'An orchestrator stops a service by sending SIGTERM. A good server handles it: stop accepting new connections, finish the requests in flight, close the database pool, then exit. If it ignores the signal, the orchestrator kills it with SIGKILL and requests are lost.',
        boxes: [b('s', 'SIGTERM received', ['deploy or scale down'], 'warn'), b('c', 'server.close()', ['stop new connections'], 'new'), b('d', 'Drain and exit', ['finish, close pool, exit 0'], 'ok')],
        deps: [d('SIGTERM received', 'server.close()', 'handler runs', 'ok'), d('server.close()', 'Drain and exit', 'then', 'ok')],
      },
    ],
  },
];
