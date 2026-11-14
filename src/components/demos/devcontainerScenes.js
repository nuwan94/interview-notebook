// Frame data for the Dev Containers walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const DEVCONTAINER_SCENES = [
  {
    id: 'open',
    label: 'Reopen in container',
    title: 'The development environment is code in the repository, so everyone gets the same one',
    frames: [
      {
        note: 'The repository contains .devcontainer/devcontainer.json. It declares the base image (or Dockerfile), the tools to add (Java 21, Maven, Node), the editor extensions, forwarded ports and set-up commands. A new developer needs only Docker and a supporting editor.',
        boxes: [b('r', 'Git repository', ['source code', '.devcontainer/devcontainer.json'], 'new'), b('d', 'Developer laptop', ['Docker and an editor, nothing else'], 'ok')],
        deps: [d('Developer laptop', 'Git repository', 'clone', 'ok')],
      },
      {
        note: 'When you choose "Reopen in Container", the tool reads devcontainer.json, pulls or builds the image, applies the Features (small installable add-ons such as Java, Docker CLI, Git) and starts the container with your source folder mounted into it.',
        boxes: [b('t', 'Dev Containers extension', ['reads devcontainer.json'], 'ok'), b('i', 'Image and Features', ['java:21 + maven + git'], 'new'), b('c', 'Dev container', ['/workspaces/payments'], 'ok', 'running')],
        deps: [d('Dev Containers extension', 'Image and Features', 'builds', 'ok'), d('Image and Features', 'Dev container', 'starts', 'ok')],
      },
      {
        note: 'The editor installs a small server inside the container and connects to it. Language servers, the debugger, the terminal and the extensions you listed all run in the container, so the code is compiled and run with the container\'s JDK and tools, while the window stays on your laptop.',
        boxes: [b('u', 'Editor window', ['on your laptop'], 'new'), b('s', 'Editor server', ['inside the container'], 'ok'), b('j', 'JDK 21 and Maven', ['the same for every developer'], 'ok'), b('x', 'Extensions', ['Java, Spring, YAML'], 'ok')],
        deps: [d('Editor window', 'Editor server', 'remote connection', 'ok'), d('Editor server', 'JDK 21 and Maven', 'uses', 'ok'), d('Editor server', 'Extensions', 'runs', 'ok')],
      },
      {
        note: 'Your source files live in a bind mount of the local folder, or in a Docker volume (faster on Windows and macOS). Because the toolchain is in the container, nothing needs to be installed on the host, and a broken environment is fixed by rebuilding the container.',
        boxes: [b('w', 'Workspace folder', ['bind mount or volume'], 'ok'), b('c', 'Dev container', ['tools, not data'], 'ok'), b('r', 'Rebuild container', ['clean environment in a minute'], 'new')],
        deps: [d('Dev container', 'Workspace folder', 'mounts', 'ok'), d('Rebuild container', 'Dev container', 'recreates', 'new')],
      },
    ],
  },
  {
    id: 'config',
    label: 'devcontainer.json and lifecycle',
    title: 'One file, a few building blocks, and commands that run in a fixed order',
    frames: [
      {
        note: 'The base is an image (for example mcr.microsoft.com/devcontainers/java:21), or a build section pointing at your own Dockerfile, or a Docker Compose file whose service becomes the dev container. Teams usually start from a prebuilt image and add Features.',
        boxes: [b('j', 'devcontainer.json', ['name, image or build', 'features, customizations'], 'new'), b('a', 'image', ['prebuilt base'], 'ok'), b('b', 'build (Dockerfile)', ['custom base'], 'ok'), b('c', 'dockerComposeFile', ['dev container plus services'], 'ok')],
        deps: [d('devcontainer.json', 'image', 'option 1', 'ok'), d('devcontainer.json', 'build (Dockerfile)', 'option 2', 'ok'), d('devcontainer.json', 'dockerComposeFile', 'option 3', 'ok')],
      },
      {
        note: 'Features are reusable units published to a registry (ghcr.io/devcontainers/features/java, node, docker-in-docker, azure-cli). Each has options such as the version, and they install on top of the image in a defined order. This keeps your own Dockerfile small.',
        boxes: [b('f', 'features', ['java: 21', 'maven: 3.9', 'docker-in-docker'], 'new'), b('r', 'Feature registry', ['ghcr.io/devcontainers/features'], 'ok'), b('i', 'Dev container image', ['base plus installed features'], 'ok')],
        deps: [d('features', 'Feature registry', 'pulled from', 'ok'), d('Feature registry', 'Dev container image', 'installed into', 'ok')],
      },
      {
        note: 'Lifecycle commands run at fixed moments: initializeCommand on the host before anything, then onCreateCommand, updateContentCommand and postCreateCommand once inside the new container (for example pre-download Maven dependencies), then postStartCommand every start and postAttachCommand each time the editor attaches.',
        boxes: [b('1', 'initializeCommand', ['on the host'], 'warn'), b('2', 'onCreateCommand', ['first creation'], 'ok'), b('3', 'postCreateCommand', ['mvn dependency:go-offline'], 'ok'), b('4', 'postStartCommand', ['every start'], 'ok')],
        deps: [d('initializeCommand', 'onCreateCommand', 'then', 'ok'), d('onCreateCommand', 'postCreateCommand', 'then', 'ok'), d('postCreateCommand', 'postStartCommand', 'then', 'ok')],
      },
      {
        note: 'Customizations are tool specific: the list of VS Code extensions and settings to install, or JetBrains IDE settings. forwardPorts makes container ports (8080, 5005) available on localhost. remoteUser and containerEnv set who you are and which variables exist inside.',
        boxes: [b('c', 'customizations', ['extensions, settings'], 'ok'), b('p', 'forwardPorts', ['8080, 5005'], 'ok'), b('u', 'remoteUser', ['vscode, not root'], 'ok'), b('e', 'containerEnv', ['SPRING_PROFILES_ACTIVE=dev'], 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'services',
    label: 'With services and teams',
    title: 'Add a database through Compose, prebuild the image, and mind the security trade-offs',
    frames: [
      {
        note: 'With dockerComposeFile, the dev container is one Compose service and the database, Redis or Kafka are others on the same network. The code in the dev container reaches Postgres at db:5432, exactly as it will in production-like environments.',
        boxes: [b('d', 'Service app (dev container)', ['JDK, Maven, your code'], 'new'), b('p', 'Service db', ['postgres:16'], 'ok'), b('r', 'Service redis', ['redis:7'], 'ok'), b('n', 'Compose network', ['DNS by service name'], 'ok')],
        deps: [d('Service app (dev container)', 'Service db', 'db:5432', 'ok'), d('Service app (dev container)', 'Service redis', 'redis:6379', 'ok')],
      },
      {
        note: 'Building features and installing dependencies can take minutes. Prebuilding runs the build in CI (devcontainer build, or GitHub Codespaces prebuilds), publishes the resulting image to a registry, and devcontainer.json then just references it, so opening the project takes seconds.',
        boxes: [b('c', 'CI pipeline', ['devcontainer build'], 'new'), b('r', 'Container registry', ['bank/payments-devcontainer:1.4'], 'ok'), b('d', 'Developer', ['reopens in seconds'], 'ok')],
        deps: [d('CI pipeline', 'Container registry', 'pushes', 'ok'), d('Developer', 'Container registry', 'pulls', 'ok')],
      },
      {
        note: 'Running Docker from inside the dev container needs a choice. Docker-in-Docker starts a separate daemon inside (isolated, but needs privileged mode). Docker-outside-of-Docker mounts the host socket (simple and fast, but the container can then control the host\'s Docker, which is root-equivalent).',
        boxes: [b('a', 'docker-in-docker', ['own daemon, privileged'], 'warn'), b('b', 'docker-outside-of-docker', ['mounts the host socket'], 'bad', 'host access'), b('t', 'Testcontainers', ['needs one of the two'], 'ok')],
        deps: [d('Testcontainers', 'docker-in-docker', 'option', 'warn'), d('Testcontainers', 'docker-outside-of-docker', 'option', 'bad')],
      },
      {
        note: 'A dev container is a real container with your source code and credentials. Opening an untrusted repository can run its lifecycle commands, so trust is explicit. Use a non-root user, avoid mounting sensitive host folders, pull base images from your internal registry, and keep real secrets out of the file.',
        boxes: [b('t', 'Workspace trust', ['do not open unknown repos blindly'], 'warn'), b('u', 'Non-root user', ['least privilege'], 'ok'), b('s', 'Secrets', ['not in devcontainer.json'], 'ok'), b('i', 'Internal registry', ['approved base images'], 'ok')],
        deps: [],
      },
    ],
  },
];
