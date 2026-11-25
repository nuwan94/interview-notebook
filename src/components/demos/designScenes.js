// Frame data for the SOLID and design-pattern walk-throughs. Every scene is drawn by UmlStage: class cards and
// arrows at fixed positions, planned so that no arrow crosses a card.
// card: { id, x, y, w, title, kind, lines, tone, badge }. arrow: { from, fs, ff, to, ts, tf, kind, tone, label }.
// tone: ok | bad | warn | new | none.

import { UmlStage } from './UmlStage.jsx';

const card = (id, x, y, w, title, lines = [], extra = {}) => ({ id, x, y, w, title, lines, ...extra });
const mark = (t, m) => ({ t, mark: m });

// ---------- SOLID ----------

// single responsibility: four teams on the left, each asking for a different kind of change
const ACTORS = [
  ['fin', 'Finance', 'changes tax rules'],
  ['mkt', 'Marketing', 'changes the invoice'],
  ['ops', 'Operations', 'changes email sender'],
  ['dba', 'Database team', 'changes the tables'],
];
const actorY = (i) => 30 + i * 68;
const actors = ACTORS.map(([id, title, line], i) => card(id, 16, actorY(i), 160, title, [line], { kind: 'actor' }));
const OM_LINES = ['calculateTotal(): tax rules', 'renderInvoicePdf(): layout', 'sendConfirmationEmail(): SMTP', 'save(): SQL'];
const omCard = (tone, badge, marked) =>
  card('om', 250, 106, 260, 'OrderManager', OM_LINES.map((l) => (marked ? mark(l, 'bad') : l)), { tone, badge });
// each team's arrow points at the line of OrderManager it would change
const omArrows = ACTORS.map(([id], i) => ({ from: id, fs: 'r', to: 'om', ts: 'l', tf: (37 + i * 17) / 102, straight: true, tone: 'bad' }));
const SPLIT = [
  ['order', 'Order', 'totals and tax rules'],
  ['inv', 'InvoiceRenderer', 'PDF layout'],
  ['note', 'OrderNotifier', 'emails'],
  ['repo', 'OrderRepository', 'saving to the database'],
];
const splitCards = (tone) => SPLIT.map(([id, title, line], i) => card(id, 250, actorY(i), 196, title, [line], { tone }));
const splitArrows = ACTORS.map(([id], i) => ({ from: id, fs: 'r', to: SPLIT[i][0], ts: 'l', tone: 'ok' }));

// open/closed: the shipping switch, then one class per delivery type
const SWITCH = ['double shipping(Order o) {', '  switch (o.deliveryType()) {', '    case STANDARD: return 4.0;', '    case EXPRESS:  return 9.0;', '    case BULKY:    return 15.0;'];
const checkoutUser = card('co', 430, 90, 180, 'Checkout', ['calls shipping(o)']);
const IMPLS = [
  ['std', 'Standard', 'returns 4.0', 40],
  ['exp', 'Express', 'returns 9.0', 190],
  ['blk', 'Bulky', 'returns 15.0', 340],
  ['drn', 'Drone', 'returns 12.0', 490],
];
const policyCard = card('sp', 290, 40, 230, 'ShippingPolicy', ['cost(order)'], { kind: 'interface', tone: 'ok' });
const implCard = ([id, title, line, x], tone, badge) => card(id, x, 200, 120, title, [line], { tone, badge });
const implArrow = ([id], i) => ({
  from: id, fs: 't', to: 'sp', ts: 'b', tf: [0.13, 0.37, 0.63, 0.87][i], straight: true, kind: 'implements', tone: 'ok',
  ...(id === 'blk' ? { label: 'implements', labelAt: [420, 150] } : {}),
});

// dependency inversion: two layers, business code above and details below
const DIP_BANDS = [
  { label: 'Business code (high level)', y: 10, h: 140 },
  { label: 'Details (low level)', y: 166, h: 144 },
];
const pgCard = card('pg', 370, 46, 230, 'PaymentGateway', ['charge(amount, card)'], { kind: 'interface', tone: 'ok' });

export const SOLID_SCENES = [
  {
    id: 'srp',
    label: 'Single responsibility',
    title: 'One class, one reason to change',
    stage: UmlStage,
    frames: [
      {
        h: 300,
        cards: [omCard('bad', 'one class, 4 jobs')],
        arrows: [],
        note: 'OrderManager does four jobs. It calculates the total, draws the PDF invoice, sends the email and saves the order.',
      },
      {
        h: 300,
        cards: [...actors, omCard('bad', '4 reasons to change', true)],
        arrows: omArrows,
        result: { text: 'four teams edit one file', tone: 'bad' },
        note: 'Four different teams ask for changes, and every change lands in the same class. Their edits collide, and one change can break another job.',
      },
      {
        h: 300,
        cards: [...actors, ...splitCards('ok')],
        arrows: splitArrows,
        result: { text: 'one reason to change each', tone: 'ok' },
        note: 'Split the class by reason to change. Now each team changes only its own class.',
      },
      {
        h: 300,
        cards: [...actors, ...splitCards('ok'), card('svc', 494, 140, 132, 'OrderService', ['place(order)'], { tone: 'warn', badge: 'coordinates' })],
        arrows: [
          ...splitArrows,
          ...SPLIT.map(([id], i) => ({ from: 'svc', fs: 'l', ff: 0.2 + i * 0.2, to: id, ts: 'r', straight: true, tone: 'new' })),
        ],
        result: { text: 'small parts, tested alone', tone: 'ok' },
        note: 'A thin OrderService calls the four classes in the right order. Each class can now be read, tested and changed on its own.',
      },
    ],
  },
  {
    id: 'ocp',
    label: 'Open/closed',
    title: 'Add a feature by adding code, not by editing code',
    stage: UmlStage,
    frames: [
      {
        h: 300,
        cards: [card('calc', 40, 50, 300, 'ShippingCalculator', [...SWITCH, '  }', '}'], { kind: 'code' }), checkoutUser],
        arrows: [{ from: 'co', fs: 'l', to: 'calc', ts: 'r', tf: 0.3, tone: 'none' }],
        note: 'One method picks the shipping price with a switch on the delivery type.',
      },
      {
        h: 300,
        cards: [
          card('calc', 40, 50, 300, 'ShippingCalculator', [...SWITCH, mark('    case DRONE:    return 12.0;', 'bad'), '  }', '}'], { kind: 'code', tone: 'bad', badge: 'edited again' }),
          checkoutUser,
        ],
        arrows: [{ from: 'co', fs: 'l', to: 'calc', ts: 'r', tf: 0.3, tone: 'none' }],
        result: { text: 'tested code edited', tone: 'bad' },
        note: 'The business adds drone delivery. You must edit a method that is already tested and in production, so every other case is at risk again.',
      },
      {
        h: 300,
        cards: [card('co', 16, 47, 180, 'Checkout', ['uses a ShippingPolicy'], { tone: 'warn' }), policyCard, ...IMPLS.slice(0, 3).map((x) => implCard(x, 'ok'))],
        arrows: [{ from: 'co', fs: 'r', to: 'sp', ts: 'l', tone: 'ok', label: 'depends on' }, ...IMPLS.slice(0, 3).map(implArrow)],
        note: 'Refactor once. A ShippingPolicy interface has one method, and each delivery type is a small class that implements it. Checkout only knows the interface.',
      },
      {
        h: 300,
        cards: [
          card('co', 16, 47, 180, 'Checkout', ['uses a ShippingPolicy'], { tone: 'ok' }),
          policyCard,
          ...IMPLS.slice(0, 3).map((x) => implCard(x, 'ok')),
          implCard(IMPLS[3], 'new', 'new class'),
        ],
        arrows: [{ from: 'co', fs: 'r', to: 'sp', ts: 'l', tone: 'ok', label: 'depends on' }, ...IMPLS.map(implArrow)],
        focus: ['drn', 'sp', 'drn>sp:implements'],
        result: { text: 'nothing else edited', tone: 'ok' },
        note: 'Drone delivery is now one new class. Checkout, Standard, Express and Bulky do not change. The code is open for extension and closed for modification.',
      },
    ],
  },
  {
    id: 'dip',
    label: 'Dependency inversion',
    title: 'Depend on the abstraction, not the detail',
    stage: UmlStage,
    frames: [
      {
        h: 320,
        bands: DIP_BANDS,
        cards: [
          card('cs', 40, 53, 240, 'CheckoutService', ['creates new StripeGateway()'], { tone: 'warn' }),
          card('sg', 40, 214, 240, 'StripeGateway', ['HTTP calls to Stripe'], { tone: 'warn' }),
        ],
        arrows: [{ from: 'cs', fs: 'b', to: 'sg', ts: 't', tone: 'bad', label: 'depends on a concrete class' }],
        note: 'CheckoutService holds the business rules. It creates a StripeGateway itself with new, so the business code depends on a low-level detail.',
      },
      {
        h: 320,
        bands: DIP_BANDS,
        cards: [
          card('cs', 40, 53, 240, 'CheckoutService', ['creates new StripeGateway()'], { tone: 'bad', badge: 'hard to test' }),
          card('sg', 40, 214, 240, 'StripeGateway', ['HTTP calls to Stripe'], { tone: 'warn' }),
        ],
        arrows: [{ from: 'cs', fs: 'b', to: 'sg', ts: 't', tone: 'bad', label: 'depends on a concrete class' }],
        result: { text: 'tests need the real Stripe', tone: 'bad' },
        note: 'The cost: a test of checkout calls Stripe, and changing the payment provider means editing business code.',
      },
      {
        h: 320,
        bands: DIP_BANDS,
        cards: [
          card('cs', 40, 53, 240, 'CheckoutService', ['uses a PaymentGateway'], { tone: 'ok' }),
          pgCard,
          card('sg', 390, 220, 190, 'StripeGateway', ['HTTP calls to Stripe'], { tone: 'ok' }),
        ],
        arrows: [
          { from: 'cs', fs: 'r', to: 'pg', ts: 'l', tone: 'ok', label: 'depends on' },
          { from: 'sg', fs: 't', to: 'pg', ts: 'b', tf: 0.5, kind: 'implements', tone: 'ok', label: 'implements' },
        ],
        note: 'Add a PaymentGateway interface on the business side. CheckoutService depends on it, and StripeGateway implements it. The arrow from the detail now points up: that is the inversion.',
      },
      {
        h: 320,
        bands: DIP_BANDS,
        cards: [
          card('cs', 40, 53, 240, 'CheckoutService', ['gets it in the constructor'], { tone: 'ok' }),
          pgCard,
          card('fg', 150, 220, 190, 'FakeGateway', ['for tests, no network'], { tone: 'new', badge: 'new' }),
          card('sg', 390, 220, 190, 'StripeGateway', ['for production'], { tone: 'ok' }),
        ],
        arrows: [
          { from: 'cs', fs: 'r', to: 'pg', ts: 'l', tone: 'ok', label: 'depends on' },
          { from: 'sg', fs: 't', to: 'pg', ts: 'b', tf: 0.5, kind: 'implements', tone: 'ok', label: 'implements' },
          { from: 'fg', fs: 't', to: 'pg', ts: 'b', tf: 0.13, straight: true, kind: 'implements', tone: 'new' },
        ],
        result: { text: 'tests pass in a FakeGateway', tone: 'ok' },
        note: 'CheckoutService receives its gateway in the constructor. This is dependency injection. Spring passes in StripeGateway, and a test passes in FakeGateway.',
      },
    ],
  },
];

// ---------- design patterns ----------

// strategy: the cart holds one discount rule and calls it through the interface
const cartCard = (lines, tone = 'warn') => card('cart', 24, 40, 250, 'Cart', lines, { tone });
const strategyCard = card('ds', 380, 41.5, 230, 'DiscountStrategy', ['apply(total)'], { kind: 'interface', tone: 'ok' });
const pctCard = (tone, lines = ['total x 0.9']) => card('pct', 290, 200, 150, 'PercentOff(10)', lines, { tone });
const loyCard = (tone, lines = ['total - 15.00']) => card('loy', 460, 200, 160, 'LoyaltyTier(GOLD)', lines, { tone });
const strategyArrows = [
  { from: 'cart', fs: 'r', to: 'ds', ts: 'l', tone: 'ok', label: 'delegates to' },
  { from: 'pct', fs: 't', to: 'ds', ts: 'b', tf: 0.3, straight: true, kind: 'implements', tone: 'ok' },
  { from: 'loy', fs: 't', to: 'ds', ts: 'b', tf: 0.7, straight: true, kind: 'implements', tone: 'ok' },
];
const holdsPct = { id: 'holds-pct', from: 'cart', fs: 'b', ff: 0.3, to: 'pct', ts: 'l', tone: 'new', label: 'holds' };
// the arrow to the second rule passes under the first one, so it never crosses a card
const holdsLoy = { id: 'holds-loy', points: [[99, 108], [99, 276], [540, 276], [540, 251]], tone: 'new', label: 'holds', labelAt: [320, 269] };

// observer: OrderService keeps a list of listeners and calls each one
const LISTENERS = [
  ['email', 'EmailListener', 'sends a confirmation'],
  ['stock', 'InventoryListener', 'reserves the stock'],
  ['stats', 'AnalyticsListener', 'records the sale'],
  ['loyal', 'LoyaltyListener', 'awards points'],
];
const listenerCard = ([id, title, line], i, tone, marked, badge) =>
  card(id, 400, 24 + i * 68, 220, title, [marked ? mark(line, 'new') : line], { tone, badge });
const serviceCard = (lines, tone = 'warn', badge) => card('svc', 24, 90, 240, 'OrderService', lines, { tone, badge });
const listEntry = (i, m) => (m ? mark(`• ${LISTENERS[i][1]}`, m) : `• ${LISTENERS[i][1]}`);

// decorator: each wrapper sits around the next one, and a call passes through every wall
const caller = card('caller', 14, 145, 118, 'Caller', ['calls send()', 'on a Notifier']);
const emailCard = (tone = 'ok', badge) => card('email', 450, 80, 160, 'EmailNotifier', ['sends the email'], { tone, h: 150, badge });
const loggingCard = (tone = 'new', badge) =>
  card('log', 310, 55, 310, 'LoggingNotifier', ['logs how long', 'the call took'], { kind: 'wrap', tone, h: 200, sepW: 140, badge });
const retryCard = (tone = 'new', badge) =>
  card('retry', 160, 30, 470, 'RetryingNotifier', ['tries again if', 'the call fails'], { kind: 'wrap', tone, h: 250, sepW: 150, badge });
const call = (id, x1, x2, tone, label) => ({ id, points: [[x1, 170], [x2, 170]], tone, label });
const back = (id, x1, x2, tone, label) => ({ id, points: [[x1, 205], [x2, 205]], tone, label });

export const PATTERN_SCENES = [
  {
    id: 'strategy',
    label: 'Strategy',
    title: 'Strategy: swap the rule without touching the caller',
    stage: UmlStage,
    frames: [
      {
        h: 300,
        cards: [cartCard(['discount: DiscountStrategy', 'total() calls discount.apply()']), strategyCard, pctCard('none'), loyCard('none')],
        arrows: strategyArrows,
        note: 'Cart needs a discount rule. It does not hard-code one. It holds a DiscountStrategy, an interface with one method, and two rules implement it.',
      },
      {
        h: 300,
        line: 'Cart cart = new Cart(new PercentOff(10));',
        cards: [cartCard([mark('discount = PercentOff(10)', 'new'), 'total() calls discount.apply()']), strategyCard, pctCard('new'), loyCard('none')],
        arrows: [...strategyArrows, holdsPct],
        note: 'During a sale, the cart gets the PercentOff(10) rule.',
      },
      {
        h: 300,
        line: 'cart.total()',
        cards: [cartCard(['discount = PercentOff(10)', mark('total(): 100.00 -> 90.00', 'ok')]), strategyCard, pctCard('new', [mark('total x 0.9', 'ok')]), loyCard('none')],
        arrows: [...strategyArrows, holdsPct],
        result: { text: '90.00', tone: 'ok' },
        focus: ['cart', 'pct', 'holds-pct'],
        note: 'Cart calls apply() through the interface. It does not know which rule runs, and it has no if/else on the rule type.',
      },
      {
        h: 300,
        line: 'new Cart(new LoyaltyTier(GOLD)).total()',
        cards: [cartCard([mark('discount = LoyaltyTier(GOLD)', 'new'), mark('total(): 100.00 -> 85.00', 'ok')]), strategyCard, pctCard('none'), loyCard('new', [mark('total - 15.00', 'ok')])],
        arrows: [...strategyArrows, holdsLoy],
        result: { text: '85.00', tone: 'ok' },
        focus: ['cart', 'loy', 'holds-loy'],
        note: 'A gold customer gets the LoyaltyTier rule instead. The Cart class did not change. A new rule is just a new class, or a lambda.',
      },
    ],
  },
  {
    id: 'observer',
    label: 'Observer',
    title: 'Observer: one event, many independent listeners',
    stage: UmlStage,
    frames: [
      {
        h: 300,
        cards: [serviceCard(['listeners: (empty)']), ...LISTENERS.slice(0, 3).map((l, i) => listenerCard(l, i, 'none'))],
        arrows: [],
        note: 'OrderService does not know who cares about a new order. It only keeps a list of listeners, which is empty for now.',
      },
      {
        h: 300,
        cards: [
          serviceCard(['listeners:', listEntry(0, 'new'), listEntry(1, 'new'), listEntry(2, 'new')]),
          ...LISTENERS.slice(0, 3).map((l, i) => listenerCard(l, i, 'ok')),
        ],
        // each arrow points at the listener's entry in the list
        arrows: LISTENERS.slice(0, 3).map(([id], i) => ({ from: id, fs: 'l', to: 'svc', ts: 'r', tf: (54 + i * 17) / 102, straight: true, tone: 'ok', ...(i === 0 ? { label: 'subscribe', labelAt: [312, 72] } : {}) })),
        note: 'Three listeners subscribe. OrderService adds each one to its list. The list holds the OrderListener interface, not the concrete classes.',
      },
      {
        h: 300,
        line: 'orderService.place(order)',
        cards: [
          serviceCard(['listeners:', listEntry(0), listEntry(1), listEntry(2)], 'new'),
          ...LISTENERS.slice(0, 3).map((l, i) => listenerCard(l, i, 'new', true)),
        ],
        arrows: LISTENERS.slice(0, 3).map(([id], i) => ({ from: 'svc', fs: 'r', ff: 0.25 + i * 0.25, to: id, ts: 'l', straight: true, tone: 'new', ...(i === 1 ? { label: 'onPlaced(order)', labelAt: [318, 122] } : {}) })),
        result: { text: '3 listeners reacted', tone: 'ok' },
        note: 'An order is placed. OrderService loops over its list and calls onPlaced on each listener. Each one reacts in its own way.',
      },
      {
        h: 300,
        line: 'orderService.place(order)',
        cards: [
          serviceCard(['listeners:', listEntry(0), listEntry(1), listEntry(2), listEntry(3, 'new')], 'ok', 'not edited'),
          ...LISTENERS.slice(0, 3).map((l, i) => listenerCard(l, i, 'ok')),
          listenerCard(LISTENERS[3], 3, 'new', true, 'new class'),
        ],
        arrows: LISTENERS.map(([id], i) => ({ from: 'svc', fs: 'r', ff: 0.2 + i * 0.2, to: id, ts: 'l', straight: true, tone: i === 3 ? 'new' : 'ok' })),
        note: 'A fourth reaction is one new class and one subscribe call. OrderService is not edited. The price: the flow is harder to follow, and a slow listener must not hold up the others.',
      },
    ],
  },
  {
    id: 'decorator',
    label: 'Decorator',
    title: 'Decorator: add behaviour by wrapping',
    stage: UmlStage,
    frames: [
      {
        h: 300,
        cards: [caller, emailCard('ok', 'a Notifier')],
        arrows: [call('c-e', 132, 450, 'none', 'send()')],
        note: 'The caller only knows the Notifier interface. Right now the notifier is an EmailNotifier.',
      },
      {
        h: 300,
        line: 'new LoggingNotifier(new EmailNotifier())',
        cards: [caller, loggingCard('new', 'also a Notifier'), emailCard()],
        arrows: [call('c-l', 132, 310, 'none', 'send()'), call('l-e', 318, 450, 'none', 'next.send()')],
        note: 'Wrap it in a LoggingNotifier. It implements Notifier too and holds the next notifier. It does its extra work, then passes the call on. The caller cannot tell the difference.',
      },
      {
        h: 300,
        line: 'new RetryingNotifier(new LoggingNotifier(new EmailNotifier()))',
        cards: [caller, retryCard('new', 'also a Notifier'), loggingCard('ok'), emailCard()],
        arrows: [call('c-r', 132, 160, 'none'), call('r-l', 168, 310, 'none', 'next.send()'), call('l-e', 318, 450, 'none', 'next.send()')],
        note: 'Wrap again with a RetryingNotifier. The behaviours are combined while the program runs, with no subclass for each combination.',
      },
      {
        h: 300,
        line: 'notifier.send("Your order has shipped")',
        cards: [caller, retryCard('new'), loggingCard('new'), emailCard('new')],
        arrows: [call('c-r', 132, 160, 'new'), call('r-l', 168, 310, 'new', 'next.send()'), call('l-e', 318, 450, 'new', 'next.send()')],
        note: 'One call to send() goes in through every layer: first retry, then logging, then the email itself.',
      },
      {
        h: 300,
        line: 'notifier.send("Your order has shipped")',
        cards: [caller, retryCard('ok'), loggingCard('ok'), emailCard('ok')],
        arrows: [
          call('c-r', 132, 160, 'none'),
          call('r-l', 168, 310, 'none', 'next.send()'),
          call('l-e', 318, 450, 'none', 'next.send()'),
          back('e-l', 450, 318, 'ok', 'returns'),
          back('l-r', 310, 168, 'ok', 'returns'),
          back('r-c', 160, 132, 'ok'),
        ],
        result: { text: 'email sent, logged, retried if needed', tone: 'ok' },
        note: 'The result comes back out the same way. java.io works like this too: new BufferedReader(new InputStreamReader(in)).',
      },
    ],
  },
];
