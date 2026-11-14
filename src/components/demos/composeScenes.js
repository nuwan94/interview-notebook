// Frame data for the Docker Compose walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const COMPOSE_SCENES = [
  {
    id: 'up',
    label: 'docker compose up',
    title: 'One file describes the whole application; one command creates it',
    frames: [
      {
        note: 'compose.yaml lists the services (app, db, cache), the images or build contexts, ports, environment, volumes and dependencies. It is the single description of the local environment, kept in Git next to the code.',
        boxes: [b('f', 'compose.yaml', ['services: app, db, redis', 'volumes, networks'], 'new'), b('c', 'docker compose up', ['read the file, create everything'], 'ok')],
        deps: [d('compose.yaml', 'docker compose up', 'input', 'ok')],
      },
      {
        note: 'Compose first creates a private network for the project and any named volumes. Every service joins the network and is reachable by its service name, so the app connects to db:5432, not localhost.',
        boxes: [b('c', 'docker compose up', ['project name: bank'], 'ok'), b('n', 'Network bank_default', ['DNS by service name'], 'new'), b('v', 'Volume pgdata', ['database files survive restarts'], 'new')],
        deps: [d('docker compose up', 'Network bank_default', 'creates', 'ok'), d('docker compose up', 'Volume pgdata', 'creates', 'ok')],
      },
      {
        note: 'Containers start in dependency order. depends_on with condition: service_healthy makes the app wait until the database healthcheck passes; without a condition it only waits for the container to start, not for Postgres to accept connections.',
        boxes: [b('d', 'Service db', ['postgres:16', 'healthcheck: pg_isready'], 'ok', 'healthy'), b('a', 'Service app', ['waits for db healthy'], 'ok'), b('r', 'Service redis', ['redis:7'], 'ok')],
        deps: [d('Service app', 'Service db', 'depends_on healthy', 'ok'), d('Service app', 'Service redis', 'depends_on started', 'ok')],
      },
      {
        note: 'Only published ports reach your machine: ports: "8080:8080" maps host port 8080 to the app. The database port stays private to the network unless you publish it deliberately for a local tool.',
        boxes: [b('h', 'Your browser', ['localhost:8080'], 'new'), b('a', 'Service app', ['published 8080'], 'ok'), b('d', 'Service db', ['5432 private'], 'ok')],
        deps: [d('Your browser', 'Service app', 'published port', 'ok'), d('Service app', 'Service db', 'db:5432', 'ok')],
      },
    ],
  },
  {
    id: 'dev',
    label: 'Development workflow',
    title: 'Compose is for local development and small deployments, not for running a cluster',
    frames: [
      {
        note: 'Day to day you use a few commands: up -d (start in the background), logs -f, ps, exec to open a shell, down to stop and remove containers and the network, and down -v to remove volumes too (this deletes database data).',
        boxes: [b('u', 'up -d', ['start in background'], 'ok'), b('l', 'logs -f app', ['follow output'], 'ok'), b('x', 'down', ['remove containers, network'], 'warn'), b('v', 'down -v', ['also deletes volumes'], 'bad', 'data loss')],
        deps: [],
      },
      {
        note: 'Environment-specific settings go in layers: compose.yaml is the base, compose.override.yaml is merged automatically for local development, and -f compose.prod.yaml adds another layer. Secrets and passwords come from an .env file that is not committed, or from Compose secrets.',
        boxes: [b('b', 'compose.yaml', ['base services'], 'ok'), b('o', 'compose.override.yaml', ['dev ports, bind mounts'], 'new', 'auto-merged'), b('e', '.env file', ['values, not in Git'], 'warn')],
        deps: [d('compose.override.yaml', 'compose.yaml', 'merged over', 'ok'), d('.env file', 'compose.yaml', 'substituted', 'warn')],
      },
      {
        note: 'Profiles switch optional services on and off (for example a debug UI or a Kafka stack), and develop.watch (docker compose watch) syncs changed source files or rebuilds the image while you edit, so the container follows your code.',
        boxes: [b('p', 'Profile debug', ['pgadmin, kafka-ui'], 'new'), b('w', 'compose watch', ['sync or rebuild on change'], 'ok'), b('a', 'Service app', ['updated container'], 'ok')],
        deps: [d('compose watch', 'Service app', 'syncs files', 'ok')],
      },
      {
        note: 'Compose runs on one Docker host with no self-healing across machines, no rolling updates and no scheduling. For production, or when you need several nodes, use Kubernetes; Compose files can even be converted to Kubernetes manifests as a starting point.',
        boxes: [b('c', 'Docker Compose', ['one host', 'local dev, tests, demos'], 'ok'), b('k', 'Kubernetes', ['many nodes', 'self-healing, rolling updates'], 'new', 'production')],
        deps: [d('Docker Compose', 'Kubernetes', 'grow into', 'new')],
      },
    ],
  },
];
