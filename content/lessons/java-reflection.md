---
title: Reflection, annotations and dynamic proxies — how Java frameworks work
nav: Reflection and proxies
slug: java-reflection
summary: How Java code inspects and uses types at run time: the Class object, fields, methods and constructors, setAccessible and the module system, annotations and their retention, writing and reading a custom annotation, compile-time annotation processing, JDK dynamic proxies and CGLIB, method handles, and how Spring, Jackson, Hibernate and Mockito use all of it, with examples and interview questions.
tags: [Java, Reflection, Annotations, Proxies, Spring, Frameworks]
order: 11
topic: Java / Language
updated: 2026-11-24
subnav: true
---

Most of the "magic" in Spring, Jackson, Hibernate and JUnit comes from three plain Java features:

- **Reflection** lets code look at a class and use it, even when the code did not know that class when it was compiled.
- **Annotations** attach extra information (metadata) to code.
- **Dynamic proxies** are classes generated while the program runs. A proxy stands in for another object.

Interviews ask questions such as:

- How do `@Autowired` and `@Transactional` actually work?
- What is a proxy, and why can a `final` class not be proxied?
- What does `setAccessible` do, and what does it cost?
- How are annotations read?

This lesson connects the Java lessons with the [Spring](lesson:spring-core) ones.

The animation has four scenes: reflection, annotations, a dynamic proxy, and how Spring uses all three.

```demo
name: reflection-walk
```

> **One sentence to remember:** *Frameworks read your annotations through reflection and wrap your objects in proxies to add behaviour.*

## The Class object {#class-object}

Every loaded type has exactly one `Class` object **per class loader**. (A class loader is the part of the JVM that finds and loads classes.)

The `Class` object is where reflection starts. It describes the type: its name, modifiers, superclass, interfaces, fields, methods, constructors, annotations and generic signatures.

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

`Class.forName` loads the class and also **initialises** it, which runs its static initialisers. `ClassLoader.loadClass` only loads it. If the name cannot be found, you get a `ClassNotFoundException` (see [class loading](lesson:jvm-troubleshooting#classloading)).

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

Details that catch people out:

| Detail | Explanation |
| --- | --- |
| `getMethods()` vs `getDeclaredMethods()` | `getMethods()` returns the **public** methods, including inherited ones. `getDeclaredMethods()` returns **all** methods that **this class** declares, private ones included, but not inherited ones. Fields and constructors have the same pair. |
| `InvocationTargetException` | If the called method throws an exception, reflection wraps it in this one. Call `getCause()` (or `getTargetException()`) to see the real exception. |
| Primitive types | The parameter type is `long.class`, not `Long.class`. Reflection boxes and unboxes the arguments for you. |
| Generic types | They are erased at run time, but the signatures stay in the class file. `getGenericSuperclass()` and `getGenericReturnType()` return them (see [erasure](lesson:java-generics#erasure)). Jackson's `TypeReference` works this way. |
| Parameter names | They are **not** available unless the code is compiled with `-parameters`. Spring Boot's build plugins turn this on, so `@RequestParam` and constructor binding work without naming the parameters. |
| Records | The fields are final. `setAccessible` does **not** let you change them. |
| Arrays | Use `Array.newInstance(type, 3)`, `Array.get` and `Array.set`. |

### Access and the module system {#access}

`setAccessible(true)` turns off the Java access check for one `Field`, `Method` or `Constructor` object. Then you can read and call private members.

It used to work everywhere. Since [Java 9](lesson:java-version-history#java-9), the **module system** controls it. In [Java 16](lesson:java-version-history#java-16) and [Java 17](lesson:java-version-history#java-17), the JDK also locked away its own internal classes (**strong encapsulation**). The rules today:

- **Your own code on the class path:** it still works.
- **Classes inside a named module:** it works only if that package is opened to the caller. You open it with `opens` in `module-info.java`, or on the command line with `--add-opens java.base/java.lang=ALL-UNNAMED`.
- **JDK internals:** it throws `InaccessibleObjectException` unless the package is opened. This is why old libraries fail on Java 17 with *"Unable to make field private ... accessible"*. The real fix is to **upgrade the library**. An `--add-opens` flag is only a stopgap.
- **Final fields:** changing them through reflection is unreliable, because the JIT compiler may have copied the value into the compiled code. Newer Java versions warn about it (JEP 500) and plan to forbid it.

### The cost and the limits {#costs}

Reflection is powerful, but it has a price:

- **You lose type safety.** A wrong name or parameter type fails while the program runs, not when it compiles. A rename in the IDE does not update names written in strings.
- **You bypass encapsulation.** Code can come to depend on private details that may change.
- **It is slower.** A lookup such as `getMethod` is slow, so do it once and cache the result. The call itself is much cheaper than it used to be, because [Java 18](lesson:java-version-history#java-18) rebuilt core reflection on top of method handles (JEP 416). A reflective call is still slower than a direct one, because the JIT can optimise it less.
- **Native images and AOT.** GraalVM native image looks at the program when it builds it, and removes anything it does not see being used. So every class that is used only through reflection must be **registered** in advance. Spring generates these hints for you (see [Spring Boot 3](lesson:spring-boot-3)).
- **Security.** Reflection can break a class's rules. A security-sensitive class must not assume that nobody touches its private fields.

The rule: use reflection in **framework and infrastructure code**, cache the lookups, and keep it out of normal business logic.

### Method handles {#method-handles}

A `MethodHandle` (Java 7) is a typed and faster relative of `Method`. You get one from a `Lookup`. The `Lookup` checks access once, when you look the method up, and not on every call.

```java
MethodHandles.Lookup lookup = MethodHandles.lookup();
MethodHandle handle = lookup.findVirtual(Account.class, "deposit", MethodType.methodType(void.class, long.class));
handle.invoke(account, 500L);
```

When a handle is stored in a `static final` field, the JIT can inline the call, so it runs almost as fast as a direct call.

Related tools:

- `VarHandle` does the same for fields, with control over memory ordering. It replaced much of `Unsafe`.
- Lambdas and method references are built on `invokedynamic` and `LambdaMetafactory` (see [functional Java](lesson:java-functional)).

You rarely write handles yourself. But you should know that modern reflection uses them underneath.

## Annotations {#annotations}

An **annotation** is metadata attached to a class, method, field, parameter or other element. It has no behaviour of its own. **Something else has to read it.**

- The compiler reads `@Override`.
- JUnit reads `@Test`.
- Hibernate reads `@Entity`.
- Spring MVC reads `@GetMapping`.

You declare an annotation with `@interface`. You describe it with **meta-annotations**, which are annotations on an annotation:

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
| `@Retention` | How long the annotation is kept. `SOURCE` is gone after compiling, like `@Override`. `CLASS` is in the class file but not loaded at run time, and it is **the default**. `RUNTIME` can be read by reflection. |
| `@Target` | Where it may be placed: `TYPE`, `FIELD`, `METHOD`, `PARAMETER`, `CONSTRUCTOR` and others. |
| `@Inherited` | A **class** annotation is also seen on subclasses. It does not work for interfaces or methods. |
| `@Repeatable` | The same annotation may appear several times on one element. |
| `@Documented` | The annotation is shown in Javadoc. |

An annotation's elements can be primitives, `String`, `Class`, enums, other annotations, and arrays of these.

The classic mistake is forgetting `@Retention(RUNTIME)`. The annotation compiles, but it silently never shows up at run time.

**Reading an annotation** is ordinary reflection:

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

Plain reflection does **not** see an annotation on an interface method when you look at the method that implements it. That is why Spring has its own `AnnotatedElementUtils` and `MergedAnnotations`. They search interfaces, superclasses and **meta-annotations**.

For example, `@RestController` is itself annotated with `@Controller` and `@ResponseBody`, and Spring treats it as both.

### Compile-time processing {#processing}

An **annotation processor** runs **inside the compiler**. It uses the `javax.annotation.processing` API (JSR 269). It reads annotated source code and **generates new source files**. It costs nothing at run time and needs no reflection.

Examples:

- **Lombok** changes the compiler's syntax tree to add getters, builders and constructors. It hooks deeper into `javac` than the standard API allows.
- **MapStruct** generates mapper classes. **Dagger** generates dependency-injection code. **Immutables** and **AutoValue** generate value classes.
- **Micronaut and Quarkus** do dependency injection and proxies at **build time**. That is why they start fast and suit native images. **Spring AOT** (Spring Boot 3) moves part of the work to build time too.

The trade-off: processors make start-up faster and code easier to analyse. But they need build setup (a processor path), and generated code is harder to debug.

## Dynamic proxies {#proxies}

A **proxy** is an object that stands in for another object and controls access to it. This is the [proxy pattern](lesson:design-patterns#proxy).

A **dynamic** proxy is generated **while the program runs**, instead of being written by hand. So one handler can serve any interface.

### JDK dynamic proxies {#jdk-proxy}

`java.lang.reflect.Proxy` creates a class that **implements the interfaces you give it**. Every call on that class goes to one `InvocationHandler`:

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

- It works **only for interfaces**. The generated class already extends `java.lang.reflect.Proxy`. A Java class can extend only one class, so it cannot also extend your class.
- `equals`, `hashCode` and `toString` also go to the handler. If you forget that, you get odd results.
- If the handler throws a **checked exception that the interface method does not declare**, the caller gets an `UndeclaredThrowableException`.
- To call a `default` method of the interface from the handler, use `InvocationHandler.invokeDefault` ([Java 16](lesson:java-version-history#java-16)).
- The proxy is **not** an instance of the target's class. `proxy instanceof AccountServiceImpl` is false.

### CGLIB and ByteBuddy {#cglib}

For a class with no interface, libraries use **bytecode generation**: they write a new class while the program runs.

1. They generate a **subclass** of your class.
2. The subclass overrides each method and calls an **interceptor**.
3. The interceptor can run extra code and then call `proceed()` to run the original method.

**CGLIB** (a copy of it is inside Spring) and **ByteBuddy** (used by Hibernate and Mockito) work this way.

Java now also has an official **Class-File API** ([Java 24](lesson:java-version-history#java-24)) for reading and writing bytecode. With it, the JDK and frameworks no longer need their own copy of the ASM library.

| | JDK dynamic proxy | CGLIB or ByteBuddy |
| --- | --- | --- |
| Needs | An interface. | A **non-final** class. |
| Generated class | Implements the interface. | **Extends** the class. |
| What it can intercept | Interface methods. | Public and protected methods that are not final. |
| Cannot proxy | Classes without interfaces. | `final` classes, `final` methods and `private` methods. |
| Instance of the target class? | No. | Yes, because it is a subclass. |
| Constructor | Not involved. | It needs a way to create the object. Spring uses Objenesis to skip the constructor. |

This table explains the classic interview answers:

- **Spring cannot proxy a `final` class.**
- A `private` or `final` method silently loses `@Transactional`.
- Spring Boot uses CGLIB by default (`spring.aop.proxy-target-class=true`).

See [Spring AOP](lesson:spring-aop#how) for how the chain of advice is built on top of this.

## How frameworks use all three {#frameworks}

| Framework | What it does with reflection, annotations and proxies |
| --- | --- |
| **Spring** | It scans the class path and reads `@Component` and `@Service`. It creates beans by calling constructors through reflection, and fills `@Autowired` and `@Value`. It wraps beans in **proxies** for `@Transactional`, `@Async`, `@Cacheable` and method security (see [Spring core](lesson:spring-core#lifecycle) and [transactions](lesson:spring-transactions)). |
| **Jackson** | It finds getters, setters, fields and `@JsonProperty` through reflection. It creates objects through a constructor, or through the no-argument one. It reads generic types through `TypeReference`. |
| **Hibernate / JPA** | It reads `@Entity`, `@Id` and `@Column`. It **creates entities by reflection**, so an entity needs a no-argument constructor and must not be final. It returns ByteBuddy **proxies** for lazy associations. |
| **JUnit** | It finds methods annotated `@Test`, `@BeforeEach` and so on, and calls them. |
| **Mockito** | It generates a subclass, or changes the class's bytecode (the inline mock maker, the default since Mockito 5), so that a mock can record calls. |
| **Bean Validation** | It reads `@NotNull`, `@Size` and custom constraints, exactly like the validator above. |

A good way to answer *"how does X work?"* is to say three things: **which annotation is read, which component reads it, and whether the object is replaced by a proxy.**

### Native images and AOT {#native-image}

GraalVM compiles a Java program **ahead of time** (AOT), before it runs. It uses a **closed-world assumption**: anything it cannot reach at build time is dropped.

Reflection breaks this, because a class named in a string is invisible to the build. So reflective access must be listed in **reachability metadata**.

Spring Boot 3 creates much of this metadata automatically at build time. You can add hints with `@RegisterReflectionForBinding`, `@ImportRuntimeHints` and `RuntimeHints`.

Frameworks that avoid reflection at run time, such as Micronaut, Quarkus and Spring AOT, fit this model best.

Try it in the lab: [How a framework wires beans with reflection](lab:reflection-di-container).

## Cheat sheet {#cheatsheet}

| Need | Code |
| --- | --- |
| Get the class | `X.class`, `obj.getClass()` or `Class.forName("a.B")` |
| Create an object | `type.getDeclaredConstructor(...).newInstance(...)` (the old `type.newInstance()` is deprecated) |
| Call a method | `type.getMethod("name", argTypes).invoke(obj, args)` |
| Use a private member | `getDeclaredField` or `getDeclaredMethod`, then `setAccessible(true)` |
| Get the real exception | `InvocationTargetException.getCause()` |
| List annotations | `element.getAnnotations()`, `getAnnotation(X.class)`, `isAnnotationPresent` |
| Write a custom annotation | `@Retention(RUNTIME)`, `@Target(...)`, and elements with defaults |
| Proxy an interface | `Proxy.newProxyInstance(loader, interfaces, handler)` |
| Proxy a class | CGLIB or ByteBuddy (in Spring: `ProxyFactory`, `@EnableAspectJAutoProxy`) |
| Generate code at build time | An annotation processor (MapStruct, Dagger, Lombok) |
| Fast repeated access | A `MethodHandle` in a `static final` field |
| Spot a proxy in Spring | `AopUtils.isAopProxy(bean)`, or a class name that contains `$$SpringCGLIB$$` |

## Interview questions {#questions}

### [basic] What is reflection and what is it used for? {#reflection-q}

Reflection lets a program inspect and use classes, fields, methods and constructors while it runs. This includes classes it did not know when it was compiled.

Frameworks use it for:

- dependency injection (Spring),
- serialization (Jackson),
- persistence (Hibernate),
- test runners (JUnit),
- validation and plug-in systems.

In normal application code it is rarely the right tool. It loses compile-time checking and is harder to maintain.

### [basic] How can you obtain a `Class` object? {#get-class-q}

There are three ways:

1. **`Account.class`**, a class literal known at compile time.
2. **`account.getClass()`**, the real class of an object at run time.
3. **`Class.forName("com.bank.Account")`**, by name. It loads and initialises the class, and throws `ClassNotFoundException` if the class is missing.

Primitives have `int.class` and so on, and arrays have their own classes. There is one `Class` object per class **per class loader**.

### [basic] What is an annotation, and does it do anything on its own? {#annotation-q}

An annotation is metadata attached to a piece of code. **On its own it does nothing.** Something must read it:

- The compiler reads `@Override` and `@FunctionalInterface`.
- An annotation processor can read annotations at compile time and generate code.
- A framework reads `RUNTIME` annotations through reflection. Spring reads `@Service`, and JUnit reads `@Test`.

Without a reader, an annotation is just a label.

### [basic] What are the retention policies? {#retention-q}

There are three:

- **`SOURCE`:** the compiler throws it away. Examples are `@Override` and Lombok's annotations.
- **`CLASS`:** it is stored in the class file but not available at run time. This is **the default** when you do not say.
- **`RUNTIME`:** it is stored and can be read by reflection.

An annotation that a framework reads at run time must have `@Retention(RetentionPolicy.RUNTIME)`. If you forget it, the annotation compiles and silently does nothing.

### [basic] What is a dynamic proxy? {#proxy-q}

A **proxy** is an object that stands in for another and intercepts the calls to it. A **dynamic** proxy is created while the program runs.

`java.lang.reflect.Proxy` generates a class that implements the interfaces you give it. It sends every method call to an `InvocationHandler`. There you can add behaviour, such as logging, security or transactions, and then call the real object.

So one piece of shared code can wrap many different interfaces, without writing a class for each.

### [intermediate] What is the difference between `getMethods()` and `getDeclaredMethods()`? {#declared-q}

- **`getMethods()`** returns all **public** methods, including inherited ones and methods from interfaces.
- **`getDeclaredMethods()`** returns **every method declared in that class**, whatever its visibility, but not inherited ones.

To find a private method of a superclass, walk up the hierarchy with `getSuperclass()`.

Fields and constructors have the same pair of methods. Constructors are never inherited, so `getConstructors()` returns the public constructors of that class only.

### [intermediate] What does `setAccessible(true)` do, and why does it fail on newer Java versions? {#set-accessible-q}

It turns off the language access check for one reflective object. Then you can read, write or call a private member.

It fails on newer Java versions because of the module system:

1. Since Java 9, the module system adds its own check. If the package is in a named module that does not `open` it to the caller, `setAccessible` throws `InaccessibleObjectException`.
2. Since Java 16 and 17, the JDK's internal packages are closed by default. So libraries that reach into them fail.

The proper fix is to update the library. `--add-opens` is only a temporary workaround.

### [intermediate] Why do you get `InvocationTargetException`, and how do you handle it? {#ite-q}

`Method.invoke` wraps any exception thrown by the called method in an `InvocationTargetException`. This keeps it apart from errors of the reflective call itself, such as `IllegalAccessException`.

Unwrap it with `getCause()`. Then rethrow or handle the real exception.

This matters in a proxy handler. If you let the wrapper escape, callers see an unexpected exception type instead of the one the method really threw.

### [intermediate] What is the difference between a JDK dynamic proxy and CGLIB? {#jdk-vs-cglib-q}

- **A JDK proxy implements the target's interfaces.** It needs at least one interface and can intercept only interface methods. It is not an instance of the target class.
- **CGLIB and ByteBuddy generate a subclass of the target class.** They work without interfaces. But they cannot proxy `final` classes, or `final` and `private` methods, and they need a way to create the object.

Spring Boot uses CGLIB by default, so you can inject a bean by its class.

### [intermediate] Why can't Spring proxy a final class, and what happens to a final method? {#final-q}

The CGLIB proxy is a **subclass** that overrides methods to add the extra behaviour.

- **A final class cannot be extended.** So no proxy can be created, and Spring fails with an error.
- **A final method cannot be overridden.** So the call goes straight to the target, and an annotation such as `@Transactional` on it is **silently ignored**. Private methods behave the same way.

The fix: make the class and its advised methods non-final and public. Kotlin classes need the `all-open` plugin for this reason, because Kotlin classes are final by default.

### [intermediate] How does `@Autowired` work at the Java level? {#autowired-q}

1. Spring scans the class path. Reflection reads the annotations.
2. Spring builds a **bean definition**, a recipe for the object.
3. To create the bean, it picks a constructor and calls it by reflection with the dependencies it has found.
4. For field or setter injection, a `BeanPostProcessor` finds the members annotated `@Autowired`. It finds the dependency by type (and by name or qualifier), calls `setAccessible(true)` and sets the field.

Constructor injection is preferred. It needs no access to private fields, allows `final` fields and works in plain unit tests.

### [intermediate] How does `@Transactional` work, and why does self-invocation ignore it? {#transactional-q}

How it works:

1. A `BeanPostProcessor` sees the annotation and replaces the bean with a proxy.
2. A call from another bean reaches the proxy.
3. The proxy starts a transaction, calls the raw bean, and then commits or rolls back.

Self-invocation is when a method of the raw bean calls another of its own methods through `this`. That call does not pass through the proxy, so no transaction starts for the second method.

Fix it by moving the method to another bean, by injecting the proxy, or by restructuring the code. See [Spring AOP](lesson:spring-aop#pitfalls).

### [intermediate] How do you create a custom annotation and process it at run time? {#custom-annotation-q}

1. Declare it with `@interface`.
2. Add `@Retention(RUNTIME)` and `@Target`.
3. Add elements with defaults.
4. Write the code that reads it. With plain reflection, loop over the fields or methods and call `getAnnotation`. In Spring, write an aspect or a `BeanPostProcessor`.

Example: an `@Audited` annotation on methods, plus an aspect that writes an audit record around each call.

Use Spring's `AnnotatedElementUtils` to also find annotations on interfaces and meta-annotations.

### [intermediate] What is an annotation processor, and how is it different from reflection? {#processor-q}

- **An annotation processor runs while the code compiles.** It reads the annotated source and generates new classes, such as MapStruct mappers or Dagger components.
- **Reflection runs while the program runs.** It works on loaded classes.

A processor has no run-time cost, is checked by the compiler and suits native images. But it needs build setup, and you may have to debug the generated code.

Lombok is a special case. It edits the compiler's syntax tree instead of only generating new files.

### [deep] Why is reflection slow, and what has changed in recent Java versions? {#reflection-speed-q}

The slow parts are:

1. **Looking up members.** `getMethod` searches and copies metadata.
2. **Checks** of access and arguments.
3. **Boxing** of primitive arguments.
4. **No JIT optimisation.** The JIT cannot inline or optimise a call it only learns about at run time.

Cache the `Method` and `Field` objects.

In Java 18, core reflection was rebuilt on **method handles** (JEP 416). They are better optimised, so the gap is smaller. For the fastest repeated calls, store a `MethodHandle` in a `static final` field, or generate code at build time.

### [deep] How do frameworks avoid reflection, and why would they? {#avoid-reflection-q}

**How:** they move the work to **build time**. Annotation processors generate the wiring code (Dagger, MapStruct). Micronaut, Quarkus and Spring AOT work out bean definitions and proxies in advance.

**Why:**

1. **Faster start-up and less memory**, because there is no class-path scan.
2. **GraalVM native images**, where reflection would otherwise have to be registered by hand.
3. **Earlier errors**, because a missing bean fails the build, not the first request.

The cost is less flexibility: the program cannot load unknown classes at run time.

### [deep] Why does Hibernate need a no-argument constructor and non-final entities? {#hibernate-q}

1. **No-argument constructor:** Hibernate creates entities **by reflection** when it reads rows. It has no values to pass to a constructor, so it needs one with no arguments. JPA allows it to be `protected`.
2. **Non-final class and accessors:** for lazy loading, Hibernate returns a **ByteBuddy subclass proxy** of the entity. The proxy loads the data on first use. A subclass is impossible if the class or its accessors are final.
3. **Final fields are awkward**, because Hibernate sets the fields after the object is created.

For these reasons records cannot be entities. They work well as projections and DTOs.

### [deep] How would you write a framework feature that finds and runs all methods annotated `@Scheduled`-like? {#scan-q}

1. Find the candidate classes, with the class path scanner or from a list held by the container.
2. For each class, loop over `getDeclaredMethods()` and check `isAnnotationPresent`.
3. Check the signature: no parameters, and a suitable return type.
4. Call `setAccessible(true)` once, and **cache** the `Method`.
5. Call it on the bean from a scheduler thread. Unwrap `InvocationTargetException` and log the real cause.

Do the scan once at start-up, not on every call.

Watch out for proxies. Find the target class with `AopUtils.getTargetClass`, or the annotation could be missed.

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

Points to explain:

- `RUNTIME` retention is what makes the annotation visible.
- `getDeclaredFields` is used so that private fields are included.
- A real validator caches the field list for each class, because reflection lookups are slow. It also walks up the superclasses.
- Bean Validation works the same way, with far more rules.

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

Points to explain:

- It works only because `AccountService` is an interface.
- `InvocationTargetException` is unwrapped, so the caller sees the real exception. Otherwise a checked exception that the interface does not declare would become an `UndeclaredThrowableException`.
- The same handler serves any interface.
- This is exactly what Spring does for `@Transactional`. When there is no interface, Spring uses CGLIB.

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

Points to explain:

- This is the core of constructor injection: find the constructor, look at its parameter types, create those first, then call it.
- The map makes each bean a **singleton** (one object per class).
- The sketch leaves out thread safety, interfaces and qualifiers, scopes, and proxies for `@Transactional`.
- It also does not handle **circular dependencies**. It would recurse forever, while Spring detects them.
- It does not use `computeIfAbsent`. Creating a dependency would add to the same `HashMap` while `computeIfAbsent` is still changing it, and that throws a `ConcurrentModificationException`.
