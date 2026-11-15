// Frame data for the "Gradle" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

const TASKS = (t, badges = {}) => [
  b('c', 'compileJava', ['sources to classes'], t[0], badges.c),
  b('r', 'processResources', ['copy resources'], t[1], badges.r),
  b('s', 'classes', ['lifecycle task'], t[2], badges.s),
  b('t', 'test', ['run JUnit'], t[3], badges.t),
  b('j', 'jar', ['package'], t[4], badges.j),
];
const TDEPS = (t) => [d('classes', 'compileJava', 'dependsOn', t[0]), d('classes', 'processResources', 'dependsOn', t[1]), d('test', 'classes', 'dependsOn', t[2]), d('jar', 'classes', 'dependsOn', t[3])];

export const GRADLE_SCENES = [
  {
    id: 'phases',
    label: 'Build phases',
    title: 'Initialise, configure, then execute',
    frames: [
      {
        note: 'Every Gradle build has three phases. First, initialization: Gradle reads settings.gradle.kts to learn which projects are part of the build, for example include("api", "app"). Nothing is compiled yet.',
        boxes: [b('s', 'settings.gradle.kts', ['include api and app'], 'new', '1 init'), b('a', 'Project :api', [], 'none'), b('w', 'Project :app', [], 'none')],
        deps: [d('settings.gradle.kts', 'Project :api', 'include', 'ok'), d('settings.gradle.kts', 'Project :app', 'include', 'ok')],
      },
      {
        note: "Second, configuration: Gradle runs every project's build script from top to bottom. The scripts register tasks and say how they depend on each other, and Gradle builds a directed acyclic graph of tasks. No task does its work in this phase, but this phase runs on every build, so it should be cheap.",
        boxes: TASKS(['new', 'new', 'new', 'new', 'new'], { c: '2 config' }),
        deps: TDEPS(['ok', 'ok', 'ok', 'ok']),
      },
      {
        note: 'Third, execution: Gradle runs only the tasks you asked for and the tasks they depend on, in dependency order. gradle test runs compileJava and processResources, then classes, then test. The jar task is not in the graph for this request, so it does not run.',
        boxes: TASKS(['ok', 'ok', 'ok', 'new', 'none'], { t: '3 run' }),
        deps: TDEPS(['ok', 'ok', 'ok', 'none']),
      },
      {
        note: 'The Gradle daemon is a long-lived background JVM that keeps compiled build logic and caches in memory, so later builds start fast. The configuration cache goes further: it saves the task graph, so a repeated build can skip the configuration phase entirely.',
        boxes: [b('d', 'Gradle daemon', ['warm JVM, reused'], 'ok'), b('g', 'Configuration cache', ['saved task graph'], 'new'), b('e', 'Execution', ['straight to the tasks'], 'ok')],
        deps: [d('Gradle daemon', 'Configuration cache', 'keeps', 'ok'), d('Configuration cache', 'Execution', 'skips configuration', 'ok')],
      },
    ],
  },
  {
    id: 'incremental',
    label: 'Up-to-date checks',
    title: 'Gradle skips work whose inputs have not changed',
    frames: [
      {
        note: 'A task declares its inputs and outputs. compileJava has the source files, the classpath and compiler options as inputs, and the class files as outputs. Gradle fingerprints them, so it can tell later whether anything changed.',
        boxes: [b('i', 'Source files', ['inputs: src/main/java'], 'none'), b('t', 'compileJava', ['task'], 'new'), b('o', 'Class files', ['outputs: build/classes'], 'none')],
        deps: [d('Source files', 'compileJava', 'input', 'ok'), d('compileJava', 'Class files', 'output', 'ok')],
      },
      {
        note: 'First build: there is no record of a previous run, so the task executes and Gradle stores the input and output fingerprints.',
        boxes: [b('i', 'Source files', ['hash stored'], 'none'), b('t', 'compileJava', ['EXECUTED'], 'ok', 'run'), b('o', 'Class files', ['hash stored'], 'ok')],
        deps: [d('Source files', 'compileJava', 'input', 'ok'), d('compileJava', 'Class files', 'output', 'ok')],
      },
      {
        note: 'Second build with nothing changed: the fingerprints match, so the task is marked UP-TO-DATE and does no work. This is why a no-change build of a large project takes seconds.',
        boxes: [b('i', 'Source files', ['same hash'], 'none'), b('t', 'compileJava', ['UP-TO-DATE'], 'warn', 'skipped'), b('o', 'Class files', ['same hash'], 'none')],
        deps: [d('Source files', 'compileJava', 'unchanged', 'warn'), d('compileJava', 'Class files', 'kept', 'warn')],
      },
      {
        note: 'You edit one class. The input hash changes, so compileJava runs again, and it compiles incrementally: only that class and the classes that depend on it. The test task then sees different class files and runs too. Tasks whose inputs did not change still skip.',
        boxes: [b('i', 'Source files', ['one file changed'], 'new'), b('t', 'compileJava', ['incremental compile'], 'ok', 'run'), b('o', 'Class files', ['changed'], 'ok'), b('u', 'test', ['inputs changed, runs'], 'ok', 'run')],
        deps: [d('Source files', 'compileJava', 'changed', 'new'), d('compileJava', 'Class files', '', 'ok'), d('Class files', 'test', 'input', 'ok')],
      },
      {
        note: 'The build cache goes beyond your own previous run. Gradle stores task outputs under a key made from the input hash, locally or in a shared remote cache. When you switch branches, or CI already built the same inputs, the task shows FROM-CACHE and its outputs are copied instead of rebuilt.',
        boxes: [b('t', 'compileJava', ['FROM-CACHE'], 'ok', 'cache hit'), b('k', 'Build cache', ['key = input hash'], 'new'), b('c', 'CI server', ['filled the cache'], 'none')],
        deps: [d('CI server', 'Build cache', 'stores outputs', 'ok'), d('Build cache', 'compileJava', 'copies outputs', 'ok')],
      },
    ],
  },
  {
    id: 'configurations',
    label: 'Configurations',
    title: 'api shares a dependency, implementation hides it',
    frames: [
      {
        note: "Gradle groups dependencies into configurations. With implementation, the service module uses Jackson internally. Jackson is on the service's own classpath, but it is not on the compile classpath of modules that depend on service. The app cannot import Jackson types through it by accident.",
        boxes: [b('a', 'app module', ['cannot see Jackson'], 'none'), b('s', 'service module', ['uses Jackson inside'], 'ok'), b('j', 'Jackson', ['implementation'], 'ok')],
        deps: [d('app module', 'service module', 'implementation project', 'ok'), d('service module', 'Jackson', 'implementation', 'ok')],
      },
      {
        note: "With api (from the java-library plugin), the dependency is part of the module's public API: the service exposes Jackson types in its method signatures, so the app needs Jackson to compile as well. The cost is that a Jackson change now recompiles the app too.",
        boxes: [b('a', 'app module', ['sees Jackson'], 'new'), b('s', 'service module', ['Jackson in its API'], 'ok'), b('j', 'Jackson', ['api'], 'ok')],
        deps: [d('app module', 'service module', 'implementation project', 'ok'), d('service module', 'Jackson', 'api', 'new'), d('app module', 'Jackson', 'also on compile classpath', 'new')],
      },
      {
        note: 'Other configurations pick the classpath. compileOnly is needed to compile but not shipped (Lombok). runtimeOnly is shipped but not needed to compile (a JDBC driver). testImplementation is only for tests (JUnit). Choosing the narrowest one keeps jars small and builds fast.',
        boxes: [b('l', 'Lombok', ['compileOnly'], 'warn'), b('p', 'PostgreSQL driver', ['runtimeOnly'], 'ok'), b('u', 'JUnit', ['testImplementation'], 'new'), b('c', 'Compile classpath', [], 'none'), b('r', 'Runtime classpath', [], 'none'), b('t', 'Test classpath', [], 'none')],
        deps: [d('Lombok', 'Compile classpath', '', 'warn'), d('PostgreSQL driver', 'Runtime classpath', '', 'ok'), d('JUnit', 'Test classpath', '', 'new')],
      },
      {
        note: 'A version catalog, gradle/libs.versions.toml, lists library versions in one file. Every module refers to them by name, such as libs.jackson.databind, so one edit upgrades the whole build and modules cannot drift apart.',
        boxes: [b('v', 'libs.versions.toml', ['one list of versions'], 'new'), b('a', 'app build file', ['libs.jackson.databind'], 'ok'), b('s', 'service build file', ['libs.jackson.databind'], 'ok')],
        deps: [d('app build file', 'libs.versions.toml', 'reads', 'ok'), d('service build file', 'libs.versions.toml', 'reads', 'ok')],
      },
    ],
  },
];
