<a id="custom-providers"></a>
# 自定义提供商

扩展可以通过`pi.registerProvider()`注册自定义模型提供程序。这使得：

- **代理** - 通过公司代理或 API 网关路由请求
- **自定义端点** - 使用自托管或私有模型部署
- **OAuth/SSO**- 为企业提供商添加身份验证流程
- **自定义 API** - 实现非标准 LLM API 的流式传输

<a id="example-extensions"></a>
## 扩展示例

请参阅这些完整的提供商示例：

- [`examples/extensions/custom-provider-anthropic/`](../examples/extensions/custom-provider-anthropic/)
- [`examples/extensions/custom-provider-gitlab-duo/`](../examples/extensions/custom-provider-gitlab-duo/)

<a id="table-of-contents"></a>
## 目录

- [示例扩展](#example-extensions)
- [快速参考](#quick-reference)
- [覆盖现有提供商](#override-existing-provider)
- [注册新提供商](#register-new-provider)
- [取消注册提供商](#unregister-provider)
- [OAuth 支持](#oauth-support)
- [自定义流媒体 API](#custom-streaming-api)
- [上下文溢出错误](#context-overflow-errors)
- [测试您的实现](#testing-your-implementation)
- [配置参考](#config-reference)
- [模型定义参考](#model-definition-reference)

<a id="quick-reference"></a>
## 快速参考

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Override baseUrl for existing provider
  pi.registerProvider("anthropic", {
    baseUrl: "https://proxy.example.com"
  });

  // Register new provider with models
  pi.registerProvider("my-provider", {
    name: "My Provider",
    baseUrl: "https://api.example.com",
    apiKey: "$MY_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "my-model",
        name: "My Model",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096
      }
    ]
  });
}
```

扩展工厂也可以是`async`。对于动态模型发现，请在工厂中获取并注册模型，而不是`session_start`。 pi 在启动继续之前等待工厂，因此提供程序在交互式启动期间和`pi --list-models`可用。

<a id="override-existing-provider"></a>
## 覆盖现有提供者

最简单的用例：通过代理重定向现有提供者。

```typescript
// All Anthropic requests now go through your proxy
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// Add custom headers to OpenAI requests
pi.registerProvider("openai", {
  headers: {
    "X-Custom-Header": "value"
  }
});

// Both baseUrl and headers
pi.registerProvider("google", {
  baseUrl: "https://ai-gateway.corp.com/google",
  headers: {
    "X-Corp-Auth": "$CORP_AUTH_TOKEN"  // env var or literal
  }
});
```

当仅提供`baseUrl`和/or`headers`时（无`models`），该提供程序的所有现有模型都将与新端点一起保留。

<a id="register-new-provider"></a>
## 注册新提供商

要添加全新的提供程序，请指定`models`以及所需的配置。

如果模型列表来自远程端点，请使用异步扩展工厂：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  const response = await fetch("http://localhost:1234/v1/models");
  const payload = (await response.json()) as {
    data: Array<{
      id: string;
      name?: string;
      context_window?: number;
      max_tokens?: number;
    }>;
  };

  pi.registerProvider("local-openai", {
    baseUrl: "http://localhost:1234/v1",
    apiKey: "$LOCAL_OPENAI_API_KEY",
    api: "openai-completions",
    models: payload.data.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.context_window ?? 128000,
      maxTokens: model.max_tokens ?? 4096,
    })),
  });
}
```

这会在启动完成之前注册获取的模型。

```typescript
pi.registerProvider("my-llm", {
  baseUrl: "https://api.my-llm.com/v1",
  apiKey: "$MY_LLM_API_KEY",  // env var reference
  api: "openai-completions",  // which streaming API to use
  models: [
    {
      id: "my-llm-large",
      name: "My LLM Large",
      reasoning: true,        // supports extended thinking
      input: ["text", "image"],
      cost: {
        input: 3.0,           // $/million tokens
        output: 15.0,
        cacheRead: 0.3,
        cacheWrite: 3.75
      },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});
```

当提供`models`时，它会**替换**该提供程序的所有现有模型。

`apiKey`和自定义标头值使用与`models.json`相同的配置值语法：开头的`!command`对整个值执行命令，`$ENV_VAR`和`${ENV_VAR}`插入环境变量，`$$`发出文字`$`，并且`$!`发出文字`!`。

<a id="unregister-provider"></a>
## 取消注册提供商

使用`pi.unregisterProvider(name)`删除之前通过`pi.registerProvider(name, ...)`注册的提供者：

```typescript
// Register
pi.registerProvider("my-llm", {
  baseUrl: "https://api.my-llm.com/v1",
  apiKey: "$MY_LLM_API_KEY",
  api: "openai-completions",
  models: [
    {
      id: "my-llm-large",
      name: "My LLM Large",
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// Later, remove it
pi.unregisterProvider("my-llm");
```

取消注册会删除该提供程序的动态模型、API 密钥回退、OAuth 提供程序注册和自定义流处理程序注册。任何被覆盖的内置模型或提供者行为都会被恢复。

初始扩展加载阶段后进行的调用会立即应用，因此不需要`/reload`。

<a id="api-types"></a>
### API 类型

`api`字段确定使用哪种流实现：

|应用程序编程接口|用于|
|-----|---------|
|`anthropic-messages`|Anthropic Claude API 及其兼容版本|
|`openai-completions`|OpenAI 聊天完成 API 和兼容版本|
|`openai-responses`|OpenAI 响应 API|
|`azure-openai-responses`|Azure OpenAI 响应 API|
|`openai-codex-responses`|OpenAI Codex 响应 API|
|`mistral-conversations`|Mistral SDK 对话/Chat流式传输|
|`google-generative-ai`|谷歌生成式人工智能API|
|`google-vertex`|谷歌 Vertex 人工智能 API|
|`bedrock-converse-stream`|亚马逊 Bedrock 匡威 API|

大多数与 OpenAI 兼容的提供商都使用`openai-completions`。使用模型级别`thinkingLevelMap`表示特定于模型的思维级别，使用`compat`表示提供者的怪癖。`xhigh`和`max`级别是可选的，需要非空映射条目，并且可能被不支持的孔分隔：

```typescript
models: [{
  id: "custom-model",
  // ...
  reasoning: true,
  thinkingLevelMap: {              // map pi levels to provider values; null hides unsupported levels
    minimal: null,
    low: null,
    medium: null,
    high: "default",
    xhigh: null,
    max: "max"
  },
  compat: {
    supportsDeveloperRole: false,   // use "system" instead of "developer"
    supportsReasoningEffort: true,
    maxTokensField: "max_tokens",   // instead of "max_completion_tokens"
    requiresToolResultName: true,   // tool results need name field
    thinkingFormat: "qwen",        // top-level enable_thinking: true
    cacheControlFormat: "anthropic" // Anthropic-style cache_control markers
  }
}]
```

将`openrouter`用于 OpenRouter 样式`reasoning: { effort }`控件。将`together`用于 Together 样式`reasoning: { enabled }`控件；对于`supportsReasoningEffort`，它还会发送`reasoning_effort`。对于读取`qwen-chat-template`并需要`chat_template_kwargs.enable_thinking`的本地 Qwen 兼容服务器，请使用`preserve_thinking`。
将`cacheControlFormat: "anthropic"`用于与 OpenAI 兼容的提供程序，这些提供程序通过系统提示、最后一个工具定义和最后一个用户/assistant文本内容上的`cache_control`公开人类风格的提示缓存。

对于使用`api: "anthropic-messages"`的人类兼容提供者，请在其上游模型需要自适应思维的模型或提供者上设置`compat.forceAdaptiveThinking: true`（`thinking.type: "adaptive"`加`output_config.effort`）。内置自适应克劳德模型会自动设置此功能。仅针对发出空思维签名并期望重播时`compat.allowEmptySignature: true`的提供者设置`signature: ""`。

> 迁移说明：米斯特拉尔从`openai-completions`迁移到`mistral-conversations`。
> 对本机 Mistral 模型使用`mistral-conversations`。
> 如果您有意通过`openai-completions`路由与 Mistral 兼容的/custom端点，请根据需要显式设置`compat`标志。

<a id="auth-header"></a>
### 验证头

如果您的提供商需要`Authorization: Bearer <key>`但不使用标准 API，请设置`authHeader: true`：

```typescript
pi.registerProvider("custom-api", {
  baseUrl: "https://api.example.com",
  apiKey: "$MY_API_KEY",
  authHeader: true,  // adds Authorization: Bearer header
  api: "openai-completions",
  models: [...]
});
```

每个请求都会解析密钥。显式请求`Authorization`标头优先于生成的值。

<a id="oauth-support"></a>
## OAuth 支持

添加与`/login`集成的 OAuth/SSO身份验证：

```typescript
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";

pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com/v1",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",

    async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
      const method = await callbacks.onSelect({
        message: "Select login method:",
        options: [
          { id: "browser", label: "Browser OAuth" },
          { id: "device", label: "Device code" }
        ]
      });
      if (!method) throw new Error("Login cancelled");

      let code: string;
      if (method === "device") {
        callbacks.onDeviceCode({
          userCode: "ABCD-1234",
          verificationUri: "https://sso.corp.com/device",
          intervalSeconds: 5,
          expiresInSeconds: 900
        });
        code = await pollDeviceCodeUntilComplete();
      } else {
        callbacks.onAuth({ url: "https://sso.corp.com/authorize?..." });
        code = await callbacks.onPrompt({ message: "Enter SSO code:" });
      }

      // Exchange for tokens (your implementation)
      const tokens = await exchangeCodeForTokens(code);

      return {
        refresh: tokens.refreshToken,
        access: tokens.accessToken,
        expires: Date.now() + tokens.expiresIn * 1000
      };
    },

    async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
      const tokens = await refreshAccessToken(credentials.refresh);
      return {
        refresh: tokens.refreshToken ?? credentials.refresh,
        access: tokens.accessToken,
        expires: Date.now() + tokens.expiresIn * 1000
      };
    },

    getApiKey(credentials: OAuthCredentials): string {
      return credentials.access;
    }
  }
});
```

注册后，用户可以通过`/login corporate-ai`进行身份验证。

<a id="oauthlogincallbacks"></a>
### OAuth登录回调

`callbacks`对象为提供商拥有的流程提供 UI 中立的交互：

```typescript
interface OAuthLoginCallbacks {
  // Open URL in browser (for OAuth redirects)
  onAuth(params: { url: string }): void;

  // Show device code (for device authorization flow)
  onDeviceCode(params: {
    userCode: string;
    verificationUri: string;
    intervalSeconds?: number;
    expiresInSeconds?: number;
  }): void;

  // Show transient progress
  onProgress?(message: string): void;

  // Prompt user for input (for manual token entry)
  onPrompt(params: { message: string }): Promise<string>;

  // Show an interactive selector, e.g. to choose browser OAuth vs device code
  onSelect(params: {
    message: string;
    options: { id: string; label: string }[];
  }): Promise<string | undefined>;
}
```

<a id="oauthcredentials"></a>
### OAuth凭证

凭证保存在`~/.pi/agent/auth.json`中：

```typescript
interface OAuthCredentials {
  refresh: string;   // Refresh token (for refreshToken())
  access: string;    // Access token (returned by getApiKey())
  expires: number;   // Expiration timestamp in milliseconds
}
```

<a id="custom-streaming-api"></a>
## 自定义流媒体 API

对于具有非标准 API 的提供商，请实施`streamSimple`。在编写自己的提供程序之前，请先研究现有的提供程序实现：

**参考实现：**
- [anthropic.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/anthropic.ts)- Anthropic 消息 API
- [mistral.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/mistral.ts)- 米斯特拉尔对话 API
- [openai-completions.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/openai-completions.ts)- OpenAI 聊天完成
- [openai-responses.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/openai-responses.ts)- OpenAI 响应 API
- [google.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/google.ts)- 谷歌生成人工智能
- [amazon-bedrock.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/amazon-bedrock.ts)- AWS Bedrock

<a id="stream-pattern"></a>
### 流模式

所有提供商都遵循相同的模式：

```typescript
import {
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  calculateCost,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";

function streamMyProvider(
  model: Model<any>,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    // Initialize output message
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    try {
      // Push start event
      stream.push({ type: "start", partial: output });

      // Make API request and process response...
      // Push content events as they arrive...

      // Push done event
      stream.push({
        type: "done",
        reason: output.stopReason as "stop" | "length" | "toolUse",
        message: output
      });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();

  return stream;
}
```

<a id="event-types"></a>
### 事件类型

按以下顺序通过`stream.push()`推送事件：

1. `{ type: "start", partial: output }`- 流开始

2. 内容事件（可重复，跟踪每个块的`contentIndex`）：
   - `{ type: "text_start", contentIndex, partial }`- 文本块开始
   - `{ type: "text_delta", contentIndex, delta, partial }`- 文本块
   - `{ type: "text_end", contentIndex, content, partial }`- 文本块结束
   - `{ type: "thinking_start", contentIndex, partial }`- 思考开始
   - `{ type: "thinking_delta", contentIndex, delta, partial }`- 思考块
   - `{ type: "thinking_end", contentIndex, content, partial }`- 思考结束
   - `{ type: "toolcall_start", contentIndex, partial }`- 工具调用开始
   - `{ type: "toolcall_delta", contentIndex, delta, partial }`- 工具调用 JSON 块
   - `{ type: "toolcall_end", contentIndex, toolCall, partial }`- 工具调用结束

3. `{ type: "done", reason, message }`或`{ type: "error", reason, error }`- 流结束

每个事件中的`partial`字段包含当前`AssistantMessage`状态。接收数据时更新`output.content`，然后将`output`包含为`partial`。

<a id="content-blocks"></a>
### 内容块

当内容块到达时将其添加到`output.content`中：

```typescript
// Text block
output.content.push({ type: "text", text: "" });
stream.push({ type: "text_start", contentIndex: output.content.length - 1, partial: output });

// As text arrives
const block = output.content[contentIndex];
if (block.type === "text") {
  block.text += delta;
  stream.push({ type: "text_delta", contentIndex, delta, partial: output });
}

// When block completes
stream.push({ type: "text_end", contentIndex, content: block.text, partial: output });
```

<a id="tool-calls"></a>
### 工具调用

工具调用需要积累JSON并解析：

```typescript
// Start tool call
output.content.push({
  type: "toolCall",
  id: toolCallId,
  name: toolName,
  arguments: {}
});
stream.push({ type: "toolcall_start", contentIndex: output.content.length - 1, partial: output });

// Accumulate JSON
let partialJson = "";
partialJson += jsonDelta;
try {
  block.arguments = JSON.parse(partialJson);
} catch {}
stream.push({ type: "toolcall_delta", contentIndex, delta: jsonDelta, partial: output });

// Complete
stream.push({
  type: "toolcall_end",
  contentIndex,
  toolCall: { type: "toolCall", id, name, arguments: block.arguments },
  partial: output
});
```

<a id="usage-and-cost"></a>
### 使用和成本

从 API 响应更新使用情况并计算成本：

```typescript
output.usage.input = response.usage.input_tokens;
output.usage.output = response.usage.output_tokens;
output.usage.cacheRead = response.usage.cache_read_tokens ?? 0;
output.usage.cacheWrite = response.usage.cache_write_tokens ?? 0;
output.usage.totalTokens = output.usage.input + output.usage.output +
                           output.usage.cacheRead + output.usage.cacheWrite;
calculateCost(model, output.usage);
```

<a id="context-overflow-errors"></a>
### 上下文溢出错误

当请求超出模型的上下文窗口时，pi 可以通过压缩对话并重试来自动恢复。仅当 pi 将故障识别为溢出时，此恢复才会启动。

检测在最终确定的辅助消息上运行：

- `stopReason === "error"`
- `errorMessage`匹配 pi 的已知溢出模式之一（参见 [`packages/ai/src/utils/overflow.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/utils/overflow.ts)）

如果您的提供程序返回溢出错误并显示 pi 无法识别的消息，请规范化来自注册提供程序的同一扩展的错误。使用`message_end`处理程序重写助理消息，使其`errorMessage`以 pi 识别的短语开头。通用后备`context_length_exceeded`是最安全的选择。

```typescript
const MY_PROVIDER_OVERFLOW_PATTERN = /your provider's overflow phrase/i;

export default function (pi: ExtensionAPI) {
  pi.registerProvider("my-provider", { /* ... */ });

  pi.on("message_end", (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant") return;
    if (message.stopReason !== "error") return;
    if (
      message.provider !== "my-provider" &&
      ctx.model?.provider !== "my-provider"
    )
      return;

    const errorMessage = message.errorMessage ?? "";
    if (errorMessage.includes("context_length_exceeded")) return;
    if (!MY_PROVIDER_OVERFLOW_PATTERN.test(errorMessage)) return;

    return {
      message: {
        ...message,
        errorMessage: `context_length_exceeded: ${errorMessage}`,
      },
    };
  });
}
```

`message_end`在 pi 跟踪自动压缩的辅助消息之前运行，因此重写的`errorMessage`是 pi 检查的内容。完成此操作后，pi 将：

1. 检测`errorMessage`的溢出。
2. 从实时上下文中删除失败的助手消息。
3. 运行压实。
4. 重试该请求一次。

仔细保护重写：

- 将其范围限定为您的提供商（`message.provider`和`ctx.model?.provider`），以便其他提供商的不相关错误不会受到影响。
- 匹配特定于提供者的模式，而不是 pi 的通用溢出模式。重写速率限制或限制错误（`rate limit`、`too many requests`）会错误地触发压缩，而不是 pi 的正常重试与回退路径。
- 当`errorMessage`已包含`context_length_exceeded`时跳过，因此处理程序是幂等的。

<a id="registration"></a>
### 登记

注册您的流函数：

```typescript
pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: "$MY_API_KEY",
  api: "my-custom-api",
  models: [...],
  streamSimple: streamMyProvider
});
```

<a id="testing-your-implementation"></a>
## 测试您的实施

根据内置提供程序使用的相同测试套件来测试您的提供程序。从 [packages/ai/test/](https://github.com/earendil-works/pi-mono/tree/main/packages/ai/test)复制并调整这些测试文件：

|测试|目的|
|------|---------|
|`stream.test.ts`|基本流式传输、文本输出|
|`tokens.test.ts`|令牌计数和使用|
|`abort.test.ts`|Abort信号处理|
|`empty.test.ts`|空/minimal回复|
|`context-overflow.test.ts`|上下文窗口限制|
|`image-limits.test.ts`|图像输入处理|
|`unicode-surrogate.test.ts`|Unicode 边缘情况|
|`tool-call-without-result.test.ts`|工具调用边缘情况|
|`image-tool-result.test.ts`|工具结果中的图像|
|`total-tokens.test.ts`|总代币计算|
|`cross-provider-handoff.test.ts`|提供者之间的上下文切换|

使用您的提供程序/model对运行测试以验证兼容性。

<a id="config-reference"></a>
## 配置参考

```typescript
interface ProviderConfig {
  /** Display name for the provider in UI such as /login. */
  name?: string;

  /** API endpoint URL. Required when defining models. */
  baseUrl?: string;

  /** API key literal, env interpolation ($ENV_VAR or ${ENV_VAR}), or !command. Required when defining models (unless oauth). */
  apiKey?: string;

  /** API type for streaming. Required at provider or model level when defining models. */
  api?: Api;

  /** Custom streaming implementation for non-standard APIs. */
  streamSimple?: (
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
  ) => AssistantMessageEventStream;

  /** Custom headers to include in requests. Values use the same resolution syntax as apiKey. */
  headers?: Record<string, string>;

  /** If true, adds Authorization: Bearer header with the resolved API key. */
  authHeader?: boolean;

  /** Models to register. If provided, replaces all existing models for this provider. */
  models?: ProviderModelConfig[];

  /** OAuth provider for /login support. */
  oauth?: {
    name: string;
    login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;
    refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;
    getApiKey(credentials: OAuthCredentials): string;
  };
}
```

<a id="model-definition-reference"></a>
## 模型定义参考

```typescript
interface ProviderModelConfig {
  /** Model ID (e.g., "claude-sonnet-4-20250514"). */
  id: string;

  /** Display name (e.g., "Claude 4 Sonnet"). */
  name: string;

  /** API type override for this specific model. */
  api?: Api;

  /** API endpoint URL override for this specific model. */
  baseUrl?: string;

  /** Whether the model supports extended thinking. */
  reasoning: boolean;

  /** Maps pi thinking levels to provider/model-specific values; null marks a level unsupported. */
  thinkingLevelMap?: Partial<Record<"off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max", string | null>>;

  /** Supported input types. */
  input: ("text" | "image")[];

  /** Cost per million tokens (for usage tracking). */
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };

  /** Maximum context window size in tokens. */
  contextWindow: number;

  /** Maximum output tokens. */
  maxTokens: number;

  /** Custom headers for this specific model. */
  headers?: Record<string, string>;

  /** Compatibility settings for the selected API. */
  compat?: {
    // openai-completions
    supportsStore?: boolean;
    supportsDeveloperRole?: boolean;
    supportsReasoningEffort?: boolean;
    supportsUsageInStreaming?: boolean;
    maxTokensField?: "max_completion_tokens" | "max_tokens";
    requiresToolResultName?: boolean;
    requiresAssistantAfterToolResult?: boolean;
    requiresThinkingAsText?: boolean;
    requiresReasoningContentOnAssistantMessages?: boolean;
    thinkingFormat?: "openai" | "openrouter" | "deepseek" | "together" | "zai" | "qwen" | "chat-template" | "qwen-chat-template" | "string-thinking" | "ant-ling";
    chatTemplateKwargs?: Record<string, string | number | boolean | null | { "$var": "thinking.enabled" | "thinking.effort"; omitWhenOff?: boolean }>;
    cacheControlFormat?: "anthropic";
    sessionAffinityFormat?: "openai" | "openai-nosession" | "openrouter";
    sendSessionAffinityHeaders?: boolean;

    // anthropic-messages
    supportsEagerToolInputStreaming?: boolean;
    supportsLongCacheRetention?: boolean;
    sendSessionAffinityHeaders?: boolean;
    supportsCacheControlOnTools?: boolean;
    forceAdaptiveThinking?: boolean;
    allowEmptySignature?: boolean;
  };
}
```

`openrouter`发送`reasoning: { effort }`。`deepseek`发送 `thinking: { type: "enabled" | "disabled" }` and `reasoning_effort` when enabled. `together` sends `reasoning: { enabled }` and also `reasoning_effort` when `supportsReasoningEffort` is enabled. `qwen` is for DashScope-style top-level `enable_thinking`. Use `qwen-chat-template` for local Qwen-compatible servers that read `chat_template_kwargs.enable_thinking` and need `preserve_thinking`. Use `chat-template` for configurable `chat_template_kwargs`, for example DeepSeek V3.x behind vLLM with `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`.
`cacheControlFormat: "anthropic"`将人类风格的`cache_control`标记应用于系统提示、最后一个工具定义和最后一个用户/assistant文本内容。
