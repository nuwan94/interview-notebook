// Frame data for the reactive and virtual threads walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_REACTIVE_SCENES = [
  {
    id: 'blocking',
    label: 'Thread per request',
    title: 'Classic Spring MVC: one platform thread is held for the whole request',
    frames: [
      {
        note: 'Spring MVC on Tomcat assigns one request thread from a pool (200 by default) to each request. The thread runs your controller from start to finish.',
        boxes: [b('c1', 'Client A', ['request 1'], 'new'), b('c2', 'Client B', ['request 2'], 'new'), b('t1', 'Request thread 1', ['serves client A'], 'ok'), b('t2', 'Request thread 2', ['serves client B'], 'ok')],
        deps: [d('Client A', 'Request thread 1', 'assigned', 'ok'), d('Client B', 'Request thread 2', 'assigned', 'ok')],
      },
      {
        note: 'Each request calls a slow downstream service and waits 500 ms for the answer. The thread is blocked: it does nothing but wait, yet it cannot serve anyone else, and it occupies memory (about 1 MB of stack).',
        boxes: [b('t1', 'Request thread 1', ['blocked waiting 500 ms'], 'warn', 'idle but held'), b('t2', 'Request thread 2', ['blocked waiting 500 ms'], 'warn', 'idle but held'), b('s', 'Ledger service', ['slow'], 'warn')],
        deps: [d('Request thread 1', 'Ledger service', 'wait', 'warn'), d('Request thread 2', 'Ledger service', 'wait', 'warn')],
      },
      {
        note: 'Under load all 200 threads end up waiting on the slow service. New requests queue up and time out even though the CPU is nearly idle: the thread pool, not the hardware, is the limit. Timeouts, bulkheads and larger pools only move the problem.',
        boxes: [b('t1', 'Request thread pool', ['200 of 200 threads blocked'], 'bad', 'exhausted'), b('c3', 'Client C', ['request waits, then times out'], 'bad')],
        deps: [d('Client C', 'Request thread pool', 'no free thread', 'bad')],
      },
    ],
  },
  {
    id: 'reactive',
    label: 'Event loop (WebFlux)',
    title: 'WebFlux: a few event-loop threads handle many requests by never waiting',
    frames: [
      {
        note: 'WebFlux runs on Netty with a small number of event-loop threads (about one per CPU core). A handler returns a Mono or Flux, a description of work to do later, instead of the result.',
        boxes: [b('c1', 'Client A', ['request 1'], 'new'), b('c2', 'Client B', ['request 2'], 'new'), b('e', 'Event loop', ['4 threads for everything'], 'ok')],
        deps: [d('Client A', 'Event loop', 'request', 'ok'), d('Client B', 'Event loop', 'request', 'ok')],
      },
      {
        note: 'When the handler calls the downstream service with the non-blocking WebClient, it registers a callback and returns immediately. The event-loop thread is free at once and starts handling client B. Nothing waits.',
        boxes: [b('e', 'Event loop', ['sends request for A', 'moves on to B'], 'ok', 'not blocked'), b('s', 'Ledger service', ['responds in 500 ms'], 'warn')],
        deps: [d('Event loop', 'Ledger service', 'non-blocking call', 'ok')],
      },
      {
        note: 'When the downstream response arrives, the event loop picks it up, runs the next step of the pipeline (map, flatMap) and writes the response to client A. Four threads can keep thousands of requests in flight because they are only used while there is actual work to do.',
        boxes: [b('s', 'Ledger service', ['response for A'], 'ok'), b('e', 'Event loop', ['continues the pipeline for A'], 'ok'), b('c1', 'Client A', ['200 OK'], 'ok')],
        deps: [d('Ledger service', 'Event loop', 'callback', 'ok'), d('Event loop', 'Client A', 'response', 'ok')],
      },
      {
        note: 'The rule: never block an event-loop thread. One Thread.sleep, JDBC call or blocking HTTP call stalls all the requests sharing that thread. Everything on the path (database driver such as R2DBC, HTTP client, security) must be non-blocking, and stack traces and debugging are harder.',
        boxes: [b('e', 'Event loop', ['a blocking JDBC call here', 'stalls every request on the thread'], 'bad', 'never block'), b('d', 'Database', ['blocking driver'], 'warn')],
        deps: [d('Event loop', 'Database', 'blocking call', 'bad')],
      },
    ],
  },
  {
    id: 'virtual',
    label: 'Virtual threads',
    title: 'Virtual threads keep the simple blocking style but make waiting cheap',
    frames: [
      {
        note: 'Java 21 virtual threads are lightweight threads managed by the JVM, not the operating system. With spring.threads.virtual.enabled=true, Spring Boot 3.2 and later runs each request on a new virtual thread instead of a pooled platform thread.',
        boxes: [b('c1', 'Client A', ['request'], 'new'), b('v', 'Virtual thread', ['one per request', 'a few KB each, millions possible'], 'ok', 'cheap')],
        deps: [d('Client A', 'Virtual thread', 'assigned', 'ok')],
      },
      {
        note: 'Your code is still plain blocking code: restClient.get() waits for the answer. When a virtual thread blocks on I/O, the JVM unmounts it from its carrier (platform) thread, and the carrier immediately runs another virtual thread. Waiting no longer wastes an expensive thread.',
        boxes: [b('v', 'Virtual thread', ['blocked on I/O: unmounted'], 'ok', 'parked'), b('p', 'Platform thread', ['carrier: runs other virtual threads'], 'ok', 'still busy')],
        deps: [d('Virtual thread', 'Platform thread', 'unmount while waiting', 'ok')],
      },
      {
        note: 'You get most of the scalability of the reactive model with ordinary imperative code, normal stack traces and the existing blocking libraries (JDBC, JPA). The limits are now the downstream resources: the database connection pool and the services you call still need bulkheads, timeouts and limits.',
        boxes: [b('v', 'Virtual thread', ['10,000 concurrent requests'], 'ok'), b('d', 'Database', ['connection pool: 20', 'the real limit now'], 'warn', 'size the pool')],
        deps: [d('Virtual thread', 'Database', 'wait for a connection', 'warn')],
      },
      {
        note: 'Watch for pinning: a virtual thread inside a synchronized block (Java 21) or a native call keeps its carrier thread while blocked. Prefer ReentrantLock in hot paths, and avoid ThreadLocal-heavy designs and unbounded per-thread state. Choose WebFlux for streaming, backpressure and very high fan-out; choose virtual threads for the typical blocking CRUD service.',
        boxes: [b('v', 'Virtual thread', ['blocked inside synchronized (Java 21)'], 'warn', 'pinned'), b('p', 'Platform thread', ['held, cannot run others'], 'warn')],
        deps: [d('Virtual thread', 'Platform thread', 'pinned to carrier', 'warn')],
      },
    ],
  },
];
