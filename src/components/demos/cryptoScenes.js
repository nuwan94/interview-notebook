// Frame data for the encryption walk-through (uses the same box-and-arrow player as the design demos).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const CRYPTO_SCENES = [
  {
    id: 'symmetric',
    label: 'Symmetric',
    title: 'Symmetric: one shared secret key does both jobs',
    frames: [
      {
        note: 'Alice wants to send Bob a private message. They share one secret key K, agreed in advance through some safe channel. Eve can read everything that travels over the network.',
        boxes: [b('a', 'Alice', ['has key K', 'message: "meet at 9"'], 'ok'), b('b', 'Bob', ['has key K'], 'ok'), b('e', 'Eve (eavesdropper)', ['sees all network traffic'], 'warn')],
        deps: [],
      },
      {
        note: 'Alice encrypts the message with K using a cipher such as AES-GCM. The output is ciphertext that looks like random bytes.',
        boxes: [b('a', 'Alice', ['has key K', 'ciphertext: 9f3a...c71e'], 'new', 'encrypted'), b('b', 'Bob', ['has key K'], 'ok'), b('e', 'Eve (eavesdropper)', ['sees all network traffic'], 'warn')],
        deps: [d('Alice', 'ciphertext', 'AES-GCM encrypt with K', 'ok')],
      },
      {
        note: 'The ciphertext crosses the network. Eve sees it but cannot read it without K.',
        boxes: [b('a', 'Alice', ['sent'], 'ok'), b('b', 'Bob', ['received 9f3a...c71e'], 'new'), b('e', 'Eve (eavesdropper)', ['captured 9f3a...c71e', 'cannot decrypt'], 'bad', 'blind')],
        deps: [d('Alice', 'Bob', 'ciphertext over the network', 'ok'), d('Eve', 'ciphertext', 'copies it, no key', 'bad')],
      },
      {
        note: 'Bob decrypts with the same key K and recovers the message. GCM also checks an authentication tag, so any tampering on the way makes decryption fail.',
        boxes: [b('a', 'Alice', ['done'], 'ok'), b('b', 'Bob', ['has key K', 'message: "meet at 9"'], 'ok', 'decrypted'), b('e', 'Eve (eavesdropper)', ['still only ciphertext'], 'bad')],
        deps: [d('Bob', 'message', 'AES-GCM decrypt with K, tag verified', 'ok')],
      },
      {
        note: 'The catch is key distribution: how did Alice and Bob get K to each other safely in the first place? And with n people who all need private channels you need n(n-1)/2 keys. Asymmetric cryptography solves the sharing problem.',
        boxes: [b('a', 'Alice', ['key K'], 'warn'), b('b', 'Bob', ['key K'], 'warn'), b('c', 'Carol', ['key K?'], 'bad', 'how?')],
        deps: [d('Alice', 'Bob', 'must already share K secretly', 'bad')],
      },
    ],
  },
  {
    id: 'asymmetric',
    label: 'Asymmetric',
    title: 'Asymmetric: encrypt with the public key, decrypt with the private key',
    frames: [
      {
        note: 'Bob generates a key pair. The private key never leaves him. The public key can be given to anyone, including Eve; knowing it does not reveal the private key.',
        boxes: [b('a', 'Alice', ['no secret needed'], 'ok'), b('b', 'Bob', ['private key (secret)', 'public key (shared)'], 'ok', 'key pair'), b('e', 'Eve (eavesdropper)', ['knows the public key'], 'warn')],
        deps: [d('Bob', 'Alice', 'publishes his public key', 'ok')],
      },
      {
        note: 'Alice encrypts her message with Bob\'s public key. No secret had to be exchanged beforehand.',
        boxes: [b('a', 'Alice', ['has Bob\'s public key', 'ciphertext: 51d0...8a2f'], 'new', 'encrypted'), b('b', 'Bob', ['private key (secret)'], 'ok'), b('e', 'Eve (eavesdropper)', ['knows the public key'], 'warn')],
        deps: [d('Alice', 'ciphertext', 'RSA-OAEP encrypt with Bob\'s public key', 'ok')],
      },
      {
        note: 'Eve captures the ciphertext. She has the public key too, but it can only encrypt, not decrypt. Only the private key can undo it.',
        boxes: [b('a', 'Alice', ['sent'], 'ok'), b('b', 'Bob', ['received 51d0...8a2f'], 'new'), b('e', 'Eve (eavesdropper)', ['has ciphertext and public key', 'cannot decrypt'], 'bad', 'blind')],
        deps: [d('Alice', 'Bob', 'ciphertext over the network', 'ok'), d('Eve', 'ciphertext', 'copies it, no private key', 'bad')],
      },
      {
        note: 'Bob decrypts with his private key. The cost: asymmetric operations are slow and can only encrypt small amounts of data, so in practice they protect a symmetric key, not the whole message.',
        boxes: [b('a', 'Alice', ['done'], 'ok'), b('b', 'Bob', ['message: "meet at 9"'], 'ok', 'decrypted'), b('e', 'Eve (eavesdropper)', ['still blind'], 'bad')],
        deps: [d('Bob', 'message', 'RSA-OAEP decrypt with his private key', 'ok')],
      },
    ],
  },
  {
    id: 'signature',
    label: 'Digital signature',
    title: 'Signatures run the keys the other way round',
    frames: [
      {
        note: 'A signature proves who wrote a message and that it was not changed. Alice has a key pair; everyone knows her public key.',
        boxes: [b('a', 'Alice', ['private key (secret)', 'public key (shared)', 'message: "pay 10 to Bob"'], 'ok'), b('b', 'Bob', ['knows Alice\'s public key'], 'ok')],
        deps: [],
      },
      {
        note: 'Alice hashes the message and signs the hash with her private key. Only she can produce this value.',
        boxes: [b('a', 'Alice', ['message: "pay 10 to Bob"', 'signature: 7c2e...b90d'], 'new', 'signed'), b('b', 'Bob', ['knows Alice\'s public key'], 'ok')],
        deps: [d('Alice', 'signature', 'sign hash(message) with her private key', 'ok')],
      },
      {
        note: 'Bob receives the message and the signature and verifies them with Alice\'s public key. The check passes: the message came from Alice and is unchanged.',
        boxes: [b('a', 'Alice', ['done'], 'ok'), b('b', 'Bob', ['message: "pay 10 to Bob"', 'verify with public key: VALID'], 'ok', 'valid')],
        deps: [d('Bob', 'signature', 'verify with Alice\'s public key', 'ok')],
      },
      {
        note: 'Mallory changes the amount in transit. The hash of the altered message no longer matches the signature, so verification fails and Bob rejects it. A signature gives integrity, authenticity and non-repudiation, but not secrecy (the message is still readable).',
        boxes: [b('a', 'Alice', ['signed "pay 10 to Bob"'], 'ok'), b('m', 'Mallory', ['changed it to "pay 1000 to Mallory"'], 'bad', 'tampering'), b('b', 'Bob', ['verify with public key: INVALID'], 'bad', 'rejected')],
        deps: [d('Mallory', 'message', 'alters it in transit', 'bad'), d('Bob', 'signature', 'verification fails', 'bad')],
      },
    ],
  },
  {
    id: 'hybrid',
    label: 'Hybrid (TLS)',
    title: 'Hybrid: asymmetric agrees the key, symmetric moves the data',
    frames: [
      {
        note: 'A client opens an HTTPS connection to a server. Symmetric encryption is fast but needs a shared key; asymmetric cryptography can create one over an open network. TLS combines them.',
        boxes: [b('c', 'Client (browser)', ['wants a private channel'], 'ok'), b('s', 'Server', ['certificate with its public key'], 'ok'), b('e', 'Eve (eavesdropper)', ['sees the whole handshake'], 'warn')],
        deps: [],
      },
      {
        note: 'The server proves its identity with a certificate that a trusted certificate authority signed. The client checks the chain, the expiry date and that the name matches the site.',
        boxes: [b('c', 'Client (browser)', ['certificate: VALID'], 'ok', 'trusts the CA'), b('s', 'Server', ['certificate signed by a CA'], 'ok'), b('e', 'Eve (eavesdropper)', ['sees the certificate (public)'], 'warn')],
        deps: [d('Server', 'Client', 'sends certificate', 'ok'), d('Client', 'CA chain', 'verifies signatures and hostname', 'ok')],
      },
      {
        note: 'Both sides run an ephemeral Diffie-Hellman exchange (ECDHE). Each sends a public value and combines it with its own private value. Both arrive at the same secret, which never travelled; Eve saw only the public values and cannot compute it.',
        boxes: [b('c', 'Client (browser)', ['shared secret', 'derives session key'], 'new', 'key agreed'), b('s', 'Server', ['shared secret', 'derives session key'], 'new', 'key agreed'), b('e', 'Eve (eavesdropper)', ['saw both public values', 'cannot derive the secret'], 'bad', 'blind')],
        deps: [d('Client', 'Server', 'public value', 'ok'), d('Server', 'Client', 'public value (signed with its key)', 'ok')],
      },
      {
        note: 'All application data now travels encrypted with a fast symmetric cipher (AES-GCM or ChaCha20-Poly1305) under the session key.',
        boxes: [b('c', 'Client (browser)', ['session key'], 'ok'), b('s', 'Server', ['session key'], 'ok'), b('e', 'Eve (eavesdropper)', ['sees only ciphertext'], 'bad')],
        deps: [d('Client', 'Server', 'AES-GCM encrypted requests', 'ok'), d('Server', 'Client', 'AES-GCM encrypted responses', 'ok')],
      },
      {
        note: 'When the session ends the ephemeral values are thrown away. Even if the server\'s long-term private key is stolen later, old recordings cannot be decrypted: that property is called forward secrecy.',
        boxes: [b('c', 'Client (browser)', ['session over: keys deleted'], 'ok'), b('s', 'Server', ['session over: keys deleted', 'long-term key stolen later'], 'warn'), b('e', 'Eve (eavesdropper)', ['recorded traffic', 'still cannot decrypt'], 'bad', 'forward secrecy')],
        deps: [],
      },
    ],
  },
];
