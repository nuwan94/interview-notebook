---
title: Exceptions and error handling — checked, unchecked, try-with-resources and good practice
nav: Exceptions
slug: java-exceptions
summary: How Java reports and handles failure: the Throwable hierarchy, checked and unchecked exceptions, try, catch and finally and their traps, try-with-resources and suppressed exceptions, custom exceptions and exception chaining, what to catch and what never to catch, logging, exceptions in threads, lambdas and async code, the cost of a stack trace, and how Spring turns exceptions into HTTP errors and transaction rollbacks, with banking examples and interview questions.
tags: [Java, Exceptions, Error handling, try-with-resources, Spring, Best practices]
order: 9
topic: Java / Language
updated: 2026-11-17
subnav: true
---

A bank system spends much of its code on what happens when something goes wrong: the account has too little money, the database is slow, the network call times out, the input is bad. Interviews ask *what the difference between checked and unchecked exceptions is, how `finally` behaves, why try-with-resources exists, how to design a custom exception, what you should never catch, and how an exception becomes an HTTP error or a transaction rollback in Spring.* Play the four scenes: the exception hierarchy, what runs in `try`, `catch` and `finally`, how try-with-resources closes things, and the path of a failure through a Spring service.

```demo
name: exception-walk
```

> **One sentence to remember:** *Throw an exception when a method cannot do what its name promises, catch it only where you can do something useful about it, never swallow it, always keep the original cause, and close resources with try-with-resources.*

## The Throwable hierarchy {#hierarchy}

Only a `Throwable` can be thrown. It records a **message**, an optional **cause**, the **stack trace** at the point where it was created, and a list of **suppressed** exceptions. It has two direct subclasses:

- **`Error`**: a serious problem of the JVM or the environment that a program is not expected to handle: `OutOfMemoryError`, `StackOverflowError`, `NoClassDefFoundError`, `AssertionError`. Do not catch them in normal code. See [what to do about an OutOfMemoryError](lesson:jvm-troubleshooting#oom).
- **`Exception`**: a condition a program may want to handle. It splits again:
  - **checked**: every `Exception` that is **not** a `RuntimeException`, for example `IOException`, `SQLException`, `TimeoutException`. The compiler forces you to **catch** them or **declare** them with `throws`.
  - **unchecked**: `RuntimeException` and its subclasses, for example `NullPointerException`, `IllegalArgumentException`, `IllegalStateException`, `ArithmeticException`, `IndexOutOfBoundsException`, `ClassCastException`, `ConcurrentModificationException`, `UnsupportedOperationException`. The compiler does not check them.

| | Checked | Unchecked (`RuntimeException`) | `Error` |
| --- | --- | --- | --- |
| Compiler forces catch or `throws` | yes | no | no |
| Typical meaning | a failure the caller could reasonably handle (file missing, network down) | a bug or a broken rule (null, bad argument, wrong state) | the JVM is in trouble |
| Should you catch it? | yes, where you can recover or translate it | only at a boundary, or to translate it | almost never |
| Examples | `IOException`, `SQLException` | `IllegalArgumentException`, `InsufficientFundsException` (your own) | `OutOfMemoryError`, `StackOverflowError` |

## try, catch and finally {#try-catch}

```java
try {
    ledger.debit(from, cents);
    ledger.credit(to, cents);
} catch (InsufficientFundsException e) {        // the first matching catch runs
    audit.rejected(from, cents);
    throw e;                                     // not handled here: let the caller decide
} catch (LedgerUnavailableException | TimeoutException e) {   // multi-catch: one block, several types
    throw new TransferFailedException("Transfer not completed", e);
} finally {
    metrics.increment("transfer.attempted");     // runs whether or not an exception occurred
}
```

The rules:

- The **first** catch whose type matches (the thrown type or one of its superclasses) runs. Put **subclasses before superclasses**. The other order does not compile, because the later block is unreachable.
- A **multi-catch** (Java 7) lists alternatives with `|`. The types must not be related by inheritance, and the variable is implicitly final.
- Catching a **checked** exception that the `try` body cannot throw is a compile error (except `Exception` and `Throwable`).
- A `finally` block runs after the `try` and any `catch`, **even after a `return`, `break` or a thrown exception**. It does **not** run if the JVM exits (`System.exit`, a crash, power loss), if the thread is killed, or if the `try` never ends (an endless loop or a deadlock).
- **Do not `return` or `throw` from `finally`.** It replaces whatever the `try` block was doing, so an exception from the `try` simply disappears. This is the classic trap in the second scene.

```java
static int broken() {
    try {
        throw new IllegalStateException("lost");
    } finally {
        return 2;            // the exception is discarded and the method returns 2
    }
}
```

## try-with-resources {#resources}

Anything that holds an external resource (a file, a socket, a JDBC `Connection`) must be closed even when something fails. Before [Java 7](lesson:java-version-history#java-7) that meant a clumsy `finally` with a second `try` inside. A resource that implements `AutoCloseable` can be declared in the `try` header and is closed **automatically, in reverse order of opening**:

```java
String sql = "SELECT balance_cents FROM account WHERE id = ?";
try (Connection con = dataSource.getConnection();
     PreparedStatement ps = con.prepareStatement(sql)) {
    ps.setString(1, accountId);
    try (ResultSet rs = ps.executeQuery()) {
        return rs.next() ? rs.getLong(1) : 0L;
    }
} catch (SQLException e) {
    throw new AccountStoreException("Cannot read balance of " + accountId, e);
}
```

Why it is better than `finally`:

- **No leak and no boilerplate.** Every resource that was opened is closed, in the right order, on every path.
- **No masked exception.** If the body throws and `close()` throws too, the body's exception stays the **primary** one and the failure from `close()` is attached to it as a **suppressed** exception. You read it with `getSuppressed()`. With a hand-written `finally`, the second exception would replace the first and the real cause would be lost.
- Since [Java 9](lesson:java-version-history#java-9) an existing effectively final variable can be used directly: `try (con) { ... }`.

## Throwing, wrapping and custom exceptions {#custom}

Use `throw` to raise an exception and `throws` in a signature to declare which **checked** exceptions a method may raise. When you catch a low-level exception and raise a higher-level one, always pass the original as the **cause**. This is **exception chaining**, and the stack trace then shows `Caused by:` with the whole story.

```java
public class InsufficientFundsException extends RuntimeException {
    private final String accountId;
    private final long shortfallCents;

    public InsufficientFundsException(String accountId, long shortfallCents) {
        super("Account " + accountId + " is short by " + shortfallCents + " cents");
        this.accountId = accountId;
        this.shortfallCents = shortfallCents;
    }
    public String accountId() { return accountId; }
    public long shortfallCents() { return shortfallCents; }
}

public class AccountStoreException extends RuntimeException {
    public AccountStoreException(String message, Throwable cause) { super(message, cause); }
}
```

Guidelines for your own exceptions:

- **Prefer a standard exception** when one fits: `IllegalArgumentException` for a bad argument, `IllegalStateException` for a call at the wrong moment, `NoSuchElementException`, `UnsupportedOperationException`, `ArithmeticException`. Create your own when the caller needs to tell this failure apart or read data from it.
- Name it for **what went wrong** (`InsufficientFundsException`), not where (`ServiceException`). A small hierarchy with a base type (`PaymentException`) lets callers catch a family.
- Offer the standard constructors, especially `(String message, Throwable cause)`.
- Put **useful, safe data** in it (account id, amount, error code). Do not put secrets, full card numbers or personal data in the message, because messages end up in logs and sometimes in responses.
- **Exception translation:** a layer should throw exceptions that belong to its own abstraction. A repository does not leak `SQLException` to the service, it throws its own exception or Spring's `DataAccessException`, with the original as the cause.

## Checked or unchecked? {#checked}

The traditional advice is to use a **checked** exception for a recoverable condition the caller can be expected to handle and an **unchecked** one for a programming error. In practice most modern code, including Spring, uses **unchecked** exceptions almost everywhere:

- checked exceptions **leak** through every layer's signature, or are wrapped and rethrown many times;
- they do not work with **lambdas and streams**, because the standard functional interfaces declare no checked exceptions (see [lambdas](lesson:java-functional#checked-exceptions) and [streams](lesson:java-streams#checked));
- callers often cannot do anything useful with them anyway, so they end up with an empty `catch`.

A reasonable rule: use a checked exception only when you are sure that **every** caller can and should react (and document that); otherwise use an unchecked one, and convert a checked exception from a library into an unchecked one at the boundary.

When you **override** a method, the overriding method may throw the **same, a narrower or no** checked exceptions, never broader or new ones, because callers written against the parent type know only its declared exceptions. Unchecked exceptions are not restricted.

## Handling it well {#rules}

| Do | Do not |
| --- | --- |
| Catch the **most specific** type you can handle. | Catch `Exception` or `Throwable` in the middle of the code. |
| **Fail fast**: validate arguments at the start and throw `IllegalArgumentException`, `NullPointerException` (`Objects.requireNonNull`) or `IllegalStateException`. | Let a bad value travel deep before it blows up. |
| Add **context** (ids, amounts, step) and keep the **cause**. | `throw new RuntimeException("failed")` that drops the original. |
| **Log once**, at the place where you finally handle it, with the exception as the last argument: `log.error("Transfer {} failed", id, e)`. | Log and rethrow at every layer (the same failure appears ten times), or `e.printStackTrace()`. |
| Handle the failure or **let it propagate**. | An **empty catch** block, which hides bugs and money problems. |
| Clean up with **try-with-resources**. | Close in a plain `finally` by hand, or forget to close. |
| Restore the interrupt flag after catching `InterruptedException`: `Thread.currentThread().interrupt()` (see [interrupts](lesson:java-concurrency#interrupt)). | Swallow `InterruptedException`, so a thread can no longer be stopped. |
| Return an empty list or an `Optional` for "nothing found" when that is normal. | Use exceptions for **normal control flow** (for example to end a loop). |
| Catch `Throwable` only at the **very top** of a thread, to log and shut down cleanly. | Catch `OutOfMemoryError` and carry on as if nothing happened. |

Errors are not the same as exceptions: after an `OutOfMemoryError` the program state may be inconsistent, and catching a `StackOverflowError` to "try something else" hides a recursion bug.

## Threads, lambdas and async code {#threads}

- An exception that escapes `run()` ends **that thread only**. The default is to print the stack trace. Set a handler with `Thread.setDefaultUncaughtExceptionHandler` to log it properly.
- In an `ExecutorService`, an exception from a task started with **`execute()`** reaches the thread's uncaught handler (the worker dies and the pool replaces it). An exception from a task started with **`submit()`** is **captured in the `Future`** and appears only when you call `get()`, wrapped in an `ExecutionException`. A `submit()` whose future is never read **swallows the failure**.
- With **`CompletableFuture`**, handle the failure in the chain with `exceptionally`, `handle` or `whenComplete`. When stages are composed, the original exception arrives wrapped in a `CompletionException` (from `join()`) or `ExecutionException` (from `get()`), so look at `getCause()`.
- In a **lambda**, you cannot throw a checked exception from the standard interfaces. Catch it inside the lambda and wrap it in an unchecked one, or write a small adapter that does so.

```java
accountIds.stream()
        .map(id -> {
            try {
                return loader.load(id);              // throws a checked IOException
            } catch (IOException e) {
                throw new UncheckedIOException(e);   // the JDK has this wrapper for exactly this case
            }
        })
        .toList();
```

## The cost of an exception {#cost}

Throwing and catching is cheap compared with what is usually done around it. The expensive part is **filling in the stack trace** when the exception object is **created** (`fillInStackTrace`), which walks the whole call stack, so a deep stack costs more. This matters in two cases:

- **Exceptions used for control flow**, in a hot loop, are slow. Check a condition instead (`if (map.containsKey(k))`), or return an `Optional`.
- A "business" exception thrown often and never inspected can skip the trace, using the protected constructor `super(message, cause, false, false)` (disable suppression and make the stack trace not writable). Do this only for exceptions that are expected and frequent, because without a trace they are hard to debug.

Since [Java 14](lesson:java-version-history#java-14) a `NullPointerException` message says exactly what was null (*"Cannot invoke \"Account.balance()\" because \"account\" is null"*), which makes many bugs easy to find from the log. Read a stack trace from the **top** (the exception and the line where it was created) and then look at **`Caused by:`**, which gives the root cause at the bottom.

## In Spring and REST APIs {#spring}

- **One place for errors.** Do not catch exceptions in every controller. Write a `@RestControllerAdvice` with `@ExceptionHandler` methods that map each exception to a status and a body, ideally a [`ProblemDetail`](lesson:spring-mvc#errors) (RFC 9457). A business rule violation is a **4xx** (`422` or `409`), a bug or an outage is a **500** with a generic message and a correlation id, and the stack trace goes to the log only. Never return a stack trace to a client.
- **Exception translation in the data layer.** Spring converts vendor exceptions such as `SQLException` into its unchecked `DataAccessException` hierarchy (`DuplicateKeyException`, `DataIntegrityViolationException`, `OptimisticLockingFailureException`), so the service does not depend on the database.
- **Transactions.** `@Transactional` rolls back by default for **unchecked exceptions and errors**, and **commits** after a **checked** exception unless you write `rollbackFor`. Also, if an inner `@Transactional` method throws and the outer one **catches** it and carries on, the transaction is marked **rollback-only**, and the outer commit fails with `UnexpectedRollbackException`. See [rollback rules](lesson:spring-transactions#rollback).
- **Retry only what can succeed later.** A timeout or a `503` is transient and worth a retry with backoff; `InsufficientFundsException` or a validation error will fail every time. Retry only [idempotent operations](lesson:microservice-resilience#retries), with a limit.
- **Do not leak internals.** The message to the client says what the client can do, and the log carries the technical detail.

Try it in the lab: [try-with-resources and the exception that wins](lab:exceptions-try-with-resources).

## Cheat sheet {#cheatsheet}

| Need | Code or rule |
| --- | --- |
| checked, unchecked, error | `Exception` (not `RuntimeException`) is checked; `RuntimeException` unchecked; `Error` is for the JVM |
| handle several types | `catch (A \| B e)`; subclasses before superclasses |
| always clean up | `try (var in = ...) { ... }` (closed in reverse order) |
| never in `finally` | `return`, `throw` |
| keep the cause | `throw new XException("context", e)` |
| bad argument or state | `IllegalArgumentException`, `IllegalStateException`, `Objects.requireNonNull` |
| second failure during close | `e.getSuppressed()` |
| interrupted | `Thread.currentThread().interrupt()` or rethrow |
| checked exception in a lambda | wrap in an unchecked one, `UncheckedIOException` |
| failure in `submit()` | read it from `Future.get()` (`ExecutionException`) |
| cheap exception | `super(msg, cause, false, false)` (no trace), or do not use an exception |
| REST error | `@RestControllerAdvice` returning `ProblemDetail`, no stack trace |
| roll back for a checked exception | `@Transactional(rollbackFor = Exception.class)` |
| log it | once, at the handling place: `log.error("msg {}", id, e)` |

## Interview questions {#questions}

### [basic] What is the difference between checked and unchecked exceptions? {#checked-q}

A **checked** exception is a subclass of `Exception` that is not a `RuntimeException` (`IOException`, `SQLException`). The compiler forces the caller to catch it or declare it in `throws`. An **unchecked** exception is a `RuntimeException` (or an `Error`): the compiler does not check it. Checked exceptions represent conditions a caller may reasonably recover from, unchecked ones usually represent programming errors such as a null or a bad argument. In practice most modern code, Spring included, prefers unchecked exceptions, because checked ones spread through every method signature and do not work well with lambdas.

### [basic] What is the difference between `Exception` and `Error`? {#error-q}

Both extend `Throwable`. An `Exception` is a condition the application may want to handle. An `Error` is a serious problem of the JVM or the environment, such as `OutOfMemoryError`, `StackOverflowError` or `NoClassDefFoundError`, that the application normally cannot recover from, so it is not caught in normal code. Catching an `Error` is justified only at the top of a thread to log it and shut down in an orderly way.

### [basic] How do `try`, `catch` and `finally` work, and when does `finally` not run? {#finally-q}

The `try` body runs. If it throws, the first `catch` whose type matches runs. The `finally` block runs afterwards in every case: normal completion, a caught exception, an uncaught exception, even after a `return`. It does not run when the JVM exits (`System.exit`, a crash or power loss), when the thread is killed, or when the `try` body never finishes (an endless loop or a deadlock). Use `finally` for clean-up, and do not `return` or `throw` from it.

### [basic] What is try-with-resources and why is it better than `finally`? {#twr-q}

It is a `try` that declares resources implementing `AutoCloseable` in its header (`try (var in = Files.newInputStream(p)) { ... }`). They are closed automatically in **reverse order**, whether the body finishes normally or with an exception. It is shorter and safer than closing in `finally`: nothing is forgotten, and if the body and `close()` both throw, the body's exception stays primary and the one from `close()` is attached as a **suppressed** exception instead of replacing it.

### [basic] What is the difference between `throw` and `throws`? {#throw-throws-q}

`throw` is a statement that raises one exception object: `throw new IllegalStateException("closed")`. `throws` is part of a method signature and declares which checked exceptions the method may let escape, so callers know they must handle them. Unchecked exceptions need no `throws`, though it may be added for documentation.

### [intermediate] What happens if both the `try` block and the `finally` block throw or return? {#finally-return-q}

The `finally` block wins. If `try` throws exception A and `finally` throws exception B, the caller receives **B** and A is lost (a hand-written `finally` hides the original cause). If `finally` contains a `return`, it overrides both the `try` block's return value and any exception it threw, so the exception disappears silently. Therefore never `return` or `throw` from `finally`, and use try-with-resources for resources, where a failure in `close()` is suppressed and not allowed to replace the primary exception.

### [intermediate] What is a suppressed exception? {#suppressed-q}

When an exception is already propagating and another one occurs while cleaning up, in try-with-resources the second one is added to the first through `addSuppressed`, and can be read with `getSuppressed()`. The primary exception, the real problem, is the one thrown. This keeps the root cause visible while still recording that closing also failed. You can add suppressed exceptions yourself when you close several things by hand and want to report all failures.

### [intermediate] How do you design a custom exception, and should it be checked? {#custom-q}

Extend `RuntimeException` unless every caller must and can handle it. Name it for the condition (`InsufficientFundsException`), provide the `(message, cause)` constructor, and carry the data a handler needs (account id, shortfall) as fields, without secrets in the message. Consider a small hierarchy with a common base so a boundary can catch a family. Prefer a standard exception (`IllegalArgumentException`, `IllegalStateException`) when it describes the problem well. Make it checked only when it is a normal, recoverable outcome that the caller is forced to consider.

### [intermediate] What is exception chaining and why keep the cause? {#chaining-q}

When you catch a low-level exception and throw a higher-level one, pass the original as the cause: `throw new AccountStoreException("Cannot load " + id, e)`. The stack trace then shows `Caused by:` with the full chain, down to the root cause, such as a timeout or a constraint violation. If you drop the cause, the information needed to diagnose the incident is lost. Also keep the layers clean: translate low-level exceptions into the language of the layer (a repository does not leak `SQLException` to a service).

### [intermediate] What are the rules for overriding a method that throws exceptions? {#override-q}

An overriding method may declare the same checked exceptions, **narrower** ones (subclasses) or none, but never new or broader checked exceptions, because code written against the parent type only knows the parent's declaration. It may throw any unchecked exception. A constructor must declare, at least, the checked exceptions of the superclass constructor it calls. This is why an interface method that declares no exceptions cannot be implemented by a method that throws `IOException`.

### [intermediate] How do multiple catch blocks and multi-catch work? {#multi-catch-q}

Catch blocks are checked in order and the first matching type runs, so specific types must come **before** their superclasses, or the code does not compile (the later block is unreachable). A **multi-catch** `catch (IOException | SQLException e)` handles unrelated types in one block. The alternatives must not be subclasses of each other, and `e` is implicitly final. Since Java 7 you can also rethrow a caught `Exception` variable and the compiler infers the precise types (precise rethrow), as long as the variable is not reassigned.

### [intermediate] Should you catch `Exception` or `Throwable`? {#catch-all-q}

Not in ordinary code: it also catches bugs and conditions you cannot handle (and, for `Throwable`, errors such as `OutOfMemoryError`), and it hides what went wrong. Catch the specific types you can handle. Catching `Exception` is acceptable at a **boundary**, for example a request handler, a message listener or a thread's main loop, where you log, convert it to an error response and keep the system running. Catching `Throwable` belongs at the top of a thread, only to log and shut down.

### [intermediate] How should exceptions be logged? {#logging-q}

Log an exception **once**, where it is finally handled, not at every layer that rethrows it, or one failure fills the log with duplicates. Pass the exception as the last argument so the stack trace and the cause chain are printed (`log.error("Transfer {} failed", id, e)`), include identifiers, and never use `printStackTrace()`. Do not log secrets or personal data (card numbers, tokens, full account numbers). In a service, add a correlation id so a failure can be followed across services and matched with the error the client received.

### [intermediate] How do you deal with checked exceptions inside lambdas and streams? {#lambda-q}

The standard functional interfaces (`Function`, `Supplier`, `Consumer`) do not declare checked exceptions, so a lambda cannot throw them. Options: catch the checked exception inside the lambda and rethrow it wrapped in an unchecked one (`UncheckedIOException` for `IOException`), write a small `ThrowingFunction` interface with an adapter that wraps and unwraps, or avoid the lambda and use a plain loop when error handling is the main point. Do not hide the failure by returning `null` from the lambda.

### [intermediate] What happens to an exception thrown in another thread? {#thread-q}

It cannot be caught by the code that started the thread, because the thread has its own stack. An exception that escapes `run()` ends that thread and goes to its `UncaughtExceptionHandler` (the default prints the trace). In an executor, `execute()` behaves that way, and the worker is replaced, while `submit()` stores the exception in the `Future` and it only appears when you call `get()` (as an `ExecutionException`), so a result that nobody reads hides the failure. With `CompletableFuture` use `exceptionally`, `handle` or `whenComplete`. Always make sure a background failure is logged and counted.

### [intermediate] Why must you not swallow `InterruptedException`? {#interrupt-q}

An interrupt is the standard way to ask a thread to stop. When a blocking call throws `InterruptedException` the interrupt flag has been cleared. If you catch it and carry on, nobody learns that the thread was asked to stop, and shutdown or cancellation hangs. Either propagate it (declare `throws InterruptedException`) or restore the flag with `Thread.currentThread().interrupt()` and return quickly. Never leave the catch empty.

### [deep] Why are exceptions considered slow, and how can the cost be reduced? {#cost-q}

Most of the cost is creating the exception: the constructor calls `fillInStackTrace`, which walks the call stack and records every frame, and a deeper stack costs more. Throwing and catching themselves are cheap. So exceptions are expensive when they are used for **control flow** in hot code, because every normal "miss" builds a trace. Fix it by checking a condition first or returning an `Optional` or a result object. For an expected, frequent business exception you can disable the trace with the protected constructor `(message, cause, false, false)`, and you can reuse a pre-built exception, accepting that debugging is harder. In ordinary error handling the cost does not matter, and a good stack trace is worth far more than the microseconds.

### [deep] How does Spring handle exceptions in a REST API, and how would you design the error responses? {#spring-q}

Controllers do not catch business exceptions. A `@RestControllerAdvice` with `@ExceptionHandler` methods maps each exception type to a response, ideally a `ProblemDetail` (RFC 9457) with `type`, `title`, `status`, `detail` and an extension such as a correlation id. A rule violation is a 4xx (`400` for bad syntax, `422` or `409` for a business conflict), an unexpected error is a `500` with a generic message, and the stack trace is only written to the log. `ResponseStatusException` suits small cases. Add a catch-all handler so nothing escapes as an HTML error page, and add tests for each mapping. Never expose internals such as SQL, class names or stack frames.

### [deep] How does `@Transactional` treat exceptions, and what usually goes wrong? {#tx-q}

By default Spring rolls back for **unchecked** exceptions and `Error`, and **commits** when a **checked** exception is thrown, so a method that throws `IOException` after debiting an account commits the debit unless you write `rollbackFor`. Other traps: catching the exception inside the transactional method and returning normally, so Spring never sees the failure and commits partial work; an inner `@Transactional` method that throws and is caught by the outer one, which marks the whole transaction rollback-only and gives `UnexpectedRollbackException` at commit; and `@Transactional` on a method called through `this`, where the proxy is bypassed. See [Spring transactions](lesson:spring-transactions#rollback).

### [deep] Are checked exceptions a good design? {#checked-debate-q}

It is a real debate. For: the compiler forces callers to think about failures that are likely and recoverable, and signatures document them. Against: they leak implementation details through every layer, force many empty or wrapping catch blocks, make interface evolution hard, and break lambdas and streams. Newer languages and most modern Java libraries (Spring, Hibernate, JUnit) use unchecked exceptions. A pragmatic position: use unchecked exceptions by default, use a checked one only for an expected outcome that every caller should handle, wrap library exceptions at the boundary, and document what a method can throw with `@throws`.

### [deep] Which failures do you retry, and how? {#retry-q}

Retry only failures that can succeed later and operations that are **idempotent**: timeouts, connection resets, `503` or `429` responses, a deadlock victim, an optimistic-locking conflict. Do not retry validation errors, business rule violations such as insufficient funds, or `4xx` responses, because they fail the same way every time. Use a **limited** number of attempts with **exponential backoff and jitter**, an overall deadline, and a circuit breaker so a sick dependency is not hammered. For a payment, make the operation idempotent first, for example with an idempotency key, so that a retry after an unknown outcome cannot charge twice. See [retries in resilience](lesson:microservice-resilience#retries).

### [deep] How would you design error handling for a payment service from end to end? {#design-q}

Validate input early and throw specific exceptions. Keep business failures (insufficient funds, account closed) as distinct unchecked exceptions that carry data, and translate technical ones (SQL, HTTP client) into the service's own exceptions with the cause attached. Make the operation idempotent. Roll back the transaction on any failure and be sure that `rollbackFor` covers checked exceptions. Handle all errors in one `@RestControllerAdvice` that returns `ProblemDetail` with stable error codes and a correlation id, and log each failure once with the cause chain and no sensitive data. Retry only transient, idempotent calls with backoff and a circuit breaker, send poison messages to a dead-letter queue, record metrics (error rate per type) with alerts, and test the failure paths, including a failing `close()` and a timeout.

### [coding] Write an `InsufficientFundsException` and a `withdraw` method that uses it correctly. {#coding-exception}

```java
public class InsufficientFundsException extends RuntimeException {
    private final String accountId;
    private final long shortfallCents;

    public InsufficientFundsException(String accountId, long shortfallCents) {
        super("Account " + accountId + " is short by " + shortfallCents + " cents");
        this.accountId = accountId;
        this.shortfallCents = shortfallCents;
    }
    public String accountId() { return accountId; }
    public long shortfallCents() { return shortfallCents; }
}

public final class Account {
    private final String id;
    private long balanceCents;

    public Account(String id, long openingCents) {
        this.id = Objects.requireNonNull(id);
        this.balanceCents = openingCents;
    }

    public synchronized void withdraw(long cents) {
        if (cents <= 0) {
            throw new IllegalArgumentException("Amount must be positive: " + cents);    // bad input
        }
        if (cents > balanceCents) {
            throw new InsufficientFundsException(id, cents - balanceCents);              // business rule
        }
        balanceCents -= cents;
    }
}
```

Explain the two kinds of failure: `IllegalArgumentException` for a caller bug and a business exception, here unchecked, that carries the account and the shortfall so a handler can build a useful message. The checks come before any change, so a failed call leaves the balance untouched, and `synchronized` makes the check and the update one atomic step. Mention that a REST layer would map the business exception to `422` through a `@RestControllerAdvice`.

### [coding] Write a generic retry helper with a limit and exponential backoff that only retries transient failures. {#coding-retry}

```java
public final class Retry {
    private Retry() {}

    public static <T> T withBackoff(Callable<T> action, int maxAttempts, Duration firstDelay,
                                    Predicate<Exception> retryable) throws Exception {
        long delayMillis = firstDelay.toMillis();
        for (int attempt = 1; ; attempt++) {
            try {
                return action.call();
            } catch (Exception e) {
                if (attempt >= maxAttempts || !retryable.test(e)) {
                    throw e;                                          // give up, keep the original exception
                }
                try {
                    long jitter = ThreadLocalRandom.current().nextLong(delayMillis / 2 + 1);
                    Thread.sleep(delayMillis + jitter);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();               // restore the flag
                    e.addSuppressed(ie);
                    throw e;
                }
                delayMillis *= 2;                                     // exponential backoff
            }
        }
    }
}

String rate = Retry.withBackoff(
        () -> rateClient.fetch("SGD/USD"), 4, Duration.ofMillis(200),
        e -> e instanceof TimeoutException || e instanceof ConnectException);
```

Explain the design: the predicate decides which failures are transient, so a validation error is thrown at once, the last exception is rethrown unchanged after the final attempt, jitter prevents many clients retrying together, the delay doubles each time, and an interrupt stops the retrying and keeps the flag. Add that it is only safe for idempotent actions, that a real system would also have an overall deadline and a circuit breaker, and that Resilience4j or Spring Retry provide this ready-made.

### [coding] Find and fix the exception-handling problems in this method. {#coding-bugs}

```java
public long loadBalance(String accountId) {
    Connection con = null;
    try {
        con = dataSource.getConnection();
        PreparedStatement ps = con.prepareStatement("SELECT balance_cents FROM account WHERE id = ?");
        ps.setString(1, accountId);
        ResultSet rs = ps.executeQuery();
        rs.next();
        return rs.getLong(1);
    } catch (Exception e) {
        e.printStackTrace();
        return 0;
    } finally {
        try { con.close(); } catch (Exception ignored) {}
        return -1;
    }
}
```

Fixed version:

```java
public long loadBalance(String accountId) {
    String sql = "SELECT balance_cents FROM account WHERE id = ?";
    try (Connection con = dataSource.getConnection();
         PreparedStatement ps = con.prepareStatement(sql)) {
        ps.setString(1, accountId);
        try (ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                throw new AccountNotFoundException(accountId);
            }
            return rs.getLong(1);
        }
    } catch (SQLException e) {
        throw new AccountStoreException("Cannot read balance of " + accountId, e);
    }
}
```

The problems: a `return -1` in `finally` overrides the real result and hides every exception, so the method always returns -1; catching `Exception` and returning `0` makes a database outage look like an empty account, which is dangerous for money; `printStackTrace()` is not logging; the empty `catch (Exception ignored)` hides a failed `close()`; the statement and result set are never closed; `con` can be `null` in `finally` and throw a `NullPointerException`; and `rs.next()` is not checked. The fix uses try-with-resources, a specific `SQLException` catch that is translated into an unchecked exception with the cause, and a clear exception for a missing account.
