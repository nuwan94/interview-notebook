---
title: AWS networking — VPC, load balancers, Route 53, CloudFront and API Gateway
nav: AWS networking
slug: aws-networking
summary: How traffic reaches and leaves a service on AWS, VPC with subnets, route tables, internet and NAT gateways, security groups and network ACLs, Application and Network Load Balancers with target groups and health checks, Route 53 routing and failover, CloudFront and WAF at the edge, API Gateway with authorizers and throttling, VPC endpoints and PrivateLink, Direct Connect, VPN and Transit Gateway, what Java services must configure behind them, cost traps, and what a bank adds, with examples and interview questions.
tags: [AWS, VPC, ALB, Route 53, CloudFront, API Gateway, Networking, Security group, Java, Spring Boot]
order: 58
topic: Cloud / AWS
updated: 2026-11-17
subnav: true
---

Networking is where cloud security, availability and cost meet, and interviewers like it because it shows whether you understand what happens to a request. They ask *how a VPC is laid out, what makes a subnet public, how a private service reaches the internet or S3, how security groups differ from network ACLs, what a load balancer does and how health checks work, how Route 53 and CloudFront fit in front, when to use API Gateway instead of a load balancer, and how a bank connects its data centre.* This lesson follows the [service map](lesson:aws-service-map#networking) and builds on [cloud basics](lesson:cloud-basics#networking). Play the four scenes: the VPC, the path from user to container, private connections, and API Gateway.

```demo
name: aws-network-walk
```

*The AWS service icons in the diagrams are the official AWS Architecture Icons, shown unmodified. This site is not affiliated with, endorsed by or sponsored by Amazon Web Services.*

> **One sentence to remember:** *Put only the load balancer in public subnets, keep application and data in private subnets, control access with security groups that reference each other, reach AWS services through endpoints, and put DNS, an edge and a load balancer in front for speed, protection and availability.*

```demo
name: aws-map-networking
```

## The VPC {#vpc}

A **VPC** (Virtual Private Cloud) is your isolated network inside one region. You choose its **CIDR range** (for example `10.0.0.0/16`) and divide it into **subnets**, each living in **one availability zone**.

- **Public subnet:** has a route to an **internet gateway**, so resources with a public address can talk to the internet. Put only the load balancers and NAT gateways here.
- **Private subnet:** has **no route** to the internet gateway. The application, the databases and the caches live here. Resources reach out through a NAT gateway or endpoints, and nothing reaches in.
- **A third tier** is sometimes used: **isolated** subnets with no outbound route at all, for databases.
- **Route tables:** each subnet uses a route table, a list of destination ranges and targets. The line `0.0.0.0/0 -> igw-...` is what makes a subnet public. The line `0.0.0.0/0 -> nat-...` gives a private subnet outbound access. The line `10.0.0.0/16 -> local` is always there.
- **Zones:** make each tier **in at least two, usually three zones**, with the same subnets in each, so a zone failure leaves the others running ([availability](lesson:cloud-basics#availability)).
- **Address planning:** choose ranges that **do not overlap** with other VPCs, accounts and the bank's data centre, because overlapping ranges cannot be routed together later. Leave room to grow, and think about IPv6.
- **Default VPC:** every region has one with public subnets. Do not use it for real workloads, and some banks delete it.

## Reaching the internet and AWS services {#egress}

- **Internet gateway (IGW):** a horizontally scaled gateway that connects the VPC to the internet. It carries inbound and outbound traffic for public addresses and costs nothing by itself.
- **NAT gateway:** lets resources in private subnets **start** connections to the internet (a partner API, a package repository) and receive the replies, while nothing outside can start one to them. It lives in a **public subnet**, and you need **one per zone** for resilience. It charges **per hour and per GB processed**, which is a common surprise on the bill.
- **VPC endpoints** keep traffic to AWS services on the AWS network and **remove the NAT cost** for that traffic:
  - **gateway endpoints** for **S3 and DynamoDB**: a route table entry, **free**;
  - **interface endpoints** (powered by **PrivateLink**) for most other services (SQS, Secrets Manager, ECR, KMS, CloudWatch): a private network interface in your subnet, charged per hour and per GB.
  - An **endpoint policy** limits what can be reached through it, and a bucket policy can require `aws:SourceVpce`, so a bucket is readable only from your network ([bucket security](lesson:aws-storage#security)).
- **PrivateLink** also exposes **your own service** to other VPCs and accounts through a Network Load Balancer: the consumer sees one private address, only that service is reachable, and address ranges may overlap.
- **Egress control:** to restrict where private workloads may call, route outbound traffic through **AWS Network Firewall** or a proxy, which filters by domain name.

## Security groups and network ACLs {#firewalls}

| | Security group | Network ACL |
| --- | --- | --- |
| level | the **network interface** of a resource | the **subnet** |
| state | **stateful**: the reply is allowed automatically | **stateless**: allow the return traffic too |
| rules | **allow** only | **allow and deny**, evaluated in number order |
| default | denies all inbound, allows all outbound | the default NACL allows everything |
| use | the main control | a coarse extra layer, for example blocking an address range |

The pattern that matters is **security groups that reference each other**: the load balancer group accepts 443 from the internet, the application group accepts its port **only from the load balancer group**, and the database group accepts its port **only from the application group**. No address lists to maintain, and a compromised host elsewhere in the VPC cannot reach the database. Never open `0.0.0.0/0` to SSH or database ports. Use **Systems Manager Session Manager** instead of a bastion host.

## Load balancers {#load-balancing}

Elastic Load Balancing spreads traffic over healthy targets in several zones:

| | **ALB** (Application) | **NLB** (Network) | **GWLB** |
| --- | --- | --- | --- |
| layer | 7, HTTP, HTTPS, gRPC, WebSocket | 4, TCP, UDP, TLS | 3, appliances |
| routing | by host, path, header, query, method | by port | transparent to firewalls |
| address | DNS name, changing IPs | **static IP** per zone, Elastic IPs | |
| extras | redirects, fixed responses, OIDC or Cognito authentication, WAF, slow start | extreme throughput, low latency, PrivateLink source, preserves the client IP | inspection fleets |

- **Target group:** the set of targets (instances, IP addresses, Lambda functions, containers) with a **health check** (path, interval, thresholds). Only healthy targets receive traffic. Make `/health` check what the service needs, but not every dependency, or a failing database takes every task out at once ([readiness vs liveness](lesson:spring-observability)).
- **Cross-zone** balancing is on by default for ALB, and has a data charge on NLB.
- **TLS:** terminate it at the load balancer with a certificate from **Certificate Manager (ACM)**, which issues and renews it for free, and choose a modern security policy. Re-encrypt to the targets when the bank requires encryption in transit inside the VPC.
- **Timeouts and draining:** the ALB **idle timeout** (60 seconds by default) closes quiet connections, and the **deregistration delay** (300 seconds by default) lets in-flight requests finish when a target leaves. Set the application's keep-alive timeout **longer** than the ALB idle timeout, and shut the application down gracefully ([Java settings below](#java)).
- **Client address:** the application sees the load balancer's address. The real one is in the `X-Forwarded-For` header.
- **Listener rules** let one ALB serve many services by path or host, which saves money, at the cost of a shared failure domain and shared limits.
- **Containers and Kubernetes:** ECS registers tasks in target groups by itself, and on EKS the **AWS Load Balancer Controller** creates ALBs and NLBs from Ingress and Service objects ([compute](lesson:aws-compute#ecs)).

## Route 53 {#route53}

A managed DNS service with a 100 percent availability target, **hosted zones** (public or private, for names inside a VPC) and **records**:

- **Alias records** point a name, even the bare domain, to an AWS resource (CloudFront, ALB, API Gateway, S3 website) at no query cost, and follow its address changes. A `CNAME` cannot sit at the zone apex.
- **Routing policies:**
  - **simple** (one answer), **weighted** (a share of traffic to each, for gradual shifts and tests), **latency** (the lowest-latency region), **geolocation** and **geoproximity** (by user location, for data residency), **failover** (primary and secondary), **multivalue answer**.
- **Health checks** watch an endpoint or a CloudWatch alarm and remove an unhealthy answer, which gives **DNS failover** between regions ([disaster recovery](lesson:cloud-basics#availability)).
- **TTL:** DNS answers are cached for the TTL, so failover is **not instant**. Use a short TTL (30 to 60 seconds) for records that must move, and remember that some resolvers and **JVMs cache longer** than asked.
- **Private hosted zones** give internal names such as `payments.internal` that resolve only inside the VPC. **Resolver endpoints** forward queries between the VPC and the bank's on-premises DNS.
- **DNSSEC** signing is available for public zones.

## CloudFront and WAF {#edge}

**CloudFront** is a content delivery network with hundreds of edge locations:

- **Caching and speed:** static files, images and cacheable API responses are served from the edge near the user, and dynamic requests travel to the origin over AWS's backbone, which is faster than the open internet. Cache by path with **cache policies**, control it with `Cache-Control` headers, and invalidate with a path.
- **Origins:** an S3 bucket (use **origin access control**, so the bucket is not public), a load balancer, API Gateway or any HTTP server. Protect an ALB origin by requiring a **secret header** or a managed prefix list, so only CloudFront can reach it.
- **Security:** TLS at the edge with an **ACM certificate in us-east-1**, **AWS WAF** attached to the distribution, free **Shield Standard** DDoS protection, geo restrictions, signed URLs and cookies for private content.
- **Edge compute:** **CloudFront Functions** and **Lambda@Edge** rewrite or redirect requests at the edge.
- **Banking use:** cache only public, non-personal content. Never cache an authenticated response without a cache key that includes the user, and prefer to forward the `Authorization` header and not cache at all.

**AWS WAF** filters HTTP requests with managed rule groups (OWASP style injection and cross-site scripting rules, known bad inputs, IP reputation), rate-based rules, and your own rules. It attaches to CloudFront, an ALB, API Gateway or Cognito. **Shield Advanced** adds DDoS response support and cost protection. **Global Accelerator** gives two static anycast addresses that route TCP and UDP traffic over the AWS backbone to the closest healthy region, for non-HTTP traffic or fast regional failover without DNS caching.

## API Gateway {#api-gateway}

A managed front door for APIs:

- **Types:** **HTTP API** (cheaper, faster, JWT authorizers, enough for most uses), **REST API** (more features: usage plans, API keys, request validation, caching, WAF, private endpoints) and **WebSocket API**.
- **What it does for you:** TLS, **authorization** (Cognito or any JWT/OIDC issuer, IAM, or a Lambda authorizer), **throttling** and **usage plans** per client, request validation and transformation, stages and canary releases, custom domains, access logs and metrics.
- **Integrations:** Lambda (proxy), an HTTP endpoint, an **ALB or NLB through a VPC link** (to reach private services), and AWS services directly.
- **Limits:** about **29 seconds** of integration time and a **10 MB** payload, so long jobs return `202 Accepted` and finish asynchronously through a queue ([messaging](lesson:messaging)).
- **Pricing:** per request, so it is excellent for spiky or low-volume APIs and **expensive at steady, very high volume**, where an ALB is cheaper.
- **API Gateway or ALB?** Use API Gateway when you want built-in authorization, throttling per client, API keys for partners and a serverless back end. Use an ALB when you have containers, high steady traffic, gRPC or WebSocket, and you do authorization in the service or in a gateway such as [Spring Cloud Gateway](lesson:spring-cloud#gateway). Many banks put both: the edge, then an API gateway, then services ([gateway pattern](lesson:microservice-communication#gateway)).

## Connecting networks {#hybrid}

- **Direct Connect:** a **dedicated private line** from the bank's data centre or a colocation facility to AWS. Steady latency and throughput, no internet, usually ordered months ahead. Use **two connections in different locations** for resilience, because a single line is a single point of failure.
- **Site-to-Site VPN:** IPsec tunnels over the internet. Quick to set up, encrypted, lower bandwidth, variable latency. The usual **backup for Direct Connect** or the starter link.
- **Transit Gateway:** a regional **hub** that connects many VPCs, VPNs and Direct Connect with route tables, instead of a mesh of **VPC peering** links. Peering is simpler for two VPCs but is not transitive.
- **Cross-account sharing:** AWS **Resource Access Manager** shares subnets or a Transit Gateway across accounts, and PrivateLink exposes single services.
- **Multi-account layout:** a bank usually has a **network account** that owns the Direct Connect, the Transit Gateway, inspection and shared DNS, and workload accounts that attach to it ([accounts](lesson:aws-service-map#accounts)).
- **Overlapping addresses** are the classic problem, so reserve ranges centrally before the first VPC exists.

## What a Java service must configure {#java}

- **Forwarded headers:** behind a load balancer, set `server.forward-headers-strategy=native` (or `framework`) so Spring builds correct redirect URLs and sees the real scheme and client address.
- **Keep-alive above the idle timeout:** if Tomcat closes an idle connection before the ALB does, the ALB may reuse a closed connection and return **502**. Set Tomcat's `keep-alive-timeout` above 60 seconds, for example 65.
- **Graceful shutdown:** `server.shutdown=graceful` with a timeout shorter than the deregistration delay and the ECS `stopTimeout`, so in-flight requests finish when a task is replaced ([deployments](lesson:deployment-strategies)).
- **Health endpoint:** expose `/actuator/health` (liveness and readiness groups) for the target group, and keep it cheap.
- **DNS caching:** the JVM caches successful lookups. A DNS name that moves (a database failover, a Route 53 failover) needs `networkaddress.cache.ttl` set to something short such as 30 seconds.
- **Timeouts:** set connect and read timeouts on every client, and **retry only idempotent calls with backoff**, so a slow dependency does not exhaust threads ([resilience](lesson:microservice-resilience)).
- **Connection reuse:** use pooled HTTP clients with keep-alive, because new TLS connections are slow and NAT gateways have limits on simultaneous connections per destination.
- **Trust and TLS:** use the platform trust store, keep certificates short-lived, and consider mutual TLS between services if the bank requires it.

## Cost levers {#cost}

- **NAT gateway** hourly and per-GB charges: use **gateway endpoints** for S3 and DynamoDB, interface endpoints for chatty services such as ECR, and keep one NAT per zone only where the availability need justifies it.
- **Data transfer:** traffic **between zones** and **between regions** is charged, and internet egress costs most. Keep chatty services in the same zone when you can, use CloudFront (cheaper egress and caching), and watch cross-zone load balancing.
- **Load balancers** cost per hour plus capacity units: share one ALB across services by host and path rules where isolation allows.
- **Public IPv4 addresses** are charged per hour, so avoid giving them to resources that do not need them.
- **API Gateway** per-request pricing against ALB hourly pricing: do the arithmetic at your traffic level.
- **Idle resources:** unused NAT gateways, load balancers and Elastic IPs keep billing.

## In a bank {#bank}

- **Private by default:** only the edge and load balancers are public, applications and data are in private or isolated subnets, and databases are never publicly accessible. A service control policy can deny creating internet gateways or public addresses outside the network account.
- **Layered protection:** DNS, CloudFront and WAF with managed rules and rate limits, Shield, then an ALB or API Gateway with authentication, then security groups per tier, with encryption in transit everywhere, including inside the VPC.
- **Segmentation:** separate accounts and VPCs for production, non-production and shared services, connected through a Transit Gateway with inspection, with **no direct route** between production and non-production.
- **Private connectivity:** Direct Connect with a redundant second line and a VPN backup to the data centre, PrivateLink and endpoints with endpoint policies for AWS services, and no internet path for sensitive data.
- **Egress allow-list:** outbound calls pass a firewall or proxy that allows only approved domains.
- **Visibility:** **VPC Flow Logs** to a protected log account, ALB and CloudFront access logs, WAF logs, DNS query logging, GuardDuty and alarms on unusual traffic.
- **Resilience:** three zones, a tested regional failover (Route 53 or Global Accelerator), health checks that reflect real readiness, and capacity for a zone loss.
- **Compliance:** documented network diagrams, IP plan, change control through code review of the infrastructure templates ([infrastructure as code](lesson:aws-service-map#operations)), and region choices that respect data residency.

Try it in the lab: [Inside a VPC: public and private subnets](lab:aws-vpc-request-path).

## Cheat sheet {#cheatsheet}

| Topic | Remember |
| --- | --- |
| VPC | your network in one region, subnets in single zones, CIDR ranges that must not overlap |
| public subnet | route to the internet gateway, holds only load balancers and NAT |
| private subnet | no inbound path, outbound through NAT or endpoints |
| NAT gateway | outbound only, one per zone, per-hour plus per-GB charge |
| endpoints | gateway (S3, DynamoDB, free), interface (PrivateLink, others, charged) |
| security group | stateful, allow only, reference other groups |
| network ACL | stateless, subnet level, allow and deny, a coarse extra layer |
| ALB / NLB | layer 7 with path and host routing / layer 4 with static IPs and top speed |
| target group | targets plus a health check, only healthy ones get traffic |
| Route 53 | alias records, weighted, latency, failover, TTL limits failover speed |
| CloudFront | edge cache, TLS with ACM, WAF, origin access control |
| API Gateway | auth, throttling, usage plans, 29 s and 10 MB limits, per-request price |
| hybrid | Direct Connect (primary), VPN (backup), Transit Gateway (hub) |
| Java | forwarded headers, keep-alive above the idle timeout, graceful shutdown, short DNS TTL |

## Interview questions {#questions}

### [basic] What makes a subnet public or private? {#subnet-q}

A subnet is public when its route table has a route to an internet gateway (`0.0.0.0/0` to the IGW) and its resources have public addresses. A private subnet has no such route, so nothing from the internet can reach it, and it reaches out only through a NAT gateway or endpoints. Put load balancers and NAT gateways in public subnets and applications and databases in private ones, in each availability zone.

### [basic] What is the difference between a security group and a network ACL? {#sg-nacl-q}

A security group is a stateful, allow-only firewall on a resource's network interface, so reply traffic is allowed automatically. A network ACL works at the subnet level, is stateless (return traffic needs its own rule), and supports allow and deny rules evaluated in order. Security groups are the main control, especially when they reference each other, and a network ACL is an optional coarse layer such as blocking a range of addresses.

### [basic] What does a NAT gateway do? {#nat-q}

It lets resources in private subnets start connections to the internet and receive the replies, by translating their addresses to its own public address, while blocking connections started from outside. It lives in a public subnet, you need one per zone for resilience, and it charges per hour and per gigabyte, so use VPC endpoints for AWS service traffic to reduce the cost.

### [basic] What is the difference between ALB and NLB? {#alb-nlb-q}

An ALB works at layer 7 and understands HTTP: it routes by host, path, header or method, handles redirects, authentication and WebSocket, and integrates with WAF. An NLB works at layer 4 on TCP, UDP and TLS, gives a static IP per zone, handles extreme throughput with low latency, preserves the client address, and is what PrivateLink services sit behind. Choose an ALB for web and API traffic and an NLB for non-HTTP protocols, static addresses or the highest performance.

### [basic] What is a VPC endpoint? {#endpoint-q}

A private path from your VPC to an AWS service that does not use the internet or a NAT gateway. A gateway endpoint (S3 and DynamoDB) is a route table entry and is free. An interface endpoint (PrivateLink) is a network interface with a private address in your subnet for most other services and is charged. Endpoint policies limit what can be reached, and bucket policies can require that access comes from a specific endpoint.

### [basic] What does Route 53 do? {#route53-q}

It is AWS's DNS service: it hosts public and private zones and answers queries with records. Alias records point names, including the bare domain, at AWS resources. Routing policies (weighted, latency, geolocation, failover) decide which answer to give, and health checks remove unhealthy answers, which gives DNS failover. Because answers are cached for the TTL, failover is not immediate.

### [intermediate] A private ECS service must call an external partner API and read from S3. How do you set up the network? {#egress-q}

Place the tasks in private subnets across zones. Route outbound internet traffic to a NAT gateway in a public subnet of the same zone (one per zone), and ideally pass it through a firewall or proxy that allows only the partner's domain. For S3 add a gateway VPC endpoint so those requests stay on the AWS network and avoid NAT charges, with an endpoint policy and a bucket policy that requires the endpoint. Add interface endpoints for ECR, Secrets Manager and CloudWatch Logs if the tasks must start without internet access.

### [intermediate] Users get sporadic 502 errors behind an ALB from a Spring Boot service. What do you check? {#502-q}

First whether Tomcat's keep-alive timeout is shorter than the ALB idle timeout (60 seconds by default): the application closes an idle connection and the ALB reuses it, which gives a 502, so set the keep-alive above the idle timeout. Then check that tasks are deregistered gracefully (deregistration delay, graceful shutdown and the ECS stop timeout), that health checks pass during start-up and deployment, that the application is not crashing or out of memory, and the ALB access logs and target response codes to tell an application error from a connection error.

### [intermediate] How do you design a service so one zone can fail without an outage? {#zones-q}

Run the load balancer, the tasks and the data tier in at least two zones, preferably three, with enough capacity left after losing one. Use a Multi-AZ database or an Aurora cluster, one NAT gateway per zone with per-zone route tables, a target group health check that removes failed targets, an Auto Scaling or ECS service that spreads tasks across zones and replaces lost ones, and cross-zone load balancing. Then test it by failing a zone or a task set, because untested failover tends to fail.

### [intermediate] How would you place CloudFront and WAF in front of an application and stop people bypassing them? {#bypass-q}

Point the DNS name at CloudFront with an alias record, terminate TLS there with an ACM certificate in us-east-1, and attach WAF with managed rule groups and rate limits to the distribution. To stop requests going straight to the origin, allow only CloudFront to reach the load balancer: use the CloudFront managed prefix list in the ALB security group, and require a secret header that CloudFront adds and the ALB or application checks. For an S3 origin use origin access control and keep the bucket private.

### [intermediate] When would you choose API Gateway over an ALB? {#apigw-alb-q}

When the API needs built-in authorization (Cognito, JWT, IAM or a Lambda authorizer), per-client throttling and usage plans, API keys for partners, request validation, stages and canary releases, or when the back end is Lambda and traffic is spiky or low. An ALB is better for containerised services with high, steady traffic (per-request pricing adds up), gRPC or WebSocket and long requests, because API Gateway has a 29-second integration limit and a 10 MB payload limit. Banks often combine them, with API Gateway for external partner APIs and ALBs inside.

### [intermediate] What are the options for connecting a bank data centre to AWS? {#hybrid-q}

Direct Connect is a dedicated private line with steady latency and bandwidth, ordered in advance, and should be duplicated across two locations. Site-to-Site VPN is encrypted IPsec over the internet, quick to set up, with lower and less predictable performance, and is the usual backup path. Both attach to a Transit Gateway that connects the VPCs. Plan non-overlapping address ranges early, use BGP routing, share DNS through Route 53 Resolver endpoints, and monitor both links.

### [intermediate] What is the difference between VPC peering, Transit Gateway and PrivateLink? {#connect-q}

Peering is a one-to-one connection between two VPCs, simple and cheap but not transitive and needing non-overlapping ranges. Transit Gateway is a hub that connects many VPCs, VPNs and Direct Connect with route tables, which scales better than a mesh of peerings and allows central inspection. PrivateLink exposes one service to consumers without connecting the networks, so only that service is reachable and ranges may overlap, which suits a service provided to other teams, accounts or partners.

### [deep] Design the network for a bank's internet-facing payments API on AWS. {#design-q}

A multi-account landing zone with a network account owning the Transit Gateway, Direct Connect to the data centre (two locations) with a VPN backup, inspection and shared DNS. The payments account has a VPC across three zones with public subnets that contain only the load balancer, private subnets for the ECS or EKS tasks and isolated subnets for the Aurora database, with security groups that reference each other. Traffic enters through Route 53, CloudFront with WAF, Shield and rate limits, then an ALB reachable only from CloudFront and API Gateway for partner APIs with usage plans and JWT authorization. Tasks reach AWS services through endpoints with policies, and outbound calls pass an egress firewall with a domain allow-list. Flow logs, access logs, WAF logs and GuardDuty go to a protected log account, TLS is used everywhere, a second region is ready behind Route 53 failover, and everything is created by reviewed infrastructure code.

### [deep] DNS failover to the second region took ten minutes instead of one. Why, and what would you change? {#failover-q}

DNS answers are cached by resolvers, operating systems and the JVM for the TTL or longer, so clients keep using the old address after Route 53 changes its answer. Causes include a TTL that was too long (300 seconds or more), clients and resolvers that ignore the TTL, a health check with a slow detection interval and thresholds, and connections that stay open to the failed region. Lower the TTL and health check interval and failure threshold for records that must fail over, configure the JVM DNS cache TTL, close and retry stale connections, and consider Global Accelerator, whose static anycast addresses fail over without DNS caching. Rehearse the failover and measure the real recovery time.

### [deep] Your AWS bill shows large NAT gateway and data transfer charges. How do you investigate and reduce them? {#nat-cost-q}

Use VPC Flow Logs and Cost Explorer with usage type to find which workloads send the data and where. The usual causes are traffic to S3, DynamoDB, ECR or other AWS services passing through the NAT gateway, cross-zone traffic from chatty services and load balancers, cross-region replication, and large downloads from the internet. Fix with gateway endpoints for S3 and DynamoDB, interface endpoints for the heavy services (ECR, CloudWatch), keeping chatty services in the same zone, serving content through CloudFront, compressing, and replacing per-zone NATs in non-production by a single one. Re-measure after each change.

### [coding] Write CloudFormation for an internet-facing ALB, an application security group that accepts traffic only from it, and a target group with a health check and a draining delay. {#coding-alb}

```yaml
Resources:
  AlbSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: ALB, HTTPS from the internet
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - { IpProtocol: tcp, FromPort: 443, ToPort: 443, CidrIp: 0.0.0.0/0 }

  AppSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Payments tasks, traffic only from the ALB
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 8080
          ToPort: 8080
          SourceSecurityGroupId: !Ref AlbSecurityGroup   # a group, not an address range

  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Type: application
      Scheme: internet-facing
      Subnets: [!Ref PublicSubnetA, !Ref PublicSubnetB, !Ref PublicSubnetC]
      SecurityGroups: [!Ref AlbSecurityGroup]
      LoadBalancerAttributes:
        - { Key: idle_timeout.timeout_seconds, Value: '60' }
        - { Key: routing.http.drop_invalid_header_fields.enabled, Value: 'true' }

  TargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      VpcId: !Ref Vpc
      Protocol: HTTP
      Port: 8080
      TargetType: ip                                   # Fargate tasks
      HealthCheckPath: /actuator/health/readiness
      HealthCheckIntervalSeconds: 15
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      TargetGroupAttributes:
        - { Key: deregistration_delay.timeout_seconds, Value: '30' }   # draining time for in-flight requests

  HttpsListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref LoadBalancer
      Port: 443
      Protocol: HTTPS
      SslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06
      Certificates: [{ CertificateArn: !Ref Certificate }]
      DefaultActions:
        - { Type: forward, TargetGroupArn: !Ref TargetGroup }
```

Explain: the load balancer group is the only one open to the internet, and the application group names it as the **source**, so the tasks accept traffic only from the ALB and not from anything else in the VPC; the ALB sits in **public subnets** in three zones while the tasks stay private; the target group's health check uses the readiness endpoint, with two successes to join and three failures to leave; the short **deregistration delay** lets in-flight requests finish when a task is replaced (set the service's stop timeout and Spring's graceful shutdown to fit inside it); and the listener terminates TLS 1.2 and 1.3 with an ACM certificate.

### [coding] Configure Spring Boot to run correctly behind an ALB: forwarded headers, keep-alive above the idle timeout, graceful shutdown and health groups. {#coding-spring}

```yaml
server:
  port: 8080
  forward-headers-strategy: native         # trust X-Forwarded-For and X-Forwarded-Proto from the load balancer
  shutdown: graceful                       # finish in-flight requests on SIGTERM
  tomcat:
    keep-alive-timeout: 65s                # longer than the ALB idle timeout of 60 seconds
    max-keep-alive-requests: 1000
    connection-timeout: 20s
    remoteip:
      internal-proxies: 10\.\d+\.\d+\.\d+  # only trust the VPC range as a proxy

spring:
  lifecycle:
    timeout-per-shutdown-phase: 25s        # shorter than the ALB draining delay and the ECS stop timeout

management:
  endpoint:
    health:
      probes:
        enabled: true                      # /actuator/health/liveness and /readiness
      group:
        readiness:
          include: readinessState,db       # leave the optional dependencies out
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
```

```java
@Configuration
class DnsCacheConfig {
    @PostConstruct
    void shortDnsCache() {
        // a database or service name that moves on failover must be looked up again soon
        java.security.Security.setProperty("networkaddress.cache.ttl", "30");
        java.security.Security.setProperty("networkaddress.cache.negative.ttl", "5");
    }
}
```

Explain: `forward-headers-strategy` makes redirects and generated links use `https` and the real client address (trust only the VPC range); the **keep-alive timeout above the idle timeout** removes the race that causes sporadic 502s; **graceful shutdown** finishes requests during the draining time, so its timeout must be shorter than the target group's deregistration delay and the ECS stop timeout; the readiness group decides when the task receives traffic and includes only the dependencies the service cannot work without; and a **short JVM DNS cache** lets the application follow a database failover or a Route 53 change. In practice the DNS properties are set before the first lookup, for example with `-Dsun.net.inetaddr.ttl`.

### [coding] Write CloudFormation for an HTTP API in API Gateway with a JWT authorizer, a private ALB integration through a VPC link, and throttling. {#coding-apigw}

```yaml
Resources:
  VpcLink:
    Type: AWS::ApiGatewayV2::VpcLink
    Properties:
      Name: payments-vpc-link
      SubnetIds: [!Ref PrivateSubnetA, !Ref PrivateSubnetB, !Ref PrivateSubnetC]
      SecurityGroupIds: [!Ref VpcLinkSecurityGroup]

  Api:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: payments-api
      ProtocolType: HTTP

  JwtAuthorizer:
    Type: AWS::ApiGatewayV2::Authorizer
    Properties:
      ApiId: !Ref Api
      AuthorizerType: JWT
      Name: cognito-jwt
      IdentitySource: ['$request.header.Authorization']
      JwtConfiguration:
        Issuer: !Sub https://cognito-idp.${AWS::Region}.amazonaws.com/${UserPool}
        Audience: [!Ref UserPoolClient]

  PrivateAlbIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref Api
      IntegrationType: HTTP_PROXY
      IntegrationMethod: ANY
      IntegrationUri: !Ref InternalListener            # the internal ALB listener
      ConnectionType: VPC_LINK
      ConnectionId: !Ref VpcLink
      PayloadFormatVersion: '1.0'
      TimeoutInMillis: 10000                           # fail faster than the 29 second maximum

  PaymentsRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref Api
      RouteKey: 'ANY /payments/{proxy+}'
      AuthorizationType: JWT
      AuthorizerId: !Ref JwtAuthorizer
      AuthorizationScopes: [payments/write]
      Target: !Sub integrations/${PrivateAlbIntegration}

  DefaultStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref Api
      StageName: $default
      AutoDeploy: true
      DefaultRouteSettings:
        ThrottlingRateLimit: 100                       # requests per second
        ThrottlingBurstLimit: 200
      AccessLogSettings:
        DestinationArn: !GetAtt AccessLogGroup.Arn
        Format: '{"requestId":"$context.requestId","status":"$context.status","ip":"$context.identity.sourceIp","route":"$context.routeKey"}'
```

Explain: the **VPC link** lets the API reach an **internal** ALB, so the containers keep private addresses and the ALB is not on the internet; the **JWT authorizer** validates the token's signature, issuer, audience and expiry before any backend call, and the route also requires a scope; the integration timeout is shorter than the 29-second maximum so a slow service fails fast; the stage **throttles** to 100 requests a second with a burst of 200 (per-client limits need a REST API with usage plans); and access logs go to CloudWatch for audit. Add WAF to protect the API, and a custom domain with an ACM certificate in the same region.
