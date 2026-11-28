// Frame data for the "Terraform and infrastructure as code" walk-through, drawn by BoardStage.

import { BoardStage } from './BoardStage.jsx';

const box = (id, x, y, w, title, lines, tone = 'none', o = {}) => ({ id, x, y, w, title, lines, mono: true, tone, ...o });
const C1 = 14, C2 = 230, C3 = 446, W = 180;
const W2 = 290, R2 = 336;

/* ---------- the workflow ---------- */
const workflowFrames = [
  {
    h: 250,
    line: 'terraform init',
    result: { text: 'download providers, connect the backend', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'your code', ['main.tf describes', 'what you want'], 'none'),
      box('i', C2, 70, W, 'terraform init', ['gets the provider', 'plugins'], 'new'),
      box('b', C3, 70, W, 'backend', ['where the state', 'is stored'], 'ok'),
      box('x', C1, 180, 612, 'you describe the end result, Terraform works out the steps', ['this is called declarative: "I want a bucket", not "run these commands"'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'i', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'i', to: 'b', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'init runs once per folder, and again when a provider or module changes. It downloads the provider plugins and connects the backend.',
  },
  {
    h: 250,
    line: 'terraform plan',
    result: { text: '+1 to add, ~1 to change, 0 to destroy', tone: 'warn' },
    cards: [
      box('c', C1, 70, W, 'your code', ['the wanted state'], 'new'),
      box('s', C2, 70, W, 'state file', ['what Terraform', 'thinks exists'], 'ok'),
      box('p', C3, 70, W, 'the plan', ['the difference,', 'nothing changed yet'], 'warn'),
      box('x', C1, 180, 612, 'plan reads the real resources, compares them with your code, and lists the changes', ['read the plan carefully: a replace or a destroy can lose data'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'p', fs: 'b', ts: 'b', tone: 'warn' }, { from: 's', to: 'p', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'plan is safe. It changes nothing. It shows what apply would do, so a person can review it first.',
  },
  {
    h: 250,
    line: 'terraform apply',
    result: { text: 'the cloud now matches the code', tone: 'ok' },
    cards: [
      box('p', C1, 70, W, 'approved plan', ['the changes to make'], 'warn'),
      box('a', C2, 70, W, 'cloud API', ['creates and', 'updates resources'], 'new'),
      box('s', C3, 70, W, 'state file', ['updated with the', 'new resource ids'], 'ok'),
      box('x', C1, 180, 612, 'apply uses the dependency graph: a subnet is created before the server inside it', ['independent resources are created at the same time'], 'none'),
    ],
    arrows: [{ from: 'p', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'a', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'apply makes the changes through the cloud provider API, then records the result in the state file.',
  },
];

/* ---------- state ---------- */
const stateFrames = [
  {
    h: 250,
    line: 'aws_s3_bucket.logs',
    result: { text: 'state links code to real things', tone: 'ok' },
    cards: [
      box('c', C1, 70, W, 'resource in code', ['aws_s3_bucket.logs'], 'none'),
      box('s', C2, 70, W, 'state file', ['logs = bucket-7f3a', 'with all attributes'], 'new'),
      box('r', C3, 70, W, 'real bucket', ['bucket-7f3a', 'in the cloud'], 'ok'),
      box('x', C1, 180, 612, 'without state, Terraform could not tell which real resource belongs to which block', ['the state file can hold secrets, so protect it like a password'], 'none'),
    ],
    arrows: [{ from: 'c', to: 's', fs: 'r', ts: 'l', tone: 'ok' }, { from: 's', to: 'r', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The state file maps each resource address in your code to the real resource id. It also stores the attributes.',
  },
  {
    h: 270,
    line: 'a remote backend with locking',
    result: { text: 'one apply at a time', tone: 'ok' },
    cards: [
      box('a', C1, 50, W, 'engineer A', ['terraform apply'], 'ok'),
      box('b', C1, 160, W, 'engineer B', ['terraform apply'], 'bad'),
      box('l', C3, 100, W, 'remote state', ['S3 with a lock'], 'new'),
      box('x', C3, 190, W, 'lock held by A', ['B waits or fails'], 'warn'),
    ],
    arrows: [{ from: 'a', to: 'l', fs: 'r', ts: 'l', fo: 4, toff: -10, tone: 'ok' }, { from: 'b', to: 'l', fs: 'r', ts: 'l', fo: -4, toff: 10, tone: 'bad' }],
    note: 'A shared remote backend keeps one copy of the state. The lock stops two people from changing the same infrastructure at once.',
  },
  {
    h: 250,
    line: 'someone edits the console',
    result: { text: 'drift: plan shows the difference', tone: 'warn' },
    cards: [
      box('c', C1, 70, W, 'manual change', ['a port opened in', 'the console'], 'bad'),
      box('d', C2, 70, W, 'drift', ['the cloud no longer', 'matches the state'], 'warn'),
      box('p', C3, 70, W, 'next plan', ['shows the change', 'to revert it'], 'new'),
      box('x', C1, 180, 612, 'either apply to put it back, or change the code to keep it', ['catch drift early: run plan on a schedule'], 'none'),
    ],
    arrows: [{ from: 'c', to: 'd', fs: 'r', ts: 'l', tone: 'bad' }, { from: 'd', to: 'p', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'Drift means the real infrastructure changed outside Terraform. The next plan finds it.',
  },
];

/* ---------- modules and environments ---------- */
const modulesFrames = [
  {
    h: 250,
    line: 'module "network" { ... }',
    result: { text: 'write once, use many times', tone: 'ok' },
    cards: [
      box('r', C1, 70, W, 'root module', ['your main.tf'], 'none'),
      box('m', C2, 70, W, 'module network', ['vpc, subnets,', 'routes'], 'new'),
      box('o', C3, 70, W, 'outputs', ['subnet_ids,', 'vpc_id'], 'ok'),
      box('x', C1, 180, 612, 'a module is a folder of Terraform files with inputs (variables) and outputs', ['other modules use the outputs, so each part stays small'], 'none'),
    ],
    arrows: [{ from: 'r', to: 'm', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'm', to: 'o', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A module groups resources behind a few inputs and outputs, like a function in code.',
  },
  {
    h: 270,
    line: 'envs/dev, envs/stage, envs/prod',
    result: { text: 'same modules, separate state', tone: 'ok' },
    cards: [
      box('m', C2, 40, W, 'shared modules', ['network, app, database'], 'new'),
      box('d', C1, 150, 140, 'dev', ['own state'], 'ok'),
      box('s', 174, 150, 140, 'stage', ['own state'], 'ok'),
      box('p', 334, 150, 140, 'prod', ['own state,', 'tighter access'], 'warn'),
    ],
    arrows: [{ from: 'm', to: 'd', fs: 'b', ts: 't', tone: 'ok' }, { from: 'm', to: 's', fs: 'b', ts: 't', tone: 'ok' }, { from: 'm', to: 'p', fs: 'b', ts: 't', tone: 'ok' }],
    note: 'Give each environment its own folder and its own state. A mistake in dev can then never touch prod.',
  },
  {
    h: 250,
    line: 'version = "~> 5.0"',
    result: { text: 'pin versions so runs repeat', tone: 'ok' },
    cards: [
      box('v', C1, 70, W, 'version rules', ['providers and modules', 'have constraints'], 'new'),
      box('l', C2, 70, W, '.terraform.lock.hcl', ['exact provider', 'versions and hashes'], 'ok'),
      box('c', C3, 70, W, 'same result', ['on every laptop and', 'in the pipeline'], 'ok'),
      box('x', C1, 180, 612, 'commit the lock file to git', ['upgrade on purpose with terraform init -upgrade, and read the plan'], 'none'),
    ],
    arrows: [{ from: 'v', to: 'l', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'l', to: 'c', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'A new provider version can change behaviour. The lock file makes every machine use the same one.',
  },
];

/* ---------- the pipeline ---------- */
const pipelineFrames = [
  {
    h: 250,
    line: 'pull request',
    result: { text: 'checks run, the plan is posted', tone: 'ok' },
    cards: [
      box('p', C1, 70, W, 'pull request', ['a change to the', 'Terraform code'], 'none'),
      box('k', C2, 70, W, 'checks', ['fmt, validate,', 'tflint'], 'new'),
      box('l', C3, 70, W, 'plan comment', ['shows what would', 'change'], 'warn'),
      box('x', C1, 180, 612, 'reviewers read the plan, not only the code', ['the plan is the real effect of the change'], 'none'),
    ],
    arrows: [{ from: 'p', to: 'k', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'k', to: 'l', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'On every pull request the pipeline formats, validates, lints and plans. It posts the plan for review.',
  },
  {
    h: 250,
    line: 'policy as code',
    result: { text: 'rules stop risky changes', tone: 'ok' },
    cards: [
      box('l', C1, 70, W, 'the plan', ['a public bucket', 'is proposed'], 'warn'),
      box('p', C2, 70, W, 'policy check', ['OPA, Sentinel,', 'Checkov'], 'new'),
      box('b', C3, 70, W, 'blocked', ['the pull request', 'cannot merge'], 'bad'),
      box('x', C1, 180, 612, 'rules such as "no public buckets" and "encryption on" are checked automatically', ['people review intent, tools check the rules'], 'none'),
    ],
    arrows: [{ from: 'l', to: 'p', fs: 'r', ts: 'l', tone: 'warn' }, { from: 'p', to: 'b', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Policy as code checks the plan against company rules before anyone can apply it.',
  },
  {
    h: 250,
    line: 'merge to main',
    result: { text: 'apply with a short-lived role', tone: 'ok' },
    cards: [
      box('m', C1, 70, W, 'merge', ['after approval'], 'ok'),
      box('a', C2, 70, W, 'apply job', ['uses OIDC, no', 'stored keys'], 'new'),
      box('s', C3, 70, W, 'locked state', ['one apply at a time'], 'ok'),
      box('x', C1, 180, 612, 'only the pipeline can change production', ['a nightly plan reports drift'], 'none'),
    ],
    arrows: [{ from: 'm', to: 'a', fs: 'r', ts: 'l', tone: 'ok' }, { from: 'a', to: 's', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'The apply job signs in to the cloud with OIDC, so no long-lived keys are stored. People do not apply to production by hand.',
  },
];

export const TERRAFORM_SCENES = [
  { id: 'workflow', label: 'Init, plan, apply', title: 'Write code, see the plan, then apply', stage: BoardStage, frames: workflowFrames },
  { id: 'state', label: 'State and drift', title: 'The state file links code to real things', stage: BoardStage, frames: stateFrames },
  { id: 'modules', label: 'Modules and environments', title: 'Reuse code, separate the state', stage: BoardStage, frames: modulesFrames },
  { id: 'pipeline', label: 'In a pipeline', title: 'Review the plan, apply from CI', stage: BoardStage, frames: pipelineFrames },
];
