# Pi 中文文档

[Pi Coding Agent 官方文档](https://pi.dev/docs/latest)的非官方简体中文静态站点。

## 本地运行

~~~powershell
npm ci --ignore-scripts
npm run dev:pages
~~~

## 构建 GitHub Pages 版本

~~~powershell
npm run build:pages
~~~

静态文件会生成到 dist-pages。构建配置会在 GitHub Actions 中自动读取仓库名称：

- 普通项目仓库发布到 https://用户名.github.io/仓库名/
- 名称为 用户名.github.io 的仓库发布到根路径

## 自动部署

.github/workflows/deploy-pages.yml 会在推送到 main 或 master 后自动构建并部署。

首次部署前，在 GitHub 仓库中进入 Settings → Pages，将 Source 设为 GitHub Actions。