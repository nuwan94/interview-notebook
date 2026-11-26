// Frame data for the reactive and virtual threads walk-through, drawn by BoardStage as thread timelines:
// each lane is a thread, time runs left to right, and each bar is what the thread is doing.

import { BoardStage } from './BoardStage.jsx';

const X0 = 120;
const SCALE = 0.75; // px per ms
const tx = (ms) => X0 + ms * SCALE;
let uid = 0;
const bar = (laneY, t0, t1, title, tone = 'ok', o = {}) => ({ id: `b${uid++}`, x: tx(t0), y: laneY, w: (t1 - t0) * SCALE, h: 30, title, tone, ...o });
const wait = (laneY, t0, t1, title, tone = 'none') => ({ x: tx(t0), y: laneY, w: (t1 - t0) * SCALE, h: 30, title, tone });
const lane = (y, t) => ({ x: 14, y: y + 20, t });
const timeArrow = (y) => ({ x: 540, y, t: 'time  →' });

/* ---------- thread per request ---------- */
const L1 = 40, L2 = 86, L3 = 132;
const blockingLanes = [lane(L1, 'thread 1'), lane(L2, 'thread 2'), lane(L3, 'thread 3')];

const blockingFrames = [
  {
    h: 210,
    line: 'Tomcat: one pooled thread per request',
    texts: [...blockingLanes, timeArrow(186)],
    cards: [bar(L1, 0, 40, 'A', 'new'), bar(L2, 20, 60, 'B', 'new'), bar(L3, 40, 80, 'C', 'new')],
    note: 'Spring MVC on Tomcat gives each request its own thread from a pool (200 by default). The thread runs your controller from start to finish. Here three requests, A, B and C, start on three threads.',
  },
  {
    h: 210,
    line: 'ledgerClient.balance(id)   // waits 500 ms',
    result: { text: 'threads held, CPU idle', tone: 'warn' },
    texts: [...blockingLanes, timeArrow(186)],
    cards: [
      bar(L1, 0, 40, 'A', 'new'), bar(L1, 40, 540, 'A waits for the ledger service', 'warn'), bar(L1, 540, 580, 'A', 'ok'),
      bar(L2, 20, 60, 'B', 'new'), bar(L2, 60, 560, 'B waits', 'warn'), bar(L2, 560, 600, 'B', 'ok'),
      bar(L3, 40, 80, 'C', 'new'), bar(L3, 80, 580, 'C waits', 'warn'), bar(L3, 580, 620, 'C', 'ok'),
    ],
    note: 'Each request calls a slow service and waits 500 ms for the answer. Look at the bars: almost all of each thread\'s time is orange waiting. The thread does nothing, but it cannot serve anyone else, and it still holds about 1 MB of stack.',
  },
  {
    h: 250,
    line: '200 of 200 threads blocked',
    result: { text: 'pool exhausted', tone: 'bad' },
    texts: [lane(L1, 'thread 1'), lane(L2, 'thread 2'), { x: 14, y: L3 - 4, t: '…' }, lane(L3, 'thread 200'), timeArrow(226)],
    cards: [
      bar(L1, 0, 620, 'waiting', 'warn'), bar(L2, 0, 620, 'waiting', 'warn'), bar(L3, 0, 620, 'waiting', 'warn'),
      { id: 'd', x: X0, y: 178, w: 300, title: 'Request D', lines: ['no free thread: queues, then times out'], tone: 'bad' },
    ],
    note: 'Under load all 200 threads end up waiting on the slow service. New requests queue and time out, even though the CPU is almost idle. The thread pool, not the hardware, is the limit. Bigger pools only move the problem.',
  },
];

/* ---------- event loop (WebFlux) ---------- */
const EL = 40;
const W1 = 92, W2 = 128, W3 = 164;
const loopLanes = (extra = []) => [lane(EL, 'event loop'), ...extra, timeArrow(220)];
const firstSteps = () => [bar(EL, 0, 40, 'A', 'new'), bar(EL, 40, 80, 'B', 'new'), bar(EL, 80, 120, 'C', 'new')];

const reactiveFrames = [
  {
    h: 240,
    line: 'return webClient.get()...bodyToMono(Balance.class);',
    texts: loopLanes(),
    cards: firstSteps(),
    note: 'WebFlux runs on Netty with a few event-loop threads, about one per CPU core. One is shown here. Each handler returns a Mono or Flux: a description of work, not the result. The loop runs the first step of A, then B, then C, one after another.',
  },
  {
    h: 240,
    line: 'non-blocking call: register a callback, return at once',
    result: { text: 'no thread waits', tone: 'ok' },
    texts: loopLanes([{ x: 14, y: W1 + 20, t: 'in flight' }]),
    regions: [wait(W1, 40, 540, 'A: waiting, no thread held'), wait(W2, 80, 580, 'B: waiting'), wait(W3, 120, 620, 'C: waiting')],
    cards: firstSteps(),
    note: 'Each first step sends its request with the non-blocking WebClient and registers a callback. The loop is free at once and moves on. The three waits still happen, but in the dashed boxes: no thread is held while they wait.',
  },
  {
    h: 240,
    line: 'response arrives  →  .map(...)  →  write 200 OK',
    result: { text: 'few threads, many requests', tone: 'ok' },
    texts: loopLanes([{ x: 14, y: W1 + 20, t: 'in flight' }]),
    regions: [wait(W1, 40, 540, 'A: waiting'), wait(W2, 80, 580, 'B: waiting'), wait(W3, 120, 620, 'C: waiting')],
    cards: [...firstSteps(), bar(EL, 540, 580, 'A', 'ok'), bar(EL, 580, 620, 'B', 'ok'), bar(EL, 620, 660, 'C', 'ok')],
    note: 'When a response arrives, the loop runs the next step of that pipeline (map, flatMap) and writes the answer. A thread is used only while there is real work. That is how four threads keep thousands of requests in flight.',
  },
  {
    h: 240,
    line: 'jdbcTemplate.query(...)   // blocks the loop',
    result: { text: 'everything stalls', tone: 'bad' },
    texts: loopLanes(),
    cards: [bar(EL, 0, 40, 'A', 'new'), bar(EL, 40, 540, 'A blocks the loop with a JDBC call', 'bad'), bar(EL, 540, 580, 'B', 'warn'), bar(EL, 580, 620, 'C', 'warn')],
    note: 'The rule: never block an event-loop thread. One JDBC call, Thread.sleep or blocking HTTP call holds the loop, and every request sharing it waits. Everything on the path must be non-blocking: R2DBC instead of JDBC, WebClient instead of RestTemplate.',
  },
];

/* ---------- virtual threads ---------- */
const C1 = 40, C2 = 86, P = 140;
const carrierLanes = (extra = []) => [lane(C1, 'carrier 1'), lane(C2, 'carrier 2'), ...extra, timeArrow(206)];

const virtualFrames = [
  {
    h: 226,
    line: 'spring.threads.virtual.enabled=true',
    texts: carrierLanes(),
    cards: [bar(C1, 0, 40, 'V1', 'new'), bar(C2, 0, 40, 'V2', 'new'), bar(C1, 40, 80, 'V3', 'new'), bar(C2, 40, 80, 'V4', 'new')],
    note: 'Java 21 virtual threads are cheap threads managed by the JVM. With this property, Spring Boot 3.2+ runs each request on a new virtual thread. The JVM runs virtual threads on a few real platform threads, called carriers.',
  },
  {
    h: 226,
    line: 'restClient.get()...   // plain blocking code',
    result: { text: 'waiting is cheap', tone: 'ok' },
    texts: carrierLanes([{ x: 14, y: P + 20, t: 'parked' }]),
    regions: [wait(P, 40, 540, 'V1 parked: blocked on I/O, no carrier held')],
    cards: [
      bar(C1, 0, 40, 'V1', 'new'), bar(C1, 40, 80, 'V3', 'ok'), bar(C1, 80, 120, 'V5', 'ok'), bar(C1, 120, 160, 'V7', 'ok'), bar(C1, 540, 580, 'V1', 'new'),
      bar(C2, 0, 40, 'V2', 'ok'), bar(C2, 40, 80, 'V4', 'ok'), bar(C2, 80, 120, 'V6', 'ok'),
    ],
    note: 'Your code still blocks: it waits for the answer. But when V1 blocks on I/O, the JVM parks it and frees its carrier, which runs other virtual threads at once. When the answer arrives, V1 continues on any carrier. You get reactive-like scaling with ordinary code.',
  },
  {
    h: 226,
    line: '10,000 threads  →  20 connections',
    result: { text: 'the pool is the limit now', tone: 'warn' },
    cards: [
      { id: 'vt', x: 14, y: 70, w: 170, title: 'Virtual threads', lines: ['10,000 requests', 'cheap to create'], tone: 'ok' },
      { id: 'pool', x: 236, y: 70, w: 170, title: 'Connection pool', lines: ['20 connections', '9,980 threads wait'], tone: 'warn', badge: 'bottleneck' },
      { id: 'db', x: 458, y: 70, w: 168, title: 'Database', lines: ['handles 20 queries', 'at a time'], tone: 'none' },
    ],
    arrows: [{ from: 'vt', to: 'pool', tone: 'warn' }, { from: 'pool', to: 'db' }],
    note: 'Virtual threads remove the thread limit, not the resource limits. A connection pool of 20 still allows only 20 queries at once, so thousands of virtual threads simply wait for it. You still need pool sizing, timeouts, bulkheads and rate limits.',
  },
  {
    h: 226,
    line: 'synchronized (lock) { blockingCall(); }   // Java 21',
    result: { text: 'carrier pinned', tone: 'warn' },
    texts: carrierLanes(),
    cards: [
      bar(C1, 0, 40, 'V1', 'new'), bar(C1, 40, 540, 'V1 blocks inside synchronized: carrier pinned', 'warn'), bar(C1, 540, 580, 'V3', 'warn', { badge: 'late' }),
      bar(C2, 0, 40, 'V2', 'ok'), bar(C2, 40, 80, 'V4', 'ok'), bar(C2, 80, 120, 'V6', 'ok'),
    ],
    note: 'Watch for pinning. In Java 21, a virtual thread that blocks inside a synchronized block cannot be parked, so it holds its carrier. Prefer ReentrantLock on hot paths, and update libraries (Java 24 removes most of this). Choose WebFlux for streaming and backpressure, virtual threads for typical CRUD services.',
  },
];

export const SPRING_REACTIVE_SCENES = [
  { id: 'blocking', label: 'Thread per request', title: 'Classic Spring MVC: one platform thread is held for the whole request', stage: BoardStage, frames: blockingFrames },
  { id: 'reactive', label: 'Event loop (WebFlux)', title: 'WebFlux: a few event-loop threads handle many requests by never waiting', stage: BoardStage, frames: reactiveFrames },
  { id: 'virtual', label: 'Virtual threads', title: 'Virtual threads keep the simple blocking style but make waiting cheap', stage: BoardStage, frames: virtualFrames },
];
