---
title: Java Strings and immutability — the string pool, StringBuilder and immutable classes
nav: Strings and immutability
slug: java-strings
summary: Why String is immutable, the string pool and == versus equals, concatenation and StringBuilder, hashing, Unicode and charsets, and how to design your own immutable classes and records, with animations and interview questions.
tags: [Java, Strings, Immutability]
order: 5
topic: Java / Language
updated: 2026-11-13
subnav: true
---

`==` versus `equals`, "how many objects does `new String("a")` create?" and "why is `String` immutable?" are among the oldest Java interview questions, and they lead straight into immutability, thread safety and hash-based collections. This lesson covers `String` completely and then applies the same ideas to your own classes. It connects to [HashMap](lesson:java-hashmap) (strings as keys), the [memory model](lesson:java-memory-model) (safe publication of immutable objects) and [OOP concepts](lesson:oop-concepts). Play the four scenes: the string pool, concatenation, why strings are immutable, and characters and encoding.

```demo
name: java-strings-walk
```

> **One sentence to remember:** *a `String` never changes, so literals can be shared in a pool, its hash code can be cached, it is safe across threads and as a map key; compare with `equals`, build text in loops with `StringBuilder`, and copy this immutability into your own value classes with `final` fields, no setters and defensive copies.*

## String basics {#basics}

`String` is a `final` class that stores text as UTF-16 (Java 9+ compact strings store Latin-1 text in one byte per character internally). It is **immutable**: no method changes an existing string; methods such as `toUpperCase`, `trim`, `replace` and `substring` return a **new** string.

```java
String name = "ana";
name.toUpperCase();              // result thrown away: name is still "ana"
name = name.toUpperCase();       // assign the returned string
```

## The string pool and == {#pool}

String **literals** are interned: the JVM keeps one object per distinct literal in the **string pool** (on the heap since Java 7) and every use of the literal refers to it. `new String("x")` always creates a separate heap object.

```java
String a = "ACC-1";
String b = "ACC-1";
String c = new String("ACC-1");

a == b;             // true: same pooled object
a == c;             // false: different objects
a.equals(c);        // true: same characters
a == c.intern();    // true: intern() returns the pooled instance
```

| Expression | Result | Why |
| --- | --- | --- |
| `"a" + "b" == "ab"` | `true` | compile-time constant, folded and pooled |
| `final String x = "a"; x + "b" == "ab"` | `true` | `x` is a constant variable |
| `String x = "a"; x + "b" == "ab"` | `false` | built at run time |
| `new String("a") == new String("a")` | `false` | two heap objects |

`new String("abc")` creates **one** object on the heap (plus the pooled `"abc"` literal if it was not already there), so the usual answer is "one or two". Never use `==` to compare string content; use `equals`, and put the literal first (`"ACC-1".equals(input)`) or use `Objects.equals` to avoid a `NullPointerException`.

## Why String is immutable {#why-immutable}

| Reason | Explanation |
| --- | --- |
| **String pool** | shared literals are only safe if nobody can change them |
| **Hash caching** | `hashCode()` is computed once and stored, so strings are fast `HashMap` keys; a key whose hash changed would be lost |
| **Thread safety** | immutable objects can be shared by any number of threads with no locks |
| **Security** | file names, class names, URLs and credentials cannot be altered after validation |
| **Class loading and reflection** | names used to look up classes must not change |

The cost: every change creates a new object, so repeated modification needs a builder.

## Concatenation and StringBuilder {#builder}

`s = s + part` in a loop creates a new string each pass and copies everything so far, so the work is O(n²). Use a `StringBuilder`:

```java
StringBuilder sb = new StringBuilder();
for (String line : lines) sb.append(line).append('\n');
String text = sb.toString();
```

| Class | Mutable | Thread-safe | Use |
| --- | --- | --- | --- |
| `String` | no | yes (immutable) | normal text |
| `StringBuilder` | yes | no | building text in one thread: the default |
| `StringBuffer` | yes | yes (synchronized) | legacy; rarely useful |

A single expression `a + b + c` is fine: the compiler uses `StringBuilder` (Java 8) or `invokedynamic` and `StringConcatFactory` (Java 9+). Other tools: `String.join(", ", items)`, `Collectors.joining`, `String.format` and `"...".formatted(...)`, `repeat`, and **text blocks** (`"""`) for multi-line JSON or SQL.

## Common methods and traps {#methods}

| Method | Note |
| --- | --- |
| `equals`, `equalsIgnoreCase`, `compareTo` | `equals` for content; `compareTo` for ordering (negative, zero, positive) |
| `isEmpty` / `isBlank` (Java 11) | `isBlank` is also true for whitespace only |
| `trim` / `strip` (Java 11) | `strip` removes all Unicode whitespace, `trim` only characters up to `' '` |
| `split(regex)` | the argument is a **regex**: `"a.b".split(".")` returns nothing useful, use `"\\."`; trailing empty strings are dropped |
| `substring(i, j)` | end index exclusive; copies the characters (since Java 7u6) |
| `replace` vs `replaceAll` | `replace` takes literal text, `replaceAll` takes a regex |
| `chars()`, `codePoints()` | streams of characters or Unicode code points |
| `toLowerCase(Locale.ROOT)` | the no-argument version depends on the default locale (Turkish `I` problem) |
| `String.valueOf(x)` | safe for `null` (`"null"`); `x.toString()` throws on `null` |

## Characters, Unicode and encodings {#unicode}

A `char` is a 16-bit UTF-16 code unit, not always a "character": emoji and some scripts need two (a surrogate pair), so `"A😀".length()` is 3 while a person sees 2 symbols. Use `codePointCount` and `codePoints()` when that matters. Converting between text and bytes needs a **charset**: always pass `StandardCharsets.UTF_8` to `getBytes`, `new String(bytes, charset)`, readers and writers. The platform default only became UTF-8 on every platform in Java 18 (JEP 400).

## Passwords and sensitive text {#passwords}

APIs such as `JPasswordField` and `Console.readPassword()` return `char[]` so you can **overwrite** it after use; a `String` stays in memory until it is garbage collected (and may remain in the pool or a heap dump). The benefit is modest in practice, but never log secrets or put them in exception messages, and avoid building them with string concatenation into URLs or SQL.

## Designing immutable classes {#immutable-classes}

An immutable class cannot be changed after construction. Recipe:

1. Declare the class `final` (or make constructors private) so subclasses cannot add mutability.
2. Make all fields `private final`.
3. No setters; "modifying" methods return a **new** instance (`withAmount(...)`).
4. **Defensive copies** of mutable arguments (in the constructor) and mutable fields (in the getters).
5. Do not let `this` escape from the constructor.

```java
public final class Statement {
    private final String accountId;
    private final List<Entry> entries;
    private final Date issued;                       // mutable type: copy it

    public Statement(String accountId, List<Entry> entries, Date issued) {
        this.accountId = Objects.requireNonNull(accountId);
        this.entries = List.copyOf(entries);          // immutable copy, also rejects nulls
        this.issued = new Date(issued.getTime());     // defensive copy in
    }

    public List<Entry> entries() { return entries; }              // already immutable
    public Date issued() { return new Date(issued.getTime()); }   // defensive copy out
}

public record Money(BigDecimal amount, String currency) {          // records: final, immutable by default
    public Money {
        Objects.requireNonNull(amount);
        if (currency.length() != 3) throw new IllegalArgumentException("currency");
    }
    public Money plus(Money other) { return new Money(amount.add(other.amount), currency); }
}
```

Benefits: thread-safe without locks, safe as map keys and set elements, easy to reason about and cache, and no defensive copying for callers. `final` on a reference does **not** make the object immutable (`final List<String> x` can still be added to). Prefer `java.time` types (`LocalDate`, `Instant`) over `Date`, and `BigDecimal` for money: both are immutable. `BigDecimal.equals` compares scale too (`2.0` is not equal to `2.00`); use `compareTo` for numeric comparison.

## Cheat sheet {#cheatsheet}

| Need | Do |
| --- | --- |
| compare text | `a.equals(b)`, `"lit".equals(x)`, `Objects.equals` |
| build text in a loop | `StringBuilder` |
| join a list | `String.join(sep, list)` / `Collectors.joining` |
| template | `"%s: %.2f".formatted(...)` |
| multi-line text | text block `"""` |
| text to bytes | `getBytes(StandardCharsets.UTF_8)` |
| case-insensitive keys | `toLowerCase(Locale.ROOT)` |
| immutable value object | `record`, or `final` class with `final` fields and defensive copies |
| immutable collection | `List.copyOf`, `List.of` |

## Interview questions {#questions}

### [basic] Why is String immutable in Java? {#why-immutable-q}

Several benefits: literals can be shared in the string pool safely; the hash code can be cached, making strings efficient and reliable `HashMap` keys; strings can be shared between threads without synchronisation; and security-sensitive values (file paths, class names, URLs, credentials) cannot be modified after validation. The price is a new object for every change.

### [basic] What is the difference between == and equals() for Strings? {#eq-vs-equals}

`==` compares references: do both variables point to the same object? `equals` compares the characters. Two strings with the same text can be different objects (`new String("a")`), so use `equals` for content. Literals often compare `==` true only because of the pool, which is an implementation detail to avoid relying on.

### [basic] What is the string pool? {#pool-q}

A cache of distinct string literals kept on the heap (since Java 7). Every occurrence of the same literal refers to one pooled object, saving memory and making literal comparison cheap. `String.intern()` returns the pooled instance for any string, adding it if absent.

### [basic] How many objects does new String("abc") create? {#new-string-objects}

At most two: the pooled literal `"abc"` (created once, when the class is loaded, if not already in the pool) and a new heap `String` for the `new` expression. The commonly accepted answer is "one or two, depending on whether the literal was already pooled".

### [basic] What is the difference between String, StringBuilder and StringBuffer? {#string-sb-sbuf}

`String` is immutable. `StringBuilder` is a mutable character buffer, not thread-safe, fastest, the default for building text. `StringBuffer` is the same but with synchronized methods, so it is slower and rarely needed because a builder is almost always used by one thread.

### [basic] Why shouldn't you concatenate strings with + inside a loop? {#concat-loop}

Each `+` creates a new `String` and copies the text built so far, making the total cost O(n²) and producing garbage. A `StringBuilder` appends in place with amortised O(1) per append, and `toString()` creates one string at the end. A single one-line `a + b + c` is fine.

### [basic] How do you compare strings safely when one may be null? {#null-safe-equals}

Call `equals` on a value you know is not null (`"ACC-1".equals(input)`), or use `Objects.equals(a, b)`, which handles `null` on either side. `input.equals("ACC-1")` throws `NullPointerException` when `input` is `null`.

### [basic] What is the difference between trim() and strip()? {#trim-vs-strip}

`trim()` removes characters up to the space (code point 32) from both ends. `strip()` (Java 11) removes all Unicode whitespace as defined by `Character.isWhitespace`, so it also handles non-ASCII spaces. `isBlank()` is true for empty or whitespace-only text.

### [basic] What is the difference between substring, split and replace? {#substring-split-replace}

`substring(begin, end)` returns part of the string (end exclusive). `split(regex)` divides by a **regular expression** and drops trailing empty strings; special characters such as `.` or `|` must be escaped. `replace` substitutes literal text, `replaceAll` uses a regex.

### [basic] What are text blocks? {#text-blocks}

Java 15+ multi-line string literals delimited by `"""`. They keep line breaks, remove the common indentation and need little escaping, which suits JSON, SQL and HTML: `String sql = """ SELECT id FROM account WHERE ... """;`.

### [intermediate] What does intern() do and when would you use it? {#intern-q}

It returns the canonical pooled instance equal to the string, adding it to the pool if needed. It can save memory when millions of duplicates of a small set of values exist (the same few country codes), but the pool has overhead and `intern` itself is costly; modern GCs offer string deduplication (`-XX:+UseStringDeduplication` with G1) instead.

### [intermediate] Why are Strings good HashMap keys? {#string-keys}

They are immutable, so the hash code never changes while the key is in the map, and `String` caches its `hashCode`, making repeated lookups cheap. `equals` and `hashCode` are consistent. See [HashMap](lesson:java-hashmap).

### [intermediate] Is "a" + "b" == "ab" true? What about with variables? {#constant-folding}

True: both operands are compile-time constants, so the compiler folds them into the literal `"ab"` and it is pooled. If either operand is a non-final variable, the concatenation is computed at run time into a new object, and `==` is false. If the variable is `final` and initialised with a constant, it is a constant variable and folding applies.

### [intermediate] How do you make a custom class immutable? {#custom-immutable}

Make the class `final`, all fields `private final`, no setters, initialise everything in the constructor, make defensive copies of mutable inputs (in the constructor) and mutable internal state (in getters), use immutable collections (`List.copyOf`), and ensure `this` does not escape the constructor. Records give most of this automatically.

### [intermediate] Does final make an object immutable? {#final-vs-immutable}

No. `final` on a reference only prevents reassigning the variable. `final List<String> items` can still have elements added. Immutability is a property of the object: no way to change its state after construction.

### [intermediate] What is a defensive copy and when is it needed? {#defensive-copy}

A copy of a mutable object made when you store it (constructor arguments) or hand it out (getters), so the caller cannot change your internal state later. Needed for `Date`, arrays and collections held by an immutable class. Immutable types (`String`, `LocalDate`, `List.copyOf`) need no copy.

### [intermediate] How are Java records related to immutability? {#records-q}

A record is a concise final class whose components are `private final` fields with generated accessors, constructor, `equals`, `hashCode` and `toString`. It is shallowly immutable: a component of a mutable type (a `List`) can still be mutated, so copy such components in the compact constructor.

### [intermediate] Why does BigDecimal.equals(2.0, 2.00) return false? {#bigdecimal-equals}

`BigDecimal.equals` compares both the value and the **scale** (digits after the point), and `2.0` and `2.00` have different scales. `compareTo` ignores scale and returns 0. Use `compareTo` for numeric equality, and note that `HashSet`/`HashMap` use `equals`.

### [intermediate] Why use a char[] instead of a String for a password? {#char-array-password}

A `char[]` can be overwritten (`Arrays.fill(pw, '\0')`) as soon as you finish, shortening how long the secret sits in memory, while a `String` is immutable and lingers until garbage collected, possibly in the pool or a heap dump. It is a defence in depth, not a complete one; mainly never log or persist the secret.

### [intermediate] What problems does String.format or toLowerCase() have with locales? {#locale}

They use the default locale, which can change results: in a Turkish locale `"TITLE".toLowerCase()` yields a dotless i, and number formats use commas instead of points. Use `toLowerCase(Locale.ROOT)` for identifiers and protocol values, and an explicit `Locale` in `format`.

### [deep] What are compact strings (Java 9)? {#compact-strings}

`String` stores its characters in a `byte[]` plus a coder flag: Latin-1 text uses one byte per character, anything else UTF-16 with two. Most strings are Latin-1, so memory use roughly halves. It is an internal optimisation; the API is unchanged.

### [deep] How does string concatenation compile in Java 8 versus Java 9+? {#concat-compile}

Java 8 compiled `a + b + c` into code that creates a `StringBuilder`, appends each part and calls `toString()`. Java 9+ emits an `invokedynamic` call to `StringConcatFactory`, which picks the best strategy at run time (sizing the result exactly, avoiding intermediate builders), so it is faster and keeps bytecode smaller.

### [deep] Explain String.hashCode() and the cached hash. {#string-hash}

It computes `s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1]` and stores the result in a private field the first time it is needed (a `hash` field with `hashIsZero` handling for the value 0). Immutability makes the cached value permanently valid. It is not collision-free: `"Aa"` and `"BB"` have the same hash, which is why `equals` is still needed ([HashMap](lesson:java-hashmap)).

### [deep] How does a switch on a String work? {#switch-string}

The compiler switches on `s.hashCode()` to jump to a candidate and then confirms with `equals` (because different strings can share a hash). The strings in `case` labels must be constants, and `null` throws `NullPointerException`.

### [deep] What is the difference between a char and a code point? {#code-point}

A `char` is a 16-bit UTF-16 code unit. A Unicode code point can need two `char`s (a surrogate pair), as with most emoji. `length()` and `charAt` work on code units; `codePointCount`, `codePointAt` and `codePoints()` work on code points. Reversing text with `StringBuilder.reverse()` handles surrogate pairs correctly; a naive `char` loop does not.

### [deep] Why are immutable objects thread-safe, and what is safe publication? {#safe-publication}

With no state changes there are no races on their fields, and `final` fields get a special guarantee: other threads see their correct values once the constructor finishes, even if the reference is published through a data race ([memory model](lesson:java-memory-model)). Immutability plus not leaking `this` from the constructor is what makes sharing safe.

### [coding] Write a method that reverses a string and one that checks for a palindrome. {#coding-reverse}

```java
static String reverse(String s) {
    return new StringBuilder(s).reverse().toString();
}

static boolean isPalindrome(String s) {
    String cleaned = s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    int i = 0, j = cleaned.length() - 1;
    while (i < j) {
        if (cleaned.charAt(i++) != cleaned.charAt(j--)) return false;
    }
    return true;
}
```

`StringBuilder.reverse` is O(n) and handles surrogate pairs; the palindrome check compares from both ends in O(n) without building a reversed copy.

### [coding] Check whether two strings are anagrams. {#coding-anagram}

```java
static boolean anagrams(String a, String b) {
    if (a.length() != b.length()) return false;
    int[] counts = new int[26];
    for (int i = 0; i < a.length(); i++) {
        counts[a.charAt(i) - 'a']++;
        counts[b.charAt(i) - 'a']--;
    }
    for (int c : counts) if (c != 0) return false;
    return true;
}
```

O(n) time and O(1) space for lowercase `a-z`. For arbitrary Unicode, use a `Map<Integer, Integer>` of code points, or sort both arrays (O(n log n)).

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

```java
public record Customer(String name, List<String> accountIds, LocalDate joined) {
    public Customer {
        Objects.requireNonNull(name);
        accountIds = List.copyOf(accountIds);     // defensive copy, immutable list
    }
}
```

Fixes: a record (final, no setters), an immutable copy of the list, and `LocalDate` instead of the mutable `Date`. With a classic class: `final` class, `private final` fields, remove the setter, copy in the constructor and copy or wrap in the getters.

### [coding] Count the occurrences of each character in a string. {#coding-char-count}

```java
Map<Character, Integer> counts = new TreeMap<>();
for (char c : s.toCharArray()) {
    counts.merge(c, 1, Integer::sum);
}
// streams: s.chars().mapToObj(c -> (char) c)
//            .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
```

`merge` replaces the "get, check null, put" pattern; use a `LinkedHashMap` to keep first-seen order and `codePoints()` for full Unicode.
