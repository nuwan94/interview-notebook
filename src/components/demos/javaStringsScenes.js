// Frame data for the Java Strings walk-through.
// Every scene draws memory: PoolStage for the pool (variables, heap and pool region), StringCellsStage for the
// scenes about characters (each object drawn as a strip of cells, variables pointing at it).

import { PoolStage } from './PoolStage.jsx';
import { StringCellsStage } from './StringCellsStage.jsx';

// cells from text: cells('AB', 'warn') -> [{ t: 'A', tone: 'warn' }, { t: 'B', tone: 'warn' }]
const cells = (text, tone = 'none') => [...text].map((t) => ({ t: t === ' ' ? '␣' : t, tone }));

export const JAVA_STRINGS_SCENES = [
  {
    id: 'pool',
    label: 'String pool and ==',
    title: 'Literals share one object in the string pool, new String makes another, and == compares objects',
    stage: PoolStage, // drawn by PoolStage: variables, the heap and the pool region
    frames: (() => {
      // "ACC-1" sits in the first slot so arrows reach it without crossing the other literals
      const acc = { id: 'acc', text: '"ACC-1"' };
      const pool = [acc, { id: 'sgd', text: '"SGD"' }, { id: 'usd', text: '"USD"' }, { id: 'eur', text: '"EUR"' }, { id: 'pending', text: '"PENDING"' }];
      const c1 = { id: 'c1', text: '"ACC-1"' };
      const e1 = { id: 'e1', text: '"ACC-1"' };
      const a = { n: 'a', to: 'acc' };
      const bb = { n: 'b', to: 'acc' };
      const c = { n: 'c', to: 'c1' };
      const dd = { n: 'd', to: 'acc' };
      const e = { n: 'e', to: 'e1' };
      return [
        {
          line: 'String a = "ACC-1";',
          vars: [a],
          pool,
          heap: [],
          note: 'The string pool is a part of the heap. It holds one copy of each string literal (text in quotes) used by your classes, such as "SGD" and "USD". "ACC-1" is in the pool too, and a points to it.',
        },
        {
          line: 'String b = "ACC-1";',
          vars: [a, bb],
          pool,
          heap: [],
          note: 'The same literal again. The pool already has "ACC-1", so no new object is made: b points to the same object as a.',
        },
        {
          line: 'String c = new String("ACC-1");',
          vars: [a, bb, c],
          pool,
          heap: [c1],
          note: 'new always makes a new object, outside the pool. Now there are two objects with the same text "ACC-1": the pooled one, and the one c points to.',
        },
        {
          line: 'a == b',
          vars: [a, bb, c],
          pool,
          heap: [c1],
          focus: ['a', 'b'],
          result: { text: 'true: same object', tone: 'ok' },
          note: '== asks "do these two variables point to the same object?". a and b both point to the pooled "ACC-1", so the answer is true.',
        },
        {
          line: 'a == c',
          vars: [a, bb, c],
          pool,
          heap: [c1],
          focus: ['a', 'c'],
          result: { text: 'false: different objects', tone: 'bad' },
          note: 'a points into the pool and c points to the object made with new. The text is the same, but they are two different objects, so == is false.',
        },
        {
          line: 'a.equals(c)',
          vars: [a, bb, c],
          pool,
          heap: [c1],
          focus: ['a', 'c'],
          result: { text: 'true: same text', tone: 'ok' },
          note: 'equals compares the text, not the objects. Both contain "ACC-1", so it is true. This is why you should always compare strings with equals.',
        },
        {
          line: 'String d = c.intern();  a == d',
          vars: [a, bb, c, dd],
          pool,
          heap: [c1],
          focus: ['a', 'd'],
          result: { text: 'true: intern() gives the pooled copy', tone: 'ok' },
          note: 'intern() looks up the same text in the pool and returns the pooled object. So d points to the same object as a, and a == d is true.',
        },
        {
          line: 'String e = prefix + "C-1";  a == e',
          vars: [a, bb, c, dd, e],
          pool,
          heap: [c1, e1],
          focus: ['a', 'e'],
          result: { text: 'false: built while running', tone: 'bad' },
          note: 'Here prefix is a normal variable holding "AC", so the text is joined while the program runs and becomes a new object outside the pool. (If both parts were constants, like "AC" + "C-1", the compiler would join them first and the result would be the pooled literal.)',
        },
      ];
    })(),
  },
  {
    id: 'concat',
    label: 'Concatenation in loops',
    title: 'Every + makes a new String and copies the old text, while a StringBuilder fills one buffer',
    stage: StringCellsStage, // each object is a strip of character cells
    frames: (() => {
      const sVar = (to) => [{ name: 'String s', to }];
      const garbage = { text: 'garbage: nothing points here', tone: 'bad' };
      return [
        {
          line: 's = s + part;   // pass 1, part = "A"',
          rows: [{ id: 'p1', label: 'pass 1', tag: { text: 'a new String', tone: 'new' }, cells: cells('A', 'new') }],
          pointers: sVar('p1'),
          result: { text: 'one new String', tone: 'new' },
          footer: { text: 'Characters written so far: 1', tone: 'warn' },
          note: 'The loop runs s = s + part for the parts "A", "B", "C" and "D". A String never changes, so each pass must build a brand-new String. Pass 1 writes one character.',
        },
        {
          line: 's = s + part;   // pass 2, part = "B"',
          rows: [
            { id: 'p1', label: 'pass 1', tag: garbage, cells: cells('A'), dim: true },
            { id: 'p2', label: 'pass 2', tag: { text: 'copies "A", then adds "B"', tone: 'warn' }, cells: [...cells('A', 'warn'), ...cells('B', 'new')] },
          ],
          pointers: sVar('p2'),
          result: { text: 'the old String is garbage', tone: 'warn' },
          footer: { text: 'Characters written so far: 1 + 2 = 3', tone: 'warn' },
          note: 'Pass 2 makes a new String. It copies the old text "A" (orange) and adds "B" (blue). The old String is now garbage, because s points to the new one.',
        },
        {
          line: 's = s + part;   // pass 3, part = "C"',
          rows: [
            { id: 'p1', label: 'pass 1', tag: garbage, cells: cells('A'), dim: true },
            { id: 'p2', label: 'pass 2', tag: garbage, cells: cells('AB'), dim: true },
            { id: 'p3', label: 'pass 3', tag: { text: 'copies "AB", then adds "C"', tone: 'warn' }, cells: [...cells('AB', 'warn'), ...cells('C', 'new')] },
          ],
          pointers: sVar('p3'),
          result: { text: 'every pass copies more', tone: 'warn' },
          footer: { text: 'Characters written so far: 1 + 2 + 3 = 6', tone: 'warn' },
          note: 'Pass 3 copies everything again, now two characters, and adds one. Every pass copies more than the one before.',
        },
        {
          line: 's = s + part;   // pass 4, part = "D"',
          rows: [
            { id: 'p1', label: 'pass 1', tag: garbage, cells: cells('A'), dim: true },
            { id: 'p2', label: 'pass 2', tag: garbage, cells: cells('AB'), dim: true },
            { id: 'p3', label: 'pass 3', tag: garbage, cells: cells('ABC'), dim: true },
            { id: 'p4', label: 'pass 4', tag: { text: 'copies "ABC", then adds "D"', tone: 'warn' }, cells: [...cells('ABC', 'warn'), ...cells('D', 'new')] },
          ],
          pointers: sVar('p4'),
          result: { text: 'slow: the work grows with n²', tone: 'bad' },
          footer: { text: 'Characters written: 1 + 2 + 3 + 4 = 10, and three garbage Strings', tone: 'bad' },
          note: 'Four parts took 10 writes and left three garbage objects. With n parts, the writes add up to about n² / 2. So 1 000 parts need about 500 000 writes. This is O(n²).',
        },
        {
          line: 'sb.append(part);   // "A", "B", "C", "D"',
          rows: [{ id: 'b1', label: 'StringBuilder buffer, capacity 4', tag: { text: 'filled in place', tone: 'ok' }, cells: cells('ABCD', 'new') }],
          pointers: [{ name: 'StringBuilder sb', to: 'b1' }],
          result: { text: 'nothing copied', tone: 'ok' },
          footer: { text: 'Characters written so far: 4, and no garbage', tone: 'ok' },
          note: 'A StringBuilder keeps one array of characters that can change. Here it was created with new StringBuilder(4). Each append writes only the new character at the end. Nothing is copied.',
        },
        {
          line: 'sb.append("E");   // the buffer is full',
          rows: [
            { id: 'b1', label: 'old array', tag: { text: 'garbage after the buffer grew', tone: 'bad' }, cells: cells('ABCD'), dim: true },
            { id: 'b2', label: 'new array, capacity 10', tag: { text: 'copied once, then "E" added', tone: 'warn' }, cells: [...cells('ABCD', 'warn'), ...cells('E', 'new')], empty: 5 },
          ],
          pointers: [{ name: 'StringBuilder sb', to: 'b2' }],
          result: { text: 'one copy, then room to grow', tone: 'ok' },
          footer: { text: 'Characters written: 4 + 4 copied + 1 = 9. The + loop needs 15 for five parts.', tone: 'ok' },
          note: 'When the buffer is full, the builder makes a bigger array, about twice the size (here 4 × 2 + 2 = 10), and copies the text once. Because the size doubles, this happens rarely. On average each append costs a fixed amount of work, so building the text is O(n).',
        },
        {
          line: 'String s = sb.toString();',
          rows: [
            { id: 'b2', label: 'StringBuilder buffer', tag: { text: 'still there, can keep growing', tone: 'none' }, cells: cells('ABCDE'), empty: 5 },
            { id: 's', label: 'the final String', tag: { text: 'made once, at the end', tone: 'ok' }, cells: cells('ABCDE', 'ok') },
          ],
          pointers: [
            { name: 'StringBuilder sb', to: 'b2' },
            { name: 'String s', to: 's', tone: 'ok' },
          ],
          result: { text: 'fast: one String at the end', tone: 'ok' },
          footer: { text: 'toString() copies the 5 characters once, into the final String.', tone: 'ok' },
          note: 'toString() copies the text into one new String, once. Use StringBuilder for this. StringBuffer works the same way, but every method is synchronized, so it is slower. It is rarely needed, because a builder is normally used by one thread.',
        },
        {
          line: 'String msg = name + ": " + amount;',
          rows: [{ id: 'm', label: 'the String msg', tag: { text: 'built in one step', tone: 'ok' }, cells: cells('Ana: 50', 'ok') }],
          pointers: [{ name: 'String msg', to: 'm', tone: 'ok' }],
          result: { text: 'fine: no builder needed', tone: 'ok' },
          footer: { text: 'One String is built, with no garbage and no loop.', tone: 'ok' },
          note: 'One + expression on one line is fine. The compiler turns it into efficient code that works out the final size and builds the String once. You need a StringBuilder only when you add text in a loop.',
        },
      ];
    })(),
  },
  {
    id: 'immutable',
    label: 'Why String is immutable',
    title: 'A String never changes, so it is safe to share, to use as a key and to read from many threads',
    stage: StringCellsStage,
    frames: (() => {
      const ana = { id: 'ana', label: 'String object', tag: { text: 'its characters never change', tone: 'ok' }, cells: cells('ana') };
      const sgd = { id: 'sgd', slot: 1, label: 'String object "SGD" in the pool', tag: { text: 'one object, shared', tone: 'ok' }, cells: cells('SGD') };
      return [
        {
          line: 'String name = "ana";',
          rows: [ana],
          pointers: [{ name: 'String name', to: 'ana' }],
          note: 'name points to a String object that holds the characters "ana". The class is final, its fields are private and final, and no method changes them.',
        },
        {
          line: 'name.toUpperCase();',
          rows: [ana, { id: 'up1', label: 'new String', tag: { text: 'nobody keeps it, so it is garbage', tone: 'warn' }, cells: cells('ANA', 'new') }],
          pointers: [{ name: 'String name', to: 'ana' }],
          result: { text: 'name is still "ana"', tone: 'warn' },
          note: 'toUpperCase() does not change the object. It returns a new String "ANA". The result is not assigned to anything, so it is thrown away, and name still points to "ana".',
        },
        {
          line: 'name = name.toUpperCase();',
          rows: [
            { ...ana, tag: { text: 'unchanged, and now garbage', tone: 'bad' }, dim: true },
            { id: 'up2', label: 'new String', tag: { text: 'name points here now', tone: 'ok' }, cells: cells('ANA', 'new') },
          ],
          pointers: [{ name: 'String name', to: 'up2' }],
          result: { text: 'name is "ANA"', tone: 'ok' },
          note: 'To keep the result, assign it. The variable name now points to the new object. The old object "ana" did not change. Nothing points to it any more, so the garbage collector removes it later.',
        },
        {
          line: 'String a = "SGD";  String b = "SGD";  String c = "SGD";',
          rows: [sgd],
          pointers: [
            { name: 'String a', to: 'sgd', at: 0 },
            { name: 'String b', to: 'sgd', at: 1 },
            { name: 'String c', to: 'sgd', at: 2 },
          ],
          result: { text: 'safe only because it cannot change', tone: 'ok' },
          note: 'Reason 1, the string pool. The three variables share one pooled object. If a String could change, changing it through a would also change b and c without warning.',
        },
        {
          line: 'accounts.put("SGD", account);   // calls "SGD".hashCode()',
          rows: [
            sgd,
            { id: 'hash', slot: 2, label: 'its hash field', tag: { text: 'calculated on the first call, then reused', tone: 'ok' }, cells: [{ t: '82032', tone: 'ok' }] },
          ],
          pointers: [{ name: 'map key', to: 'sgd' }],
          result: { text: 'hash calculated once', tone: 'ok' },
          note: 'Reason 2, the cached hash code. The first hashCode() call calculates 82032 and stores it inside the String. Later calls return the stored value. A HashMap finds the key by this number, which only works because the text can never change.',
        },
        {
          line: '// threads 1, 2 and 3 all read the same String',
          rows: [sgd],
          pointers: [
            { name: 'thread 1', to: 'sgd', at: 0 },
            { name: 'thread 2', to: 'sgd', at: 1 },
            { name: 'thread 3', to: 'sgd', at: 2 },
          ],
          result: { text: 'no locks needed', tone: 'ok' },
          note: 'Reason 3, threads and security. Many threads can read the same String at once, with no locks, because nobody can change it. For the same reason, a file path or a URL cannot be changed after a security check has approved it.',
        },
        {
          line: 'this.entries = List.copyOf(entries);   // in the Statement constructor',
          rows: [
            { id: 'list', label: "the caller's ArrayList", tag: { text: 'the caller can still change it', tone: 'warn' }, cells: [{ t: 'e1' }, { t: 'e2' }] },
            { id: 'copy', label: 'the copy inside Statement', tag: { text: 'cannot be changed', tone: 'ok' }, cells: [{ t: 'e1', tone: 'ok' }, { t: 'e2', tone: 'ok' }] },
          ],
          pointers: [
            { name: 'caller: entries', to: 'list' },
            { name: 'Statement.entries', to: 'copy', tone: 'ok' },
          ],
          note: 'Your own classes can be immutable too. Make the class final, make the fields private and final, and add no setters. Make a defensive copy of anything that can change: here the constructor keeps its own unchangeable copy of the list.',
        },
        {
          line: 'entries.add(e3);   // the caller changes its own list',
          rows: [
            { id: 'list', label: "the caller's ArrayList", tag: { text: 'now has 3 entries', tone: 'warn' }, cells: [{ t: 'e1' }, { t: 'e2' }, { t: 'e3', tone: 'new' }] },
            { id: 'copy', label: 'the copy inside Statement', tag: { text: 'still 2 entries', tone: 'ok' }, cells: [{ t: 'e1', tone: 'ok' }, { t: 'e2', tone: 'ok' }] },
          ],
          pointers: [
            { name: 'caller: entries', to: 'list' },
            { name: 'Statement.entries', to: 'copy', tone: 'ok' },
          ],
          result: { text: 'the Statement does not change', tone: 'ok' },
          note: 'The caller adds e3 to its own list. The Statement does not see it, because it holds a copy. Without the copy, both would share one list and the Statement could change from outside. A record with List.copyOf in its constructor does the same.',
        },
      ];
    })(),
  },
  {
    id: 'unicode',
    label: 'Characters and encoding',
    title: 'A Java char is not always a whole character, and turning text into bytes needs a charset',
    stage: StringCellsStage,
    frames: (() => {
      const chars = (dim) => ({
        id: 'chars',
        label: 'the chars inside "A😀"',
        tag: { text: '😀 needs two chars: a surrogate pair', tone: 'warn' },
        cells: [
          { t: 'A', sub: 0 },
          { t: 'D83D', tone: 'warn', sub: 1 },
          { t: 'DE00', tone: 'warn', sub: 2 },
        ],
        dim,
      });
      return [
        {
          line: '"A😀".length()',
          rows: [chars(false)],
          result: { text: '3, not 2', tone: 'warn' },
          note: 'Java stores text as 16-bit chars (UTF-16). "A" fits in one char. The emoji 😀 does not, so it is stored as two chars, called a surrogate pair. length() counts chars, so it returns 3, although a person sees two symbols.',
        },
        {
          line: '"A😀".codePointCount(0, 3)',
          rows: [
            chars(false),
            { id: 'cp', label: 'code points: the real characters', tag: { text: 'what a person sees', tone: 'ok' }, cells: [{ t: 'A', tone: 'ok', sub: 0 }, { t: '😀', tone: 'ok', sub: 1 }] },
          ],
          result: { text: '2', tone: 'ok' },
          note: 'A code point is one real Unicode character. codePointCount and codePoints() count those, so the result is 2. Use them when you need the number of characters a person sees.',
        },
        {
          line: 'byte[] b = text.getBytes(StandardCharsets.UTF_8);',
          rows: [
            chars(true),
            { id: 'utf8', label: 'UTF-8 bytes', tag: { text: '"A" takes 1 byte, 😀 takes 4', tone: 'ok' }, cells: [{ t: '41', tone: 'ok' }, ...['F0', '9F', '98', '80'].map((t) => ({ t, tone: 'new' }))] },
          ],
          result: { text: '5 bytes on every machine', tone: 'ok' },
          note: 'Turning text into bytes needs a charset: the rule for how characters become bytes. UTF-8 stores "A" in one byte and 😀 in four. Name the charset, and you get the same bytes everywhere.',
        },
        {
          line: 'byte[] b = text.getBytes();   // no charset, before Java 18',
          rows: [
            chars(true),
            { id: 'linux', label: 'on Linux (default UTF-8)', tag: { text: '5 bytes', tone: 'ok' }, cells: [{ t: '41' }, { t: 'F0' }, { t: '9F' }, { t: '98' }, { t: '80' }] },
            { id: 'win', label: 'on Windows (default windows-1252)', tag: { text: '😀 becomes "?"', tone: 'bad' }, cells: [{ t: '41' }, { t: '3F', tone: 'bad' }] },
          ],
          result: { text: 'different bytes on different machines', tone: 'bad' },
          note: 'Without a charset, Java used the operating system default before Java 18. The same code gave different bytes on Windows and Linux, and text got garbled. Since Java 18 the default is UTF-8 everywhere, but naming it is still clearer.',
        },
        {
          line: '"TITLE".toLowerCase()   // computer set to Turkish',
          rows: [
            { id: 'in', label: 'the input', cells: cells('TITLE') },
            { id: 'tr', label: 'toLowerCase() with a Turkish locale', tag: { text: 'a dotless ı', tone: 'bad' }, cells: [{ t: 't' }, { t: 'ı', tone: 'bad' }, { t: 't' }, { t: 'l' }, { t: 'e' }] },
            { id: 'root', label: 'toLowerCase(Locale.ROOT)', tag: { text: 'the same everywhere', tone: 'ok' }, cells: cells('title', 'ok') },
          ],
          result: { text: '"tıtle".equals("title") is false', tone: 'bad' },
          note: 'Changing case depends on the language settings, called the locale. In Turkish, a capital I becomes a dotless ı, so a check against "title" fails. Use toLowerCase(Locale.ROOT) for codes, ids and map keys.',
        },
      ];
    })(),
  },
];
