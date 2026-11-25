---
title: Design patterns — common solutions with Java and Spring examples
nav: Design patterns
slug: design-patterns
summary: What design patterns are, the creational, structural and behavioural patterns interviewers ask about, where you already use them in the JDK and Spring, the enterprise patterns, and the anti-patterns to avoid, with interview questions.
tags: [Design patterns, OOP, Java, Spring]
order: 3
topic: Fundamentals / Object-oriented design
updated: 2026-11-24
subnav: true
---

A **design pattern** is a named, reusable solution to a problem that keeps coming up in object-oriented design.

Most of the value is **vocabulary**. Saying "this is a decorator" tells a colleague the structure, the purpose and the trade-offs in two words.

Interviewers usually ask three things about a pattern:

- What is it?
- Where is a real example in the JDK or Spring?
- Above all, *when should you not use it*?

This lesson covers the patterns that come up most. The code uses an e-commerce model, and each section names places where you have already met the pattern. The lesson builds on the [OOP concepts](lesson:oop-concepts) and [SOLID](lesson:solid-principles) lessons.

The animation shows three patterns at work: Strategy, Observer and Decorator.

```demo
name: patterns-walk
```

> **One sentence to remember:** *A pattern buys flexibility with extra classes, so use it only when you need that flexibility.*

## Patterns in context {#context}

### What a pattern is, and is not {#what-is}

The idea comes from building architecture (Christopher Alexander). The "Gang of Four" (GoF) book of 1994 applied it to software and describes **23 patterns**.

A pattern description has four parts:

- a **name**,
- the **problem** it solves,
- the **structure** of the solution,
- and its **consequences**, good and bad.

A pattern is a template, not code you can copy. You adapt it each time you use it. Patterns are discovered, not invented: they record solutions that experienced developers kept reaching for.

### The three categories {#categories}

| Category | What it is about | GoF patterns |
| --- | --- | --- |
| **Creational** | How objects are created. | Singleton, Factory Method, Abstract Factory, Builder, Prototype. |
| **Structural** | How objects are combined into larger structures. | Adapter, Decorator, Proxy, Facade, Composite, Bridge, Flyweight. |
| **Behavioural** | How objects talk to each other and share work. | Strategy, Observer, Template Method, Command, Iterator, State, Chain of Responsibility, Visitor, Mediator, Memento, Interpreter. |

You do not need all 23. Know these ones well: **Singleton, Factory, Builder, Adapter, Decorator, Proxy, Facade, Strategy, Observer and Template Method**, plus the Spring-style enterprise patterns.

## Creational patterns {#creational}

### Singleton {#singleton}

**Purpose:** a class has exactly one object, and everyone can reach it. In Java, the safest way to write one is an `enum` with a single constant:

```java
public enum AppConfig {
    INSTANCE;
    private final Properties props = load();
    public String get(String key) { return props.getProperty(key); }
}
// AppConfig.INSTANCE.get("currency")
```

Two other ways:

- The **holder idiom** is lazy (it creates the object only when first needed) and thread-safe without locks. A private static nested class holds the instance, and Java creates it the first time it is used.
- Lazy **double-checked locking** works only with a `volatile` field ([why](lesson:java-memory-model#dcl)).

Be ready to criticise the pattern:

- A singleton is **global state that can change**, and code that uses it has a hidden dependency.
- That makes code harder to test, because you cannot swap the singleton for a fake.
- "One" means only one **per class loader**.

A **Spring singleton bean** is not the GoF singleton. It is one object per application context, created and injected by the container. The class itself stays ordinary and testable, so prefer it.

### Factory method and abstract factory {#factory}

**Purpose:** create objects without writing the concrete class name in the calling code, so the caller is not tied to that class. In Java the everyday form is the **static factory method**:

```java
List<String> names = List.of("a", "b");            // returns an immutable list implementation you never see
Integer n = Integer.valueOf(127);                    // may return a cached instance (flyweight)
NumberFormat f = NumberFormat.getInstance(locale);   // the concrete class depends on the locale
```

Its advantages over `new` (Effective Java, item 1):

1. It has a **name** that explains it, such as `Money.ofCents(500)`.
2. It does not have to create a new object each time, so it can cache.
3. It can return a **subtype**.
4. Callers depend only on the interface.

Two GoF variants:

- The **factory method** lets a subclass choose which class to create.
- The **abstract factory** creates **families** of related objects that belong together. Examples are a UI toolkit that makes matching buttons and menus for each platform, and `DocumentBuilderFactory`.

In Spring, the container itself is a factory (`BeanFactory`), and `@Bean` methods are factory methods.

### Builder {#builder}

**Purpose:** build a complex object step by step, keeping the building separate from the finished object.

It solves the "telescoping constructor" problem: a series of constructors with more and more optional parameters, often of the same type, so calls are hard to read. A builder gives readable code, keeps all the checks in one place and can create **immutable** objects:

```java
Order order = Order.builder()
        .customerId("C-42")
        .addLine("SKU-1", 2)
        .addLine("SKU-7", 1)
        .shippingMethod(ShippingMethod.EXPRESS)
        .build();                    // build() validates, then returns an immutable Order
```

Examples in the JDK and libraries: `StringBuilder`, `Stream.builder()`, `HttpRequest.newBuilder()`, `Calendar.Builder` and Lombok's `@Builder`.

Use it when a class has many optional fields. For two or three parameters, a constructor or a record is simpler.

### Prototype {#prototype}

**Purpose:** create new objects by copying an existing one.

In Java that means `clone()`, which is flawed, or better, a **copy constructor** or a copy method. It helps when creating an object is expensive, or when you want a variation of a prepared template. An example is copying a filled-in order for "order again".

Spring's `prototype` bean scope (a new object each time the bean is requested) uses the word in a different sense.

## Structural patterns {#structural}

### Adapter {#adapter}

**Purpose:** make one interface look like another one that the client expects, so classes that do not fit together can work together. Think of a travel plug adapter.

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

JDK examples: `Arrays.asList` (an array seen as a `List`), `InputStreamReader` (bytes seen as characters) and `Collections.enumeration`.

It is the usual way to keep a third-party or old API from spreading into your own domain code.

### Decorator {#decorator}

**Purpose:** add behaviour to an object while the program runs, by **wrapping** it in another object with the same interface. It is an alternative to writing subclasses.

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

JDK examples: all of `java.io`, such as `new BufferedReader(new InputStreamReader(new FileInputStream(f)))`, and `Collections.unmodifiableList` and `synchronizedList`.

It avoids a subclass for every combination, such as `RetryingLoggingEmailNotifier`, and it follows the open/closed principle. The cost: many small classes, and the order of wrapping matters.

### Proxy {#proxy}

**Purpose:** put a stand-in object in front of another object to **control access** to it. The stand-in has the same interface.

The client calls the proxy. The proxy decides whether and how to call the real object. It can create the object only when needed, check security, cache results, call a remote machine, log, or run a transaction.

- A **JDK dynamic proxy** (`java.lang.reflect.Proxy`) is generated while the program runs, for **interfaces**. **CGLIB** and **ByteBuddy** generate a **subclass** as a proxy, for classes.
- **Spring AOP** is built on proxies. `@Transactional`, `@Async`, `@Cacheable` and `@PreAuthorize` all work because Spring wraps your bean in a proxy. For `@Transactional`, the proxy starts the transaction, calls your method, then commits or rolls back.
- **Hibernate** returns proxies for entities and collections that it loads lazily.

The classic trap comes from how proxies work. A call **from one method of a bean to another method of the same bean** (`this.save()`) does not go through the proxy. So `@Transactional` or `@Cacheable` on the inner method is silently ignored. The fix is to call through the proxy, for example by moving the method to another bean.

**Decorator versus proxy:** the structure is almost the same, but the purpose differs. A decorator **adds behaviour** that the caller chose to combine. A proxy **controls access**, and the caller usually does not see it.

### Facade {#facade}

**Purpose:** give a simple interface to a complex subsystem.

Example: placing an order needs calls to stock, payment, tax and shipping, in the right order, with a way to undo them if something fails. An `OrderFacade.placeOrder(cart)` hides all that, so the controller makes one call.

An **API gateway** is a facade at the architecture level, and `JdbcTemplate` is a facade over plain JDBC. The risk: the facade grows into a God class that knows everything.

### Composite {#composite}

**Purpose:** treat single objects and groups of objects the same way, in tree structures.

Example: a product **bundle** is a product whose price is the sum of its parts. Callers do not care whether they hold a single item or a bundle:

```java
interface Priced { Money price(); }
record Item(Money price) implements Priced { }
record Bundle(List<Priced> parts) implements Priced {
    public Money price() { return parts.stream().map(Priced::price).reduce(Money.ZERO, Money::plus); }
}
```

Other examples: a file system (files and folders), UI component trees (Swing, React-style trees) and category trees.

### Flyweight {#flyweight}

**Purpose:** share objects to save memory when there are very many identical ones.

`Integer.valueOf` caches the values from -128 to 127, and the [string pool](lesson:java-memory-model#string-pool) shares equal string literals. The shared objects must be immutable.

### Bridge {#bridge}

**Purpose:** separate an abstraction from its implementation, so the two can change independently.

Example: several `Notification` types, each of which can be sent by email, SMS or push. It looks like composition, and it is mainly worth recognising by name.

## Behavioural patterns {#behavioural}

### Strategy {#strategy}

**Purpose:** put a family of interchangeable algorithms behind one interface, and let the caller pick one while the program runs. It is the pattern behind the open/closed principle:

```java
interface DiscountStrategy { Money apply(Money total); }

class Cart {
    private DiscountStrategy discount;
    Cart(DiscountStrategy discount) { this.discount = discount; }
    Money total() { return discount.apply(subtotal()); }       // no if/else on the rule type
}

new Cart(total -> total.times(0.9));                            // a lambda is a strategy for a one-method interface
```

Examples in the JDK and Spring:

- `Comparator`: the sort order is a strategy passed to `sort`.
- The rejection policies of `ThreadPoolExecutor`.
- Spring Security's `PasswordEncoder`.

Since Java 8, a lambda can replace a strategy class that has one method. The first animation scene shows a strategy being swapped.

### Observer {#observer}

**Purpose:** when something happens in one object, notify any number of other objects, without the source knowing who they are. It is a one-to-many link with low coupling.

```java
interface OrderListener { void onPlaced(Order order); }

class OrderService {
    private final List<OrderListener> listeners = new CopyOnWriteArrayList<>();
    void subscribe(OrderListener l) { listeners.add(l); }
    void place(Order o) { save(o); listeners.forEach(l -> l.onPlaced(o)); }   // email, stock, analytics...
}
```

Examples in the JDK and Spring: `PropertyChangeListener` and Swing listeners, the reactive `Flow` API (Java 9), and Spring's `ApplicationEventPublisher` with `@EventListener`. (`java.util.Observable` has been deprecated since Java 9.)

Watch out for three problems:

- Listeners **leak memory** when nobody unsubscribes them (see [memory leaks](lesson:garbage-collector#problems)).
- A slow or failing listener can delay or break the others.
- The flow is hard to trace.

Between services, the same idea is called publish/subscribe messaging.

### Template method {#template-method}

**Purpose:** fix the **skeleton** of an algorithm in a base class, and let subclasses fill in some steps without changing their order.

The base class calls the steps. This is the "Hollywood principle": don't call us, we'll call you.

```java
abstract class ReportJob {
    final void run() { var data = load(); var out = format(data); deliver(out); }   // fixed skeleton
    protected abstract List<Order> load();
    protected abstract String format(List<Order> data);
    protected void deliver(String out) { System.out.println(out); }                // a hook with a default
}
```

Examples in the JDK and Spring: `HttpServlet.service` calling `doGet` or `doPost`, `AbstractList`, and `JdbcTemplate` (which uses callbacks instead of subclasses).

The pattern uses **inheritance**. When the part that varies is a whole algorithm, the strategy pattern, which uses composition, is the more flexible choice.

### Command {#command}

**Purpose:** turn a request into an object, so it can be queued, logged, retried or undone.

`Runnable` and `Callable` are commands, and a task queue or a thread pool runs commands. In an e-commerce back office, an editable cart could use an `AddItemCommand` and an `ApplyCouponCommand`, each with `execute()` and `undo()`.

Message-driven systems distinguish commands ("do this") from events ("this happened").

### Iterator {#iterator}

**Purpose:** walk through a collection without exposing how it is built. Java builds this into the language with `Iterable`, `Iterator` and the enhanced `for` loop.

Most collection iterators are **fail-fast**. They throw `ConcurrentModificationException` if the collection changes while you loop over it. Iterators of concurrent collections are **weakly consistent** instead: they do not throw, but they may not show the latest changes.

### State {#state}

**Purpose:** let an object change its behaviour when its internal state changes. It replaces large `switch` statements on a status field.

Example: an order moves through `NEW`, `PAID`, `SHIPPED` and `CANCELLED`, and which actions are allowed depends on the state:

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

For complex lifecycles, use a state machine library such as Spring Statemachine.

State looks like Strategy, with one difference. In State, the object changes its own behaviour as it moves between states. In Strategy, the client picks the behaviour.

### Chain of responsibility {#chain}

**Purpose:** pass a request along a chain of handlers, until one handles it or each one has done its part.

**Servlet filters**, Spring's `HandlerInterceptor` and the **Spring Security filter chain** are all chains. A request passes through authentication, then authorisation, then logging, then reaches the controller. Each handler decides whether to pass the request on (`chain.doFilter(...)`). This makes concerns that apply to many requests easy to plug in and reorder.

### Visitor {#visitor}

**Purpose:** add new operations to a class hierarchy without changing the classes. It uses **double dispatch**: the method that runs depends on two types, the element's and the visitor's.

It is awkward in Java, because every element needs an `accept(visitor)` method. With **sealed types and pattern-matching `switch`** (Java 21), the same job is usually simpler: a `switch` over a sealed hierarchy, which the compiler checks for completeness (see [sealed hierarchies](lesson:oop-concepts#sealed)).

`FileVisitor` in `java.nio.file` is the JDK example.

### Mediator, memento and interpreter {#minor-behavioural}

A short note on each, so the names are not new:

- A **mediator** handles how a group of objects talk to each other, in one central place. Examples are a chat room and an air-traffic controller. `ExecutorService` coordinates tasks in a similar way.
- A **memento** saves an object's state and restores it later, for example as undo snapshots.
- An **interpreter** evaluates a small language, such as a regular expression or a SpEL expression.

## Enterprise and Spring patterns {#enterprise}

The patterns you use every day in a Java back end often do not come from the GoF book:

| Pattern | Idea | Where you see it |
| --- | --- | --- |
| **Dependency injection** | Objects receive their collaborators instead of creating them. | The Spring container and constructor injection. |
| **Inversion of control** | The framework calls your code. | Spring and servlet containers. |
| **MVC and front controller** | One entry point sends each request to a controller, and views are kept separate from models. | Spring's `DispatcherServlet`. |
| **Service layer** | A layer between the controller and the data, where transactions and business operations start and end. | `@Service` classes. |
| **Repository** | Access to stored objects that looks like a collection, hiding how they are stored. | Spring Data `JpaRepository`. |
| **DAO** | An object that holds the data-access code for one entity. | Older JDBC and JPA code. |
| **DTO** | A plain object shaped for sending over the network, separate from the domain entity. | API request and response classes, often records. |
| **Unit of work** | Track changes to objects and write them all in one transaction. | The JPA `EntityManager` or the Hibernate session. |
| **Specification** | Business rules as objects that can be combined. | Spring Data `Specification`. |
| **Aggregate root** | A group of objects with one entry point that enforces their rules. | In domain-driven design, an `Order` with its lines. |

Microservices have a separate family of patterns: saga, outbox, CQRS, circuit breaker, API gateway, retry with back-off and idempotency. They apply the same ideas at the architecture level.

## Anti-patterns {#anti-patterns}

An **anti-pattern** is a common solution that looks reasonable but causes more problems than it solves.

| Anti-pattern | The problem |
| --- | --- |
| **God object or blob** | One class knows and does everything. |
| **Singleton abuse** | Global state that can change is hidden behind `getInstance()`. |
| **Golden hammer** | You use your favourite pattern or tool for every problem. |
| **Pattern fever or over-engineering** | Factories, strategies and layers for a problem that needed one `if`. |
| **Service locator** | Classes look up their dependencies in a global registry, so the dependencies are hidden and hard to test. |
| **Anemic domain model** | Entities hold only data, and all the rules sit in services. |
| **Spaghetti code** | The control flow is tangled and has no structure. |
| **Magic numbers and strings** | Unexplained literal values are scattered through the code. |
| **Copy-paste programming** | Logic is duplicated, so a fix must be made in many places. |
| **Premature optimisation** | Code is made complicated for a speed problem nobody has measured. |
| **Cargo cult** | A pattern is used because others use it, without understanding the problem. |

## Patterns and SOLID {#patterns-solid}

| Pattern | The principle it serves |
| --- | --- |
| Strategy, Decorator, Template method | Open/closed. |
| Factory, dependency injection | Dependency inversion. |
| Adapter, Facade | Dependency inversion and interface segregation. |
| Observer | Low coupling between the publisher and the subscribers. |
| Composite | Liskov substitution: a group is used like a single item. |
| Command | Single responsibility: a request becomes its own object. |

## Choosing a pattern {#choosing}

Start from the **problem**, not from the pattern:

| If you need to... | Consider |
| --- | --- |
| create objects without naming the concrete class | Factory method. |
| build an object with many optional fields | Builder. |
| have exactly one shared object | A Spring singleton bean, or an enum singleton. |
| use an API whose interface does not fit | Adapter. |
| add behaviour in layers, chosen while the program runs | Decorator. |
| control or intercept access to an object | Proxy. |
| hide a complicated subsystem behind one call | Facade. |
| swap an algorithm | Strategy. |
| react to events without tight coupling | Observer. |
| fix the steps of a procedure but vary some of them | Template method. |
| queue, retry or undo operations | Command. |
| change behaviour with a lifecycle status | State. |
| pass a request through ordered handlers | Chain of responsibility. |

Try it in the lab: [Strategy and Factory replace an if-else chain](lab:pattern-strategy-factory).

## Cheat sheet {#cheatsheet}

| Pattern | Category | In one line | JDK or Spring example |
| --- | --- | --- | --- |
| Singleton | Creational | One object only. | An enum; a Spring singleton bean. |
| Factory method | Creational | Create without naming the class. | `List.of`, `Integer.valueOf`. |
| Builder | Creational | Build step by step. | `StringBuilder`, `HttpRequest.newBuilder()`. |
| Adapter | Structural | Convert one interface to another. | `Arrays.asList`, `InputStreamReader`. |
| Decorator | Structural | Wrap to add behaviour. | `BufferedReader`, `unmodifiableList`. |
| Proxy | Structural | Control access. | Spring AOP, Hibernate lazy loading. |
| Facade | Structural | A simple front for a subsystem. | `JdbcTemplate`, an API gateway. |
| Strategy | Behavioural | A swappable algorithm. | `Comparator`. |
| Observer | Behavioural | Notify subscribers. | `@EventListener`, `Flow`. |
| Template method | Behavioural | A fixed skeleton with variable steps. | `HttpServlet`, `JdbcTemplate`. |
| Chain of responsibility | Behavioural | Ordered handlers. | Servlet filters, Spring Security. |
| State | Behavioural | Behaviour depends on the state. | An order lifecycle. |

## Interview questions {#questions}

### [basic] What is a design pattern, and why use one? {#what-is-pattern}

A design pattern is a named, reusable solution to a design problem that keeps coming up. It is described by its purpose, its structure and its consequences.

Why use them:

1. They give developers a shared vocabulary ("use a decorator here").
2. They capture solutions that are known to work.
3. They help you recognise the structure of existing code.

They are templates to adapt, not code to copy. They are also not free: each one adds a layer of indirection, so use a pattern only for a real need.

### [basic] What are the types of design patterns? {#types-of-patterns}

The Gang of Four describe 23 patterns in three categories:

- **Creational** patterns deal with creating objects: Singleton, Factory, Abstract Factory, Builder and Prototype.
- **Structural** patterns combine objects into larger structures: Adapter, Decorator, Proxy, Facade, Composite, Bridge and Flyweight.
- **Behavioural** patterns deal with how objects communicate and share work: Strategy, Observer, Template method, Command, Iterator, State, Chain of responsibility, Visitor and others.

### [basic] How do you implement a Singleton in Java, and what are its drawbacks? {#singleton-q}

The simplest robust way is an `enum` with one constant. Two other ways:

- The **holder idiom**: a private static nested class holds the instance. Java creates it lazily and safely the first time the class is used.
- **Double-checked locking**, which needs a `volatile` field.

The drawbacks:

1. It is global state that can change, and it hides a dependency.
2. It is hard to test or replace.
3. "One" means one per class loader.
4. Reflection or serialization can create a second object. An enum prevents both.

A Spring singleton bean is a better approach: one object per container, injected and testable.

### [basic] What is the difference between the Factory and Abstract Factory patterns? {#factory-vs-abstract}

- A **factory method** creates objects of **one** product type, and lets the concrete class vary. It can be a static factory such as `List.of`, or a method that a subclass overrides.
- An **abstract factory** is an object that creates a **family** of related products that belong together, such as the whole set of widgets for one look and feel.

So a factory method is about one product, and an abstract factory is about consistent groups of products.

### [basic] What is the Builder pattern, and when would you use it? {#builder-q}

It builds a complex object step by step through a chain of method calls, and finishes with `build()`.

Use it when a class has many parameters, especially optional ones:

- It avoids telescoping constructors and calls that are hard to read.
- It can create immutable objects, with all the checks in `build()`.

Examples: `StringBuilder`, `HttpRequest.newBuilder()` and Lombok's `@Builder`. For two or three parameters, a constructor or a record is simpler.

### [basic] Explain the Strategy pattern with an example. {#strategy-q}

Put a family of algorithms behind one interface, make them interchangeable, and let the client choose one while the program runs.

Example: a `Cart` holds a `DiscountStrategy`. Percentage off, loyalty tier and buy-one-get-one-free are separate implementations. The cart calls `apply(total)` with no `if/else` on the rule type.

`Comparator` is the JDK's example. The pattern supports the open/closed principle, and since Java 8 a lambda can be the strategy.

### [basic] Explain the Observer pattern. Where is it used? {#observer-q}

A subject keeps a list of observers and notifies them when something happens. The subject does not need to know who they are or how many there are.

Where it is used:

- GUI listeners and `PropertyChangeListener`.
- Spring's `ApplicationEventPublisher` and `@EventListener`.
- Reactive streams.
- Between services, as publish/subscribe messaging.

Risks: listeners leak if nobody removes them, and a slow or failing observer can affect the others.

### [basic] What is the Adapter pattern? {#adapter-q}

It converts the interface of a class into another interface that the client expects. Classes whose interfaces do not fit can then work together.

Example: a `LegacyBankAdapter` implements your `PaymentGateway` interface and translates each call into a call to the vendor's `LegacyBankClient`.

JDK examples: `Arrays.asList` and `InputStreamReader`. An adapter also keeps third-party APIs from spreading into your domain code.

### [basic] What is the Decorator pattern, and how does it differ from inheritance? {#decorator-q}

A decorator wraps an object that has the same interface. It adds behaviour before or after passing the call on, and decorators can be stacked. Example: `new BufferedReader(new InputStreamReader(in))`.

The difference from inheritance:

- Inheritance fixes the extra behaviour at compile time, and needs a subclass for each combination.
- Decorators combine behaviours while the program runs, and they follow the open/closed principle.

The cost is many small classes, and the result depends on the order of wrapping.

### [intermediate] What is the difference between Decorator and Proxy? {#decorator-vs-proxy}

They look alike: both implement the target's interface and pass calls on to it. The **purpose** is what differs.

- A **decorator adds responsibilities**, and the caller usually builds the stack on purpose.
- A **proxy controls access** to the real object. It can load lazily, check security, cache, make remote calls or run transactions. It is usually invisible to the caller, who often does not know it exists.

Spring AOP and Hibernate lazy loading use proxies.

### [intermediate] How does Spring use the Proxy pattern, and what is the self-invocation problem? {#spring-proxy}

For `@Transactional`, `@Async`, `@Cacheable` and the security annotations, Spring wraps the bean in a proxy. The proxy is a JDK dynamic proxy for interfaces, or a CGLIB or ByteBuddy subclass otherwise. It adds the transaction or caching behaviour around each call.

A call from outside the bean goes through the proxy. But a call from one method to another **inside the same bean** (`this.other()`) skips the proxy, so the annotation on the second method is ignored. This is the self-invocation problem.

The fixes: move the method to another bean, inject a reference to the proxy, or restructure the code.

### [intermediate] What is the difference between Strategy and State? {#strategy-vs-state}

Both pass behaviour to an interchangeable object, and their class diagrams are almost identical. The difference is who changes the behaviour, and why.

- In **Strategy**, the **client** picks the algorithm, and it stays until someone changes it. Strategies usually do not know about each other.
- In **State**, the **object itself** switches between states as it runs. The states know about the moves between them. The behaviour changes because of the lifecycle, such as an order that is NEW, PAID or SHIPPED, not because the client chose it.

### [intermediate] What is the Template Method pattern, and how does it differ from Strategy? {#template-vs-strategy}

Template method fixes the skeleton of an algorithm in a base class and lets subclasses supply some steps. It uses **inheritance**, and the base class calls the subclass, not the other way round.

Strategy puts the part that varies into a separate object that is **composed** in.

- Strategy is more flexible: you can change it while the program runs, and you need no subclass per variant.
- Template method is simple when a family of classes shares a fixed procedure.

Spring's `JdbcTemplate` takes the template idea but uses callbacks instead of subclasses.

### [intermediate] Where do you see the Chain of Responsibility pattern in Java web applications? {#chain-q}

In **servlet filters** and in the **Spring Security filter chain**.

A request passes through ordered handlers, such as authentication, authorisation, CORS and logging. Each handler either handles the request, rejects it, or calls `chain.doFilter` to pass it on. Spring MVC's `HandlerInterceptor`s work in a similar way.

The pattern makes these shared concerns easy to plug in and reorder. The order matters: authenticate before you authorise.

### [intermediate] Singleton scope in Spring versus the Singleton pattern. {#spring-singleton}

- Spring's default scope creates **one object per application context** for each bean definition, and the container manages it.
- The GoF pattern forces one object per JVM (strictly, per class loader) from inside the class itself, with a private constructor and a static accessor.

Spring's version leaves classes ordinary, injectable and testable, and it also offers other scopes: prototype, request and session.

A Spring singleton is still shared between threads, so it must be **stateless or thread-safe**.

### [intermediate] What are the problems with the Singleton pattern in tests and with concurrency? {#singleton-problems}

**In tests:**

- You cannot easily replace a global object with a fake.
- State left by one test leaks into the next one.
- Code that calls `Config.getInstance()` hides its dependency.

**With concurrency:**

- A lazily created singleton needs safe publication, meaning other threads must see it fully built. Use the holder idiom, an enum, or `volatile` with double-checked locking.
- Any state inside the singleton that can change must itself be thread-safe.

Prefer injecting one shared object.

### [intermediate] What is the difference between DTO, DAO, Repository and entity? {#dto-dao-repo}

- An **entity** is a domain object with an identity, mapped to storage.
- A **DAO** (data access object) wraps the data-access operations for one table or entity.
- A **repository** offers a collection-like interface for an aggregate, written in domain terms, such as `orders.findByCustomer(...)`. It hides persistence completely, which is what Spring Data gives you.
- A **DTO** (data transfer object) is a simple object shaped for sending, such as a request or response body. It keeps internal entities from leaking through the API.

### [intermediate] When is a Facade appropriate, and what is the risk? {#facade-q}

Use a facade when callers need one simple operation that involves several subsystems in a set order.

Example: placing an order touches stock, payment, tax and shipping. The facade offers `placeOrder` and hides the coordination. It reduces how much callers depend on the subsystems.

The risk is that it grows into a God class that knows everything. Keep it thin, and let each subsystem keep its own logic.

### [intermediate] How would you implement an order lifecycle with the State pattern? {#state-q}

1. Model each status (NEW, PAID, SHIPPED, CANCELLED) as a state that decides which moves are allowed.
2. Use an enum with one method per action. Each method returns the next state, or throws `IllegalStateException`. One class per state also works.
3. Let the order pass `pay()`, `ship()` and `cancel()` to its current state.

This replaces scattered `if (status == ...)` checks, and it makes illegal moves impossible to write. For complex flows with conditions and events, use a state machine library.

### [intermediate] How do lambdas change the classic patterns? {#lambdas-patterns}

Patterns that exist to pass behaviour around shrink to a lambda when the interface has one method:

- **Strategy**, for example a `Comparator`.
- **Command**, for example a `Runnable`.
- **Observer**, as a listener lambda.
- **Template method**, by passing the varying step as a function.
- Parts of **Factory**, as a `Supplier<T>`.

The structure is the same, but you no longer need a named class for each variant. Patterns with state or with several methods still need classes.

### [intermediate] Which design patterns appear in the Java Collections framework and java.io? {#jdk-patterns}

- **Iterator:** `Iterable` and `Iterator`.
- **Factory method:** `List.of` and `Collections.emptyList`.
- **Decorator:** `Collections.unmodifiableList`, `synchronizedList`, and `BufferedReader` around a reader.
- **Adapter:** `Arrays.asList` and `InputStreamReader`.
- **Strategy:** `Comparator`.
- **Template method:** `AbstractList`.
- **Flyweight:** the `Integer.valueOf` cache.
- **Builder:** `StringBuilder`.
- **Singleton:** `Runtime.getRuntime()`.

### [deep] How would you implement a thread-safe lazy Singleton and why does double-checked locking need volatile? {#dcl-singleton}

Use the holder idiom: `private static class Holder { static final Config INSTANCE = new Config(); }`, with `getInstance()` returning `Holder.INSTANCE`. The JVM initialises `Holder` lazily, exactly once and safely, with no explicit locks.

Double-checked locking needs a `volatile` field, because `instance = new Config()` is three steps: reserve memory, run the constructor, assign the reference. Without a **happens-before** guarantee (a rule that one thread's writes are visible to another), another thread can see the reference before the constructor's writes.

An enum is the simplest option, and it also survives serialization and reflection. See [the memory model lesson](lesson:java-memory-model#q-dcl-q).

### [deep] What is the difference between the Observer pattern and publish/subscribe messaging? {#observer-vs-pubsub}

- In **Observer**, the subject holds direct references to its observers and calls them **synchronously, in the same process**. The two sides know each other through an interface.
- In **publish/subscribe**, a **broker or event bus** (Kafka, RabbitMQ, Spring's event bus) sits between publishers and subscribers. Delivery is usually asynchronous. There are delivery guarantees and storage, and the two sides may run in different processes.

Observer is a design pattern inside one process. Pub/sub is the same idea at the scale of an architecture, with extra concerns: ordering, duplicates, retries and consumers that can safely process a message twice (idempotent consumers).

### [deep] When are design patterns harmful? {#patterns-harmful}

When they are used for their own sake.

A factory, a strategy and an interface for a problem that has one concrete case add classes and layers, and every reader pays for them. This is the "cargo cult" or "pattern fever" anti-pattern.

Patterns can also be a sign of language limits. Many GoF patterns shrink or disappear with lambdas, records, sealed types and pattern matching, for example Strategy, Command and Visitor.

Use a pattern when it solves a problem you actually have, and prefer the simplest code that is easy to change.

### [deep] How would you design a payment module that supports several providers and retries, using patterns? {#design-payment}

1. Define a `PaymentGateway` interface. It is the **strategy** or **adapter** abstraction.
2. Write one **adapter** per provider that translates its API.
3. Choose the provider by payment method or region, with a **factory** or by injecting a map of beans.
4. Add shared behaviour as **decorators**: a `RetryingGateway`, a `LoggingGateway` and a `CircuitBreakerGateway` stacked around the real gateway.
5. A **facade**, `PaymentService`, coordinates the fraud check, the charge and the receipt for the checkout.
6. An **observer** (an event) tells stock and email that the payment succeeded.

Make the charge idempotent with a request id, so a retry can never charge the customer twice.

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

Every new discount code means editing this method. Turn each branch into a strategy, and look it up by its code:

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

A new discount is a new class annotated with its code. `DiscountService` is not edited (open/closed), and each strategy can be unit-tested on its own.

Without Spring, build the map by hand, or use an enum whose constants implement `Discount`.

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

Why both are safe:

- The enum is created when it is first used. The JVM guarantees that a class is initialised once, and that all threads see the result.
- The `Holder` class is not loaded until `getInstance()` is first called, so you get lazy creation for free.

The state inside a singleton that can change (the map above) must itself be thread-safe. That is why it is a `ConcurrentHashMap`.

### [coding] Add retry and logging to a Notifier without changing it. {#coding-decorator}

```java
interface Notifier { void send(String message); }

class SmsNotifier implements Notifier {
    public void send(String message) { /* call the SMS provider */ }
}
```

Wrap the notifier in decorators that implement the same interface and pass the call on:

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

`SmsNotifier` is unchanged, callers still use `Notifier`, and the behaviours can be recombined freely.

Point out two details:

- The order matters. With retry outside logging, a log line is written for each attempt. With logging outside retry, it is written once per call.
- Retrying a send that is not idempotent can deliver duplicate messages.
