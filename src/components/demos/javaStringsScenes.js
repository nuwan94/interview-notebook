// Frame data for the Java Strings walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JAVA_STRINGS_SCENES = [
  {
    id: 'pool',
    label: 'String pool and ==',
    title: 'Literals share one pooled object, new String creates another, and == compares references',
    frames: [
      {
        note: 'String literals in source code are interned: the JVM keeps one copy of each distinct literal in the string pool (part of the heap) and every use of that literal points to it. So a and b below refer to the very same object.',
        boxes: [b('a', 'String a = "ACC-1"', ['reference to the pooled literal'], 'new'), b('b', 'String b = "ACC-1"', ['same pooled literal'], 'new'), b('p', 'String pool', ['"ACC-1" (one object)'], 'ok', 'shared')],
        deps: [d('String a = "ACC-1"', 'String pool', 'points to', 'ok'), d('String b = "ACC-1"', 'String pool', 'points to', 'ok')],
      },
      {
        note: 'new String("ACC-1") always creates a fresh object on the heap, even though the same text is in the pool. The new object and the pooled one hold equal characters but are different objects, so == is false.',
        boxes: [b('a', 'String a = "ACC-1"', ['pooled literal'], 'ok'), b('c', 'String c = new String("ACC-1")', ['a separate heap object'], 'warn', 'new object'), b('p', 'String pool', ['"ACC-1"'], 'ok')],
        deps: [d('String a = "ACC-1"', 'String pool', 'points to', 'ok')],
      },
      {
        note: '== compares references (are these the same object?). equals compares content (do they hold the same characters?). Always compare strings with equals, and prefer "ACC-1".equals(x) or Objects.equals so a null x does not throw.',
        boxes: [b('x', 'a == c', ['false: different objects'], 'bad', 'reference'), b('y', 'a.equals(c)', ['true: same characters'], 'ok', 'content'), b('z', '"ACC-1".equals(input)', ['null-safe'], 'ok', 'preferred')],
        deps: [],
      },
      {
        note: 'intern() returns the pooled instance for a string, so c.intern() == a is true. It is rarely needed, and the pool is not a general cache. A compile-time constant such as "AC" + "C-1" is folded to the literal and pooled, but a concatenation done at run time creates a new object.',
        boxes: [b('i', 'c.intern() == a', ['true: returns the pooled copy'], 'ok'), b('k', '"AC" + "C-1" == a', ['true: folded at compile time'], 'ok'), b('r', 'prefix + "C-1" == a', ['false: built at run time'], 'bad')],
        deps: [],
      },
    ],
  },
  {
    id: 'concat',
    label: 'Concatenation in loops',
    title: 'Every + on a String creates a new object, so building text in a loop needs a StringBuilder',
    frames: [
      {
        note: 'Strings never change, so s = s + part builds a brand-new String each time, copying everything so far. In a loop of n parts the copies grow, making the total work O(n squared) and creating a lot of garbage.',
        boxes: [b('l', 'for 10,000 lines', ['s = s + line'], 'warn'), b('s1', 'String of 1 line', ['copy 1'], 'none'), b('s2', 'String of 2 lines', ['copy 2'], 'none'), b('s3', 'String of 10,000 lines', ['copy 10,000'], 'bad', 'slow')],
        deps: [d('for 10,000 lines', 'String of 10,000 lines', 'every pass copies', 'bad')],
      },
      {
        note: 'A StringBuilder keeps a growable character buffer and appends in place. The buffer doubles when full, so appending is amortised O(1) and toString() makes just one String at the end.',
        boxes: [b('b', 'StringBuilder', ['mutable buffer', 'append in place'], 'ok'), b('l', 'for 10,000 lines', ['sb.append(line)'], 'new'), b('s', 'sb.toString()', ['one String created at the end'], 'ok', 'fast')],
        deps: [d('for 10,000 lines', 'StringBuilder', 'append', 'ok'), d('StringBuilder', 'sb.toString()', 'once', 'ok')],
      },
      {
        note: 'StringBuilder is not thread-safe and is the normal choice. StringBuffer has synchronized methods, so it is slower and almost never needed, because a builder is normally used by one thread only. A simple one-line a + b + c is fine: the compiler turns it into an efficient call.',
        boxes: [b('a', 'StringBuilder', ['fast, not synchronized', 'default choice'], 'ok'), b('b', 'StringBuffer', ['synchronized, slower', 'legacy'], 'warn'), b('c', 'a + b + c in one expression', ['compiler optimises it'], 'ok')],
        deps: [],
      },
      {
        note: 'Other tools: String.join(", ", list) and Collectors.joining for lists, String.format or formatted() for templates, and text blocks for multi-line text. They are readable and avoid manual loops.',
        boxes: [b('j', 'String.join(", ", ids)', ['list to text'], 'ok'), b('f', '"%s owes %.2f".formatted(n, amt)', ['templates'], 'ok'), b('t', 'Text block """ ... """', ['multi-line JSON or SQL'], 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'immutable',
    label: 'Why String is immutable',
    title: 'Immutability makes strings safe as keys, safe to share between threads and safe to pass around',
    frames: [
      {
        note: 'String is a final class and holds a private final array of characters with no method that changes it. Methods such as toUpperCase or substring return a new String and leave the original alone.',
        boxes: [b('a', 'String name = "ana"', ['value never changes'], 'new'), b('b', 'name.toUpperCase()', ['returns a new String "ANA"'], 'ok'), b('c', 'name', ['still "ana"', 'result must be assigned'], 'warn')],
        deps: [d('String name = "ana"', 'name.toUpperCase()', 'does not modify', 'ok')],
      },
      {
        note: 'Reason 1: the pool. If strings could change, changing one literal would change every variable that shares it. Reason 2: hashing. A String caches its hashCode, which is safe only because the content never changes, so strings are ideal HashMap keys.',
        boxes: [b('p', 'String pool', ['shared safely'], 'ok'), b('h', 'cached hashCode', ['computed once', 'safe as a HashMap key'], 'ok')],
        deps: [],
      },
      {
        note: 'Reason 3: threads and security. An immutable object can be shared by many threads without locks. Values such as file paths, class names and database URLs cannot be altered after a security check has approved them.',
        boxes: [b('t', 'Many threads', ['read the same String', 'no synchronisation needed'], 'ok'), b('s', 'Security check', ['path approved', 'cannot change afterwards'], 'ok')],
        deps: [d('Many threads', 'Security check', 'safe to share', 'ok')],
      },
      {
        note: 'The same idea applies to your own value classes. Make them final, with private final fields, no setters, and defensive copies of any mutable parts. A record does most of this for you. Immutable money, ids and dates remove a whole class of bugs.',
        boxes: [b('r', 'record Money(BigDecimal amount, String currency)', ['final fields', 'no setters'], 'ok', 'immutable'), b('d', 'Defensive copy', ['List.copyOf(items) in the constructor'], 'ok'), b('m', 'Mutable Date field', ['callers can change it later'], 'bad', 'leak')],
        deps: [],
      },
    ],
  },
  {
    id: 'unicode',
    label: 'Characters and encoding',
    title: 'A Java char is not always a character, and bytes need an explicit charset',
    frames: [
      {
        note: 'A String stores UTF-16 code units. Most characters take one char, but emoji and some scripts need two (a surrogate pair). So length() counts code units, not what a person sees as characters.',
        boxes: [b('a', '"Ana"', ['length() = 3'], 'ok'), b('b', '"A😀"', ['length() = 3', 'but 2 visible characters'], 'warn', 'surrogate pair'), b('c', 'codePointCount()', ['counts real code points'], 'ok', 'correct')],
        deps: [],
      },
      {
        note: 'Converting between text and bytes needs a charset. getBytes() with no argument used the platform default, which differed between machines and caused garbled text. Always pass StandardCharsets.UTF_8 (the default only became UTF-8 everywhere in Java 18).',
        boxes: [b('x', 's.getBytes()', ['platform default charset', 'differs per machine'], 'bad'), b('y', 's.getBytes(StandardCharsets.UTF_8)', ['explicit and portable'], 'ok', 'preferred')],
        deps: [],
      },
      {
        note: 'Case conversion depends on the locale. In a Turkish locale "TITLE".toLowerCase() turns I into a dotless i and breaks comparisons and lookups. Use toLowerCase(Locale.ROOT) for identifiers, protocol keywords and map keys.',
        boxes: [b('x', 'id.toLowerCase()', ['uses the default locale'], 'warn'), b('y', 'id.toLowerCase(Locale.ROOT)', ['same result everywhere'], 'ok', 'safe')],
        deps: [],
      },
    ],
  },
];
