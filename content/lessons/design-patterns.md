---
title: Design patterns — common solutions with Java and Spring examples
slug: design-patterns
summary: What design patterns are, the creational, structural and behavioural patterns interviewers ask about, where you already use them in the JDK and Spring, the enterprise patterns, and the anti-patterns to avoid, with interview questions.
tags: [Design patterns, OOP, Java, Spring]
order: 8
topic: Fundamentals / Design patterns
updated: 2026-11-12
subnav: true
---

A **design pattern** is a named, reusable solution to a problem that keeps appearing in object-oriented design. The value is mostly **vocabulary**: saying "this is a decorator" tells a colleague the structure, the intent and the trade-offs in two words. Interviewers ask for a definition, a real example from the JDK or Spring, and, above all, *when not to use it*. This lesson covers the patterns that come up most, with an e-commerce model for the code and the places you have already met each one. It builds on the [OOP concepts](lesson:oop-concepts) and [SOLID](lesson:solid-principles) lessons. Press play to watch three of the patterns work.

```demo
name: patterns-walk
```

> **One sentence to remember:** *a pattern is a trade-off with a name: it buys flexibility (usually through an interface and one more layer of indirection) at the price of more classes and a flow that is harder to follow, so use it when that flexibility is actually needed.*

## Patterns in context {#context}

### What a pattern is, and is not {#what-is}

The idea comes from architecture (Christopher Alexander) and was applied to software by the "Gang of Four" (GoF) book of 1994, which describes **23 patterns**. A pattern description has a **name**, the **problem** it solves, the **structure** of the solution and its **consequences**. It is a template, not code you can copy: each use is adapted to the situation. Patterns are discovered, not invented: they record solutions that experienced developers kept reaching for.

### The three categories {#categories}

| Category | Concerned with | GoF patterns |
| --- | --- | --- |
| **Creational** | how objects are created | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| **Structural** | how objects are composed into larger structures | Adapter, Decorator, Proxy, Facade, Composite, Bridge, Flyweight |
| **Behavioural** | how objects communicate and share responsibility | Strategy, Observer, Template Method, Command, Iterator, State, Chain of Responsibility, Visitor, Mediator, Memento, Interpreter |

You do not need all 23. The ones marked in the sections below are the ones to know cold: **Singleton, Factory, Builder, Adapter, Decorator, Proxy, Facade, Strategy, Observer, Template Method**, plus the Spring-style enterprise patterns.

## Creational patterns {#creational}

### Singleton {#singleton}

**Intent:** exactly one instance of a class, with a global access point. In Java the safest implementation is a single-element `enum`:

```java
public enum AppConfig {
    INSTANCE;
    private final Properties props = load();
    public String get(String key) { return props.getProperty(key); }
}
// AppConfig.INSTANCE.get("currency")
```

The **holder idiom** is lazy and thread-safe without locking (a private static nested class holds the instance, initialised when first used). Lazy double-checked locking works only with a `volatile` field ([why](lesson:java-memory-model#dcl)). Be ready to criticise it: a singleton is **global mutable state** with a hidden dependency, which makes code harder to test (you cannot substitute it) and to reason about, and "one" is only one **per class loader**. Also note that a **Spring singleton bean** is not the GoF singleton: it is one instance per application context, created and injected by the container, so classes stay ordinary and testable. Prefer that.

### Factory method and abstract factory {#factory}

**Intent:** create objects without hard-coding the concrete class, so the creating code is not tied to it. In Java the everyday form is the **static factory method**:

```java
List<String> names = List.of("a", "b");            // returns an immutable list implementation you never see
Integer n = Integer.valueOf(127);                    // may return a cached instance (flyweight)
NumberFormat f = NumberFormat.getInstance(locale);   // the concrete class depends on the locale
```

Its advantages over `new` (Effective Java item 1): it has a **name** (`Money.ofCents(500)`), it need not create a new object each time (caching), it can return a **subtype**, and callers depend on the interface. The GoF **factory method** lets a subclass choose which class to instantiate; the **abstract factory** creates **families** of related objects (a UI toolkit producing matching buttons and menus for each platform; a `DocumentBuilderFactory`). In Spring the container itself is a factory (`BeanFactory`), and `@Bean` methods are factory methods.

### Builder {#builder}

**Intent:** build a complex object step by step, separating construction from representation. It fixes the "telescoping constructor" problem (constructors with many optional parameters of the same type) and lets you create **immutable** objects with readable code and validation in one place:

```java
Order order = Order.builder()
        .customerId("C-42")
        .addLine("SKU-1", 2)
        .addLine("SKU-7", 1)
        .shippingMethod(ShippingMethod.EXPRESS)
        .build();                    // build() validates, then returns an immutable Order
```

JDK and library examples: `StringBuilder`, `Stream.builder()`, `HttpRequest.newBuilder()`, `Calendar.Builder`, Lombok's `@Builder`. Use it when a class has many optional fields; for two or three parameters a constructor or a record is simpler.

### Prototype {#prototype}

**Intent:** create new objects by copying an existing one. In Java that is `clone()` (flawed) or, better, a **copy constructor** or copy method. It helps when creation is expensive or you want a variation of a configured template, such as a copy of a pre-filled order for "reorder". Spring's `prototype` bean scope (a new instance on each request for the bean) is a different meaning of the word.

## Structural patterns {#structural}

### Adapter {#adapter}

**Intent:** make one interface look like another that the client expects, so incompatible classes work together. Think of a plug adapter.

```java
interface PaymentGateway { Receipt charge(Money amount, Card card); }      // what our code uses

class LegacyBankClient { int doPayment(String acct, double dollars) { ... } }   // what the vendor gives us

class LegacyBankAdapter implements PaymentGateway {
    private final LegacyBankClient client;
    LegacyBankAdapter(LegacyBankClient client) { this.client = client; }

    public Receipt charge(Money amount, Card card) {
        int code = client.doPayment(card.account(), amount.toDollars());   // translate the call and the result
        return code == 0 ? Receipt.ok() : Receipt.failed(code);
    }
}
```

JDK: `Arrays.asList` (an array seen as a `List`), `InputStreamReader` (bytes to characters), `Collections.enumeration`. It is the usual way to keep a third-party or legacy API from leaking into your domain.

### Decorator {#decorator}

**Intent:** add behaviour to an object dynamically by **wrapping** it in another object with the same interface, as an alternative to subclassing.

```java
interface Notifier { void send(String message); }

class EmailNotifier implements Notifier { public void send(String m) { /* send email */ } }

class RetryingNotifier implements Notifier {
    private final Notifier next;
    RetryingNotifier(Notifier next) { this.next = next; }
    public void send(String m) { for (int i = 0; i < 3; i++) { try { next.send(m); return; } catch (RuntimeException e) { /* retry */ } } }
}

Notifier n = new RetryingNotifier(new LoggingNotifier(new EmailNotifier()));   // combine at run time
```

JDK: the whole of `java.io` (`new BufferedReader(new InputStreamReader(new FileInputStream(f)))`), and `Collections.unmodifiableList` / `synchronizedList`. It avoids a subclass for every combination (`RetryingLoggingEmailNotifier`...) and follows the open/closed principle. The cost: many small classes, and the order of wrapping matters.

### Proxy {#proxy}

**Intent:** provide a stand-in that **controls access** to another object, with the same interface. The client calls the proxy; the proxy decides whether and how to call the real object (lazy creation, security checks, caching, remote access, logging, transactions).

- **JDK dynamic proxy** (`java.lang.reflect.Proxy`): generated at run time for **interfaces**. **CGLIB / ByteBuddy** generate a **subclass** proxy for classes.
- **Spring AOP** is built on proxies: `@Transactional`, `@Async`, `@Cacheable` and `@PreAuthorize` all work because Spring wraps your bean in a proxy that begins the transaction, calls your method, then commits or rolls back.
- **Hibernate** returns proxies for lazily loaded entities and collections.

The classic gotcha follows from the mechanism: a call **from one method of a bean to another method of the same bean** (`this.save()`) does not pass through the proxy, so `@Transactional` or `@Cacheable` on the inner method is silently ignored. The fix is to call through the proxy (move the method to another bean).

**Decorator versus proxy:** the structure is nearly identical; the intent differs. A decorator **adds behaviour** a caller chose to compose; a proxy **controls access** and is usually invisible to the caller.

### Facade {#facade}

**Intent:** provide a simple interface to a complex subsystem. A checkout needs inventory, payment, tax and shipping calls in the right order with rollback; an `OrderFacade.placeOrder(cart)` hides that so the controller makes one call. An **API gateway** is a facade at the architecture level, and `JdbcTemplate` is one over raw JDBC. The risk is that the facade becomes a God class that knows everything.

### Composite {#composite}

**Intent:** treat individual objects and groups of objects uniformly, for tree structures. A product **bundle** is a product whose price is the sum of its parts, and callers do not care whether they hold a single item or a bundle:

```java
interface Priced { Money price(); }
record Item(Money price) implements Priced { }
record Bundle(List<Priced> parts) implements Priced {
    public Money price() { return parts.stream().map(Priced::price).reduce(Money.ZERO, Money::plus); }
}
```

Other examples: a file system (files and folders), UI component trees (Swing, React-style trees), category trees.

### Flyweight {#flyweight}

**Intent:** share objects to save memory when there are very many identical ones. `Integer.valueOf` caches -128 to 127, and the [string pool](lesson:java-memory-model#string-pool) shares equal string literals. The shared state must be immutable.

### Bridge {#bridge}

**Intent:** separate an abstraction from its implementation so the two can vary independently (for example `Notification` types, each of which can be sent through email, SMS or push). It looks like composition, and is mainly worth recognising by name.

## Behavioural patterns {#behavioural}

### Strategy {#strategy}

**Intent:** define a family of interchangeable algorithms behind an interface and let the caller pick one at run time. It is the pattern behind the open/closed principle:

```java
interface DiscountStrategy { Money apply(Money total); }

class Cart {
    private DiscountStrategy discount;
    Cart(DiscountStrategy discount) { this.discount = discount; }
    Money total() { return discount.apply(subtotal()); }       // no if/else on the rule type
}

new Cart(total -> total.times(0.9));                            // a lambda is a strategy for a one-method interface
```

JDK and Spring: `Comparator` (the sort order is a strategy passed to `sort`), `ThreadPoolExecutor`'s rejection policies, Spring Security's `PasswordEncoder`. Since Java 8 a lambda replaces the single-method strategy class. The animation above shows a run-time swap.

### Observer {#observer}

**Intent:** when one object changes or something happens, notify any number of dependents without the source knowing who they are: a one-to-many dependency with loose coupling.

```java
interface OrderListener { void onPlaced(Order order); }

class OrderService {
    private final List<OrderListener> listeners = new CopyOnWriteArrayList<>();
    void subscribe(OrderListener l) { listeners.add(l); }
    void place(Order o) { save(o); listeners.forEach(l -> l.onPlaced(o)); }   // email, stock, analytics...
}
```

JDK and Spring: `PropertyChangeListener` and Swing listeners, the reactive `Flow` API (Java 9), and Spring's `ApplicationEventPublisher` with `@EventListener`. (`java.util.Observable` is deprecated since Java 9.) Watch for: listeners that **leak** because nobody unsubscribes (see [memory leaks](lesson:garbage-collector#problems)), a slow or failing listener delaying or breaking the rest, and a flow that is hard to trace. Across services the same idea is publish/subscribe messaging.

### Template method {#template-method}

**Intent:** define the **skeleton** of an algorithm in a base class, and let subclasses fill in specific steps, without changing the order. The base class calls the steps (the "Hollywood principle": don't call us, we'll call you).

```java
abstract class ReportJob {
    final void run() { var data = load(); var out = format(data); deliver(out); }   // fixed skeleton
    protected abstract List<Order> load();
    protected abstract String format(List<Order> data);
    protected void deliver(String out) { System.out.println(out); }                // a hook with a default
}
```

JDK and Spring: `HttpServlet.service` calling `doGet`/`doPost`, `AbstractList`, `JdbcTemplate` (callbacks instead of subclassing). It uses **inheritance**, so the strategy pattern (composition) is the more flexible alternative when the varying part is a whole algorithm.

### Command {#command}

**Intent:** turn a request into an object, so it can be queued, logged, retried or undone. `Runnable` and `Callable` are commands, and a task queue or a thread pool is a command executor. In an e-commerce back office: `AddItemCommand`, `ApplyCouponCommand` with `execute()` and `undo()` for an editable cart. Message-driven systems send commands (do this) versus events (this happened).

### Iterator {#iterator}

**Intent:** traverse a collection without exposing its structure. Java builds it into the language: `Iterable` and `Iterator`, and the enhanced `for` loop. Most collections' iterators are **fail-fast** (they throw `ConcurrentModificationException` if the collection changes during iteration), while concurrent collections' iterators are weakly consistent.

### State {#state}

**Intent:** let an object change its behaviour when its internal state changes, replacing large `switch` statements on a status field. An order moves through `NEW`, `PAID`, `SHIPPED`, `CANCELLED`, and which actions are allowed depends on the state:

```java
enum OrderState {
    NEW     { OrderState pay()    { return PAID; }      OrderState cancel() { return CANCELLED; } },
    PAID    { OrderState ship()   { return SHIPPED; }   OrderState cancel() { return CANCELLED; } },
    SHIPPED { },
    CANCELLED { };
    OrderState pay()    { throw new IllegalStateException("cannot pay in " + this); }
    OrderState ship()   { throw new IllegalStateException("cannot ship in " + this); }
    OrderState cancel() { throw new IllegalStateException("cannot cancel in " + this); }
}
```

For complex lifecycles use a state machine library (Spring Statemachine). State resembles strategy: in State the object changes its own behaviour as it moves between states; in Strategy the client picks the behaviour.

### Chain of responsibility {#chain}

**Intent:** pass a request along a chain of handlers until one handles it (or each does its part). **Servlet filters**, Spring's `HandlerInterceptor` and the **Spring Security filter chain** are chains: authentication, then authorisation, then logging, then the controller. Each handler decides whether to continue (`chain.doFilter(...)`), which makes cross-cutting concerns pluggable and orderable.

### Visitor {#visitor}

**Intent:** add new operations to a class hierarchy without changing the classes, using **double dispatch**. It is awkward in Java (an `accept(visitor)` method on every element). With **sealed types and pattern-matching `switch`** (Java 21) the same job is usually simpler: a `switch` over a sealed hierarchy that the compiler checks for completeness (see [sealed hierarchies](lesson:oop-concepts#sealed)). `FileVisitor` in `java.nio.file` is the JDK example.

### Mediator, memento and interpreter {#minor-behavioural}

Briefly, so the names are not new: a **mediator** centralises how objects communicate (a chat room, an air-traffic controller; `ExecutorService` coordinates tasks), a **memento** captures and restores an object's state (undo snapshots), and an **interpreter** evaluates a small language (regex, SpEL expressions).

## Enterprise and Spring patterns {#enterprise}

The patterns you use daily in a Java back end are often not from the GoF book:

| Pattern | Idea | Where |
| --- | --- | --- |
| **Dependency injection** | objects receive collaborators instead of creating them | Spring container, constructor injection |
| **Inversion of control** | the framework calls your code | Spring, servlet containers |
| **MVC and Front controller** | one entry point dispatches to controllers, views separate from models | Spring's `DispatcherServlet` |
| **Service layer** | transaction and business-operation boundary between controller and data | `@Service` |
| **Repository** | collection-like access to aggregates, hiding persistence | Spring Data `JpaRepository` |
| **DAO** | an object encapsulating data access for one entity | older JDBC/JPA code |
| **DTO** | a plain object shaped for the wire, separate from the domain entity | API request and response classes, records |
| **Unit of work** | track changes to objects and write them in one transaction | the JPA `EntityManager` / Hibernate session |
| **Specification** | composable business rules as objects | Spring Data `Specification` |
| **Aggregate root** | a cluster of objects with one entry point enforcing invariants | domain-driven design `Order` with its lines |

For microservices there is a separate family (saga, outbox, CQRS, circuit breaker, API gateway, retry with back-off, idempotency). They apply the same idea at architecture level.

## Anti-patterns {#anti-patterns}

An **anti-pattern** is a common solution that looks reasonable but causes more problems than it solves.

| Anti-pattern | Problem |
| --- | --- |
| **God object / blob** | one class that knows and does everything |
| **Singleton abuse** | global mutable state hidden behind `getInstance()` |
| **Golden hammer** | using the one pattern or tool you like for every problem |
| **Pattern fever / over-engineering** | factories, strategies and layers for a problem that needed an `if` |
| **Service locator** | classes look up dependencies from a global registry: hidden, hard to test |
| **Anemic domain model** | entities with only data, all rules in services |
| **Spaghetti code** | tangled control flow with no structure |
| **Magic numbers and strings** | unexplained literals scattered through the code |
| **Copy-paste programming** | duplicated logic that must be fixed in many places |
| **Premature optimisation** | making code complicated for performance you have not measured |
| **Cargo cult** | applying a pattern because others do, without understanding the problem |

## Patterns and SOLID {#patterns-solid}

| Pattern | Principle it serves |
| --- | --- |
| Strategy, Decorator, Template method | open/closed |
| Factory, dependency injection | dependency inversion |
| Adapter, Facade | dependency inversion, interface segregation |
| Observer | low coupling between publisher and subscribers |
| Composite | Liskov substitution (a group is used like a single item) |
| Command | single responsibility (a request as its own object) |

## Choosing a pattern {#choosing}

Start from the **problem**, not the pattern:

| If you need to... | Consider |
| --- | --- |
| create objects without naming the concrete class | Factory method |
| build an object with many optional fields | Builder |
| exactly one shared instance | a Spring singleton bean (or an enum singleton) |
| use an incompatible API | Adapter |
| add behaviour in layers, chosen at run time | Decorator |
| control or intercept access to an object | Proxy |
| hide a complicated subsystem behind one call | Facade |
| swap an algorithm | Strategy |
| react to events without coupling | Observer |
| fix the steps of a procedure but vary some | Template method |
| queue, retry or undo operations | Command |
| behaviour that depends on a lifecycle status | State |
| pass a request through ordered handlers | Chain of responsibility |

## Cheat sheet {#cheatsheet}

| Pattern | Category | One line | JDK or Spring example |
| --- | --- | --- | --- |
| Singleton | creational | one instance | enum; Spring singleton bean |
| Factory method | creational | create without naming the class | `List.of`, `Integer.valueOf` |
| Builder | creational | step-by-step construction | `StringBuilder`, `HttpRequest.newBuilder()` |
| Adapter | structural | convert one interface to another | `Arrays.asList`, `InputStreamReader` |
| Decorator | structural | wrap to add behaviour | `BufferedReader`, `unmodifiableList` |
| Proxy | structural | control access | Spring AOP, Hibernate lazy loading |
| Facade | structural | simple front for a subsystem | `JdbcTemplate`, API gateway |
| Strategy | behavioural | swappable algorithm | `Comparator` |
| Observer | behavioural | notify subscribers | `@EventListener`, `Flow` |
| Template method | behavioural | fixed skeleton, variable steps | `HttpServlet`, `JdbcTemplate` |
| Chain of responsibility | behavioural | ordered handlers | servlet filters, Spring Security |
| State | behavioural | behaviour depends on state | order lifecycle |

## Interview questions {#questions}

### [basic] What is a design pattern, and why use one? {#what-is-pattern}

A named, reusable solution to a recurring design problem, described by its intent, structure and consequences. They give developers a shared vocabulary ("use a decorator here"), capture proven solutions and help you recognise structure in existing code. They are templates to adapt, not code to copy, and they are not free: each adds indirection, so they should answer a real need.

### [basic] What are the types of design patterns? {#types-of-patterns}

The Gang of Four describe 23 patterns in three categories. **Creational** patterns deal with object creation (Singleton, Factory, Abstract Factory, Builder, Prototype). **Structural** patterns compose objects into larger structures (Adapter, Decorator, Proxy, Facade, Composite, Bridge, Flyweight). **Behavioural** patterns handle communication and responsibility (Strategy, Observer, Template method, Command, Iterator, State, Chain of responsibility, Visitor and others).

### [basic] How do you implement a Singleton in Java, and what are its drawbacks? {#singleton-q}

The simplest robust way is a single-element enum. Another is the holder idiom: a private static nested class that holds the instance and is initialised lazily and thread-safely by class loading. Double-checked locking needs a `volatile` field. Drawbacks: it is global mutable state with a hidden dependency, hard to test or replace, "one" means one per class loader, and it can be broken by reflection or serialization (an enum avoids both). A Spring singleton bean is a better approach: one instance per container, injected, testable.

### [basic] What is the difference between the Factory and Abstract Factory patterns? {#factory-vs-abstract}

A **factory method** is a method that creates an object of one product type, letting the choice of concrete class vary (a static factory such as `List.of`, or a method overridden by a subclass). An **abstract factory** is an object that creates a **family** of related products that belong together, such as the whole set of widgets for one look and feel. Factory method is about one product, abstract factory about consistent groups of products.

### [basic] What is the Builder pattern, and when would you use it? {#builder-q}

It constructs a complex object step by step through a fluent API and finishes with `build()`. Use it when a class has many parameters, especially optional ones, to avoid telescoping constructors and unreadable calls, and to create immutable objects with validation in `build()`. Examples: `StringBuilder`, `HttpRequest.newBuilder()`, Lombok `@Builder`. For two or three parameters, a constructor or a record is simpler.

### [basic] Explain the Strategy pattern with an example. {#strategy-q}

Define a family of algorithms behind an interface, make them interchangeable and let the client choose at run time. A `Cart` holds a `DiscountStrategy`; percentage off, loyalty tier and buy-one-get-one are separate implementations, and the cart calls `apply(total)` without an `if/else` on the rule. `Comparator` is the JDK's example. It supports the open/closed principle, and since Java 8 a lambda can be the strategy.

### [basic] Explain the Observer pattern. Where is it used? {#observer-q}

A subject keeps a list of observers and notifies them when something happens, so the subject does not need to know who they are or how many. Used in GUI listeners, `PropertyChangeListener`, Spring's `ApplicationEventPublisher` and `@EventListener`, reactive streams, and, across services, publish/subscribe messaging. Risks: listener leaks if observers are never removed, and a slow or failing observer affecting the others.

### [basic] What is the Adapter pattern? {#adapter-q}

It converts the interface of a class into another interface that the client expects, so classes with incompatible interfaces can work together. For example a `LegacyBankAdapter` implements your `PaymentGateway` interface and translates calls to the vendor's `LegacyBankClient`. JDK examples: `Arrays.asList`, `InputStreamReader`. It also keeps third-party APIs from leaking into your domain.

### [basic] What is the Decorator pattern, and how does it differ from inheritance? {#decorator-q}

A decorator wraps an object that has the same interface, adds behaviour before or after delegating, and can be stacked, for example `new BufferedReader(new InputStreamReader(in))`. Inheritance fixes the extra behaviour at compile time and needs a subclass for each combination; decorators combine behaviours at run time and follow the open/closed principle. The cost is many small classes and sensitivity to the order of wrapping.

### [intermediate] What is the difference between Decorator and Proxy? {#decorator-vs-proxy}

Structurally they look alike: both implement the target's interface and delegate to it. The **intent** differs. A decorator **adds responsibilities** and the caller usually builds the stack deliberately. A proxy **controls access** to the real object (lazy loading, security, caching, remote calls, transactions) and is usually transparent to the caller, which often does not know it exists. Spring AOP and Hibernate lazy loading use proxies.

### [intermediate] How does Spring use the Proxy pattern, and what is the self-invocation problem? {#spring-proxy}

For `@Transactional`, `@Async`, `@Cacheable` and security annotations, Spring wraps the bean in a proxy (a JDK dynamic proxy for interfaces, CGLIB or ByteBuddy subclass otherwise) that adds the transaction or caching behaviour around the call. A call from outside goes through the proxy. But a call from one method to another **within the same bean** (`this.other()`) bypasses the proxy, so the annotation on the second method is ignored. Fix it by moving the method to another bean, injecting a reference to the proxy, or restructuring.

### [intermediate] What is the difference between Strategy and State? {#strategy-vs-state}

Both delegate behaviour to an interchangeable object, and the class diagrams are almost identical. In **Strategy** the **client** selects the algorithm and it stays until changed; strategies usually do not know about each other. In **State** the **object itself** switches among states as it runs, states are aware of the transitions between them, and the behaviour changes because of the lifecycle (an order that is NEW, PAID, SHIPPED), not because the client chose.

### [intermediate] What is the Template Method pattern, and how does it differ from Strategy? {#template-vs-strategy}

Template method fixes the skeleton of an algorithm in a base class and lets subclasses supply some steps, through **inheritance**; the base calls the subclass, not the other way round. Strategy puts the varying part in a separate object that is **composed** in. Strategy is more flexible (change at run time, no subclass per variant), whereas template method is simple when a family of classes shares a fixed procedure. Spring's `JdbcTemplate` takes the template idea but uses callbacks instead of subclassing.

### [intermediate] Where do you see the Chain of Responsibility pattern in Java web applications? {#chain-q}

In **servlet filters** and the **Spring Security filter chain**: a request passes through ordered handlers (authentication, authorisation, CORS, logging) and each either handles it, rejects it, or calls `chain.doFilter` to pass it on. Spring MVC `HandlerInterceptor`s work similarly. The pattern makes cross-cutting concerns pluggable and orderable, and the order is significant (authenticate before authorise).

### [intermediate] Singleton scope in Spring versus the Singleton pattern. {#spring-singleton}

The Spring default scope creates **one instance per application context** for a bean definition, managed by the container. The GoF pattern enforces one instance per JVM (strictly per class loader) from inside the class itself, via a private constructor and static accessor. Spring's version leaves classes as ordinary, injectable, testable classes and allows other scopes (prototype, request, session). The Spring singleton is still shared across threads, so it must be **stateless or thread-safe**.

### [intermediate] What are the problems with the Singleton pattern in tests and with concurrency? {#singleton-problems}

Tests cannot easily replace a global instance with a fake, and state left by one test leaks into the next. Code that calls `Config.getInstance()` hides its dependency. For concurrency, a lazily created singleton needs safe publication (holder idiom, enum, or `volatile` double-checked locking), and mutable singleton state must itself be thread-safe. Prefer injecting a single shared instance.

### [intermediate] What is the difference between DTO, DAO, Repository and entity? {#dto-dao-repo}

An **entity** is a domain object with identity, mapped to storage. A **DAO** (data access object) wraps the data-access operations for one table or entity. A **repository** presents a domain-oriented, collection-like interface for an aggregate (`orders.findByCustomer(...)`), hiding persistence completely, which is what Spring Data gives you. A **DTO** (data transfer object) is a simple object shaped for transport (a request or response body), used so internal entities do not leak through the API.

### [intermediate] When is a Facade appropriate, and what is the risk? {#facade-q}

When callers need a simple operation that involves several subsystems in a particular order, such as placing an order across inventory, payment, tax and shipping: the facade offers `placeOrder` and hides the choreography. It reduces coupling to the subsystems. The risk is that it grows into a God class that knows everything, so keep it thin and let the subsystems keep their own logic.

### [intermediate] How would you implement an order lifecycle with the State pattern? {#state-q}

Model the statuses (NEW, PAID, SHIPPED, CANCELLED) as states that decide which transitions are legal: an enum with a method per action that returns the next state or throws `IllegalStateException`, or one class per state. The order delegates `pay()`, `ship()`, `cancel()` to its current state, which replaces scattered `if (status == ...)` checks and makes illegal transitions impossible to express. For complex flows with guards and events, use a state machine library.

### [intermediate] How do lambdas change the classic patterns? {#lambdas-patterns}

Patterns that exist to pass behaviour around shrink to a lambda when the interface has one method: **Strategy** (`Comparator`), **Command** (`Runnable`), **Observer** (a listener lambda), **Template method** (pass the varying step as a function) and parts of **Factory** (`Supplier<T>`). The structure is the same, but you no longer need a named class for each variant. Patterns with state or several methods still need classes.

### [intermediate] Which design patterns appear in the Java Collections framework and java.io? {#jdk-patterns}

Iterator (`Iterable`/`Iterator`), Factory method (`List.of`, `Collections.emptyList`), Decorator (`Collections.unmodifiableList`, `synchronizedList`, `BufferedReader` around a reader), Adapter (`Arrays.asList`, `InputStreamReader`), Strategy (`Comparator`), Template method (`AbstractList`), Flyweight (`Integer.valueOf` cache), Builder (`StringBuilder`), and Singleton (`Runtime.getRuntime()`).

### [deep] How would you implement a thread-safe lazy Singleton and why does double-checked locking need volatile? {#dcl-singleton}

Use the holder idiom: `private static class Holder { static final Config INSTANCE = new Config(); }` with `getInstance()` returning `Holder.INSTANCE`. The JVM initialises `Holder` lazily and exactly once, safely, with no explicit locking. With double-checked locking the field must be `volatile`: `instance = new Config()` is allocate, construct, assign, and without a happens-before edge another thread can see the reference before the constructor's writes. An enum is simplest and also survives serialization and reflection. See [the memory model lesson](lesson:java-memory-model#q-dcl-q).

### [deep] What is the difference between the Observer pattern and publish/subscribe messaging? {#observer-vs-pubsub}

In Observer, the subject holds direct references to its observers and calls them **synchronously in the same process**; the two know each other through an interface. In publish/subscribe, publishers and subscribers are decoupled by a **broker or event bus** (Kafka, RabbitMQ, Spring's event bus), usually asynchronous, with delivery guarantees, persistence and possibly different processes. Observer is an in-process design pattern; pub/sub is the same idea at architecture scale, with extra concerns: ordering, duplicates, retries and idempotent consumers.

### [deep] When are design patterns harmful? {#patterns-harmful}

When they are applied for their own sake. A factory, a strategy and an interface for a problem with one concrete case add classes, indirection and cost to every reader, the "cargo cult" or "pattern fever" anti-pattern. Patterns are also a sign of language limits: many GoF patterns shrink or vanish with lambdas, records, sealed types and pattern matching (Strategy, Command, Visitor). Use a pattern when it solves a problem you actually have, and prefer the simplest code that is easy to change.

### [deep] How would you design a payment module that supports several providers and retries, using patterns? {#design-payment}

Define a `PaymentGateway` interface (the **strategy** or **adapter** abstraction) with one **adapter** per provider that translates its API; choose the provider by method or region with a **factory** or by injecting a map of beans. Add cross-cutting behaviour as **decorators**: `RetryingGateway`, `LoggingGateway`, `CircuitBreakerGateway` stacked around the real one. A **facade** (`PaymentService`) coordinates fraud check, charge and receipt for the checkout, and an **observer** (an event) tells inventory and email that payment succeeded. Keep it idempotent with a request id so retries cannot charge twice.

### [coding] Replace the switch with the Strategy pattern. {#coding-strategy}

```java
Money applyDiscount(Order order, String code) {
    switch (code) {
        case "TEN_OFF":    return order.total().times(0.90);
        case "FREE_SHIP":  return order.total().minus(order.shippingCost());
        case "LOYALTY":    return order.total().minus(order.loyaltyPoints());
        default:           return order.total();
    }
}
```

Every new code edits this method. Turn each branch into a strategy and look it up by code:

```java
interface Discount { Money apply(Order order); }

@Component("TEN_OFF")   class TenOff    implements Discount { public Money apply(Order o) { return o.total().times(0.90); } }
@Component("FREE_SHIP") class FreeShip  implements Discount { public Money apply(Order o) { return o.total().minus(o.shippingCost()); } }
@Component("LOYALTY")   class Loyalty   implements Discount { public Money apply(Order o) { return o.total().minus(o.loyaltyPoints()); } }

@Service
class DiscountService {
    private final Map<String, Discount> discounts;           // Spring injects all Discount beans keyed by bean name
    DiscountService(Map<String, Discount> discounts) { this.discounts = discounts; }

    Money apply(Order order, String code) {
        return discounts.getOrDefault(code, Order::total).apply(order);   // unknown code: no discount
    }
}
```

A new discount is a new class annotated with its code; `DiscountService` is not edited (open/closed), and each strategy is unit-testable on its own. Without Spring, build the map by hand or use an enum whose constants implement `Discount`.

### [coding] Implement a thread-safe Singleton in two ways. {#coding-singleton}

```java
// 1. enum: the simplest, also safe against serialization and reflection
public enum Catalog {
    INSTANCE;
    private final Map<String, Product> products = new ConcurrentHashMap<>();
    public Product find(String sku) { return products.get(sku); }
}

// 2. holder idiom: lazy, no locking in the accessor
public final class Config {
    private Config() { }
    private static final class Holder { static final Config INSTANCE = new Config(); }
    public static Config getInstance() { return Holder.INSTANCE; }
}
```

The enum is created when it is first used, and the JVM guarantees that class initialisation happens once and is visible to all threads. The holder class is not loaded until `getInstance()` is first called, which gives lazy initialisation for free. The mutable state inside a singleton (the map above) must itself be thread-safe, which is why it is a `ConcurrentHashMap`.

### [coding] Add retry and logging to a Notifier without changing it. {#coding-decorator}

```java
interface Notifier { void send(String message); }

class SmsNotifier implements Notifier {
    public void send(String message) { /* call the SMS provider */ }
}
```

Wrap the notifier in decorators that implement the same interface and delegate:

```java
class LoggingNotifier implements Notifier {
    private final Notifier next;
    LoggingNotifier(Notifier next) { this.next = next; }
    public void send(String message) {
        long start = System.nanoTime();
        next.send(message);
        System.out.printf("sent in %d ms%n", (System.nanoTime() - start) / 1_000_000);
    }
}

class RetryingNotifier implements Notifier {
    private final Notifier next;
    private final int attempts;
    RetryingNotifier(Notifier next, int attempts) { this.next = next; this.attempts = attempts; }

    public void send(String message) {
        for (int i = 1; ; i++) {
            try { next.send(message); return; }
            catch (RuntimeException e) { if (i == attempts) throw e; }
        }
    }
}

Notifier notifier = new RetryingNotifier(new LoggingNotifier(new SmsNotifier()), 3);
```

`SmsNotifier` is unchanged, callers still use `Notifier`, and the behaviours can be recombined freely. Point out that the order matters here: with retry outside logging, the log line is written for each attempt; with logging outside retry, once per call. Also that retrying a non-idempotent send can deliver duplicates.
