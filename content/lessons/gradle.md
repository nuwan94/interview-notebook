---
title: Gradle — tasks, incremental builds and dependency configurations
nav: Gradle
slug: gradle
summary: How Gradle builds a Java project: the Kotlin DSL build files, the three build phases, the task graph, inputs and outputs with up-to-date checks, the daemon, build cache and configuration cache, dependency configurations (api, implementation, runtimeOnly), version catalogs, multi-project builds, the Spring Boot plugin and troubleshooting, with examples and interview questions.
tags: [Java, Gradle, Build tools, Dependencies, Spring Boot]
order: 22
topic: Java / Build tools
updated: 2026-11-24
subnav: true
---

**Gradle** builds the same kind of projects as [Maven](lesson:maven), but in a different way.

- Maven has a fixed list of phases. Gradle has a **graph of tasks**. A task is one piece of work, such as "compile the code" or "run the tests".
- Gradle runs only the tasks you need, and skips a task when its inputs have not changed.
- The build file is code, written in Kotlin or Groovy. That makes it more flexible and more powerful, but a little harder to read.

Interviews ask:

- What are the three build phases?
- What makes Gradle fast?
- What is the difference between `api` and `implementation`?
- How is a build with several projects organised?
- How does Gradle compare with Maven?

The animation has three scenes: the build phases, how Gradle skips unchanged work, and the dependency configurations.

```demo
name: gradle-walk
```

> **One sentence to remember:** *Gradle runs a graph of tasks and skips every task whose inputs have not changed.*

## Build files {#files}

A Gradle project has two kinds of build file:

- `settings.gradle.kts` says which projects exist.
- Each project has a `build.gradle.kts` that says what that project does.

```kotlin
// settings.gradle.kts
rootProject.name = "payments"
include("payments-api", "payments-service", "payments-app")
```

```kotlin
// build.gradle.kts of a Spring Boot service
plugins {
    java
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.5"
}

group = "com.bank"
version = "1.4.0"

java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }   // Gradle finds or downloads this JDK
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.test {
    useJUnitPlatform()
}
```

- **Plugins** add tasks and conventions.
  - The `java` plugin adds the tasks `compileJava`, `test`, `jar` and `build`. It also sets the standard folders (`src/main/java`, `src/test/java`), the same as Maven.
  - The `application` plugin adds `run`.
  - The `java-library` plugin adds the `api` configuration.
- **There are two languages for build files.** The **Kotlin DSL** (`.kts`) is type-safe and gets good completion in the IDE. The **Groovy DSL** (`.gradle`) is older and shorter. New projects usually pick Kotlin.
- **Dependencies** use the same coordinates as Maven, `group:artifact:version`, and the same repositories, such as Maven Central and Nexus.
- **The wrapper** is the `./gradlew` script. It downloads the Gradle version named in `gradle/wrapper/gradle-wrapper.properties`, so everyone and CI use the same version. Always use the wrapper and commit it.

## The three build phases {#phases}

Every Gradle build runs three phases, in this order:

1. **Initialization.** Gradle reads `settings.gradle.kts` and decides which projects take part.
2. **Configuration.** Gradle runs the build script of every project. It does not run the tasks yet. The scripts register tasks and set their properties. From the `dependsOn` links between tasks, Gradle builds the **task graph**. The graph is a DAG (directed acyclic graph): arrows have a direction and never form a loop.
3. **Execution.** Gradle runs the tasks you asked for and the tasks they depend on, in dependency order.

So `gradle test` runs `compileJava`, `processResources`, `classes`, `compileTestJava`, `processTestResources`, `testClasses` and `test`. It does not run `jar`.

The most common beginner mistake is to do real work in the **configuration** phase. That phase runs on every build, even `gradle tasks`:

```kotlin
// bad: runs at configuration time, on every build
val version = file("version.txt").readText()

// better: a task does it at execution time, only when it is needed
tasks.register("printVersion") {
    doLast { println(file("version.txt").readText()) }
}
```

Two more habits keep configuration cheap:

- Use `tasks.register` instead of `tasks.create`. `register` is **lazy**: Gradle creates the task only if it is needed. `create` is **eager**: it creates the task every time.
- Use **providers** (`layout.buildDirectory`, `providers.gradleProperty`). A provider reads its value only when it is needed.

Try it in the lab: [Initialization, configuration, execution](lab:gradle-build-phases).

## Tasks, inputs and outputs {#tasks}

A **task** has a name, actions, and optional dependencies on other tasks. Most importantly, it declares its **inputs** and **outputs**:

```kotlin
abstract class GenerateReport : DefaultTask() {
    @get:InputFile abstract val template: RegularFileProperty
    @get:Input abstract val customer: Property<String>
    @get:OutputFile abstract val report: RegularFileProperty

    @TaskAction
    fun run() {
        report.get().asFile.writeText(template.get().asFile.readText().replace("{{customer}}", customer.get()))
    }
}

tasks.register<GenerateReport>("report") {
    template = file("report.tpl")
    customer = "Acme Bank"
    report = layout.buildDirectory.file("report.txt")
}
```

- **Task links** come in three kinds.
  - `dependsOn` means "the other task must run before this one".
  - `mustRunAfter` only sets the order, and only if both tasks run anyway.
  - `finalizedBy` runs another task afterwards, for example a cleanup.
- **Lifecycle tasks** such as `build`, `assemble` and `check` have no action of their own. They only group other tasks. `build` runs `assemble` (which makes the jar) and `check` (which runs the tests and other checks).
- **The up-to-date check** happens before a task runs. Gradle takes a **fingerprint** (a hash) of the inputs and outputs. If they match the previous run, the task is `UP-TO-DATE` and does nothing. A task with no declared outputs always runs. A task with wrong declarations causes stale or slow builds.
- **Incremental compilation** means `compileJava` recompiles only the classes affected by a change.

The console shows one outcome for each task:

- No label means the task ran (`EXECUTED`).
- `UP-TO-DATE` means nothing changed, so it was skipped.
- `FROM-CACHE` means its outputs were copied from the build cache.
- `SKIPPED` means it was disabled, or its `onlyIf` condition was false.
- `NO-SOURCE` means it had no input files.

Try it in the lab: [Why the second Gradle build is faster](lab:gradle-up-to-date).

## Why Gradle is fast {#speed}

| Feature | What it does |
| --- | --- |
| **Daemon** | A background JVM stays running between builds. There is no JVM start-up time, and the build logic stays compiled. |
| **Incremental build** | A task is skipped when its inputs and outputs have not changed. |
| **Build cache** | Task outputs are stored under a hash of the inputs, on your machine or on a shared server. They are reused across branches, machines and CI. Turn it on with `--build-cache` or `org.gradle.caching=true`. |
| **Configuration cache** | Gradle saves the task graph, so a repeated build skips the configuration phase. Turn it on with `org.gradle.configuration-cache=true`. |
| **Parallel execution** | Independent projects and tasks run at the same time. Turn it on with `org.gradle.parallel=true`. |
| **Dependency resolution cache** | Downloaded artifacts and their metadata are kept in `~/.gradle`, with checksums. |

A cache hit is only correct if two things are true:

- The task is **deterministic**: the same inputs always give the same outputs.
- The task declares **all** of its inputs, including environment values.

A task that reads an undeclared file, or the current time, poisons the cache. `--scan` creates a **build scan**, a report that shows exactly where the time went.

## Dependency configurations {#configurations}

A **configuration** is a named group of dependencies with one purpose. It decides on which **classpath** (the list of jars Java can see) a library appears. These are the main ones for the `java` and `java-library` plugins:

| Configuration | Compile classpath | Runtime classpath | Visible to consumers | Use it for |
| --- | --- | --- | --- | --- |
| `implementation` | Yes. | Yes. | Not at compile time. | Normal dependencies used inside the module. |
| `api` (java-library) | Yes. | Yes. | Yes, at compile time. | Types that appear in your public methods and classes. |
| `compileOnly` | Yes. | No. | No. | Annotations, Lombok, and APIs the platform supplies. |
| `runtimeOnly` | No. | Yes. | Not at compile time, but yes at run time. | JDBC drivers and logging backends. |
| `testImplementation` | Tests only. | Tests only. | No. | JUnit, Mockito and Testcontainers. |
| `annotationProcessor` | Only on the processor path. | No. | No. | Lombok and MapStruct processors. |

A **consumer** is another module that depends on yours.

- **Use `implementation` by default, and `api` only when needed.** If a library's type appears in your public API (for example, in a method signature), it must be `api`, or consumers fail to compile. The benefit of `implementation` is a smaller compile classpath and **less recompilation**: when an internal library changes, the modules that use yours do not recompile.
- **Gradle picks the highest version.** When two paths ask for different versions, Gradle chooses the **highest** one requested. Maven does not. To control it, use `constraints { }`, a platform (BOM) or `strictly`.
- **A BOM works like Maven's `import` scope.** `implementation(platform("org.springframework.boot:spring-boot-dependencies:3.3.0"))` imports the managed versions.
- **Avoid versions that move.** Dynamic versions (`1.+`, `latest.release`) and `-SNAPSHOT` or `changing` modules make builds impossible to repeat. Use fixed versions. Use **dependency locking** if you need to pin the whole tree.

Try it in the lab: [api versus implementation](lab:gradle-api-vs-implementation).

### Version catalogs {#catalog}

A **version catalog** is the file `gradle/libs.versions.toml`. It lists versions and libraries once:

```toml
[versions]
jackson = "2.17.1"
testcontainers = "1.19.8"

[libraries]
jackson-databind = { module = "com.fasterxml.jackson.core:jackson-databind", version.ref = "jackson" }
testcontainers-postgres = { module = "org.testcontainers:postgresql", version.ref = "testcontainers" }

[plugins]
spring-boot = { id = "org.springframework.boot", version = "3.3.0" }
```

```kotlin
dependencies {
    implementation(libs.jackson.databind)
    testImplementation(libs.testcontainers.postgres)
}
```

One edit upgrades every project, and the IDE can complete the names.

## Multi-project builds {#multi}

A build can contain several projects:

```kotlin
// settings.gradle.kts
include("payments-api", "payments-service", "payments-app")
```

```kotlin
// payments-app/build.gradle.kts
dependencies {
    implementation(project(":payments-service"))
}
```

- **`project(":name")` is a dependency on another project.** Gradle works out the build order from these links. It builds only what is needed: `:payments-app:build` also builds the projects it depends on. It runs independent projects in parallel.
- **Share configuration without copying it.** Put the shared settings in **convention plugins**, under `buildSrc` or in an included build called `build-logic`. Each project applies them with `plugins { id("bank.java-conventions") }`. This is the modern replacement for `allprojects { }` and `subprojects { }` blocks, which hide where settings come from.
- **A composite build** uses `includeBuild("../shared-lib")`. It replaces a published dependency with a local checkout. This is handy when you work on a library and the app that uses it at the same time.
- **Useful options:**
  - `./gradlew :payments-service:test` runs one project's tests.
  - `--continue` keeps going after a failure.
  - `--parallel` runs projects in parallel.
  - `-x test` excludes a task.
  - `--tests "*PaymentServiceTest"` picks tests by name.
  - `--offline` uses only cached dependencies.
  - `--refresh-dependencies` downloads dependency information again.

## Gradle with Spring Boot {#spring}

- **The `org.springframework.boot` plugin** adds several tasks.
  - `bootRun` starts the app.
  - `bootJar` builds an executable jar with the dependencies inside, like Maven's repackage.
  - `bootBuildImage` builds a container image with buildpacks.
  - It also renames the plain `jar` task's output to a `-plain` jar.
- **The `io.spring.dependency-management` plugin** applies Boot's managed versions, so Boot dependencies need no version. You can import the BOM with `platform(...)` instead.
- **Layered jars** and `bootBuildImage` give efficient container images, the same as with Maven.
- **Testing** needs `useJUnitPlatform()`. Put slow integration tests in a separate `integrationTest` task, or use the JVM test suites plugin, so `test` stays fast.
- **Toolchains** (`java.toolchain`) let the build use a chosen JDK, whatever JDK runs Gradle itself.

## Maven and Gradle {#vs-maven}

| | Gradle | Maven |
| --- | --- | --- |
| Model | A task graph that you can program. | A fixed, declarative lifecycle. |
| Build file | Kotlin or Groovy code. | XML. |
| Incremental builds and caching | Strong: up-to-date checks, a build cache and a configuration cache. | Limited. |
| Dependency conflicts | The highest version wins. | The nearest definition wins. |
| Customisation | You write tasks and plugins in the build. | You write a plugin in Java. |
| Predictability | It depends on how the build is written. | Very uniform. |
| Strong at | Large multi-project builds and Android. | Standard enterprise Java builds. |

See [Maven](lesson:maven) for the other side. A good answer always names the trade-off: flexibility and speed, against uniformity and simplicity.

## Troubleshooting {#troubleshooting}

| Symptom | Likely cause and fix |
| --- | --- |
| A task runs every time | Its inputs and outputs are missing or wrong, or it reads something undeclared. Run with `--info` and look for "Task ... is not up-to-date because". |
| The output is stale after a change | The outputs are not declared, or a task writes to a shared location. Prove it with `--rerun` or `clean`, then fix the declaration. |
| `Could not resolve` | A repository is missing from `repositories { }`, the coordinates are wrong, or there is a proxy problem. Try `--refresh-dependencies`. |
| A consumer module fails to compile | A library used in the public API is declared as `implementation` instead of `api`. |
| Configuration is slow | Build scripts contain heavy code, or tasks are created eagerly. Use `tasks.register`, the configuration cache and `--scan`. |
| `Unsupported class file major version` | Gradle or a plugin is older than the JDK. Update the wrapper version. |
| The daemon runs out of memory | Set `org.gradle.jvmargs=-Xmx2g` in `gradle.properties`. |
| It works locally but fails in CI | The JDK or Gradle version differs, or an input is undeclared. Use the wrapper and toolchains. |

Useful commands:

- `./gradlew tasks` lists the tasks.
- `./gradlew dependencies --configuration runtimeClasspath` shows the dependency tree.
- `./gradlew dependencyInsight --dependency jackson-databind` explains why a version was chosen.
- `./gradlew build --scan` creates a build scan.
- `./gradlew --stop` stops the daemons.

## Cheat sheet {#cheatsheet}

| Need | Command or setting |
| --- | --- |
| Standard build | `./gradlew build` |
| Run the tests | `./gradlew test` (one test: `--tests "*PaymentServiceTest"`) |
| Run a Spring Boot app | `./gradlew bootRun` |
| Executable jar | `./gradlew bootJar` |
| List the tasks | `./gradlew tasks --all` |
| Why this version | `./gradlew dependencyInsight --dependency <name>` |
| Dependency tree | `./gradlew dependencies --configuration runtimeClasspath` |
| Speed up | `org.gradle.caching=true`, `org.gradle.parallel=true` and the configuration cache |
| Force a rerun | `--rerun-tasks`, or `--rerun` for one task |
| Share versions | `gradle/libs.versions.toml` |
| Share build logic | Convention plugins in `build-logic` |
| Same Gradle for everyone | `./gradlew` (the wrapper) |

## Interview questions {#questions}

### [basic] What is Gradle and how does it differ from Maven? {#what-q}

Gradle is a build tool that runs a graph of tasks, written in Kotlin or Groovy code. Maven runs a fixed lifecycle described in XML.

1. Gradle tasks declare their inputs and outputs.
2. So Gradle can skip work that is up to date, reuse cached results and run tasks in parallel.
3. This makes repeated builds of large projects faster.

Maven is more uniform and simpler. Gradle is more flexible and faster. Both use the same repositories and coordinates.

### [basic] What are the three phases of a Gradle build? {#phases-q}

Initialization, configuration and execution.

1. **Initialization** reads `settings.gradle.kts` and decides which projects are in the build.
2. **Configuration** runs every project's build script, registers the tasks and builds the task graph. It does not run any task.
3. **Execution** runs the requested tasks and the tasks they depend on, in order.

Configuration runs on every build, so slow code there slows down everything.

### [basic] What is a task? {#task-q}

A task is a named piece of work, such as `compileJava`, `test` or `jar`.

- It has actions and can depend on other tasks.
- Ideally it declares its inputs and outputs.
- Plugins add tasks, and you can write your own with `tasks.register`.
- Some tasks, such as `build`, are lifecycle tasks that only group other tasks.

### [basic] What is the Gradle wrapper and why use it? {#wrapper-q}

The wrapper is a small script that downloads and runs a fixed Gradle version. It makes everyone use the same version.

- It consists of `gradlew`, `gradlew.bat` and a small `gradle/wrapper` folder, all committed with the project.
- The script downloads the exact Gradle version named in `gradle-wrapper.properties` and runs it.
- Nobody needs to install Gradle first, including CI.

This prevents "it works on my machine" differences between builds.

### [basic] What does `UP-TO-DATE` mean? {#uptodate-q}

The task did not run, because nothing it depends on has changed.

- Its inputs and outputs are the same as in its last successful run, so running it would give the same result.
- Gradle checks this by comparing fingerprints (hashes) of the input files, the input properties and the output files.

`FROM-CACHE` is a related outcome. It means the outputs were copied from the build cache instead of being rebuilt.

### [intermediate] Explain `implementation` versus `api`. {#api-q}

Both make the library available to your module. Only `api` also shows it to the modules that use yours.

- Both put the dependency on the module's own compile and runtime classpaths.
- `api` (from `java-library`) also puts it on the compile classpath of consumers. Use it when the library's types appear in your public signatures.
- `implementation` keeps it internal. Consumers do not see it at compile time, and a change in that library does not recompile them.

For example, if `AccountService` has a method that returns a Jackson `JsonNode`, Jackson must be `api`. Use `implementation` by default and `api` only when you need it.

### [intermediate] When do you use `compileOnly`, `runtimeOnly` and `testImplementation`? {#config-q}

Use each one when a library is needed in only one place.

- `compileOnly` is for things needed only to compile, and not shipped. Examples are annotation APIs and Lombok (together with `annotationProcessor`).
- `runtimeOnly` is for libraries the code never compiles against but needs at run time. Examples are a JDBC driver and a logging backend.
- `testImplementation` is for test code only. Examples are JUnit, Mockito and Testcontainers.

Narrow configurations keep the deliverable small and the classpaths clean.

### [intermediate] How does Gradle resolve conflicting versions of a dependency? {#conflict-q}

It picks the **highest** version requested anywhere in the graph. Maven picks the nearest one instead.

You can change the result with:

- `constraints`,
- `strictly` versions,
- a platform or BOM,
- `resolutionStrategy.force`,
- or exclusions.

`./gradlew dependencyInsight --dependency name` shows which paths asked for which version, and why one was chosen.

### [intermediate] What is the build cache and how does it differ from the up-to-date check? {#cache-q}

The up-to-date check compares with your last run. The build cache can reuse outputs from any earlier run, anywhere.

- The **up-to-date check** compares with the **last run of the same task in the same workspace**.
- The **build cache** stores task outputs under a hash of the inputs. So it can reuse results from **any earlier run**: another branch, another machine, or CI (with a remote cache).

Both only work if tasks declare all their inputs and are deterministic.

### [intermediate] What is the configuration cache? {#config-cache-q}

It saves the result of the configuration phase, the task graph, so a repeated build can skip that phase.

- Gradle reloads the saved graph when the configuration's inputs have not changed. Those inputs are the build scripts and the files and properties they read.
- This matters most in large multi-project builds.
- It needs build logic that does not read the live project model while tasks run, so some plugins and scripts must be updated.

### [intermediate] How do you organise a multi-project build and share configuration? {#multi-q}

List the projects in settings, link them with project dependencies, and share build logic through convention plugins.

1. List the projects in `settings.gradle.kts` with `include`.
2. Link them with `implementation(project(":name"))`.
3. Keep versions in a version catalog.
4. Put the shared build logic in **convention plugins** (in `build-logic` or `buildSrc`), and apply them in each project.

Avoid `allprojects` and `subprojects` blocks. They spread configuration around and are harder to cache and read. Gradle works out the build order itself and runs independent projects in parallel.

### [intermediate] What is a version catalog? {#catalog-q}

A version catalog is the file `gradle/libs.versions.toml`. It defines versions, libraries, bundles and plugins in one place.

- Build scripts then use type-safe names such as `libs.jackson.databind`.
- It keeps versions the same across projects, so an upgrade is a one-line change.
- It works with update tools such as Dependabot.
- It replaces ad-hoc `ext` properties.

### [intermediate] A build is slow. How do you find out why? {#slow-q}

Measure first with a build scan, then fix the slow part.

1. Run `./gradlew build --scan` or `--profile`. It shows where the time goes: configuration, dependency resolution, one task, or the tests.
2. Then act on what you find:
   - turn on the build cache, parallel execution and the configuration cache;
   - make sure tasks declare their inputs and outputs, so they can be skipped;
   - move work out of the configuration phase;
   - split large modules, so a change recompiles less;
   - and give the daemon enough memory.

### [deep] Why should work not be done in the configuration phase? {#configuration-q}

Because the configuration phase runs on every build, for every project, even when its tasks do not run.

- It runs even for `gradle help`.
- Reading files, calling the network or creating all tasks eagerly adds time to every build.
- It also breaks the configuration cache.

Do the work inside task actions (`doLast`, `@TaskAction`). Use `tasks.register` so tasks are created lazily, and `Provider` values so they are computed only when needed.

### [deep] How does Gradle decide a task's order, and what is the difference between `dependsOn` and `mustRunAfter`? {#order-q}

Gradle builds a graph and runs each task after everything it depends on.

- **`dependsOn`** means "this task needs that task, so run it first". It **adds** the other task to the graph.
- **`mustRunAfter`** and **`shouldRunAfter`** only fix the order **if** both tasks are already in the graph. They never add a task.
- **`finalizedBy`** runs a task after another one, even when the first one fails. This suits cleanup.

For example, say `test` must run after a `lint` task. Running both puts `lint` first, but `./gradlew test` alone does not run `lint`.

### [deep] Which build tool would you choose for a bank's large multi-module Spring Boot platform? {#choose-q}

It depends on the real trade-offs, so measure before you decide.

- **Gradle** gives faster repeated and incremental builds, a shared build cache for CI and developers, and flexible logic in convention plugins. This pays off with dozens of modules.
- **Maven** gives a very uniform build that is easy to audit. Many enterprise tools and teams already know it.

Check the team's skills, the existing CI and artifact repository, and compliance needs such as dependency locking and reproducible builds. Then measure the actual build time. Do not mix both tools in one repository.

### [coding] Write a Gradle Kotlin build file for a Spring Boot service with PostgreSQL and Testcontainers. {#coding-build}

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.5"
}

group = "com.bank"
version = "1.0.0"

java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:postgresql")
}

tasks.test {
    useJUnitPlatform()
}
```

How to explain it:

- Boot's managed versions come from the dependency-management plugin.
- The database driver is `runtimeOnly`.
- The test libraries are `testImplementation`.
- The toolchain pins the JDK.
- `bootJar` produces the jar you can run.

### [coding] Create a custom task that fails the build when a file is too large, and make `check` depend on it. {#coding-task}

```kotlin
abstract class CheckJarSize : DefaultTask() {
    @get:InputFile abstract val jar: RegularFileProperty
    @get:Input abstract val maxMegabytes: Property<Int>

    @TaskAction
    fun verify() {
        val size = jar.get().asFile.length() / (1024 * 1024)
        if (size > maxMegabytes.get()) {
            throw GradleException("Jar is $size MB, the limit is ${maxMegabytes.get()} MB")
        }
    }
}

val checkJarSize = tasks.register<CheckJarSize>("checkJarSize") {
    jar = tasks.bootJar.flatMap { it.archiveFile }     // also depends on bootJar through the provider
    maxMegabytes = 120
}

tasks.check {
    dependsOn(checkJarSize)
}
```

How to explain it:

- The task declares its inputs, so Gradle skips it when the jar and the limit have not changed.
- The jar is passed through a provider, which creates the dependency on `bootJar` automatically.
- `tasks.register` keeps configuration lazy.
