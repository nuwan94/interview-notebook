---
title: SOLID and design principles
nav: SOLID principles
slug: solid-principles
summary: The five SOLID principles with a violation and a fix for each, plus DRY, KISS, YAGNI, the Law of Demeter, coupling and cohesion, the code smells that point to them, and when not to apply them, with interview questions.
tags: [OOP, Design, SOLID, Principles]
order: 2
topic: Fundamentals / Object-oriented design
updated: 2026-11-24
subnav: true
---

SOLID is a set of five guidelines that keep object-oriented code easy to change.

Interviewers rarely want you to recite the five definitions. They want to know two things:

- Can you **spot a violation in real code**?
- Can you **fix it without over-engineering**?

So this lesson gives each principle a short meaning, a bad example, a fix and a way to recognise the problem. The examples use an e-commerce and warehouse model. The lesson assumes the basics from the [OOP concepts lesson](lesson:oop-concepts): abstraction, polymorphism and composition.

The animation applies three of the principles: single responsibility, open/closed and dependency inversion.

```demo
name: solid-walk
```

> **One sentence to remember:** *Keep together what changes together, and depend on as little as possible.*

## Why principles at all {#why}

Code rarely fails because it does not work today. It fails because it is painful to change tomorrow. Three symptoms tell you a design is going bad:

- **Rigidity:** a small change forces edits in many places.
- **Fragility:** a change in one place breaks something unrelated.
- **Immobility:** you cannot reuse a part, because it is tangled with everything else. You often cannot test it alone either.

SOLID names five common causes of these symptoms, and the habit that prevents each one. The principles are guidelines for judgement, not laws. The last section covers when to ignore them.

Two words appear throughout this lesson:

- **Cohesion** is how strongly the parts inside one class or module belong together. High cohesion is good.
- **Coupling** is how strongly classes or modules depend on each other. Low coupling is good.

Every principle here is a way to raise cohesion or lower coupling, so that one change touches one place.

## The five principles {#principles}

### S: single responsibility {#srp}

**A class should have only one reason to change.**

Robert Martin later put it another way: a class should answer to **one actor**. An actor is one group of people who would ask for changes. So do not read "responsibility" as "does one tiny thing". Read it as "changes for one kind of reason".

```java
// Violation: four different groups of people each ask for changes to this class
class OrderManager {
    Money calculateTotal(Order o) { /* tax and discount rules */ }
    byte[] renderInvoicePdf(Order o) { /* layout */ }
    void sendConfirmationEmail(Order o) { /* SMTP */ }
    void save(Order o) { /* SQL */ }
}
```

Four groups ask for changes to this class:

- Finance changes the tax rules.
- Marketing changes the invoice layout.
- Operations changes the email provider.
- The database team changes the tables.

All four edit the same file. Their changes collide, and one change can break another job.

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

**How to spot it:**

- The class name ends in `Manager`, `Helper`, `Util` or `Processor`.
- One file imports from unrelated layers, such as SQL, HTTP and PDF.
- The class changes in almost every pull request.
- A test needs five mocks before it can start.

In a Spring application, the usual split into controller, service and repository is single responsibility applied to a request.

### O: open for extension, closed for modification {#ocp}

**You should be able to add new behaviour without editing existing code that already works.**

The tools are interfaces and polymorphism. The stable code depends on an interface, and new behaviour arrives as a new class that implements it.

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

In Spring this is everyday practice. Inject a `List<ShippingPolicy>` or a `Map<String, ShippingPolicy>`, and Spring picks up new implementations automatically.

**How to spot it:** long `if/else if` or `switch` chains on a type code, chains of `instanceof` checks, or an enum that every method switches on.

Note the trade-off. Apply the principle where change is **likely**. A switch over a closed set that will never grow is fine. A [sealed hierarchy](lesson:oop-concepts#sealed) with a pattern `switch` is the opposite design, on purpose: when a case is added, the compiler points to every place you must update.

### L: Liskov substitution {#lsp}

**An object of a subtype must work anywhere the parent type is expected, and the caller must not notice any difference.**

The principle is about **behaviour and promises**, not only about matching method signatures.

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

A subtype must follow three rules. They use two terms: a **precondition** is what a method requires before it runs, and a **postcondition** is what it promises after it runs.

- It must **not demand more** from callers than the parent did. Its preconditions must not be stronger.
- It must **not promise less** than the parent did. Its postconditions must not be weaker, though it may promise more.
- It must **keep the parent's invariants** (the rules that are always true), and it must not throw new, unexpected exceptions.

**How to spot it:**

- An override throws `UnsupportedOperationException`.
- An override does nothing.
- Callers need an `instanceof` check for one subclass.
- Code contains special cases such as "is this really a `Square`?".

The JDK has a famous case. `Collections.unmodifiableList(...)` returns a `List` whose `add` throws an exception. That surprises code written against `List`.

The fix is usually to stop using inheritance for that relationship. Use composition, or two separate interfaces, such as a read-only `Shape` and a resizable one.

### I: interface segregation {#isp}

**A class should not be forced to depend on methods it does not use.** Prefer several small, focused interfaces to one large one.

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

An e-commerce example: do not write one `ProductService` interface with 40 methods for the catalogue, prices and stock. A reporting module that only reads prices should depend only on a `PriceLookup` interface.

The JDK gets this right with tiny interfaces such as `Runnable`, `Comparable`, `Closeable` and `Supplier`. It gets it wrong with the huge `java.sql.Connection`.

**How to spot it:** implementations full of empty methods or methods that throw, and test mocks that must stub methods the tested code never calls.

### D: dependency inversion {#dip}

**High-level code should depend on abstractions, not on concrete low-level classes. Both should depend on the abstraction.**

High-level code is the business logic, such as checkout. Low-level code is a detail, such as the HTTP calls to a payment provider.

The "inversion" works like this. Normally the business code would depend on the detail. Instead, the business code defines an interface, and the detail implements it. So now the detail depends on the business side.

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

People often mix up three terms:

| Term | What it is |
| --- | --- |
| **Dependency inversion** | The *principle*: depend on abstractions. |
| **Dependency injection** | The *technique*: pass dependencies in through the constructor, a setter or a field, instead of creating them with `new`. |
| **Inversion of control** | The broader idea that a framework controls the flow and connects the objects. Spring's container does the injection for you. |

**How to spot it:**

- `new SomeConcreteClass()` deep inside business logic.
- Static calls to infrastructure, such as `DriverManager.getConnection`, or `System.currentTimeMillis()` inside rules you want to test.
- Tests that cannot run without a database or a network.

Prefer **constructor injection**. The dependencies are visible and `final`, and the object is valid as soon as it is built.

## The other principles {#other-principles}

| Principle | Meaning | Example |
| --- | --- | --- |
| **DRY** (don't repeat yourself) | Each piece of knowledge lives in one place. | There is one tax calculation, not copies in the cart, the invoice and the report. |
| **KISS** (keep it simple) | Choose the simplest design that works. | Write a plain method before building a plugin framework. |
| **YAGNI** (you aren't gonna need it) | Do not build for future needs you only imagine. | Do not write a `PaymentProviderFactoryFactory` for the one provider you have. |
| **Composition over inheritance** | Reuse code by holding an object and delegating to it, not by extending a class. | An `Order` has a `ShippingPolicy` ([details](lesson:oop-concepts#composition)). |
| **Law of Demeter** | Talk to your direct collaborators, not to their internals. | Call `order.shippingAddress()`, not `order.customer().address().city()`. |
| **Tell, don't ask** | Tell an object to act. Do not pull its data out and decide for it. | Call `order.cancel()` instead of `if (order.getStatus() == PAID) order.setStatus(CANCELLED)`. |
| **Favour immutability** | Objects that cannot change cannot be broken. | Use records and `final` fields ([thread safety](lesson:java-concurrency#patterns)). |
| **Separation of concerns** | Different jobs live in different modules. | Keep separate web, domain and persistence layers. |

DRY is about *knowledge*, not about text. Two methods may look alike but change for different reasons. Keep them separate, because merging them would tie unrelated things together.

### Coupling and cohesion {#coupling-cohesion}

**Cohesion** is how strongly the parts inside a module belong together. **Coupling** is how strongly modules depend on each other. The goal is **high cohesion and low coupling**.

Kinds of coupling, from worst to best:

1. Reaching into another class's internals, or sharing state that can change.
2. Depending on a concrete class.
3. Depending on an interface.
4. Communicating through events or messages.

Almost every principle above is a way to raise cohesion or lower coupling.

## Smells and the principle behind them {#smells}

A **code smell** is a sign in the code that something in the design may be wrong.

| Smell | Principle it likely breaks | Usual fix |
| --- | --- | --- |
| One class does many unrelated things (a "God class"). | Single responsibility. | Split it by reason to change. |
| You edit the same `switch` for every new case. | Open/closed. | Use polymorphism or the strategy pattern. |
| A subclass throws `UnsupportedOperationException`. | Liskov substitution, interface segregation. | Use a different hierarchy or smaller interfaces. |
| A class implements interface methods it does not need. | Interface segregation. | Split the interface. |
| Business code contains `new ConcreteService()`. | Dependency inversion. | Inject an interface. |
| Long chains such as `a.b().c().d()`. | Law of Demeter. | Add a method on `a` that does the job. |
| Logic is copied and pasted. | DRY. | Extract one method or class. |
| Data classes have only getters, and all the logic is elsewhere. | Tell, don't ask (an anemic model). | Move the rules into the entity. |
| An interface has one implementation "just in case". | YAGNI. | Delete it until a second case appears. |

## Using the principles with judgement {#judgement}

The most common mistake is not ignoring SOLID. It is **over-applying** it: an interface for every class, factories that build factories, ten tiny classes where one clear method would do.

Abstractions have a cost. They add files and layers of indirection, and the code becomes harder to read. Some working rules:

- Add an interface when there is a **second implementation**, or a **real need to swap** one, such as a test fake or a payment provider that may change. Do not add it on day one.
- Follow the **rule of three**. The first time, write the code. The second time, duplicate it. The third time, generalise it, because by then you can see what really varies.
- Apply open/closed where change is **likely**. The history of the code tells you where that is.
- A short script or a one-off report does not need dependency injection.

Good design means choosing the right amount of structure for the change you expect.

Try it in the lab: [SOLID in practice: splitting a god class](lab:solid-refactor).

## Cheat sheet {#cheatsheet}

| Letter | Principle | One-line test |
| --- | --- | --- |
| **S** | Single responsibility | "Does this class have more than one reason to change?" |
| **O** | Open/closed | "Can I add a case without editing existing code?" |
| **L** | Liskov substitution | "Can every subtype stand in for its parent without surprises?" |
| **I** | Interface segregation | "Do implementers have to write methods they do not need?" |
| **D** | Dependency inversion | "Does business code depend on an interface, or on a concrete detail?" |

## Interview questions {#questions}

### [basic] What is SOLID? {#what-is-solid}

Five object-oriented design principles described by Robert Martin:

1. **S**ingle responsibility: a class has one reason to change.
2. **O**pen/closed: open for extension, closed for modification.
3. **L**iskov substitution: a subtype works wherever its parent type is used.
4. **I**nterface segregation: prefer small, focused interfaces.
5. **D**ependency inversion: depend on abstractions.

Together they aim at code that is easy to change, test and reuse, with high cohesion and low coupling. Be ready to give a short e-commerce example for each.

### [basic] Explain the single responsibility principle with an example. {#srp-q}

A class should have only one reason to change.

Example: an `OrderManager` calculates totals, renders PDF invoices, sends emails and writes to the database. It must change whenever finance, marketing, operations or the database team want something.

Split it into `Order` (the rules), `InvoiceRenderer`, `OrderNotifier` and `OrderRepository`, coordinated by a thin `OrderService`. Each one can then be understood, tested and changed on its own.

### [basic] Explain the open/closed principle. {#ocp-q}

Code should be open for extension but closed for modification. You add behaviour by writing new code, not by editing tested code.

Example: a `ShippingPolicy` interface replaces an `if/else` chain on the delivery type. A new delivery method is then a new class, and the checkout does not change. Spring makes this easy, because it can inject all the implementations of an interface.

### [basic] Explain the Liskov substitution principle. {#lsp-q-basic}

If `S` is a subtype of `T`, you can replace a `T` object with an `S` object without breaking the program.

The standard violation is `Square extends Rectangle`. A rectangle promises that you can set width and height separately. A square cannot keep that promise. Code that sets width 5 and height 4 expects an area of 20, but gets 16.

A subtype must not demand more (stronger preconditions), promise less (weaker postconditions) or throw new exceptions.

### [basic] Explain interface segregation. {#isp-q}

A class should not depend on methods it does not use, so prefer many small interfaces to one big one.

Example: a `Worker` interface with `work`, `eat` and `sleep` forces `Robot` to implement `eat`. Split it into `Workable`, `Feedable` and `Restable`, and let each class implement only the ones it needs.

The smell: method implementations that are empty or throw an exception.

### [basic] Explain dependency inversion. {#dip-q}

High-level modules should not depend on low-level modules. Both should depend on abstractions.

Example: a `CheckoutService` that creates a `StripeGateway` with `new` is tied to Stripe. Make it depend on a `PaymentGateway` interface instead, and let the Stripe class implement that interface.

Now the dependency arrow points from the detail to the abstraction, and tests can pass in a fake.

### [basic] What are DRY, KISS and YAGNI? {#dry-kiss-yagni}

- **DRY** (don't repeat yourself): each piece of knowledge has one place where it lives, so you make a change only once. It protects against duplication.
- **KISS** (keep it simple): prefer the simplest design that works. It protects against needless complexity.
- **YAGNI** (you aren't gonna need it): do not build features or abstractions for needs you only imagine. It protects against guessing about the future.

DRY is about repeated *knowledge*, not merely code that looks similar.

### [basic] What are coupling and cohesion? {#coupling-q}

- **Cohesion** measures how closely the jobs inside a module belong together. High is good.
- **Coupling** measures how much modules depend on each other. Low is good.

A cohesive class with low coupling can be changed, tested and reused on its own. Depending on interfaces, using dependency injection and avoiding shared state that can change all reduce coupling.

### [intermediate] What is the difference between dependency inversion, dependency injection and inversion of control? {#di-vs-dip-q}

- **Dependency inversion** is the design principle: depend on abstractions.
- **Dependency injection** is a technique that puts the principle into practice. An object receives its collaborators from outside, through the constructor, a setter or a field, instead of creating them.
- **Inversion of control** is the general idea that a framework controls object creation and the flow of calls, instead of your code. Spring's container is an IoC container that performs dependency injection.

Constructor injection is preferred, because the dependencies are visible, `final` and easy to replace with fakes.

### [intermediate] How does Spring support the SOLID principles? {#spring-solid}

- **Dependency inversion:** dependency injection and the container let code depend on interfaces while Spring connects the implementations.
- **Open/closed:** you can inject a `List<Interface>` or a `Map<String, Interface>`, so a new implementation is picked up without edits.
- **Single responsibility:** the controller, service and repository layers each have one job.
- **Interface segregation:** a Spring Data repository declares only the queries you need.
- **Liskov substitution:** profiles, `@Primary` and `@Qualifier` let you swap implementations, which only works if each one honours the contract.

Testing with mock beans also becomes simple.

### [intermediate] Give a real example of an open/closed violation and its fix. {#ocp-violation}

A discount method switches on a customer type string, such as `"REGULAR"`, `"VIP"` or `"STAFF"`. Each new customer type edits the method and puts the existing branches at risk.

The fix: a `DiscountRule` interface with one class per rule. The rules are injected as a list and applied by the checkout. The checkout is now closed for modification and open to new rules.

A guard against over-engineering: make this change once the rules really start changing. Also decide how rules interact, such as whether they stack and which has priority.

### [intermediate] Give an example of a Liskov violation other than Square and Rectangle. {#lsp-other}

- A `ReadOnlyOrderList extends ArrayList` that throws `UnsupportedOperationException` from `add()`. Code written against `List` that calls `add` fails when it gets this list.
- A `Bird` class with `fly()`, and a `Penguin extends Bird` that cannot fly. Callers that make every bird fly break.
- In the JDK, `Collections.unmodifiableList` has the same tension.

The fixes: separate abstractions (`Bird` and `FlyingBird`) or composition, so the type system states what each class can do.

### [intermediate] How do you fix an interface that is too big? {#isp-fix}

Split it along the lines of the classes that use it:

1. Find which group of methods each client uses.
2. Extract one role interface for each group.
3. Let a class implement several of them where needed, while each client depends only on the one it uses.

Example: split `ProductService` into `ProductCatalogue`, `PriceLookup` and `StockManager`. A reporting job then depends only on `PriceLookup`, and its tests only stub that interface.

If you cannot change the original interface, because it comes from a library, wrap it in an adapter that offers the small interface.

### [intermediate] How do SOLID and testing relate? {#solid-testing}

SOLID makes code testable:

- Single responsibility gives small units with few dependencies.
- Dependency inversion lets you inject fakes and mocks instead of real databases and payment providers.
- Interface segregation means mocks stub only a few methods.
- Liskov substitution means a fake can stand in for the real thing.

It also works the other way. When a test is hard to write, because it needs many mocks or a database, that usually points to a SOLID violation in the design.

### [intermediate] Is a class with several methods violating single responsibility? {#srp-methods}

**No.** Responsibility means a **reason to change**, not a number of methods.

`Order` can have many methods, such as add a line, apply a discount, cancel and total. They all serve one idea, and they change together when the order rules change.

The violation is when one class serves several actors or concerns, such as rules plus persistence plus rendering. Splitting a cohesive class into one-method classes makes the code worse, and that is a smell of its own.

### [intermediate] What is the relationship between SOLID and design patterns? {#solid-patterns}

Patterns are concrete solutions, and SOLID explains why they work:

- **Strategy** and **Decorator** apply open/closed.
- **Factory** and dependency injection apply dependency inversion.
- **Adapter** and **Facade** help interface segregation.
- **Template method** and **Strategy** rely on Liskov substitution.

If you know the principles, you can work out a pattern when you need one instead of memorising names. See [the patterns lesson](lesson:design-patterns).

### [intermediate] What are the criticisms of SOLID, and when should you not apply it? {#solid-criticism}

The criticisms:

1. The principles can be over-applied. You get many tiny classes, interfaces with one implementation, and layers that make code harder to follow.
2. "Single responsibility" is vague.
3. Open/closed can encourage abstractions built for changes that never come.

The principles matter most in code that changes often and is tested heavily. A one-off script, a prototype or a small, stable module does not need them. Add an abstraction when a second use case or a test need appears (the rule of three). Judge a design by how easy the next change is.

### [deep] How would you define "responsibility" in the single responsibility principle? {#srp-define}

Robert Martin's later definition: a module should be responsible to **one, and only one, actor**. An actor is one group of people who would ask for changes, such as finance, operations or marketing. It does not mean "does one thing".

An example of the danger: a class has `calculatePay` (used by finance) and `reportHours` (used by HR), and both share a helper method. A change to the helper for one actor silently breaks the other. So separate code along the boundaries between actors.

### [deep] How do Liskov and generics relate? Why is List<Dog> not a List<Animal>? {#lsp-generics}

Suppose `List<Dog>` were a `List<Animal>`. Then you could add a `Cat` through the `Animal` view and break the list of dogs. That violates substitution, because a list is both read and written.

So Java generics are **invariant**: `List<Dog>` and `List<Animal>` are unrelated types. Wildcards express the safe cases:

- `List<? extends Animal>` is one you can only read from. It is a **producer**, and it is **covariant** (it accepts lists of subtypes).
- `List<? super Dog>` is one you can only write to. It is a **consumer**, and it is **contravariant** (it accepts lists of supertypes).

The rule is "producer extends, consumer super". Arrays, by contrast, are covariant, so a wrong write fails only at run time, with an `ArrayStoreException`.

### [deep] Dependency injection versus the service locator. Which is better and why? {#di-vs-locator}

**Dependency injection is better** in business code.

A **service locator** is a global registry that a class calls to look up what it needs, such as `Registry.get(PaymentGateway.class)`. Its problems:

1. It hides what a class needs, because the dependency does not appear in the constructor.
2. Tests must set up the registry first.
3. The class is tied to the locator.

**Dependency injection** makes dependencies visible, `final` and replaceable, and the class does not know about the container. Prefer constructor injection. A locator is sometimes justified for finding plugins, or at the edge of a framework.

### [deep] How would you design a plugin architecture so new payment methods can be added without recompiling the core? {#plugin-design}

1. The core defines a stable `PaymentMethod` interface. The core owns it and depends only on it (dependency inversion).
2. Each payment method is implemented in a separate module or JAR.
3. The core discovers the implementations at start-up. Options are Java's `ServiceLoader` with `META-INF/services` entries, Spring's component scanning or `List<PaymentMethod>` injection, or the module system's `provides ... with`.

The interface must be small and clearly specified, so that every plugin honours its contract (Liskov substitution). It must also be versioned, so that plugins do not break when it evolves.

### [deep] How would you design the discount rules of an e-commerce checkout so new rules can be added without touching existing code? {#design-discounts}

1. Define a `DiscountRule` interface with `Money apply(Cart cart)`.
2. Write each rule as its own class, such as percentage off, buy two get one free, or loyalty tier.
3. Let the checkout hold a list of rules injected by the framework, and apply them in order.

This follows three principles:

- Adding a rule is a new class, and nothing existing changes (open/closed).
- Each rule is easy to test alone (single responsibility).
- The checkout depends only on the interface (dependency inversion).

If the set of rules is fixed and you want every case handled, model the rules as a sealed interface and use a pattern `switch`. Also explain how conflicts between rules are resolved, such as priority and stacking.

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

The problems:

- It formats **and** sends mail, which breaks single responsibility.
- Adding a format means editing the `if` chain, which breaks open/closed.
- The SMTP session is created inside, which breaks dependency inversion and makes the class hard to test.

A refactoring:

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

What changed:

- Formatting and mailing are separate (S).
- A new format is a new class (O).
- `ReportService` depends on the `Mailer` and `ReportFormat` interfaces, which tests can fake (D).

Also mention the judgement call: if there will only ever be one format and one mailer, this may be more structure than you need.

### [coding] Fix this Liskov violation. {#coding-lsp}

```java
class Bird { void fly() { /* ... */ } }
class Sparrow extends Bird { }
class Penguin extends Bird {
    @Override void fly() { throw new UnsupportedOperationException("penguins cannot fly"); }
}

void migrate(List<Bird> birds) { birds.forEach(Bird::fly); }   // blows up with a penguin
```

`Penguin` cannot keep the promise of `Bird.fly()`, so it cannot stand in for a `Bird`. The hierarchy puts a capability in the wrong place. Separate it:

```java
abstract class Bird { void eat() { /* ... */ } }
interface Flyer { void fly(); }

class Sparrow extends Bird implements Flyer { public void fly() { /* ... */ } }
class Penguin extends Bird { }                       // no fly() to break

void migrate(List<? extends Flyer> flyers) { flyers.forEach(Flyer::fly); }
```

Now the type system says which birds can fly, and `migrate` only accepts things that can.

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

The class creates its own database access and reads the system clock. A test cannot control either one, and it needs a real database. Depend on abstractions and inject them:

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

In production, the wiring passes in a `SaleCalendar` backed by the database and `Clock.systemUTC()`. The test passes in a lambda and a fixed clock, so it runs in microseconds with no database.

Passing in a `Clock` is the standard way to make code that depends on time testable.
