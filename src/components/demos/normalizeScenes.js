// Frame data for the normalisation walk-through (animated table views).
// table: { id, name, cols, rows, pk: [col index], fk: [col index], badge, tone }
// row:   { key, cells, tone, hl: [col index] }   tone/hl: ok | bad | warn | new

const t = (id, name, cols, rows, o = {}) => ({ id, name, cols, rows, pk: [], fk: [], ...o });
const r = (key, cells, o = {}) => ({ key, cells, ...o });

const FLAT_COLS = ['txn_id', 'customer', 'email', 'branch', 'branch_city', 'amount'];
const flat = (o = {}) => [
  r('1', [1, 'Alice', 'alice@mail.com', 'Orchard', 'Singapore', 500], o[1]),
  r('2', [2, 'Alice', 'alice@mail.com', 'Orchard', 'Singapore', 120], o[2]),
  r('3', [3, 'Bob', 'bob@mail.com', 'Orchard', 'Singapore', 80], o[3]),
  r('4', [4, 'Carol', 'carol@mail.com', 'Marina', 'Singapore', 300], o[4]),
];

export const NORMALIZE_SCENES = [
  {
    id: 'anomalies',
    label: 'One big table',
    title: 'One wide table repeats facts, and that causes update, insert and delete anomalies',
    frames: [
      {
        note: 'Everything about a transfer sits in one table: the customer, their email, the branch, its city and the amount. It looks convenient. But Alice\'s email is stored on every one of her rows, and "Orchard is in Singapore" is stored on every Orchard row. This repetition (redundancy) causes all the problems that follow.',
        tables: [t('flat', 'statement', FLAT_COLS, flat({ 1: { hl: [2, 3, 4] }, 2: { hl: [2, 3, 4] }, 3: { hl: [3, 4] } }), { pk: [0], badge: 'one big table', tone: 'warn' })],
      },
      {
        note: 'Update anomaly: Alice changes her email, but the update reaches only one of her two rows. Now the table holds two different emails for the same person, and nobody knows which one is true. The more copies a fact has, the more places there are to forget.',
        tables: [
          t(
            'flat',
            'statement',
            FLAT_COLS,
            [
              r('1', [1, 'Alice', 'alice@new.com', 'Orchard', 'Singapore', 500], { tone: 'ok', hl: [2] }),
              r('2', [2, 'Alice', 'alice@mail.com', 'Orchard', 'Singapore', 120], { tone: 'bad', hl: [2] }),
              r('3', [3, 'Bob', 'bob@mail.com', 'Orchard', 'Singapore', 80]),
              r('4', [4, 'Carol', 'carol@mail.com', 'Marina', 'Singapore', 300]),
            ],
            { pk: [0], badge: 'inconsistent', tone: 'bad' },
          ),
        ],
      },
      {
        note: 'Insert anomaly: the bank opens a new branch, Jurong, which has no transfers yet. There is nowhere to record it, because every row needs a txn_id, a customer and an amount. You would have to add a fake row full of blanks.',
        tables: [
          t(
            'flat',
            'statement',
            FLAT_COLS,
            [
              ...flat(),
              r('j', [null, null, null, 'Jurong', 'Singapore', null], { tone: 'bad', hl: [0, 1, 2, 5] }),
            ],
            { pk: [0], badge: 'blank row needed', tone: 'bad' },
          ),
        ],
      },
      {
        note: 'Delete anomaly: Carol\'s only transfer is deleted. Her email goes with it, and so does the fact that a Marina branch exists in Singapore. Deleting one fact destroyed two others, because they shared a row.',
        tables: [
          t(
            'flat',
            'statement',
            FLAT_COLS,
            [
              ...flat().slice(0, 3),
              r('4', [4, 'Carol', 'carol@mail.com', 'Marina', 'Singapore', 300], { tone: 'bad', hl: [1, 2, 3, 4] }),
            ],
            { pk: [0], badge: 'delete txn 4: Carol and Marina vanish', tone: 'bad' },
          ),
        ],
      },
    ],
  },
  {
    id: 'split',
    label: 'Normalising it',
    title: 'Split the table so each fact lives in exactly one place',
    frames: [
      {
        note: 'Start from the wide table, and ask of each column: what does it describe? The email describes the customer. The city describes the branch. Only the amount describes the transfer. Each kind of thing gets its own table.',
        tables: [t('flat', 'statement', FLAT_COLS, flat({ 1: { hl: [1, 2] }, 3: { hl: [1, 2] }, 4: { hl: [1, 2, 3, 4] } }), { pk: [0], badge: 'before', tone: 'warn' })],
      },
      {
        note: 'Customers and branches become their own tables, with one row each and a primary key (PK) that identifies the row. Alice\'s email now appears only once.',
        tables: [
          t('cust', 'customer', ['customer_id', 'name', 'email'], [r('c1', [1, 'Alice', 'alice@mail.com'], { tone: 'new' }), r('c2', [2, 'Bob', 'bob@mail.com'], { tone: 'new' }), r('c3', [3, 'Carol', 'carol@mail.com'], { tone: 'new' })], { pk: [0], badge: 'new', tone: 'new' }),
          t('br', 'branch', ['branch_id', 'name', 'city'], [r('b1', [1, 'Orchard', 'Singapore'], { tone: 'new' }), r('b2', [2, 'Marina', 'Singapore'], { tone: 'new' })], { pk: [0], badge: 'new', tone: 'new' }),
        ],
      },
      {
        note: 'The transfer table keeps only its own facts, plus foreign keys (FK) that point at the customer and the branch. The wide table is gone and nothing is repeated. The database can also check that every FK points at a real row.',
        tables: [
          t('cust', 'customer', ['customer_id', 'name', 'email'], [r('c1', [1, 'Alice', 'alice@mail.com']), r('c2', [2, 'Bob', 'bob@mail.com']), r('c3', [3, 'Carol', 'carol@mail.com'])], { pk: [0] }),
          t('br', 'branch', ['branch_id', 'name', 'city'], [r('b1', [1, 'Orchard', 'Singapore']), r('b2', [2, 'Marina', 'Singapore'])], { pk: [0] }),
          t(
            'txn',
            'transfer',
            ['txn_id', 'customer_id', 'branch_id', 'amount'],
            [r('t1', [1, 1, 1, 500], { tone: 'new', hl: [1, 2] }), r('t2', [2, 1, 1, 120], { tone: 'new', hl: [1, 2] }), r('t3', [3, 2, 1, 80], { tone: 'new', hl: [1, 2] }), r('t4', [4, 3, 2, 300], { tone: 'new', hl: [1, 2] })],
            { pk: [0], fk: [1, 2], badge: 'new', tone: 'new' },
          ),
        ],
      },
      {
        note: 'The update anomaly is gone. Alice changes her email, and exactly one cell changes. Every transfer of hers sees the new value through the join.',
        tables: [
          t('cust', 'customer', ['customer_id', 'name', 'email'], [r('c1', [1, 'Alice', 'alice@new.com'], { tone: 'ok', hl: [2] }), r('c2', [2, 'Bob', 'bob@mail.com']), r('c3', [3, 'Carol', 'carol@mail.com'])], { pk: [0], badge: 'one cell updated', tone: 'ok' }),
          t('txn', 'transfer', ['txn_id', 'customer_id', 'branch_id', 'amount'], [r('t1', [1, 1, 1, 500]), r('t2', [2, 1, 1, 120]), r('t3', [3, 2, 1, 80]), r('t4', [4, 3, 2, 300])], { pk: [0], fk: [1, 2] }),
        ],
      },
      {
        note: 'The insert and delete anomalies are gone too. Jurong is just a new row in branch, with no transfer needed. Deleting transfer 4 leaves Carol and the Marina branch in place.',
        tables: [
          t('br', 'branch', ['branch_id', 'name', 'city'], [r('b1', [1, 'Orchard', 'Singapore']), r('b2', [2, 'Marina', 'Singapore']), r('b3', [3, 'Jurong', 'Singapore'], { tone: 'ok', hl: [1, 2] })], { pk: [0], badge: 'branch added alone', tone: 'ok' }),
          t('txn', 'transfer', ['txn_id', 'customer_id', 'branch_id', 'amount'], [r('t1', [1, 1, 1, 500]), r('t2', [2, 1, 1, 120]), r('t3', [3, 2, 1, 80])], { pk: [0], fk: [1, 2], badge: 'txn 4 deleted, Carol and Marina remain', tone: 'ok' }),
        ],
      },
      {
        note: 'You can still get the original wide view whenever you need it, because a JOIN rebuilds the rows when the query runs. Normalisation moves the cost away from writes and consistency, and onto reads.',
        tables: [
          t(
            'join',
            'SELECT ... FROM transfer JOIN customer JOIN branch',
            FLAT_COLS,
            flat({ 1: { tone: 'ok' }, 2: { tone: 'ok' }, 3: { tone: 'ok' }, 4: { tone: 'ok' } }),
            { pk: [0], badge: 'query result, not stored', tone: 'ok' },
          ),
        ],
      },
    ],
  },
  {
    id: 'forms',
    label: '1NF, 2NF, 3NF',
    title: 'The normal forms, one rule at a time',
    frames: [
      {
        note: 'This breaks 1NF, which says every cell must hold one single value. Alice\'s phones cell holds a list. You cannot search, index or check one number on its own, and the number of phones is limited to what fits in the cell.',
        tables: [t('c', 'customer', ['customer_id', 'name', 'phones'], [r('1', [1, 'Alice', '6123 4567, 9123 4567'], { tone: 'bad', hl: [2] }), r('2', [2, 'Bob', '8123 4567'])], { pk: [0], badge: 'not 1NF', tone: 'bad' })],
      },
      {
        note: 'The 1NF fix: one value per cell. The phones move into their own table, with one row per phone, linked back by the customer id. Now a phone can be looked up, indexed and added without changing the shape of any table.',
        tables: [
          t('c', 'customer', ['customer_id', 'name'], [r('1', [1, 'Alice']), r('2', [2, 'Bob'])], { pk: [0] }),
          t('p', 'customer_phone', ['customer_id', 'phone'], [r('p1', [1, '6123 4567'], { tone: 'new', hl: [1] }), r('p2', [1, '9123 4567'], { tone: 'new', hl: [1] }), r('p3', [2, '8123 4567'], { tone: 'new' })], { pk: [0, 1], fk: [0], badge: '1NF', tone: 'ok' }),
        ],
      },
      {
        note: 'This breaks 2NF. The key is made of two columns, account_id and fund_id (a composite key). But fund_name depends on fund_id alone, which is only part of the key. So "Global Equity" repeats on every holding of that fund, and renaming the fund needs many updates.',
        tables: [
          t(
            'h',
            'holding',
            ['account_id', 'fund_id', 'units', 'fund_name'],
            [r('1', [10, 'F1', 40, 'Global Equity'], { tone: 'warn', hl: [3] }), r('2', [11, 'F1', 15, 'Global Equity'], { tone: 'warn', hl: [3] }), r('3', [11, 'F2', 90, 'Bond Income'])],
            { pk: [0, 1], badge: 'not 2NF', tone: 'bad' },
          ),
        ],
      },
      {
        note: 'The 2NF fix: every non-key column must depend on the whole key. fund_name moves to a fund table, keyed by fund_id. A holding keeps only what depends on the account and the fund together, which is the number of units.',
        tables: [
          t('f', 'fund', ['fund_id', 'fund_name'], [r('f1', ['F1', 'Global Equity'], { tone: 'new' }), r('f2', ['F2', 'Bond Income'], { tone: 'new' })], { pk: [0], badge: 'new', tone: 'new' }),
          t('h', 'holding', ['account_id', 'fund_id', 'units'], [r('1', [10, 'F1', 40]), r('2', [11, 'F1', 15]), r('3', [11, 'F2', 90])], { pk: [0, 1], fk: [1], badge: '2NF', tone: 'ok' }),
        ],
      },
      {
        note: 'This breaks 3NF. In the account table, branch_city depends on branch_id, which is not the key. The chain goes account_id to branch_id to branch_city, which is called a transitive dependency. Every account at the same branch repeats the city.',
        tables: [
          t(
            'a',
            'account',
            ['account_id', 'owner', 'branch_id', 'branch_city'],
            [r('1', [10, 'Alice', 'B1', 'Singapore'], { tone: 'warn', hl: [3] }), r('2', [11, 'Bob', 'B1', 'Singapore'], { tone: 'warn', hl: [3] }), r('3', [12, 'Carol', 'B2', 'Kuala Lumpur'])],
            { pk: [0], badge: 'not 3NF', tone: 'bad' },
          ),
        ],
      },
      {
        note: 'The 3NF fix: branch_city moves to a branch table, and the account keeps only branch_id as a foreign key. The rule to remember is that every non-key column depends on "the key, the whole key and nothing but the key".',
        tables: [
          t('br', 'branch', ['branch_id', 'city'], [r('b1', ['B1', 'Singapore'], { tone: 'new' }), r('b2', ['B2', 'Kuala Lumpur'], { tone: 'new' })], { pk: [0], badge: 'new', tone: 'new' }),
          t('a', 'account', ['account_id', 'owner', 'branch_id'], [r('1', [10, 'Alice', 'B1']), r('2', [11, 'Bob', 'B1']), r('3', [12, 'Carol', 'B2'])], { pk: [0], fk: [2], badge: '3NF', tone: 'ok' }),
        ],
      },
    ],
  },
  {
    id: 'denormalise',
    label: 'Denormalising on purpose',
    title: 'Normalise by default, and denormalise on purpose for read speed',
    frames: [
      {
        note: 'A statement page needs the customer name, the branch city and the amount. In the normalised design, that is a join over three tables on every request. It is correct and flexible, but on a very busy read path the joins add up.',
        tables: [
          t('cust', 'customer', ['customer_id', 'name'], [r('c1', [1, 'Alice']), r('c2', [2, 'Bob'])], { pk: [0] }),
          t('br', 'branch', ['branch_id', 'city'], [r('b1', [1, 'Singapore']), r('b2', [2, 'Kuala Lumpur'])], { pk: [0] }),
          t('txn', 'transfer', ['txn_id', 'customer_id', 'branch_id', 'amount'], [r('t1', [1, 1, 1, 500]), r('t2', [2, 2, 2, 80])], { pk: [0], fk: [1, 2], badge: '3 tables, 2 joins', tone: 'warn' }),
        ],
      },
      {
        note: 'To denormalise, keep the normalised tables as the source of truth, and add a copy shaped for the read. The copy can be a reporting table, a materialised view, a cache or a search document. One read, with no joins.',
        tables: [
          t('rep', 'statement_view', ['txn_id', 'customer', 'city', 'amount'], [r('s1', [1, 'Alice', 'Singapore', 500], { tone: 'new' }), r('s2', [2, 'Bob', 'Kuala Lumpur', 80], { tone: 'new' })], { pk: [0], badge: 'derived copy', tone: 'new' }),
        ],
      },
      {
        note: 'The price is keeping the copy in sync. When Alice\'s name changes, the source changes in one place. But the copy stays stale until a trigger, a refresh or an event updates it. This is the same trade as embedding in a document store.',
        tables: [
          t('cust', 'customer', ['customer_id', 'name'], [r('c1', [1, 'Alicia'], { tone: 'ok', hl: [1] }), r('c2', [2, 'Bob'])], { pk: [0], badge: 'source updated', tone: 'ok' }),
          t('rep', 'statement_view', ['txn_id', 'customer', 'city', 'amount'], [r('s1', [1, 'Alice', 'Singapore', 500], { tone: 'warn', hl: [1] }), r('s2', [2, 'Bob', 'Kuala Lumpur', 80])], { pk: [0], badge: 'stale until refreshed', tone: 'warn' }),
        ],
      },
    ],
  },
];
