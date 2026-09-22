import { App, Modal, Notice } from 'obsidian';
import { SkillAction } from '../data/skillActions';

const RISK_LABELS: Record<SkillAction['risk'], string> = {
	'read-only': '只读 / read-only',
	'local package': '本地会话保存',
	'needs confirmation': '需确认 / needs confirmation',
	'formal write': '正式写入 / formal write',
};

export class SkillPromptModal extends Modal {
	private readonly action: SkillAction;

	constructor(app: App, action: SkillAction) {
		super(app);
		this.action = action;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('agd-skill-modal');

		const headerEl = contentEl.createDiv({ cls: 'agd-skill-modal__header' });
		const titleEl = headerEl.createDiv();
		titleEl.createEl('p', {
			cls: 'agd-panel__kicker',
			text: `${this.action.system} · ${this.action.skillName}`,
		});
		titleEl.createEl('h2', { text: this.action.name });
		headerEl.createSpan({
			cls: `agd-skill-risk agd-skill-risk--${this.action.risk.replaceAll(' ', '-')}`,
			text: RISK_LABELS[this.action.risk],
		});

		contentEl.createEl('p', {
			cls: 'agd-skill-modal__purpose',
			text: this.action.purpose,
		});
		contentEl.createEl('p', {
			cls: 'agd-skill-modal__manual',
			text: 'Manual execution required：插件只生成提示词，不执行 skill、不写入 vault、不调用外部 API。',
		});

		const promptEl = contentEl.createEl('textarea', {
			cls: 'agd-skill-prompt-textarea',
			attr: {
				readonly: 'true',
				'aria-label': `${this.action.name} Codex 提示词`,
			},
		});
		promptEl.value = this.action.prompt;

		const footerEl = contentEl.createDiv({ cls: 'agd-skill-modal__footer' });
		const copyButton = footerEl.createEl('button', {
			cls: 'agd-action-button agd-skill-copy-button',
			text: 'Copy prompt',
			attr: {
				type: 'button',
				'aria-label': '复制 codex 提示词',
			},
		});
		const closeButton = footerEl.createEl('button', {
			cls: 'agd-refresh-button',
			text: '关闭',
			attr: {
				type: 'button',
			},
		});

		copyButton.addEventListener('click', () => {
			void this.copyPrompt();
		});
		closeButton.addEventListener('click', () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
		this.contentEl.removeClass('agd-skill-modal');
	}

	private async copyPrompt(): Promise<void> {
		try {
			await navigator.clipboard.writeText(this.action.prompt);
			new Notice('提示词已复制。请手动粘贴到 codex 对话中执行。');
		} catch {
			new Notice('复制失败，请手动选中文本复制。');
		}
	}
}
