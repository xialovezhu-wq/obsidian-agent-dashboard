import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const compiled = await build({
  stdin: {
    contents: `export { loadDashboardData } from './src/data/dashboardDataLoader';
      export { AgentDashboardView } from './src/views/DashboardView';
      export { SKILL_ACTIONS } from './src/data/skillActions';
      export { TFile } from 'obsidian';`,
    resolveDir: new URL('..', import.meta.url).pathname,
  },
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{
    name: 'offline-obsidian',
    setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
        export class TFile { constructor(path) { this.path = path; } }
        export const normalizePath = path => path;
        export class ItemView {
          constructor(leaf) { this.app = leaf.app; this.contentEl = leaf.contentEl; }
        }
        export class Modal {}
        export class Notice {}
      ` }));
    },
  }],
});
const { loadDashboardData, AgentDashboardView, SKILL_ACTIONS, TFile } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
);

function fixtureApp(summary, readOverride) {
  return { vault: {
    getAbstractFileByPath: path => new TFile(path),
    read: readOverride ?? (async () => JSON.stringify(summary)),
  } };
}

test('missing fields never turn into health scores or passed checks', async () => {
  const result = await loadDashboardData(fixtureApp({}));
  assert.equal(result.source, 'cache');
  assert.ok(result.data.systems.every(system => system.health === null));
  assert.ok(result.data.systems.every(system => system.lastLint === '未记录体检结果'));
  assert.ok(result.data.pipeline.rows.every(row => row.statuses.every(status => status === 'pending')));
  assert.ok(result.data.math.gaps.every(metric => metric.value === null));
});

test('real zero and arbitrary valid scores remain exact; explicit lint evidence is required', async () => {
  for (const score of [0, 37.5, 100]) {
    const result = await loadDashboardData(fixtureApp({
      health: { score }, lint_status: { status: 'passed' }, lint_risks: [], pending_items: [],
    }));
    assert.equal(result.data.systems[0].health, score);
    assert.equal(result.data.systems[0].lastLint, '体检通过');
    assert.equal(result.data.math.gaps[2].value, 0);
    assert.equal(result.data.math.gaps[2].unit, '项');
  }
  const unverified = await loadDashboardData(fixtureApp({ lint_risks: [] }));
  assert.equal(unverified.data.systems[0].lastLint, '未记录体检结果');
});

test('invalid score is unknown and malformed JSON remains explicitly mock', async () => {
  for (const score of [-1, 101, '88']) {
    const result = await loadDashboardData(fixtureApp({ health: { score } }));
    assert.equal(result.data.systems[0].health, null);
  }
  const malformed = await loadDashboardData(fixtureApp({}, async () => '{broken'));
  assert.equal(malformed.source, 'mock');
  assert.match(malformed.message, /mock fallback/);
});

test('concurrent refreshes share one read, preserve active view, and use the title getter', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let reads = 0;
  let renders = 0;
  let shownTitle = '';
  let title = 'Fixture title';
  const contentEl = {
    empty() {}, addClass() {}, removeClass() {},
    querySelector: () => ({ setText: value => { shownTitle = value; } }),
  };
  const app = fixtureApp({}, async () => { reads++; await gate; return '{}'; });
  const view = new AgentDashboardView({ app, contentEl }, () => title);
  view.activeView = 'english';
  view.renderDashboard = () => { renders++; };
  const first = view.reloadDashboardView();
  const second = view.reloadDashboardView();
  release();
  await Promise.all([first, second]);
  assert.equal(reads, 4);
  assert.equal(renders, 1);
  assert.equal(view.activeView, 'english');
  title = 'Changed title';
  view.updateDashboardTitle();
  assert.equal(shownTitle, title);
  assert.equal(view.getDisplayText(), title);
});

test('a closed view does not render after a pending cache read', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let renders = 0;
  const view = new AgentDashboardView({
    app: fixtureApp({}, async () => { await gate; return '{}'; }),
    contentEl: { empty() {}, addClass() {}, removeClass() {} },
  }, () => 'Fixture');
  view.renderDashboard = () => { renders++; };
  const loading = view.reloadDashboardView();
  await view.onClose();
  release();
  await loading;
  assert.equal(renders, 0);
});

test('quick packages, formal curation, and source-backed teaching have distinct prompts', () => {
  const byId = new Map(SKILL_ACTIONS.map(action => [action.id, action]));
  for (const subject of ['math', '408']) {
    const quick = byId.get(`kaoyan-${subject}-wrong-intake`);
    assert.equal(quick.risk, 'local package');
    assert.match(quick.prompt, /完整/);
    assert.match(quick.prompt, /不做正式编纂/);
  }
  assert.equal(byId.get('kaoyan-math-nightly-qa').risk, 'formal write');
  assert.equal(byId.get('kaoyan-408-daily-intake-curation').risk, 'formal write');
  assert.match(byId.get('kaoyan-english-intensive-reading').prompt, /我的首译/);
  assert.ok(!byId.has('kaoyan-408-qa-template'));
  assert.ok(!byId.has('kaoyan-408-rollback-review'));
});
