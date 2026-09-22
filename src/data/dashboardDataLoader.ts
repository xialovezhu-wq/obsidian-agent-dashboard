import { App, normalizePath, TFile } from 'obsidian';
import {
	DashboardData,
	MOCK_DASHBOARD_DATA,
	MetricItem,
	PairItem,
	PipelineStatus,
	Priority,
	SystemKey,
	SystemStatus,
} from './mockData';

type CacheKey = 'overview' | 'math' | 'cs408' | 'english';

type CacheSummary = Record<string, unknown>;

type LoadedSummaryMap = Record<CacheKey, CacheSummary>;

export interface DashboardDataLoadResult {
	data: DashboardData;
	source: 'cache' | 'mock';
	message: string;
	generatedAt: string | null;
	errors: string[];
}

const CACHE_PATHS: Record<CacheKey, string> = {
	overview:
		'第二大脑/四系统集成/dashboard-cache/overview-dashboard-summary.json',
	math: '第二大脑/四系统集成/dashboard-cache/math-dashboard-summary.json',
	cs408: '第二大脑/四系统集成/dashboard-cache/408-dashboard-summary.json',
	english:
		'第二大脑/四系统集成/dashboard-cache/english-dashboard-summary.json',
};

const STATUS_LABELS: Record<string, string> = {
	complete: '已完成',
	ready: '可读取',
	partial: '部分完成',
	candidate: '待确认',
	synced: '已同步',
	designed: '已设计',
	blocked: '阻塞',
	error: '异常',
	missing: '缺失',
};

export async function loadDashboardData(app: App): Promise<DashboardDataLoadResult> {
	try {
		const summaries = await readAllSummaries(app);
		const data = buildDashboardData(summaries);
		const generatedAt = getString(summaries.overview, 'generated_at');

		return {
			data,
			source: 'cache',
			generatedAt,
			errors: [],
			message: `已读取第二大脑 dashboard-cache（只读）；生成时间 ${formatDateTime(generatedAt)}。按钮仍为模拟动作，不写入学习系统。`,
		};
	} catch (error) {
		const reason = error instanceof Error ? error.message : '未知读取错误';
		return {
			data: MOCK_DASHBOARD_DATA,
			source: 'mock',
			generatedAt: null,
			errors: [reason],
			message: `mock fallback：dashboard-cache 读取失败，当前显示内置模拟数据。原因：${reason}`,
		};
	}
}

function buildDashboardData(summaries: LoadedSummaryMap): DashboardData {
	return {
		...MOCK_DASHBOARD_DATA,
		systems: buildSystems(summaries),
		pipeline: buildPipeline(summaries),
		queue: buildQueue(summaries.overview),
		math: {
			locks: buildBoundaryPairs(summaries.math),
			gaps: buildMetrics(summaries.math),
			topics: buildTopics(summaries.math),
			feed: buildFeed(summaries.math),
		},
		cs408: {
			locks: buildBoundaryPairs(summaries.cs408),
			stats: [
				{ label: '边界', value: knownArrayCount(summaries.cs408, 'protected_boundaries') },
				{ label: '风险', value: knownArrayCount(summaries.cs408, 'lint_risks') },
				{ label: '待办', value: knownArrayCount(summaries.cs408, 'pending_items') },
				{ label: '更新', value: knownArrayCount(summaries.cs408, 'recent_updates') },
			],
			topics: buildTopics(summaries.cs408),
			feed: buildRiskFeed(summaries.cs408),
		},
		english: {
			bank: buildEnglishBank(summaries.english),
			streams: buildEnglishStreams(summaries.english),
			logic: buildTopics(summaries.english),
			feed: buildFeed(summaries.english),
		},
		pulse: {
			funnel: buildOverviewFunnel(summaries),
			sources: buildSourceStatus(summaries),
			runs: buildReadOnlyRuns(summaries.overview),
			feeds: buildOverviewFeeds(summaries.overview),
		},
	};
}

async function readAllSummaries(app: App): Promise<LoadedSummaryMap> {
	return {
		overview: await readCacheFile(app, CACHE_PATHS.overview),
		math: await readCacheFile(app, CACHE_PATHS.math),
		cs408: await readCacheFile(app, CACHE_PATHS.cs408),
		english: await readCacheFile(app, CACHE_PATHS.english),
	};
}

async function readCacheFile(app: App, path: string): Promise<CacheSummary> {
	const normalizedPath = normalizePath(path);
	const abstractFile = app.vault.getAbstractFileByPath(normalizedPath);

	if (!(abstractFile instanceof TFile)) {
		throw new Error(`${normalizedPath} 不存在`);
	}

	const content = await app.vault.read(abstractFile);
	let parsed: unknown;

	try {
		parsed = JSON.parse(content) as unknown;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'JSON 解析异常';
		throw new Error(`${normalizedPath} JSON 解析失败：${message}`);
	}

	if (!isRecord(parsed)) {
		throw new Error(`${normalizedPath} 不是 JSON 对象`);
	}

	return parsed;
}

function buildSystems(summaries: LoadedSummaryMap): SystemStatus[] {
	return [
		buildSystemStatus('brain', '第二大脑', '第二大脑', summaries.overview),
		buildSystemStatus('math', '数学', '数学系统', summaries.math),
		buildSystemStatus('cs408', '408', '408 系统', summaries.cs408),
		buildSystemStatus('english', '英语', '英语系统', summaries.english),
	];
}

function buildSystemStatus(
	key: Exclude<SystemKey, 'pulse'>,
	label: string,
	shortLabel: string,
	summary: CacheSummary,
): SystemStatus {
	const syncStatus = getStatusSummary(summary, 'sync_status');
	const tutorTopic = getStatusSummary(summary, 'tutor_topic');
	const lintRiskCount = getStringArray(summary, 'lint_risks').length;
	const boundaryCount = getStringArray(summary, 'protected_boundaries').length;
	const dirty = getBooleanLike(summary, 'formal_worktree_dirty');

	return {
		key,
		label,
		shortLabel,
		health: getHealth(summary),
		sync: formatStatus(syncStatus.status, syncStatus.lastSync),
		tutor: tutorTopic.topic || formatStatus(tutorTopic.status),
		protected: dirty ? '正式目录有未提交变更' : `边界已记录 ${boundaryCount} 条`,
		lastLint: lintRiskCount > 0 ? `${lintRiskCount} 项风险` : hasPassedLint(summary) ? '体检通过' : '未记录体检结果',
	};
}

function buildPipeline(summaries: LoadedSummaryMap): DashboardData['pipeline'] {
	const rows = [
		{ system: '第二大脑', summary: summaries.overview },
		{ system: '数学', summary: summaries.math },
		{ system: '408', summary: summaries.cs408 },
		{ system: '英语', summary: summaries.english },
	].map(({ system, summary }) => ({
		system,
		statuses: buildPipelineStatuses(summary),
	}));

	return {
		columns: MOCK_DASHBOARD_DATA.pipeline.columns,
		rows,
	};
}

function buildPipelineStatuses(summary: CacheSummary): PipelineStatus[] {
	const lintRiskCount = getStringArray(summary, 'lint_risks').length;
	const syncStatus = getStatusSummary(summary, 'sync_status').status;
	const tutorStatus = getStatusSummary(summary, 'tutor_topic').status;
	const readinessStatus = getStatusSummary(summary, 'dashboard_readiness').status;

	return [
		statusToPipeline(getStatusSummary(summary, 'intake_status').status, 'pending'),
		statusToPipeline(readinessStatus, 'pending'),
		lintRiskCount > 0 ? 'pending' : hasPassedLint(summary) ? 'done' : 'pending',
		statusToPipeline(readinessStatus, 'pending'),
		statusToPipeline(tutorStatus, 'pending'),
		statusToPipeline(syncStatus, 'pending'),
	];
}

function buildQueue(overview: CacheSummary): DashboardData['queue'] {
	const pendingItems = getStringArray(overview, 'pending_items').slice(0, 5);

	if (pendingItems.length === 0) {
		return [
			{
				title: 'dashboard-cache 暂无待办',
				system: '四系统总控',
				priority: 'low',
				state: '只读',
			},
		];
	}

	return pendingItems.map((item) => ({
		title: shorten(item, 34),
		system: inferSystemLabel(item),
		priority: inferPriority(item),
		state: item.includes('确认') ? '待确认' : '可处理',
	}));
}

function buildBoundaryPairs(summary: CacheSummary): PairItem[] {
	const boundaries = getStringArray(summary, 'protected_boundaries');
	const dirty = getBooleanLike(summary, 'formal_worktree_dirty');
	const syncStatus = getStatusSummary(summary, 'sync_status');

	return [
		{ label: '边界条目', value: `${boundaries.length} 条` },
		{ label: '正式目录', value: dirty ? '有未提交变更，只读展示' : '未记录脏状态' },
		{ label: '同步状态', value: formatStatus(syncStatus.status, syncStatus.lastSync) },
		{ label: '保护原则', value: shorten(boundaries[0] ?? '不写入正式学习系统', 28) },
	];
}

function buildMetrics(summary: CacheSummary): MetricItem[] {
	return [
		{ label: '健康状态', value: getHealth(summary) },
		{ label: '读取评分', value: validScore(getNestedNumber(summary, 'dashboard_readiness', 'score')) },
		{ label: '体检风险', value: knownArrayCount(summary, 'lint_risks'), unit: '项' },
		{ label: '待确认项', value: knownArrayCount(summary, 'pending_items'), unit: '项' },
	];
}

function buildTopics(summary: CacheSummary): string[] {
	const topic = getStatusSummary(summary, 'tutor_topic').topic;
	const pendingItems = getStringArray(summary, 'pending_items')
		.slice(0, 4)
		.map((item) => shorten(item, 18));
	const topics = [topic, ...pendingItems].filter((item): item is string => Boolean(item));

	return topics.length > 0 ? topics : ['待确认'];
}

function buildFeed(summary: CacheSummary): PairItem[] {
	const updates = getArray(summary, 'recent_updates')
		.slice(0, 4)
		.map(updateToPair);

	if (updates.length > 0) {
		return updates;
	}

	return getStringArray(summary, 'pending_items')
		.slice(0, 4)
		.map((item, index) => ({
			label: `待办 ${index + 1}`,
			value: shorten(item, 42),
		}));
}

function buildRiskFeed(summary: CacheSummary): PairItem[] {
	const risks = getStringArray(summary, 'lint_risks').slice(0, 4);

	if (risks.length > 0) {
		return risks.map((risk, index) => ({
			label: `风险 ${index + 1}`,
			value: shorten(risk, 58),
		}));
	}

	return buildFeed(summary);
}

function buildEnglishBank(summary: CacheSummary): PairItem[] {
	const health = getStatusSummary(summary, 'health');
	const lintRiskCount = getStringArray(summary, 'lint_risks').length;
	const pendingCount = getStringArray(summary, 'pending_items').length;

	return [
		{ label: '健康状态', value: formatStatus(health.status) },
		{ label: '体检风险', value: `${lintRiskCount} 项` },
		{ label: '待确认项', value: `${pendingCount} 项` },
		{ label: '长期库边界', value: '只读，不写入' },
	];
}

function buildEnglishStreams(summary: CacheSummary): PairItem[] {
	const boundaries = getStringArray(summary, 'protected_boundaries');

	return [
		{ label: '正式文章', value: hasText(boundaries, 'articles') ? '受保护' : '待确认' },
		{ label: '长期词库', value: hasText(boundaries, 'master_bank') ? '受保护' : '待确认' },
		{ label: '复习文件', value: hasText(boundaries, 'review') ? '受保护' : '待确认' },
		{ label: '原始资料', value: hasText(boundaries, 'raw') ? '只读' : '待确认' },
	];
}

function buildOverviewFunnel(summaries: LoadedSummaryMap): PairItem[] {
	const allRiskCount =
		getStringArray(summaries.overview, 'lint_risks').length +
		getStringArray(summaries.math, 'lint_risks').length +
		getStringArray(summaries.cs408, 'lint_risks').length +
		getStringArray(summaries.english, 'lint_risks').length;
	const allPendingCount =
		getStringArray(summaries.overview, 'pending_items').length +
		getStringArray(summaries.math, 'pending_items').length +
		getStringArray(summaries.cs408, 'pending_items').length +
		getStringArray(summaries.english, 'pending_items').length;

	return [
		{ label: '缓存文件', value: '4 个已读取' },
		{ label: '待确认', value: `${allPendingCount} 项` },
		{ label: '风险提示', value: `${allRiskCount} 项` },
		{ label: '最近生成', value: formatDateTime(getString(summaries.overview, 'generated_at')) },
	];
}

function buildSourceStatus(summaries: LoadedSummaryMap): PairItem[] {
	return [
		{ label: '总览缓存', value: formatStatus(getStatusSummary(summaries.overview, 'dashboard_readiness').status) },
		{ label: '数学缓存', value: formatStatus(getStatusSummary(summaries.math, 'dashboard_readiness').status) },
		{ label: '408 缓存', value: formatStatus(getStatusSummary(summaries.cs408, 'dashboard_readiness').status) },
		{ label: '英语缓存', value: formatStatus(getStatusSummary(summaries.english, 'dashboard_readiness').status) },
	];
}

function buildReadOnlyRuns(overview: CacheSummary): PairItem[] {
	const readiness = getStatusSummary(overview, 'dashboard_readiness');
	const syncStatus = getStatusSummary(overview, 'sync_status');

	return [
		{ label: '数据读取', value: 'dashboard-cache 只读' },
		{ label: '刷新状态', value: formatStatus(readiness.status) },
		{ label: '同步状态', value: formatStatus(syncStatus.status, syncStatus.lastSync) },
		{ label: '按钮动作', value: '仍为模拟，不写入' },
	];
}

function buildOverviewFeeds(overview: CacheSummary): DashboardData['pulse']['feeds'] {
	const pendingBySystem = getArray(overview, 'pending_by_system').slice(0, 3);
	const columns = pendingBySystem.map((item) => {
		const record = isRecord(item) ? item : {};
		const title = getString(record, 'display_name') ?? getString(record, 'system') ?? '系统';
		const pendingItems = getStringArray(record, 'pending_items').slice(0, 3);

		return {
			title,
			items: pendingItems.length > 0 ? pendingItems.map((pending) => shorten(pending, 30)) : ['暂无待办'],
		};
	});

	return [
		...columns,
		{
			title: '总控风险',
			items: getStringArray(overview, 'lint_risks')
				.slice(0, 3)
				.map((risk) => shorten(risk, 30)),
		},
	];
}

function updateToPair(update: unknown): PairItem {
	if (typeof update === 'string') {
		return {
			label: '最近更新',
			value: shorten(update, 58),
		};
	}

	if (!isRecord(update)) {
		return {
			label: '最近更新',
			value: '格式待确认',
		};
	}

	const date = getString(update, 'date');
	const title = getString(update, 'title') ?? getString(update, 'source') ?? '最近更新';
	const summary = getString(update, 'summary') ?? '无摘要';

	return {
		label: date ? `${date} ${title}` : title,
		value: shorten(summary, 58),
	};
}

function statusToPipeline(status: string | null, fallback: PipelineStatus): PipelineStatus {
	if (status === 'complete' || status === 'synced') {
		return 'done';
	}
	if (status === 'ready' || status === 'designed') {
		return 'ready';
	}
	if (status === 'blocked' || status === 'error') {
		return 'blocked';
	}
	if (status === 'candidate' || status === 'partial') {
		return 'pending';
	}
	return fallback;
}

function getHealth(summary: CacheSummary): number | null {
	return validScore(getNestedNumber(summary, 'health', 'score'));
}

function validScore(value: number | null): number | null {
	return value !== null && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function hasPassedLint(summary: CacheSummary): boolean {
	const status = getStatusSummary(summary, 'lint_status').status;
	return status === 'passed' || status === 'pass' || status === 'ok' || status === 'complete';
}

function knownArrayCount(summary: CacheSummary, key: string): number | null {
	return Array.isArray(summary[key]) ? summary[key].length : null;
}

function inferSystemLabel(item: string): string {
	if (item.includes('数学')) {
		return '数学';
	}
	if (item.includes('408')) {
		return '408';
	}
	if (item.includes('英语')) {
		return '英语';
	}
	if (item.includes('Tutor')) {
		return '三科小练';
	}
	return '四系统总控';
}

function inferPriority(item: string): Priority {
	if (item.includes('风险') || item.includes('清洗') || item.includes('修复')) {
		return 'high';
	}
	if (item.includes('确认')) {
		return 'medium';
	}
	return 'low';
}

function formatStatus(status: string | null, lastSync?: string | null): string {
	const label = status ? STATUS_LABELS[status] ?? status : '待确认';
	return lastSync ? `${label} / ${lastSync}` : label;
}

function formatDateTime(value: string | null): string {
	if (!value) {
		return '未记录';
	}

	const [datePart, timePart] = value.split('T');
	const time = timePart?.slice(0, 5);
	return time ? `${datePart} ${time}` : value;
}

function shorten(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength - 1)}…`;
}

function hasText(items: string[], pattern: string): boolean {
	return items.some((item) => item.includes(pattern));
}

function getStatusSummary(
	record: CacheSummary,
	key: string,
): { status: string | null; summary: string | null; topic: string | null; lastSync: string | null } {
	const child = getRecord(record, key);

	return {
		status: child ? getString(child, 'status') : null,
		summary: child ? getString(child, 'summary') : null,
		topic: child ? getString(child, 'topic') : null,
		lastSync: child ? getString(child, 'last_sync') : null,
	};
}

function getRecord(record: CacheSummary, key: string): CacheSummary | null {
	const value = record[key];
	return isRecord(value) ? value : null;
}

function getString(record: CacheSummary, key: string): string | null {
	const value = record[key];
	return typeof value === 'string' ? value : null;
}

function getNestedNumber(record: CacheSummary, key: string, childKey: string): number | null {
	const child = getRecord(record, key);
	if (!child) {
		return null;
	}

	const value = child[childKey];
	return typeof value === 'number' ? value : null;
}

function getBooleanLike(record: CacheSummary, key: string): boolean {
	const value = record[key];
	return value === true || value === 'true';
}

function getStringArray(record: CacheSummary, key: string): string[] {
	return getArray(record, key).filter((item): item is string => typeof item === 'string');
}

function getArray(record: CacheSummary, key: string): unknown[] {
	const value = record[key];
	return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is CacheSummary {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
