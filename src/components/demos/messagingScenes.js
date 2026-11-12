// Frame data for the messaging walk-through (box-and-arrow player with icons). Broker-agnostic.
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const MESSAGING_SCENES = [
  {
    id: 'models',
    label: 'Queue vs publish/subscribe',
    title: 'Point-to-point queue: one consumer per message. Publish/subscribe: every subscriber gets a copy',
    frames: [
      {
        note: 'A producer puts messages on a queue. The producer does not know who will process them or when, and it does not wait.',
        boxes: [b('p', 'Producer', ['sends m1, m2, m3, m4'], 'new'), b('q', 'Task queue', ['m1 m2 m3 m4'], 'ok', 'queue')],
        deps: [d('Producer', 'Task queue', 'send (does not wait)', 'ok')],
      },
      {
        note: 'Two consumers read from the same queue: competing consumers. Each message goes to exactly one of them, so adding consumers shares the load. This is how you scale processing and smooth out bursts.',
        boxes: [b('q', 'Task queue', ['m3 m4 waiting'], 'ok'), b('c1', 'Consumer 1', ['processing m1'], 'new'), b('c2', 'Consumer 2', ['processing m2'], 'new')],
        deps: [d('Task queue', 'Consumer 1', 'm1', 'ok'), d('Task queue', 'Consumer 2', 'm2', 'ok')],
      },
      {
        note: 'Publish/subscribe works differently: a publisher announces a fact (TransferCompleted) to a topic. Each interested service has its own subscription and receives its own copy. The publisher does not know the subscribers, so new ones can be added without changing it.',
        boxes: [b('p', 'Publisher', ['TransferCompleted'], 'new'), b('t', 'Transfers topic', ['fan-out to every subscription'], 'ok', 'topic'), b('l', 'Ledger service', ['gets a copy'], 'ok'), b('n', 'Notification service', ['gets a copy'], 'ok'), b('a', 'Audit service', ['gets a copy'], 'ok')],
        deps: [d('Publisher', 'Transfers topic', 'publish once', 'ok'), d('Transfers topic', 'Ledger service', 'copy', 'ok'), d('Transfers topic', 'Notification service', 'copy', 'ok'), d('Transfers topic', 'Audit service', 'copy', 'ok')],
      },
      {
        note: 'The two models combine: each subscriber has its own queue, and the instances of that subscriber compete on it (a consumer group). So three Notification instances share the notification copy, while Ledger and Audit still get theirs.',
        boxes: [b('t', 'Transfers topic', ['one copy per subscription'], 'ok'), b('n1', 'Notification service A', ['takes message 1'], 'new'), b('n2', 'Notification service B', ['takes message 2'], 'new'), b('l', 'Ledger service', ['has its own queue'], 'ok')],
        deps: [d('Transfers topic', 'Notification service A', 'competing on one subscription', 'ok'), d('Transfers topic', 'Notification service B', 'competing on one subscription', 'ok')],
      },
    ],
  },
  {
    id: 'ack',
    label: 'Acknowledgement and duplicates',
    title: 'At-least-once delivery: a lost acknowledgement means the message is delivered again',
    frames: [
      {
        note: 'The broker delivers message m7 ("debit account A by 50") to a consumer. It does not delete it yet: it keeps it as unacknowledged until the consumer confirms.',
        boxes: [b('q', 'Message broker', ['m7 delivered, waiting for ack'], 'warn', 'in flight'), b('c', 'Consumer 1', ['received m7'], 'new')],
        deps: [d('Message broker', 'Consumer 1', 'deliver m7', 'ok')],
      },
      {
        note: 'The consumer does the work (the debit is committed in its database) but crashes before it can send the acknowledgement. From the broker\'s point of view nothing is known.',
        boxes: [b('c', 'Consumer 1', ['debit committed', 'crashed before ack'], 'bad', 'crashed'), b('q', 'Message broker', ['no ack arrives'], 'warn')],
        deps: [d('Consumer 1', 'Message broker', 'ack never sent', 'bad')],
      },
      {
        note: 'The connection closes (or the visibility timeout passes), so the broker assumes the message was not handled and delivers m7 again, to another consumer. This is at-least-once delivery: safer than losing a message, but duplicates are normal.',
        boxes: [b('q', 'Message broker', ['redelivers m7'], 'warn', 'redelivery'), b('c2', 'Consumer 2', ['receives m7 again'], 'new')],
        deps: [d('Message broker', 'Consumer 2', 'deliver m7 (second time)', 'ok')],
      },
      {
        note: 'If Consumer 2 simply debits again, the customer pays twice. The consumer must be idempotent: it records processed message ids in the same transaction as its work.',
        boxes: [b('c2', 'Consumer 2', ['debit again?'], 'bad', 'double debit'), b('d', 'Accounts database', ['balance reduced by 100 instead of 50'], 'bad')],
        deps: [d('Consumer 2', 'Accounts database', 'debit 50 (second time)', 'bad')],
      },
      {
        note: 'With an idempotent receiver the consumer looks up m7 in a processed-messages table, finds it, skips the work and just acknowledges. The effect happens once even though the delivery happened twice.',
        boxes: [b('c2', 'Consumer 2', ['m7 already processed', 'skips and acknowledges'], 'ok', 'idempotent'), b('d', 'Accounts database', ['balance reduced by 50'], 'ok'), b('q', 'Message broker', ['m7 removed'], 'ok')],
        deps: [d('Consumer 2', 'Accounts database', 'lookup message id', 'ok'), d('Consumer 2', 'Message broker', 'ack', 'ok')],
      },
    ],
  },
  {
    id: 'dlq',
    label: 'Retries and dead letters',
    title: 'A poison message must not block the queue: retry with backoff, then park it',
    frames: [
      {
        note: 'Message m9 has a malformed payload. Every attempt to process it throws an exception. If the broker redelivers it immediately and forever, it blocks the consumer and burns CPU: a poison message.',
        boxes: [b('q', 'Payment queue', ['m9 (malformed)', 'm10 m11 waiting'], 'warn'), b('c', 'Consumer 1', ['fails on m9', 'attempt 1'], 'bad', 'error')],
        deps: [d('Payment queue', 'Consumer 1', 'm9', 'bad')],
      },
      {
        note: 'Retries are spaced out with exponential backoff (1 s, 10 s, 1 min), often through a delay or retry queue, so a temporary problem (a database that is briefly down) can recover. Other messages keep flowing meanwhile.',
        boxes: [b('r', 'Retry queue', ['m9 waits 10 s', 'attempt 2 of 3'], 'warn', 'delayed'), b('c', 'Consumer 1', ['processes m10, m11'], 'ok')],
        deps: [d('Consumer 1', 'Retry queue', 'm9 failed, retry later', 'warn'), d('Retry queue', 'Payment queue', 'back after the delay', 'ok')],
      },
      {
        note: 'After the maximum number of attempts the message is moved to a dead-letter queue, with headers recording the error and the attempt count. The main queue is healthy again.',
        boxes: [b('dl', 'Dead-letter queue', ['m9 + error: bad JSON', 'attempts: 3'], 'bad', 'parked'), b('q', 'Payment queue', ['flowing normally'], 'ok')],
        deps: [d('Consumer 1', 'Dead-letter queue', 'give up after 3 attempts', 'bad')],
      },
      {
        note: 'An alert fires on the dead-letter queue depth. An engineer inspects the message, fixes the bug or the data, and redrives the message back to the main queue. Never ignore a dead-letter queue.',
        boxes: [b('e', 'Engineer', ['fixes the bug', 'redrives m9'], 'ok'), b('dl', 'Dead-letter queue', ['m9 sent back'], 'ok'), b('q', 'Payment queue', ['m9 processed successfully'], 'ok', 'recovered')],
        deps: [d('Engineer', 'Dead-letter queue', 'inspect and redrive', 'ok'), d('Dead-letter queue', 'Payment queue', 'm9', 'ok')],
      },
    ],
  },
  {
    id: 'ordering',
    label: 'Ordering',
    title: 'Order is only guaranteed per queue or key, and parallel consumers can break it',
    frames: [
      {
        note: 'Two messages about account A are produced in order: deposit 100, then withdraw 50. Two consumers compete on the same queue, and they work in parallel.',
        boxes: [b('p', 'Producer', ['1: deposit 100', '2: withdraw 50 (account A)'], 'new'), b('q', 'Task queue', ['msg 1, msg 2'], 'ok'), b('c1', 'Consumer 1', ['takes msg 1 (slow)'], 'new'), b('c2', 'Consumer 2', ['takes msg 2 (fast)'], 'new')],
        deps: [d('Task queue', 'Consumer 1', 'msg 1', 'ok'), d('Task queue', 'Consumer 2', 'msg 2', 'ok')],
      },
      {
        note: 'Consumer 2 finishes first, so the withdrawal is applied before the deposit and is rejected for insufficient funds. Competing consumers destroy ordering, and the final result depends on timing.',
        boxes: [b('c2', 'Consumer 2', ['withdraw 50 on balance 0'], 'bad', 'rejected'), b('c1', 'Consumer 1', ['deposit 100 applied afterwards'], 'warn')],
        deps: [d('Consumer 2', 'Accounts database', 'withdraw first', 'bad')],
      },
      {
        note: 'The fix is to route by key: all messages with the same key (the account id) go to the same queue or partition and are handled by one consumer at a time. Messages of one account stay in order, and different accounts still run in parallel.',
        boxes: [b('p', 'Producer', ['key = account A'], 'new'), b('q', 'Message broker', ['hash(key) chooses the queue', 'account A -> queue 1'], 'ok', 'keyed'), b('c1', 'Consumer 1', ['owns queue 1: msg 1, then msg 2'], 'ok', 'in order'), b('c2', 'Consumer 2', ['owns queue 2: other accounts'], 'ok')],
        deps: [d('Producer', 'Message broker', 'send with a key', 'ok'), d('Message broker', 'Consumer 1', 'msg 1, msg 2 in order', 'ok')],
      },
      {
        note: 'Retries can still reorder: if msg 1 fails and is retried later, msg 2 overtakes it. Defend with sequence or version numbers in the message: a consumer that sees a gap waits or rejects, and an older version is ignored.',
        boxes: [b('c1', 'Consumer 1', ['sees version 2 before version 1', 'parks it until version 1 arrives'], 'warn', 'gap detected'), b('q', 'Message broker', ['msg 1 retried after backoff'], 'warn')],
        deps: [d('Message broker', 'Consumer 1', 'msg 2, then the retried msg 1', 'warn')],
      },
    ],
  },
];
