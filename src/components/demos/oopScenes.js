// Frame data for the OOP walk-through demo (method lookup, overloads and constructors).
// class.state: active | searching | found | done. method.state: checked | found | miss.

const m = (sig, state) => ({ sig, state });
const cls = (name, parent, methods, state, extra) => ({ name, parent, methods, state, ...extra });

const product = (methods, state, extra) => cls('Product', null, methods, state, extra);

export const OOP_SCENES = [
  {
    id: 'dispatch',
    label: 'Which method runs?',
    title: 'Dynamic dispatch: the object decides, not the variable',
    code: ['Product p = new FrozenItem("peas");', 'p.price();', 'p.describe();'],
    frames: [
      {
        line: -1,
        note: 'Three classes: Product, Perishable (extends Product, overrides price) and FrozenItem (extends Perishable, overrides describe). Both price() and describe() exist in Product.',
        classes: [
          product([m('price()'), m('describe()')]),
          cls('Perishable', 'Product', [m('price()')]),
          cls('FrozenItem', 'Perishable', [m('describe()')]),
        ],
        vars: [],
      },
      {
        line: 0,
        note: 'The variable p has the declared type Product, but the object it refers to is a FrozenItem. The two types are different, and that gap is what polymorphism uses.',
        classes: [product([m('price()'), m('describe()')]), cls('Perishable', 'Product', [m('price()')]), cls('FrozenItem', 'Perishable', [m('describe()')], 'active')],
        vars: [{ n: 'p', declared: 'Product', actual: 'FrozenItem' }],
      },
      {
        line: 1,
        note: 'Compile time: the compiler checks that the declared type, Product, has a method price(). It does, so the line compiles. It only ever looks at the declared type.',
        classes: [product([m('price()', 'checked'), m('describe()')]), cls('Perishable', 'Product', [m('price()')]), cls('FrozenItem', 'Perishable', [m('describe()')])],
        vars: [{ n: 'p', declared: 'Product', actual: 'FrozenItem' }],
      },
      {
        line: 1,
        note: 'Run time: the JVM starts the search at the actual class of the object, FrozenItem. It has no price(), so the search moves up to the parent.',
        classes: [product([m('price()'), m('describe()')]), cls('Perishable', 'Product', [m('price()')]), cls('FrozenItem', 'Perishable', [m('describe()', 'miss')], 'searching')],
        vars: [{ n: 'p', declared: 'Product', actual: 'FrozenItem' }],
      },
      {
        line: 1,
        note: 'Perishable has price(), so that version runs, not Product\'s. The overriding method closest to the actual class wins.',
        classes: [product([m('price()'), m('describe()')]), cls('Perishable', 'Product', [m('price()', 'found')], 'found'), cls('FrozenItem', 'Perishable', [m('describe()')])],
        vars: [{ n: 'p', declared: 'Product', actual: 'FrozenItem' }],
        result: 'Perishable.price() ran',
      },
      {
        line: 2,
        note: 'p.describe(): the compiler again only checks Product, which has describe().',
        classes: [product([m('price()'), m('describe()', 'checked')]), cls('Perishable', 'Product', [m('price()')]), cls('FrozenItem', 'Perishable', [m('describe()')])],
        vars: [{ n: 'p', declared: 'Product', actual: 'FrozenItem' }],
      },
      {
        line: 2,
        note: 'At run time FrozenItem itself overrides describe(), so the search ends at once and FrozenItem.describe() runs. The same call on the same variable ran code from two different classes.',
        classes: [product([m('price()'), m('describe()')]), cls('Perishable', 'Product', [m('price()')]), cls('FrozenItem', 'Perishable', [m('describe()', 'found')], 'found')],
        vars: [{ n: 'p', declared: 'Product', actual: 'FrozenItem' }],
        result: 'FrozenItem.describe() ran',
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
        note: 'Printer has two overloads of print: one for Product and one for Perishable. Perishable extends Product and overrides describe().',
        classes: [
          cls('Printer', null, [m('print(Product)'), m('print(Perishable)')]),
          product([m('describe()')]),
          cls('Perishable', 'Product', [m('describe()')]),
        ],
        vars: [],
      },
      {
        line: 0,
        note: 'p is declared as Product but holds a Perishable.',
        classes: [cls('Printer', null, [m('print(Product)'), m('print(Perishable)')]), product([m('describe()')]), cls('Perishable', 'Product', [m('describe()')], 'active')],
        vars: [{ n: 'p', declared: 'Product', actual: 'Perishable' }],
      },
      {
        line: 1,
        note: 'Compile time: to pick an overload the compiler uses the declared type of the argument, Product. print(Product) fits. print(Perishable) does not, because a Product is not necessarily a Perishable. The choice is fixed here.',
        classes: [cls('Printer', null, [m('print(Product)', 'found'), m('print(Perishable)', 'miss')], 'found'), product([m('describe()')]), cls('Perishable', 'Product', [m('describe()')])],
        vars: [{ n: 'p', declared: 'Product', actual: 'Perishable' }],
        result: 'print(Product) chosen',
      },
      {
        line: 2,
        note: 'Inside print(Product), the call p.describe() is an override, so it is decided at run time from the actual object. Perishable.describe() runs.',
        classes: [cls('Printer', null, [m('print(Product)'), m('print(Perishable)')]), product([m('describe()')]), cls('Perishable', 'Product', [m('describe()', 'found')], 'found')],
        vars: [{ n: 'p', declared: 'Product', actual: 'Perishable' }],
        result: 'Perishable.describe() ran',
      },
      {
        line: 2,
        note: 'The rule to remember: overloading looks at the declared (compile-time) types of the arguments; overriding looks at the actual (run-time) type of the receiver. Mixing them up is a classic interview trap.',
        classes: [cls('Printer', null, [m('print(Product)'), m('print(Perishable)')]), product([m('describe()')]), cls('Perishable', 'Product', [m('describe()')])],
        vars: [{ n: 'p', declared: 'Product', actual: 'Perishable' }],
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
        note: 'Each class has a constructor and a field with an initial value. The question: in which order do they run?',
        classes: [product([m('fields'), m('constructor')]), cls('Perishable', 'Product', [m('fields'), m('constructor')]), cls('FrozenItem', 'Perishable', [m('fields'), m('constructor')])],
        log: [],
      },
      {
        line: 0,
        note: 'The FrozenItem constructor is called. Its first statement is an implicit (or explicit) super(...) call, so before anything else of its own runs, control goes up.',
        classes: [product([m('fields'), m('constructor')]), cls('Perishable', 'Product', [m('fields'), m('constructor')]), cls('FrozenItem', 'Perishable', [m('fields'), m('constructor')], 'active')],
        log: [],
      },
      {
        line: 0,
        note: 'Perishable\'s constructor also begins with super(...), so control reaches the top of the hierarchy: Product.',
        classes: [product([m('fields'), m('constructor')]), cls('Perishable', 'Product', [m('fields'), m('constructor')], 'active'), cls('FrozenItem', 'Perishable', [m('fields'), m('constructor')])],
        log: [],
      },
      {
        line: 0,
        note: 'Product runs first: its field initialisers, then its constructor body. Object (above Product) has already run.',
        classes: [product([m('fields', 'found'), m('constructor', 'found')], 'done'), cls('Perishable', 'Product', [m('fields'), m('constructor')]), cls('FrozenItem', 'Perishable', [m('fields'), m('constructor')])],
        log: ['Product fields', 'Product constructor'],
      },
      {
        line: 0,
        note: 'Back in Perishable: its field initialisers run, then the rest of its constructor body.',
        classes: [product([m('fields', 'found'), m('constructor', 'found')], 'done'), cls('Perishable', 'Product', [m('fields', 'found'), m('constructor', 'found')], 'done'), cls('FrozenItem', 'Perishable', [m('fields'), m('constructor')])],
        log: ['Product fields', 'Product constructor', 'Perishable fields', 'Perishable constructor'],
      },
      {
        line: 0,
        note: 'Finally FrozenItem finishes. The order is always top-down: parent before child. This is why calling an overridable method from a constructor is dangerous: the child\'s override can run before the child\'s fields are initialised.',
        classes: [product([m('fields', 'found'), m('constructor', 'found')], 'done'), cls('Perishable', 'Product', [m('fields', 'found'), m('constructor', 'found')], 'done'), cls('FrozenItem', 'Perishable', [m('fields', 'found'), m('constructor', 'found')], 'done')],
        log: ['Product fields', 'Product constructor', 'Perishable fields', 'Perishable constructor', 'FrozenItem fields', 'FrozenItem constructor'],
      },
    ],
  },
];
