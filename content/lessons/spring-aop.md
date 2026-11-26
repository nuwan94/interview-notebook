---
title: Spring AOP and proxies — aspects, advice, pointcuts and the self-invocation trap
nav: AOP and proxies
slug: spring-aop
summary: Cross-cutting concerns and aspect-oriented programming in Spring, JDK dynamic proxies versus CGLIB, writing aspects with pointcuts and advice, how @Transactional, @Async and @Cacheable work through proxies, and the pitfalls (self-invocation, private and final methods), with Java examples and interview questions.
tags: [Spring, AOP, Proxy, Aspect, Transactional]
order: 82
topic: Spring / Fundamentals
updated: 2026-11-26
subnav: true
---

"How does `@Transactional` work?" is the usual way into this topic. The correct answer is: *through a proxy*. Interviewers then ask:

- What is AOP?
- What is the difference between JDK and CGLIB proxies?
- Why does calling a method on `this` ignore the annotation?
- How would you write an aspect?

This lesson builds on the [Spring core](lesson:spring-core) lifecycle, where a post-processor creates the proxies. It is also the base for [transactions](lesson:acid-base#transactional), caching, async methods and method security.

The demo has three scenes: a call through a proxy, the self-invocation trap, and a chain of advice.

```demo
name: spring-aop-walk
```

> **One sentence to remember:** *Spring wraps a bean in a proxy that adds behaviour around its methods, so only calls that go through the proxy get that behaviour.*

## The idea {#idea}

### Cross-cutting concerns {#crosscutting}

Some behaviour is needed in many classes but is not business logic. Examples are transactions, security checks, logging, metrics, caching, retries and auditing. This is called a **cross-cutting concern**.

If you write it inside every method, you repeat the same code everywhere and bury the business logic. **Aspect-oriented programming (AOP)** moves each concern into one place, called an **aspect**, and declares *where* it applies. The business methods stay clean.

### Vocabulary {#terms}

| Term | Meaning |
| --- | --- |
| **Aspect** | A module of cross-cutting behaviour: a class annotated `@Aspect`. |
| **Join point** | A point in the program where advice can run. In Spring AOP this is always **a method execution**. |
| **Pointcut** | An expression that selects which join points (methods) the advice applies to. |
| **Advice** | The code to run at a join point: before, after, around and so on. |
| **Target** | The original bean that gets the advice. |
| **Proxy** | The object that stands in front of the target and runs the advice. |
| **Weaving** | Connecting aspects to targets. Spring does it at run time with proxies. AspectJ does it at compile time or load time. |

## How Spring AOP works {#how}

![A call through a Spring AOP proxy](images/spring-aop-proxy-call.png "The caller invokes the proxy, which runs the advice and then calls the plain object. | Spring Framework documentation, Apache-2.0 | https://github.com/spring-projects/spring-framework")

### Proxies {#proxies}

If any advice matches a bean, a `BeanPostProcessor` replaces the bean with a **proxy** **after initialisation** (see the [lifecycle](lesson:spring-core#lifecycle)). Callers receive the proxy. Every method call then goes: proxy → the chain of advice → the target.

Spring can build two kinds of proxy:

| | JDK dynamic proxy | CGLIB proxy |
| --- | --- | --- |
| How it works | It implements the target's interfaces, using `java.lang.reflect.Proxy`. | It generates a **subclass** of the target class. |
| What it needs | The bean must implement an interface, and you inject it by the interface type. | The class must not be `final` and must have a visible constructor. |
| What it cannot advise | Methods that are not in the interface. | `final` or `private` methods, and `final` classes. |
| Spring Boot default | No. | **Yes** (`spring.aop.proxy-target-class=true`). It works without interfaces, and injection by class works. |

A CGLIB proxy is a subclass of your class, so you can inject it by the concrete class. A JDK proxy only implements the interfaces, so injecting it by the concrete class would fail.

### Spring AOP versus AspectJ {#aspectj}

| | Spring AOP | AspectJ |
| --- | --- | --- |
| Weaving | Proxies at run time. | Changes the bytecode at compile time or load time. |
| Join points | Only public method calls on **Spring beans**. | Any method, constructors, field access, and calls inside the same object. |
| Self-invocation | Not advised. | Advised, because no proxy is involved. |
| Setup and speed | Simple, with a small cost per call. | Needs a special compiler or agent, but has no proxy cost. |
| Use | Almost always. | When you must advise objects that are not beans, or internal calls. |

## Writing an aspect {#aspect}

### Pointcuts and advice {#advice}

```java
@Aspect
@Component
class TimingAspect {

    private static final Logger log = LoggerFactory.getLogger(TimingAspect.class);

    // pointcut: any public method in the service package
    @Pointcut("execution(public * com.bank.service..*(..))")
    void serviceMethods() {}

    @Around("serviceMethods()")
    Object time(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();                         // call the target (or the next advice)
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            log.info("{} took {} ms", pjp.getSignature().toShortString(), ms);
        }
    }
}
```

The `spring-boot-starter-aop` dependency (or the `aspectj` weaver on the classpath) turns on `@Aspect` processing. Boot then switches on proxying automatically.

| Advice | When it runs |
| --- | --- |
| `@Before` | Before the method. It cannot stop the method, unless it throws an exception. |
| `@AfterReturning` | After the method returns normally. It can see the result. |
| `@AfterThrowing` | After the method throws an exception. |
| `@After` | After the method in every case, like `finally`. |
| `@Around` | Wraps the whole call. It **decides whether and how to continue**, and it can change the arguments, the result or the exception. It is the most powerful, and `@Transactional` and `@Cacheable` use it. |

Common pointcut expressions:

- `execution(modifiers? return-type declaring-type? name(params) throws?)` matches method signatures.
- `within(com.bank.service..*)` matches every method in a package.
- `@annotation(com.bank.Audited)` matches methods with an annotation.
- `@within(...)`, `bean(*Service)` and `args(...)` match by class annotation, bean name and arguments.

You can combine them with `&&`, `||` and `!`.

### Annotation-driven aspects {#annotation}

The cleanest pattern is your own annotation that marks the methods to advise:

```java
@Target(ElementType.METHOD) @Retention(RetentionPolicy.RUNTIME)
public @interface Audited { String action(); }

@Aspect @Component
class AuditAspect {
    private final AuditLog auditLog;
    AuditAspect(AuditLog auditLog) { this.auditLog = auditLog; }

    @AfterReturning("@annotation(audited)")
    void record(JoinPoint jp, Audited audited) {
        auditLog.write(audited.action(), jp.getArgs());
    }
}

@Service class TransferService {
    @Audited(action = "TRANSFER") public void transfer(...) { ... }
}
```

Any method marked `@Audited` is now written to the audit log after it returns. The method itself contains no audit code.

### Ordering {#order}

When several aspects apply to one method, they form a chain. The outermost aspect runs first on the way in and last on the way out.

You set the order with `@Order(n)` on the aspect, or by implementing `Ordered`. A lower number means further out.

The order matters:

- Security should be outside the transaction, so a rejected caller never opens a transaction.
- A **retry aspect must be outside the transaction aspect**, so each retry gets a fresh transaction.

## Built on proxies {#built-on}

Much of Spring is AOP in disguise:

| Annotation | What the proxy does |
| --- | --- |
| `@Transactional` | Begins a transaction, then commits it or rolls it back around the method ([transactions](lesson:acid-base#transactional)). |
| `@Async` | Hands the call to a thread pool and returns straight away. |
| `@Cacheable` / `@CacheEvict` | Returns a cached result, or removes an entry from the cache, around the call. |
| `@PreAuthorize` / `@Secured` | Checks permissions before the call ([Spring Security](lesson:spring-security)). |
| `@Retryable`, `@Validated` (method validation), `@Scheduled` locking | Wrap the call with retry or validation logic. |

Because they all use the same mechanism, they all have the same **limits**.

## Pitfalls {#pitfalls}

### Self-invocation {#self-invocation}

When one method calls another method **on the same object** (`this.audit()`, or just `audit()`), it is a plain Java call on the target. It never goes through the proxy, so the advice is skipped.

```java
@Service
class TransferService {
    @Transactional
    public void process(Transfer t) {
        // ...
        audit(t);                      // direct call: @Transactional(REQUIRES_NEW) below is ignored
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void audit(Transfer t) { ... }
}
```

Ways to fix it:

- **Move the method to another bean and inject that bean.** This is the usual answer.
- Inject the bean into itself, or use `AopContext.currentProxy()`. This works, but it is a code smell.
- Restructure the code so the annotated method is the one called from outside.
- Use **AspectJ** weaving mode.

### Other limits {#limits}

- **Only public methods** are advised by default. Recent versions can advise protected and package-private methods with CGLIB for some advice, but do not rely on it. `private` methods are never advised.
- **`final` classes and methods** cannot be overridden by a CGLIB subclass, so they get no advice. (Kotlin classes are final by default and need the `all-open` plugin.)
- **Only Spring beans** are advised. An object created with `new` has no proxy.
- **Constructors and `@PostConstruct`** may run before the proxy exists, so calls made there get no advice.
- **Thread boundaries.** `@Async` runs the method on another thread, so the caller's transaction and security context do not follow it.
- **Swallowed exceptions.** If a `@Transactional` method catches an exception and does not rethrow it, the advice never sees it, so the transaction commits.
- **Type and equality.** The injected object is a proxy, so `bean.getClass()` returns a generated class. When debugging, use `AopUtils.getTargetClass(bean)` and `AopUtils.isAopProxy(bean)`.

Try it in the lab: [AOP proxies and the self-invocation trap](lab:aop-proxy-self-call).

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| AOP | Moves cross-cutting concerns (transactions, security, logging) into aspects. |
| Spring AOP | Proxies at run time. Only method executions on Spring beans. |
| Proxy types | JDK (interfaces) or CGLIB (subclass). Boot uses CGLIB by default. |
| Advice | Before, after returning, after throwing, after, and around (the most powerful). |
| Pointcut | `execution(...)`, `within`, `@annotation` and `bean`, combined with `&&`, `\|\|` and `!`. |
| Ordering | `@Order`: lower is further out. Retry outside the transaction, security before it. |
| Annotations that use it | `@Transactional`, `@Async`, `@Cacheable` and `@PreAuthorize`. |
| Self-invocation | `this.method()` skips the proxy, so the advice is ignored. |
| Limits | No private, final or non-bean targets. `@Async` crosses a thread boundary. |
| Alternative | AspectJ weaving advises anything, including self-invocation. |

## Interview questions {#questions}

### [basic] What is AOP and why is it useful? {#aop-q}

AOP (aspect-oriented programming) separates cross-cutting concerns from business logic. Examples are transactions, logging, security and caching.

Instead of repeating that code in every method, you write it once as an aspect. A pointcut declares where it applies.

This removes duplication and keeps the business code focused.

### [basic] Explain aspect, advice, pointcut and join point. {#terms-q}

- An **aspect** is a class that holds cross-cutting behaviour.
- A **join point** is a point in the program where behaviour can be added. In Spring AOP it is always a method execution.
- A **pointcut** is an expression that selects which join points to use.
- **Advice** is the code that runs at those join points: before, after, around and so on.

### [basic] What are the types of advice? {#advice-q}

There are five:

- `@Before` runs before the method.
- `@AfterReturning` runs after a normal return.
- `@AfterThrowing` runs after an exception.
- `@After` always runs, like `finally`.
- `@Around` wraps the call. It controls whether the method runs, with which arguments, and what it returns.

`@Around` is the most flexible. Transactions and caching use it.

### [basic] How does Spring implement AOP? {#impl-q}

With proxies at run time.

After a bean is initialised, a `BeanPostProcessor` wraps it in a proxy. The proxy is a JDK dynamic proxy if the bean has interfaces, and a CGLIB subclass otherwise. It runs the chain of advice around each call, then calls the target.

Callers hold the proxy, not the original bean.

### [basic] What is the difference between JDK dynamic proxies and CGLIB? {#proxy-q}

- A **JDK proxy** implements the target's interfaces. It can only intercept interface methods.
- A **CGLIB proxy** is a subclass of the target class. It works without interfaces, but it cannot advise final classes or final methods.

Spring Boot uses CGLIB by default (`proxy-target-class=true`).

### [intermediate] How does @Transactional work? {#tx-q}

A proxy with transaction advice wraps the bean. For each call:

1. On entry, it gets a connection and begins a transaction through the `PlatformTransactionManager`. The transaction is bound to the current thread.
2. It calls the target method.
3. On a normal return, it commits.
4. On a `RuntimeException` or an `Error`, by default, it rolls back.

Your method contains no transaction code.

### [intermediate] Why does @Transactional not work when a method calls another method in the same class? {#self-q}

Because `this.other()` is a direct call on the target object. It does not go through the proxy, so the transaction advice never runs. The annotation on the inner method is ignored.

To fix it:

- move the method to another bean and inject that bean,
- restructure the code, or
- use AspectJ weaving mode.

### [intermediate] Why does @Transactional on a private method have no effect? {#private-q}

A proxy intercepts calls by overriding or implementing public methods. A CGLIB subclass cannot override a `private` method, and the method is called directly. So no advice runs.

Put the annotation on a public method of a Spring bean, and call it from another bean.

### [intermediate] What is the difference between Spring AOP and AspectJ? {#aspectj-q}

- **Spring AOP** uses proxies at run time. It only supports method executions on Spring beans, and it is simple to set up.
- **AspectJ** weaves aspects into the bytecode at compile time or load time. It supports many more join points (constructors, field access, internal calls) on any object, and it has no proxy cost. But it needs extra tooling.

Use Spring AOP unless you need something only AspectJ can do.

### [intermediate] How do you control the order of multiple aspects? {#order-q}

Put `@Order(n)` on the aspect class, or implement `Ordered`. A lower value means higher priority, which means the aspect wraps further out.

A good order is: security first, then retry, then the transaction. Then each retry runs in a new transaction, and an unauthorised call never opens one.

### [intermediate] How can you tell whether a bean is proxied? {#debug-q}

- Call `AopUtils.isAopProxy(bean)` or `AopUtils.isCglibProxy(bean)`.
- Look at `bean.getClass()`. A proxy has a name like `$$SpringCGLIB$$`.
- `AopUtils.getTargetClass(bean)` returns the real class.

If an annotation seems to be ignored, check three things: the call comes from another bean, the method is public and not final, and the container manages the bean.

### [intermediate] What happens to @Async and @Transactional together? {#async-q}

`@Async` runs the method on another thread from a thread pool. The transaction, and the security context, belong to the calling thread and do not move with the call.

So:

- If the async method has `@Transactional`, it starts its own transaction.
- The caller cannot roll back that transaction.
- If a class calls its own `@Async` method (self-invocation), the method runs synchronously, on the same thread.

### [deep] Why must a retry aspect sit outside the transaction aspect? {#retry-q}

If retry is inside the transaction advice, every retry reuses the same transaction. After the first failure, that transaction may already be marked rollback-only, or it may hold stale data and locks.

If retry is outside, each attempt calls the transactional proxy again and gets a fresh transaction.

Set this with `@Order`: give retry the lower number, so it is further out.

### [deep] How does Spring create the proxy and decide which beans to proxy? {#auto-proxy-q}

An `AbstractAutoProxyCreator` does it. It is a `BeanPostProcessor` that Spring registers for you.

1. It collects all advisors. An advisor is a pointcut plus its advice. Advisors come from `@Aspect` classes and from Spring itself, for transactions and caching.
2. After each bean is initialised, it checks whether any pointcut matches one of the bean's methods.
3. If one does, it builds a `ProxyFactory` with the matching advisors and returns the proxy instead of the bean.

### [deep] What are the performance and design costs of AOP? {#cost-q}

- A small cost per call from the chain of interceptors. Next to I/O, this is usually too small to matter.
- Harder debugging, because stack traces have proxies in between.
- Hidden behaviour: you cannot see it when you read the method.
- The self-invocation and visibility pitfalls.

Use AOP for real cross-cutting concerns, not to hide ordinary business flow.

### [coding] Write an aspect that logs the duration of methods annotated @Timed. {#coding-timed}

```java
@Target(ElementType.METHOD) @Retention(RetentionPolicy.RUNTIME)
public @interface Timed {}

@Aspect @Component
class TimedAspect {
    private static final Logger log = LoggerFactory.getLogger(TimedAspect.class);

    @Around("@annotation(com.bank.Timed)")
    Object measure(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();
        } finally {
            log.info("{} took {} ms", pjp.getSignature().toShortString(), (System.nanoTime() - start) / 1_000_000);
        }
    }
}
```

Explain four things:

- `proceed()` runs the target. The method does not run unless you call it.
- `finally` records the time even when the method throws.
- Only calls that go through the proxy are measured.
- For real metrics, Micrometer's `@Timed` and `@Observed` already do this.

### [coding] Fix the self-invocation bug so audit() really runs in its own transaction. {#coding-self}

```java
@Service
class TransferService {
    @Transactional
    public void process(Transfer t) {
        saveTransfer(t);
        audit(t);                                              // bug: skips the proxy
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void audit(Transfer t) { ... }
}
```

```java
@Service
class AuditService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void audit(Transfer t) { ... }
}

@Service
class TransferService {
    private final AuditService auditService;
    TransferService(AuditService auditService) { this.auditService = auditService; }

    @Transactional
    public void process(Transfer t) {
        saveTransfer(t);
        auditService.audit(t);                                  // goes through the AuditService proxy
    }
}
```

Explain three things:

- The call now goes through the `AuditService` proxy, so a new transaction starts.
- The audit is committed even if `process` rolls back later.
- This is why the annotated method belongs in a separate bean.

### [coding] Retry and transaction ordering with aspects. {#coding-order}

```java
@Aspect @Component @Order(1)               // outer: runs first on the way in
class RetryAspect {
    @Around("@annotation(retryable)")
    Object retry(ProceedingJoinPoint pjp, Retryable retryable) throws Throwable {
        int attempts = 0;
        while (true) {
            try { return pjp.proceed(); }
            catch (OptimisticLockingFailureException e) {
                if (++attempts >= retryable.maxAttempts()) throw e;
            }
        }
    }
}
// transaction advice has a lower precedence (higher order value), so it sits inside:
// each pjp.proceed() opens a fresh transaction
```

Explain the order of the chain: retry, then the transaction, then the target. If the order were reversed, every retry would run inside a transaction that had already rolled back ([optimistic locking](lesson:acid-base#jpa-locks)).
