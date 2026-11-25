// Frame data for the Maven walk-through. Every scene brings its own picture (a custom stage).

import { LifecycleStage } from './LifecycleStage.jsx';
import { DepTreeStage } from './DepTreeStage.jsx';
import { ReactorStage } from './ReactorStage.jsx';

// ---- dependencies scene: nodes of the dependency tree (d = depth column, row = position in the column) ----
const n = (id, name, sub, d, row, tone = 'none', state, badge) => ({ id, name, sub, d, row, tone, state, badge });
const APP = n('app', 'your app', 'pom.xml', 0, 0);
const STARTER = n('starter', 'starter-web', '3.3.0, declared', 1, 0, 'new', 'focus');
const DIM_REPOS = {
  local: { sub: 'has the jars now', tone: 'ok', state: 'dim' },
  nexus: { sub: 'company mirror', tone: 'none', state: 'dim' },
  central: { sub: 'public source', tone: 'none', state: 'dim' },
};

export const MAVEN_SCENES = [
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    title: 'Running a phase runs every phase before it',
    stage: LifecycleStage, // drawn by LifecycleStage: the phases in order, their goals and where the jar goes
    frames: [
      {
        line: 'the default lifecycle',
        upTo: -1,
        clean: false,
        note: 'A Maven build follows a lifecycle. A lifecycle is a fixed list of steps called phases. A phase does no work by itself. A plugin goal is attached to each phase and does the work. For example, compiler:compile does the work of the compile phase.',
      },
      {
        line: 'mvn package',
        upTo: 3,
        clean: false,
        result: { text: 'jar in target/', tone: 'ok' },
        note: 'You ask for one phase, and Maven runs every phase up to it, in order. So mvn package runs validate, compile, test and package, then stops. The jar is now in the target folder.',
      },
      {
        line: 'mvn test',
        upTo: 2,
        clean: false,
        result: { text: 'stops after test: no jar yet', tone: 'warn' },
        note: 'mvn test stops after the test phase. So a failing test stops the build before any jar exists, which is what you want in CI. The flag -DskipTests still compiles the tests but does not run them. The flag -Dmaven.test.skip=true does not even compile them.',
      },
      {
        line: 'mvn clean install',
        upTo: 5,
        clean: true,
        result: { text: 'jar copied to ~/.m2', tone: 'ok' },
        note: 'clean is a separate lifecycle. It runs first and deletes the target folder. Then Maven runs the default lifecycle up to install. Install copies the jar into your local repository, ~/.m2, so other projects on your machine can use it. Nothing has left your computer yet.',
      },
      {
        line: 'mvn deploy',
        upTo: 6,
        clean: false,
        result: { text: 'uploaded to Nexus', tone: 'ok' },
        note: 'mvn deploy runs every phase and then uploads the jar to a remote repository, such as Nexus or Artifactory. Teammates and other builds can now download it. Releases are usually deployed by the CI server, not from a developer laptop.',
      },
    ],
  },
  {
    id: 'dependencies',
    label: 'Dependencies',
    title: 'Maven finds every jar your code needs',
    stage: DepTreeStage, // drawn by DepTreeStage: the dependency tree by depth, and the repositories below it
    frames: [
      {
        line: 'org.springframework.boot : spring-boot-starter-web : 3.3.0',
        nodes: [APP, STARTER],
        edges: [['app', 'starter', 'new']],
        lookup: true,
        repos: {
          local: { sub: 'checked first', tone: 'new', state: 'focus' },
          nexus: { sub: 'company mirror', tone: 'none' },
          central: { sub: 'public source', tone: 'none' },
        },
        note: 'The pom.xml names each dependency by its coordinates: groupId, artifactId and version. The scope says where it is needed: compile (the default), provided, runtime or test. To find the jar, Maven looks in your local repository, ~/.m2, first.',
      },
      {
        line: 'mvn package (first build on this machine)',
        nodes: [APP, STARTER],
        edges: [['app', 'starter', 'new']],
        lookup: true,
        ask: true,
        repos: {
          local: { sub: 'miss: not here', tone: 'bad', state: 'focus' },
          nexus: { sub: 'proxy: has it', tone: 'ok', state: 'focus' },
          central: { sub: 'public source', tone: 'none' },
        },
        result: { text: 'downloaded once, then kept in ~/.m2', tone: 'ok' },
        note: 'The jar is not in the local repository yet, so Maven downloads it from a remote repository and keeps a copy. Companies point every build at one mirror, such as Nexus or Artifactory, which stands in for Maven Central. The next build on this machine does not need the network.',
      },
      {
        line: 'mvn dependency:tree',
        nodes: [
          APP,
          n('starter', 'starter-web', '3.3.0, declared', 1, 0, 'ok'),
          n('mvc', 'spring-webmvc', 'transitive', 2, 0, 'new'),
          n('jackson', 'jackson', 'transitive', 2, 1, 'new'),
          n('tomcat', 'tomcat-embed', 'transitive', 2, 2, 'new'),
          n('core', 'spring-core', 'transitive', 3, 0, 'new'),
          n('jcore', 'jackson-core', 'transitive', 3, 1, 'new'),
        ],
        edges: [['app', 'starter', 'ok'], ['starter', 'mvc', 'new'], ['starter', 'jackson', 'new'], ['starter', 'tomcat', 'new'], ['mvc', 'core', 'new'], ['jackson', 'jcore', 'new']],
        repos: DIM_REPOS,
        result: { text: 'you declared 1, you get 6', tone: 'new' },
        note: 'Dependencies bring their own dependencies. The starter brings Spring MVC, Jackson and an embedded Tomcat, and those bring more. These are called transitive dependencies. Maven reads the pom of each jar and builds the whole tree. Run mvn dependency:tree to see it.',
      },
      {
        line: 'two paths ask for different Jackson versions',
        nodes: [
          n('app', 'your app', 'pom.xml', 0, 1),
          n('a', 'Library A', 'direct', 1, 0),
          n('b', 'Library B', 'direct', 1, 2),
          n('j17', 'jackson', '2.17, depth 2', 2, 0, 'ok', 'focus', 'chosen'),
          n('c', 'Library C', 'transitive', 2, 2),
          n('j12', 'jackson', '2.12, depth 3', 3, 2, 'bad', 'focus', 'omitted'),
        ],
        edges: [['app', 'a'], ['app', 'b'], ['a', 'j17', 'ok'], ['b', 'c'], ['c', 'j12', 'bad']],
        repos: DIM_REPOS,
        result: { text: 'nearest wins: depth 2 beats depth 3', tone: 'ok' },
        note: 'Two paths ask for different versions of Jackson. Maven keeps only one, and its rule is "nearest wins": the version closest to your project is used. If two are equally close, the one declared first wins. Here 2.17 is at depth 2 and 2.12 is at depth 3, so 2.12 is left out. The rule looks at position, not at which version is newer.',
      },
      {
        line: '<scope>import</scope> spring-boot-dependencies',
        nodes: [
          n('app', 'your app', 'imports the BOM', 0, 1, 'new', 'focus'),
          n('a', 'Library A', 'direct', 1, 0),
          n('b', 'Library B', 'direct', 1, 2),
          n('j17', 'jackson', '2.17.1, managed', 2, 0, 'ok', undefined, 'BOM'),
          n('c', 'Library C', 'transitive', 2, 2),
          n('j12', 'jackson', '2.17.1, managed', 3, 2, 'ok', undefined, 'BOM'),
        ],
        edges: [['app', 'a'], ['app', 'b'], ['a', 'j17', 'ok'], ['b', 'c'], ['c', 'j12', 'ok']],
        managed: [
          { name: 'jackson', sub: '2.17.1 everywhere' },
          { name: 'tomcat-embed', sub: 'version set too' },
          { name: '+ hundreds more', sub: 'tested together' },
        ],
        result: { text: 'one version everywhere', tone: 'ok' },
        note: 'Do not leave versions to chance. dependencyManagement sets one version for a library wherever it appears in the tree. Spring Boot publishes a BOM (bill of materials), spring-boot-dependencies, that lists tested versions of hundreds of libraries. So you usually leave the version out of your own dependencies.',
      },
    ],
  },
  {
    id: 'reactor',
    label: 'Multi-module',
    title: 'The reactor builds modules in dependency order',
    stage: ReactorStage, // drawn by ReactorStage: the parent pom and the modules in build order
    frames: [
      {
        line: 'parent pom with <packaging>pom</packaging>',
        hl: [0, 7, 8],
        order: false,
        modules: [
          { id: 'app', slot: 0, sub: 'Spring Boot main class', tone: 'none' },
          { id: 'service', slot: 1, sub: 'business logic', tone: 'none' },
          { id: 'api', slot: 2, sub: 'DTOs', tone: 'none' },
          { id: 'reports', slot: 3, sub: 'monthly statements', tone: 'none' },
        ],
        needs: [],
        note: 'A multi-module project has a parent pom with packaging pom. It holds the shared settings, such as the Java version, dependencyManagement and plugin settings. Each module has its own pom and inherits from the parent.',
      },
      {
        line: 'mvn install',
        hl: [2, 3, 4, 5],
        order: true,
        modules: [
          { id: 'api', slot: 0, sub: 'needs nothing', tone: 'new' },
          { id: 'service', slot: 1, sub: 'needs api', tone: 'new' },
          { id: 'app', slot: 2, sub: 'needs service', tone: 'new' },
          { id: 'reports', slot: 3, sub: 'needs nothing', tone: 'none' },
        ],
        needs: [['service', 'api'], ['app', 'service']],
        result: { text: 'sorted by what each module needs', tone: 'new' },
        note: 'The order of the modules list does not decide the build order. The reactor reads which module needs which, and sorts them. app needs service, and service needs api. So api is built first, then service, then app.',
      },
      {
        line: 'mvn -pl app -am package',
        hl: [2],
        order: true,
        modules: [
          { id: 'api', slot: 0, sub: 'needed by service', tone: 'ok', status: 'also made' },
          { id: 'service', slot: 1, sub: 'needed by app', tone: 'ok', status: 'also made' },
          { id: 'app', slot: 2, sub: 'chosen with -pl', tone: 'new', state: 'focus', status: 'asked' },
          { id: 'reports', slot: 3, sub: 'not needed', tone: 'none', state: 'dim', status: 'not built' },
        ],
        needs: [['service', 'api'], ['app', 'service']],
        result: { text: '3 of 4 modules built', tone: 'ok' },
        note: 'You rarely need to build every module. -pl app (project list) picks the app module. -am (also make) adds the modules it needs. reports is not needed, so it is not built. In a large repository this saves minutes on every run.',
      },
      {
        line: 'mvn install',
        hl: [],
        order: true,
        modules: [
          { id: 'api', slot: 0, sub: 'built', tone: 'ok', status: 'SUCCESS' },
          { id: 'service', slot: 1, sub: 'a test failed', tone: 'bad', state: 'focus', status: 'FAILURE' },
          { id: 'app', slot: 2, sub: 'not started', tone: 'warn', status: 'SKIPPED' },
          { id: 'reports', slot: 3, sub: 'not started', tone: 'warn', status: 'SKIPPED' },
        ],
        needs: [['service', 'api'], ['app', 'service']],
        result: { text: 'the build stops at the first failure', tone: 'bad' },
        note: 'When one module fails, the reactor stops. Every module after it shows SKIPPED, even reports, which does not need service. In CI this "fail fast" default is usually right.',
      },
      {
        line: 'mvn install --fail-at-end',
        hl: [],
        order: true,
        modules: [
          { id: 'api', slot: 0, sub: 'built', tone: 'ok', status: 'SUCCESS' },
          { id: 'service', slot: 1, sub: 'a test failed', tone: 'bad', status: 'FAILURE' },
          { id: 'app', slot: 2, sub: 'needs the failed module', tone: 'warn', status: 'SKIPPED' },
          { id: 'reports', slot: 3, sub: 'does not need service', tone: 'ok', state: 'focus', status: 'SUCCESS' },
        ],
        needs: [['service', 'api'], ['app', 'service']],
        result: { text: 'independent modules still build', tone: 'warn' },
        note: '--fail-at-end keeps building the modules that do not depend on the failed one, and fails the build at the end. app needs service, so it is still skipped, but reports is built. --fail-never ignores failures completely.',
      },
    ],
  },
];
