// Frame data for the Spring messaging walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_MSG_SCENES = [
  {
    id: 'listener',
    label: 'Listener and acknowledgement',
    title: 'When a Spring listener acknowledges a message decides what happens on failure',
    frames: [
      {
        note: 'A @KafkaListener (or @RabbitListener) method consumes TransferCompleted events. The container polls the broker, deserialises the message and calls your method on a listener thread.',
        boxes: [b('k', 'Message broker', ['topic transfers', 'offset 41: TransferCompleted'], 'ok'), b('l', 'Listener bean', ['@KafkaListener(topics = "transfers")'], 'new')],
        deps: [d('Message broker', 'Listener bean', 'deliver offset 41', 'ok')],
      },
      {
        note: 'If the method returns normally, the container acknowledges (commits the offset), and the broker will not redeliver. This is at-least-once delivery: the acknowledgement happens after processing, so a crash in between means the message is processed again.',
        boxes: [b('l', 'Listener bean', ['processed successfully'], 'ok'), b('k', 'Message broker', ['offset 41 committed'], 'ok', 'acknowledged')],
        deps: [d('Listener bean', 'Message broker', 'acknowledge', 'ok')],
      },
      {
        note: 'If the method throws, the container does not commit. The configured error handler retries with a backoff (for example 3 attempts, 1 s apart). Meanwhile this message blocks later messages on the same partition, so transient errors are fine but a permanently bad message is a problem.',
        boxes: [b('l', 'Listener bean', ['throws on offset 42', 'retry 1 of 3'], 'warn', 'retrying'), b('k', 'Message broker', ['offset 42 not committed', 'redelivered'], 'warn')],
        deps: [d('Message broker', 'Listener bean', 'redeliver after backoff', 'warn')],
      },
      {
        note: 'After the retries are exhausted, a poison message (malformed or unprocessable) must not block the partition forever. The error handler publishes it to a dead-letter topic with the exception details, commits the offset and moves on. Operators inspect and replay dead letters later.',
        boxes: [b('l', 'Listener bean', ['gave up on offset 42'], 'bad'), b('d', 'Dead letter queue', ['transfers.DLT', 'message + exception + headers'], 'warn', 'parked'), b('k', 'Message broker', ['offset 42 committed, continues with 43'], 'ok')],
        deps: [d('Listener bean', 'Dead letter queue', 'publish', 'warn')],
      },
    ],
  },
  {
    id: 'idempotent',
    label: 'Idempotent consumer',
    title: 'At-least-once delivery means the same message can arrive twice',
    frames: [
      {
        note: 'The listener processes message id m-77 ("credit account A by 50"): it updates the balance and then crashes before the offset is committed.',
        boxes: [b('l', 'Listener bean', ['credit A by 50', 'crash before ack'], 'bad'), b('d', 'Database', ['A = 150 (credited once)'], 'ok')],
        deps: [d('Listener bean', 'Database', 'update', 'ok')],
      },
      {
        note: 'After the restart the broker redelivers m-77 because it was never acknowledged. A naive listener credits again: the account ends at 200 and the customer received 50 too much.',
        boxes: [b('k', 'Message broker', ['redeliver m-77'], 'warn'), b('l', 'Listener bean', ['credit A by 50 again'], 'bad'), b('d', 'Database', ['A = 200 (wrong)'], 'bad', 'double credit')],
        deps: [d('Message broker', 'Listener bean', 'm-77 again', 'warn')],
      },
      {
        note: 'Fix: record processed message ids in a table with a unique constraint, in the same transaction as the business update. On redelivery the insert violates the constraint, the listener recognises a duplicate and skips the work.',
        boxes: [b('l', 'Listener bean', ['INSERT processed_message(m-77)', 'unique violation: duplicate'], 'ok'), b('d', 'Database', ['A = 150, unchanged'], 'ok', 'exactly-once effect')],
        deps: [d('Message broker', 'Listener bean', 'm-77 again', 'warn'), d('Listener bean', 'Database', 'skip', 'ok')],
      },
      {
        note: 'The producer side needs care too. Writing to the database and sending a message are two systems, so use the transactional outbox: save the event in an outbox table within the business transaction and let a relay publish it. Together, outbox plus idempotent consumer give effectively-once processing.',
        boxes: [b('t', 'Transaction A', ['business row + outbox row in one transaction'], 'ok', 'atomic'), b('r', 'Message relay', ['reads outbox, publishes'], 'ok'), b('k', 'Message broker', ['at-least-once'], 'ok')],
        deps: [d('Message relay', 'Message broker', 'publish', 'ok')],
      },
    ],
  },
  {
    id: 'partition',
    label: 'Partitions and ordering',
    title: 'Messages with the same key stay in order; consumers in a group share the partitions',
    frames: [
      {
        note: 'A topic is split into partitions. The producer picks the partition from the message key (hash of the account id). All events for account A go to partition 0 and all events for account B to partition 1, so each account\'s events stay in order.',
        boxes: [b('p', 'Producer bean', ['key = accountId'], 'new'), b('k', 'Message broker', ['partition 0: account A events', 'partition 1: account B events'], 'ok')],
        deps: [d('Producer bean', 'Message broker', 'hash(key) picks partition', 'ok')],
      },
      {
        note: 'Consumers with the same group id form a consumer group, and each partition is read by exactly one consumer in the group. Two instances split the two partitions: ordering per key is kept and the work is shared.',
        boxes: [b('k', 'Message broker', ['partition 0', 'partition 1'], 'ok'), b('c1', 'Consumer instance 1', ['owns partition 0'], 'ok'), b('c2', 'Consumer instance 2', ['owns partition 1'], 'ok')],
        deps: [d('Message broker', 'Consumer instance 1', 'partition 0', 'ok'), d('Message broker', 'Consumer instance 2', 'partition 1', 'ok')],
      },
      {
        note: 'Adding a third instance does nothing when there are only two partitions: parallelism is capped by the partition count. Plan partitions for the peak parallelism you will need, since increasing them later changes the key-to-partition mapping.',
        boxes: [b('c1', 'Consumer instance 1', ['partition 0'], 'ok'), b('c2', 'Consumer instance 2', ['partition 1'], 'ok'), b('c3', 'Consumer instance 3', ['idle: no partition left'], 'warn', 'idle')],
        deps: [],
      },
      {
        note: 'If an instance dies, the group rebalances: its partition is assigned to a surviving consumer, which resumes from the last committed offset. Messages after that offset are redelivered, which is one more reason consumers must be idempotent.',
        boxes: [b('c2', 'Consumer instance 2', ['crashed'], 'bad'), b('c1', 'Consumer instance 1', ['takes over partition 1', 'resumes at last committed offset'], 'ok', 'rebalanced')],
        deps: [d('Message broker', 'Consumer instance 1', 'rebalance', 'warn')],
      },
    ],
  },
];
