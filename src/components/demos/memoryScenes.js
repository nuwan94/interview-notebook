// Frame data behind the memory walk-through demo.
// A frame is the complete picture after one line has run: the call stack, the heap objects and the string pool.
// A variable is { n: name, v: 'text' } for a primitive value or { n: name, ref: 'H1' } for a reference to an object.

const v = (n, val) => ({ n, v: String(val) });
const r = (n, ref) => ({ n, ref });
const s = (name, ...vars) => ({ name, vars });
const o = (id, type, body, extra = {}) => ({ id, type, body, ...extra });

export const SCENES = [
  {
    id: 'strings',
    label: 'String pool',
    title: 'Literals, new String() and intern()',
    code: [
      'String a = "hi";',
      'String b = "hi";',
      'String c = new String("hi");',
      'a == b            // ?',
      'a == c            // ?',
      'a.equals(c)       // ?',
      'String d = c.intern();',
      'a == d            // ?',
    ],
    frames: [
      { line: -1, note: 'main() starts. The stack holds only its own frame; the heap and the string pool are empty.', stack: [s('main')], heap: [], pool: [] },
      {
        line: 0,
        note: 'The literal "hi" is interned: one String object is created in the string pool, and the variable a holds a reference to it.',
        stack: [s('main', r('a', 'P1'))],
        heap: [],
        pool: [o('P1', 'String', '"hi"')],
      },
      {
        line: 1,
        note: 'The same literal again: the pool already has "hi", so b gets a reference to the same object. Nothing new is created.',
        stack: [s('main', r('a', 'P1'), r('b', 'P1'))],
        heap: [],
        pool: [o('P1', 'String', '"hi"')],
      },
      {
        line: 2,
        note: 'new String(...) always allocates a new object on the heap, outside the pool. The literal "hi" inside it is still the pooled one.',
        stack: [s('main', r('a', 'P1'), r('b', 'P1'), r('c', 'H1'))],
        heap: [o('H1', 'String', '"hi"')],
        pool: [o('P1', 'String', '"hi"')],
      },
      {
        line: 3,
        note: 'a == b compares references. Both point to P1, so the result is true.',
        stack: [s('main', r('a', 'P1'), r('b', 'P1'), r('c', 'H1'))],
        heap: [o('H1', 'String', '"hi"')],
        pool: [o('P1', 'String', '"hi"')],
        result: 'true',
      },
      {
        line: 4,
        note: 'a points to P1 and c points to H1: two different objects, so == is false even though the characters match.',
        stack: [s('main', r('a', 'P1'), r('b', 'P1'), r('c', 'H1'))],
        heap: [o('H1', 'String', '"hi"')],
        pool: [o('P1', 'String', '"hi"')],
        result: 'false',
      },
      {
        line: 5,
        note: 'equals() compares the characters, not the references, so the result is true. Always use equals() for text.',
        stack: [s('main', r('a', 'P1'), r('b', 'P1'), r('c', 'H1'))],
        heap: [o('H1', 'String', '"hi"')],
        pool: [o('P1', 'String', '"hi"')],
        result: 'true',
      },
      {
        line: 6,
        note: 'intern() looks the text up in the pool and returns the pooled object, P1. The heap copy H1 is untouched.',
        stack: [s('main', r('a', 'P1'), r('b', 'P1'), r('c', 'H1'), r('d', 'P1'))],
        heap: [o('H1', 'String', '"hi"')],
        pool: [o('P1', 'String', '"hi"')],
      },
      {
        line: 7,
        note: 'a and d are the same pooled object, so == is true.',
        stack: [s('main', r('a', 'P1'), r('b', 'P1'), r('c', 'H1'), r('d', 'P1'))],
        heap: [o('H1', 'String', '"hi"')],
        pool: [o('P1', 'String', '"hi"')],
        result: 'true',
      },
    ],
  },
  {
    id: 'frames',
    label: 'Stack and heap',
    title: 'Stack frames, references and objects',
    code: [
      'void main() {',
      '  int count = 3;',
      '  Order o = new Order(7);',
      '  ship(o, count);',
      '}',
      'void ship(Order o, int n) {',
      '  n = n + 1;',
      '  o.qty = 9;',
      '}',
    ],
    frames: [
      { line: 0, note: 'main() is called: the JVM pushes a frame for it onto this thread\'s stack.', stack: [s('main')], heap: [], pool: [] },
      { line: 1, note: 'A primitive local lives directly in the frame. count holds the value 3.', stack: [s('main', v('count', 3))], heap: [], pool: [] },
      {
        line: 2,
        note: 'new Order(7) allocates an object on the heap. The local o in the frame only holds a reference to it.',
        stack: [s('main', v('count', 3), r('o', 'H1'))],
        heap: [o('H1', 'Order', 'qty = 7')],
        pool: [],
      },
      {
        line: 3,
        note: 'Calling ship() pushes a new frame. Arguments are copied: n gets the value 3, and o gets a copy of the reference, pointing to the same Order.',
        stack: [s('main', v('count', 3), r('o', 'H1')), s('ship', r('o', 'H1'), v('n', 3))],
        heap: [o('H1', 'Order', 'qty = 7')],
        pool: [],
      },
      {
        line: 6,
        note: 'n = n + 1 changes only the copy in ship()\'s frame. count in main() is still 3: Java passes everything by value.',
        stack: [s('main', v('count', 3), r('o', 'H1')), s('ship', r('o', 'H1'), v('n', 4))],
        heap: [o('H1', 'Order', 'qty = 7')],
        pool: [],
      },
      {
        line: 7,
        note: 'o.qty = 9 follows the copied reference to the shared object. The change is visible through main()\'s o as well.',
        stack: [s('main', v('count', 3), r('o', 'H1')), s('ship', r('o', 'H1'), v('n', 4))],
        heap: [o('H1', 'Order', 'qty = 9', { changed: true })],
        pool: [],
      },
      {
        line: 8,
        note: 'ship() returns: its frame is popped and n and its copy of o disappear at once. The Order is not on the stack, so it stays.',
        stack: [s('main', v('count', 3), r('o', 'H1'))],
        heap: [o('H1', 'Order', 'qty = 9')],
        pool: [],
      },
      {
        line: 4,
        note: 'main() returns and its frame is popped. Nothing references the Order any more: it is now unreachable and the garbage collector may free it.',
        stack: [],
        heap: [o('H1', 'Order', 'qty = 9', { dim: true })],
        pool: [],
      },
    ],
  },
];
