---
title: Reflection, annotations and dynamic proxies — how Java frameworks work
nav: Reflection and proxies
slug: java-reflection
summary: How Java code inspects and uses types at run time: the Class object, fields, methods and constructors, setAccessible and the module system, annotations and their retention, writing and reading a custom annotation, compile-time annotation processing, JDK dynamic proxies and CGLIB, method handles, and how Spring, Jackson, Hibernate and Mockito use all of it, with examples and interview questions.
tags: [Java, Reflection, Annotations, Proxies, Spring, Frameworks]
order: 11
topic: Java / Language
updated: 2026-11-16
subnav: true
---

Most of the "magic" in Spring, Jackson, Hibernate and JUnit is three plain Java features. **Reflection** lets code look at a class and use it without knowing it at compile time. **Annotations** attach metadata to code. **Dynamic proxies** generate a class at run time that stands in for another object. Interviews ask *how `@Autowired` or `@Transactional` actually works, what a proxy is, why a final class cannot be proxied, what `setAccessible` does and what it costs, and how annotations are read.* It is the lesson that connects the Java lessons with the [Spring](lesson:spring-core) ones. Play the four scenes: reflection, annotations, a dynamic proxy and the way Spring uses them.

```demo
name: reflection-walk
```

> **One sentence to remember:** *Reflection finds and calls code by name at run time, an annotation is only data that some framework reads through reflection, and a dynamic proxy is a generated class that forwards every call to a handler, which is how a framework adds behaviour such as transactions without touching your code.*

## The Class object {#class-object}

Every loaded type has exactly one `Class` object **per class loader**. It is the entry point of reflection and describes the type: its name, modifiers, superclass, interfaces, fields, methods, constructors, annotations and generic signatures.

```java
Class<?> a = Account.class;                       // from a type, checked at compile time
Class<?> b = account.getClass();                  // from an instance: the real, run-time class
Class<?> c = Class.forName("com.bank.Account");   // from a string: loads and initialises it

a.getName();             // "com.bank.Account"
a.getSimpleName();       // "Account"
a.getSuperclass();       // class java.lang.Object
a.getInterfaces();       // the interfaces it implements
Modifier.isFinal(a.getModifiers());
```

`Class.forName` **initialises** the class (runs static initialisers). `ClassLoader.loadClass` only loads it. A name that cannot be found gives `ClassNotFoundException` (see [class loading](lesson:jvm-troubleshooting#classloading)).

## Using reflection {#using}

```java
Class<?> type = Class.forName("com.bank.Account");

// create an instance
Object account = type.getDeclaredConstructor(String.class).newInstance("ACC-1001");

// call a method
Method deposit = type.getMethod("deposit", long.class);
deposit.invoke(account, 500L);

// read and write a field, even a private one
Field balance = type.getDeclaredField("balance");
balance.setAccessible(true);
long value = (long) balance.get(account);
balance.set(account, 900L);
```

Things that catch people out:

| Detail | Explanation |
| --- | --- |
| `getMethods()` vs `getDeclaredMethods()` | `getMethods()` returns **public** methods, including inherited ones. `getDeclaredMethods()` returns **all** methods declared by **this class only**, private included, not inherited ones. The same applies to fields and constructors |
| `InvocationTargetException` | an exception thrown **by the called method** is wrapped. Call `getCause()` (or `getTargetException()`) to see the real one |
| primitive types | the parameter type is `long.class`, not `Long.class`; arguments are boxed and unboxed for you |
| generic types | erased at run time, but the signatures are kept in class metadata: `getGenericSuperclass()` and `getGenericReturnType()` return them (see [erasure](lesson:java-generics#erasure)). This is how Jackson's `TypeReference` works |
| parameter names | **not** available unless compiled with `-parameters`. Spring Boot's build plugins enable it, which is why `@RequestParam` and constructor binding work without names |
| records | the fields are final and `setAccessible` does **not** let you write them |
| arrays | `Array.newInstance(type, 3)` and `Array.get` / `Array.set` |

### Access and the module system {#access}

`setAccessible(true)` switches off the Java access check for that one `Field`, `Method` or `Constructor` object, so private members can be read and called. It used to work everywhere. Since [Java 9](lesson:java-version-history#java-9) the **module system** controls it, and in [Java 16](lesson:java-version-history#java-16) and [Java 17](lesson:java-version-history#java-17) the JDK's own internals became strongly encapsulated:

- for **your own code on the class path** it still works;
- for classes inside a **named module** it works only if the package is `opens` to the caller (in `module-info.java`, or at the command line with `--add-opens java.base/java.lang=ALL-UNNAMED`);
- for **JDK internals** it throws `InaccessibleObjectException` unless the package is explicitly opened. This is why old libraries fail on Java 17 with *"Unable to make field private ... accessible"*, and the fix is to **upgrade the library** (an `--add-opens` flag is only a stopgap);
- changing **final** fields through reflection is unreliable, because the JIT may have inlined the value, and newer Java versions warn about it (JEP 500) and plan to forbid it.

### The cost and the limits {#costs}

Reflection is powerful, and it has a price:

- **Type safety is lost.** A wrong name or parameter type fails at run time, not at compile time, and a rename in the IDE does not update strings.
- **Encapsulation is bypassed**, so code can depend on private details that change.
- **Speed.** A lookup (`getMethod`) is slow and should be done once and cached; the call itself is much cheaper than it used to be, because [Java 18](lesson:java-version-history#java-18) reimplemented core reflection on top of method handles (JEP 416). A reflective call is still slower than a direct one because the JIT can optimise it less.
- **Native images and AOT.** GraalVM native image analyses the program at build time and removes what it cannot see being used, so every class used only through reflection must be **registered** in advance (Spring generates these hints for you; see [Spring Boot 3](lesson:spring-boot-3)).
- **Security.** Reflection can break invariants, so a security-sensitive class must not trust that its private fields are untouched.

The rule: use reflection in **framework and infrastructure code**, cache the lookups, and keep it out of ordinary business logic.

### Method handles {#method-handles}

`MethodHandle` (since Java 7) is the typed, faster cousin of `Method`. You get one from a `Lookup`, which checks access at the point of the lookup and not at every call:

```java
MethodHandles.Lookup lookup = MethodHandles.lookup();
MethodHandle handle = lookup.findVirtual(Account.class, "deposit", MethodType.methodType(void.class, long.class));
handle.invoke(account, 500L);
```

When a handle is stored in a `static final` field the JIT can inline the call almost like a direct one. `VarHandle` does the same for fields with memory-ordering control (it replaced much of `Unsafe`). Lambdas and method references are built on `invokedynamic` and `LambdaMetafactory` (see [functional Java](lesson:java-functional)). You rarely write handles yourself, but you should know that they are what modern reflection uses underneath.

## Annotations {#annotations}

An **annotation** is metadata attached to a class, method, field, parameter or other element. It has no behaviour: **something else has to read it.** `@Override` is read by the compiler, `@Test` by JUnit, `@Entity` by Hibernate and `@GetMapping` by Spring MVC.

You declare one with `@interface` and describe it with **meta-annotations**:

```java
@Retention(RetentionPolicy.RUNTIME)           // how long it is kept
@Target(ElementType.FIELD)                    // where it may be placed
@Documented
public @interface NotBlank {
    String message() default "must not be blank";   // an element, with a default
}
```

| Meta-annotation | Purpose |
| --- | --- |
| `@Retention` | `SOURCE` (gone after compiling, such as `@Override`), `CLASS` (in the class file but not loaded; **the default**), `RUNTIME` (readable by reflection) |
| `@Target` | the elements it may be put on: `TYPE`, `FIELD`, `METHOD`, `PARAMETER`, `CONSTRUCTOR`, ... |
| `@Inherited` | a **class** annotation is seen on subclasses. It does not apply to interfaces or methods |
| `@Repeatable` | the same annotation may appear several times |
| `@Documented` | shown in Javadoc |

Elements can be primitives, `String`, `Class`, enums, other annotations and arrays of these. A forgotten `@Retention(RUNTIME)` is the classic mistake: the annotation compiles and silently never shows up at run time.

**Reading it** is ordinary reflection:

```java
List<String> validate(Object target) throws IllegalAccessException {
    List<String> errors = new ArrayList<>();
    for (Field f : target.getClass().getDeclaredFields()) {
        NotBlank rule = f.getAnnotation(NotBlank.class);
        if (rule == null) continue;
        f.setAccessible(true);
        Object value = f.get(target);
        if (value == null || value.toString().isBlank()) {
            errors.add(f.getName() + " " + rule.message());
        }
    }
    return errors;
}
```

Notes: annotations on an **interface method are not seen** on the implementing method with plain reflection, which is why Spring uses its own `AnnotatedElementUtils` and `MergedAnnotations` to search interfaces, superclasses and **meta-annotations**. `@RestController` is itself annotated with `@Controller` and `@ResponseBody`, and Spring treats it as both.

### Compile-time processing {#processing}

An **annotation processor** runs **inside the compiler** (the `javax.annotation.processing` API, JSR 269), reads annotated source and **generates new source files**. It costs nothing at run time and needs no reflection:

- **Lombok** changes the compiler's syntax tree to add getters, builders and constructors (it hooks deeper into `javac` than the standard API);
- **MapStruct** generates mapper classes, **Dagger** generates the dependency-injection code, **Immutables** and **AutoValue** generate value classes;
- **Micronaut and Quarkus** do dependency injection and proxies at **build time**, which is why they start fast and suit native images, and **Spring AOT** (Spring Boot 3) moves part of the work there as well.

Trade-off: processors make start-up faster and the code easier to analyse, but they need build setup (a processor path), and generated code is harder to debug.

## Dynamic proxies {#proxies}

A **proxy** is an object that stands in for another and controls access to it (the [proxy pattern](lesson:design-patterns#proxy)). A **dynamic** proxy is generated **at run time** instead of being written by hand, so one handler can serve any interface.

### JDK dynamic proxies {#jdk-proxy}

`java.lang.reflect.Proxy` creates a class that **implements the interfaces you give it**. Every call on it goes to one `InvocationHandler`:

```java
public interface AccountService {
    void transfer(String from, String to, long cents);
}

InvocationHandler handler = (proxy, method, args) -> {
    long start = System.nanoTime();
    try {
        return method.invoke(target, args);                       // call the real object
    } catch (InvocationTargetException e) {
        throw e.getCause();                                       // unwrap the real exception
    } finally {
        log.info("{} took {} us", method.getName(), (System.nanoTime() - start) / 1_000);
    }
};

AccountService service = (AccountService) Proxy.newProxyInstance(
        AccountService.class.getClassLoader(),
        new Class<?>[] { AccountService.class },
        handler);
```

Facts worth knowing:

- It works **only for interfaces**. The generated class already extends `java.lang.reflect.Proxy`, and Java has single inheritance, so it cannot also extend your class.
- `equals`, `hashCode` and `toString` also go to the handler. Forgetting that gives odd results.
- If the handler throws a **checked exception that the interface method does not declare**, the caller gets `UndeclaredThrowableException`.
- To call a `default` method of the interface from the handler, use `InvocationHandler.invokeDefault` ([Java 16](lesson:java-version-history#java-16)).
- The proxy is **not** an instance of the target's class: `proxy instanceof AccountServiceImpl` is false.

### CGLIB and ByteBuddy {#cglib}

For a class with no interface, libraries generate a **subclass** at run time with **bytecode generation**. The subclass overrides each method and calls an interceptor, which can run extra code and then `proceed()` to the original. **CGLIB** (repackaged inside Spring) and **ByteBuddy** (used by Hibernate and Mockito) do this. Java now has an official **Class-File API** ([Java 24](lesson:java-version-history#java-24)) for reading and writing bytecode, so that the JDK and frameworks no longer need an embedded copy of ASM.

| | JDK dynamic proxy | CGLIB or ByteBuddy |
| --- | --- | --- |
| needs | an interface | a **non-final** class |
| generated class | implements the interface | **extends** the class |
| what it can intercept | interface methods | public and protected non-final methods |
| cannot proxy | classes without interfaces | `final` classes and methods, `private` methods |
| instance of the target class | no | yes (it is a subclass) |
| constructor | not involved | needs a way to create it (Spring uses Objenesis to skip it) |

That table is the reason for the interview classics: **a `final` class cannot be proxied by Spring**, a `private` or `final` method silently loses `@Transactional`, and Spring Boot defaults to CGLIB (`spring.aop.proxy-target-class=true`). See [Spring AOP](lesson:spring-aop#how) for how the advice chain is built on this.

## How frameworks use all three {#frameworks}

| Framework | What it does with reflection, annotations and proxies |
| --- | --- |
| **Spring** | scans the class path and reads `@Component` and `@Service`; creates beans through constructors by reflection; fills `@Autowired` and `@Value`; wraps beans in **proxies** for `@Transactional`, `@Async`, `@Cacheable` and method security (see [Spring core](lesson:spring-core#lifecycle) and [transactions](lesson:spring-transactions)) |
| **Jackson** | finds getters, setters, fields and `@JsonProperty` through reflection; creates objects through a constructor or the no-argument one; reads generic types through `TypeReference` |
| **Hibernate / JPA** | reads `@Entity`, `@Id` and `@Column`; **instantiates entities by reflection** (so a no-argument constructor is required, and the class must not be final); returns ByteBuddy **proxies** for lazy associations |
| **JUnit** | finds methods annotated `@Test`, `@BeforeEach` and so on, and invokes them |
| **Mockito** | generates a subclass or instruments the class (the inline mock maker, default since Mockito 5) so that a mock records calls |
| **Bean Validation** | reads `@NotNull`, `@Size` and custom constraints, exactly like the validator above |

A useful way to answer *"how does X work?"*: say **which annotation is read, by which component, and whether the class is replaced by a proxy.**

### Native images and AOT {#native-image}

GraalVM compiles a Java program ahead of time under a **closed-world assumption**: anything not reachable at build time is dropped. Reflection breaks this, because a class named in a string cannot be seen. So reflective access must be declared in **reachability metadata**. Spring Boot 3 does much of it automatically at build time and lets you add hints with `@RegisterReflectionForBinding`, `@ImportRuntimeHints` and `RuntimeHints`. Frameworks that avoid run-time reflection (Micronaut, Quarkus, Spring AOT) fit this model best.

Try it in the lab: [How a framework wires beans with reflection](lab:reflection-di-container).

## Cheat sheet {#cheatsheet}

| Need | Code |
| --- | --- |
| the class | `X.class`, `obj.getClass()`, `Class.forName("a.B")` |
| create an object | `type.getDeclaredConstructor(...).newInstance(...)` (the old `type.newInstance()` is deprecated) |
| call a method | `type.getMethod("name", argTypes).invoke(obj, args)` |
| a private member | `getDeclaredField` or `getDeclaredMethod`, then `setAccessible(true)` |
| the real exception | `InvocationTargetException.getCause()` |
| list annotations | `element.getAnnotations()`, `getAnnotation(X.class)`, `isAnnotationPresent` |
| custom annotation | `@Retention(RUNTIME)`, `@Target(...)`, elements with defaults |
| interface proxy | `Proxy.newProxyInstance(loader, interfaces, handler)` |
| class proxy | CGLIB or ByteBuddy (Spring: `ProxyFactory`, `@EnableAspectJAutoProxy`) |
| generate code at build time | annotation processor (MapStruct, Dagger, Lombok) |
| fast repeated access | store a `MethodHandle` in a `static final` field |
| find a proxy in Spring | `AopUtils.isAopProxy(bean)`, class name contains `$$SpringCGLIB$$` |

## Interview questions {#questions}

### [basic] What is reflection and what is it used for? {#reflection-q}

Reflection is the ability of a program to inspect and use classes, fields, methods and constructors at run time, including ones it did not know at compile time. It is used by frameworks: dependency injection (Spring), serialization (Jackson), persistence (Hibernate), test runners (JUnit), validation and plug-in systems. In ordinary application code it is rarely the right tool, because it loses compile-time checking and is harder to maintain.

### [basic] How can you obtain a `Class` object? {#get-class-q}

Three ways: `Account.class` (a literal, known at compile time), `account.getClass()` (the actual run-time class of an instance), and `Class.forName("com.bank.Account")` (by name, loading and initialising it, which throws `ClassNotFoundException` if it is missing). Primitives have `int.class`, and arrays have their own classes. There is one `Class` object per class **per class loader**.

### [basic] What is an annotation, and does it do anything on its own? {#annotation-q}

An annotation is metadata attached to a program element. On its own it does nothing: something must read it. The compiler reads `@Override` and `@FunctionalInterface`, an annotation processor can read others at compile time and generate code, and a framework reads `RUNTIME` annotations through reflection (Spring reads `@Service`, JUnit reads `@Test`). Without that reader the annotation is just an inert label.

### [basic] What are the retention policies? {#retention-q}

`SOURCE`: discarded by the compiler (`@Override`, Lombok's annotations). `CLASS`: stored in the class file but not available at run time, and **the default if you do not say**. `RUNTIME`: stored and readable by reflection. An annotation that a framework needs to read at run time must be `@Retention(RetentionPolicy.RUNTIME)`, and forgetting it makes the annotation compile and silently do nothing.

### [basic] What is a dynamic proxy? {#proxy-q}

A proxy is an object that stands in for another and intercepts calls to it. A dynamic proxy is created at run time. `java.lang.reflect.Proxy` generates a class that implements given interfaces and sends every method call to an `InvocationHandler`, where you can add behaviour (logging, security, transactions) and then call the real object. It lets one piece of cross-cutting code wrap many different interfaces without writing a class for each.

### [intermediate] What is the difference between `getMethods()` and `getDeclaredMethods()`? {#declared-q}

`getMethods()` returns all **public** methods of the class, including inherited ones and those from interfaces. `getDeclaredMethods()` returns **all methods declared in that class**, whatever their visibility, but not inherited ones. To find a private method of a superclass you walk up with `getSuperclass()`. The same pair exists for fields and constructors (constructors are never inherited, so `getConstructors()` returns the public ones of that class).

### [intermediate] What does `setAccessible(true)` do, and why does it fail on newer Java versions? {#set-accessible-q}

It turns off the language access check for that one reflective object so a private member can be read, written or called. Since Java 9 the module system adds its own check: if the package belongs to a named module that does not `open` it to the caller, `setAccessible` throws `InaccessibleObjectException`. From Java 16 and 17 the JDK's internal packages are closed by default, so libraries that reach into them fail. The proper fix is to update the library; `--add-opens` is a temporary workaround.

### [intermediate] Why do you get `InvocationTargetException`, and how do you handle it? {#ite-q}

`Method.invoke` wraps any exception thrown by the invoked method in an `InvocationTargetException`, so that exceptions from your reflective call can be told apart from exceptions of the call itself (such as `IllegalAccessException`). Unwrap it with `getCause()` and rethrow or handle the real exception. In a proxy handler this matters: if you let the wrapper escape, callers see an unexpected exception type instead of the one the method really threw.

### [intermediate] What is the difference between a JDK dynamic proxy and CGLIB? {#jdk-vs-cglib-q}

A JDK proxy implements the **interfaces** of the target, so it needs at least one interface and can only intercept their methods; it is not an instance of the target class. CGLIB (and ByteBuddy) generate a **subclass** of the target class, so they work without interfaces, but they cannot proxy `final` classes or `final` and `private` methods, and they need a way to construct the object. Spring Boot uses CGLIB by default, so injecting a bean by its class works.

### [intermediate] Why can't Spring proxy a final class, and what happens to a final method? {#final-q}

The CGLIB proxy is a **subclass** that overrides methods to add the advice. A final class cannot be extended, so no proxy can be created (or Spring falls back and fails with an error). A final method cannot be overridden, so the call goes straight to the target and the annotation on it, such as `@Transactional`, is **silently ignored**. Private methods behave the same way. Make the class and its advised methods non-final and public. Kotlin classes need the `all-open` plugin for this reason.

### [intermediate] How does `@Autowired` work at the Java level? {#autowired-q}

Spring scans the class path (reflection reads the annotations), builds a bean definition, then to create the bean it chooses a constructor and calls it by reflection with the dependencies it has resolved. For field or setter injection a `BeanPostProcessor` finds members annotated `@Autowired`, resolves the dependency by type (and name or qualifier), makes the field accessible with `setAccessible(true)` and sets it. Constructor injection is preferred because it needs no private field access, allows final fields and works in plain unit tests.

### [intermediate] How does `@Transactional` work, and why does self-invocation ignore it? {#transactional-q}

A `BeanPostProcessor` sees the annotation and replaces the bean with a proxy. A call from another bean reaches the proxy, which begins a transaction, calls the raw bean, and commits or rolls back. When a method of the raw bean calls another of its own methods through `this`, the call does not pass through the proxy, so no transaction is started for the second method. Fix it by moving the method to another bean, injecting the proxy, or restructuring. See [Spring AOP](lesson:spring-aop#pitfalls).

### [intermediate] How do you create a custom annotation and process it at run time? {#custom-annotation-q}

Declare it with `@interface`, set `@Retention(RUNTIME)` and `@Target`, and add elements with defaults. Then write the code that reads it: with reflection loop over fields or methods and call `getAnnotation`, or in Spring write an aspect or a `BeanPostProcessor`. For example a `@Audited` annotation on methods plus an aspect that writes an audit record around them. Use Spring's `AnnotatedElementUtils` to also find annotations on interfaces and meta-annotations.

### [intermediate] What is an annotation processor, and how is it different from reflection? {#processor-q}

An annotation processor runs **during compilation**, reads the annotated source and generates new classes (MapStruct mappers, Dagger components). Reflection runs **at run time** and works on loaded classes. The processor approach has no run-time cost, is checked by the compiler and fits native images, but needs build configuration and generates code you may have to debug. Lombok is a special case that edits the compiler's syntax tree rather than only generating new files.

### [deep] Why is reflection slow, and what has changed in recent Java versions? {#reflection-speed-q}

The expensive parts are looking up members (`getMethod` searches and copies metadata), access and argument checks, boxing of primitives and the fact that the JIT cannot inline or optimise a call it only learns about at run time. Cache the `Method` and `Field` objects. In Java 18 core reflection was reimplemented on **method handles** (JEP 416), which are better optimised, narrowing the gap; for the fastest repeated calls use a `MethodHandle` in a `static final` field or generate code at build time.

### [deep] How do frameworks avoid reflection, and why would they? {#avoid-reflection-q}

By moving the work to **build time**: annotation processors generate the wiring code (Dagger, MapStruct), and Micronaut, Quarkus and Spring AOT precompute bean definitions and proxies. The reasons are **start-up time and memory** (no class-path scanning), **GraalVM native images** (reflection must otherwise be registered by hand), and **earlier errors** (a missing bean fails the build, not the first request). The cost is less dynamism: no loading of unknown classes at run time.

### [deep] Why does Hibernate need a no-argument constructor and non-final entities? {#hibernate-q}

Hibernate creates entities **by reflection** when it reads rows, and it has no values to pass to a constructor, so it needs a no-argument one (JPA allows `protected`). For lazy loading it returns a **ByteBuddy subclass proxy** of the entity that loads the data on first use, so the class and its accessors must not be final. Final fields are also awkward because Hibernate sets them after construction. Records cannot be entities for that reason, though they work well as projections and DTOs.

### [deep] How would you write a framework feature that finds and runs all methods annotated `@Scheduled`-like? {#scan-q}

Scan for candidate classes (the class path scanner, or a list from the container), then for each class loop over `getDeclaredMethods()`, check `isAnnotationPresent`, validate the signature (no parameters, return type), call `setAccessible(true)` once, **cache** the `Method`, and invoke it on the bean instance from a scheduler thread, unwrapping `InvocationTargetException` and logging the real cause. Do the scan once at start-up, not on every call, and handle proxies by finding the target class (`AopUtils.getTargetClass`) or the annotation could be missed.

### [coding] Write a small validator that reads a custom `@NotBlank` annotation. {#coding-validator}

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface NotBlank {
    String message() default "must not be blank";
}

public record Violation(String field, String message) {}

public final class Validator {
    public static List<Violation> validate(Object target) {
        List<Violation> result = new ArrayList<>();
        for (Field field : target.getClass().getDeclaredFields()) {
            NotBlank rule = field.getAnnotation(NotBlank.class);
            if (rule == null) continue;
            try {
                field.setAccessible(true);
                Object value = field.get(target);
                if (value == null || value.toString().isBlank()) {
                    result.add(new Violation(field.getName(), rule.message()));
                }
            } catch (IllegalAccessException e) {
                throw new IllegalStateException("Cannot read " + field.getName(), e);
            }
        }
        return result;
    }
}

class TransferRequest {
    @NotBlank String fromAccount;
    @NotBlank(message = "is required") String toAccount;
    long cents;
    // constructor omitted
}
```

Explain that `RUNTIME` retention is what makes the annotation visible, that `getDeclaredFields` is used so private fields are included, that a real validator caches the field list per class (reflection lookups are slow) and walks superclasses, and that Bean Validation does the same with far more rules.

### [coding] Write a generic timing proxy for any interface. {#coding-proxy}

```java
public final class TimingProxy {
    private TimingProxy() {}

    @SuppressWarnings("unchecked")
    public static <T> T wrap(T target, Class<T> type) {
        InvocationHandler handler = (proxy, method, args) -> {
            long start = System.nanoTime();
            try {
                return method.invoke(target, args);
            } catch (InvocationTargetException e) {
                throw e.getCause();                       // callers see the real exception
            } finally {
                long micros = (System.nanoTime() - start) / 1_000;
                System.out.printf("%s.%s took %d us%n", type.getSimpleName(), method.getName(), micros);
            }
        };
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, handler);
    }
}

AccountService service = TimingProxy.wrap(new AccountServiceImpl(), AccountService.class);
service.transfer("ACC-1", "ACC-2", 5_000);
```

Explain that it works only because `AccountService` is an interface, that `InvocationTargetException` is unwrapped so the caller sees the real exception (a checked exception not declared by the interface would otherwise become `UndeclaredThrowableException`), that the same handler serves any interface, and that this is exactly what Spring does for `@Transactional`, with CGLIB when there is no interface.

### [coding] Write a tiny dependency-injection container using constructors and an annotation. {#coding-container}

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Component {}

public final class MiniContainer {
    private final Map<Class<?>, Object> beans = new HashMap<>();

    public <T> T get(Class<T> type) {
        if (!type.isAnnotationPresent(Component.class)) {
            throw new IllegalArgumentException(type.getName() + " is not a @Component");
        }
        Object bean = beans.get(type);
        if (bean == null) {
            bean = create(type);              // creates the dependencies first, recursively
            beans.put(type, bean);
        }
        return type.cast(bean);
    }

    private Object create(Class<?> type) {
        try {
            Constructor<?> ctor = type.getDeclaredConstructors()[0];      // one constructor, for the example
            Object[] args = Arrays.stream(ctor.getParameterTypes())
                    .map(this::get)                                       // resolve each dependency, recursively
                    .toArray();
            ctor.setAccessible(true);
            return ctor.newInstance(args);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Cannot create " + type.getName(), e);
        }
    }
}

@Component class AccountRepository {}
@Component class TransferService {
    private final AccountRepository repository;
    TransferService(AccountRepository repository) { this.repository = repository; }
}

TransferService service = new MiniContainer().get(TransferService.class);
```

Explain that this is the core of constructor injection (find the constructor, resolve parameter types, call it), that the map makes each bean a singleton, and what the sketch leaves out: thread safety, circular dependencies (it would recurse forever; Spring detects them), interfaces and qualifiers, scopes, and proxies for `@Transactional`. Note that `computeIfAbsent` is not used because creating a dependency would re-enter the same `HashMap` while it is being modified, which throws `ConcurrentModificationException`.
