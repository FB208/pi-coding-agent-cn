# 项目维护与发布规则

- 本项目同时保留 GitHub Pages 和 Codex Sites（chatgpt.site）两种部署方式，共用同一份源码。
- 任何会影响网站内容、样式、交互或构建配置的改动完成后，必须依次运行：
  - npm run build:pages
  - npm run build
- 两项构建均成功后，如果当前任务运行在 Codex 中且 Sites 连接器可用，应自动将已验证版本发布到现有 chatgpt.site 项目，无需等待用户再次要求发布。
- GitHub Pages 由 .github/workflows/deploy-pages.yml 在代码推送到 main 或 master 后自动发布。
- 只读检查、讨论方案、构建失败或用户明确要求暂不发布时，不得触发任何线上发布。
- 发布时必须复用 .openai/hosting.json 中的现有 project_id，禁止创建重复的 Sites 项目。
- 不得将 Sites 的短期源码凭据、部署令牌或其他密钥写入仓库、GitHub Secrets、日志或文档。