// Frame data for the SOLID and design-pattern walk-throughs.
// A frame shows boxes (classes) and dependencies between them.
// box.tone: bad | ok | new | warn | (none). dep.tone: bad | ok | (none). dep.label describes the arrow.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SOLID_SCENES = [
  {
    id: 'srp',
    label: 'Single responsibility',
    title: 'One class, one reason to change',
    frames: [
      {
        note: 'OrderManager does everything: it calculates totals, builds PDF invoices, sends emails and saves to the database. A change to any of those four things means editing this class.',
        boxes: [b('om', 'OrderManager', ['calculate total', 'render PDF invoice', 'send confirmation email', 'save to database'], 'bad', '4 reasons to change')],
        deps: [],
      },
      {
        note: 'A tax-rule change, a new invoice layout, a new email provider and a database migration all touch the same file, collide in version control and risk breaking each other. That is the smell the principle names.',
        boxes: [b('om', 'OrderManager', ['calculate total', 'render PDF invoice', 'send confirmation email', 'save to database'], 'bad', 'edited for every change')],
        deps: [],
      },
      {
        note: 'Split it by reason to change. Order keeps the business rules. InvoiceRenderer, Notifier and OrderRepository each own one concern.',
        boxes: [
          b('o', 'Order', ['totals, status, rules'], 'ok', '1 reason'),
          b('i', 'InvoiceRenderer', ['PDF layout'], 'ok', '1 reason'),
          b('n', 'Notifier', ['emails'], 'ok', '1 reason'),
          b('r', 'OrderRepository', ['persistence'], 'ok', '1 reason'),
        ],
        deps: [],
      },
      {
        note: 'A thin OrderService coordinates them. Each class can now be understood, tested and changed alone, and a new email provider only touches Notifier.',
        boxes: [
          b('s', 'OrderService', ['orchestrates the steps'], 'warn', 'coordinates'),
          b('o', 'Order', ['totals, status, rules'], 'ok'),
          b('i', 'InvoiceRenderer', ['PDF layout'], 'ok'),
          b('n', 'Notifier', ['emails'], 'ok'),
          b('r', 'OrderRepository', ['persistence'], 'ok'),
        ],
        deps: [d('OrderService', 'Order', 'uses'), d('OrderService', 'InvoiceRenderer', 'uses'), d('OrderService', 'Notifier', 'uses'), d('OrderService', 'OrderRepository', 'uses')],
      },
    ],
  },
  {
    id: 'ocp',
    label: 'Open/closed',
    title: 'Add a feature by adding code, not by editing code',
    frames: [
      {
        note: 'ShippingCalculator chooses a price with an if/else chain on the delivery type.',
        boxes: [b('sc', 'ShippingCalculator', ['if STANDARD: 4.00', 'else if EXPRESS: 9.00', 'else if BULKY: 15.00'], 'warn', 'one big method')],
        deps: [],
      },
      {
        note: 'The business adds drone delivery. You must edit ShippingCalculator, which is already tested and in production, and every other path through the method is at risk. The class is open to change, the opposite of closed.',
        boxes: [b('sc', 'ShippingCalculator', ['if STANDARD: 4.00', 'else if EXPRESS: 9.00', 'else if BULKY: 15.00', 'else if DRONE: 12.00'], 'bad', 'edited again')],
        deps: [],
      },
      {
        note: 'Refactor once: a ShippingPolicy interface, and one small class per delivery type. The checkout depends only on the interface.',
        boxes: [
          b('cp', 'Checkout', ['uses a ShippingPolicy'], 'warn'),
          b('sp', 'ShippingPolicy', ['cost(order)'], 'ok', 'interface'),
          b('st', 'Standard', ['4.00'], 'ok'),
          b('ex', 'Express', ['9.00'], 'ok'),
          b('bk', 'Bulky', ['15.00'], 'ok'),
        ],
        deps: [d('Checkout', 'ShippingPolicy', 'depends on', 'ok'), d('Standard', 'ShippingPolicy', 'implements'), d('Express', 'ShippingPolicy', 'implements'), d('Bulky', 'ShippingPolicy', 'implements')],
      },
      {
        note: 'Now drone delivery is a new class that implements ShippingPolicy. Checkout, Standard, Express and Bulky are not touched at all: open for extension, closed for modification.',
        boxes: [
          b('cp', 'Checkout', ['unchanged'], 'ok'),
          b('sp', 'ShippingPolicy', ['unchanged'], 'ok', 'interface'),
          b('st', 'Standard', ['unchanged'], 'ok'),
          b('ex', 'Express', ['unchanged'], 'ok'),
          b('bk', 'Bulky', ['unchanged'], 'ok'),
          b('dr', 'Drone', ['12.00'], 'new', 'new class'),
        ],
        deps: [d('Drone', 'ShippingPolicy', 'implements', 'ok')],
      },
    ],
  },
  {
    id: 'dip',
    label: 'Dependency inversion',
    title: 'Depend on the abstraction, not the detail',
    frames: [
      {
        note: 'CheckoutService (high-level business logic) creates a StripeGateway (a low-level detail) directly with new. The arrow of dependency points from policy to detail.',
        boxes: [b('cs', 'CheckoutService', ['new StripeGateway()'], 'warn', 'high-level'), b('sg', 'StripeGateway', ['HTTP calls to Stripe'], 'warn', 'low-level')],
        deps: [d('CheckoutService', 'StripeGateway', 'depends on a concrete class', 'bad')],
      },
      {
        note: 'Consequences: you cannot test checkout without calling Stripe, you cannot switch provider without editing business code, and the business rules are tied to an HTTP library.',
        boxes: [b('cs', 'CheckoutService', ['new StripeGateway()'], 'bad', 'hard to test'), b('sg', 'StripeGateway', ['HTTP calls to Stripe'], 'warn', 'low-level')],
        deps: [d('CheckoutService', 'StripeGateway', 'depends on a concrete class', 'bad')],
      },
      {
        note: 'Introduce an interface owned by the business side, PaymentGateway, and make CheckoutService depend on that.',
        boxes: [b('cs', 'CheckoutService', ['uses a PaymentGateway'], 'ok'), b('pg', 'PaymentGateway', ['charge(amount, card)'], 'ok', 'abstraction'), b('sg', 'StripeGateway', ['HTTP calls to Stripe'], 'warn')],
        deps: [d('CheckoutService', 'PaymentGateway', 'depends on', 'ok'), d('StripeGateway', 'PaymentGateway', 'implements', 'ok')],
      },
      {
        note: 'The dependency arrow from the detail now points at the abstraction: that is the inversion. A framework such as Spring injects the implementation (dependency injection), and tests inject a FakeGateway with no network.',
        boxes: [
          b('cs', 'CheckoutService', ['constructor takes a PaymentGateway'], 'ok'),
          b('pg', 'PaymentGateway', ['charge(amount, card)'], 'ok', 'abstraction'),
          b('sg', 'StripeGateway', ['production'], 'ok'),
          b('fg', 'FakeGateway', ['tests'], 'new', 'new'),
        ],
        deps: [d('CheckoutService', 'PaymentGateway', 'depends on', 'ok'), d('StripeGateway', 'PaymentGateway', 'implements', 'ok'), d('FakeGateway', 'PaymentGateway', 'implements', 'ok')],
      },
    ],
  },
];

export const PATTERN_SCENES = [
  {
    id: 'strategy',
    label: 'Strategy',
    title: 'Strategy: swap the algorithm without touching the caller',
    frames: [
      {
        note: 'A cart needs a discount. Instead of hard-coding the rule, Cart holds a DiscountStrategy: an interface with one method.',
        boxes: [b('c', 'Cart', ['has a DiscountStrategy'], 'warn'), b('s', 'DiscountStrategy', ['apply(total)'], 'ok', 'interface')],
        deps: [d('Cart', 'DiscountStrategy', 'delegates to', 'ok')],
      },
      {
        note: 'During the sale the strategy is PercentOff(10). Cart calls apply() and does not know or care which rule runs.',
        boxes: [b('c', 'Cart', ['total = 100.00'], 'warn'), b('s', 'DiscountStrategy', ['apply(total)'], 'ok', 'interface'), b('p', 'PercentOff(10)', ['total x 0.9 = 90.00'], 'new', 'chosen')],
        deps: [d('Cart', 'PercentOff(10)', 'calls through the interface', 'ok')],
      },
      {
        note: 'A loyal customer arrives, so the strategy is swapped for LoyaltyTier(gold) at run time. The Cart class is unchanged and a new rule is just a new class.',
        boxes: [b('c', 'Cart', ['total = 100.00'], 'warn'), b('s', 'DiscountStrategy', ['apply(total)'], 'ok', 'interface'), b('l', 'LoyaltyTier(gold)', ['total - 15.00 = 85.00'], 'new', 'chosen')],
        deps: [d('Cart', 'LoyaltyTier(gold)', 'calls through the interface', 'ok')],
      },
    ],
  },
  {
    id: 'observer',
    label: 'Observer',
    title: 'Observer: one event, many independent listeners',
    frames: [
      {
        note: 'OrderService does not know who cares about a placed order. Listeners register themselves with it.',
        boxes: [b('o', 'OrderService', ['subscribers: []'], 'warn'), b('e', 'EmailListener', [], 'ok'), b('i', 'InventoryListener', [], 'ok'), b('a', 'AnalyticsListener', [], 'ok')],
        deps: [],
      },
      {
        note: 'Three listeners subscribe. OrderService only keeps a list of the OrderListener interface.',
        boxes: [b('o', 'OrderService', ['subscribers: 3'], 'warn'), b('e', 'EmailListener', ['subscribed'], 'ok'), b('i', 'InventoryListener', ['subscribed'], 'ok'), b('a', 'AnalyticsListener', ['subscribed'], 'ok')],
        deps: [d('EmailListener', 'OrderService', 'subscribes', 'ok'), d('InventoryListener', 'OrderService', 'subscribes', 'ok'), d('AnalyticsListener', 'OrderService', 'subscribes', 'ok')],
      },
      {
        note: 'An order is placed: OrderService publishes one event and each listener reacts in its own way: send a confirmation, reserve stock, record the sale.',
        boxes: [b('o', 'OrderService', ['order placed: event published'], 'new', 'event'), b('e', 'EmailListener', ['send confirmation'], 'new'), b('i', 'InventoryListener', ['reserve stock'], 'new'), b('a', 'AnalyticsListener', ['record sale'], 'new')],
        deps: [d('OrderService', 'EmailListener', 'notifies', 'ok'), d('OrderService', 'InventoryListener', 'notifies', 'ok'), d('OrderService', 'AnalyticsListener', 'notifies', 'ok')],
      },
      {
        note: 'Adding a fourth reaction (a loyalty-points listener) means one new class and one subscription; OrderService is not edited. The price: the flow is harder to follow, and a slow or failing listener must not break the others.',
        boxes: [b('o', 'OrderService', ['unchanged'], 'ok'), b('e', 'EmailListener', [], 'ok'), b('i', 'InventoryListener', [], 'ok'), b('a', 'AnalyticsListener', [], 'ok'), b('l', 'LoyaltyListener', ['award points'], 'new', 'new')],
        deps: [d('OrderService', 'LoyaltyListener', 'notifies', 'ok')],
      },
    ],
  },
  {
    id: 'decorator',
    label: 'Decorator',
    title: 'Decorator: add behaviour by wrapping',
    frames: [
      {
        note: 'A Notifier interface with one implementation, EmailNotifier. Callers only use the interface.',
        boxes: [b('n', 'Notifier', ['send(message)'], 'ok', 'interface'), b('e', 'EmailNotifier', ['sends an email'], 'ok')],
        deps: [d('EmailNotifier', 'Notifier', 'implements', 'ok')],
      },
      {
        note: 'Wrap it with a LoggingNotifier. It implements Notifier too, holds another Notifier, does its extra work (log) and then delegates. Callers cannot tell the difference.',
        boxes: [b('n', 'Notifier', ['send(message)'], 'ok', 'interface'), b('l', 'LoggingNotifier', ['log, then delegate'], 'new', 'wrapper'), b('e', 'EmailNotifier', ['sends an email'], 'ok')],
        deps: [d('LoggingNotifier', 'Notifier', 'implements', 'ok'), d('LoggingNotifier', 'EmailNotifier', 'wraps', 'ok')],
      },
      {
        note: 'Wrap again: RetryingNotifier(LoggingNotifier(EmailNotifier)). One call to send() passes through retry, then logging, then the email, and the results come back out the same way. Behaviour is combined at run time with no subclass for each combination. java.io does the same: new BufferedReader(new InputStreamReader(...)).',
        boxes: [b('r', 'RetryingNotifier', ['retry on failure, then delegate'], 'new', 'wrapper'), b('l', 'LoggingNotifier', ['log, then delegate'], 'new', 'wrapper'), b('e', 'EmailNotifier', ['sends an email'], 'ok')],
        deps: [d('RetryingNotifier', 'LoggingNotifier', 'wraps', 'ok'), d('LoggingNotifier', 'EmailNotifier', 'wraps', 'ok')],
      },
    ],
  },
];
