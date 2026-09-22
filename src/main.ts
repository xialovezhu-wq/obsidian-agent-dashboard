import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DASHBOARD_VIEW_TYPE } from './data/mockData';
import {
	AgentDashboardSettingTab,
	AgentDashboardSettings,
	DEFAULT_SETTINGS,
} from './settings';
import { AgentDashboardView } from './views/DashboardView';

export default class AgentDashboardPlugin extends Plugin {
	settings!: AgentDashboardSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			DASHBOARD_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new AgentDashboardView(leaf, () => this.settings.dashboardTitle.trim() || DEFAULT_SETTINGS.dashboardTitle),
		);

		this.addRibbonIcon('layout-dashboard', '打开智能体总控台', () => {
			void this.activateDashboardView();
		});

		this.addCommand({
			id: 'open-dashboard',
			name: '打开智能体总控台',
			callback: () => {
				void this.activateDashboardView();
			},
		});

		this.addSettingTab(new AgentDashboardSettingTab(this.app, this));
	}

	onunload() {}

	async activateDashboardView() {
		const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
		const existingLeaf = leaves.find((candidate) => candidate.view instanceof AgentDashboardView);
		const leaf = existingLeaf ?? this.app.workspace.getLeaf(true);
		const shouldReloadExistingView = existingLeaf !== undefined;

		await leaf.setViewState({
			type: DASHBOARD_VIEW_TYPE,
			active: true,
		});
		if (shouldReloadExistingView && leaf.view instanceof AgentDashboardView) {
			await leaf.view.reloadDashboardView();
		}
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	updateDashboardTitles(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)) {
			if (leaf.view instanceof AgentDashboardView) leaf.view.updateDashboardTitle();
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<AgentDashboardSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
