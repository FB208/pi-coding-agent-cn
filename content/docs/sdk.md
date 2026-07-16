> pi可以帮助您使用SDK。要求它为您的用例构建集成。

<a id="sdk"></a>
# SDK

SDK 提供对 pi 代理功能的编程访问。使用它将 pi 嵌入其他应用程序、构建自定义界面或与自动化工作流程集成。

**用例示例：**
- 构建自定义 UI（Web、桌面、移动）
- 将代理功能集成到现有应用程序中
- 使用代理推理创建自动化管道
- 构建生成子代理的自定义工具
- 以编程方式测试代理行为

请参阅 [examples/sdk/](../examples/sdk/)获取从最小控制到完全控制的工作示例。

<a id="quick-start"></a>
## 快速入门

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

<a id="installation"></a>
## 安装

```bash
npm install @earendil-works/pi-coding-agent
```

SDK包含在主包中。无需单独安装。

<a id="core-concepts"></a>
## 核心概念

<a id="createagentsession"></a>
### 创建代理会话()

主要工厂函数为单个`AgentSession`。

`createAgentSession()`使用`ResourceLoader`提供扩展、技能、提示模板、主题和上下文文件。如果您不提供，它将使用`DefaultResourceLoader`进行标准发现。

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

// Minimal: defaults with DefaultResourceLoader
const { session } = await createAgentSession();

// Custom: override specific options
const { session } = await createAgentSession({
  model: myModel,
  tools: ["read", "bash"],
  sessionManager: SessionManager.inMemory(),
});
```

<a id="agentsession"></a>
### 代理会话

会话管理代理生命周期、消息历史记录、模型状态、压缩和事件流。

```typescript
interface AgentSession {
  // Send a prompt and wait for completion
  prompt(text: string, options?: PromptOptions): Promise<void>;

  // Queue messages during streaming
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;

  // Subscribe to events (returns unsubscribe function)
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;

  // Session info
  sessionFile: string | undefined;
  sessionId: string;

  // Model control
  setModel(model: Model): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): void;
  cycleModel(): Promise<ModelCycleResult | undefined>;
  cycleThinkingLevel(): ThinkingLevel | undefined;

  // State access
  agent: Agent;
  model: Model | undefined;
  thinkingLevel: ThinkingLevel;
  messages: AgentMessage[];
  isStreaming: boolean;

  // In-place tree navigation within the current session file
  navigateTree(targetId: string, options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string }): Promise<{ editorText?: string; cancelled: boolean }>;

  // Compaction
  compact(customInstructions?: string): Promise<CompactionResult>;
  abortCompaction(): void;

  // Abort current operation
  abort(): Promise<void>;

  // Cleanup
  dispose(): void;
}
```

会话替换 API（例如 new-session、resume、fork 和 import）在`AgentSessionRuntime`上运行，而不是在`AgentSession`上运行。

<a id="createagentsessionruntime-and-agentsessionruntime"></a>
### createAgentSessionRuntime() 和 AgentSessionRuntime

当您需要替换活动会话并重建 cwd 绑定的运行时状态时，请使用运行时 API。
这与内置交互、打印和 RPC 模式使用的层相同。

`createAgentSessionRuntime()`采用运行时工厂加上初始 cwd/session目标。工厂关闭进程全局固定输入，为有效 cwd 重新创建 cwd 绑定服务，针对这些服务解析会话选项，并返回完整的运行时结果。

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
    })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});
```

`AgentSessionRuntime`拥有以下活动运行时的替换：

- `newSession()`
- `switchSession()`
- `fork()`
- 克隆流经`fork(entryId, { position: "at" })`
- `importFromJsonl()`

重要行为：

- 这些操作后`runtime.session`发生变化
- 事件订阅附加到特定的`AgentSession`，因此替换后重新订阅
- 如果您使用扩展，请在新会话中再次调用`runtime.session.bindExtensions(...)`
- 创建返回`runtime.diagnostics`的诊断信息
- 如果运行时创建或替换失败，该方法将抛出异常，调用者决定如何处理它

```typescript
let session = runtime.session;
let unsubscribe = session.subscribe(() => {});

await runtime.newSession();

unsubscribe();
session = runtime.session;
unsubscribe = session.subscribe(() => {});
```

<a id="prompting-and-message-queueing"></a>
### 提示和消息队列

`PromptOptions`控制提示扩展、流式传输时的排队行为以及提示预检通知：

```typescript
interface PromptOptions {
  expandPromptTemplates?: boolean;
  images?: ImageContent[];
  streamingBehavior?: "steer" | "followUp";
  source?: InputSource;
  preflightResult?: (success: boolean) => void;
}
```

每次`prompt()`调用时都会调用`preflightResult`一次：

- `true`当提示被接受、排队或立即处理时
- `false`当提示预检在接受之前被拒绝时

它在`prompt()`解析之前触发。仅在完全接受的运行完成（包括重试）后，`prompt()`仍会解析。接受后的失败通过正常事件和消息流报告，而不是通过`preflightResult(false)`报告。

`prompt()`方法处理提示模板、扩展命令和消息发送：

```typescript
// Basic prompt (when not streaming)
await session.prompt("What files are here?");

// With images
await session.prompt("What's in this image?", {
  images: [{ type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } }]
});

// During streaming: must specify how to queue the message
await session.prompt("Stop and do this instead", { streamingBehavior: "steer" });
await session.prompt("After you're done, also check X", { streamingBehavior: "followUp" });
```

**行为：**
- **扩展命令**（例如，`/mycommand`）：立即执行，即使在流式传输期间也是如此。他们通过`pi.sendMessage()`管理自己的法学硕士互动。
- **基于文件的提示模板**（来自`.md`文件）：在发送或排队之前扩展到其内容。
- **在没有`streamingBehavior`** 的情况下进行流式传输：引发错误。直接使用`steer()`或`followUp()`，或指定选项。
- **`preflightResult(true)`**：表示提示已被接受、排队或立即处理。
- **`preflightResult(false)`**：表示在接受之前预检被拒绝。

对于流式传输期间的显式排队：

```typescript
// Queue a steering message for delivery after the current assistant turn finishes its tool calls
await session.steer("New instruction");

// Wait for agent to finish (delivered only when agent stops)
await session.followUp("After you're done, also do this");
```

`steer()`和`followUp()`都扩展基于文件的提示模板，但扩展命令出错（扩展命令无法排队）。

<a id="agent-and-agentstate"></a>
### 代理和代理状态

`Agent`类（来自`@earendil-works/pi-agent-core`）处理核心 LLM 交互。通过`session.agent`访问它。

```typescript
// Access current state
const state = session.agent.state;

// state.messages: AgentMessage[] - conversation history
// state.model: Model - current model
// state.thinkingLevel: ThinkingLevel - current thinking level
// state.systemPrompt: string - system prompt
// state.tools: AgentTool[] - available tools
// state.streamingMessage?: AgentMessage - current partial assistant message
// state.errorMessage?: string - latest assistant error

// Replace messages (useful for branching or restoration)
session.agent.state.messages = messages; // copies the top-level array

// Replace tools
session.agent.state.tools = tools; // copies the top-level array

// Wait for agent to finish processing
await session.agent.waitForIdle();
```

<a id="events"></a>
### 活动

订阅事件以接收流输出和生命周期通知。

```typescript
session.subscribe((event) => {
  switch (event.type) {
    // Streaming text from assistant
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      if (event.assistantMessageEvent.type === "thinking_delta") {
        // Thinking output (if thinking enabled)
      }
      break;
    
    // Tool execution
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      break;
    case "tool_execution_update":
      // Streaming tool output
      break;
    case "tool_execution_end":
      console.log(`Result: ${event.isError ? "error" : "success"}`);
      break;
    
    // Message lifecycle
    case "message_start":
      // New message starting
      break;
    case "message_end":
      // Message complete
      break;
    
    // Agent lifecycle
    case "agent_start":
      // Agent started processing prompt
      break;
    case "agent_end":
      // Agent finished (event.messages contains new messages)
      break;
    
    // Turn lifecycle (one LLM response + tool calls)
    case "turn_start":
      break;
    case "turn_end":
      // event.message: assistant response
      // event.toolResults: tool results from this turn
      break;
    
    // Session events (queue, compaction, retry)
    case "queue_update":
      console.log(event.steering, event.followUp);
      break;
    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
      break;
  }
});
```

<a id="options-reference"></a>
## 选项参考

<a id="directories"></a>
### 目录

```typescript
const { session } = await createAgentSession({
  // Working directory for DefaultResourceLoader discovery
  cwd: process.cwd(), // default
  
  // Global config directory
  agentDir: "~/.pi/agent", // default (expands ~)
});
```

`cwd`被`DefaultResourceLoader`用于：
- 项目扩展 (`.pi/extensions/`)
- 项目技能：
  - `.pi/skills/`
  - `.agents/skills/`在`cwd`和祖先目录中（直到 git repo 根目录，或者不在 repo 中时的文件系统根目录）
- 项目提示 (`.pi/prompts/`)
- 上下文文件（`AGENTS.md`从 cwd 向上走）
- 会话目录命名

`agentDir`被`DefaultResourceLoader`用于：
- 全局扩展 (`extensions/`)
- 全球技能：
  - `skills/`位于`agentDir`下（例如`~/.pi/agent/skills/`）
  - `~/.agents/skills/`
- 全局提示 (`prompts/`)
- 全局上下文文件 (`AGENTS.md`)
- 设置 (`settings.json`)
- 自定义模型 (`models.json`)
- 凭证 (`auth.json`)
- 会话 (`sessions/`)

当您传递自定义`ResourceLoader`时，`cwd`和`agentDir`不再控制资源发现。它们仍然影响会话命名和刀具路径解析。

<a id="model"></a>
### 模型

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// Find specific built-in model (doesn't check if API key exists)
const opus = getModel("anthropic", "claude-opus-4-5");
if (!opus) throw new Error("Model not found");

// Find any model by provider/id, including custom models from models.json
// (doesn't check if API key exists)
const customModel = modelRuntime.getModel("my-provider", "my-model");

// Get only models that have valid authentication configured
const available = await modelRuntime.getAvailable();

const { session } = await createAgentSession({
  model: opus,
  thinkingLevel: "medium", // off, minimal, low, medium, high, xhigh, max
  
  // Models for cycling (Ctrl+P in interactive mode)
  scopedModels: [
    { model: opus, thinkingLevel: "high" },
    { model: haiku, thinkingLevel: "off" },
  ],
  
  modelRuntime,
});
```

如果没有提供型号：
1. 尝试从会话中恢复（如果继续）
2. 使用设置中的默认值
3. 回退到第一个可用模型

要匹配 CLI 模型解析，请使用导出的解析器帮助程序：

```typescript
import {
  resolveCliModel,
  resolveModelScopeWithDiagnostics,
} from "@earendil-works/pi-coding-agent";

const cliModel = resolveCliModel({
  cliModel: "anthropic/claude-opus-4-5:high",
  modelRuntime,
});
if (cliModel.error) throw new Error(cliModel.error);
if (cliModel.warning) console.warn(cliModel.warning);

const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(
  ["anthropic/*:high", "gpt-5"],
  modelRuntime,
);
for (const diagnostic of diagnostics) {
  console.warn(diagnostic.message);
}
```

`resolveCliModel()`使用所有已注册的模型，因此`--api-key`样式的首次设置可以在存储的身份验证存在之前解析模型。`resolveModelScopeWithDiagnostics()`匹配`--models`和`enabledModels`语义，同时返回警告而不是打印它们。

> 请参阅[示例/sdk/02-custom-model.ts](../examples/sdk/02-custom-model.ts)

<a id="api-keys-and-oauth"></a>
### API 密钥和 OAuth

身份验证解析优先级（由`ModelRuntime`处理）：
1. 运行时覆盖（通过`setRuntimeApiKey`，不持久）
2. `auth.json`中存储的凭据（API 密钥或 OAuth 令牌）
3. 环境变量（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`等）
4. 后备解析器（用于来自`models.json`的自定义提供程序密钥）

```typescript
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { createAgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";

// Default: uses ~/.pi/agent/auth.json and ~/.pi/agent/models.json
const modelRuntime = await ModelRuntime.create();

// Provider-owned auth methods and current status
for (const provider of modelRuntime.getProviders()) {
  const status = await modelRuntime.checkAuth(provider.id);
  console.log(provider.name, provider.auth, status);
}

// Runtime API key override (not persisted to disk)
modelRuntime.setRuntimeApiKey("anthropic", "sk-my-temp-key");

// Custom credential and model locations
const customRuntime = await ModelRuntime.create({
  authPath: "/my/app/auth.json",
  modelsPath: "/my/app/models.json",
});

// Or inject any pi-ai CredentialStore
const credentials = new InMemoryCredentialStore();
const inMemoryRuntime = await ModelRuntime.create({ credentials });

const { session } = await createAgentSession({
  modelRuntime: customRuntime,
});
```

> 请参阅[示例/sdk/09-api-keys-and-oauth.ts](../examples/sdk/09-api-keys-and-oauth.ts)

<a id="system-prompt"></a>
### 系统提示

使用`ResourceLoader`覆盖系统提示符：

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  systemPromptOverride: () => "You are a helpful assistant.",
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 请参阅[示例/sdk/03-custom-prompt.ts](../examples/sdk/03-custom-prompt.ts)

<a id="tools"></a>
### 工具

指定要启用的内置工具：

- 内置工具名称：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`
- 默认内置函数：`read`、`bash`、`edit`、`write`
- `noTools: "all"`禁用所有工具
- `noTools: "builtin"`禁用默认内置函数，同时保持扩展和自定义工具启用
- 应用任何`tools`允许列表后，`excludeTools`禁用特定的内置、扩展或自定义工具名称

`edit`工具返回`details.diff`用于 Pi 的 TUI 显示，并返回`details.patch`作为 SDK 消费者的标准统一补丁。

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

// Read-only mode
const { session } = await createAgentSession({
  tools: ["read", "grep", "find", "ls"],
});

// Pick specific tools
const { session } = await createAgentSession({
  tools: ["read", "bash", "grep"],
});

// Disable one tool while keeping the rest available
const { session } = await createAgentSession({
  excludeTools: ["ask_question"],
});
```

<a id="tools-with-custom-cwd"></a>
#### 带有自定义 cwd 的工具

当您传递自定义`cwd`时，`createAgentSession()`会为该 cwd 构建选定的内置工具。

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const cwd = "/path/to/project";

// Use default tools for custom cwd
const { session } = await createAgentSession({
  cwd,
  sessionManager: SessionManager.inMemory(cwd),
});

// Or pick specific tools for custom cwd
const { session } = await createAgentSession({
  cwd,
  tools: ["read", "bash", "grep"],
  sessionManager: SessionManager.inMemory(cwd),
});
```

> 请参阅[示例/sdk/05-tools.ts](../examples/sdk/05-tools.ts)

<a id="custom-tools"></a>
### 定制工具

```typescript
import { Type } from "typebox";
import { createAgentSession, defineTool } from "@earendil-works/pi-coding-agent";

// Inline custom tool
const myTool = defineTool({
  name: "my_tool",
  label: "My Tool",
  description: "Does something useful",
  parameters: Type.Object({
    input: Type.String({ description: "Input value" }),
  }),
  execute: async (_toolCallId, params) => ({
    content: [{ type: "text", text: `Result: ${params.input}` }],
    details: {},
  }),
});

// Pass custom tools directly
const { session } = await createAgentSession({
  customTools: [myTool],
});
```

将`defineTool()`用于独立定义和数组，例如`customTools: [myTool]`。内联`pi.registerTool({ ... })`已经正确推断参数类型。

通过`customTools`传递的自定义工具与扩展注册的工具相结合。 ResourceLoader 加载的扩展也可以通过`pi.registerTool()`注册工具。

如果您传递`tools`，请包含您想要启用的每个自定义或扩展工具名称，例如`tools: ["read", "bash", "my_tool"]`。

> 请参阅[示例/sdk/05-tools.ts](../examples/sdk/05-tools.ts)

<a id="extensions"></a>
### 扩展

扩展由`ResourceLoader`加载。`DefaultResourceLoader`从`~/.pi/agent/extensions/`、`.pi/extensions/`和 settings.json 扩展源中发现扩展。

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/path/to/my-extension.ts"],
  extensionFactories: [
    (pi) => {
      pi.on("agent_start", () => {
        console.log("[Inline Extension] Agent starting");
      });
    },
  ],
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

扩展可以注册工具、订阅事件、添加命令等。请参阅 [extensions.md](extensions.md)了解完整的 API。

**命名内联扩展：** 默认情况下，内联工厂在启动扩展列表中显示为`<inline:1>`、`<inline:2>`等。要显示描述性名称，请包装工厂：

```typescript
import type { InlineExtension } from "@earendil-works/pi-coding-agent";

const myProvider: InlineExtension = {
  name: "my-provider",
  factory: (pi) => {
    pi.on("agent_start", () => {
      console.log("[my-provider] Agent starting");
    });
  },
};

const loader = new DefaultResourceLoader({
  extensionFactories: [myProvider],
});
```

这显示为`<inline:my-provider>`而不是`<inline:1>`。为了向后兼容，裸工厂函数仍然被接受。

**事件总线：** 扩展可以通过`pi.events`进行通信。如果您需要从外部发出或监听，请将共享的`eventBus`传递给`DefaultResourceLoader`：

```typescript
import { createEventBus, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const eventBus = createEventBus();
const loader = new DefaultResourceLoader({
  eventBus,
});
await loader.reload();

eventBus.on("my-extension:status", (data) => console.log(data));
```

> 请参阅[示例/sdk/06-extensions.ts](../examples/sdk/06-extensions.ts)和[文档/extensions.md](extensions.md)

<a id="skills"></a>
### 技能

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type Skill,
} from "@earendil-works/pi-coding-agent";

const customSkill: Skill = {
  name: "my-skill",
  description: "Custom instructions",
  filePath: "/path/to/SKILL.md",
  baseDir: "/path/to",
  source: "custom",
};

const loader = new DefaultResourceLoader({
  skillsOverride: (current) => ({
    skills: [...current.skills, customSkill],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 请参阅[示例/sdk/04-skills.ts](../examples/sdk/04-skills.ts)

<a id="context-files"></a>
### 上下文文件

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  agentsFilesOverride: (current) => ({
    agentsFiles: [
      ...current.agentsFiles,
      { path: "/virtual/AGENTS.md", content: "# Guidelines\n\n- Be concise" },
    ],
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 请参阅[示例/sdk/07-context-files.ts](../examples/sdk/07-context-files.ts)

<a id="slash-commands"></a>
### 斜线命令

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type PromptTemplate,
} from "@earendil-works/pi-coding-agent";

const customCommand: PromptTemplate = {
  name: "deploy",
  description: "Deploy the application",
  source: "(custom)",
  content: "# Deploy\n\n1. Build\n2. Test\n3. Deploy",
};

const loader = new DefaultResourceLoader({
  promptsOverride: (current) => ({
    prompts: [...current.prompts, customCommand],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 请参阅[示例/sdk/08-prompt-templates.ts](../examples/sdk/08-prompt-templates.ts)

<a id="session-management"></a>
### 会话管理

会话使用具有`id`/`parentId`链接的树结构，从而实现就地分支。

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSession,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

// In-memory (no persistence)
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});

// New persistent session
const { session: persisted } = await createAgentSession({
  sessionManager: SessionManager.create(process.cwd()),
});

// Continue most recent
const { session: continued, modelFallbackMessage } = await createAgentSession({
  sessionManager: SessionManager.continueRecent(process.cwd()),
});
if (modelFallbackMessage) {
  console.log("Note:", modelFallbackMessage);
}

// Open specific file
const { session: opened } = await createAgentSession({
  sessionManager: SessionManager.open("/path/to/session.jsonl"),
});

// List sessions
const currentProjectSessions = await SessionManager.list(process.cwd());
const allSessions = await SessionManager.listAll(process.cwd());

// Session replacement API for /new, /resume, /fork, /clone, and import flows.
const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
    })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

// Replace the active session with a fresh one
await runtime.newSession();

// Replace the active session with another saved session
await runtime.switchSession("/path/to/session.jsonl");

// Replace the active session with a fork from a specific user entry
await runtime.fork("entry-id");

// Clone the active path through a specific entry
await runtime.fork("entry-id", { position: "at" });
```

**SessionManager 树 API：**

```typescript
const sm = SessionManager.open("/path/to/session.jsonl");

// Session listing
const currentProjectSessions = await SessionManager.list(process.cwd());
const allSessions = await SessionManager.listAll(process.cwd());

// Tree traversal
const entries = sm.getEntries();        // All entries (excludes header)
const tree = sm.getTree();              // Full tree structure
const path = sm.getPath();              // Path from root to current leaf
const leaf = sm.getLeafEntry();         // Current leaf entry
const entry = sm.getEntry(id);          // Get entry by ID
const children = sm.getChildren(id);    // Direct children of entry

// Labels
const label = sm.getLabel(id);          // Get label for entry
sm.appendLabelChange(id, "checkpoint"); // Set label

// Branching
sm.branch(entryId);                     // Move leaf to earlier entry
sm.branchWithSummary(id, "Summary...");  // Branch with context summary
sm.createBranchedSession(leafId);       // Extract path to new file
```

> 请参阅[示例/sdk/11-sessions.ts](../examples/sdk/11-sessions.ts)和[会话格式](session-format.md)

<a id="settings-management"></a>
### 设置管理

```typescript
import { createAgentSession, SettingsManager, SessionManager } from "@earendil-works/pi-coding-agent";

// Default: loads from files (global + project merged)
const { session } = await createAgentSession({
  settingsManager: SettingsManager.create(),
});

// With overrides
const settingsManager = SettingsManager.create();
settingsManager.applyOverrides({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 5 },
});
const { session } = await createAgentSession({ settingsManager });

// In-memory (no file I/O, for testing)
const { session } = await createAgentSession({
  settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  sessionManager: SessionManager.inMemory(),
});

// Custom directories
const { session } = await createAgentSession({
  settingsManager: SettingsManager.create("/custom/cwd", "/custom/agent"),
});
```

**静态工厂：**
- `SettingsManager.create(cwd?, agentDir?)`- 从文件加载
- `SettingsManager.inMemory(settings?)`- 没有文件 I/O

**项目特定设置：**

设置从两个位置加载并合并：
1. 全球：`~/.pi/agent/settings.json`
2. 项目：`<cwd>/.pi/settings.json`

项目覆盖全局。嵌套对象合并键。默认情况下，设置者会修改全局设置。

**持久性和错误处理语义：**

- 设置 getters/setters对于内存状态是同步的。
- Setters 将持久化写入队列异步写入。
- 当您需要持久性边界时（例如，在进程退出之前或在测试中断言文件内容之前），请调用`await settingsManager.flush()`。
- `SettingsManager`不打印设置 I/O错误。使用`settingsManager.drainErrors()`并在您的应用程序层中报告它们。

> 请参阅[示例/sdk/10-settings.ts](../examples/sdk/10-settings.ts)

<a id="resourceloader"></a>
## 资源加载器

使用`DefaultResourceLoader`发现扩展、技能、提示、主题和上下文文件。

```typescript
import {
  DefaultResourceLoader,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  cwd,
  agentDir: getAgentDir(),
});
await loader.reload();

const extensions = loader.getExtensions();
const skills = loader.getSkills();
const prompts = loader.getPrompts();
const themes = loader.getThemes();
const contextFiles = loader.getAgentsFiles().agentsFiles;
```

<a id="return-value"></a>
## 返回值

`createAgentSession()`返回：

```typescript
interface CreateAgentSessionResult {
  // The session
  session: AgentSession;
  
  // Extensions result (for runner setup)
  extensionsResult: LoadExtensionsResult;
  
  // Warning if session model couldn't be restored
  modelFallbackMessage?: string;
}

interface LoadExtensionsResult {
  extensions: Extension[];
  errors: Array<{ path: string; error: string }>;
  runtime: ExtensionRuntime;
}
```

<a id="complete-example"></a>
## 完整示例

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create({
  authPath: "/custom/agent/auth.json",
  modelsPath: "/custom/agent/models.json",
});
if (process.env.MY_KEY) {
  modelRuntime.setRuntimeApiKey("anthropic", process.env.MY_KEY);
}

// Inline tool
const statusTool = defineTool({
  name: "status",
  label: "Status",
  description: "Get system status",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `Uptime: ${process.uptime()}s` }],
    details: {},
  }),
});

const model = getModel("anthropic", "claude-opus-4-5");
if (!model) throw new Error("Model not found");

// In-memory settings with overrides
const settingsManager = SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 2 },
});

const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: "/custom/agent",
  settingsManager,
  systemPromptOverride: () => "You are a minimal assistant. Be concise.",
});
await loader.reload();

const { session } = await createAgentSession({
  cwd: process.cwd(),
  agentDir: "/custom/agent",

  model,
  thinkingLevel: "off",
  modelRuntime,

  tools: ["read", "bash", "status"],
  customTools: [statusTool],
  resourceLoader: loader,

  sessionManager: SessionManager.inMemory(),
  settingsManager,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Get status and list files.");
```

<a id="run-modes"></a>
## 运行模式

SDK 导出运行模式实用程序，用于在`createAgentSession()`之上构建自定义接口：

<a id="interactivemode"></a>
### 交互模式

完整的 TUI 交互模式，包含编辑器、聊天历史记录和所有内置命令：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

const mode = new InteractiveMode(runtime, {
  migratedProviders: [],
  modelFallbackMessage: undefined,
  initialMessage: "Hello",
  initialImages: [],
  initialMessages: [],
});

await mode.run();
```

<a id="runprintmode"></a>
### 运行打印模式

单次模式：发送提示、输出结果、退出：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  runPrintMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

await runPrintMode(runtime, {
  mode: "text",
  initialMessage: "Hello",
  initialImages: [],
  messages: ["Follow up"],
});
```

<a id="runrpcmode"></a>
### 运行Rpc模式

用于子流程集成的 JSON-RPC 模式：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  runRpcMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

await runRpcMode(runtime);
```

有关 JSON 协议，请参阅 [RPC 文档](rpc.md)。

<a id="rpc-mode-alternative"></a>
## RPC 模式替代方案

对于不使用 SDK 构建的基于子流程的集成，请直接使用 CLI：

```bash
pi --mode rpc --no-session
```

有关 JSON 协议，请参阅 [RPC 文档](rpc.md)。

在以下情况下首选 SDK：
- 你想要类型安全
- 你们处于同一个 Node.js 进程中
- 您需要直接访问代理状态
- 您想要以编程方式自定义工具/extensions

在以下情况下首选 RPC 模式：
- 您正在从另一种语言进行集成
- 您想要进程隔离
- 您正在构建一个与语言无关的客户端

<a id="exports"></a>
## 出口

主要入口点导出：

```typescript
// Factory
createAgentSession
createAgentSessionRuntime
AgentSessionRuntime

// Auth and Models
ModelRuntime // implements pi-ai Models and owns credential storage
ModelRegistry // synchronous extension compatibility facade
resolveCliModel
resolveModelScopeWithDiagnostics

// Resource loading
DefaultResourceLoader
type ResourceLoader
createEventBus

// Constants and helpers
CONFIG_DIR_NAME
defineTool
getAgentDir
getPackageDir
getReadmePath
getDocsPath
getExamplesPath

// Session management
SessionManager
SettingsManager

// Tool factories
createCodingTools
createReadOnlyTools
createReadTool, createBashTool, createEditTool, createWriteTool
createGrepTool, createFindTool, createLsTool

// Types
type CreateAgentSessionOptions
type CreateAgentSessionResult
type ExtensionFactory
type InlineExtension
type ExtensionAPI
type ToolDefinition
type Skill
type PromptTemplate
type Tool
```

对于扩展类型，请参阅 [extensions.md](extensions.md)了解完整的 API。
