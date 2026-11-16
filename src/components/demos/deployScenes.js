// Frame data for the "Deployment strategies" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const DEPLOY_SCENES = [
  {
    id: 'rolling',
    label: 'Rolling update',
    title: 'Replace the pods a few at a time',
    frames: [
      {
        note: 'A rolling update is the default in Kubernetes. The service runs three pods of version 1, and the load balancer sends traffic to all of them. A new image is applied, so the controller starts to replace them one by one.',
        boxes: [b('l', 'Load balancer', ['sends traffic to ready pods'], 'none'), b('o', 'Old version', ['3 pods, v1'], 'ok'), b('n', 'New version', ['1 pod starting, v2'], 'new')],
        deps: [d('Load balancer', 'Old version', 'traffic', 'ok'), d('Load balancer', 'New version', 'not yet', 'warn')],
      },
      {
        note: 'A new pod gets traffic only after its readiness probe succeeds. Then one old pod is stopped, after it finishes the requests it is serving. The number of extra and missing pods is limited by maxSurge and maxUnavailable, so capacity never drops far.',
        boxes: [b('r', 'Readiness probe', ['passes, so the pod is ready'], 'ok'), b('n', 'New version', ['2 pods, v2'], 'new'), b('o', 'Old version', ['2 pods, v1, draining'], 'warn')],
        deps: [d('Readiness probe', 'New version', 'allows traffic', 'ok'), d('New version', 'Old version', 'replaces one', 'warn')],
      },
      {
        note: 'The loop repeats until every pod runs version 2. There was no downtime and no extra environment. The price is that versions 1 and 2 serve requests at the same time during the update, so they must be compatible, including their database schema.',
        boxes: [b('n', 'New version', ['3 pods, v2'], 'ok'), b('o', 'Old version', ['0 pods, replaced'], 'none'), b('l', 'Load balancer', ['all traffic on v2'], 'ok')],
        deps: [d('Load balancer', 'New version', 'traffic', 'ok')],
      },
      {
        note: 'Suppose version 2 has a bug and its pods never become ready. The rollout stops, the old pods keep serving all the traffic, and users are not affected. kubectl rollout undo then returns to version 1. This is why the readiness probe must test something real.',
        boxes: [b('n', 'New version', ['pods not ready, v2'], 'bad'), b('p', 'Rollout paused', ['no more pods replaced'], 'warn'), b('o', 'Old version', ['still serves all traffic'], 'ok')],
        deps: [d('New version', 'Rollout paused', 'fails probe', 'bad'), d('Rollout paused', 'Old version', 'keeps', 'ok')],
      },
    ],
  },
  {
    id: 'bluegreen',
    label: 'Blue-green',
    title: 'Two complete environments and a switch',
    frames: [
      {
        note: 'Blue is live with version 1 and takes all the traffic. Green is an identical second environment, where version 2 is deployed and tested with no users on it. Nothing the users see has changed yet.',
        boxes: [b('r', 'Router', ['sends all traffic to blue'], 'none'), b('b', 'Blue environment', ['live, version 1'], 'ok'), b('g', 'Green environment', ['idle, version 2 tested'], 'new')],
        deps: [d('Router', 'Blue environment', 'all traffic', 'ok'), d('Router', 'Green environment', 'none yet', 'warn')],
      },
      {
        note: 'The cut-over is one change at the router, a load balancer rule or a service selector. All traffic moves to green at once. Blue stays running, untouched, for as long as the team wants a quick way back.',
        boxes: [b('r', 'Router', ['switched to green'], 'new'), b('g', 'Green environment', ['live, version 2'], 'ok'), b('b', 'Blue environment', ['idle, version 1 kept'], 'none')],
        deps: [d('Router', 'Green environment', 'all traffic', 'ok'), d('Router', 'Blue environment', 'none now', 'warn')],
      },
      {
        note: 'If the metrics get worse, the rollback is the same switch in reverse and takes seconds, because blue is still there. If everything is fine, blue is removed or becomes the next idle environment. The cost is running two full environments for a while.',
        boxes: [b('m', 'Monitoring', ['errors rise on green'], 'bad'), b('r', 'Router', ['switched back to blue'], 'warn'), b('b', 'Blue environment', ['live again, version 1'], 'ok')],
        deps: [d('Monitoring', 'Router', 'triggers', 'bad'), d('Router', 'Blue environment', 'all traffic', 'ok')],
      },
    ],
  },
  {
    id: 'canary',
    label: 'Canary',
    title: 'Try the new version on a few users first',
    frames: [
      {
        note: 'A canary release sends a small share of the real traffic, for example 5 percent, to the new version. The other 95 percent stay on the stable version. If something is wrong, only a few users are affected.',
        boxes: [b('t', 'Traffic split', ['95 percent / 5 percent'], 'new'), b('s', 'Stable version', ['v1, 95 percent'], 'ok'), b('c', 'Canary version', ['v2, 5 percent'], 'warn')],
        deps: [d('Traffic split', 'Stable version', '95 percent', 'ok'), d('Traffic split', 'Canary version', '5 percent', 'warn')],
      },
      {
        note: 'The two versions are compared on the same metrics: error rate, latency, and a business signal such as payment success. Tools such as Argo Rollouts or Flagger can do this comparison automatically and decide the next step.',
        boxes: [b('s', 'Stable version', ['error rate 0.2 percent'], 'ok'), b('c', 'Canary version', ['error rate 0.2 percent'], 'ok'), b('m', 'Metrics', ['compared over time'], 'new')],
        deps: [d('Stable version', 'Metrics', 'reports', 'ok'), d('Canary version', 'Metrics', 'reports', 'ok')],
      },
      {
        note: 'The numbers are healthy, so the share grows in steps (5, 25, 50, 100 percent) with a check at every step. At 100 percent the canary becomes the new stable version and the old one is removed.',
        boxes: [b('t', 'Traffic split', ['25, then 50, then 100'], 'new'), b('c', 'Canary version', ['v2 grows'], 'ok'), b('s', 'Stable version', ['v1 shrinks'], 'none')],
        deps: [d('Traffic split', 'Canary version', 'more traffic', 'ok'), d('Traffic split', 'Stable version', 'less traffic', 'warn')],
      },
      {
        note: 'If the canary\'s errors rise, the split is set back to zero, and only the small share of users who were on it saw a problem. This blast radius is the main benefit of canary over a switch of all traffic.',
        boxes: [b('c', 'Canary version', ['errors rise, v2'], 'bad'), b('m', 'Metrics', ['threshold crossed'], 'bad'), b('r', 'Rollback', ['traffic back to v1'], 'warn')],
        deps: [d('Canary version', 'Metrics', 'reports', 'bad'), d('Metrics', 'Rollback', 'triggers', 'warn')],
      },
    ],
  },
  {
    id: 'database',
    label: 'Database changes',
    title: 'Expand and contract',
    frames: [
      {
        note: 'During a rolling or canary release, the old and new versions run at the same time against one database. A change that renames or drops a column breaks the old version at once, so the schema must change in compatible steps.',
        boxes: [b('o', 'Old version', ['reads column name'], 'ok'), b('n', 'New version', ['reads column full_name'], 'new'), b('d', 'Database', ['one schema for both'], 'warn')],
        deps: [d('Old version', 'Database', 'reads', 'ok'), d('New version', 'Database', 'reads', 'warn')],
      },
      {
        note: 'Step one, expand: a migration adds the new column and keeps the old one. Nothing is removed, so the old version still works. Then the new version is deployed, and it writes both columns while it reads the new one.',
        boxes: [b('m', 'Migration', ['adds full_name, keeps name'], 'new'), b('d', 'Database', ['both columns exist'], 'ok'), b('n', 'New version', ['writes both columns'], 'ok')],
        deps: [d('Migration', 'Database', 'adds', 'ok'), d('New version', 'Database', 'writes both', 'ok')],
      },
      {
        note: 'Step two, contract: when no old version is left running and a rollback is no longer needed, a later release stops writing the old column, and a final migration removes it. Each step can be rolled back on its own.',
        boxes: [b('n', 'New version', ['uses only full_name'], 'ok'), b('m', 'Migration', ['drops the old column'], 'warn'), b('d', 'Database', ['only full_name left'], 'ok')],
        deps: [d('New version', 'Database', 'uses', 'ok'), d('Migration', 'Database', 'removes name', 'warn')],
      },
    ],
  },
];
