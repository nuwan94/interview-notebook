// Frame data for the "AWS compute" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const AWS_COMPUTE_SCENES = [
  {
    id: 'ec2',
    label: 'EC2 fleet',
    title: 'From an image to a scaling fleet',
    frames: [
      {
        note: 'An EC2 instance starts from an image, an AMI, which holds the operating system and the software you baked in. The instance type sets CPU and memory, an IAM role gives it permissions without keys, and an EBS volume is its disk.',
        boxes: [b('a', 'AMI', ['OS and Java baked in'], 'new'), b('e', 'EC2', ['m7g.large, 2 vCPU, 8 GiB'], 'ok'), b('r', 'IAM role', ['instance profile, no keys'], 'ok'), b('v', 'EBS', ['encrypted root disk'], 'none')],
        deps: [d('AMI', 'EC2', 'launches', 'ok'), d('EC2', 'IAM role', 'assumes', 'ok'), d('EC2', 'EBS', 'boots from', 'ok')],
      },
      {
        note: 'A launch template records the AMI, instance type, role, security group and user data once. An Auto Scaling group uses it to keep between a minimum and a maximum number of instances, spread over two availability zones.',
        boxes: [b('t', 'Launch template', ['AMI, type, role, security group'], 'new'), b('g', 'Auto Scaling group', ['min 2, desired 2, max 8'], 'ok'), b('a', 'EC2', ['one instance in each zone'], 'ok')],
        deps: [d('Launch template', 'Auto Scaling group', 'defines', 'ok'), d('Auto Scaling group', 'EC2', 'keeps running', 'ok')],
      },
      {
        note: 'The load balancer health-checks the instances and sends traffic only to healthy ones. A target-tracking policy watches average CPU. When it passes 60 percent, the group adds instances, and later it removes them again.',
        boxes: [b('l', 'ALB', ['health checks the targets'], 'ok'), b('g', 'Auto Scaling group', ['target tracking, CPU 60 percent'], 'new'), b('a', 'EC2', ['2 growing to 6'], 'warn')],
        deps: [d('ALB', 'EC2', 'traffic to healthy ones', 'ok'), d('Auto Scaling group', 'EC2', 'adds and removes', 'warn')],
      },
      {
        note: 'To release a new version you build a new AMI, update the launch template, and start an instance refresh. The group replaces the instances in small batches and waits for each new one to pass the load balancer check, so the release is a rolling update.',
        boxes: [b('t', 'Launch template', ['version 2, new AMI'], 'new'), b('g', 'Auto Scaling group', ['instance refresh'], 'warn'), b('a', 'EC2', ['replaced in batches'], 'ok')],
        deps: [d('Launch template', 'Auto Scaling group', 'new version', 'ok'), d('Auto Scaling group', 'EC2', 'replaces gradually', 'warn')],
      },
    ],
  },
  {
    id: 'lambda',
    label: 'Lambda',
    title: 'What happens when a function is called',
    frames: [
      {
        note: 'An event source calls the function, for example an HTTP request through API Gateway, a message from SQS or a file arriving in S3. The function has an IAM role that allows only what it needs, here one DynamoDB table.',
        boxes: [b('e', 'API Gateway', ['HTTP request'], 'none'), b('f', 'Lambda function', ['Java 21 handler'], 'new'), b('d', 'DynamoDB table', ['payments'], 'ok')],
        deps: [d('API Gateway', 'Lambda function', 'invokes', 'ok'), d('Lambda function', 'DynamoDB table', 'reads and writes', 'ok')],
      },
      {
        note: 'If no warm execution environment is free, Lambda creates one. This is the cold start: it downloads the code, starts the JVM and runs the initialisation code. A Java function with a large framework can take seconds. Later calls reuse the environment and run in milliseconds.',
        boxes: [b('c', 'Cold start', ['download, JVM start, init'], 'bad'), b('w', 'Warm call', ['environment reused'], 'ok'), b('f', 'Lambda function', ['handler runs'], 'new')],
        deps: [d('Cold start', 'Lambda function', 'first call, slow', 'bad'), d('Warm call', 'Lambda function', 'next calls, fast', 'ok')],
      },
      {
        note: 'Ways to reduce the cold start for Java: SnapStart takes a snapshot of the initialised function and restores it, provisioned concurrency keeps environments ready, and a lean dependency set or a native image shortens the start itself.',
        boxes: [b('s', 'SnapStart', ['restore from a snapshot'], 'new'), b('p', 'Provisioned concurrency', ['environments kept warm'], 'ok'), b('f', 'Lambda function', ['starts in milliseconds'], 'ok')],
        deps: [d('SnapStart', 'Lambda function', 'restores', 'ok'), d('Provisioned concurrency', 'Lambda function', 'already running', 'ok')],
      },
      {
        note: 'With an SQS trigger, Lambda polls the queue and scales out with the queue length, up to the reserved concurrency you set. That limit protects the database behind it. A failed message returns to the queue and ends in the dead-letter queue.',
        boxes: [b('q', 'SQS', ['backlog of messages'], 'warn'), b('f', 'Lambda function', ['up to 20 at once'], 'new'), b('d', 'DynamoDB table', ['protected by the limit'], 'ok')],
        deps: [d('SQS', 'Lambda function', 'batches', 'ok'), d('Lambda function', 'DynamoDB table', 'writes', 'ok')],
      },
    ],
  },
  {
    id: 'containers',
    label: 'ECS and EKS',
    title: 'Two ways to run containers',
    frames: [
      {
        note: 'Both start from an image in ECR, the AWS image registry. The pipeline builds it once and tags it with the commit, and every environment runs that same image.',
        boxes: [b('p', 'Pipeline', ['builds the image'], 'none'), b('r', 'ECR', ['payments:4f2a9c1'], 'new'), b('e', 'ECS', ['or EKS, same image'], 'ok')],
        deps: [d('Pipeline', 'ECR', 'pushes', 'ok'), d('ECR', 'ECS', 'pulled by', 'ok')],
      },
      {
        note: 'In ECS a task definition describes the containers: image, CPU, memory, ports, secrets and the roles. A service keeps the wanted number of tasks running behind the load balancer. On Fargate, AWS supplies the compute for every task.',
        boxes: [b('d', 'Task definition', ['image, CPU, memory, roles'], 'new'), b('s', 'ECS', ['service keeps 4 tasks'], 'ok'), b('t', 'Fargate tasks', ['no nodes to manage'], 'ok')],
        deps: [d('Task definition', 'ECS', 'used by', 'ok'), d('ECS', 'Fargate tasks', 'runs', 'ok')],
      },
      {
        note: 'In EKS AWS runs the Kubernetes control plane. You choose where the pods run: managed node groups of EC2 instances, Karpenter that adds nodes as needed, or Fargate. You keep the Kubernetes objects and tools you already know.',
        boxes: [b('c', 'EKS', ['managed control plane'], 'new'), b('n', 'Worker nodes', ['managed node group or Karpenter'], 'ok'), b('p', 'Pods', ['your Deployments'], 'ok')],
        deps: [d('EKS', 'Worker nodes', 'schedules on', 'ok'), d('Worker nodes', 'Pods', 'run', 'ok')],
      },
      {
        note: 'Both give a pod or task its own IAM role, so the application calls AWS with temporary credentials: a task role in ECS, and a service-account role (IRSA or Pod Identity) in EKS. No access key is stored in the image or the configuration.',
        boxes: [b('t', 'Fargate tasks', ['task role'], 'ok'), b('p', 'Pods', ['service-account role'], 'ok'), b('r', 'IAM role', ['temporary credentials'], 'new'), b('s', 'S3 bucket', ['read one prefix'], 'ok')],
        deps: [d('Fargate tasks', 'IAM role', 'assume', 'ok'), d('Pods', 'IAM role', 'assume', 'ok'), d('IAM role', 'S3 bucket', 'allows', 'ok')],
      },
    ],
  },
];
