# 快速开始

本页将带你从安装开始，直到完成第一个实用的 pi 会话。

## 安装

Pi 以 npm 包形式发布：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装期间禁用依赖项生命周期脚本。正常通过 npm 安装 Pi 不需要运行安装脚本。

### 卸载

请使用安装 pi 时所用的包管理器。curl 安装程序会在全局使用 npm，因此 curl 和 npm 安装都通过 npm 移除：

```bash
# curl installer or npm install -g
npm uninstall -g @earendil-works/pi-coding-agent

# pnpm
pnpm remove -g @earendil-works/pi-coding-agent

# Yarn
yarn global remove @earendil-works/pi-coding-agent

# Bun
bun uninstall -g @earendil-works/pi-coding-agent
```

卸载 pi 后，设置、凭据、会话和已安装的 pi 包仍会保留在 `~/.pi/agent/` 中。

随后，在希望 pi 执行工作的项目目录中启动它：

```bash
cd /path/to/project
pi
```

## 身份验证

Pi 可以通过 `/login` 使用订阅提供商，也可以通过环境变量或身份验证文件使用 API 密钥提供商。

### 选项 1：订阅登录

启动 pi 并运行：

```text
/login
```

然后选择提供商。内置订阅登录包括 Claude Pro/Max、ChatGPT Plus/Pro (Codex) 和 GitHub Copilot。

### 选项 2：API 密钥

启动 pi 前设置 API 密钥：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

也可以运行 `/login` 并选择 API 密钥提供商，将密钥存储在 `~/.pi/agent/auth.json` 中。

所有受支持的提供商、环境变量和云提供商设置请参阅[提供商](providers.md)。

## 第一个会话

pi 启动后，输入请求并按 Enter：

```text
Summarize this repository and tell me how to run its checks.
```

默认情况下，pi 会为模型提供四个工具：

- `read` - 读取文件
- `write` - 创建或覆盖文件
- `edit` - 修补文件
- `bash` - 运行 shell 命令

通过工具选项还可以使用其他内置只读工具（`grep`、`find`、`ls`）。Pi 在当前工作目录中运行，并可修改其中的文件。如果希望轻松回滚，请使用 git 或其他检查点工作流。

## 向 pi 提供项目指令

Pi 启动时会加载上下文文件。添加 `AGENTS.md` 文件，告诉它应如何在项目中工作：

```markdown
# Project Instructions

- Run `npm run check` after code changes.
- Do not run production migrations locally.
- Keep responses concise.
```

Pi 会加载：

- `~/.pi/agent/AGENTS.md`，用于全局指令
- 父目录和当前目录中的 `AGENTS.md` 或 `CLAUDE.md`

更改上下文文件后，请重启 pi 或运行 `/reload`。

## 常见尝试

### 引用文件

在编辑器中输入 `@` 可模糊搜索文件，也可以在命令行中传入文件：

```bash
pi @README.md "Summarize this"
pi @src/app.ts @src/app.test.ts "Review these together"
```

可使用 Ctrl+V（Windows 上为 Alt+V）粘贴图片或文本；在支持的终端中，也可以将图片拖入。

### 运行 shell 命令

在交互模式中：

```text
!npm run lint
```

命令输出会发送给模型。使用 `!!command` 可运行命令，而不将其输出加入模型上下文。

### 切换模型

使用 `/model` 或 Ctrl+L 选择模型。使用 Shift+Tab 循环切换思考级别。使用 Ctrl+P / Shift+Ctrl+P 在限定范围的模型间循环切换。

### 稍后继续

会话会自动保存：

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse previous sessions
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Open a specific session
```

在 pi 中，使用 `/resume`、`/new`、`/tree`、`/fork` 和 `/clone` 管理会话。

### 非交互模式

对于一次性提示词：

```bash
pi -p "Summarize this codebase"
cat README.md | pi -p "Summarize this text"
pi -p @screenshot.png "What's in this image?"
```

使用 `--mode json` 可获得 JSON 事件输出，使用 `--mode rpc` 可进行进程集成。

## 后续步骤

- [使用 Pi](usage.md) - 交互模式、斜杠命令、会话、上下文文件和 CLI 参考。
- [提供商](providers.md) - 身份验证和模型设置。
- [设置](settings.md) - 全局和项目配置。
- [快捷键](keybindings.md) - 快捷键和自定义。
- [Pi 包](packages.md) - 安装共享的扩展、技能、提示词和主题。

平台说明：[Windows](windows.md)、[Termux](termux.md)、[tmux](tmux.md)、[终端设置](terminal-setup.md)、[Shell 别名](shell-aliases.md)。
