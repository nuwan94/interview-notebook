---
title: Spring AOP and proxies — aspects, advice, pointcuts and the self-invocation trap
nav: AOP and proxies
slug: spring-aop
summary: Cross-cutting concerns and aspect-oriented programming in Spring, JDK dynamic proxies versus CGLIB, writing aspects with pointcuts and advice, how @Transactional, @Async and @Cacheable work through proxies, and the pitfalls (self-invocation, private and final methods), with Java examples and interview questions.
tags: [Spring, AOP, Proxy, Aspect, Transactional]
order: 28
topic: Spring / Fundamentals
updated: 2026-11-13
subnav: true
---

"How does `@Transactional` work?" is the standard way into this lesson, and the correct answer is *a proxy*. Interviewers follow with *what is AOP, JDK versus CGLIB proxies, why does calling a method on `this` ignore the annotation, and how would you write an aspect?* It builds on the [Spring core](lesson:spring-core) lifecycle (proxies are created by a post-processor) and underpins [transactions](lesson:acid-base#transactional), caching, async and method security. Play the three scenes: a call through a proxy, the self-invocation trap, and an advice chain.

```demo
name: spring-aop-walk
```

> **One sentence to remember:** *Spring AOP wraps a bean in a proxy that runs extra behaviour (advice) before and after your method, so it only works for calls that go through the proxy, never for calls from inside the object.*

## The idea {#idea}

### Cross-cutting concerns {#crosscutting}

Some behaviour applies to many classes but is not business logic: transactions, security checks, logging, metrics, caching, retries, auditing. Writing it inside every method duplicates code and clutters the business logic. **Aspect-oriented programming (AOP)** pulls such a **cross-cutting concern** into one place (an **aspect**) and declares *where* it applies, so the methods stay clean.

### Vocabulary {#terms}

| Term | Meaning |
| --- | --- |
| **Aspect** | a module of cross-cutting behaviour (a class annotated `@Aspect`) |
| **Join point** | a point in execution where advice can apply; in Spring AOP always **a method execution** |
| **Pointcut** | an expression selecting which join points (methods) the advice applies to |
| **Advice** | the code to run at a join point: before, after, around ... |
| **Target** | the original bean being advised |
| **Proxy** | the object that stands in front of the target and applies the advice |
| **Weaving** | linking aspects to targets: at runtime by proxy (Spring) or at compile or load time (AspectJ) |

## How Spring AOP works {#how}

### Proxies {#proxies}

When a bean matches any advisor, a `BeanPostProcessor` replaces it **after initialisation** with a **proxy** (see the [lifecycle](lesson:spring-core#lifecycle)). Callers receive the proxy; each method call goes proxy, then the advice chain, then the target.

| | JDK dynamic proxy | CGLIB proxy |
| --- | --- | --- |
| Mechanism | implements the target's interfaces (`java.lang.reflect.Proxy`) | generates a **subclass** of the target class |
| Needs | the bean implements an interface; inject by the interface type | a non-`final` class with a visible constructor |
| Cannot advise | methods not in the interface | `final` or `private` methods, final classes |
| Spring Boot default | no | **yes** (`spring.aop.proxy-target-class=true`), so it works even without interfaces and injection by class works |

Because the proxy is a subclass or a sibling implementation, injecting by the concrete class works with CGLIB but would fail with a JDK proxy.

### Spring AOP versus AspectJ {#aspectj}

| | Spring AOP | AspectJ |
| --- | --- | --- |
| Weaving | runtime proxies | compile-time or load-time bytecode weaving |
| Join points | public method calls on **Spring beans** only | any method, constructors, field access, calls inside the same object |
| Self-invocation | not advised | advised (no proxy involved) |
| Setup and speed | simple, small runtime overhead | needs a compiler or agent, no proxy overhead |
| Use | the 95 percent case | when you must advise non-beans or internal calls |

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

The dependency `spring-boot-starter-aop` (or the `aspectj` weaver on the classpath) enables `@Aspect` processing; Boot turns on proxying automatically.

| Advice | Runs |
| --- | --- |
| `@Before` | before the method; cannot stop it unless it throws |
| `@AfterReturning` | after normal return (can see the result) |
| `@AfterThrowing` | after an exception |
| `@After` | after the method regardless (like `finally`) |
| `@Around` | wraps the call; **decides whether and how to proceed**, can change arguments, result or exception. The most powerful, used by `@Transactional` and `@Cacheable` |

Common pointcut designators: `execution(modifiers? return-type declaring-type? name(params) throws?)`, `within(com.bank.service..*)`, `@annotation(com.bank.Audited)`, `@within(...)`, `bean(*Service)`, `args(...)`, combinable with `&&`, `||`, `!`.

### Annotation-driven aspects {#annotation}

The cleanest pattern is a custom annotation that marks the methods to advise:

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

### Ordering {#order}

When several aspects apply to one method, they form a chain: the outermost runs first on the way in and last on the way out. Control it with `@Order(n)` on the aspect (lower is outer) or by implementing `Ordered`. The order matters: for example security before transaction (no transaction for a rejected caller), and a **retry aspect must be outside the transaction aspect** so each retry gets a fresh transaction.

## Built on proxies {#built-on}

Much of Spring is AOP in disguise:

| Annotation | What the proxy does |
| --- | --- |
| `@Transactional` | begins, commits or rolls back a transaction around the method ([transactions](lesson:acid-base#transactional)) |
| `@Async` | submits the call to an executor and returns immediately |
| `@Cacheable` / `@CacheEvict` | returns a cached result or evicts, around the call |
| `@PreAuthorize` / `@Secured` | checks permissions before the call ([Spring Security](lesson:spring-security)) |
| `@Retryable`, `@Validated` (method validation), `@Scheduled` locking | wrap the call with retry or validation logic |

Because they all use the same mechanism, they share the same **limits**.

## Pitfalls {#pitfalls}

### Self-invocation {#self-invocation}

A call from one method to another **on the same object** (`this.audit()`, or just `audit()`) is a plain Java call on the target and never passes through the proxy, so the advice is skipped.

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

Fixes: move the method to **another bean** and inject it (the usual answer), inject the bean into itself or use `AopContext.currentProxy()` (works but smells), restructure so the annotated method is the entry point, or use **AspectJ** weaving mode.

### Other limits {#limits}

- **Only public methods** are advised by default with proxies (protected and package-private work with CGLIB in recent versions for some advice, but do not rely on it); `private` methods are never advised.
- **`final` classes and methods** cannot be overridden by a CGLIB subclass, so no advice (Kotlin classes need the `all-open` plugin).
- **Only Spring beans** are advised: an object created with `new` has no proxy.
- **Calls inside the aspect or constructors** (`@PostConstruct`) may run before the proxy exists.
- **Thread boundaries:** `@Async` runs the method on another thread, so the caller's transaction and security context do not follow it.
- **Exceptions swallowed** inside a `@Transactional` method are invisible to the advice, so the transaction commits.
- **Equality and type:** the injected object is a proxy; `bean.getClass()` is a generated class, so use `AopUtils.getTargetClass(bean)` and `AopUtils.isAopProxy(bean)` when debugging.

## Cheat sheet {#cheatsheet}

| Topic | Key point |
| --- | --- |
| AOP | extract cross-cutting concerns (transactions, security, logging) into aspects |
| Spring AOP | runtime proxies, method execution join points on Spring beans only |
| Proxy types | JDK (interfaces) or CGLIB (subclass); Boot defaults to CGLIB |
| Advice | before, after returning, after throwing, after, around (most powerful) |
| Pointcut | `execution(...)`, `within`, `@annotation`, `bean`, combined with `&&` `||` `!` |
| Ordering | `@Order`, lower is outer; retry outside transaction, security before it |
| Annotations that use it | `@Transactional`, `@Async`, `@Cacheable`, `@PreAuthorize` |
| Self-invocation | `this.method()` skips the proxy: advice ignored |
| Limits | no private, final or non-bean targets; thread boundary for `@Async` |
| Alternative | AspectJ weaving advises anything, including self-invocation |

## Interview questions {#questions}

### [basic] What is AOP and why is it useful? {#aop-q}

Aspect-oriented programming separates cross-cutting concerns such as transactions, logging, security and caching from business logic. Instead of repeating that code in every method, you write it once as an aspect and declare with a pointcut where it applies. It reduces duplication and keeps business code focused.

### [basic] Explain aspect, advice, pointcut and join point. {#terms-q}

An aspect is a class holding cross-cutting behaviour. A join point is a point in execution where behaviour can be added (in Spring AOP, a method execution). A pointcut is an expression selecting which join points. Advice is the code that runs at them (before, after, around, and so on).

### [basic] What are the types of advice? {#advice-q}

`@Before` (before the method), `@AfterReturning` (after normal return), `@AfterThrowing` (after an exception), `@After` (always, like finally) and `@Around` (wraps the invocation and controls whether the method runs, its arguments and its result). `@Around` is the most flexible and is what transactions and caching use.

### [basic] How does Spring implement AOP? {#impl-q}

With runtime proxies. After a bean is initialised, a `BeanPostProcessor` wraps it in a proxy (JDK dynamic proxy for interfaces, CGLIB subclass otherwise) that applies the advice chain around calls and delegates to the target. Callers hold the proxy, not the original bean.

### [basic] What is the difference between JDK dynamic proxies and CGLIB? {#proxy-q}

JDK proxies implement the target's interfaces and can only intercept interface methods; CGLIB subclasses the target class so it works without interfaces but cannot advise final classes or methods. Spring Boot uses CGLIB by default (`proxy-target-class=true`).

### [intermediate] How does @Transactional work? {#tx-q}

A proxy with transaction advice wraps the bean. On entry it obtains a connection, begins a transaction and binds it to the thread through the `PlatformTransactionManager`; it then proceeds to the target; on normal return it commits, and on a `RuntimeException` or `Error` (by default) it rolls back. Your method contains no transaction code.

### [intermediate] Why does @Transactional not work when a method calls another method in the same class? {#self-q}

Because the call `this.other()` is a direct call on the target object, not through the proxy, so the transaction advice never runs. The annotation on the inner method is ignored. Fix by moving the method to another bean and injecting it, by restructuring, or by using AspectJ weaving mode.

### [intermediate] Why does @Transactional on a private method have no effect? {#private-q}

Proxies intercept calls from outside by overriding or implementing public methods; a `private` method cannot be overridden by a CGLIB subclass and is called directly, so no advice applies. Use a public method on a Spring-managed bean (and call it from another bean).

### [intermediate] What is the difference between Spring AOP and AspectJ? {#aspectj-q}

Spring AOP uses runtime proxies, supports only method-execution join points on Spring beans, and is simple to set up. AspectJ weaves aspects into the bytecode at compile or load time, supports many join points (constructors, field access, internal calls) on any object, and avoids proxy overhead, but needs extra tooling. Use Spring AOP unless you need what only AspectJ provides.

### [intermediate] How do you control the order of multiple aspects? {#order-q}

With `@Order(n)` on the aspect class or by implementing `Ordered`; a lower value gives higher precedence and wraps outermost. For example security first, then the retry aspect, then the transaction, so each retry runs in a new transaction and unauthorised calls never open one.

### [intermediate] How can you tell whether a bean is proxied? {#debug-q}

`AopUtils.isAopProxy(bean)`, `AopUtils.isCglibProxy(bean)`, or look at `bean.getClass()` (names like `$$SpringCGLIB$$`). `AopUtils.getTargetClass(bean)` returns the real class. If an annotation seems ignored, check that the call comes from another bean, the method is public and non-final, and the bean is container-managed.

### [intermediate] What happens to @Async and @Transactional together? {#async-q}

`@Async` runs the method on another thread from an executor. The transaction (and security context) belongs to the calling thread and does not propagate, so the async method starts its own transaction if it has `@Transactional`, and the caller cannot roll it back. Also self-invocation of an `@Async` method runs synchronously.

### [deep] Why must a retry aspect sit outside the transaction aspect? {#retry-q}

If the retry advice is inside the transaction advice, a retry reuses the same transaction, which may already be marked rollback-only after the failure (or hold stale state and locks). Placed outside, each attempt calls the transactional proxy again and gets a fresh transaction. Set it with `@Order` (retry lower number, so outer).

### [deep] How does Spring create the proxy and decide which beans to proxy? {#auto-proxy-q}

An `AbstractAutoProxyCreator` (a `BeanPostProcessor`, registered for you) looks up all advisors (pointcut plus advice, from `@Aspect` classes and infrastructure like transaction and cache advisors) and, for each bean after initialisation, checks whether any pointcut matches one of its methods. If so it builds a `ProxyFactory` with the matching advisors and returns the proxy instead of the bean.

### [deep] What are the performance and design costs of AOP? {#cost-q}

A small per-call overhead from the interceptor chain (usually negligible beside I/O), harder debugging and stack traces with proxies in between, hidden behaviour that is invisible when reading the method, and the self-invocation and visibility pitfalls. Use AOP for genuine cross-cutting concerns, not to hide ordinary business flow.

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

Explain that `proceed()` runs the target and must be called for the method to execute, that `finally` records the time even on exceptions, that only calls through the proxy are measured, and that Micrometer's `@Timed` and `@Observed` do this for real metrics.

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

Explain that the call now crosses a proxy so the new transaction is started, the audit is committed even if `process` later rolls back, and that this is why the annotated method belongs in a separate bean.

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

Explain the chain order (retry, then transaction, then target) and why the reverse would retry inside an already rolled-back transaction ([optimistic locking](lesson:acid-base#jpa-locks)).
