---
title: Maven — lifecycle, dependencies and multi-module builds
nav: Maven
slug: maven
summary: How Apache Maven builds a Java project: the pom.xml, coordinates, the lifecycle and plugin goals, dependency scopes, transitive dependencies and the nearest-wins rule, dependencyManagement and BOMs, repositories and settings.xml, multi-module reactor builds, profiles, the Spring Boot plugin and common troubleshooting, with examples and interview questions.
tags: [Java, Maven, Build tools, Dependencies, Spring Boot]
order: 21
topic: Java / Build tools
updated: 2026-11-15
subnav: true
---

Every Java project needs the same things: compile the code, find the libraries it uses, run the tests and produce a jar. **Maven** does this from a single declarative file, `pom.xml`, using conventions so that every Maven project looks the same. Interviews ask *what the lifecycle is, how dependencies are resolved, what happens when two libraries need different versions, how a multi-module build is ordered, and how Maven differs from Gradle?* This lesson covers Maven; [Gradle](lesson:gradle) is the other common tool. Play the three scenes: the lifecycle, dependency resolution and the multi-module reactor.

```demo
name: maven-walk
```

> **One sentence to remember:** *Maven is convention over configuration: the pom declares what the project is and what it needs, a fixed lifecycle of phases decides the order, plugin goals do the work, and dependencies come from repositories using group, artifact and version coordinates.*

## The pom.xml {#pom}

The **POM** (Project Object Model) is the description of the project. A minimal Spring Boot service:

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.0</version>            <!-- brings dependencyManagement and plugin defaults -->
  </parent>

  <groupId>com.bank</groupId>           <!-- who: usually a reversed domain -->
  <artifactId>payments-service</artifactId>   <!-- what: the project name -->
  <version>1.4.0-SNAPSHOT</version>     <!-- which: SNAPSHOT means "under development" -->
  <packaging>jar</packaging>            <!-- jar (default), war, pom -->

  <properties>
    <java.version>21</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>   <!-- version comes from the parent -->
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

- **Coordinates** (**GAV**): `groupId:artifactId:version` identify any artifact in the world. `packaging` says what is produced.
- **Convention over configuration:** sources are in `src/main/java`, resources in `src/main/resources`, tests in `src/test/java`, output in `target/`. You do not configure any of it.
- **Inheritance:** a `<parent>` pom passes down properties, dependency management and plugin configuration. Every pom also inherits from the built-in **super POM**.
- **Effective POM:** `mvn help:effective-pom` prints the result after inheritance and defaults, which is the way to answer "where does this setting come from?".
- **SNAPSHOT versions** can be overwritten in a repository and are re-checked for updates; **release versions** are immutable.

## The lifecycle, phases and goals {#lifecycle}

Maven has three built-in **lifecycles**: `clean` (delete `target`), `default` (build and deliver) and `site` (documentation). The default lifecycle is an ordered list of **phases**:

| Phase | What happens |
| --- | --- |
| `validate` | check the project is correct |
| `compile` | compile `src/main/java` |
| `test` | run unit tests (Surefire) |
| `package` | build the jar or war |
| `verify` | run checks, usually integration tests (Failsafe) |
| `install` | copy the artifact into the local repository `~/.m2` |
| `deploy` | upload to a remote repository |

- **Asking for a phase runs every earlier phase.** `mvn package` runs validate, compile, test and package.
- **A phase has no code.** A **plugin goal** is bound to it: `compiler:compile` to `compile`, `surefire:test` to `test`, `jar:jar` to `package`. The default bindings depend on the packaging.
- **Run a goal directly** with `plugin:goal`, such as `mvn dependency:tree` or `mvn spring-boot:run`. A direct goal runs alone, with no earlier phases.
- **Commands are combined:** `mvn clean verify` runs the whole clean lifecycle and then the default lifecycle up to verify.

```bash
mvn clean verify                  # the usual CI build
mvn test -Dtest=PaymentServiceTest#rejectsNegativeAmount   # one test
mvn package -DskipTests           # compile tests, do not run them
mvn -q -o test                    # quiet and offline
mvn dependency:tree -Dincludes=com.fasterxml.jackson.core
```

Unit tests belong to `test` (Surefire, classes named `*Test`), and integration tests to `integration-test` and `verify` (Failsafe, classes named `*IT`), so a flaky database test does not block `package`.

## Dependencies {#dependencies}

```xml
<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
  <scope>runtime</scope>
</dependency>
```

| Scope | On the compile classpath | On the runtime classpath | On the test classpath | Packaged |
| --- | --- | --- | --- | --- |
| `compile` (default) | yes | yes | yes | yes |
| `provided` | yes | no | yes | no (the server supplies it) |
| `runtime` | no | yes | yes | yes |
| `test` | no | no | yes | no |
| `import` | only in `dependencyManagement`, to import a BOM | | | |

- **Transitive dependencies:** a dependency's own dependencies come along. Their scopes are narrowed (a `compile` dependency of a `test` dependency is `test`).
- **Mediation, nearest wins:** when the same artifact appears twice at different versions, Maven picks the one closest to your project in the tree. At equal depth the first declaration wins. It is not "the newest wins", so a library can silently get an older version than it needs.
- **Exclusions** remove an unwanted transitive dependency: `<exclusions><exclusion>…</exclusion></exclusions>`.
- **Optional** dependencies are not passed on to projects that depend on you.
- **Directly declared beats transitive.** If you need to control a version, declare it yourself (or manage it).

### dependencyManagement and BOMs {#bom}

`<dependencyManagement>` does not add dependencies. It **sets the version** (and scope) to use whenever the artifact appears, directly or transitively. A **BOM** (bill of materials) is a pom that contains only dependencyManagement, and you import it:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.cloud</groupId>
      <artifactId>spring-cloud-dependencies</artifactId>
      <version>2023.0.2</version>
      <type>pom</type>
      <scope>import</scope>       <!-- merge its managed versions into mine -->
    </dependency>
  </dependencies>
</dependencyManagement>
```

`spring-boot-starter-parent` already manages versions of hundreds of libraries, which is why Spring Boot dependencies have no `<version>`. If you cannot use Boot as the parent, import `spring-boot-dependencies` as a BOM instead.

## Repositories {#repositories}

- **Local repository:** `~/.m2/repository`. Maven looks here first, and `install` writes here.
- **Remote repositories:** Maven Central by default, plus any you declare.
- **Mirror:** in a company, `~/.m2/settings.xml` routes all downloads through one proxy (Nexus or Artifactory), which caches Central and hosts your private artifacts. This is faster, controllable and works behind a firewall.
- **settings.xml** holds per-user settings that must not be committed: mirrors, server credentials, proxies and profiles. The project's `pom.xml` is shared, `settings.xml` is personal.
- **Publishing:** `deploy` uploads to the repository named in `<distributionManagement>`, with credentials from `settings.xml`. Releases are immutable; snapshots go to a separate snapshot repository.

```xml
<!-- ~/.m2/settings.xml -->
<settings>
  <mirrors>
    <mirror>
      <id>corp</id>
      <mirrorOf>*</mirrorOf>
      <url>https://nexus.bank.example/repository/maven-public/</url>
    </mirror>
  </mirrors>
  <servers>
    <server>
      <id>corp-releases</id>
      <username>${env.NEXUS_USER}</username>
      <password>${env.NEXUS_TOKEN}</password>
    </server>
  </servers>
</settings>
```

## Multi-module projects {#modules}

A parent pom with `<packaging>pom</packaging>` lists modules:

```xml
<!-- parent pom.xml -->
<groupId>com.bank</groupId>
<artifactId>payments-parent</artifactId>
<version>1.4.0-SNAPSHOT</version>
<packaging>pom</packaging>

<modules>
  <module>payments-api</module>
  <module>payments-service</module>
  <module>payments-app</module>
</modules>

<dependencyManagement>
  <dependencies>
    <dependency>                     <!-- one place to define internal versions -->
      <groupId>com.bank</groupId>
      <artifactId>payments-api</artifactId>
      <version>${project.version}</version>
    </dependency>
  </dependencies>
</dependencyManagement>
```

- The **reactor** collects the modules, sorts them by their dependencies and builds them in that order, no matter how the `<modules>` list is written. Circular dependencies are an error.
- **Inheritance versus aggregation** are separate ideas: a module inherits from its `<parent>`, and a pom aggregates modules with `<modules>`. They are usually the same pom, but they do not have to be.
- **Useful options:** `-pl app -am` (build app and what it needs), `-pl service -amd` (also make dependents), `-rf :service` (resume from a module), `-T 1C` (one thread per core, in parallel).
- **Versions:** use one version for all modules (`${project.version}`), or the CI-friendly `${revision}` property with the flatten plugin so a release does not need many edits.
- A **BOM module** or a **parent with dependencyManagement** keeps third-party versions the same across modules.

## Plugins and profiles {#plugins}

- **Plugins** supply goals. Common ones: `maven-compiler-plugin` (Java version, `--release`), `maven-surefire-plugin` and `maven-failsafe-plugin` (tests), `maven-jar-plugin`, `maven-shade-plugin` or the Spring Boot plugin (executable jar), `jacoco-maven-plugin` (coverage), `maven-enforcer-plugin` (rules such as banned dependencies or a minimum Java version).
- **pluginManagement** is to plugins what dependencyManagement is to dependencies: it fixes versions and configuration in the parent without activating the plugin.
- **Profiles** change the build for an environment or situation:

```xml
<profiles>
  <profile>
    <id>integration</id>
    <activation>
      <property><name>env</name><value>ci</value></property>   <!-- mvn -Denv=ci ... -->
    </activation>
    <properties>
      <skip.docker>false</skip.docker>
    </properties>
  </profile>
</profiles>
```

Activate with `-P integration`, by a property, a JDK version or an OS. Profiles that change *dependencies* make builds harder to reproduce, so keep them for packaging and test settings, and put runtime configuration in the application, not in Maven.

## Maven with Spring Boot {#spring}

- **`spring-boot-starter-parent`** gives sensible defaults: Java version property, UTF-8, managed versions, and plugin configuration for the repackage goal.
- **`spring-boot-maven-plugin:repackage`** runs in `package` and turns the plain jar into an **executable fat jar**: dependencies in `BOOT-INF/lib`, a launcher class, and `java -jar app.jar` just works. The original jar is kept with the `.original` suffix.
- **Run in development:** `mvn spring-boot:run`. **Build an image without a Dockerfile:** `mvn spring-boot:build-image` uses Cloud Native Buildpacks.
- **Layered jars** put dependencies in their own layer, so a Docker image rebuild reuses the large dependency layer and only the small application layer changes.
- **Wrapper:** `mvnw` (`./mvnw clean verify`) downloads the Maven version recorded in `.mvn/wrapper`, so everyone, including CI, uses the same version without installing Maven.

## Maven and Gradle {#vs-gradle}

| | Maven | Gradle |
| --- | --- | --- |
| Build file | declarative XML (`pom.xml`) | code (Kotlin or Groovy DSL) |
| Flexibility | fixed lifecycle, extend with plugins | tasks and a graph you can program |
| Speed on repeat builds | rebuilds modules, limited caching | incremental, build cache, daemon |
| Learning curve | low and uniform | steeper, more powerful |
| Consistency across projects | very high | depends on the team |
| Typical use | enterprise Java, Spring Boot | Android, large multi-module builds |

Neither is "better". Choose what the team knows and what the project needs; a build that is predictable and identical on every machine matters more than the tool.

## Troubleshooting {#troubleshooting}

| Symptom | Likely cause and fix |
| --- | --- |
| `Could not resolve dependencies` | not in any repository, wrong coordinates, or the mirror or proxy is down; check `settings.xml` and run with `-U` to force snapshot updates |
| `NoSuchMethodError` or `ClassNotFoundException` at run time | two versions on the classpath and the wrong one won; run `mvn dependency:tree`, then manage the version |
| `release version 21 not supported` | the JDK running Maven is older than `<java.version>`; check `mvn -v` and `JAVA_HOME` |
| works on my machine, fails in CI | stale `~/.m2`, a SNAPSHOT that changed, or a different JDK; use the wrapper, `clean`, and pin versions |
| tests do not run | the class name does not match the Surefire pattern (`*Test`), or `-DskipTests` is set in the pom or profile |
| the jar will not start (`no main manifest attribute`) | the Spring Boot plugin is missing, so the jar was not repackaged |
| a library gets an old version | nearest wins chose a different one; declare it directly or add it to dependencyManagement |
| slow builds | use `-T 1C`, `-pl … -am`, `-o` offline, and a nearby mirror; avoid `clean` when it is not needed |

Useful commands: `mvn dependency:tree`, `mvn dependency:analyze` (unused and undeclared dependencies), `mvn help:effective-pom`, `mvn versions:display-dependency-updates`, `mvn -X` (debug output).

## Cheat sheet {#cheatsheet}

| Need | Command or setting |
| --- | --- |
| standard build | `mvn clean verify` |
| fast build without tests | `mvn package -DskipTests` |
| one test | `mvn test -Dtest=ClassName#method` |
| run a Spring Boot app | `mvn spring-boot:run` |
| see the dependency tree | `mvn dependency:tree` |
| find unused dependencies | `mvn dependency:analyze` |
| what the pom really says | `mvn help:effective-pom` |
| build one module and its needs | `mvn -pl app -am package` |
| build in parallel | `mvn -T 1C verify` |
| same Maven for everyone | `./mvnw` (Maven Wrapper) |
| managed versions | `dependencyManagement` and BOM `import` |
| local repo and mirror | `~/.m2/repository`, `~/.m2/settings.xml` |

## Interview questions {#questions}

### [basic] What is Maven and what problem does it solve? {#what-q}

A build and dependency management tool. A declarative `pom.xml` describes the project, and Maven compiles, tests, packages and publishes it using the same conventions everywhere. Its two big features are the standard **lifecycle** and **dependency management**: libraries are downloaded by coordinates (group, artifact, version) from repositories, together with their own dependencies, so nobody copies jars into the repository.

### [basic] What are the Maven coordinates? {#gav-q}

`groupId` (the organisation, usually a reversed domain), `artifactId` (the project name) and `version`, written GAV. Together with `packaging` (and optionally a classifier) they uniquely identify an artifact, in the repository path and in `dependency` elements. A `-SNAPSHOT` version means work in progress that can change; a release version never changes once published.

### [basic] What are the main phases of the default lifecycle? {#phases-q}

validate, compile, test, package, verify, install and deploy (with more in between, such as `process-resources`, `test-compile` and `integration-test`). Running a phase runs all earlier phases. `package` produces the jar, `install` copies it into the local repository, and `deploy` uploads it to a remote repository.

### [basic] What is the difference between a phase and a goal? {#goal-q}

A phase is a named step in a lifecycle with no behaviour of its own. A goal is a task provided by a plugin (`compiler:compile`). Goals are **bound** to phases, so running a phase runs its goals in order. You can also run a goal directly (`mvn dependency:tree`), which does not run any earlier phases.

### [basic] What is the difference between `mvn clean install` and `mvn clean package`? {#install-q}

Both clean and build the artifact. `package` stops once the jar exists in `target/`. `install` goes further and copies it to the local repository (`~/.m2`), which is needed when another project on the same machine must depend on it, such as a module built separately. Neither publishes anything remote; that is `deploy`.

### [basic] What is `~/.m2` and what is `settings.xml`? {#m2-q}

`~/.m2/repository` is the local repository, a cache of downloaded artifacts and of artifacts you `install`ed. `~/.m2/settings.xml` holds personal or environment settings that do not belong in the project: mirrors, repository credentials, proxies and profiles. The `pom.xml` is shared and committed, `settings.xml` is not.

### [intermediate] Explain dependency scopes. {#scope-q}

`compile` (default) is available everywhere and is packaged. `provided` is needed to compile but supplied at run time by the platform, such as the Servlet API on an external server, and is not packaged. `runtime` is not needed to compile but is on the runtime classpath, such as a JDBC driver. `test` is only for tests. `import` is used inside `dependencyManagement` to bring in a BOM. Choosing the narrowest scope keeps the artifact small and avoids accidental compile-time coupling.

### [intermediate] What are transitive dependencies, and how does Maven choose when versions conflict? {#transitive-q}

Transitive dependencies are the dependencies of your dependencies; Maven resolves the whole tree. If the same artifact is requested at different versions, Maven uses **nearest definition**: the version with the shortest path from your project, and the first declared on a tie. It is not the highest version. To control the result, declare the dependency in your own pom, manage it in `dependencyManagement`, or exclude the unwanted one. `mvn dependency:tree -Dverbose` shows what was omitted for conflict.

### [intermediate] What is the difference between `dependencies` and `dependencyManagement`? {#depman-q}

`dependencies` adds libraries to the project. `dependencyManagement` adds nothing; it only **declares the version and scope** to use when a dependency of that artifact appears, directly or transitively. It lets a parent pom or BOM centralise versions so child modules can omit them. It is the main tool for keeping versions consistent across modules.

### [intermediate] What is a BOM and how do you use one? {#bom-q}

A bill of materials is a pom with a `dependencyManagement` section listing compatible versions of many libraries, for example `spring-boot-dependencies` or `spring-cloud-dependencies`. You import it with `<type>pom</type><scope>import</scope>` inside `dependencyManagement`, and then declare the libraries without versions. It avoids version mismatches between parts of one framework, and it is the way to get Boot's managed versions when the project has a different parent.

### [intermediate] How does a multi-module build work? {#reactor-q}

A parent pom with `packaging pom` lists `<modules>`. The **reactor** reads all module poms, sorts them by their inter-module dependencies and builds them in that order, regardless of the list order, and fails on cycles. Shared configuration lives in the parent (inheritance) while the `<modules>` list is aggregation. Use `-pl` and `-am` to build part of the tree and `-T` to build independent modules in parallel.

### [intermediate] How do profiles work, and when would you avoid them? {#profile-q}

A profile is a named set of changes (properties, dependencies, plugin settings) that is active when you pass `-P`, or when a condition holds: a property, the JDK version or the operating system. They suit packaging and test variations. Avoid using them to change dependencies or behaviour per environment, because the artifact then differs by how it was built, which makes problems hard to reproduce. Prefer one artifact configured at run time by the application.

### [intermediate] What does the Spring Boot Maven plugin do? {#boot-plugin-q}

During `package` its `repackage` goal rewrites the jar into an executable one: dependencies are nested in `BOOT-INF/lib`, application classes in `BOOT-INF/classes`, and a launcher class is the `Main-Class`, so `java -jar` works. It also provides `spring-boot:run` for development, `spring-boot:build-image` to create a container image with buildpacks, and layered-jar support for efficient Docker layers.

### [intermediate] A service fails with `NoSuchMethodError` after you added a library. How do you investigate? {#conflict-q}

It is almost always a version conflict: two versions of a library are on the classpath and the one that won lacks the method. Run `mvn dependency:tree -Dverbose -Dincludes=group:artifact` to find which paths bring which version and what was omitted. Then fix it by declaring or managing the right version, excluding the transitive one, or importing the BOM that defines compatible versions. Confirm with the tree and run the tests.

### [deep] Why can Maven builds differ between machines, and how do you make them reproducible? {#reproducible-q}

Causes: a different Maven or JDK version, SNAPSHOT dependencies that changed, version ranges, a stale local repository, a different mirror, and profiles activated by the environment. Make builds reproducible with the **Maven Wrapper** (fixed Maven version), a pinned JDK (toolchains or CI image), fixed release versions or a managed BOM, the enforcer plugin (`requireJavaVersion`, `dependencyConvergence`, `banDuplicatePomDependencyVersions`), `project.build.outputTimestamp` for byte-identical jars, and a clean CI workspace.

### [deep] What is the difference between Surefire and Failsafe? {#surefire-q}

Surefire runs unit tests in the `test` phase, matching `*Test`, `Test*` and similar names, and fails the build immediately. Failsafe runs integration tests, matching `*IT`, in `integration-test` and checks the result in `verify`, so a failure still lets the `post-integration-test` phase run to stop servers or containers before the build fails. Splitting them keeps fast tests fast and slow ones separate.

### [deep] How would you compare Maven and Gradle for a new Spring Boot project? {#vs-gradle-q}

Both are fully supported by Spring Boot. Maven offers a uniform, declarative model with little to learn and almost identical builds in every project. Gradle offers a programmable task graph, incremental builds, a build cache and a daemon, which pay off in large multi-module projects and on repeated builds. Pick the one the team knows, weigh the build time of the real project, and avoid mixing both. See [Gradle](lesson:gradle).

### [coding] Write the pom for a Spring Boot web service with PostgreSQL and tests. {#coding-pom}

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.0</version>
  </parent>

  <groupId>com.bank</groupId>
  <artifactId>accounts-service</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <java.version>21</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

Explain that versions come from the parent, the JDBC driver is `runtime` because code does not compile against it, the test starter is `test` scope, and the Boot plugin makes `mvn package` produce a runnable jar.

### [coding] Force a single Jackson version and exclude a logging library you do not want. {#coding-conflict}

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.fasterxml.jackson</groupId>
      <artifactId>jackson-bom</artifactId>
      <version>2.17.1</version>
      <type>pom</type>
      <scope>import</scope>           <!-- every Jackson module now uses 2.17.1 -->
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <dependency>
    <groupId>com.bank</groupId>
    <artifactId>legacy-client</artifactId>
    <version>3.2.0</version>
    <exclusions>
      <exclusion>
        <groupId>commons-logging</groupId>
        <artifactId>commons-logging</artifactId>
      </exclusion>
    </exclusions>
  </dependency>
</dependencies>
```

Explain the difference: the BOM import fixes the version wherever Jackson appears in the tree, while the exclusion removes one transitive artifact from one dependency. Verify both with `mvn dependency:tree`.
