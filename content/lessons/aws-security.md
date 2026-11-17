---
title: AWS identity and security — IAM, KMS, Secrets Manager, Cognito and detection
nav: AWS security
slug: aws-security
summary: How identity and security work on AWS for Java and Spring Boot, IAM principals, roles and temporary credentials, policy types and how a request is evaluated, least privilege tooling, roles for tasks, pods, functions and pipelines, IAM Identity Center for people, Organizations and service control policies, KMS envelope encryption and key policies, Secrets Manager and Parameter Store, Cognito user pools, protection with WAF and Shield, detection with CloudTrail, Config, GuardDuty, Security Hub, Inspector and Macie, and what a bank adds, with examples and interview questions.
tags: [AWS, IAM, KMS, Secrets Manager, Cognito, Security, CloudTrail, GuardDuty, Encryption, Java, Spring Boot]
order: 59
topic: Cloud / AWS
updated: 2026-11-17
subnav: true
---

Security is the first thing a bank checks on a cloud design, so interviews go deep. They ask *what an IAM role is and why it replaces access keys, how a request is evaluated when several policies apply, what a service control policy does, how a task or a pipeline gets permissions, how KMS envelope encryption works, where secrets live and how they rotate, how Cognito relates to OAuth and OIDC, and how you detect and respond to a problem.* This lesson follows the [service map](lesson:aws-service-map#security), builds on [cloud basics](lesson:cloud-basics#iam) and the [shared responsibility model](lesson:cloud-basics#responsibility), and links to [authentication and authorization](lesson:authn-authz) and [cryptography](lesson:cryptography). Play the four scenes: roles, envelope encryption, secrets, and detection.

```demo
name: aws-security-walk
```

*The AWS service icons in the diagrams are the official AWS Architecture Icons, shown unmodified. This site is not affiliated with, endorsed by or sponsored by Amazon Web Services.*

> **One sentence to remember:** *Give every workload a role with only the permissions it needs, give people temporary access through single sign-on, encrypt with keys you control, keep secrets out of code, and record and watch everything so a mistake or an attack is seen and can be explained.*

```demo
name: aws-map-security
```

## The identity model {#identity}

IAM (Identity and Access Management) answers two questions for every API call: **who is calling** and **are they allowed**.

- **Principals** are the callers: an **IAM role**, an IAM user, a federated user, an AWS service, or the account root.
- **The root user** of an account can do anything and cannot be restricted by policies in the account. Protect it with MFA, store the credentials in a safe, create no access keys for it, and use it only for the few tasks that require it.
- **IAM users** have long-lived passwords and access keys. They leak, so a modern design has **no IAM users for people or workloads**.
- **IAM roles** have no password and no keys. A principal **assumes** the role through **STS** (the Security Token Service) and receives **temporary credentials** (an access key, a secret and a session token) valid from 15 minutes to 12 hours. Roles are used by services, applications, pipelines, other accounts and people through single sign-on.
- **A role has two policies of different kinds:** the **trust policy** says **who may assume** the role, and the **permissions policies** say **what the role may do**. Mixing the two up is a common mistake.
- **Where credentials come from:** ECS tasks, EC2 instances, Lambda functions and EKS pods receive them from the platform's metadata endpoint, and the SDK finds them by itself through the **default credentials provider chain** (environment, web identity, container and instance providers, then profile files). Application code never handles a key ([Java](#java)).
- **Sessions and tags:** a session can carry **session tags** and a **session policy** that narrows its permissions for one use, which is how a broker gives a user a limited, short-lived grant.

## Policies and how a request is evaluated {#policies}

A policy is a JSON document of **statements** with an `Effect` (Allow or Deny), `Action`, `Resource`, an optional `Principal` (in resource policies) and an optional `Condition`. There are several kinds:

| Policy | Attached to | Purpose |
| --- | --- | --- |
| **identity-based** | a role, user or group | what that identity may do |
| **resource-based** | the resource (a bucket, a key, a queue, a role trust) | who may use the resource, **including other accounts** |
| **service control policy (SCP)** | an organization, OU or account | the **maximum** permissions in the accounts, a guardrail |
| **permissions boundary** | a role or user | the maximum an identity policy can grant, used for delegated administration |
| **session policy** | one assumed-role session | narrows that session |
| **endpoint policy** | a VPC endpoint | what may pass through the endpoint ([endpoints](lesson:aws-networking#egress)) |

The evaluation logic for a request is:

1. **Everything is denied by default.**
2. An **explicit Deny in any policy always wins.**
3. Otherwise the request needs an **Allow** from the right places: within one account, an identity policy **or** a resource policy is enough, and an **SCP, a permissions boundary and a session policy must each also allow** it (they only restrict, they never grant).
4. For **cross-account** access both sides must agree: the caller's identity policy **and** the resource policy in the other account.

Useful policy features:

- **Conditions:** restrict by source IP, VPC or endpoint (`aws:SourceVpce`), MFA, TLS (`aws:SecureTransport`), time, region (`aws:RequestedRegion`), tags, and the organization (`aws:PrincipalOrgID`).
- **ABAC (attribute-based access control):** allow when the principal's tag equals the resource's tag (`aws:PrincipalTag/team` equals `aws:ResourceTag/team`), so one policy serves many teams ([RBAC and ABAC](lesson:authn-authz#rbac-abac)).
- **Resource-level permissions:** name the specific bucket prefix or table, never `"Resource": "*"` unless the action cannot be scoped.
- **Wildcards and `NotAction`** are easy to get wrong, and `"Action": "*"` is the classic over-permission.

## Least privilege in practice {#least-privilege}

Nobody writes perfect policies at the start, so the process matters:

- **Start narrow** with the actions and resources the code needs, and read the `AccessDenied` messages as you test.
- **IAM Access Analyzer** finds resources shared outside your account or organization, **generates a policy from CloudTrail activity**, and validates policies against best practices. Its **unused access findings** list roles, users and permissions nobody has used.
- **Last accessed information** shows which services and actions a role has really used, so you can remove the rest.
- **Policy simulator** and `aws iam simulate-principal-policy` test whether a call would be allowed.
- **Managed policies:** AWS managed policies (such as `AdministratorAccess` or `PowerUserAccess`) are broad, so write **customer managed** policies for real workloads and keep them in code and under review ([infrastructure as code](lesson:aws-service-map#operations)).
- **Separate roles** for separate jobs: one role per service and function, not one shared role for all, so a compromise stays small.

## Roles for workloads, pipelines and people {#roles}

| Who | How they get permissions |
| --- | --- |
| **ECS or Fargate task** | a **task role** (the application) and a separate **execution role** (pulling the image, writing logs) |
| **EKS pod** | **IRSA** or **EKS Pod Identity**, which map a Kubernetes service account to an IAM role ([EKS](lesson:aws-compute#ecs)) |
| **Lambda function** | an **execution role**, plus a resource policy that says who may invoke it |
| **EC2 instance** | an **instance profile** carrying a role |
| **CI/CD pipeline** | **OIDC federation**: the pipeline presents its signed identity token (GitHub Actions or GitLab CI) and assumes a role, with **no stored AWS key**, restricted by repository and branch in the trust policy ([pipelines](lesson:cicd-fundamentals)) |
| **Another account** | **cross-account role assumption**, the trust policy names the other account or organization |
| **On-premises server** | **IAM Roles Anywhere**, using an X.509 certificate from the bank's own CA |
| **Engineers and operators** | **IAM Identity Center**, below |

**IAM Identity Center** is single sign-on for the workforce. It connects to the bank directory (SAML or SCIM from Entra ID, Okta and others), enforces **MFA**, and maps a group to a **permission set**, which becomes a temporary role in each assigned account. Access is time-limited, central, and removed when someone leaves the directory. There is no need for IAM users.

**Break-glass access:** keep a tightly controlled, monitored emergency role for the case where single sign-on is down, with alarms when it is used.

## Accounts, organizations and guardrails {#organizations}

A bank does not run everything in one account. **AWS Organizations** groups accounts into **organizational units** (security, network, shared services, workloads by environment), and **Control Tower** builds the landing zone with baseline accounts and controls ([accounts](lesson:aws-service-map#accounts)). Separate accounts give a strong **blast radius** boundary, because an IAM mistake or a compromise stops at the account edge.

**Service control policies** attach to the organization or an OU and set the **outer limit**. They do not grant anything and they do not apply to the management account. Typical guardrails:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyOutsideApprovedRegions",
      "Effect": "Deny",
      "NotAction": ["iam:*", "organizations:*", "route53:*", "cloudfront:*", "support:*"],
      "Resource": "*",
      "Condition": { "StringNotEquals": { "aws:RequestedRegion": ["ap-southeast-1", "ap-southeast-2"] } }
    },
    {
      "Sid": "ProtectAuditTrail",
      "Effect": "Deny",
      "Action": ["cloudtrail:StopLogging", "cloudtrail:DeleteTrail", "config:StopConfigurationRecorder", "guardduty:DeleteDetector"],
      "Resource": "*"
    },
    {
      "Sid": "NoRootUser",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": { "StringLike": { "aws:PrincipalArn": "arn:aws:iam::*:root" } }
    }
  ]
}
```

The first statement keeps workloads in the approved regions (data residency), the second makes it impossible for anyone in the member accounts to switch off the audit trail, and the third blocks use of the root user in member accounts. Other common ones deny leaving the organization, creating IAM users or access keys, disabling S3 Block Public Access, and creating unencrypted volumes.

## AWS KMS {#kms}

**KMS** creates and controls encryption keys, with every use authorised by policy and logged in CloudTrail. The keys are protected in FIPS-validated hardware, and **the key material never leaves KMS**.

- **Key types:** **AWS owned** (invisible, no control), **AWS managed** (`aws/s3`, created for you, rotated, policy fixed) and **customer managed** (you set the key policy, rotation, tags, aliases and can disable or schedule deletion). Banks mostly use **customer managed keys** for data in scope, because they give control and an audit trail.
- **Symmetric or asymmetric:** symmetric keys (AES-256-GCM) cover encryption; asymmetric keys (RSA, ECC) cover signing and key agreement, with the public key available outside KMS.
- **Envelope encryption** (the second scene) is the pattern: KMS encrypts a **data key**, and the data key encrypts the data. `Encrypt` and `Decrypt` handle only **4 KB**, so for larger data the application calls `GenerateDataKey`, encrypts locally with AES-GCM, **discards the plaintext key** and stores the **encrypted data key** beside the ciphertext. Most AWS services (S3, EBS, RDS, DynamoDB) do this for you. The **AWS Encryption SDK** does it for your own code ([cryptography](lesson:cryptography#hybrid)).
- **Key policy:** every key has a resource policy that is the **root of access**. A key policy that delegates to IAM (the default allows the account root) lets IAM policies grant use. Separate **key administrators** (manage the key) from **key users** (encrypt and decrypt), and deny use outside the organization.
- **Grants** give temporary, narrow permission to use a key, which AWS services use for you.
- **Rotation:** automatic **yearly rotation** of the key material keeps the same key ID and old versions, so nothing has to be re-encrypted. Rotating by hand means a new key and an alias switch.
- **Encryption context:** extra key-value data bound to the ciphertext and logged, which stops a ciphertext for one purpose from being decrypted for another.
- **Multi-Region keys** make related keys in several regions, so data encrypted in one region decrypts in another (disaster recovery, global tables).
- **Quotas and cost:** KMS has **request rate limits**, and high-volume encryption can be throttled, so use **S3 Bucket Keys** and cache data keys. Each customer managed key costs a small monthly fee plus per request.
- **CloudHSM** gives you a **dedicated hardware security module** under your sole control, for strict regulatory needs, at a much higher cost and effort. KMS custom key stores can use it.
- **Deleting a key** destroys all data under it, so KMS enforces a **7 to 30 day waiting period** and you should alarm on `ScheduleKeyDeletion`.

## Secrets {#secrets}

- **Secrets Manager** stores a secret (a database credential, an API key, a certificate) encrypted with KMS, controls access with IAM and resource policies, versions it, replicates it across regions, and **rotates it automatically** by calling a Lambda function (managed rotation exists for RDS and Aurora) (the third scene). It charges per secret and per API call.
- **Parameter Store** (in Systems Manager) holds configuration. `String` parameters are plain, `SecureString` parameters are KMS-encrypted. The standard tier is free and cheaper than Secrets Manager but has **no built-in rotation**.
- **Rules:** nothing secret in source control, images, environment files, logs or tickets. Applications read secrets at start-up (or periodically) with their role and keep them in memory only.
- **Avoid secrets where you can:** use **IAM roles** instead of AWS keys, **IAM database authentication** (a 15 minute token) or RDS Proxy instead of a stored database password ([databases](lesson:aws-databases#connections)), and OIDC federation instead of pipeline keys.
- **When one leaks:** rotate it at once, check CloudTrail for its use, and revoke sessions. Scan code and history for secrets (GitLeaks, GitHub secret scanning) in the pipeline.
- **ACM** (Certificate Manager) issues and **renews TLS certificates** for CloudFront, load balancers and API Gateway. Private CA issues certificates for internal and mutual TLS.

## Cognito and application identity {#cognito}

**Amazon Cognito** provides sign-in for **your application's users** (customers), which is different from IAM, which is for AWS access:

- **User pool:** a user directory that handles registration, sign-in, **MFA**, password policies, account recovery, social and SAML federation, and issues **OIDC tokens** (an ID token, an access token and a refresh token, all JWTs). It is an **OAuth 2.0 and OpenID Connect authorization server**: your API validates the access token like any other ([OAuth 2.0](lesson:oauth2#validate), [OIDC](lesson:oidc#flow), [JWT validation](lesson:jwt#validation)).
- **Identity pool:** exchanges a token (from a user pool or another provider) for **temporary AWS credentials**, for a mobile app that uploads straight to S3.
- **Hosted UI, custom domain, Lambda triggers** (pre sign-up, token customisation) and **advanced security** (compromised credential and risky sign-in detection).
- **With API Gateway or an ALB:** both can validate Cognito tokens before the request reaches the service ([API Gateway](lesson:aws-networking#api-gateway)), and a Spring Boot service can also act as an OAuth resource server ([Spring Security](lesson:spring-security#jwt-rs)).
- **Limits to know:** the user pool is a managed product with its own limits and migration cost. A bank with its own identity platform often keeps that platform and uses Cognito only for a specific channel, or federates it.

## Protecting the application and the network {#protection}

- **WAF** filters web requests with managed rule groups, rate rules and custom rules, attached to CloudFront, an ALB, API Gateway or Cognito. **Shield** protects against DDoS (Standard is automatic and free, **Advanced** adds response support and cost protection). **Network Firewall** filters traffic inside the VPC by domain and rule. Details are in the [networking lesson](lesson:aws-networking#edge).
- **Security groups and private subnets** keep the application away from the internet, and **VPC endpoints with policies** keep AWS traffic private ([firewalls](lesson:aws-networking#firewalls)).
- **Encryption in transit** everywhere: TLS to the edge and the load balancer, and between services where the bank requires it, with mutual TLS for service-to-service calls if needed ([mTLS](lesson:cryptography#mtls)).
- **S3 Block Public Access**, bucket policies that require TLS and the organization, and Object Lock for records ([storage security](lesson:aws-storage#security)).

## Detection and response {#detection}

Prevention fails sometimes, so record, check, alert and respond (the fourth scene):

| Service | What it does |
| --- | --- |
| **CloudTrail** | records **every API call** (who, when, from where, what) for the management plane, and optionally data events (S3 object access). Send an **organization trail** to a locked bucket in a **log archive account**, with **log file validation** |
| **AWS Config** | records resource configuration over time and **checks it against rules** (no public bucket, encryption on, no open SSH), with **conformance packs** and automatic remediation |
| **GuardDuty** | threat detection from CloudTrail, VPC Flow Logs, DNS logs, S3 and EKS activity: compromised credentials, crypto-mining, unusual API use |
| **Security Hub** | aggregates findings from GuardDuty, Inspector, Macie, Config and partner tools across accounts, and scores the account against standards such as **CIS** and **PCI DSS** |
| **Inspector** | scans EC2, ECR images and Lambda functions for **known vulnerabilities** |
| **Macie** | finds **sensitive data** (card numbers, personal data) in S3 |
| **Detective** | investigates a finding by showing the related activity graph |
| **IAM Access Analyzer** | external and unused access findings |
| **EventBridge** | routes findings to tickets, a chat channel or an automatic action such as isolating an instance or disabling a key |

A response runbook should be tested: **isolate** the resource (swap its security group, detach the role, deny with a policy), **preserve evidence** (snapshot the disk, keep logs), **rotate** exposed credentials, **find the cause** in CloudTrail, then **fix** and **learn**. Run exercises, because the first real incident is the wrong time to find a missing permission.

## Java and Spring Boot {#java}

- **No keys in code:** build the SDK clients without credentials, for example `S3Client.create()`, and the **default credentials provider chain** picks up the task role, the IRSA token or the local profile in development.
- **Region and endpoint:** set the region from configuration or the environment, and use VPC endpoints in the network without changing code.
- **Secrets:** use **Spring Cloud AWS** (`spring.config.import=aws-secretsmanager:payments/db`) or the **AWS Secrets Manager JDBC library / caching client**, which caches the secret and refreshes after rotation. Reload the connection pool credentials after a rotation, or rely on RDS Proxy.
- **JWT validation:** a Spring Boot resource server points at the Cognito issuer URI, and Spring downloads the keys and validates the signature, issuer, expiry and audience. Check the `scope` or group claims for authorization ([coding example](#coding-spring)).
- **Encryption in your own code:** use the **AWS Encryption SDK** or the KMS client with `GenerateDataKey` and AES-GCM, and bind an **encryption context** ([coding example](#coding-kms)).
- **Least privilege in tests:** run integration tests against a role with the same limited policy, or LocalStack with IAM enforcement, so a missing permission is found in the pipeline.
- **Logging:** never log tokens, secrets or full card numbers, and log the request ID so CloudTrail and application logs line up.

## Cost levers {#cost}

- **KMS:** monthly key fees, per request fees and throttling. Use S3 Bucket Keys, data key caching, and one key per data domain rather than one per object or per table.
- **Secrets Manager:** a monthly price per secret plus API calls. Use Parameter Store for non-secret settings, and cache secrets in the application.
- **CloudTrail:** the first management event trail is free, extra trails and **data events** cost money and create volume. Log what an auditor needs.
- **GuardDuty, Config, Macie, Inspector and Security Hub** are priced by usage (events, resources, items scanned), so enable them for the organization and watch the first month's bill, especially Macie on large buckets.
- **WAF** costs per web ACL, rule and request.
- **The cost of not doing it** (an incident, a failed audit) is far higher, so the right goal is the needed coverage at a sensible price, not the cheapest.

## In a bank {#bank}

- **Landing zone:** accounts per environment and domain under Organizations, SCPs for region, audit trail, encryption and public access guardrails, and a separate **security** and **log archive** account that workload teams cannot change.
- **People:** IAM Identity Center tied to the bank directory with MFA, no IAM users, **just-in-time elevated access** with approval and a time limit, and an alarmed break-glass role.
- **Workloads:** a role per service, least privilege reviewed in code, no long-lived keys, OIDC for pipelines, and **permissions boundaries** if teams may create their own roles.
- **Data protection:** customer-managed KMS keys per data domain with separate administrators and users, encryption everywhere (S3, EBS, RDS, DynamoDB, logs and backups), TLS enforced, tokenisation or field-level encryption for card and personal data, and Macie scans.
- **Secrets:** Secrets Manager with rotation, IAM database authentication where possible, and scans for secrets in source control.
- **Detection:** organization CloudTrail with validation and Object Lock, Config conformance packs, GuardDuty and Security Hub in every account and region with a delegated administrator, alarms to the security operations centre, and tested playbooks.
- **Compliance evidence:** the controls above map to the bank's frameworks (PCI DSS, MAS TRM in Singapore, ISO 27001, SOC 2). **AWS Artifact** gives AWS's own compliance reports for the audit.
- **Change and review:** every IAM and SCP change goes through code review and an approval pipeline, and **access reviews** remove unused permissions every quarter.

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| roles | temporary credentials through STS, a trust policy says who, permissions policies say what |
| no keys | tasks, pods, functions and pipelines use roles, people use Identity Center |
| evaluation | default deny, explicit deny wins, SCP and boundary only limit, cross-account needs both sides |
| SCP | organization guardrail, never grants, not for the management account |
| least privilege | Access Analyzer, last accessed, customer managed policies, one role per job |
| KMS | key never leaves KMS, envelope encryption with data keys, key policy is the root of access |
| key types | AWS owned, AWS managed, customer managed (banks) |
| rotation | KMS yearly automatic, Secrets Manager scheduled through Lambda |
| secrets | Secrets Manager (rotation) or Parameter Store (settings), not in code, prefer no secret at all |
| Cognito | user pool = sign-in and OIDC tokens, identity pool = AWS credentials |
| detect | CloudTrail, Config, GuardDuty, Security Hub, Inspector, Macie |
| logs | organization trail to a locked log account with validation |
| Java | default credentials chain, cached secrets, resource server on the Cognito issuer |

## Interview questions {#questions}

### [basic] What is an IAM role and why is it better than an access key? {#role-q}

An IAM role is an identity with permissions but no password or long-lived keys. A principal assumes it through STS and gets temporary credentials that expire, so a leak has a short life, and there is nothing to store or rotate by hand. Services, applications, pipelines, other accounts and people through single sign-on all use roles, and the SDK picks up the credentials automatically.

### [basic] What is the difference between a trust policy and a permissions policy? {#trust-q}

The trust policy (a resource policy on the role) says who may assume the role, for example the ECS tasks service, another account or a federated identity. The permissions policies say what the role can do once assumed, for example read one S3 prefix. A role needs both: someone allowed to assume it, and permissions worth having.

### [basic] How does AWS decide whether to allow a request? {#evaluation-q}

Everything is denied by default. An explicit deny in any applicable policy wins. Otherwise there must be an allow: within one account an identity policy or a resource policy is enough, but service control policies, permissions boundaries and session policies must also allow it, because they only limit. For cross-account access both the caller's identity policy and the resource's policy in the other account must allow.

### [basic] What is a service control policy? {#scp-q}

A policy on an organization, an OU or an account that sets the maximum permissions for the principals in those accounts. It grants nothing by itself, so a request needs an allow in the account and must not be blocked by the SCP. Banks use SCPs as guardrails, for example to allow only approved regions, protect CloudTrail, block the root user and prevent disabling encryption or public access settings. It does not apply to the management account.

### [basic] What is envelope encryption? {#envelope-q}

KMS encrypts a small data key, and the data key encrypts the data. The application asks KMS for a data key, gets a plaintext copy and an encrypted copy, encrypts the data locally with the plaintext key (AES-GCM), discards it, and stores the ciphertext with the encrypted data key. To read it, KMS decrypts the data key. It allows large data to be encrypted fast without the master key ever leaving KMS, and each use is logged.

### [basic] When do you use Secrets Manager and when Parameter Store? {#secrets-q}

Secrets Manager for credentials and keys that need encryption, fine-grained access, audit and rotation, such as a database password, at a price per secret. Parameter Store for configuration values, with optional SecureString encryption, at a lower or no cost, but with no built-in rotation. Better still, remove the secret altogether with roles and IAM database authentication where possible.

### [basic] What is the difference between a Cognito user pool and an identity pool? {#cognito-q}

A user pool is a directory and sign-in service for your application's users, with registration, MFA and federation, and it issues OIDC tokens (JWTs) that your API validates. An identity pool exchanges a token from a user pool or another provider for temporary AWS credentials, so a client can access an AWS service directly. Many applications use only a user pool.

### [intermediate] How does an ECS service get permission to read one S3 prefix and decrypt it with KMS? {#task-role-q}

Give the task a task role whose trust policy names `ecs-tasks.amazonaws.com`, with an identity policy that allows `s3:GetObject` on only that bucket prefix and `kms:Decrypt` on the specific key, ideally with a condition on the key's encryption context or via the S3 service. The key policy must also allow the role (or delegate to IAM). Keep the separate execution role for pulling the image and writing logs. The SDK in the container finds the credentials from the task metadata, so no key appears anywhere.

### [intermediate] How would you let a GitHub Actions or GitLab pipeline deploy to AWS without storing keys? {#oidc-q}

Create an IAM OIDC identity provider for the CI system and a deploy role whose trust policy allows `sts:AssumeRoleWithWebIdentity` from that provider, with conditions on the token's audience and on the subject, which pins it to one repository and branch or environment. The pipeline requests its signed token, exchanges it for temporary credentials for the role, and deploys. Nothing long-lived is stored, the credentials expire in an hour, and CloudTrail shows each assumption.

### [intermediate] A developer has `AdministratorAccess` in a sandbox account but cannot create resources in an unapproved region. Why? {#scp-region-q}

Because an SCP on the organization or OU denies actions outside the approved regions, and an SCP overrides what the identity policy allows. The effective permissions are the intersection of the SCP, any permissions boundary and the identity policy, minus any explicit deny. Check the SCPs on the account's OUs and the `aws:RequestedRegion` condition, and confirm the call is not to a global service that should be excluded.

### [intermediate] How do you give a partner's AWS account access to one bucket? {#cross-account-q}

Either a bucket policy that names the partner's role as a principal with specific actions and a prefix, plus an identity policy in their account that allows the calls (both sides are needed), or a role in your account that trusts the partner account, which they assume with an external ID to prevent the confused deputy problem. Add conditions for TLS and, where possible, source IP or endpoint, encrypt with a key whose policy also allows the partner, and log the access with CloudTrail data events.

### [intermediate] How do you rotate a database password without downtime? {#rotation-q}

Store it in Secrets Manager with rotation enabled. The rotation Lambda creates a new password version, sets it in the database, tests it and promotes it to current, while the old version stays valid for a short time (the alternating users strategy keeps two database users so the old one still works during the switch). Applications read the secret through a caching client that refreshes on failure, or connect through RDS Proxy or with IAM authentication, so connection pools pick up the change without a restart.

### [intermediate] How do you investigate suspected use of a leaked access key? {#incident-q}

Identify the key and its principal, deactivate the key (or deny the role's sessions with a policy that denies tokens issued before now) before anything else, then search CloudTrail for every call by that key, with source IPs and user agents, to see what it did and where. Check for new users, roles, keys, security group changes and data access, snapshot affected resources for evidence, rotate related secrets, review GuardDuty and Security Hub findings, and fix the cause, for example by removing the key and using roles instead.

### [intermediate] How do customer-managed KMS keys help a bank, and what are their costs? {#cmk-q}

They give control and evidence: you define who can administer and who can use each key, separate those duties, rotate and disable keys, share them across accounts, and every use is logged in CloudTrail, which supports auditors and data classification, and disabling a key can render data unreadable. The costs are a monthly fee per key and per-request charges, the risk of throttling at high volume (so use S3 Bucket Keys and data key caching), the work of key policies and keeping them correct, and the danger of deleting a key that is still in use.

### [deep] Design access control for a bank's AWS platform with fifty teams. {#design-q}

Use an AWS Organizations structure with a security OU, a log archive account, a network account, shared services, and workload accounts per team and environment, created through Control Tower or an account factory. Attach SCPs for approved regions, protected audit services, no root use, no IAM users or keys, encryption and public access guardrails. People sign in through IAM Identity Center from the bank directory with MFA, with read-only by default and just-in-time elevation. Workloads use roles per service, pipelines use OIDC, and teams create roles only under a permissions boundary. Data is encrypted with customer-managed keys per domain, secrets are in Secrets Manager, and the organization trail goes to the locked log account. Access Analyzer, Config, GuardDuty and Security Hub run everywhere with a delegated administrator and feed the security operations centre. All changes are made through reviewed code and pipelines, with quarterly access reviews.

### [deep] How would you encrypt a customer's documents in your own service so that a leak of the bucket exposes nothing? {#design-kms-q}

Use envelope encryption with a customer-managed key per data domain. For each document ask KMS for a data key with an encryption context that names the customer and document, encrypt locally with AES-GCM and a fresh nonce, discard the plaintext key, and store the ciphertext, the nonce and the encrypted data key. Allow `kms:Decrypt` only to the service's role in the key policy and require the same context on decrypt, so a stolen ciphertext cannot be decrypted by another caller or for another customer. Add bucket encryption with SSE-KMS and a bucket policy requiring TLS, Block Public Access, Object Lock if needed, and alarms on unusual `Decrypt` volume. Use the AWS Encryption SDK to avoid implementing it by hand.

### [deep] A service intermittently fails with KMS throttling errors. Why, and what do you change? {#kms-throttle-q}

KMS has per-account request quotas per second per operation, and a service that calls KMS for every object, every request or every small field exceeds them at peak. Reduce the calls: use S3 Bucket Keys, cache data keys for a short time and reuse them for several operations (the Encryption SDK caching materials manager does this with limits on age and use), batch work, and avoid decrypting on every read when a cache is allowed. Spread keys across a few keys or regions if needed, retry with backoff, and ask for a quota increase if the load is real. Monitor `ThrottledRequests` and test at the expected peak.

### [coding] Write CloudFormation for an ECS task role with least privilege: read one S3 prefix, decrypt with one KMS key, read one secret, and nothing else. {#coding-role}

```yaml
Resources:
  PaymentsTaskRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: payments-task
      MaxSessionDuration: 3600
      PermissionsBoundary: !Sub arn:aws:iam::${AWS::AccountId}:policy/workload-boundary
      AssumeRolePolicyDocument:                      # the trust policy: who may assume this role
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal: { Service: ecs-tasks.amazonaws.com }
            Action: sts:AssumeRole
            Condition:
              ArnLike: { 'aws:SourceArn': !Sub 'arn:aws:ecs:${AWS::Region}:${AWS::AccountId}:*' }
              StringEquals: { 'aws:SourceAccount': !Ref 'AWS::AccountId' }   # stops a confused deputy
      Policies:
        - PolicyName: payments-access
          PolicyDocument:                            # the permissions policy: what it may do
            Version: '2012-10-17'
            Statement:
              - Sid: ReadStatements
                Effect: Allow
                Action: [s3:GetObject]
                Resource: !Sub arn:aws:s3:::${StatementsBucket}/statements/*
              - Sid: ListOnlyThePrefix
                Effect: Allow
                Action: s3:ListBucket
                Resource: !Sub arn:aws:s3:::${StatementsBucket}
                Condition: { StringLike: { 's3:prefix': ['statements/*'] } }
              - Sid: DecryptWithPaymentsKey
                Effect: Allow
                Action: [kms:Decrypt, kms:GenerateDataKey]
                Resource: !GetAtt PaymentsKey.Arn
                Condition:
                  StringEquals: { 'kms:EncryptionContext:app': payments }     # only with the right context
              - Sid: ReadOwnSecret
                Effect: Allow
                Action: secretsmanager:GetSecretValue
                Resource: !Sub arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:payments/db-*
```

Explain: the **trust policy** lets only ECS tasks in this account assume the role, and the source conditions prevent another service or account from tricking the ECS service into using it; the **permissions policy** names exact resources (one bucket prefix, one key, one secret) and no wildcards on actions; listing the bucket is allowed only for the prefix; the KMS permissions require the **encryption context**, so the role cannot decrypt data meant for other purposes; the **permissions boundary** caps what this role could ever be given; the session lasts one hour; and the task uses a separate execution role to pull its image. The key policy must also allow this role, and no access keys exist anywhere.

### [coding] Write Java that encrypts a document with KMS envelope encryption (GenerateDataKey and AES-GCM) and decrypts it again. {#coding-kms}

```java
public class EnvelopeCrypto {

    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final KmsClient kms;
    private final String keyId;
    private final SecureRandom random = new SecureRandom();

    public EnvelopeCrypto(KmsClient kms, String keyId) {
        this.kms = kms;
        this.keyId = keyId;
    }

    public record Envelope(byte[] encryptedDataKey, byte[] nonce, byte[] ciphertext) {}

    public Envelope encrypt(byte[] plaintext, Map<String, String> context) throws GeneralSecurityException {
        GenerateDataKeyResponse dk = kms.generateDataKey(r -> r
                .keyId(keyId)
                .keySpec(DataKeySpec.AES_256)
                .encryptionContext(context));                       // bound to the ciphertext and logged

        byte[] plainKey = dk.plaintext().asByteArray();
        try {
            byte[] nonce = new byte[NONCE_BYTES];
            random.nextBytes(nonce);                                // a new nonce for every message
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(plainKey, "AES"), new GCMParameterSpec(TAG_BITS, nonce));
            cipher.updateAAD(context.toString().getBytes(StandardCharsets.UTF_8));
            byte[] ciphertext = cipher.doFinal(plaintext);
            return new Envelope(dk.ciphertextBlob().asByteArray(), nonce, ciphertext);
        } finally {
            Arrays.fill(plainKey, (byte) 0);                        // discard the plaintext key
        }
    }

    public byte[] decrypt(Envelope e, Map<String, String> context) throws GeneralSecurityException {
        DecryptResponse dr = kms.decrypt(r -> r
                .ciphertextBlob(SdkBytes.fromByteArray(e.encryptedDataKey()))
                .keyId(keyId)
                .encryptionContext(context));                       // KMS refuses if the context differs

        byte[] plainKey = dr.plaintext().asByteArray();
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(plainKey, "AES"), new GCMParameterSpec(TAG_BITS, e.nonce()));
            cipher.updateAAD(context.toString().getBytes(StandardCharsets.UTF_8));
            return cipher.doFinal(e.ciphertext());                  // throws if the data was changed
        } finally {
            Arrays.fill(plainKey, (byte) 0);
        }
    }
}
```

Explain: `GenerateDataKey` returns the key twice, **plaintext** for local use and **encrypted under the KMS key** for storage; the data is encrypted locally with **AES-256-GCM**, which gives confidentiality and tamper detection, with a **fresh random nonce** each time (reusing a nonce with the same key breaks GCM); the plaintext key is **wiped** after use; the **encryption context** is checked by KMS on decrypt and is written to CloudTrail, so a ciphertext cannot be decrypted for a different customer or purpose, and it also goes into the GCM additional data; and only the small encrypted key travels to KMS, so large files cost one KMS call. In production prefer the **AWS Encryption SDK**, which does this with formats, key caching and algorithm suites already tested, and keep the role's `kms:Decrypt` narrow.

### [coding] Configure a Spring Boot service as an OAuth resource server for a Cognito user pool, and load its database credentials from Secrets Manager. {#coding-spring}

```yaml
spring:
  config:
    import: aws-secretsmanager:payments/db        # Spring Cloud AWS, read with the task role
  datasource:
    url: jdbc:postgresql://${DB_HOST}:5432/payments
    username: ${username}                          # keys of the JSON secret become properties
    password: ${password}
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://cognito-idp.ap-southeast-1.amazonaws.com/${COGNITO_POOL_ID}

app:
  auth:
    client-id: ${COGNITO_CLIENT_ID}
```

```java
@Configuration
@EnableMethodSecurity
class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http, @Value("${app.auth.client-id}") String clientId) throws Exception {
        http
            .csrf(csrf -> csrf.disable())                                   // stateless API with bearer tokens
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/payments/**").hasAuthority("SCOPE_payments/write")
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        return http.build();
    }

    /** The issuer is checked by default. Cognito access tokens carry client_id instead of aud, so check it too. */
    @Bean
    JwtDecoder jwtDecoder(@Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
                          @Value("${app.auth.client-id}") String clientId) {
        NimbusJwtDecoder decoder = JwtDecoders.fromIssuerLocation(issuer);
        OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(issuer);
        OAuth2TokenValidator<Jwt> clientValidator = jwt ->
                clientId.equals(jwt.getClaimAsString("client_id"))
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "wrong client", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerValidator, clientValidator));
        return decoder;
    }
}
```

Explain: the application starts with the **task role only**, and Spring Cloud AWS reads the secret `payments/db` with that role, so the database password never appears in the image, the repository or an environment file (rotation is picked up with a restart or a refresh, or avoided with IAM database authentication or RDS Proxy); the **issuer URI** makes Spring download the pool's signing keys and validate the signature, issuer and expiry; Cognito scopes become `SCOPE_` authorities, so the POST route needs the `payments/write` scope; the extra validator checks the **client** that the token was issued to, because Cognito access tokens have a `client_id` claim and no `aud`; the API is stateless, so CSRF protection is switched off for bearer tokens only; and API Gateway or the ALB may validate the token too, while the service still checks it, as defence in depth ([resource server](lesson:oauth2#spring-rs)).
