// Content of the AWS service map figure. slug = file in public/images/aws (official AWS Architecture Icons).
// Colours are only the accent of each category card, not AWS's.

const s = (slug, name, role) => ({ slug, name, role });

export const AWS_MAP = [
  {
    id: 'compute', title: 'Compute', color: '#c25e0a',
    services: [
      s('ec2', 'EC2', 'virtual machines'),
      s('auto-scaling', 'Auto Scaling', 'add and remove instances'),
      s('lambda', 'Lambda', 'functions on events'),
      s('ecs', 'ECS', 'AWS container orchestrator'),
      s('eks', 'EKS', 'managed Kubernetes'),
      s('fargate', 'Fargate', 'containers, no nodes'),
      s('beanstalk', 'Elastic Beanstalk', 'deploy a web app'),
      s('batch', 'Batch', 'queued batch jobs'),
    ],
  },
  {
    id: 'storage', title: 'Storage', color: '#2f7d4f',
    services: [
      s('s3', 'S3', 'objects and files'),
      s('glacier', 'S3 Glacier', 'cheap archive'),
      s('ebs', 'EBS', 'a disk for one instance'),
      s('efs', 'EFS', 'shared file system'),
      s('fsx', 'FSx', 'Windows and HPC files'),
      s('backup', 'Backup', 'central backup policies'),
    ],
  },
  {
    id: 'databases', title: 'Databases', color: '#23408f',
    services: [
      s('rds', 'RDS', 'managed relational databases'),
      s('aurora', 'Aurora', 'fast MySQL and PostgreSQL'),
      s('dynamodb', 'DynamoDB', 'key-value at any scale'),
      s('elasticache', 'ElastiCache', 'Redis and Memcached'),
      s('documentdb', 'DocumentDB', 'MongoDB compatible'),
      s('neptune', 'Neptune', 'graph database'),
      s('redshift', 'Redshift', 'data warehouse'),
      s('opensearch', 'OpenSearch', 'search and log analytics'),
    ],
  },
  {
    id: 'networking', title: 'Networking', color: '#7b3fa0',
    services: [
      s('vpc', 'VPC', 'your private network'),
      s('elb', 'Load balancers', 'ALB for HTTP, NLB for TCP'),
      s('route53', 'Route 53', 'DNS and failover'),
      s('cloudfront', 'CloudFront', 'CDN at the edge'),
      s('api-gateway', 'API Gateway', 'managed API front door'),
      s('direct-connect', 'Direct Connect', 'private link to a data centre'),
      s('transit-gateway', 'Transit Gateway', 'hub for many VPCs'),
      s('privatelink', 'PrivateLink', 'private access to services'),
    ],
  },
  {
    id: 'security', title: 'Security and identity', color: '#b3261e',
    services: [
      s('iam', 'IAM', 'who may do what'),
      s('identity-center', 'IAM Identity Center', 'single sign-on for people'),
      s('kms', 'KMS', 'encryption keys'),
      s('secrets-manager', 'Secrets Manager', 'secrets with rotation'),
      s('cognito', 'Cognito', 'sign-in for your app users'),
      s('waf', 'WAF', 'web application firewall'),
      s('shield', 'Shield', 'DDoS protection'),
      s('guardduty', 'GuardDuty', 'threat detection'),
      s('security-hub', 'Security Hub', 'findings in one place'),
      s('acm', 'Certificate Manager', 'TLS certificates'),
    ],
  },
  {
    id: 'integration', title: 'Integration and messaging', color: '#a65b0a',
    services: [
      s('sqs', 'SQS', 'message queue'),
      s('sns', 'SNS', 'publish and subscribe'),
      s('eventbridge', 'EventBridge', 'event bus and rules'),
      s('kinesis', 'Kinesis', 'ordered data streams'),
      s('msk', 'MSK', 'managed Kafka'),
      s('step-functions', 'Step Functions', 'workflows and sagas'),
      s('mq', 'Amazon MQ', 'managed ActiveMQ, RabbitMQ'),
    ],
  },
  {
    id: 'operations', title: 'Developer and operations', color: '#2a6f8f',
    services: [
      s('cloudformation', 'CloudFormation', 'infrastructure as code'),
      s('cdk', 'CDK', 'infrastructure in Java or TypeScript'),
      s('ecr', 'ECR', 'container image registry'),
      s('codebuild', 'CodeBuild', 'managed builds'),
      s('codepipeline', 'CodePipeline', 'release pipelines'),
      s('codedeploy', 'CodeDeploy', 'deployments'),
      s('cloudwatch', 'CloudWatch', 'metrics, logs, alarms'),
      s('x-ray', 'X-Ray', 'distributed tracing'),
      s('cloudtrail', 'CloudTrail', 'audit of API calls'),
      s('config', 'Config', 'resource compliance'),
      s('systems-manager', 'Systems Manager', 'patching and parameters'),
    ],
  },
  {
    id: 'analytics', title: 'Analytics and AI', color: '#566b2e',
    services: [
      s('athena', 'Athena', 'SQL over S3'),
      s('glue', 'Glue', 'ETL and data catalogue'),
      s('emr', 'EMR', 'Spark and Hadoop'),
      s('lake-formation', 'Lake Formation', 'data lake permissions'),
      s('sagemaker', 'SageMaker', 'build and host models'),
      s('bedrock', 'Bedrock', 'foundation models by API'),
    ],
  },
  {
    id: 'governance', title: 'Governance and cost', color: '#556070',
    services: [
      s('organizations', 'Organizations', 'many accounts, guardrails'),
      s('control-tower', 'Control Tower', 'governed landing zone'),
      s('cost-explorer', 'Cost Explorer', 'where the money goes'),
      s('budgets', 'Budgets', 'alerts on spend'),
      s('trusted-advisor', 'Trusted Advisor', 'best-practice checks'),
    ],
  },
];
