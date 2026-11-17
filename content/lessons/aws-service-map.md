---
title: AWS service map — the services that matter and how they fit together
nav: AWS service map
slug: aws-service-map
summary: A guided map of AWS for a Java and Spring Boot developer, the global infrastructure, how to read the catalogue, the 25 or so services that matter grouped into compute, storage, databases, networking, security and identity, integration and messaging, developer and operations tools, analytics and governance, with Azure and Google Cloud equivalents, how they combine in a web application and an event-driven flow, accounts and Organizations, how to choose between look-alike services, pricing basics, and a bank view, with examples and interview questions.
tags: [AWS, Cloud, EC2, S3, Lambda, RDS, DynamoDB, IAM, VPC, SQS]
order: 54
topic: Cloud / AWS
updated: 2026-11-17
subnav: true
---

AWS has more than two hundred services, and nobody knows them all. The skill that interviews test is a **map**: knowing roughly twenty-five services, which category each belongs to, what problem it solves, when to pick it over its look-alike, and how they combine into a real system. This lesson is that map. Each category has a lesson of its own to follow (compute, storage, databases, networking, security, messaging and operations). Play the three scenes: a web application layer by layer, an event-driven flow, and an account structure.

```demo
name: aws-walk
```

> **One sentence to remember:** *Learn the AWS catalogue by problem, not by name: compute runs code, storage and databases keep data, networking connects and protects, security and identity decide who may do what, messaging decouples services, and operations tools watch and deploy all of it.*

## The global infrastructure {#infrastructure}

- **Regions** are separate geographic areas (`ap-southeast-1` is Singapore). Services, prices and features differ by region, and data stays in a region unless you copy it. Pick the region by latency, **data residency rules**, service availability and price.
- **Availability zones (AZs)** are separate data centres in a region. A multi-AZ design survives the loss of one.
- **Edge locations** and **regional edge caches** serve CloudFront (the CDN), Route 53 and Global Accelerator close to users.
- **Local Zones, Wavelength and Outposts** push AWS closer to a city, a mobile network or your own data centre, for latency or for data that must stay on-premises.
- **Global services** do not belong to one region: IAM, Route 53, CloudFront, Organizations. Most others are regional.

For the concepts behind these terms see [Cloud basics](lesson:cloud-basics#regions).

## How to read the catalogue {#reading}

Every service falls into a **category**, and within a category the services differ by **how much AWS manages for you**:

- **Building blocks** (EC2, EBS, VPC) give you raw infrastructure. Maximum control, maximum work.
- **Managed services** (RDS, ElastiCache, MSK) run a known technology for you: patching, backups and failover are handled.
- **Serverless services** (Lambda, DynamoDB, SQS, S3, Fargate) have no servers to size at all: they scale by use and are billed by use.

A useful default for a product team: **choose the most managed service that meets the requirement**, and drop down a level only when you need control it does not give.

## The service map {#map}

The first column is the category, and the Azure and Google Cloud equivalents are beside each service so that you can talk across clouds.

### Compute {#compute}

| Service | What it is | Use it for | Azure / GCP |
| --- | --- | --- | --- |
| **EC2** | virtual machines | full control, lift and shift, special hardware | Virtual Machines / Compute Engine |
| **Auto Scaling** | adds and removes EC2 instances by policy | elastic fleets behind a load balancer | VM Scale Sets / Managed Instance Groups |
| **Lambda** | functions run on events, billed per call | event handlers, glue, light APIs | Functions / Cloud Functions |
| **ECS** | AWS's own container orchestrator | containers with the least overhead | Container Apps / Cloud Run |
| **EKS** | managed Kubernetes | teams standardised on Kubernetes | AKS / GKE |
| **Fargate** | serverless compute for ECS and EKS containers | containers with no nodes to manage | Container Apps / Cloud Run |
| **Elastic Beanstalk, App Runner** | deploy a web app or container, AWS runs it | simple web apps, fast start | App Service / App Engine |
| **Batch** | scheduled, queued batch jobs on managed compute | large batch and HPC workloads | Batch / Cloud Batch |

### Storage {#storage}

| Service | What it is | Use it for | Azure / GCP |
| --- | --- | --- | --- |
| **S3** | object storage with very high durability | files, statements, backups, data lakes, static sites | Blob Storage / Cloud Storage |
| **S3 Glacier** | archive classes of S3 | long-term, rarely read data (retention rules) | Archive tier / Archive class |
| **EBS** | block volumes for one EC2 instance | a VM's disk, a database on EC2 | Managed Disks / Persistent Disk |
| **EFS** | shared NFS file system | files shared by many instances | Azure Files / Filestore |
| **FSx** | managed Windows, Lustre, NetApp file systems | Windows shares, HPC | Azure NetApp Files |
| **Backup** | central backup policies | a uniform backup rule across services | Backup / Backup and DR |

### Databases {#databases}

| Service | What it is | Use it for | Azure / GCP |
| --- | --- | --- | --- |
| **RDS** | managed MySQL, PostgreSQL, Oracle, SQL Server, MariaDB | a relational database without the operating work | Azure SQL, Database for PostgreSQL / Cloud SQL |
| **Aurora** | AWS's cloud-built MySQL and PostgreSQL compatible database | high throughput relational with fast failover | Hyperscale / AlloyDB |
| **DynamoDB** | serverless key-value and document store | huge scale, predictable low latency, simple access patterns | Cosmos DB / Firestore, Bigtable |
| **ElastiCache** | managed Redis and Memcached | caching, sessions, rate limits | Azure Cache for Redis / Memorystore |
| **DocumentDB, Neptune, Keyspaces** | MongoDB-compatible, graph, Cassandra-compatible | those specific models | Cosmos DB APIs |
| **Redshift** | data warehouse | analytics over large structured data | Synapse / BigQuery |
| **OpenSearch Service** | managed search and log analytics | full-text search, log search | Azure AI Search / Elastic on GCP |

### Networking and content delivery {#networking}

| Service | What it is | Use it for | Azure / GCP |
| --- | --- | --- | --- |
| **VPC** | your private network | subnets, routing, security groups | Virtual Network / VPC |
| **Elastic Load Balancing** | ALB (HTTP), NLB (TCP), GWLB | spreading traffic, health checks, TLS | Application Gateway, Load Balancer / Cloud Load Balancing |
| **Route 53** | DNS and health-checked routing | domain names, failover and latency routing | Azure DNS, Traffic Manager / Cloud DNS |
| **CloudFront** | content delivery network | caching, TLS at the edge, shielding the origin | Front Door, CDN / Cloud CDN |
| **API Gateway** | managed API front door | throttling, auth and routing for APIs | API Management / API Gateway, Apigee |
| **Direct Connect, Site-to-Site VPN** | private links to a data centre | hybrid connectivity | ExpressRoute, VPN Gateway / Interconnect |
| **Transit Gateway, PrivateLink** | hub for many VPCs, private service access | multi-VPC and multi-account networks | Virtual WAN / Private Service Connect |

### Security, identity and compliance {#security}

| Service | What it is | Use it for | Azure / GCP |
| --- | --- | --- | --- |
| **IAM** | users, roles and policies | who may do what, on which resource | Entra ID and RBAC / Cloud IAM |
| **IAM Identity Center** | single sign-on to many accounts | people logging in with the company identity | Entra ID / Cloud Identity |
| **KMS, CloudHSM** | key management, dedicated HSMs | encryption keys, customer-managed keys | Key Vault / Cloud KMS |
| **Secrets Manager, Parameter Store** | secrets and configuration with rotation | database passwords, API keys, settings | Key Vault / Secret Manager |
| **Cognito** | sign-up and sign-in for your app's users | customer identity, OAuth and OIDC | Entra External ID / Identity Platform |
| **WAF, Shield** | web application firewall, DDoS protection | blocking attacks at the edge | WAF, DDoS Protection / Cloud Armor |
| **GuardDuty, Security Hub, Inspector, Macie** | threat detection, findings hub, vulnerability and data scans | detecting problems | Defender / Security Command Center |
| **ACM** | certificates | free public TLS certificates for AWS endpoints | App Service Certificates / Certificate Manager |

### Integration and messaging {#integration}

| Service | What it is | Use it for | Azure / GCP |
| --- | --- | --- | --- |
| **SQS** | message queue | buffering, decoupling, work queues | Service Bus queues / Cloud Tasks, Pub/Sub |
| **SNS** | publish and subscribe topics | fan-out, notifications | Event Grid / Pub/Sub |
| **EventBridge** | event bus with rules and schedules | routing events between services and SaaS | Event Grid / Eventarc |
| **Kinesis, MSK** | streaming data, managed Kafka | ordered streams, event streaming | Event Hubs / Pub/Sub, Managed Kafka |
| **Step Functions** | managed workflows and state machines | orchestrating steps and sagas | Logic Apps, Durable Functions / Workflows |
| **Amazon MQ** | managed ActiveMQ and RabbitMQ | lifting existing JMS or AMQP systems | Service Bus / none direct |

### Developer and operations tools {#operations}

| Service | What it is | Use it for | Azure / GCP |
| --- | --- | --- | --- |
| **CloudFormation, CDK** | infrastructure as code | repeatable environments | ARM and Bicep / Deployment Manager |
| **ECR** | container image registry | storing and scanning images | Container Registry / Artifact Registry |
| **CodeBuild, CodePipeline, CodeDeploy** | build, pipeline and deployment services | AWS-native CI/CD | Azure DevOps / Cloud Build |
| **CloudWatch** | metrics, logs, alarms, dashboards | monitoring and alerting | Azure Monitor / Cloud Monitoring |
| **X-Ray, OpenTelemetry (ADOT)** | distributed tracing | following a request across services | Application Insights / Cloud Trace |
| **CloudTrail** | record of API calls | audit, forensics | Activity Log / Cloud Audit Logs |
| **Systems Manager** | patching, run commands, parameters | managing fleets without SSH | Update Management / OS Config |

### Analytics, AI and governance {#analytics}

- **Analytics:** Athena (SQL over S3), Glue (ETL and data catalogue), EMR (Spark and Hadoop), QuickSight (dashboards), Lake Formation (data lake permissions).
- **AI and ML:** SageMaker (build and host models), Bedrock (foundation models behind an API), Textract, Rekognition, Comprehend and Transcribe (ready-made services).
- **Governance and cost:** Organizations (many accounts), Control Tower (a governed landing zone), Config (resource configuration and compliance), Trusted Advisor, Cost Explorer, Budgets and the Cost and Usage Report.

## Putting it together: a web application {#webapp}

The first scene shows the standard layered design for a Spring Boot service:

1. **Edge:** Route 53 resolves the name, CloudFront caches static content and fronts the API, and **WAF** filters the requests.
2. **Entry:** an **Application Load Balancer** in public subnets is the only public entry. It terminates TLS with an **ACM** certificate and health-checks the targets.
3. **Compute:** **stateless** containers on **ECS Fargate** (or EKS, or EC2 in an Auto Scaling group) in **private subnets** across at least two AZs, scaling on CPU or request count ([elasticity](lesson:cloud-basics#elasticity)).
4. **Data:** **Aurora** or RDS with a multi-AZ standby for transactions, **ElastiCache** for hot reads, **S3** for documents, DynamoDB where access is by key at very large scale.
5. **Identity and secrets:** each service runs under an **IAM role** (no keys), reads secrets from **Secrets Manager**, and encrypts data with **KMS**.
6. **Observability and audit:** logs and metrics to **CloudWatch**, traces with OpenTelemetry, and **CloudTrail** for every API call ([observability](lesson:spring-observability)).
7. **Delivery:** images in **ECR**, infrastructure in **CloudFormation or Terraform**, deployments by a pipeline ([CI/CD](lesson:cicd-fundamentals)) using a rolling or canary strategy ([deployment strategies](lesson:deployment-strategies)).

## Putting it together: an event-driven flow {#events}

The second scene shows how messaging decouples services, a pattern that fits payments and notifications:

- A producer publishes an event to **SNS**, which **fans out** to one **SQS** queue per consumer. A new consumer subscribes without any change to the producer.
- A queue **buffers** a spike, so a slow consumer does not lose messages or slow the producer. The consumer (a Spring Boot service with `@SqsListener`, or **Lambda**) reads in batches and scales with the queue length.
- Delivery is **at-least-once**, so a consumer must be **idempotent**: a conditional write in DynamoDB, or a unique key in the database, makes a repeated message harmless.
- After a number of failed receives a message moves to a **dead-letter queue**, which has a CloudWatch alarm so the team can inspect and redrive it ([messaging](lesson:messaging)).
- **EventBridge** is the choice when you route events by content between many services or SaaS sources, **Kinesis or MSK** when you need ordered, replayable streams, and **Step Functions** when a process has several steps with retries and compensation ([saga](lesson:saga)).

## Accounts and Organizations {#accounts}

The third scene shows why one account is not enough:

- An **AWS account** is the basic boundary for **permissions, billing and limits**. Separate accounts for production, non-production, logging and security tooling limit the **blast radius** and simplify audits.
- **AWS Organizations** groups the accounts in **organisational units (OUs)**, with consolidated billing and **service control policies (SCPs)**: guardrails that set the maximum permissions in an account, for example "only these regions" and "CloudTrail cannot be turned off". An SCP never grants anything, it only limits.
- **Control Tower** builds a governed **landing zone** with that structure, a logging account, an audit account and baseline controls.
- **People** sign in once through **IAM Identity Center** and get **permission sets** per account. **Machines** use **roles**: a pipeline account assumes a narrow cross-account role to deploy into production, with temporary credentials.
- **Central logging:** every account sends CloudTrail and Config data to a protected log archive account that most people cannot change.

## Choosing between look-alike services {#choosing}

| Question | Choice and reason |
| --- | --- |
| **ECS, EKS or Lambda?** | **Lambda** for short, event-driven work with spiky or low traffic. **ECS on Fargate** for containers when you want the least operations. **EKS** when the team and tooling are already Kubernetes. EC2 only when you need the host |
| **RDS, Aurora or DynamoDB?** | **RDS** for a standard relational database. **Aurora** for more throughput, faster failover and read scaling. **DynamoDB** for key-based access at large scale and predictable latency, when you can design for the access patterns, with no joins |
| **SQS, SNS, EventBridge or Kinesis?** | **SQS**: one consumer group pulling work. **SNS**: push the same message to many. **EventBridge**: route events by rules and schedules. **Kinesis or MSK**: ordered, replayable streams and high volume |
| **S3, EBS or EFS?** | **S3** for objects accessed by API. **EBS** for one instance's block disk. **EFS** for a shared file system |
| **ALB or NLB?** | **ALB** for HTTP with path and host routing. **NLB** for TCP and TLS passthrough, static IPs and very high throughput |
| **Secrets Manager or Parameter Store?** | **Secrets Manager** for secrets with automatic rotation. **Parameter Store** for plain configuration and cheap secrets |
| **API Gateway or ALB?** | **API Gateway** for managed throttling, API keys, authorisers and usage plans. **ALB** for plain routing to containers at lower cost |
| **CloudFormation, CDK or Terraform?** | CloudFormation is the AWS-native engine, CDK writes it in Java or TypeScript, Terraform is multi-cloud with a large community |

## Pricing basics {#pricing}

Most services bill along some of these dimensions: **compute time** (per second), **storage** per GB-month, **requests**, **data transferred out**, and **provisioned capacity**. Savings come from right-sizing, **Savings Plans or Reserved Instances** for steady load, **Spot** for interruptible work, **S3 lifecycle rules**, and turning things off. Watch **data transfer** (out of a region, between AZs, and through NAT gateways), which is often the surprise ([cost and FinOps](lesson:cloud-basics#cost)). A free tier exists for learning. Use **tags**, **Budgets** and cost anomaly alerts from the first day.

## Using AWS from a Java application {#java}

- **AWS SDK for Java v2** provides a client per service (`S3Client`, `SqsClient`, `DynamoDbClient`) with built-in retries and a **default credentials provider chain**: environment, SSO profile on a laptop, and the task or pod **role** in production, so there are **no access keys in code**.
- **Spring Cloud AWS** adds Spring-style integration: `@SqsListener`, `SqsTemplate`, S3 `Resource` loading, Secrets Manager and Parameter Store as property sources, and auto-configured clients.
- Reuse **one client per service**, closed on shutdown, with explicit timeouts, and set the region deliberately.
- For local development, **LocalStack** or Testcontainers can imitate S3, SQS and DynamoDB in tests ([testing](lesson:spring-testing)).
- Spring Boot's actuator health, graceful shutdown and externalised configuration fit ECS and EKS directly ([Kubernetes probes](lesson:kubernetes#probes)).

## In a bank {#bank}

- **Landing zone first.** A multi-account Organization with SCP guardrails, central logging and security accounts, single sign-on and no long-lived users is the base on which every workload is placed.
- **Region and residency.** Allowed regions are enforced by SCP, and data classes decide which services and keys may hold them.
- **Encryption.** KMS customer-managed keys per data class with rotation and tight key policies, TLS everywhere, S3 with block public access and default encryption, and private connectivity through VPC endpoints and PrivateLink.
- **Network.** Workloads in private subnets, a controlled egress path, Direct Connect to the data centre, and a hub-and-spoke design with Transit Gateway.
- **Detection and evidence.** CloudTrail organisation trail, Config rules and conformance packs, GuardDuty and Security Hub across all accounts, and immutable log storage.
- **Resilience.** Multi-AZ by default, tested failover, a documented region-level DR plan with RTO and RPO, and backups in a separate account.
- **Concentration and exit.** Regulators expect a view of the dependency on one provider, an exit strategy, and a clear division of responsibility ([shared responsibility](lesson:cloud-basics#responsibility)).

## Cheat sheet {#cheatsheet}

| Need | Service |
| --- | --- |
| a virtual machine | EC2 (Auto Scaling for fleets) |
| run a function on an event | Lambda |
| run containers | ECS or EKS, on Fargate when you want no nodes |
| objects and files | S3 (Glacier to archive) |
| a disk, a shared file system | EBS, EFS |
| relational database | RDS, Aurora |
| key-value at scale | DynamoDB |
| cache | ElastiCache (Redis) |
| private network | VPC with private subnets |
| spread traffic | ALB (HTTP), NLB (TCP) |
| DNS, CDN, API front door | Route 53, CloudFront, API Gateway |
| who may do what | IAM roles, Identity Center, SCPs |
| keys and secrets | KMS, Secrets Manager |
| decouple services | SQS, SNS, EventBridge, Kinesis or MSK |
| workflows | Step Functions |
| monitor, trace, audit | CloudWatch, X-Ray or OpenTelemetry, CloudTrail |
| infrastructure as code | CloudFormation, CDK, Terraform |
| many accounts | Organizations, Control Tower |

## Interview questions {#questions}

### [basic] How would you describe the main categories of AWS services? {#categories-q}

Compute (EC2, Lambda, ECS, EKS, Fargate) runs code. Storage (S3, EBS, EFS) and databases (RDS, Aurora, DynamoDB, ElastiCache) keep data. Networking (VPC, ELB, Route 53, CloudFront, API Gateway) connects and exposes services. Security and identity (IAM, KMS, Secrets Manager, WAF, GuardDuty) control access and protect data. Integration (SQS, SNS, EventBridge, Kinesis, Step Functions) decouples services. Developer and operations tools (CloudFormation, CloudWatch, CloudTrail, ECR) build, deploy, monitor and audit. Governance services (Organizations, Config, Control Tower) manage accounts and compliance.

### [basic] What is the difference between EC2, ECS, EKS, Fargate and Lambda? {#compute-q}

EC2 gives virtual machines that you manage. ECS is AWS's container orchestrator and EKS is managed Kubernetes. Fargate is a serverless way to run ECS or EKS containers without managing nodes. Lambda runs functions in response to events, scales to zero and bills per invocation. The more serverless the choice, the less you operate and the less control you have.

### [basic] What is S3 and what are its main uses? {#s3-q}

Simple Storage Service is object storage accessed over an API, with very high durability and virtually unlimited capacity. Objects are stored in buckets with keys, and are not a file system. It is used for documents, statements and images, backups and archives, static websites, and the data lake. It has storage classes (Standard, Infrequent Access, Glacier) and lifecycle rules for cost, versioning, encryption, and block public access, which should always be on.

### [basic] What is the difference between SQS and SNS? {#sqs-sns-q}

SQS is a queue: producers send messages that wait until a consumer pulls and deletes them, which buffers work and decouples producer from consumer. SNS is publish and subscribe: a message sent to a topic is pushed to all subscribers (queues, Lambda, HTTP, email). They are combined as fan-out: SNS to several SQS queues, each consumed independently, with dead-letter queues for failures.

### [basic] What is IAM and how is a role different from a user? {#iam-q}

IAM controls who can do what in AWS through identities and JSON policies, with default deny. A user has long-lived credentials and is meant for a person (and today people should rather use single sign-on). A role has no credentials of its own: an application, service or person assumes it and gets temporary credentials, so there are no keys to leak. Workloads on EC2, ECS, EKS and Lambda should always use roles.

### [basic] What is a VPC and what are public and private subnets? {#vpc-q}

A VPC is your private, isolated network inside a region. It is divided into subnets in availability zones. A public subnet has a route to an internet gateway and holds things that must be reachable, such as a load balancer. A private subnet has no direct route from the internet and holds applications and databases, reaching out through a NAT gateway or VPC endpoints. Security groups act as stateful firewalls around instances.

### [intermediate] RDS, Aurora or DynamoDB: how do you choose? {#database-q}

RDS suits a standard relational workload and managed operations on a familiar engine. Aurora is relational too, with higher throughput, quick failover, storage that grows by itself and up to 15 read replicas. DynamoDB is a serverless key-value and document store with single-digit millisecond latency at any scale, but you must design for known access patterns and there are no joins. Pick relational for complex queries and transactions across entities, and DynamoDB for simple, massive, key-based access, such as sessions, idempotency records or event stores.

### [intermediate] When would you use SQS, SNS, EventBridge or Kinesis? {#messaging-q}

SQS when a consumer group needs to pull work from a buffer. SNS to push one event to many subscribers. EventBridge to route events by content or schedule between AWS services, your services and SaaS partners, with rules and schema support. Kinesis or MSK when you need ordered, replayable streams, multiple readers at their own pace, and very high volume. Often they are combined, for example EventBridge or SNS in front of SQS queues.

### [intermediate] Explain how you would build a highly available web application on AWS. {#ha-q}

Route 53 and CloudFront at the edge with WAF, an Application Load Balancer across at least two AZs, stateless containers on ECS or EKS in private subnets in an auto scaling group, a multi-AZ database (Aurora or RDS) with an ElastiCache layer, and S3 for files. Services use IAM roles, secrets come from Secrets Manager, data is encrypted with KMS, logs and metrics go to CloudWatch, and the infrastructure is code deployed by a pipeline. For region-level protection add cross-region replication and a DR plan with a chosen RTO and RPO.

### [intermediate] What are service control policies and how do they differ from IAM policies? {#scp-q}

SCPs are attached to an Organization, an OU or an account and define the **maximum** permissions of every identity in it, including administrators. They never grant permission, they only limit. An IAM policy grants permissions to an identity. An action works only if both an SCP (and any permission boundary) and an IAM policy allow it. Typical SCPs restrict regions, prevent disabling CloudTrail or GuardDuty, and deny leaving the organisation.

### [intermediate] How does a Spring Boot application authenticate to AWS services without keys? {#sdk-q}

The SDK's default credentials provider chain looks for credentials in the environment, then the shared profile or SSO session, and then the container or instance metadata. In production the ECS task role, the EKS service account (IRSA or Pod Identity), or the Lambda execution role supplies temporary credentials automatically, so nothing is stored in code, configuration or images. On a laptop, the developer's SSO profile is used. The role's policy allows only the actions and resources the service needs.

### [intermediate] How do you handle duplicate messages with SQS? {#idempotent-q}

Standard SQS queues deliver at least once, so a message can arrive twice. Make the consumer idempotent: record each processed message id or business key with a conditional write (a DynamoDB `attribute_not_exists` condition, or a unique constraint in the database) and skip if it already exists, or design the operation to be naturally repeatable (set a status rather than add an amount). FIFO queues add deduplication for a window and ordering by message group, at a lower throughput.

### [intermediate] How do you reduce latency and cost for static and cacheable content? {#cdn-q}

Put CloudFront in front of S3 or the application, with cache behaviours and TTLs per path, compression and an origin access control so the bucket is not public. Users are served from the nearest edge, the origin load drops, and data transfer from CloudFront is usually cheaper than from the origin directly. Cache keys must include only what varies, and invalidation or versioned file names handle changes.

### [deep] Design the AWS architecture of a payment service for a bank. {#design-q}

A multi-account landing zone with SCP guardrails, an organisation CloudTrail and central security accounts. The workload account has a VPC across three AZs with isolated subnets for data, private subnets for the service, and public subnets only for the load balancer behind CloudFront and WAF. Stateless containers on ECS Fargate or EKS take payment requests, which are idempotent through a request key stored in Aurora, and publish events to SNS and SQS for downstream services, with dead-letter queues and alarms. Aurora multi-AZ stores transactions, ElastiCache stores short-lived data, and S3 stores statements. Roles give temporary credentials, secrets are in Secrets Manager, and data is encrypted with customer-managed KMS keys. Private connectivity uses VPC endpoints and Direct Connect to the data centre. The pipeline deploys by canary with automatic rollback, observability uses CloudWatch and tracing, and a second region holds replicated data for DR at the agreed RTO and RPO, with tested failover.

### [deep] How would you structure AWS accounts for a bank with many teams? {#accounts-q}

Use Organizations with OUs such as security, infrastructure, workloads (production and non-production), sandbox and suspended. Each application or environment gets its own account for a clean boundary of permissions, limits and cost. A log archive account and an audit account receive CloudTrail, Config and security findings, and the people who build cannot change them. SCPs enforce regions, encryption and the protection of logging, and Control Tower or custom automation provisions new accounts with a baseline. People use Identity Center with permission sets, pipelines assume narrow cross-account roles, networking uses Transit Gateway and shared VPCs or a hub-and-spoke model, and budgets and tags make costs visible per team.

### [deep] A Lambda behind SQS is processing messages twice and some never finish. What do you check? {#lambda-sqs-q}

Check the queue's **visibility timeout**: it must be longer than the function's timeout (AWS recommends at least six times), or the message becomes visible again while still being processed and is handled twice. Check batch handling: if one message in a batch fails, the whole batch returns unless you use partial batch response (`ReportBatchItemFailures`). Check the **dead-letter queue** and `maxReceiveCount`, the function's concurrency and throttling, and cold starts or timeouts under load. Make the handler idempotent, because duplicates are always possible, and put an alarm on the age of the oldest message and on the DLQ depth.

### [deep] How would you control cost on AWS across an organisation? {#cost-q}

Visibility first: consolidated billing, mandatory tags and cost allocation by team and service, Cost Explorer and the Cost and Usage Report, budgets and anomaly detection. Then reduce: right-size instances and databases, Savings Plans or reservations for the steady baseline, Spot for batch and stateless workers, schedules that stop non-production at night, S3 lifecycle and intelligent tiering, and removal of idle load balancers, snapshots and volumes. Watch data transfer, NAT gateway traffic and log volume, and use SCPs and service quotas to prevent expensive mistakes. Make cost a regular engineering review with owners, not a finance report.

### [coding] Write a Spring Boot SQS listener that processes a payment event idempotently using DynamoDB. {#coding-sqs}

```java
// pom.xml: io.awspring.cloud:spring-cloud-aws-starter-sqs and software.amazon.awssdk:dynamodb-enhanced
// application.properties: spring.cloud.aws.region.static=ap-southeast-1

@Component
public class PaymentEventListener {

    private final DynamoDbTable<ProcessedEvent> processed;
    private final PaymentService payments;

    public PaymentEventListener(DynamoDbEnhancedClient dynamo, PaymentService payments) {
        this.processed = dynamo.table("processed-events", TableSchema.fromBean(ProcessedEvent.class));
        this.payments = payments;
    }

    @SqsListener("payments-queue")
    public void handle(PaymentRequested event) {
        try {
            // claim the event first: fails if this id was already seen
            processed.putItem(PutItemEnhancedRequest.builder(ProcessedEvent.class)
                    .item(new ProcessedEvent(event.eventId()))
                    .conditionExpression(Expression.builder()
                            .expression("attribute_not_exists(eventId)").build())
                    .build());
        } catch (ConditionalCheckFailedException duplicate) {
            return;                          // already handled: acknowledge and ignore
        }
        payments.process(event);             // an exception here returns the message to the queue
    }
}
```

Explain: the listener acknowledges the message when the method returns normally, and SQS redelivers it if the method throws, so delivery is at least once; the **conditional put** makes duplicates harmless, because only the first delivery of an `eventId` succeeds in claiming it; a failure inside `process` leaves the claim in place, so in a real design the claim and the work share one transaction or the claim is released on failure; and the queue has a dead-letter queue with `maxReceiveCount`, so a poison message does not loop forever. The service uses its task role, with no keys in the code.

### [coding] Write AWS CLI commands that create a private, encrypted, versioned S3 bucket for statements. {#coding-s3}

```bash
BUCKET=example-bank-statements-prod
REGION=ap-southeast-1

aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"

# never public
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# keep old versions, so an overwrite or delete can be undone
aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

# encrypt by default with a customer-managed KMS key
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration '{
  "Rules": [{
    "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "aws:kms", "KMSMasterKeyID": "alias/statements-key" },
    "BucketKeyEnabled": true
  }]
}'

# move old statements to cheaper storage, expire very old versions
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules": [{
    "ID": "archive-old-statements", "Status": "Enabled", "Filter": { "Prefix": "customer-statements/" },
    "Transitions": [{ "Days": 90, "StorageClass": "GLACIER" }],
    "NoncurrentVersionExpiration": { "NoncurrentDays": 365 }
  }]
}'
```

Explain: block public access is the first control, and it is enforced at the account level in a bank as well; versioning protects against accidental overwrites and deletes; default encryption with a customer-managed key gives control over who can decrypt (and the key policy is part of the access model), and the bucket key reduces KMS request cost; the lifecycle rule moves data to Glacier after 90 days and removes old versions after a year, which should follow the retention policy; and in practice this is written as CloudFormation, CDK or Terraform and deployed by a pipeline, not typed by hand.

### [coding] Write a CloudFormation template for an SQS queue with a dead-letter queue and an alarm. {#coding-cfn}

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  PaymentsDlq:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: payments-dlq
      MessageRetentionPeriod: 1209600            # 14 days to investigate
      SqsManagedSseEnabled: true

  PaymentsQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: payments-queue
      VisibilityTimeout: 180                     # longer than the consumer's timeout
      SqsManagedSseEnabled: true
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt PaymentsDlq.Arn
        maxReceiveCount: 5                       # after 5 failed receives

  DlqNotEmptyAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: payments-dlq-not-empty
      Namespace: AWS/SQS
      MetricName: ApproximateNumberOfMessagesVisible
      Dimensions: [{ Name: QueueName, Value: !GetAtt PaymentsDlq.QueueName }]
      Statistic: Maximum
      Period: 60
      EvaluationPeriods: 1
      Threshold: 0
      ComparisonOperator: GreaterThanThreshold
      TreatMissingData: notBreaching
```

Explain: a message that fails five times is moved to the dead-letter queue, so one poison message cannot block the rest or loop forever; the DLQ keeps messages for 14 days so the team can look at them and redrive; the visibility timeout is longer than the consumer's processing time, to avoid duplicate handling; encryption is on; and the alarm fires as soon as anything lands in the DLQ, with an SNS action added in a real stack so that someone is notified.
