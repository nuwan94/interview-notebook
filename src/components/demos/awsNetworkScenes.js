// Frame data for the "AWS networking" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const AWS_NETWORK_SCENES = [
  {
    id: 'vpc',
    label: 'A VPC with subnets',
    title: 'Public in front, private behind',
    frames: [
      {
        note: 'A VPC is your own private network in one region, with an address range such as 10.0.0.0/16. You cut it into subnets, each in one availability zone. Public subnets hold what faces the internet. Private subnets hold the application and the database.',
        boxes: [b('v', 'VPC', ['10.0.0.0/16, three zones'], 'new'), b('p', 'Public subnet', ['load balancer, NAT'], 'ok'), b('q', 'Private subnet', ['application and database'], 'ok')],
        deps: [d('VPC', 'Public subnet', 'contains', 'ok'), d('VPC', 'Private subnet', 'contains', 'ok')],
      },
      {
        note: 'An internet gateway connects the VPC to the internet. Customers reach the load balancer in the public subnet. The load balancer forwards the requests to the tasks in the private subnet, which have no public address and cannot be reached directly.',
        boxes: [b('i', 'Internet gateway', ['the way in and out'], 'new'), b('l', 'ALB', ['public subnet'], 'ok'), b('t', 'Fargate tasks', ['private subnet, no public IP'], 'ok')],
        deps: [d('Internet gateway', 'ALB', 'HTTPS from customers', 'ok'), d('ALB', 'Fargate tasks', 'forwards the request', 'ok')],
      },
      {
        note: 'The private tasks sometimes call out, for example to a partner API. A NAT gateway in the public subnet lets them start connections to the internet, and replies come back, but nothing outside can start a connection to them.',
        boxes: [b('t', 'Fargate tasks', ['call a partner API'], 'none'), b('n', 'NAT gateway', ['public subnet, outbound only'], 'new'), b('i', 'Internet gateway', ['to the internet'], 'ok')],
        deps: [d('Fargate tasks', 'NAT gateway', 'route table sends it', 'ok'), d('NAT gateway', 'Internet gateway', 'translated address', 'ok')],
      },
      {
        note: 'Security groups are the firewall at each resource, and they allow rules only. The load balancer accepts 443 from anywhere. The application accepts its port only from the load balancer group. The database accepts its port only from the application group.',
        boxes: [b('a', 'ALB security group', ['443 from anywhere'], 'ok'), b('b', 'App security group', ['8080 from the ALB group'], 'ok'), b('c', 'Database security group', ['5432 from the app group'], 'ok')],
        deps: [d('ALB security group', 'App security group', 'only this group', 'ok'), d('App security group', 'Database security group', 'only this group', 'ok')],
      },
    ],
  },
  {
    id: 'traffic',
    label: 'From user to container',
    title: 'DNS, edge, load balancer',
    frames: [
      {
        note: 'The app looks up api.bank.example. Route 53 answers with an alias to the CloudFront distribution. From then on the customer talks to the nearest CloudFront edge location, not to your region.',
        boxes: [b('m', 'Mobile app', ['looks up the name'], 'none'), b('r', 'Route 53', ['alias record'], 'new'), b('c', 'CloudFront', ['nearest edge location'], 'ok')],
        deps: [d('Mobile app', 'Route 53', 'DNS query', 'ok'), d('Route 53', 'CloudFront', 'alias to the edge', 'ok')],
      },
      {
        note: 'At the edge CloudFront ends TLS using a certificate from Certificate Manager, which renews it by itself. WAF inspects every request there and blocks injection attempts, bad bots and floods before they reach your region.',
        boxes: [b('c', 'CloudFront', ['TLS ends here'], 'ok'), b('w', 'WAF', ['blocks bad requests'], 'new'), b('a', 'Certificate Manager', ['renews the certificate'], 'ok')],
        deps: [d('WAF', 'CloudFront', 'filters requests', 'ok'), d('Certificate Manager', 'CloudFront', 'TLS certificate', 'ok')],
      },
      {
        note: 'CloudFront forwards what it cannot serve from its cache to the load balancer. The ALB sends each request to a healthy target in the target group. Targets that fail the health check are taken out until they recover.',
        boxes: [b('l', 'ALB', ['routes by path and host'], 'ok'), b('g', 'Target group', ['health check on /health'], 'new'), b('t', 'Fargate tasks', ['spread over three zones'], 'ok')],
        deps: [d('ALB', 'Target group', 'picks a target', 'ok'), d('Target group', 'Fargate tasks', 'only healthy ones', 'ok')],
      },
      {
        note: 'For disaster recovery Route 53 health checks watch the primary region. When it fails, Route 53 answers with the second region instead. The failover time depends on the record TTL, so keep it short for records that need to move.',
        boxes: [b('r', 'Route 53', ['health check fails'], 'warn'), b('p', 'Primary region', ['unhealthy'], 'bad'), b('s', 'Second region', ['takes the traffic'], 'ok')],
        deps: [d('Route 53', 'Primary region', 'stops answering with it', 'bad'), d('Route 53', 'Second region', 'failover record', 'ok')],
      },
    ],
  },
  {
    id: 'private',
    label: 'Private connections',
    title: 'Keeping traffic off the internet',
    frames: [
      {
        note: 'Tasks in a private subnet read a bucket. Without help the traffic goes through the NAT gateway to the public S3 address. A gateway VPC endpoint adds a route straight to S3 inside the AWS network. It is free and removes the NAT charge.',
        boxes: [b('t', 'Fargate tasks', ['private subnet'], 'none'), b('e', 'VPC endpoint', ['route to S3'], 'new'), b('s', 'S3 bucket', ['statements bucket'], 'ok')],
        deps: [d('Fargate tasks', 'VPC endpoint', 'route table entry', 'ok'), d('VPC endpoint', 'S3 bucket', 'stays on the AWS network', 'ok')],
      },
      {
        note: 'PrivateLink shares one service with another VPC or account without joining the networks. The consumer gets a private address in its own subnet. Only that one service is reachable, and the address ranges may overlap.',
        boxes: [b('a', 'Payments service', ['consumer VPC'], 'none'), b('p', 'PrivateLink', ['private address'], 'new'), b('s', 'Partner service', ['provider behind an NLB'], 'ok')],
        deps: [d('Payments service', 'PrivateLink', 'calls a private name', 'ok'), d('PrivateLink', 'Partner service', 'one service only', 'ok')],
      },
      {
        note: 'The bank data centre connects to AWS over Direct Connect, a dedicated private line with steady latency. A Site-to-Site VPN over the internet is the encrypted backup path. Both end on a Transit Gateway, which connects the VPCs.',
        boxes: [b('d', 'Bank data centre', ['core banking'], 'none'), b('c', 'Direct Connect', ['dedicated line'], 'ok'), b('v', 'Site-to-Site VPN', ['encrypted backup'], 'warn'), b('t', 'Transit Gateway', ['hub for the VPCs'], 'new')],
        deps: [d('Bank data centre', 'Direct Connect', 'primary', 'ok'), d('Bank data centre', 'Site-to-Site VPN', 'backup', 'warn'), d('Direct Connect', 'Transit Gateway', 'attached', 'ok'), d('Site-to-Site VPN', 'Transit Gateway', 'attached', 'warn')],
      },
    ],
  },
  {
    id: 'api',
    label: 'API Gateway',
    title: 'A managed front door for APIs',
    frames: [
      {
        note: 'API Gateway receives the request first. It checks the bearer token with a Cognito authorizer, so a request without a valid token is rejected before it costs any backend time.',
        boxes: [b('m', 'Mobile app', ['sends a bearer token'], 'none'), b('g', 'API Gateway', ['authorizer on every route'], 'new'), b('c', 'Cognito', ['validates the JWT'], 'ok')],
        deps: [d('Mobile app', 'API Gateway', 'HTTPS with a token', 'ok'), d('API Gateway', 'Cognito', 'checks the token', 'ok')],
      },
      {
        note: 'A usage plan limits how fast each client can call, for example 100 requests a second with a burst of 200. A partner that goes over gets 429 responses instead of overloading the services behind.',
        boxes: [b('p', 'Partner app', ['has an API key'], 'none'), b('g', 'API Gateway', ['throttles per client'], 'ok'), b('u', 'Usage plan', ['100 per second, burst 200'], 'warn')],
        deps: [d('Partner app', 'API Gateway', 'calls with its key', 'ok'), d('Usage plan', 'API Gateway', 'sets the limits', 'warn')],
      },
      {
        note: 'API Gateway can call a Lambda function directly. To reach a service in a private subnet it uses a VPC link to the load balancer, so the containers never get a public address.',
        boxes: [b('g', 'API Gateway', ['routes by path'], 'ok'), b('l', 'Lambda function', ['small handlers'], 'ok'), b('v', 'VPC link', ['private route'], 'new'), b('a', 'ALB', ['internal load balancer'], 'ok')],
        deps: [d('API Gateway', 'Lambda function', 'proxy integration', 'ok'), d('API Gateway', 'VPC link', 'for private services', 'ok'), d('VPC link', 'ALB', 'inside the VPC', 'ok')],
      },
      {
        note: 'API Gateway waits at most 29 seconds for a backend, and its payload limit is 10 MB. Long work does not fit. The API answers 202 Accepted at once, puts the job on a queue and the client reads the result later.',
        boxes: [b('g', 'API Gateway', ['29 second limit'], 'warn'), b('q', 'SQS queue', ['long jobs go here'], 'ok'), b('l', 'Lambda function', ['does the work'], 'ok')],
        deps: [d('API Gateway', 'SQS queue', '202 Accepted', 'ok'), d('SQS queue', 'Lambda function', 'processes later', 'ok')],
      },
    ],
  },
];
