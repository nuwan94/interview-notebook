// Frame data for the "Resilience" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const RESILIENCE_SCENES = [
  {
    id: 'timeouts',
    label: 'Timeouts and retries',
    title: 'Never wait forever, and retry carefully',
    frames: [
      {
        note: 'The payment service calls the card service with no timeout. The card service becomes slow instead of failing. Every call now waits, and each waiting call holds a thread of the payment service.',
        boxes: [b('p', 'Payment service', ['threads all waiting'], 'bad', 'no timeout'), b('c', 'Card service', ['slow, not down'], 'warn')],
        deps: [d('Payment service', 'Card service', 'waits forever', 'bad')],
      },
      {
        note: 'With a timeout of one second the payment service gives up quickly, frees its thread and can return an error or a fallback. The rule: every remote call has a connect timeout and a read timeout, and the total must fit inside the time the user will wait.',
        boxes: [b('p', 'Payment service', ['timeout 1 s'], 'ok', 'fails fast'), b('c', 'Card service', ['slow'], 'warn')],
        deps: [d('Payment service', 'Card service', 'gives up after 1 s', 'ok')],
      },
      {
        note: 'Many failures are brief, so a retry often works. Retry with exponential backoff (wait 100 ms, 200 ms, 400 ms) and jitter (a random part added), so that many callers do not retry at the same instant. Retry only calls that are safe to repeat, which means idempotent ones.',
        boxes: [b('p', 'Payment service', ['attempt 1, 2, 3'], 'new', 'backoff + jitter'), b('c', 'Card service', ['recovers on attempt 3'], 'ok')],
        deps: [d('Payment service', 'Card service', 'retry with a growing wait', 'ok')],
      },
      {
        note: 'Retries can cause a retry storm. If three layers each retry three times, one user request can become 27 calls to the failing service at the moment it is struggling. Retry at one layer only, cap the number of retries, and use a retry budget (for example at most 10 percent extra calls).',
        boxes: [b('g', 'API gateway', ['retries 3 times'], 'bad'), b('p', 'Payment service', ['retries 3 times'], 'bad'), b('c', 'Card service', ['27 calls for 1 request'], 'bad', 'overloaded')],
        deps: [d('API gateway', 'Payment service', 'x3', 'bad'), d('Payment service', 'Card service', 'x3 each', 'bad')],
      },
    ],
  },
  {
    id: 'breaker',
    label: 'Circuit breaker',
    title: 'Stop calling a service that keeps failing',
    frames: [
      {
        note: 'Closed is the normal state. Calls pass through and the breaker counts successes and failures over a sliding window, for example the last 20 calls or the last 10 seconds.',
        boxes: [b('p', 'Payment service', ['calls pass through'], 'ok'), b('x', 'Closed', ['counting failures'], 'ok', 'normal'), b('c', 'Card service', ['healthy'], 'ok')],
        deps: [d('Payment service', 'Closed', 'call', 'ok'), d('Closed', 'Card service', 'forward', 'ok')],
      },
      {
        note: 'When the failure rate passes a threshold, say 50 percent, the breaker opens. For the next 30 seconds calls are not sent at all: they fail immediately or return a fallback. That spares the sick service and the caller\'s threads.',
        boxes: [b('p', 'Payment service', ['gets an instant error or fallback'], 'warn'), b('x', 'Open', ['failure rate 60 percent'], 'bad', 'fail fast'), b('c', 'Card service', ['left alone to recover'], 'warn')],
        deps: [d('Payment service', 'Open', 'call', 'warn'), d('Open', 'Card service', 'blocked', 'bad')],
      },
      {
        note: 'After the wait the breaker becomes half-open and lets a few trial calls through. If they succeed, the dependency has recovered; if they fail, the breaker opens again for another wait.',
        boxes: [b('p', 'Payment service', ['a few trial calls'], 'new'), b('x', 'Half-open', ['testing recovery'], 'warn', 'probing'), b('c', 'Card service', ['answers the trials'], 'ok')],
        deps: [d('Payment service', 'Half-open', 'trial call', 'warn'), d('Half-open', 'Card service', 'forward', 'ok')],
      },
      {
        note: 'When the trials succeed the breaker closes and normal traffic resumes. Tune it per dependency: the window, the threshold, the wait time, and which exceptions count as failures. A client error such as 404 should not trip the breaker.',
        boxes: [b('p', 'Payment service', ['normal again'], 'ok'), b('x', 'Closed', ['recovered'], 'ok', 'normal'), b('c', 'Card service', ['healthy'], 'ok')],
        deps: [d('Payment service', 'Closed', 'call', 'ok'), d('Closed', 'Card service', 'forward', 'ok')],
      },
    ],
  },
  {
    id: 'bulkhead',
    label: 'Bulkheads',
    title: 'Keep one slow dependency from using all your resources',
    frames: [
      {
        note: 'The payment service uses one shared pool of 50 threads for everything it calls. The card service becomes slow and its calls hold threads for seconds.',
        boxes: [b('p', 'Payment service', ['one pool of 50 threads'], 'bad'), b('c', 'Card service', ['slow'], 'warn'), b('a', 'Account service', ['healthy'], 'ok')],
        deps: [d('Payment service', 'Card service', 'holds threads', 'bad'), d('Payment service', 'Account service', 'no free thread', 'bad')],
      },
      {
        note: 'All 50 threads end up waiting for the card service, so even calls to the healthy account service cannot get one. One slow dependency has taken down the whole payment service. This is the cascading failure a bulkhead prevents.',
        boxes: [b('p', 'Payment service', ['pool exhausted'], 'bad', 'blocked'), b('a', 'Account service', ['healthy but unreachable'], 'warn'), b('u', 'Customer', ['everything times out'], 'bad')],
        deps: [d('Customer', 'Payment service', 'request', 'bad'), d('Payment service', 'Account service', 'cannot call', 'bad')],
      },
      {
        note: 'A bulkhead (named after the walls in a ship\'s hull) gives each dependency its own limited pool or a cap on concurrent calls. Calls to the card service can use at most 10 threads. The rest are rejected quickly.',
        boxes: [b('p', 'Payment service', ['separate limits'], 'ok'), b('c', 'Card pool', ['max 10 at once'], 'warn', 'limited'), b('a', 'Account pool', ['max 20 at once'], 'ok')],
        deps: [d('Payment service', 'Card pool', 'card calls', 'warn'), d('Payment service', 'Account pool', 'account calls', 'ok')],
      },
      {
        note: 'Now the slow card service can only use its own ten threads. Account calls still work and the service keeps running, perhaps with a degraded card feature. Bulkheads, timeouts and breakers are used together.',
        boxes: [b('p', 'Payment service', ['still responsive'], 'ok'), b('c', 'Card pool', ['full, rejecting fast'], 'warn'), b('a', 'Account pool', ['working normally'], 'ok')],
        deps: [d('Payment service', 'Card pool', 'rejected quickly', 'warn'), d('Payment service', 'Account pool', 'works', 'ok')],
      },
    ],
  },
  {
    id: 'load',
    label: 'Load shedding',
    title: 'When overloaded, refuse some work to protect the rest',
    frames: [
      {
        note: 'A flood of requests arrives, more than the service can handle. Without limits it queues everything. The queue grows, every request waits longer, response times exceed the clients\' timeouts, and the work is wasted because the callers have already given up.',
        boxes: [b('u', 'Clients', ['3000 requests per second'], 'new'), b('q', 'Request queue', ['growing without limit'], 'bad', 'overload'), b('s', 'Payment service', ['capacity 1000 per second'], 'warn')],
        deps: [d('Clients', 'Request queue', 'too many', 'bad'), d('Request queue', 'Payment service', 'slow drain', 'warn')],
      },
      {
        note: 'Load shedding rejects excess requests early with 429 (too many requests) or 503, keeping the queue short. The requests that are accepted are served quickly. It is better to serve 1000 well and refuse 2000 than to serve nobody.',
        boxes: [b('u', 'Clients', ['3000 requests per second'], 'new'), b('l', 'Load shedder', ['bounded queue, rejects extra'], 'ok', 'protects'), b('s', 'Payment service', ['serves 1000 per second'], 'ok')],
        deps: [d('Clients', 'Load shedder', 'requests', 'ok'), d('Load shedder', 'Payment service', 'accepted', 'ok')],
      },
      {
        note: 'Shed by priority. Payments and logins keep working; reports, exports and background refreshes are refused first. Rate limits per client stop one noisy caller from using everyone\'s capacity, and a Retry-After header tells good clients when to try again.',
        boxes: [b('p', 'Payment request', ['high priority'], 'ok', 'kept'), b('r', 'Report export', ['low priority'], 'warn', 'shed'), b('l', 'Load shedder', ['priority rules'], 'ok')],
        deps: [d('Payment request', 'Load shedder', 'accepted', 'ok'), d('Report export', 'Load shedder', '429 Retry-After', 'warn')],
      },
      {
        note: 'Backpressure passes the pressure back to the caller instead of absorbing it: a full queue says "slow down", a reactive stream requests only as much as it can process, and a message consumer reads at its own pace. Autoscaling then adds capacity, but it takes time, so shedding covers the gap.',
        boxes: [b('c', 'Consumer', ['reads only what it can handle'], 'ok'), b('k', 'Kafka topic', ['buffers the backlog'], 'ok', 'absorbs spikes'), b('h', 'Autoscaler', ['adds instances in a minute'], 'new')],
        deps: [d('Consumer', 'Kafka topic', 'pulls at its own pace', 'ok'), d('Autoscaler', 'Consumer', 'scales out', 'ok')],
      },
    ],
  },
  {
    id: 'degrade',
    label: 'Graceful degradation',
    title: 'Return less, not nothing',
    frames: [
      {
        note: 'The account summary screen needs balances, recent transactions and personal offers from three services. If the offers service fails and the page waits for all three, the whole screen fails because of the least important part.',
        boxes: [b('u', 'Customer', ['opens the summary'], 'new'), b('a', 'Summary service', ['needs all three'], 'bad', 'all or nothing'), b('o', 'Offers service', ['down'], 'bad')],
        deps: [d('Customer', 'Summary service', 'request', 'new'), d('Summary service', 'Offers service', 'fails', 'bad')],
      },
      {
        note: 'Graceful degradation separates essential data from optional data. Balances are essential: if they fail, the call fails. Offers are optional: if they fail, the service returns the page without them, or with a default, and marks the section as unavailable.',
        boxes: [b('a', 'Summary service', ['balances required', 'offers optional'], 'ok', 'partial result'), b('b', 'Balance service', ['essential'], 'ok'), b('o', 'Offers service', ['optional, skipped'], 'warn')],
        deps: [d('Summary service', 'Balance service', 'required', 'ok'), d('Summary service', 'Offers service', 'fallback: empty list', 'warn')],
      },
      {
        note: 'Other fallbacks: serve a cached value, which is stale but useful, for example yesterday\'s exchange rates; use a default; queue the action for later and tell the user it is pending; or switch to a simpler feature. Choose fallbacks with the business, and never fall back in ways that are unsafe, such as approving a payment without a fraud check.',
        boxes: [b('s', 'Rates service', ['down'], 'bad'), b('c', 'Redis cache', ['yesterday\'s rates'], 'warn', 'stale but safe'), b('p', 'Payment service', ['uses cached rates for a quote'], 'ok')],
        deps: [d('Payment service', 'Rates service', 'fails', 'bad'), d('Payment service', 'Redis cache', 'fallback', 'warn')],
      },
    ],
  },
];
