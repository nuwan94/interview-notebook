---
title: Exceptions and error handling — checked, unchecked, try-with-resources and good practice
nav: Exceptions
slug: java-exceptions
summary: How Java reports and handles failure: the Throwable hierarchy, checked and unchecked exceptions, try, catch and finally and their traps, try-with-resources and suppressed exceptions, custom exceptions and exception chaining, what to catch and what never to catch, logging, exceptions in threads, lambdas and async code, the cost of a stack trace, and how Spring turns exceptions into HTTP errors and transaction rollbacks, with banking examples and interview questions.
tags: [Java, Exceptions, Error handling, try-with-resources, Spring, Best practices]
order: 9
topic: Java / Language
updated: 2026-11-24
subnav: true
---

A bank system spends a lot of its code on what happens when something goes wrong. The account has too little money, the database is slow, a network call times out, or the input is bad.

Interviews ask about this often:

- What is the difference between checked and unchecked exceptions?
- How does `finally` behave?
- Why does try-with-resources exist?
- How do you design a custom exception?
- What should you never catch?
- How does an exception become an HTTP error or a transaction rollback in Spring?

The animation has four scenes: the exception hierarchy, what runs in `try`, `catch` and `finally`, how try-with-resources closes things, and the path of a failure through a Spring service.

```demo
name: exception-walk
```

> **One sentence to remember:** *Catch an exception only where you can deal with it, keep its cause, and close resources with try-with-resources.*

## The Throwable hierarchy {#hierarchy}

Only a `Throwable` can be thrown. A `Throwable` records four things:

- a **message**;
- an optional **cause**, which is the exception that led to this one;
- the **stack trace**, the list of method calls at the moment it was created;
- a list of **suppressed** exceptions, explained in the try-with-resources section.

`Throwable` has two direct subclasses:

- **`Error`** is a serious problem in the JVM or its environment. A program is not expected to handle it. Examples are `OutOfMemoryError`, `StackOverflowError`, `NoClassDefFoundError` and `AssertionError`. Do not catch them in normal code. See [what to do about an OutOfMemoryError](lesson:jvm-troubleshooting#oom).
- **`Exception`** is a problem that a program may want to handle. It splits again into two kinds:
  - A **checked** exception is every `Exception` that is **not** a `RuntimeException`. Examples are `IOException`, `SQLException` and `TimeoutException`. The compiler forces you to **catch** it or to **declare** it with `throws`.
  - An **unchecked** exception is a `RuntimeException` or one of its subclasses. Examples are `NullPointerException`, `IllegalArgumentException`, `IllegalStateException`, `ArithmeticException`, `IndexOutOfBoundsException`, `ClassCastException`, `ConcurrentModificationException` and `UnsupportedOperationException`. The compiler does not check them.

| | Checked | Unchecked (`RuntimeException`) | `Error` |
| --- | --- | --- | --- |
| Does the compiler force a catch or `throws`? | Yes. | No. | No. |
| What it usually means | A failure the caller could reasonably handle, such as a missing file or a network that is down. | A bug or a broken rule, such as a null, a bad argument or a wrong state. | The JVM is in trouble. |
| Should you catch it? | Yes, where you can recover or turn it into another exception. | Only at a boundary, or to turn it into another exception. | Almost never. |
| Examples | `IOException`, `SQLException` | `IllegalArgumentException`, your own `InsufficientFundsException` | `OutOfMemoryError`, `StackOverflowError` |

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

- Only the **first** `catch` that matches runs. A `catch` matches when its type is the thrown type or one of its superclasses. So put **subclasses before superclasses**. The other order does not compile, because the later block could never run.
- A **multi-catch** (Java 7) lists several types with `|`. The types must not be subclasses of each other, and the variable is automatically final.
- You cannot catch a **checked** exception that the `try` body can never throw. That is a compile error. `Exception` and `Throwable` are the exceptions to this rule.
- A `finally` block runs after the `try` and any `catch`. It runs **even after a `return`, a `break` or a thrown exception**.
- A `finally` block does **not** run if the JVM stops (`System.exit`, a crash or a power cut), if the thread is killed, or if the `try` never ends (an endless loop or a deadlock).
- **Do not `return` or `throw` from `finally`.** It replaces whatever the `try` block was doing, so an exception from the `try` simply disappears. This is the classic trap shown in the second scene.

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

A **resource** is anything that holds something outside your program, such as a file, a socket or a JDBC `Connection`. It must be closed, even when something fails.

Before [Java 7](lesson:java-version-history#java-7), that meant a clumsy `finally` with a second `try` inside it. Now, a resource that implements `AutoCloseable` can be declared in the `try` header. Java then closes it **automatically, in the reverse order of opening**:

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

- **No leaks and no boilerplate.** Every resource that was opened is closed, in the right order, on every path.
- **The real error is not hidden.** Suppose the body throws, and then `close()` throws too. The body's exception stays the **primary** one. The failure from `close()` is attached to it as a **suppressed** exception, and you read it with `getSuppressed()`. With a hand-written `finally`, the second exception would replace the first, and the real cause would be lost.
- Since [Java 9](lesson:java-version-history#java-9), you can use an existing variable directly if it is effectively final (never reassigned): `try (con) { ... }`.

## Throwing, wrapping and custom exceptions {#custom}

Throw an exception when a method cannot do what its name promises. For example, `withdraw` throws when the balance is too low, instead of returning a special value.

- `throw` raises an exception.
- `throws` in a method signature declares which **checked** exceptions the method may raise.

Sometimes you catch a low-level exception and raise a higher-level one instead. Always pass the original as the **cause**. This is called **exception chaining**. The stack trace then shows `Caused by:` followed by the whole story.

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

- **Prefer a standard exception** when one fits. Use `IllegalArgumentException` for a bad argument and `IllegalStateException` for a call at the wrong moment. `NoSuchElementException`, `UnsupportedOperationException` and `ArithmeticException` are also common. Create your own exception when the caller needs to tell this failure apart from others, or needs to read data from it.
- **Name it for what went wrong**, such as `InsufficientFundsException`, not for where it happened, such as `ServiceException`. A small hierarchy with a base type, such as `PaymentException`, lets callers catch a whole family.
- **Offer the standard constructors**, especially `(String message, Throwable cause)`.
- **Put useful, safe data in it**, such as the account id, the amount or an error code. Do not put secrets, full card numbers or personal data in the message. Messages end up in logs and sometimes in responses.
- **Translate exceptions between layers.** Each layer should throw exceptions that belong to its own level. A repository does not pass `SQLException` up to the service. It throws its own exception, or Spring's `DataAccessException`, with the original as the cause.

## Checked or unchecked? {#checked}

The traditional advice is:

- use a **checked** exception for a problem the caller can be expected to handle;
- use an **unchecked** exception for a programming error.

In practice, most modern code, including Spring, uses **unchecked** exceptions almost everywhere. There are three reasons:

1. Checked exceptions **spread** into the signature of every layer, or they are wrapped and rethrown many times.
2. They do not work with **lambdas and streams**, because the standard functional interfaces declare no checked exceptions (see [lambdas](lesson:java-functional#checked-exceptions) and [streams](lesson:java-streams#checked)).
3. Callers often cannot do anything useful with them, so they end up with an empty `catch`.

A reasonable rule: use a checked exception only when you are sure that **every** caller can and should react to it, and document it. Otherwise use an unchecked exception. When a library throws a checked exception, convert it into an unchecked one at the boundary.

When you **override** a method, the new method may throw the **same** checked exceptions, **narrower** ones (subclasses), or **none**. It may never throw broader or new ones, because callers written against the parent type know only the parent's exceptions. Unchecked exceptions have no such limit.

## Handling it well {#rules}

| Do | Do not |
| --- | --- |
| Catch the **most specific** type you can handle. | Catch `Exception` or `Throwable` in the middle of the code. |
| **Fail fast.** Check the arguments at the start, and throw `IllegalArgumentException`, `NullPointerException` (with `Objects.requireNonNull`) or `IllegalStateException`. | Let a bad value travel deep into the code before it fails. |
| Add **context**, such as ids, amounts and the step, and keep the **cause**. | Write `throw new RuntimeException("failed")`, which drops the original exception. |
| **Log once**, at the place where you finally handle it. Pass the exception as the last argument: `log.error("Transfer {} failed", id, e)`. | Log and rethrow at every layer, so the same failure appears ten times. Do not call `e.printStackTrace()`. |
| Handle the failure, or **let it propagate** to the caller. | Write an **empty catch** block. It hides bugs and money problems. |
| Clean up with **try-with-resources**. | Close resources by hand in a plain `finally`, or forget to close them. |
| After catching `InterruptedException`, restore the interrupt flag with `Thread.currentThread().interrupt()` (see [interrupts](lesson:java-concurrency#interrupt)). | Swallow `InterruptedException`, so the thread can no longer be stopped. |
| Return an empty list or an `Optional` for "nothing found" when that is a normal result. | Use exceptions for **normal control flow**, for example to end a loop. |
| Catch `Throwable` only at the **very top** of a thread, to log it and shut down cleanly. | Catch `OutOfMemoryError` and carry on as if nothing happened. |

Errors are not the same as exceptions. After an `OutOfMemoryError`, the program's data may be in a broken state. And catching a `StackOverflowError` to "try something else" only hides a recursion bug.

## Threads, lambdas and async code {#threads}

- **A plain thread:** an exception that escapes `run()` ends **that thread only**. By default, the stack trace is printed. Set a handler with `Thread.setDefaultUncaughtExceptionHandler` to log it properly.
- **An `ExecutorService` with `execute()`:** the exception reaches the thread's uncaught-exception handler. The worker thread dies, and the pool replaces it.
- **An `ExecutorService` with `submit()`:** the exception is **stored in the `Future`**. It appears only when you call `get()`, wrapped in an `ExecutionException`. If nobody ever reads the future, the failure is **silently lost**.
- **`CompletableFuture`:** handle the failure inside the chain with `exceptionally`, `handle` or `whenComplete`. When stages are chained, the original exception arrives wrapped. It is a `CompletionException` from `join()` or an `ExecutionException` from `get()`, so look at `getCause()`.
- **A lambda:** you cannot throw a checked exception from the standard functional interfaces. Catch it inside the lambda and wrap it in an unchecked one, or write a small adapter that does this for you.

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

Throwing and catching are cheap compared with the work usually done around them. The expensive part is **filling in the stack trace**. This happens when the exception object is **created** (`fillInStackTrace`). It walks the whole call stack, so a deep stack costs more.

This matters in two cases:

- **Exceptions used for control flow** in a busy loop are slow. Check a condition instead (`if (map.containsKey(k))`), or return an `Optional`.
- **A "business" exception that is thrown often and never inspected** can skip the trace. Use the protected constructor `super(message, cause, false, false)`. The two `false` values turn off suppressed exceptions and the stack trace. Do this only for exceptions that are expected and frequent, because without a trace they are hard to debug.

Since [Java 14](lesson:java-version-history#java-14), a `NullPointerException` message says exactly what was null, for example *"Cannot invoke \"Account.balance()\" because \"account\" is null"*. That makes many bugs easy to find from the log.

How to read a stack trace: start at the **top**, which shows the exception and the line where it was created. Then look for **`Caused by:`**. The last `Caused by:`, at the bottom, is the root cause.

## In Spring and REST APIs {#spring}

- **Handle errors in one place.** Do not catch exceptions in every controller. Write a `@RestControllerAdvice` class with `@ExceptionHandler` methods. Each method maps an exception type to an HTTP status and a body, ideally a [`ProblemDetail`](lesson:spring-mvc#errors) (the RFC 9457 error format).
  - A broken business rule is a **4xx** (`422` or `409`).
  - A bug or an outage is a **500**, with a generic message and a correlation id.
  - The stack trace goes only to the log. Never return a stack trace to a client.
- **Spring translates database exceptions.** It converts vendor exceptions such as `SQLException` into its own unchecked `DataAccessException` hierarchy, for example `DuplicateKeyException`, `DataIntegrityViolationException` and `OptimisticLockingFailureException`. So the service does not depend on the database.
- **Transactions.** By default, `@Transactional` rolls back for **unchecked exceptions and errors**. It **commits** after a **checked** exception, unless you add `rollbackFor`. There is a second trap: if an inner `@Transactional` method throws, and the outer one **catches** the exception and carries on, the transaction is marked **rollback-only**. The outer commit then fails with `UnexpectedRollbackException`. See [rollback rules](lesson:spring-transactions#rollback).
- **Retry only what can succeed later.** A timeout or a `503` is temporary, so a retry with a growing delay (backoff) is worth it. An `InsufficientFundsException` or a validation error will fail every time. Retry only [idempotent operations](lesson:microservice-resilience#retries) (ones that are safe to repeat), and set a limit.
- **Do not leak internals.** The message to the client says what the client can do. The log holds the technical detail.

Try it in the lab: [try-with-resources and the exception that wins](lab:exceptions-try-with-resources).

## Cheat sheet {#cheatsheet}

| Need | Code or rule |
| --- | --- |
| Checked, unchecked or error | `Exception` (but not `RuntimeException`) is checked. `RuntimeException` is unchecked. `Error` is for the JVM. |
| Handle several types | `catch (A \| B e)`, with subclasses before superclasses |
| Always clean up | `try (var in = ...) { ... }`, closed in reverse order |
| Never put in `finally` | `return` or `throw` |
| Keep the cause | `throw new XException("context", e)` |
| Bad argument or state | `IllegalArgumentException`, `IllegalStateException`, `Objects.requireNonNull` |
| Second failure during close | `e.getSuppressed()` |
| Interrupted | `Thread.currentThread().interrupt()`, or rethrow |
| Checked exception in a lambda | Wrap it in an unchecked one, such as `UncheckedIOException`. |
| Failure in `submit()` | Read it from `Future.get()`, as an `ExecutionException`. |
| Cheap exception | `super(msg, cause, false, false)` with no trace, or do not use an exception |
| REST error | `@RestControllerAdvice` returning `ProblemDetail`, with no stack trace |
| Roll back for a checked exception | `@Transactional(rollbackFor = Exception.class)` |
| Log it | Once, where it is handled: `log.error("msg {}", id, e)` |

## Interview questions {#questions}

### [basic] What is the difference between checked and unchecked exceptions? {#checked-q}

**The compiler forces you to handle a checked exception, but not an unchecked one.**

- A **checked** exception is a subclass of `Exception` that is not a `RuntimeException`, such as `IOException` or `SQLException`. The caller must catch it or declare it in `throws`.
- An **unchecked** exception is a `RuntimeException` (or an `Error`). The compiler does not check it.
- Checked exceptions are meant for problems the caller can reasonably recover from. Unchecked ones usually mean a programming error, such as a null or a bad argument.

In practice, most modern code, Spring included, prefers unchecked exceptions. Checked ones spread into every method signature and do not work well with lambdas.

### [basic] What is the difference between `Exception` and `Error`? {#error-q}

**An `Exception` is a problem the application may handle. An `Error` is a JVM problem it normally cannot recover from.**

- Both extend `Throwable`.
- An `Error` is a serious problem in the JVM or its environment, such as `OutOfMemoryError`, `StackOverflowError` or `NoClassDefFoundError`.
- So normal code does not catch an `Error`.

Catching an `Error` makes sense only at the top of a thread, to log it and shut down in an orderly way.

### [basic] How do `try`, `catch` and `finally` work, and when does `finally` not run? {#finally-q}

**The `try` body runs, the first matching `catch` runs if something is thrown, and `finally` runs at the end in almost every case.**

1. The `try` body runs.
2. If it throws, the first `catch` whose type matches runs.
3. The `finally` block runs afterwards in every case: after normal completion, a caught exception, an uncaught exception, and even after a `return`.

`finally` does **not** run when the JVM stops (`System.exit`, a crash or a power cut), when the thread is killed, or when the `try` body never finishes (an endless loop or a deadlock).

Use `finally` for clean-up, and do not `return` or `throw` from it.

### [basic] What is try-with-resources and why is it better than `finally`? {#twr-q}

**It is a `try` that closes its resources for you, in reverse order, without hiding the real error.**

You declare resources that implement `AutoCloseable` in the header: `try (var in = Files.newInputStream(p)) { ... }`. They are closed automatically in **reverse order**, whether the body finishes normally or with an exception.

It is better than closing in `finally` for two reasons:

1. It is shorter, and nothing is forgotten.
2. If the body and `close()` both throw, the body's exception stays the primary one. The one from `close()` is attached as a **suppressed** exception instead of replacing it.

### [basic] What is the difference between `throw` and `throws`? {#throw-throws-q}

**`throw` raises an exception. `throws` declares that a method may raise one.**

- `throw` is a statement that raises one exception object: `throw new IllegalStateException("closed")`.
- `throws` is part of a method signature. It lists the checked exceptions that the method may let escape, so callers know they must handle them.

Unchecked exceptions need no `throws`, but you may add them for documentation.

### [intermediate] What happens if both the `try` block and the `finally` block throw or return? {#finally-return-q}

**The `finally` block wins, and whatever the `try` block did is lost.**

- If `try` throws exception A and `finally` throws exception B, the caller receives **B**. A is lost, so a hand-written `finally` can hide the original cause.
- If `finally` contains a `return`, it overrides both the `try` block's return value and any exception it threw. The exception disappears silently.

So never `return` or `throw` from `finally`. Use try-with-resources for resources: there, a failure in `close()` is suppressed and cannot replace the primary exception.

### [intermediate] What is a suppressed exception? {#suppressed-q}

**A second exception that happened during clean-up, attached to the first one so it is not lost.**

- In try-with-resources, an exception may already be on its way out when `close()` throws another one.
- The second one is added to the first through `addSuppressed`. You can read it with `getSuppressed()`.
- The primary exception, the real problem, is the one that is thrown.

This keeps the root cause visible, and it still records that closing failed too. You can also add suppressed exceptions yourself when you close several things by hand and want to report every failure.

### [intermediate] How do you design a custom exception, and should it be checked? {#custom-q}

**Usually extend `RuntimeException`. Make it checked only when every caller must and can handle it.**

How to design it:

1. Name it for the problem, such as `InsufficientFundsException`.
2. Provide the `(message, cause)` constructor.
3. Carry the data a handler needs, such as the account id and the shortfall, as fields. Keep secrets out of the message.
4. Consider a small hierarchy with a common base type, so a boundary can catch a whole family.

Prefer a standard exception, such as `IllegalArgumentException` or `IllegalStateException`, when it describes the problem well. Make it checked only when it is a normal, recoverable outcome that the caller must be forced to consider.

### [intermediate] What is exception chaining and why keep the cause? {#chaining-q}

**Chaining means passing the original exception as the cause of the new one. You keep it so the root cause is not lost.**

When you catch a low-level exception and throw a higher-level one, pass the original: `throw new AccountStoreException("Cannot load " + id, e)`.

- The stack trace then shows `Caused by:` with the full chain, down to the root cause, such as a timeout or a broken database constraint.
- If you drop the cause, the information you need to diagnose the incident is gone.

Also keep the layers clean. Translate low-level exceptions into the language of the layer: a repository does not pass `SQLException` up to a service.

### [intermediate] What are the rules for overriding a method that throws exceptions? {#override-q}

**The overriding method may throw the same checked exceptions, narrower ones or none, but never new or broader ones.**

- The reason: code written against the parent type only knows the parent's declaration.
- The overriding method may throw any unchecked exception.
- A constructor must declare at least the checked exceptions of the superclass constructor it calls.

For example, if an interface method declares no exceptions, a class cannot implement it with a method that throws `IOException`.

### [intermediate] How do multiple catch blocks and multi-catch work? {#multi-catch-q}

**Catch blocks are tried in order and the first match runs. Multi-catch handles several unrelated types in one block.**

- Specific types must come **before** their superclasses. Otherwise the code does not compile, because the later block could never run.
- A **multi-catch**, `catch (IOException | SQLException e)`, handles unrelated types in one block. The types must not be subclasses of each other, and `e` is automatically final.
- Since Java 7 you can also catch `Exception`, rethrow the variable, and the compiler works out the exact types that can come out. This is called **precise rethrow**. It works as long as you do not assign a new value to the variable.

### [intermediate] Should you catch `Exception` or `Throwable`? {#catch-all-q}

**Not in ordinary code. Only at a boundary.**

- Catching `Exception` also catches bugs and problems you cannot handle. Catching `Throwable` also catches errors such as `OutOfMemoryError`. Both hide what went wrong.
- Catch the specific types you can handle instead.
- Catching `Exception` is fine at a **boundary**: a request handler, a message listener or a thread's main loop. There you log it, turn it into an error response and keep the system running.
- Catching `Throwable` belongs at the top of a thread, only to log and shut down.

### [intermediate] How should exceptions be logged? {#logging-q}

**Once, where the exception is finally handled, with the exception as the last argument.**

- Do not log at every layer that rethrows it. Otherwise one failure fills the log with copies.
- Pass the exception as the last argument, so the stack trace and the cause chain are printed: `log.error("Transfer {} failed", id, e)`.
- Include identifiers, and never use `printStackTrace()`.
- Do not log secrets or personal data, such as card numbers, tokens or full account numbers.
- In a service, add a correlation id. It lets you follow a failure across services and match it with the error the client received.

### [intermediate] How do you deal with checked exceptions inside lambdas and streams? {#lambda-q}

**Catch it inside the lambda and rethrow it wrapped in an unchecked exception.**

The standard functional interfaces (`Function`, `Supplier`, `Consumer`) do not declare checked exceptions, so a lambda cannot throw one. You have three options:

1. Catch the checked exception inside the lambda and rethrow it wrapped in an unchecked one, such as `UncheckedIOException` for `IOException`.
2. Write a small `ThrowingFunction` interface with an adapter that wraps and unwraps.
3. Skip the lambda and use a plain loop, when error handling is the main point.

Do not hide the failure by returning `null` from the lambda.

### [intermediate] What happens to an exception thrown in another thread? {#thread-q}

**The code that started the thread cannot catch it. It goes to the thread's handler, or it is stored in a `Future`.**

- Each thread has its own stack, so the starting code never sees the exception.
- An exception that escapes `run()` ends that thread and goes to its `UncaughtExceptionHandler`. The default handler prints the trace.
- In an executor, `execute()` works the same way, and the worker thread is replaced.
- `submit()` stores the exception in the `Future`. It appears only when you call `get()`, as an `ExecutionException`. So if nobody reads the result, the failure stays hidden.
- With `CompletableFuture`, use `exceptionally`, `handle` or `whenComplete`.

Always make sure a background failure is logged and counted.

### [intermediate] Why must you not swallow `InterruptedException`? {#interrupt-q}

**Because then nobody learns that the thread was asked to stop, and shutdown or cancellation hangs.**

- An interrupt is the standard way to ask a thread to stop.
- When a blocking call throws `InterruptedException`, the thread's interrupt flag has already been cleared.
- If you catch it and carry on, the request to stop is lost.

So do one of two things: let it propagate (declare `throws InterruptedException`), or restore the flag with `Thread.currentThread().interrupt()` and return quickly. Never leave the catch empty.

### [deep] Why are exceptions considered slow, and how can the cost be reduced? {#cost-q}

**Creating the stack trace is the slow part. Throwing and catching are cheap.**

- The constructor calls `fillInStackTrace`, which walks the call stack and records every frame. A deeper stack costs more.
- So exceptions are expensive when they are used for **control flow** in busy code, because every normal "miss" builds a trace.

How to reduce the cost:

1. Check a condition first, or return an `Optional` or a result object.
2. For an expected, frequent business exception, turn off the trace with the protected constructor `(message, cause, false, false)`.
3. Reuse a pre-built exception object.

The last two make debugging harder. In ordinary error handling the cost does not matter, and a good stack trace is worth far more than a few microseconds.

### [deep] How does Spring handle exceptions in a REST API, and how would you design the error responses? {#spring-q}

**One `@RestControllerAdvice` maps each exception type to an HTTP status and a `ProblemDetail` body. Controllers do not catch business exceptions.**

1. A `@RestControllerAdvice` with `@ExceptionHandler` methods maps each exception type to a response.
2. The body is ideally a `ProblemDetail` (RFC 9457). It has `type`, `title`, `status` and `detail` fields, plus extra fields such as a correlation id.
3. A broken rule is a 4xx: `400` for bad syntax, and `422` or `409` for a business conflict.
4. An unexpected error is a `500` with a generic message. The stack trace is written only to the log.
5. `ResponseStatusException` suits small cases.
6. Add a catch-all handler, so nothing escapes as an HTML error page, and test each mapping.

Never expose internals such as SQL, class names or stack frames.

### [deep] How does `@Transactional` treat exceptions, and what usually goes wrong? {#tx-q}

**It rolls back for unchecked exceptions and errors, and it commits for checked exceptions unless you add `rollbackFor`.**

So a method that throws `IOException` after debiting an account **commits** the debit, unless you write `rollbackFor`.

Other common traps:

- **Catching the exception inside the transactional method** and returning normally. Spring never sees the failure, so it commits half-done work.
- **An inner `@Transactional` method throws, and the outer one catches it.** The whole transaction is marked rollback-only, and the commit fails with `UnexpectedRollbackException`.
- **Calling a `@Transactional` method through `this`.** The call skips Spring's proxy, so no transaction starts.

See [Spring transactions](lesson:spring-transactions#rollback).

### [deep] Are checked exceptions a good design? {#checked-debate-q}

**It is a real debate. A practical answer is to use unchecked exceptions by default.**

Arguments for checked exceptions:

- The compiler forces callers to think about failures that are likely and recoverable.
- Signatures document those failures.

Arguments against:

- They leak implementation details through every layer.
- They force many empty or wrapping catch blocks.
- They make it hard to change an interface later.
- They break lambdas and streams.

Newer languages and most modern Java libraries (Spring, Hibernate, JUnit) use unchecked exceptions. A practical position: use unchecked exceptions by default. Use a checked one only for an expected outcome that every caller should handle. Wrap library exceptions at the boundary, and document what a method can throw with `@throws`.

### [deep] Which failures do you retry, and how? {#retry-q}

**Retry only failures that can succeed later, and only operations that are idempotent (safe to repeat).**

Worth retrying:

- timeouts and connection resets;
- `503` or `429` responses;
- a transaction picked as the victim of a deadlock;
- an optimistic-locking conflict.

Not worth retrying, because they fail the same way every time:

- validation errors;
- broken business rules, such as insufficient funds;
- other `4xx` responses.

How to retry:

1. Use a **limited** number of attempts.
2. Wait longer each time (**exponential backoff**) and add a random amount (**jitter**).
3. Set an overall deadline.
4. Add a circuit breaker, so a failing dependency is not hammered.

For a payment, make the operation idempotent first, for example with an idempotency key. Then a retry after an unknown outcome cannot charge twice. See [retries in resilience](lesson:microservice-resilience#retries).

### [deep] How would you design error handling for a payment service from end to end? {#design-q}

**Clear exception types, one place that turns them into responses, safe transactions, careful retries and good monitoring.**

1. **Validate input early** and throw specific exceptions.
2. **Keep business failures**, such as insufficient funds or a closed account, as separate unchecked exceptions that carry data.
3. **Translate technical exceptions** (SQL, HTTP client) into the service's own exceptions, with the cause attached.
4. **Make the operation idempotent.**
5. **Roll back the transaction on any failure**, and make sure `rollbackFor` covers checked exceptions.
6. **Handle all errors in one `@RestControllerAdvice`** that returns `ProblemDetail` with stable error codes and a correlation id.
7. **Log each failure once**, with the cause chain and no sensitive data.
8. **Retry only temporary, idempotent calls**, with backoff and a circuit breaker.
9. **Send poison messages**, ones that fail every time, to a dead-letter queue.
10. **Record metrics**, such as the error rate per type, and set alerts.
11. **Test the failure paths**, including a failing `close()` and a timeout.

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

How to explain it:

- There are two kinds of failure. `IllegalArgumentException` is for a bug in the caller. `InsufficientFundsException` is a business exception, here unchecked. It carries the account and the shortfall, so a handler can build a useful message.
- The checks come before any change, so a failed call leaves the balance untouched.
- `synchronized` makes the check and the update one atomic step.
- A REST layer would map the business exception to `422` through a `@RestControllerAdvice`.

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

How to explain the design:

- The `retryable` predicate decides which failures are temporary. A validation error is thrown at once.
- After the last attempt, the last exception is rethrown unchanged.
- The delay doubles each time.
- Jitter adds a random wait, so many clients do not all retry at the same moment.
- An interrupt stops the retrying and keeps the interrupt flag.

Also say that it is only safe for idempotent actions. A real system would also have an overall deadline and a circuit breaker. Resilience4j and Spring Retry provide this ready-made.

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

The problems in the original:

1. The `return -1` in `finally` overrides the real result and hides every exception, so the method always returns -1.
2. Catching `Exception` and returning `0` makes a database outage look like an empty account. That is dangerous with money.
3. `printStackTrace()` is not logging.
4. The empty `catch (Exception ignored)` hides a failed `close()`.
5. The statement and the result set are never closed.
6. `con` can be `null` in `finally`, which throws a `NullPointerException`.
7. The result of `rs.next()` is not checked.

The fix uses try-with-resources. It catches only `SQLException` and translates it into an unchecked exception with the cause. A missing account gets its own clear exception.
