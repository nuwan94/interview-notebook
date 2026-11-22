---
title: AWS compute — EC2, Auto Scaling, Lambda, ECS, EKS and Fargate
nav: AWS compute
slug: aws-compute
summary: How to choose and run compute on AWS for Java and Spring Boot, EC2 instance types, AMIs, purchasing options and Auto Scaling groups with rolling instance refresh, Lambda with events, concurrency, cold starts and SnapStart for Java, ECS tasks and services on Fargate or EC2, EKS with managed nodes and pod IAM roles, App Runner, Beanstalk and Batch, containers and JVM settings, cost levers such as Graviton and Spot, and what a bank adds, with examples and interview questions.
tags: [AWS, EC2, Lambda, ECS, EKS, Fargate, Auto Scaling, Compute, Java]
order: 55
topic: Cloud / AWS
updated: 2026-11-17
subnav: true
---

Compute is where your code runs, and AWS offers it at several levels of control. Interviews ask *how you choose between EC2, containers and Lambda, how an Auto Scaling group works, how you release to a fleet, what a cold start is and what to do about it for Java, the difference between ECS and EKS, what Fargate does, how a container gets AWS permissions, and how you cut the cost.* This lesson follows the [service map](lesson:aws-service-map#compute). Play the three scenes: an EC2 fleet, a Lambda call, and ECS against EKS.

```demo
name: aws-compute-walk
```

*The AWS service icons in the diagrams are the official AWS Architecture Icons, shown unmodified. This site is not affiliated with, endorsed by or sponsored by Amazon Web Services.*

> **One sentence to remember:** *Pick the most managed compute that fits: Lambda for event-driven work, containers on Fargate for services, EKS when you already run Kubernetes, and EC2 only when you need the machine, and give every one of them an IAM role, a health check, and a way to scale and to roll back.*

```demo
name: aws-map-compute
```

## Choosing compute {#choosing}

The choice trades **control** for **operations**: the more you control, the more you patch, scale and secure yourself.

| Option | You manage | Scales | Good for | Watch out for |
| --- | --- | --- | --- | --- |
| **EC2** | the OS, runtime, patching, scaling | Auto Scaling groups | special hardware, licences, full control, lift and shift | operations load, snowflake servers |
| **ECS on EC2** | the nodes and the tasks | service and cluster scaling | containers where you need node control, GPUs or a large steady load | node patching and capacity |
| **ECS on Fargate** | the tasks only | per task | web services and workers with the least operations | no privileged containers or host access, a little pricier per vCPU |
| **EKS** | Kubernetes objects (and nodes unless Fargate) | HPA, Karpenter | teams standardised on Kubernetes and its ecosystem | Kubernetes complexity, upgrades |
| **Lambda** | the function | per event, to zero | event handlers, glue, spiky or low traffic | cold starts, 15-minute limit, limits on payload |
| **App Runner** | almost nothing: source or image in, service out | automatic | simple web apps and APIs | less control, fewer options |
| **Elastic Beanstalk** | the application, with AWS managing the environment | Auto Scaling | quick web apps, older projects | opinionated, ageing |
| **Batch** | the job definitions | queue-driven, can use Spot | large batch and compute jobs | not for interactive requests |

A reasonable default for a new Spring Boot service is **a container on ECS Fargate or EKS**, with **Lambda** for event-driven pieces around it ([Cloud basics](lesson:cloud-basics#models)).

## EC2 {#ec2}

EC2 gives virtual machines. The parts to know (the first scene):

- **AMI:** the machine image with the OS and software. Use **golden AMIs** built by a pipeline (Packer, EC2 Image Builder) with patches, agents and your Java runtime already in place, so every instance starts the same.
- **Instance types:** a name such as `m7g.large` is a *family* (`m`), a *generation* (`7`), extra letters for features (`g` means AWS Graviton ARM, `i` Intel, `a` AMD), and a *size* (`large`). Families: **general purpose** (`m`, and burstable `t`), **compute optimised** (`c`), **memory optimised** (`r`, `x`), **storage optimised** (`i`, `d`) and **accelerated** (`g`, `p`, GPUs). Java services run well on **Graviton** (ARM) at a better price and performance, if your dependencies have ARM builds.
- **Burstable `t` types** earn CPU credits at idle and spend them in bursts. A steady high load drains the credits and the instance is throttled, so they suit dev and light services only.
- **Storage:** an **EBS** volume is a network disk (survives a stop, can be snapshotted and encrypted), and an **instance store** is a fast local disk that disappears with the instance.
- **Networking and access:** the instance sits in a subnet with a **security group** (a stateful firewall). Reach it with **Systems Manager Session Manager** rather than opening SSH and managing key pairs.
- **IAM role (instance profile):** the application gets temporary credentials from the instance metadata service. Require **IMDSv2** (`HttpTokens: required`) to block the SSRF attacks that steal those credentials.
- **User data:** a script that runs at first boot, for last-minute configuration. Keep it small, and bake the heavy work into the AMI.
- **Placement and tenancy:** placement groups control closeness or spread, and dedicated hosts or instances give single-tenant hardware, for example for licences.

### Purchasing options {#purchasing}

| Option | Price | Commitment | Use for |
| --- | --- | --- | --- |
| **On-Demand** | full price, per second | none | unpredictable or short workloads |
| **Savings Plans / Reserved** | up to about 70 percent off | 1 or 3 years of steady spend | the steady baseline |
| **Spot** | up to about 90 percent off | none, but AWS can reclaim with a 2-minute notice | stateless workers, batch, CI agents, fault-tolerant fleets |
| **Capacity Reservations** | on-demand price | reserved capacity in a zone | guaranteed capacity for a known event |

A common mix is **Savings Plans for the baseline, On-Demand for the peak, Spot for the interruptible work**, spread over several instance types so one Spot pool running dry does not stop the fleet.

## Auto Scaling groups {#auto-scaling}

An **Auto Scaling group (ASG)** keeps a fleet of identical instances (the second and third scenes):

- A **launch template** defines what to launch: AMI, instance type (or several, with an allocation strategy), IAM role, security groups, metadata options, user data and storage. Templates are **versioned**.
- **Capacity:** `min`, `desired` and `max`. Put the group in subnets in **at least two AZs**, and it balances across them and replaces an instance that fails.
- **Health checks:** EC2 status checks only find a dead machine. Add the **ELB health check** so an instance whose application is unhealthy is replaced too, with a **grace period** long enough for a JVM service to start.
- **Scaling policies:** **target tracking** ("keep average CPU at 60 percent", or `ALBRequestCountPerTarget`) is the usual choice and works like a thermostat. **Step scaling** reacts in bands, **scheduled scaling** raises capacity before a known peak (salary day), and **predictive scaling** learns daily patterns. Scaling on a **queue backlog per instance** suits workers.
- **Instance refresh:** to release a new AMI, update the launch template and start a refresh. The ASG replaces instances in batches, with a minimum healthy percentage, and can roll back automatically on an alarm. This is a rolling deployment ([deployment strategies](lesson:deployment-strategies#rolling)).
- **Lifecycle hooks** pause an instance while it starts or terminates, so you can finish a configuration step or drain work, and **warm pools** keep pre-initialised instances ready to cut the start time.
- **Java details:** a JVM needs warm-up, so set a **slow start** on the target group, use a **deregistration delay** so in-flight requests finish, and shut down gracefully ([graceful shutdown](lesson:deployment-strategies#rolling)).
- The load balancer's **connection draining** and the ASG's **termination policy** decide which instances go first on scale-in, so make the application **stateless** ([elasticity](lesson:cloud-basics#elasticity)).

## Lambda {#lambda}

Lambda runs a function in response to an **event**, with no servers to manage and billing by **requests and GB-seconds** (the second scene).

- **Triggers:** *synchronous* (API Gateway, an ALB, the SDK invoke), *asynchronous* (S3, SNS, EventBridge, with built-in retries and a destination or dead-letter queue), and *poll-based* (SQS, Kinesis, DynamoDB Streams, MSK, where Lambda polls and batches for you).
- **Execution environment:** Lambda creates a micro-VM, loads your code, runs the **init** code once (static initialisers, Spring context), and then runs the **handler** for each call. A *warm* environment is reused for later calls, so keep clients and connections in static fields and out of the handler.
- **Limits:** up to **15 minutes** per call, **128 MB to 10 GB** of memory (CPU grows with memory), a 6 MB payload for synchronous calls, up to 10 GB of ephemeral storage, and an account **concurrency** limit (a soft limit that can be raised).
- **Concurrency:** each simultaneous call needs its own environment. **Reserved concurrency** caps a function (and guarantees it capacity, which also **protects a downstream database**), and **provisioned concurrency** keeps environments initialised and ready.
- **Cold starts and Java:** a cold start downloads the package, starts the runtime and runs init. A Java function with a large framework can take several seconds. Ways to cut it:
  - **SnapStart** takes a snapshot of the initialised environment and restores it, which often cuts the start by a large factor. Be careful with state captured in the snapshot (random seeds, connections, unique ids): use the runtime hooks to refresh them.
  - **Provisioned concurrency** removes cold starts for the amount you keep warm, at a cost.
  - **Less to load:** a smaller JAR, fewer dependencies, no classpath scanning, lazy initialisation, AWS CRT or URLConnection HTTP clients instead of heavy ones, and tiered compilation settings.
  - **Native image (GraalVM)** starts in milliseconds but adds build complexity.
  - Choose the framework deliberately: a full Spring Boot context is heavy for Lambda, and **Spring Cloud Function**, Micronaut or Quarkus, or plain handlers are lighter.
- **Errors and retries:** a *synchronous* failure goes back to the caller. An *asynchronous* event is retried twice, then goes to a destination or DLQ. With *SQS*, a failed batch returns to the queue and ends in the queue's DLQ, so use **partial batch responses** to retry only the failed messages and make handlers **idempotent**.
- **Versions and aliases:** publish an immutable **version** and point an **alias** (`live`) at it. An alias can split traffic by weight (a canary), and CodeDeploy can shift it gradually with alarms and automatic rollback.
- **Networking:** a function can run in your VPC to reach a private database. Use **RDS Proxy** to pool connections, because hundreds of environments opening connections can exhaust a database.
- **Permissions:** the **execution role** is the function's identity, with only the actions it needs. The *resource policy* controls who may invoke it.
- **Packaging:** a ZIP or a container image (up to 10 GB), with layers for shared libraries.

A Java handler for an SQS trigger is in the coding questions below.

## ECS and Fargate {#ecs}

**Amazon ECS** is AWS's own container orchestrator (the third scene):

- **Task definition:** the blueprint of a task: container images, CPU and memory, ports, environment variables, **secrets** pulled from Secrets Manager or Parameter Store, log configuration, health check, and **two roles**. The **task execution role** lets ECS pull the image and read secrets and write logs. The **task role** is what your application uses to call AWS services.
- **Task and service:** a **task** is a running instance of a definition. A **service** keeps the desired number of tasks running, replaces failed ones, registers them with a load balancer target group, and handles deployments.
- **Cluster and capacity:** the cluster groups the capacity. **Fargate** runs each task on AWS-managed compute (you choose vCPU and memory, with no nodes to patch). The **EC2 launch type** uses your own instances (with a capacity provider and an ASG), for GPUs, special sizes or a large steady load where it is cheaper.
- **Networking:** the `awsvpc` mode gives each task its own network interface and security group, so a task is a first-class citizen of the VPC and the load balancer reaches it by IP.
- **Scaling:** **Service Auto Scaling** with target tracking on CPU, memory or ALB requests per target, plus scheduled actions.
- **Deployments:** the default is a **rolling update** (minimum healthy and maximum percent), with a **circuit breaker** that rolls back a deployment that cannot become healthy. **CodeDeploy** adds **blue-green and canary** with traffic shifting and alarms ([deployment strategies](lesson:deployment-strategies#blue-green)).
- **Service Connect** and **Cloud Map** give service discovery and simple service-to-service networking inside the cluster.
- **Fargate trade-offs:** nothing to patch and per-second billing, but no privileged containers or host access, no DaemonSets, a fixed set of CPU and memory sizes, and a higher price per vCPU than well-used EC2.

## EKS {#eks}

**Amazon EKS** runs Kubernetes, with AWS operating the **control plane** (API server, etcd) across several AZs ([Kubernetes](lesson:kubernetes)):

- **Data plane options:** **managed node groups** (EC2 nodes with AWS handling the lifecycle), **Karpenter** (adds the right nodes just in time and consolidates them, and often cuts the cost), or **Fargate profiles** (a pod per micro-VM, with limits).
- **AWS integration:** the **AWS Load Balancer Controller** turns Ingress and Service objects into ALBs and NLBs, **EBS and EFS CSI drivers** provide storage, and **CoreDNS, kube-proxy and the VPC CNI** are managed add-ons.
- **Pod permissions:** **IRSA** (IAM roles for service accounts) or the newer **EKS Pod Identity** let one pod assume a specific IAM role, so no node-wide permission and no keys ([IAM](lesson:aws-service-map#security)).
- **Upgrades:** Kubernetes versions are supported for a limited time, so plan regular upgrades of the control plane, the nodes and the add-ons.
- **When EKS:** the team already runs Kubernetes, needs its ecosystem (Helm, operators, GitOps with Argo CD), runs on several clouds, or needs its flexibility. **When ECS:** you want the simplest AWS-native way to run containers and do not need Kubernetes.

| | **ECS** | **EKS** |
| --- | --- | --- |
| Model | AWS-specific tasks and services | standard Kubernetes API |
| Learning curve | gentle | steep |
| Control plane cost | none | an hourly fee per cluster |
| Portability | AWS only | the same objects elsewhere |
| Ecosystem | AWS tools | Helm, operators, Argo CD, service meshes |
| Operations | less | more (add-ons, upgrades, nodes) |

## Running Spring Boot on these {#spring-boot}

- **Containers:** build a small image (layered JAR or Jib, a slim JRE base) and tag it by commit ([Docker](lesson:docker)). Push it to **ECR** with image scanning on.
- **JVM in a container:** use `-XX:MaxRAMPercentage=75` so the heap follows the container memory limit, and size CPU and memory so garbage collection and JIT have room. A `-Xmx` larger than the limit gets the process killed.
- **Health and shutdown:** expose Actuator `/actuator/health/readiness` and `liveness` for the ALB, ECS or Kubernetes probes, set `server.shutdown=graceful`, and keep the stop timeout longer than the shutdown phase ([observability](lesson:spring-observability)).
- **Configuration:** from environment variables, **Parameter Store or Secrets Manager** (injected by ECS or read with Spring Cloud AWS), never baked into the image.
- **AWS access:** the SDK uses the task or pod role automatically ([SDK credentials](lesson:aws-service-map#java)).
- **Logging:** write to standard output as JSON, and let the platform ship it to CloudWatch Logs. Add a correlation id and trace context.
- **Lambda:** Spring Cloud Function or a plain handler with SnapStart, keeping the init small.

## Cost levers {#cost}

- **Graviton** instances and Fargate ARM tasks, typically about 20 percent cheaper for similar performance.
- **Right-size** with Compute Optimizer and real CPU and memory data. Most services are oversized.
- **Savings Plans** (compute) for the steady baseline, which also cover Fargate and Lambda. **Spot** for stateless workers, CI runners and batch.
- **Scale in at night** for non-production (scheduled scaling), and use Karpenter consolidation on EKS.
- **Lambda:** tune the memory (a higher setting can be both faster and cheaper), avoid idle polling, and compare with a container for steady high volume.
- Watch the **non-compute** costs of compute: NAT gateway traffic, cross-AZ data transfer and load balancer hours ([cost and FinOps](lesson:cloud-basics#cost)).

## In a bank {#bank}

- **Hardened images.** Golden AMIs and approved base images in a private ECR, built by a pipeline, scanned (Inspector, image scanning) and signed, with no direct pull from public registries.
- **No SSH, no snowflakes.** Access through Session Manager with logging, immutable instances replaced rather than patched by hand, and patching done by rebuilding the image.
- **IMDSv2 required**, EBS volumes **encrypted** with customer-managed KMS keys, security groups closed by default, and workloads only in private subnets.
- **Least-privilege roles** per task, pod or function, with permission boundaries and service control policies as guardrails ([accounts](lesson:aws-service-map#accounts)).
- **Controlled release.** Rolling or canary deployment through a pipeline with approvals and automatic rollback ([CI/CD](lesson:cicd-fundamentals)), and a record of which image runs where.
- **Resilience.** At least two AZs, tested failover, capacity for N+1, and a plan for loss of a region ([availability](lesson:cloud-basics#availability)).
- **Compliance and tenancy.** Dedicated tenancy or hosts where licensing or policy demand it, an approved list of instance and runtime options, and tagging for ownership and cost.

Try it in the lab: [Auto Scaling behind a load balancer](lab:aws-autoscaling-alb).

## Cheat sheet {#cheatsheet}

| Need | Choice |
| --- | --- |
| full control, special hardware | EC2 |
| new containerised service, least ops | ECS on Fargate |
| Kubernetes skills and ecosystem | EKS (Karpenter for nodes) |
| event-driven, spiky, glue | Lambda |
| simple web app from source or image | App Runner |
| large queued batch | AWS Batch on Spot |
| fleet release | new AMI, launch template, instance refresh |
| scaling | target tracking, scheduled for known peaks |
| Java cold start | SnapStart, provisioned concurrency, lean init |
| container AWS access | task role (ECS), IRSA or Pod Identity (EKS), execution role (Lambda) |
| cost | Graviton, right-size, Savings Plans, Spot, scale in |
| security | IMDSv2, encrypted EBS, Session Manager, private subnets, signed images |

## Interview questions {#questions}

### [basic] How do you choose between EC2, containers and Lambda? {#choose-q}

By how much control and operating work you want. Lambda for event-driven, spiky or low-volume work with no servers, within its limits. Containers on ECS Fargate (or EKS if the team uses Kubernetes) for long-running services with the least operations. EC2 when you need control of the machine: special hardware, licences, custom kernel or software, or a large steady load where it is cheaper. The default for a new service is a container on Fargate, with Lambda around it for events.

### [basic] What is an AMI and a launch template? {#ami-q}

An AMI is the machine image from which an instance starts: the operating system and the software baked into it. A launch template records everything needed to launch an instance, including the AMI, instance type, IAM role, security groups, user data and metadata options, and it is versioned. An Auto Scaling group uses a launch template to create identical instances, and releasing means a new AMI and a new template version.

### [basic] What is an Auto Scaling group? {#asg-q}

A managed fleet of instances created from a launch template, with a minimum, desired and maximum size, spread across availability zones. It replaces unhealthy instances, registers them with a load balancer, and scales in and out by policies such as target tracking on CPU or request count. It is how EC2 gets elasticity and self-healing.

### [basic] What is the difference between On-Demand, Savings Plans and Spot? {#purchasing-q}

On-Demand is full price with no commitment. Savings Plans (and Reserved Instances) give a large discount for committing to steady usage for one or three years. Spot is spare capacity at a deep discount that AWS can reclaim with two minutes' notice, so it suits stateless, fault-tolerant work. A typical fleet uses Savings Plans for the baseline, On-Demand for peaks and Spot for interruptible workers.

### [basic] What is AWS Lambda and what are its main limits? {#lambda-q}

A service that runs a function in response to events, scales automatically (to zero when idle) and bills per request and per GB-second, with no servers to manage. The main limits are a 15-minute maximum run time, 128 MB to 10 GB of memory (with CPU in proportion), a 6 MB synchronous payload, an account concurrency limit, and cold starts. It is a poor fit for long-running or steady high-volume processing.

### [basic] What is the difference between ECS and EKS? {#ecs-eks-q}

ECS is AWS's own, simpler container orchestrator with tasks and services, with no control plane charge. EKS is managed Kubernetes: the standard API, a large ecosystem and portability, but more complexity and an hourly cluster fee. Choose ECS for the simplest AWS-native route, and EKS when the team already uses Kubernetes or needs its ecosystem or multi-cloud portability. Both can run on Fargate or on EC2.

### [intermediate] What is a cold start and how do you reduce it for a Java Lambda? {#cold-start-q}

When no warm environment is available, Lambda creates one, downloads the code, starts the JVM and runs the initialisation, which for a Java framework can take seconds. Reduce it with SnapStart (restore from a snapshot of the initialised function), provisioned concurrency (environments kept ready), a smaller package and fewer dependencies, lazy initialisation and avoiding classpath scanning, a lighter framework such as Spring Cloud Function, Micronaut or Quarkus, or a GraalVM native image. Keep clients in static fields so warm calls are fast.

### [intermediate] How does Lambda scale and how do you protect a database behind it? {#lambda-scale-q}

Lambda adds environments as concurrent requests arrive, and with SQS it scales with the queue length. Hundreds of concurrent functions can exhaust a database's connections. Protect it with reserved concurrency to cap the function, a small SQS batch and maximum concurrency setting on the event source, RDS Proxy for connection pooling, and idempotent handlers so retries are safe.

### [intermediate] What is the difference between the ECS task role and the task execution role? {#task-role-q}

The task execution role is used by ECS itself to set the task up: pull the image from ECR, fetch the secrets that are injected into the container, and write logs to CloudWatch. The task role is the identity of your application code inside the container, used when it calls AWS services such as S3 or DynamoDB. They have separate policies, and the task role should have only what the application needs.

### [intermediate] How does a pod on EKS get AWS permissions? {#irsa-q}

With IAM roles for service accounts (IRSA) or EKS Pod Identity. A Kubernetes service account is associated with an IAM role, and the pod receives temporary credentials for that role through the SDK's credential chain. Each workload gets its own role, so there is no node-wide permission and no stored key. The alternative of using the node's instance role would give every pod on the node the same access.

### [intermediate] How do you deploy a new version to an EC2 Auto Scaling fleet without downtime? {#asg-deploy-q}

Build a new AMI in the pipeline, create a new launch template version, and start an instance refresh with a minimum healthy percentage, an instance warm-up that fits the JVM, and automatic rollback on an alarm. The group replaces instances in batches, each new instance has to pass the load balancer health check before the next batch starts, and a deregistration delay lets in-flight requests finish. For a blue-green approach use a second group or CodeDeploy.

### [intermediate] A rolling update of an ECS service keeps failing. What do you check? {#ecs-deploy-q}

Look at the service events and the stopped task's reason. Typical causes are a health check that fails (a wrong path, a start-up time longer than the grace period), the container being killed for exceeding memory (check the JVM heap settings against the limit), the execution role not allowed to pull the image or read a secret, a security group or subnet that blocks the load balancer or a dependency, and insufficient capacity. The deployment circuit breaker can roll the service back, and the logs in CloudWatch show the application error.

### [intermediate] Why use Fargate, and when would you choose ECS on EC2 instead? {#fargate-q}

Fargate removes the nodes: there is nothing to patch, scale or secure at the host level, billing is per task, and each task is isolated. It fits most web services and workers. EC2 capacity is preferable for GPUs, special instance types or storage, privileged containers or host-level tools, and for a large, steady, well-packed load where the lower unit price pays for the extra work.

### [intermediate] How do you size a JVM in a container? {#jvm-q}

Set the container memory limit, and make the heap a fraction of it with `-XX:MaxRAMPercentage` (about 70 to 75 percent), leaving room for metaspace, thread stacks, direct buffers and the OS. A heap set larger than the limit makes the container be killed by the out-of-memory killer. Give enough CPU for garbage collection and JIT compilation, because with very low CPU the start-up and the pause times suffer. Load-test with the real limits, and watch container memory, not only the heap.

### [deep] Design the compute layer for a payment platform with a steady API, a spiky batch and event handlers. {#design-q}

The API runs as containers on ECS Fargate (or EKS if the organisation runs Kubernetes), across three AZs behind an ALB, with a service auto scaling policy on requests per target, a minimum of three tasks for availability, a task role per service, health checks on the readiness endpoint, and a canary deployment through CodeDeploy with alarms and automatic rollback. The nightly batch runs on AWS Batch or scheduled ECS tasks using Spot with checkpoints, so interruptions only delay it. The event handlers are Lambda functions on SQS with partial batch responses, reserved concurrency to protect the database and idempotent processing. Images come from a private ECR with scanning and signing, instances use Graviton, the steady part is covered by Savings Plans, and everything is deployed by a pipeline with the approvals and audit evidence that a bank needs.

### [deep] How would you migrate a fleet of long-running Java applications from VMs to containers on AWS? {#migration-q}

Assess each application: its statelessness, configuration, start-up time, storage and dependencies. Containerise the simplest first, with externalised configuration, health endpoints, graceful shutdown and logging to standard output, build the image in a pipeline and push it to ECR. Start with ECS on Fargate or EKS in a non-production environment, run both versions side by side with weighted routing, move traffic gradually with a canary, and keep the old environment for a fast rollback. Replace local state with shared services (sessions in Redis, files in S3), size the JVM for the container limits, and update monitoring and runbooks. Applications that cannot be containerised yet can be rehosted on EC2 with an Auto Scaling group as a first step.

### [deep] Compare Karpenter with the Cluster Autoscaler on EKS. {#karpenter-q}

The Cluster Autoscaler scales pre-defined node groups up and down according to pending pods, so each group has a fixed instance type and the choices are limited by how you set the groups up. Karpenter looks at the pending pods' real requirements (CPU, memory, zone, architecture) and launches the best-fitting instance directly, from a wide range of types and purchase options including Spot, and it consolidates and removes underused nodes. It starts nodes faster, packs workloads more tightly and usually reduces the cost, with less node-group management.

### [coding] Write an ECS Fargate task definition for a Spring Boot service with a secret, logging and a health check. {#coding-ecs}

```json
{
  "family": "payments",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "512",
  "memory": "1024",
  "runtimePlatform": { "cpuArchitecture": "ARM64", "operatingSystemFamily": "LINUX" },
  "executionRoleArn": "arn:aws:iam::111122223333:role/payments-execution",
  "taskRoleArn": "arn:aws:iam::111122223333:role/payments-task",
  "containerDefinitions": [
    {
      "name": "payments",
      "image": "111122223333.dkr.ecr.ap-southeast-1.amazonaws.com/payments:4f2a9c1",
      "essential": true,
      "portMappings": [{ "containerPort": 8080 }],
      "environment": [
        { "name": "JAVA_TOOL_OPTIONS", "value": "-XX:MaxRAMPercentage=75" },
        { "name": "SPRING_PROFILES_ACTIVE", "value": "prod" }
      ],
      "secrets": [
        { "name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:111122223333:secret:payments/db-AbC123:password::" }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/actuator/health/liveness || exit 1"],
        "interval": 15, "timeout": 5, "retries": 3, "startPeriod": 60
      },
      "stopTimeout": 40,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/payments",
          "awslogs-region": "ap-southeast-1",
          "awslogs-stream-prefix": "app"
        }
      }
    }
  ]
}
```

Explain: the **image tag is a commit hash**, not `latest`; the **execution role** lets ECS pull the image and read the secret, while the **task role** is what the application uses to call AWS; the password is injected from Secrets Manager and never appears in the definition; `MaxRAMPercentage` sizes the heap from the 1 GiB limit; the health check has a `startPeriod` long enough for the JVM to start; `stopTimeout` gives the application time to shut down gracefully (with `server.shutdown=graceful`); ARM64 selects Graviton for a lower price; and logs go to CloudWatch through the `awslogs` driver.

### [coding] Write a Lambda handler in Java for an SQS trigger that returns partial batch failures. {#coding-lambda}

```java
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;

import java.util.ArrayList;
import java.util.List;

public class PaymentHandler implements RequestHandler<SQSEvent, SQSBatchResponse> {

    // created once per execution environment, reused by warm invocations
    private static final PaymentProcessor PROCESSOR = PaymentProcessor.create();

    @Override
    public SQSBatchResponse handleRequest(SQSEvent event, Context context) {
        List<SQSBatchResponse.BatchItemFailure> failures = new ArrayList<>();

        for (SQSEvent.SQSMessage message : event.getRecords()) {
            try {
                PROCESSOR.process(message.getMessageId(), message.getBody());   // idempotent by message id
            } catch (Exception e) {
                context.getLogger().log("failed " + message.getMessageId() + ": " + e);
                failures.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
            }
        }
        return new SQSBatchResponse(failures);        // only these messages return to the queue
    }
}
```

Explain: the event source mapping must have `ReportBatchItemFailures` enabled, so that Lambda deletes the messages that succeeded and returns **only the failed ones** to the queue, instead of retrying the whole batch; after the queue's `maxReceiveCount` they move to the dead-letter queue; the processor is created in a **static field**, so the initialisation (clients, connection pool) happens once per environment and not on each call; the processing is **idempotent** by message id, because SQS delivers at least once; the SQS visibility timeout must be longer than the function timeout; and SnapStart plus a small dependency set keep the cold start low.

### [coding] Write a CloudFormation launch template and Auto Scaling group with target tracking and a rolling instance refresh. {#coding-asg}

```yaml
Resources:
  PaymentsTemplate:
    Type: AWS::EC2::LaunchTemplate
    Properties:
      LaunchTemplateName: payments
      LaunchTemplateData:
        ImageId: '{{resolve:ssm:/golden-ami/payments/latest}}'      # the approved, patched AMI
        InstanceType: m7g.large                                     # Graviton
        IamInstanceProfile: { Arn: !GetAtt PaymentsInstanceProfile.Arn }
        SecurityGroupIds: [!Ref PaymentsSecurityGroup]
        MetadataOptions: { HttpTokens: required, HttpEndpoint: enabled }   # IMDSv2 only
        BlockDeviceMappings:
          - DeviceName: /dev/xvda
            Ebs: { VolumeSize: 30, Encrypted: true, KmsKeyId: !Ref DataKey }

  PaymentsGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      MinSize: '2'
      MaxSize: '8'
      DesiredCapacity: '2'
      VPCZoneIdentifier: [!Ref PrivateSubnetA, !Ref PrivateSubnetB]
      LaunchTemplate:
        LaunchTemplateId: !Ref PaymentsTemplate
        Version: !GetAtt PaymentsTemplate.LatestVersionNumber
      TargetGroupARNs: [!Ref PaymentsTargetGroup]
      HealthCheckType: ELB
      HealthCheckGracePeriod: 120                                   # time for the JVM to start
    UpdatePolicy:
      AutoScalingRollingUpdate:
        MinInstancesInService: '2'
        MaxBatchSize: '1'
        PauseTime: PT5M
        WaitOnResourceSignals: false

  CpuPolicy:
    Type: AWS::AutoScaling::ScalingPolicy
    Properties:
      AutoScalingGroupName: !Ref PaymentsGroup
      PolicyType: TargetTrackingScaling
      TargetTrackingConfiguration:
        PredefinedMetricSpecification: { PredefinedMetricType: ASGAverageCPUUtilization }
        TargetValue: 60
```

Explain: the AMI id comes from a Parameter Store entry that the image pipeline updates, so a new approved image reaches the fleet through the template; **IMDSv2 is required**, and the root volume is encrypted with a customer-managed key; the group spans two private subnets in two AZs, with min 2 and max 8 for availability and a cost cap; `HealthCheckType: ELB` replaces instances whose application is unhealthy, with a grace period that matches the start-up time; the rolling update replaces one instance at a time while keeping at least two in service; and the target tracking policy holds average CPU near 60 percent.
