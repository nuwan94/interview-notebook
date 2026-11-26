// Pictures for the "Spring at a glance" walk-through.
// kind 'request':   the layers one payment request passes through, each tagged with the Spring project that owns it.
//                   Frame: { kind, line, result?, layers: [{ id, name, detail, project }], active: [id], done: [id],
//                            dir: 'down' | 'up', ops?: true, note }
// kind 'container': bean definitions (recipes) -> ApplicationContext -> beans, injection and a proxy.
//                   Frame: { kind, line, result?, step: 1..5, note }
// kind 'projects':  the Spring projects drawn as a building: Framework at the bottom, Boot on it, add-ons, Cloud.
//                   Frame: { kind, line, result?, show: [id], focus: [id], note }
import './SpringMapStage.css';

const W = 640;
const HEAD = 10;
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)', none: '#7b8697' };

function Markers() {
  return (
    <defs>
      {Object.entries(TONE).map(([k, c]) => (
        <marker key={k} id={`smap-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0 1L10 5L0 9z" fill={c} />
        </marker>
      ))}
    </defs>
  );
}

// a straight arrow whose head tip lands exactly on (x2, y2)
function Arrow({ x1, y1, x2, y2, tone = 'ok', label, lx, ly, isNew = true, width = 2.25 }) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ex = x2 - ((x2 - x1) / len) * HEAD;
  const ey = y2 - ((y2 - y1) / len) * HEAD;
  return (
    <g className={`g-edge ${isNew ? 'is-new' : ''}`}>
      <path d={`M${x1} ${y1}L${ex} ${ey}`} pathLength="1" className="g-edge-line" stroke={TONE[tone]} strokeWidth={width} fill="none" markerEnd={`url(#smap-arrow-${tone})`} />
      {label && (
        <text x={lx ?? (x1 + x2) / 2} y={ly ?? (y1 + y2) / 2 - 6} textAnchor="middle" className="smap-edge-label">{label}</text>
      )}
    </g>
  );
}

/* ---------- one request, every layer ---------- */
const L = { x: 150, w: 330, y0: 34, step: 25, h: 21, tagX: 492, tagW: 136 };

function RequestPicture({ f, prev }) {
  const active = new Set(f.active || []);
  const done = new Set(f.done || []);
  const rowY = (i) => L.y0 + i * L.step;
  const activeIdx = f.layers.map((l, i) => (active.has(l.id) ? i : -1)).filter((i) => i >= 0);
  const deepest = Math.max(...activeIdx, 0);
  const H = L.y0 + f.layers.length * L.step + (f.ops ? 44 : 12);
  const dirChanged = !prev || prev.dir !== f.dir || prev.active?.join() !== f.active?.join();

  // the request travels down the left side; the response comes back up
  const ax = 112;
  const top = rowY(0) + L.h / 2;
  const bottom = rowY(deepest) + L.h / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="g-svg" role="img" aria-label="Layers of one request">
      <Markers />
      <text x="12" y="20" className="smap-title">Request path</text>
      <text x={L.x} y="20" className="smap-title">Layer</text>
      <text x={L.tagX} y="20" className="smap-title">Spring project</text>
      {f.layers.map((l, i) => {
        const y = rowY(i);
        const isActive = active.has(l.id);
        const isDone = done.has(l.id);
        const state = isActive ? 'is-active' : isDone ? 'is-done' : '';
        return (
          <g key={l.id} className={!isActive && !isDone ? 'smap-pending' : ''}>
            <rect x={L.x} y={y} width={L.w} height={L.h} rx="5" className={`smap-layer ${state}`} />
            <text x={L.x + 10} y={y + 15} className="smap-layer-name">{l.name}</text>
            <text x={L.x + L.w - 10} y={y + 15} textAnchor="end" className="smap-layer-detail">{l.detail}</text>
            {l.project && (
              <>
                <rect x={L.tagX} y={y + 1} width={L.tagW} height={L.h - 2} rx="9" className={`smap-tag ${isActive ? 'is-active' : ''}`} />
                <text x={L.tagX + L.tagW / 2} y={y + 15} textAnchor="middle" className={`smap-tag-text ${isActive ? 'is-active' : ''}`}>{l.project}</text>
              </>
            )}
            <line x1={ax + 6} y1={y + L.h / 2} x2={L.x} y2={y + L.h / 2} stroke="#d5dde8" strokeWidth="1" strokeDasharray="3 3" />
          </g>
        );
      })}
      {f.dir === 'up' ? (
        <Arrow key={`up-${f.active?.join()}`} x1={ax} y1={rowY(f.layers.length - 1) + L.h / 2} x2={ax} y2={top} tone="ok" label="response" lx={ax - 44} ly={(top + rowY(f.layers.length - 1)) / 2} isNew={dirChanged} width={2.75} />
      ) : (
        deepest > 0 && <Arrow key={`down-${deepest}`} x1={ax} y1={top} x2={ax} y2={bottom} tone="new" label="request" lx={ax - 44} ly={(top + bottom) / 2} isNew={dirChanged} width={2.75} />
      )}
      {f.ops && (
        <g className="g-pop">
          <rect x={L.x} y={H - 36} width={L.w} height={26} rx="6" className="smap-layer is-done" />
          <text x={L.x + 10} y={H - 19} className="smap-layer-name">Actuator + Micrometer</text>
          <text x={L.x + L.w - 10} y={H - 19} textAnchor="end" className="smap-layer-detail">duration, trace id</text>
          <rect x={L.tagX} y={H - 35} width={L.tagW} height={24} rx="10" className="smap-tag is-active" />
          <text x={L.tagX + L.tagW / 2} y={H - 19} textAnchor="middle" className="smap-tag-text is-active">Spring Boot</text>
        </g>
      )}
    </svg>
  );
}

/* ---------- the container ---------- */
const C = { defX: 16, defW: 178, ctxX: 236, ctxW: 124, beanX: 410, beanW: 178, rows: [78, 148, 218], h: 44 };
const DEFS = [
  { id: 'svc', def: '@Service', name: 'PaymentService', bean: 'paymentService' },
  { id: 'repo', def: '@Repository', name: 'AccountRepository', bean: 'accountRepository' },
  { id: 'clock', def: '@Bean in AppConfig', name: 'Clock', bean: 'clock' },
];

function ContainerPicture({ f, prev }) {
  const s = f.step;
  const was = prev?.step ?? 0;
  const H = 290;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="g-svg" role="img" aria-label="The Spring container">
      <Markers />
      <rect x="8" y="8" width="196" height={H - 16} rx="10" className="smap-col" />
      <text x={C.defX + 4} y="32" className="smap-title">Your code</text>
      <text x={C.defX + 4} y="50" className="smap-sub">bean definitions (recipes)</text>
      {DEFS.map((d, i) => (
        <g key={d.id}>
          <rect x={C.defX} y={C.rows[i]} width={C.defW} height={C.h} rx="6" className={`smap-card is-recipe ${s === 1 ? 'is-focus' : ''}`} />
          <text x={C.defX + 10} y={C.rows[i] + 17} className="smap-sub">{d.def}</text>
          <text x={C.defX + 10} y={C.rows[i] + 35} className="smap-card-name">{d.name}</text>
        </g>
      ))}

      <rect x={C.ctxX} y={C.rows[0] - 10} width={C.ctxW} height={C.rows[2] + C.h - C.rows[0] + 20} rx="10" className={`smap-ctx ${s < 2 ? 'is-idle' : ''}`} />
      <text x={C.ctxX + C.ctxW / 2} y={C.rows[0] - 22} textAnchor="middle" className="smap-title">ApplicationContext</text>
      <text x={C.ctxX + C.ctxW / 2} y={C.rows[1] + 18} textAnchor="middle" className="smap-card-name">{s < 2 ? 'not started' : s === 2 ? 'scans' : 'creates'}</text>
      <text x={C.ctxX + C.ctxW / 2} y={C.rows[1] + 34} textAnchor="middle" className="smap-sub">{s < 2 ? '' : s === 2 ? 'reads recipes' : s === 3 ? 'one object each' : 'and wires them'}</text>

      <rect x="396" y="8" width="236" height={H - 16} rx="10" className="smap-col" />
      <text x="408" y="32" className="smap-title">Beans in the container</text>
      <text x="408" y="50" className="smap-sub">real objects, one of each (singleton)</text>

      {s >= 2 &&
        DEFS.map((d, i) => (
          <Arrow key={`scan-${d.id}`} x1={C.defX + C.defW + 2} y1={C.rows[i] + C.h / 2} x2={C.ctxX - 1} y2={C.rows[i] + C.h / 2} tone="new" label={i === 0 ? 'scan' : null} isNew={was < 2} />
        ))}
      {s >= 3 &&
        DEFS.map((d, i) => (
          <g key={`bean-${d.id}`}>
            <Arrow x1={C.ctxX + C.ctxW + 2} y1={C.rows[i] + C.h / 2} x2={C.beanX - 1} y2={C.rows[i] + C.h / 2} tone="ok" label={i === 0 ? 'new' : null} isNew={was < 3} />
            <g className={was < 3 ? 'g-pop' : ''}>
              <rect x={C.beanX} y={C.rows[i]} width={C.beanW} height={C.h} rx="6" className="smap-card is-bean" />
              <text x={C.beanX + 10} y={C.rows[i] + 27} className="smap-card-name">{d.bean}</text>
            </g>
          </g>
        ))}
      {s >= 4 && (
        <>
          {/* repository injected straight up into the service */}
          <Arrow x1={C.beanX + 120} y1={C.rows[1] - 1} x2={C.beanX + 120} y2={C.rows[0] + C.h + 1} tone="new" label="injected" lx={C.beanX + 70} ly={C.rows[1] - 9} isNew={was < 4} />
          {/* clock goes round the right side, so it does not cross the repository */}
          <g className={`g-edge ${was < 4 ? 'is-new' : ''}`}>
            <path
              d={`M${C.beanX + C.beanW + 1} ${C.rows[2] + C.h / 2} C ${C.beanX + C.beanW + 30} ${C.rows[2] + C.h / 2} ${C.beanX + C.beanW + 30} ${C.rows[0] + C.h / 2} ${C.beanX + C.beanW + 1 + HEAD} ${C.rows[0] + C.h / 2}`}
              pathLength="1"
              className="g-edge-line"
              stroke={TONE.new}
              strokeWidth="2.25"
              fill="none"
              markerEnd="url(#smap-arrow-new)"
            />
          </g>
        </>
      )}
      {s >= 5 && (
        <g className={was < 5 ? 'g-pop' : ''}>
          <rect x={C.beanX - 8} y={C.rows[0] - 18} width={C.beanW + 16} height={C.h + 26} rx="9" className="smap-proxy" />
          <text x={C.beanX + C.beanW + 4} y={C.rows[0] - 6} textAnchor="end" className="smap-proxy-text">proxy: @Transactional</text>
        </g>
      )}
    </svg>
  );
}

/* ---------- the project stack ---------- */
const BLOCKS = [
  { id: 'framework', name: 'Spring Framework', detail: 'container, AOP, transactions, MVC and WebFlux, JDBC, testing', cls: 'is-core', x: 30, y: 232, w: 580, h: 50 },
  { id: 'boot', name: 'Spring Boot', detail: 'starters, auto-configuration, embedded server, Actuator', cls: 'is-boot', x: 30, y: 170, w: 580, h: 50 },
  { id: 'data', name: 'Spring Data', detail: 'JPA, MongoDB, Redis', cls: 'is-addon', x: 30, y: 104, w: 136, h: 54 },
  { id: 'security', name: 'Security', detail: 'login, roles, tokens', cls: 'is-addon', x: 178, y: 104, w: 136, h: 54 },
  { id: 'batch', name: 'Batch', detail: 'chunked jobs', cls: 'is-addon', x: 326, y: 104, w: 136, h: 54 },
  { id: 'messaging', name: 'Kafka / AMQP', detail: 'messaging', cls: 'is-addon', x: 474, y: 104, w: 136, h: 54 },
  { id: 'cloud', name: 'Spring Cloud', detail: 'Gateway, Config Server, Resilience4j', cls: 'is-cloud', x: 30, y: 40, w: 580, h: 52 },
];

function ProjectsPicture({ f, prev }) {
  const show = new Set(f.show);
  const focus = new Set(f.focus || []);
  const seen = new Set(prev?.show || []);
  return (
    <svg viewBox={`0 0 ${W} 296`} className="g-svg" role="img" aria-label="Spring projects">
      <text x="30" y="26" className="smap-sub">Each layer is built on the one below it.</text>
      {BLOCKS.map((bk) =>
        show.has(bk.id) ? (
          <g key={bk.id} className={seen.has(bk.id) ? '' : 'g-pop'} opacity={focus.size && !focus.has(bk.id) ? 0.55 : 1}>
            <rect x={bk.x} y={bk.y} width={bk.w} height={bk.h} rx="8" className={`smap-block ${bk.cls} ${focus.has(bk.id) ? 'is-focus' : ''}`} />
            <text x={bk.x + (bk.w > 300 ? 16 : bk.w / 2)} y={bk.y + 22} textAnchor={bk.w > 300 ? 'start' : 'middle'} className="smap-block-name">{bk.name}</text>
            <text x={bk.x + (bk.w > 300 ? 16 : bk.w / 2)} y={bk.y + 40} textAnchor={bk.w > 300 ? 'start' : 'middle'} className="smap-block-detail">{bk.detail}</text>
          </g>
        ) : (
          <rect key={bk.id} x={bk.x} y={bk.y} width={bk.w} height={bk.h} rx="8" className="smap-ghost" />
        ),
      )}
    </svg>
  );
}

export function SpringMapStage({ frames, index }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const Picture = f.kind === 'container' ? ContainerPicture : f.kind === 'projects' ? ProjectsPicture : RequestPicture;
  return (
    <div className="g-stage smap-stage">
      <div className="smap-bar">
        <code className="smap-line">{f.line}</code>
        {f.result && (
          <span className="smap-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <Picture f={f} prev={prev} />
    </div>
  );
}
