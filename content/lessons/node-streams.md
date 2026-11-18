---
title: Node.js streams — Readable, Writable, Transform, backpressure and pipeline
nav: Node.js streams
slug: node-streams
summary: Node.js streams for backend interviews, why streams keep memory flat, Readable, Writable, Duplex and Transform, flowing and paused modes, events, highWaterMark and object mode, backpressure with write returning false and drain, pipe versus stream.pipeline, error handling and cleanup, premature close and AbortSignal, async iteration with for await, async generators in pipelines, writing custom streams, parsing lines and NDJSON, HTTP request and response streams, file uploads with size limits, database to browser exports with gzip, the Web Streams API and fetch bodies, performance pitfalls and testing, compared with Java streams and Reactive Streams, with banking examples and interview questions.
tags: [Node.js, Streams, Backpressure, Transform, pipeline, Buffers, Performance, Backend, Full stack]
order: 69
topic: Full stack / Node.js
updated: 2026-11-18
subnav: true
---

Streams are where Node.js interviews separate people who have used the API from people who understand it. They ask *what a stream is and why use one, the four types, what backpressure is and how it is signalled, the difference between `pipe` and `pipeline`, how errors and early disconnects are handled, how you write a Transform, how you stream a large export or upload without loading it into memory, and how Node streams relate to web streams.* This lesson goes deeper than the short [streams section of the Node.js runtime lesson](lesson:node-runtime#streams) and the [Express file endpoints](lesson:node-express#structure). Examples are JavaScript with banking exports. Play the four scenes: the stream types, backpressure, `pipe` versus `pipeline`, and a real export.

```demo
name: stream-walk
```

> **One sentence to remember:** *A stream moves data in chunks through a small buffer, the writable tells the source to slow down with `write()` returning `false` and `drain`, and `pipeline` connects streams and destroys them all when anything fails.*

## Why streams {#why}

A normal call such as `fs.readFile` or `await res.json()` loads **everything** into memory before you can touch it. That has two costs:

- **Memory:** a 2 GB statement export held in memory per request. Ten concurrent requests need 20 GB and the process crashes (the V8 heap is limited, and a `Buffer` above about 2 to 4 GB cannot be created at all).
- **Latency:** nothing is sent until everything has been read, so the user waits for the slowest part.

A **stream** processes data **in chunks, as it arrives**. Memory stays around one buffer whatever the total size, the first byte can leave immediately, and stages can be connected: read, parse, transform, compress, write. Streams are also how Node.js itself works: HTTP requests and responses, TCP sockets, files, `process.stdin` and `process.stdout`, `zlib`, `crypto` hashes and child-process pipes are all streams.

Use streams for **large or unbounded data** (files, uploads, exports, logs, media) and for **anything that arrives over time** (sockets). For small data a plain `await` is simpler and fine.

## The four types {#types}

All streams are `EventEmitter`s ([events](lesson:node-runtime#events)). Four kinds (the first scene):

| Type | Direction | Examples | Core methods |
| --- | --- | --- | --- |
| **Readable** | you read from it | `fs.createReadStream`, HTTP request (server) or response (client), `process.stdin`, DB cursor | `read()`, events `data`, `end`, async iteration |
| **Writable** | you write to it | `fs.createWriteStream`, HTTP response (server), `process.stdout`, a socket | `write(chunk)`, `end()`, events `drain`, `finish` |
| **Duplex** | both, independent sides | TCP socket (`net.Socket`), a WebSocket | read and write |
| **Transform** | a Duplex whose output is computed from its input | `zlib.createGzip()`, `crypto.createHash()`, a CSV parser | like Duplex, plus `transform()` |

(`PassThrough` is a Transform that returns its input unchanged, handy for tapping or for testing.)

**Chunks.** A chunk is a `Buffer` (or a string if you set an encoding) in the normal **byte mode**. In **object mode** (`objectMode: true`) a chunk is any JavaScript value except `null`, such as a parsed row, so you can pass objects between stages.

**`highWaterMark`.** The size at which a stream's internal buffer is considered full. It is measured in **bytes** (64 KiB by default for file streams, and for generic streams in Node 22 and later, 16 KiB before that) or in **objects** (16 by default) in object mode. It is a **threshold for signalling**, not a hard limit: the stream asks the producer to stop once the buffer reaches it.

```javascript
import { createReadStream } from 'node:fs';

const rs = createReadStream('statement.csv', { highWaterMark: 256 * 1024, encoding: 'utf8' });
console.log(rs.readableHighWaterMark);   // 262144
```

## Reading: modes and events {#readable}

A Readable has two modes:

- **Paused** (the initial state): data stays in the buffer until you ask for it with `read()`, or switch modes.
- **Flowing**: data is delivered automatically through `data` events as fast as possible. It starts when you add a `data` listener, call `pipe()` or `resume()`, and stops with `pause()`.

Events: `data` (a chunk), `end` (no more data), `error`, `close` (the underlying resource is released, always the last event), plus `readable` (in paused mode data can be read), `pause` and `resume`.

There are three ways to consume a Readable. **Prefer async iteration**:

```javascript
// 1. for await: simple, handles backpressure, throws on error, closes the stream on break
let bytes = 0;
for await (const chunk of createReadStream('statement.csv')) {
  bytes += chunk.length;
}

// 2. pipe / pipeline: connect to a writable (see below)

// 3. events: low level, easy to get wrong
rs.on('data', (chunk) => { /* no backpressure unless you pause() yourself */ });
rs.on('end', () => console.log('done'));
rs.on('error', (err) => console.error(err));
```

Notes:

- Adding a `data` listener to a stream that is not piped starts flowing mode at full speed. If your handler is slow or async, call `rs.pause()` and `rs.resume()` or use `for await`, otherwise data piles up.
- Breaking out of a `for await` loop **destroys** the stream.
- **Create one on demand** with `Readable.from(iterable)`: it turns an array, a generator or an async generator into a stream (object mode by default).

```javascript
import { Readable } from 'node:stream';

const rows = Readable.from([{ id: 1 }, { id: 2 }]);              // object mode
const lines = Readable.from(['a\n', 'b\n'], { objectMode: false });

async function* transactions() {
  for (let page = 0; page < 100; page++) yield* await loadPage(page);   // pull pages lazily
}
const source = Readable.from(transactions());
```

- **Text and encodings:** a chunk boundary can split a multi-byte character. Use `rs.setEncoding('utf8')` (or `encoding` in the options), which decodes correctly across chunks, instead of calling `chunk.toString()` yourself.
- **Lines:** do not split chunks on `'\n'` by hand, because a line can span two chunks. Use `readline`:

```javascript
import { createInterface } from 'node:readline';

const rl = createInterface({ input: createReadStream('transactions.csv'), crlfDelay: Infinity });
for await (const line of rl) {
  const [id, amount] = line.split(',');
  // one line at a time, constant memory
}
```

## Writing: write, end and drain {#writable}

```javascript
import { createWriteStream } from 'node:fs';

const out = createWriteStream('report.csv');
out.write('id,amount\n');
out.write('1,100\n');
out.end('2,250\n');                     // last chunk, then close the stream

out.on('finish', () => console.log('all data flushed to the file'));   // after end()
out.on('error', (err) => console.error(err));
out.on('close', () => console.log('file descriptor released'));
```

- **`write(chunk)`** returns a **boolean**. `true` means keep going. **`false` means the internal buffer is above `highWaterMark`: stop writing until the `drain` event.** The chunk is still accepted (it is buffered), so ignoring `false` does not lose data, it just lets memory grow without limit.
- **`end([chunk])`** says no more data. After `end()`, calling `write()` raises an error.
- **`finish`** is emitted after `end()` once all data is flushed to the underlying system. **`close`** is emitted when the resource is released. For files, wait for `finish` (or use `pipeline`) before reading the file back.
- Useful properties: `writable.writableLength` (bytes buffered), `writable.writableNeedDrain`, `writable.writableHighWaterMark`.
- **`cork()` and `uncork()`** batch several small writes into one system call.

**Manual writing with backpressure** (what `pipe` does for you):

```javascript
import { once } from 'node:events';

async function writeAll(writable, rows) {
  for (const row of rows) {
    if (!writable.write(`${row.id},${row.amount}\n`)) {
      await once(writable, 'drain');        // buffer is full: wait until it empties
    }
  }
  writable.end();
  await once(writable, 'finish');
}
```

## Backpressure {#backpressure}

The mismatch problem (the second scene): the source can produce faster than the destination can consume. A file on an SSD reads at hundreds of MB per second, a mobile client downloads at 1 MB per second. The difference has to go somewhere.

**Backpressure** is the mechanism that lets a slow consumer slow the producer:

1. The writable's buffer fills. `write()` returns `false` once the buffer exceeds `highWaterMark`.
2. The producer (or `pipe`) **pauses the source**: it stops reading.
3. The writable flushes to the slow destination and emits **`drain`**.
4. The producer **resumes**.

Result: memory stays near one or two buffers for any size of data, and a slow client costs a little memory, not a lot. Ignoring backpressure (writing in a loop without checking the return value, or a `data` handler that triggers async work without pausing) gives the classic "memory grows until the process is killed" bug.

`pipe()` and `pipeline()` implement this loop. Transform streams also take part: a Transform's readable side buffers up to its own `highWaterMark`, and when that is full it stops accepting writes, which propagates the pressure back up the chain.

## pipe versus pipeline {#pipeline}

```javascript
// Old: pipe wires backpressure but not errors or cleanup
createReadStream('a.csv').pipe(createGzip()).pipe(res);
```

`pipe` has these problems (the third scene):

- **Errors are not forwarded.** An error in `createReadStream` does not close `res`, so the response hangs. You need an `error` listener on every stream.
- **No cleanup.** If `res` closes early (the client leaves), the source stream and the gzip stream stay open and leak a file descriptor and memory.
- It returns the last stream, not a promise, so you cannot `await` completion.

**`stream.pipeline`** fixes all three. It connects the streams in order, applies backpressure, and **if any stream errors or closes early, it destroys all of them** and reports the first error. Use the promise form:

```javascript
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

try {
  await pipeline(
    createReadStream('statement.csv'),
    createGzip(),
    createWriteStream('statement.csv.gz'),
  );
  console.log('compressed');
} catch (err) {
  console.error('pipeline failed, all streams destroyed', err);
}
```

Details:

- A stage can be an **async generator function**, which receives the previous stream as an async iterable and yields the output: the simplest way to write a transform.

```javascript
await pipeline(
  createReadStream('transactions.ndjson'),
  async function* (source) {                       // a transform without a class
    let rest = '';
    for await (const chunk of source) {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();                          // keep the partial last line
      for (const line of lines) if (line) yield JSON.stringify({ ...JSON.parse(line), checked: true }) + '\n';
    }
    if (rest) yield rest + '\n';
  },
  createWriteStream('checked.ndjson'),
);
```

- **Cancellation:** `pipeline(streams, { signal })` stops with an `AbortError` when the signal aborts, and destroys everything. Combine with `AbortSignal.timeout(ms)`.
- **Client disconnect:** when `res` closes early, `pipeline` rejects with **`ERR_STREAM_PREMATURE_CLOSE`** and destroys the file and gzip streams. That is expected and should be logged at a low level, not treated as a server error.
- The callback form `pipeline(a, b, c, (err) => ...)` also exists, and **`stream.finished(stream, cb)`** (promise version in `stream/promises`) tells you when one stream ends, errors or closes.
- **`stream.compose`** combines streams into one reusable Duplex.

## Errors and cleanup {#errors}

- A stream that errors is **destroyed**: it emits `error` and then `close`, and cannot be reused. Always handle `error` (or use `pipeline` or `for await`, which turn it into a rejection or exception). An `error` event with no listener is thrown and can crash the process.
- Call **`stream.destroy(err?)`** to release a stream's resources immediately (a file descriptor, a socket). Do it when you stop using a stream early.
- A Readable that you stop consuming without destroying keeps its file open. `for await` with `break`, and `pipeline`, destroy for you.
- **Resource leaks** are the main stream bug in production: unclosed file handles and sockets, buffered data held by a stalled consumer. Watch the open file descriptor count and memory when diagnosing.
- In an HTTP server, **do not send headers after the stream has started failing**: if the error comes after the first chunk, the status code is already sent, so you can only destroy the response (`res.destroy(err)`), which the client sees as a broken download. Validate and open things (the file, the query) **before** writing the status line when you can.

## Custom streams {#custom}

**Transform**: implement `transform(chunk, encoding, callback)` and optionally `flush(callback)` for data left at the end.

```javascript
import { Transform } from 'node:stream';

// object mode in, text out: one CSV line per row
export const toCsvLine = () => new Transform({
  writableObjectMode: true,                          // receives objects
  transform(row, _encoding, callback) {
    callback(null, `${row.id},${row.owner},${(row.balance / 100).toFixed(2)}\n`);   // push one result
  },
});

// groups items into arrays of N: needs flush for the last partial group
export const batch = (size) => {
  let items = [];
  return new Transform({
    objectMode: true,
    transform(item, _enc, callback) {
      items.push(item);
      if (items.length >= size) { this.push(items); items = []; }
      callback();
    },
    flush(callback) {
      if (items.length) this.push(items);            // the remainder
      callback();
    },
  });
};
```

**Writable**: implement `write(chunk, encoding, callback)`. Call `callback()` when the chunk is handled (this is what creates backpressure: a slow `callback` keeps the buffer full), or `callback(err)` to fail.

```javascript
import { Writable } from 'node:stream';

const insertBatches = (db) => new Writable({
  objectMode: true,
  highWaterMark: 4,                                  // at most 4 batches buffered
  async write(rows, _enc, callback) {
    try { await db.insertMany(rows); callback(); } catch (err) { callback(err); }
  },
});
```

**Readable**: implement `read()` and call `push(chunk)`, or simply use `Readable.from(asyncGenerator)`, which is almost always easier and correct about backpressure.

Rules for custom streams: always call the callback exactly once, call `this.push(null)` (or `callback` in `flush`) to end, never `throw` from the callback style (use `callback(err)`), and keep a Transform's work per chunk small and non-blocking, because a blocked event loop stalls every stream.

## Real use cases {#usecases}

**1. Large download or export from a database** (the fourth scene). Stream rows from a cursor, format them, compress them and send them. Memory stays constant and the first bytes go out at once.

```javascript
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';

app.get('/accounts/:id/export.csv.gz', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Disposition', 'attachment; filename="export.csv.gz"');

  try {
    await pipeline(
      Readable.from(streamTransactions(req.params.id)),    // async generator over a DB cursor
      async function* (rows) {
        yield 'id,date,amount\n';
        for await (const t of rows) yield `${t.id},${t.date},${(t.amount / 100).toFixed(2)}\n`;
      },
      createGzip(),
      res,                                                 // the HTTP response is a Writable
      { signal: AbortSignal.timeout(5 * 60_000) },
    );
  } catch (err) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') req.log.error({ err }, 'export failed');
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  }
});
```

With PostgreSQL use `pg-query-stream` or a cursor to read in batches of a few hundred rows.

**2. Upload without buffering.** The request is a Readable. Stream it to disk or object storage with a **size limit**:

```javascript
function limitBytes(max) {
  let seen = 0;
  return new Transform({
    transform(chunk, _enc, callback) {
      seen += chunk.length;
      if (seen > max) return callback(Object.assign(new Error('Payload too large'), { status: 413 }));
      callback(null, chunk);
    },
  });
}

app.put('/documents/:id', async (req, res) => {
  await pipeline(req, limitBytes(10 * 1024 * 1024), createWriteStream(tempPath(req.params.id)));
  res.sendStatus(204);
});
```

Multipart form uploads use a streaming parser (`busboy`, used by `multer`), and large files go **straight to S3** with a multipart upload stream or a presigned URL ([upload patterns](lesson:aws-storage#patterns)) so the API never holds them.

**3. Proxy or relay.** `pipeline(upstreamResponse, res)` forwards a body without storing it.

**4. Process large files**: logs, CSV, NDJSON (`readline` or a generator pipeline), or compute a hash while reading: `await pipeline(createReadStream(f), createHash('sha256'))` then `hash.digest('hex')`.

**5. Child processes and CLIs**: `child.stdout` and `process.stdin` are streams, so `pipeline(process.stdin, transform, process.stdout)` makes a Unix-style filter.

**6. Sockets and real-time**: a `net.Socket` is a Duplex, and WebSocket libraries add framing on top.

## Web Streams {#web}

The **Web Streams API** (`ReadableStream`, `WritableStream`, `TransformStream`) is the standard version used by browsers, `fetch`, Deno, Cloudflare Workers and Node.js (global since Node 18). Node's own streams predate it and remain the standard for files, sockets and HTTP servers.

```javascript
import { Readable, Writable } from 'node:stream';

const res = await fetch('https://api.example/export');                 // body is a web ReadableStream
await pipeline(Readable.fromWeb(res.body), createWriteStream('export.csv'));

// the other direction, and a built-in web transform
const web = Readable.toWeb(createReadStream('big.csv'));
const gzipped = web.pipeThrough(new CompressionStream('gzip'));

for await (const chunk of res.body) { /* a web ReadableStream is async iterable in Node */ }
```

| | Node streams | Web streams |
| --- | --- | --- |
| availability | Node.js | browsers, Node, Deno, edge runtimes |
| chunks | `Buffer`, string, objects | typically `Uint8Array`, any value |
| connect | `pipe`, `pipeline` | `pipeTo`, `pipeThrough` |
| backpressure | `write()` returns false and `drain` | built in via queuing strategy and `desiredSize` |
| conversion | `Readable.toWeb`, `fromWeb`, `Writable.toWeb`, `Duplex.toWeb` | same helpers |

Use Node streams for server-side I/O and web streams where code must run in the browser or at the edge.

## Performance and pitfalls {#performance}

- **Chunk size matters.** Tiny chunks mean many callbacks and system calls. Larger `highWaterMark` (64 KiB to 1 MiB) improves throughput for files, at the price of more memory per stream.
- **Do not concatenate chunks into one `Buffer` or string** (`data += chunk`) for large inputs, that defeats the purpose. Process each chunk, or use `readline`.
- **Per-chunk async work in an event handler** (`on('data', async ...)`) creates unbounded concurrency and ignores backpressure. Use `for await`, or a Writable whose `write` callback waits.
- **Object mode is slower** than byte mode and its `highWaterMark` counts objects, not size, so 16 huge objects can be a lot of memory. Batch small objects.
- **CPU-heavy transforms block the event loop**, hurting every request. Offload to `worker_threads` ([workers](lesson:node-runtime#scaling)).
- **The thread pool:** `fs` and `zlib` use the libuv pool (4 threads by default), so many concurrent file streams or compressions can queue ([thread pool](lesson:node-runtime#runtime)).
- **Do not mix** `pipe` and manual `data` listeners on the same stream.
- **Forgetting that `res` is a stream**: call `res.end()` or let `pipeline` end it, otherwise the client waits.
- **Measure** with `process.memoryUsage()` and a load test: memory should stay flat while the data size grows.

## Testing streams {#testing}

- Feed a Transform with `Readable.from([...])`, collect the output with `await Array.fromAsync(stream)` or `for await`, and assert on the result. No files needed.
- Test **backpressure and errors** with a slow Writable (a `write` that delays its callback) and a source that throws, and assert that the other streams are destroyed (`stream.destroyed`).
- Use `PassThrough` as a fake `req` or `res` in unit tests, and `supertest` for the HTTP layer ([Express testing](lesson:node-express#testing)).

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

test('batch groups items and flushes the remainder', async () => {
  const out = await Array.fromAsync(Readable.from([1, 2, 3, 4, 5]).pipe(batch(2)));
  assert.deepEqual(out, [[1, 2], [3, 4], [5]]);
});
```

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| `fs.readFile` or `res.json(bigArray)` for large data | stream it |
| `.pipe()` chains without error handling | `stream.pipeline` |
| ignoring the return value of `write()` | wait for `drain`, or use `pipeline` |
| `on('data', async ...)` | `for await`, or a Writable with an async `write` |
| splitting chunks on `'\n'` by hand | `readline`, or keep the partial last line |
| `chunk.toString()` on multi-byte text | `setEncoding('utf8')` |
| no `error` listener | handle `error`, or use `pipeline` |
| not destroying a stream you abandon | `destroy()`, or `for await` with `break` |
| forgetting `flush` in a batching Transform | emit the remainder in `flush` |
| calling the Transform callback twice or never | exactly once per chunk |
| sending the status code after streaming has started | open resources first, then send headers |
| treating `ERR_STREAM_PREMATURE_CLOSE` as a server fault | it is a client disconnect, log at a low level |
| CPU-heavy work in a Transform | use a worker thread |

## For a Java developer {#java}

| Java | Node.js streams |
| --- | --- |
| `InputStream` and `OutputStream` (blocking, one thread per stream) | Readable and Writable (non-blocking, callbacks and events) |
| `try-with-resources` to close | `pipeline` and `destroy` |
| `BufferedReader.readLine()` | `readline` with `for await` |
| `FilterInputStream`, a `Reader` wrapper | Transform |
| `GZIPOutputStream` wrapping a stream | `zlib.createGzip()` in a `pipeline` |
| `Files.lines`, `Stream<T>` (a lazy pipeline, no I/O backpressure) | async generators, `Readable.from` |
| Reactive Streams, Reactor `Flux`, `Flow.Subscriber.request(n)` | backpressure via `write()` returning false and `drain` (a push model with a pause signal, versus demand-based `request(n)`) |
| `StreamingResponseBody` and `ResponseBodyEmitter` in Spring MVC | `pipeline(source, res)` |
| WebFlux `DataBuffer` streaming | Buffer chunks |
| Kafka or Reactor for unbounded data | streams for bytes, message queues for events |

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| why | constant memory, low latency, composable stages |
| types | Readable, Writable, Duplex, Transform (PassThrough) |
| modes | paused or flowing, byte or object mode |
| `highWaterMark` | buffer threshold, 64 KiB bytes or 16 objects |
| read | prefer `for await`, `Readable.from(generator)`, `readline` for lines |
| write | `write()` returns false means wait for `drain`, `end()`, then `finish` and `close` |
| backpressure | slow consumer pauses the source, bounded memory |
| `pipe` | backpressure only, no error forwarding, no cleanup |
| `pipeline` | backpressure plus error handling plus destroy all, promise form in `stream/promises` |
| generators in `pipeline` | the easiest transform |
| errors | stream is destroyed, handle `error`, `ERR_STREAM_PREMATURE_CLOSE` is a client leaving |
| custom Transform | `transform(chunk, enc, cb)`, `flush(cb)`, call `cb` once |
| web streams | `ReadableStream`, `pipeThrough`, `Readable.fromWeb` and `toWeb` |
| avoid | concatenating chunks, async `data` handlers, CPU work in transforms |

## Interview questions {#questions}

### [basic] What is a stream in Node.js and why use one? {#what-q}

A stream is an abstraction for handling data in chunks over time instead of all at once. It keeps memory use around one buffer regardless of data size, lets the first bytes flow before the rest is ready, and lets you compose stages (read, parse, compress, write). It is used for large files, uploads and exports and for things that arrive over time, such as HTTP bodies and sockets. For small data, a plain `await` is simpler.

### [basic] What are the four types of streams? {#types-q}

**Readable** (a source you read from: a file, an HTTP request), **Writable** (a destination: a file, an HTTP response), **Duplex** (both sides, independent: a TCP socket) and **Transform** (a Duplex whose output is computed from its input: gzip, a parser, a hash). `PassThrough` is a Transform that changes nothing.

### [basic] What is backpressure? {#backpressure-q}

The way a slow consumer tells a fast producer to slow down. When a writable's internal buffer exceeds its `highWaterMark`, `write()` returns `false`. The producer should pause until the writable emits `drain`. Without it, the data difference piles up in memory. `pipe` and `pipeline` do this automatically, so memory stays bounded.

### [basic] What is the difference between `finish`, `end` and `close`? {#events-q}

`end` is emitted on a **Readable** when there is no more data to read. `finish` is emitted on a **Writable** after `end()` was called and all data has been flushed to the underlying system. `close` is emitted when the stream and its underlying resource (a file descriptor, a socket) have been released, and it is the last event, including after errors.

### [basic] What does `highWaterMark` mean? {#hwm-q}

The buffer size at which a stream signals that it is full: bytes in byte mode (about 64 KiB by default for files) or a count of objects in object mode (16). For a writable it is the point where `write()` starts returning `false`, and for a readable it is how much it reads ahead before pausing. It is a threshold for backpressure, not a hard limit.

### [intermediate] What is wrong with `readable.pipe(writable)` and what do you use instead? {#pipe-q}

`pipe` handles backpressure but not errors or cleanup. If the source errors, the destination is not closed, so the response hangs. If the destination closes early (the client leaves), the source stays open and leaks a file descriptor and memory. You need an `error` handler on every stream and you cannot `await` completion. `stream.pipeline` (the promise form from `node:stream/promises`) connects the streams, applies backpressure, destroys all streams on the first error or early close, and resolves or rejects once, so it is the recommended way.

### [intermediate] What happens when a client disconnects in the middle of a streamed download? {#disconnect-q}

The response (a Writable) closes. With `pipeline`, that is detected, all streams in the chain are destroyed (releasing the file or database cursor) and the promise rejects with `ERR_STREAM_PREMATURE_CLOSE`. It is a normal event, not a server bug, so log it at a low level and do not try to send a response. With plain `pipe`, nothing cleans up the source, which leaks resources.

### [intermediate] What are the ways to consume a Readable? {#consume-q}

Async iteration with `for await...of` (simplest: handles backpressure, turns errors into exceptions, destroys the stream on `break`), `pipe` or `pipeline` to a Writable, event listeners (`data`, `end`, `error`, which start flowing mode and give no backpressure unless you pause), and `read()` in paused mode with the `readable` event. Prefer `for await` and `pipeline`.

### [intermediate] How do you process a very large file line by line? {#lines-q}

Create a read stream and wrap it with `readline.createInterface({ input, crlfDelay: Infinity })`, then `for await (const line of rl)`. It handles lines that span chunk boundaries and keeps memory constant. Splitting each chunk on newlines by hand is wrong, because a line can be split across two chunks, so you must keep the partial last line. Decode text with `setEncoding('utf8')` so multi-byte characters are not split.

### [intermediate] How do you write a Transform stream, and what is `flush` for? {#transform-q}

Create a `Transform` with a `transform(chunk, encoding, callback)` method that calls `callback(null, output)` or `this.push(output)` and then `callback()`. Call the callback exactly once per chunk, with an error to fail. `flush(callback)` runs when the input ends and lets you emit data held back, such as the last partial batch or the trailer of a format. In modern code an async generator function inside `pipeline` is often simpler than a Transform class.

### [intermediate] What is object mode, and what are its costs? {#object-q}

In object mode a stream's chunks are arbitrary JavaScript values (parsed rows, for example) instead of bytes, and its `highWaterMark` counts objects (16 by default) rather than bytes. It is convenient for pipelines of parsed records. It is slower than byte mode because of per-object overhead, and buffering 16 large objects can use a lot of memory, so batch small items and keep objects small.

### [deep] How does backpressure propagate through a pipeline of several streams? {#propagate-q}

Each stream has its own buffer. The final Writable fills up and `write()` returns `false`, so the stage before it stops writing and pauses its source. That stage's own writable side then fills as upstream data arrives, so it signals the next stage back, and so on up to the original Readable, which stops reading from the file or socket. When the last Writable drains, the chain resumes in the opposite direction. Pressure travels backwards one buffer at a time, so total memory is about the sum of the buffers, not the data size.

### [deep] How would you design a streaming CSV export of millions of rows from PostgreSQL through an Express endpoint? {#export-design-q}

Read with a cursor or `pg-query-stream` in batches, adapt it as a Readable (object mode), format each row to a line in an async generator or Transform, optionally gzip, and `pipeline` into `res` with `Content-Type`, `Content-Disposition` and `Content-Encoding` set before the first write. Use `res` backpressure so a slow client slows the query, an `AbortSignal` timeout, and handle `ERR_STREAM_PREMATURE_CLOSE` by closing the cursor and releasing the connection back to the pool. Open the query before sending headers so a failure can still return a 500, and after the first chunk only destroy the response. Consider running the export as a background job that writes to object storage and returns a link, if it is long, to avoid tying up a connection for minutes.

### [deep] When would you choose Web Streams over Node streams? {#web-q}

When the code must run in the browser, Deno, Cloudflare Workers or another edge runtime, or when you consume `fetch` response bodies and want standard `pipeThrough`/`pipeTo` composition and built-ins such as `CompressionStream` and `TextDecoderStream`. For server-side I/O in Node.js (files, sockets, HTTP servers, child processes), Node streams remain the primary API and are better integrated. They convert with `Readable.fromWeb` and `Readable.toWeb`.

### [coding] Write an upload endpoint that streams the request body to a file with a 10 MB limit, and cleans up if the limit is exceeded or the client disconnects. {#coding-upload}

```javascript
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const MAX = 10 * 1024 * 1024;

class TooLarge extends Error {
  status = 413;
  constructor() { super('Payload too large'); }
}

function limitBytes(max) {
  let seen = 0;
  return new Transform({
    transform(chunk, _enc, callback) {
      seen += chunk.length;
      if (seen > max) return callback(new TooLarge());       // destroys the whole pipeline
      callback(null, chunk);                                  // pass the chunk on unchanged
    },
  });
}

app.put('/documents', async (req, res) => {
  const declared = Number(req.headers['content-length']);
  if (declared > MAX) return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE' });   // fail early

  const id = randomUUID();
  const file = path.join(UPLOAD_DIR, id);                     // server-chosen name: no path traversal

  try {
    await pipeline(req, limitBytes(MAX), createWriteStream(file, { flags: 'wx' }));
    res.status(201).location(`/documents/${id}`).json({ id });
  } catch (err) {
    await rm(file, { force: true });                          // remove the partial file
    if (err instanceof TooLarge) return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE' });
    if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;    // client left, nothing to send
    throw err;                                                // the error middleware handles it
  }
});
```

The header check rejects honest oversize uploads at once, and the counting Transform enforces the limit for clients that lie or use chunked encoding. `pipeline` destroys the request and the file stream on any failure, the partial file is deleted, the file name is generated by the server, and `wx` refuses to overwrite an existing file.

### [coding] Write a `batch(size)` object-mode Transform and a function that inserts batches into a database with backpressure, so memory stays bounded. {#coding-batch}

```javascript
import { Transform, Writable, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function batch(size) {
  let items = [];
  return new Transform({
    objectMode: true,
    transform(item, _enc, callback) {
      items.push(item);
      if (items.length >= size) {
        const full = items;
        items = [];
        callback(null, full);                                 // push a full batch downstream
      } else {
        callback();                                           // nothing to emit yet
      }
    },
    flush(callback) {
      callback(null, items.length ? items : undefined);       // the remaining partial batch
    },
  });
}

function insertWriter(db) {
  return new Writable({
    objectMode: true,
    highWaterMark: 2,                                         // buffer at most 2 batches
    async write(rows, _enc, callback) {
      try {
        await db.insertMany(rows);                            // the slow part
        callback();                                           // only now ask for the next batch
      } catch (err) {
        callback(err);                                        // destroys the pipeline
      }
    },
  });
}

export async function importTransactions(db, rows) {          // rows: any async iterable
  await pipeline(Readable.from(rows), batch(500), insertWriter(db));
}
```

The Writable's `write` callback is called only after the insert finishes, so while the database is slow its buffer fills (two batches), the Transform stops accepting rows, and `Readable.from` stops pulling from the source. Memory stays at about three batches however many rows there are. `flush` emits the last partial batch, and an insert error destroys every stream and rejects the promise.

### [coding] Write a function that copies a source Readable into a Writable by hand, handling backpressure and errors, without `pipe`. {#coding-manual}

```javascript
import { once } from 'node:events';

export async function copy(source, destination) {
  try {
    for await (const chunk of source) {                       // the source is read only when we ask
      if (!destination.write(chunk)) {
        await once(destination, 'drain');                     // buffer full: wait before reading more
      }
    }
    destination.end();
    await once(destination, 'finish');                        // all data flushed
  } catch (err) {
    source.destroy?.(err);                                    // release both sides on failure
    destination.destroy(err);
    throw err;
  }
}
```

`for await` only pulls the next chunk when the loop body finishes, so awaiting `drain` pauses the source and keeps memory bounded. One detail is missing compared with `pipeline`: if the destination closes or errors while we wait for `drain` the promise would hang, because `once(destination, 'drain')` rejects only on `error`. A robust version listens for `close` too, which is exactly why `stream.pipeline` is preferred over hand-written copy loops.
