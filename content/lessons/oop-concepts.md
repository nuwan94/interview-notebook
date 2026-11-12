---
title: Object-oriented programming — the concepts behind the pillars
slug: oop-concepts
summary: Classes and objects, encapsulation, abstraction, inheritance and polymorphism, interfaces vs abstract classes, composition, enums, records and sealed types, with warehouse and e-commerce examples in Java, animations and interview questions.
tags: [OOP, Design, Java]
order: 6
topic: Fundamentals / OOP
updated: 2026-11-12
subnav: true
---

"Explain the four pillars of OOP" is the opening question of countless interviews, and the follow-ups are what separate a memorised answer from understanding: *what is the difference between abstraction and encapsulation? Why prefer composition? Which method runs here?* This lesson explains the ideas in plain language, uses a small **e-commerce and warehouse** model (products, orders, stock) for every example, and ends with questions and code exercises. The animation shows the part people most often get wrong: which method actually runs.

```demo
name: oop-walk
```

> **One sentence to remember:** *object-oriented design is about putting data and the rules for changing it together (encapsulation), depending on promises rather than details (abstraction), reusing and varying behaviour (inheritance and polymorphism), and keeping each piece small enough to change on its own.*

## Objects and classes {#objects}

### Class and object {#class-object}

A **class** is a blueprint: it declares what data something has (fields) and what it can do (methods). An **object** is one instance built from that blueprint, living on the heap, with its own copy of the fields. Every object has three things:

- **State:** the current values of its fields (a product's price, an order's status).
- **Behaviour:** the methods that read or change that state.
- **Identity:** it is distinct from every other object, even one with the same state. `==` compares identity; `equals()` compares meaning (see [the equals and hashCode contract](lesson:java-hashmap#contract)).

```java
class Product {
    private final String sku;
    private long priceCents;                 // state

    Product(String sku, long priceCents) {   // constructor: builds a valid object
        this.sku = sku;
        this.priceCents = priceCents;
    }

    long price() { return priceCents; }       // behaviour
}

Product a = new Product("SKU-1", 500);
Product b = new Product("SKU-1", 500);       // same state, different identity: a == b is false
```

Variables of a class type hold a **reference**, not the object itself, so copying the variable copies the pointer. See [where objects live](lesson:java-memory-model#where-things-live) and why Java is [pass by value](lesson:java-memory-model#pass-by-value).

### Static versus instance members {#static}

An **instance** member belongs to one object. A **static** member belongs to the class and exists once, shared: a counter, a constant, a factory method. Static methods cannot use `this`, cannot be overridden (only hidden), and make code harder to test and replace, so keep them for stateless utilities and constants.

### Constructors and this {#constructors}

A constructor has the class name and no return type. It runs once when the object is created and should leave the object in a **valid state** (an order with no customer should not be creatable). Rules worth knowing:

- If you declare no constructor, the compiler adds a no-argument one. Declare any constructor and that default disappears.
- `this(...)` calls another constructor of the same class; `super(...)` calls a parent constructor. Either must be the first statement (Java 25 relaxed this: statements that do not use `this` may now come before `super(...)`, see [flexible constructor bodies](lesson:java-version-history#java-25)).
- Constructors are **not inherited**.
- `this` is the current object, used to tell a field from a parameter of the same name or to pass the object on.

### Initialization order {#init-order}

When you write `new FrozenItem()`, a parent is always built before its child. The order is:

1. The class is loaded, and its `static` fields and static blocks run (parent class first, once only).
2. Memory is allocated and every field gets its default (0, `false`, `null`).
3. The constructor starts. Its first step is `super(...)`, so the parent constructor runs completely first, including the parent's field initialisers.
4. Back in the child: its field initialisers and instance blocks run, in the order they are written, and then the rest of the constructor body.

The third animation scene shows it. A consequence: **never call an overridable method from a constructor**. The parent constructor runs before the child's fields are set, so the child's override can see `null` or 0 where it expects real values.

### The Object class {#object-class}

Every class extends `Object`, which gives all objects `equals`, `hashCode`, `toString`, `getClass`, `clone` and the monitor methods `wait`/`notify`. Override `toString` for readable logs, and `equals` and `hashCode` **together** for value objects. Do not override `clone` (a flawed design; use a copy constructor) or `finalize` (deprecated for removal, see [finalizers](lesson:garbage-collector#references)).

## The four pillars {#pillars}

### Encapsulation {#encapsulation}

**Encapsulation** means bundling data with the code that works on it, and **hiding the internals** so the object can protect its own rules (its invariants). Outsiders talk to the object through its methods, not by reaching into its fields.

```java
// Weak: anyone can break the rule
class Stock { public int quantity; }
stock.quantity = -5;                         // nothing stops this

// Strong: the object guards its rule
class Stock {
    private int quantity;
    void remove(int n) {
        if (n <= 0 || n > quantity) throw new IllegalArgumentException("bad quantity");
        quantity -= n;
    }
    int quantity() { return quantity; }
}
```

Java's access modifiers are the tool:

| Modifier | Visible to |
| --- | --- |
| `private` | the same class only |
| *(none)*, package-private | classes in the same package |
| `protected` | the same package and subclasses |
| `public` | everyone |

Useful guidelines:

- Make fields `private` and expose the smallest interface that works.
- A getter and setter for every field is **not** encapsulation, it is a public field with extra typing. Prefer methods that express intent (`order.cancel()` instead of `order.setStatus(CANCELLED)`): *tell, don't ask*.
- Never hand out a **mutable internal object**: return a copy or an unmodifiable view (`List.copyOf(items)`), and copy mutable arguments in the constructor (a **defensive copy**).
- The strongest encapsulation is **immutability**: an object that cannot change cannot be put in an invalid state, and can be shared across threads freely ([see thread-safety patterns](lesson:java-concurrency#patterns)).

### Abstraction {#abstraction}

**Abstraction** means exposing *what* something does and hiding *how*, so callers depend on a simple concept rather than on details. In Java you create abstractions with **interfaces** and **abstract classes**:

```java
interface PaymentGateway {                          // the abstraction: what callers need
    Receipt charge(Money amount, Card card);
}

class StripeGateway implements PaymentGateway { /* details of the HTTP calls */ }
class FakeGateway   implements PaymentGateway { /* used in tests */ }
```

The checkout code uses `PaymentGateway` and does not care which one it gets. This is what lets you swap implementations, test without the network and change the details later.

**Abstraction versus encapsulation**, a very common question: abstraction is about the **design** level, choosing which behaviour to show (the interface); encapsulation is about the **implementation** level, protecting data and hiding the internals (private fields and invariants). Abstraction hides *complexity*; encapsulation hides *data*. They work together.

### Inheritance {#inheritance}

**Inheritance** lets a class (the subclass) reuse and extend another (the superclass) with `extends`, forming an **is-a** relationship:

```java
class Product {
    long price() { return basePrice; }
    String describe() { return "Product " + sku; }
}

class PerishableProduct extends Product {
    @Override long price() { return isNearExpiry() ? basePrice / 2 : basePrice; }
}
```

- A subclass inherits non-private members, can add its own, and can **override** methods.
- Java has **single inheritance** of classes (one `extends`) but a class may implement many interfaces.
- `super.method()` calls the parent's version; `super(...)` calls its constructor.
- `final` on a class prevents subclassing, on a method prevents overriding.
- Use inheritance only for a true *is-a* relationship that also behaves correctly wherever the parent is expected (the [Liskov substitution principle](lesson:solid-principles#lsp)). Otherwise use composition.

Inheritance is the most overused feature in OOP. It creates the tightest coupling there is: a subclass depends on the parent's *implementation*, so a change to the parent can break children (the **fragile base class** problem). See [composition](lesson:oop-concepts#composition).

### Polymorphism {#polymorphism}

**Polymorphism** ("many forms") means one call, different behaviour depending on the object. There are two kinds:

- **Overriding (runtime polymorphism, dynamic dispatch):** a subclass redefines a method, and the version that runs is chosen from the **actual class of the object** when the call executes.
- **Overloading (compile-time polymorphism):** several methods in one class share a name but differ in their parameter lists, and the compiler picks one from the **declared types of the arguments**.

```java
Product p = new PerishableProduct("milk");   // declared type Product, actual type PerishableProduct
p.price();                                    // runs PerishableProduct.price(): decided at run time
```

The payoff: code written against the general type works with every subtype, including ones written later, so you replace `if (type == X) ... else if (type == Y)` chains with one polymorphic call:

```java
// before: every new product type means editing this method
double shipping(Product p) {
    if (p instanceof Perishable) return 9.0;
    else if (p instanceof Bulky) return 15.0;
    else return 4.0;
}

// after: each class knows its own cost; adding a type adds a class and changes nothing here
double shipping(Product p) { return p.shippingCost(); }
```

#### Rules for overriding {#overriding-rules}

- Same name and parameter types; the return type may be a **subtype** (covariant return).
- The access level may be widened but never narrowed (a `public` method cannot become `protected`).
- It may not throw broader checked exceptions.
- `static`, `private` and `final` methods cannot be overridden (a static method with the same signature **hides** the parent's).
- **Fields are never polymorphic:** a field with the same name in the subclass hides the parent's field, and the declared type decides which one you see.
- Always write `@Override`, so the compiler tells you if you did not really override anything.

#### How the call is dispatched {#dispatch}

At **compile time** the compiler checks that the *declared* type has the method, and picks the overload. At **run time** the JVM looks for an override starting at the *actual* class and walking up (HotSpot speeds this up with a per-class table of virtual methods, a **vtable**, and the JIT often inlines calls that always hit one class). The first animation scene shows the search, the second contrasts overloads and overrides. Bytecode uses `invokevirtual` for class methods and `invokeinterface` for interface methods, `invokespecial` for constructors and `super` calls (and for private methods before Java 11), and `invokestatic` for static methods.

## Interfaces and abstract classes {#interfaces}

Both define a contract that subclasses fulfil, and neither can be instantiated directly. They differ in what they can hold and how they combine:

| | Interface | Abstract class |
| --- | --- | --- |
| Instance state (fields) | no (only `public static final` constants) | yes |
| Constructors | no | yes (called by subclasses) |
| Method bodies | `default`, `static` and (Java 9) `private` methods | any methods, plus abstract ones |
| How many can a class use | **implement many** | **extend one** |
| Expresses | a capability or role ("can be shipped") | a partial implementation shared by related classes |
| Member visibility | methods are `public` | any modifier |

**Default methods** (Java 8, see [Java 8](lesson:java-version-history#java-8)) let an interface gain a method without breaking its implementers, which is how `List.sort` and `Collection.stream` were added. If a class inherits the same default method from two interfaces, it does not compile until the class overrides it (it can pick one with `Shippable.super.label()`). Rule of thumb: a method in a **class** always beats an interface default, and the **more specific** interface beats a less specific one.

**Which to choose:** start with an interface. Use an abstract class when subclasses share real state or a template of steps (the **template method** [pattern](lesson:design-patterns#template-method)). Many designs use both: an interface for the contract and an abstract base class that provides most of the implementation.

A **marker interface** (`Serializable`) has no methods and only tags a class; annotations have mostly replaced the idea for new code.

## Composition over inheritance {#composition}

**Composition** means building a class by holding other objects and delegating to them: a **has-a** relationship. It is the preferred way to reuse behaviour because the parts are replaceable and only their public interface is depended on.

```java
// Inheritance: a new class for every combination, fixed at compile time
class FrozenOrder extends Order { /* ... */ }
class FrozenExpressOrder extends FrozenOrder { /* ... */ }

// Composition: behaviour is a part you plug in
class Order {
    private final ShippingPolicy shipping;    // an interface
    private final DiscountPolicy discount;    // an interface

    Order(ShippingPolicy shipping, DiscountPolicy discount) { ... }

    Money total() { return discount.apply(subtotal()).plus(shipping.cost(this)); }
}
```

Why composition wins:

- **Flexibility:** you can change a part at run time, and combine parts freely without a subclass for every combination.
- **No fragile base class:** the classic example is a counting set that extends `HashSet` and overrides `add` and `addAll`; because `HashSet.addAll` calls `add` internally, items get counted twice. A class that *wraps* a set and delegates does not depend on such details.
- **Easy testing:** inject a fake part.
- **Encapsulation:** a subclass sees its parent's protected internals, a composing class sees only the public interface.

Use inheritance when the relationship is truly *is-a*, you control the base class and it was **designed for extension** (documented, with few overridable methods). Otherwise "design and document for inheritance or else prohibit it" (make it `final`).

## Design principles and patterns {#solid}

Two topics grew big enough to get their own lessons:

- **[SOLID and design principles](lesson:solid-principles)**: single responsibility, open/closed, Liskov substitution, interface segregation and dependency inversion, plus DRY, KISS, YAGNI, the Law of Demeter, coupling and cohesion.
- **[Design patterns](lesson:design-patterns)**: Singleton, Factory, Builder, Adapter, Decorator, Proxy, Strategy, Observer, Template Method and more, with Java and Spring examples.

Read this lesson first: they build on classes, abstraction, inheritance, polymorphism and composition.

## Modern Java for object design {#modern-java}

### Records {#records}

A **record** (Java 16, see [Java 16](lesson:java-version-history#java-16)) is an immutable data carrier with the constructor, accessors, `equals`, `hashCode` and `toString` written for you. Use it for value objects and DTOs. A record is `final`, cannot extend a class (it can implement interfaces) and may validate in a compact constructor:

```java
record Money(long cents, String currency) {
    Money {                                              // compact constructor
        if (cents < 0) throw new IllegalArgumentException("negative amount");
    }
    Money plus(Money other) { return new Money(cents + other.cents, currency); }
}
```

### Enums with behaviour {#enums}

An `enum` is a fixed set of singleton constants, and each can carry fields and behaviour or implement an interface. It is the neat replacement for the "type code plus switch" pattern, and the safest singleton:

```java
enum ShippingMethod implements ShippingPolicy {
    STANDARD(4_00) { public long cost(Order o) { return base; } },
    EXPRESS(9_00)  { public long cost(Order o) { return base + 2 * o.itemCount(); } };

    protected final long base;
    ShippingMethod(long base) { this.base = base; }
}
```

### Sealed hierarchies and pattern matching {#sealed}

**Sealed** classes and interfaces (Java 17) list exactly their permitted subtypes, so a hierarchy is *closed*. Together with pattern matching for `switch` (Java 21) the compiler checks that every case is handled:

```java
sealed interface PaymentResult permits Approved, Declined, Pending {}
record Approved(String receipt) implements PaymentResult {}
record Declined(String reason) implements PaymentResult {}
record Pending(String ticket) implements PaymentResult {}

String message(PaymentResult r) {
    return switch (r) {
        case Approved a -> "Paid: " + a.receipt();
        case Declined d -> "Refused: " + d.reason();
        case Pending p  -> "Waiting: " + p.ticket();      // no default needed: adding a subtype breaks the build here
    };
}
```

This is the opposite trade-off to open polymorphism: use an *open* hierarchy with virtual methods when you expect new types, and a *sealed* one when the set of cases is fixed and you want the compiler to check you handle them all. See [sealed classes in Java 17](lesson:java-version-history#java-17) and [pattern matching in Java 21](lesson:java-version-history#java-21).

### Nested classes {#nested}

| Kind | Notes |
| --- | --- |
| **Static nested class** | an ordinary class placed inside another for grouping; no hidden reference to the outer object |
| **Inner class** (non-static) | holds a hidden reference to its enclosing instance. It can read the outer fields, but it also **keeps the outer object alive**, a common cause of [memory leaks](lesson:java-memory-model#leaks) |
| **Local / anonymous class** | declared inside a method; can capture effectively final locals |
| **Lambda** | not a class of its own in the source; `this` inside a lambda is the enclosing object, unlike an anonymous class |

Prefer a static nested class unless you truly need the outer instance.

## Common pitfalls {#pitfalls}

| Pitfall | Why it hurts | Fix |
| --- | --- | --- |
| Public mutable fields | anyone can break an invariant | private fields, intention-revealing methods |
| Returning internal collections | callers can mutate your state | `List.copyOf`, unmodifiable views |
| Calling overridable methods in constructors | the child's fields are not set yet | call only `private`/`final` methods |
| Deep inheritance trees | hard to follow, tightly coupled | composition, interfaces |
| `equals` across a hierarchy | symmetry breaks when a subclass adds state | `final` value classes, records, or composition |
| `instanceof` chains on type | every new type means editing the chain | polymorphism, or a sealed type with pattern `switch` |
| Anemic domain model | objects with only getters and setters, logic scattered in "services" | put the rules in the entity (`order.cancel()`) |
| God class | one class doing everything | split by responsibility |
| Inheritance for code reuse only | no real is-a relationship | composition |

## Cheat sheet {#cheatsheet}

| Question | Short answer |
| --- | --- |
| Four pillars? | encapsulation, abstraction, inheritance, polymorphism |
| Abstraction vs encapsulation? | abstraction hides complexity (the contract); encapsulation hides data and guards invariants |
| Overload vs override? | overload: same name, different parameters, chosen at compile time; override: same signature in a subclass, chosen at run time |
| Interface vs abstract class? | interface: capability, many allowed, no instance state; abstract class: shared state and partial implementation, only one |
| Can you override a static or private method? | no (static is hidden, private is not visible) |
| Is a constructor inherited? | no |
| Which runs first, parent or child constructor? | parent |
| Is Java single or multiple inheritance? | single for classes, multiple for interfaces |
| Is/has? | inheritance is *is-a*, composition is *has-a* |
| Fields polymorphic? | no, only instance methods |

## Interview questions {#questions}

### [basic] What are the four pillars of OOP? {#four-pillars}

**Encapsulation** bundles data with the methods that act on it and hides the internals behind a controlled interface. **Abstraction** exposes what something does and hides how, using interfaces and abstract classes. **Inheritance** lets a class reuse and extend another (an is-a relationship). **Polymorphism** lets the same call behave differently depending on the object's actual type, through overriding and overloading. Be ready to give a one-line example of each; the warehouse examples in this lesson work.

### [basic] What is the difference between a class and an object? {#class-vs-object}

A class is the blueprint that defines fields and methods; an object is one instance of it, created with `new`, living on the heap with its own state, and identified by its own reference. One class can have many objects. Two objects of the same class with equal field values are still different objects (`==` is false), which is why `equals()` exists.

### [basic] What is encapsulation, and how do you achieve it in Java? {#encapsulation-q}

Hiding an object's internal state and exposing behaviour through methods, so the object can enforce its own rules. In Java: `private` fields, a minimal public interface, validation in constructors and methods, defensive copies of mutable data, and ideally immutability. Public getters and setters for every field are not real encapsulation; prefer methods that express behaviour.

### [basic] What is the difference between abstraction and encapsulation? {#abstraction-vs-encapsulation}

Abstraction is about **what** the user sees: a simplified contract (an interface) that hides complexity, for example `PaymentGateway.charge()`. Encapsulation is about **how** the data is protected: private fields and methods that guard invariants. Abstraction works at design level and encapsulation at implementation level; an abstraction is usually implemented by encapsulated classes.

### [basic] What is inheritance, and what are its drawbacks? {#inheritance-q}

A subclass acquires the fields and methods of a superclass with `extends`, reusing code and modelling is-a relationships. The drawbacks: it is the strongest coupling between classes (a subclass depends on its parent's implementation, the fragile base class problem), it exposes internals through `protected`, deep hierarchies are hard to understand, and Java allows only one superclass. Use it only for a real is-a relationship that behaves correctly wherever the parent is expected ([Liskov substitution](lesson:solid-principles#lsp)); otherwise prefer composition.

### [basic] What is polymorphism? Explain compile-time and run-time polymorphism. {#polymorphism-q}

One interface, many behaviours. **Compile-time polymorphism** is overloading: methods with the same name and different parameters, resolved by the compiler from the declared argument types. **Run-time polymorphism** is overriding: a subclass redefines a method, and the JVM picks the version from the **actual** object's class at call time (dynamic dispatch). Run-time polymorphism lets code written against a supertype work with any subtype, including future ones.

### [basic] What is the difference between method overloading and overriding? {#overload-vs-override}

Overloading: same name, **different parameter lists**, in one class (or between a class and its parent), resolved at **compile time** from the declared types. Overriding: **same signature** in a subclass, replacing the parent's behaviour, resolved at **run time** from the actual type. Overriding needs inheritance, may use a covariant return type, cannot reduce visibility or throw broader checked exceptions, and does not apply to `static`, `private` or `final` methods. Use `@Override`.

### [basic] What is the difference between an abstract class and an interface? {#abstract-vs-interface}

An interface is a contract of capabilities: no instance state or constructors, methods are public, and a class can implement many. Since Java 8 it can have `default` and `static` methods, and since Java 9 `private` ones. An abstract class can have fields, constructors, any visibility and partial implementation, but a class can extend only one. Choose an interface for a capability or role, an abstract class for closely related classes that share state or a skeleton algorithm, and often both together.

### [basic] Can you override a static or private method? What about a constructor? {#override-static}

No to all. A `private` method is not visible to the subclass, so a same-named method there is a new method. A `static` method belongs to the class, so a same-signature static method in a subclass **hides** the parent's and is chosen by the declared type, not by the object. Constructors are not inherited at all, so they cannot be overridden; a subclass calls them with `super(...)`.

### [basic] What is the difference between this and super? {#this-vs-super}

`this` is the current object (used for its fields, for calling another constructor with `this(...)`, or to pass the object on). `super` refers to the parent-class part of the current object: `super.method()` calls the parent's version of an overridden method, and `super(...)` calls a parent constructor. Both constructor forms must be the first statement.

### [basic] What does final do on a variable, a method and a class? {#final-q}

`final` variable: it can be assigned only once (a final reference still allows the object to change). `final` method: it cannot be overridden. `final` class: it cannot be subclassed (`String`, records, wrapper classes). Final fields also have special visibility guarantees across threads ([see final fields](lesson:java-memory-model#final-jmm)).

### [basic] What are the access modifiers in Java? {#access-modifiers}

`private` (same class), package-private (no keyword, same package), `protected` (same package and subclasses) and `public` (everywhere). Prefer the narrowest level that works. Note that `protected` also grants access to the whole package, and that top-level classes can only be public or package-private.

### [intermediate] How do you create an immutable class in Java? {#immutable-class}

Make the class `final` (or all constructors private), make all fields `private final`, provide no setters, set everything in the constructor, **copy mutable arguments** on the way in and **copy or wrap them on the way out**, and do not let `this` escape from the constructor. Or use a record, being careful if it holds a mutable component. Immutable objects are thread-safe, can be shared freely and are ideal map keys, which is why `String` and `Integer` are immutable.

### [intermediate] What is the order of initialization when you create an object? {#init-order-q}

Class loading: static fields and blocks, parent class first, once. Then for each `new`: fields get default values, then the constructor runs, which starts with `super(...)` so the parent's field initialisers and constructor complete first; then the child's field initialisers and instance blocks run in textual order, and then the rest of the child's constructor body. So parent before child, always. This is why an overridable method called from a parent constructor can see uninitialised child fields.

### [intermediate] Why is calling an overridable method from a constructor a bad idea? {#ctor-overridable}

Because of the initialization order: the parent constructor runs **before** the child's fields are initialised. If the parent constructor calls a method the child overrides, the child's version runs on a half-built object and may see `null` or 0 instead of the values it expects, producing baffling bugs. Only call `private`, `final` or `static` methods from a constructor, or use a factory method / `init` step after construction.

### [intermediate] Why prefer composition over inheritance? {#composition-q}

Composition reuses behaviour by delegating to a held object, so it depends only on that object's public interface, can swap parts at run time, avoids a class explosion (one subclass per combination), and is easy to test with fakes. Inheritance ties the subclass to the parent's implementation (the fragile base class), is fixed at compile time and breaks encapsulation. The standard demonstration is a set that extends `HashSet` to count additions and double-counts because `addAll` calls `add`. Use inheritance only for a true is-a relationship on a class designed for extension.

### [intermediate] What is the diamond problem, and how does Java handle it? {#diamond}

With multiple inheritance, a class could inherit the same member from two parents with no clear winner. Java avoids it for state and implementation by allowing only **single inheritance of classes**. With interfaces and default methods (Java 8) a conflict can still occur: if two interfaces provide the same default method, the implementing class **must override it** and may choose one with `InterfaceName.super.method()`. A class method always wins over an interface default, and a more specific interface wins over a less specific one.

### [intermediate] What are covariant return types? {#covariant}

An overriding method may declare a return type that is a **subtype** of the parent's. For example `Product copy()` can be overridden by `PerishableProduct copy()`, so callers of the subclass need no cast. The compiler generates a hidden **bridge method** with the original signature so run-time dispatch still works.

### [intermediate] How does Java decide which overloaded method to call? {#overload-resolution}

At compile time, from the declared types of the arguments, in phases: first by exact match or primitive **widening**, then by **boxing/unboxing**, and last with **varargs**. The most specific applicable method wins. So `print(5)` with `print(long)` and `print(Integer)` calls `print(long)` (widening beats boxing), and a `Product`-typed variable holding a `Perishable` selects `print(Product)` even though the object is a `Perishable`. If two methods are equally specific the call is ambiguous and does not compile.

### [intermediate] What are the types of nested classes, and what is the memory-leak risk of inner classes? {#nested-q}

Static nested, inner (non-static), local and anonymous classes. An **inner** class instance holds an implicit reference to its enclosing object, so a long-lived inner object (a listener, a cached task) keeps the whole outer object alive and can leak memory. Prefer static nested classes, or lambdas that capture only what they need. In an anonymous class `this` is the anonymous object; in a lambda it is the enclosing object.

### [intermediate] When would you use a record, an enum or a sealed interface? {#modern-types}

A **record** for an immutable value or DTO (`Money`, `OrderLine`). An **enum** for a fixed set of constants that may carry data and behaviour (status, shipping method), and as a safe singleton. A **sealed interface** with records for a closed set of alternatives (a payment result: approved, declined, pending) so that a pattern `switch` is checked for completeness. Use ordinary classes and interfaces with open polymorphism when new variants are expected.

### [deep] How does the JVM implement dynamic dispatch? {#vtable}

Each class has a table of its virtual methods (a **vtable**). An override replaces the parent's entry at the same index, so `invokevirtual` can find the code with one lookup at a known offset, whatever the actual class. Interface calls (`invokeinterface`) use a slower search through an interface table, because a method has no fixed offset across unrelated classes. The JIT makes it cheap: with **class hierarchy analysis** and **inline caches** it can prove a call site only ever sees one (monomorphic) or two (bimorphic) classes and inline the target, guarding with a cheap type check. This is why virtual calls are usually not a performance problem in Java.

### [deep] What is the fragile base class problem? {#fragile-base}

A change to a superclass that looks safe breaks subclasses, because they depend on its implementation, not just its contract. For example, if `addAll` in a base collection stops calling `add`, a subclass that counted items by overriding `add` now undercounts. Because a subclass inherits implementation details (which methods call which), inheritance across code you do not control is risky. Mitigations: composition and delegation, making classes `final` unless designed and documented for extension, keeping overridable methods few and documenting "self-use".

### [deep] Why is implementing equals tricky in a class hierarchy? {#equals-hierarchy}

`equals` must be symmetric and transitive. If `Point` defines equality by x and y and `ColorPoint extends Point` adds a colour, then `point.equals(colorPoint)` can be true while `colorPoint.equals(point)` is false (or the reverse), breaking symmetry, and using `instanceof` leaves it unfixable. Using `getClass()` for comparison restores the contract but violates [Liskov substitution](lesson:solid-principles#lsp). There is no way to extend an instantiable class and add a value component while keeping the `equals` contract: favour composition (a `ColorPoint` that *has* a `Point`), a `final` class or a record. See the [contract in the HashMap lesson](lesson:java-hashmap#contract).

### [deep] What is an anemic domain model, and why do people criticise it? {#anemic}

A model whose entities contain only fields with getters and setters, while all the business rules sit in separate "service" classes that read and write the data. It looks like OOP but is procedural code: invariants are not protected (any service can set any field), rules are scattered and duplicated, and entities can be in invalid states. A **rich** domain model puts behaviour next to the data it guards (`order.cancel()`, `stock.reserve(n)`), which is the original intent of encapsulation. In practice, keep thin services for orchestration (transactions, calling other systems) and put the rules in the domain objects.

### [coding] Replace the type checks with polymorphism. {#coding-polymorphism}

```java
double shippingCost(Item item) {
    if (item.getType().equals("PERISHABLE")) {
        return 9.0 + item.getWeight() * 0.5;
    } else if (item.getType().equals("BULKY")) {
        return 15.0 + item.getVolume() * 2.0;
    } else {
        return 4.0;
    }
}
```

Each new type means editing this method and the string comparisons are error-prone. Move the rule to the type:

```java
sealed interface Item permits PerishableItem, BulkyItem, StandardItem {
    double shippingCost();
}

record PerishableItem(double weight) implements Item {
    public double shippingCost() { return 9.0 + weight * 0.5; }
}
record BulkyItem(double volume) implements Item {
    public double shippingCost() { return 15.0 + volume * 2.0; }
}
record StandardItem() implements Item {
    public double shippingCost() { return 4.0; }
}

// caller: item.shippingCost();
```

A new item type is a new class; the caller is unchanged. If you expect third parties to add types, drop `sealed`; if the set is closed and you want the compiler to enforce handling, keep it.

### [coding] What does this print? {#coding-init-order}

```java
class Product {
    Product() { System.out.println("Product, label=" + label()); }
    String label() { return "base"; }
}

class FrozenItem extends Product {
    private String tag = "frozen";
    FrozenItem() { System.out.println("FrozenItem, tag=" + tag); }
    @Override String label() { return tag; }
}

new FrozenItem();
```

It prints `Product, label=null` and then `FrozenItem, tag=frozen`. The `FrozenItem` constructor starts by calling the `Product` constructor, which calls the **overridden** `label()` through dynamic dispatch, but `tag` has not been initialised yet (its initialiser runs after `super()` returns), so it still has its default value `null`. The fix is not to call overridable methods from a constructor.

### [coding] This immutable-looking class is not immutable. Fix it. {#coding-immutable}

```java
public final class Shipment {
    private final String id;
    private final List<String> skus;
    private final Date shippedAt;

    public Shipment(String id, List<String> skus, Date shippedAt) {
        this.id = id;
        this.skus = skus;
        this.shippedAt = shippedAt;
    }

    public List<String> getSkus() { return skus; }
    public Date getShippedAt() { return shippedAt; }
}
```

The fields are `final`, but the **objects they refer to are mutable** and are shared with the caller: someone can keep the list passed to the constructor and add to it later, or call `getSkus().add(...)`, or `getShippedAt().setTime(...)`. Copy on the way in and out, and prefer immutable types:

```java
public record Shipment(String id, List<String> skus, Instant shippedAt) {
    public Shipment {
        skus = List.copyOf(skus);            // defensive, unmodifiable copy (also rejects nulls)
    }
}
```

`Instant` is immutable, `List.copyOf` makes the list unmodifiable and independent of the caller's list, and the record supplies accessors, `equals`, `hashCode` and `toString`.
