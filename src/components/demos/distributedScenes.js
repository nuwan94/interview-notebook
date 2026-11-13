// Frame data for the distributed systems walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const DISTRIBUTED_SCENES = [
  {
    id: 'cap',
    label: 'Partition: consistency or availability',
    title: 'CAP in practice: when the network splits, choose between answering and being correct',
    frames: [
      {
        note: 'A balance is stored on two replicas in two data centers. Both hold balance = 100. A client in each region talks to its nearest replica.',
        boxes: [b('a', 'Replica A', ['balance = 100'], 'ok'), b('b', 'Replica B', ['balance = 100'], 'ok'), b('c1', 'Client 1', ['near A'], 'none'), b('c2', 'Client 2', ['near B'], 'none')],
        deps: [d('Replica A', 'Replica B', 'replication link works', 'ok')],
      },
      {
        note: 'A network partition cuts the link between the data centers. Both replicas are still running, but neither can tell whether the other is dead or just unreachable. Partitions are not optional in a real network, so the real question is what to do now.',
        boxes: [b('a', 'Replica A', ['balance = 100', 'cannot reach B'], 'warn'), b('b', 'Replica B', ['balance = 100', 'cannot reach A'], 'warn')],
        deps: [d('Replica A', 'Replica B', 'link down', 'bad')],
      },
      {
        note: 'Client 1 withdraws 40 through Replica A, which accepts it (balance = 60). Replica B cannot hear about it, so it still believes the balance is 100.',
        boxes: [b('c1', 'Client 1', ['withdraw 40'], 'new'), b('a', 'Replica A', ['balance = 60'], 'ok', 'accepted'), b('b', 'Replica B', ['balance = 100 (stale)'], 'warn')],
        deps: [d('Client 1', 'Replica A', 'write', 'ok'), d('Replica A', 'Replica B', 'cannot replicate', 'bad')],
      },
      {
        note: 'Choice 1, consistency over availability (CP): Replica B refuses to answer because it cannot confirm it has the latest value. The system returns an error but never a wrong balance. Used where correctness matters more than uptime (leader-based consensus stores, many banking ledgers).',
        boxes: [b('c2', 'Client 2', ['read balance'], 'new'), b('b', 'Replica B', ['cannot reach a majority', 'refuses the read'], 'bad', 'unavailable')],
        deps: [d('Client 2', 'Replica B', 'read balance', 'ok'), d('Replica B', 'Client 2', 'error: try later', 'bad')],
      },
      {
        note: 'Choice 2, availability over consistency (AP): Replica B answers with what it has, 100, which is stale. The system stays up and every request gets an answer, but readers may see old data until the partition heals. Used for carts, feeds, caches and counters that tolerate it.',
        boxes: [b('c2', 'Client 2', ['read balance'], 'new'), b('b', 'Replica B', ['answers 100', 'stale'], 'warn', 'stale read')],
        deps: [d('Client 2', 'Replica B', 'read balance', 'ok'), d('Replica B', 'Client 2', '100 (stale)', 'warn')],
      },
      {
        note: 'When the partition heals, an AP system must reconcile: replicas exchange versions and merge them (last-write-wins, vector clocks or a domain-specific merge). A CP system just resumes. Even with no partition there is a trade-off between latency and consistency (the PACELC extension).',
        boxes: [b('a', 'Replica A', ['balance = 60'], 'ok'), b('b', 'Replica B', ['syncs: balance = 60'], 'ok', 'reconciled')],
        deps: [d('Replica A', 'Replica B', 'link restored: exchange versions', 'ok')],
      },
    ],
  },
  {
    id: 'quorum',
    label: 'Quorum reads and writes',
    title: 'Quorums: with W + R > N, every read overlaps the latest write',
    frames: [
      {
        note: 'Data is copied to N = 3 replicas. The system is configured with write quorum W = 2 and read quorum R = 2. Because 2 + 2 > 3, any write set and any read set must share at least one replica.',
        boxes: [b('a', 'Replica A', ['x = old (v1)'], 'none'), b('b', 'Replica B', ['x = old (v1)'], 'none'), b('c', 'Replica C', ['x = old (v1)'], 'none'), b('k', 'Coordinator', ['N=3, W=2, R=2'], 'new')],
        deps: [],
      },
      {
        note: 'A write of x = new (v2) is sent to all three replicas. Replica A and Replica B acknowledge, which is W = 2, so the write succeeds. Replica C is slow or unreachable and misses it.',
        boxes: [b('k', 'Coordinator', ['2 acks received', 'write succeeds'], 'ok', 'W=2 met'), b('a', 'Replica A', ['x = new (v2)'], 'ok'), b('b', 'Replica B', ['x = new (v2)'], 'ok'), b('c', 'Replica C', ['x = old (v1)', 'missed the write'], 'warn', 'lagging')],
        deps: [d('Coordinator', 'Replica A', 'write v2', 'ok'), d('Coordinator', 'Replica B', 'write v2', 'ok'), d('Coordinator', 'Replica C', 'write v2 (lost)', 'bad')],
      },
      {
        note: 'A read asks two replicas, and by chance gets Replica B (v2) and Replica C (v1). The coordinator compares version numbers and returns the newest, v2. At least one of any two replicas is guaranteed to hold the latest write.',
        boxes: [b('k', 'Coordinator', ['got v2 and v1', 'returns v2 (newest)'], 'ok', 'R=2 met'), b('b', 'Replica B', ['x = v2'], 'ok'), b('c', 'Replica C', ['x = v1'], 'warn')],
        deps: [d('Coordinator', 'Replica B', 'read', 'ok'), d('Coordinator', 'Replica C', 'read', 'ok')],
      },
      {
        note: 'Read repair: having seen that Replica C is behind, the coordinator writes v2 to it, so replicas converge over time. Anti-entropy jobs and hinted handoff also repair replicas that were down.',
        boxes: [b('k', 'Coordinator', ['repairs C in the background'], 'new'), b('c', 'Replica C', ['x = v2'], 'ok', 'repaired')],
        deps: [d('Coordinator', 'Replica C', 'write v2 (read repair)', 'ok')],
      },
      {
        note: 'Tuning: W = N gives fast reads but writes fail if any replica is down; W = 1, R = 1 is fast and available but can return stale data (W + R is not greater than N). Sloppy quorums and concurrent writes can still break the guarantee, so version numbers or vector clocks are needed.',
        boxes: [b('k', 'Coordinator', ['W=1, R=1: fast', 'W+R is not greater than N', 'stale reads possible'], 'warn', 'trade-off')],
        deps: [],
      },
    ],
  },
  {
    id: 'raft',
    label: 'Consensus (Raft)',
    title: 'Raft: a majority elects a leader and agrees on a replicated log',
    frames: [
      {
        note: 'Five nodes must agree on the same sequence of commands, even when some fail. Raft elects one leader per term. Everyone starts as a follower with a random election timeout.',
        boxes: [b('n1', 'Node 1', ['follower', 'term 1'], 'none'), b('n2', 'Node 2', ['follower', 'term 1'], 'none'), b('n3', 'Node 3', ['follower', 'term 1'], 'none'), b('n4', 'Node 4', ['follower', 'term 1'], 'none'), b('n5', 'Node 5', ['follower', 'term 1'], 'none')],
        deps: [],
      },
      {
        note: 'Node 2\'s timeout expires first. It becomes a candidate for term 2 and asks the others for votes. Each node votes once per term.',
        boxes: [b('n2', 'Node 2', ['candidate', 'term 2', 'votes for itself'], 'warn', 'election'), b('n1', 'Node 1', ['votes yes'], 'ok'), b('n3', 'Node 3', ['votes yes'], 'ok'), b('n4', 'Node 4', ['no reply'], 'none')],
        deps: [d('Node 2', 'Node 1', 'RequestVote term 2', 'ok'), d('Node 2', 'Node 3', 'RequestVote term 2', 'ok')],
      },
      {
        note: 'Node 2 receives 3 of 5 votes: a majority. It becomes the leader and sends heartbeats so the others stay followers. Only one leader can win a majority per term, so there is never a split brain.',
        boxes: [b('n2', 'Node 2', ['LEADER', 'term 2', '3 of 5 votes'], 'ok', 'leader'), b('n1', 'Node 1', ['follower, term 2'], 'none'), b('n3', 'Node 3', ['follower, term 2'], 'none')],
        deps: [d('Node 2', 'Node 1', 'heartbeat', 'ok'), d('Node 2', 'Node 3', 'heartbeat', 'ok')],
      },
      {
        note: 'A client command goes to the leader, which appends it to its log and sends it to the followers. When a majority (3 of 5, counting itself) have stored it, the entry is committed and applied, and the client gets the answer.',
        boxes: [b('n2', 'Node 2', ['LEADER', 'log: [set x=1]', 'committed after 3 acks'], 'ok', 'committed'), b('n1', 'Node 1', ['log: [set x=1]'], 'ok'), b('n3', 'Node 3', ['log: [set x=1]'], 'ok'), b('n4', 'Node 4', ['slow, log catches up later'], 'warn')],
        deps: [d('Node 2', 'Node 1', 'AppendEntries set x=1', 'ok'), d('Node 2', 'Node 3', 'AppendEntries set x=1', 'ok')],
      },
      {
        note: 'The leader crashes. Followers stop receiving heartbeats, a timeout fires, and a new election starts for term 3. A node with an up-to-date log wins, so committed entries are never lost. A cluster of 2f+1 nodes tolerates f failures: 5 nodes survive 2.',
        boxes: [b('n2', 'Node 2', ['crashed'], 'bad', 'down'), b('n3', 'Node 3', ['candidate, term 3', 'wins with 3 votes'], 'ok', 'new leader'), b('n1', 'Node 1', ['follower, term 3'], 'none')],
        deps: [d('Node 3', 'Node 1', 'RequestVote term 3', 'ok')],
      },
      {
        note: 'If a network partition leaves only 2 nodes on one side, they cannot reach a majority, so they cannot elect a leader or commit anything. The 3-node side keeps working. Consensus chooses consistency: the minority is unavailable rather than wrong.',
        boxes: [b('n1', 'Node 1', ['minority side (2 nodes)', 'cannot elect or commit'], 'bad', 'stalled'), b('n3', 'Node 3', ['majority side (3 nodes)', 'keeps committing'], 'ok', 'available')],
        deps: [d('Node 1', 'Node 3', 'partition', 'bad')],
      },
    ],
  },
  {
    id: 'hashing',
    label: 'Consistent hashing',
    title: 'Consistent hashing: adding a node moves only a fraction of the keys',
    frames: [
      {
        note: 'Naive sharding uses hash(key) mod N. With N = 3 nodes that works, but changing N to 4 remaps almost every key, so nearly all cached or stored data has to move.',
        boxes: [b('m', 'Modulo sharding', ['3 nodes: key 10 -> node 1', '4 nodes: key 10 -> node 2', 'about 75 percent of keys move'], 'bad', 'bad')],
        deps: [],
      },
      {
        note: 'Consistent hashing places both nodes and keys on the same circular hash space (a ring). A key belongs to the first node found going clockwise from the key\'s position.',
        boxes: [b('a', 'Node A', ['position 0.1', 'owns keys 0.8 to 0.1'], 'ok'), b('b', 'Node B', ['position 0.4', 'owns keys 0.1 to 0.4'], 'ok'), b('c', 'Node C', ['position 0.7', 'owns keys 0.4 to 0.7'], 'ok')],
        deps: [],
      },
      {
        note: 'Node D joins at position 0.55, between B and C. It takes over only the keys from 0.4 to 0.55 that used to belong to Node C. Nodes A and B are untouched. On average only about 1 of N keys move.',
        boxes: [b('d', 'Node D', ['position 0.55 (new)', 'takes keys 0.4 to 0.55'], 'new', 'joined'), b('c', 'Node C', ['now owns 0.55 to 0.7'], 'warn', 'gave up some keys'), b('a', 'Node A', ['unchanged'], 'ok'), b('b', 'Node B', ['unchanged'], 'ok')],
        deps: [d('Node C', 'Node D', 'moves keys 0.4 to 0.55', 'ok')],
      },
      {
        note: 'A problem with one position per node: the ranges can be very uneven, so one node gets much more load. The fix is virtual nodes: each physical node owns many small points on the ring, which evens out the load and spreads a failed node\'s keys across all the others.',
        boxes: [b('v', 'Virtual nodes', ['A: 0.05 0.31 0.62 0.88', 'B: 0.12 0.44 0.70 0.95', 'C: 0.20 0.38 0.55 0.81'], 'ok', 'balanced'), b('f', 'Node B fails', ['its 4 ranges go to different neighbours'], 'warn', 'spread')],
        deps: [],
      },
    ],
  },
];
