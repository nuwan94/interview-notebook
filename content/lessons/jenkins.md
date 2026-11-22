---
title: Jenkins — controller, agents, Jenkinsfile and shared libraries
nav: Jenkins
slug: jenkins
summary: How Jenkins works and how to use it well for Java and Spring Boot builds, the controller and agent architecture, freestyle and pipeline jobs, declarative and scripted Jenkinsfiles with stages, steps, post, environment, parameters, when and parallel, multibranch pipelines and webhooks, agents on Kubernetes, credentials, shared libraries, plugins, security and maintenance, common problems, and how a bank runs it with approvals and audit evidence, with examples and interview questions.
tags: [Jenkins, Jenkinsfile, CI/CD, Pipeline, Groovy, Build, DevOps]
order: 50
topic: CI/CD / Pipelines
updated: 2026-11-17
subnav: true
---

**Jenkins** is the best-known open-source automation server. It is older than most CI tools, extremely flexible through a huge plugin ecosystem, and still very common in banks and large enterprises because it can be self-hosted, locked down and wired into almost anything. Interviews ask *what the controller and agents are, how a Jenkinsfile is structured, the difference between declarative and scripted pipelines, how a multibranch pipeline works, how secrets are handled, what a shared library is, how to scale and secure Jenkins, and what goes wrong with it.* Play the four scenes: architecture, a declarative pipeline, multibranch and shared libraries, and credentials.

```demo
name: jenkins-walk
```

> **One sentence to remember:** *The controller schedules and stores, agents do the work in clean workspaces, the Jenkinsfile in the repository defines the pipeline as code, shared libraries remove the copying, and secrets come from the credentials store and never from the file.*

## Architecture {#architecture}

- **Controller** (formerly called master): the central server with the web UI, job configuration, build history, the build queue, plugins and security settings. It decides **what runs where**. It should not run builds itself: set its executors to zero so heavy or untrusted build code cannot touch it.
- **Agent** (a *node*): a machine, VM, container or pod that connects to the controller and runs the steps. Agents have **labels** (`maven`, `linux`, `docker`), and a job asks for a label.
- **Executor:** a slot on an agent that runs one build at a time. An agent with 4 executors runs 4 builds in parallel.
- **Workspace:** the directory on the agent where the code is checked out and built. It is the agent's disk, not shared between agents.
- **Build queue:** builds wait here until an executor with the right label is free.
- **Job** or **project:** a unit of work. **Build:** one run of a job, with a number, a log and results.
- **Connection:** an agent connects to the controller by **WebSocket** or **inbound TCP (JNLP)**, or the controller starts it by SSH. Inbound agents are easier through firewalls.
- **State:** configuration and build history live in `JENKINS_HOME` on the controller's disk. It must be **backed up**, and ideally the configuration is held **as code** (see below), so a lost controller can be rebuilt.

**Agents on Kubernetes.** With the Kubernetes plugin the controller creates a **pod per build** from a pod template (containers for maven, docker, kubectl), runs the steps there, and deletes the pod. Every build gets a clean, identical environment, there is no snowflake agent to maintain, and capacity follows demand ([Kubernetes](lesson:kubernetes)). The same idea works with Docker agents: `agent { docker { image 'maven:3.9-eclipse-temurin-21' } }` runs the stage inside that image.

## Kinds of jobs {#jobs}

| Type | What it is | Use it for |
| --- | --- | --- |
| **Freestyle** | a form-based job configured in the UI | legacy jobs, quick experiments. Hard to version and review |
| **Pipeline** | the steps come from a `Jenkinsfile` (or an inline script) | one pipeline for one repository or branch |
| **Multibranch pipeline** | scans a repository and creates a pipeline per branch and pull request that has a `Jenkinsfile` | the normal choice for application repositories |
| **Organization folder** | scans a whole GitHub or GitLab organisation and creates a multibranch job per repository | many repositories with the same conventions |

The rule is **pipeline as code**: the definition is in the repository, reviewed with the code, versioned, and different per branch when needed ([CI/CD fundamentals](lesson:cicd-fundamentals#as-code)). UI-configured jobs drift and cannot be reviewed.

## The Jenkinsfile {#jenkinsfile}

Two syntaxes exist, both Groovy-based:

| | **Declarative** | **Scripted** |
| --- | --- | --- |
| Starts with | `pipeline { ... }` | `node { ... }` |
| Structure | fixed sections: `agent`, `stages`, `post`, `options`... | free-form Groovy code |
| Validation | checked before the run | errors appear while running |
| Flexibility | limited, with an escape hatch `script { }` | unlimited |
| Recommended | **yes, the default** | only for logic declarative cannot express |

A declarative pipeline for a Spring Boot service:

```groovy
pipeline {
    agent { label 'maven' }

    options {
        timeout(time: 30, unit: 'MINUTES')       // never let a build hang forever
        disableConcurrentBuilds()                // one build per branch at a time
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    environment {
        IMAGE = "registry.example.com/payments:${env.GIT_COMMIT.take(8)}"
    }

    stages {
        stage('Build and test') {
            steps { sh 'mvn -B clean verify' }
            post { always { junit '**/target/surefire-reports/*.xml' } }
        }
        stage('Quality') {
            parallel {
                stage('Static analysis') { steps { sh 'mvn -B sonar:sonar' } }
                stage('Dependency scan') { steps { sh 'mvn -B org.owasp:dependency-check-maven:check' } }
            }
        }
        stage('Image') {
            when { branch 'main' }                // only the main branch publishes
            steps {
                withCredentials([usernamePassword(credentialsId: 'registry-creds',
                        usernameVariable: 'USER', passwordVariable: 'PASS')]) {
                    sh '''
                      echo "$PASS" | docker login registry.example.com -u "$USER" --password-stdin
                      docker build -t "$IMAGE" . && docker push "$IMAGE"
                    '''
                }
            }
        }
        stage('Approval') {
            when { branch 'main' }
            steps { input message: "Deploy ${env.IMAGE} to production?", submitter: 'release-managers' }
        }
        stage('Deploy') {
            when { branch 'main' }
            steps { sh './deploy.sh production "$IMAGE"' }
        }
    }

    post {
        failure { echo 'Build failed: notify the team' }
        cleanup { cleanWs() }                     // always clean the workspace at the end
    }
}
```

The sections you must know:

- **`agent`**: where to run (`any`, a label, a Docker image, a Kubernetes pod template, or `none` at the top with an agent per stage).
- **`stages` / `stage` / `steps`**: the ordered work. A stage is a named block, and steps are the actions (`sh`, `bat`, `junit`, `archiveArtifacts`, `input`, `withCredentials`...).
- **`post`**: conditions that run after the stage or the pipeline: `always`, `success`, `failure`, `unstable`, `changed`, `cleanup`.
- **`environment`**: variables (and credentials bound by id). **`parameters`**: values the user gives when starting a build. **`options`**: timeouts, retries, build retention, concurrency. **`triggers`**: cron, `pollSCM`, or upstream jobs.
- **`when`**: run a stage only on a condition (branch, tag, an expression, a changed path, an environment variable).
- **`parallel`**: stages that run at the same time (and `matrix` for a combination such as several JDK versions).
- **`input`**: pause for a human approval, with a `submitter` limited to a group, and a record of who approved.
- **`script { }`**: a block of scripted Groovy inside declarative, for loops or complex logic.

Two warnings about Groovy: the pipeline code runs on the **controller** in a sandbox and is **serialised** so it can survive a restart (CPS), so keep it **short and about orchestration**. Put real work in shell scripts, Maven or Gradle tasks that run on the agent. And in `sh` always use **single-quoted** strings for secrets (`'$PASS'`), because Groovy would interpolate a double-quoted one and put the secret in the process list and log.

## Triggers, multibranch and webhooks {#multibranch}

- **Webhook (preferred):** the Git server calls Jenkins when something is pushed or a pull request changes, so builds start at once and Jenkins does no polling.
- **Poll SCM:** Jenkins asks the repository on a schedule. Simple, wasteful, and slow to react. Use it only where webhooks cannot reach Jenkins.
- **Cron:** time-based, for nightly builds and scheduled scans.
- **Upstream/downstream:** one job starts another when it succeeds.
- **Multibranch pipeline** (the third scene): the job **scans** the repository, creates a pipeline for every branch and pull request with a `Jenkinsfile`, and removes it when the branch is deleted. Results appear as **status checks** on the pull request, and branch protection can require them. Use `when { branch 'main' }` or `when { changeRequest() }` to decide what runs where, so pull requests build and test while only `main` publishes and deploys.

## Shared libraries {#shared-libraries}

With dozens of services, copying the same stages everywhere causes drift. A **shared library** is a Git repository of Groovy code that pipelines import:

```groovy
// repository "jenkins-shared-library": vars/buildJavaService.groovy
def call(Map config = [:]) {
    pipeline {
        agent { label 'maven' }
        stages {
            stage('Build and test') { steps { sh "mvn -B verify ${config.mavenArgs ?: ''}" } }
            stage('Image') {
                when { branch 'main' }
                steps { sh "./build-image.sh ${config.imageName}" }
            }
        }
    }
}
```

```groovy
// a service's Jenkinsfile
@Library('company-pipeline@v3') _
buildJavaService(imageName: 'payments', mavenArgs: '-Pintegration')
```

A fix in the library reaches every service. Treat the library like a product: **version it** (pin `@v3`, not the moving branch), test it, document it, and review changes, because a bug there breaks every pipeline at once. Keep it small and let teams override a stage when they need to.

## Credentials and secrets {#credentials}

The fourth scene shows the rule: **secrets live in the Jenkins credentials store, and the Jenkinsfile only names the id**.

- Credential types: username and password, secret text, SSH key, certificate, secret file.
- **`withCredentials([...])`** binds the secret to variables only inside the block. Jenkins **masks** the value in the console log. Masking is a safety net only: base64 or splitting the value defeats it.
- **Scope** credentials to a folder or a team so that a job can use only its own, and limit who can create and view them.
- Prefer **short-lived credentials**: a pipeline that gets a cloud token by role or OIDC, or reads from **HashiCorp Vault** or a cloud secret manager at run time, leaves nothing long-lived to leak ([cryptography](lesson:cryptography)).
- Never print `env`, never pass secrets as command-line arguments (visible to other processes), never commit them, and never give pull requests from forks access to credentials.

## Plugins {#plugins}

Plugins give Jenkins its reach (Git, Pipeline, Kubernetes, Credentials, JUnit, SonarQube, Blue Ocean, Role-based authorisation, Configuration as Code), and are also its biggest maintenance burden:

- Each plugin is a **dependency** with its own security history. Install only what you use, remove the rest, and keep them updated, in a test instance first.
- Plugin updates can break pipelines, so **pin and test** upgrades. Keep the controller's list of plugins in code (a `plugins.txt`).
- Prefer a plain `sh 'mvn ...'` to a plugin wrapper for the tool you can call directly, so a build is the same on a laptop and in Jenkins.

## Security and operations {#security}

- **Authentication and authorisation:** connect to the company identity provider (LDAP, SSO with OIDC or SAML), enable **role-based access** (the Role Strategy or Matrix plugin), and never allow anonymous access.
- **Controller hardening:** zero executors on the controller, agent-to-controller access rules on, the **script approval** feature for sandboxed Groovy, CSRF protection, HTTPS behind a reverse proxy, and prompt installation of the security advisories Jenkins publishes.
- **Isolation of agents:** untrusted code such as pull request builds should run on **ephemeral, restricted agents** with no access to production credentials.
- **Configuration as Code (JCasC):** the controller's settings (security, agents, credentials references, tools) are described in a YAML file in Git, so a controller can be recreated reproducibly and changes are reviewed.
- **Backups and upgrades:** back up `JENKINS_HOME`, use the **LTS** release line, upgrade regularly and in small steps.
- **Monitoring:** watch queue length, agent availability, disk space (build history and workspaces), and the age of plugins. Discard old builds with a `buildDiscarder`.
- **High availability:** the open-source controller is a single instance, so reliability comes from fast recovery (JCasC, backups, a persistent volume) and from keeping the work on replaceable agents.

## Common problems {#problems}

- **A pipeline that is mostly Groovy.** Slow, fragile, hard to test. Move the logic to scripts or the build tool.
- **Snowflake agents** with hand-installed tools. Use containers or pod templates, so every build starts from a defined image.
- **Plugin sprawl and a stale controller**, with known vulnerabilities and breaking upgrades.
- **Credentials printed in logs** or passed with Groovy string interpolation.
- **Shared workspaces and leftover files** between builds. Clean the workspace (`cleanWs()`) and build in containers.
- **A flaky or slow pipeline** because everything runs in one long sequence. Run independent stages in `parallel`, cache dependencies, and use `disableConcurrentBuilds` plus `milestone` for deploy stages so an older build does not overwrite a newer one.
- **UI-edited jobs** that nobody can review or reproduce.
- **A single overloaded controller** running builds. Keep executors at zero on it and scale the agents.

## Jenkins in a bank {#bank}

- **Why it stays:** it is self-hosted, auditable, works inside restricted networks, and connects to older internal systems that a SaaS tool cannot reach.
- **Approval and four-eyes:** the `input` step restricted to a named group, plus branch protection and required reviewers on the repository, give segregation of duties. Only the pipeline holds the production credentials.
- **Audit evidence:** build logs, test and scan reports, the artifact's version and checksum, and the approver's identity are archived with the build (`archiveArtifacts`, `fingerprint`), so a change can be traced from a commit to production.
- **Controlled shared library:** the approved pipeline steps (build, scan, sign, deploy) are in a protected, versioned library, so every service goes through the same mandatory gates and teams cannot quietly skip the security scan.
- **Isolated agents and network zones:** build agents in a separate zone, deployment agents with access to production only for the deploy stage, and secrets from a vault.
- **Compliance:** role-based access reviews, a documented upgrade and backup procedure, and a defined list of allowed plugins.

## Jenkins against other tools {#compare}

| | Jenkins | GitHub Actions | GitLab CI |
| --- | --- | --- | --- |
| Hosting | self-hosted | SaaS (or self-hosted runners) | SaaS or self-managed |
| Pipeline file | `Jenkinsfile` (Groovy) | YAML in `.github/workflows` | `.gitlab-ci.yml` |
| Extensibility | very large plugin ecosystem | marketplace of actions | built-in features and templates |
| Setup and upkeep | you run the controller, plugins, agents | managed | managed or yours |
| Best fit | complex, regulated, on-premises estates | GitHub-centred teams | teams using GitLab as one platform |

The tool matters less than the practice: pipeline as code, build once, quality gates and fast feedback apply to all of them.

Try it in the lab: [A Jenkins pipeline: controller, agents, credentials](lab:jenkins-pipeline-agents).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| controller | schedules, stores, UI. Zero executors, back up `JENKINS_HOME` |
| agent | runs the steps, by label. Prefer ephemeral pods or containers |
| executor | one build slot on an agent |
| job type | multibranch pipeline for application repositories |
| Jenkinsfile | declarative by default, in the repository |
| sections | `agent`, `stages`, `steps`, `post`, `environment`, `options`, `when`, `parallel`, `input` |
| groovy | orchestration only, real work in `sh`, Maven or scripts |
| trigger | webhook over polling |
| secrets | credentials store, `withCredentials`, single-quoted in `sh`, short-lived tokens |
| shared library | one place for common stages, pinned and versioned |
| plugins | few, updated, in code (`plugins.txt`) |
| JCasC | controller configuration as code |
| bank | approval by group, audit archive, controlled library, isolated agents |

## Interview questions {#questions}

### [basic] What is Jenkins and what is it used for? {#what-q}

Jenkins is an open-source automation server, most often used for continuous integration and delivery: it builds, tests, scans, packages and deploys software when code changes, and can run scheduled jobs. It is self-hosted, extensible with plugins, and defines pipelines as code in a `Jenkinsfile`. It is common in enterprises and banks because it runs inside restricted networks and integrates with many systems.

### [basic] What are the Jenkins controller and agents? {#controller-agent-q}

The controller is the central server: UI, configuration, job definitions, build queue, history and security. Agents (nodes) are the machines, containers or pods that run the builds, selected by labels. The controller should not run builds itself (zero executors), so a heavy or untrusted build cannot affect it, and builds scale by adding agents. An executor is one build slot on an agent.

### [basic] What is a Jenkinsfile and why keep it in the repository? {#jenkinsfile-q}

A text file that defines the pipeline as code, written in declarative or scripted Groovy syntax. Keeping it in the repository means the pipeline is versioned with the code, reviewed in pull requests, different per branch when needed, reproducible, and recoverable if the Jenkins server is lost. Jobs configured by hand in the UI cannot be reviewed or reproduced.

### [basic] What is the difference between declarative and scripted pipelines? {#declarative-q}

Declarative starts with `pipeline { }` and has a fixed structure (`agent`, `stages`, `steps`, `post`, `options`) that Jenkins validates before the run, so it is simpler and safer, and it is the recommended default. Scripted starts with `node { }` and is free-form Groovy: it is more powerful and easier to turn into unreadable code. Declarative can embed scripted code in a `script { }` block when it needs a loop or complex logic.

### [basic] What are stages and steps? {#stages-q}

A stage is a named, ordered part of the pipeline (Build, Test, Deploy), shown as a column in the UI. Steps are the individual actions inside a stage: run a shell command, publish test results, archive a file, ask for approval. If a step fails, the stage fails, and the later stages are skipped unless configured otherwise.

### [basic] What does the `post` section do? {#post-q}

It defines actions that run after a stage or a pipeline depending on the result: `always`, `success`, `failure`, `unstable`, `changed` and `cleanup`. It is used to publish test reports, send notifications, and clean the workspace, so they happen whatever the outcome.

### [intermediate] What is a multibranch pipeline? {#multibranch-q}

A job type that scans a repository and automatically creates a pipeline for every branch and pull request that contains a `Jenkinsfile`, and removes it when the branch goes away. Each runs the Jenkinsfile of that branch, and the result is reported to the Git server as a status check, which branch protection can require before a merge. Conditions such as `when { branch 'main' }` make pull requests build and test while only main publishes and deploys.

### [intermediate] How do you handle credentials safely in Jenkins? {#credentials-q}

Store them in the Jenkins credentials store, scoped to a folder or team, and refer to them by id with `withCredentials`, so the Jenkinsfile contains no secret and the value exists as environment variables only inside the block. Jenkins masks the values in the log, but masking is only a safety net. Use single quotes in `sh` so Groovy does not interpolate the secret, never print the environment, never pass secrets on a command line, do not expose them to pull requests from forks, and prefer short-lived tokens from Vault or a cloud role.

### [intermediate] What is a shared library and what are the risks? {#library-q}

A Git repository of Groovy code (`vars/`, `src/`) that Jenkinsfiles load with `@Library`, so common stages are written once and every service calls them. A fix reaches every pipeline. The risk is the same: a bug breaks every pipeline at once. So version it and pin `@v3`, test it, review changes, keep it small, and let a team override a step when it genuinely needs to.

### [intermediate] How do you scale Jenkins? {#scale-q}

Keep the controller light (no builds) and scale by adding agents, ideally ephemeral pods or containers created per build by the Kubernetes plugin, so capacity follows demand and every build is clean. Run independent stages in parallel, cache dependencies, use labels to place work on suitable agents, discard old builds, and split into several controllers by team if one controller becomes the bottleneck, because the open-source controller is a single instance.

### [intermediate] Why are plugins a risk, and how do you manage them? {#plugins-q}

Each plugin is code with its own bugs and vulnerabilities, and updates can break pipelines. Install only what is needed, keep the list in code, test upgrades on a staging controller, apply security advisories quickly, and remove unused plugins. Prefer calling the tool directly (`sh 'mvn verify'`) over a plugin wrapper where it is simple, so the build behaves the same on a laptop.

### [intermediate] Why use webhooks instead of polling the repository? {#webhook-q}

A webhook makes the Git server tell Jenkins immediately when something changes, so builds start in seconds and Jenkins does no repeated checking. Polling asks the repository on a timer, which delays builds, wastes load on both systems and makes many requests to find nothing. Polling is a fallback when the Git server cannot reach Jenkins.

### [intermediate] How do you stop two deployments of the same service from running at once, or an old build from overwriting a newer one? {#concurrency-q}

Use `options { disableConcurrentBuilds() }` so a branch runs one build at a time, and `milestone()` steps (or the `lock` step from the Lockable Resources plugin) around the deploy stage. A milestone makes an older build abort if a newer one has already passed that point, so a slow earlier build cannot deploy after a newer one.

### [deep] How would you design Jenkins for a bank with hundreds of services? {#design-q}

A small number of controllers per business area, each rebuilt from code (JCasC, a pinned `plugins.txt`, a persistent volume, backups), with zero executors and single sign-on with role-based access. Agents are ephemeral Kubernetes pods created from approved images, in network zones separated for build and deploy, with production access only for the deploy stage. Every service uses a protected, versioned shared library that enforces the mandatory stages (build, tests, scans, SBOM, signing, approval) so teams cannot skip them. Secrets come from a vault with short-lived tokens, the artifact is built once and promoted, approvals use a named group and are recorded with the build, and logs, reports and the artifact fingerprint are archived for audit. The platform team monitors queue time, agent health, disk space and the age of plugins.

### [deep] A pipeline that worked yesterday now fails with no code change. How do you investigate? {#debug-q}

Compare what changed besides the code: the agent or its image (a tool version), a plugin or Jenkins upgrade, a shared library version if it is not pinned, a dependency version range or a moving tag such as `latest`, an expired credential or certificate, a changed environment variable, a full disk, or a flaky test or external service. Read the first failure in the log, rebuild on a clean agent to separate state from code, and run the failing command locally in the same container image. Then fix the cause by pinning versions, making the build hermetic, and adding monitoring.

### [deep] What does it mean that Jenkins pipeline code is CPS-transformed, and how does that influence how you write it? {#cps-q}

The Groovy of a Pipeline runs through the Continuation-Passing Style engine, which makes it durable: the state can be saved and the build resumes after a controller restart. The price is that it runs slowly, in a sandbox, some Groovy and Java features and many non-serialisable objects do not work, and long computations load the controller. So keep the Groovy to orchestration, put real work in `sh` steps, Maven or scripts on the agent, and use `@NonCPS` only for small pure helper methods.

### [deep] How do you secure the pipeline against a malicious pull request? {#secure-q}

A pull request can change the Jenkinsfile, so what runs is untrusted code. Do not give pull-request builds access to production credentials or deploy stages (use `when { changeRequest() }` for build and test only), run them on isolated ephemeral agents with no secrets, require approval before building pull requests from forks or new contributors, load the Jenkinsfile from a trusted revision where that is possible, keep the Groovy sandbox and script approval on, and rely on shared-library steps owned by the platform team for anything sensitive.

### [coding] Write a declarative Jenkinsfile that builds a Maven project in a container, runs tests in parallel with a scan, and publishes the image only from main. {#coding-pipeline}

```groovy
pipeline {
    agent {
        docker { image 'maven:3.9-eclipse-temurin-21'; args '-v $HOME/.m2:/root/.m2' }
    }
    options { timeout(time: 25, unit: 'MINUTES'); disableConcurrentBuilds() }

    stages {
        stage('Build') {
            steps { sh 'mvn -B -DskipTests package' }
        }
        stage('Verify') {
            parallel {
                stage('Unit tests') {
                    steps { sh 'mvn -B test' }
                    post { always { junit 'target/surefire-reports/*.xml' } }
                }
                stage('Dependency scan') {
                    steps { sh 'mvn -B org.owasp:dependency-check-maven:check' }
                }
            }
        }
        stage('Publish image') {
            when { branch 'main' }
            steps {
                withCredentials([usernamePassword(credentialsId: 'registry-creds',
                        usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                    sh '''
                      echo "$REG_PASS" | docker login registry.example.com -u "$REG_USER" --password-stdin
                      docker build -t registry.example.com/payments:"$GIT_COMMIT" .
                      docker push registry.example.com/payments:"$GIT_COMMIT"
                    '''
                }
            }
        }
    }
    post { cleanup { cleanWs() } }
}
```

Explain: the Docker agent gives every build the same JDK and Maven, with the local Maven repository mounted as a cache; tests and the scan are independent, so they run in parallel; `when { branch 'main' }` keeps pull requests from publishing; the password is injected only inside `withCredentials`, passed through standard input and read in a **single-quoted** shell block, so it is neither interpolated by Groovy nor shown in the process list; the image is tagged with the commit hash, not `latest`; and a timeout and `cleanWs` keep the agent healthy.

### [coding] Write a small shared library step `deployTo(env, image)` that asks for approval for production only, and use it from a Jenkinsfile. {#coding-library}

```groovy
// vars/deployTo.groovy
def call(String environment, String image) {
    if (environment == 'production') {
        timeout(time: 30, unit: 'MINUTES') {
            input message: "Deploy ${image} to production?",
                  ok: 'Deploy', submitter: 'release-managers'
        }
    }
    milestone()                                   // an older build cannot pass after a newer one
    lock(resource: "deploy-${environment}") {     // one deployment per environment at a time
        sh "./deploy.sh '${environment}' '${image}'"
    }
    echo "Deployed ${image} to ${environment}"
}
```

```groovy
// Jenkinsfile
@Library('company-pipeline@v3') _
pipeline {
    agent any
    stages {
        stage('Deploy test')       { steps { deployTo('test', env.IMAGE) } }
        stage('Deploy production') {
            when { branch 'main' }
            steps { deployTo('production', env.IMAGE) }
        }
    }
}
```

Explain: the step hides the policy, so every service gets the same rule that production needs an approval by the release managers, with a timeout so a forgotten approval does not hold an executor; `milestone` and `lock` prevent overlapping or out-of-order deployments; the library version is pinned; and the approver is recorded in the build, which is the audit evidence.

### [coding] Write a Jenkinsfile that runs the build on a Kubernetes pod agent with a Maven and a Docker-free image builder container. {#coding-kubernetes}

```groovy
pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: maven
      image: maven:3.9-eclipse-temurin-21
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "1", memory: 2Gi }
        limits:   { memory: 3Gi }
    - name: kaniko
      image: gcr.io/kaniko-project/executor:debug
      command: ["sleep"]
      args: ["infinity"]
'''
        }
    }
    stages {
        stage('Build') {
            steps { container('maven') { sh 'mvn -B clean package' } }
        }
        stage('Image') {
            when { branch 'main' }
            steps {
                container('kaniko') {
                    sh '/kaniko/executor --context "$WORKSPACE" --dockerfile Dockerfile --destination registry.example.com/payments:"$GIT_COMMIT"'
                }
            }
        }
    }
}
```

Explain: the controller creates one pod for the build with two containers that share the workspace, and `container('name')` runs a step in the chosen one; the pod disappears at the end, so there is no agent to maintain and every build is clean; resource requests and limits keep one build from starving the cluster; and Kaniko builds the image without a Docker daemon, so the pod needs no privileged access. Registry credentials would be mounted from a Kubernetes secret or injected by the pipeline.
