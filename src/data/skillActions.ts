export type SkillActionSystem = '数学' | '408' | '英语' | '总控';

export type SkillActionRisk = 'read-only' | 'local package' | 'needs confirmation' | 'formal write';

export interface SkillAction {
	id: string;
	system: SkillActionSystem;
	name: string;
	skillName: string;
	risk: SkillActionRisk;
	purpose: string;
	prompt: string;
}

const PROMPT_PREFIX = '请在 Codex 中执行以下请求。此插件仅供复制，不会执行 Skill 或连接外部服务。';

export const SKILL_ACTIONS: SkillAction[] = [
	{
		id: 'kaoyan-math-wrong-intake',
		system: '数学',
		name: '数学快速保存',
		skillName: '$kaoyan-math-wrong-intake',
		risk: 'local package',
		purpose: '保存当前真实题目的完整会话与可用附件。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-math-wrong-intake，快速入库当前这一道真实数学题。
保留本题完整相关会话、题面、用户作答、解析及当前可用附件，来源与编号按真实证据填写，缺失明确记录。
本次只保存不可变会话包，不做正式编纂，不推断掌握度，不改正式错题卡或回滚账本。`,
	},
	{
		id: 'kaoyan-math-nightly-qa',
		system: '数学',
		name: '数学正式编纂',
		skillName: '$kaoyan-math-nightly-qa',
		risk: 'formal write',
		purpose: '按截止日期或精确集合完成数学正式入库与归档。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-math-nightly-qa，完成数学正式入库。
截止日期或精确 capture/package 集合：
按本科当前事务处理全部指定范围，保留原始学习日期、完整材料与个人证据；已提交项目只恢复尚缺归档，不重复正式写入。`,
	},
	{
		id: 'kaoyan-math-daily-filter',
		system: '数学',
		name: '数学学习后旧题筛选',
		skillName: '$kaoyan-math-daily-filter',
		risk: 'read-only',
		purpose: '从已完成的本轮学习证据筛选适合迁移检查的旧题。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-math-daily-filter。
本轮已完成且正式入库的题目 ID：
按当前个人缺口筛选至多五道合格旧题；遵守 Day 0–7 与独立正确排除，合格不足时少于五题。保护未揭示答案，不把学习前热身与学习后筛选混用。`,
	},
	{
		id: 'kaoyan-math-visual-review',
		system: '数学',
		name: '数学可视化复盘稿',
		skillName: '$kaoyan-math-visual-review',
		risk: 'read-only',
		purpose: '按已核实的学习证据整理数学复盘。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-math-visual-review，生成数学复盘稿。
日期与学习范围：
输出形式：Markdown / HTML。
仅使用真实学习证据，保护未揭示答案；不修改正式错题卡、生成索引或回滚账本。`,
	},
	{
		id: 'kaoyan-408-wrong-intake',
		system: '408',
		name: '408 快速保存',
		skillName: '$kaoyan-408-wrong-intake',
		risk: 'local package',
		purpose: '保存当前真实题目的完整会话、材料与作答证据。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-408-wrong-intake，快速入库当前这一道真实 408 题。
保留完整相关会话、题干、选项、用户作答、解析及当前可用附件，来源标签以实际证据为准。
按本科当前终态与 Capture 合同保存；本次不改正式表，不做正式编纂，不推断独立掌握。`,
	},
	{
		id: 'kaoyan-408-question-worker',
		system: '408',
		name: '408 当前题讲解',
		skillName: '$kaoyan-408-question-worker',
		risk: 'read-only',
		purpose: '围绕题面与真实作答定位当前断点。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-408-question-worker。
当前题面与来源：
我的作答和理由：
需要保护的答案：
按本题证据反馈；没有明确快速入库请求时不写学习数据。`,
	},
	{
		id: 'kaoyan-408-daily-intake-curation',
		system: '408',
		name: '408 正式编纂',
		skillName: '$kaoyan-408-daily-intake-curation',
		risk: 'formal write',
		purpose: '按截止日或精确集合完成本科正式编纂。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-408-daily-intake-curation，完成 408 正式入库。
截止日期或精确集合：
沿本科当前串行事务处理完整指定范围，保留原日期与真实作答证据；不重复已完成的正式写入。`,
	},
	{
		id: 'kaoyan-english-reading-intake',
		system: '英语',
		name: '英语阅读材料保存',
		skillName: '$kaoyan-english-reading-intake',
		risk: 'local package',
		purpose: '保存完整阅读材料、题目、解析及来源。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-english-reading-intake。
年份 / Text 与来源：
原文、题目、选项、解析和当前附件：
保存完整材料和本段会话包，缺失来源明确记录；不写正式词库，不进行语义预处理或后台处理。`,
	},
	{
		id: 'kaoyan-english-intensive-reading',
		system: '英语',
		name: '英语逐句精读',
		skillName: '$kaoyan-english-intensive-reading',
		risk: 'local package',
		purpose: '从原句与首译定位第一处意义偏差。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-english-intensive-reading。
当前原句：
我的首译或疑问：
需要保护的答案：
按当前证据指出第一处意义偏差，解释深度服从本科教法；完整保存本段会话，不做正式词库写入或后台处理。`,
	},
	{
		id: 'kaoyan-english-vocab-export',
		system: '英语',
		name: '英语不背单词导出',
		skillName: '$kaoyan-english-vocab-export',
		risk: 'read-only',
		purpose: '整篇结束后输出有来源的 A/B/C 词汇清单。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-english-vocab-export。整篇已结束。
文章身份或路径：
根据完整会话包与本科规则输出 A/B/C 清单；不写正式词库，不补造用户不会或已掌握的词。`,
	},
	{
		id: 'kaoyan-english-daily-intake-curation',
		system: '英语',
		name: '英语正式编纂',
		skillName: '$kaoyan-english-daily-intake-curation',
		risk: 'formal write',
		purpose: '按截止日期完成英语正式入库。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-english-daily-intake-curation，完成英语正式入库。
截止日期或精确集合：
保留原学习日期、完整来源与真实首译/纠正证据；沿本科事务验证正式写入和归档，不重复已完成项目。`,
	},
	{
		id: 'kaoyan-dashboard-summary',
		system: '总控',
		name: '刷新 Dashboard 摘要',
		skillName: '$kaoyan-dashboard-summary',
		risk: 'needs confirmation',
		purpose: '更新只读看板使用的摘要文件。',
		prompt: `${PROMPT_PREFIX}

请使用 $kaoyan-dashboard-summary。
目标系统：math / 408 / english / second-brain。
只更新对应摘要与看板缓存，说明输出路径并验证 JSON；不修改正式学习数据、回滚账本或私人原始记录。`,
	},
];
