---
title: CI/CD fundamentals — pipelines, quality gates, branching and delivery
nav: CI/CD fundamentals
slug: cicd-fundamentals
summary: What continuous integration, continuous delivery and continuous deployment mean and how they differ, the stages of a pipeline from commit to production, build once and promote the same artifact, quality gates, trunk-based development against long-lived branches and feature flags, pipelines as code with GitHub Actions and Jenkins, secrets, rollback, the DORA metrics, and how a bank adds approvals and audit evidence, with examples and interview questions.
tags: [CI/CD, Pipeline, Git, Jenkins, GitHub Actions, DevOps, Delivery]
order: 49
topic: CI/CD / Basics
updated: 2026-11-17
subnav: true
---

Before CI/CD, a release was an event: weeks of work merged at the end, a long test phase, a weekend deployment with a checklist, and a lot of fear. **Continuous integration and delivery** replace that with a small, automatic, repeatable path from a commit to production, so releasing is boring. Interviews ask *what CI and CD mean, how continuous delivery differs from continuous deployment, what the stages of a pipeline are, why you build the artifact once, what trunk-based development is, how you stop a bad change, how you roll back, and how a regulated bank still ships often.* Play the four scenes: the pipeline from commit to production, the three levels of automation, branching, and quality gates.

```demo
name: cicd-walk
```

> **One sentence to remember:** *Integrate small changes into the main branch many times a day, let an automatic pipeline build and test every one of them, build the artifact once and promote that same artifact through the environments, and make every release easy to verify and to roll back.*

## CI, continuous delivery and continuous deployment {#definitions}

The three terms describe how far the automation goes:

| Term | What it means | Who presses the button for production? |
| --- | --- | --- |
| **Continuous integration (CI)** | Developers merge into the shared main branch **often** (at least daily). Every merge is built and tested automatically, so integration problems appear within minutes. | nobody, this stage does not deploy |
| **Continuous delivery (CD)** | Every change that passes the pipeline is a **release candidate** that *could* go live at any moment, through an automated path. | **a person** decides when (an approval, a release window) |
| **Continuous deployment** | Every change that passes the pipeline **goes live automatically**. | **nobody** |

So "CD" stands for two different things, and interviewers like to check that you know it. Most banks practise **continuous delivery**: the pipeline is fully automatic up to a final approval, because a change approval and a controlled release time are required. **Deploying** (putting code on servers) is also not the same as **releasing** (making a feature visible to users): with a [feature flag](lesson:cicd-fundamentals#branching) you can deploy daily and release when the business is ready.

## The stages of a pipeline {#stages}

A **pipeline** is the automated sequence of steps that every change goes through. A typical one for a Spring Boot service:

| Stage | What happens | Fails the pipeline when |
| --- | --- | --- |
| **Trigger** | a push or a pull request, a schedule, or a tag | not applicable |
| **Build** | check out the code, compile, resolve dependencies with [Maven](lesson:maven) or [Gradle](lesson:gradle) | it does not compile |
| **Unit tests** | fast tests of plain classes (see [testing](lesson:spring-testing)) | any test fails |
| **Static analysis** | SonarQube, Checkstyle, SpotBugs: bugs, code smells, duplicated code, coverage | the quality gate is red |
| **Security scans** | dependency scan (known CVEs), secret scan, later an image scan | a critical vulnerability or a leaked secret is found |
| **Package** | build the **artifact**: a JAR, and a container image (see [Docker](lesson:docker)) tagged with the version | the image cannot be built |
| **Publish** | push the artifact to a **repository** (Nexus, Artifactory) or an image registry | not applicable |
| **Deploy to test** | deploy that artifact to a test environment, for example on [Kubernetes](lesson:kubernetes) | the deployment does not become healthy |
| **Integration and end-to-end tests** | slower tests against the running application and real dependencies | a test fails |
| **Approval** | a person or a rule decides to go on (continuous delivery) | rejected |
| **Deploy to production** | the same artifact, with production configuration | the rollout does not become healthy |
| **Verify** | smoke test, health checks, then watch the [metrics](lesson:spring-observability) | the checks fail, so roll back |

Two ordering rules: put the **fastest checks first** so a developer learns about a problem in minutes (*fail fast*), and run independent steps **in parallel**. A good target is feedback from the main pipeline in **under ten minutes**, with slower checks running after the merge.

## Continuous integration in practice {#ci}

CI is a **practice** first and a tool second. A server that builds the code does not make a team do CI. The habits are:

- **Commit small and often** to the main branch (or merge short branches within a day).
- **Keep the build green.** A broken main branch is the team's first priority, and the quickest fix is often to **revert** the change.
- **Make the build self-testing.** A build that only compiles proves little. The tests are what give you the confidence to release.
- **Keep the build fast.** A slow pipeline makes people batch changes, which is the opposite of CI.
- **Everyone sees the result.** Failures are visible and reach the author immediately.
- **Fix flaky tests or remove them.** A test that sometimes fails for no reason teaches the team to ignore red builds.

## Branching: trunk-based, GitHub flow and Gitflow {#branching}

How you branch decides how painful integration is (the third scene).

| Model | How it works | Good for | Watch out for |
| --- | --- | --- | --- |
| **Trunk-based development** | everyone works on `main` or on branches that live **hours to a day**; unfinished work is hidden with **feature flags** | CI and continuous delivery; teams that ship often | needs good tests and discipline |
| **GitHub flow** | `main` is always deployable; each change is a short branch and a **pull request** with review and checks | most teams and services | branches that quietly grow old |
| **Gitflow** | long-lived `develop`, plus `release/*` and `hotfix/*` branches | products with scheduled versions and several supported releases | big merges, late integration, slow delivery |

A **long-lived feature branch** delays integration: the longer it lives, the larger and riskier the final merge, and the team cannot tell whether the pieces work together until the end. A **feature flag** (a configuration switch) lets you merge and deploy unfinished code that is turned off, and later turn it on for a few users, then everyone, or back off again if it misbehaves, without a new deployment. Remove the flag when the feature is done, or flags become clutter.

A **pull request** adds a human check before merging: a reviewer other than the author reads the change while the pipeline runs the same checks that main will run. Keep them small, because reviews of 100 lines are real reviews and reviews of 2,000 lines are not.

## Artifacts, versions and environments {#artifacts}

The most important rule of delivery: **build once, promote the same artifact.**

- The pipeline builds the artifact (a JAR in an image) **one time**, gives it a unique, immutable version (for example `payments:1.4.2` or the commit hash), stores it in a repository and then **promotes that exact artifact** to test, UAT and production. Rebuilding for each environment means production runs something that was never tested.
- **Never deploy `latest`.** A moving tag means you cannot tell what is running or what to roll back to. Use a version or an image digest.
- **Configuration is not part of the artifact.** The same image runs everywhere, and environment-specific settings (URLs, credentials, feature flags) come from the environment: environment variables, a config server, ConfigMaps and Secrets. (This is factor III of the twelve-factor app.)
- **Environments** (dev, test, UAT or staging, production) should be as similar as possible and created from code, so a bug found in test is not "an environment difference".
- **Immutable infrastructure:** replace servers and containers with new ones instead of patching them by hand.
- **Database changes** are part of the pipeline: use a migration tool (Flyway or Liquibase), keep migrations in version control, and make them **backward compatible** with the version that is still running during the rollout.

## Quality gates {#gates}

A **quality gate** is an automatic rule that decides whether a change may go on (the fourth scene). Examples:

- all unit and integration tests pass;
- **coverage** of new code is at least a set level (a useful signal, not a goal in itself: tests must assert something);
- **static analysis**: no new bugs, vulnerabilities or serious code smells (SonarQube's gate checks the *new code* so old debt does not block everyone);
- **dependency scan** (software composition analysis): no library with a critical known vulnerability (OWASP Dependency-Check, Snyk, Trivy, Dependabot);
- **secret scan**: no passwords or keys in the code;
- **image scan** and a check that the base image is allowed;
- **license check** and, in regulated teams, a signed-off change record.

A gate is only worth having if a failure **blocks** the pipeline. A report that nobody has to act on is noise.

## A pipeline as code {#as-code}

The pipeline definition lives **in the repository** next to the code (a *pipeline as code*), so it is versioned, reviewed and reproducible. The same idea with different syntax appears in every tool: GitHub Actions (`.github/workflows/*.yml`), GitLab CI (`.gitlab-ci.yml`), Jenkins (`Jenkinsfile`), Azure DevOps (`azure-pipelines.yml`), Tekton (Kubernetes resources).

```yaml
# .github/workflows/ci.yml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven                       # reuse downloaded dependencies between runs
      - name: Build and test
        run: mvn -B verify                   # compile, unit and integration tests, package
      - uses: actions/upload-artifact@v4
        with:
          name: payments-jar
          path: target/*.jar
```

Habits that make a pipeline trustworthy: pin the versions of tools and actions, **cache** dependencies, run steps in **parallel**, keep secrets in the tool's secret store and **never print them** in logs, use short-lived credentials instead of stored passwords where the platform allows it, and keep the pipeline itself under code review, because anyone who can change the pipeline can run code with its permissions.

## Rollback and recovery {#rollback}

Every release needs a way back, decided **before** the release:

- **Roll back** by redeploying the previous artifact. It is quick and safe when the change is not tied to a database change that cannot be undone.
- **Roll forward** with a quick fix when going back is not possible (for example, data has already been migrated).
- **Feature flags** switch a feature off without redeploying anything.
- **Automatic rollback** is triggered by health checks and metrics after a rollout (more in the deployment strategies lessons).
- Keep changes **small**: a small change is easy to understand, to test and to undo.

## Measuring delivery: DORA metrics {#metrics}

The DORA research (the *Accelerate* book and the annual State of DevOps reports) found four measures that predict software delivery performance:

| Metric | Question it answers |
| --- | --- |
| **Deployment frequency** | how often do we release to production? |
| **Lead time for changes** | how long from a commit to running in production? |
| **Change failure rate** | what share of releases cause a failure or need a fix? |
| **Time to restore** (failed deployment recovery time) | how long to recover after a failed release or an incident? |

The first two measure **speed** and the last two measure **stability**. The finding that matters: high-performing teams are good at both at the same time, because small, frequent, automated releases are *safer*. Newer DORA reports also look at rework. Use the numbers to find the bottleneck in your process, and never as a target for ranking individuals.

## Common problems {#problems}

- **Slow pipelines** (30 minutes and more): fix by parallelising, caching, splitting fast and slow tests, and removing pointless steps.
- **Flaky tests:** quarantine and fix them. Do not just re-run the build until it is green.
- **"Works on my machine":** make the build run in a clean, defined environment (a container), the same one locally and in CI.
- **Manual steps** inside the process, such as a hand-edited server or a copied file, which are not repeatable.
- **Secrets in the repository** or in build logs.
- **A pipeline that is ignored:** red builds that stay red, gates that everyone can bypass.
- **Environment drift:** test and production differ, so test results mean little.

## CI/CD in a bank {#bank}

A regulated bank has extra requirements, and a good pipeline can *meet* them rather than fight them:

- **Change management and approvals.** The approval stage is real: a change record, a release window, and sign-off by someone with the right role.
- **Segregation of duties (the four-eyes principle).** The author of a change must not be the only approver, and the person who can change the pipeline or deploy to production is controlled. Branch protection and required reviewers enforce this.
- **Audit trail and evidence.** The pipeline keeps build logs, test reports, scan results, who approved what and which exact artifact reached production, so an auditor can see the whole chain without screenshots.
- **Controlled production access.** Production deployments run from the pipeline with a dedicated, tightly scoped identity, not from developers' laptops.
- **Security by default.** Dependency and image scanning, secret scanning and signed artifacts are gates, because a bank cannot accept known critical vulnerabilities.

The result is often **continuous delivery with an approval gate**, an automated path that is the *same* for every change, and releases that are frequent but controlled.

## Cheat sheet {#cheatsheet}

| Need | Rule |
| --- | --- |
| CI | merge small changes often, every merge built and tested automatically |
| continuous delivery | always releasable, a **person** decides to release |
| continuous deployment | every passing change goes live **automatically** |
| one artifact | build once, version it, promote the same one everywhere |
| image tags | a version or digest, never `latest` |
| configuration | outside the artifact, per environment |
| fast feedback | cheap checks first, run in parallel, under about 10 minutes |
| branching | short branches or trunk-based, feature flags for unfinished work |
| quality gate | tests, static analysis, dependency and secret scans, blocking |
| pipeline as code | `Jenkinsfile`, `.github/workflows`, `.gitlab-ci.yml` in the repository |
| rollback | redeploy the previous artifact, or switch a feature flag off |
| DORA | deployment frequency, lead time, change failure rate, time to restore |
| bank | approvals, four-eyes, audit evidence, controlled production access |

## Interview questions {#questions}

### [basic] What is continuous integration? {#ci-q}

Continuous integration is the practice of merging every developer's changes into a shared main branch often, at least daily, and verifying each merge with an automatic build and test run. Its purpose is to find integration problems within minutes instead of at the end of a long branch. The tool (Jenkins, GitHub Actions, GitLab CI) is only support: CI also needs small commits, a fast, self-testing build and a team that fixes a broken main branch immediately.

### [basic] What is the difference between continuous delivery and continuous deployment? {#cd-q}

Both extend CI with an automated path to production. In **continuous delivery** every change that passes the pipeline is ready to release, and a **person** decides when to push the button. In **continuous deployment** there is **no human step**: every passing change goes live automatically. Continuous deployment needs excellent automated tests, monitoring and fast rollback. Banks usually practise continuous delivery, because change approval and release windows are required.

### [basic] What are the typical stages of a pipeline? {#stages-q}

Trigger on a commit, build, unit tests, static analysis and security scans (quality gates), package an artifact such as a JAR and an image, publish it to a repository or registry, deploy to a test environment, run integration and end-to-end tests, get approval, deploy the **same** artifact to production, then verify with a smoke test and monitoring, with a rollback path. Cheap, fast stages come first so failures are found early.

### [basic] What is an artifact, and why build it once? {#artifact-q}

An artifact is the deployable output of a build: a JAR, a container image, a package. It is built **once**, given an immutable version, stored in a repository and then **promoted** through the environments. Rebuilding for each environment risks production running a binary that was never tested, because a rebuild can pick up different dependencies or a different environment. Configuration that differs per environment is injected at deploy time and is not baked in.

### [basic] What is a quality gate? {#gate-q}

An automatic rule at a point in the pipeline that decides whether a change may continue: tests pass, coverage of new code is above a threshold, no new serious static-analysis issues, no critical vulnerability in dependencies, no secrets in the code. A failed gate **stops** the pipeline, so the problem is fixed before the change reaches production. A gate that does not block anything is just a report.

### [basic] What does "pipeline as code" mean and why is it useful? {#as-code-q}

The pipeline definition is a file in the repository (`Jenkinsfile`, `.github/workflows/ci.yml`, `.gitlab-ci.yml`) and not settings clicked together in a UI. It is versioned with the code, reviewed in pull requests, reproducible, easy to copy to a new service and easy to roll back, and a branch can change its own build. It also makes the pipeline itself something to review and protect, because it can run code with credentials.

### [intermediate] Compare trunk-based development, GitHub flow and Gitflow. {#branching-q}

**Trunk-based:** everyone integrates into `main` at least daily, with branches that live hours, and unfinished work hidden behind feature flags. It fits CI and continuous delivery best. **GitHub flow:** `main` is always deployable and every change is a short branch with a pull request. **Gitflow:** long-lived `develop`, `release` and `hotfix` branches, which suits versioned products with several supported releases but delays integration and creates large merges. For a service that is deployed continuously, trunk-based or GitHub flow is the better choice.

### [intermediate] Why are long-lived branches a problem for CI? {#long-branch-q}

The longer a branch lives, the further it drifts from main. Merging it means resolving many conflicts, and the combination of the changes is untested until the end, so the risk is high and discovered late. Reviews of a huge change are shallow. Continuous integration reverses this: integrate small pieces often, so each integration is cheap and a failure points at a small change. Use feature flags to merge unfinished work safely.

### [intermediate] What is a feature flag, and how does it relate to CI/CD? {#flag-q}

A feature flag is a configuration switch that turns code paths on or off at run time. It separates **deploy** from **release**: unfinished or risky code can be merged and deployed to production with the flag off, then enabled for a small group, widened gradually and switched off instantly if something goes wrong, without a new deployment. The costs are extra code paths to test and the discipline of removing flags once a feature is fully released.

### [intermediate] What does "fail fast" mean in a pipeline, and how do you achieve a fast pipeline? {#fail-fast-q}

It means a problem is reported as early and as cheaply as possible, so the author gets feedback in minutes. Order the stages from fastest to slowest (compile and unit tests before integration tests), stop at the first failure, run independent jobs in parallel, cache dependencies and build layers, run only what is affected when possible, and keep slow end-to-end tests outside the critical merge path or limit them to a few critical journeys. A common target is main-pipeline feedback in under ten minutes.

### [intermediate] How do you deal with flaky tests? {#flaky-q}

A flaky test passes and fails without a code change, usually because of timing, shared state, test order, real clocks, network calls or external services. It destroys trust, because people stop believing red builds. Find the cause and fix it (remove sleeps and use proper waiting, isolate data, fix the clock, use Testcontainers instead of shared services), **quarantine** it so it does not block the pipeline while it is being fixed, track flakiness, and do not simply re-run until green. Delete a test that cannot be made reliable and cover the behaviour another way.

### [intermediate] Why should you not deploy the `latest` tag, and how should artifacts be versioned? {#latest-q}

`latest` moves, so you cannot say which build is running, you cannot reproduce a deployment, and a rollback has nothing to go back to. Tag each artifact with an immutable identifier: a semantic version (`1.4.2`), the commit hash, a build number, or the image digest, and deploy exactly that. Often both a human-readable version and the commit hash are used, so any running instance can be traced to its source.

### [intermediate] How do you handle configuration and secrets across environments? {#config-q}

The artifact stays the same in every environment, and everything that differs, such as URLs, limits and credentials, comes from the environment through environment variables, a config server, or Kubernetes ConfigMaps and Secrets. Secrets must never be in the repository, in the image or in logs: use a secret store such as Vault or the platform's secret manager, inject them at run time, scope them narrowly and rotate them, and prefer short-lived credentials (for example OIDC federation) to long-lived keys in the pipeline.

### [intermediate] Rollback or roll forward? {#rollback-q}

Rolling back means redeploying the previous artifact, which is fast and predictable and is the default when something is wrong. It is not always possible: if a release already ran an irreversible database migration or sent messages in a new format, the old version may not work with the new data. Then you roll forward with a quick fix. That is why migrations are made backward compatible, why releases are small, and why feature flags are useful: switching a flag off is a rollback without a deployment.

### [intermediate] What are the DORA metrics and what do they tell you? {#dora-q}

Four measures from the DORA research: **deployment frequency**, **lead time for changes** (commit to production), **change failure rate** and **time to restore service** (recovery time after a failed change). The first two show speed, the last two stability. The research found that the best teams are strong in both, because small, frequent, automated changes are safer. The numbers help locate bottlenecks (long lead time often points to slow reviews, slow pipelines or manual approvals) and should not be used to compare or rank people.

### [intermediate] Where do different kinds of tests belong in a pipeline? {#tests-q}

Follow the test pyramid. Many fast **unit tests** run first on every commit. Fewer **integration tests** (a database or broker through Testcontainers, a Spring slice test) run next. A small number of **end-to-end and contract tests** run against a deployed test environment. Then a **smoke test** runs after each deployment, and performance or security tests may run on a schedule or before release. Each level catches different problems, and the slower and more fragile the test, the fewer of them you keep. See [testing](lesson:spring-testing).

### [deep] How would you design a pipeline for a payment service in a regulated bank? {#design-q}

Pipeline as code in the repository, triggered by every pull request and merge. Build and unit-test in a clean container, run static analysis, dependency, secret and image scans as blocking gates, build **one** versioned image, sign it and push it to an internal registry. Deploy it to test with configuration from the environment, run integration, contract and end-to-end tests, then a change record and approval by a role other than the author (four-eyes) before the **same** image is deployed to production by the pipeline using a scoped identity. Run migrations with Flyway or Liquibase in a backward-compatible way, verify with a smoke test and metrics, keep an automatic or one-step rollback, and keep logs, test reports, scan results and approvals as audit evidence. Measure DORA metrics and alert on the pipeline's health.

### [deep] How do you apply segregation of duties without making delivery slow? {#sod-q}

Move the control from people and tickets into the **pipeline**. Branch protection and required reviewers ensure that someone other than the author approves a change. The pipeline, and only the pipeline, holds production credentials, so nobody deploys from a laptop. Approvals are recorded automatically with the exact artifact, test and scan evidence, so an auditor needs no manual proof. Low-risk changes can follow a pre-approved, automated path and high-risk ones need an extra approver. This gives stronger control than manual steps and is faster, because the evidence is a by-product of the process.

### [deep] What is supply chain security in a pipeline, and what can you do about it? {#supply-chain-q}

The pipeline builds software from code you wrote and from many things you did not: dependencies, plugins, build tools, base images and CI actions. An attacker who compromises any of them reaches production. Counter-measures: pin dependency, plugin and action versions (and verify checksums or hashes), scan for known vulnerabilities, use an internal repository as a proxy and an approved list of base images, produce a **software bill of materials (SBOM)**, **sign** artifacts and verify signatures at deployment, build in clean, ephemeral runners, give the pipeline least-privilege credentials, and protect the pipeline definition with review.

### [deep] How do you handle database changes in continuous delivery? {#db-q}

Keep schema changes in version control and apply them with a migration tool (Flyway or Liquibase) as a pipeline step. During a rolling deployment the old and the new application versions run together against the same database, so each migration must be **backward compatible**. Use the *expand and contract* pattern: first add the new column or table (expand), deploy code that writes and reads both, migrate the data, deploy code that uses only the new structure, and only later drop the old one (contract). Avoid destructive changes in the same release as the code that stops using the old structure, and test the migration on a copy of production-like data.

### [coding] Write a GitHub Actions workflow that builds and tests a Maven project on every pull request, and publishes an image from `main`. {#coding-workflow}

```yaml
name: payments-ci
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven
      - name: Build and test
        run: mvn -B verify

  publish:
    needs: build                                    # runs only if the build and tests passed
    if: github.ref == 'refs/heads/main'             # never from a pull request
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/example-bank/payments:${{ github.sha }}     # an immutable tag, not "latest"
```

Explain: pull requests only build and test, so untrusted code never gets registry credentials; `needs` makes publishing depend on a green build; the token is a short-lived secret and the permissions are the minimum; the image is tagged with the commit hash, so any running container can be traced to its source and rolled back to a known build; `cache: maven` speeds up repeat runs. Add that a real pipeline would also include scans and a deployment job with an approval (`environment` with required reviewers).

### [coding] Write a declarative Jenkins pipeline with parallel tests and a manual approval before production. {#coding-jenkinsfile}

```groovy
pipeline {
    agent any
    options { timeout(time: 30, unit: 'MINUTES') }

    stages {
        stage('Build') {
            steps { sh 'mvn -B -DskipTests package' }
        }
        stage('Test') {
            parallel {
                stage('Unit tests')        { steps { sh 'mvn -B test' } }
                stage('Static analysis')   { steps { sh 'mvn -B sonar:sonar' } }
                stage('Dependency scan')   { steps { sh 'mvn -B org.owasp:dependency-check-maven:check' } }
            }
        }
        stage('Deploy to test') {
            steps { sh './deploy.sh test "${BUILD_NUMBER}"' }
        }
        stage('Approval') {
            steps {
                input message: 'Deploy build ${BUILD_NUMBER} to production?',
                      ok: 'Deploy', submitter: 'release-managers'
            }
        }
        stage('Deploy to production') {
            steps { sh './deploy.sh production "${BUILD_NUMBER}"' }
        }
    }

    post {
        always  { junit '**/target/surefire-reports/*.xml' }
        failure { echo 'Build failed: notify the team' }
    }
}
```

Explain: the three checks are independent, so they run in parallel and shorten the pipeline; `input` pauses for a person from the named group, which is the continuous-delivery approval gate and is recorded in the build; `submitter` limits who may approve; the same build number identifies the artifact that is deployed to both environments; the timeout stops a hung pipeline; and `post` always publishes the test report. A real script would add credentials with `withCredentials`, and the deploy script would be idempotent.

### [coding] Write a smoke-test script that a pipeline runs after a deployment and that fails if the service does not become healthy. {#coding-smoke}

```bash
#!/usr/bin/env bash
set -euo pipefail

URL="${1:?usage: smoke.sh <base-url> <expected-version>}"
EXPECTED="${2:?missing expected version}"

for attempt in $(seq 1 30); do
  if body=$(curl --fail --silent --max-time 3 "$URL/actuator/health"); then
    if echo "$body" | grep -q '"status":"UP"'; then
      running=$(curl --fail --silent --max-time 3 "$URL/actuator/info" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
      if [ "$running" = "$EXPECTED" ]; then
        echo "OK: version $running is healthy"
        exit 0
      fi
      echo "Healthy, but running $running instead of $EXPECTED (old pods still serving?)"
    fi
  fi
  echo "Attempt $attempt not ready, waiting"
  sleep 5
done

echo "FAILED: $EXPECTED did not become healthy in time" >&2
exit 1
```

Explain: the script retries for a few minutes because a new version needs time to start (the readiness probe), `--fail` turns HTTP errors into a non-zero exit, `set -euo pipefail` stops on any error, and checking the **version** as well as the health proves that the new release, not the old one, is serving traffic. A non-zero exit fails the pipeline stage and can trigger the rollback step. A fuller smoke test would also run one harmless business call, such as reading a test account.
