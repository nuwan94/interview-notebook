import { LuBlocks, LuBookOpen, LuCoffee, LuContainer, LuDatabase, LuLeaf, LuNetwork, LuShieldCheck } from 'react-icons/lu';

// Home-page card details for the top-level topics (the `topic:` front matter of lessons, first part).
// Sub-topics get a generated summary from their lesson titles. Unknown topics fall back to a generic icon.
const TOPICS = {
  Fundamentals: { icon: LuBlocks, blurb: 'Object-oriented design, SOLID and the classic design patterns: the vocabulary every interview starts with.' },
  Java: { icon: LuCoffee, blurb: 'The language and platform: strings, generics, collections, streams, the JVM and garbage collection, concurrency.' },
  Databases: { icon: LuDatabase, blurb: 'SQL and NoSQL, normalisation, ACID and BASE, transactions and caching with Redis.' },
  Security: { icon: LuShieldCheck, blurb: 'Cryptography, authentication and authorisation, OAuth 2.0, OpenID Connect and JWT.' },
  Microservices: { icon: LuNetwork, blurb: 'Distributed systems, decomposition and migration, communication, resilience, state, sagas, event sourcing and messaging.' },
  Containers: { icon: LuContainer, blurb: 'Docker, Compose, Dev Containers, Kubernetes, local clusters (minikube, kind) and OpenShift.' },
  Spring: { icon: LuLeaf, blurb: 'Spring Core, Boot, MVC, Data, Security, testing, caching, observability, Cloud and messaging.' },
};

export const topicIcon = (node) => TOPICS[node.path.split('/')[0]]?.icon || LuBookOpen;
export const topicBlurb = (node) => TOPICS[node.name]?.blurb || '';
