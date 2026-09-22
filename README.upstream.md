# Obsidian 学习与 Agent 看板

这是一个基于 Obsidian 插件模板开发的本地看板。插件读取四系统生成的摘要缓存，展示学习流程、资料状态、维护结果和操作入口，不将看板数字作为正式学习记录的替代品。

## 开发与安装

```sh
npm ci
npm test
npm run build
```

将构建得到的 `main.js`、`manifest.json`、`styles.css` 放入个人 Vault 的 `.obsidian/plugins/agent-dashboard/`，然后在 Obsidian 中启用。

`src/data/dashboardDataLoader.ts` 定义摘要文件的读取路径；使用者需生成自己的摘要并调整路径。`src/views/` 为页面，`src/data/` 为数据映射，`tests/` 为现有检查。未提供摘要时不能把占位内容当成真实学习结果。

上游模板的许可证保留于 `LICENSE`。

## 公开范围

这是从本机工作源码整理的公开副本。只包含代码、运行逻辑和必要结构，不包含真实学习记录、完整对话、学习画像、健康记录、原始教材、凭据、浏览器数据或运行数据库。路径中的 `YOUR_USER` 必须按本机环境配置。源码检查不代表已在另一台电脑部署成功；本次发布不启动服务、不写入真实学习库。
