---
title: Maven — lifecycle, dependencies and multi-module builds
nav: Maven
slug: maven
summary: How Apache Maven builds a Java project: the pom.xml, coordinates, the lifecycle and plugin goals, dependency scopes, transitive dependencies and the nearest-wins rule, dependencyManagement and BOMs, repositories and settings.xml, multi-module reactor builds, profiles, the Spring Boot plugin and common troubleshooting, with examples and interview questions.
tags: [Java, Maven, Build tools, Dependencies, Spring Boot]
order: 21
topic: Java / Build tools
updated: 2026-11-24
subnav: true
---

Every Java project needs the same jobs done:

- compile the code,
- download the libraries it uses,
- run the tests,
- and produce a jar.

**Maven** does all of this from one file, `pom.xml`. The file is **declarative**: it says what the project is and what it needs, not the steps to build it. Maven also uses fixed **conventions** (standard folder names and a standard build order), so every Maven project looks the same.

Interviews ask:

- What is the lifecycle?
- How are dependencies found?
- What happens when two libraries need different versions of the same library?
- In what order does a multi-module build run?
- How is Maven different from Gradle?

This lesson covers Maven. [Gradle](lesson:gradle) is the other common build tool.

The animation has three scenes: the lifecycle, how dependencies are found, and the multi-module build order.

```demo
name: maven-walk
```

> **One sentence to remember:** *The pom says what the project needs, and Maven runs a fixed list of phases to build it.*

## The pom.xml {#pom}

The **POM** (Project Object Model) describes the project. Here is a small Spring Boot service:

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

- **Coordinates** identify any artifact (a jar or other build result) in the world. They are `groupId:artifactId:version`, often called **GAV**. `packaging` says what kind of file is produced.
- **Convention over configuration** means you do not configure the folders. Sources go in `src/main/java`, resources in `src/main/resources` and tests in `src/test/java`. The output goes to `target/`.
- **Inheritance** lets a `<parent>` pom pass down properties, dependency versions and plugin settings. Every pom also inherits from a built-in pom called the **super POM**.
- The **effective POM** is the final pom after inheritance and defaults are applied. `mvn help:effective-pom` prints it. Use it to answer "where does this setting come from?".
- A **SNAPSHOT version** is work in progress. It can be overwritten in a repository, and Maven checks it again for updates. A **release version** never changes once published.

## The lifecycle, phases and goals {#lifecycle}

Maven has three built-in **lifecycles**. A lifecycle is a fixed list of steps.

- `clean` deletes the `target` folder.
- `default` builds and delivers the project.
- `site` builds documentation.

Each step in a lifecycle is called a **phase**. These are the main phases of the default lifecycle, in order:

| Phase | What happens |
| --- | --- |
| `validate` | Maven checks that the project is correct. |
| `compile` | Maven compiles `src/main/java`. |
| `test` | Maven runs the unit tests with the Surefire plugin. |
| `package` | Maven builds the jar or war. |
| `verify` | Maven runs checks, usually the integration tests with the Failsafe plugin. |
| `install` | Maven copies the artifact into the local repository, `~/.m2`. |
| `deploy` | Maven uploads the artifact to a remote repository. |

How phases behave:

- **Asking for a phase runs every phase before it.** `mvn package` runs validate, compile, test and package.
- **A phase has no code of its own.** A **plugin goal** is attached ("bound") to it and does the work. For example, `compiler:compile` is bound to `compile`, `surefire:test` to `test` and `jar:jar` to `package`. Which goals are bound by default depends on the packaging.
- **You can run a goal directly** with `plugin:goal`, such as `mvn dependency:tree` or `mvn spring-boot:run`. A goal run this way runs alone, without the earlier phases.
- **You can combine commands.** `mvn clean verify` runs the whole clean lifecycle, then the default lifecycle up to verify.

```bash
mvn clean verify                  # the usual CI build
mvn test -Dtest=PaymentServiceTest#rejectsNegativeAmount   # one test
mvn package -DskipTests           # compile tests, do not run them
mvn -q -o test                    # quiet and offline
mvn dependency:tree -Dincludes=com.fasterxml.jackson.core
```

Unit tests and integration tests run in different phases:

- Unit tests run in `test`, with Surefire. Their class names end in `Test`.
- Integration tests run in `integration-test` and `verify`, with Failsafe. Their class names end in `IT`.

This way a slow or flaky database test does not stop `package`.

Try it in the lab: [mvn package runs every phase before it](lab:maven-lifecycle).

## Dependencies {#dependencies}

A dependency names a library by its coordinates. The **scope** says where the library is needed:

```xml
<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
  <scope>runtime</scope>
</dependency>
```

A **classpath** is the list of jars Java can see. There are separate classpaths for compiling, running and testing.

| Scope | On the compile classpath | On the runtime classpath | On the test classpath | Packaged |
| --- | --- | --- | --- | --- |
| `compile` (default) | Yes. | Yes. | Yes. | Yes. |
| `provided` | Yes. | No. | Yes. | No, because the server supplies it. |
| `runtime` | No. | Yes. | Yes. | Yes. |
| `test` | No. | No. | Yes. | No. |
| `import` | It is used only in `dependencyManagement`, to import a BOM. | | | |

The rules:

- **Transitive dependencies come along.** A transitive dependency is a dependency of one of your dependencies. Its scope can become narrower. For example, a `compile` dependency of a `test` dependency becomes `test`.
- **Nearest wins.** Sometimes the same library appears twice with different versions. Maven then picks the version closest to your project in the tree. If both are at the same depth, the one declared first wins. This rule is called **mediation**. It is not "the newest wins", so a library can quietly get an older version than it needs.
- **Exclusions** remove a transitive dependency you do not want: `<exclusions><exclusion>…</exclusion></exclusions>`.
- **Optional** dependencies are not passed on to projects that depend on yours.
- **A direct declaration beats a transitive one.** If you need to control a version, declare it yourself or manage it (next section).

Try it in the lab: [Two libraries, two Jackson versions](lab:maven-dependency-conflict).

### dependencyManagement and BOMs {#bom}

`<dependencyManagement>` does not add any dependency. It only **sets the version** (and scope) to use whenever that library appears, directly or transitively.

A **BOM** (bill of materials) is a pom that contains only a dependencyManagement section. You import it like this:

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

`spring-boot-starter-parent` already manages the versions of hundreds of libraries. That is why Spring Boot dependencies have no `<version>`. If your project cannot use Boot as its parent, import `spring-boot-dependencies` as a BOM instead.

## Repositories {#repositories}

A **repository** is a store of artifacts. Maven uses two kinds.

- The **local repository** is `~/.m2/repository` on your machine. Maven looks here first, and `install` writes here.
- **Remote repositories** are servers. Maven Central is the default, and you can add others.

In a company, a few more ideas matter:

- A **mirror** sends all downloads through one proxy server, usually Nexus or Artifactory. You set it in `~/.m2/settings.xml`. The proxy caches Maven Central and also hosts the company's private artifacts. Builds become faster and easier to control, and they work behind a firewall.
- **settings.xml** holds personal settings that must not be committed: mirrors, server passwords, proxies and profiles. The project's `pom.xml` is shared. `settings.xml` belongs to one user or one machine.
- **Publishing** happens in `deploy`. It uploads to the repository named in `<distributionManagement>`, using the credentials from `settings.xml`. Release versions cannot be changed after upload. Snapshots go to a separate snapshot repository.

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

A large project can be split into **modules**. A parent pom with `<packaging>pom</packaging>` lists them:

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

- The **reactor** is the part of Maven that builds modules. It reads all modules, sorts them by their dependencies on each other and builds them in that order. The order of the `<modules>` list does not matter. A cycle (A needs B and B needs A) is an error.
- **Inheritance and aggregation are separate ideas.** A module *inherits* settings from its `<parent>`. A pom *aggregates* modules by listing them in `<modules>`. Usually one pom does both, but it does not have to.
- **Useful options:**
  - `-pl app -am` builds `app` and the modules it needs.
  - `-pl service -amd` builds `service` and the modules that depend on it.
  - `-rf :service` resumes the build from the `service` module.
  - `-T 1C` builds in parallel, with one thread per CPU core.
- **Versions:** give all modules one version (`${project.version}`). Or use the CI-friendly `${revision}` property with the flatten plugin, so a release does not need many edits.
- **Shared library versions:** a BOM module, or a parent with dependencyManagement, keeps third-party versions the same in every module.

Try it in the lab: [The reactor orders a multi-module build](lab:maven-reactor).

## Plugins and profiles {#plugins}

**Plugins** supply the goals. Common ones:

- `maven-compiler-plugin` sets the Java version (`--release`).
- `maven-surefire-plugin` and `maven-failsafe-plugin` run the tests.
- `maven-jar-plugin` builds the jar.
- `maven-shade-plugin` or the Spring Boot plugin builds an executable jar.
- `jacoco-maven-plugin` measures test coverage.
- `maven-enforcer-plugin` checks rules, such as banned dependencies or a minimum Java version.

**pluginManagement** does for plugins what dependencyManagement does for dependencies. It fixes plugin versions and settings in the parent, but does not switch the plugin on.

A **profile** is a named set of changes to the build, for one environment or situation:

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

You switch a profile on with `-P integration`. It can also switch on by itself, based on a property, the JDK version or the operating system.

Be careful with profiles that change *dependencies*. They make builds harder to reproduce. Use profiles for packaging and test settings. Put runtime configuration in the application, not in Maven.

## Maven with Spring Boot {#spring}

- **`spring-boot-starter-parent`** gives sensible defaults. It sets a Java version property, UTF-8 encoding, managed versions and the plugin settings for the `repackage` goal.
- **`spring-boot-maven-plugin:repackage`** runs in `package`. It turns the plain jar into an **executable fat jar**. A fat jar contains your code and all its dependencies (in `BOOT-INF/lib`), plus a launcher class, so `java -jar app.jar` just works. The original jar is kept with the `.original` suffix.
- **Run it while developing** with `mvn spring-boot:run`.
- **Build a container image without a Dockerfile** with `mvn spring-boot:build-image`. It uses Cloud Native Buildpacks.
- **Layered jars** put the dependencies in their own layer. When you rebuild the Docker image, the large dependency layer is reused and only the small application layer changes.
- **The wrapper** `mvnw` (`./mvnw clean verify`) downloads the Maven version recorded in `.mvn/wrapper`. Everyone, including CI, then uses the same version without installing Maven.

## Maven and Gradle {#vs-gradle}

| | Maven | Gradle |
| --- | --- | --- |
| Build file | Declarative XML (`pom.xml`). | Code, in the Kotlin or Groovy DSL. |
| Flexibility | A fixed lifecycle, extended with plugins. | Tasks in a graph that you can program. |
| Speed on repeat builds | It rebuilds modules and has limited caching. | It is incremental, with a build cache and a daemon. |
| Learning curve | Low, and the same everywhere. | Steeper, but more powerful. |
| Consistency across projects | Very high. | It depends on the team. |
| Typical use | Enterprise Java and Spring Boot. | Android and large multi-module builds. |

Neither tool is "better". Choose what the team knows and what the project needs. A build that is predictable and the same on every machine matters more than the tool.

## Troubleshooting {#troubleshooting}

| Symptom | Likely cause and fix |
| --- | --- |
| `Could not resolve dependencies` | The artifact is in no repository, the coordinates are wrong, or the mirror or proxy is down. Check `settings.xml`, and run with `-U` to force snapshot updates. |
| `NoSuchMethodError` or `ClassNotFoundException` at run time | Two versions are on the classpath and the wrong one won. Run `mvn dependency:tree`, then manage the version. |
| `release version 21 not supported` | The JDK running Maven is older than `<java.version>`. Check `mvn -v` and `JAVA_HOME`. |
| It works on my machine but fails in CI | The cause is a stale `~/.m2`, a SNAPSHOT that changed or a different JDK. Use the wrapper and `clean`, and pin versions. |
| Tests do not run | The class name does not match the Surefire pattern (`*Test`), or `-DskipTests` is set in the pom or a profile. |
| The jar will not start (`no main manifest attribute`) | The Spring Boot plugin is missing, so the jar was not repackaged. |
| A library gets an old version | Nearest wins chose a different one. Declare it directly or add it to dependencyManagement. |
| Builds are slow | Use `-T 1C`, `-pl … -am`, `-o` (offline) and a nearby mirror. Do not run `clean` when you do not need it. |

Useful commands:

- `mvn dependency:tree` shows the dependency tree.
- `mvn dependency:analyze` finds unused and undeclared dependencies.
- `mvn help:effective-pom` shows the final pom.
- `mvn versions:display-dependency-updates` lists newer versions.
- `mvn -X` prints debug output.

## Cheat sheet {#cheatsheet}

| Need | Command or setting |
| --- | --- |
| Standard build | `mvn clean verify` |
| Fast build without tests | `mvn package -DskipTests` |
| One test | `mvn test -Dtest=ClassName#method` |
| Run a Spring Boot app | `mvn spring-boot:run` |
| See the dependency tree | `mvn dependency:tree` |
| Find unused dependencies | `mvn dependency:analyze` |
| See what the pom really says | `mvn help:effective-pom` |
| Build one module and what it needs | `mvn -pl app -am package` |
| Build in parallel | `mvn -T 1C verify` |
| Same Maven for everyone | `./mvnw` (the Maven Wrapper) |
| Managed versions | `dependencyManagement` and a BOM `import` |
| Local repository and mirror | `~/.m2/repository` and `~/.m2/settings.xml` |

## Interview questions {#questions}

### [basic] What is Maven and what problem does it solve? {#what-q}

Maven is a build tool and a dependency manager.

1. **It builds every project the same way.** A declarative `pom.xml` describes the project. Maven compiles, tests, packages and publishes it with the same conventions everywhere, using its standard **lifecycle**.
2. **It manages dependencies.** It downloads libraries from repositories by their coordinates (group, artifact, version), together with their own dependencies.

For example, you add `spring-boot-starter-web` to the pom, and Maven downloads it and everything it needs. Nobody copies jars into the code repository.

### [basic] What are the Maven coordinates? {#gav-q}

`groupId`, `artifactId` and `version`, written GAV.

- `groupId` is the organisation, usually a reversed domain such as `com.bank`.
- `artifactId` is the project name, such as `payments-service`.
- `version` is the release, such as `1.4.0`.

With `packaging` (and sometimes a classifier), they identify one artifact exactly. They appear in the repository path and in `dependency` elements. A `-SNAPSHOT` version is work in progress and can change. A release version never changes once published.

### [basic] What are the main phases of the default lifecycle? {#phases-q}

validate, compile, test, package, verify, install and deploy. There are more phases in between, such as `process-resources`, `test-compile` and `integration-test`.

Running a phase runs all the phases before it.

- `package` produces the jar.
- `install` copies it into the local repository.
- `deploy` uploads it to a remote repository.

### [basic] What is the difference between a phase and a goal? {#goal-q}

A phase is a step in the lifecycle. A goal is the work a plugin does.

- A **phase** is a named step with no behaviour of its own, such as `compile`.
- A **goal** is a task provided by a plugin, such as `compiler:compile`.
- Goals are **bound** to phases. Running a phase runs its goals in order.

You can also run a goal directly, for example `mvn dependency:tree`. That runs only the goal, with no earlier phases.

### [basic] What is the difference between `mvn clean install` and `mvn clean package`? {#install-q}

`install` goes one step further: it copies the jar into your local repository.

- Both commands clean and then build the artifact.
- `package` stops once the jar exists in `target/`.
- `install` also copies the jar to `~/.m2`. You need this when another project on the same machine depends on it, such as a module built separately.

Neither command publishes anything to a remote server. That is `deploy`.

### [basic] What is `~/.m2` and what is `settings.xml`? {#m2-q}

- `~/.m2/repository` is the **local repository**. It is a cache of downloaded artifacts and of the artifacts you `install`ed.
- `~/.m2/settings.xml` holds **personal or machine settings** that do not belong in the project: mirrors, repository passwords, proxies and profiles.

The `pom.xml` is shared and committed. `settings.xml` is not committed.

### [intermediate] Explain dependency scopes. {#scope-q}

A scope says on which classpaths a dependency appears and whether it is packaged.

- `compile` is the default. It is available everywhere and is packaged.
- `provided` is needed to compile, but the platform supplies it at run time, so it is not packaged. An example is the Servlet API on an external server.
- `runtime` is not needed to compile, but it is on the runtime classpath. An example is a JDBC driver.
- `test` is only for tests.
- `import` is used inside `dependencyManagement` to bring in a BOM.

Choose the narrowest scope. It keeps the artifact small and stops code from compiling against a library by accident.

### [intermediate] What are transitive dependencies, and how does Maven choose when versions conflict? {#transitive-q}

Transitive dependencies are the dependencies of your dependencies. When versions conflict, Maven picks the **nearest** one, not the highest.

1. Maven builds the whole dependency tree.
2. If the same artifact is asked for at different versions, Maven uses the version with the **shortest path** from your project. This is called **nearest definition**.
3. If two paths have the same length, the one declared first wins.

To control the result, declare the dependency in your own pom, manage it in `dependencyManagement`, or exclude the unwanted one. `mvn dependency:tree -Dverbose` shows which versions were left out because of a conflict.

### [intermediate] What is the difference between `dependencies` and `dependencyManagement`? {#depman-q}

`dependencies` adds libraries. `dependencyManagement` adds nothing and only sets versions.

- `dependencies` puts libraries into the project.
- `dependencyManagement` **declares the version and scope** to use whenever that artifact appears, directly or transitively.

A parent pom or BOM uses it to keep versions in one place, so child modules can leave the version out. It is the main tool for keeping versions the same across modules.

### [intermediate] What is a BOM and how do you use one? {#bom-q}

A BOM (bill of materials) is a pom that lists versions of many libraries that work together.

- It has only a `dependencyManagement` section. Examples are `spring-boot-dependencies` and `spring-cloud-dependencies`.
- You import it inside `dependencyManagement` with `<type>pom</type><scope>import</scope>`.
- Then you declare the libraries without versions.

It prevents version mismatches between parts of one framework. It is also how you get Boot's managed versions when your project has a different parent.

### [intermediate] How does a multi-module build work? {#reactor-q}

A parent pom lists the modules, and the **reactor** builds them in dependency order.

1. The parent pom has `packaging pom` and a `<modules>` list.
2. The reactor reads all module poms and sorts them by the dependencies between them. The order of the list does not matter. A cycle fails the build.
3. Shared configuration lives in the parent (inheritance). The `<modules>` list is aggregation.

For example, if `app` needs `service` and `service` needs `api`, the reactor builds `api`, then `service`, then `app`. Use `-pl` and `-am` to build part of the tree, and `-T` to build independent modules in parallel.

### [intermediate] How do profiles work, and when would you avoid them? {#profile-q}

A profile is a named set of changes to the build that you can switch on.

- It can change properties, dependencies and plugin settings.
- It is active when you pass `-P`, or when a condition holds: a property, the JDK version or the operating system.
- It suits packaging and test variations.

Avoid profiles that change dependencies or behaviour for each environment. The artifact then depends on how it was built, which makes problems hard to reproduce. Prefer one artifact that the application configures at run time.

### [intermediate] What does the Spring Boot Maven plugin do? {#boot-plugin-q}

It turns the normal jar into an executable jar, and it adds goals for running and packaging the app.

- During `package`, its `repackage` goal rewrites the jar. Dependencies go into `BOOT-INF/lib`, application classes into `BOOT-INF/classes`, and a launcher class becomes the `Main-Class`. So `java -jar` works.
- `spring-boot:run` starts the app while you develop.
- `spring-boot:build-image` creates a container image with buildpacks.
- It supports layered jars, for efficient Docker layers.

### [intermediate] A service fails with `NoSuchMethodError` after you added a library. How do you investigate? {#conflict-q}

It is almost always a version conflict. Two versions of a library are on the classpath, and the one that won does not have the method.

1. Run `mvn dependency:tree -Dverbose -Dincludes=group:artifact`. It shows which paths bring which version, and which version was left out.
2. Fix it in one of three ways: declare or manage the right version, exclude the transitive one, or import the BOM that defines compatible versions.
3. Check the tree again and run the tests.

### [deep] Why can Maven builds differ between machines, and how do you make them reproducible? {#reproducible-q}

Because the inputs to the build differ. Common causes:

- a different Maven or JDK version,
- SNAPSHOT dependencies that changed,
- version ranges,
- a stale local repository,
- a different mirror,
- and profiles switched on by the environment.

To make builds reproducible:

1. Use the **Maven Wrapper** to fix the Maven version.
2. Pin the JDK, with toolchains or a fixed CI image.
3. Use fixed release versions or a managed BOM.
4. Add the enforcer plugin with `requireJavaVersion`, `dependencyConvergence` and `banDuplicatePomDependencyVersions`.
5. Set `project.build.outputTimestamp` to get byte-identical jars.
6. Build in a clean CI workspace.

### [deep] What is the difference between Surefire and Failsafe? {#surefire-q}

Surefire runs unit tests. Failsafe runs integration tests.

- **Surefire** runs in the `test` phase. It picks up classes named `*Test`, `Test*` and similar, and fails the build at once if a test fails.
- **Failsafe** picks up classes named `*IT`. It runs them in `integration-test` and checks the result in `verify`. So after a failure, the `post-integration-test` phase still runs and can stop servers or containers. Only then does the build fail.

Keeping them apart keeps the fast tests fast and the slow tests separate.

### [deep] How would you compare Maven and Gradle for a new Spring Boot project? {#vs-gradle-q}

Both work well. Pick the one the team knows, and check the real build time.

- Spring Boot fully supports both.
- **Maven** has a uniform, declarative model. There is little to learn, and builds look almost the same in every project.
- **Gradle** has a programmable task graph, incremental builds, a build cache and a daemon. These pay off in large multi-module projects and on repeated builds.

Do not mix both in one project. See [Gradle](lesson:gradle).

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

How to explain it:

- The versions come from the parent.
- The JDBC driver has `runtime` scope, because the code does not compile against it.
- The test starter has `test` scope.
- The Boot plugin makes `mvn package` produce a jar you can run.

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

How to explain it:

- The BOM import fixes the version wherever Jackson appears in the tree.
- The exclusion removes one transitive artifact from one dependency.
- Check both with `mvn dependency:tree`.
