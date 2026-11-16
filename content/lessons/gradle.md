---
title: Gradle — tasks, incremental builds and dependency configurations
nav: Gradle
slug: gradle
summary: How Gradle builds a Java project: the Kotlin DSL build files, the three build phases, the task graph, inputs and outputs with up-to-date checks, the daemon, build cache and configuration cache, dependency configurations (api, implementation, runtimeOnly), version catalogs, multi-project builds, the Spring Boot plugin and troubleshooting, with examples and interview questions.
tags: [Java, Gradle, Build tools, Dependencies, Spring Boot]
order: 21
topic: Java / Build tools
updated: 2026-11-15
subnav: true
---

**Gradle** builds the same projects as [Maven](lesson:maven) but with a different idea: instead of a fixed lifecycle, you have a graph of **tasks**, and Gradle runs only the tasks that are needed and whose inputs have changed. The build file is code (Kotlin or Groovy), which is more flexible and more powerful, and a little harder to read. Interviews ask *what the three build phases are, what makes Gradle fast, what the difference is between `api` and `implementation`, how multi-project builds are organised, and how Gradle compares with Maven?* Play the three scenes: the build phases, up-to-date checks and the dependency configurations.

```demo
name: gradle-walk
```

> **One sentence to remember:** *Gradle models a build as a graph of tasks with declared inputs and outputs, so it can skip work that is up to date, take results from a cache and run only what you asked for, while dependency configurations decide which libraries are visible at compile time and at run time.*

## Build files {#files}

A project has a `settings.gradle.kts` (which projects exist) and one `build.gradle.kts` per project (what each one does):

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

- **Plugins** add tasks and conventions. The `java` plugin gives `compileJava`, `test`, `jar`, `build` and the standard source layout (`src/main/java`, `src/test/java`, the same as Maven). `application` adds `run`; `java-library` adds `api`.
- **Kotlin DSL (`.kts`)** gives type-safe code and good IDE completion; **Groovy DSL (`.gradle`)** is older and more compact. New projects usually pick Kotlin.
- **Dependencies** use the same coordinates as Maven, `group:artifact:version`, and the same repositories (Maven Central, Nexus).
- **The wrapper:** `./gradlew` downloads the Gradle version in `gradle/wrapper/gradle-wrapper.properties`, so everyone and CI use the same version. Always use the wrapper and commit it.

## The three build phases {#phases}

1. **Initialization.** Gradle reads `settings.gradle.kts` and decides which projects take part.
2. **Configuration.** Gradle runs the build script of every project (not the tasks). Scripts register tasks and set their properties, and Gradle builds the **task graph**, a directed acyclic graph, from the `dependsOn` relations.
3. **Execution.** Gradle runs the tasks that were requested and those they depend on, in dependency order.

`gradle test` therefore runs `compileJava`, `processResources`, `classes`, `compileTestJava`, `processTestResources`, `testClasses` and `test`, but not `jar`.

The most common beginner mistake is to do real work in the **configuration** phase, because it runs on every build, even `gradle tasks`:

```kotlin
// bad: runs at configuration time, on every build
val version = file("version.txt").readText()

// better: a task does it at execution time, only when it is needed
tasks.register("printVersion") {
    doLast { println(file("version.txt").readText()) }
}
```

Prefer `tasks.register` (lazy: the task is created only if needed) over `tasks.create` (eager), and use providers (`layout.buildDirectory`, `providers.gradleProperty`) so that values are read when they are needed.

## Tasks, inputs and outputs {#tasks}

A **task** is a unit of work with a name, optional dependencies, actions, and, importantly, declared **inputs** and **outputs**:

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

- **Task dependencies:** `dependsOn` (must run before), `mustRunAfter` (ordering only, if both run), `finalizedBy` (run something afterwards, for example cleanup).
- **Lifecycle tasks** such as `build`, `assemble` and `check` have no action of their own and only group other tasks. `build` runs `assemble` (jar) and `check` (tests and verification).
- **Up-to-date check:** before running, Gradle fingerprints the inputs and outputs. If they match the previous run, the task is `UP-TO-DATE` and does nothing. A task with no declared outputs is always run, and a wrongly declared one is a source of stale or slow builds.
- **Incremental compilation:** `compileJava` recompiles only the classes affected by a change.

Task outcomes you see in the console: `EXECUTED` (no label), `UP-TO-DATE`, `FROM-CACHE`, `SKIPPED` (it was disabled or `onlyIf` was false) and `NO-SOURCE` (no input files).

## Why Gradle is fast {#speed}

| Feature | What it does |
| --- | --- |
| **Daemon** | a background JVM that stays warm between builds, so there is no JVM start-up and build logic stays compiled |
| **Incremental build** | tasks skip when inputs and outputs are unchanged |
| **Build cache** | outputs are stored by input hash, locally or on a shared server, and reused across branches, machines and CI (`--build-cache` or `org.gradle.caching=true`) |
| **Configuration cache** | saves the task graph so repeat builds skip the configuration phase (`org.gradle.configuration-cache=true`) |
| **Parallel execution** | independent projects and tasks run at the same time (`org.gradle.parallel=true`) |
| **Dependency resolution cache** | downloaded artifacts and metadata are kept in `~/.gradle`, with checksums |

For a cache hit to be correct, tasks must be **deterministic** and declare **all** inputs, including environment values. A task reading an undeclared file or the current time poisons the cache. `--scan` produces a build scan that shows exactly where the time went.

## Dependency configurations {#configurations}

A **configuration** is a named bucket of dependencies with a purpose. For the `java` and `java-library` plugins:

| Configuration | Compile classpath | Runtime classpath | Exposed to consumers | Use for |
| --- | --- | --- | --- | --- |
| `implementation` | yes | yes | not at compile time | normal dependencies used inside the module |
| `api` (java-library) | yes | yes | yes, at compile time | types that appear in your public methods and classes |
| `compileOnly` | yes | no | no | annotations, Lombok, APIs the platform supplies |
| `runtimeOnly` | no | yes | no (at run time yes) | JDBC drivers, logging backends |
| `testImplementation` | tests only | tests only | no | JUnit, Mockito, Testcontainers |
| `annotationProcessor` | processor path | no | no | Lombok, MapStruct processors |

- **implementation versus api:** use `implementation` by default. A library you expose in your public API (a type in a method signature) must be `api`, or consumers fail to compile. The benefit of `implementation` is a smaller compile classpath and **less recompilation**: a change to an internal library does not recompile the modules that use yours.
- **Conflict resolution:** unlike Maven, Gradle picks the **highest** version requested by any path. Use `constraints { }`, a platform (BOM) or `strictly` to control it.
- **BOMs:** `implementation(platform("org.springframework.boot:spring-boot-dependencies:3.3.0"))` imports managed versions, like Maven's `import` scope.
- **Dynamic versions** (`1.+`, `latest.release`) and `-SNAPSHOT`/`changing` modules make builds unrepeatable; use fixed versions and **dependency locking** if you need to pin the whole tree.

### Version catalogs {#catalog}

`gradle/libs.versions.toml` lists versions and libraries once:

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

- **`project(":name")`** is a dependency on another project. Gradle works out the build order from them, builds only what is needed (`:payments-app:build` builds its dependencies too), and runs independent projects in parallel.
- **Share configuration** without copying it: put it in **convention plugins** under `buildSrc` or an included build `build-logic`, and apply them with `plugins { id("bank.java-conventions") }`. This is the modern replacement for `allprojects { }` and `subprojects { }` blocks, which hide where settings come from.
- **Composite builds:** `includeBuild("../shared-lib")` substitutes a local checkout for a published dependency, which is handy while working on a library and its consumer together.
- **Useful options:** `./gradlew :payments-service:test`, `--continue` (keep going after a failure), `--parallel`, `-x test` (exclude a task), `--tests "*PaymentServiceTest"`, `--offline`, `--refresh-dependencies`.

## Gradle with Spring Boot {#spring}

- The **`org.springframework.boot`** plugin adds `bootRun`, `bootJar` (an executable jar with nested dependencies, like Maven's repackage), `bootBuildImage` (a container image with buildpacks) and makes the plain `jar` task a `-plain` jar.
- The **`io.spring.dependency-management`** plugin applies Boot's managed versions, so Boot dependencies have no version. Alternatively import the BOM with `platform(...)`.
- **Layered jars** and `bootBuildImage` give efficient container images, as with Maven.
- **Testing:** `useJUnitPlatform()`; for slow integration tests add a separate `integrationTest` task or the JVM test suites plugin, so `test` stays fast.
- **Toolchains** (`java.toolchain`) let the build use a specific JDK regardless of the one running Gradle.

## Maven and Gradle {#vs-maven}

| | Gradle | Maven |
| --- | --- | --- |
| Model | task graph, programmable | fixed lifecycle, declarative |
| Build file | Kotlin or Groovy code | XML |
| Incremental and cache | strong (up-to-date, build cache, configuration cache) | limited |
| Dependency conflicts | highest version wins | nearest definition wins |
| Customisation | write tasks and plugins in the build | write a plugin in Java |
| Predictability | depends on how the build is written | very uniform |
| Strong at | large multi-project builds, Android | enterprise Java standardisation |

See [Maven](lesson:maven) for the other side. A good answer always names the trade-off: flexibility and speed against uniformity and simplicity.

## Troubleshooting {#troubleshooting}

| Symptom | Likely cause and fix |
| --- | --- |
| a task runs every time | missing or wrong inputs and outputs, or it reads something undeclared; run with `--info` and look at "Task ... is not up-to-date because" |
| stale output after a change | outputs not declared, or a task writes to a shared location; use `--rerun` or `clean` to prove it, then fix the declaration |
| `Could not resolve` | repository missing from `repositories { }`, wrong coordinates, or a proxy problem; try `--refresh-dependencies` |
| compile error in a consumer module | a library used in the public API is declared as `implementation` instead of `api` |
| slow configuration | heavy code in build scripts or eager task creation; use `tasks.register`, the configuration cache and `--scan` |
| `Unsupported class file major version` | Gradle or a plugin is older than the JDK; update the wrapper version |
| out of memory in the daemon | set `org.gradle.jvmargs=-Xmx2g` in `gradle.properties` |
| works locally, fails in CI | different JDK or Gradle version, or an undeclared input; use the wrapper and toolchains |

Useful commands: `./gradlew tasks`, `./gradlew dependencies --configuration runtimeClasspath`, `./gradlew dependencyInsight --dependency jackson-databind`, `./gradlew build --scan`, `./gradlew --stop` (stop daemons).

## Cheat sheet {#cheatsheet}

| Need | Command or setting |
| --- | --- |
| standard build | `./gradlew build` |
| run the tests | `./gradlew test` (one: `--tests "*PaymentServiceTest"`) |
| run a Spring Boot app | `./gradlew bootRun` |
| executable jar | `./gradlew bootJar` |
| list tasks | `./gradlew tasks --all` |
| why this version | `./gradlew dependencyInsight --dependency <name>` |
| dependency tree | `./gradlew dependencies --configuration runtimeClasspath` |
| speed up | `org.gradle.caching=true`, `org.gradle.parallel=true`, configuration cache |
| force a rerun | `--rerun-tasks` or `--rerun` for one task |
| share versions | `gradle/libs.versions.toml` |
| share build logic | convention plugins in `build-logic` |
| same Gradle for everyone | `./gradlew` (wrapper) |

## Interview questions {#questions}

### [basic] What is Gradle and how does it differ from Maven? {#what-q}

A build tool that models the build as a graph of tasks written in Kotlin or Groovy code, rather than Maven's fixed lifecycle and XML. Its tasks declare inputs and outputs, so Gradle can skip up-to-date work, reuse cached results and run in parallel, which makes repeated builds faster on large projects. Maven is more uniform and simpler, Gradle more flexible and faster. Both use the same repositories and coordinates.

### [basic] What are the three phases of a Gradle build? {#phases-q}

**Initialization** reads `settings.gradle.kts` and decides which projects are in the build. **Configuration** runs every project's build script, registers tasks and builds the task graph, without running any task. **Execution** runs the requested tasks and their dependencies in order. Configuration runs on every build, so expensive code there slows everything down.

### [basic] What is a task? {#task-q}

A named unit of work, for example `compileJava`, `test` or `jar`. It has actions, dependencies on other tasks and, ideally, declared inputs and outputs. Plugins contribute tasks, and you can write your own with `tasks.register`. Some are lifecycle tasks such as `build` that only group others.

### [basic] What is the Gradle wrapper and why use it? {#wrapper-q}

`gradlew` and `gradlew.bat` plus a small `gradle/wrapper` directory, committed with the project. The script downloads the exact Gradle version named in `gradle-wrapper.properties` and runs it. Everyone, including CI, uses the same version with nothing installed beforehand, which prevents "works on my machine" build differences.

### [basic] What does `UP-TO-DATE` mean? {#uptodate-q}

The task did not run because its inputs and outputs are the same as in its last successful execution, so its work would produce the same result. Gradle compares fingerprints (hashes) of the input files, properties and the output files. `FROM-CACHE` is the related case where outputs were restored from the build cache instead of being rebuilt.

### [intermediate] Explain `implementation` versus `api`. {#api-q}

Both put the dependency on the module's own compile and runtime classpaths. `api` (from `java-library`) also exposes it to modules that depend on this one at compile time, so use it when its types appear in your public signatures. `implementation` keeps it internal: consumers do not see it at compile time, and a change in that library does not recompile them. Default to `implementation` and use `api` only when needed.

### [intermediate] When do you use `compileOnly`, `runtimeOnly` and `testImplementation`? {#config-q}

`compileOnly` is for things needed only to compile and not shipped, such as annotation APIs or Lombok (together with `annotationProcessor`). `runtimeOnly` is for libraries the code never compiles against but needs at run time, such as a JDBC driver or logging backend. `testImplementation` is for test code only: JUnit, Mockito, Testcontainers. Narrow configurations keep the deliverable small and the classpaths clean.

### [intermediate] How does Gradle resolve conflicting versions of a dependency? {#conflict-q}

By default it chooses the **highest** version requested anywhere in the graph, unlike Maven's nearest definition. You can override that with `constraints`, `strictly` versions, a platform or BOM, `resolutionStrategy.force`, or exclusions. `./gradlew dependencyInsight --dependency name` explains which paths asked for which version and why one was selected.

### [intermediate] What is the build cache and how does it differ from the up-to-date check? {#cache-q}

The up-to-date check compares against the **last run of the same task in the same workspace**. The build cache stores task outputs keyed by a hash of the inputs, so it can reuse results from **any earlier run**: another branch, another machine or CI (with a remote cache). Both rely on tasks declaring all of their inputs and being deterministic.

### [intermediate] What is the configuration cache? {#config-cache-q}

A feature that saves the result of the configuration phase, the task graph, and reloads it when the inputs of the configuration (build scripts, relevant files and properties) have not changed. Repeat builds skip configuration entirely, which matters in large multi-project builds. It requires build logic that does not read the live project model during execution, so some plugins and scripts need updating.

### [intermediate] How do you organise a multi-project build and share configuration? {#multi-q}

List the projects in `settings.gradle.kts` with `include`, connect them with `implementation(project(":name"))`, and keep versions in a version catalog. Put the shared build logic in **convention plugins** (in `build-logic` or `buildSrc`) that each project applies, rather than `allprojects` and `subprojects` blocks, which scatter configuration and are harder to cache and read. Gradle derives the build order and runs independent projects in parallel.

### [intermediate] What is a version catalog? {#catalog-q}

A `gradle/libs.versions.toml` file that defines versions, libraries, bundles and plugins in one place. Build scripts then use type-safe accessors such as `libs.jackson.databind`. It keeps versions consistent across projects, makes upgrades a one-line change and works with dependabot-style tools, and it replaces ad-hoc `ext` properties.

### [intermediate] A build is slow. How do you find out why? {#slow-q}

Run `./gradlew build --scan` or `--profile` to see where time goes: configuration, dependency resolution, a specific task, or the tests. Then act on it: enable the build cache, parallel execution and configuration cache; make sure tasks declare their inputs and outputs so they can be skipped; move work out of the configuration phase; split large modules so a change recompiles less; and give the daemon enough memory.

### [deep] Why should work not be done in the configuration phase? {#configuration-q}

Because configuration runs on every invocation, even `gradle help`, for every project in the build, whether or not its tasks run. Reading files, calling the network or creating all tasks eagerly adds time to every build, and breaks the configuration cache. Do work inside task actions (`doLast`, `@TaskAction`), use `tasks.register` for lazy creation and `Provider` values so that they are computed only when needed.

### [deep] How does Gradle decide a task's order, and what is the difference between `dependsOn` and `mustRunAfter`? {#order-q}

Gradle builds a directed acyclic graph from the dependencies and runs a task after everything it depends on. `dependsOn` means "this task needs that task, so run it first" and it adds the other task to the graph. `mustRunAfter` and `shouldRunAfter` only fix the order **if** both tasks are already in the graph; they never add a task. `finalizedBy` schedules a task after another, even when the first fails, which suits cleanup.

### [deep] Which build tool would you choose for a bank's large multi-module Spring Boot platform? {#choose-q}

Weigh the real trade-offs. Gradle gives faster repeated and incremental builds, a shared build cache across CI and developers, and flexible logic in convention plugins, which pays off with dozens of modules. Maven gives a very uniform, easily audited build that many enterprise tools and teams already know. Check team skill, the existing CI and artifact repository, compliance needs such as dependency locking and reproducible builds, and measure the actual build time before deciding. Do not mix both in one repository.

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

Explain that Boot's managed versions come from the dependency-management plugin, the driver is `runtimeOnly`, the test libraries are `testImplementation`, the toolchain pins the JDK, and `bootJar` produces the runnable jar.

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

Explain that the task declares its inputs, so it is skipped when the jar and limit are unchanged, that wiring the jar through a provider creates the task dependency automatically, and that `tasks.register` keeps configuration lazy.
