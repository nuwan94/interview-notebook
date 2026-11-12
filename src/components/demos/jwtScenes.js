// Frame data for the JWT walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JWT_SCENES = [
  {
    id: 'issue',
    label: 'Issue and verify',
    title: 'A JWT is signed once and verified by anyone with the public key',
    frames: [
      {
        note: 'Alice logs in. The token issuer authenticates her and prepares a token with three parts: a header (algorithm and key id), a payload of claims, and a signature that covers both.',
        boxes: [b('c', 'Client (Alice)', ['username + password'], 'ok'), b('i', 'Token issuer', ['header: alg=RS256, kid=k1', 'payload: sub=alice, role=analyst,', 'iss, aud, exp=15 min'], 'new', 'builds token')],
        deps: [d('Client', 'Token issuer', 'POST /login', 'ok')],
      },
      {
        note: 'The issuer signs base64url(header) + "." + base64url(payload) with its private key. The private key never leaves the issuer.',
        boxes: [b('i', 'Token issuer', ['signs with private key k1', 'token = header.payload.signature'], 'ok', 'signed'), b('t', 'Token', ['eyJhbGciOi...eyJzdWIiOi...Sx4pQ...'], 'new')],
        deps: [d('Token issuer', 'Token', 'sign(header.payload)', 'ok')],
      },
      {
        note: 'The client keeps the token and sends it with each API call. Anyone can read the payload (it is only Base64URL encoded), so it must never hold secrets.',
        boxes: [b('c', 'Client (Alice)', ['Authorization: Bearer eyJ...'], 'ok'), b('s', 'API service', ['receives the token'], 'none')],
        deps: [d('Client', 'API service', 'GET /reports', 'ok')],
      },
      {
        note: 'The API picks the public key by kid from the issuer JWKS (cached), checks that the algorithm is one it expects, verifies the signature and then the claims: issuer, audience, expiry. No call to the issuer is needed.',
        boxes: [b('s', 'API service', ['alg allowed: RS256', 'signature valid with key k1', 'iss ok, aud ok, exp ok'], 'ok', 'valid'), b('i', 'Token issuer', ['only publishes its JWKS'], 'none')],
        deps: [d('API service', 'Token issuer', 'fetch public keys once (JWKS)', 'ok')],
      },
      {
        note: 'The API now trusts the claims (sub=alice, role=analyst) and applies its authorization rules. Verification proves who issued the token and that it was not changed; it does not hide the content.',
        boxes: [b('s', 'API service', ['identity: alice', 'role: analyst', 'serves the request'], 'ok', '200 OK'), b('c', 'Client (Alice)', ['gets the report'], 'ok')],
        deps: [d('API service', 'Client', '200 OK', 'ok')],
      },
    ],
  },
  {
    id: 'attacks',
    label: 'Tampering attacks',
    title: 'What the signature stops, and what a careless verifier lets through',
    frames: [
      {
        note: 'Mallory is a normal user with role=analyst. She decodes her token (easy, it is Base64URL) and changes role to admin.',
        boxes: [b('m', 'Mallory', ['payload: role=analyst', 'edits it to role=admin'], 'bad', 'tampering'), b('t', 'Token', ['old signature kept'], 'warn')],
        deps: [d('Mallory', 'Token', 'edits the payload', 'bad')],
      },
      {
        note: 'The API recomputes the signature over the new payload. It no longer matches the one in the token, and Mallory cannot make a valid one without the private key. The request is rejected.',
        boxes: [b('m', 'Mallory', ['sends the edited token'], 'bad'), b('s', 'API service', ['signature does not match'], 'ok', '401 rejected')],
        deps: [d('Mallory', 'API service', 'GET /admin  (edited token)', 'bad')],
      },
      {
        note: 'Attack 2, "alg none": Mallory sets the header to alg=none and removes the signature. A verifier that trusts the algorithm named in the token header would treat it as valid.',
        boxes: [b('m', 'Mallory', ['header: alg=none', 'signature removed'], 'bad'), b('s', 'Vulnerable server', ['reads alg from the token', 'alg none: nothing to check'], 'bad', 'accepted!')],
        deps: [d('Mallory', 'Vulnerable server', 'unsigned admin token', 'bad')],
      },
      {
        note: 'Fix: the verifier decides which algorithms and keys are acceptable (a fixed allow-list, never "none"). The token header may only select a key, not the rules.',
        boxes: [b('m', 'Mallory', ['header: alg=none'], 'bad'), b('s', 'API service', ['allowed: RS256 only', 'alg none is not on the list'], 'ok', '401 rejected')],
        deps: [d('Mallory', 'API service', 'unsigned admin token', 'bad')],
      },
      {
        note: 'Attack 3, algorithm confusion: the server expects RS256 (public key verifies). Mallory switches the header to HS256 and signs with the public key, which she knows, as if it were an HMAC secret. A library that picks the algorithm from the header accepts it. Pinning the algorithm per key prevents it.',
        boxes: [b('m', 'Mallory', ['alg=HS256', 'HMAC key = the public key'], 'bad'), b('s', 'API service', ['key k1 is RSA, so only RS256 allowed'], 'ok', '401 rejected')],
        deps: [d('Mallory', 'API service', 'token signed with the public key', 'bad')],
      },
    ],
  },
  {
    id: 'hs-vs-rs',
    label: 'HS256 vs RS256',
    title: 'Shared secret or key pair: who can forge a token?',
    frames: [
      {
        note: 'HS256 uses one shared secret (HMAC). The issuer and every service that verifies tokens hold the same secret.',
        boxes: [b('i', 'Token issuer', ['secret S'], 'ok'), b('a', 'Orders API', ['secret S'], 'ok'), b('b', 'Billing API', ['secret S'], 'ok'), b('c', 'Reports API', ['secret S'], 'ok')],
        deps: [d('Token issuer', 'Orders API', 'shares the secret', 'ok')],
      },
      {
        note: 'Because every verifier holds the secret, every verifier can also create tokens. If any one service is breached, the attacker can forge tokens accepted by all of them.',
        boxes: [b('m', 'Attacker', ['breached the Reports API', 'knows secret S'], 'bad'), b('b', 'Billing API', ['accepts the forged token'], 'bad', 'forged')],
        deps: [d('Attacker', 'Billing API', 'token signed with S', 'bad')],
      },
      {
        note: 'RS256 and ES256 use a key pair. Only the issuer holds the private key; services only get the public key, which can verify but not sign.',
        boxes: [b('i', 'Token issuer', ['private key (secret)', 'publishes public key'], 'ok'), b('a', 'Orders API', ['public key'], 'new'), b('b', 'Billing API', ['public key'], 'new'), b('c', 'Reports API', ['public key'], 'new')],
        deps: [d('Token issuer', 'Orders API', 'public key via JWKS', 'ok')],
      },
      {
        note: 'Now a breached service leaks only a public key, which is already public. The attacker cannot forge tokens. Use HS256 only when issuer and verifier are the same trusted service; otherwise prefer RS256, ES256 or EdDSA.',
        boxes: [b('m', 'Attacker', ['breached the Reports API', 'has only the public key'], 'warn'), b('b', 'Billing API', ['cannot validate a forged signature'], 'ok', '401 rejected')],
        deps: [d('Attacker', 'Billing API', 'forged token', 'bad')],
      },
    ],
  },
];
