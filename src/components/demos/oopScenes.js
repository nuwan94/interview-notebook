// Frame data for the OOP walk-through demo (method lookup, overloads and constructors), drawn by OopStage.
// class.state: checked | searching | passed | found | actual | active | waiting | done.
// method.state: checked | found | miss. method.order: the step number in the constructor scene.

const m = (sig, state, order) => ({ sig, state, order });
const cls = (name, parent, methods, state) => ({ name, parent, methods, state });

// ---------- which method runs ----------
const product = (price, describe, state) => cls('Product', null, [m('price()', price), m('describe()', describe)], state);
const perishable = (price, state) => cls('Perishable', 'Product', [m('price()', price)], state);
const frozen = (methods, state) => cls('FrozenItem', 'Perishable', methods, state);
const P = { n: 'p', declared: 'Product', actual: 'FrozenItem' };

// ---------- overload versus override ----------
const printer = (a, b, state) => cls('Printer', null, [m('print(Product)', a), m('print(Perishable)', b)], state);
const oProduct = (state) => cls('Product', null, [m('describe()')], state);
const oPerishable = (d, state) => cls('Perishable', 'Product', [m('describe()', d)], state);
const P2 = { n: 'p', declared: 'Product', actual: 'Perishable' };

// ---------- constructor order ----------
const ctor = (name, parent, f, c, state) => cls(name, parent, [m('fields', f && 'found', f), m('constructor', c && 'found', c)], state);
const parts = (a, b, c) => ({
  sections: [
    { cls: 'Product', field: a ? 'name = "peas"' : 'name = null', set: a },
    { cls: 'Perishable', field: b ? 'shelfDays = 90' : 'shelfDays = 0', set: b },
    { cls: 'FrozenItem', field: c ? 'tag = "frozen"' : 'tag = null', set: c },
  ],
});

export const OOP_SCENES = [
  {
    id: 'dispatch',
    label: 'Which method runs?',
    title: 'Dynamic dispatch: the object decides, not the variable',
    code: ['Product p = new FrozenItem("peas");', 'p.price();', 'p.describe();'],
    frames: [
      {
        line: -1,
        note: 'There are three classes. Perishable extends Product and overrides price(). FrozenItem extends Perishable and overrides describe().',
        classes: [product(), perishable(), frozen([m('describe()')])],
      },
      {
        line: 0,
        note: 'The variable p has the declared type Product. The object it points to is a FrozenItem. Polymorphism uses exactly this gap between the two types.',
        classes: [product(), perishable(), frozen([m('describe()')], 'actual')],
        vars: [P],
        focus: ['FrozenItem'],
      },
      {
        line: 1,
        note: 'At compile time, the compiler only looks at the declared type, Product. Product has a price() method, so the line compiles.',
        classes: [product('checked', undefined, 'checked'), perishable(), frozen([m('describe()')])],
        vars: [P],
        arrows: { compile: ['compile time:', 'check Product'] },
        focus: ['Product'],
        result: { text: 'it compiles', tone: 'ok' },
      },
      {
        line: 1,
        note: 'At run time, the JVM starts looking at the real class of the object, FrozenItem. FrozenItem has no price() of its own, so the search moves up to its parent.',
        classes: [product(), perishable(), frozen([m('describe()'), m('no price()', 'miss')], 'searching')],
        vars: [P],
        arrows: { run: ['run time: start', 'at real class'] },
        up: ['FrozenItem'],
        upLabel: 'not here: look in the parent',
        focus: ['FrozenItem', 'Perishable'],
      },
      {
        line: 1,
        note: 'Perishable has price(), so its version runs, not the one in Product. The override closest to the real class always wins.',
        classes: [product(), perishable('found', 'found'), frozen([m('describe()'), m('no price()', 'miss')], 'passed')],
        vars: [P],
        arrows: { run: ['run time: start', 'at real class'] },
        up: ['FrozenItem'],
        upLabel: 'not here: look in the parent',
        focus: ['FrozenItem', 'Perishable'],
        result: { text: 'Perishable.price() runs', tone: 'ok' },
      },
      {
        line: 2,
        note: 'Next, p.describe(). The compiler again checks only Product, and Product has describe().',
        classes: [product(undefined, 'checked', 'checked'), perishable(), frozen([m('describe()')])],
        vars: [P],
        arrows: { compile: ['compile time:', 'check Product'] },
        focus: ['Product'],
        result: { text: 'it compiles', tone: 'ok' },
      },
      {
        line: 2,
        note: 'At run time, FrozenItem has its own describe(), so the search stops at once. The same variable ran code from two different classes.',
        classes: [product(), perishable(), frozen([m('describe()', 'found')], 'found')],
        vars: [P],
        arrows: { run: ['run time: start', 'at real class'] },
        focus: ['FrozenItem'],
        result: { text: 'FrozenItem.describe() runs', tone: 'ok' },
      },
    ],
  },
  {
    id: 'overload',
    label: 'Overload vs override',
    title: 'Overloads are chosen at compile time, overrides at run time',
    code: ['Product p = new Perishable("milk");', 'printer.print(p);        // which overload?', '// inside print(Product): p.describe()   // which describe?'],
    frames: [
      {
        line: -1,
        note: 'Printer has two overloads of print: one takes a Product and one takes a Perishable. Perishable extends Product and overrides describe().',
        classes: [printer(), oProduct(), oPerishable()],
      },
      {
        line: 0,
        note: 'The variable p is declared as a Product, but it holds a Perishable.',
        classes: [printer(), oProduct(), oPerishable(undefined, 'actual')],
        vars: [P2],
        focus: ['Perishable'],
      },
      {
        line: 1,
        note: 'The compiler picks the overload from the declared type of the argument, which is Product. print(Product) fits. print(Perishable) does not, because a Product is not always a Perishable. This choice is fixed before the program runs.',
        classes: [printer('found', 'miss', 'checked'), oProduct(), oPerishable()],
        vars: [P2],
        arrows: { compile: ['compiler sees', 'type Product'] },
        focus: ['Printer'],
        result: { text: 'print(Product) is chosen', tone: 'warn' },
      },
      {
        line: 2,
        note: 'Inside print(Product), the call p.describe() is an override. It is decided at run time from the real object, so Perishable.describe() runs.',
        classes: [printer(), oProduct(), oPerishable('found', 'found')],
        vars: [P2],
        arrows: { run: ['run time:', 'real object'] },
        focus: ['Perishable'],
        result: { text: 'Perishable.describe() runs', tone: 'ok' },
      },
      {
        line: 2,
        note: 'The rule to remember: an overload is chosen from the declared types of the arguments. An override is chosen from the real class of the object. Mixing these up is a classic interview trap.',
        classes: [printer('found', undefined), oProduct(), oPerishable('found')],
        vars: [P2],
        arrows: { compile: ['overload:', 'declared type'], run: ['override:', 'real class'] },
      },
    ],
  },
  {
    id: 'init',
    label: 'Constructor order',
    title: 'new FrozenItem(): parents are built first',
    code: ['new FrozenItem("peas");'],
    frames: [
      {
        line: -1,
        note: 'Each class has a field with a starting value and a constructor. In which order do they run?',
        classes: [ctor('Product', null), ctor('Perishable', 'Product'), ctor('FrozenItem', 'Perishable')],
      },
      {
        line: 0,
        note: 'First, Java reserves memory for the whole object. The object has one part for each class. Every field starts at its default value: null, 0 or false.',
        classes: [ctor('Product', null), ctor('Perishable', 'Product'), ctor('FrozenItem', 'Perishable')],
        object: parts(false, false, false),
      },
      {
        line: 0,
        note: 'The FrozenItem constructor is called. Its first statement is super(...), written by you or added by the compiler, so control goes up to the parent before anything else runs.',
        classes: [ctor('Product', null), ctor('Perishable', 'Product'), ctor('FrozenItem', 'Perishable', 0, 0, 'waiting')],
        object: parts(false, false, false),
        up: ['FrozenItem'],
        upLabel: 'super(...) first',
        upTone: 'new',
      },
      {
        line: 0,
        note: 'The Perishable constructor also starts with super(...), so control goes up again, to Product.',
        classes: [ctor('Product', null), ctor('Perishable', 'Product', 0, 0, 'waiting'), ctor('FrozenItem', 'Perishable', 0, 0, 'waiting')],
        object: parts(false, false, false),
        up: ['FrozenItem', 'Perishable'],
        upLabel: 'super(...) first',
        upTone: 'new',
      },
      {
        line: 0,
        note: 'Product runs first: its field values, then its constructor body. (Object, above Product, has already finished.)',
        classes: [ctor('Product', null, 1, 2, 'done'), ctor('Perishable', 'Product', 0, 0, 'waiting'), ctor('FrozenItem', 'Perishable', 0, 0, 'waiting')],
        object: parts(true, false, false),
        focus: ['Product'],
      },
      {
        line: 0,
        note: 'Back in Perishable: its field values are set, then the rest of its constructor runs.',
        classes: [ctor('Product', null, 1, 2, 'done'), ctor('Perishable', 'Product', 3, 4, 'done'), ctor('FrozenItem', 'Perishable', 0, 0, 'waiting')],
        object: parts(true, true, false),
        focus: ['Perishable'],
      },
      {
        line: 0,
        note: 'Finally FrozenItem finishes. The order is always parent first, child last. So never call an overridable method from a constructor: the child version could run before the child fields are set.',
        classes: [ctor('Product', null, 1, 2, 'done'), ctor('Perishable', 'Product', 3, 4, 'done'), ctor('FrozenItem', 'Perishable', 5, 6, 'done')],
        object: parts(true, true, true),
        result: { text: 'parent first, child last', tone: 'ok' },
      },
    ],
  },
];
