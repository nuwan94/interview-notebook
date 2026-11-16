---
title: GitLab CI/CD — pipelines, runners, artifacts, rules and environments
nav: GitLab CI/CD
slug: gitlab-ci
summary: How GitLab CI/CD works and how to build a Java and Spring Boot pipeline with it, .gitlab-ci.yml with stages and jobs, runners and executors on Docker and Kubernetes, artifacts against cache, variables and protected secrets, rules and merge request pipelines, needs and DAG pipelines, include, extends and templates, environments and manual deployments, container registry and Kaniko, parent and child pipelines, and a comparison with Jenkins and GitHub Actions, with examples and interview questions.
tags: [GitLab, GitLab CI, CI/CD, Pipeline, Runner, YAML, DevOps]
order: 51
topic: CI/CD / Pipelines
updated: 2026-11-17
subnav: true
---

**GitLab CI/CD** is the pipeline system built into GitLab, which also holds the repository, merge requests, the container registry, environments and security scanning in one place. You describe the pipeline in a `.gitlab-ci.yml` file in the repository, and **runners** execute the jobs. Interviews ask *what a stage, a job and a pipeline are, what a runner and an executor are, the difference between artifacts and cache, how rules and merge request pipelines work, how to protect secrets and production, how `needs` speeds a pipeline up, how to reuse configuration, and how GitLab compares with Jenkins.* Play the four scenes: stages and jobs, runners, artifacts and cache, and rules.

```demo
name: gitlab-walk
```

> **One sentence to remember:** *`.gitlab-ci.yml` declares stages and jobs, runners run each job in a clean container, artifacts carry results between jobs while a cache only saves time, rules choose which jobs exist for each event, and protected variables and environments keep production safe.*

## The building blocks {#concepts}

| Term | Meaning |
| --- | --- |
| **Pipeline** | the whole run for one commit, merge request or schedule |
| **Stage** | a phase (`build`, `test`, `deploy`). Stages run **in order**, and a stage starts only if the previous one succeeded |
| **Job** | one unit of work with a `script`. Jobs in the same stage run **in parallel** |
| **Runner** | a separate program that picks up jobs from GitLab and runs them |
| **Executor** | how a runner runs a job: `shell`, `docker`, `kubernetes`, `docker-machine`... |
| **Artifact** | files a job produces and **passes** to later jobs and to the UI |
| **Cache** | files stored **between** pipelines to speed up jobs (dependencies) |
| **Variable** | a value for jobs: predefined (`CI_COMMIT_SHA`), project, group or instance level, or file |
| **Environment** | a named target (`staging`, `production`) with a deployment history |
| **Merge request (MR)** | GitLab's name for a pull request, with its own pipelines and approval rules |

## A first pipeline for a Spring Boot service {#first}

```yaml
# .gitlab-ci.yml
stages: [build, test, package, deploy]

default:
  image: maven:3.9-eclipse-temurin-21
  interruptible: true                         # a newer commit can cancel an old pipeline

variables:
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"

cache:
  key:
    files: [pom.xml]                          # a new cache when dependencies change
  paths: [.m2/repository]

build:
  stage: build
  script: mvn -B -DskipTests package
  artifacts:
    paths: [target/*.jar]
    expire_in: 1 week

unit-tests:
  stage: test
  script: mvn -B test
  artifacts:
    when: always                              # keep reports even when tests fail
    reports:
      junit: target/surefire-reports/TEST-*.xml

dependency-scan:
  stage: test
  script: mvn -B org.owasp:dependency-check-maven:check
  allow_failure: false

image:
  stage: package
  image: { name: gcr.io/kaniko-project/executor:debug, entrypoint: [""] }
  script:
    - /kaniko/executor --context "$CI_PROJECT_DIR" --dockerfile Dockerfile
        --destination "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-test:
  stage: deploy
  script: ./deploy.sh test "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA"
  environment: { name: test }
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-production:
  stage: deploy
  script: ./deploy.sh production "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA"
  environment: { name: production }
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual                            # a person presses play
```

Reading it (the first scene): `unit-tests` and `dependency-scan` run **in parallel** in the `test` stage; `deploy-production` is a **manual** job that waits for a person; the image is tagged with the **commit SHA**, not `latest`, and built **once** and then deployed to every environment ([build once, promote](lesson:cicd-fundamentals#artifacts)). Every job gets a **fresh** container, so nothing is shared except through artifacts and cache.

## Runners and executors {#runners}

GitLab does not run your code. **Runners** do (the second scene), by polling GitLab for jobs, which means they only need **outbound** access to the server.

- **Scope:** *shared* runners serve every project of the instance, *group* runners serve a group, *project* runners serve one project (useful for a restricted network or special hardware). Runners and jobs are matched by **tags**.
- **Executors:**
  - **shell**: runs on the host. Simple, but jobs share and dirty the machine.
  - **docker**: each job runs in a **new container** from the job's `image`, with optional `services` (a Postgres or Redis container for tests). The usual choice.
  - **kubernetes**: each job is a **pod**, so the cluster's capacity is shared and builds scale out.
  - **autoscaling executors** (cloud VMs on demand) for elastic capacity.
- **Building images:** the Docker executor cannot easily run `docker build` safely. Use **Kaniko** or **Buildah** (no daemon, no privileges), or **Docker-in-Docker** (a privileged service container, which is a security trade-off) only when you must.
- **Security:** a runner runs whatever the pipeline file says. Do not run untrusted merge request code on a runner that holds production access: use **protected runners** (jobs on protected branches only) and separate runners for build and for deploy.

## Artifacts and cache {#artifacts}

People confuse these two (the third scene):

| | **Artifacts** | **Cache** |
| --- | --- | --- |
| Purpose | **results** that later jobs or people need (a JAR, a test report) | a **shortcut** for dependencies (`.m2`, `node_modules`) |
| Scope | passed to the **later jobs of the same pipeline**, downloadable in the UI | reused by **later pipelines** (per key and per runner) |
| Reliability | guaranteed, stored by GitLab | **best effort**, may be missing: a job must still work without it |
| Control | `artifacts:paths`, `expire_in`, `reports`, `dependencies` | `cache:key`, `cache:paths`, `policy` |

Use artifacts for what must **flow** through the pipeline, and a cache keyed on `pom.xml` or `package-lock.json` for what only needs to be **fast**. `artifacts:reports` (JUnit, coverage, SAST) shows results in the merge request.

## Variables and secrets {#variables}

- **Predefined variables** describe the run: `CI_COMMIT_SHA`, `CI_COMMIT_BRANCH`, `CI_MERGE_REQUEST_ID`, `CI_REGISTRY_IMAGE`, `CI_PIPELINE_SOURCE`, `CI_JOB_TOKEN`.
- **Custom variables** are set in the YAML (for non-secrets) or in the **project, group or instance settings** (for secrets).
- **Masked** variables are hidden in job logs (the value must meet format rules), and **protected** variables are passed only to pipelines on **protected branches and tags**, so a merge request from a feature branch cannot read the production password.
- **File** variables write the value to a temporary file (for a kubeconfig or a certificate) and give its path.
- **Environment-scoped** variables apply only to jobs for a given environment, so `DB_URL` differs between test and production.
- **Better than stored secrets:** short-lived credentials. The job gets an **ID token (OIDC)** from GitLab (`id_tokens:`) and exchanges it with HashiCorp Vault or a cloud provider for temporary access, so no long-lived key sits in settings. See [authentication and tokens](lesson:authn-authz).
- Never `echo` a secret, never commit one, and remember that masking is a safeguard, not a vault.

## Rules and merge request pipelines {#rules}

`rules:` decide **whether a job exists** in a pipeline (the fourth scene). The older `only/except` keywords are superseded.

```yaml
workflow:
  rules:                                              # which pipelines exist at all
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG

unit-tests:
  script: mvn -B test                                 # no rules: runs in every pipeline above

deploy-production:
  script: ./deploy.sh production
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/       # only a release tag
      when: manual
    - when: never
```

- A **merge request pipeline** (`merge_request_event`) runs the checks on the proposed change: build, tests, scans. It gives fast feedback to the author and never deploys. GitLab can also **merge the result** with the target branch first (merged results pipelines) and queue merges (merge trains), so main stays green.
- A **branch pipeline** on the default branch builds the image and deploys to test automatically, and production stays `when: manual`.
- `rules:changes` runs a job only when certain files changed (useful in a monorepo), `rules:exists` checks that a file is present, and `when` can be `on_success`, `manual`, `delayed` or `never`.
- Avoid **duplicate pipelines** (a branch pipeline and an MR pipeline for the same push) with a `workflow:rules` block like the one above.

## Faster pipelines with `needs` {#needs}

By default a job waits for the **whole previous stage**. `needs` turns the pipeline into a **graph** (a DAG): a job starts as soon as the jobs it needs have finished.

```yaml
image:
  stage: package
  needs: [build]            # does not wait for the slow tests
  script: ...

e2e-tests:
  stage: test
  needs: [build, image]     # and needs the image artifact too
```

Also: run independent jobs in the same stage in parallel, use `parallel: 4` or `parallel: matrix:` to split a test suite or try several JDK versions, make jobs `interruptible` so a new push cancels old runs, keep images small and cached on the runner, and use the cache for dependencies.

## Reuse: `include`, `extends` and templates {#reuse}

For many repositories, copying YAML is the same trap as copying Jenkinsfiles. GitLab offers:

```yaml
include:
  - project: 'platform/ci-templates'              # a central repository of approved pipelines
    ref: v3.2.0                                   # pinned, like a library version
    file: '/java/maven-service.yml'
  - template: Security/SAST.gitlab-ci.yml         # a GitLab-provided template

.java-job:                                        # a hidden template job (leading dot)
  image: maven:3.9-eclipse-temurin-21
  before_script: [java -version]

unit-tests:
  extends: .java-job                              # inherits the image and before_script
  script: mvn -B test
```

- `include` pulls YAML from the same repository, another project, a remote URL or GitLab's templates. Use `ref:` to **pin a version**.
- `extends` and YAML anchors reuse job fragments. **CI/CD components** (a catalogue of versioned, parameterised building blocks with `inputs:`) are the modern form.
- A **central templates repository** owned by a platform team lets a bank put mandatory jobs (SAST, dependency and secret scanning, SBOM) in every pipeline. **Compliance pipelines** and **security policies** can *force* them even if a project tries to leave them out.

## Environments, deployments and approvals {#environments}

- An **environment** (`environment: name: production`) records every deployment, the commit and pipeline behind it, and the person who triggered it. The UI shows what is deployed where, and offers a **rollback** by re-running a previous deployment.
- **Protected environments** limit **who may deploy** (for example only the release group), and can require **approvals** (several approvers, so the author cannot be the only one). This is the **four-eyes** control that a bank needs, enforced by the platform.
- **Review apps** create a temporary environment per merge request (`environment: name: review/$CI_COMMIT_REF_SLUG`, with `on_stop` to remove it), so reviewers can try the change.
- **Deployment strategies** are done in the deploy job or with a tool such as Argo CD or Helm: rolling, blue-green or canary ([deployment strategies](lesson:deployment-strategies)). GitLab can also **deploy to Kubernetes** with an agent that connects from the cluster, so the cluster does not need to be reachable from outside.
- **Resource groups** (`resource_group: production`) make sure only one deployment to an environment runs at a time.

## Parent and child pipelines {#child-pipelines}

A big repository or a monorepo can split its pipeline: a **parent** pipeline triggers **child** pipelines (`trigger: include:`), each defined in its own file, often **only for the changed service** (`rules:changes`). **Multi-project pipelines** trigger a pipeline in another project, for example a downstream deployment repository. Both keep each YAML file small and let parts run independently.

## GitLab built-in features {#features}

Beyond the pipeline engine, GitLab includes a **container registry** (images tagged by commit), a **package registry** (Maven, npm), **security scanners** (SAST, dependency, container and secret scanning, DAST, and licence checks, with results in the merge request), **code quality** and **test reports**, and **merge request approvals** with code owners. Having them in one tool reduces glue, but you should check which features your licence tier includes.

## Common problems {#problems}

- **The cache treated as storage.** A job that needs the cache to pass fails when it is empty. Use artifacts for results.
- **Secrets exposed to merge requests.** Variables that are not **protected** are visible to any pipeline, including one from a branch that anyone can create. Protect them, and scope runners.
- **Duplicate pipelines** for a branch and its merge request. Add `workflow:rules`.
- **Slow pipelines** because stages wait for each other. Use `needs`, parallel jobs, a good cache, and small images.
- **`latest` image tags** in `image:`, making builds irreproducible. Pin versions.
- **One giant YAML file.** Split with `include`, templates and child pipelines.
- **Docker-in-Docker with privileged mode** on shared runners. Prefer Kaniko or Buildah.
- **Artifacts that never expire** and fill the storage. Set `expire_in`.

## GitLab CI against Jenkins and GitHub Actions {#compare}

| | GitLab CI/CD | Jenkins | GitHub Actions |
| --- | --- | --- | --- |
| Where it lives | built into GitLab (SaaS or self-managed) | a separate server you run | built into GitHub |
| Pipeline file | `.gitlab-ci.yml` | `Jenkinsfile` (Groovy) | `.github/workflows/*.yml` |
| Execution | runners (shell, Docker, Kubernetes) | agents | hosted or self-hosted runners |
| Reuse | `include`, `extends`, components | shared libraries | reusable workflows, marketplace actions |
| Model | stages, jobs, DAG with `needs` | stages with Groovy | workflows, jobs, steps |
| Strength | one platform, strong DevSecOps and environments | maximum flexibility, big plugin set | tight GitHub integration, large ecosystem |
| Cost of upkeep | low with SaaS, medium self-managed | highest: controller, plugins, agents | low |

## In a bank {#bank}

- **Self-managed GitLab** inside the bank's network is common: the code, the pipelines and the registry never leave it, runners are placed in controlled network zones, and all of it is under the bank's own audit.
- **Mandatory pipelines.** A central templates project and compliance pipelines force the same security stages for every service, so a team cannot remove the scan.
- **Four-eyes by configuration.** Protected branches, merge request approvals with **code owners**, approval rules that the author cannot satisfy, and **protected environments** with named deployers.
- **Evidence.** Pipelines, job logs, test and scan reports, the deployment history of each environment and the audit events are kept, so a release can be traced from the merge request to production.
- **Separation of runners.** Build runners with no production access, and protected deploy runners that run only protected-branch jobs, with credentials from a vault or by OIDC.
- **Pinned and signed.** Pinned template versions, base images from an internal registry, signed images and an SBOM per release.

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| pipeline | stages in order, jobs in a stage in parallel |
| file | `.gitlab-ci.yml` in the repository |
| runner | separate program, polls GitLab, scoped shared, group or project, matched by tags |
| executor | docker (container per job) or kubernetes (pod per job) |
| artifacts | results passed between jobs, `expire_in` |
| cache | best-effort speed-up between pipelines, key on the lock file |
| variables | masked hides in logs, **protected** limits to protected branches, OIDC for short-lived secrets |
| rules | decide if a job exists, `workflow:rules` avoids duplicates |
| MR pipeline | build, test, scan, never deploy |
| needs | DAG, start when the needed jobs finish |
| reuse | `include` with `ref`, `extends`, templates, components |
| environments | deployment history, protected, approvals, `resource_group` |
| images | Kaniko, tag with `CI_COMMIT_SHORT_SHA`, never `latest` |
| bank | self-managed, mandatory templates, code owners, protected environments |

## Interview questions {#questions}

### [basic] What is GitLab CI/CD and what is `.gitlab-ci.yml`? {#what-q}

GitLab CI/CD is the continuous integration and delivery system built into GitLab. The pipeline is defined in a `.gitlab-ci.yml` file in the repository, which lists stages and jobs, their scripts, images, rules and artifacts. GitLab creates a pipeline from it for each push, merge request or schedule, and runners execute the jobs. It is pipeline as code, so it is versioned and reviewed with the code.

### [basic] What are stages and jobs? {#stages-jobs-q}

A job is one unit of work: a script that runs in a clean environment. A stage groups jobs. Stages run in the order they are listed, and the jobs of one stage run in parallel. If a job in a stage fails, the next stage does not start, unless the job has `allow_failure`. With `needs` a job can start earlier, as soon as the jobs it depends on are done.

### [basic] What is a GitLab runner? {#runner-q}

A runner is a separate application that polls GitLab for pending jobs and runs them, so the GitLab server itself runs no builds. It can be shared by all projects, by a group, or dedicated to one project, and is matched to jobs by tags. It needs only outbound access to GitLab. How it runs a job is set by its executor, such as shell, Docker or Kubernetes.

### [basic] What is the difference between artifacts and cache? {#artifacts-cache-q}

Artifacts are the **results** of a job (a JAR, a test report) that GitLab stores and passes to later jobs in the same pipeline, and that can be downloaded. A cache holds **dependencies** such as the Maven repository to speed up later pipelines. It is best effort, can be missing, and a job must work without it. Use artifacts for what must flow through the pipeline, and a cache, keyed on the lock file, for speed only.

### [basic] What is the difference between a branch pipeline and a merge request pipeline? {#mr-q}

A branch pipeline runs for a push to a branch. A merge request pipeline runs for the proposed change in a merge request, in its context, and exposes merge request variables and reports. The usual setup is that merge request pipelines run build, tests and scans for quick feedback and never deploy, while the default-branch pipeline builds the image and deploys, with production manual.

### [basic] How are variables and secrets used? {#variables-q}

Non-secret values go into the YAML `variables:` block, and secrets are set in the project, group or instance settings, never in the repository. A variable can be **masked** (hidden in logs) and **protected** (only given to pipelines on protected branches and tags). File variables hold certificates or kubeconfigs, and environment scope limits a variable to one environment. Short-lived credentials through an OIDC ID token are better than a stored secret.

### [intermediate] What do `rules` do and how do they differ from `only` and `except`? {#rules-q}

`rules` is a list of conditions evaluated in order: the first match decides whether the job is added to the pipeline and with which `when` (`on_success`, `manual`, `delayed`, `never`). They can test variables, changed files (`changes`) and the existence of files, and can set variables. `only` and `except` are the older, less flexible keywords and should not be mixed with `rules`. A `workflow:rules` block controls which pipelines are created at all and avoids duplicate branch and merge request pipelines.

### [intermediate] What does `needs` do? {#needs-q}

It builds a directed acyclic graph: a job with `needs` starts as soon as the listed jobs have finished, without waiting for every job of the previous stage. It shortens the pipeline when stages contain a mix of fast and slow jobs, and it can also control which artifacts a job downloads. Stages still describe the display order, but `needs` decides the real execution order.

### [intermediate] How do you protect production deployments in GitLab? {#protect-q}

Use a **protected environment** so only named roles or users may deploy, and require approvals from several people so the author cannot approve alone. Make the production job `when: manual` and limit it to the default branch or release tags. Store production secrets in **protected** variables, scoped to the production environment, or fetch short-lived credentials by OIDC, and use a **protected runner** that runs only protected-branch jobs. Add a `resource_group` so deployments do not overlap, and keep the deployment history for audit.

### [intermediate] How do you reuse pipeline configuration across many projects? {#reuse-q}

Put shared YAML in a central templates project and `include` it with a pinned `ref`, define hidden jobs (names starting with a dot) and inherit them with `extends`, or publish versioned CI/CD components with inputs. A platform team can then provide approved build, scan and deploy jobs, and compliance pipelines or security policies can enforce that mandatory jobs run. Pin the version of included templates, like a library, because a change in a template affects every project that uses it.

### [intermediate] How do you build a Docker image in a GitLab pipeline safely? {#image-q}

Avoid a plain `docker build`, which needs a Docker daemon. Use **Kaniko** or **Buildah**, which build images without a daemon or privileges, and push them to the project's container registry with `CI_REGISTRY_IMAGE` and a tag from `CI_COMMIT_SHORT_SHA`. Docker-in-Docker works but needs a privileged container, which is a security risk on shared runners. Build only on the default branch or tags, scan the image, and promote the same image to every environment.

### [intermediate] A pipeline takes 25 minutes. How do you make it faster? {#faster-q}

Measure which jobs are on the critical path. Use `needs` so jobs do not wait for a whole stage, run independent jobs in parallel and split big test suites with `parallel`. Cache the dependencies with a key from the lock file, use small, pre-built job images, and avoid downloading unneeded artifacts with `dependencies` or `needs:artifacts`. Make jobs `interruptible` so obsolete pipelines are cancelled, run slow jobs only in merge requests or nightly where appropriate, and use `rules:changes` in a monorepo so only affected parts run.

### [intermediate] What are protected variables and why do they matter? {#protected-q}

A protected variable is passed only to jobs that run on protected branches or tags. Without this, anyone who can push a branch and edit `.gitlab-ci.yml` could print a secret in a job. With protection, a feature branch or a merge request from a branch that is not protected cannot read production credentials. Combine them with protected runners and protected environments.

### [deep] Design the GitLab pipelines for a bank's microservice platform. {#design-q}

A central templates project, owned by the platform team and versioned with tags, defines the standard pipeline: build, unit tests, SAST, dependency, secret and container scanning, SBOM, image build with Kaniko, signing, and deployment jobs. Services `include` a pinned version and add only their specifics, while compliance pipelines make the security stages mandatory. Merge request pipelines run the checks, and the default branch builds one image tagged with the commit SHA and promotes it through test and UAT to production. Production is manual, in a protected environment with approvals from a named group (four-eyes) and a code-owner review rule on the protected branch. Runners are ephemeral Kubernetes pods in separated zones, with credentials obtained by OIDC from Vault, and protected runners handle deployment. Deployment history, scan reports and audit events are kept as evidence, and metrics on pipeline duration and failure rate are monitored.

### [deep] How would you handle a monorepo with many services in GitLab CI? {#monorepo-q}

Use a parent pipeline with `rules:changes` that triggers a **child pipeline** (`trigger: include:`) only for the services whose files changed, each defined in its own YAML so every service keeps a small pipeline. Share common behaviour with `include` and `extends`, use `needs` to order the jobs that depend on each other, share a Maven or Gradle cache by key, and run a full pipeline on a schedule or on the release branch to catch cross-service problems. Beware that `changes` compares with the right base (use merge request pipelines or `compare_to`), and that shared libraries must trigger the services that depend on them.

### [deep] How do runners create a security risk, and how do you reduce it? {#runner-risk-q}

A runner executes arbitrary commands from the pipeline file, so anyone who can change that file in a pipeline that uses the runner can run code on it. Risks are stolen secrets, access to the internal network, and a runner that is reused with leftover state or privileged Docker. Reduce them by using ephemeral containers or pods, no privileged mode (Kaniko instead of Docker-in-Docker), separate runners for untrusted merge requests and for deployments, **protected runners** for protected branches only, tags that match jobs to the right runner, network limits, short-lived credentials by OIDC, and keeping the runner software updated.

### [deep] Compare GitLab CI, Jenkins and GitHub Actions, and say when you would choose each. {#compare-q}

Jenkins is a separate, self-run automation server with unmatched flexibility and plugins, suited to complex or legacy estates and strict on-premises control, at the cost of operating the controller and plugins. GitHub Actions is built into GitHub with a big marketplace and low upkeep, a natural fit for GitHub-centred teams. GitLab CI/CD is part of an all-in-one platform (repository, registry, security scans, environments, approvals), which suits teams that want one tool and strong built-in DevSecOps, including self-managed in a bank. The practices (pipeline as code, build once, quality gates) are the same, so the choice follows where the code lives, the compliance needs and the effort the team can spend on operating the tool.

### [coding] Write a `.gitlab-ci.yml` that builds a Maven project with a dependency cache, runs tests with a JUnit report, and builds and pushes an image from the default branch only. {#coding-pipeline}

```yaml
stages: [build, test, package]

default:
  image: maven:3.9-eclipse-temurin-21
  interruptible: true

variables:
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"

cache:
  key: { files: [pom.xml] }
  paths: [.m2/repository]

build:
  stage: build
  script: mvn -B -DskipTests package
  artifacts:
    paths: [target/*.jar]
    expire_in: 1 week

test:
  stage: test
  needs: [build]
  script: mvn -B test
  artifacts:
    when: always
    reports:
      junit: target/surefire-reports/TEST-*.xml

image:
  stage: package
  needs: [build]
  image: { name: gcr.io/kaniko-project/executor:debug, entrypoint: [""] }
  script:
    - mkdir -p /kaniko/.docker
    - echo "{\"auths\":{\"$CI_REGISTRY\":{\"username\":\"$CI_REGISTRY_USER\",\"password\":\"$CI_REGISTRY_PASSWORD\"}}}" > /kaniko/.docker/config.json
    - /kaniko/executor --context "$CI_PROJECT_DIR" --dockerfile Dockerfile
        --destination "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Explain: the cache key comes from `pom.xml`, so it changes only when dependencies change, and it is only a speed-up; the JAR is an **artifact** passed to the next jobs; `needs` lets the image job start as soon as the build is done, without waiting for the tests; the JUnit report is uploaded even when tests fail (`when: always`) and shows in the merge request; Kaniko builds without a Docker daemon, using the job's own registry credentials (`CI_REGISTRY_USER` and `CI_REGISTRY_PASSWORD` are provided by GitLab, so nothing is stored); the image is tagged with the commit SHA; and `rules` keeps merge requests from publishing images. Add `workflow:rules` so a push does not create both a branch and a merge request pipeline.

### [coding] Add a manual, protected production deployment that only runs for a release tag and cannot overlap. {#coding-deploy}

```yaml
deploy-production:
  stage: deploy
  image: bitnami/kubectl:1.30
  environment:
    name: production
    url: https://payments.example-bank.com
  resource_group: production                     # one production deployment at a time
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.example-bank.com        # short-lived identity, no stored password
  script:
    - ./scripts/get-kubeconfig.sh "$VAULT_ID_TOKEN"
    - kubectl set image deployment/payments payments="$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA"
    - kubectl rollout status deployment/payments --timeout=180s
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/    # only a release tag, never a branch
      when: manual
    - when: never
```

Explain: the job exists only for a release tag and waits for a person, and the **protected environment** `production` (configured in the project settings) limits who may press play and requires approvals, which gives four-eyes; the `resource_group` serialises deployments; the **ID token** is exchanged for temporary credentials in Vault, so no long-lived cluster key is stored in a variable; `kubectl rollout status` fails the job if the new version does not become healthy, which is the signal for a rollback to the previous deployment from the environment page; and the deployed image is exactly the one built and tested earlier, not rebuilt.

### [coding] Write reusable pipeline configuration: a central template and a service that uses it with `include` and `extends`. {#coding-reuse}

```yaml
# project platform/ci-templates, file java/maven-service.yml
.maven-job:
  image: maven:3.9-eclipse-temurin-21
  cache:
    key: { files: [pom.xml] }
    paths: [.m2/repository]
  variables:
    MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"

maven-test:
  extends: .maven-job
  stage: test
  script: mvn -B test
  artifacts:
    when: always
    reports: { junit: target/surefire-reports/TEST-*.xml }

dependency-scan:
  extends: .maven-job
  stage: test
  script: mvn -B org.owasp:dependency-check-maven:check
```

```yaml
# a service's own .gitlab-ci.yml
include:
  - project: 'platform/ci-templates'
    ref: v3.2.0                       # pinned, upgraded on purpose
    file: '/java/maven-service.yml'

stages: [test, deploy]

deploy-test:
  stage: deploy
  script: ./deploy.sh test "$CI_COMMIT_SHORT_SHA"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Explain: the platform team owns the hidden `.maven-job` and the test and scan jobs, so every service gets the same build image, cache and mandatory security scan; the service adds only its own deploy job; the `ref` is pinned to a version, so a change to the template does not silently change every pipeline, and an upgrade is a deliberate, reviewed commit. In a regulated setting, a compliance pipeline or a security policy would also force the scan job to exist even if a project left the `include` out.
