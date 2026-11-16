// Frame data for the "GitLab CI/CD" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const GITLAB_SCENES = [
  {
    id: 'pipeline',
    label: 'Stages and jobs',
    title: 'From .gitlab-ci.yml to a pipeline',
    frames: [
      {
        note: 'A push or a merge request makes GitLab read .gitlab-ci.yml from the repository. The file declares stages in order, and jobs that each belong to one stage. The result is one pipeline for that commit.',
        boxes: [b('p', 'Push', ['commit or merge request'], 'none'), b('y', 'gitlab-ci.yml', ['stages and jobs'], 'new'), b('l', 'Pipeline', ['one per commit'], 'ok')],
        deps: [d('Push', 'gitlab-ci.yml', 'read', 'ok'), d('gitlab-ci.yml', 'Pipeline', 'creates', 'ok')],
      },
      {
        note: 'Stages run one after another: build, test, deploy. The jobs inside a stage run in parallel, here unit tests and a security scan at the same time. If any job in a stage fails, the next stage does not start.',
        boxes: [b('b', 'Build stage', ['compile and package'], 'ok'), b('u', 'Unit tests', ['job, runs in parallel'], 'ok'), b('s', 'Security scan', ['job, runs in parallel'], 'warn'), b('d', 'Deploy stage', ['waits for the test stage'], 'none')],
        deps: [d('Build stage', 'Unit tests', 'then', 'ok'), d('Build stage', 'Security scan', 'then', 'ok'), d('Unit tests', 'Deploy stage', 'all must pass', 'ok'), d('Security scan', 'Deploy stage', 'all must pass', 'ok')],
      },
      {
        note: 'The deploy job to production is manual and protected. A person with the right role presses the play button, and the deployment is recorded against the production environment, with a link back to the commit and the pipeline.',
        boxes: [b('t', 'Test stage', ['passed'], 'ok'), b('m', 'Manual job', ['deploy to production'], 'warn'), b('e', 'Environment', ['production, protected'], 'ok')],
        deps: [d('Test stage', 'Manual job', 'then waits', 'ok'), d('Manual job', 'Environment', 'deploys to', 'ok')],
      },
    ],
  },
  {
    id: 'runners',
    label: 'Runners',
    title: 'Where the jobs actually run',
    frames: [
      {
        note: 'GitLab itself does not run jobs. A runner is a separate program that asks GitLab for work. Shared runners serve all projects, group runners serve a group, and a project runner serves one project, for example one inside a restricted network.',
        boxes: [b('g', 'GitLab server', ['holds the pipeline'], 'new'), b('r', 'Runner', ['polls for jobs'], 'ok'), b('j', 'Job', ['script from the YAML'], 'none')],
        deps: [d('Runner', 'GitLab server', 'asks for a job', 'ok'), d('GitLab server', 'Job', 'hands over', 'ok')],
      },
      {
        note: 'The runner\'s executor decides how a job runs. With the Docker executor every job starts in a fresh container made from the image named in the job, for example maven with Java 21, and the container is removed afterwards.',
        boxes: [b('r', 'Runner', ['docker executor'], 'ok'), b('c', 'Job container', ['image: maven 3.9, JDK 21'], 'new'), b('s', 'Service container', ['postgres for the tests'], 'ok')],
        deps: [d('Runner', 'Job container', 'starts', 'ok'), d('Job container', 'Service container', 'talks to', 'ok')],
      },
      {
        note: 'On Kubernetes the runner starts each job as a pod instead, so the capacity of the cluster is shared and builds scale out. Building container images inside a pod uses a tool such as Kaniko that needs no privileged Docker daemon.',
        boxes: [b('r', 'Runner', ['kubernetes executor'], 'ok'), b('p', 'Job pod', ['one pod per job'], 'new'), b('k', 'Kaniko', ['builds the image, no Docker daemon'], 'ok')],
        deps: [d('Runner', 'Job pod', 'creates', 'ok'), d('Job pod', 'Kaniko', 'runs', 'ok')],
      },
    ],
  },
  {
    id: 'artifacts',
    label: 'Artifacts and cache',
    title: 'Passing files and saving time',
    frames: [
      {
        note: 'Every job starts clean, so files do not carry over by themselves. The build job lists its JAR under artifacts. GitLab uploads it, and later jobs of the same pipeline download it automatically. This is how the same file reaches test and deploy.',
        boxes: [b('b', 'Build job', ['produces app.jar'], 'ok'), b('a', 'Artifact', ['app.jar, kept for 1 week'], 'new'), b('t', 'Test job', ['downloads it'], 'ok')],
        deps: [d('Build job', 'Artifact', 'uploads', 'ok'), d('Artifact', 'Test job', 'downloads', 'ok')],
      },
      {
        note: 'A cache is different. It stores things that speed up later pipelines, such as the Maven repository, keyed by a hash of pom.xml. It is best effort: a job must still work when the cache is empty. Artifacts are results, a cache is only a shortcut.',
        boxes: [b('j', 'Build job', ['needs dependencies'], 'ok'), b('c', 'Cache', ['.m2, key from pom.xml'], 'new'), b('m', 'Maven Central', ['only on a cache miss'], 'none')],
        deps: [d('Build job', 'Cache', 'restores', 'ok'), d('Build job', 'Maven Central', 'if missing', 'warn')],
      },
    ],
  },
  {
    id: 'rules',
    label: 'Rules and merge requests',
    title: 'Different pipelines for different events',
    frames: [
      {
        note: 'Rules decide when a job exists. In a merge request pipeline the build, tests and scans run, and the deploy jobs are left out. Authors get fast feedback on their change, and nothing is deployed from an unreviewed branch.',
        boxes: [b('m', 'Merge request', ['feature branch'], 'none'), b('r', 'Rules', ['if merge request event'], 'new'), b('p', 'MR pipeline', ['build, test, scan only'], 'ok')],
        deps: [d('Merge request', 'Rules', 'evaluated', 'ok'), d('Rules', 'MR pipeline', 'selects', 'ok')],
      },
      {
        note: 'After the merge, the pipeline on main has more jobs: the image is built and pushed, and the change is deployed to test automatically. Production stays manual. One file describes all of this, and the rules keep each pipeline small and relevant.',
        boxes: [b('m', 'Main branch', ['after the merge'], 'ok'), b('r', 'Rules', ['if branch is main'], 'new'), b('p', 'Main pipeline', ['build, test, image, deploy test'], 'ok')],
        deps: [d('Main branch', 'Rules', 'evaluated', 'ok'), d('Rules', 'Main pipeline', 'selects', 'ok')],
      },
      {
        note: 'The needs keyword turns stages into a graph. A job with needs starts as soon as the jobs it depends on finish, without waiting for the rest of its stage. A slow job in the test stage no longer holds up the image build, and the pipeline finishes sooner.',
        boxes: [b('b', 'Build job', ['finished'], 'ok'), b('i', 'Image job', ['needs: build'], 'new'), b('s', 'Slow tests', ['still running'], 'warn')],
        deps: [d('Build job', 'Image job', 'starts at once', 'ok'), d('Build job', 'Slow tests', 'starts', 'ok')],
      },
    ],
  },
];
