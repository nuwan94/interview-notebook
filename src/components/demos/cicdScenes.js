// Frame data for the "CI/CD fundamentals" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const CICD_SCENES = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    title: 'From a commit to production',
    frames: [
      {
        note: 'A developer pushes a commit. The pipeline is started by that event, not by a person, and runs the same steps for every change. The first stage compiles the code and runs the fast unit tests.',
        boxes: [b('d', 'Developer', ['git push'], 'none'), b('p', 'Pipeline', ['starts on every commit'], 'new'), b('b', 'Build', ['compile, unit tests'], 'ok')],
        deps: [d('Developer', 'Pipeline', 'triggers', 'ok'), d('Pipeline', 'Build', 'runs', 'ok')],
      },
      {
        note: 'Quality gates check the result: test coverage, static analysis, a scan of the libraries and of the image. If every gate passes, the pipeline packages one artifact, here the image app:1.4.2. It is built once and never rebuilt for another environment.',
        boxes: [b('b', 'Build', ['unit tests pass'], 'ok'), b('g', 'Quality gate', ['coverage, scans'], 'warn'), b('a', 'Artifact', ['app:1.4.2 image'], 'ok')],
        deps: [d('Build', 'Quality gate', 'checks', 'ok'), d('Quality gate', 'Artifact', 'if all pass', 'ok')],
      },
      {
        note: 'The artifact is stored in a registry and then promoted through the environments. The same image goes to the test environment, where integration tests run, and then, after an approval where the process needs one, to production. Only the configuration differs.',
        boxes: [b('r', 'Registry', ['app:1.4.2, built once'], 'new'), b('t', 'Test env', ['integration tests'], 'none'), b('a', 'Approval', ['a person signs off'], 'warn'), b('p', 'Production', ['the same image'], 'ok')],
        deps: [d('Registry', 'Test env', 'deploy', 'ok'), d('Test env', 'Approval', 'passed', 'ok'), d('Approval', 'Production', 'promote', 'ok')],
      },
      {
        note: 'The pipeline does not end at the deployment. A smoke test checks that the new version answers, and monitoring watches errors and latency. If they get worse, the previous version is restored, which is why every release must be easy to roll back.',
        boxes: [b('p', 'Production', ['version 1.4.2'], 'ok'), b('s', 'Smoke test', ['health check'], 'new'), b('m', 'Monitoring', ['errors, latency'], 'ok'), b('r', 'Rollback', ['previous version'], 'warn')],
        deps: [d('Production', 'Smoke test', 'verify', 'ok'), d('Production', 'Monitoring', 'watch', 'ok'), d('Monitoring', 'Rollback', 'if it degrades', 'warn')],
      },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery or deployment',
    title: 'Three levels of automation',
    frames: [
      {
        note: 'Continuous integration is the base: everyone merges small changes into the main branch often, and every merge is built and tested automatically. The result is a main branch that is always green and ready to be released.',
        boxes: [b('c', 'Commit', ['merged to main'], 'none'), b('t', 'Build and test', ['automatic, every time'], 'ok'), b('r', 'Release candidate', ['main is always green'], 'ok')],
        deps: [d('Commit', 'Build and test', 'triggers', 'ok'), d('Build and test', 'Release candidate', 'produces', 'ok')],
      },
      {
        note: 'Continuous delivery adds an automated path to production. Every release candidate is ready to go live, but a person decides when. A bank often stops here, because a change approval or a release window is required.',
        boxes: [b('r', 'Release candidate', ['tested, packaged'], 'ok'), b('a', 'Approval', ['a person decides'], 'warn'), b('p', 'Production', ['one click, same steps'], 'ok')],
        deps: [d('Release candidate', 'Approval', 'waits for', 'warn'), d('Approval', 'Production', 'deploys', 'ok')],
      },
      {
        note: 'Continuous deployment removes the human step: every change that passes all the checks goes to production automatically. It needs strong automated tests, feature flags and fast rollback, and it is rare in regulated systems.',
        boxes: [b('r', 'Release candidate', ['passed everything'], 'ok'), b('c', 'Automated checks', ['tests, canary, metrics'], 'new'), b('p', 'Production', ['no human step'], 'ok')],
        deps: [d('Release candidate', 'Automated checks', 'runs', 'ok'), d('Automated checks', 'Production', 'if healthy', 'ok')],
      },
    ],
  },
  {
    id: 'branching',
    label: 'Branching',
    title: 'Short branches keep integration cheap',
    frames: [
      {
        note: 'A branch that lives for weeks drifts away from main. Everyone else keeps changing the same files, so the final merge is large, full of conflicts and risky, and nobody knows whether the combination works until the end. This is what continuous integration tries to avoid.',
        boxes: [b('m', 'main', ['changes every day'], 'none'), b('f', 'Feature branch', ['open for 3 weeks'], 'warn'), b('x', 'Big merge', ['many conflicts'], 'bad')],
        deps: [d('main', 'Big merge', 'meets', 'bad'), d('Feature branch', 'Big merge', 'meets', 'bad')],
      },
      {
        note: 'In trunk-based development a branch lives for hours or a day. It becomes a pull request that is reviewed and checked by the pipeline, then merged into main. Small changes are easy to review, easy to merge and easy to revert.',
        boxes: [b('s', 'Short branch', ['merged within a day'], 'ok'), b('p', 'Pull request', ['review + pipeline'], 'new'), b('m', 'main', ['always releasable'], 'ok')],
        deps: [d('Short branch', 'Pull request', 'opens', 'ok'), d('Pull request', 'main', 'merges', 'ok')],
      },
      {
        note: 'A feature that takes weeks does not need a long branch. Merge it in small pieces behind a feature flag that is off in production. The code is integrated and deployed every day, and the flag decides when users see it.',
        boxes: [b('u', 'Unfinished code', ['merged in small pieces'], 'warn'), b('f', 'Feature flag', ['off in production'], 'new'), b('m', 'main', ['deployed daily'], 'ok')],
        deps: [d('Unfinished code', 'main', 'merged', 'ok'), d('Feature flag', 'Unfinished code', 'hides', 'warn')],
      },
    ],
  },
  {
    id: 'gates',
    label: 'Quality gates',
    title: 'Each gate can stop the pipeline',
    frames: [
      {
        note: 'A pipeline is a series of gates. Unit tests run first because they are fastest, then static analysis for bugs and code smells, then a scan of the third-party libraries. A change goes forward only while every gate passes.',
        boxes: [b('u', 'Unit tests', ['all green'], 'ok'), b('s', 'Static analysis', ['no new issues'], 'ok'), b('d', 'Dependency scan', ['checking libraries'], 'new')],
        deps: [d('Unit tests', 'Static analysis', 'then', 'ok'), d('Static analysis', 'Dependency scan', 'then', 'ok')],
      },
      {
        note: 'The scan finds a library with a critical known vulnerability. The gate fails, the pipeline stops, nothing is published and nothing is deployed. The developer gets the report immediately, while the change is still fresh in mind.',
        boxes: [b('d', 'Dependency scan', ['critical CVE found'], 'bad'), b('p', 'Pipeline', ['stops here'], 'bad'), b('v', 'Developer', ['gets the report'], 'warn')],
        deps: [d('Dependency scan', 'Pipeline', 'fails', 'bad'), d('Pipeline', 'Developer', 'notifies', 'warn')],
      },
      {
        note: 'The developer upgrades the library and pushes again. The pipeline runs from the start, every gate now passes, and the artifact is published. A failing pipeline is a normal, cheap event, and fixing it first is the team rule.',
        boxes: [b('v', 'Developer', ['upgrades the library'], 'new'), b('p', 'Pipeline', ['runs again, all green'], 'ok'), b('a', 'Artifact', ['safe to publish'], 'ok')],
        deps: [d('Developer', 'Pipeline', 'pushes', 'ok'), d('Pipeline', 'Artifact', 'publishes', 'ok')],
      },
    ],
  },
];
