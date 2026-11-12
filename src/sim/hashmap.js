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
      this.emit(`${sig}: \`hashCode()\` ${c.raw} → spread ${c.spread} → bucket \`${this.cap - 1} & ${c.spread}\` = ${c.idx}.`, {
        calc: { ...c, stage: 3 },
        active: { bucket: c.idx, state: 'target' },
      });
      return c;
    }
    this.emit(`${sig}: first ask the key for its \`hashCode()\` → ${c.raw}.`, { calc: { ...c, stage: 1 } });
    this.emit(`Spread the high bits into the low bits: \`h ^ (h >>> 16)\` → ${c.spread}.`, { calc: { ...c, stage: 2 } });
    this.emit(`Pick the bucket: \`(n - 1) & hash\` = \`${this.cap - 1} & ${c.spread}\` → bucket ${c.idx}.`, {
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
        `Bucket ${c.idx} is a red-black tree: descend by hash (then \`compareTo\`) instead of walking every node — O(log n).`,
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
          ? `Walked ${skipped + 1} of ${b.nodes.length} nodes in bucket ${c.idx} (hash, then \`equals()\`) → match.`
          : `Bucket ${c.idx} is a collision: walked all ${b.nodes.length} nodes comparing hash (then \`equals()\`) → no match.`,
        { calc: { ...c, stage: 3 }, active: { bucket: c.idx, nodeId: hit?.id, state: hit ? 'match' : 'compare' }, dwell: 1 },
      );
      return hit;
    }
    this.emit(
      b.nodes.length === 1
        ? `Bucket ${c.idx} already holds a node — compare it with our key.`
        : `Bucket ${c.idx} already holds ${b.nodes.length} nodes — walk the chain, comparing each one.`,
      { calc: { ...c, stage: 3 }, active: { bucket: c.idx, state: 'target' }, dwell: 0.8 },
    );
    for (const n of b.nodes) {
      const lbl = this.kf.label(n.key);
      if (n.hash !== c.spread) {
        this.emit(`Node ${lbl}: stored hash ${n.hash} ≠ ${c.spread} → different key. \`equals()\` is not even called.`, {
          calc: { ...c, stage: 3 },
          active: { bucket: c.idx, nodeId: n.id, state: 'compare' },
          dwell: 0.8,
        });
      } else if (n.key === key || this.kf.equals(n.key, key)) {
        this.emit(`Node ${lbl}: hash is equal and \`equals()\` returns true → same key found.`, {
          calc: { ...c, stage: 3 },
          active: { bucket: c.idx, nodeId: n.id, state: 'match' },
        });
        return n;
      } else {
        this.emit(`Node ${lbl}: hash is equal but \`equals()\` returns false → a genuine collision, keep walking.`, {
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
      this.emit(`Key already present → replace the value (${fmtVal(old)} → ${fmtVal(value)}). Size stays ${this.size}.`, {
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
        ? `Bucket ${c.idx} is empty → store the new Node here. No collision.`
        : b.tree
          ? `Not found → insert a new TreeNode into the tree.`
          : `End of chain, key not found → append the new Node at the tail (Java 8+; Java 7 inserted at the head).`,
      {
        calc: { ...c, stage: 3 },
        active: { bucket: c.idx, nodeId: node.id, state: 'new' },
        result: { text: 'returns null', kind: 'null' },
      },
    );
    if (!b.tree && b.nodes.length > TREEIFY_THRESHOLD) this.treeifyBin(c.idx);
    if (this.size > this.threshold) this.resize(`size ${this.size} > threshold ${this.threshold}`);
  }

  treeifyBin(idx) {
    const b = this.table[idx];
    if (this.cap < MIN_TREEIFY_CAPACITY) {
      this.emit(
        `Chain has ${b.nodes.length} nodes (more than ${TREEIFY_THRESHOLD}) but the table has only ${this.cap} buckets (< ${MIN_TREEIFY_CAPACITY}) → HashMap resizes instead of treeifying.`,
        { active: { bucket: idx, state: 'target' }, dwell: 1.4 },
      );
      this.resize(`treeifyBin() with capacity ${this.cap} < ${MIN_TREEIFY_CAPACITY}`);
    } else {
      b.tree = true;
      this.emit(
        `Chain has ${b.nodes.length} nodes and the table has ${this.cap} (≥ ${MIN_TREEIFY_CAPACITY}) buckets → bucket ${idx} is converted into a red-black tree.`,
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
      `Resize (${why}): capacity ${oldCap} → ${newCap}. One bit decides each node's fate: \`hash & ${oldCap}\` is 0 → stays at index i ("lo"), else moves to i + ${oldCap} ("hi").`,
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
      `Done: ${newCap} buckets, new threshold ${this.threshold}. Stored hashes were reused — no \`hashCode()\` call, no re-hashing; relative order inside each chain is preserved.`,
      { tags, dwell: 2 },
    );
  }

  get(key) {
    const sig = `get(${this.kf.label(key)})`;
    const c = this.hashFrames(sig, key);
    const hit = this.locate(key, c);
    if (hit) {
      this.emit(`Found it → ${sig} returns ${fmtVal(hit.value)}.`, {
        calc: { ...c, stage: 3 },
        active: { bucket: c.idx, nodeId: hit.id, state: 'match' },
        result: { text: `returns ${fmtVal(hit.value)}`, kind: 'ok' },
      });
    } else {
      const b = this.table[c.idx];
      this.emit(
        b
          ? `Reached the end of bucket ${c.idx} without a match → ${sig} returns null.`
          : `Bucket ${c.idx} is empty → ${sig} returns null.`,
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
      this.emit(`Not found → nothing to remove, returns null.`, {
        active: { bucket: c.idx, state: 'miss' },
        result: { text: 'returns null', kind: 'null' },
      });
      return;
    }
    const b = this.table[c.idx];
    b.nodes = b.nodes.filter((n) => n !== hit);
    if (!b.nodes.length) this.table[c.idx] = null;
    this.size--;
    this.emit(`Node unlinked from bucket ${c.idx}. Size is now ${this.size}. (The table never shrinks.)`, {
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
      `${caption} The Node stays in bucket ${bIdx} (stored hash ${node?.hash}), but the key's hashCode() is now ${c.raw} → it would be looked up in bucket ${c.idx}.`,
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
    intro || `A brand-new HashMap: ${capacity} empty buckets, load factor 0.75 → resize threshold ${map.threshold}.`,
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
