---
title: Java Generics — type parameters, erasure, wildcards and PECS
nav: Generics
slug: java-generics
summary: Generic classes and methods, bounded types, type erasure and its limits, invariance versus array covariance, wildcards and the PECS rule, raw types and heap pollution, with animations and interview questions and coding tasks.
tags: [Java, Generics, Types]
order: 10
topic: Java / Language
updated: 2026-11-24
subnav: true
---

Generics questions show whether you only use `List<String>` or also understand it. Typical questions:

- What is type erasure?
- Why is `List<Integer>` not a `List<Number>`?
- What does `? super T` mean?

You use generics in every [collection](lesson:java-collections), in `Optional`, in [streams](lesson:java-streams) and in `CompletableFuture`. The rules also explain many confusing compiler errors.

The animation has four scenes: why generics, type erasure, wildcards and PECS, and bounded type parameters.

```demo
name: java-generics-walk
```

> **One sentence to remember:** *Generics check types when you compile, then disappear, so read with `? extends` and write with `? super`.*

## Why generics {#why}

Before Java 5, collections held plain `Object`s. Every read needed a cast. A wrong type failed with a `ClassCastException` while the program ran, sometimes far away from the real mistake.

Generics let the compiler check the element type. The compiler also adds the casts for you.

```java
List accounts = new ArrayList();            // raw type: avoid
accounts.add("oops");                       // compiles
Account a = (Account) accounts.get(0);      // ClassCastException at run time

List<Account> typed = new ArrayList<>();
typed.add("oops");                          // compile error
Account b = typed.get(0);                   // no cast
```

## Generic classes and methods {#generic-types}

A **type parameter** such as `T` is a placeholder for a type. The code that uses the class fills it in.

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

The usual letter names:

| Letter | Meaning |
| --- | --- |
| `T` | A type. |
| `E` | An element of a collection. |
| `K`, `V` | A key and a value. |
| `R` | A result. |
| `N` | A number. |

A **generic method** declares its own type parameter before the return type, for example `<T> T first(List<T> list)`. The compiler works out `T` from the arguments. This is called **type inference**.

The **diamond** `new ArrayList<>()` lets the compiler work out the type arguments from the variable on the left.

## Bounded type parameters {#bounds}

A **bound** tells the compiler what `T` can do. Without a bound, the compiler only knows that `T` is an `Object`.

```java
static <T extends Comparable<T>> T max(T a, T b) {             // T must be comparable to itself
    return a.compareTo(b) >= 0 ? a : b;
}

static <T extends Number & Comparable<T>> T largest(List<T> xs) { ... }   // several bounds with &

static <T extends Comparable<? super T>> void sort(List<T> list) { ... } // the library form (PECS on the bound)
```

You join several bounds with `&`. Only the first bound can be a class. The others must be interfaces.

## Invariance: List<Integer> is not List<Number> {#invariance}

`Integer` extends `Number`. But `List<Integer>` is **not** a subtype of `List<Number>`. This rule is called **invariance**.

If Java allowed it, this code would break type safety:

```java
List<Integer> ints = new ArrayList<>();
List<Number> nums = ints;        // compile error (if allowed...)
nums.add(3.14);                  // ...a Double would end up in a list of Integers
```

**Arrays are different: they are covariant.** An `Integer[]` is an `Object[]`. This is unsafe. `Object[] o = new String[1]; o[0] = 42;` compiles and then throws an `ArrayStoreException` at run time. Generic collections stop the same mistake at compile time instead.

## Wildcards and PECS {#wildcards}

A **wildcard** `?` stands for "some type I do not know exactly". It makes a parameter accept more kinds of lists, while staying safe.

| Wildcard | Meaning | You can | You cannot |
| --- | --- | --- | --- |
| `List<?>` | A list of an unknown type. | Read elements as `Object`, call `size` and `clear`. | Add anything except `null`. |
| `List<? extends Number>` | A list of some subtype of `Number`. | **Read** elements as `Number`. | Add anything except `null`. |
| `List<? super Integer>` | A list of `Integer` or a supertype of it. | **Add** `Integer`s. | Read anything except as `Object`. |

**PECS means Producer Extends, Consumer Super.**

- If a parameter *produces* values that you read, use `extends`.
- If a parameter *consumes* values that you write into it, use `super`.

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

Generic types exist only for the compiler. The compiler (javac) does three things:

1. It checks the generic types.
2. It **erases** the type parameters. `T` is replaced by its bound, or by `Object` if it has no bound.
3. It adds casts, and **bridge methods** where needed (explained in the questions below).

So at run time, `List<String>` and `List<Integer>` are both just `List`.

What erasure stops you from doing:

| You cannot | Because |
| --- | --- |
| Write `new T()` or `new T[n]`. | `T` is unknown at run time. |
| Write `obj instanceof List<String>`. | The type argument is erased. Use `List<?>` instead. |
| Write `catch (MyException<T> e)`, or make a generic subclass of `Throwable`. | Exception types must be fully known at run time (**reifiable**). |
| Overload `f(List<String>)` and `f(List<Integer>)`. | Both erase to `f(List)`, so the names clash. |
| Use a primitive as a type argument, such as `List<int>`. | Type arguments must be reference types. Use `Integer`, which means boxing. |
| Declare a `static T field`. | A static member is shared by every version of the class, so it cannot have one `T`. |

The workarounds:

- Pass a **`Class<T>` type token**. Then you can call `clazz.cast(obj)` or `clazz.getDeclaredConstructor().newInstance()`.
- Use a **super type token**, such as `new TypeReference<List<Account>>() {}` in Jackson. The generic types in class and method signatures are kept in the class file, so a library can read them through reflection.
- Use `Array.newInstance(clazz, n)` to create an array, or pass a `Supplier<T>` factory.

## Raw types, unchecked warnings and heap pollution {#raw}

A **raw type** is a generic class used with no type argument, such as plain `List`. It turns off generic checking. It exists only so old code still compiles.

When you mix raw and generic types, the compiler gives **unchecked warnings**.

**Heap pollution** means a variable of a generic type points to an object of the wrong type. It causes a `ClassCastException` later, in a place where you do not expect one.

Generic varargs (`T...`) can cause heap pollution. That is why methods that are really safe, such as `List.of` and `Arrays.asList`, carry `@SafeVarargs`.

If you must hide a warning with `@SuppressWarnings("unchecked")`, put it on the smallest possible piece of code. Add a comment that explains why it is safe.

## Useful patterns {#patterns}

- **Generic repository:** `interface Repository<T, ID> { Optional<T> findById(ID id); T save(T entity); }`. This is the shape of Spring Data's `CrudRepository`.
- **Recursive bound, or self type:** `abstract class Builder<T extends Builder<T>> { abstract T self(); T name(String n) { ...; return self(); } }`. Each builder method returns the subclass type, so calls can be chained.
- **Result or Either types:** `Result<T, E>` handles errors without exceptions.
- **Type tokens:** a `Map<Class<?>, Object>` stores one value per type safely.

Try it in the lab: [Generics: invariance, wildcards and PECS](lab:generics-erasure-pecs).

## Cheat sheet {#cheatsheet}

| Situation | Use |
| --- | --- |
| A method only reads from a collection. | `Collection<? extends T>` |
| A method only adds to a collection. | `Collection<? super T>` |
| A method reads and writes. | The exact type, `List<T>`. |
| You do not care about the element type. | `List<?>` |
| You need a method of `T`, such as `compareTo`. | A bound: `T extends Comparable<? super T>`. |
| You need the type at run time. | Pass a `Class<T>`. |
| A library method links two types. | `<T, R> R map(T in, Function<? super T, ? extends R> f)` |

## Interview questions {#questions}

### [basic] What are generics and why were they added? {#what-are-generics}

Generics are classes and methods that take a type as a parameter, such as `List<String>` or `<T> T first(List<T>)`. They came in Java 5.

They give three things:

1. **Type safety at compile time.** A wrong type is a compile error, not a `ClassCastException` while the program runs.
2. **No explicit casts.** The compiler adds them.
3. **Reusable code.** One `Result<T>` class works for any type.

### [basic] What is type erasure? {#type-erasure-q}

The compiler checks the generic types and then removes them.

1. Type parameters are replaced by their bound, or by `Object`.
2. Casts are added where needed.
3. Bridge methods keep polymorphism working.

At run time, a `List<String>` and a `List<Integer>` are the same class. Erasure kept generic code compatible with code written before Java 5.

### [basic] Can you create an instance of a type parameter, such as new T()? {#new-t}

**No.** `T` is erased, so the JVM does not know the real class.

Two alternatives:

- Pass a `Class<T>` and call `getDeclaredConstructor().newInstance()`.
- Pass a `Supplier<T>`, for example `ArrayList::new`. This is type-safe and needs no reflection.

### [basic] What is a raw type and why should you avoid it? {#raw-type-q}

A raw type is a generic class used without type arguments, such as `List list`.

Avoid it because:

- It skips the compile-time checks.
- It produces unchecked warnings.
- It lets wrong types in, and they fail later with a `ClassCastException`.

It exists only so old code keeps working.

### [basic] What is the diamond operator? {#diamond}

`<>` (Java 7) lets the compiler work out the type arguments of a constructor call from the context.

Example: `Map<String, List<Account>> m = new HashMap<>();`. Java 9 extended it to anonymous classes.

### [basic] What does <T extends Comparable<T>> mean? {#bound-meaning}

It is a bounded type parameter. `T` must be a type that implements `Comparable<T>`. So the method can call `compareTo` on `T` values.

A type parameter can have several bounds, such as `T extends Number & Comparable<T>`. The first one may be a class. The others must be interfaces.

### [basic] Can you use primitive types as generic type arguments? {#primitives}

**No.** Type arguments must be reference types. `List<int>` is illegal, so you write `List<Integer>`.

That means **autoboxing**: each `int` is wrapped in an `Integer` object. It costs memory, and unboxing a `null` throws a `NullPointerException`.

Types made for primitives, such as `IntStream` and `IntFunction`, avoid boxing. Project Valhalla aims to remove this limit.

### [intermediate] Why is List<Integer> not a List<Number>? {#invariance-q}

Because generics are **invariant**.

If `List<Integer>` were a `List<Number>`, you could add a `Double` through the `Number` view. The list of `Integer`s would then hold a `Double`.

To accept a list of any `Number` subtype for reading, use `List<? extends Number>`.

### [intermediate] What is the difference between ? extends T and ? super T? {#extends-vs-super}

- **`? extends T`** is some unknown subtype of `T`. You can read `T`s from it. You cannot add anything except `null`.
- **`? super T`** is some unknown supertype of `T`. You can add `T`s to it. You can only read elements as `Object`.

Use `extends` for a source of values. Use `super` for a destination of values.

### [intermediate] Explain PECS with an example. {#pecs-q}

PECS means **Producer Extends, Consumer Super**.

Example: `copy(List<? super T> dst, List<? extends T> src)`.

- The source produces values for us, so it uses `extends`.
- The destination consumes our values, so it uses `super`.

Thanks to this signature, you can copy a `List<Integer>` into a `List<Number>` or a `List<Object>`.

The standard library uses it in `Collections.copy`, `Comparator<? super T>` and `Function<? super T, ? extends R>`.

### [intermediate] What is the difference between List<?> and List<Object>? {#wildcard-vs-object}

- **`List<Object>`** holds any objects, and you can add to it. But only a `List<Object>` can be assigned to it.
- **`List<?>`** is a list of an unknown type. Any `List<X>` can be assigned to it. But you cannot add anything except `null`.

Use `List<?>` as a parameter when the method does not depend on the element type.

### [intermediate] What are bridge methods? {#bridge-methods}

A bridge method is an extra method that the compiler generates. It keeps polymorphism working after erasure.

Example: `class Name implements Comparable<Name> { int compareTo(Name o) }`.

1. After erasure, the interface method is `Comparable.compareTo(Object)`.
2. The class only has `compareTo(Name)`.
3. So the compiler adds `compareTo(Object)`, which casts the argument and calls `compareTo(Name)`.

Bridge methods appear in stack traces and through reflection.

### [intermediate] Why can't you create a generic array like new List<String>[10]? {#generic-array}

Because it would break type safety.

1. An array remembers its element type at run time and checks every store. A wrong store throws `ArrayStoreException`.
2. After erasure, the JVM cannot tell a `List<String>[]` from a `List<Integer>[]`.
3. So the array could not check its stores.

Use a `List<List<String>>` instead. Or use an array of the raw or wildcard type (`List<?>[]`), with care.

### [intermediate] What are the problems with arrays being covariant while generics are invariant? {#array-covariance}

Arrays can fail at run time, while generics fail at compile time.

- `Object[] a = new String[1]; a[0] = 42;` compiles. It throws `ArrayStoreException` at run time, because arrays are covariant and **reified** (they keep their element type at run time).
- The same mistake with lists, `List<Object> = List<String>`, does not compile, because generics are invariant.

So prefer lists over arrays when you work with generics.

### [intermediate] What is heap pollution and @SafeVarargs? {#heap-pollution}

**Heap pollution** is when a variable of a generic type points to an object that is not of that type. It usually comes from raw types, unchecked casts or generic varargs. The failure shows up later as an unexpected `ClassCastException`.

**`@SafeVarargs`** is a promise that a generic varargs method does not misuse its array. It removes the warning where the method is called. It is allowed on `static`, `final` and `private` methods.

### [intermediate] How do you get the runtime type of a generic parameter? {#runtime-type}

You cannot read it from `T` directly. Two ways around it:

- Pass a **`Class<T>` token**.
- Capture the type with an anonymous subclass, called a **super type token**: `new TypeReference<List<Account>>() {}`. The generic superclass signature is kept in the class file, and `getGenericSuperclass()` reads it.

Spring's `ParameterizedTypeReference` and Jackson's `TypeReference` use the second way.

### [deep] Why do generic type arguments get erased instead of reified like in C#? {#why-erasure}

For **compatibility with old code**.

Java 5 had to work with a huge amount of existing non-generic code and libraries. It could not change the JVM, and it could not ask everyone to recompile. Erasure let old and new code work together.

The price is no type information at run time, no `new T()` and the other limits above.

### [deep] What does <T extends Comparable<? super T>> allow that <T extends Comparable<T>> does not? {#comparable-super}

It allows a subclass that inherits `compareTo` from its parent.

Example: `class Timestamp extends Date`. `Timestamp` implements `Comparable<Date>`, not `Comparable<Timestamp>`.

- `T extends Comparable<T>` rejects `Timestamp`.
- `T extends Comparable<? super T>` accepts it, because a `Comparable<Date>` can consume a `Timestamp`.

This is PECS applied to a type bound.

### [deep] What is a covariant return type, and how does it relate to generics? {#covariant-return}

An overriding method may return a subtype of the original return type. For example, `Object clone()` can be overridden as `Account clone()`. This is a **covariant return type**.

The compiler adds a bridge method with the original signature. Generic return types follow the same rules. And `? extends` lets generic code say "some subtype of".

### [deep] How does the compiler infer type arguments for a generic method call? {#inference}

It looks at the argument types. Since Java 8, it also looks at the **target type**: the place where the result is used. It then solves the constraints.

Example: `Collections.emptyList()` assigned to a `List<String>` gives `T = String`.

When inference fails, you can name the type yourself with a **type witness**: `Collections.<String>emptyList()`.

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

How it works:

- The collection only produces values, so it is `? extends T`.
- The bound uses `? super T`, so subclasses that inherit `compareTo` also work.
- An empty collection returns `Optional.empty()` instead of `null`.

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

Replace every raw type with a parameterised one. The casts disappear, and the compiler checks every `add` and `put`. A wrong type becomes a compile error instead of a `ClassCastException` at run time.
