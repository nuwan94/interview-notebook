// Frame data for the Spring Data JPA and Hibernate walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SPRING_JPA_SCENES = [
  {
    id: 'states',
    label: 'Entity states',
    title: 'An entity moves between transient, managed, detached and removed',
    frames: [
      {
        note: 'new Account() creates a plain Java object. It is transient: the persistence context knows nothing about it, it has no database row, and changes to it are never saved.',
        boxes: [b('e', 'Account entity', ['new Account("Alice", 100)', 'id = null'], 'none', 'transient'), b('p', 'Persistence context', ['empty'], 'none')],
        deps: [],
      },
      {
        note: 'repository.save(account) (persist) makes it managed. The persistence context now tracks it. The INSERT is not necessarily run immediately: Hibernate queues it and sends it at flush time, usually at commit.',
        boxes: [b('e', 'Account entity', ['id assigned', 'tracked by the context'], 'ok', 'managed'), b('p', 'Persistence context', ['holds Account #1', 'INSERT queued'], 'new'), b('db', 'Database', ['no row yet'], 'none')],
        deps: [d('Account entity', 'Persistence context', 'persist', 'ok')],
      },
      {
        note: 'While managed, changing a field is enough. At flush Hibernate compares the entity with the snapshot it took when loading (dirty checking) and issues an UPDATE. No save() call is needed inside a transaction.',
        boxes: [b('e', 'Account entity', ['balance 100 -> 70', 'setBalance() only'], 'ok', 'dirty'), b('p', 'Persistence context', ['dirty check at flush'], 'new'), b('db', 'Database', ['UPDATE account SET balance = 70'], 'ok', 'at commit')],
        deps: [d('Persistence context', 'Database', 'flush on commit', 'ok')],
      },
      {
        note: 'When the transaction ends and the context closes, the entity becomes detached: it still has its data and id but is no longer tracked, so further changes are not saved automatically. Lazy associations can no longer be loaded.',
        boxes: [b('e', 'Account entity', ['still in memory', 'changes are ignored'], 'warn', 'detached'), b('p', 'Persistence context', ['closed'], 'none')],
        deps: [],
      },
      {
        note: 'save() on a detached entity calls merge: Hibernate loads the current row into the context and copies the state onto that managed instance. Use the returned object, not the one you passed in. repository.delete() moves a managed entity to removed, and the DELETE is sent at flush.',
        boxes: [b('e', 'Account entity', ['detached copy passed in'], 'warn'), b('m', 'Persistence context', ['merge: managed copy returned'], 'ok', 'managed again')],
        deps: [d('Account entity', 'Persistence context', 'merge', 'ok')],
      },
    ],
  },
  {
    id: 'n1',
    label: 'The N+1 problem',
    title: 'One query for the list, then one more per row, unless you fetch together',
    frames: [
      {
        note: 'A report loads all 100 customers and prints each one\'s addresses. customerRepository.findAll() runs one query for the customers. Addresses are lazy, so they are not loaded yet.',
        boxes: [b('s', 'Service bean', ['findAll()'], 'new'), b('db', 'Database', ['query 1: SELECT * FROM customer', '100 rows'], 'ok', '1 query')],
        deps: [d('Service bean', 'Database', 'SELECT customers', 'ok')],
      },
      {
        note: 'The loop touches customer.getAddresses() on each customer. Every access triggers its own SELECT ... WHERE customer_id = ?, so 100 more queries run. Total 1 + N = 101 queries to print one page. It works in development with 5 rows and collapses in production.',
        boxes: [b('s', 'Service bean', ['for each customer: getAddresses()'], 'warn'), b('db', 'Database', ['101 queries', 'one per customer'], 'bad', 'N+1')],
        deps: [d('Service bean', 'Database', 'SELECT addresses x 100', 'bad')],
      },
      {
        note: 'Fix 1: fetch the association in the same query with a fetch join (or an entity graph): SELECT c FROM Customer c JOIN FETCH c.addresses. One query returns customers with their addresses already loaded.',
        boxes: [b('s', 'Service bean', ['findAllWithAddresses()'], 'ok'), b('db', 'Database', ['1 query with a join'], 'ok', 'fixed')],
        deps: [d('Service bean', 'Database', 'SELECT ... JOIN FETCH', 'ok')],
      },
      {
        note: 'Fix 2, for paged lists: batch fetching (@BatchSize or hibernate.default_batch_fetch_size) loads the addresses of 50 customers per query, so 100 customers need 3 queries. Or use a DTO projection that selects only the columns the page needs. Detect the problem by logging SQL or counting statements in tests.',
        boxes: [b('s', 'Service bean', ['@BatchSize(50) or a DTO projection'], 'ok'), b('db', 'Database', ['3 queries instead of 101'], 'ok', 'batched')],
        deps: [d('Service bean', 'Database', 'IN (?, ?, ...) x 50', 'ok')],
      },
    ],
  },
  {
    id: 'lazy',
    label: 'Lazy loading error',
    title: 'Touching a lazy association after the transaction ended throws LazyInitializationException',
    frames: [
      {
        note: 'findById() runs inside a transactional service method. The Account is loaded and its transactions collection is lazy: only a proxy placeholder is held, no SQL has run for it.',
        boxes: [b('s', 'Service bean', ['@Transactional findById()'], 'new'), b('p', 'Persistence context', ['Account loaded', 'transactions: lazy proxy'], 'ok', 'open'), b('db', 'Database', ['SELECT account only'], 'ok')],
        deps: [d('Service bean', 'Persistence context', 'load', 'ok')],
      },
      {
        note: 'The method returns and the transaction commits. The persistence context closes, so the Account is detached. The lazy collection is still just a proxy, and it can no longer reach the database.',
        boxes: [b('s', 'Service bean', ['returns the entity'], 'ok'), b('p', 'Persistence context', ['closed'], 'warn', 'closed')],
        deps: [],
      },
      {
        note: 'Later, the controller or a JSON serializer calls account.getTransactions(). The proxy needs the context to load the rows and finds it closed: LazyInitializationException ("could not initialize proxy - no Session").',
        boxes: [b('c', 'Controller', ['account.getTransactions()'], 'bad'), b('p', 'Persistence context', ['no session'], 'bad', 'LazyInitializationException')],
        deps: [d('Controller', 'Persistence context', 'load lazy collection', 'bad')],
      },
      {
        note: 'Fixes: load what you need inside the transaction (fetch join, entity graph), return a DTO instead of the entity so the web layer never touches lazy data, or map inside the service. Avoid making everything EAGER, and be aware that open-in-view keeps the session open during rendering but hides queries and holds a connection longer.',
        boxes: [b('s', 'Service bean', ['maps to AccountDto inside the transaction'], 'ok', 'DTO'), b('c', 'Controller', ['gets plain data only'], 'ok')],
        deps: [d('Service bean', 'Controller', 'AccountDto', 'ok')],
      },
    ],
  },
];
