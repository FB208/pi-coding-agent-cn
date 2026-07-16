<a id="custom-models"></a>
# 自定义模型

通过`~/.pi/agent/models.json`添加自定义提供程序和模型（Ollama、vLLM、LM Studio、代理）。

<a id="table-of-contents"></a>
## 目录

- [最小示例](#minimal-example)
- [完整示例](#full-example)
- [支持的API](#supported-apis)
- [提供商配置](#provider-configuration)
- [型号配置](#model-configuration)
- [覆盖内置提供程序](#overriding-built-in-providers)
- [每个模型覆盖](#per-model-overrides)
- [人择消息兼容性](#anthropic-messages-compatibility)
- [OpenAI 兼容性](#openai-compatibility)

<a id="minimal-example"></a>
## 最小的例子

对于本地模型（Ollama、LM Studio、vLLM），每个模型仅需要`id`：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

`apiKey`值是一个占位符，因为 Ollama 会忽略它。 pi 仍然将模型视为需要身份验证才能出现在`/model`中，因此无密钥本地服务器应保留一个虚拟值，使用`/login`为该提供程序保存密钥，或者在选择模型时传递`--api-key`。

一些 OpenAI 兼容服务器不理解用于推理模型的`developer`角色。对于这些提供程序，将`compat.supportsDeveloperRole`设置为`false`，以便 pi 将系统提示符作为`system`消息发送。如果服务器也不支持`reasoning_effort`，请将`compat.supportsReasoningEffort`也设置为`false`。

您可以在提供程序级别设置`compat`以应用于所有模型，或在模型级别设置以覆盖特定模型。这通常适用于 Ollama、vLLM、SGLang 和类似的 OpenAI 兼容服务器。

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "gpt-oss:20b",
          "reasoning": true
        }
      ]
    }
  }
}
```

<a id="full-example"></a>
## 完整示例

当您需要特定值时覆盖默认值：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B (Local)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

每次打开`/model`时，该文件都会重新加载。在会议期间编辑；无需重新启动。

<a id="google-ai-studio-example"></a>
## 谷歌AI工作室示例

使用`google-generative-ai`和`baseUrl`从 Google AI Studio 添加模型，包括自定义 Gemma 4 条目：

```json
{
  "providers": {
    "my-google": {
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "api": "google-generative-ai",
      "apiKey": "$GEMINI_API_KEY",
      "models": [
        {
          "id": "gemma-4-31b-it",
          "name": "Gemma 4 31B",
          "input": ["text", "image"],
          "contextWindow": 262144,
          "reasoning": true
        }
      ]
    }
  }
}
```

将自定义模型添加到`google-generative-ai`API 类型时，需要`baseUrl`。

<a id="supported-apis"></a>
## 支持的API

|应用程序编程接口|描述|
|-----|-------------|
|`openai-completions`|OpenAI 聊天完成（最兼容）|
|`openai-responses`|OpenAI 响应 API|
|`anthropic-messages`|人择消息 API|
|`google-generative-ai`|谷歌生成人工智能|

在提供程序级别（所有模型的默认值）或模型级别（每个模型覆盖）设置`api`。

<a id="provider-configuration"></a>
## 提供商配置

|场地|描述|
|-------|-------------|
|`baseUrl`|API 端点 URL|
|`api`|API 类型（见上文）|
|`apiKey`|可选的 API 密钥配置（请参阅下面的值解析）。当`/login`/`auth.json`或 CLI`--api-key`提供身份验证时，请忽略它。|
|`oauth`|动态 OAuth 提供程序类型。目前支持`"radius"`；需要网关`baseUrl`。|
|`headers`|自定义标头（请参阅下面的值解析）|
|`authHeader`|设置`true`自动添加`Authorization: Bearer <apiKey>`|
|`models`|模型配置数组|
|`modelOverrides`|每个模型覆盖此提供程序上的内置或扩展注册模型|

对于具有`models`的提供程序，非内置提供程序配置需要提供程序或模型级别的`baseUrl`和`api`值。加载文件不需要`apiKey`：当通过`/login`/`auth.json`、CLI`--api-key`或提供程序`apiKey`配置身份验证时，模型可用。如果未配置身份验证，则模型会加载，但在`/model`和`--list-models`中保持不可用。

<a id="value-resolution"></a>
### 价值解析

`apiKey`和`headers`字段支持命令执行、环境插值和文字：

- **Shell 命令：** 开头的`"!command"`将整个值作为命令执行并使用 stdout
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  "apiKey": "!op read 'op://vault/item/credential'"
  ```
- **环境插值：**`"$ENV_VAR"`或`"${ENV_VAR}"`使用指定变量的值。插值适用于较大的文字。
  ```json
  "apiKey": "$MY_API_KEY"
  "apiKey": "${KEY_PREFIX}_${KEY_SUFFIX}"
  ```
`$FOO_BAR`是变量`FOO_BAR`；当`BAR`是文字文本时，使用`${FOO}_BAR`。缺少环境变量会导致该值无法解析。
- **转义：**`"$$"`发出文字`"$"`；`"$!"`发出文字`"!"`而不触发命令执行。
  ```json
  "apiKey": "$$literal-dollar-prefix"
  "apiKey": "$!literal-bang-prefix"
  ```
- **字面值：** 直接使用。普通大写字符串（例如`MY_API_KEY`）是文字；使用`$MY_API_KEY`作为环境变量。
  ```json
  "apiKey": "sk-..."
  ```

对于`models.json`，shell 命令在请求时解析。 pi 故意不对任意命令应用内置 TTL、过时重用或恢复逻辑。不同的命令需要不同的缓存和失败策略，并且 pi 无法推断出正确的策略。

如果您的命令速度慢、成本高、速率受限，或者应该在暂时性故障时继续使用先前的值，请将其包装在您自己的脚本或命令中，以实现您想要的缓存或 TTL 行为。

`/model`可用性检查使用配置的身份验证存在，并且不执行 shell 命令。

<a id="custom-headers"></a>
### 自定义标头

```json
{
  "providers": {
    "custom-proxy": {
      "baseUrl": "https://proxy.example.com/v1",
      "apiKey": "$MY_API_KEY",
      "api": "anthropic-messages",
      "headers": {
        "x-portkey-api-key": "$PORTKEY_API_KEY",
        "x-secret": "!op read 'op://vault/item/secret'"
      },
      "models": [...]
    }
  }
}
```

<a id="model-configuration"></a>
## 型号配置

|场地|必需的|默认|描述|
|-------|----------|---------|-------------|
|`id`|是的| — |型号标识符（传递给 API）|
|`name`|不|`id`|人类可读的模型标签。用于匹配（`--model`模式）并显示为辅助模型详细信息文本。|
|`api`|不|提供商的`api`|覆盖此模型的提供商的 API|
|`reasoning`|不|`false`|支持扩展思维|
|`thinkingLevelMap`|不|省略|将 pi 思维级别映射到提供者值并标记不支持的级别（见下文）|
|`input`|不|`["text"]`|输入类型：`["text"]`或`["text", "image"]`|
|`contextWindow`|不| `128000` |上下文窗口大小（以标记为单位）|
|`maxTokens`|不| `16384` |最大输出令牌|
|`cost`|不|全为零|每百万代币费率以及可选的请求范围输入定价层|
|`compat`|不|提供商`compat`|提供商兼容性覆盖。当两者都设置时，与提供者级别`compat`合并。|

成本层提供完整的替代费率集，并在总输入使用量 (`input + cacheRead + cacheWrite`) 超过`inputTokensAbove`时应用于完整请求。当多个级别匹配时，阈值最高的获胜。

```json
{
  "cost": {
    "input": 5,
    "output": 30,
    "cacheRead": 0.5,
    "cacheWrite": 6.25,
    "tiers": [
      {
        "inputTokensAbove": 272000,
        "input": 10,
        "output": 45,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    ]
  }
}
```

当前行为：
- `/model`、`--list-models`和交互式页脚按模型`id`显示条目。
- 配置的`name`用于模型匹配和辅助模型详细信息文本。它不会替换页脚/status-bar型号 ID。

<a id="thinking-level-map"></a>
### 思维层次图

在模型上使用`thinkingLevelMap`来描述特定于模型的思维控制。关键是 pi 思维级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。地图可能包含漏洞；例如，模型可以公开`high`和`max`而不公开`xhigh`。

值是三态的：

|价值|意义|
|-------|---------|
|省略|通过`high`的标准级别使用提供者的默认映射；不支持扩展`xhigh`和`max`级别|
|细绳|支持级别并将该值发送给提供商|
|`null`|关卡不受支持并隐藏在/skipped/clamped之外|

仅支持 off、high 和 max 推理的模型示例：

```json
{
  "id": "deepseek-v4-pro",
  "reasoning": true,
  "thinkingLevelMap": {
    "minimal": null,
    "low": null,
    "medium": null,
    "high": "high",
    "xhigh": null,
    "max": "max"
  }
}
```

思维不能被禁用的模型示例：

```json
{
  "id": "always-thinking-model",
  "reasoning": true,
  "thinkingLevelMap": {
    "off": null
  }
}
```

迁移：使用`compat.reasoningEffortMap`的旧配置应将该映射移动到模型级别`thinkingLevelMap`。对于不应出现在 UI 中的级别，请使用`null`。

<a id="overriding-built-in-providers"></a>
## 重写内置提供程序

通过代理路由内置提供者，无需重新定义模型：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1"
    }
  }
}
```

所有内置 Anthropic 模型仍然可用。现有的 OAuth 或 API 密钥身份验证继续有效。

要将自定义模型合并到内置提供程序中，请包含`models`数组：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1",
      "apiKey": "$ANTHROPIC_API_KEY",
      "api": "anthropic-messages",
      "models": [...]
    }
  }
}
```

合并语义：
- 保留内置模型。
- 自定义模型由提供程序中的`id`更新插入。
- 如果自定义模型`id`与内置模型`id`匹配，则自定义模型将替换该内置模型。
- 如果自定义模型`id`是新的，它将与内置模型一起添加。

<a id="per-model-overrides"></a>
## 每个模型的覆盖

使用`modelOverrides`自定义内置模型和匹配扩展注册模型，而无需替换提供者的完整模型列表。

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "name": "Claude Sonnet 4 (Bedrock Route)",
          "compat": {
            "openRouterRouting": {
              "only": ["amazon-bedrock"]
            }
          }
        }
      }
    }
  }
}
```

`modelOverrides`支持每个模型的以下字段：`name`、`reasoning`、`thinkingLevelMap`、`input`、`cost`（部分）、`contextWindow`、`maxTokens`、`headers`、`compat`。

Direct OpenAI GPT-5.6 Sol、Terra 和 Luna 默认使用`272000`上下文窗口，因此请求保留在 OpenAI 的短上下文定价层内。要选择 OpenAI 的 1.05M 上下文窗口，请为您使用的每个模型增加它：

```json
{
  "providers": {
    "openai": {
      "modelOverrides": {
        "gpt-5.6-sol": {
          "contextWindow": 1050000
        }
      }
    }
  }
}
```

覆盖保留内置定价元数据。总输入令牌超过 272K 的请求对整个请求使用 GPT-5.6 的长上下文速率。需要时，对`gpt-5.6-terra`或`gpt-5.6-luna`应用相同的覆盖。

行为注意事项：
- `modelOverrides`适用于内置提供者模型和匹配的扩展注册提供者模型。
- 未知的型号 ID 将被忽略。
- 您可以将提供商级别`baseUrl`/`headers`与`modelOverrides`组合起来。
- 覆盖`name`仅更改模型匹配和次要详细文本；页脚和主要型号列表继续显示型号`id`。
- 如果还为提供程序定义了`models`，则自定义模型将在内置覆盖后合并。具有相同`id`的自定义模型将替换覆盖的内置模型条目。

<a id="anthropic-messages-compatibility"></a>
## 人择消息兼容性

对于使用`api: "anthropic-messages"`的提供者或代理，请使用`compat`来控制特定于人类的请求兼容性。

默认情况下 pi 发送每个工具`eager_input_streaming: true`。如果代理或 Anthropic 兼容后端拒绝该字段，请将`supportsEagerToolInputStreaming`设置为`false`。 Pi 将省略`tools[].eager_input_streaming`并为支持工具的请求发送旧的`fine-grained-tool-streaming-2025-05-14`beta 标头。

一些人择模型需要适应性思维（`thinking.type: "adaptive"`加`output_config.effort`），而不是传统的基于预算的思维有效负载。内置模型会自动设置此项。对于路由到这些模型的自定义提供程序或别名，请将`forceAdaptiveThinking`设置为`true`。

一些与人类兼容的提供者发出带有空签名的思维块，并且仍然期望它们重播。仅针对这些提供者将`allowEmptySignature`设置为`true`；真正的人择拒绝空洞的思维签名。

```json
{
  "providers": {
    "anthropic-proxy": {
      "baseUrl": "https://proxy.example.com",
      "api": "anthropic-messages",
      "apiKey": "$ANTHROPIC_PROXY_KEY",
      "compat": {
        "supportsEagerToolInputStreaming": false,
        "supportsLongCacheRetention": true,
        "forceAdaptiveThinking": true,
        "allowEmptySignature": true
      },
      "models": [
        {
          "id": "claude-opus-4-7",
          "reasoning": true,
          "input": ["text", "image"]
        }
      ]
    }
  }
}
```

|场地|描述|
|-------|-------------|
|`supportsEagerToolInputStreaming`|提供程序是否接受每个工具`eager_input_streaming`。默认值：`true`。设置为`false`以忽略该字段，并在启用工具的请求上使用旧的细粒度工具流式测试标头。|
|`supportsLongCacheRetention`|当缓存保留为`long`时，提供程序是否接受人为长缓存保留 (`cache_control.ttl: "1h"`)。默认值：`true`。|
|`sendSessionAffinityHeaders`|启用缓存时是否从会话 ID 发送`x-session-affinity`。默认值：自动检测已知提供商。|
|`supportsCacheControlOnTools`|提供程序是否接受工具定义上的人类风格`cache_control`标记。默认值：`true`。|
|`forceAdaptiveThinking`|是否为该模型发送自适应思维（`thinking.type: "adaptive"`加`output_config.effort`）。内置自适应模型会自动设置此值。默认值：`false`。|
|`allowEmptySignature`|是否将空思维签名重播为`signature: ""`而不是将思维转换为文本。默认值：`false`。|

<a id="openai-compatibility"></a>
## OpenAI 兼容性

对于具有部分 OpenAI 兼容性的提供商，请使用`compat`字段。

- 提供程序级别`compat`将默认值应用于该提供程序下的所有模型。
- 模型级别`compat`会覆盖该模型的提供程序级别值。

```json
{
  "providers": {
    "local-llm": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "compat": {
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens"
      },
      "models": [...]
    }
  }
}
```

|场地|描述|
|-------|-------------|
|`supportsStore`|提供商支持`store`字段|
|`supportsDeveloperRole`|使用`developer`与`system`角色|
|`supportsReasoningEffort`|支持`reasoning_effort`参数|
|`supportsUsageInStreaming`|支持`stream_options: { include_usage: true }`（默认：`true`）|
|`maxTokensField`|使用`max_completion_tokens`或`max_tokens`|
|`requiresToolResultName`|在工具结果消息中包含`name`|
|`requiresAssistantAfterToolResult`|在工具结果之后的用户消息之前插入辅助消息|
|`requiresThinkingAsText`|将思维块转换为纯文本|
|`requiresReasoningContentOnAssistantMessages`|启用推理时，在所有重播的助理消息中包含空`reasoning_content`|
|`thinkingFormat`|使用`reasoning_effort`、`openrouter`、`deepseek`、`together`、`zai`、`qwen`、`chat-template`或`qwen-chat-template`思维参数|
|`chatTemplateKwargs`|`chat_template_kwargs`的`thinkingFormat: "chat-template"`值；使用`{ "$var": "thinking.enabled" }`或`{ "$var": "thinking.effort" }`来获取 pi 控制的思维值|
|`cacheControlFormat`|在系统提示、最后一个工具定义和最后一个用户/assistant文本内容上使用人类风格的`cache_control`标记。目前仅支持`anthropic`。|
|`sendSessionAffinityHeaders`|对于`openai-completions`，在启用缓存时从会话 ID 发送会话关联标头。默认值：`false`。|
|`sessionAffinityFormat`|For`openai-completions`and`openai-responses`, the session-affinity header format:`openai`sends`session_id`/`x-client-request-id`(completions also`x-session-affinity`),`openai-nosession`omits the underscore-containing`session_id`header,`openrouter`发送`x-session-id`。不影响`prompt_cache_key`主体参数。默认：自动检测。|
|`supportsStrictMode`|在工具定义中包含`strict`字段|
|`supportsLongCacheRetention`|当缓存保留为`long`时，提供程序是否接受长缓存保留：对于 OpenAI 提示缓存，为`prompt_cache_retention: "24h"`，或在`cacheControlFormat`为`anthropic`时接受`cache_control.ttl: "1h"`。默认值：`true`。|
|`openRouterRouting`|OpenRouter 提供商的路由首选项。该对象按原样发送到 [OpenRouter API 请求](https://openrouter.ai/docs/guides/routing/provider-selection)的`provider`字段中。|
|`vercelGatewayRouting`|用于选择提供商的 Vercel AI 网关路由配置（`only`、`order`）|

`openrouter`使用`reasoning: { effort }`。当启用`supportsReasoningEffort`时，`together`使用`reasoning: { enabled }`和`reasoning_effort`。`qwen`使用顶级`enable_thinking`。对于需要`chat_template_kwargs.enable_thinking`和`preserve_thinking`的本地 Qwen 兼容服务器，请使用`qwen-chat-template`。对需要可配置`chat_template_kwargs`的 vLLM/Hugging面部聊天模板使用`chat-template`，例如对 DeepSeek V3.x 模板使用`chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`。

`cacheControlFormat: "anthropic"`适用于 OpenAI 兼容的提供程序，通过文本内容和工具定义上的`cache_control`标记公开人类风格的提示缓存。

例子：

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "$OPENROUTER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "openrouter/anthropic/claude-3.5-sonnet",
          "name": "OpenRouter Claude 3.5 Sonnet",
          "compat": {
            "openRouterRouting": {
              "allow_fallbacks": true,
              "require_parameters": false,
              "data_collection": "deny",
              "zdr": true,
              "enforce_distillable_text": false,
              "order": ["anthropic", "amazon-bedrock", "google-vertex"],
              "only": ["anthropic", "amazon-bedrock"],
              "ignore": ["gmicloud", "friendli"],
              "quantizations": ["fp16", "bf16"],
              "sort": {
                "by": "price",
                "partition": "model"
              },
              "max_price": {
                "prompt": 10,
                "completion": 20
              },
              "preferred_min_throughput": {
                "p50": 100,
                "p90": 50
              },
              "preferred_max_latency": {
                "p50": 1,
                "p90": 3,
                "p99": 5
              }
            }
          }
        }
      ]
    }
  }
}
```

Vercel AI 网关示例：

```json
{
  "providers": {
    "vercel-ai-gateway": {
      "baseUrl": "https://ai-gateway.vercel.sh/v1",
      "apiKey": "$AI_GATEWAY_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "moonshotai/kimi-k2.5",
          "name": "Kimi K2.5 (Fireworks via Vercel)",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": { "input": 0.6, "output": 3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 262144,
          "maxTokens": 262144,
          "compat": {
            "vercelGatewayRouting": {
              "only": ["fireworks", "novita"],
              "order": ["fireworks", "novita"]
            }
          }
        }
      ]
    }
  }
}
```
