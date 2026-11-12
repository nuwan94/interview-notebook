import { Playground } from './Playground.jsx';

const FRUITS = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'kiwi', 'lemon', 'mango', 'nectarine', 'orange', 'papaya'];
const puts = (keys) => keys.map((key, i) => ({ type: 'put', key, value: i + 1 }));

// --- Point keys for the hashCode()/equals() demo -------------------------------------------------
// Object.hashCode() in HotSpot is a pseudo-random "identity" number, shown here with typical values.
const IDENTITY = { p1: 0x1b6d3586, p2: 0x4554617c };
const pointKf = ({ hash, equals }) => ({
  hashOf: (k) => (hash === 'identity' ? IDENTITY[k.name] : 31 * (31 + k.x) + k.y), // Objects.hash(x, y)
  equals: (a, b) => (equals === 'value' ? a.x === b.x && a.y === b.y : a === b),
  label: (k) => `${k.name}=Point(${k.x},${k.y})`,
});
const pt = (name, x, y) => ({ name, x, y });
const twoPoints = () => {
  const p1 = pt('p1', 1, 2);
  const p2 = pt('p2', 1, 2);
  return [
    { type: 'put', key: p1, value: 'A' },
    { type: 'get', key: p2 },
  ];
};

const DEMOS = {
  'bucket-index': {
    title: 'How a key finds its bucket',
    variants: [
      {
        id: 'main',
        label: 'Strings',
        ops: [...puts(['apple', 'banana', 'fig', 'elderberry']), { type: 'get', key: 'fig' }],
        input: { kind: 'string', placeholder: 'e.g. mango' },
      },
    ],
  },
  'collision-chain': {
    title: 'Two keys, one bucket: collisions',
    variants: [
      {
        id: 'main',
        label: 'Chain',
        blurb:
          '"banana" and "date" have different hash codes but land in the same bucket. "Aa" and "BB" are worse: their hashCode() is identical.',
        ops: [...puts(['banana', 'date', 'Aa', 'BB']), { type: 'get', key: 'BB' }],
        input: { kind: 'string', placeholder: 'e.g. date' },
      },
    ],
  },
  treeify: {
    title: 'Long chains become trees',
    variants: [
      {
        id: 'main',
        label: 'Treeify',
        blurb:
          'Keys 1, 65, 129, … all share bucket 1 in every table up to 64 buckets. Watch what HashMap does at the 9th, 10th and 11th key.',
        ops: puts(Array.from({ length: 11 }, (_, i) => 1 + 64 * i)),
        brief: true,
        speed: 2,
      },
    ],
  },
  resize: {
    title: 'Resizing at the load factor',
    variants: [
      {
        id: 'main',
        label: 'Resize',
        blurb: 'Thirteen fruit keys go in. The 13th pushes size past the threshold (12) and the table doubles.',
        ops: puts(FRUITS),
        brief: true,
        speed: 2,
        input: { kind: 'string', placeholder: 'e.g. plum' },
      },
    ],
  },
  contract: {
    title: 'Why hashCode() and equals() must agree',
    variants: [
      {
        id: 'neither',
        label: 'Neither overridden',
        blurb:
          '`p1` and `p2` are two objects with the same coordinates. Without overrides, `equals()` compares identity and `hashCode()` is an identity number.',
        kf: pointKf({ hash: 'identity', equals: 'identity' }),
        makeOps: twoPoints,
      },
      {
        id: 'equals-only',
        label: 'Only equals()',
        blurb:
          '`equals()` now compares coordinates, but `hashCode()` is still the identity number, so `get(p2)` goes to the wrong bucket and `equals()` is never consulted. (It can even work by luck — 1 time in 16.)',
        kf: pointKf({ hash: 'identity', equals: 'value' }),
        makeOps: twoPoints,
      },
      {
        id: 'both',
        label: 'Both overridden',
        blurb: 'Both methods use the coordinates (`Objects.hash(x, y)`): equal points hash to the same bucket and `equals()` confirms.',
        kf: pointKf({ hash: 'value', equals: 'value' }),
        makeOps: twoPoints,
      },
      {
        id: 'mutable',
        label: 'Mutable key trap',
        blurb: 'A correct key class, but the key is changed after it was stored. The entry is still in the map and nobody can find it.',
        kf: pointKf({ hash: 'value', equals: 'value' }),
        makeOps: () => {
          const p1 = pt('p1', 1, 2);
          return [
            { type: 'put', key: p1, value: 'A' },
            { type: 'mutate', key: p1, fn: (k) => (k.x = 5), caption: '`p1.x = 5` — the key changed after it was stored.', short: 'p1.x = 5' },
            { type: 'get', key: p1 },
            { type: 'get', key: pt('p2', 1, 2) },
          ];
        },
      },
    ],
  },
};

export function DemoFrame({ name }) {
  const demo = DEMOS[name];
  if (!demo) {
    return (
      <p className="demo" role="alert">
        Unknown demo “{name}”.
      </p>
    );
  }
  return <Playground title={demo.title} variants={demo.variants} />;
}
