# 使用 Pi

本页汇集快速入门页面未涵盖的日常使用细节。

## 交互模式

<p align="center"><img src="images/interactive-mode.png" alt="交互模式" width="600"></p>

界面包含四个主要区域：

- **启动标头** - 快捷键、已加载的上下文文件、提示词模板、技能和扩展
- **消息** - 用户消息、助手回复、工具调用、工具结果、通知、错误和扩展 UI
- **编辑器** - 输入内容的位置；边框颜色表示当前思考级别
- **页脚** - 工作目录、会话名称、令牌/缓存用量、成本、上下文用量和当前模型

编辑器可以暂时由 `/settings` 等内置 UI 或自定义扩展 UI 替代。

### 编辑器功能

| 功能 | 操作方式 |
|---------|-----|
| 文件引用 | 输入 `@` 模糊搜索项目文件 |
| 路径补全 | 按 Tab 补全路径 |
| 多行输入 | Shift+Enter；Windows Terminal 中也可用 Ctrl+Enter |
| 复制回复 | Ctrl+X 复制最后一条助手消息；在 `/tree` 中复制所选消息 |
| 图片 | 使用 Ctrl+V 粘贴，Windows 上使用 Alt+V，或拖入终端 |
| Shell 命令 | `!command` 运行命令并将输出发送给模型 |
| 隐藏 Shell 命令 | `!!command` 运行命令但不将输出发送给模型 |
| 外部编辑器 | Ctrl+G 依次尝试打开 `externalEditor`、`$VISUAL`、`$EDITOR`、Windows 上的记事本或其他平台上的 `nano` |

所有快捷键和自定义方式请参阅[快捷键](keybindings.md)。

## 斜杠命令

在编辑器中输入 `/` 可打开命令补全。扩展可以注册自定义命令；技能以 `/skill:name` 提供；提示词模板通过 `/templatename` 展开。

| 命令 | 说明 |
|---------|-------------|
| `/login`、`/logout` | 管理 OAuth 或 API 密钥凭据 |
| [`/llama`](llama-cpp.md) | 下载、加载和卸载 llama.cpp 路由器模型 |
| `/model` | 切换模型 |
| `/scoped-models` | 为 Ctrl+P 循环切换启用/禁用模型 |
| `/settings` | 思考级别、主题、消息递送和传输方式 |
| `/resume` | 从过往会话中选择 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置会话显示名称 |
| `/session` | 显示会话文件、ID、消息、令牌和成本 |
| `/tree` | 跳转到会话中的任意位置并从那里继续 |
| `/trust` | 保存项目信任决定供后续会话使用 |
| `/fork` | 从之前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制为新会话 |
| `/compact [prompt]` | 手动压缩上下文，可选用自定义指令 |
| `/copy` | 将最后一条助手消息复制到剪贴板 |
| `/export [file]` | 将会话导出为 HTML 或 JSONL |
| `/import <file>` | 从 JSONL 文件导入并恢复会话 |
| `/share` | 上传为私有 GitHub gist，并提供可共享的 HTML 链接 |
| `/reload` | 重新加载键绑定、扩展、技能、提示词、主题和上下文文件 |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit` | 退出 pi |

## 消息队列

代理仍在工作时也可以提交消息：

- **Enter** 将引导消息加入队列，在当前助手轮次执行完工具调用后递送。
- **Alt+Enter** 将后续消息加入队列，在代理完成全部工作后递送。
- **Escape** 中止操作，并将排队消息恢复到编辑器。
- **Alt+Up** 将排队消息取回编辑器。

Windows Terminal 默认将 Alt+Enter 用作全屏快捷键。如果希望 pi 接收此快捷键，请按[终端设置](terminal-setup.md)中的说明重新映射。

可在[设置](settings.md)中使用 `steeringMode` 和 `followUpMode` 配置递送方式。

## 会话

会话自动保存到 `~/.pi/agent/sessions/`，并按工作目录组织。

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse and select a session
pi --no-session        # Ephemeral mode; do not save
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Use a specific session file or session ID
pi --fork <path|id>    # Fork a session into a new session file
```

实用的会话命令：

- `/session` 显示当前会话文件和 ID。
- `/tree` 浏览文件内的会话树，并可对已放弃的分支生成摘要。
- `/fork` 从较早的用户消息创建新会话。
- `/clone` 将当前活动分支复制到新的会话文件。
- `/compact` 汇总较早消息以释放上下文。

详情请参阅[会话](sessions.md)和[压缩](compaction.md)。

## 上下文文件

Pi 启动时从以下位置加载 `AGENTS.md` 或 `CLAUDE.md`：

- `~/.pi/agent/AGENTS.md`，用于全局指令
- 从当前工作目录向上查找的父目录
- 当前目录

上下文文件可用于项目约定、命令、安全规则和偏好。使用 `--no-context-files` 或 `-nc` 禁用加载。

### 系统提示词文件

使用以下文件替换默认系统提示词：

- 项目中的 `.pi/SYSTEM.md`
- 全局的 `~/.pi/agent/SYSTEM.md`

在任一位置使用 `APPEND_SYSTEM.md`，可追加到默认提示词而不替换它。

### 项目信任

交互启动时，如果项目文件夹包含项目本地设置、资源或项目 `.agents/skills`，且 `~/.pi/agent/trust.json` 中没有针对该文件夹或父文件夹的已保存决定，pi 会先询问是否信任。信任项目后，pi 可加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失的项目包，并执行项目扩展。

在作出信任决定前，pi 仅加载上下文文件、用户/全局扩展和 CLI `-e` 扩展，以便它们处理 `project_trust` 事件。项目本地扩展、项目包管理的扩展和项目设置，仅在项目获信任后加载。切换到另一个当前工作目录的会话，而该目录的信任在当前进程中尚未确定时，也适用这种区分。

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不显示信任提示。若没有适用的已保存信任决定，它们会使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 会忽略这些项目资源，`always` 则信任它们。传入 `--approve`/`-a` 或 `--no-approve`/`-na` 可针对单次运行覆盖项目信任。

如果没有扩展或已保存决定适用，`defaultProjectTrust` 控制回退行为。可在 `~/.pi/agent/settings.json` 中将其设为 `"ask"`、`"always"` 或 `"never"`，也可通过 `/settings` 更改。

`pi config` 和包命令采用同样的项目信任流程，但 `pi update` 从不提示。传入 `--approve` 可针对单次命令信任项目本地设置，传入 `--no-approve` 可忽略它们。

在交互模式中使用 `/trust`，可以保存项目信任决定供后续会话使用，其中也包括对直接父文件夹的信任。它只写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此需要重启 pi 才能生效。

## 导出和共享会话

使用 `/export [file]` 将会话写入 HTML。

使用 `/share` 上传私有 GitHub gist，并获得可共享的 HTML 链接。

如果使用 pi 开展开源工作，并希望发布会话用于模型、提示词、工具和评估研究，请参阅 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。它会将会话发布到 Hugging Face 数据集。

## CLI 参考

```bash
pi [options] [@files...] [messages...]
```

### 包命令

```bash
pi install <source> [-l]     # Install package, -l for project-local
pi remove <source> [-l]      # Remove package
pi uninstall <source> [-l]   # Alias for remove
pi update [source|self|pi]   # Update pi only, or one package source
pi update --all              # Update pi and packages; reconcile pinned git refs
pi update --extensions       # Update packages only; reconcile pinned git refs
pi update --models           # Refresh model catalogs only
pi update --self             # Update pi only
pi update --extension <src>  # Update one package
pi list                      # List installed packages
pi config                    # Enable/disable package resources
```

这些命令用于管理 pi 包，`pi update` 还可更新 pi CLI 安装。卸载 pi 本身请参阅[快速入门](quickstart.md#卸载)。`pi config` 和项目包命令接受 `--approve`/`--no-approve`，以针对单次命令信任或忽略项目本地设置。`pi update` 从不提示项目信任。

包来源和安全说明请参阅 [Pi 包](packages.md)。

### 模式

| 标志 | 说明 |
|------|-------------|
| 默认 | 交互模式 |
| `-p`、`--print` | 打印回复并退出 |
| `--mode json` | 将所有事件输出为 JSON 行；参阅 [JSON 模式](json.md) |
| `--mode rpc` | 通过 stdin/stdout 使用 RPC 模式；参阅 [RPC 模式](rpc.md) |
| `--export <in> [out]` | 将会话导出为 HTML |

在打印模式中，pi 还会读取管道传入的 stdin，并将其合并到初始提示词：

```bash
cat README.md | pi -p "Summarize this text"
```

### 模型选项

| 选项 | 说明 |
|--------|-------------|
| `--provider <name>` | 提供商，例如 `anthropic`、`openai` 或 `google` |
| `--model <pattern>` | 模型模式或 ID；支持 `provider/id` 和可选的 `:<thinking>` |
| `--api-key <key>` | API 密钥，覆盖环境变量 |
| `--thinking <level>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <patterns>` | 用于 Ctrl+P 循环切换的逗号分隔模式 |
| `--list-models [search]` | 列出可用模型 |

### 会话选项

| 选项 | 说明 |
|--------|-------------|
| `-c`、`--continue` | 继续最近的会话 |
| `-r`、`--resume` | 浏览并选择会话 |
| `--session <path\|id>` | 使用指定会话文件或部分 UUID |
| `--fork <path\|id>` | 将会话文件或部分 UUID 分叉为新会话 |
| `--session-dir <dir>` | 自定义会话存储目录 |
| `--no-session` | 临时模式；不保存 |
| `--name <name>`、`-n <name>` | 启动时设置会话显示名称 |

### 工具选项

| 选项 | 说明 |
|--------|-------------|
| `--tools <list>`、`-t <list>` | 仅允许指定的内置、扩展和自定义工具 |
| `--exclude-tools <list>`、`-xt <list>` | 禁用指定的内置、扩展和自定义工具 |
| `--no-builtin-tools`、`-nbt` | 禁用内置工具，但保留扩展/自定义工具 |
| `--no-tools`、`-nt` | 禁用所有工具 |

内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`。

### 资源选项

| 选项 | 说明 |
|--------|-------------|
| `-e`、`--extension <source>` | 从路径、npm 或 git 加载扩展；可重复指定 |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载技能；可重复指定 |
| `--no-skills` | 禁用技能发现 |
| `--prompt-template <path>` | 加载提示词模板；可重复指定 |
| `--no-prompt-templates` | 禁用提示词模板发现 |
| `--theme <path>` | 加载主题；可重复指定 |
| `--no-themes` | 禁用主题发现 |
| `--no-context-files`、`-nc` | 禁用 `AGENTS.md` 和 `CLAUDE.md` 发现 |

将 `--no-*` 与显式标志组合，可忽略设置，只加载所需内容。例如：

```bash
pi --no-extensions -e ./my-extension.ts
```

### 其他选项

| 选项 | 说明 |
|--------|-------------|
| `--system-prompt <text>` | 替换默认提示词；仍会追加上下文文件和技能 |
| `--append-system-prompt <text>` | 追加到系统提示词 |
| `--verbose` | 强制显示详细启动信息 |
| `-a`、`--approve` | 针对此次运行信任项目本地文件 |
| `-na`、`--no-approve` | 针对此次运行忽略项目本地文件 |
| `-h`、`--help` | 显示帮助 |
| `-v`、`--version` | 显示版本 |

### 文件参数

为文件添加 `@` 前缀以将其包含在消息中：

```bash
pi @prompt.md "Answer this"
pi -p @screenshot.png "What's in this image?"
pi @code.ts @test.ts "Review these files"
```

### 示例

```bash
# Interactive with initial prompt
pi "List all .ts files in src/"

# Non-interactive
pi -p "Summarize this codebase"

# Non-interactive with piped stdin
cat README.md | pi -p "Summarize this text"

# Named one-shot session
pi --name "release audit" -p "Audit this repository"

# Different model
pi --provider openai --model gpt-4o "Help me refactor"

# Model with provider prefix
pi --model openai/gpt-4o "Help me refactor"

# Model with thinking level shorthand
pi --model sonnet:high "Solve this complex problem"

# Limit model cycling
pi --models "claude-*,gpt-4o"

# Read-only mode
pi --tools read,grep,find,ls -p "Review the code"

# Disable one extension or built-in tool while keeping the rest available
pi --exclude-tools ask_question
```

### 环境变量

| 变量 | 说明 |
|----------|-------------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录；默认为 `~/.pi/agent` |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储目录；会被 `--session-dir` 覆盖 |
| `PI_PACKAGE_DIR` | 覆盖包目录，适用于 Nix/Guix 存储路径 |
| `PI_OFFLINE` | 禁用启动时的网络操作，包括更新检查、包更新检查和安装/更新遥测 |
| `PI_SKIP_VERSION_CHECK` | 跳过启动时的 Pi 版本更新检查，阻止向 `pi.dev` 请求最新版本 |
| `PI_TELEMETRY` | 覆盖安装/更新遥测和提供商归因标头：`1`/`true`/`yes` 或 `0`/`false`/`no`。这不会禁用更新检查 |
| `PI_CACHE_RETENTION` | 在支持时设为 `long` 以使用扩展的提示词缓存 |
| `VISUAL`、`EDITOR` | 未设置 `externalEditor` 时供 Ctrl+G 使用的备用外部编辑器；Windows 默认为记事本，其他平台默认为 `nano` |

## 设计原则

Pi 保持核心小巧，并将工作流特定行为放入扩展、技能、提示词模板和包中。

它有意不内置 MCP、子代理、权限弹窗、计划模式、待办事项或后台 bash。你可以通过扩展或包构建或安装这些工作流，也可以使用容器和 tmux 等外部工具。

完整设计理由请阅读[博客文章](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。
