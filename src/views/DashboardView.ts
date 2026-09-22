import { ItemView, WorkspaceLeaf } from 'obsidian';
import {
	DashboardDataLoadResult,
	loadDashboardData,
} from '../data/dashboardDataLoader';
import { SKILL_ACTIONS, SkillAction } from '../data/skillActions';
import {
	DashboardData,
	DASHBOARD_VIEW_TYPE,
	HEATMAP_SYSTEMS,
	MOCK_DASHBOARD_DATA,
	PairItem,
	MetricItem,
	PipelineStatus,
	Priority,
	SYSTEM_LABELS,
	SystemKey,
	SystemStatus,
	ViewId,
} from '../data/mockData';
import { SkillPromptModal } from './SkillPromptModal';

type HeatIntensity = 1 | 2 | 3 | 4 | 5;

const CONTROL_LABEL = '本地学习中控';
const DASHBOARD_SUBTITLE = '第二大脑 · 数学 · 408 · 英语';

const STATUS_LABELS: Record<PipelineStatus, string> = {
	done: '已完成',
	ready: '待执行',
	pending: '待确认',
	blocked: '阻塞',
	locked: '锁定',
};

const PRIORITY_LABELS: Record<Priority, string> = {
	high: '高',
	medium: '中',
	low: '低',
};

const SKILL_RISK_LABELS: Record<SkillAction['risk'], string> = {
	'read-only': '只读 / read-only',
	'local package': '本地会话保存',
	'needs confirmation': '需确认 / needs confirmation',
	'formal write': '正式写入 / formal write',
};

export class AgentDashboardView extends ItemView {
	private activeView: ViewId = 'overview';
	private dashboardData: DashboardData = MOCK_DASHBOARD_DATA;
	private loadResult: DashboardDataLoadResult = {
		data: MOCK_DASHBOARD_DATA,
		source: 'mock',
		message: 'mock fallback：尚未读取 dashboard-cache。',
		generatedAt: null,
		errors: [],
	};
	private statusLineEl: HTMLElement | null = null;
	private lastSyncEl: HTMLElement | null = null;
	private toastEl: HTMLElement | null = null;
	private toastTimer: number | null = null;
	private pendingReload: Promise<void> | null = null;
	private isClosed = false;

	constructor(leaf: WorkspaceLeaf, private readonly getTitle: () => string) {
		super(leaf);
		this.icon = 'layout-dashboard';
		this.navigation = false;
	}

	getViewType(): string {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.getTitle();
	}

	async onOpen(): Promise<void> {
		this.isClosed = false;
		await this.reloadDashboardView();
	}

	async reloadDashboardView(): Promise<void> {
		if (this.pendingReload) return this.pendingReload;
		this.setStatus('正在读取缓存…');
		const reload = this.loadDataSource().then(() => {
			if (this.isClosed) return;
			this.contentEl.empty();
			this.contentEl.addClass('agd-view-host');
			this.statusLineEl = null;
			this.lastSyncEl = null;
			this.toastEl = null;
			this.renderDashboard(this.contentEl);
		});
		this.pendingReload = reload;
		try {
			await reload;
		} finally {
			this.pendingReload = null;
		}
	}

	updateDashboardTitle(): void {
		this.contentEl.querySelector<HTMLElement>('.agd-main-title')?.setText(this.getTitle());
	}

	async onClose(): Promise<void> {
		this.isClosed = true;
		if (this.toastTimer !== null) {
			window.clearTimeout(this.toastTimer);
			this.toastTimer = null;
		}
		this.contentEl.empty();
		this.contentEl.removeClass('agd-view-host');
	}

	private renderDashboard(containerEl: HTMLElement): void {
		const shellEl = containerEl.createDiv({ cls: 'agd-shell' });
		this.renderNav(shellEl);

		const workspaceEl = shellEl.createEl('main', { cls: 'agd-workspace' });
		this.renderHeader(workspaceEl);
		this.renderActions(workspaceEl);

		this.statusLineEl = workspaceEl.createDiv({
			cls: 'agd-status-line',
			attr: {
				role: 'status',
				'aria-live': 'polite',
				'aria-atomic': 'true',
			},
			text: this.loadResult.message,
		});

		this.renderSkillCenter(workspaceEl);
		this.renderOverview(workspaceEl);
		this.renderMath(workspaceEl);
		this.render408(workspaceEl);
		this.renderEnglish(workspaceEl);
		this.renderPulse(workspaceEl);
		this.renderToast(containerEl);
	}

	private renderHeader(parentEl: HTMLElement): void {
		const headerEl = parentEl.createEl('header', { cls: 'agd-top-header' });
		const titleBlockEl = headerEl.createEl('section', {
			cls: 'agd-title-block',
			attr: { 'aria-labelledby': 'agd-dashboard-title' },
		});
		titleBlockEl.createEl('p', { cls: 'agd-eyebrow', text: CONTROL_LABEL });
		titleBlockEl.createEl('h1', {
			cls: 'agd-main-title',
			text: this.getTitle(),
			attr: { id: 'agd-dashboard-title' },
		});
		titleBlockEl.createEl('p', {
			cls: 'agd-subtitle',
			text: DASHBOARD_SUBTITLE,
		});

		const statusEl = headerEl.createEl('section', {
			cls: 'agd-status-strip',
			attr: { 'aria-label': '全局状态' },
		});
		this.createPill(
			statusEl,
			this.loadResult.source === 'cache' ? '只读缓存' : 'mock fallback',
			['agd-status-pill--live'],
		);
		this.lastSyncEl = this.createPill(statusEl, this.getLastSyncLabel());
		this.createPill(statusEl, '不写入真实库');
		const refreshButton = statusEl.createEl('button', {
			cls: 'agd-refresh-button',
			text: '刷新状态',
			attr: {
				type: 'button',
				'aria-label': '只读刷新 dashboard-cache',
			},
		});
		this.registerDomEvent(refreshButton, 'click', () => {
			void this.reloadDashboardView();
		});
	}

	private renderSkillCenter(parentEl: HTMLElement): void {
		const sectionEl = parentEl.createEl('section', {
			cls: 'agd-skill-center',
			attr: { 'aria-label': 'Actions / skill center' },
		});
		const headerEl = sectionEl.createDiv({ cls: 'agd-section-heading' });
		const titleEl = headerEl.createDiv();
		titleEl.createEl('p', { cls: 'agd-section-kicker', text: '操作中心 / skill center' });
		titleEl.createEl('h2', { text: 'Skill 提示词路由' });
		headerEl.createSpan({
			cls: 'agd-section-meta',
			text: 'Manual execution required',
		});

		const noteEl = sectionEl.createEl('p', {
			cls: 'agd-skill-center__note',
			text: '这里只生成可复制的 codex 提示词；插件不会执行 skill、不会调用外部 API、不会直接修改 vault 或学习系统。',
		});
		noteEl.setAttr('role', 'note');

		const gridEl = sectionEl.createDiv({ cls: 'agd-skill-action-grid' });
		for (const action of SKILL_ACTIONS) {
			this.renderSkillActionCard(gridEl, action);
		}
	}

	private renderSkillActionCard(parentEl: HTMLElement, action: SkillAction): void {
		const cardEl = parentEl.createEl('article', {
			cls: [
				'agd-skill-action-card',
				`agd-skill-action-card--${this.getSkillSystemClass(action.system)}`,
			].join(' '),
		});
		const topEl = cardEl.createDiv({ cls: 'agd-skill-action-card__top' });
		topEl.createSpan({
			cls: `agd-skill-system-badge agd-skill-system-badge--${this.getSkillSystemClass(
				action.system,
			)}`,
			text: action.system,
		});
		topEl.createSpan({
			cls: `agd-skill-risk agd-skill-risk--${action.risk.replaceAll(' ', '-')}`,
			text: SKILL_RISK_LABELS[action.risk],
		});

		cardEl.createEl('h3', { text: action.name });
		cardEl.createEl('p', { cls: 'agd-skill-action-card__skill', text: action.skillName });
		cardEl.createEl('p', { cls: 'agd-skill-action-card__purpose', text: action.purpose });
		cardEl.createEl('p', {
			cls: 'agd-skill-action-card__manual',
			text: 'Manual execution required',
		});

		const buttonEl = cardEl.createEl('button', {
			cls: 'agd-action-button agd-skill-action-card__button',
			text: '生成提示词',
			attr: {
				type: 'button',
				'aria-label': `生成 ${action.name} 的 Codex 提示词`,
			},
		});
		this.registerDomEvent(buttonEl, 'click', () => {
			this.setStatus(`${action.name} 提示词已生成；Manual execution required。`);
			new SkillPromptModal(this.app, action).open();
		});
	}

	private renderActions(parentEl: HTMLElement): void {
		const actionsEl = parentEl.createEl('section', {
			cls: 'agd-action-row',
			attr: { 'aria-label': '全局操作' },
		});
		for (const action of this.dashboardData.actions) {
			const buttonEl = actionsEl.createEl('button', {
				cls: 'agd-action-button',
				text: action,
				attr: {
					type: 'button',
					'aria-label': `${action}模拟操作`,
				},
			});
			this.registerDomEvent(buttonEl, 'click', () => this.runMockAction(buttonEl, action));
		}
	}

	private renderNav(parentEl: HTMLElement): void {
		const railEl = parentEl.createEl('aside', {
			cls: 'agd-side-rail',
			attr: { 'aria-label': '控制台视图' },
		});
		const markEl = railEl.createDiv({ cls: 'agd-rail-mark' });
		markEl.createSpan({ cls: 'agd-rail-mark__dot' });
		markEl.createSpan({ text: '本地中控' });

		const navEl = railEl.createEl('nav', {
			cls: 'agd-view-nav',
			attr: { 'aria-label': '视图切换' },
		});
		for (const view of this.dashboardData.views) {
			const buttonEl = navEl.createEl('button', {
				cls: [
					'agd-view-nav__button',
					`agd-view-nav__button--${view.id}`,
					this.activeView === view.id ? 'is-active' : '',
				]
					.filter(Boolean)
					.join(' '),
				attr: {
					type: 'button',
					'aria-label': `显示${view.label}视图`,
					'aria-selected': String(this.activeView === view.id),
					'data-view': view.id,
				},
			});
			buttonEl.createSpan({
				cls: [
					'agd-view-nav__key',
					view.system ? `agd-view-nav__key--${view.system}` : '',
				]
					.filter(Boolean)
					.join(' '),
				text: view.key,
			});
			buttonEl.createSpan({ text: view.label });
			this.registerDomEvent(buttonEl, 'click', () => this.switchView(view.id));
		}

		const footerEl = railEl.createDiv({ cls: 'agd-rail-footer' });
		footerEl.createSpan({
			cls: 'agd-rail-footer__label',
			text: this.loadResult.source === 'cache' ? '只读缓存数据' : 'mock fallback',
		});
		footerEl.createSpan({ cls: 'agd-rail-footer__value', text: '不写入真实库' });
	}

	private renderOverview(parentEl: HTMLElement): void {
		const panelEl = this.createViewPanel(parentEl, 'overview', '总览视图');
		this.createSectionHeading(
			panelEl,
			'总览',
			'四系统总控',
			this.loadResult.source === 'cache'
				? 'dashboard-cache / 只读'
				: 'mock fallback / 本地只读',
		);

		const systemGridEl = panelEl.createDiv({ cls: 'agd-system-grid' });
		for (const system of this.dashboardData.systems) {
			this.renderSystemCard(systemGridEl, system);
		}

		const splitEl = panelEl.createDiv({ cls: 'agd-two-column-grid agd-two-column-grid--matrix' });
		const matrixPanelEl = this.createPanel(splitEl, '智能体流程', '流程状态矩阵', '收集到同步');
		this.renderPipeline(matrixPanelEl);

		const queuePanelEl = this.createPanel(
			splitEl,
			'待办',
			'跨系统队列',
			`${this.dashboardData.queue.length} 项`,
		);
		this.renderQueue(queuePanelEl);

		const heatPanelEl = this.createPanel(panelEl, '12 周轨迹', '活动热力图', '悬停查看');
		this.renderHeatmap(heatPanelEl);
	}

	private renderMath(parentEl: HTMLElement): void {
		const panelEl = this.createViewPanel(parentEl, 'math', '数学视图');
		this.createSystemHeader(
			panelEl,
			'数学系统',
			'错题网络已保护',
			'当前专题：条件边界与分类讨论',
			'源数据锁定',
			'math',
		);

		const gridEl = panelEl.createDiv({ cls: 'agd-three-column-grid' });
		this.renderPairs(
			this.createPanel(gridEl, '保护边界', '错题网络边界'),
			this.dashboardData.math.locks,
			'agd-lock-list',
		);
		this.renderMetrics(
			this.createPanel(gridEl, '方法缺口', '薄弱触发雷达'),
			this.dashboardData.math.gaps,
		);
		this.renderTags(
			this.createPanel(gridEl, '专题队列', '待钻专题'),
			this.dashboardData.math.topics,
		);
		this.renderFeed(
			this.createPanel(panelEl, '同步与体检', '数学链路记录'),
			this.dashboardData.math.feed,
		);
	}

	private render408(parentEl: HTMLElement): void {
		const panelEl = this.createViewPanel(parentEl, 'cs408', '408 视图');
		this.createSystemHeader(
			panelEl,
			'408 系统',
			'复做答案已保护',
			'当前专题：状态转移与边界条件',
			'答案隐藏',
			'cs408',
		);

		const gridEl = panelEl.createDiv({ cls: 'agd-three-column-grid' });
		this.renderPairs(
			this.createPanel(gridEl, '正式数据', '数据锁定面板'),
			this.dashboardData.cs408.locks,
			'agd-lock-list',
		);
		this.renderNetworkSummary(this.createPanel(gridEl, '关系网', '关系摘要'));
		this.renderTags(
			this.createPanel(gridEl, '小练候选', '专题候选'),
			this.dashboardData.cs408.topics,
		);
		this.renderFeed(
			this.createPanel(panelEl, '风险流', '复做保护风险'),
			this.dashboardData.cs408.feed,
		);
	}

	private renderEnglish(parentEl: HTMLElement): void {
		const panelEl = this.createViewPanel(parentEl, 'english', '英语视图');
		this.createSystemHeader(
			panelEl,
			'英语系统',
			'长期词库已保护',
			'当前专题：长难句限定条件与转折逻辑',
			'词库锁定',
			'english',
		);

		const gridEl = panelEl.createDiv({ cls: 'agd-three-column-grid' });
		this.renderPairs(
			this.createPanel(gridEl, '长期库', '表格完整性'),
			this.dashboardData.english.bank,
			'agd-lock-list',
		);
		this.renderPairs(
			this.createPanel(gridEl, '来源流', '语料来源状态'),
			this.dashboardData.english.streams,
			'agd-source-grid',
		);
		this.renderTags(
			this.createPanel(gridEl, '句子逻辑', '长难句队列'),
			this.dashboardData.english.logic,
		);
		this.renderFeed(
			this.createPanel(panelEl, '复习 / 小练 / 同步', '英语链路记录'),
			this.dashboardData.english.feed,
		);
	}

	private renderPulse(parentEl: HTMLElement): void {
		const panelEl = this.createViewPanel(parentEl, 'pulse', '外部脉搏视图');
		this.createSystemHeader(
			panelEl,
			'外部脉搏',
			'外部信号暂存',
			this.loadResult.source === 'cache'
				? '展示 dashboard-cache 汇总信息；不请求网络，不写入学习系统。'
				: '外部信息流只做模拟，不请求网络。',
			this.loadResult.source === 'cache' ? '只读缓存' : '离线模拟',
			'pulse',
		);

		const gridEl = panelEl.createDiv({ cls: 'agd-three-column-grid' });
		this.renderPairs(
			this.createPanel(gridEl, '研究漏斗', '筛选流程'),
			this.dashboardData.pulse.funnel,
			'agd-funnel-list',
		);
		this.renderPairs(
			this.createPanel(gridEl, '来源构成', '外部信号'),
			this.dashboardData.pulse.sources,
			'agd-source-grid',
		);
		this.renderFeed(
			this.createPanel(gridEl, '智能体运行', '模拟队列'),
			this.dashboardData.pulse.runs,
		);

		const feedsPanelEl = this.createPanel(panelEl, '外部信息流', '暂存列表');
		const columnsEl = feedsPanelEl.createDiv({ cls: 'agd-feed-columns' });
		for (const feed of this.dashboardData.pulse.feeds) {
			const columnEl = columnsEl.createEl('section', { cls: 'agd-feed-column' });
			columnEl.createEl('h4', { text: feed.title });
			const listEl = columnEl.createEl('ul');
			for (const item of feed.items) {
				listEl.createEl('li', { text: item });
			}
		}
	}

	private renderSystemCard(parentEl: HTMLElement, system: SystemStatus): void {
		const cardEl = parentEl.createEl('article', {
			cls: `agd-system-card agd-system-card--${system.key} agd-health-${system.health}`,
		});
		const topEl = cardEl.createDiv({ cls: 'agd-system-card__top' });
		const titleEl = topEl.createDiv();
		titleEl.createEl('p', { cls: 'agd-panel__kicker', text: system.shortLabel });
		titleEl.createEl('h3', { cls: 'agd-system-card__name', text: system.label });
		topEl.createDiv({
			cls: 'agd-health-gauge',
			text: system.health === null ? '未记录' : String(system.health),
			attr: { 'aria-label': `${system.label}健康度 ${system.health === null ? '未记录' : system.health}` },
		});

		const detailsEl = cardEl.createDiv({ cls: 'agd-system-card__details' });
		this.renderDetail(detailsEl, '同步', system.sync);
		this.renderDetail(detailsEl, '小练', system.tutor);
		this.renderDetail(detailsEl, '保护', system.protected);
		this.renderDetail(detailsEl, '体检', system.lastLint);
	}

	private renderPipeline(parentEl: HTMLElement): void {
		const wrapEl = parentEl.createDiv({ cls: 'agd-pipeline-matrix' });
		const gridEl = wrapEl.createDiv({ cls: 'agd-matrix-grid' });
		gridEl.createDiv({ cls: 'agd-matrix-cell agd-matrix-cell--head', text: '系统' });
		for (const column of this.dashboardData.pipeline.columns) {
			gridEl.createDiv({ cls: 'agd-matrix-cell agd-matrix-cell--head', text: column });
		}
		for (const row of this.dashboardData.pipeline.rows) {
			gridEl.createDiv({ cls: 'agd-matrix-cell agd-matrix-cell--row', text: row.system });
			for (const status of row.statuses) {
				const cellEl = gridEl.createDiv({ cls: 'agd-matrix-cell' });
				cellEl.createSpan({
					cls: `agd-matrix-status agd-status-${status}`,
					text: STATUS_LABELS[status],
				});
			}
		}
	}

	private renderQueue(parentEl: HTMLElement): void {
		const listEl = parentEl.createDiv({ cls: 'agd-queue-list' });
		for (const item of this.dashboardData.queue) {
			const itemEl = listEl.createEl('article', { cls: 'agd-queue-item' });
			const textEl = itemEl.createDiv();
			textEl.createEl('p', { cls: 'agd-item-title', text: item.title });
			textEl.createEl('p', {
				cls: 'agd-item-meta',
				text: `${item.system} / ${item.state}`,
			});
			itemEl.createSpan({
				cls: `agd-priority agd-priority--${item.priority}`,
				text: PRIORITY_LABELS[item.priority],
			});
		}
	}

	private renderHeatmap(parentEl: HTMLElement): void {
		if (this.loadResult.source === 'cache') {
			parentEl.createEl('p', { text: '缓存未提供活动轨迹，暂不显示热力图。' });
			return;
		}
		const wrapEl = parentEl.createDiv({ cls: 'agd-heatmap-wrap' });
		const axisEl = wrapEl.createDiv({
			cls: 'agd-heatmap-axis',
			attr: { 'aria-hidden': 'true' },
		});
		axisEl.createSpan({ text: '一' });
		axisEl.createSpan({ text: '三' });
		axisEl.createSpan({ text: '五' });

		const heatmapEl = wrapEl.createDiv({
			cls: 'agd-heatmap',
			attr: { 'aria-label': '最近活动热力图' },
		});
		const tooltipEl = parentEl.createDiv({
			cls: 'agd-heat-tooltip',
			attr: { role: 'tooltip' },
		});
		const today = new Date(2026, 5, 28);
		for (let weekIndex = 0; weekIndex < 12; weekIndex += 1) {
			const weekEl = heatmapEl.createDiv({ cls: 'agd-heat-week' });
			for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
				const index = weekIndex * 7 + dayIndex;
				const system =
					HEATMAP_SYSTEMS[(index + dayIndex) % HEATMAP_SYSTEMS.length] ?? 'brain';
				const intensity = (((index * 7 + dayIndex * 3) % 5) + 1) as HeatIntensity;
				const date = new Date(today);
				date.setDate(today.getDate() - (83 - index));
				const tooltip = `${this.formatDate(date)} / ${SYSTEM_LABELS[system]} / 活动强度 ${intensity}`;
				const cellEl = weekEl.createEl('button', {
					cls: `agd-heat-cell agd-heat-cell--${system} agd-heat-cell--i${intensity}`,
					attr: {
						type: 'button',
						'aria-label': tooltip,
						'data-tooltip': tooltip,
					},
				});
				this.registerDomEvent(cellEl, 'mouseenter', () => {
					this.showHeatTooltip(tooltipEl, tooltip);
				});
				this.registerDomEvent(cellEl, 'focus', () => {
					this.showHeatTooltip(tooltipEl, tooltip);
				});
				this.registerDomEvent(cellEl, 'mouseleave', () => {
					this.hideHeatTooltip(tooltipEl);
				});
				this.registerDomEvent(cellEl, 'blur', () => {
					this.hideHeatTooltip(tooltipEl);
				});
			}
		}
	}

	private renderPairs(parentEl: HTMLElement, rows: PairItem[], className: string): void {
		const listEl = parentEl.createDiv({ cls: className });
		for (const row of rows) {
			const rowEl = listEl.createDiv({
				cls:
					className === 'agd-source-grid'
						? 'agd-source-item'
						: className === 'agd-funnel-list'
							? 'agd-funnel-item'
							: 'agd-lock-row',
			});
			rowEl.createSpan({ text: row.label });
			rowEl.createSpan({ text: row.value });
		}
	}

	private renderMetrics(parentEl: HTMLElement, rows: MetricItem[]): void {
		const listEl = parentEl.createDiv({ cls: 'agd-metric-stack' });
		for (const row of rows) {
			const rowEl = listEl.createDiv({ cls: 'agd-metric-row' });
			const topEl = rowEl.createDiv({ cls: 'agd-metric-row__top' });
			topEl.createSpan({ text: row.label });
			const label = row.value === null ? '未记录' : `${row.value}${row.unit ?? '%'}`;
			topEl.createSpan({ text: label });
			if (row.value === null || (row.unit && row.unit !== '%')) continue;
			const barEl = rowEl.createDiv({
				cls: 'agd-metric-bar',
				attr: { 'aria-label': `${row.label} ${row.value}%` },
			});
			barEl.createSpan({ cls: `agd-width-${this.getMetricWidth(row.value)}` });
		}
	}

	private renderTags(parentEl: HTMLElement, tags: string[]): void {
		const cloudEl = parentEl.createDiv({ cls: 'agd-tag-cloud' });
		for (const tag of tags) {
			cloudEl.createSpan({ cls: 'agd-topic-tag', text: tag });
		}
	}

	private renderFeed(parentEl: HTMLElement, rows: PairItem[]): void {
		const listEl = parentEl.createDiv({ cls: 'agd-feed-list' });
		for (const row of rows) {
			const itemEl = listEl.createEl('article', { cls: 'agd-feed-item' });
			const textEl = itemEl.createDiv();
			textEl.createEl('p', { cls: 'agd-item-title', text: row.label });
			textEl.createEl('p', { cls: 'agd-item-meta', text: row.value });
			itemEl.createSpan({
				cls: 'agd-state-chip',
				text: this.loadResult.source === 'cache' ? '只读' : '模拟',
			});
		}
	}

	private renderNetworkSummary(parentEl: HTMLElement): void {
		const gridEl = parentEl.createDiv({ cls: 'agd-network-summary' });
		for (const stat of this.dashboardData.cs408.stats) {
			const statEl = gridEl.createDiv({ cls: 'agd-network-stat' });
			statEl.createEl('strong', { text: stat.value === null ? '未记录' : String(stat.value) });
			statEl.createSpan({ text: stat.label });
		}
	}

	private renderToast(parentEl: HTMLElement): void {
		this.toastEl = parentEl.createDiv({
			cls: 'agd-toast',
			attr: {
				role: 'status',
				'aria-live': 'polite',
				'aria-atomic': 'true',
			},
		});
	}

	private createViewPanel(parentEl: HTMLElement, view: ViewId, label: string): HTMLElement {
		return parentEl.createEl('section', {
			cls: ['agd-view-panel', this.activeView === view ? 'is-active' : '']
				.filter(Boolean)
				.join(' '),
			attr: {
				'aria-label': label,
				'data-panel': view,
			},
		});
	}

	private createSectionHeading(
		parentEl: HTMLElement,
		kicker: string,
		title: string,
		meta: string,
	): void {
		const headingEl = parentEl.createDiv({ cls: 'agd-section-heading' });
		const textEl = headingEl.createDiv();
		textEl.createEl('p', { cls: 'agd-section-kicker', text: kicker });
		textEl.createEl('h2', { text: title });
		headingEl.createSpan({ cls: 'agd-section-meta', text: meta });
	}

	private createSystemHeader(
		parentEl: HTMLElement,
		kicker: string,
		title: string,
		description: string,
		pill: string,
		system: SystemKey,
	): void {
		const headerEl = parentEl.createDiv({
			cls: `agd-system-page-header agd-system-page-header--${system}`,
		});
		const textEl = headerEl.createDiv();
		textEl.createEl('p', { cls: 'agd-section-kicker', text: kicker });
		textEl.createEl('h2', { text: title });
		textEl.createEl('p', { text: description });
		this.createPill(headerEl, pill, [`agd-status-pill--${system}`]);
	}

	private createPanel(
		parentEl: HTMLElement,
		kicker: string,
		title: string,
		note?: string,
	): HTMLElement {
		const panelEl = parentEl.createEl('section', { cls: 'agd-panel' });
		const headerEl = panelEl.createDiv({ cls: 'agd-panel__header' });
		const titleEl = headerEl.createDiv();
		titleEl.createEl('p', { cls: 'agd-panel__kicker', text: kicker });
		titleEl.createEl('h3', { text: title });
		if (note) {
			headerEl.createSpan({ cls: 'agd-panel__note', text: note });
		}
		return panelEl;
	}

	private createPill(parentEl: HTMLElement, text: string, classes: string[] = []): HTMLElement {
		return parentEl.createSpan({
			cls: ['agd-status-pill', ...classes].join(' '),
			text,
		});
	}

	private renderDetail(parentEl: HTMLElement, label: string, value: string): void {
		const rowEl = parentEl.createDiv({ cls: 'agd-detail-row' });
		rowEl.createSpan({ text: label });
		rowEl.createSpan({ text: value });
	}

	private async loadDataSource(): Promise<void> {
		this.loadResult = await loadDashboardData(this.app);
		this.dashboardData = this.loadResult.data;
	}

	private switchView(view: ViewId): void {
		this.activeView = view;
		this.contentEl.querySelectorAll<HTMLElement>('[data-view]').forEach((buttonEl) => {
			const isActive = buttonEl.dataset.view === view;
			buttonEl.toggleClass('is-active', isActive);
			buttonEl.setAttribute('aria-selected', String(isActive));
		});
		this.contentEl.querySelectorAll<HTMLElement>('[data-panel]').forEach((panelEl) => {
			panelEl.toggleClass('is-active', panelEl.dataset.panel === view);
		});
		this.setStatus(`已切换到${this.getViewLabel(view)}。${this.getSourceNote()}。`);
	}

	private runMockAction(buttonEl: HTMLButtonElement, action: string): void {
		buttonEl.removeClass('is-done');
		buttonEl.addClass('is-running');
		buttonEl.setText('执行中');
		this.setStatus(`${action}已加入模拟队列。`);
		this.showToast(`${action}：执行中`);

		window.setTimeout(() => {
			buttonEl.removeClass('is-running');
			buttonEl.addClass('is-done');
			buttonEl.setText('完成');
			this.setStatus(`${action}已完成模拟动作；没有改动真实数据。`);
			this.showToast(`${action}：完成`);
		}, 700);

		window.setTimeout(() => {
			buttonEl.removeClass('is-done');
			buttonEl.setText(action);
		}, 1700);
	}

	private showHeatTooltip(tooltipEl: HTMLElement, text: string): void {
		tooltipEl.setText(text);
		tooltipEl.addClass('is-visible');
	}

	private hideHeatTooltip(tooltipEl: HTMLElement): void {
		tooltipEl.removeClass('is-visible');
	}

	private setStatus(text: string): void {
		this.statusLineEl?.setText(text);
	}

	private getViewLabel(view: ViewId): string {
		return this.dashboardData.views.find((item) => item.id === view)?.label ?? view;
	}

	private getMetricWidth(value: number): number {
		const clamped = Math.max(0, Math.min(100, Math.round(value)));
		return Math.round(clamped / 10) * 10;
	}

	private getSkillSystemClass(system: SkillAction['system']): string {
		if (system === '数学') {
			return 'math';
		}
		if (system === '408') {
			return 'cs408';
		}
		if (system === '英语') {
			return 'english';
		}
		return 'brain';
	}

	private getSourceNote(): string {
		return this.loadResult.source === 'cache'
			? '当前为第二大脑 dashboard-cache 只读数据'
			: '当前为 mock fallback 模拟数据';
	}

	private getLastSyncLabel(): string {
		if (this.loadResult.source === 'mock') {
			return '缓存未读取';
		}

		return `缓存生成 ${this.formatDateTime(this.loadResult.generatedAt)}`;
	}

	private formatDateTime(value: string | null): string {
		if (!value) {
			return '未记录';
		}

		const [datePart, timePart] = value.split('T');
		const time = timePart?.slice(0, 5);
		return time ? `${datePart} ${time}` : value;
	}

	private showToast(text: string): void {
		if (!this.toastEl) {
			return;
		}
		this.toastEl.setText(text);
		this.toastEl.addClass('is-visible');
		if (this.toastTimer !== null) {
			window.clearTimeout(this.toastTimer);
		}
		this.toastTimer = window.setTimeout(() => {
			this.toastEl?.removeClass('is-visible');
			this.toastTimer = null;
		}, 1500);
	}

	private formatDate(date: Date): string {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
			date.getDate(),
		).padStart(2, '0')}`;
	}
}
