// Frame data for the "AWS identity and security" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const AWS_SECURITY_SCENES = [
  {
    id: 'roles',
    label: 'Roles, not keys',
    title: 'Who may do what',
    frames: [
      {
        note: 'A Fargate task needs to read one bucket. It has no access key. The task runs with an IAM role, and AWS hands it temporary credentials that expire and rotate by themselves. Nothing secret is stored in the image or the configuration.',
        boxes: [b('t', 'Fargate tasks', ['run with a task role'], 'none'), b('r', 'IAM role', ['trusted by ECS tasks'], 'new'), b('s', 'S3 bucket', ['statements bucket'], 'ok')],
        deps: [d('Fargate tasks', 'IAM role', 'assumes it, gets temporary keys', 'ok'), d('IAM role', 'S3 bucket', 'allowed: GetObject on one prefix', 'ok')],
      },
      {
        note: 'A request is allowed only if nothing denies it and something allows it. A service control policy sets the outer limit for the whole account. The role policy grants within that limit. An explicit deny anywhere wins over every allow.',
        boxes: [b('c', 'Service control policy', ['organization guardrail'], 'warn'), b('r', 'IAM role', ['identity policy allows'], 'ok'), b('s', 'S3 bucket', ['request must pass both'], 'ok')],
        deps: [d('Service control policy', 'IAM role', 'caps what is possible', 'warn'), d('IAM role', 'S3 bucket', 'allowed only if both allow', 'ok')],
      },
      {
        note: 'A pipeline deploys into another account without any stored key. Its role asks to assume a deploy role in the workload account, which trusts the pipeline account. The credentials last an hour, and CloudTrail records who assumed what.',
        boxes: [b('p', 'Pipeline role', ['in the CI account'], 'ok'), b('d', 'Deploy role', ['in the workload account, trusts the pipeline'], 'new'), b('c', 'CloudFormation', ['creates the resources'], 'ok')],
        deps: [d('Pipeline role', 'Deploy role', 'assumes, 1 hour', 'ok'), d('Deploy role', 'CloudFormation', 'deploys the stack', 'ok')],
      },
      {
        note: 'People sign in through IAM Identity Center, which is connected to the bank directory with multi-factor authentication. A permission set maps to a temporary role in each account, so nobody has a long-lived IAM user.',
        boxes: [b('d', 'Corporate directory', ['groups and MFA'], 'none'), b('i', 'IAM Identity Center', ['single sign-on'], 'new'), b('a', 'Admin role', ['temporary, per account'], 'ok')],
        deps: [d('Corporate directory', 'IAM Identity Center', 'federates', 'ok'), d('IAM Identity Center', 'Admin role', 'assigns a permission set', 'ok')],
      },
    ],
  },
  {
    id: 'kms',
    label: 'Envelope encryption',
    title: 'KMS and data keys',
    frames: [
      {
        note: 'KMS keys never leave KMS and are limited to small inputs. To encrypt a large document the service asks KMS for a data key. KMS returns two copies of one fresh key: a plaintext copy and a copy encrypted under the KMS key.',
        boxes: [b('a', 'Payments service', ['wants to encrypt a file'], 'none'), b('k', 'KMS key', ['GenerateDataKey'], 'new'), b('d', 'Data key', ['plaintext and encrypted copy'], 'ok')],
        deps: [d('Payments service', 'KMS key', 'asks for a data key', 'ok'), d('KMS key', 'Data key', 'returns two copies', 'ok')],
      },
      {
        note: 'The service encrypts the file locally with the plaintext data key using AES-GCM, then throws the plaintext key away. It stores the ciphertext together with the encrypted data key. The bucket holds nothing that can be read without KMS.',
        boxes: [b('a', 'Payments service', ['encrypts, forgets the key'], 'ok'), b('s', 'S3 bucket', ['ciphertext + encrypted key'], 'ok'), b('d', 'Data key', ['plaintext discarded'], 'warn')],
        deps: [d('Payments service', 'S3 bucket', 'stores the envelope', 'ok'), d('Payments service', 'Data key', 'discards the plaintext', 'warn')],
      },
      {
        note: 'To read the file the service sends the encrypted data key to KMS. KMS checks the key policy and the caller permissions, decrypts the data key and returns it. Every use of the key is written to CloudTrail.',
        boxes: [b('a', 'Payments service', ['needs the plaintext key'], 'none'), b('k', 'KMS key', ['checks policy, decrypts'], 'ok'), b('c', 'CloudTrail', ['logs every use'], 'new')],
        deps: [d('Payments service', 'KMS key', 'Decrypt the data key', 'ok'), d('KMS key', 'CloudTrail', 'records the call', 'ok')],
      },
      {
        note: 'A customer-managed key per data domain is common. The key policy decides who can use it and who can administer it, and the two groups differ. The same key protects the database and the bucket, and rotates every year without re-encrypting anything.',
        boxes: [b('k', 'KMS key', ['payments key, yearly rotation'], 'ok'), b('p', 'Key policy', ['payments roles only'], 'new'), b('d', 'Aurora database', ['encrypted with it'], 'ok'), b('s', 'S3 bucket', ['encrypted with it'], 'ok')],
        deps: [d('Key policy', 'KMS key', 'controls use', 'ok'), d('KMS key', 'Aurora database', 'encrypts', 'ok'), d('KMS key', 'S3 bucket', 'encrypts', 'ok')],
      },
    ],
  },
  {
    id: 'secrets',
    label: 'Secrets and rotation',
    title: 'No password in the code',
    frames: [
      {
        note: 'The database password lives in Secrets Manager, encrypted with a KMS key. At start-up the task reads it with its IAM role. The password is not in the image, the repository or an environment file.',
        boxes: [b('t', 'Fargate tasks', ['read the secret at start'], 'none'), b('s', 'Secrets Manager', ['database credentials'], 'new'), b('k', 'KMS key', ['encrypts the secret'], 'ok')],
        deps: [d('Fargate tasks', 'Secrets Manager', 'GetSecretValue with the role', 'ok'), d('Secrets Manager', 'KMS key', 'decrypts', 'ok')],
      },
      {
        note: 'Secrets Manager rotates the password on a schedule. It calls a Lambda function, which creates a new password, sets it in the database, tests it and marks it current. The application picks up the new value on its next read.',
        boxes: [b('s', 'Secrets Manager', ['rotates every 30 days'], 'ok'), b('l', 'Lambda function', ['rotation steps'], 'new'), b('d', 'Aurora database', ['password changed'], 'ok')],
        deps: [d('Secrets Manager', 'Lambda function', 'triggers', 'ok'), d('Lambda function', 'Aurora database', 'sets the new password', 'ok')],
      },
      {
        note: 'Not every value is a secret. Plain settings such as a feature flag or a URL go in Parameter Store, which is cheaper. Passwords, keys and tokens that need rotation and audit go in Secrets Manager.',
        boxes: [b('t', 'Fargate tasks', ['read both at start'], 'none'), b('s', 'Secrets Manager', ['passwords, rotation, audit'], 'ok'), b('p', 'Parameter Store', ['plain settings, cheaper'], 'ok')],
        deps: [d('Fargate tasks', 'Secrets Manager', 'secrets', 'ok'), d('Fargate tasks', 'Parameter Store', 'settings', 'ok')],
      },
    ],
  },
  {
    id: 'detect',
    label: 'Detect and respond',
    title: 'Record, check, alert',
    frames: [
      {
        note: 'CloudTrail records every API call: who, from where, what and when. The trail is delivered to a locked archive in a separate log account, with log file validation, so an attacker who takes over a workload account cannot erase the evidence.',
        boxes: [b('a', 'Admin role', ['changes a security group'], 'none'), b('c', 'CloudTrail', ['every API call'], 'new'), b('v', 'Audit archive', ['log account, locked'], 'ok')],
        deps: [d('Admin role', 'CloudTrail', 'call is recorded', 'ok'), d('CloudTrail', 'Audit archive', 'immutable copy', 'ok')],
      },
      {
        note: 'Config checks resources against rules, for example that no bucket is public. When a bucket breaks the rule Config marks it non-compliant, and an automatic action can fix it, here a Lambda function that switches Block Public Access back on.',
        boxes: [b('c', 'Config', ['rule: no public bucket'], 'warn'), b('s', 'S3 bucket', ['public, non-compliant'], 'bad'), b('l', 'Lambda function', ['turns Block Public Access on'], 'ok')],
        deps: [d('Config', 'S3 bucket', 'finds the breach', 'bad'), d('Config', 'Lambda function', 'starts the fix', 'ok')],
      },
      {
        note: 'GuardDuty watches CloudTrail, flow logs and DNS logs for unusual behaviour, such as a credential used from a new country. Security Hub collects the findings from all services and accounts in one place, and EventBridge routes the serious ones to the on-call team.',
        boxes: [b('g', 'GuardDuty', ['finds unusual behaviour'], 'new'), b('h', 'Security Hub', ['all findings in one place'], 'ok'), b('e', 'EventBridge', ['routes to on-call'], 'ok')],
        deps: [d('GuardDuty', 'Security Hub', 'finding', 'ok'), d('Security Hub', 'EventBridge', 'high severity', 'warn')],
      },
      {
        note: 'Inspector scans container images and instances for known vulnerabilities, and Macie looks for personal data such as card numbers in buckets. Both feed their findings into Security Hub, so they are fixed before they become incidents.',
        boxes: [b('i', 'Inspector', ['image vulnerabilities'], 'ok'), b('r', 'ECR', ['scanned on push'], 'none'), b('m', 'Macie', ['finds card numbers'], 'ok'), b('s', 'S3 bucket', ['scanned for personal data'], 'none')],
        deps: [d('Inspector', 'ECR', 'scans', 'ok'), d('Macie', 'S3 bucket', 'scans', 'ok')],
      },
    ],
  },
];
