import { LuBlocks, LuBookOpen, LuGitBranch, LuCoffee, LuContainer, LuDatabase, LuLeaf, LuNetwork, LuShieldCheck } from 'react-icons/lu';

// Home-page card details for the top-level topics (the `topic:` front matter of lessons, first part).
// Sub-topics get a generated summary from their lesson titles. Unknown topics fall back to a generic icon.
const TOPICS = {
  Fundamentals: { image: 'fundamentals', icon: LuBlocks, blurb: 'Object-oriented design, SOLID and design patterns, plus data structures, sorting, searching and the coding interview patterns: the vocabulary every interview starts with.' },
  Java: { image: 'java', icon: LuCoffee, blurb: 'The language and platform: strings, exceptions, generics, collections, streams, the JVM and garbage collection, troubleshooting a running JVM, concurrency, build tools.' },
  Databases: { image: 'databases', icon: LuDatabase, blurb: 'SQL and NoSQL, normalisation, ACID and BASE, transactions and caching with Redis.' },
  Security: { image: 'security', icon: LuShieldCheck, blurb: 'Cryptography, authentication and authorisation, OAuth 2.0, OpenID Connect and JWT.' },
  Microservices: { image: 'microservices', icon: LuNetwork, blurb: 'Distributed systems, decomposition and migration, communication, resilience, state, sagas, event sourcing and messaging.' },
  Containers: { image: 'containers', icon: LuContainer, blurb: 'Docker, Compose, Dev Containers, Kubernetes, local clusters (minikube, kind) and OpenShift.' },
  'CI/CD': { image: 'cicd', icon: LuGitBranch, blurb: 'Pipelines from commit to production, quality gates, branching, deployment strategies and release management.' },
  Spring: { image: 'spring', icon: LuLeaf, blurb: 'Spring Core, Boot, MVC, Data, Security, testing, caching, observability, Cloud and messaging.' },
};

export const topicIcon = (node) => TOPICS[node.path.split(' / ')[0]]?.icon || LuBookOpen;
/** Illustration for a top-level topic card (files in public/images/topics), or '' for sub-topics and unknown topics. */
export const topicImage = (node) => (node.path.includes(' / ') ? '' : TOPICS[node.name]?.image || '');
export const topicBlurb = (node) => TOPICS[node.name]?.blurb || '';
