---
title: Terraform and infrastructure as code — plan, state, modules and pipelines
nav: Terraform
slug: terraform
summary: Infrastructure as code with Terraform, declarative versus imperative, the init, plan and apply workflow, providers, resources, variables, outputs, locals, data sources, count and for_each, lifecycle rules, the state file and remote backends with locking, drift, import, moved and removed blocks, modules and environments, workspaces versus folders, version pinning and the lock file, secrets and sensitive values, running Terraform in a CI/CD pipeline with plan review, policy as code and OIDC, testing with validate, tflint and terraform test, OpenTofu and the licence change, and how Terraform compares with CloudFormation, CDK, Pulumi and Ansible, with banking examples and interview questions.
tags: [Terraform, IaC, Infrastructure as code, OpenTofu, State, Modules, CI/CD, AWS, DevOps, Cloud]
order: 96
topic: Cloud / Infrastructure as code
updated: 2026-11-28
subnav: true
---

A cloud interview often asks how you build the infrastructure, not only what it is. Expect questions like these:

- What is infrastructure as code, and why use it?
- What is the difference between `terraform plan` and `terraform apply`?
- What is the state file, and why is it dangerous to lose or leak it?
- How do two engineers work on the same infrastructure safely?
- What is drift, and how do you find it?
- How do you keep dev, stage and prod apart?
- How do you run Terraform in a pipeline?
- Where do secrets go?

This lesson builds on [Cloud basics](lesson:cloud-basics#cloud-native), [the AWS service map](lesson:aws-service-map#bank) and [CI/CD fundamentals](lesson:cicd-fundamentals#stages). The examples use AWS and a bank. Play the four scenes: init, plan and apply, state and drift, modules and environments, and the pipeline.

```demo
name: terraform-walk
```

> **One sentence to remember:** *You write the infrastructure you want, Terraform shows the plan, and only then does it change anything.*

In more detail: the state file links your code to the real resources, modules and separate states keep environments apart, and a pipeline makes every change reviewed and repeatable.

## What infrastructure as code is {#what}

**Infrastructure as code (IaC)** means you describe servers, networks, databases and permissions in text files, and a tool creates them from those files. The files live in git, like application code.

Compare this with clicking in the cloud console. Console changes are fast the first time, but nobody can review them, repeat them, or undo them with confidence. With code you get:

- **Review.** A teammate reads the change in a pull request before it happens.
- **Repeatability.** The same code builds dev, stage and prod. The three environments stay alike.
- **History.** Git shows who changed what, when and why.
- **Recovery.** After a disaster you can rebuild the infrastructure from the code.
- **Speed.** A new environment takes minutes, not days.

Two styles of tools exist:

| Style | Meaning | Example |
| --- | --- | --- |
| **Declarative** | You describe the end result. The tool works out the steps. | Terraform, CloudFormation |
| **Imperative** | You write the steps in order. | A shell script with `aws` commands |

**Terraform** is a declarative tool made by HashiCorp. You write "I want a bucket with encryption on". Terraform compares that with what exists, and creates or changes only what is needed. It works with any cloud and many other services through plugins called **providers**.

**The licence change.** In 2023 HashiCorp changed Terraform's licence from an open-source one to the Business Source License. The community then created **OpenTofu**, an open-source fork that is run by the Linux Foundation. The two tools are very similar in everyday use. Everything in this lesson applies to both, and the command is `tofu` instead of `terraform` in OpenTofu.

**Terraform and other tools.**

| Tool | What it is | Compared with Terraform |
| --- | --- | --- |
| **CloudFormation** | AWS's own IaC service, with JSON or YAML templates | AWS only, with no state file to manage, because AWS keeps the state |
| **AWS CDK** | Write CloudFormation using Java, TypeScript or Python | A real programming language, but still AWS only |
| **Pulumi** | Declarative IaC written in general languages, for many clouds | Same idea as Terraform, with a programming language instead of HCL |
| **Ansible** | Configures servers: installs packages and changes files | Configuration management, not provisioning. They are often used together. |
| **Helm and Kubernetes manifests** | Describe what runs inside a cluster | Terraform builds the cluster. Helm or GitOps deploys the apps. |
| **Crossplane** | Manages cloud resources through Kubernetes objects | Another way to do IaC, from inside a cluster |

The important distinction is **provisioning** (creating the servers, networks and databases) versus **configuration** (setting up what runs on a server). Terraform is mainly for provisioning.

## The workflow: init, plan, apply {#workflow}

Terraform has four main commands (the first scene):

1. **`terraform init`** prepares the folder. It downloads the provider plugins and connects the backend (where the state is stored). Run it once, and again when a provider or module changes.
2. **`terraform plan`** compares your code with the real infrastructure and shows the difference. It changes nothing.
3. **`terraform apply`** makes the changes. It shows the plan first and waits for you to type `yes`.
4. **`terraform destroy`** removes everything the folder manages. Use it for test environments only.

A plan marks every change with a symbol:

```text
Terraform will perform the following actions:

  # aws_s3_bucket.logs will be created
  + resource "aws_s3_bucket" "logs" {
      + bucket = "bank-prod-logs"
    }

  # aws_security_group.app will be updated in-place
  ~ resource "aws_security_group" "app" {
      ~ description = "app tier" -> "application tier"
    }

  # aws_db_instance.main must be replaced
-/+ resource "aws_db_instance" "main" {
      ~ engine_version = "15.4" -> "16.1" # forces replacement
    }

Plan: 2 to add, 1 to change, 1 to destroy.
```

| Symbol | Meaning |
| --- | --- |
| `+` | create |
| `~` | change in place |
| `-` | destroy |
| `-/+` | destroy and create again (a **replacement**) |

**Always read the plan for `-` and `-/+`.** A replacement of a database deletes its data. Terraform tells you which attribute forces the replacement.

In a pipeline, save the plan and apply exactly that file. Then what was reviewed is what runs:

```bash
terraform plan -out=tfplan      # save the plan
terraform apply tfplan          # apply exactly this plan, with no extra prompt
```

How Terraform decides the order: it builds a **dependency graph** from the references in your code. A server that uses `aws_subnet.private.id` waits for the subnet. Resources that do not depend on each other are created at the same time. For a hidden dependency that code cannot show, use `depends_on`.

Other useful commands:

| Command | Purpose |
| --- | --- |
| `terraform fmt` | format the files in the standard style |
| `terraform validate` | check the syntax and the references, without calling the cloud |
| `terraform output` | show the output values |
| `terraform state list` | list what the state manages |
| `terraform apply -replace=ADDRESS` | force one resource to be created again |
| `terraform apply -refresh-only` | update the state to match reality, with no other change |

## The language: HCL {#hcl}

Terraform files use **HCL** (HashiCorp Configuration Language). It reads like configuration, not like a program. These are the building blocks:

| Block | Purpose |
| --- | --- |
| `terraform` | settings: the Terraform version, the providers and the backend |
| `provider` | how to connect to a service, such as AWS and which region |
| `resource` | one thing to create, such as a bucket or a server |
| `data` | read something that already exists, without managing it |
| `variable` | an input you can set from outside |
| `locals` | a named value computed inside the code |
| `output` | a value shown at the end, or passed to other code |
| `module` | a reusable group of the blocks above |

A small but complete example:

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "ap-southeast-1"
}

variable "env" {
  type = string
  validation {
    condition     = contains(["dev", "stage", "prod"], var.env)
    error_message = "env must be dev, stage or prod."
  }
}

locals {
  name = "bank-${var.env}"
  tags = { env = var.env, owner = "payments-team" }
}

resource "aws_s3_bucket" "logs" {
  bucket = "${local.name}-logs"
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id          # a reference: also sets the order
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "logs_bucket" {
  value = aws_s3_bucket.logs.arn
}
```

Things to notice:

- `aws_s3_bucket.logs` is the **address** of a resource: type, then name. Other code uses it as `aws_s3_bucket.logs.id`.
- A reference such as `aws_s3_bucket.logs.id` also tells Terraform the order: the public access block waits for the bucket.
- `version = "~> 5.0"` means "5.x, but not 6". More on versions below.
- A `validation` block rejects a bad input early, with a clear message.

**Setting variables.** In order from lowest to highest priority: the `default`, a `terraform.tfvars` file, `-var-file=prod.tfvars`, environment variables named `TF_VAR_env`, and `-var` on the command line.

**Reading what already exists** with a `data` block:

```hcl
data "aws_vpc" "main" {
  tags = { Name = "bank-shared-vpc" }
}

resource "aws_security_group" "app" {
  vpc_id = data.aws_vpc.main.id
  name   = "${local.name}-app"
}
```

**Making several of a thing.** Use `for_each` over a map or a set. Use `count` only for "none or one" and simple numbers.

```hcl
variable "queues" {
  type    = set(string)
  default = ["payments", "refunds", "alerts"]
}

resource "aws_sqs_queue" "q" {
  for_each = var.queues
  name     = "${local.name}-${each.key}"
}
```

Why `for_each` beats `count` for lists: with `count`, items are identified by their position. Removing the first of three items shifts the others, and Terraform plans to **destroy and re-create** them. With `for_each`, each item has a stable key, so removing one item removes only that one.

Other language features:

- **Expressions and functions.** `join`, `lookup`, `merge`, `length`, `try`, conditionals (`var.env == "prod" ? 3 : 1`) and `for` expressions.
- **`dynamic` blocks** generate repeated nested blocks, such as several ingress rules, from a list.
- **`lifecycle` rules** change how a resource is handled:

```hcl
resource "aws_db_instance" "main" {
  # ...
  lifecycle {
    prevent_destroy       = true               # any plan that destroys it fails
    create_before_destroy = true               # build the new one first, then remove the old one
    ignore_changes        = [tags["last_scan"]] # a tool changes this, so do not fight it
  }
}
```

## State: the file that links code to reality {#state}

Terraform keeps a **state file** (`terraform.tfstate`). It records which real resource belongs to each block in your code, with all of its attributes (the second scene).

Why it is needed:

- **Mapping.** `aws_s3_bucket.logs` is a name in code. The state says it is the bucket `bank-prod-logs`. Without it, Terraform could not tell what it already created.
- **Planning.** The plan compares your code, the state and the real resources.
- **Speed.** It does not have to read every resource each time.
- **Dependencies.** It remembers the order for deletion.

Two warnings about the state file:

1. **It contains secrets.** Database passwords and keys that Terraform handled are stored in it as plain text. Treat it like a password: encrypt it, and limit who can read it. Never commit it to git.
2. **Losing it is a disaster.** Terraform would think nothing exists, and would try to create everything again.

**Remote backends.** For a team, keep the state in a shared place called a **backend**, not on a laptop. The common AWS choice is an S3 bucket:

```hcl
terraform {
  backend "s3" {
    bucket       = "bank-terraform-state"
    key          = "prod/network/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true      # locking: Terraform 1.10 and later
  }
}
```

A good backend gives you:

- **Locking.** While one apply runs, a lock stops a second one. Without it, two applies could corrupt the state. Older setups use a DynamoDB table for the lock. Newer versions can keep a lock file in the bucket.
- **Versioning.** Turn on S3 versioning, so you can restore an older state.
- **Encryption and access control.** Only the pipeline and a few people may read it.

Terraform Cloud (HCP Terraform), GitLab and other products can also store state and add locking, runs and access control.

**Drift** means the real infrastructure changed outside Terraform, for example someone opened a port in the console. The next `terraform plan` shows the difference. You then choose to apply the code and put it back, or change the code to keep the new setting. A plan that runs on a schedule finds drift early.

**Changing state without changing infrastructure.** These tools exist for refactoring:

| Tool | Use |
| --- | --- |
| `import` block | bring an existing resource under Terraform's control |
| `moved` block | tell Terraform that a resource was renamed or moved into a module, so it is not destroyed |
| `removed` block | stop managing a resource without destroying it |
| `terraform state mv`, `terraform state rm` | the same ideas as commands, edited by hand |

```hcl
import {
  to = aws_s3_bucket.legacy
  id = "bank-legacy-reports"      # the real bucket that already exists
}

moved {
  from = aws_s3_bucket.logs
  to   = module.logging.aws_s3_bucket.logs
}
```

The `moved` block is the safe way to rename. Without it, Terraform sees one resource gone and a new one added, and would destroy the real one.

## Modules {#modules}

A **module** is a folder of Terraform files used as one unit. It has **inputs** (variables) and **outputs**. The code you run directly is the **root module**. It calls other modules (the third scene).

```text
infra/
  modules/
    network/        main.tf  variables.tf  outputs.tf
    app/            main.tf  variables.tf  outputs.tf
  envs/
    dev/            main.tf  backend.tf  dev.tfvars
    prod/           main.tf  backend.tf  prod.tfvars
```

```hcl
# envs/prod/main.tf
module "network" {
  source   = "../../modules/network"
  env      = "prod"
  vpc_cidr = "10.20.0.0/16"
}

module "app" {
  source     = "../../modules/app"
  env        = "prod"
  subnet_ids = module.network.private_subnet_ids      # an output of another module
  min_size   = 3
}
```

Good habits for modules:

- **Small and focused.** One module does one job: a network, a database, a service.
- **Few inputs, clear outputs.** Hide the details inside.
- **Versioned.** Modules from a registry or a git tag need a version, so a change upstream cannot surprise you: `source = "git::https://git.bank.example/tf/network.git?ref=v1.4.0"`.
- **No provider settings inside.** The root module configures the provider and passes it in.
- **Do not over-abstract.** A module that wraps one resource and exposes all its arguments adds nothing.

The public **Terraform Registry** holds ready modules, such as a VPC module. Use them with care and with a version. A bank often keeps its own approved modules in a private registry.

## Environments: dev, stage and prod {#envs}

Environments should look alike, but must not share state. There are two common ways:

| Way | How it works | Good | Bad |
| --- | --- | --- | --- |
| **A folder per environment** | `envs/dev`, `envs/prod`, each with its own backend key | clear, separate state, separate access, easy to review | a little repeated code, solved by modules |
| **Workspaces** | one folder, several states selected with `terraform workspace select prod` | no repeated code | the same backend and credentials for all, easy to apply to the wrong one |

Most teams use **folders** for different environments, especially when prod needs stricter access. Workspaces suit temporary copies, such as one environment per feature branch.

A bigger system is also split by **layer**: a network state, a database state, an application state. Each has a small **blast radius** (the damage a mistake can do), runs faster, and can be owned by a different team. Layers share values with outputs and `data` blocks (or the `terraform_remote_state` data source).

Separate **cloud accounts** per environment add a hard wall. Prod then needs different credentials from dev ([accounts and guardrails](lesson:aws-security#organizations)).

## Versions and the lock file {#versions}

Three things can change under you: Terraform itself, the providers and the modules. Pin all three.

| What | How |
| --- | --- |
| Terraform | `required_version = ">= 1.6, < 2.0"` |
| Providers | `version = "~> 5.0"` in `required_providers` |
| Modules | `version = "1.4.0"` or a git tag |

The operator `~> 5.0` means "5.0 or newer, but below 6.0". `~> 5.31.0` means "5.31.x only".

`terraform init` writes **`.terraform.lock.hcl`**. It records the exact provider versions and checksums. **Commit this file.** Then every laptop and the pipeline use the same provider build. To upgrade on purpose, run `terraform init -upgrade`, then read the plan. This is the same idea as a lock file for [dependencies](lesson:dependency-management#pinning).

## Secrets and sensitive values {#secrets}

- **Never write secrets in `.tf` files or in git.** A password in code is a leak.
- Mark a variable or output `sensitive = true`. Terraform then hides it in the plan and the logs. **It is still stored in the state**, so protect the state.
- Let the cloud create and rotate secrets. For example, an RDS database can manage its own master password in Secrets Manager (`manage_master_user_password = true`). The application reads the secret at runtime ([secrets](lesson:aws-security#secrets)).
- Read existing secrets with a `data` block, and pass only their ARN to applications.
- Newer Terraform versions add **ephemeral** values and write-only arguments, which are never saved in the state. Prefer them when your provider supports them.
- Give Terraform's own cloud credentials a role with **least privilege**, and short lifetime (see the pipeline section).

## Terraform in a pipeline {#pipeline}

People should not run `terraform apply` for production from a laptop. A pipeline makes every change reviewed, logged and repeatable (the fourth scene, [CI/CD stages](lesson:cicd-fundamentals#stages)).

**On a pull request:**

1. `terraform fmt -check` and `terraform validate`.
2. A linter such as **tflint**, and a security scanner such as **Checkov** or **Trivy**.
3. `terraform plan -out=tfplan`, then post the plan as a comment.
4. A **policy check** on the plan.
5. A person reviews the code and the plan.

**On merge to main:**

1. `terraform apply` of the plan from the same commit.
2. The lock stops two runs at once.
3. A notification reports the result.

**Policy as code** means rules written as code and checked automatically. Examples: "no public buckets", "encryption is on", "only these instance sizes". Tools include **Open Policy Agent (OPA)** with Conftest, **Sentinel** (in HCP Terraform) and Checkov. People then review the intent, and the machine checks the rules.

**Signing in to the cloud without stored keys.** Use **OIDC** (OpenID Connect). The pipeline proves who it is with a short-lived token, and the cloud gives it a temporary role ([roles for pipelines](lesson:aws-security#roles)). No access key is stored in the CI system. A GitHub Actions example:

```yaml
name: terraform
on:
  pull_request:
  push: { branches: [main] }

permissions:
  id-token: write        # allow the OIDC token
  contents: read
  pull-requests: write   # allow the plan comment

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::111122223333:role/terraform-plan
          aws-region: ap-southeast-1
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
      - run: terraform fmt -check
      - run: terraform validate
      - run: terraform plan -out=tfplan
```

Other good habits:

- Use **separate roles** for plan (read-only) and apply (can change things). The plan role can then run on every pull request without risk.
- Use **environment protection** or manual approval for production.
- Run a **scheduled plan** every night to report drift.
- Use **one state per pipeline job**, so jobs do not wait on each other for the lock.
- Tools such as **Atlantis**, **Terragrunt**, **Spacelift** and **HCP Terraform** add pull-request automation and run management on top of Terraform.

## Testing {#testing}

Infrastructure code needs checks too. From fastest to slowest:

| Level | Tool | What it finds |
| --- | --- | --- |
| Format and syntax | `terraform fmt`, `terraform validate` | typos and broken references |
| Lint | tflint | wrong instance types, deprecated arguments |
| Security scan | Checkov, Trivy | public buckets, open ports, no encryption |
| Plan checks | policy as code on the plan, `check` blocks | rule breaks before apply |
| Unit-style tests | `terraform test` with `.tftest.hcl` files | module behaviour, with `plan` or with mocked providers |
| Integration tests | Terratest, `terraform test` with `apply` | real resources in a throw-away account |

A small `terraform test` file:

```hcl
# tests/logs.tftest.hcl
run "bucket_blocks_public_access" {
  command = plan

  variables {
    env = "dev"
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.logs.block_public_policy == true
    error_message = "The logs bucket must block public policies."
  }
}
```

Test modules in a **sandbox account** with small resources, and destroy them at the end. Never test in production.

## An example for a bank {#example}

A small landing zone for a payments service:

1. **Accounts.** Dev, stage and prod are separate cloud accounts. The pipeline has one role per account.
2. **Repository layout.** `modules/` holds the approved modules. `envs/<name>/` holds one folder per environment, each with its own state key.
3. **State.** One encrypted, versioned bucket in a shared tooling account. Access is only for the pipeline roles.
4. **Network layer first.** VPC, private subnets and endpoints. Outputs: the subnet ids.
5. **Data layer.** A database module with encryption, backups, `prevent_destroy` and deletion protection.
6. **App layer.** A container service module that takes the subnets and the database address as inputs.
7. **Pipeline.** Pull request: fmt, validate, tflint, Checkov, plan comment, two approvers for prod. Merge: apply. Nightly: drift report.
8. **Rules.** Every resource has an owner and a cost-centre tag. Public buckets are blocked by policy. Changes to the database layer need the data team's review.

## For a Java developer {#java}

| Java and Spring | Terraform |
| --- | --- |
| `pom.xml` or `build.gradle` describing what you want | `.tf` files describing the infrastructure you want |
| `mvn dependency:tree` and a lock or BOM | `.terraform.lock.hcl` and version constraints |
| a Maven artifact repository | the Terraform Registry and a private module registry |
| a library with parameters | a module with variables and outputs |
| `application-prod.yml` per environment | `prod.tfvars` or a folder per environment |
| Flyway or Liquibase migrations | the plan and apply, and `moved` blocks for refactoring |
| Spring profiles | variables and workspaces |
| a build that must be repeatable | pinned versions and a saved plan |
| unit tests and integration tests | `terraform test` and Terratest |
| a code review of a diff | a review of the plan |

Try it in the labs: [Plan before apply](lab:tf-plan-apply), [State, locks and drift](lab:tf-state-drift) and [A reviewed Terraform pipeline](lab:tf-pipeline).

## Common mistakes {#mistakes}

| Mistake | Fix |
| --- | --- |
| state kept on a laptop or committed to git | use an encrypted remote backend with locking |
| changing resources in the console | change the code, and run a scheduled plan to find drift |
| applying without reading the plan | read every `-` and `-/+`, and save the plan with `-out` |
| one state for everything | split by environment and layer to limit the blast radius |
| `count` over a list that changes | use `for_each` with stable keys |
| renaming a resource without a `moved` block | add `moved`, or the resource is destroyed and re-created |
| secrets in `.tf` files or variables files in git | use a secrets manager, and mark values `sensitive` |
| unpinned providers and modules | pin versions and commit the lock file |
| a huge module that does everything | small modules with clear inputs and outputs |
| one admin role for all pipelines | separate plan and apply roles, least privilege, OIDC |
| no `prevent_destroy` on databases | add `prevent_destroy` and the provider's deletion protection |
| `terraform destroy` run in the wrong folder | check the backend and the workspace first, and protect prod |

## Related pieces {#related}

- [Cloud basics](lesson:cloud-basics#cloud-native): why cloud-native systems are built from code.
- [AWS accounts and guardrails](lesson:aws-security#organizations): the account layout that Terraform builds into.
- [Kubernetes](lesson:kubernetes#architecture) and [Docker](lesson:docker#images): Terraform often builds the cluster, and other tools deploy the apps.
- [Deployment strategies](lesson:deployment-strategies#overview): how the applications on this infrastructure are released.
- [Dependency management](lesson:dependency-management#pinning): the same idea of pinning and reproducible builds.

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| IaC | infrastructure described in files, reviewed in git, created by a tool |
| declarative | describe the result, the tool finds the steps |
| workflow | `init`, `plan`, `apply`, and `destroy` for test environments |
| plan | safe, changes nothing, read `-` and `-/+` |
| saved plan | `plan -out=tfplan`, then `apply tfplan` |
| state | maps code to real resources, holds secrets, never lose or commit it |
| backend | remote, encrypted, versioned, with locking |
| drift | the real world changed, the next plan shows it |
| `for_each` | stable keys, better than `count` for lists |
| `moved`, `import`, `removed` | refactor state without destroying |
| module | inputs, outputs, small, versioned |
| environments | a folder and a state each, separate accounts |
| versions | pin Terraform, providers and modules, commit the lock file |
| secrets | not in code, `sensitive` hides but does not encrypt the state |
| pipeline | plan on a pull request, apply on merge, OIDC, policy as code |
| testing | fmt, validate, tflint, Checkov, `terraform test`, Terratest |

## Interview questions {#questions}

### [basic] What is infrastructure as code and why use it? {#iac-q}

Infrastructure as code means you describe servers, networks and databases in files, and a tool builds them from the files.

The reasons to use it:

1. Changes are reviewed in a pull request before they happen.
2. The same code builds dev, stage and prod, so they stay alike.
3. Git keeps the history of every change.
4. You can rebuild after a disaster, and create a new environment quickly.

For example, a bank can create an identical test copy of its payments network in minutes, instead of repeating console clicks.

### [basic] What is the difference between `terraform plan` and `terraform apply`? {#plan-apply-q}

`plan` shows what would change and changes nothing. `apply` makes the changes.

`plan` compares your code with the state and the real resources. It lists creates, updates and destroys. `apply` shows the plan, asks for approval, then calls the cloud APIs and updates the state.

In a pipeline you save the plan with `-out` and apply exactly that file, so what was reviewed is what runs.

### [basic] What is declarative infrastructure code? {#declarative-q}

Declarative code describes the end result, not the steps.

You write "a bucket with encryption on". Terraform finds the difference from what exists, and creates or changes only what is needed. If nothing is different, it does nothing. This makes a second `apply` safe: it is **idempotent**, which means that repeating it gives the same result.

A script of `aws` commands is imperative. It runs every step, whatever already exists.

### [basic] What is a Terraform provider? {#provider-q}

A provider is a plugin that lets Terraform talk to one service, such as AWS, Azure, Kubernetes or Datadog.

It defines the resource types for that service (`aws_s3_bucket`) and calls its API. You list providers in `required_providers`, and `terraform init` downloads them. Pin their versions, because a new version can change behaviour.

### [basic] What is the Terraform state file and why does it matter? {#state-q}

The state file records which real resource belongs to each resource block in your code, with its attributes.

It matters for three reasons:

1. Terraform needs it to know what it already created, so it can plan only the changes.
2. It can contain secrets in plain text, so it must be encrypted and access-controlled.
3. If it is lost, Terraform thinks nothing exists, and tries to create everything again.

So keep it in a remote backend, not on a laptop and not in git.

### [basic] What is a module? {#module-q}

A module is a folder of Terraform files that is used as one reusable unit, like a function.

It takes inputs (variables) and gives outputs. The code you run directly is the root module, and it calls other modules. Modules keep code small and consistent. Pin their versions when they come from a registry or git.

### [intermediate] How do two engineers work on the same infrastructure safely? {#team-q}

They use a shared remote backend with locking.

1. The state lives in one place, such as an encrypted, versioned S3 bucket.
2. While one `apply` runs, a lock stops a second one. The second run waits or fails, so the state cannot be corrupted.
3. Changes go through pull requests, and a pipeline applies them, so there is one history and no hand-made changes.

If a lock is stuck after a crash, check that no run is active, then release it with `terraform force-unlock`.

### [intermediate] What is drift and how do you deal with it? {#drift-q}

Drift means the real infrastructure no longer matches the code and the state, because someone changed it outside Terraform.

The next `terraform plan` shows the difference. Then you choose: apply, to put the infrastructure back as the code says, or change the code to accept the new setting.

To catch drift early, run a scheduled plan, and report any difference. To prevent it, limit console access and give changes only through the pipeline.

### [intermediate] `count` or `for_each`: which do you use and why? {#count-q}

Use `for_each` for collections, and `count` only for "none or one".

`count` identifies items by their position. If you remove the first of three items, the others shift down by one, and Terraform plans to destroy and re-create them. `for_each` uses a stable key for each item, so removing one item affects only that one.

An example of `count`: `count = var.enabled ? 1 : 0` to create a resource only in some environments.

### [intermediate] How do you rename a resource without destroying it? {#moved-q}

Add a `moved` block that says the old address is now the new address.

```hcl
moved {
  from = aws_s3_bucket.logs
  to   = module.logging.aws_s3_bucket.logs
}
```

Terraform then updates the state, and the plan shows no destroy. Without it, Terraform sees one resource gone and a new one added, and it would destroy the real resource. The older way is `terraform state mv`, which is a manual command that people can forget.

### [intermediate] How do you bring an existing resource under Terraform? {#import-q}

Write the resource block, then import the real resource into the state.

1. Write a `resource` block that matches the real one.
2. Add an `import` block with the target address and the real id (or run `terraform import`).
3. Run `terraform plan`. Change the code until the plan shows no changes.
4. Apply, to record the import in the state.

Import only brings the resource into the state. It does not write the code for you, and the plan tells you where your code and reality differ.

### [intermediate] How do you manage dev, stage and prod? {#envs-q}

Use the same modules, with a separate folder and a separate state for each environment.

Each folder has its own backend key and its own variable values. Separate cloud accounts, with separate pipeline roles, add a hard wall, so a mistake in dev cannot touch prod.

Workspaces also give separate states, but they share one backend and one set of credentials, so it is easy to apply to the wrong one. They suit temporary copies better than long-lived environments.

### [intermediate] How do you handle secrets in Terraform? {#secrets-q}

Keep secrets out of the code and out of git, and protect the state.

1. Let the cloud create and rotate secrets, such as an RDS-managed master password in Secrets Manager.
2. Read existing secrets with a `data` block, and pass only references to applications.
3. Mark variables and outputs `sensitive = true`. That hides them in the output, but they are still stored in the state.
4. Encrypt the state, and limit access to it.
5. Use ephemeral values or write-only arguments, where the provider supports them.

### [intermediate] How do you run Terraform in a CI/CD pipeline? {#pipeline-q}

Plan on the pull request, and apply on merge.

1. On a pull request: format, validate, lint, security scan, `plan -out`, and post the plan as a comment.
2. Check the plan with policy as code, such as OPA or Checkov, then a person reviews it.
3. On merge to main: apply the plan, with the state lock on.
4. Sign in to the cloud with OIDC and short-lived roles, not stored keys, and use a read-only role for plan.
5. Run a scheduled plan to report drift.

### [deep] What happens if two applies run at the same time without a lock? {#lock-q}

The state can be corrupted, and the infrastructure can end up in a mixed condition.

Both runs read the same starting state. Each makes its own changes and then writes its own version of the state. The last write wins, so the state may miss resources the other run created, or still list ones that were deleted. The next plan would then try to create duplicates, or fail.

A backend with locking prevents this. The second run waits or fails until the first one finishes.

### [deep] A plan shows `-/+` for a production database. What do you do? {#replace-q}

Stop, and do not apply until you understand why.

1. Read which attribute "forces replacement". It is often an engine version, a name, an availability zone or a storage setting.
2. Check whether the provider can change it in place, with a different argument, or whether the change really needs a new database.
3. If it does, plan a migration (a snapshot and restore, or a blue-green copy), not a plain apply.
4. Protect against the mistake: `prevent_destroy`, the provider's deletion protection, and a policy that blocks destroys of data stores.

A replacement of a database deletes its data.

### [deep] How would you structure Terraform for a large bank with many teams? {#structure-q}

Split by layer, by environment and by team, and share through approved modules.

1. **Accounts.** One cloud account per environment and often per workload, with guardrails at the organisation level.
2. **State.** Many small states (network, data, app) instead of one large one, so each has a small blast radius and is owned by one team.
3. **Modules.** A private registry of reviewed, versioned modules that follow the bank's rules (encryption, tags, logging).
4. **Pipeline.** The same pipeline for everyone: checks, policy as code, plan review, apply by role, drift reports.
5. **Access.** Teams use pipeline roles with least privilege, and almost nobody applies by hand to production.

### [deep] When would you pick CloudFormation, CDK, Pulumi or Terraform? {#choose-q}

It depends on the clouds, the team and the rules of the company.

- **CloudFormation or CDK** suit an AWS-only company that wants AWS to keep the state, and gets new AWS features first. CDK lets developers write Java or TypeScript.
- **Terraform or OpenTofu** suit several clouds and services (cloud, Kubernetes, DNS, monitoring) with one tool and a large community.
- **Pulumi** suits teams that want general programming languages with the Terraform-style model.
- **Ansible** is for configuring servers, not for provisioning, and is often used with one of the others.

Whatever the tool, the principles are the same: code in git, review the change, repeatable runs and no manual edits.

### [coding] Write Terraform for a private S3 bucket with versioning and encryption, with variables and an output. {#coding-bucket}

```hcl
variable "env" {
  type = string
}

locals {
  bucket_name = "bank-${var.env}-statements"
}

resource "aws_s3_bucket" "statements" {
  bucket = local.bucket_name
  tags   = { env = var.env, owner = "payments-team" }
}

resource "aws_s3_bucket_public_access_block" "statements" {
  bucket                  = aws_s3_bucket.statements.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "statements" {
  bucket = aws_s3_bucket.statements.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "statements" {
  bucket = aws_s3_bucket.statements.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

output "statements_bucket_arn" {
  value = aws_s3_bucket.statements.arn
}
```

Explain these points:

- Public access is **blocked** first, which is the main control for a bank.
- Versioning and encryption are separate resources in the current AWS provider, and each one **refers to the bucket id**, so the order is correct.
- The name and tags come from a **variable** and a **local**, so one code base serves every environment.
- The **output** passes the ARN to other code.
- Run `plan` first, and read it, before `apply`.

### [coding] Write a remote S3 backend with locking, and a module call that passes outputs between two modules. {#coding-backend}

```hcl
terraform {
  required_version = ">= 1.10"

  backend "s3" {
    bucket       = "bank-terraform-state"
    key          = "prod/app/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}

module "network" {
  source   = "git::https://git.bank.example/tf/network.git?ref=v1.4.0"
  env      = "prod"
  vpc_cidr = "10.20.0.0/16"
}

module "app" {
  source     = "git::https://git.bank.example/tf/app.git?ref=v2.1.0"
  env        = "prod"
  subnet_ids = module.network.private_subnet_ids
  vpc_id     = module.network.vpc_id
}
```

Explain these points:

- The state is **remote, encrypted and locked**, and the key separates the environment and layer.
- `required_version` stops an old Terraform from touching newer state.
- Modules are **pinned to a git tag**, so an upstream change cannot surprise the plan.
- The app module takes the network module's **outputs** as inputs, which also makes Terraform create the network first.
- Older Terraform versions lock with a DynamoDB table instead of `use_lockfile`.

### [coding] A teammate changed a security group in the console. How do you find and fix it? {#coding-drift}

```bash
terraform init
terraform plan -refresh-only      # show only what changed in the real world
terraform plan                    # show what apply would do to put it back
```

```text
  # aws_security_group.app will be updated in-place
  ~ resource "aws_security_group" "app" {
      ~ ingress = [
          - { from_port = 22, cidr_blocks = ["0.0.0.0/0"] ... },
        ]
    }
```

Explain these points:

- `-refresh-only` shows the **drift** without proposing changes to the code.
- The plan shows that port 22 was opened to the whole internet by hand.
- If the change was wrong, **apply** removes it. If it was needed, put the rule **in the code** through a pull request, so it is reviewed and kept.
- To prevent a repeat: limit console permissions, and run a scheduled plan that alerts on drift.
