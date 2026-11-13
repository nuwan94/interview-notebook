---
title: SOLID and design principles
nav: SOLID principles
slug: solid-principles
summary: The five SOLID principles with a violation and a fix for each, plus DRY, KISS, YAGNI, the Law of Demeter, coupling and cohesion, the code smells that point to them, and when not to apply them, with interview questions.
tags: [OOP, Design, SOLID, Principles]
order: 2
topic: Fundamentals / OOP
updated: 2026-11-12
subnav: true
---

SOLID is a set of five guidelines for keeping object-oriented code easy to change. Interviewers rarely want the five definitions recited; they want to know whether you can **spot a violation in real code** and **fix it without over-engineering**. This lesson gives each principle a short meaning, a bad example, a fix and a way to recognise the problem, using an e-commerce and warehouse model. Press play to watch three of them applied. It assumes the basics from the [OOP concepts lesson](lesson:oop-concepts): abstraction, polymorphism and composition.

```demo
name: solid-walk
```

> **One sentence to remember:** *every principle here is a way to raise cohesion (things that belong together stay together) and lower coupling (things depend on each other as little as possible), so that one change touches one place.*

## Why principles at all {#why}

Code rarely fails because it does not work today; it fails because it is painful to change tomorrow. Three symptoms tell you the design is going bad:

- **Rigidity:** a small change forces edits in many places.
- **Fragility:** a change in one place breaks something unrelated.
- **Immobility:** you cannot reuse a part because it is tangled with everything else (and you cannot test it alone).

SOLID names five common causes of these symptoms and the habit that prevents each. They are guidelines for judgement, not laws: the last section covers when to ignore them.

## The five principles {#principles}

### S: single responsibility {#srp}

**A class should have one reason to change.** Robert Martin's later wording: it should answer to **one actor**, one group of people who would ask for changes. Do not read "responsibility" as "does one tiny thing"; read it as "one axis of change".

```java
// Violation: four different groups of people each ask for changes to this class
class OrderManager {
    Money calculateTotal(Order o) { /* tax and discount rules */ }
    byte[] renderInvoicePdf(Order o) { /* layout */ }
    void sendConfirmationEmail(Order o) { /* SMTP */ }
    void save(Order o) { /* SQL */ }
}
```

Finance changes the tax rules, marketing changes the invoice layout, operations changes the email provider, the database team changes the schema: all four edit the same file, collide, and risk breaking each other.

```java
// Fix: one class per concern, coordinated by a thin service
class Order { Money total() { ... } }                       // rules
class InvoiceRenderer { byte[] render(Order o) { ... } }    // layout
class OrderNotifier { void confirm(Order o) { ... } }       // email
interface OrderRepository { void save(Order o); }           // persistence

class OrderService {
    // constructor takes the four collaborators
    void place(Order o) { repository.save(o); notifier.confirm(o); }
}
```

**How to spot it:** a class name ending in `Manager`, `Helper`, `Util` or `Processor`; imports from unrelated layers (SQL, HTTP and PDF in one file); a class that changes in every pull request; a test that needs five mocks to set up. In a Spring service the classic layering of controller, service and repository is single responsibility applied to a request.

### O: open for extension, closed for modification {#ocp}

**You should be able to add new behaviour without editing existing, working code.** The tools are interfaces and polymorphism: the stable code depends on an abstraction, and new behaviour arrives as a new implementation.

```java
// Violation: every new delivery type edits this method
double shipping(Order o) {
    switch (o.deliveryType()) {
        case STANDARD: return 4.0;
        case EXPRESS:  return 9.0;
        case BULKY:    return 15.0;
        default: throw new IllegalArgumentException();
    }
}
```

```java
// Fix: a new type is a new class, the checkout is untouched
interface ShippingPolicy { double cost(Order o); }
class Standard implements ShippingPolicy { public double cost(Order o) { return 4.0; } }
class Express  implements ShippingPolicy { public double cost(Order o) { return 9.0; } }
class Drone    implements ShippingPolicy { public double cost(Order o) { return 12.0; } }   // added later
```

In Spring this is everyday practice: inject `List<ShippingPolicy>` or a `Map<String, ShippingPolicy>` and new implementations are picked up automatically.

**How to spot it:** long `if/else if` or `switch` chains on a type code, `instanceof` ladders, or an enum that every method switches on. Note the trade-off: use it where change is **likely**. A switch on a closed set that will never grow is fine, and a [sealed hierarchy](lesson:oop-concepts#sealed) with a pattern `switch` is the opposite, deliberate design where the compiler flags every place to update when a case is added.

### L: Liskov substitution {#lsp}

**Objects of a subtype must be usable anywhere the supertype is expected, without the caller noticing a difference.** It is about **behaviour and contracts**, not just matching method signatures.

```java
class Rectangle {
    void setWidth(int w)  { this.width = w; }
    void setHeight(int h) { this.height = h; }
    int area() { return width * height; }
}

class Square extends Rectangle {              // a square "is a" rectangle in geometry...
    @Override void setWidth(int w)  { super.setWidth(w);  super.setHeight(w); }
    @Override void setHeight(int h) { super.setHeight(h); super.setWidth(h); }
}

void resize(Rectangle r) { r.setWidth(5); r.setHeight(4); /* caller expects area 20 */ }
// resize(new Square()) leaves area 16: the subtype broke the promise
```

The rules a subtype must follow, in contract terms:

- It must **not demand more** from callers than the parent did (no stronger preconditions).
- It must **not promise less** than the parent did (no weaker postconditions); it may promise more.
- It must **keep the parent's invariants** and not throw new, unexpected exceptions.

**How to spot it:** an override that throws `UnsupportedOperationException`, an override that does nothing, a subclass that needs an `instanceof` check by callers, or "special case" code that asks "is this really a `Square`?". The JDK itself has a famous case: `Collections.unmodifiableList(...)` returns a `List` whose `add` throws, which surprises code written against `List`. The fix is usually to stop using inheritance for that relationship (use composition, or two separate interfaces such as a read-only `Shape` and a resizable one).

### I: interface segregation {#isp}

**Clients should not be forced to depend on methods they do not use.** Prefer several small, focused interfaces to one large one.

```java
// Violation: a robot cannot eat
interface Worker { void work(); void eat(); void sleep(); }
class Robot implements Worker {
    public void work() { /* ... */ }
    public void eat()  { throw new UnsupportedOperationException(); }   // also an LSP smell
    public void sleep() { throw new UnsupportedOperationException(); }
}
```

```java
// Fix: small interfaces that a class combines as needed
interface Workable { void work(); }
interface Feedable { void eat(); }
interface Restable { void sleep(); }
class Human implements Workable, Feedable, Restable { /* ... */ }
class Robot implements Workable { public void work() { /* ... */ } }
```

In e-commerce: do not make one `ProductService` interface with 40 methods for catalogue, pricing and inventory; a reporting module that only reads prices should depend only on a `PriceLookup`. The JDK gets this right with tiny interfaces (`Runnable`, `Comparable`, `Closeable`, `Supplier`), and gets it wrong with the huge `java.sql.Connection`. **How to spot it:** implementations full of empty or throwing methods, and mocks in tests that must stub methods the code under test never calls.

### D: dependency inversion {#dip}

**High-level code should depend on abstractions, not on concrete low-level classes; both depend on the abstraction.** The "inversion" is that the low-level detail now depends on an interface defined by the high-level code, rather than the other way around.

```java
// Violation: business logic is welded to Stripe
class CheckoutService {
    private final StripeGateway gateway = new StripeGateway();   // concrete class, created inside
    void pay(Order o) { gateway.charge(o.total(), o.card()); }
}
```

```java
// Fix: depend on an interface, receive the implementation from outside
interface PaymentGateway { Receipt charge(Money amount, Card card); }

class CheckoutService {
    private final PaymentGateway gateway;
    CheckoutService(PaymentGateway gateway) { this.gateway = gateway; }   // constructor injection
    void pay(Order o) { gateway.charge(o.total(), o.card()); }
}
// production: new CheckoutService(new StripeGateway());   tests: new CheckoutService(new FakeGateway());
```

Three terms people mix up:

| Term | What it is |
| --- | --- |
| **Dependency inversion** | the *principle*: depend on abstractions |
| **Dependency injection** | the *technique*: pass dependencies in (constructor, setter or field) instead of creating them with `new` |
| **Inversion of control** | the broader idea that a framework controls the flow and wires objects together; Spring's container does injection for you |

**How to spot it:** `new SomeConcreteClass()` deep inside business logic, static calls to infrastructure (`DriverManager.getConnection`, `System.currentTimeMillis()` in rules you want to test), and tests that cannot run without a database or a network. Prefer **constructor injection**: the dependencies are explicit and `final`, and the object is valid after construction.

## The other principles {#other-principles}

| Principle | Meaning | Example |
| --- | --- | --- |
| **DRY** (don't repeat yourself) | each piece of knowledge lives in one place | one tax calculation, not copies in the cart, invoice and report |
| **KISS** (keep it simple) | choose the simplest design that works | a plain method before a plugin framework |
| **YAGNI** (you aren't gonna need it) | do not build for hypothetical future needs | no `PaymentProviderFactoryFactory` for the one provider you have |
| **Composition over inheritance** | reuse by holding and delegating, not extending | an `Order` that has a `ShippingPolicy` ([details](lesson:oop-concepts#composition)) |
| **Law of Demeter** | talk to direct collaborators, not their internals | `order.shippingAddress()` rather than `order.customer().address().city()` |
| **Tell, don't ask** | tell an object to act, do not pull its data out and decide for it | `order.cancel()` instead of `if (order.getStatus() == PAID) order.setStatus(CANCELLED)` |
| **Favour immutability** | objects that cannot change cannot be broken | records, `final` fields ([thread safety](lesson:java-concurrency#patterns)) |
| **Separation of concerns** | different jobs live in different modules | web, domain and persistence layers |

DRY is about *knowledge*, not text: two methods that look alike but change for different reasons should stay separate, because merging them couples unrelated things.

### Coupling and cohesion {#coupling-cohesion}

**Cohesion** is how strongly the parts inside a module belong together. **Coupling** is how strongly modules depend on each other. The goal is **high cohesion and low coupling**. Types of coupling, from worst to best: reaching into another class's internals or shared mutable state; depending on a concrete class; depending on an interface; communicating through events or messages. Almost every principle above is a way to raise cohesion or lower coupling.

## Smells and the principle behind them {#smells}

| Smell | Likely violated principle | Typical fix |
| --- | --- | --- |
| A class that does many unrelated things ("God class") | single responsibility | split by reason to change |
| Editing the same `switch` for every new case | open/closed | polymorphism, strategy |
| Subclass that throws `UnsupportedOperationException` | Liskov, interface segregation | different hierarchy, smaller interfaces |
| Implementing interface methods you do not need | interface segregation | split the interface |
| `new ConcreteService()` inside business code | dependency inversion | inject an interface |
| Long chains of `a.b().c().d()` | Law of Demeter | add a method that does the job on `a` |
| Copy-pasted logic | DRY | extract one method or class |
| Data classes with getters and all logic elsewhere | tell don't ask (anemic model) | move the rules into the entity |
| Abstractions with one implementation "just in case" | YAGNI | delete it until a second case appears |

## Using the principles with judgement {#judgement}

The commonest mistake is not ignoring SOLID, it is **over-applying** it: an interface for every class, factories that build factories, ten tiny classes where one clear method would do. Abstractions have a cost: more files, more indirection, harder to read. Some working rules:

- Introduce an interface when there is a **second implementation** or a **real need to substitute** (a test fake, a payment provider that may change), not on day one.
- Follow the **rule of three**: duplicate once, generalise the third time, when you can see what really varies.
- Apply open/closed where change is **likely**, which you learn from the history of the code.
- A short script or a one-off report does not need dependency injection.

Good design is choosing the right amount of structure for the expected change.

## Cheat sheet {#cheatsheet}

| Letter | Principle | One-line test |
| --- | --- | --- |
| **S** | single responsibility | "Does this class have more than one reason to change?" |
| **O** | open/closed | "Can I add a case without editing existing code?" |
| **L** | Liskov substitution | "Can every subtype stand in for its parent without surprises?" |
| **I** | interface segregation | "Do implementers have to write methods they do not need?" |
| **D** | dependency inversion | "Does business code depend on an interface, or on a concrete detail?" |

## Interview questions {#questions}

### [basic] What is SOLID? {#what-is-solid}

Five object-oriented design principles by Robert Martin: **S**ingle responsibility (one reason to change), **O**pen/closed (open for extension, closed for modification), **L**iskov substitution (subtypes usable wherever the supertype is), **I**nterface segregation (small focused interfaces) and **D**ependency inversion (depend on abstractions). Together they aim at code that is easy to change, test and reuse: high cohesion and low coupling. Be ready to give a short e-commerce example for each.

### [basic] Explain the single responsibility principle with an example. {#srp-q}

A class should have only one reason to change. An `OrderManager` that calculates totals, renders PDF invoices, sends emails and writes to the database changes whenever finance, marketing, operations or the database team want something. Split it into `Order` (rules), `InvoiceRenderer`, `OrderNotifier` and `OrderRepository`, coordinated by a thin `OrderService`. Each can then be understood, tested and changed independently.

### [basic] Explain the open/closed principle. {#ocp-q}

Code should be open to extension but closed to modification: you add behaviour by writing new code, not by editing tested code. Typically a `ShippingPolicy` interface replaces an `if/else` chain on the delivery type, so a new delivery method is a new class, and the checkout does not change. Spring makes this easy by injecting all implementations of an interface.

### [basic] Explain the Liskov substitution principle. {#lsp-q-basic}

If `S` is a subtype of `T`, then objects of type `T` can be replaced with objects of type `S` without breaking the program. The standard violation is `Square extends Rectangle`: setting width and height independently is part of the rectangle's contract, a square cannot honour it, and code expecting area 20 from width 5 and height 4 gets 16. A subtype must not strengthen preconditions, weaken postconditions or throw new exceptions.

### [basic] Explain interface segregation. {#isp-q}

Clients should not depend on methods they do not use, so prefer many small interfaces over one fat one. A `Worker` interface with `work`, `eat` and `sleep` forces `Robot` to implement `eat`. Split it into `Workable`, `Feedable` and `Restable`, and let a class implement the ones it needs. Smells: empty or exception-throwing method implementations.

### [basic] Explain dependency inversion. {#dip-q}

High-level modules should not depend on low-level modules; both should depend on abstractions. A `CheckoutService` that creates a `StripeGateway` with `new` is tied to Stripe. If it depends on a `PaymentGateway` interface instead, the Stripe class implements that interface, so the dependency arrow points from detail to abstraction, and tests can supply a fake.

### [basic] What are DRY, KISS and YAGNI? {#dry-kiss-yagni}

**DRY**: each piece of knowledge has one authoritative place, so a change is made once. **KISS**: prefer the simplest design that works. **YAGNI**: do not build features or abstractions for needs you only imagine. They protect against duplication, needless complexity and speculative generality respectively. DRY is about duplicated *knowledge*, not merely similar-looking code.

### [basic] What are coupling and cohesion? {#coupling-q}

Cohesion measures how closely the responsibilities inside a module belong together (high is good). Coupling measures how much modules depend on each other (low is good). A cohesive, loosely coupled class can be changed, tested and reused on its own. Depending on interfaces, using dependency injection and avoiding shared mutable state all reduce coupling.

### [intermediate] What is the difference between dependency inversion, dependency injection and inversion of control? {#di-vs-dip-q}

**Dependency inversion** is the design principle: depend on abstractions. **Dependency injection** is a technique that realises it: an object receives its collaborators from outside (constructor, setter or field) rather than creating them. **Inversion of control** is the general idea that a framework controls object creation and the flow of calls instead of your code; Spring's container is an IoC container that performs dependency injection. Constructor injection is preferred: dependencies are explicit, `final` and easy to fake.

### [intermediate] How does Spring support the SOLID principles? {#spring-solid}

Dependency injection and the container give **dependency inversion** (code depends on interfaces and Spring wires the implementations). Injecting `List<Interface>` or `Map<String, Interface>` supports **open/closed**. The controller-service-repository layering applies **single responsibility**. Spring Data repositories are **interface segregation** in practice (you declare only the queries you need). Profiles and `@Primary`/`@Qualifier` let you substitute implementations, which relies on **Liskov**. And testing with mock beans becomes simple.

### [intermediate] Give a real example of an open/closed violation and its fix. {#ocp-violation}

A discount method that switches on a customer type string (`"REGULAR"`, `"VIP"`, `"STAFF"`): each new customer type edits the method and risks the existing branches. Fix: a `DiscountRule` interface with one class per rule, injected as a list and applied by the checkout. The checkout is closed for modification and open to new rules. A guard against over-engineering: do this once the rules are actually changing, and cover conflicts such as stacking and priority.

### [intermediate] Give an example of a Liskov violation other than Square and Rectangle. {#lsp-other}

A `ReadOnlyOrderList extends ArrayList` that throws `UnsupportedOperationException` from `add()`: code written against `List` and calling `add` fails when handed it. Likewise a `Bird` with `fly()` and a `Penguin extends Bird` that cannot fly: callers that fly every bird break. In the JDK, `Collections.unmodifiableList` has this tension. Fixes: separate abstractions (`Bird` and `FlyingBird`), or composition, so the type system states what each class can do.

### [intermediate] How do you fix an interface that is too big? {#isp-fix}

Split it along the lines of its clients: find which groups of methods each client uses, and extract a role interface per group. A class can still implement several of them, while a client depends only on the one it needs. For example, split `ProductService` into `ProductCatalogue`, `PriceLookup` and `StockManager`, so a reporting job depends only on `PriceLookup` and its tests only stub that. If you cannot change the original (a library interface), wrap it in an adapter that exposes the small interface.

### [intermediate] How do SOLID and testing relate? {#solid-testing}

They make code testable: single responsibility gives small units with few dependencies; dependency inversion lets you inject fakes and mocks instead of real databases and payment providers; interface segregation means mocks stub only a few methods; Liskov means a fake can stand in for the real thing. Conversely, when a test is hard to write (many mocks, needs the database), it usually points at a SOLID violation in the design.

### [intermediate] Is a class with several methods violating single responsibility? {#srp-methods}

No. Responsibility means **reason to change**, not number of methods. `Order` can have many methods (add line, apply discount, cancel, total) because they all serve one concept and change together when order rules change. The violation is when one class serves several actors or concerns (rules plus persistence plus rendering). Splitting a cohesive class into one-method classes makes code worse and is its own smell.

### [intermediate] What is the relationship between SOLID and design patterns? {#solid-patterns}

Patterns are concrete solutions, SOLID explains why they work. **Strategy** and **Decorator** implement open/closed. **Factory** and dependency injection implement dependency inversion. **Adapter** and the **Facade** help interface segregation. **Template method** and **Strategy** lean on Liskov. Learning the principles lets you derive a pattern when you need one instead of memorising names. See [the patterns lesson](lesson:design-patterns).

### [intermediate] What are the criticisms of SOLID, and when should you not apply it? {#solid-criticism}

The principles are guidelines and can be over-applied, producing many tiny classes, interfaces with one implementation and indirection that makes code harder to follow. "Single responsibility" is vague, and open/closed can encourage speculative abstraction. They matter most in code that changes often and is tested heavily; a one-off script, a prototype or a stable, small module does not need them. Add abstraction when a second use case or test need appears (the rule of three), and measure good design by how easy the next change is.

### [deep] How would you define "responsibility" in the single responsibility principle? {#srp-define}

Robert Martin's later definition: a module should be responsible to **one, and only one, actor**: one stakeholder group that would request changes (finance, operations, marketing). It is not "does one thing". Two functions of a class that change for different actors, such as `calculatePay` (finance) and `reportHours` (HR), sharing a helper, show the danger: a change for one actor silently breaks the other. Separate them along actor boundaries.

### [deep] How do Liskov and generics relate? Why is List<Dog> not a List<Animal>? {#lsp-generics}

If `List<Dog>` were a `List<Animal>`, you could add a `Cat` through the `Animal` view and break the `Dog` list: it would violate substitution because lists are both read and written. Java generics are therefore **invariant**. Wildcards express the safe cases: `List<? extends Animal>` is read-only (a producer, covariant) and `List<? super Dog>` is write-only (a consumer, contravariant): "producer extends, consumer super". Arrays, by contrast, are covariant and fail at run time with `ArrayStoreException`.

### [deep] Dependency injection versus the service locator. Which is better and why? {#di-vs-locator}

A **service locator** is a global registry the class calls to look up its dependencies (`Registry.get(PaymentGateway.class)`). It hides what a class needs (the dependency does not appear in its constructor), makes tests need the registry set up, and ties the class to the locator. **Dependency injection** makes dependencies explicit, immutable and replaceable, and keeps the class unaware of the container. Prefer constructor injection. Locators are sometimes justified for plugin lookup or at the framework edge, but not in business code.

### [deep] How would you design a plugin architecture so new payment methods can be added without recompiling the core? {#plugin-design}

The core defines a stable `PaymentMethod` interface (the abstraction, owned by the core) and depends only on it (dependency inversion). Each method is implemented in a separate module or JAR. The core discovers implementations at start-up: Java's `ServiceLoader` with `META-INF/services` entries, Spring's component scanning or `List<PaymentMethod>` injection, or a module path with the JPMS `provides ... with`. The interface must be small and well-specified so that every plugin honours its contract (Liskov), and versioned so plugins do not break when it evolves.

### [deep] How would you design the discount rules of an e-commerce checkout so new rules can be added without touching existing code? {#design-discounts}

Define a `DiscountRule` interface (`Money apply(Cart cart)`), implement each rule as its own class (percentage off, buy-two-get-one, loyalty tier), and let the checkout hold a list of rules injected by the framework and apply them in order. Adding a rule is a new class; nothing existing changes (open/closed), each rule is easy to test alone (single responsibility), and the checkout depends only on the interface (dependency inversion). If the rule set is fixed and you want exhaustive handling, model rules as a sealed interface and use a pattern `switch`. Mention how to resolve conflicts between rules explicitly (priority, stacking).

### [coding] Refactor this class to follow SOLID. {#coding-god-class}

```java
public class ReportService {
    public void generateAndEmail(String type, List<Order> orders) {
        String content;
        if (type.equals("CSV")) {
            content = toCsv(orders);
        } else if (type.equals("HTML")) {
            content = toHtml(orders);
        } else {
            throw new IllegalArgumentException(type);
        }
        Session s = Session.getInstance(System.getProperties());
        // ... build MimeMessage, send over SMTP ...
    }
}
```

Problems: it formats **and** sends mail (single responsibility), adding a format edits the `if` chain (open/closed), and the SMTP session is created inside (dependency inversion, hard to test). A refactoring:

```java
interface ReportFormat { String render(List<Order> orders); }          // new formats = new classes
class CsvFormat implements ReportFormat { public String render(List<Order> o) { /* ... */ } }
class HtmlFormat implements ReportFormat { public String render(List<Order> o) { /* ... */ } }

interface Mailer { void send(String to, String subject, String body); }   // abstraction over SMTP

class ReportService {
    private final Map<String, ReportFormat> formats;                    // injected, keyed by name
    private final Mailer mailer;

    ReportService(Map<String, ReportFormat> formats, Mailer mailer) {
        this.formats = formats;
        this.mailer = mailer;
    }

    void generateAndEmail(String type, List<Order> orders, String to) {
        ReportFormat format = Optional.ofNullable(formats.get(type))
                .orElseThrow(() -> new IllegalArgumentException(type));
        mailer.send(to, "Orders report", format.render(orders));
    }
}
```

Formatting and mailing are separate (S), a new format is a new class (O), and `ReportService` depends on `Mailer` and `ReportFormat` interfaces that tests can fake (D). Mention the judgement call: if there will only ever be one format and one mailer, this may be more structure than needed.

### [coding] Fix this Liskov violation. {#coding-lsp}

```java
class Bird { void fly() { /* ... */ } }
class Sparrow extends Bird { }
class Penguin extends Bird {
    @Override void fly() { throw new UnsupportedOperationException("penguins cannot fly"); }
}

void migrate(List<Bird> birds) { birds.forEach(Bird::fly); }   // blows up with a penguin
```

`Penguin` cannot honour the contract of `Bird.fly()`, so it is not substitutable. The hierarchy puts a capability in the wrong place. Separate it:

```java
abstract class Bird { void eat() { /* ... */ } }
interface Flyer { void fly(); }

class Sparrow extends Bird implements Flyer { public void fly() { /* ... */ } }
class Penguin extends Bird { }                       // no fly() to break

void migrate(List<? extends Flyer> flyers) { flyers.forEach(Flyer::fly); }
```

Now the type system says which birds can fly, and `migrate` can only be given things that can.

### [coding] Make this code testable with dependency inversion. {#coding-dip}

```java
public class DiscountService {
    public Money apply(Order o) {
        LocalDate today = LocalDate.now();
        boolean sale = new SaleCalendarDao().isSaleDay(today);   // hits the database
        return sale ? o.total().times(0.9) : o.total();
    }
}
```

The class creates its own database access and reads the system clock, so a test cannot control either and needs a real database. Depend on abstractions and inject them:

```java
interface SaleCalendar { boolean isSaleDay(LocalDate day); }

public class DiscountService {
    private final SaleCalendar calendar;
    private final Clock clock;

    public DiscountService(SaleCalendar calendar, Clock clock) {
        this.calendar = calendar;
        this.clock = clock;
    }

    public Money apply(Order o) {
        boolean sale = calendar.isSaleDay(LocalDate.now(clock));
        return sale ? o.total().times(0.9) : o.total();
    }
}

// test: new DiscountService(day -> true, Clock.fixed(Instant.parse("2026-11-11T00:00:00Z"), ZoneOffset.UTC))
```

The production wiring supplies a database-backed `SaleCalendar` and `Clock.systemUTC()`; the test supplies a lambda and a fixed clock, so it runs in microseconds with no database. Passing a `Clock` is the standard way to make time-dependent code testable.
