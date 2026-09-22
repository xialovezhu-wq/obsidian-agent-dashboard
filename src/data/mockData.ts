export type SystemKey = 'brain' | 'math' | 'cs408' | 'english' | 'pulse';

export type PipelineStatus = 'done' | 'ready' | 'pending' | 'blocked' | 'locked';

export type Priority = 'high' | 'medium' | 'low';

export interface SystemStatus {
	key: Exclude<SystemKey, 'pulse'>;
	label: string;
	shortLabel: string;
	health: number | null;
	sync: string;
	tutor: string;
	protected: string;
	lastLint: string;
}

export interface QueueItem {
	title: string;
	system: string;
	priority: Priority;
	state: string;
}

export interface MetricItem {
	label: string;
	value: number | null;
	unit?: string;
}

export interface PairItem {
	label: string;
	value: string;
}

export interface NetworkStat {
	label: string;
	value: number | null;
}

export interface ExternalFeed {
	title: string;
	items: string[];
}

export interface DashboardData {
	systems: SystemStatus[];
	pipeline: {
		columns: string[];
		rows: {
			system: string;
			statuses: PipelineStatus[];
		}[];
	};
	queue: QueueItem[];
	math: {
		locks: PairItem[];
		gaps: MetricItem[];
		topics: string[];
		feed: PairItem[];
	};
	cs408: {
		locks: PairItem[];
		stats: NetworkStat[];
		topics: string[];
		feed: PairItem[];
	};
	english: {
		bank: PairItem[];
		streams: PairItem[];
		logic: string[];
		feed: PairItem[];
	};
	pulse: {
		funnel: PairItem[];
		sources: PairItem[];
		runs: PairItem[];
		feeds: ExternalFeed[];
	};
	actions: string[];
	views: {
		id: ViewId;
		label: string;
		key: string;
		system?: SystemKey;
	}[];
}

export type ViewId = 'overview' | 'math' | 'cs408' | 'english' | 'pulse';

export const DASHBOARD_VIEW_TYPE = 'agent-dashboard-view';

export const HEATMAP_SYSTEMS: Exclude<SystemKey, 'pulse'>[] = [
	'brain',
	'math',
	'cs408',
	'english',
];

export const SYSTEM_LABELS: Record<Exclude<SystemKey, 'pulse'>, string> = {
	brain: '第二大脑',
	math: '数学',
	cs408: '408',
	english: '英语',
};

export const MOCK_DASHBOARD_DATA: DashboardData = {
	actions: [
		'新建日记',
		'深度研究',
		'生成同步包',
		'收件箱入库',
		'库内体检',
		'专题小练',
		'打开外部脉搏',
	],
	views: [
		{ id: 'overview', label: '总览', key: '总', system: 'brain' },
		{ id: 'math', label: '数学', key: '数', system: 'math' },
		{ id: 'cs408', label: '408', key: '408', system: 'cs408' },
		{ id: 'english', label: '英语', key: '英', system: 'english' },
		{ id: 'pulse', label: '外部脉搏', key: '脉', system: 'pulse' },
	],
	systems: [
		{
			key: 'brain',
			label: '第二大脑',
			shortLabel: '第二大脑',
			health: 88,
			sync: '可同步',
			tutor: '过程记录路由',
			protected: '状态文件受保护',
			lastLint: '体检通过',
		},
		{
			key: 'math',
			label: '数学',
			shortLabel: '数学系统',
			health: 84,
			sync: '同步包已就绪',
			tutor: '条件边界与分类讨论',
			protected: '错题网络锁定',
			lastLint: '体检通过',
		},
		{
			key: 'cs408',
			label: '408',
			shortLabel: '408 系统',
			health: 81,
			sync: '复盘报告待审',
			tutor: '状态转移与边界条件',
			protected: '复做答案隐藏',
			lastLint: '2 项风险',
		},
		{
			key: 'english',
			label: '英语',
			shortLabel: '英语系统',
			health: 86,
			sync: '同步包已就绪',
			tutor: '长难句限定条件与转折逻辑',
			protected: '长期词库已锁定',
			lastLint: '体检通过',
		},
	],
	pipeline: {
		columns: ['收集', '查询', '体检', '查看', '小练', '同步'],
		rows: [
			{
				system: '第二大脑',
				statuses: ['done', 'ready', 'done', 'ready', 'pending', 'ready'],
			},
			{
				system: '数学',
				statuses: ['done', 'ready', 'done', 'ready', 'ready', 'locked'],
			},
			{
				system: '408',
				statuses: ['done', 'ready', 'pending', 'ready', 'ready', 'locked'],
			},
			{
				system: '英语',
				statuses: ['ready', 'ready', 'done', 'ready', 'pending', 'ready'],
			},
		],
	},
	queue: [
		{
			title: '同步包待审阅',
			system: '第二大脑 / 数学',
			priority: 'high',
			state: '可处理',
		},
		{
			title: '小练专题待确认',
			system: '数学 / 408 / 英语',
			priority: 'medium',
			state: '待确认',
		},
		{
			title: '体检风险待处理',
			system: '408',
			priority: 'high',
			state: '阻塞',
		},
		{
			title: '控制台待接真实数据',
			system: '插件面板',
			priority: 'medium',
			state: '排队中',
		},
		{
			title: '第二大脑总控整合待执行',
			system: '第二大脑',
			priority: 'low',
			state: '可处理',
		},
	],
	math: {
		locks: [
			{ label: '正式错题卡', value: '已锁定' },
			{ label: '生成目录', value: '只读' },
			{ label: '回滚账本', value: '已锁定' },
			{ label: '小练结果', value: '不回写' },
		],
		gaps: [
			{ label: '触发意识', value: 82 },
			{ label: '链路组织', value: 68 },
			{ label: '验算检查', value: 74 },
			{ label: '计算稳定', value: 58 },
		],
		topics: ['条件边界与分类讨论', '端点意识', '参数范围', '分段讨论', '定义域检查'],
		feed: [
			{ label: '数学同步包', value: '已就绪，仅模拟' },
			{ label: '二次验收', value: '等待人工确认' },
			{ label: 'Obsidian 命令行验收', value: '本面板未连接' },
			{ label: '错题网络保护', value: '源卡片未改动' },
		],
	},
	cs408: {
		locks: [
			{ label: '正式节点', value: '已锁定' },
			{ label: '关系边', value: '已锁定' },
			{ label: '专题链', value: '已锁定' },
			{ label: '复做记录', value: '已锁定' },
			{ label: '复盘输出', value: '已锁定' },
		],
		stats: [
			{ label: '节点', value: 128 },
			{ label: '关系边', value: 276 },
			{ label: '专题链', value: 18 },
			{ label: '体检风险', value: 4 },
		],
		topics: ['状态转移', '边界条件', '缓存/替换策略', '协议状态', '调度与队列'],
		feed: [
			{ label: '历史定位索引可能有答案风险', value: '展示前需要复核' },
			{ label: '标签暂缺', value: '需核对本地标签表' },
			{ label: '一个未解析链接', value: '等待定位来源' },
			{ label: '输出层需要复做保护', value: '答案继续隐藏' },
		],
	},
	english: {
		bank: [
			{ label: '长期词库表', value: '562 行' },
			{ label: '13 列结构', value: '有效' },
			{ label: '周复盘文件', value: '未改动' },
			{ label: '疑似重复项', value: '3 条' },
		],
		streams: [
			{ label: '精读文章', value: '可用' },
			{ label: '视频语料', value: '待确认' },
			{ label: '音频语料', value: '空' },
			{ label: '网页材料', value: '可用' },
			{ label: '摘要工具来源', value: '待确认' },
		],
		logic: ['对照结构', '除非条件', '方式关系', '地点限定', '递进并列', '让步转折'],
		feed: [
			{ label: '小练接入方案', value: '长难句逻辑小练排队中' },
			{ label: '英语同步包', value: '已就绪' },
			{ label: '体检报告', value: '表格列数有效' },
			{ label: '原始视频待确认', value: '不写入长期库' },
		],
	},
	pulse: {
		funnel: [
			{ label: '已抓取', value: '42 条原始信号' },
			{ label: '已筛选', value: '保留 13 条' },
			{ label: '已简报', value: '5 条短摘要' },
			{ label: '已保存', value: '0 次本地写入' },
		],
		sources: [
			{ label: '代码平台', value: '可用' },
			{ label: '订阅源', value: '可用' },
			{ label: '技术社区', value: '已筛选' },
			{ label: '视频平台', value: '待确认' },
			{ label: '摘要工具', value: '暂存' },
		],
		runs: [
			{ label: '深度研究', value: '空闲' },
			{ label: '库内体检', value: '排队中' },
			{ label: '收件箱入库', value: '可执行' },
			{ label: '同步包复核', value: '模拟运行中' },
		],
		feeds: [
			{
				title: '代码仓库',
				items: ['Obsidian 插件模式', '本地优先控制台', '智能体工作流笔记'],
			},
			{
				title: '技术社区',
				items: ['专注用小工具', '离线优先界面笔记', '大模型工作流讨论'],
			},
			{
				title: '视频材料',
				items: ['学习系统演示', 'Obsidian 插件评测', '智能体操作台'],
			},
			{
				title: '订阅文章',
				items: ['个人知识库体检方法', '考试复习节奏', '本地研究循环'],
			},
		],
	},
};
