---
title: Java Strings and immutability — the string pool, StringBuilder and immutable classes
nav: Strings and immutability
slug: java-strings
summary: Why String is immutable, the string pool and == versus equals, concatenation and StringBuilder, hashing, Unicode and charsets, and how to design your own immutable classes and records, with animations and interview questions.
tags: [Java, Strings, Immutability]
order: 8
topic: Java / Language
updated: 2026-11-24
subnav: true
---

Strings are behind some of the oldest Java interview questions:

- What is the difference between `==` and `equals`?
- How many objects does `new String("a")` create?
- Why is `String` immutable?

The answers lead to bigger topics: immutability, thread safety and how strings work as `HashMap` keys. This lesson explains `String` first, then shows how to make your own classes immutable in the same way.

Related lessons: [HashMap](lesson:java-hashmap) (strings as keys), the [memory model](lesson:java-memory-model) (sharing immutable objects between threads) and [OOP concepts](lesson:oop-concepts).

The animation has four scenes: the string pool, concatenation, why strings are immutable, and characters and encoding.

```demo
name: java-strings-walk
```

> **One sentence to remember:** *A `String` never changes, so compare it with `equals` and build long text with `StringBuilder`.*

## String basics {#basics}

`String` is a `final` class, so nobody can extend it.

It is **immutable**: once a string is created, its text never changes. Methods that seem to change it, such as `toUpperCase`, `trim`, `replace` and `substring`, return a **new** string. The original stays the same.

```java
String name = "ana";
name.toUpperCase();              // the new string is thrown away: name is still "ana"
name = name.toUpperCase();       // keep the new string by assigning it
```

How the text is stored inside: Java uses UTF-16, two bytes per character. Since Java 9, a string that contains only Latin-1 characters (plain English text, for example) is stored with one byte per character. This is called **compact strings**. It saves memory and does not change how you use `String`.

## The string pool and == {#pool}

The **string pool** is a special area of the heap where Java keeps one copy of each string **literal** (text written in quotes in your code). If the same literal appears many times, every use points to the same object. Putting a string into the pool is called **interning**.

`new String("x")` is different: it always creates a new object, outside the pool.

```java
String a = "ACC-1";
String b = "ACC-1";
String c = new String("ACC-1");

a == b;             // true: both point to the same pooled object
a == c;             // false: c is a different object
a.equals(c);        // true: the characters are the same
a == c.intern();    // true: intern() returns the pooled object
```

`==` asks *"are these the same object?"*. `equals` asks *"do they contain the same text?"*. For text you almost always want `equals`.

Some cases are surprising, because the compiler joins constant strings before the program runs:

| Expression | Result | Why |
| --- | --- | --- |
| `"a" + "b" == "ab"` | `true` | Both parts are constants, so the compiler turns them into the literal `"ab"`, which is pooled. |
| `final String x = "a"; x + "b" == "ab"` | `true` | `x` is `final` and set to a constant, so it is treated as a constant too. |
| `String x = "a"; x + "b" == "ab"` | `false` | `x` is a normal variable, so the result is built at run time as a new object. |
| `new String("a") == new String("a")` | `false` | Each `new` creates its own object. |

**How many objects does `new String("abc")` create?** One or two. The `new` always creates one object. The literal `"abc"` is also added to the pool, but only if it is not there already.

**Comparing safely when a value may be `null`:** write the literal first, `"ACC-1".equals(input)`, or use `Objects.equals(a, b)`. If `input` is `null`, `input.equals("ACC-1")` throws a `NullPointerException`.

## Why String is immutable {#why-immutable}

| Reason | Explanation |
| --- | --- |
| **The string pool** | The pool shares one object between many variables. That is only safe if nobody can change it. |
| **Cached hash code** | A string calculates its `hashCode()` once and stores it. This makes strings fast `HashMap` keys. If a key could change, its hash would change and the map could no longer find it. |
| **Thread safety** | An object that never changes can be read by many threads at once, with no locks. |
| **Security** | Values such as file names, URLs and class names are checked before use. Because they cannot change afterwards, nobody can swap them after the check. |
| **Class loading** | Java looks up classes by name. Those names must not change. |

The cost: every change creates a new object. If you change text many times, use a builder instead (next section).

## Concatenation and StringBuilder {#builder}

Joining strings with `+` inside a loop is slow:

```java
String s = "";
for (String part : parts) s = s + part;      // slow for many parts
```

Each pass creates a new string and copies all the text built so far. With 1 000 parts, Java copies the text about 1 000 times, and the copies get longer each time. The work grows with the **square** of the number of parts (O(n²)).

A `StringBuilder` keeps one growing buffer and adds to the end of it, so there is no copying on every step:

```java
StringBuilder sb = new StringBuilder();
for (String line : lines) sb.append(line).append('\n');
String text = sb.toString();                  // one final string
```

| Class | Can change? | Thread-safe? | When to use |
| --- | --- | --- | --- |
| `String` | No | Yes, because it never changes | Normal text |
| `StringBuilder` | Yes | No | Building text, usually inside one method. **The usual choice.** |
| `StringBuffer` | Yes | Yes, its methods are `synchronized` | Old code. Rarely needed today. |

A single line such as `a + b + c` is fine. The compiler already turns it into efficient code, so you do not need a builder there.

Other useful tools:

- `String.join(", ", items)` and `Collectors.joining(", ")` join a list with a separator.
- `String.format("%s: %.2f", name, amount)` or `"%s: %.2f".formatted(name, amount)` fill in a template.
- `"ab".repeat(3)` gives `"ababab"`.
- **Text blocks** (`"""`, Java 15) hold multi-line text such as JSON or SQL without escape characters.

## Common methods and traps {#methods}

| Method | What to know |
| --- | --- |
| `equals`, `equalsIgnoreCase` | Compare the text. |
| `compareTo` | Compares for sorting. Returns a negative number, zero or a positive number. |
| `isEmpty` / `isBlank` (Java 11) | `isEmpty` is true only for `""`. `isBlank` is also true for text that is only spaces. |
| `trim` / `strip` (Java 11) | Both remove spaces at the ends. `strip` also removes Unicode spaces that `trim` misses. |
| `split(regex)` | The argument is a **regular expression**, not plain text. `"a.b".split(".")` does not work, because `.` means "any character". Write `"a.b".split("\\.")`. Empty strings at the end are dropped. |
| `substring(begin, end)` | The `end` position is **not** included: `"bank".substring(0, 2)` is `"ba"`. |
| `replace` / `replaceAll` | `replace` looks for plain text. `replaceAll` takes a regular expression. |
| `chars()`, `codePoints()` | Give a stream of the characters. |
| `toLowerCase(Locale.ROOT)` | Without a `Locale`, the result depends on the computer's language settings (see the Turkish example below). |
| `String.valueOf(x)` | Returns `"null"` when `x` is `null`. `x.toString()` would throw an exception. |

## Characters, Unicode and encodings {#unicode}

A Java `char` holds 16 bits. Most letters fit in one `char`, but emoji and some rare characters need **two** `char`s, called a **surrogate pair**. So `"A😀".length()` is **3**, even though a person sees two symbols. When you need the number of real characters, use `codePointCount`, or `codePoints()` to loop over them.

Turning text into bytes (for a file or a network call) needs a **charset**: the rule for how characters become bytes. Always say which one, normally UTF-8:

```java
byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
String back = new String(bytes, StandardCharsets.UTF_8);
```

Before Java 18, the default charset depended on the operating system, so the same code could produce different bytes on Windows and Linux. Since Java 18 the default is UTF-8 everywhere, but naming it is still clearer.

## Passwords and sensitive text {#passwords}

Some APIs, such as `Console.readPassword()`, return a password as a `char[]` instead of a `String`. The reason: you can **overwrite** an array with zeros as soon as you are done. A `String` cannot be changed, so the password stays in memory until the garbage collector removes it, and it could appear in a memory dump.

This protection is small. The important rules are simpler: never log a password or token, never put one in an exception message, and never build one into a URL or SQL text.

## Designing immutable classes {#immutable-classes}

An **immutable class** is one whose objects cannot change after they are created. You can apply the same idea as `String` to your own classes. The recipe:

1. Make the class `final`, so nobody can create a changeable subclass.
2. Make every field `private final`.
3. Do not write setters. A method that "changes" the object returns a **new** object instead, for example `withAmount(...)`.
4. Make **defensive copies**: copy changeable objects when they come in (constructor) and when they go out (getters). Otherwise the caller keeps a reference and can change your data from outside.
5. Do not pass `this` to other code from inside the constructor.

```java
public final class Statement {
    private final String accountId;
    private final List<Entry> entries;
    private final Date issued;                        // Date can be changed, so we must copy it

    public Statement(String accountId, List<Entry> entries, Date issued) {
        this.accountId = Objects.requireNonNull(accountId);
        this.entries = List.copyOf(entries);           // an unchangeable copy of the list
        this.issued = new Date(issued.getTime());      // copy on the way in
    }

    public List<Entry> entries() { return entries; }               // safe: the list cannot change
    public Date issued() { return new Date(issued.getTime()); }    // copy on the way out
}
```

A **record** (Java 16) gives you most of this with one line. Its fields are `private final`, there are no setters, and the class is `final`:

```java
public record Money(BigDecimal amount, String currency) {
    public Money {                                                  // checks run when the object is created
        Objects.requireNonNull(amount);
        if (currency.length() != 3) throw new IllegalArgumentException("currency");
    }
    public Money plus(Money other) { return new Money(amount.add(other.amount), currency); }
}
```

What you gain: the object is safe to share between threads without locks, safe to use as a map key, and easy to reason about, because it is always in the state it was created in.

Three things to watch:

- **`final` on a variable does not make the object immutable.** `final List<String> items` means you cannot point `items` at another list, but you can still add to the list.
- **Prefer immutable types** such as `LocalDate` and `Instant` instead of the old `Date`, and `BigDecimal` for money.
- **`BigDecimal.equals` also compares the number of decimal places**: `2.0` and `2.00` are *not* equal with `equals`. Use `compareTo(...) == 0` to compare the values.

Try it in the lab: [Strings: the pool, immutability and StringBuilder](lab:string-pool-builder).

## Cheat sheet {#cheatsheet}

| Need | Do |
| --- | --- |
| Compare text | `a.equals(b)`, `"lit".equals(x)` or `Objects.equals(a, b)` |
| Build text in a loop | `StringBuilder` |
| Join a list | `String.join(sep, list)` or `Collectors.joining(sep)` |
| Fill in a template | `"%s: %.2f".formatted(...)` |
| Multi-line text | a text block `"""` |
| Text to bytes | `getBytes(StandardCharsets.UTF_8)` |
| Lower case for keys and codes | `toLowerCase(Locale.ROOT)` |
| Immutable value object | a `record`, or a `final` class with `final` fields and defensive copies |
| Immutable list | `List.of(...)` or `List.copyOf(list)` |

## Interview questions {#questions}

### [basic] Why is String immutable in Java? {#why-immutable-q}

Because it makes strings safe to share. Four reasons:

1. **The string pool** shares one object between many variables, which only works if nobody can change it.
2. **The hash code is cached.** A string calculates it once, which makes strings fast and reliable `HashMap` keys.
3. **Thread safety.** Many threads can read the same string without locks.
4. **Security.** A file path or URL that was checked cannot be changed after the check.

The price is that every change creates a new string.

### [basic] What is the difference between == and equals() for Strings? {#eq-vs-equals}

`==` checks whether two variables point to the **same object**. `equals` checks whether two strings contain the **same text**.

Two strings can have the same text but be different objects, for example `new String("a")` and `"a"`. So always use `equals` to compare text. Sometimes `==` returns `true` for literals, but only because of the string pool, and you should not rely on that.

### [basic] What is the string pool? {#pool-q}

An area of the heap where Java keeps **one copy of each string literal**. Every place in the code that uses the same literal gets the same object. This saves memory.

`String.intern()` returns the pooled copy of any string, and adds it to the pool if it is not there yet. Since Java 7 the pool is on the normal heap.

### [basic] How many objects does new String("abc") create? {#new-string-objects}

**One or two.**

- `new` always creates one new `String` object.
- The literal `"abc"` is also put in the pool when the class is loaded, but only if the pool does not already have it.

So it is two the first time, and one if `"abc"` was already in the pool.

### [basic] What is the difference between String, StringBuilder and StringBuffer? {#string-sb-sbuf}

- **`String`** cannot change.
- **`StringBuilder`** is a buffer you can change. It is not thread-safe, and it is the fastest. Use it when you build text.
- **`StringBuffer`** is the same as `StringBuilder`, but every method is `synchronized`, which makes it slower. It is rarely needed, because text is usually built inside one thread.

### [basic] Why shouldn't you concatenate strings with + inside a loop? {#concat-loop}

Each `+` creates a new string and copies all the text built so far. Over many loop passes, this copying adds up to work that grows with the square of the number of parts (O(n²)), and it creates a lot of garbage.

A `StringBuilder` adds to the end of one buffer, and `toString()` creates the final string once. Note that a single line like `a + b + c` is fine, because the compiler handles it efficiently.

### [basic] How do you compare strings safely when one may be null? {#null-safe-equals}

Call `equals` on a value you know is not `null`, such as the literal: `"ACC-1".equals(input)`. Or use `Objects.equals(a, b)`, which handles `null` on either side.

`input.equals("ACC-1")` throws a `NullPointerException` if `input` is `null`.

### [basic] What is the difference between trim() and strip()? {#trim-vs-strip}

Both remove spaces from both ends of a string.

- `trim()` removes only basic spaces and control characters (codes up to 32).
- `strip()` (Java 11) removes **every kind of Unicode space**, including the special spaces used in some languages.

A related method, `isBlank()`, is true when a string is empty or contains only spaces.

### [basic] What is the difference between substring, split and replace? {#substring-split-replace}

- `substring(begin, end)` returns part of the string. The character at `end` is not included.
- `split(regex)` cuts the string into pieces. The separator is a **regular expression**, so special characters such as `.` or `|` must be escaped (`"\\."`). Empty pieces at the end are dropped.
- `replace` swaps plain text. `replaceAll` uses a regular expression.

### [basic] What are text blocks? {#text-blocks}

Multi-line strings written between `"""` marks (Java 15). They keep the line breaks, remove the shared indentation and need almost no escape characters. They are handy for JSON, SQL and HTML:

```java
String sql = """
    SELECT id, balance
    FROM account
    WHERE customer_id = ?
    """;
```

### [intermediate] What does intern() do and when would you use it? {#intern-q}

`intern()` returns the pooled copy of a string, adding it to the pool if needed. After interning, equal strings are the same object.

It can save memory when a program holds millions of copies of a few values (for example, the same few country codes). But interning has its own cost. Today a better option is often the garbage collector's **string deduplication** (`-XX:+UseStringDeduplication` with the G1 collector), which removes duplicate text automatically.

### [intermediate] Why are Strings good HashMap keys? {#string-keys}

Because they never change. A map finds a key by its hash code, so a key's hash code must stay the same while it is in the map. A string's hash code never changes, and `String` calculates it only once and stores it, so looking it up again is cheap. See [HashMap](lesson:java-hashmap).

### [intermediate] Is "a" + "b" == "ab" true? What about with variables? {#constant-folding}

**Yes, it is true.** Both parts are constants, so the compiler joins them into the literal `"ab"` before the program runs, and that literal comes from the pool.

With a normal variable it is **false**: `String x = "a"; x + "b" == "ab"`. The joining happens while the program runs and creates a new object.

If the variable is `final` and set to a constant (`final String x = "a";`), the compiler treats it as a constant, and the result is `true` again.

### [intermediate] How do you make a custom class immutable? {#custom-immutable}

1. Make the class `final`.
2. Make all fields `private final`, and set them in the constructor.
3. Do not add setters.
4. Copy changeable inputs in the constructor, and copy changeable fields in getters (defensive copies).
5. Use unchangeable collections, such as `List.copyOf`.
6. Do not let `this` escape from the constructor.

A **record** does most of this for you.

### [intermediate] Does final make an object immutable? {#final-vs-immutable}

**No.** `final` on a variable only means the variable cannot point to a different object. The object itself can still change: with `final List<String> items`, you can still call `items.add(...)`.

An object is immutable only if there is **no way** to change its state after it is created.

### [intermediate] What is a defensive copy and when is it needed? {#defensive-copy}

A copy of a changeable object that you make when it **comes in** (a constructor argument) or **goes out** (a getter). Without it, the caller keeps a reference to the same object and can change your data from outside.

You need it for changeable types such as `Date`, arrays and normal collections. Types that cannot change, such as `String`, `LocalDate` or a list from `List.copyOf`, need no copy.

### [intermediate] How are Java records related to immutability? {#records-q}

A record is a short way to write a `final` class whose fields are `private final`. Java generates the constructor, the accessor methods, `equals`, `hashCode` and `toString`.

A record is only **shallowly** immutable. If one of its fields is a changeable object, such as a normal `List`, that list can still be changed. So copy such fields in the record's constructor, for example with `List.copyOf`.

### [intermediate] Why does BigDecimal.equals(2.0, 2.00) return false? {#bigdecimal-equals}

`BigDecimal.equals` compares two things: the **value** and the **scale** (the number of digits after the decimal point). `2.0` has scale 1 and `2.00` has scale 2, so they are not equal.

To compare only the values, use `a.compareTo(b) == 0`. Be careful with `HashSet` and `HashMap`, because they use `equals`, so they treat `2.0` and `2.00` as different keys.

### [intermediate] Why use a char[] instead of a String for a password? {#char-array-password}

You can wipe a `char[]` as soon as you are done with it (`Arrays.fill(password, '\0')`), so the secret stays in memory for less time. A `String` cannot be changed, so it stays until the garbage collector removes it, and it might show up in a memory dump.

This is a small extra protection, not a complete one. The rules that matter more: never log a secret and never store it as plain text.

### [intermediate] What problems does String.format or toLowerCase() have with locales? {#locale}

Without an explicit `Locale`, both use the computer's language settings, and the results can change:

- In Turkish, `"TITLE".toLowerCase()` gives `"tıtle"` with a dotless **ı**, so a check such as `equals("title")` fails.
- Number formatting may use a comma instead of a decimal point: `1,50` instead of `1.50`.

Use `toLowerCase(Locale.ROOT)` for codes and identifiers, and pass a `Locale` to `String.format` when you format numbers.

### [deep] What are compact strings (Java 9)? {#compact-strings}

An internal memory saving. Since Java 9, a string stores its text in a `byte[]` plus a flag that says how it is encoded:

- Text that contains only Latin-1 characters (most English text) uses **one byte** per character.
- Any other text uses UTF-16, with **two bytes** per character.

Since most strings are Latin-1, string memory roughly halves. Your code does not change at all.

### [deep] How does string concatenation compile in Java 8 versus Java 9+? {#concat-compile}

- **Java 8:** the compiler turned `a + b + c` into code that creates a `StringBuilder`, appends each part and calls `toString()`.
- **Java 9 and later:** the compiler emits a single `invokedynamic` instruction that calls `StringConcatFactory`. The JVM picks the best way to join the strings when the program runs, for example by calculating the exact size of the result first.

The result is faster joining and smaller compiled code.

### [deep] Explain String.hashCode() and the cached hash. {#string-hash}

`hashCode()` combines the characters with the formula `s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1]`.

The first time it is called, the result is stored in a private field of the string. Later calls just return that stored value. This is only safe because the string never changes.

Different strings can still have the same hash code. For example, `"Aa"` and `"BB"` both give 2112. That is why `HashMap` also calls `equals` to confirm a match ([HashMap](lesson:java-hashmap)).

### [deep] How does a switch on a String work? {#switch-string}

The compiler first switches on `s.hashCode()` to jump quickly to the likely `case`. Then it calls `equals` to confirm, because two different strings can have the same hash code.

The `case` labels must be constants. If `s` is `null`, the switch throws a `NullPointerException`.

### [deep] What is the difference between a char and a code point? {#code-point}

- A **`char`** is one 16-bit unit of UTF-16 text.
- A **code point** is one real Unicode character.

Most characters fit in one `char`. Emoji and some rare characters need **two** `char`s, called a surrogate pair. Methods such as `length()` and `charAt` count `char`s. Methods such as `codePointCount`, `codePointAt` and `codePoints()` count real characters.

This matters when you reverse text: `StringBuilder.reverse()` keeps surrogate pairs together, but a simple loop over `char`s breaks them.

### [deep] Why are immutable objects thread-safe, and what is safe publication? {#safe-publication}

An immutable object never changes, so two threads can never conflict while reading it.

**Safe publication** means another thread is guaranteed to see the object fully built, not half-built. Java gives `final` fields a special guarantee: once the constructor finishes, every thread sees the correct values of those fields, even without locks ([memory model](lesson:java-memory-model)). That guarantee only holds if the constructor does not leak `this` to other code before it finishes.

### [coding] Write a method that reverses a string and one that checks for a palindrome. {#coding-reverse}

```java
static String reverse(String s) {
    return new StringBuilder(s).reverse().toString();
}

static boolean isPalindrome(String s) {
    String cleaned = s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");   // keep only letters and digits
    int i = 0, j = cleaned.length() - 1;
    while (i < j) {
        if (cleaned.charAt(i++) != cleaned.charAt(j--)) return false;
    }
    return true;
}
```

How it works:

- `reverse` uses `StringBuilder.reverse()`, which takes O(n) time and keeps emoji and other two-`char` characters intact.
- `isPalindrome` removes everything except letters and digits, then compares characters from both ends towards the middle. It takes O(n) time and does not build a reversed copy.

### [coding] Check whether two strings are anagrams. {#coding-anagram}

Two strings are anagrams if they contain the same letters the same number of times, for example `"listen"` and `"silent"`.

```java
static boolean anagrams(String a, String b) {
    if (a.length() != b.length()) return false;
    int[] counts = new int[26];                  // one counter per letter a to z
    for (int i = 0; i < a.length(); i++) {
        counts[a.charAt(i) - 'a']++;             // add for letters in a
        counts[b.charAt(i) - 'a']--;             // subtract for letters in b
    }
    for (int c : counts) if (c != 0) return false;
    return true;
}
```

If every counter ends at zero, both strings used the same letters. This takes O(n) time and a fixed amount of memory, but it only works for lowercase `a` to `z`. For any Unicode text, count characters in a `Map<Integer, Integer>`, or sort both strings and compare them (O(n log n)).

### [coding] Make this class immutable. {#coding-make-immutable}

```java
public class Customer {
    private String name;
    private List<String> accountIds;
    private Date joined;
    public Customer(String name, List<String> accountIds, Date joined) {
        this.name = name; this.accountIds = accountIds; this.joined = joined;
    }
    public List<String> getAccountIds() { return accountIds; }
    public Date getJoined() { return joined; }
    public void setName(String name) { this.name = name; }
}
```

The problems: the setter changes the name, the caller's list and `Date` are stored directly so the caller can still change them, and the getters hand out the same changeable objects.

A fixed version as a record:

```java
public record Customer(String name, List<String> accountIds, LocalDate joined) {
    public Customer {
        Objects.requireNonNull(name);
        accountIds = List.copyOf(accountIds);     // an unchangeable copy
    }
}
```

What changed: the record has no setters and its fields are `final`; the list is copied into an unchangeable list; and `LocalDate`, which cannot change, replaces `Date`.

With a normal class instead of a record: make the class `final` and the fields `private final`, remove the setter, copy the list and the date in the constructor, and return copies from the getters.

### [coding] Count the occurrences of each character in a string. {#coding-char-count}

```java
Map<Character, Integer> counts = new TreeMap<>();     // TreeMap keeps the characters sorted
for (char c : s.toCharArray()) {
    counts.merge(c, 1, Integer::sum);                  // add 1, or start at 1 if missing
}
```

The same with streams:

```java
Map<Character, Long> counts = s.chars()
        .mapToObj(c -> (char) c)
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
```

`merge` replaces the longer "get the value, check for `null`, put it back" code. Use a `LinkedHashMap` to keep the order in which characters first appear, and `codePoints()` instead of `chars()` if the text may contain emoji.
