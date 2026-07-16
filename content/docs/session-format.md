<a id="session-file-format"></a>
# 会话格式

会话存储为 JSONL（JSON 行）文件。每行都是一个带有`type`字段的 JSON 对象。会话条目通过`id`/`parentId`字段形成树结构，无需创建新文件即可实现就地分支。

<a id="file-location"></a>
## 文件位置

```
~/.pi/agent/sessions/--<path>--/<timestamp>_<uuid>.jsonl
```

其中`<path>`是工作目录，其中`/`替换为`-`。

<a id="deleting-sessions"></a>
## 删除会话

可以通过删除`~/.pi/agent/sessions/`下的`.jsonl`文件来删除会话。

Pi 还支持从`/resume`交互删除会话（选择一个会话并按`Ctrl+D`，然后确认）。如果可用，pi 使用`trash`CLI 来避免永久删除。

<a id="session-version"></a>
## 会话版本

会话在标头中有一个版本字段：

- **版本 1**：线性条目序列（旧版，加载时自动迁移）
- **版本 2**：具有`id`/`parentId`链接的树结构
- **版本 3**：将`hookMessage`角色重命名为`custom`（扩展统一）

现有会话在加载时会自动迁移到当前版本 (v3)。

<a id="source-files"></a>
## 源文件

GitHub 上的来源（[pi-mono](https://github.com/earendil-works/pi-mono)）：
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts)- 会话条目类型和 SessionManager
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/messages.ts)- 扩展消息类型（BashExecutionMessage、CustomMessage 等）
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/types.ts)- 基本消息类型（UserMessage、AssistantMessage、ToolResultMessage）
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/agent/src/types.ts)- AgentMessage 联合类型

对于项目中的 TypeScript 定义，请检查`node_modules/@earendil-works/pi-coding-agent/dist/`和`node_modules/@earendil-works/pi-ai/dist/`。

<a id="message-types"></a>
## 消息类型

会话条目包含`AgentMessage`对象。理解这些类型对于解析会话和编写扩展至关重要。

<a id="content-blocks"></a>
### 内容块

消息包含类型化内容块的数组：

```typescript
interface TextContent {
  type: "text";
  text: string;
}

interface ImageContent {
  type: "image";
  data: string;      // base64 encoded
  mimeType: string;  // e.g., "image/jpeg", "image/png"
}

interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
}
```

<a id="base-message-types-from-pi-ai"></a>
### 基本消息类型（来自 pi-ai）

```typescript
interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;  // Unix ms
}

interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: string;
  provider: string;
  model: string;
  usage: Usage;
  stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
  errorMessage?: string;
  timestamp: number;
}

interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: any;      // Tool-specific metadata
  isError: boolean;
  timestamp: number;
}

interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

<a id="extended-message-types-from-pi-coding-agent"></a>
### 扩展消息类型（来自 pi-coding-agent）

```typescript
interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;  // true for !! prefix commands
  timestamp: number;
}

interface CustomMessage {
  role: "custom";
  customType: string;            // Extension identifier
  content: string | (TextContent | ImageContent)[];
  display: boolean;              // Show in TUI
  details?: any;                 // Extension-specific metadata
  timestamp: number;
}

interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string;                // Entry we branched from
  timestamp: number;
}

interface CompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
}
```

<a id="agentmessage-union"></a>
### 代理消息联盟

```typescript
type AgentMessage =
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomMessage
  | BranchSummaryMessage
  | CompactionSummaryMessage;
```

<a id="entry-base"></a>
## 入门基地

所有条目（`SessionHeader`除外）都扩展`SessionEntryBase`：

```typescript
interface SessionEntryBase {
  type: string;
  id: string;           // 8-char hex ID
  parentId: string | null;  // Parent entry ID (null for first entry)
  timestamp: string;    // ISO timestamp
}
```

<a id="entry-types"></a>
## 条目类型

<a id="sessionheader"></a>
### 会话头

文件的第一行。仅元数据，不是树的一部分（无`id`/`parentId`）。

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```

对于与家长的会话（通过`/fork`、`/clone`或`newSession({ parentSession })`创建）：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```

<a id="sessionmessageentry"></a>
### 会话消息条目

对话中的一条消息。`message`字段包含`AgentMessage`。

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"Hello"}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop"}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"output"}],"isError":false}}
```

<a id="modelchangeentry"></a>
### 模型更改条目

当用户在会话中切换模型时发出。

```json
{"type":"model_change","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:05:00.000Z","provider":"openai","modelId":"gpt-4o"}
```

<a id="thinkinglevelchangeentry"></a>
### 思维水平改变入口

当用户改变思考/reasoning级别时发出。

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```

<a id="compactionentry"></a>
### 压实入口

压缩上下文时创建。存储早期消息的摘要。

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000}
```

可选字段：
- `details`：特定于实现的数据（例如，`{ readFiles: string[], modifiedFiles: string[] }`用于默认值，或用于扩展的自定义数据）
- `fromHook`：`true`（如果由扩展生成），`false`/`undefined`（如果由 pi 生成）（旧字段名称）

<a id="branchsummaryentry"></a>
### 分支摘要条目

当通过`/tree`切换分支时创建，并使用 LLM 生成的左分支到共同祖先的摘要。从废弃的路径捕获上下文。

```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"Branch explored approach A..."}
```

可选字段：
- `details`：默认的文件跟踪数据 (`{ readFiles: string[], modifiedFiles: string[] }`)，或扩展的自定义数据
- `fromHook`：`true`（如果由扩展生成），`false`/`undefined`（如果由 pi 生成）（旧字段名称）

<a id="customentry"></a>
### 自定义条目

扩展状态持久性。不参与法学硕士背景。

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

使用`customType`来识别重新加载时的扩展条目。交互模式可以通过`pi.registerEntryRenderer(customType, renderer)`渲染自定义条目，但它们仍然不参与 LLM 上下文。

<a id="custommessageentry"></a>
### 自定义消息条目

确实参与 LLM 上下文的扩展注入消息。

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"Injected context...","display":true}
```

领域：
-`content`：字符串或 `(TextContent|ImageContent)[]` (与 UserMessage 相同)
- `display`：`true`= 在 TUI 中以独特的样式显示，`false`= 隐藏
- `details`：可选的扩展特定元数据（不发送到 LLM）

<a id="labelentry"></a>
### 标签条目

条目上的用户定义书签/marker。

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

将`label`设置为`undefined`以清除标签。

<a id="sessioninfoentry"></a>
### 会话信息条目

会话元数据（例如，用户定义的显示名称）。通过扩展中的`/name`、`--name`/`-n`或`pi.setSessionName()`设置。

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

会话名称显示在会话选择器 (`/resume`) 中，而不是设置后的第一条消息。

<a id="tree-structure"></a>
## 树结构

条目形成树：
- 第一个条目有`parentId: null`
- 每个后续条目通过`parentId`指向其父条目
- 分支从较早的条目创建新的子项
- “叶子”是树中的当前位置

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← current leaf
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← alternate branch
```

<a id="context-building"></a>
## 情境构建

`buildContextEntries()`从当前叶子走到根，在执行压缩的同时生成活动条目列表：

1. 收集路径上的所有条目
2. 如果`CompactionEntry`在路径上：
   - 首先包括压缩条目
   - 然后从`firstKeptEntryId`开始进行压缩
   - 然后是压缩后的条目
3. 保留选定范围内的非消息条目，以便交互模式可以呈现它们

`buildSessionContext()`建立在该条目列表的基础上，为 LLM 生成消息列表：

1. 从完整路径中提取当前模型和思维水平设置
2. 将选定的条目转换为消息：
   - `message`-> 存储`AgentMessage`
   - `compaction`->`compactionSummary`
   - `branch_summary`->`branchSummary`
   - `custom_message`->`CustomMessage`
   - `custom`-> 无上下文消息

<a id="parsing-example"></a>
## 解析示例

```typescript
import { readFileSync } from "fs";

const lines = readFileSync("session.jsonl", "utf8").trim().split("\n");

for (const line of lines) {
  const entry = JSON.parse(line);

  switch (entry.type) {
    case "session":
      console.log(`Session v${entry.version ?? 1}: ${entry.id}`);
      break;
    case "message":
      console.log(`[${entry.id}] ${entry.message.role}: ${JSON.stringify(entry.message.content)}`);
      break;
    case "compaction":
      console.log(`[${entry.id}] Compaction: ${entry.tokensBefore} tokens summarized`);
      break;
    case "branch_summary":
      console.log(`[${entry.id}] Branch from ${entry.fromId}`);
      break;
    case "custom":
      console.log(`[${entry.id}] Custom (${entry.customType}): ${JSON.stringify(entry.data)}`);
      break;
    case "custom_message":
      console.log(`[${entry.id}] Extension message (${entry.customType}): ${entry.content}`);
      break;
    case "label":
      console.log(`[${entry.id}] Label "${entry.label}" on ${entry.targetId}`);
      break;
    case "model_change":
      console.log(`[${entry.id}] Model: ${entry.provider}/${entry.modelId}`);
      break;
    case "thinking_level_change":
      console.log(`[${entry.id}] Thinking: ${entry.thinkingLevel}`);
      break;
  }
}
```

<a id="sessionmanager-api"></a>
## 会话管理器API

以编程方式处理会话的关键方法。

<a id="static-creation-methods"></a>
### 静态创建方法
- `SessionManager.create(cwd, sessionDir?)`- 新会话
- `SessionManager.open(path, sessionDir?)`- 打开现有会话文件
- `SessionManager.continueRecent(cwd, sessionDir?)`- 继续最近的或创建新的
- `SessionManager.inMemory(cwd?)`- 无文件持久性
- `SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?)`- 来自另一个项目的分叉会话

<a id="static-listing-methods"></a>
### 静态列表方法
- `SessionManager.list(cwd, sessionDir?, onProgress?)`- 列出目录的会话
- `SessionManager.listAll(onProgress?)`- 列出所有项目的所有会话

<a id="instance-methods---session-management"></a>
### 实例方法 - 会话管理
- `newSession(options?)`- 开始新会话（选项：`{ parentSession?: string }`）
- `setSessionFile(path)`- 切换到不同的会话文件
- `createBranchedSession(leafId)`- 将分支提取到新会话文件

<a id="instance-methods---appending-all-return-entry-id"></a>
### 实例方法-追加（全部返回条目ID）
- `appendMessage(message)`- 添加消息
- `appendThinkingLevelChange(level)`- 记录思维变化
- `appendModelChange(provider, modelId)`- 记录模型更改
- `appendCompaction(summary, firstKeptEntryId, tokensBefore, details?, fromHook?)`- 添加压缩
- `appendCustomEntry(customType, data?)`- 扩展状态（不在上下文中）
- `appendSessionInfo(name)`- 设置会话显示名称
- `appendCustomMessageEntry(customType, content, display, details?)`- 扩展消息（在上下文中）
- `appendLabelChange(targetId, label)`- 设置/clear标签

<a id="instance-methods---tree-navigation"></a>
### 实例方法 - 树导航
- `getLeafId()`- 当前位置
- `getLeafEntry()`- 获取当前叶条目
- `getEntry(id)`- 通过 ID 获取条目
- `getBranch(fromId?)`- 从入口走到根
- `getTree()`- 获取完整的树结构
- `getChildren(parentId)`- 获取直接子项
- `getLabel(id)`- 获取条目标签
- `branch(entryId)`- 将叶子移至较早的条目
- `resetLeaf()`- 将叶子重置为空（在任何条目之前）
- `branchWithSummary(entryId, summary, details?, fromHook?)`- 带有上下文摘要的分支

<a id="instance-methods---context-info"></a>
### 实例方法 - 上下文和信息
- `buildContextEntries()`- 获取应用压缩的活动分支条目
- `buildSessionContext()`- 获取 LLM 的消息、思考水平和模型
- `getEntries()`- 所有条目（不包括标题）
- `getHeader()`- 会话标头元数据
- `getSessionName()`- 从最新的 session_info 条目获取显示名称
- `getCwd()`- 工作目录
- `getSessionDir()`- 会话存储目录
- `getSessionId()`- 会话 UUID
- `getSessionFile()`- 会话文件路径（内存中未定义）
- `isPersisted()`- 会话是否保存到磁盘
