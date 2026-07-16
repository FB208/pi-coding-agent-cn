# 会话

Pi 会将对话保存为会话，因此你可以继续工作、从早先的轮次创建分支，以及重新访问之前的路径。

## 会话存储

会话会自动保存到 `~/.pi/agent/sessions/`，并按工作目录组织。每个会话都是一个采用树形结构的 JSONL 文件。

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse and select from past sessions
pi --no-session        # Ephemeral mode; do not save
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Use a specific session file or partial session ID
pi --fork <path|id>    # Fork a session file or partial session ID into a new session
```

在交互模式中使用 `/session` 可查看当前会话文件、会话 ID、消息数、令牌数和费用。

有关 JSONL 文件格式和 SessionManager API，请参阅[会话格式](session-format.md)。

## 会话命令

| 命令 | 说明 |
|---------|-------------|
| `/resume` | 浏览并选择以前的会话 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置当前会话的显示名称 |
| `/session` | 显示会话信息 |
| `/tree` | 浏览当前会话树 |
| `/fork` | 从以前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制到新会话 |
| `/compact [prompt]` | 总结较早的上下文；参阅[压缩](compaction.md) |
| `/export [file]` | 将会话导出为 HTML |
| `/share` | 作为私有 GitHub gist 上传，并生成可分享的 HTML 链接 |

## 恢复和删除会话

`/resume` 会打开当前项目的交互式会话选择器。`pi -r` 会在启动时打开同一个选择器。

在选择器中，你可以：

- 直接输入进行搜索
- 用 Ctrl+P 切换路径显示
- 用 Ctrl+S 切换排序模式
- 用 Ctrl+N 筛选命名会话
- 用 Ctrl+R 重命名
- 用 Ctrl+D 删除，然后确认

如果可用，pi 会使用 `trash` CLI 删除，而不是永久移除文件。

## 命名会话

使用 `/name <name>` 设置易读的会话名称：

```text
/name Refactor auth module
```

使用 `--name` 或 `-n` 在启动时设置名称：

```bash
pi --name "Refactor auth module"
pi --name "CI audit" -p "Review this build failure"
```

命名会话更容易在 `/resume` 和 `pi -r` 中找到。

## 使用 `/tree` 创建分支

会话以树的形式存储。每个条目都有 `id` 和 `parentId`，当前位置是活动叶节点。`/tree` 让你可以跳转到任意先前位置并从那里继续，而无需创建新文件。

<p align="center"><img src="images/tree-view.png" alt="树形视图" width="600"></p>

示例结构：

```text
├─ user: "Hello, can you help..."
│  └─ assistant: "Of course! I can..."
│     ├─ user: "Let's try approach A..."
│     │  └─ assistant: "For approach A..."
│     │     └─ user: "That worked..."  ← active
│     └─ user: "Actually, approach B..."
│        └─ assistant: "For approach B..."
```

### 树形视图控制

| 按键 | 操作 |
|-----|--------|
| ↑↓ | 浏览可见条目 |
| ←→ | 向上/向下翻页 |
| Ctrl+←/Ctrl+→ 或 Alt+←/Alt+→ | 折叠/展开或在分支区段之间跳转 |
| Shift+L | 设置或清除所选条目的标签 |
| Shift+T | 切换标签时间戳 |
| Enter | 选择条目 |
| Escape/Ctrl+C | 取消 |
| Ctrl+O | 循环切换筛选模式 |

筛选模式包括：默认、无工具、仅用户、仅标签和全部。在[设置](settings.md)中通过 `treeFilterMode` 配置默认模式。

### 选择行为

选择用户消息或自定义消息时：

1. 将叶节点移到所选消息的父节点。
2. 将所选消息文本放入编辑器。
3. 允许你编辑并重新提交，从而创建新分支。

选择助手、工具、压缩或其他非用户条目时：

1. 将叶节点移到该条目。
2. 保持编辑器为空。
3. 允许你从该位置继续。

选择根用户消息会将叶节点重置为空对话，并把原始提示词放入编辑器。

## `/tree`、`/fork` 和 `/clone`

| 功能 | `/tree` | `/fork` | `/clone` |
|---------|---------|---------|----------|
| 输出 | 同一会话文件 | 新会话文件 | 新会话文件 |
| 视图 | 完整树 | 用户消息选择器 | 当前活动分支 |
| 典型用途 | 就地探索不同方案 | 从较早的提示词开始新会话 | 继续之前复制当前工作 |
| 摘要 | 可选的分支摘要 | 无 | 无 |

希望将不同方案保留在一起时使用 `/tree`。需要单独的会话文件时使用 `/fork` 或 `/clone`。

## 分支摘要

当 `/tree` 从一个分支切换到另一个分支时，pi 可以总结被离开的分支，并将摘要附加到新位置。这样无需重放整个分支，也能保留刚刚离开的路径中的重要上下文。

出现提示时，可选择：

1. 不生成摘要
2. 使用默认提示词总结
3. 使用自定义关注点说明总结

有关分支总结的内部机制和扩展钩子，请参阅[压缩](compaction.md)。

## 会话格式

会话文件采用 JSONL 格式，包含消息条目、模型变更、思考级别变更、标签、压缩、分支摘要和扩展条目。

有关解析器、扩展、SDK 用法和完整的 SessionManager API，请参阅[会话格式](session-format.md)。
