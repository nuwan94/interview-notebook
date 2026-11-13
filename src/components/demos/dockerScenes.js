// Frame data for the Docker walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const DOCKER_SCENES = [
  {
    id: 'layers',
    label: 'Image layers and cache',
    title: 'An image is a stack of read-only layers, and Docker rebuilds only from the first changed line',
    frames: [
      {
        note: 'Every instruction in a Dockerfile that changes the file system (FROM, RUN, COPY) creates a read-only layer. The image is the stack of those layers, identified by hashes. Layers are shared between images, so ten services on the same base image store the base once.',
        boxes: [b('a', 'Layer 1: FROM eclipse-temurin:21-jre', ['base OS and JRE'], 'none', 'shared'), b('b', 'Layer 2: COPY app.jar', ['your application'], 'new'), b('c', 'Image', ['layer 1 + layer 2', 'read-only'], 'ok')],
        deps: [d('Layer 1: FROM eclipse-temurin:21-jre', 'Image', 'bottom', 'ok'), d('Layer 2: COPY app.jar', 'Image', 'top', 'ok')],
      },
      {
        note: 'Docker caches each layer. When you rebuild, it reuses every layer up to the first instruction whose inputs changed, and re-runs everything after it. A one-line code change is cheap if the expensive steps are above it.',
        boxes: [b('a', 'COPY pom.xml', ['unchanged: cached'], 'ok', 'cache hit'), b('b', 'RUN mvn dependency:go-offline', ['unchanged: cached', 'saves minutes'], 'ok', 'cache hit'), b('c', 'COPY src ./src', ['changed: rebuilt'], 'warn', 'rebuilt'), b('d', 'RUN mvn package', ['runs again'], 'warn', 'rebuilt')],
        deps: [d('COPY pom.xml', 'RUN mvn dependency:go-offline', 'next', 'ok'), d('COPY src ./src', 'RUN mvn package', 'next', 'warn')],
      },
      {
        note: 'The classic mistake is copying the whole project first with COPY . . and then installing dependencies. Any source edit invalidates that layer and everything below, so dependencies are downloaded again on every build. Copy the dependency descriptor first, install, then copy the source.',
        boxes: [b('a', 'COPY . .', ['any file changed: miss'], 'bad', 'bad order'), b('b', 'RUN mvn package', ['downloads all dependencies again'], 'bad', 'slow'), b('c', 'COPY pom.xml then source', ['dependencies cached', 'only your code rebuilds'], 'ok', 'good order')],
        deps: [d('COPY . .', 'RUN mvn package', 'invalidates', 'bad')],
      },
      {
        note: 'A .dockerignore file keeps target/, .git and local secrets out of the build context, so the context sent to the daemon is small and a changed log file does not bust the cache.',
        boxes: [b('a', 'Build context', ['everything in the folder', 'sent to the Docker daemon'], 'warn'), b('b', '.dockerignore', ['target/', '.git', '.env', '*.log'], 'ok', 'excluded')],
        deps: [d('.dockerignore', 'Build context', 'filters', 'ok')],
      },
    ],
  },
  {
    id: 'run',
    label: 'Image vs container',
    title: 'A container is an image plus a thin writable layer and one running process',
    frames: [
      {
        note: 'docker run creates a container from an image. It adds a thin writable layer on top of the read-only image layers, then starts the one main process (PID 1). Many containers can start from the same image.',
        boxes: [b('i', 'Image', ['read-only layers'], 'ok'), b('c1', 'Container A', ['writable layer', 'process: java -jar app.jar'], 'new'), b('c2', 'Container B', ['writable layer', 'process: java -jar app.jar'], 'new')],
        deps: [d('Image', 'Container A', 'docker run', 'ok'), d('Image', 'Container B', 'docker run', 'ok')],
      },
      {
        note: 'Files the container writes go into its writable layer using copy-on-write. When the container is removed, that layer is gone. Never keep database files or uploads there.',
        boxes: [b('c', 'Container', ['writes /data/ledger.db', 'goes to writable layer'], 'warn'), b('x', 'docker rm', ['container removed'], 'bad'), b('l', 'Lost data', ['writable layer deleted'], 'bad', 'ephemeral')],
        deps: [d('docker rm', 'Lost data', 'deletes', 'bad')],
      },
      {
        note: 'A volume is storage managed by Docker outside the container file system. It survives container removal and can be mounted into a new container. A bind mount maps a host folder instead, handy for local development.',
        boxes: [b('v', 'Volume pgdata', ['managed by Docker', 'survives docker rm'], 'ok', 'persistent'), b('c1', 'Container (old)', ['removed'], 'none'), b('c2', 'Container (new)', ['-v pgdata:/var/lib/postgresql/data', 'finds the same data'], 'ok')],
        deps: [d('Container (new)', 'Volume pgdata', 'mounts', 'ok')],
      },
      {
        note: 'Stopping sends SIGTERM to PID 1 and, after a grace period (10 s by default), SIGKILL. A Java process started through a shell wrapper may never receive SIGTERM, so use the exec form of CMD so the JVM is PID 1 and shuts down gracefully.',
        boxes: [b('a', 'CMD java -jar app.jar', ['shell form: sh is PID 1', 'signal may not reach the JVM'], 'bad'), b('b', 'CMD ["java", "-jar", "app.jar"]', ['exec form: JVM is PID 1', 'receives SIGTERM, shuts down cleanly'], 'ok', 'preferred')],
        deps: [],
      },
    ],
  },
  {
    id: 'network',
    label: 'Networking and Compose',
    title: 'Containers on the same network reach each other by service name',
    frames: [
      {
        note: 'A container has its own network namespace and a private IP. To reach it from outside you publish a port: -p 8080:8080 maps host port 8080 to container port 8080. Without -p nothing outside the Docker host can connect.',
        boxes: [b('c', 'Client', ['curl localhost:8080'], 'new'), b('h', 'Docker host', ['port 8080 published'], 'ok'), b('a', 'Container app', ['listens on 8080', 'private IP 172.18.0.2'], 'ok')],
        deps: [d('Client', 'Docker host', '8080', 'ok'), d('Docker host', 'Container app', 'port mapping', 'ok')],
      },
      {
        note: 'On a user-defined network (and in Docker Compose) Docker runs an internal DNS. The app reaches the database with the host name db, the Compose service name, instead of an IP address. localhost inside a container means the container itself, a very common mistake.',
        boxes: [b('a', 'Container app', ['jdbc:postgresql://db:5432/bank'], 'new'), b('d', 'Container db', ['service name: db', 'port 5432, not published'], 'ok'), b('x', 'jdbc:postgresql://localhost:5432', ['localhost = the app container itself', 'connection refused'], 'bad', 'wrong')],
        deps: [d('Container app', 'Container db', 'DNS name db', 'ok')],
      },
      {
        note: 'Docker Compose describes several containers in one YAML file: services, networks, volumes, environment. One command, docker compose up, builds and starts the whole local stack.',
        boxes: [b('f', 'compose.yaml', ['services: app, db, redis', 'volumes: pgdata'], 'new'), b('a', 'app', ['depends_on: db (healthy)'], 'ok'), b('d', 'db', ['postgres:16', 'healthcheck: pg_isready'], 'ok'), b('r', 'redis', ['redis:7'], 'ok')],
        deps: [d('compose.yaml', 'app', 'defines', 'ok'), d('compose.yaml', 'db', 'defines', 'ok'), d('compose.yaml', 'redis', 'defines', 'ok')],
      },
      {
        note: 'depends_on only controls start order. A database container can be started but not yet ready to accept connections. Use a healthcheck with depends_on condition service_healthy, or make the application retry its connection on startup.',
        boxes: [b('a', 'depends_on: db', ['db container started'], 'warn', 'not enough'), b('b', 'Postgres', ['still initialising', 'refuses connections'], 'warn'), b('c', 'condition: service_healthy', ['waits for the healthcheck'], 'ok', 'correct')],
        deps: [],
      },
    ],
  },
  {
    id: 'multistage',
    label: 'Multi-stage builds',
    title: 'Build with a full JDK and Maven, ship only the JRE and the jar',
    frames: [
      {
        note: 'A single-stage image that builds the app contains the JDK, Maven, the source code and the downloaded dependencies. It is large, slower to pull and has a bigger attack surface, and it may leak source or credentials.',
        boxes: [b('s', 'Single-stage image', ['JDK + Maven + source', '~700 MB'], 'bad', 'large')],
        deps: [],
      },
      {
        note: 'A multi-stage Dockerfile uses several FROM lines. The first stage builds the jar with the JDK and Maven. The second stage starts from a small JRE image and copies only the jar from the first stage with COPY --from=build.',
        boxes: [b('b', 'Stage 1: build', ['FROM maven:3-eclipse-temurin-21', 'RUN mvn package'], 'new'), b('r', 'Stage 2: runtime', ['FROM eclipse-temurin:21-jre', 'COPY --from=build app.jar'], 'ok'), b('j', 'app.jar', ['the only artefact carried over'], 'ok')],
        deps: [d('Stage 1: build', 'app.jar', 'produces', 'ok'), d('app.jar', 'Stage 2: runtime', 'COPY --from', 'ok')],
      },
      {
        note: 'The final image holds only the JRE, the jar and your configuration, typically 150 to 250 MB. The build stage is discarded. Add a non-root USER, a HEALTHCHECK if you do not rely on Kubernetes probes, and the exec-form ENTRYPOINT.',
        boxes: [b('i', 'Final image', ['JRE + app.jar', '~200 MB'], 'ok', 'small'), b('u', 'USER app', ['not root'], 'ok'), b('e', 'ENTRYPOINT exec form', ['JVM is PID 1'], 'ok')],
        deps: [],
      },
      {
        note: 'Spring Boot offers shortcuts: a layered jar (extract layers so dependencies are cached separately from your code), mvn spring-boot:build-image which uses Cloud Native Buildpacks and needs no Dockerfile, and Jib, which builds an optimised image without a Docker daemon.',
        boxes: [b('l', 'Layered jar', ['dependencies layer: rarely changes', 'application layer: changes often'], 'ok'), b('p', 'Buildpacks', ['spring-boot:build-image'], 'ok'), b('j', 'Jib', ['no Docker daemon needed'], 'ok')],
        deps: [],
      },
    ],
  },
];
