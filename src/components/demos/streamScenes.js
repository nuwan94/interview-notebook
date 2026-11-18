// Frame data for the "Node.js streams" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const STREAM_SCENES = [
  {
    id: 'types',
    label: 'The four stream types',
    title: 'Readable, Writable, Duplex, Transform',
    frames: [
      {
        note: 'A Readable is a source of data you consume in chunks: a file, an HTTP request body, a database cursor, process.stdin. It emits data events, or you read it with for await. When there is no more, it emits end.',
        boxes: [b('s', 'Readable source', ['file, request, cursor'], 'new'), b('c', 'Chunk', ['Buffer or string, 64 KB'], 'ok'), b('u', 'Consumer', ['for await or pipe'], 'ok')],
        deps: [d('Readable source', 'Chunk', 'emits', 'ok'), d('Chunk', 'Consumer', 'consumed by', 'ok')],
      },
      {
        note: 'A Writable is a destination: a file, an HTTP response, a socket, process.stdout. You call write(chunk) and finally end(). It emits drain when it can take more and finish when everything has been flushed.',
        boxes: [b('p', 'Producer', ['calls write(chunk)'], 'ok'), b('w', 'Writable destination', ['file, response, socket'], 'new'), b('f', 'finish event', ['all data flushed'], 'ok')],
        deps: [d('Producer', 'Writable destination', 'write, then end', 'ok'), d('Writable destination', 'finish event', 'emits', 'ok')],
      },
      {
        note: 'A Transform sits in the middle: it is both writable and readable, and the output is computed from the input. Examples: gzip compression, parsing lines into objects, encryption. A Duplex is two independent sides, such as a TCP socket.',
        boxes: [b('i', 'Input chunks', ['raw rows'], 'none'), b('t', 'Transform', ['parse, compress, encrypt'], 'new'), b('o', 'Output chunks', ['changed data'], 'ok')],
        deps: [d('Input chunks', 'Transform', 'written to', 'ok'), d('Transform', 'Output chunks', 'read from', 'ok')],
      },
      {
        note: 'Streams hold data in an internal buffer whose size is the highWaterMark: 64 KB for bytes, 16 for object mode. Object mode lets a stream pass JavaScript objects, such as parsed rows, instead of bytes. Chunks are the unit of work, so memory stays about one buffer, not the whole data set.',
        boxes: [b('b', 'Internal buffer', ['highWaterMark 64 KB'], 'warn'), b('m', 'Byte mode', ['Buffer chunks'], 'ok'), b('j', 'Object mode', ['one object per chunk'], 'new')],
        deps: [d('Internal buffer', 'Byte mode', 'default', 'ok'), d('Internal buffer', 'Object mode', 'objectMode: true', 'ok')],
      },
    ],
  },
  {
    id: 'backpressure',
    label: 'Backpressure',
    title: 'Slow consumers slow the source',
    frames: [
      {
        note: 'The source reads from a fast SSD at 500 MB per second. The destination is a mobile client that accepts 1 MB per second. If the source ignores that, the difference piles up in memory, and a few slow clients can exhaust the server.',
        boxes: [b('f', 'Fast source', ['500 MB per second'], 'ok'), b('m', 'Memory grows', ['unbounded buffer'], 'bad'), b('s', 'Slow client', ['1 MB per second'], 'warn')],
        deps: [d('Fast source', 'Memory grows', 'faster than', 'bad'), d('Memory grows', 'Slow client', 'waiting for', 'warn')],
      },
      {
        note: 'The writable has a buffer limit. When write() leaves the buffer above the highWaterMark it returns false. That false means stop writing for now. The producer must pause its source.',
        boxes: [b('w', 'write(chunk)', ['buffer over the limit'], 'warn'), b('r', 'returns false', ['stop sending'], 'bad'), b('p', 'Source paused', ['no new reads'], 'ok')],
        deps: [d('write(chunk)', 'returns false', 'result', 'bad'), d('returns false', 'Source paused', 'producer pauses', 'ok')],
      },
      {
        note: 'When the writable has flushed its buffer to the client it emits drain. The producer resumes reading and writing. This loop keeps memory near one buffer for any file size, and pipe and pipeline run it for you.',
        boxes: [b('d', 'drain event', ['buffer is empty again'], 'ok'), b('r', 'Source resumes', ['reads the next chunk'], 'ok'), b('l', 'Steady flow', ['memory stays flat'], 'ok')],
        deps: [d('drain event', 'Source resumes', 'signals', 'ok'), d('Source resumes', 'Steady flow', 'gives', 'ok')],
      },
    ],
  },
  {
    id: 'pipeline',
    label: 'pipe versus pipeline',
    title: 'Errors and cleanup',
    frames: [
      {
        note: 'readable.pipe(writable) wires the backpressure loop, but it does not forward errors. If the source fails, the destination stays open and waiting. If the destination closes early, the source keeps its file handle. Each stream needs its own error handler, and forgetting one leaks resources.',
        boxes: [b('s', 'Source errors', ['file read fails'], 'bad'), b('d', 'Destination stays open', ['never ends'], 'bad'), b('l', 'Leaked handles', ['descriptors, memory'], 'bad')],
        deps: [d('Source errors', 'Destination stays open', 'pipe ignores it', 'bad'), d('Destination stays open', 'Leaked handles', 'causes', 'bad')],
      },
      {
        note: 'stream.pipeline chains any number of streams, applies backpressure, and on an error or an early close it destroys every stream in the chain. Its promise version from node:stream/promises resolves when the last stream finishes and rejects with the first error.',
        boxes: [b('p', 'pipeline(a, b, c)', ['chains and waits'], 'new'), b('e', 'First error', ['from any stream'], 'warn'), b('x', 'All streams destroyed', ['handles released'], 'ok')],
        deps: [d('pipeline(a, b, c)', 'First error', 'catches', 'warn'), d('First error', 'All streams destroyed', 'cleans up', 'ok')],
      },
      {
        note: 'A client that disconnects mid-download closes the response. Pipeline notices, destroys the file read stream and the gzip transform, and rejects with ERR_STREAM_PREMATURE_CLOSE. Pass an AbortSignal to stop a pipeline from outside, for example on a timeout.',
        boxes: [b('c', 'Client disconnects', ['browser tab closed'], 'warn'), b('p', 'Pipeline rejects', ['premature close'], 'bad'), b('f', 'File handle closed', ['no leak'], 'ok')],
        deps: [d('Client disconnects', 'Pipeline rejects', 'detected', 'warn'), d('Pipeline rejects', 'File handle closed', 'destroys', 'ok')],
      },
    ],
  },
  {
    id: 'real',
    label: 'A real export',
    title: 'Database to browser, never all in memory',
    frames: [
      {
        note: 'A statement export with 2 million rows. Loading them all with SELECT into an array needs gigabytes and delays the first byte until the query ends. A cursor reads the rows in batches and exposes them as a Readable in object mode.',
        boxes: [b('a', 'Load all rows', ['array of 2 million'], 'bad'), b('c', 'Database cursor', ['500 rows per fetch'], 'new'), b('r', 'Readable of rows', ['object mode'], 'ok')],
        deps: [d('Database cursor', 'Readable of rows', 'exposed as', 'ok')],
      },
      {
        note: 'A Transform turns each row object into one line of NDJSON or CSV. Because it works one row at a time, its memory use is constant. A gzip Transform then compresses the text on the fly, so the download is smaller.',
        boxes: [b('r', 'Row objects', ['one at a time'], 'ok'), b('t', 'Format transform', ['row to CSV line'], 'new'), b('g', 'Gzip transform', ['compress chunks'], 'new')],
        deps: [d('Row objects', 'Format transform', 'then', 'ok'), d('Format transform', 'Gzip transform', 'then', 'ok')],
      },
      {
        note: 'The last writable is the HTTP response. The browser starts receiving data after the first batch, and the response is sent with chunked transfer encoding because the total size is unknown. If the user cancels, the whole pipeline is destroyed and the database cursor is closed.',
        boxes: [b('g', 'Gzip output', ['compressed bytes'], 'ok'), b('h', 'HTTP response', ['chunked transfer'], 'new'), b('u', 'Browser download', ['starts at once'], 'ok')],
        deps: [d('Gzip output', 'HTTP response', 'written to', 'ok'), d('HTTP response', 'Browser download', 'streams to', 'ok')],
      },
    ],
  },
];
