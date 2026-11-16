// Frame data for the "Cloud basics" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const CLOUD_SCENES = [
  {
    id: 'models',
    label: 'Service models',
    title: 'Who manages what',
    frames: [
      {
        note: 'With infrastructure as a service (IaaS) you rent a virtual machine, for example an EC2 instance. The provider runs the hardware and the virtualisation. You install and patch the operating system and the runtime, and you deploy your own code.',
        boxes: [b('c', 'Your code', ['you deploy and run it'], 'ok', 'you'), b('v', 'Virtual machine', ['you patch the OS'], 'warn', 'IaaS'), b('h', 'Hardware', ['the provider runs it'], 'none')],
        deps: [d('Your code', 'Virtual machine', 'runs on', 'ok'), d('Virtual machine', 'Hardware', 'runs on', 'ok')],
      },
      {
        note: 'With platform as a service (PaaS), for example Elastic Beanstalk or Azure App Service, you upload the application. The provider manages the operating system, the runtime, patching and scaling, and you keep control of the code and its settings.',
        boxes: [b('c', 'Your code', ['you deploy it'], 'ok', 'you'), b('p', 'Managed platform', ['OS, runtime, scaling'], 'new', 'PaaS'), b('h', 'Hardware', ['the provider runs it'], 'none')],
        deps: [d('Your code', 'Managed platform', 'runs on', 'ok'), d('Managed platform', 'Hardware', 'runs on', 'ok')],
      },
      {
        note: 'Serverless goes further. A function such as AWS Lambda runs only when an event arrives, scales to zero when idle, and is billed per call and per millisecond. You write the function, and everything below it, including servers, is the provider\'s job.',
        boxes: [b('e', 'Event', ['an HTTP call or a message'], 'none'), b('f', 'Function', ['runs only when called'], 'new', 'serverless'), b('d', 'Managed database', ['for example DynamoDB'], 'ok')],
        deps: [d('Event', 'Function', 'invokes', 'ok'), d('Function', 'Managed database', 'reads and writes', 'ok')],
      },
      {
        note: 'With software as a service (SaaS) the provider runs the whole application, and you only use it and configure it. Email, a CRM and an HR system are typical examples. You still own your data and the access you give to people.',
        boxes: [b('u', 'Your users', ['sign in and use it'], 'ok'), b('s', 'SaaS application', ['the provider runs everything'], 'new', 'SaaS'), b('t', 'Your data', ['you stay accountable'], 'warn')],
        deps: [d('Your users', 'SaaS application', 'use', 'ok'), d('SaaS application', 'Your data', 'stores', 'warn')],
      },
    ],
  },
  {
    id: 'regions',
    label: 'Regions and zones',
    title: 'Surviving failures',
    frames: [
      {
        note: 'A region is a geographic area, for example Singapore (ap-southeast-1). Inside it there are several availability zones, which are separate data centres with their own power, cooling and network, close enough to talk with low latency.',
        boxes: [b('r', 'Region', ['for example Singapore'], 'none'), b('a', 'Zone A', ['its own data centre'], 'ok'), b('z', 'Zone B', ['its own data centre'], 'ok')],
        deps: [d('Region', 'Zone A', 'contains', 'ok'), d('Region', 'Zone B', 'contains', 'ok')],
      },
      {
        note: 'A highly available service runs in at least two zones. A load balancer spreads the requests over both, and the database has a primary in zone A and a synchronous standby in zone B (multi-AZ).',
        boxes: [b('l', 'Load balancer', ['spreads requests'], 'new'), b('a', 'Zone A', ['app and primary database'], 'ok'), b('z', 'Zone B', ['app and standby database'], 'ok')],
        deps: [d('Load balancer', 'Zone A', 'half', 'ok'), d('Load balancer', 'Zone B', 'half', 'ok')],
      },
      {
        note: 'Zone A loses power. The load balancer stops sending requests there and uses zone B, and the standby database is promoted to primary, usually within a minute or two. Users see a short delay at worst, and nobody is paged at night.',
        boxes: [b('a', 'Zone A', ['down'], 'bad'), b('l', 'Load balancer', ['uses only zone B'], 'warn'), b('z', 'Zone B', ['standby becomes primary'], 'ok')],
        deps: [d('Load balancer', 'Zone A', 'health check fails', 'bad'), d('Load balancer', 'Zone B', 'all traffic', 'ok')],
      },
      {
        note: 'A whole region is rarer to lose, but it can happen, and some rules require a plan for it. A second region holds replicated data and a smaller or switched-off copy of the system. DNS failover moves users there. This is disaster recovery, and it costs more.',
        boxes: [b('p', 'Primary region', ['unavailable'], 'bad'), b('n', 'DNS failover', ['points to the second region'], 'warn'), b('s', 'Second region', ['replicated data, warm copy'], 'ok')],
        deps: [d('Primary region', 'DNS failover', 'health check fails', 'bad'), d('DNS failover', 'Second region', 'routes users', 'ok')],
      },
    ],
  },
  {
    id: 'scaling',
    label: 'Elasticity',
    title: 'Pay for what the load needs',
    frames: [
      {
        note: 'In a normal period two instances handle the traffic behind a load balancer. An auto scaling group keeps that number, replaces an instance that fails, and watches a metric such as average CPU.',
        boxes: [b('l', 'Load balancer', ['normal load'], 'none'), b('i', 'Instances', ['2 running'], 'ok'), b('m', 'Metrics', ['CPU 45 percent'], 'ok')],
        deps: [d('Load balancer', 'Instances', 'requests', 'ok'), d('Instances', 'Metrics', 'report', 'ok')],
      },
      {
        note: 'Salary day arrives and traffic triples. CPU passes the 70 percent target, so the scaling policy adds instances. This is scaling out, which means more machines and not a bigger one. It works well when the application is stateless.',
        boxes: [b('m', 'Metrics', ['CPU 85 percent'], 'bad'), b('a', 'Auto scaling', ['target is 70 percent'], 'new'), b('i', 'Instances', ['2, growing to 6'], 'warn')],
        deps: [d('Metrics', 'Auto scaling', 'above target', 'bad'), d('Auto scaling', 'Instances', 'adds', 'ok')],
      },
      {
        note: 'When the peak is over, the group removes the extra instances after a cool-down period. You paid for six instances for a few hours, not for the whole month. Elasticity is the ability to grow and shrink with the load, and it is a main reason for the cloud.',
        boxes: [b('m', 'Metrics', ['CPU 30 percent'], 'ok'), b('a', 'Auto scaling', ['scales in'], 'new'), b('i', 'Instances', ['back to 2'], 'ok'), b('c', 'Cost', ['pay for hours used'], 'ok')],
        deps: [d('Metrics', 'Auto scaling', 'below target', 'ok'), d('Auto scaling', 'Instances', 'removes', 'ok'), d('Instances', 'Cost', 'billed per hour', 'ok')],
      },
    ],
  },
  {
    id: 'responsibility',
    label: 'Shared responsibility',
    title: 'Security of the cloud and in the cloud',
    frames: [
      {
        note: 'Security is split. The provider is responsible for the security of the cloud: buildings, hardware, the network and the virtualisation layer. The customer is responsible for security in the cloud: identities, data, configuration and patching what runs on a virtual machine.',
        boxes: [b('p', 'Cloud provider', ['buildings, hardware, hypervisor'], 'ok'), b('y', 'Your team', ['identities, data, settings'], 'warn'), b('w', 'Workload', ['your application'], 'none')],
        deps: [d('Cloud provider', 'Workload', 'secures the platform', 'ok'), d('Your team', 'Workload', 'secures the use', 'warn')],
      },
      {
        note: 'Most cloud breaches come from the customer side. A storage bucket with public access exposes customer files, even though the provider\'s data centre was perfectly secure. A misconfiguration is the biggest cloud risk.',
        boxes: [b('b', 'Storage bucket', ['customer statements'], 'bad'), b('p', 'Public access', ['switched on by mistake'], 'bad'), b('i', 'Internet', ['anyone can read'], 'bad')],
        deps: [d('Public access', 'Storage bucket', 'opens', 'bad'), d('Internet', 'Storage bucket', 'reads', 'bad')],
      },
      {
        note: 'Least privilege fixes it. The service has an IAM role with a policy that allows only what it needs, for example reading one bucket. Public access is blocked at the account level, and the access is logged and audited.',
        boxes: [b('s', 'Payments service', ['assumes a role'], 'none'), b('r', 'IAM role', ['no stored password'], 'new'), b('o', 'Policy', ['read one bucket only'], 'ok'), b('b', 'Storage bucket', ['private, encrypted'], 'ok')],
        deps: [d('Payments service', 'IAM role', 'assumes', 'ok'), d('IAM role', 'Policy', 'has', 'ok'), d('Policy', 'Storage bucket', 'allows read', 'ok')],
      },
    ],
  },
];
