// Frame data behind the memory walk-through demo, drawn by MemoryStage.
// A frame is the complete picture after one line has run: the call stack, the heap objects and the string pool.
// A variable is { n: name, v: 'text' } for a primitive value or { n: name, ref: 'H1' } for a reference to an object.
// result: { text, tone } is shown next to the current code line. focus: the variables the step talks about.

import { memoryStage } from './MemoryStage.jsx';

const v = (n, val) => ({ n, v: String(val) });
const r = (n, ref) => ({ n, ref });
const s = (name, ...vars) => ({ name, vars });
const o = (id, type, body, extra = {}) => ({ id, type, body, ...extra });

const STRINGS_CODE = [
  'String a = "hi";',
  'String b = "hi";',
  'String c = new String("hi");',
  'a == b            // ?',
  'a == c            // ?',
  'a.equals(c)       // ?',
  'String d = c.intern();',
  'a == d            // ?',
];

const FRAMES_CODE = [
  'void main() {',
  '  int count = 3;',
  '  Order o = new Order(7);',
  '  ship(o, count);',
  '}',
  'void ship(Order o, int n) {',
  '  n = n + 1;',
  '  o.qty = 9;',
  '}',
];

const P1 = o('P1', 'String', '"hi"', { note: 'one shared copy' });
const H1s = o('H1', 'String', '"hi"', { note: 'made with new' });
const abc = [r('a', 'P1'), r('b', 'P1'), r('c', 'H1')];

export const SCENES = [
  {
    id: 'strings',
    label: 'String pool',
    title: 'Literals share one object in the pool, and new String makes another',
    code: STRINGS_CODE,
    stage: memoryStage(STRINGS_CODE),
    frames: [
      { line: -1, note: 'main() starts. The stack holds one frame for it, with no variables yet. The heap and the string pool are empty.', stack: [s('main')], heap: [], pool: [] },
      {
        line: 0,
        note: 'The literal "hi" goes into the string pool as one String object. The variable a lives in the stack frame and holds a reference (the arrow) to that object.',
        stack: [s('main', r('a', 'P1'))],
        heap: [],
        pool: [P1],
      },
      {
        line: 1,
        note: 'The same literal again. The pool already has "hi", so no new object is made. b points to the same object as a.',
        stack: [s('main', r('a', 'P1'), r('b', 'P1'))],
        heap: [],
        pool: [P1],
      },
      {
        line: 2,
        note: 'new String(...) always creates a new object on the heap, outside the pool. Now two objects hold the text "hi", and c points to the new one.',
        stack: [s('main', ...abc)],
        heap: [H1s],
        pool: [P1],
      },
      {
        line: 3,
        note: '== asks whether two variables point to the same object. a and b both point to the pooled "hi", so the answer is true.',
        stack: [s('main', ...abc)],
        heap: [H1s],
        pool: [P1],
        focus: ['a', 'b'],
        result: { text: 'true: same object', tone: 'ok' },
      },
      {
        line: 4,
        note: 'a points into the pool, and c points to the object made with new. The characters match, but these are two different objects, so == is false.',
        stack: [s('main', ...abc)],
        heap: [H1s],
        pool: [P1],
        focus: ['a', 'c'],
        result: { text: 'false: different objects', tone: 'bad' },
      },
      {
        line: 5,
        note: 'equals() compares the characters, not the objects. Both hold "hi", so the result is true. This is why you always compare text with equals().',
        stack: [s('main', ...abc)],
        heap: [H1s],
        pool: [P1],
        focus: ['a', 'c'],
        result: { text: 'true: same text', tone: 'ok' },
      },
      {
        line: 6,
        note: 'intern() looks up the text "hi" in the pool and returns the pooled object. So d points to the same object as a. The object that c points to does not change.',
        stack: [s('main', ...abc, r('d', 'P1'))],
        heap: [H1s],
        pool: [P1],
        focus: ['c', 'd'],
      },
      {
        line: 7,
        note: 'a and d point to the same pooled object, so == is true.',
        stack: [s('main', ...abc, r('d', 'P1'))],
        heap: [H1s],
        pool: [P1],
        focus: ['a', 'd'],
        result: { text: 'true: same object', tone: 'ok' },
      },
    ],
  },
  {
    id: 'frames',
    label: 'Stack and heap',
    title: 'Each call gets a stack frame, and objects live on the heap',
    code: FRAMES_CODE,
    stage: memoryStage(FRAMES_CODE),
    frames: [
      { line: 0, note: 'main() is called. The JVM pushes a frame for it onto this thread\'s stack.', stack: [s('main')], heap: [], pool: [] },
      { line: 1, note: 'A primitive local variable lives directly in the frame. count holds the value 3 itself.', stack: [s('main', v('count', 3))], heap: [], pool: [] },
      {
        line: 2,
        note: 'new Order(7) creates an object on the heap. The local variable o in the frame holds only a reference to it.',
        stack: [s('main', v('count', 3), r('o', 'H1'))],
        heap: [o('H1', 'Order', 'qty = 7')],
        pool: [],
      },
      {
        line: 3,
        note: 'Calling ship() pushes a new frame on top. The arguments are copied: n gets the value 3, and o gets a copy of the reference. Both o variables point to the same Order.',
        stack: [s('main', v('count', 3), r('o', 'H1')), s('ship', r('o', 'H1'), v('n', 3))],
        heap: [o('H1', 'Order', 'qty = 7')],
        pool: [],
      },
      {
        line: 6,
        note: 'n = n + 1 changes only the copy in ship()\'s frame. count in main() is still 3, because Java passes everything by value.',
        stack: [s('main', v('count', 3), r('o', 'H1')), s('ship', r('o', 'H1'), v('n', 4))],
        heap: [o('H1', 'Order', 'qty = 7')],
        pool: [],
        focus: ['n', 'count'],
      },
      {
        line: 7,
        note: 'o.qty = 9 follows the copied reference to the shared object. So main() sees the change through its own o as well.',
        stack: [s('main', v('count', 3), r('o', 'H1')), s('ship', r('o', 'H1'), v('n', 4))],
        heap: [o('H1', 'Order', 'qty = 9')],
        pool: [],
        focus: ['o'],
      },
      {
        line: 8,
        note: 'ship() returns. Its frame is popped, so n and its copy of o disappear at once. The Order is not on the stack, so it stays.',
        stack: [s('main', v('count', 3), r('o', 'H1'))],
        heap: [o('H1', 'Order', 'qty = 9')],
        pool: [],
      },
      {
        line: 4,
        note: 'main() returns and its frame is popped too. Now nothing points to the Order. It is unreachable, so the garbage collector may free it.',
        stack: [],
        heap: [o('H1', 'Order', 'qty = 9', { dim: true })],
        pool: [],
      },
    ],
  },
];
