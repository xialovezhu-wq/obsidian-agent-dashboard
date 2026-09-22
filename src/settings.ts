import { App, PluginSettingTab, Setting } from 'obsidian';
import AgentDashboardPlugin from './main';

export interface AgentDashboardSettings {
	dashboardTitle: string;
}

export const DEFAULT_SETTINGS: AgentDashboardSettings = {
	dashboardTitle: '考研智能体总控台',
};

export class AgentDashboardSettingTab extends PluginSettingTab {
	plugin: AgentDashboardPlugin;

	constructor(app: App, plugin: AgentDashboardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('控制台标题')
			.setDesc('显示在控制台顶部。')
			.addText((text) =>
				text
					.setPlaceholder('考研智能体总控台')
					.setValue(this.plugin.settings.dashboardTitle)
					.onChange(async (value) => {
						this.plugin.settings.dashboardTitle = value;
						await this.plugin.saveSettings();
						this.plugin.updateDashboardTitles();
					}),
			);
	}
}
