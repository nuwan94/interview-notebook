// Frame data for the Gradle walk-through. Every scene brings its own picture (a custom stage).

import { GradlePhaseStage } from './GradlePhaseStage.jsx';
import { UpToDateStage } from './UpToDateStage.jsx';
import { ClasspathStage } from './ClasspathStage.jsx';

// ---- phases scene ----
const task = (tone, state, badge) => ({ tone, state, badge });
const ALL_NEW = {
  compileJava: task('new'),
  processResources: task('new'),
  classes: task('new'),
  test: task('new'),
  jar: task('new'),
};
const TEST_RUN = {
  compileJava: task('ok', undefined, 'ran 1st'),
  processResources: task('ok', undefined, 'ran 1st'),
  classes: task('ok', undefined, 'ran 2nd'),
  test: task('new', 'focus', 'asked'),
  jar: task('none', 'dim', 'not needed'),
};
const DAEMON = { sub: 'starts once, then reused', tone: 'none' };
const NO_CACHE = { sub: 'empty on a first build', tone: 'none', state: 'dim' };

// ---- up-to-date scene ----
const IN_1 = [
  { name: 'Account.java', hash: 'a1f3' },
  { name: 'Payment.java', hash: '7c2e' },
  { name: 'classpath', hash: 'e81b' },
  { name: 'options', hash: '12d0' },
];
const tone = (list, t) => list.map((x) => ({ ...x, tone: t }));
const OUT = [{ name: 'Account.class' }, { name: 'Payment.class' }];
const CACHE_IDLE = { key: 'key 5b9a → class files', by: 'Stores outputs by input hash.', tone: 'none', state: 'dim' };

export const GRADLE_SCENES = [
  {
    id: 'phases',
    label: 'Build phases',
    title: 'Initialise, configure, then execute',
    stage: GradlePhaseStage, // drawn by GradlePhaseStage: the three phases, settings and the task graph
    frames: [
      {
        line: './gradlew test',
        phases: ['active', 'todo', 'todo'],
        settings: 'focus',
        graph: null,
        daemon: DAEMON,
        cache: NO_CACHE,
        note: 'Every Gradle build has three phases. The first is initialization. Gradle reads settings.gradle.kts to learn which projects are in the build, for example include("api", "app"). Nothing is compiled yet.',
      },
      {
        line: './gradlew test',
        phases: ['done', 'active', 'todo'],
        graph: ALL_NEW,
        daemon: DAEMON,
        cache: NO_CACHE,
        result: { text: 'task graph built, no task run', tone: 'new' },
        note: 'The second phase is configuration. Gradle runs every build script from top to bottom. The scripts register tasks and say which task needs which, and Gradle builds a graph of tasks. No task does its work yet. This phase runs on every build, so it must be cheap.',
      },
      {
        line: './gradlew test',
        phases: ['done', 'done', 'active'],
        graph: TEST_RUN,
        daemon: DAEMON,
        cache: NO_CACHE,
        result: { text: 'jar did not run', tone: 'ok' },
        note: 'The third phase is execution. Gradle runs only the task you asked for and the tasks it needs, in order. For test, that is compileJava and processResources, then classes, then test. The jar task is not needed for test, so it does not run.',
      },
      {
        line: './gradlew test (again)',
        phases: ['done', 'skipped', 'active'],
        graph: TEST_RUN,
        daemon: { sub: 'already running: no start-up', tone: 'ok', state: 'focus' },
        cache: { sub: 'reuses the saved graph', tone: 'ok', state: 'focus' },
        result: { text: 'configuration skipped', tone: 'ok' },
        note: 'The Gradle daemon is a background JVM that stays running between builds. It keeps the build logic and caches in memory, so the next build starts fast. The configuration cache saves the task graph, so a repeated build can skip the configuration phase completely.',
      },
    ],
  },
  {
    id: 'incremental',
    label: 'Up-to-date checks',
    title: 'Gradle skips work whose inputs have not changed',
    stage: UpToDateStage, // drawn by UpToDateStage: inputs with hashes, the task, outputs, saved hashes and cache
    frames: [
      {
        line: 'compileJava: declared inputs and outputs',
        inputs: tone(IN_1, 'none'),
        outputs: tone(OUT, 'none'),
        outputsState: 'dim',
        compile: { outcome: 'not run yet', tone: 'new' },
        test: null,
        record: null,
        cache: CACHE_IDLE,
        note: 'A task declares its inputs and outputs. The inputs of compileJava are the source files, the classpath and the compiler options. Its outputs are the class files. Gradle takes a hash (a short fingerprint) of each one, so later it can tell whether anything changed.',
      },
      {
        line: './gradlew build (first time)',
        inputs: tone(IN_1, 'new'),
        outputs: tone(OUT, 'ok'),
        compile: { outcome: 'EXECUTED', tone: 'ok' },
        test: null,
        record: { inputs: 'a1f3 7c2e e81b 12d0', outputs: '3b07 c9d1', tone: 'new', state: 'focus' },
        cache: CACHE_IDLE,
        result: { text: 'ran, then saved the hashes', tone: 'ok' },
        note: 'On the first build there is no record of an earlier run. So the task runs, and Gradle saves the hashes of its inputs and outputs.',
      },
      {
        line: './gradlew build (nothing changed)',
        inputs: tone(IN_1, 'ok'),
        outputs: tone(OUT, 'ok'),
        compile: { outcome: 'UP-TO-DATE', tone: 'warn' },
        test: null,
        record: { inputs: 'a1f3 7c2e e81b 12d0', outputs: '3b07 c9d1', tone: 'ok', state: 'focus' },
        cache: CACHE_IDLE,
        result: { text: 'same hashes: task skipped', tone: 'warn' },
        note: 'On the second build nothing has changed. The hashes match the saved ones, so the task is marked UP-TO-DATE and does no work. This is why a build with no changes takes seconds, even in a large project.',
      },
      {
        line: 'edit Payment.java, then ./gradlew build',
        inputs: [IN_1[0], { ...IN_1[1], hash: '9d40' }, IN_1[2], IN_1[3]].map((x, i) => ({ ...x, tone: i === 1 ? 'new' : 'none' })),
        outputs: [
          { name: 'Account.class', tone: 'none' },
          { name: 'Payment.class', tone: 'new' },
        ],
        compile: { outcome: 'EXECUTED', tone: 'ok' },
        test: { outcome: 'EXECUTED', tone: 'ok' },
        record: { inputs: 'a1f3 9d40 e81b 12d0', outputs: '3b07 4e2a', tone: 'ok' },
        cache: CACHE_IDLE,
        result: { text: 'one hash changed: the task runs', tone: 'ok' },
        note: 'You edit one class, so its hash changes and compileJava runs again. It compiles incrementally: only the changed class and the classes that depend on it. The test task now sees different class files, so it runs too. Tasks whose inputs did not change are still skipped.',
      },
      {
        line: './gradlew build --build-cache (fresh checkout)',
        inputs: tone(IN_1, 'none'),
        outputs: tone(OUT, 'ok'),
        compile: { outcome: 'FROM-CACHE', tone: 'ok' },
        test: null,
        record: null,
        recordEmpty: 'New checkout: no saved hashes here.',
        cache: { key: 'key 5b9a → class files', by: 'Filled earlier by the CI server.', tone: 'ok', state: 'focus' },
        cacheHit: true,
        result: { text: 'outputs copied, nothing compiled', tone: 'ok' },
        note: 'The build cache goes further than your own last run. Gradle stores task outputs under a key made from the input hashes, on your machine or on a shared server. If CI already built the same inputs, the task shows FROM-CACHE, and its outputs are copied instead of rebuilt. The same happens when you switch back to a branch you built before.',
      },
    ],
  },
  {
    id: 'configurations',
    label: 'Configurations',
    title: 'api shares a dependency, implementation hides it',
    stage: ClasspathStage, // drawn by ClasspathStage: the classpaths each configuration fills
    frames: [
      {
        mode: 'modules',
        line: 'service: implementation(jackson)',
        decl: 'implementation(jackson)',
        why: 'Jackson is used only inside the service.',
        exposed: false,
        result: { text: 'app cannot compile against Jackson', tone: 'bad' },
        note: 'Gradle puts dependencies into groups called configurations. With implementation, the service module uses Jackson only inside itself. Jackson is on the service classpaths, but not on the compile classpath of the app module. So the app cannot use Jackson classes through the service by accident. Jackson still ships with the app at run time.',
      },
      {
        mode: 'modules',
        line: 'service: api(jackson)',
        decl: 'api(jackson)',
        why: 'A public method returns a Jackson type.',
        exposed: true,
        result: { text: 'app compiles against Jackson too', tone: 'new' },
        note: 'With api (from the java-library plugin), the dependency is part of the module\'s public API. The service shows Jackson types in its method signatures, so the app needs Jackson to compile too. The cost: when Jackson changes, the app is recompiled as well.',
      },
      {
        mode: 'classpaths',
        line: 'one module, three classpaths',
        cols: [
          [
            { name: 'jackson', config: 'implementation', tone: 'none' },
            { name: 'lombok', config: 'compileOnly', tone: 'warn', state: 'focus' },
          ],
          [
            { name: 'jackson', config: 'implementation', tone: 'none' },
            { name: 'postgresql', config: 'runtimeOnly', tone: 'ok', state: 'focus' },
          ],
          [{ name: 'junit', config: 'testImplementation', tone: 'new', state: 'focus' }],
        ],
        result: { text: 'pick the narrowest configuration', tone: 'new' },
        note: 'Other configurations choose the classpath. compileOnly is needed to compile but is not shipped, for example Lombok. runtimeOnly is shipped but is not needed to compile, for example a JDBC driver. testImplementation is only for tests, for example JUnit. The narrowest choice keeps jars small and builds fast.',
      },
      {
        mode: 'catalog',
        line: 'gradle/libs.versions.toml',
        result: { text: 'one edit upgrades every module', tone: 'ok' },
        note: 'A version catalog, gradle/libs.versions.toml, lists the library versions in one file. Every module refers to a library by name, such as libs.jackson.databind. So one edit upgrades the whole build, and modules cannot drift apart.',
      },
    ],
  },
];
