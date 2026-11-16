---
title: Cloud basics — models, regions, elasticity and shared responsibility
nav: Cloud basics
slug: cloud-basics
summary: What cloud computing is and why teams use it, IaaS, PaaS, FaaS and SaaS, public, private, hybrid and multi-cloud, regions, availability zones and edge locations, high availability and disaster recovery with RTO and RPO, elasticity and auto scaling, the shared responsibility model, identity and least privilege, cost and FinOps, cloud-native design and lock-in, migration strategies, and what a bank must consider, with AWS first and Azure and Google Cloud equivalents, examples and interview questions.
tags: [Cloud, AWS, Azure, GCP, IaaS, PaaS, High availability, Elasticity, Security]
order: 51
topic: Cloud / Basics
updated: 2026-11-17
subnav: true
---

"The cloud" is somebody else's data centre, rented by the hour and controlled with an API. That one sentence hides the real change: infrastructure becomes **software you call**, capacity becomes **elastic**, and you pay for **use**, not for ownership. Interviews ask *what the service models are, what a region and an availability zone are, how you make a system highly available, what elasticity means, who is responsible for what, how identities and permissions work, how costs are controlled, and why cloud is attractive and what its risks are.* Examples use **AWS** first, with the Azure and Google Cloud names beside it. Play the four scenes: service models, regions and zones, elasticity, and shared responsibility.

```demo
name: cloud-walk
```

> **One sentence to remember:** *Rent capacity on demand through an API, spread it across zones for availability, scale it with the load, give every identity the least privilege it needs, and remember that the provider secures the cloud while you secure what you put in it.*

## What makes it "cloud" {#what}

The US standard body NIST lists five essential characteristics:

1. **On-demand self-service:** you create resources yourself with a console, a CLI or an API, with no ticket.
2. **Broad network access:** everything is available over the network, through standard protocols.
3. **Resource pooling:** the provider serves many customers (multi-tenant) from shared hardware, with isolation.
4. **Rapid elasticity:** capacity grows and shrinks quickly, often automatically.
5. **Measured service:** use is metered and billed, so **cost follows consumption**.

Why teams move: speed (a server in minutes instead of weeks), elasticity (peaks without owning peak capacity), global reach, a large catalogue of **managed services** (databases, queues, machine learning), and turning a big up-front **capital expense** into an **operating expense**. The costs are real too: ongoing bills that can surprise you, a new security model, skills, and a degree of dependency on the provider.

## Service models {#models}

The models differ in **how much the provider manages for you** (the first scene):

| Model | You manage | Provider manages | AWS example | Azure / GCP |
| --- | --- | --- | --- | --- |
| **IaaS** (infrastructure) | OS, runtime, application, data, patches | hardware, network, virtualisation | EC2, EBS, VPC | Virtual Machines / Compute Engine |
| **PaaS** (platform) | application and its settings | OS, runtime, scaling, patching | Elastic Beanstalk, App Runner, RDS (managed database) | App Service / App Engine, Cloud Run |
| **FaaS / serverless** | a function and its triggers | servers, scaling (to zero), availability | Lambda, Fargate for containers | Azure Functions / Cloud Functions |
| **SaaS** (software) | users, data, configuration | the whole application | WorkMail, Amazon Connect (examples) | Microsoft 365 / Google Workspace |

Rules of thumb: **the higher up, the less you operate and the less you control**. Managed services (RDS instead of a database on EC2) usually cost more per unit and save a lot of operating work, and they are normally the right default for a team that should be building features. **Containers** sit between IaaS and PaaS: you run them on a managed orchestrator such as EKS, AKS or GKE (see [Kubernetes](lesson:kubernetes)), or on a serverless runtime such as Fargate or Cloud Run.

## Deployment models {#deployment-models}

- **Public cloud:** shared infrastructure from a provider (AWS, Azure, Google Cloud). The usual choice.
- **Private cloud:** cloud-style infrastructure used by one organisation, in its own data centre or dedicated hosting, for control or regulation. OpenShift or OpenStack on-premises is a common example.
- **Hybrid cloud:** on-premises and public cloud used together and connected by a private link (AWS Direct Connect, Azure ExpressRoute), common in banks with core systems that stay in their own data centres.
- **Multi-cloud:** more than one public provider. The reasons are regulation, resilience or a best-of-breed service. The costs are complexity, duplicated skills, and a **lowest-common-denominator** design. Using several clouds *to avoid* lock-in is often more expensive than the lock-in it avoids.

## Regions, zones and the edge {#regions}

The geography decides latency, availability and legal position (the second scene):

- A **region** is a geographic area with several data-centre groups, for example `ap-southeast-1` (Singapore) or `ap-southeast-3` (Jakarta). Services and prices differ by region, and **data stays in the region** you choose unless you copy it.
- An **availability zone (AZ)** is one or more separate data centres in a region, with independent power, cooling and network, connected by fast private links. Zones fail **independently**, so spreading across them survives a data-centre problem.
- **Edge locations** (a CDN such as CloudFront, Azure Front Door or Cloud CDN) cache content close to users and also absorb attacks.
- **Latency:** put compute near the users and near the data. A cross-region call adds tens to hundreds of milliseconds.
- **Data residency and sovereignty:** the choice of region is also a legal choice, which matters in a bank (see below).

## High availability and disaster recovery {#availability}

**High availability (HA)** means the system keeps working through a failure of a component. **Disaster recovery (DR)** means restoring service after a large failure such as the loss of a region. Two numbers define a DR plan:

| Term | Meaning | Example |
| --- | --- | --- |
| **RTO** (recovery time objective) | how long the service may be down | "back within 1 hour" |
| **RPO** (recovery point objective) | how much data may be lost, measured in time | "lose at most 5 minutes of data" |

A lower RTO and RPO cost more. The common patterns, from cheapest to fastest:

| Pattern | What runs in the second region | RTO | Cost |
| --- | --- | --- | --- |
| **Backup and restore** | only backups | hours | lowest |
| **Pilot light** | data replicated, minimal core services off | tens of minutes | low |
| **Warm standby** | a scaled-down full copy | minutes | medium |
| **Active-active** | full capacity in both regions | near zero | highest, and the data design is hard |

Inside one region, the standard HA design is: **two or three AZs**, a load balancer across them, stateless application instances in an auto scaling group, and a database with a **multi-AZ standby** (RDS Multi-AZ or Aurora). Remove single points of failure, use **health checks**, and combine this with [resilience patterns](lesson:microservice-resilience). **Test the failover**: a plan that has never been exercised is a hope.

## Elasticity and scaling {#elasticity}

- **Vertical scaling (scale up):** a bigger machine. Simple, with a ceiling, and it needs a restart.
- **Horizontal scaling (scale out):** more machines behind a load balancer. It needs a **stateless** application (session state in a shared store such as Redis, files in object storage), and it has no practical ceiling.
- **Auto scaling:** a group adds or removes instances by a **policy**, for example target tracking at 70 percent CPU, a schedule (before the salary-day peak), or a queue length (the third scene). Set a minimum for availability and a maximum so a bug cannot create a bill without limit.
- **Elasticity** is the *property* (capacity follows load), and **scalability** is the *ability* to handle more load. A system can scale and still not be elastic, for example if it needs a manual change.
- Scale the **whole path**: a database often becomes the next bottleneck, so use read replicas, caching, or a database that scales (DynamoDB, Aurora).

## Shared responsibility {#responsibility}

The provider and the customer split the security work (the fourth scene):

| | Provider ("security **of** the cloud") | Customer ("security **in** the cloud") |
| --- | --- | --- |
| Always | buildings, hardware, network, hypervisor, the managed service's own software | your identities, your data, your configuration, access rules |
| IaaS adds to the customer | | guest OS patches, firewall rules, application security |
| PaaS and SaaS | more falls to the provider | still always: **data, identities, configuration** |

The practical lesson: most real cloud incidents are **customer misconfigurations**, such as a public storage bucket, an open security group, a leaked access key, or an over-permissive role, and not a break-in at the provider.

## Identity and access (IAM) {#iam}

Access in the cloud is controlled by identity, not by network position alone:

- **Principals:** users (people), **roles** (identities that a service or a person *assumes* for a short time), and groups. Prefer **roles with temporary credentials** to long-lived access keys. A service running on EC2, ECS or EKS gets its role automatically and needs **no key in the code or the configuration**.
- **Policies** are JSON documents that say who may do which **actions** on which **resources**, under which **conditions**. The default is **deny**, and an explicit deny always wins.
- **Least privilege:** grant only what a job needs, on specific resources, and review it. Avoid `"Action": "*"` and `"Resource": "*"`.
- **People:** single sign-on through the company identity provider, **multi-factor authentication**, no shared accounts, and no day-to-day use of the root account. See [authentication and authorisation](lesson:authn-authz).
- **Multiple accounts:** separate accounts for production, testing and the shared tooling (AWS Organizations, Azure management groups, GCP projects and folders) limit the **blast radius** and make permissions easier to reason about.
- **Encryption:** data is encrypted at rest and in transit, with keys held in a key management service (KMS), and keys managed under policy. See [cryptography](lesson:cryptography).
- **Audit:** every API call is logged (CloudTrail, Azure Activity Log, Cloud Audit Logs), and the logs go to a protected, separate place.

## Networking in one minute {#networking}

A **VPC** (virtual private cloud, a VNet in Azure) is your private network inside a region. It is divided into **subnets** (public ones with a route to the internet, private ones without). **Security groups** are stateful firewalls attached to instances, and network ACLs filter subnets. Application servers and databases sit in **private subnets**, the load balancer is the only public entry point, and a NAT gateway lets private servers reach out. A private link or a VPN connects to the company data centre, and VPC endpoints let services reach managed services such as S3 without crossing the public internet.

## Managed building blocks {#services}

| Need | AWS | Azure | Google Cloud |
| --- | --- | --- | --- |
| virtual machines | EC2 | Virtual Machines | Compute Engine |
| containers on Kubernetes | EKS | AKS | GKE |
| serverless containers | Fargate, App Runner | Container Apps | Cloud Run |
| functions | Lambda | Functions | Cloud Functions |
| object storage | S3 | Blob Storage | Cloud Storage |
| relational database | RDS, Aurora | Azure SQL, Database for PostgreSQL | Cloud SQL, AlloyDB |
| NoSQL | DynamoDB | Cosmos DB | Firestore, Bigtable |
| messaging | SQS, SNS, Kinesis, MSK | Service Bus, Event Hubs | Pub/Sub |
| identity | IAM | Entra ID and Azure RBAC | Cloud IAM |
| monitoring | CloudWatch | Azure Monitor | Cloud Monitoring |

A later lesson walks through the AWS services in more detail.

## Cost and FinOps {#cost}

Cloud makes spending **easy and fast**, so cost needs a habit, called **FinOps**:

- **Pricing models:** on-demand (pay by the second or hour), **reserved or savings plans** (commit for one or three years for a large discount), **spot** (spare capacity at a big discount, interruptible, good for batch work and stateless workers).
- **Right-sizing:** most instances are oversized. Look at the real CPU and memory use.
- **Turn off what is idle** (development environments at night), set **lifecycle rules** that move old data to cheaper storage, and delete unattached disks and old snapshots.
- **Hidden costs:** **data transfer** out of a region or to the internet, cross-AZ traffic, NAT gateway processing, logs and metrics volume, and idle load balancers.
- **Tag** every resource (team, service, environment) so that costs are attributable, and set **budgets and alerts** per account.
- **Cost is an architecture property.** A design that needs ten cross-region calls per request has a bill as well as a latency problem.

## Cloud-native design and lock-in {#cloud-native}

**Cloud-native** means designing to use the cloud's strengths: small, stateless services that scale out, **configuration in the environment** (the twelve-factor approach), health checks, automation of everything (see [CI/CD](lesson:cicd-fundamentals)), **infrastructure as code**, observability ([metrics, logs and traces](lesson:spring-observability)), and failures treated as normal. Moving an old application unchanged to a VM ("lift and shift") works, but gets little of the benefit.

**Lock-in** is the cost of leaving a provider. Managed services are convenient and proprietary, so some lock-in is the price of the convenience. Manage it consciously: keep the business logic portable (standard languages, containers, standard protocols such as SQL, Kafka or S3-compatible APIs where it is cheap), isolate provider-specific code behind an interface, and **decide** where lock-in is acceptable instead of avoiding it at any cost.

## Migration strategies {#migration}

The "6 Rs" describe what to do with each existing application:

| Strategy | Meaning |
| --- | --- |
| **Rehost** | lift and shift to VMs, little change |
| **Replatform** | small changes to use a managed service (for example to RDS) |
| **Refactor** | redesign to be cloud-native, the most work and benefit |
| **Repurchase** | replace with a SaaS product |
| **Retire** | switch it off |
| **Retain** | leave it where it is, for now |

Start with a **landing zone** (a secure, multi-account base with networking, identity, logging and guardrails), move low-risk applications first, and learn before moving the critical ones.

## The well-architected view {#well-architected}

AWS, Azure and Google each publish a "well-architected framework" with similar pillars, a good checklist for reviews: **operational excellence**, **security**, **reliability**, **performance efficiency**, **cost optimisation** and **sustainability**. A review asks, for each pillar, what could go wrong and what you have done about it.

## In a bank {#bank}

- **Regulation.** In Singapore the regulator, MAS, issues technology risk management and outsourcing guidelines, and financial institutions must be able to show governance over a cloud provider: risk assessment, exit plans, audit rights, incident reporting and control over where data is.
- **Data residency and classification.** Customer data may have to stay in a chosen country or region, so regions are restricted by policy, and data is classified (public, internal, confidential) with matching controls.
- **Encryption and keys.** Encryption everywhere, with customer-managed keys (KMS or an HSM), key rotation, and tight control over who can use a key.
- **Hybrid reality.** Core banking often stays on-premises and connects through private links, so latency, security and the dependency between the two sides are designed in.
- **Guardrails, not tickets.** Preventive controls (service control policies, policy as code) make an insecure configuration impossible, and detective controls (continuous compliance checks) find drift, which gives both speed and evidence.
- **Resilience.** A documented RTO and RPO per service, tested failover, an **exit plan** that says how to leave the provider, and concentration-risk awareness: depending on one provider for many critical services.
- **Audit.** Central, immutable logs of every administrative action, and separation of duties between those who build and those who can approve or change production.

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| characteristics | self-service, network access, pooling, elasticity, measured use |
| models | IaaS (VM) – PaaS (app) – FaaS (function) – SaaS (software); higher means less you manage |
| deployment | public, private, hybrid (common in banks), multi-cloud (costly) |
| geography | region (country level), AZ (separate data centre), edge (CDN) |
| HA | two or more AZs, load balancer, stateless app, multi-AZ database, tested failover |
| DR | RTO (time) and RPO (data); backup, pilot light, warm standby, active-active |
| scaling | scale out needs stateless; auto scaling policy with min and max |
| responsibility | provider secures the cloud, you secure what is in it; misconfiguration is the main risk |
| IAM | roles with temporary credentials, least privilege, default deny, MFA, separate accounts |
| network | VPC, private subnets for apps and data, one public entry point |
| cost | right-size, reserved or savings plans, spot, tags, budgets, watch data transfer |
| cloud-native | stateless, config in the environment, IaC, observability, automation |
| migration | rehost, replatform, refactor, repurchase, retire, retain |
| bank | data residency, customer-managed keys, guardrails, exit plan, audit logs |

## Interview questions {#questions}

### [basic] What is cloud computing and what are its main benefits? {#what-q}

Cloud computing is the on-demand use of computing resources (servers, storage, databases, networking, software) from a provider over the network, created through an API and billed by use. The benefits are speed (resources in minutes), elasticity (capacity follows demand), pay-as-you-go cost instead of up-front capital, a global footprint, and a large catalogue of managed services that remove operating work. The costs to remember are a different security model, bills that can grow unnoticed, and some dependency on the provider.

### [basic] What are IaaS, PaaS, FaaS and SaaS? {#models-q}

They describe how much the provider manages. IaaS gives virtual machines, storage and networks, and you manage the OS and everything above (EC2). PaaS gives a platform to which you deploy code, and the provider manages the OS, runtime and scaling (Elastic Beanstalk, App Service). FaaS or serverless runs a function on an event, scales to zero and bills per call (Lambda). SaaS is a finished application that you only use and configure (Microsoft 365). The higher the level, the less you operate and the less you control.

### [basic] What is the difference between a region and an availability zone? {#region-az-q}

A region is a geographic area, such as Singapore. An availability zone is one or more separate data centres inside a region, with independent power, cooling and network, connected by fast links. Spreading an application across zones protects it from the failure of a data centre, and spreading across regions protects it from the loss of a whole region, and is also used for latency and for data residency.

### [basic] What does the shared responsibility model mean? {#shared-q}

The provider is responsible for the security **of** the cloud: facilities, hardware, network and the virtualisation layer. The customer is responsible for security **in** the cloud: identities and permissions, data, configuration, and, with IaaS, the guest operating system and the application. The more managed the service, the more the provider covers, but data, identities and configuration always remain the customer's. Most incidents come from customer-side misconfiguration.

### [basic] What is elasticity and how is it different from scalability? {#elasticity-q}

Scalability is the ability to handle a larger load by adding resources. Elasticity is the ability to add and remove resources **automatically** as the load changes, so you do not pay for idle capacity. A system can be scalable (you can add servers by hand) without being elastic. Elasticity needs auto scaling, a stateless design and a load balancer.

### [basic] What is the difference between public, private, hybrid and multi-cloud? {#deployment-q}

Public cloud is shared provider infrastructure. Private cloud is dedicated to one organisation. Hybrid combines on-premises or private systems with public cloud over a private connection, which is common where core systems cannot move. Multi-cloud uses more than one public provider, for regulation, resilience or specific services, at the price of more complexity and the need to avoid depending on only the common features.

### [intermediate] How would you make an application highly available on AWS? {#ha-q}

Use at least two availability zones. Put the stateless application instances in an auto scaling group behind an Application Load Balancer that spans the zones and checks health. Keep state out of the instances: sessions in a shared store, files in S3. Use a database with a synchronous multi-AZ standby, and a managed service that is already regional where possible. Remove single points of failure (NAT gateways, a single queue consumer), set sensible timeouts and retries, and rehearse a zone failure. For region-level protection add a DR design with a chosen RTO and RPO.

### [intermediate] What are RTO and RPO and how do they drive a DR design? {#rto-rpo-q}

RTO is the maximum acceptable time to restore the service, RPO is the maximum acceptable data loss measured as time. They come from business impact, and the shorter they are, the more the design costs. Backup and restore gives hours of RTO and an RPO of the last backup. Pilot light and warm standby keep replicated data and part of the system in a second region for minutes of RTO. Active-active gives almost no downtime and needs careful data replication and conflict handling. The plan is only valid if the restore or failover is tested.

### [intermediate] Why must an application be stateless to scale horizontally, and where does the state go? {#stateless-q}

When any instance can receive any request, a load balancer can add or remove instances freely, and a failed instance loses nothing. State held in an instance's memory or disk ties users to it and disappears with it. Move it out: sessions or tokens in a shared store such as Redis or in a signed token, files in object storage, data in a database, and work in a queue. See the twelve-factor processes rule.

### [intermediate] How do you give an application running on AWS access to S3 securely? {#role-q}

Give the workload an **IAM role** (an EC2 instance profile, an ECS task role, or an EKS service-account role) with a policy that allows only the needed actions on the specific bucket or prefix. The SDK's default credentials provider chain obtains short-lived credentials from the environment automatically, so no access key is stored in code, configuration or images. Add a bucket policy that blocks public access, encrypt the bucket with KMS, use a VPC endpoint so traffic does not leave the AWS network, and log the access.

### [intermediate] What is the principle of least privilege in the cloud, and how do you apply it? {#least-privilege-q}

Every identity gets only the permissions it needs, on only the resources it needs, for only as long as it needs them. In practice: no wildcards in actions and resources, roles per workload, temporary credentials, separate accounts per environment, permission boundaries and service control policies as guardrails, an access analyser or last-used data to find and remove unused permissions, and regular reviews. Start with no access and add, instead of removing from broad access.

### [intermediate] A cloud bill doubled this month. How do you find the cause and prevent it? {#cost-q}

Use the cost explorer, grouped by service, account, region and tag, to find what changed. Common causes are data transfer or NAT gateway traffic, a runaway auto scaling group, large log or metric volume, forgotten test environments, and unattached storage. Fix the cause, and then add controls: mandatory tags, budgets with alerts, anomaly detection, a maximum size on scaling groups, lifecycle rules, right-sizing, and reserved or savings plans for the steady part of the load.

### [intermediate] What is vendor lock-in and how do you handle it? {#lockin-q}

Lock-in is the cost and effort of moving away from a provider because of proprietary services and APIs. It is not entirely avoidable, because managed services are the main benefit. Handle it deliberately: keep business logic portable and separate from provider SDK calls, use containers and open standards (SQL, Kafka, OpenTelemetry) where the portability is cheap, decide which services are worth the lock-in, document an exit plan, and avoid multi-cloud purely as insurance, because it adds cost and complexity of its own.

### [intermediate] Explain the 6 Rs of cloud migration. {#migration-q}

Rehost (lift and shift), replatform (small changes to use managed services), refactor (redesign for cloud-native), repurchase (replace with SaaS), retire (switch off) and retain (leave on-premises). A portfolio assessment assigns one to each application by value, risk and effort. Typical practice is to build a landing zone first, migrate low-risk applications to learn, and refactor only the applications where the benefit justifies the cost.

### [deep] Design a highly available, secure, three-tier web application on AWS for a bank. {#design-q}

Use a multi-account setup with a landing zone and guardrails. In a VPC with three private tiers across at least two AZs: a public Application Load Balancer with WAF as the only internet entry, application containers on ECS, Fargate or EKS in private subnets and in an auto scaling group, and a multi-AZ Aurora or RDS database in isolated subnets. Workloads use IAM roles, secrets come from Secrets Manager, and data is encrypted with customer-managed KMS keys. Reach managed services through VPC endpoints, and the company data centre through Direct Connect or VPN. Logs, metrics and traces go to a central, protected account, CloudTrail is on everywhere, and compliance rules are checked continuously. DR uses a second region at the RTO and RPO set by the business, with tested failover. Infrastructure is code deployed by a pipeline with approvals, and the region choice follows data residency rules.

### [deep] How do you secure a cloud environment against the most common breaches? {#secure-q}

The common causes are customer-side: public storage, over-permissive roles, leaked keys, unpatched VMs and open ports. Put preventive controls in place (block public access at the account level, service control policies, no long-lived keys, MFA and SSO for people, security groups that default to closed). Add detective controls (a configuration compliance service, GuardDuty or an equivalent for threats, central audit logs, vulnerability scanning, alerts on root usage), and keep infrastructure in code so a review and a pipeline check every change. Encrypt data and manage keys carefully, segment accounts and networks, and practise incident response, including how to revoke an exposed credential.

### [deep] When would you choose serverless over containers or VMs, and what are the trade-offs? {#serverless-q}

Serverless fits event-driven, spiky or low-volume work, glue code and APIs without steady traffic: no servers to manage, scale to zero and billing by use. The trade-offs are cold starts (important for JVM functions, which can be reduced with SnapStart or native images), execution time and memory limits, harder local testing, many small functions to observe and deploy, and provider coupling. Steady, high-volume or long-running workloads are often cheaper and simpler on containers or VMs, and a team that already runs Kubernetes may prefer to stay there.

### [deep] How would you design for failure of a single AZ or a whole region? {#failure-q}

For a zone: spread every tier over at least two zones with health checks, make sure the remaining zones can carry the full load (capacity for N+1), use a multi-AZ database with automatic failover, and avoid anything zonal that is a single point of failure. For a region: choose an RTO and RPO, replicate data (cross-region replicas, backups or global tables), keep infrastructure as code so the second region can be created or scaled quickly, route users with health-checked DNS, and **test** the failover regularly. Also check shared dependencies, such as the identity provider or a global control plane, which can fail across regions.

### [coding] Write an IAM policy that lets a service read objects under one prefix of one bucket and nothing else. {#coding-iam}

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadStatementsOnly",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::example-bank-statements/customer-statements/*"
    },
    {
      "Sid": "ListOnlyThatPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::example-bank-statements",
      "Condition": { "StringLike": { "s3:prefix": ["customer-statements/*"] } }
    }
  ]
}
```

Explain: the first statement allows reading objects only below the `customer-statements/` prefix of one named bucket, and the second lets the service list only that prefix, because listing is a bucket-level action and needs its own resource and a condition. Nothing grants write, delete or other buckets, so the default deny covers the rest. The policy is attached to the service's **role**, not to a user, so credentials are temporary. Add a KMS permission (`kms:Decrypt` on the one key) if the bucket is encrypted with a customer-managed key, and a bucket policy that blocks public access.

### [coding] Write Java code that uploads a statement to S3 with the AWS SDK v2, without any keys in the code. {#coding-s3}

```java
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

public class StatementStore {

    private final S3Client s3 = S3Client.builder()
            .region(Region.AP_SOUTHEAST_1)        // Singapore; credentials come from the default chain
            .build();

    private final String bucket = "example-bank-statements";

    public void save(String customerId, String month, byte[] pdf) {
        String key = "customer-statements/" + customerId + "/" + month + ".pdf";
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType("application/pdf")
                .serverSideEncryption(ServerSideEncryption.AWS_KMS)   // encrypt with a KMS key
                .build();
        s3.putObject(request, RequestBody.fromBytes(pdf));
    }
}
```

Explain: the client uses the **default credentials provider chain**, so in production it picks up the temporary credentials of the task or pod role, and on a laptop it uses the developer's SSO profile; there is no access key in the code, the properties or the image. The region is explicit, to respect data residency. The object is encrypted with KMS, the key contains the customer and month so the policy can restrict by prefix, and the SDK retries transient failures by default. In Spring Boot the client would be a singleton bean, closed on shutdown, with a timeout configuration, and S3 would be reached through a VPC endpoint.

### [coding] Write an auto scaling policy that keeps average CPU at 60 percent, between 2 and 8 instances. {#coding-scaling}

```bash
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name payments-asg \
  --min-size 2 --max-size 8 \
  --vpc-zone-identifier "subnet-aaa111,subnet-bbb222"       # two subnets in two zones

aws autoscaling put-scaling-policy \
  --auto-scaling-group-name payments-asg \
  --policy-name cpu-target-60 \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": { "PredefinedMetricType": "ASGAverageCPUUtilization" },
    "TargetValue": 60.0,
    "DisableScaleIn": false
  }'
```

Explain: the minimum of two (in two subnets, so two zones) keeps the service available if a zone fails, and the maximum of eight caps the cost and limits the damage of a runaway loop. A **target tracking** policy works like a thermostat: it adds instances when average CPU is above 60 percent and removes them when it is well below, with built-in cooldowns. For a queue worker the metric would be the queue length per instance, and for a known peak a **scheduled action** can raise the minimum before it starts. The instances must be stateless and register with the load balancer's target group.
