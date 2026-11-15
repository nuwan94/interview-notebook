// Frame data for the "Maven" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

const PHASES = (tones, badges = {}) => [
  b('c', 'compile', ['compiler:compile'], tones[0], badges.c),
  b('t', 'test', ['surefire:test'], tones[1], badges.t),
  b('p', 'package', ['jar:jar'], tones[2], badges.p),
  b('v', 'verify', ['failsafe, checks'], tones[3], badges.v),
  b('i', 'install', ['copy to ~/.m2'], tones[4], badges.i),
  b('y', 'deploy', ['upload to Nexus'], tones[5], badges.y),
];
const CHAIN = (tones) => [d('compile', 'test', '', tones[0]), d('test', 'package', '', tones[1]), d('package', 'verify', '', tones[2]), d('verify', 'install', '', tones[3]), d('install', 'deploy', '', tones[4])];

export const MAVEN_SCENES = [
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    title: 'Running a phase runs every phase before it',
    frames: [
      {
        note: 'A Maven build follows a lifecycle: an ordered list of phases. The default lifecycle runs validate, compile, test, package, verify, install and deploy. A phase does no work itself. Plugin goals are bound to phases, and the goals do the work, for example compiler:compile in compile and surefire:test in test.',
        boxes: PHASES(['new', 'new', 'new', 'new', 'new', 'new']),
        deps: CHAIN(['ok', 'ok', 'ok', 'ok', 'ok']),
      },
      {
        note: 'mvn package runs compile, test and package, in that order, and stops. You ask for a phase and Maven runs everything up to and including it. The result is a jar in the target directory.',
        boxes: PHASES(['ok', 'ok', 'new', 'none', 'none', 'none'], { p: 'asked' }),
        deps: CHAIN(['ok', 'ok', 'none', 'none', 'none']),
      },
      {
        note: 'mvn test stops after test. A failing test therefore stops the build before any jar exists, which is what you want in continuous integration. mvn -DskipTests still compiles the tests but does not run them; -Dmaven.test.skip=true does not even compile them.',
        boxes: PHASES(['ok', 'new', 'none', 'none', 'none', 'none'], { t: 'asked' }),
        deps: CHAIN(['ok', 'none', 'none', 'none', 'none']),
      },
      {
        note: 'mvn clean install runs the separate clean lifecycle first, which deletes target, then goes up to install. Install copies the jar into your local repository in ~/.m2, so other projects on your machine can depend on it. Nothing leaves your computer yet.',
        boxes: PHASES(['ok', 'ok', 'ok', 'ok', 'new', 'none'], { i: 'asked' }),
        deps: CHAIN(['ok', 'ok', 'ok', 'ok', 'none']),
      },
      {
        note: 'mvn deploy goes all the way and uploads the artifact to a remote repository such as Nexus or Artifactory, where teammates and other builds can download it. Releases are normally deployed by the continuous integration server, not by a developer laptop.',
        boxes: PHASES(['ok', 'ok', 'ok', 'ok', 'ok', 'new'], { y: 'asked' }),
        deps: CHAIN(['ok', 'ok', 'ok', 'ok', 'ok']),
      },
    ],
  },
  {
    id: 'dependencies',
    label: 'Dependencies',
    title: 'Maven finds every jar your code needs',
    frames: [
      {
        note: 'The pom.xml declares dependencies by coordinates: groupId, artifactId and version, for example org.springframework.boot : spring-boot-starter-web : 3.3.0. The scope says where it is needed: compile (default), provided, runtime or test.',
        boxes: [b('p', 'pom.xml', ['spring-boot-starter-web 3.3.0'], 'new'), b('l', 'Local repository', ['~/.m2/repository'], 'none')],
        deps: [d('pom.xml', 'Local repository', 'look here first', 'ok')],
      },
      {
        note: 'If the jar is not in the local repository, Maven downloads it from a remote repository and keeps a copy. Companies usually point all builds at one mirror (Nexus or Artifactory) that proxies Maven Central. The second build on a machine does not need the network.',
        boxes: [b('p', 'pom.xml', ['spring-boot-starter-web 3.3.0'], 'none'), b('l', 'Local repository', ['~/.m2/repository'], 'new'), b('r', 'Remote repository', ['company Nexus, then Maven Central'], 'ok')],
        deps: [d('pom.xml', 'Local repository', 'miss', 'warn'), d('Local repository', 'Remote repository', 'download and cache', 'ok')],
      },
      {
        note: "Dependencies bring their own dependencies. The starter pulls in Spring MVC, Jackson and an embedded Tomcat, and those pull in more. Maven reads each jar's pom and builds the whole tree. These are transitive dependencies. Run mvn dependency:tree to see them.",
        boxes: [b('p', 'pom.xml', ['declares one starter'], 'none'), b('s', 'spring-boot-starter-web', ['direct'], 'ok'), b('t', 'Transitive jars', ['spring-webmvc, jackson, tomcat-embed'], 'new')],
        deps: [d('pom.xml', 'spring-boot-starter-web', 'declares', 'ok'), d('spring-boot-starter-web', 'Transitive jars', 'brings', 'new')],
      },
      {
        note: "Two paths can ask for different versions of the same library. Maven's rule is nearest wins: the version closest to your project in the tree is used, and the first declared wins a tie. Here Jackson 2.17 is two steps away and 2.12 is three, so 2.12 is omitted. The rule picks by position, not by the newest version.",
        boxes: [b('a', 'Your application', [], 'none'), b('x', 'Library A', [], 'none'), b('y', 'Library B', [], 'none'), b('z', 'Library C', [], 'none'), b('n', 'Jackson 2.17', ['nearest, chosen'], 'ok'), b('o', 'Jackson 2.12', ['farther, omitted'], 'bad')],
        deps: [d('Your application', 'Library A', '', 'none'), d('Your application', 'Library B', '', 'none'), d('Library A', 'Jackson 2.17', 'depth 2', 'ok'), d('Library B', 'Library C', '', 'none'), d('Library C', 'Jackson 2.12', 'depth 3', 'bad')],
      },
      {
        note: 'Do not leave versions to chance. dependencyManagement pins a version for every artifact that appears anywhere in the tree. Spring Boot publishes a BOM (bill of materials), spring-boot-dependencies, that lists tested versions of hundreds of libraries, so you usually omit the version in your own dependencies.',
        boxes: [b('p', 'pom.xml', ['no version on jackson'], 'new'), b('m', 'Spring Boot BOM', ['dependencyManagement'], 'ok'), b('j', 'Jackson 2.17', ['one version everywhere'], 'ok')],
        deps: [d('pom.xml', 'Spring Boot BOM', 'imports', 'ok'), d('Spring Boot BOM', 'Jackson 2.17', 'pins', 'ok')],
      },
    ],
  },
  {
    id: 'reactor',
    label: 'Multi-module',
    title: 'The reactor builds modules in dependency order',
    frames: [
      {
        note: 'A multi-module project has a parent pom with packaging pom that lists its modules. The parent holds shared configuration: Java version, dependencyManagement, plugin settings. Each module has its own pom and inherits from the parent.',
        boxes: [b('p', 'Parent pom', ['packaging pom', 'shared versions'], 'new'), b('a', 'api module', ['DTOs'], 'none'), b('s', 'service module', ['business logic'], 'none'), b('w', 'app module', ['Spring Boot main'], 'none')],
        deps: [d('Parent pom', 'api module', 'module', 'ok'), d('Parent pom', 'service module', 'module', 'ok'), d('Parent pom', 'app module', 'module', 'ok')],
      },
      {
        note: "The order of the modules list does not decide the build order. Maven's reactor reads the dependencies between modules and sorts them: app needs service, and service needs api, so api builds first, then service, then app.",
        boxes: [b('a', 'api module', ['built first'], 'ok', '1'), b('s', 'service module', ['needs api'], 'ok', '2'), b('w', 'app module', ['needs service'], 'ok', '3')],
        deps: [d('app module', 'service module', 'depends on', 'ok'), d('service module', 'api module', 'depends on', 'ok')],
      },
      {
        note: 'You rarely need the whole tree. mvn -pl app -am package builds only the app module (-pl, projects list) and the modules it needs (-am, also make). In a large repository this saves minutes on every run.',
        boxes: [b('a', 'api module', ['also made'], 'ok'), b('s', 'service module', ['also made'], 'ok'), b('w', 'app module', ['asked with -pl'], 'new'), b('o', 'other modules', ['skipped'], 'none')],
        deps: [d('app module', 'service module', '', 'ok'), d('service module', 'api module', '', 'ok')],
      },
      {
        note: 'If one module fails, the reactor stops and the modules after it show SKIPPED. Use --fail-at-end to continue with modules that do not depend on the failed one, or --fail-never to ignore failures. In continuous integration, the default of failing fast is usually right.',
        boxes: [b('a', 'api module', ['SUCCESS'], 'ok'), b('s', 'service module', ['FAILURE: a test failed'], 'bad'), b('w', 'app module', ['SKIPPED'], 'warn')],
        deps: [d('app module', 'service module', 'depends on', 'warn'), d('service module', 'api module', 'depends on', 'ok')],
      },
    ],
  },
];
