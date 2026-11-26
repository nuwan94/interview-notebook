// Frame data for the "Node.js streams" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

// A row of small cells that pictures a stream's internal buffer.
const cells = (prefix, x, y, n, filled, tone = 'warn', o = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, x: x + i * 26, y, w: 22, h: 22, title: '', tone: i < filled ? tone : 'none', dim: i >= filled, ...o }));

/* ---------- the four types ---------- */
const typeFrames = [
  {
    h: 220,
    line: 'for await (const chunk of createReadStream(file))',
    result: { text: 'Readable: a source', tone: 'ok' },
    cards: [
      { id: 'src', x: 14, y: 60, w: 170, title: 'Readable', lines: ['statement.csv'], tone: 'new', badge: 'source' },
      { id: 'k1', x: 230, y: 66, w: 56, h: 34, title: '64K', mono: true, tone: 'ok' },
      { id: 'k2', x: 292, y: 66, w: 56, h: 34, title: '64K', mono: true, tone: 'ok' },
      { id: 'k3', x: 354, y: 66, w: 56, h: 34, title: 'end', mono: true, tone: 'none' },
      { id: 'use', x: 456, y: 60, w: 170, title: 'Consumer', lines: ['for await, or pipe'], tone: 'ok' },
    ],
    arrows: [{ from: 'src', to: 'k1', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'k3', to: 'use', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A Readable is a source that you consume in chunks: a file, an HTTP request body, a database cursor, process.stdin. Each chunk is a Buffer (64 KB for files). When there is no more data, it emits "end".',
  },
  {
    h: 220,
    line: 'out.write(chunk) … out.end()',
    result: { text: 'Writable: a destination', tone: 'ok' },
    cards: [
      { id: 'prod', x: 14, y: 60, w: 170, title: 'Your code', lines: ['write(chunk)', 'then end()'], mono: true, tone: 'new' },
      { id: 'dst', x: 230, y: 52, w: 200, title: 'Writable', lines: ['report.csv'], tone: 'ok', badge: 'destination' },
      ...cells('wb', 244, 108, 4, 2, 'ok'),
      { id: 'fin', x: 476, y: 60, w: 150, title: '"finish"', lines: ['all data flushed'], tone: 'ok' },
    ],
    arrows: [{ from: 'prod', to: 'dst', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'dst', to: 'fin', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A Writable is a destination: a file, an HTTP response, a socket, process.stdout. You call write(chunk), and finally end(). It emits "drain" when it can take more, and "finish" when everything has been flushed.',
  },
  {
    h: 220,
    line: 'pipeline(source, createGzip(), destination)',
    result: { text: 'Transform: in → out', tone: 'ok' },
    regions: [{ x: 196, y: 30, w: 250, h: 130, title: 'Transform (gzip)', tone: 'new' }],
    cards: [
      { id: 'in', x: 14, y: 66, w: 150, title: 'raw CSV chunks', lines: ['written in'], tone: 'none' },
      { id: 'ws', x: 208, y: 66, w: 104, title: 'writable', lines: ['side'], tone: 'new' },
      { id: 'rs', x: 330, y: 66, w: 104, title: 'readable', lines: ['side'], tone: 'new' },
      { id: 'out', x: 476, y: 66, w: 150, title: 'gzip chunks', lines: ['read out'], tone: 'ok' },
    ],
    arrows: [{ from: 'in', to: 'ws', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'ws', to: 'rs', fs: 'r', ts: 'l', tone: 'new' }, { from: 'rs', to: 'out', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A Transform is both writable and readable, and its output is computed from its input: gzip, parsing lines into objects, a hash. A Duplex also has both sides, but they are independent, like a TCP socket.',
  },
  {
    h: 220,
    line: 'highWaterMark: 64 KB, or 16 objects',
    result: { text: 'a threshold, not a limit', tone: 'warn' },
    cards: [
      { id: 'byte', x: 14, y: 44, w: 290, title: 'byte mode (default)', lines: ['chunk = Buffer', 'full at 64 KB'], tone: 'ok' },
      ...cells('bm', 28, 118, 8, 6, 'ok'),
      { id: 'obj', x: 336, y: 44, w: 290, title: 'object mode', lines: ['chunk = any JS value', 'full at 16 objects'], tone: 'new' },
      ...cells('om', 350, 118, 8, 8, 'warn'),
    ],
    note: 'Each stream has an internal buffer. highWaterMark is the level at which it counts as full: 64 KB in byte mode, 16 objects in object mode. Reaching it makes the stream ask the producer to stop. Memory stays near one buffer, not the whole data set.',
  },
];

/* ---------- backpressure ---------- */
const fast = (o = {}) => ({ id: 'fast', x: 14, y: 52, w: 150, title: 'file on SSD', lines: ['500 MB/s'], tone: 'ok', ...o });
const slow = (o = {}) => ({ id: 'slow', x: 476, y: 52, w: 150, title: 'mobile client', lines: ['1 MB/s'], tone: 'warn', ...o });
const wr = (lines, o = {}) => ({ id: 'wr', x: 210, y: 44, w: 220, title: 'res (Writable)', lines, tone: 'none', ...o });

const bpFrames = [
  {
    h: 240,
    line: 'rs.on("data", (c) => res.write(c))',
    result: { text: 'memory grows without limit', tone: 'bad' },
    cards: [fast(), wr(['buffer: 1.2 GB and growing'], { tone: 'bad', badge: 'leak' }), ...cells('mb', 224, 104, 8, 8, 'bad'), slow()],
    arrows: [{ from: 'fast', to: 'wr', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'wr', to: 'slow', fs: 'r', ts: 'l', tone: 'warn' }],
    texts: [{ x: 224, y: 160, t: '… and more chunks keep arriving' }],
    note: 'The source reads at 500 MB per second. The client takes 1 MB per second. If the code ignores the difference, it piles up in memory, and a few slow clients can exhaust the server.',
  },
  {
    h: 240,
    line: 'if (!res.write(chunk)) source.pause()',
    result: { text: 'write() returned false', tone: 'warn' },
    cards: [fast({ tone: 'warn', badge: 'paused' }), wr(['buffer at highWaterMark'], { tone: 'warn', badge: 'full' }), ...cells('mb', 224, 104, 4, 4, 'warn'), slow()],
    arrows: [{ from: 'wr', to: 'fast', fs: 'l', ts: 'r', tone: 'warn', dash: true }, { from: 'wr', to: 'slow', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'When a write leaves the buffer at or above highWaterMark, write() returns false. That means: stop writing for now. The chunk is still accepted, but the producer must pause its source.',
  },
  {
    h: 240,
    line: 'res.once("drain", () => source.resume())',
    result: { text: 'memory stays flat', tone: 'ok' },
    cards: [fast({ badge: 'resumed' }), wr(['buffer flushed'], { tone: 'ok', badge: 'drain' }), ...cells('mb', 224, 104, 4, 1, 'ok'), slow({ tone: 'ok' })],
    arrows: [{ from: 'fast', to: 'wr', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'wr', to: 'slow', fs: 'r', ts: 'l', tone: 'ok' }],
    texts: [{ x: 224, y: 160, t: '"drain"  →  the source resumes' }],
    note: 'When the buffer has been flushed to the client, the Writable emits "drain", and the source resumes. This loop keeps memory near one buffer for any file size. pipe and pipeline run it for you.',
  },
  {
    h: 240,
    line: 'pipeline(file, parse, gzip, res)   // res is slow',
    result: { text: 'pressure travels back', tone: 'warn' },
    cards: [
      { id: 's1', x: 14, y: 60, w: 130, title: 'file', lines: ['stops reading'], tone: 'warn', badge: 'paused' },
      { id: 's2', x: 174, y: 60, w: 130, title: 'parse', lines: ['buffer full'], tone: 'warn' },
      { id: 's3', x: 334, y: 60, w: 130, title: 'gzip', lines: ['buffer full'], tone: 'warn' },
      { id: 's4', x: 496, y: 60, w: 130, title: 'res', lines: ['buffer full'], tone: 'warn', badge: 'slow' },
      ...cells('p2', 188, 124, 4, 4), ...cells('p3', 348, 124, 4, 4), ...cells('p4', 510, 124, 4, 4),
    ],
    arrows: [{ from: 's4', to: 's3', fs: 'l', ts: 'r', tone: 'warn', dash: true }, { from: 's3', to: 's2', fs: 'l', ts: 'r', tone: 'warn', dash: true }, { from: 's2', to: 's1', fs: 'l', ts: 'r', tone: 'warn', dash: true }],
    note: 'In a chain, each stream has its own buffer. The last one fills first, so the one before it stops writing and fills too, and so on back to the file, which stops reading. Total memory is the sum of a few buffers, not the data size.',
  },
];

/* ---------- pipe versus pipeline ---------- */
const chain = (t1, t2, t3) => [
  { id: 'a', x: 14, y: 52, w: 170, title: 'createReadStream', lines: [t1[0]], tone: t1[1], badge: t1[2] },
  { id: 'b', x: 234, y: 52, w: 170, title: 'createGzip', lines: [t2[0]], tone: t2[1], badge: t2[2] },
  { id: 'c', x: 456, y: 52, w: 170, title: 'res', lines: [t3[0]], tone: t3[1], badge: t3[2] },
];
const links = (tone, extra = {}) => [{ from: 'a', to: 'b', fs: 'r', ts: 'l', tone, ...extra }, { from: 'b', to: 'c', fs: 'r', ts: 'l', tone, ...extra }];

const pipeFrames = [
  {
    h: 230,
    line: 'read.pipe(gzip).pipe(res)',
    result: { text: 'response hangs, handles leak', tone: 'bad' },
    cards: [...chain(['EIO: read failed', 'bad', 'error'], ['still open', 'warn'], ['never ends', 'warn', 'hangs']),
      { id: 'leak', x: 234, y: 150, w: 392, title: 'leaked', lines: ['file descriptor, gzip memory, open socket'], tone: 'bad' }],
    arrows: [{ from: 'a', to: 'b', fs: 'r', ts: 'l', tone: 'bad', cross: true }, { from: 'b', to: 'c', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'pipe wires backpressure, but it does not forward errors. If the source fails, the destination stays open and waiting. If the destination closes early, the source keeps its file. Every stream needs its own error handler.',
  },
  {
    h: 230,
    line: 'await pipeline(read, gzip, res)',
    result: { text: 'all destroyed, promise rejects', tone: 'ok' },
    cards: [...chain(['EIO: read failed', 'bad', 'error'], ['destroyed', 'none', 'closed'], ['destroyed', 'none', 'closed']),
      { id: 'catch', x: 234, y: 150, w: 392, title: 'catch (err)', lines: ['one place, first error, nothing left open'], tone: 'ok' }],
    arrows: links('none', { dash: true }),
    note: 'stream.pipeline chains any number of streams and applies backpressure. On an error or an early close, it destroys every stream in the chain. Its promise form rejects with the first error.',
  },
  {
    h: 230,
    line: 'the user closes the browser tab',
    result: { text: 'ERR_STREAM_PREMATURE_CLOSE', tone: 'warn' },
    cards: [...chain(['file closed', 'ok', 'destroyed'], ['destroyed', 'ok'], ['closed by client', 'warn', 'gone']),
      { id: 'log', x: 234, y: 150, w: 392, title: 'log at a low level', lines: ['a client leaving is not a server error'], tone: 'none' }],
    arrows: [{ from: 'a', to: 'b', fs: 'r', ts: 'l', tone: 'ok', dash: true }, { from: 'b', to: 'c', fs: 'r', ts: 'l', tone: 'warn', cross: true }],
    note: 'A client that disconnects mid-download closes the response. pipeline notices, destroys the file stream and the gzip transform, and rejects with ERR_STREAM_PREMATURE_CLOSE. Pass an AbortSignal to stop a pipeline from outside, for example on a timeout.',
  },
];

/* ---------- a real export ---------- */
const stage = (id, x, title, lines, tone = 'ok', o = {}) => ({ id, x, y: 60, w: 112, title, lines, tone, ...o });
const exportChain = (o = {}) => [
  stage('db', 14, 'DB cursor', ['500 rows', 'per fetch'], o.db || 'ok'),
  stage('fmt', 139, 'format', ['row → CSV', 'line'], o.fmt || 'new'),
  stage('gz', 264, 'gzip', ['compress', 'chunks'], o.gz || 'new'),
  stage('res', 389, 'res', ['chunked', 'transfer'], o.res || 'ok'),
  stage('br', 514, 'browser', ['download', 'starts at once'], o.br || 'ok'),
];
const exportLinks = (tone = 'ok') => [['db', 'fmt'], ['fmt', 'gz'], ['gz', 'res'], ['res', 'br']].map(([from, to]) => ({ from, to, fs: 'r', ts: 'l', tone }));

const realFrames = [
  {
    h: 240,
    line: 'await db.query("SELECT … 2M rows")',
    result: { text: 'gigabytes, first byte at the end', tone: 'bad' },
    cards: [
      { id: 'all', x: 14, y: 44, w: 290, title: 'load all rows', lines: ['array of 2,000,000', 'first byte after the query'], tone: 'bad', badge: 'heap' },
      { id: 'cur', x: 336, y: 44, w: 290, title: 'database cursor', lines: ['fetch 500 rows at a time', 'a Readable in object mode'], tone: 'ok', badge: 'stream' },
    ],
    note: 'A statement export with 2 million rows. Loading them all into an array needs gigabytes, and nothing is sent until the query ends. A cursor reads the rows in batches, and exposes them as a Readable in object mode.',
  },
  {
    h: 240,
    line: 'pipeline(cursor, toCsv, createGzip(), res)',
    result: { text: 'constant memory', tone: 'ok' },
    cards: exportChain(),
    arrows: exportLinks(),
    note: 'An async generator turns each row into one CSV line. gzip compresses the text as it flows. The response is the last Writable. Every stage works on one chunk at a time, so memory stays constant.',
  },
  {
    h: 240,
    line: 'user cancels the download',
    result: { text: 'cursor closed, connection returned', tone: 'ok' },
    cards: exportChain({ db: 'ok', fmt: 'none', gz: 'none', res: 'warn', br: 'warn' }).map((c) => (c.id === 'db' ? { ...c, lines: ['cursor closed', 'back to pool'], badge: 'released' } : c.id === 'br' ? { ...c, lines: ['tab closed'] } : c)),
    arrows: exportLinks('none').slice(0, 3).map((a) => ({ ...a, dash: true })),
    note: 'The size is unknown, so the response uses chunked transfer encoding. If the user cancels, pipeline destroys the whole chain, and the database cursor is closed. The connection goes back to the pool.',
  },
];

export const STREAM_SCENES = [
  { id: 'types', label: 'The four stream types', title: 'Readable, Writable, Transform and the buffer', stage: BoardStage, frames: typeFrames },
  { id: 'backpressure', label: 'Backpressure', title: 'Slow consumers slow the source', stage: BoardStage, frames: bpFrames },
  { id: 'pipeline', label: 'pipe versus pipeline', title: 'Errors and cleanup', stage: BoardStage, frames: pipeFrames },
  { id: 'real', label: 'A real export', title: 'Database to browser, never all in memory', stage: BoardStage, frames: realFrames },
];
