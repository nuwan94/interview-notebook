import { useLayoutEffect, useRef, useState } from 'react';
import { DemoControls, DemoHeader } from './DemoShell.jsx';
import { iconFor } from './icons.jsx';
import { GraphStage } from './GraphStage.jsx';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { SOLID_SCENES, PATTERN_SCENES } from './designScenes.js';
import { CRYPTO_SCENES } from './cryptoScenes.js';
import { AUTH_SCENES } from './authScenes.js';
import { OAUTH_SCENES } from './oauthScenes.js';
import { OIDC_SCENES } from './oidcScenes.js';
import { JWT_SCENES } from './jwtScenes.js';
import { SECURITY_SCENES } from './securityScenes.js';
import { MICROSERVICE_SCENES } from './microserviceScenes.js';
import { SAGA_SCENES } from './sagaScenes.js';
import { SCHEDULER_SCENES } from './schedulerScenes.js';
import { MESSAGING_SCENES } from './messagingScenes.js';
import { DISTRIBUTED_SCENES } from './distributedScenes.js';
import { ACID_SCENES } from './acidScenes.js';
import { SQLNOSQL_SCENES } from './sqlNosqlScenes.js';
import { COMMUNICATION_SCENES } from './communicationScenes.js';
import { RESILIENCE_SCENES } from './resilienceScenes.js';
import { DECOMPOSITION_SCENES } from './decompositionScenes.js';
import { EVENT_SOURCING_SCENES } from './eventSourcingScenes.js';
import { MICROSERVICE_STATE_SCENES } from './microserviceStateScenes.js';
import { DEVCONTAINER_SCENES } from './devcontainerScenes.js';
import { MINIKUBE_SCENES } from './minikubeScenes.js';
import { KIND_SCENES } from './kindScenes.js';
import { COMPOSE_SCENES } from './composeScenes.js';
import { OPENSHIFT_SCENES } from './openshiftScenes.js';
import { SPRING_MAP_SCENES } from './springMapScenes.js';
import { REDIS_SCENES } from './redisScenes.js';
import { JAVA_GENERICS_SCENES } from './javaGenericsScenes.js';
import { JAVA_STRINGS_SCENES } from './javaStringsScenes.js';
import { KUBERNETES_SCENES } from './kubernetesScenes.js';
import { DOCKER_SCENES } from './dockerScenes.js';
import { JAVA_CONCURRENT_COLLECTIONS_SCENES } from './javaConcurrentCollectionsScenes.js';
import { JAVA_STREAMS_SCENES } from './javaStreamsScenes.js';
import { JAVA_FUNCTIONAL_SCENES } from './javaFunctionalScenes.js';
import { JAVA_COLLECTIONS_SCENES } from './javaCollectionsScenes.js';
import { SPRING_BOOT3_SCENES } from './springBoot3Scenes.js';
import { SPRING_REACTIVE_SCENES } from './springReactiveScenes.js';
import { SPRING_MSG_SCENES } from './springMsgScenes.js';
import { SPRING_OBS_SCENES } from './springObsScenes.js';
import { SPRING_ASYNC_SCENES } from './springAsyncScenes.js';
import { REST_API_SCENES } from './restApiScenes.js';
import { SPRING_TESTING_SCENES } from './springTestingScenes.js';
import { SPRING_CLOUD_SCENES } from './springCloudScenes.js';
import { SPRING_TX_SCENES } from './springTxScenes.js';
import { SPRING_MVC_SCENES } from './springMvcScenes.js';
import { SPRING_JPA_SCENES } from './springJpaScenes.js';
import { SPRING_AOP_SCENES } from './springAopScenes.js';
import { SPRING_BOOT_SCENES } from './springBootScenes.js';
import { SPRING_CORE_SCENES } from './springCoreScenes.js';

const TONE = {
  ok: { border: '2px solid var(--color-ok)', background: 'var(--color-ok-soft)', badge: 'var(--color-ok)' },
  bad: { border: '2px solid var(--color-bad)', background: 'var(--color-bad-soft)', badge: 'var(--color-bad)' },
  warn: { border: '2px solid var(--color-warn)', background: 'var(--color-warn-soft)', badge: 'var(--color-warn)' },
  new: { border: '2px solid var(--color-pen)', background: 'var(--color-pen-soft)', badge: 'var(--color-pen)' },
  none: { border: '2px solid #b9c7d9', background: '#fff', badge: '#556070' },
};
const DEP_COLOR = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', none: 'var(--color-soft)' };


function Avatar({ name, tone = 'none', size = 'md' }) {
  const t = TONE[tone] || TONE.none;
  const icon = iconFor(name);
  if (!icon) return <span className="font-mono text-xs font-bold">{name}</span>;
  return (
    <span className="inline-flex flex-col items-center gap-0.5 min-w-[3.5rem] text-center">
      <span className={`walk-avatar ${size === 'sm' ? 'walk-avatar-sm' : ''}`} style={{ borderColor: t.badge, background: t.background }} aria-hidden="true">
        {icon}
      </span>
      <span className="font-mono text-[0.65rem] font-bold leading-tight">{name}</span>
    </span>
  );
}

export function Walk({ scenes, ariaLabel, icons = false, graph = false }) {
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const [sceneId, setSceneId] = useState(scenes[0].id);
  const scene = scenes.find((x) => x.id === sceneId);
  const p = usePlayer(scene.frames, { speed: 1 });
  const f = scene.frames[p.index];

  // keep the ruled lines of the page registered with the text after the figure
  useLayoutEffect(() => {
    const el = rootRef.current;
    const fit = () => {
      const lh = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2;
      el.style.marginBottom = '0px';
      const h = el.getBoundingClientRect().height;
      el.style.marginBottom = `${lh + Math.ceil(h / lh) * lh - h}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useOnceVisible(rootRef, () => p.play(), !reduced);

  const pick = (id) => {
    setSceneId(id);
    p.seek(0);
  };

  return (
    <figure ref={rootRef} className="demo" data-noread aria-label={ariaLabel}>
      <DemoHeader title={scene.title} scenes={scenes} sceneId={sceneId} onPick={pick} />

      {graph ? (
        <GraphStage key={scene.id} frames={scene.frames} index={p.index} reduced={reduced} label={ariaLabel} />
      ) : (
        <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {f.boxes.map((bx) => {
          const t = TONE[bx.tone || 'none'];
          const icon = icons ? iconFor(bx.title) : null;
          if (icon) {
            return (
              <div key={bx.id} className="walk-actor rounded-md px-2 py-1.5 flex items-start gap-2" style={{ border: t.border, background: t.background }}>
                <span className="walk-avatar" style={{ borderColor: t.badge, background: '#fff' }} aria-hidden="true">
                  {icon}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-sm font-bold">{bx.title}</span>
                    {bx.badge && (
                      <span className="rounded-full px-2 text-[0.62rem] font-bold tracking-wide text-white" style={{ background: t.badge }}>
                        {bx.badge}
                      </span>
                    )}
                  </div>
                  {bx.lines.map((ln) => (
                    <div key={ln} className="text-xs font-mono text-soft">
                      {ln}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div key={bx.id} className="rounded-md px-2 py-1.5" style={{ border: t.border, background: t.background }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold">{bx.title}</span>
                {bx.badge && (
                  <span className="rounded-full px-2 text-[0.62rem] font-bold tracking-wide text-white" style={{ background: t.badge }}>
                    {bx.badge}
                  </span>
                )}
              </div>
              {bx.lines.map((ln) => (
                <div key={ln} className="text-xs font-mono text-soft">
                  {ln}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-2 min-h-[1.5rem] flex flex-col gap-1" aria-label="Dependencies">
        {f.deps.map((dp) =>
          icons ? (
            <div key={`${dp.from}-${dp.to}-${dp.label}`} className="walk-flow">
              <Avatar name={dp.from} tone={dp.tone || 'none'} size="sm" />
              <span className="walk-arrow" style={{ '--arrow': DEP_COLOR[dp.tone || 'none'] }}>
                <span className="walk-arrow-label">{dp.label}</span>
                <span className="walk-arrow-line" aria-hidden="true" />
              </span>
              <Avatar name={dp.to} tone={dp.tone || 'none'} size="sm" />
            </div>
          ) : (
          <div key={`${dp.from}-${dp.to}-${dp.label}`} className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="font-bold">{dp.from}</span>
            <span className="font-bold" style={{ color: DEP_COLOR[dp.tone || 'none'] }}>
              ──{dp.label}──▶
            </span>
            <span className="font-bold">{dp.to}</span>
          </div>
          ),
        )}
      </div>
        </>
      )}

      <div className="mt-2 rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[5rem] text-[0.95rem] leading-snug" role="status" aria-live="polite">
        <Glossed text={f.note} />
      </div>
      <DemoControls p={p} speeds />
    </figure>
  );
}

export const SolidWalk = () => <Walk scenes={SOLID_SCENES} icons graph ariaLabel="SOLID principles walk-through" />;
export const PatternsWalk = () => <Walk scenes={PATTERN_SCENES} icons graph ariaLabel="Design patterns walk-through" />;
export const CryptoWalk = () => <Walk scenes={CRYPTO_SCENES} icons graph ariaLabel="Encryption walk-through" />;
export const AuthWalk = () => <Walk scenes={AUTH_SCENES} icons graph ariaLabel="Authentication walk-through" />;
export const OauthWalk = () => <Walk scenes={OAUTH_SCENES} icons graph ariaLabel="OAuth 2.0 walk-through" />;
export const OidcWalk = () => <Walk scenes={OIDC_SCENES} icons graph ariaLabel="OpenID Connect walk-through" />;
export const JwtWalk = () => <Walk scenes={JWT_SCENES} icons graph ariaLabel="JWT walk-through" />;
export const SecurityWalk = () => <Walk scenes={SECURITY_SCENES} icons graph ariaLabel="Spring Security filter chain walk-through" />;
export const MicroserviceWalk = () => <Walk scenes={MICROSERVICE_SCENES} icons graph ariaLabel="Microservice patterns walk-through" />;
export const SagaWalk = () => <Walk scenes={SAGA_SCENES} icons graph ariaLabel="Saga pattern walk-through" />;
export const SchedulerWalk = () => <Walk scenes={SCHEDULER_SCENES} icons graph ariaLabel="Distributed scheduler walk-through" />;
export const MessagingWalk = () => <Walk scenes={MESSAGING_SCENES} icons graph ariaLabel="Messaging walk-through" />;
export const DistributedWalk = () => <Walk scenes={DISTRIBUTED_SCENES} icons graph ariaLabel="Distributed systems walk-through" />;
export const AcidWalk = () => <Walk scenes={ACID_SCENES} icons graph ariaLabel="ACID and BASE walk-through" />;
export const SqlNosqlWalk = () => <Walk scenes={SQLNOSQL_SCENES} icons graph ariaLabel="SQL vs NoSQL walk-through" />;
export const SpringCoreWalk = () => <Walk scenes={SPRING_CORE_SCENES} icons graph ariaLabel="Spring core walk-through" />;
export const SpringBootWalk = () => <Walk scenes={SPRING_BOOT_SCENES} icons graph ariaLabel="Spring Boot walk-through" />;
export const SpringAopWalk = () => <Walk scenes={SPRING_AOP_SCENES} icons graph ariaLabel="Spring AOP walk-through" />;
export const SpringJpaWalk = () => <Walk scenes={SPRING_JPA_SCENES} icons graph ariaLabel="Spring Data JPA walk-through" />;
export const SpringMvcWalk = () => <Walk scenes={SPRING_MVC_SCENES} icons graph ariaLabel="Spring MVC walk-through" />;
export const SpringTxWalk = () => <Walk scenes={SPRING_TX_SCENES} icons graph ariaLabel="Spring transactions walk-through" />;
export const SpringCloudWalk = () => <Walk scenes={SPRING_CLOUD_SCENES} icons graph ariaLabel="Spring Cloud walk-through" />;
export const SpringTestingWalk = () => <Walk scenes={SPRING_TESTING_SCENES} icons graph ariaLabel="Spring testing walk-through" />;
export const RestApiWalk = () => <Walk scenes={REST_API_SCENES} icons graph ariaLabel="REST API design walk-through" />;
export const SpringAsyncWalk = () => <Walk scenes={SPRING_ASYNC_SCENES} icons graph ariaLabel="Caching and async walk-through" />;
export const SpringObsWalk = () => <Walk scenes={SPRING_OBS_SCENES} icons graph ariaLabel="Observability walk-through" />;
export const SpringMsgWalk = () => <Walk scenes={SPRING_MSG_SCENES} icons graph ariaLabel="Spring messaging walk-through" />;
export const SpringReactiveWalk = () => <Walk scenes={SPRING_REACTIVE_SCENES} icons graph ariaLabel="Reactive and virtual threads walk-through" />;
export const SpringBoot3Walk = () => <Walk scenes={SPRING_BOOT3_SCENES} icons graph ariaLabel="Spring Boot 3 walk-through" />;
export const JavaCollectionsWalk = () => <Walk scenes={JAVA_COLLECTIONS_SCENES} icons graph ariaLabel="Java collections walk-through" />;
export const JavaFunctionalWalk = () => <Walk scenes={JAVA_FUNCTIONAL_SCENES} icons graph ariaLabel="Lambdas and Optional walk-through" />;
export const JavaStreamsWalk = () => <Walk scenes={JAVA_STREAMS_SCENES} icons graph ariaLabel="Java streams walk-through" />;
export const JavaConcurrentCollectionsWalk = () => <Walk scenes={JAVA_CONCURRENT_COLLECTIONS_SCENES} icons graph ariaLabel="Concurrent collections walk-through" />;
export const DockerWalk = () => <Walk scenes={DOCKER_SCENES} icons graph ariaLabel="Docker walk-through" />;
export const KubernetesWalk = () => <Walk scenes={KUBERNETES_SCENES} icons graph ariaLabel="Kubernetes walk-through" />;
export const JavaStringsWalk = () => <Walk scenes={JAVA_STRINGS_SCENES} icons graph ariaLabel="Strings walk-through" />;
export const JavaGenericsWalk = () => <Walk scenes={JAVA_GENERICS_SCENES} icons graph ariaLabel="Generics walk-through" />;
export const RedisWalk = () => <Walk scenes={REDIS_SCENES} icons graph ariaLabel="Redis caching walk-through" />;
export const SpringMapWalk = () => <Walk scenes={SPRING_MAP_SCENES} icons graph ariaLabel="Spring at a glance walk-through" />;
export const OpenShiftWalk = () => <Walk scenes={OPENSHIFT_SCENES} icons graph ariaLabel="OpenShift walk-through" />;
export const ComposeWalk = () => <Walk scenes={COMPOSE_SCENES} icons graph ariaLabel="Docker Compose walk-through" />;
export const KindWalk = () => <Walk scenes={KIND_SCENES} icons graph ariaLabel="kind walk-through" />;
export const MinikubeWalk = () => <Walk scenes={MINIKUBE_SCENES} icons graph ariaLabel="minikube walk-through" />;
export const DevContainerWalk = () => <Walk scenes={DEVCONTAINER_SCENES} icons graph ariaLabel="Dev Containers walk-through" />;
export const MicroserviceStateWalk = () => <Walk scenes={MICROSERVICE_STATE_SCENES} icons graph ariaLabel="State management in microservices walk-through" />;
export const EventSourcingWalk = () => <Walk scenes={EVENT_SOURCING_SCENES} icons graph ariaLabel="Event sourcing and CQRS walk-through" />;
export const DecompositionWalk = () => <Walk scenes={DECOMPOSITION_SCENES} icons graph ariaLabel="Decomposition and migration walk-through" />;
export const ResilienceWalk = () => <Walk scenes={RESILIENCE_SCENES} icons graph ariaLabel="Resilience walk-through" />;
export const CommunicationWalk = () => <Walk scenes={COMMUNICATION_SCENES} icons graph ariaLabel="Service communication walk-through" />;
