---
title: Java Generics — type parameters, erasure, wildcards and PECS
nav: Generics
slug: java-generics
summary: Generic classes and methods, bounded types, type erasure and its limits, invariance versus array covariance, wildcards and the PECS rule, raw types and heap pollution, with animations and interview questions and coding tasks.
tags: [Java, Generics, Types]
order: 6
topic: Java / Language
updated: 2026-11-13
subnav: true
---

Generics questions separate people who use `List<String>` from people who understand it: "what is type erasure?", "why is `List<Integer>` not a `List<Number>`?" and "what does `? super T` mean?". You use generics in every [collection](lesson:java-collections), `Optional`, [streams](lesson:java-streams) and `CompletableFuture`, and the rules explain many confusing compiler errors. Play the four scenes: why generics, type erasure, wildcards and PECS, and bounded type parameters.

```demo
name: java-generics-walk
```

> **One sentence to remember:** *generics give compile-time type safety without casts, but the types are erased at run time; generic types are invariant (`List<Integer>` is not a `List<Number>`), so use `? extends T` when you only read (producer) and `? super T` when you only write (consumer): PECS.*

## Why generics {#why}

Before Java 5 collections held `Object`, so every read needed a cast and a wrong type failed with `ClassCastException` at run time, possibly far from the mistake. Generics let the compiler check element types and insert the casts for you.

```java
List accounts = new ArrayList();            // raw type: avoid
accounts.add("oops");                       // compiles
Account a = (Account) accounts.get(0);      // ClassCastException at run time

List<Account> typed = new ArrayList<>();
typed.add("oops");                          // compile error
Account b = typed.get(0);                   // no cast
```

## Generic classes and methods {#generic-types}

```java
public class Result<T> {                                     // type parameter on the class
    private final T value;
    private final String error;
    private Result(T value, String error) { this.value = value; this.error = error; }
    public static <T> Result<T> ok(T value) { return new Result<>(value, null); }   // generic method
    public static <T> Result<T> fail(String error) { return new Result<>(null, error); }
    public boolean isOk() { return error == null; }
    public T get() { return value; }
}

Result<Account> r = Result.ok(account);                      // T = Account (inferred)
```

| Convention | Meaning |
| --- | --- |
| `T` | type |
| `E` | element (collections) |
| `K`, `V` | key, value |
| `R` | result |
| `N` | number |

A **generic method** declares its own type parameter before the return type (`<T> T first(List<T> list)`), and the compiler infers `T` from the arguments. The **diamond** `new ArrayList<>()` infers the type arguments from the target type.

## Bounded type parameters {#bounds}

A bound tells the compiler what `T` can do:

```java
static <T extends Comparable<T>> T max(T a, T b) {             // T must be comparable to itself
    return a.compareTo(b) >= 0 ? a : b;
}

static <T extends Number & Comparable<T>> T largest(List<T> xs) { ... }   // several bounds with &

static <T extends Comparable<? super T>> void sort(List<T> list) { ... } // the library form (PECS on the bound)
```

Only the first bound can be a class; the rest must be interfaces. Without a bound, `T` is only known to be an `Object`.

## Invariance: List<Integer> is not List<Number> {#invariance}

Even though `Integer` extends `Number`, `List<Integer>` is **not** a subtype of `List<Number>`. If it were, this would compile and break type safety:

```java
List<Integer> ints = new ArrayList<>();
List<Number> nums = ints;        // compile error (if allowed...)
nums.add(3.14);                  // ...a Double would end up in a list of Integers
```

**Arrays are covariant** (`Integer[]` is an `Object[]`), which is unsafe: `Object[] o = new String[1]; o[0] = 42;` compiles and throws `ArrayStoreException` at run time. Generic collections fail at compile time instead.

## Wildcards and PECS {#wildcards}

| Wildcard | Meaning | You can | You cannot |
| --- | --- | --- | --- |
| `List<?>` | list of unknown type | read as `Object`, `size`, `clear` | add (except `null`) |
| `List<? extends Number>` | list of some subtype of `Number` | **read** `Number`s | add anything (except `null`) |
| `List<? super Integer>` | list of `Integer` or a supertype | **add** `Integer`s | read anything but `Object` |

**PECS: Producer Extends, Consumer Super.** If a parameter *produces* values you read, use `extends`; if it *consumes* values you write into it, use `super`.

```java
static double sum(Collection<? extends Number> src) {          // producer: we only read
    double total = 0;
    for (Number n : src) total += n.doubleValue();
    return total;
}

static <T> void copy(List<? super T> dst, List<? extends T> src) {   // dst consumes, src produces
    for (T item : src) dst.add(item);
}

// Comparator<? super T> in Collections.sort(list, comparator): a Comparator<Object> can sort Strings
```

## Type erasure {#erasure}

Generic types exist only for the compiler. javac checks them, **erases** type parameters (replacing `T` with its bound or `Object`), and inserts casts and **bridge methods**. At run time `List<String>` and `List<Integer>` are both just `List`.

Consequences:

| You cannot | Because |
| --- | --- |
| `new T()` or `new T[n]` | `T` is unknown at run time |
| `obj instanceof List<String>` | the type argument is erased (use `List<?>`) |
| `catch (MyException<T> e)` or extend `Throwable` generically | exceptions must be reifiable |
| overload `f(List<String>)` and `f(List<Integer>)` | same erasure, name clash |
| use primitives as type arguments (`List<int>`) | type arguments must be reference types: use `Integer` (boxing) |
| have `static T field` | the static member is shared by all instantiations |

Workarounds: pass a **`Class<T>` type token** (`clazz.cast(obj)`, `clazz.getDeclaredConstructor().newInstance()`); use a **super type token** (`new TypeReference<List<Account>>() {}` in Jackson, which reads the generic superclass through reflection, since signatures are kept in class metadata); use `Array.newInstance(clazz, n)` or `Supplier<T>` factories.

## Raw types, unchecked warnings and heap pollution {#raw}

A **raw type** (`List` with no argument) turns off generic checking and exists only for old code. Mixing raw and generic types produces **unchecked warnings**. **Heap pollution** means a variable of a parameterised type holds an object of the wrong type, which later causes a `ClassCastException` where you do not expect one. Generic varargs (`T...`) can cause it, hence `@SafeVarargs` on methods that are really safe (`List.of`, `Arrays.asList`). Suppress warnings (`@SuppressWarnings("unchecked")`) in the smallest possible scope, with a comment explaining why it is safe.

## Useful patterns {#patterns}

- **Generic repository:** `interface Repository<T, ID> { Optional<T> findById(ID id); T save(T entity); }` (the shape of Spring Data's `CrudRepository`).
- **Recursive bound / self type:** `abstract class Builder<T extends Builder<T>> { abstract T self(); T name(String n) { ...; return self(); } }`.
- **Result or Either types:** `Result<T, E>` for error handling without exceptions.
- **Type tokens:** `Map<Class<?>, Object>` to store one value per type safely.

## Cheat sheet {#cheatsheet}

| Situation | Use |
| --- | --- |
| a method only reads from a collection | `Collection<? extends T>` |
| a method only adds to a collection | `Collection<? super T>` |
| reads and writes | exact type `List<T>` |
| you do not care about the type | `List<?>` |
| need a method of `T` (e.g. `compareTo`) | bound: `T extends Comparable<? super T>` |
| need the runtime type | pass `Class<T>` |
| a library method has two related types | `<T, R> R map(T in, Function<? super T, ? extends R> f)` |

## Interview questions {#questions}

### [basic] What are generics and why were they added? {#what-are-generics}

Parameterised types and methods (`List<String>`, `<T> T first(List<T>)`) introduced in Java 5. They give compile-time type safety, remove explicit casts and enable reusable code (one `Result<T>` for any type), moving errors that used to be `ClassCastException`s at run time into compile errors.

### [basic] What is type erasure? {#type-erasure-q}

The compiler checks generic types and then removes them: type parameters are replaced by their bound (or `Object`), casts are inserted where needed, and bridge methods preserve polymorphism. At run time a `List<String>` and a `List<Integer>` are the same class. It kept generics backward compatible with pre-Java 5 code.

### [basic] Can you create an instance of a type parameter, such as new T()? {#new-t}

No, because `T` is erased and the JVM does not know the real class. Alternatives: pass a `Class<T>` and call `getDeclaredConstructor().newInstance()`, or pass a `Supplier<T>` (`ArrayList::new`), which is type-safe and avoids reflection.

### [basic] What is a raw type and why should you avoid it? {#raw-type-q}

Using a generic class without type arguments (`List list`). It bypasses compile-time checks, produces unchecked warnings, and lets wrong types in, which fail later with `ClassCastException`. It exists only for legacy compatibility.

### [basic] What is the diamond operator? {#diamond}

`<>` (Java 7) lets the compiler infer the type arguments of a constructor call from the context: `Map<String, List<Account>> m = new HashMap<>();`. Java 9 extended it to anonymous classes.

### [basic] What does <T extends Comparable<T>> mean? {#bound-meaning}

A bounded type parameter: `T` must be a type that implements `Comparable<T>`, so the method can call `compareTo` on `T` values. A type can have several bounds (`T extends Number & Comparable<T>`): the first may be a class, the rest interfaces.

### [basic] Can you use primitive types as generic type arguments? {#primitives}

No: type arguments must be reference types, so `List<int>` is illegal and you use `List<Integer>`, with autoboxing and its memory and null-unboxing costs. Primitive-specialised types (`IntStream`, `IntFunction`) avoid boxing; Project Valhalla aims to lift this limit.

### [intermediate] Why is List<Integer> not a List<Number>? {#invariance-q}

Generics are invariant. If `List<Integer>` were a `List<Number>`, you could add a `Double` through the `Number` view and corrupt the `Integer` list. Use `List<? extends Number>` to accept a list of any `Number` subtype for reading.

### [intermediate] What is the difference between ? extends T and ? super T? {#extends-vs-super}

`? extends T`: an unknown subtype of `T`; you can read `T`s but not add (except `null`). `? super T`: an unknown supertype of `T`; you can add `T`s but read only `Object`. Use `extends` for sources of values and `super` for sinks.

### [intermediate] Explain PECS with an example. {#pecs-q}

Producer Extends, Consumer Super. In `copy(List<? super T> dst, List<? extends T> src)` the source produces values for us (extends) and the destination consumes them (super). Because of this signature you can copy a `List<Integer>` into a `List<Number>` or `List<Object>`. The standard library applies it in `Collections.copy`, `Comparator<? super T>` and `Function<? super T, ? extends R>`.

### [intermediate] What is the difference between List<?> and List<Object>? {#wildcard-vs-object}

`List<Object>` is a list that holds any objects and accepts additions, but only `List<Object>` is assignable to it. `List<?>` is a list of an unknown type: any `List<X>` is assignable to it, but you cannot add anything except `null`. `List<?>` is the right parameter when the method does not depend on the element type.

### [intermediate] What are bridge methods? {#bridge-methods}

Synthetic methods the compiler generates to keep polymorphism working after erasure. For `class Name implements Comparable<Name> { int compareTo(Name o) }`, erasure leaves `Comparable.compareTo(Object)`; the compiler adds `compareTo(Object)` that casts and calls `compareTo(Name)`. They show up in stack traces and reflection.

### [intermediate] Why can't you create a generic array like new List<String>[10]? {#generic-array}

Arrays carry their element type at run time and check stores (`ArrayStoreException`), but after erasure the JVM cannot tell a `List<String>[]` from a `List<Integer>[]`, so allowing it would break type safety. Use `List<List<String>>` or an array of the raw or wildcard type (`List<?>[]`) with care.

### [intermediate] What are the problems with arrays being covariant while generics are invariant? {#array-covariance}

`Object[] a = new String[1]; a[0] = 42;` compiles and throws `ArrayStoreException` at run time, because arrays are covariant and reified. Generic collections are invariant and checked at compile time, so the same mistake with `List<Object> = List<String>` does not compile. Prefer lists over arrays when mixing with generics.

### [intermediate] What is heap pollution and @SafeVarargs? {#heap-pollution}

Heap pollution is when a variable of a parameterised type refers to an object that is not of that type, usually via raw types, unchecked casts or generic varargs; the failure appears later as an unexpected `ClassCastException`. `@SafeVarargs` (on `static`, `final` or `private` methods) asserts that a generic varargs method does not misuse its array, suppressing the warning at call sites.

### [intermediate] How do you get the runtime type of a generic parameter? {#runtime-type}

You cannot read it from `T` directly. Pass a `Class<T>` token, or capture it with an anonymous subclass (super type token): `new TypeReference<List<Account>>() {}`; the generic superclass signature is kept in the class file and read through `getGenericSuperclass()`. Spring's `ParameterizedTypeReference` and Jackson's `TypeReference` use this.

### [deep] Why do generic type arguments get erased instead of reified like in C#? {#why-erasure}

For migration compatibility: Java 5 had to work with the huge amount of existing non-generic code and libraries without changing the JVM or requiring a recompile of everything. Erasure let old and new code interoperate. The price is no runtime type information, no `new T()` and the other limits above.

### [deep] What does <T extends Comparable<? super T>> allow that <T extends Comparable<T>> does not? {#comparable-super}

A class hierarchy where the subclass inherits `compareTo` from its parent: `class Timestamp extends Date` implements `Comparable<Date>`, not `Comparable<Timestamp>`. `T extends Comparable<T>` would reject `Timestamp`; `Comparable<? super T>` accepts it because `Comparable<Date>` can consume a `Timestamp`. This is PECS on a type bound.

### [deep] What is a covariant return type, and how does it relate to generics? {#covariant-return}

An overriding method may return a subtype of the overridden method's return type (`Object clone()` overridden as `Account clone()`). The compiler adds a bridge method with the original signature. Generic return types follow the same rules, and `? extends` lets generic code express "some subtype of".

### [deep] How does the compiler infer type arguments for a generic method call? {#inference}

From the argument types and, since Java 8, also from the target type (the context where the result is used), through constraint solving: `Collections.emptyList()` assigned to `List<String>` infers `T = String`. When inference fails you can give an explicit type witness: `Collections.<String>emptyList()`.

### [coding] Write a generic Pair<K, V> class and a method that swaps it. {#coding-pair}

```java
public record Pair<K, V>(K first, V second) {
    public Pair<V, K> swap() {
        return new Pair<>(second, first);
    }
    public static <A, B> Pair<A, B> of(A a, B b) {
        return new Pair<>(a, b);
    }
}

Pair<String, BigDecimal> p = Pair.of("ACC-1", new BigDecimal("10"));
Pair<BigDecimal, String> s = p.swap();
```

### [coding] Write a generic method that returns the largest element of a collection. {#coding-max}

```java
static <T extends Comparable<? super T>> Optional<T> max(Collection<? extends T> items) {
    Iterator<? extends T> it = items.iterator();
    if (!it.hasNext()) return Optional.empty();
    T best = it.next();
    while (it.hasNext()) {
        T next = it.next();
        if (next.compareTo(best) > 0) best = next;
    }
    return Optional.of(best);
}
```

The collection is a producer (`? extends T`), the bound uses `? super T`, and an empty collection returns `Optional.empty()` instead of `null`.

### [coding] Copy one list into another with the most flexible signature. {#coding-copy}

```java
static <T> void copy(List<? super T> dst, List<? extends T> src) {
    for (T item : src) dst.add(item);
}

List<Integer> ints = List.of(1, 2, 3);
List<Number> nums = new ArrayList<>();
copy(nums, ints);            // works because of ? extends and ? super
```

### [coding] Fix the unchecked warnings in this code. {#coding-fix-raw}

```java
List names = new ArrayList();
names.add("Ana");
for (Object o : names) {
    String s = (String) o;
    System.out.println(s.length());
}
Map cache = new HashMap();
cache.put("k", 1);
Integer v = (Integer) cache.get("k");
```

```java
List<String> names = new ArrayList<>();
names.add("Ana");
for (String s : names) {
    System.out.println(s.length());
}
Map<String, Integer> cache = new HashMap<>();
cache.put("k", 1);
Integer v = cache.get("k");
```

Replace raw types by parameterised ones: the casts disappear, the compiler checks every `add` and `put`, and a wrong type becomes a compile error instead of a run-time `ClassCastException`.
