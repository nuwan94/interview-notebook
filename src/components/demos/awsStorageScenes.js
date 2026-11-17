// Frame data for the "AWS storage" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const AWS_STORAGE_SCENES = [
  {
    id: 'upload',
    label: 'Upload with a presigned URL',
    title: 'Files go straight to S3',
    frames: [
      {
        note: 'A customer uploads a signed document in the banking app. The API does not stream the file. It asks S3 for a presigned URL, a link that allows one upload of one object for a few minutes, and returns it to the client.',
        boxes: [b('c', 'Mobile app', ['wants to upload a file'], 'none'), b('a', 'Fargate tasks', ['the API creates the URL'], 'ok'), b('u', 'Presigned URL', ['one object, 5 minutes'], 'new')],
        deps: [d('Mobile app', 'Fargate tasks', 'asks for an upload link', 'ok'), d('Fargate tasks', 'Presigned URL', 'signs with its role', 'ok')],
      },
      {
        note: 'The client sends the file directly to the bucket with that URL. The API servers carry no file traffic, so there is no large memory use, no timeouts on slow mobile links, and no extra cost for the data to pass through them.',
        boxes: [b('c', 'Mobile app', ['PUT with the signed URL'], 'ok'), b('s', 'S3 bucket', ['kyc-documents/'], 'ok'), b('a', 'Fargate tasks', ['not in the data path'], 'none')],
        deps: [d('Mobile app', 'S3 bucket', 'uploads directly', 'ok')],
      },
      {
        note: 'The new object produces an event. A Lambda function checks the file type and size, scans it, and records the result in DynamoDB. The application learns that the document is ready by reading that record.',
        boxes: [b('s', 'S3 bucket', ['object created event'], 'ok'), b('l', 'Lambda function', ['validate and scan'], 'new'), b('d', 'DynamoDB table', ['document status'], 'ok')],
        deps: [d('S3 bucket', 'Lambda function', 'event', 'ok'), d('Lambda function', 'DynamoDB table', 'writes the result', 'ok')],
      },
    ],
  },
  {
    id: 'lifecycle',
    label: 'Storage classes',
    title: 'Move data to cheaper storage as it ages',
    frames: [
      {
        note: 'New statements are read often, so they start in S3 Standard: the highest price per GB, with instant access. The cost of storage matters little compared with the need for fast access in the first weeks.',
        boxes: [b('n', 'New statement', ['read daily'], 'none'), b('s', 'S3 Standard', ['hot, instant access'], 'ok')],
        deps: [d('New statement', 'S3 Standard', 'stored in', 'ok')],
      },
      {
        note: 'A lifecycle rule watches object age. After 30 days it moves the statements to S3 Standard-IA, which costs less per GB for data that is read rarely, but charges a retrieval fee. The move needs no code and no downtime.',
        boxes: [b('r', 'Lifecycle rule', ['after 30 days'], 'new'), b('s', 'S3 Standard', ['statements age 30 days'], 'warn'), b('i', 'S3 Infrequent Access', ['cheaper, retrieval fee'], 'ok')],
        deps: [d('Lifecycle rule', 'S3 Standard', 'checks age', 'ok'), d('S3 Standard', 'S3 Infrequent Access', 'moves', 'ok')],
      },
      {
        note: 'After 90 days the rule moves them to Glacier for long-term retention, for example the seven years that a regulation asks for. Storage is very cheap, and a retrieval takes minutes to hours. At the end of the period another rule deletes them.',
        boxes: [b('r', 'Lifecycle rule', ['after 90 days, after 7 years'], 'new'), b('g', 'Glacier', ['archive, slow retrieval'], 'ok'), b('x', 'Expired object', ['deleted by the rule'], 'none')],
        deps: [d('Lifecycle rule', 'Glacier', 'archives', 'ok'), d('Glacier', 'Expired object', 'after the retention', 'warn')],
      },
    ],
  },
  {
    id: 'security',
    label: 'Securing a bucket',
    title: 'Layers of protection',
    frames: [
      {
        note: 'The first layer is to forbid public access. Block Public Access is switched on for the account, so even a mistaken bucket policy or ACL cannot expose a bucket. The bucket policy then names the few roles that may read or write.',
        boxes: [b('b', 'Block public access', ['on for the whole account'], 'ok'), b('p', 'Bucket policy', ['only named roles'], 'new'), b('s', 'S3 bucket', ['private by default'], 'ok')],
        deps: [d('Block public access', 'S3 bucket', 'protects', 'ok'), d('Bucket policy', 'S3 bucket', 'allows listed roles', 'ok')],
      },
      {
        note: 'Every object is encrypted at rest. With SSE-KMS the key is a customer-managed KMS key, and its key policy says who may use it. A reader needs permission on the bucket and on the key, so two separate controls protect the data.',
        boxes: [b('s', 'S3 bucket', ['default encryption SSE-KMS'], 'ok'), b('k', 'KMS key', ['customer-managed, rotated'], 'new'), b('r', 'IAM role', ['needs bucket and key access'], 'ok')],
        deps: [d('S3 bucket', 'KMS key', 'encrypts with', 'ok'), d('IAM role', 'KMS key', 'must be allowed', 'warn')],
      },
      {
        note: 'The service reaches S3 through a VPC endpoint, so the traffic stays on the AWS network and never crosses the internet. A bucket policy condition can accept requests only from that endpoint and only over TLS.',
        boxes: [b('t', 'Fargate tasks', ['in a private subnet'], 'ok'), b('e', 'VPC endpoint', ['gateway endpoint for S3'], 'new'), b('s', 'S3 bucket', ['accepts only this endpoint'], 'ok')],
        deps: [d('Fargate tasks', 'VPC endpoint', 'private path', 'ok'), d('VPC endpoint', 'S3 bucket', 'TLS only', 'ok')],
      },
      {
        note: 'Data events for the bucket go to CloudTrail, so every read and write is recorded with the identity, the time and the source. Together with versioning and Object Lock, this gives the audit trail and the protection against deletion that a bank needs.',
        boxes: [b('s', 'S3 bucket', ['versioning, Object Lock'], 'ok'), b('c', 'CloudTrail', ['data events'], 'new'), b('a', 'Audit archive', ['in a log account'], 'ok')],
        deps: [d('S3 bucket', 'CloudTrail', 'every access', 'ok'), d('CloudTrail', 'Audit archive', 'delivered to', 'ok')],
      },
    ],
  },
  {
    id: 'disks',
    label: 'Disks, files and backup',
    title: 'EBS, EFS and AWS Backup',
    frames: [
      {
        note: 'EBS is a network disk for one EC2 instance at a time, in one availability zone. It is fast and survives a stop of the instance. It is the root disk of a server and the storage of a database that you run on EC2 yourself.',
        boxes: [b('e', 'EC2', ['zone A'], 'ok'), b('v', 'EBS', ['gp3 volume, encrypted'], 'ok'), b('s', 'EBS snapshot', ['point in time copy'], 'new')],
        deps: [d('EC2', 'EBS', 'attached to', 'ok'), d('EBS', 'EBS snapshot', 'snapshots to', 'ok')],
      },
      {
        note: 'EFS is a shared file system that many instances or containers mount at once, in several zones, over NFS. It grows and shrinks by itself. Use it for content that all copies of an application must see, not for a database.',
        boxes: [b('a', 'EC2', ['zone A mounts it'], 'ok'), b('f', 'EFS', ['shared file system'], 'new'), b('t', 'Fargate tasks', ['zone B mounts it'], 'ok')],
        deps: [d('EC2', 'EFS', 'NFS mount', 'ok'), d('Fargate tasks', 'EFS', 'NFS mount', 'ok')],
      },
      {
        note: 'AWS Backup applies one plan to many services: EBS, EFS, RDS, DynamoDB, S3. The plan sets the schedule and retention, copies the backups to another region and account, and a locked vault stops anyone from deleting them early.',
        boxes: [b('p', 'Backup', ['daily, kept 35 days'], 'new'), b('v', 'Backup vault', ['locked, second account'], 'ok'), b('r', 'Second region', ['copy for disaster recovery'], 'ok')],
        deps: [d('Backup', 'Backup vault', 'stores in', 'ok'), d('Backup vault', 'Second region', 'copies to', 'ok')],
      },
    ],
  },
];
