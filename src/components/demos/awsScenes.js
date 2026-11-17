// Frame data for the "AWS service map" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const AWS_SCENES = [
  {
    id: 'webapp',
    label: 'Web application',
    title: 'A Spring Boot service on AWS, layer by layer',
    frames: [
      {
        note: 'A customer opens the banking site. Route 53 resolves the domain name, and CloudFront, the content delivery network, serves static files from an edge location near the user and forwards the dynamic requests. AWS WAF can block bad requests here, at the edge.',
        boxes: [b('u', 'Customer', ['browser or mobile app'], 'none'), b('r', 'Route 53', ['DNS'], 'ok'), b('c', 'CloudFront', ['CDN and WAF at the edge'], 'new')],
        deps: [d('Customer', 'Route 53', 'resolves the name', 'ok'), d('Route 53', 'CloudFront', 'points to', 'ok')],
      },
      {
        note: 'CloudFront forwards the request to an Application Load Balancer, the only public entry into the VPC. The load balancer spreads it over containers that run in private subnets in two availability zones, here on ECS with Fargate, so there are no servers to patch.',
        boxes: [b('c', 'CloudFront', ['forwards dynamic calls'], 'ok'), b('l', 'ALB', ['ALB, spans two zones'], 'new'), b('f', 'Fargate tasks', ['Spring Boot containers'], 'ok')],
        deps: [d('CloudFront', 'ALB', 'HTTPS', 'ok'), d('ALB', 'Fargate tasks', 'health-checked traffic', 'ok')],
      },
      {
        note: 'The containers keep no state. Accounts and payments go to Aurora PostgreSQL with a standby in the second zone. Hot reads come from ElastiCache for Redis, and statements and documents are written to S3 as objects.',
        boxes: [b('f', 'Fargate tasks', ['stateless'], 'ok'), b('a', 'Aurora database', ['multi-AZ PostgreSQL'], 'ok'), b('e', 'ElastiCache', ['Redis cache'], 'new'), b('s', 'S3 bucket', ['statements and files'], 'ok')],
        deps: [d('Fargate tasks', 'Aurora database', 'SQL', 'ok'), d('Fargate tasks', 'ElastiCache', 'hot reads', 'ok'), d('Fargate tasks', 'S3 bucket', 'objects', 'ok')],
      },
      {
        note: 'Around the application sit the cross-cutting services. The tasks run with an IAM role and no stored keys, KMS holds the encryption keys, CloudWatch collects logs and metrics, and CloudTrail records every API call for the audit.',
        boxes: [b('f', 'Fargate tasks', ['assume an IAM role'], 'ok'), b('i', 'IAM role', ['temporary credentials'], 'new'), b('k', 'KMS key', ['encrypts data'], 'ok'), b('w', 'CloudWatch', ['logs and metrics'], 'ok'), b('t', 'CloudTrail', ['audit of API calls'], 'ok')],
        deps: [d('Fargate tasks', 'IAM role', 'assume', 'ok'), d('IAM role', 'KMS key', 'may use', 'ok'), d('Fargate tasks', 'CloudWatch', 'send', 'ok'), d('IAM role', 'CloudTrail', 'every call logged', 'ok')],
      },
    ],
  },
  {
    id: 'events',
    label: 'Event-driven',
    title: 'Decoupling services with messages',
    frames: [
      {
        note: 'The order service does not call every interested service. It publishes one event to an SNS topic. SNS pushes a copy to each subscribed SQS queue, so adding a new consumer needs no change in the publisher. This is the fan-out pattern.',
        boxes: [b('o', 'Order service', ['publishes OrderPlaced'], 'ok'), b('t', 'SNS topic', ['fan-out'], 'new'), b('p', 'Payments SQS', ['SQS'], 'ok'), b('n', 'Notifications SQS', ['SQS'], 'ok')],
        deps: [d('Order service', 'SNS topic', 'publish', 'ok'), d('SNS topic', 'Payments SQS', 'copy', 'ok'), d('SNS topic', 'Notifications SQS', 'copy', 'ok')],
      },
      {
        note: 'Each queue holds its messages until a consumer is ready, which smooths out spikes. A Lambda function reads the payment queue in batches, processes the event and writes the result to a DynamoDB table. The queue scales the function, so there are no servers to run.',
        boxes: [b('p', 'Payments SQS', ['buffers the spike'], 'ok'), b('l', 'Lambda function', ['processes in batches'], 'new'), b('d', 'DynamoDB table', ['stores the result'], 'ok')],
        deps: [d('Payments SQS', 'Lambda function', 'triggers', 'ok'), d('Lambda function', 'DynamoDB table', 'writes', 'ok')],
      },
      {
        note: 'A poison message makes the function fail repeatedly. After a set number of receives SQS moves it to a dead-letter queue, so it stops blocking the others. A CloudWatch alarm on the dead-letter queue pages the team, and the message can be inspected and redriven.',
        boxes: [b('l', 'Lambda function', ['fails on one message'], 'bad'), b('q', 'SQS DLQ', ['after 5 attempts'], 'warn'), b('a', 'Alarm', ['messages in the DLQ'], 'bad')],
        deps: [d('Lambda function', 'SQS DLQ', 'moved after retries', 'warn'), d('SQS DLQ', 'Alarm', 'triggers', 'bad')],
      },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    title: 'Many accounts under one organisation',
    frames: [
      {
        note: 'A bank does not put everything in one AWS account. AWS Organizations groups many accounts under one management account, in organisational units: production, non-production and shared services. Each account is a strong security and billing boundary.',
        boxes: [b('o', 'Organization', ['management account'], 'new'), b('p', 'Production OU', ['payments, accounts'], 'ok'), b('d', 'Development OU', ['sandboxes, test'], 'ok'), b('s', 'Shared services', ['logging, tooling'], 'none')],
        deps: [d('Organization', 'Production OU', 'contains', 'ok'), d('Organization', 'Development OU', 'contains', 'ok'), d('Organization', 'Shared services', 'contains', 'ok')],
      },
      {
        note: 'A service control policy attached to an organisational unit sets the outer limit of what any account in it may do, even for its administrators. Here it forbids leaving the approved regions and switching off CloudTrail. It is a guardrail, not a grant.',
        boxes: [b('g', 'Guardrail', ['service control policy'], 'new'), b('p', 'Production OU', ['guardrail applies'], 'ok'), b('x', 'Blocked action', ['unapproved region'], 'bad')],
        deps: [d('Guardrail', 'Production OU', 'attached to', 'ok'), d('Production OU', 'Blocked action', 'denied', 'bad')],
      },
      {
        note: 'People and pipelines do not get users in every account. They sign in once through single sign-on and assume a role in the target account for a short time. The pipeline account can only deploy into production through a narrow cross-account role.',
        boxes: [b('l', 'Pipeline account', ['builds and deploys'], 'none'), b('r', 'Cross-account role', ['temporary, deploy only'], 'new'), b('a', 'Production account', ['the workload'], 'ok')],
        deps: [d('Pipeline account', 'Cross-account role', 'assumes', 'ok'), d('Cross-account role', 'Production account', 'acts in', 'ok')],
      },
    ],
  },
];
