---
title: Lambdas, functional interfaces and Optional
nav: Lambdas and Optional
slug: java-functional
summary: Lambda syntax, method references, the core functional interfaces (Predicate, Function, Consumer, Supplier), effectively final variables and Optional, the foundation for streams, with animations and interview questions.
tags: [Java, Lambdas, Functional]
order: 7
topic: Java / Functional programming
updated: 2026-11-13
subnav: true
---

Lambdas and `Optional` came in Java 8, and interviewers still ask about them because every stream, `CompletableFuture` and Spring callback uses them. Read this first, then continue with [Streams](lesson:java-streams); the collections they work on are in [Collections framework](lesson:java-collections). Play the four scenes: from class to lambda, the core functional interfaces, `Optional`, and captured variables.

```demo
name: java-functional-walk
```

> **One sentence to remember:** *a lambda is a short implementation of an interface that has one abstract method (a functional interface); `Function`, `Predicate`, `Consumer` and `Supplier` cover most cases, variables it captures must be effectively final, and `Optional` is a return type that makes "no result" explicit.*

## Lambda syntax {#syntax}

```java
// no parameters
Runnable r = () -> System.out.println("done");

// one parameter: parentheses optional
Predicate<Account> active = a -> a.isActive();

// several parameters, types inferred from the target type
Comparator<Account> byBalance = (a, b) -> a.balance().compareTo(b.balance());

// block body with an explicit return
Function<Account, String> label = a -> {
    String id = a.id();
    return id + ":" + a.owner();
};
```

The compiler infers the parameter types from the **target type**, the functional interface the lambda is assigned to or passed as. The same lambda text can therefore mean different things in different places.

## Functional interfaces {#interfaces}

A **functional interface** has exactly one abstract method (it may also have default and static methods). Annotate your own with `@FunctionalInterface` so the compiler checks it. The ones you must know are in `java.util.function`:

| Interface | Method | Shape | Example |
| --- | --- | --- | --- |
| `Predicate<T>` | `boolean test(T)` | T to boolean | `a -> a.balance().signum() > 0` |
| `Function<T,R>` | `R apply(T)` | T to R | `Account::owner` |
| `Consumer<T>` | `void accept(T)` | T to nothing | `System.out::println` |
| `Supplier<T>` | `T get()` | nothing to T | `ArrayList::new` |
| `UnaryOperator<T>` | `T apply(T)` | T to T | `String::trim` |
| `BinaryOperator<T>` | `T apply(T, T)` | two T to T | `BigDecimal::add` |
| `BiFunction<T,U,R>` | `R apply(T, U)` | two inputs | `(a, b) -> a.add(b)` |
| `Runnable` / `Callable<V>` | `run()` / `V call()` | no input | tasks for threads and executors |
| `Comparator<T>` | `int compare(T, T)` | two T to int | `comparing(Account::balance)` |

Primitive versions (`IntPredicate`, `ToIntFunction`, `IntFunction`, `IntBinaryOperator`, ...) avoid boxing. Several of the interfaces compose:

```java
Predicate<Account> active  = Account::isActive;
Predicate<Account> funded  = a -> a.balance().signum() > 0;
Predicate<Account> usable  = active.and(funded).and(a -> !a.isFrozen());

Function<String, String> trim = String::trim;
Function<String, Integer> length = String::length;
Function<String, Integer> trimmedLength = trim.andThen(length);
```

## Method references {#method-refs}

A method reference is a lambda that only calls an existing method.

| Kind | Syntax | Equivalent lambda |
| --- | --- | --- |
| static method | `Integer::parseInt` | `s -> Integer.parseInt(s)` |
| method on a specific object | `logger::info` | `m -> logger.info(m)` |
| instance method of an arbitrary object of a type | `String::length` | `s -> s.length()` |
| constructor | `ArrayList::new` | `() -> new ArrayList<>()` |

## Lambdas versus anonymous classes {#vs-anonymous}

| | Anonymous class | Lambda |
| --- | --- | --- |
| Works for | any class or interface | functional interfaces only |
| `this` means | the anonymous object | the enclosing object |
| Compiled as | its own `.class` file | `invokedynamic`, no extra class file |
| Can have state (fields) | yes | no |
| Shadowing of local names | allowed (new scope) | not allowed (same scope) |

## Captured variables {#capture}

A lambda may read local variables from the enclosing method, but they must be **final or effectively final**: assigned exactly once. The lambda gets a copy of the value, so a later change could never be seen consistently, and the lambda may run on another thread.

```java
BigDecimal limit = new BigDecimal("1000");           // effectively final
list.removeIf(t -> t.amount().compareTo(limit) > 0); // OK

int count = 0;
list.forEach(t -> count++);                           // compile error
```

Instance and static fields are not captured copies; a lambda reads them through `this`, so they can change (and need normal thread safety).

## Optional {#optional}

`Optional<T>` is a container that holds one value or is empty. Its purpose is to make "this may not return anything" visible in a **return type**.

```java
Optional<Account> find(String id) { ... }

String email = find(id)
        .filter(Account::isActive)
        .map(Account::owner)
        .map(Customer::email)
        .orElse("no-reply@bank.example");
```

| Method | What it does |
| --- | --- |
| `Optional.of(x)` / `ofNullable(x)` / `empty()` | create; `of(null)` throws |
| `map(f)` / `flatMap(f)` / `filter(p)` | transform or test the value if present |
| `orElse(x)` | value or `x` (`x` is always evaluated) |
| `orElseGet(supplier)` | value or the supplier's result (lazy) |
| `orElseThrow(supplier)` | value or throw; `orElseThrow()` with no argument throws `NoSuchElementException` |
| `ifPresent(c)` / `ifPresentOrElse(c, r)` | run an action |
| `or(supplier)` (Java 9) | fall back to another `Optional` |
| `isPresent()` / `isEmpty()` | avoid; prefer the functional methods |

Guidelines: use it for **return values** only; do not use it for fields, parameters or collection elements; never return `null` from a method that returns `Optional`; return an empty collection (not `Optional<List>`) for "no results"; do not call `get()` without checking.

## Cheat sheet {#cheatsheet}

| Need | Use |
| --- | --- |
| test something | `Predicate` |
| convert something | `Function` / `UnaryOperator` |
| do something with a value | `Consumer` |
| produce or lazily create a value | `Supplier` |
| combine two values | `BinaryOperator` |
| result may be absent | `Optional` return type |
| lambda only calls one method | method reference |

## Interview questions {#questions}

### [basic] What is a lambda expression? {#what-is-lambda}

A concise way to write an implementation of a functional interface: `(parameters) -> body`. It lets you pass behaviour as data, for example `list.removeIf(a -> a.isClosed())`, without writing an anonymous class.

### [basic] What is a functional interface? {#what-is-fi}

An interface with exactly one abstract method (default and static methods and the `Object` methods do not count). Lambdas and method references can be used wherever one is expected. `@FunctionalInterface` makes the compiler enforce the rule.

### [basic] Name the four main functional interfaces and what each does. {#four-main}

`Predicate<T>` (T to boolean), `Function<T,R>` (T to R), `Consumer<T>` (T to void) and `Supplier<T>` (nothing to T). Variants add two arguments (`BiFunction`), same-type operators (`UnaryOperator`, `BinaryOperator`) and primitive specialisations (`IntPredicate`, `ToIntFunction`).

### [basic] What is a method reference, and what are its four kinds? {#method-ref-q}

Shorthand for a lambda that only calls an existing method: static (`Integer::parseInt`), bound instance (`logger::info`), unbound instance method of an arbitrary object (`String::length`), and constructor (`ArrayList::new`).

### [basic] What is Optional and why was it introduced? {#optional-q}

A container for a value that may be absent, designed as a **return type** so the caller is forced to handle "nothing found" instead of forgetting a `null` check. It provides `map`, `filter`, `orElse`, `orElseThrow` and friends to handle both cases without `if` statements.

### [basic] What is the difference between orElse and orElseGet? {#orelse-vs-orelseget}

`orElse(x)` evaluates `x` always, even when the `Optional` has a value, so an expensive or side-effecting expression runs for nothing. `orElseGet(supplier)` runs the supplier only when the `Optional` is empty. Use `orElseGet` unless the fallback is a constant.

### [basic] What does "effectively final" mean? {#effectively-final}

A local variable that is never reassigned after its first assignment, even without the `final` keyword. Lambdas and inner classes may only capture local variables that are final or effectively final.

### [basic] Can a lambda change a local variable of the enclosing method? {#modify-local}

No: compile error ("local variables referenced from a lambda expression must be final or effectively final"). It can change fields, and it can mutate an object the variable refers to (a list, an `AtomicInteger`), but changing shared state from a lambda is a design smell, and in parallel code a data race.

### [intermediate] Where should Optional not be used? {#optional-misuse}

Not for fields (it is not `Serializable` and adds an object per field), not for method parameters (overloads or `@Nullable` are clearer), not for collection elements, and not as a replacement for empty collections. Never return a `null` `Optional`. It is meant for return values of methods that may have no result.

### [intermediate] What is the difference between map and flatMap on Optional? {#map-vs-flatmap}

`map(f)` wraps whatever `f` returns, so if `f` returns an `Optional` you get `Optional<Optional<T>>`. `flatMap(f)` expects `f` to return an `Optional` and does not wrap it again. Use `flatMap` when the next step is itself optional: `find(id).flatMap(this::findBranch)`.

### [intermediate] How are lambdas different from anonymous inner classes? {#lambda-vs-anon}

A lambda works only for functional interfaces, has no state or identity of its own, uses `this` for the enclosing object, cannot shadow local variables, and compiles to an `invokedynamic` call rather than a separate class file (so it is lighter at load time). An anonymous class can implement any interface or extend a class, can have fields, and its `this` is itself.

### [intermediate] How do you compose predicates and functions? {#compose}

`Predicate` has `and`, `or`, `negate` and `Predicate.not`. `Function` has `andThen` (apply this, then that) and `compose` (apply that, then this). `Comparator` has `thenComparing` and `reversed`. This lets you build behaviour from small named pieces: `isActive.and(hasFunds.negate())`.

### [intermediate] Do lambdas capture values or variables? {#capture-q}

Values. A lambda captures a copy of the local variable's value at creation time, which is why locals must be effectively final. Fields are different: the lambda captures `this` and reads the current field value each time it runs.

### [intermediate] What is a closure in Java terms? {#closure}

A function together with the variables it captured from its surrounding scope. Java lambdas are closures over effectively final locals. They are less flexible than closures in languages that capture mutable variables by reference.

### [intermediate] What is currying, and how would you write it with functional interfaces? {#currying}

Turning a function of several arguments into a chain of one-argument functions. In Java: `Function<BigDecimal, Function<BigDecimal, BigDecimal>> add = a -> b -> a.add(b);` then `add.apply(x).apply(y)`. It is rarely needed in everyday Java, but it shows that functions are values you can return.

### [intermediate] Can a functional interface have more than one method? {#fi-methods}

It can have many default and static methods and redeclare `Object` methods such as `equals`, but only one abstract method. `Comparator` is functional even though it declares `equals` and many default methods.

### [intermediate] What happens if a lambda throws a checked exception? {#checked-exceptions}

The standard functional interfaces do not declare checked exceptions, so code inside the lambda must catch them or wrap them (for example in `UncheckedIOException`). Alternatively use `Callable` (which may throw) or define your own functional interface whose method declares `throws Exception`.

### [deep] How are lambdas implemented at the bytecode level? {#invokedynamic}

The compiler turns the lambda body into a private synthetic method and emits an `invokedynamic` instruction. At first execution the `LambdaMetafactory` generates, at run time, a class implementing the functional interface that calls that method, and links the call site to it. Non-capturing lambdas can be a single shared instance; capturing lambdas allocate an object holding the captured values.

### [deep] Why can't you assign a lambda to Object or use var with it? {#target-typing}

A lambda has no type of its own; it takes its type from the target context, which must be a functional interface. `Object o = () -> {};` fails because `Object` is not functional, and `var f = () -> {};` fails because there is nothing to infer from. A cast (`(Runnable) () -> {}`) or a typed variable supplies the target.

### [deep] What is a "pure function" and why does it matter for streams? {#pure}

A function whose result depends only on its arguments and which has no side effects (no mutation of outside state, no I/O). Pure lambdas are safe to run in any order, repeat, or run in parallel, which is what stream operations assume. Side effects inside `map` or `filter` are a common source of bugs and race conditions.

### [coding] Write a generic method that filters a list with a Predicate. {#coding-filter}

```java
static <T> List<T> filter(Collection<T> items, Predicate<? super T> test) {
    List<T> out = new ArrayList<>();
    for (T item : items) {
        if (test.test(item)) out.add(item);
    }
    return out;
}

List<Account> overdrawn = filter(accounts, a -> a.balance().signum() < 0);
```

`Predicate<? super T>` accepts a predicate written for a supertype too. The standard library version is `stream().filter(...)`.

### [coding] Refactor this null-heavy code with Optional. {#coding-optional}

```java
String city = null;
Account a = repo.find(id);
if (a != null) {
    Customer c = a.owner();
    if (c != null && c.address() != null) {
        city = c.address().city();
    }
}
if (city == null) city = "unknown";
```

```java
String city = repo.find(id)                    // Optional<Account>
        .map(Account::owner)
        .map(Customer::address)
        .map(Address::city)
        .orElse("unknown");
```

Each `map` is skipped as soon as something is empty (or `null`, because `map` turns a `null` result into an empty `Optional`).

### [coding] Write your own functional interface and use it. {#coding-own-fi}

```java
@FunctionalInterface
interface FeeRule {
    BigDecimal fee(Transaction t);

    default FeeRule cappedAt(BigDecimal max) {
        return t -> fee(t).min(max);
    }
}

FeeRule percent = t -> t.amount().multiply(new BigDecimal("0.01"));
FeeRule capped  = percent.cappedAt(new BigDecimal("25"));
BigDecimal fee  = capped.fee(txn);
```

One abstract method, so lambdas work; the default method composes rules, the same pattern as `Predicate.and`.
