// Official AWS Architecture Icons (64 px service icons, July 2026 release), copied unmodified into
// public/images/aws. Used only for boxes that are named after an AWS service; see public/images/CREDITS.md.
// Each rule maps a box title to a file slug. Rules are exact titles on purpose, so generic words
// (a Java "Lambda", a "queue") keep their ordinary icons.

const BASE = import.meta.env.BASE_URL || './';

const RULES = [
  [/^ec2( instances?)?$/i, 'ec2'],
  [/^auto scaling group$/i, 'auto-scaling'],
  [/^lambda function$/i, 'lambda'],
  [/^ecs$/i, 'ecs'],
  [/^eks$/i, 'eks'],
  [/^ecr$/i, 'ecr'],
  [/^fargate( tasks?)?$/i, 'fargate'],
  [/^elastic beanstalk$/i, 'beanstalk'],
  [/^s3( bucket| standard| infrequent access)?$/i, 's3'],
  [/^(aws )?backup( vault)?$/i, 'backup'],
  [/^glacier$/i, 'glacier'],
  [/^ebs$/i, 'ebs'],
  [/^efs$/i, 'efs'],
  [/^rds$/i, 'rds'],
  [/^aurora( database)?$/i, 'aurora'],
  [/^dynamodb( table)?$/i, 'dynamodb'],
  [/^elasticache$/i, 'elasticache'],
  [/^opensearch$/i, 'opensearch'],
  [/^redshift$/i, 'redshift'],
  [/^vpc$/i, 'vpc'],
  [/^(alb|nlb|elb)$/i, 'elb'],
  [/^route 53$/i, 'route53'],
  [/^cloudfront$/i, 'cloudfront'],
  [/^api gateway$/i, 'api-gateway'],
  [/^direct connect$/i, 'direct-connect'],
  [/^transit gateway$/i, 'transit-gateway'],
  [/^iam( role)?$/i, 'iam'],
  [/^iam identity center$/i, 'identity-center'],
  [/^kms( key)?$/i, 'kms'],
  [/^secrets manager$/i, 'secrets-manager'],
  [/^cognito$/i, 'cognito'],
  [/^waf$/i, 'waf'],
  [/^guardduty$/i, 'guardduty'],
  [/^sns( topic)?$/i, 'sns'],
  [/^sqs( queue)?$|^(payments|notifications) sqs$|^sqs dlq$/i, 'sqs'],
  [/^eventbridge$/i, 'eventbridge'],
  [/^kinesis$/i, 'kinesis'],
  [/^msk$/i, 'msk'],
  [/^step functions$/i, 'step-functions'],
  [/^cloudformation$/i, 'cloudformation'],
  [/^cdk$/i, 'cdk'],
  [/^cloudwatch$/i, 'cloudwatch'],
  [/^cloudtrail$/i, 'cloudtrail'],
  [/^organization$/i, 'organizations'],
  [/^control tower$/i, 'control-tower'],
];

const cache = new Map();

function component(slug) {
  if (!cache.has(slug)) {
    // a nested <svg> works both inside the graph's svg (x, y, size in pixels) and on its own (size "1em")
    const AwsIcon = ({ x, y, size = '1em' }) => (
      <svg x={x} y={y} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
        <image href={`${BASE}images/aws/${slug}.svg`} width="80" height="80" />
      </svg>
    );
    cache.set(slug, AwsIcon);
  }
  return cache.get(slug);
}

/** The official AWS icon component for a box title, or null when the title is not an AWS service name. */
export function awsIcon(name = '') {
  const rule = RULES.find(([re]) => re.test(name));
  return rule ? component(rule[1]) : null;
}
