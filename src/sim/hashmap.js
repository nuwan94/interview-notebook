// A small, faithful simulation of java.util.HashMap (Java 8+).
// It does not just draw pictures: it runs the same steps as putVal/getNode/resize/treeifyBin
// and records a "frame" after every meaningful step, which the animation player replays.

export const TREEIFY_THRESHOLD = 8;
export const UNTREEIFY_THRESHOLD = 6;
export const MIN_TREEIFY_CAPACITY = 64;

/** Java's String.hashCode(): s[0]*31^(n-1) + ... + s[n-1], with 32-bit overflow. */
export function stringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
/** HashMap.hash(): h ^ (h >>> 16). */
export const spread = (h) => (h ^ (h >>> 16)) | 0;
export const bits32 = (h) => (h >>> 0).toString(2).padStart(32, '0');

const fmtVal = (v) => (typeof v === 'string' ? `"${v}"` : String(v));

export const defaultKeyFns = {
  hashOf: (k) => (typeof k === 'string' ? stringHash(k) : k | 0),
  equals: (a, b) => a === b,
  label: (k) => (typeof k === 'string' ? `"${k}"` : String(k)),
};

class SimHashMap {
  constructor(kf, capacity, frames, brief = false) {
    this.brief = brief;
    this.kf = kf;
    this.cap = capacity;
    this.threshold = Math.floor(capacity * 0.75);
    this.table = new Array(capacity).fill(null);
    this.size = 0;
    this.nextId = 1;
    this.frames = frames;
    this.opIndex = -1;
  }

  snapshot() {
    return {
      cap: this.cap,
      size: this.size,
      threshold: this.threshold,
      table: this.table.map(
        (b) =>
          b && {
            tree: b.tree,
            nodes: b.nodes.map((n) => ({
              id: n.id,
              label: this.kf.label(n.key),
              value: fmtVal(n.value),
              hash: n.hash,
            })),
          },
      ),
    };
  }

  emit(caption, extra = {}) {
    this.frames.push({ caption, op: this.opIndex, snap: this.snapshot(), dwell: 1, ...extra });
  }

  calc(key) {
    const raw = this.kf.hashOf(key) | 0;
    const sp = spread(raw);
    return { label: this.kf.label(key), raw, high: raw >>> 16, spread: sp, idx: sp & (this.cap - 1), cap: this.cap };
  }

  hashFrames(sig, key) {
    const c = this.calc(key);
    if (this.brief) {
      this.emit(`${sig}: the hash code is ${c.raw}, the spread hash is ${c.spread}, and \`${this.cap - 1} & ${c.spread}\` picks bucket ${c.idx}.`, {
        calc: { ...c, stage: 3 },
        active: { bucket: c.idx, state: 'target' },
      });
      return c;
    }
    this.emit(`${sig}: first the map asks the key for its \`hashCode()\`, which is ${c.raw}.`, { calc: { ...c, stage: 1 } });
    this.emit(`Next it mixes the high 16 bits into the low 16 bits with \`h ^ (h >>> 16)\`. The spread hash is ${c.spread}.`, { calc: { ...c, stage: 2 } });
    this.emit(`Then it keeps only the low bits: \`(n - 1) & hash\` is \`${this.cap - 1} & ${c.spread}\`, which is bucket ${c.idx}.`, {
      calc: { ...c, stage: 3 },
      active: { bucket: c.idx, state: 'target' },
    });
    return c;
  }

  /** Walk the bucket like getNode()/putVal() do. Returns the matching node or null. Emits frames. */
  locate(key, c) {
    const b = this.table[c.idx];
    if (!b) return null;
    if (b.tree) {
      const hit = b.nodes.find((n) => n.hash === c.spread && (n.key === key || this.kf.equals(n.key, key)));
      this.emit(
        `Bucket ${c.idx} is a red-black tree. The map goes down the tree by hash (then by \`compareTo\`), so it checks only a few nodes: O(log n).`,
        {
          calc: { ...c, stage: 3 },
          active: { bucket: c.idx, nodeId: hit?.id, state: hit ? 'match' : 'compare' },
          dwell: 1.1,
        },
      );
      return hit || null;
    }
    if (this.brief && b.nodes.length > 1) {
      let hit = null;
      let skipped = 0;
      for (const n of b.nodes) {
        if (n.hash === c.spread && (n.key === key || this.kf.equals(n.key, key))) {
          hit = n;
          break;
        }
        skipped++;
      }
      this.emit(
        hit
          ? `The map checked ${skipped + 1} of the ${b.nodes.length} nodes in bucket ${c.idx}, comparing the hash and then \`equals()\`. It found the key.`
          : `Bucket ${c.idx} already holds other keys. The map checked all ${b.nodes.length} nodes, comparing the hash and then \`equals()\`, and found no match.`,
        { calc: { ...c, stage: 3 }, active: { bucket: c.idx, nodeId: hit?.id, state: hit ? 'match' : 'compare' }, dwell: 1 },
      );
      return hit;
    }
    this.emit(
      b.nodes.length === 1
        ? `Bucket ${c.idx} already holds a node. The map compares it with our key.`
        : `Bucket ${c.idx} already holds ${b.nodes.length} nodes. The map walks the chain and compares each one.`,
      { calc: { ...c, stage: 3 }, active: { bucket: c.idx, state: 'target' }, dwell: 0.8 },
    );
    for (const n of b.nodes) {
      const lbl = this.kf.label(n.key);
      if (n.hash !== c.spread) {
        this.emit(`Node ${lbl} has stored hash ${n.hash}, not ${c.spread}, so it is a different key. \`equals()\` is not even called.`, {
          calc: { ...c, stage: 3 },
          active: { bucket: c.idx, nodeId: n.id, state: 'compare' },
          dwell: 0.8,
        });
      } else if (n.key === key || this.kf.equals(n.key, key)) {
        this.emit(`Node ${lbl} has the same hash, and \`equals()\` returns true. This is the same key.`, {
          calc: { ...c, stage: 3 },
          active: { bucket: c.idx, nodeId: n.id, state: 'match' },
        });
        return n;
      } else {
        this.emit(`Node ${lbl} has the same hash, but \`equals()\` returns false. It is a different key with the same hash, so the map keeps walking.`, {
          calc: { ...c, stage: 3 },
          active: { bucket: c.idx, nodeId: n.id, state: 'compare' },
        });
      }
    }
    return null;
  }

  put(key, value) {
    const sig = `put(${this.kf.label(key)}, ${fmtVal(value)})`;
    const c = this.hashFrames(sig, key);
    const hit = this.locate(key, c);
    if (hit) {
      const old = hit.value;
      hit.value = value;
      this.emit(`The key is already there, so the map replaces the value ${fmtVal(old)} with ${fmtVal(value)}. The size stays ${this.size}.`, {
        calc: { ...c, stage: 3 },
        active: { bucket: c.idx, nodeId: hit.id, state: 'new' },
        result: { text: `returns ${fmtVal(old)}`, kind: 'ok' },
      });
      return;
    }
    const node = { id: this.nextId++, key, value, hash: c.spread };
    let b = this.table[c.idx];
    const wasEmpty = !b;
    if (!b) b = this.table[c.idx] = { tree: false, nodes: [] };
    b.nodes.push(node);
    this.size++;
    this.emit(
      wasEmpty
        ? `Bucket ${c.idx} is empty, so the new node goes straight in. There is no collision.`
        : b.tree
          ? `The key is not in the tree, so the map inserts a new TreeNode.`
          : `The map reached the end of the chain without finding the key. It adds the new node at the tail. (Java 7 added it at the head.)`,
      {
        calc: { ...c, stage: 3 },
        active: { bucket: c.idx, nodeId: node.id, state: 'new' },
        result: { text: 'returns null', kind: 'null' },
      },
    );
    if (!b.tree && b.nodes.length > TREEIFY_THRESHOLD) this.treeifyBin(c.idx);
    if (this.size > this.threshold) this.resize(`the size ${this.size} is above the threshold ${this.threshold}`);
  }

  treeifyBin(idx) {
    const b = this.table[idx];
    if (this.cap < MIN_TREEIFY_CAPACITY) {
      this.emit(
        `The chain now has ${b.nodes.length} nodes, more than ${TREEIFY_THRESHOLD}. But the table has only ${this.cap} buckets, fewer than ${MIN_TREEIFY_CAPACITY}, so HashMap doubles the table instead of making a tree.`,
        { active: { bucket: idx, state: 'target' }, dwell: 1.4 },
      );
      this.resize(`the table is too small to make a tree`);
    } else {
      b.tree = true;
      this.emit(
        `The chain has ${b.nodes.length} nodes and the table has ${this.cap} buckets, which is at least ${MIN_TREEIFY_CAPACITY}. So bucket ${idx} becomes a red-black tree.`,
        { active: { bucket: idx, state: 'treeify' }, dwell: 1.5 },
      );
    }
  }

  resize(why) {
    const oldCap = this.cap;
    const newCap = oldCap * 2;
    const tags = {};
    for (const b of this.table) b?.nodes.forEach((n) => (tags[n.id] = (n.hash & oldCap) === 0 ? 'lo' : 'hi'));
    this.emit(
      `Resize, because ${why}. The capacity doubles from ${oldCap} to ${newCap}. One bit decides where each node goes: if \`hash & ${oldCap}\` is 0, the node stays at index i (blue, "lo"). Otherwise it moves to i + ${oldCap} (orange, "hi").`,
      { tags, dwell: 2 },
    );
    const next = new Array(newCap).fill(null);
    this.table.forEach((b, i) => {
      if (!b) return;
      const lo = b.nodes.filter((n) => (n.hash & oldCap) === 0);
      const hi = b.nodes.filter((n) => (n.hash & oldCap) !== 0);
      if (lo.length) next[i] = { tree: b.tree && lo.length > UNTREEIFY_THRESHOLD, nodes: lo };
      if (hi.length) next[i + oldCap] = { tree: b.tree && hi.length > UNTREEIFY_THRESHOLD, nodes: hi };
    });
    this.table = next;
    this.cap = newCap;
    this.threshold = oldCap >= 16 ? this.threshold * 2 : Math.floor(newCap * 0.75);
    this.emit(
      `Done. The table has ${newCap} buckets and the new threshold is ${this.threshold}. The map reused the stored hashes, so it called no \`hashCode()\`. The nodes in each chain kept their order.`,
      { tags, dwell: 2 },
    );
  }

  get(key) {
    const sig = `get(${this.kf.label(key)})`;
    const c = this.hashFrames(sig, key);
    const hit = this.locate(key, c);
    if (hit) {
      this.emit(`Found it. ${sig} returns ${fmtVal(hit.value)}.`, {
        calc: { ...c, stage: 3 },
        active: { bucket: c.idx, nodeId: hit.id, state: 'match' },
        result: { text: `returns ${fmtVal(hit.value)}`, kind: 'ok' },
      });
    } else {
      const b = this.table[c.idx];
      this.emit(
        b
          ? `The map reached the end of bucket ${c.idx} without a match, so ${sig} returns null.`
          : `Bucket ${c.idx} is empty, so ${sig} returns null.`,
        {
          calc: { ...c, stage: 3 },
          active: { bucket: c.idx, state: 'miss' },
          result: { text: 'returns null', kind: 'null' },
          dwell: 1.4,
        },
      );
    }
  }

  remove(key) {
    const sig = `remove(${this.kf.label(key)})`;
    const c = this.hashFrames(sig, key);
    const hit = this.locate(key, c);
    if (!hit) {
      this.emit(`The key is not there, so there is nothing to remove. It returns null.`, {
        active: { bucket: c.idx, state: 'miss' },
        result: { text: 'returns null', kind: 'null' },
      });
      return;
    }
    const b = this.table[c.idx];
    b.nodes = b.nodes.filter((n) => n !== hit);
    if (!b.nodes.length) this.table[c.idx] = null;
    this.size--;
    this.emit(`The node is unlinked from bucket ${c.idx}. The size is now ${this.size}. The table itself never shrinks.`, {
      active: { bucket: c.idx, state: 'target' },
      result: { text: `returns ${fmtVal(hit.value)}`, kind: 'ok' },
    });
  }

  mutate(key, fn, caption) {
    fn(key);
    const bIdx = this.table.findIndex((b) => b?.nodes.some((n) => n.key === key));
    const node = this.table[bIdx]?.nodes.find((n) => n.key === key);
    const c = this.calc(key);
    this.emit(
      `${caption} The node stays in bucket ${bIdx}, with its old stored hash ${node?.hash}. But the key's \`hashCode()\` is now ${c.raw}, so every lookup goes to bucket ${c.idx}.`,
      { calc: { ...c, stage: 3 }, active: { bucket: bIdx, nodeId: node?.id, state: 'stale' }, dwell: 2 },
    );
  }
}

/**
 * Run a list of operations and return { frames, opStarts }.
 * ops: {type:'put',key,value} | {type:'get',key} | {type:'remove',key} | {type:'mutate',key,fn,caption}
 */
export function runScenario({ kf = defaultKeyFns, capacity = 16, ops = [], intro, brief = false }) {
  const frames = [];
  const map = new SimHashMap(kf, capacity, frames, brief);
  map.emit(
    intro || `A brand-new HashMap has ${capacity} empty buckets. With a load factor of 0.75, it grows when it holds more than ${map.threshold} entries.`,
  );
  const opStarts = [];
  ops.forEach((op, i) => {
    map.opIndex = i;
    opStarts.push(frames.length);
    if (op.type === 'put') map.put(op.key, op.value);
    else if (op.type === 'get') map.get(op.key);
    else if (op.type === 'remove') map.remove(op.key);
    else if (op.type === 'mutate') map.mutate(op.key, op.fn, op.caption);
  });
  return { frames, opStarts };
}

export function opLabel(op, kf = defaultKeyFns) {
  if (op.type === 'put') return `put(${kf.label(op.key)})`;
  if (op.type === 'get') return `get(${kf.label(op.key)})`;
  if (op.type === 'remove') return `remove(${kf.label(op.key)})`;
  return op.short || 'mutate';
}
