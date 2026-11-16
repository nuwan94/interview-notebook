// Frame data for the "Jenkins" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const JENKINS_SCENES = [
  {
    id: 'architecture',
    label: 'Architecture',
    title: 'Controller and agents',
    frames: [
      {
        note: 'A push reaches the Git server, which calls a webhook on the Jenkins controller. The controller finds the job that belongs to the repository and puts a build in its queue. The controller coordinates the work and does not run the builds itself.',
        boxes: [b('g', 'Git server', ['push event'], 'none'), b('c', 'Controller', ['jobs, UI, configuration'], 'new'), b('q', 'Build queue', ['waits for a free executor'], 'warn')],
        deps: [d('Git server', 'Controller', 'webhook', 'ok'), d('Controller', 'Build queue', 'enqueues', 'ok')],
      },
      {
        note: 'The controller matches the labels the job asks for, for example maven and linux, to an agent that has a free executor. The agent gets a clean workspace, checks the code out and runs the steps. Heavy work stays off the controller.',
        boxes: [b('c', 'Controller', ['picks an agent by label'], 'new'), b('a', 'Agent', ['labels: maven, linux'], 'ok'), b('w', 'Workspace', ['checked-out code'], 'ok')],
        deps: [d('Controller', 'Agent', 'sends the steps', 'ok'), d('Agent', 'Workspace', 'builds in', 'ok')],
      },
      {
        note: 'Many teams run agents as short-lived pods on Kubernetes. For each build the controller asks the cluster for a pod, the build runs in it, and the pod is deleted afterwards. Every build starts clean, and capacity grows and shrinks with demand.',
        boxes: [b('c', 'Controller', ['pod template per build'], 'new'), b('k', 'Kubernetes cluster', ['creates and deletes pods'], 'none'), b('p', 'Agent pod', ['lives for one build'], 'ok')],
        deps: [d('Controller', 'Kubernetes cluster', 'requests a pod', 'ok'), d('Kubernetes cluster', 'Agent pod', 'starts', 'ok')],
      },
    ],
  },
  {
    id: 'pipeline',
    label: 'Declarative pipeline',
    title: 'What the Jenkinsfile runs',
    frames: [
      {
        note: 'The Jenkinsfile lives in the repository. Its stages run in order: check out the code, build, test. Each stage is a group of steps, and the whole file is reviewed and versioned like any other code.',
        boxes: [b('j', 'Jenkinsfile', ['in the repository'], 'none'), b('c', 'Checkout', ['source code'], 'ok'), b('b', 'Build stage', ['mvn package'], 'ok'), b('t', 'Test stage', ['unit and integration'], 'new')],
        deps: [d('Jenkinsfile', 'Checkout', 'starts with', 'ok'), d('Checkout', 'Build stage', 'then', 'ok'), d('Build stage', 'Test stage', 'then', 'ok')],
      },
      {
        note: 'A test fails. The stage is marked failed and the later stages are skipped. The post section runs anyway: it publishes the test report and sends a notification, because post conditions such as always and failure run whatever happened.',
        boxes: [b('t', 'Test stage', ['2 tests failed'], 'bad'), b('p', 'Post actions', ['always and failure'], 'warn'), b('n', 'Notification', ['chat message to the team'], 'ok')],
        deps: [d('Test stage', 'Post actions', 'then runs', 'warn'), d('Post actions', 'Notification', 'sends', 'ok')],
      },
      {
        note: 'When all stages pass, the pipeline can pause on an input step. A person from the release group approves, and only then does the deploy stage run. The approval and the approver are recorded in the build.',
        boxes: [b('t', 'Test stage', ['passed'], 'ok'), b('a', 'Approval', ['input step, release group'], 'warn'), b('d', 'Deploy stage', ['deploys the same artifact'], 'ok')],
        deps: [d('Test stage', 'Approval', 'then', 'ok'), d('Approval', 'Deploy stage', 'approved', 'ok')],
      },
    ],
  },
  {
    id: 'multibranch',
    label: 'Multibranch',
    title: 'One Jenkinsfile for every branch',
    frames: [
      {
        note: 'A multibranch job scans the repository and creates a pipeline for every branch and pull request that has a Jenkinsfile. A new branch gets its pipeline automatically, and a deleted branch loses it.',
        boxes: [b('r', 'Repository', ['main, feature branches, pull requests'], 'none'), b('m', 'Multibranch job', ['scans and creates jobs'], 'new'), b('f', 'Branch pipeline', ['one per branch'], 'ok')],
        deps: [d('Repository', 'Multibranch job', 'scanned by', 'ok'), d('Multibranch job', 'Branch pipeline', 'creates', 'ok')],
      },
      {
        note: 'A pull request is built with the same Jenkinsfile, and Jenkins reports the result back to the Git server as a status check. The branch protection rule can then require it to be green before anyone can merge.',
        boxes: [b('p', 'Pull request', ['opened by a developer'], 'none'), b('f', 'Branch pipeline', ['builds and tests it'], 'ok'), b('s', 'Status check', ['green or red on the PR'], 'new')],
        deps: [d('Pull request', 'Branch pipeline', 'triggers', 'ok'), d('Branch pipeline', 'Status check', 'reports', 'ok')],
      },
      {
        note: 'With fifty services, copying the same stages into every Jenkinsfile is a burden. A shared library holds the common steps in one repository, so each Jenkinsfile calls one step and a fix to the library reaches every service.',
        boxes: [b('l', 'Shared library', ['buildJavaService()'], 'new'), b('j', 'Jenkinsfile', ['one line per service'], 'ok'), b('s', 'Service pipeline', ['same stages everywhere'], 'ok')],
        deps: [d('Jenkinsfile', 'Shared library', 'calls', 'ok'), d('Shared library', 'Service pipeline', 'defines', 'ok')],
      },
    ],
  },
  {
    id: 'credentials',
    label: 'Credentials',
    title: 'Secrets never live in the Jenkinsfile',
    frames: [
      {
        note: 'The registry password is stored once in the Jenkins credentials store, under an id such as registry-creds. The Jenkinsfile only names the id. Nobody who reads or edits the file can see the secret.',
        boxes: [b('j', 'Jenkinsfile', ['withCredentials id: registry-creds'], 'none'), b('s', 'Credentials store', ['encrypted, with permissions'], 'new'), b('c', 'Controller', ['looks up the id'], 'ok')],
        deps: [d('Jenkinsfile', 'Controller', 'asks for the id', 'ok'), d('Controller', 'Credentials store', 'reads', 'ok')],
      },
      {
        note: 'The controller gives the value to the agent only for that block, as environment variables. If the value is printed, Jenkins masks it in the console log. The agent uses it to push the image to the registry.',
        boxes: [b('c', 'Controller', ['sends the secret'], 'ok'), b('a', 'Agent', ['env var inside the block'], 'warn'), b('r', 'Image registry', ['image is pushed'], 'ok')],
        deps: [d('Controller', 'Agent', 'only inside the block', 'warn'), d('Agent', 'Image registry', 'push', 'ok')],
      },
      {
        note: 'When the block ends the variables are gone. A short-lived credential is better still: the pipeline asks the platform for a token that expires in minutes, so even a leaked log line is harmless a little later.',
        boxes: [b('a', 'Agent', ['block ended, secret removed'], 'ok'), b('t', 'Short-lived token', ['expires in minutes'], 'new'), b('l', 'Console log', ['the value is shown as stars'], 'ok')],
        deps: [d('Agent', 'Short-lived token', 'prefers', 'ok'), d('Agent', 'Console log', 'masked in', 'ok')],
      },
    ],
  },
];
