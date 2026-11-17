---
title: AWS storage — S3, EBS, EFS and AWS Backup
nav: AWS storage
slug: aws-storage
summary: How to store data on AWS and choose between object, block and file storage, S3 buckets and keys, consistency and durability, storage classes and lifecycle rules, versioning, Object Lock and replication, presigned URLs and events, bucket security with Block Public Access, policies, KMS and VPC endpoints, EBS volume types and snapshots, EFS and FSx, AWS Backup with vault lock and cross-region copies, cost traps, and what a bank needs for retention and audit, with Java examples and interview questions.
tags: [AWS, S3, EBS, EFS, Backup, Storage, Encryption, Lifecycle, Java]
order: 56
topic: Cloud / AWS
updated: 2026-11-17
subnav: true
---

Almost every system stores files, documents, disks or backups, and AWS gives three different kinds of storage for them. Interviews ask *what the difference between object, block and file storage is, how S3 works and why it is so durable, how storage classes and lifecycle rules cut cost, how you secure a bucket, how an upload works without passing the file through your API, what EBS and EFS are for, how backups are protected from deletion, and how a bank meets retention and audit rules.* This lesson follows the [service map](lesson:aws-service-map#storage). Play the four scenes: a presigned upload, storage classes, securing a bucket, and disks, files and backup.

```demo
name: aws-storage-walk
```

*The AWS service icons in the diagrams are the official AWS Architecture Icons, shown unmodified. This site is not affiliated with, endorsed by or sponsored by Amazon Web Services.*

> **One sentence to remember:** *Use S3 for objects, EBS for one server's disk, and EFS for files shared by many, keep every bucket private and encrypted, let lifecycle rules move ageing data to cheaper classes, and protect the backups from deletion.*

```demo
name: aws-map-storage
```

## Three kinds of storage {#kinds}

| | **Object** (S3) | **Block** (EBS) | **File** (EFS, FSx) |
| --- | --- | --- | --- |
| Access | HTTP API by bucket and key | a disk attached to one instance | a mounted file system (NFS or SMB) |
| Structure | flat keys, objects up to 5 TB | fixed-size blocks, a file system you format | directories and files |
| Shared by | any number of clients | one instance at a time (Multi-Attach for special cases) | many instances at once |
| Scope | a region (data spread over zones) | **one availability zone** | a region (across zones), mounted per zone |
| Edit part of a file | no, replace the whole object | yes | yes |
| Typical use | documents, images, backups, data lakes, static sites | a server's disk, a database on EC2 | shared content, home directories, legacy apps |

If an application needs to **write into the middle of a file** or needs a normal file system, it needs block or file storage. If it stores **whole files addressed by name**, S3 is almost always the right and cheapest answer.

## S3 basics {#s3}

- A **bucket** is a container with a globally unique name, created in one **region**. An **object** has a **key** (such as `customer-statements/2026/10/acct-123.pdf`), the data, and metadata. The slashes are only part of the key: S3 has **prefixes** that look like folders, but it is a flat store.
- **Durability** is designed at 99.999999999 percent (eleven nines): the data is stored redundantly across at least three availability zones (except One Zone classes). **Availability** is lower and depends on the class. Durability does not protect you from **your own mistakes**, such as an accidental delete, which is why versioning, Object Lock and backups exist.
- **Consistency:** S3 is **strongly consistent**. After a successful write or delete, the next read or list sees it.
- **Limits and speed:** one object up to **5 TB**, uploaded in parts. Use **multipart upload** above about 100 MB (and always for large files), because it is faster in parallel and restartable. Request rates scale per **prefix** (thousands of requests per second per prefix), so spread hot keys over prefixes.
- **Versioning** keeps every version of an object, so an overwrite or delete can be undone. A delete adds a *delete marker*. **MFA delete** adds an extra check for permanent deletion.
- **Object Lock** gives **WORM** (write once, read many) protection: *governance mode* can be bypassed by privileged users, *compliance mode* cannot be removed by anyone, including the root user, until the retention ends. A **legal hold** blocks deletion without a date.
- **Replication:** **Cross-Region Replication** copies new objects to a bucket in another region (disaster recovery, or latency for readers), and **Same-Region Replication** to another account or bucket (log aggregation, separate account backups). It needs versioning and replicates only objects written after it is switched on, unless you use batch replication.
- **Events:** object created or deleted events go to **EventBridge**, SNS, SQS or Lambda, which triggers processing ([event-driven](lesson:aws-service-map#events)).
- **Other features:** static website hosting (usually behind CloudFront), **Transfer Acceleration**, **access points** (a named policy per application), **Batch Operations** (do something to millions of objects), and **S3 Inventory** (a list of objects for audit and cost).

### Storage classes {#classes}

| Class | Access | Relative cost | Use for |
| --- | --- | --- | --- |
| **Standard** | frequent, instant | highest per GB | active data |
| **Intelligent-Tiering** | unknown or changing | moves objects between tiers automatically for a small monitoring fee | data with unpredictable access |
| **Standard-IA** | infrequent, instant | lower storage, retrieval fee, 30-day minimum | monthly access, backups |
| **One Zone-IA** | infrequent, one zone only | lower again | re-creatable data (a loss of the zone loses it) |
| **Glacier Instant Retrieval** | rare, instant | low | archives read a few times a year |
| **Glacier Flexible Retrieval** | rare, minutes to hours | very low | archives |
| **Glacier Deep Archive** | very rare, up to 12 hours | lowest | long-term retention of compliance data |

**Lifecycle rules** (the second scene) move or delete objects automatically by age, prefix or tag: for example Standard, then Standard-IA after 30 days, then Glacier after 90 days, and expire after the retention period. They can also **abort incomplete multipart uploads** and **expire old versions**, which are two common hidden costs. Mind the **minimum storage duration** and **minimum object size** of the cheaper classes, and the **retrieval fees**: moving millions of tiny objects can cost more than it saves.

## Upload and download patterns {#patterns}

- **Presigned URLs** (the first scene): the API creates a time-limited URL signed with its own credentials that allows exactly one operation (a `PUT` or a `GET`). The client uses it directly against S3, so large files never pass through your servers. Limit the lifetime to minutes, and fix the object key and content type on the server side, because the signature is only as narrow as you make it. Use **presigned POST** to add conditions such as a maximum size.
- **Private downloads:** serve through **CloudFront with an origin access control** and signed URLs or cookies, so the bucket is never public.
- **After upload:** an event triggers validation (type, size, malware scan) and a status record, and the file is moved from a quarantine prefix to the clean prefix only after it passes.
- **Large and many files:** multipart uploads and the `S3TransferManager` in the Java SDK v2 for parallel transfer, ranged `GET`s to read a part, and **S3 Select or Athena** to query data in place.
- **Do not** use S3 as a database: it has no transactions or queries across objects. Keep metadata (owner, status) in a database and the bytes in S3.

## Securing a bucket {#security}

Layers, as in the third scene:

1. **Block Public Access** on the account and on every bucket. This is the single most important control. **Disable ACLs** by setting object ownership to *bucket owner enforced*, so only policies grant access.
2. **Policies:** IAM policies on roles and a **bucket policy** on the bucket. Access is allowed if either (within the same account) allows it and nothing denies it, and an explicit deny always wins. Give each application a role limited to its prefix, and use **access points** for many consumers.
3. **Encryption at rest:** all objects are encrypted by default. **SSE-S3** uses keys that S3 manages, **SSE-KMS** uses a KMS key whose policy and use you control and audit (a customer-managed key for sensitive data), and **client-side encryption** encrypts before upload. Enable a **bucket key** to cut the KMS request cost.
4. **Encryption in transit:** a bucket policy that **denies requests without TLS** (`aws:SecureTransport` false).
5. **Network:** a **VPC gateway endpoint** so the traffic stays on the AWS network, and a policy condition that allows access only through it (`aws:SourceVpce`).
6. **Detection and audit:** **CloudTrail data events** for object-level calls, **S3 server access logs**, **IAM Access Analyzer for S3** (finds buckets shared outside the account), **Macie** (finds personal data), and Config rules that flag a public or unencrypted bucket.
7. **Protection against deletion:** versioning, Object Lock, replication to another account, and backups.

The most common real-world incidents are a **public bucket**, an **over-broad role**, and **leaked credentials**: the first two are prevented by the controls above, and the third by using roles instead of keys.

## EBS {#ebs}

**Elastic Block Store** provides network-attached disks for EC2 (the fourth scene):

- A volume lives in **one AZ** and attaches to an instance in that zone. It persists independently of the instance if you choose, and is replicated within its zone.
- **Types:** **gp3** (general purpose SSD, the default, with IOPS and throughput you set independently), **io2 and io2 Block Express** (provisioned IOPS for demanding databases), **st1 and sc1** (HDD for large sequential throughput and cold data, not boot disks).
- **Snapshots** are **incremental** point-in-time backups stored in S3 (managed by AWS). You can restore them to a new volume in any zone, copy them to another region or account, and automate them with **Data Lifecycle Manager** or AWS Backup. A snapshot of a database volume needs the database to be quiesced to be consistent.
- **Encryption** with KMS is a setting you can enforce for the whole account, and snapshots of an encrypted volume are encrypted.
- **Instance store** is a local disk that is fast and free but **disappears** when the instance stops or fails. Use it for caches and scratch space only.
- A managed database (RDS) manages its volumes for you, so raw EBS is mainly for servers and for databases that you run yourself.

## EFS and FSx {#efs}

- **EFS** is an elastic NFS file system that grows and shrinks by itself, is available in several AZs through **mount targets**, and can be mounted by many EC2 instances, ECS tasks, EKS pods and Lambda functions at once. It has **performance and throughput modes**, **infrequent access** storage classes with lifecycle management, and encryption. Use it for shared content, CMS media, and tools that need a shared POSIX file system, not for databases.
- **FSx** offers specialised managed file systems: **FSx for Windows File Server** (SMB and Active Directory), **FSx for Lustre** (high-performance computing), **FSx for NetApp ONTAP** and **OpenZFS** (enterprise features and migrations).
- **Moving data in:** **DataSync** copies large datasets online, **Storage Gateway** gives on-premises systems an S3 or file interface, the **Transfer Family** exposes S3 or EFS over SFTP (common for partners who exchange files with a bank), and the **Snow family** moves data physically.

## AWS Backup {#backup}

**AWS Backup** applies one policy to many services (EBS, EFS, RDS, DynamoDB, S3, EC2 and more), as in the last frame of the fourth scene:

- A **backup plan** sets the schedule, the retention (daily for 35 days, monthly for a year), and **copy rules** to another region and account. Resources are selected by **tags**, so a new tagged resource is protected automatically.
- A **backup vault** stores the recovery points, encrypted with a KMS key. **Vault Lock** makes it **WORM**: nobody, including administrators, can delete the backups before their retention ends, which protects them from **ransomware and from a compromised account**. Keeping the vault in a **separate account** limits the blast radius further.
- **Restore testing** matters most: a backup that has never been restored is a hope, not a backup. Automate regular restore tests, and measure the real recovery time against your RTO ([RTO and RPO](lesson:cloud-basics#availability)).
- **Audit Manager and reports** show that the plans are applied and compliant.

## Cost traps {#cost}

- **Requests and retrieval:** very many small `PUT`s and `GET`s, and retrieval fees on IA and Glacier classes, can dominate the bill. Batch small files into larger objects.
- **Data transfer:** out to the internet and across regions costs money, while transfer into S3 and to the same region is free. A **gateway VPC endpoint** for S3 avoids NAT gateway charges.
- **Hidden storage:** old object **versions**, **incomplete multipart uploads**, and old **EBS snapshots** and unattached volumes. Lifecycle rules and tag-based clean-up remove them.
- **Wrong class:** Glacier for data you read weekly, or Standard for ten-year archives. Use **Intelligent-Tiering** when you cannot predict the pattern, and S3 Storage Lens to see where the bytes are.
- **Over-provisioned disks:** right-size EBS volumes, prefer gp3 to gp2, and delete what is not attached.

## Choosing storage {#choosing}

| Need | Choice |
| --- | --- |
| documents, images, statements, exports | S3 |
| a server's boot or data disk | EBS (gp3) |
| a database with very high IOPS on EC2 | EBS io2 |
| files shared by many containers or servers | EFS |
| Windows file shares with Active Directory | FSx for Windows File Server |
| long-term compliance archive | S3 Glacier Deep Archive with Object Lock |
| a data lake | S3 with Glue and Athena |
| files from partners over SFTP | Transfer Family into S3 |
| protect against deletion and ransomware | AWS Backup with Vault Lock, cross-account copies |

## In a bank {#bank}

- **Retention and immutability.** Records such as statements and transaction logs must be kept for years and must not be altered: **Object Lock in compliance mode**, lifecycle to Glacier for the retention period, and deletion only after it ends, with legal holds for investigations.
- **Encryption with customer-managed keys** per data classification, with key policies that separate the people who administer keys from the people who use them, rotation, and use logged in CloudTrail.
- **No public data.** Block Public Access enforced by service control policies and checked by Config, VPC endpoints for private access, and Access Analyzer reviews.
- **Residency.** The bucket region is the legal location of the data, so allowed regions are enforced, and replication targets are chosen to stay within the permitted jurisdictions.
- **Separation of accounts.** Production data, the log archive and the backup vault live in different accounts, with limited cross-account roles.
- **Classification and discovery.** Macie scans for personal data, and tags drive the retention, the access and the backup plan.
- **Evidence.** Data events and access logs go to a protected log account, and backup and restore tests are recorded for audit.

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| object, block, file | S3 by key, EBS one instance in one AZ, EFS shared NFS |
| S3 durability | eleven nines across zones, but not safe from your own deletes |
| consistency | strong read-after-write |
| versioning, Object Lock | undo mistakes, WORM for compliance |
| classes | Standard, Intelligent-Tiering, IA, Glacier tiers, Deep Archive |
| lifecycle | age to cheaper class, expire, abort multipart, expire old versions |
| upload | presigned URL or multipart, not through the API |
| security | Block Public Access, no ACLs, policies, KMS, TLS only, VPC endpoint, audit |
| EBS | gp3 default, io2 for IOPS, snapshots incremental, one AZ |
| EFS | shared NFS across zones, not for databases |
| backup | AWS Backup plan, cross-region and cross-account copy, Vault Lock, test restores |
| cost | requests, transfer, old versions, multipart leftovers, wrong class |

## Interview questions {#questions}

### [basic] What is the difference between object, block and file storage? {#kinds-q}

Object storage (S3) stores whole objects addressed by bucket and key through an HTTP API, scales without limit and is shared by any client. Block storage (EBS) is a raw disk attached to one instance, which formats it and can modify any block, with low latency. File storage (EFS, FSx) is a shared file system with directories that many servers mount at once. Use S3 for documents and backups, EBS for a server's disk, and EFS for shared files.

### [basic] What is S3 and how durable is it? {#s3-q}

Simple Storage Service is object storage with effectively unlimited capacity, accessed by an API, with objects up to 5 TB. It is designed for eleven nines of durability by storing data redundantly across at least three availability zones. That protects against hardware and zone failure, but not against a user or application that deletes or overwrites data, so versioning, Object Lock and backups are still needed.

### [basic] What are S3 storage classes? {#classes-q}

Classes trade access speed and retrieval cost for price. Standard is for frequent access. Intelligent-Tiering moves data between tiers automatically. Standard-IA and One Zone-IA are cheaper for infrequent access with a retrieval fee. The Glacier classes (Instant, Flexible, Deep Archive) are very cheap for archives with retrieval times from instant to many hours. Lifecycle rules move objects between classes as they age.

### [basic] What is S3 versioning and why use it? {#versioning-q}

Versioning keeps every version of an object, so an overwrite or delete does not destroy the earlier data: a delete only adds a delete marker, and an older version can be restored. It protects against accidental or malicious changes, and is required for replication and Object Lock. The cost is storage for old versions, which a lifecycle rule should expire.

### [basic] What is a presigned URL? {#presigned-q}

A URL created with the signer's credentials that allows one operation on one object, such as an upload or a download, for a limited time. Anyone who has the URL can do exactly that, so it lets a client talk to S3 directly without AWS credentials and without the file passing through your servers. Keep the lifetime short and fix the key and content type on the server.

### [basic] What is the difference between EBS and EFS? {#ebs-efs-q}

EBS is a block disk attached to one EC2 instance in one availability zone, giving low latency for a server's disk or a database. EFS is a managed NFS file system that grows automatically and can be mounted by many instances, containers and functions across zones at once, so it suits shared files. EBS cannot be shared across zones, and EFS is not meant for databases.

### [intermediate] How do you secure an S3 bucket that stores customer documents? {#secure-q}

Turn on Block Public Access for the account and bucket, disable ACLs, and grant access only to named roles with a bucket policy and least-privilege IAM policies. Encrypt with SSE-KMS under a customer-managed key, deny requests that do not use TLS, and allow access only through a VPC endpoint. Enable versioning, and Object Lock where records must not change, log object access with CloudTrail data events, check exposure with Access Analyzer and Macie, and keep a copy in another account or region.

### [intermediate] How would you let mobile users upload large files without overloading your API? {#upload-q}

The API authenticates the user, decides the object key, and returns a presigned URL (or presigned POST with a size condition) valid for a few minutes. The client uploads straight to S3, using multipart upload for big files, so the servers carry no file traffic. An S3 event then triggers validation and a malware scan, and a status record tells the application when the document is ready. The file stays in a quarantine prefix until it passes.

### [intermediate] How do lifecycle rules reduce cost, and what must you watch out for? {#lifecycle-q}

They move objects to cheaper classes by age or tag, expire objects at the end of retention, remove old versions and abort incomplete multipart uploads. Watch the minimum storage durations and minimum object sizes of IA and Glacier classes, the retrieval fees if data is read after all, the per-request transition cost on millions of small objects, and compliance rules that forbid early deletion. Model the access pattern first, and use Intelligent-Tiering when it is unpredictable.

### [intermediate] What is Object Lock and when do you use compliance mode? {#object-lock-q}

Object Lock enforces write once, read many: an object version cannot be deleted or overwritten during its retention period. Governance mode can be overridden by users with a special permission, while compliance mode cannot be shortened or removed by anyone, including the root user, until the retention ends. Use compliance mode for regulated records such as financial statements and audit logs, where immutability must be provable. A legal hold blocks deletion without a fixed date.

### [intermediate] What is the difference between cross-region and same-region replication? {#replication-q}

Both copy new objects asynchronously from a source bucket to a destination bucket, and both need versioning. Cross-Region Replication targets another region, for disaster recovery, lower read latency, or compliance with a geographic copy. Same-Region Replication targets another bucket or account in the same region, for log aggregation or a separate-account backup. Existing objects need batch replication, and delete markers and encryption settings are configurable.

### [intermediate] How do EBS snapshots work and how do you protect them? {#snapshots-q}

A snapshot is an incremental point-in-time backup stored in S3: the first copies all used blocks and later ones only the changes. Snapshots can create a new volume in any zone and can be copied across regions and accounts, and they inherit encryption. Automate them with Data Lifecycle Manager or AWS Backup, quiesce a database for a consistent copy, copy them to another account, and protect them from deletion with a locked backup vault.

### [intermediate] How does AWS Backup help against ransomware or an insider who deletes data? {#backup-q}

A backup plan creates recovery points on a schedule for many resource types and copies them to another region and account. The vault is encrypted with a KMS key and protected with Vault Lock in compliance mode, so no one can delete the recovery points before their retention ends, even with administrator rights. Keeping the vault in a separate account with restricted access limits the damage from a compromised production account, and regular restore tests prove that the backups work.

### [deep] Design the storage for a banking platform: customer documents, statements kept for seven years, and a database on EC2. {#design-q}

Customer documents and statements go to S3 in the allowed region, with Block Public Access, SSE-KMS with a customer-managed key, TLS-only and VPC endpoint-only bucket policies, versioning, and Object Lock in compliance mode for the statements. Lifecycle rules move statements to Standard-IA after 30 days and to Glacier after 90 days, and delete after seven years and a legal-hold check. Uploads use presigned URLs with a quarantine prefix and an event-driven scan. The EC2 database uses encrypted io2 volumes, with snapshots by AWS Backup. Backups are copied to a locked vault in a separate account and to a second region, restore tests are automated, access is logged by CloudTrail data events into a log account, and Macie and Config watch for exposure and drift.

### [deep] Your S3 bill grew 3x. How do you find out why and fix it? {#s3-cost-q}

Start with Cost Explorer by usage type to see whether it is storage, requests, retrieval or data transfer, and S3 Storage Lens and Inventory to see which buckets and prefixes grew. Typical causes are old versions piling up in a versioned bucket, incomplete multipart uploads, a job making millions of small requests, data moved to IA or Glacier and then read, cross-region replication or internet transfer, and logs with no expiry. Fix with lifecycle rules for versions and multipart uploads, batching small objects, the right class or Intelligent-Tiering, a gateway endpoint to avoid NAT charges, and budgets and alerts to catch the next change early.

### [deep] How would you migrate 200 TB of files from an on-premises file server to AWS? {#migration-q}

Decide the target first: S3 if the applications can use an object API, EFS or FSx if they need a file system (FSx for Windows if they need SMB and Active Directory). For the transfer, use DataSync over Direct Connect or the internet for the bulk and incremental syncs, or Snowball devices if the bandwidth is too small, with a Storage Gateway as a bridge for applications that cannot change yet. Run an initial full copy, then repeat incremental syncs until the cut-over window, verify checksums, move applications, keep the old data read-only for a while, and plan the permissions, encryption and lifecycle policy for the new location.

### [coding] Write Java code that creates a presigned PUT URL for an upload with the AWS SDK v2. {#coding-presign}

```java
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

public class UploadLinks {

    private final S3Presigner presigner = S3Presigner.builder()
            .region(Region.AP_SOUTHEAST_1)            // credentials from the task role
            .build();

    private static final String BUCKET = "example-bank-kyc-documents";

    public UploadLink create(String customerId) {
        // the server decides the key, so the client cannot choose where the file goes
        String key = "quarantine/" + customerId + "/" + UUID.randomUUID() + ".pdf";

        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(BUCKET)
                .key(key)
                .contentType("application/pdf")        // the signature binds the content type
                .build();

        PresignedPutObjectRequest signed = presigner.presignPutObject(
                PutObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(5))
                        .putObjectRequest(put)
                        .build());

        return new UploadLink(signed.url().toString(), key);
    }

    public record UploadLink(String url, String key) {}
}
```

Explain: the API holds no AWS keys and signs with the **task role**; the URL is valid for **five minutes** and for one `PUT` of one key, with the **content type bound** into the signature, so the client cannot send a different type or choose another key; the file goes directly to S3 and never through the service; the object lands in a **quarantine prefix** where an event triggers a scan, and only a clean file is moved to the final prefix. To enforce a **maximum size**, use a presigned POST with a content-length condition, or check the size in the validation step. Create one `S3Presigner` and reuse it.

### [coding] Write a bucket policy that denies non-TLS requests, denies uploads that are not KMS-encrypted, and allows access only through a VPC endpoint. {#coding-policy}

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::example-bank-statements", "arn:aws:s3:::example-bank-statements/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    },
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::example-bank-statements/*",
      "Condition": { "StringNotEquals": { "s3:x-amz-server-side-encryption": "aws:kms" } }
    },
    {
      "Sid": "DenyOutsideTheVpcEndpoint",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::example-bank-statements", "arn:aws:s3:::example-bank-statements/*"],
      "Condition": {
        "StringNotEquals": { "aws:SourceVpce": "vpce-0a1b2c3d4e5f67890" },
        "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::111122223333:role/breakglass-admin" }
      }
    }
  ]
}
```

Explain: all three statements are **explicit denies**, which always override any allow, so they act as guardrails whatever the IAM policies say; the first rejects plain HTTP, the second rejects any upload that is not encrypted with KMS, and the third rejects any request that does not come through the **VPC endpoint**, with one exception for a **break-glass role** so that an administrator is not locked out if the endpoint is changed. Test such a policy in a non-production bucket first, because a wrong deny can lock everyone out, and combine it with Block Public Access and a default encryption setting on the bucket.

### [coding] Write a CloudFormation AWS Backup plan with daily backups, 35-day retention, a cross-region copy and a locked vault. {#coding-backup}

```yaml
Resources:
  BackupVault:
    Type: AWS::Backup::BackupVault
    Properties:
      BackupVaultName: payments-vault
      EncryptionKeyArn: !GetAtt BackupKey.Arn
      LockConfiguration:                       # Vault Lock: recovery points cannot be deleted early
        MinRetentionDays: 7
        MaxRetentionDays: 365
        ChangeableForDays: 3                   # after 3 days the lock can no longer be removed

  BackupPlan:
    Type: AWS::Backup::BackupPlan
    Properties:
      BackupPlan:
        BackupPlanName: payments-daily
        BackupPlanRule:
          - RuleName: daily-35-days
            TargetBackupVault: !Ref BackupVault
            ScheduleExpression: cron(0 17 * * ? *)       # 01:00 Singapore time
            StartWindowMinutes: 60
            CompletionWindowMinutes: 360
            Lifecycle: { DeleteAfterDays: 35 }
            CopyActions:
              - DestinationBackupVaultArn: arn:aws:backup:ap-southeast-2:111122223333:backup-vault:payments-vault-dr
                Lifecycle: { DeleteAfterDays: 35 }

  BackupSelection:
    Type: AWS::Backup::BackupSelection
    Properties:
      BackupPlanId: !Ref BackupPlan
      BackupSelection:
        SelectionName: tagged-resources
        IamRoleArn: !GetAtt BackupRole.Arn
        ListOfTags:
          - { ConditionType: STRINGEQUALS, ConditionKey: backup, ConditionValue: daily }
```

Explain: the plan runs every night and keeps the recovery points for 35 days; each one is **copied to a vault in another region** for disaster recovery; the **vault lock** sets minimum and maximum retention and, after the three-day cooling-off period, becomes **immutable even for administrators**, which is the protection against ransomware and an insider; resources are selected by the **tag** `backup=daily`, so a new tagged database or volume is covered automatically; and the vault is encrypted with a customer-managed KMS key. Add a restore test (AWS Backup restore testing) so that the recovery time is measured regularly.
