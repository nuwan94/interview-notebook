---
title: Lambdas, functional interfaces and Optional
nav: Lambdas and Optional
slug: java-functional
summary: Lambda syntax, method references, the core functional interfaces (Predicate, Function, Consumer, Supplier), effectively final variables and Optional, the foundation for streams, with animations and interview questions.
tags: [Java, Lambdas, Functional]
order: 12
topic: Java / Functional programming
updated: 2026-11-24
subnav: true
---

Lambdas and `Optional` came in Java 8. Interviewers still ask about them, because every stream, every `CompletableFuture` and many Spring callbacks use them.

Read this lesson first, then continue with [Streams](lesson:java-streams). The collections that streams work on are in [Collections framework](lesson:java-collections).

The animation has four scenes: from class to lambda, the core functional interfaces, `Optional`, and captured variables.

```demo
name: java-functional-walk
```

> **One sentence to remember:** *A lambda is a short way to implement an interface that has one method, and `Optional` is a return type for "maybe no result".*

## Lambda syntax {#syntax}

A **lambda** is a short piece of code that you can pass around like a value. It is written as `(parameters) -> body`.

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

The compiler works out the parameter types from the **target type**. The target type is the interface that the lambda is assigned to, or passed as. So the same lambda text can mean different things in different places.

## Functional interfaces {#interfaces}

A **functional interface** has exactly one abstract method. It may also have default and static methods.

Put `@FunctionalInterface` on your own ones, so the compiler checks the rule. The ones you must know are in `java.util.function`:

| Interface | Method | Shape | Example |
| --- | --- | --- | --- |
| `Predicate<T>` | `boolean test(T)` | Takes a T and returns a boolean. | `a -> a.balance().signum() > 0` |
| `Function<T,R>` | `R apply(T)` | Takes a T and returns an R. | `Account::owner` |
| `Consumer<T>` | `void accept(T)` | Takes a T and returns nothing. | `System.out::println` |
| `Supplier<T>` | `T get()` | Takes nothing and returns a T. | `ArrayList::new` |
| `UnaryOperator<T>` | `T apply(T)` | Takes a T and returns a T. | `String::trim` |
| `BinaryOperator<T>` | `T apply(T, T)` | Takes two Ts and returns a T. | `BigDecimal::add` |
| `BiFunction<T,U,R>` | `R apply(T, U)` | Takes two inputs and returns a result. | `(a, b) -> a.add(b)` |
| `Runnable` / `Callable<V>` | `run()` / `V call()` | Takes no input. | Tasks for threads and executors. |
| `Comparator<T>` | `int compare(T, T)` | Takes two Ts and returns an int. | `comparing(Account::balance)` |

There are also versions for primitives, such as `IntPredicate`, `ToIntFunction`, `IntFunction` and `IntBinaryOperator`. They avoid **boxing** (wrapping an `int` in an `Integer` object).

Several of these interfaces can be combined (**composed**):

```java
Predicate<Account> active  = Account::isActive;
Predicate<Account> funded  = a -> a.balance().signum() > 0;
Predicate<Account> usable  = active.and(funded).and(a -> !a.isFrozen());

Function<String, String> trim = String::trim;
Function<String, Integer> length = String::length;
Function<String, Integer> trimmedLength = trim.andThen(length);
```

Try it in the lab: [Predicate, Function, Consumer, Supplier](lab:fp-functional-interfaces).

## Method references {#method-refs}

A **method reference** is a shorter way to write a lambda that only calls one existing method.

| Kind | Syntax | Same as this lambda |
| --- | --- | --- |
| A static method. | `Integer::parseInt` | `s -> Integer.parseInt(s)` |
| A method on one specific object. | `logger::info` | `m -> logger.info(m)` |
| An instance method, called on whichever object is passed in. | `String::length` | `s -> s.length()` |
| A constructor. | `ArrayList::new` | `() -> new ArrayList<>()` |

## Lambdas versus anonymous classes {#vs-anonymous}

| | Anonymous class | Lambda |
| --- | --- | --- |
| Works for | Any class or interface. | Functional interfaces only. |
| `this` means | The anonymous object. | The enclosing object. |
| Compiled as | Its own `.class` file. | An `invokedynamic` call, with no extra class file. |
| Can have state (fields) | Yes. | No. |
| Can reuse a local variable name | Yes, because it has its own scope. | No, because it shares the method's scope. |

## Captured variables {#capture}

A lambda may read local variables of the method around it. This is called **capturing** them.

The variables must be **final or effectively final**. Effectively final means the variable is assigned exactly once, even without the `final` keyword.

Why the rule exists:

- The lambda gets a **copy** of the value. If the variable changed later, the lambda would not see the change, and the two would disagree.
- The lambda may run later, on another thread.

```java
BigDecimal limit = new BigDecimal("1000");           // effectively final
list.removeIf(t -> t.amount().compareTo(limit) > 0); // OK

int count = 0;
list.forEach(t -> count++);                           // compile error
```

Instance and static fields work differently. They are not copied. The lambda reads them through `this`, so they can change, and they need normal thread safety.

Try it in the lab: [A lambda captures a value, not a variable](lab:fp-lambda-capture).

## Optional {#optional}

`Optional<T>` is a box that holds one value or is empty. Its purpose is to show in a **return type** that a method may return nothing.

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
| `Optional.of(x)` / `ofNullable(x)` / `empty()` | Create an `Optional`. `of(null)` throws an exception. |
| `map(f)` / `flatMap(f)` / `filter(p)` | Change or test the value, if there is one. |
| `orElse(x)` | Return the value, or `x`. The expression `x` is **always** evaluated. |
| `orElseGet(supplier)` | Return the value, or the supplier's result. The supplier runs only when needed (lazily). |
| `orElseThrow(supplier)` | Return the value, or throw. `orElseThrow()` with no argument throws `NoSuchElementException`. |
| `ifPresent(c)` / `ifPresentOrElse(c, r)` | Run an action. |
| `or(supplier)` (Java 9) | Fall back to another `Optional`. |
| `isPresent()` / `isEmpty()` | Avoid these. Prefer the methods above. |

Guidelines:

- Use `Optional` for **return values** only.
- Do not use it for fields, parameters or collection elements.
- Never return `null` from a method whose return type is `Optional`.
- For "no results", return an empty collection, not an `Optional<List>`.
- Do not call `get()` without checking first.

Try it in the lab: [Optional: empty, present and the lazy fallback](lab:fp-optional).

## Cheat sheet {#cheatsheet}

| Need | Use |
| --- | --- |
| Test something. | `Predicate` |
| Convert something. | `Function` or `UnaryOperator` |
| Do something with a value. | `Consumer` |
| Produce a value, or create it later. | `Supplier` |
| Combine two values. | `BinaryOperator` |
| A result that may be missing. | An `Optional` return type. |
| A lambda that only calls one method. | A method reference. |

## Interview questions {#questions}

### [basic] What is a lambda expression? {#what-is-lambda}

A lambda is a short way to implement a functional interface. It is written as `(parameters) -> body`.

It lets you pass behaviour as a value, without writing an anonymous class. Example: `list.removeIf(a -> a.isClosed())`.

### [basic] What is a functional interface? {#what-is-fi}

An interface with **exactly one abstract method**. Default methods, static methods and the methods of `Object` do not count.

You can use a lambda or a method reference wherever a functional interface is expected. `@FunctionalInterface` makes the compiler enforce the rule.

### [basic] Name the four main functional interfaces and what each does. {#four-main}

1. **`Predicate<T>`** takes a T and returns a boolean.
2. **`Function<T,R>`** takes a T and returns an R.
3. **`Consumer<T>`** takes a T and returns nothing.
4. **`Supplier<T>`** takes nothing and returns a T.

There are variants. `BiFunction` takes two arguments. `UnaryOperator` and `BinaryOperator` return the same type they take. `IntPredicate` and `ToIntFunction` work with primitives.

### [basic] What is a method reference, and what are its four kinds? {#method-ref-q}

A method reference is a shorter way to write a lambda that only calls an existing method. The four kinds:

1. **A static method:** `Integer::parseInt`.
2. **A method on one specific object (bound):** `logger::info`.
3. **An instance method of whichever object is passed in (unbound):** `String::length`.
4. **A constructor:** `ArrayList::new`.

### [basic] What is Optional and why was it introduced? {#optional-q}

`Optional` is a box for a value that may be missing. It was designed as a **return type**.

It forces the caller to handle "nothing found", instead of forgetting a `null` check. Methods such as `map`, `filter`, `orElse` and `orElseThrow` handle both cases without `if` statements.

### [basic] What is the difference between orElse and orElseGet? {#orelse-vs-orelseget}

- **`orElse(x)`** always evaluates `x`, even when the `Optional` has a value. So an expensive expression, or one with side effects, runs for nothing.
- **`orElseGet(supplier)`** runs the supplier only when the `Optional` is empty.

Use `orElseGet` unless the fallback is a constant.

### [basic] What does "effectively final" mean? {#effectively-final}

It is a local variable that is never assigned again after its first assignment, even without the `final` keyword.

Lambdas and inner classes may only capture local variables that are final or effectively final.

### [basic] Can a lambda change a local variable of the enclosing method? {#modify-local}

**No.** It is a compile error: "local variables referenced from a lambda expression must be final or effectively final".

A lambda can change fields. It can also change an object that the variable points to, such as a list or an `AtomicInteger`. But changing shared state from a lambda is a design smell, and in parallel code it is a data race.

### [intermediate] Where should Optional not be used? {#optional-misuse}

`Optional` is meant only for the return values of methods that may have no result. Do not use it:

- **For fields.** It is not `Serializable`, and it adds an extra object for each field.
- **For method parameters.** Overloaded methods or `@Nullable` are clearer.
- **For collection elements.**
- **Instead of an empty collection.**

And never return a `null` `Optional`.

### [intermediate] What is the difference between map and flatMap on Optional? {#map-vs-flatmap}

- **`map(f)`** wraps whatever `f` returns. If `f` itself returns an `Optional`, you get an `Optional<Optional<T>>`.
- **`flatMap(f)`** expects `f` to return an `Optional`, and does not wrap it again.

Use `flatMap` when the next step can also find nothing. Example: `find(id).flatMap(this::findBranch)`.

### [intermediate] How are lambdas different from anonymous inner classes? {#lambda-vs-anon}

A lambda:

- works only for functional interfaces,
- has no state and no identity of its own,
- uses `this` for the enclosing object,
- cannot reuse the name of a local variable,
- compiles to an `invokedynamic` call, not a separate class file, so it is lighter to load.

An anonymous class can implement any interface or extend a class, and it can have fields. Its `this` is the anonymous object itself.

### [intermediate] How do you compose predicates and functions? {#compose}

- **`Predicate`** has `and`, `or`, `negate` and `Predicate.not`.
- **`Function`** has `andThen` (run this one, then that one) and `compose` (run that one, then this one).
- **`Comparator`** has `thenComparing` and `reversed`.

So you can build behaviour from small named pieces, for example `isActive.and(hasFunds.negate())`.

### [intermediate] Do lambdas capture values or variables? {#capture-q}

**Values.** A lambda captures a copy of the local variable's value when the lambda is created. That is why locals must be effectively final.

Fields are different. The lambda captures `this`, and reads the current field value each time it runs.

### [intermediate] What is a closure in Java terms? {#closure}

A **closure** is a function together with the variables it captured from the code around it.

Java lambdas are closures over effectively final local variables. They are less flexible than closures in languages that capture changeable variables by reference.

### [intermediate] What is currying, and how would you write it with functional interfaces? {#currying}

**Currying** turns a function of several arguments into a chain of functions that each take one argument.

In Java: `Function<BigDecimal, Function<BigDecimal, BigDecimal>> add = a -> b -> a.add(b);`, then call `add.apply(x).apply(y)`.

It is rarely needed in everyday Java. But it shows that functions are values that you can return.

### [intermediate] Can a functional interface have more than one method? {#fi-methods}

**Yes, but only one abstract method.** It can have many default and static methods. It can also redeclare `Object` methods such as `equals`.

`Comparator` is functional, even though it declares `equals` and many default methods.

### [intermediate] What happens if a lambda throws a checked exception? {#checked-exceptions}

The standard functional interfaces do not declare checked exceptions. So the code inside the lambda must catch them, or wrap them, for example in an `UncheckedIOException`.

Other options: use `Callable`, which may throw, or write your own functional interface whose method declares `throws Exception`.

### [deep] How are lambdas implemented at the bytecode level? {#invokedynamic}

1. The compiler moves the lambda body into a private generated (**synthetic**) method.
2. It writes an `invokedynamic` instruction where the lambda is used.
3. The first time that line runs, `LambdaMetafactory` generates a class that implements the functional interface and calls that method. The call site is then linked to it.

A lambda that captures nothing can be one shared object. A lambda that captures values creates an object that holds those values.

### [deep] Why can't you assign a lambda to Object or use var with it? {#target-typing}

A lambda has no type of its own. It takes its type from the place where it is used, and that place must be a functional interface.

- `Object o = () -> {};` fails, because `Object` is not a functional interface.
- `var f = () -> {};` fails, because there is nothing to take the type from.

A cast such as `(Runnable) () -> {}`, or a typed variable, gives the lambda its type.

### [deep] What is a "pure function" and why does it matter for streams? {#pure}

A **pure function** has two properties:

1. Its result depends only on its arguments.
2. It has no side effects: it changes no outside state and does no I/O.

Pure lambdas are safe to run in any order, to repeat, and to run in parallel. Stream operations assume this. Side effects inside `map` or `filter` are a common cause of bugs and race conditions.

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

`Predicate<? super T>` also accepts a predicate written for a supertype of `T`. The standard library version is `stream().filter(...)`.

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

Each `map` is skipped as soon as something is empty. A `null` result also counts as empty, because `map` turns a `null` into an empty `Optional`.

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

`FeeRule` has one abstract method, so lambdas work with it. The default method combines rules, in the same way as `Predicate.and`.
