// Frame data for the "Node.js security" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const NODE_SECURITY_SCENES = [
  {
    id: 'input',
    label: 'Never trust input',
    title: 'Everything from outside is hostile until checked',
    frames: [
      {
        note: 'Request bodies, query strings, headers, cookies, file names and even data from other services cross a trust boundary. Validate them once, at the edge, against a strict schema: right types, lengths, ranges and allowed values. After that the rest of the code works with clean, typed data.',
        boxes: [b('u', 'Untrusted input', ['body, query, headers'], 'bad'), b('v', 'Schema validation', ['strict, at the edge'], 'new'), b('t', 'Typed clean data', ['safe to use'], 'ok')],
        deps: [d('Untrusted input', 'Schema validation', 'checked by', 'warn'), d('Schema validation', 'Typed clean data', 'produces', 'ok')],
      },
      {
        note: 'Building SQL by concatenating strings lets an attacker change the query: a quote in the account name adds an OR condition that returns every row. Parameterised queries send the SQL and the values separately, so a value can never become code. Allow-list anything that cannot be a parameter, such as a column name for sorting.',
        boxes: [b('s', 'String-built SQL', ["'... ' + req.query.name"], 'bad'), b('i', 'Injected condition', ["OR '1'='1'"], 'bad'), b('p', 'Parameterised query', ['WHERE name = $1'], 'ok')],
        deps: [d('String-built SQL', 'Injected condition', 'allows', 'bad'), d('Injected condition', 'Parameterised query', 'fixed by', 'ok')],
      },
      {
        note: 'Mass assignment: spreading the request body into a database update lets a caller send role or isAdmin and change fields they should never touch. Reject unknown keys and build the object from the fields you allow, never from the whole body.',
        boxes: [b('s', 'Spread req.body', ['db.update({...body})'], 'bad'), b('r', 'role set to admin', ['field never meant to change'], 'bad'), b('a', 'Pick allowed fields', ['unknown keys rejected'], 'ok')],
        deps: [d('Spread req.body', 'role set to admin', 'allows', 'bad'), d('role set to admin', 'Pick allowed fields', 'fixed by', 'ok')],
      },
      {
        note: 'Prototype pollution: a recursive merge of untrusted JSON that follows the key __proto__ writes onto Object.prototype, so every object in the process suddenly has isAdmin set. Skip the dangerous keys, use Object.hasOwn checks, or keep dictionaries in a Map or an object without a prototype.',
        boxes: [b('m', 'Deep merge of input', ['follows __proto__'], 'bad'), b('p', 'Prototype polluted', ['every object has isAdmin'], 'bad'), b('s', 'Safe merge or Map', ['skip __proto__, constructor'], 'ok')],
        deps: [d('Deep merge of input', 'Prototype polluted', 'causes', 'bad'), d('Prototype polluted', 'Safe merge or Map', 'fixed by', 'ok')],
      },
    ],
  },
  {
    id: 'server',
    label: 'Server-side requests and files',
    title: 'When your server fetches, reads or runs things',
    frames: [
      {
        note: 'Server-side request forgery: your service fetches a URL the user supplied, and the user points it at an internal address such as the cloud metadata service at 169.254.169.254, which hands out credentials. Allow-list hosts, resolve the name and refuse private, loopback and link-local addresses, do not follow redirects blindly, and set timeouts.',
        boxes: [b('u', 'User-supplied URL', ['webhook or image URL'], 'warn'), b('m', 'Metadata service', ['169.254.169.254'], 'bad'), b('a', 'Allow-list and IP check', ['public addresses only'], 'ok')],
        deps: [d('User-supplied URL', 'Metadata service', 'can reach', 'bad'), d('Allow-list and IP check', 'User-supplied URL', 'guards', 'ok')],
      },
      {
        note: 'Path traversal: a file name such as ../../etc/passwd climbs out of the folder you meant to serve. Resolve the full path first, then check that the result is still inside the base directory. Never join user text onto a path and open it without that check.',
        boxes: [b('t', 'Dot-dot-slash path', ['../../etc/passwd'], 'bad'), b('r', 'Resolve and compare', ['path.resolve, relative'], 'new'), b('i', 'Inside the base folder', ['only then open it'], 'ok')],
        deps: [d('Dot-dot-slash path', 'Resolve and compare', 'checked by', 'warn'), d('Resolve and compare', 'Inside the base folder', 'allows', 'ok')],
      },
      {
        note: 'Command injection: child_process.exec passes one string to a shell, so user text containing && or a semicolon runs extra commands. execFile with an argument array starts the program directly and the text stays one argument. Better still, avoid spawning programs for work a library can do.',
        boxes: [b('e', 'exec with user text', ['shell parses it'], 'bad'), b('s', 'Shell runs extra commands', ['; rm, && curl'], 'bad'), b('f', 'execFile with arguments', ['no shell involved'], 'ok')],
        deps: [d('exec with user text', 'Shell runs extra commands', 'allows', 'bad'), d('Shell runs extra commands', 'execFile with arguments', 'fixed by', 'ok')],
      },
    ],
  },
  {
    id: 'browser',
    label: 'Protect the browser',
    title: 'Keep scripts and cross-site requests out',
    frames: [
      {
        note: 'Cross-site scripting: user text put into a page without encoding runs as script in the victim browser and can steal data or act as the user. Encode output for its context, never build HTML with string concatenation, sanitise any rich text you must allow, and avoid dangerouslySetInnerHTML with user data.',
        boxes: [b('u', 'Unescaped output', ['user text in HTML'], 'bad'), b('s', 'Script runs in the page', ['steals data'], 'bad'), b('e', 'Encode and sanitise', ['escape per context'], 'ok')],
        deps: [d('Unescaped output', 'Script runs in the page', 'allows', 'bad'), d('Script runs in the page', 'Encode and sanitise', 'fixed by', 'ok')],
      },
      {
        note: 'Defence in depth in the response headers. helmet sets a strict Content Security Policy, HSTS, no sniffing and frame protection. CORS stays an allow-list of known origins, and credentials are never combined with a wildcard. These limit the damage when a bug slips through.',
        boxes: [b('c', 'Content Security Policy', ['script-src self'], 'new'), b('h', 'Security headers', ['helmet defaults'], 'ok'), b('o', 'CORS allow-list', ['known origins only'], 'ok')],
        deps: [d('Content Security Policy', 'Security headers', 'part of', 'ok'), d('Security headers', 'CORS allow-list', 'with', 'ok')],
      },
      {
        note: 'Cookie-based sessions are sent by the browser to your API even from another site, so a hostile page can trigger a transfer. SameSite cookies and an anti-CSRF token or custom header stop the cross-site request, and the server checks the Origin of state-changing calls.',
        boxes: [b('a', 'Cookie authentication', ['sent automatically'], 'warn'), b('s', 'SameSite and token', ['proves same site'], 'ok'), b('x', 'Cross-site request blocked', ['no transfer made'], 'ok')],
        deps: [d('Cookie authentication', 'SameSite and token', 'protected by', 'ok'), d('SameSite and token', 'Cross-site request blocked', 'gives', 'ok')],
      },
    ],
  },
  {
    id: 'defence',
    label: 'Defence in depth',
    title: 'Limit abuse, protect data, watch the supply chain',
    frames: [
      {
        note: 'Assume some requests are hostile or just heavy. Cap body size and request time, limit the request rate per user and per address, cap page sizes and file uploads, and avoid regular expressions that can take exponential time. These limits turn a denial of service into a few rejected requests.',
        boxes: [b('r', 'Rate limit', ['per user and address'], 'new'), b('b', 'Body and time limits', ['size, headers, timeouts'], 'ok'), b('x', 'Attack blunted', ['429 instead of an outage'], 'ok')],
        deps: [d('Rate limit', 'Attack blunted', 'gives', 'ok'), d('Body and time limits', 'Attack blunted', 'gives', 'ok')],
      },
      {
        note: 'Secrets in code, logs or the image leak through every copy of them. Keep secrets in a secret manager, encrypt sensitive fields with an authenticated cipher such as AES-GCM under a managed key, and redact card numbers, tokens and passwords from logs and error messages.',
        boxes: [b('c', 'Secret in the code', ['committed to Git'], 'bad'), b('m', 'Managed key and secret', ['KMS, secret manager'], 'ok'), b('l', 'Redacted logs', ['no PAN, no token'], 'ok')],
        deps: [d('Secret in the code', 'Managed key and secret', 'replace with', 'warn'), d('Managed key and secret', 'Redacted logs', 'and', 'ok')],
      },
      {
        note: 'Most of your code is other people code. A typosquatted package or a hijacked maintainer account runs inside your service. Commit the lockfile, install with it frozen, audit dependencies, update through reviewed automated pull requests, and keep the dependency list short.',
        boxes: [b('u', 'Unvetted package', ['typosquat, install script'], 'bad'), b('l', 'Lockfile and audit', ['frozen install, pnpm audit'], 'ok'), b('a', 'Reviewed updates', ['Renovate pull requests'], 'ok')],
        deps: [d('Unvetted package', 'Lockfile and audit', 'caught by', 'warn'), d('Lockfile and audit', 'Reviewed updates', 'and', 'ok')],
      },
      {
        note: 'You cannot prevent everything, so detect it. Write an audit log of sign-ins, authorisation failures and every money movement, alert on unusual patterns such as many 403 responses or sign-ins from new places, and rehearse the incident response: contain, rotate secrets, investigate, notify, learn.',
        boxes: [b('a', 'Audit log', ['who did what, when'], 'new'), b('s', 'Security alerts', ['spikes in 401, 403'], 'warn'), b('i', 'Incident response', ['contain, rotate, learn'], 'ok')],
        deps: [d('Audit log', 'Security alerts', 'feeds', 'warn'), d('Security alerts', 'Incident response', 'starts', 'ok')],
      },
    ],
  },
];
