# 提供商

Pi 通过 OAuth 支持订阅制提供商，也通过环境变量或身份验证文件支持 API 密钥提供商。Pi 随附内置目录；已配置的提供商可以刷新较新的目录，并将其缓存在 `~/.pi/agent/models-store.json` 中供离线使用。

## 目录

- [订阅](#订阅)
- [API 密钥](#api-密钥)
- [身份验证文件](#身份验证文件)
- [云提供商](#云提供商)
- [自定义提供商](#自定义提供商)
- [解析顺序](#解析顺序)

## 订阅

在交互模式中使用 `/login`，然后选择提供商：

- ChatGPT Plus/Pro (Codex)
- Claude Pro/Max
- GitHub Copilot
- xAI（Grok/X 订阅）
- Radius

使用 `/logout` 清除凭据。令牌存储在 `~/.pi/agent/auth.json` 中，过期时会自动刷新。

### OpenAI Codex

- 需要 ChatGPT Plus 或 Pro 订阅
- 获得 OpenAI 官方认可：[Codex for OSS](https://developers.openai.com/community/codex-for-oss)

### Claude Pro/Max

Anthropic 订阅身份验证适用于 Claude Pro/Max 账户。第三方工具框架的用量取自[额外用量](https://claude.ai/settings/usage)，并按令牌计费，不计入 Claude 套餐限额。

### GitHub Copilot

- 对 github.com 直接按 Enter，或输入你的 GitHub Enterprise Server 域名
- 如果收到“model not supported”，请在 VS Code 中启用：Copilot Chat → 模型选择器 → 选择模型 → “Enable”

### xAI（Grok/X 订阅）

- 运行 `/login xai`，然后选择 **Use a subscription**
- 仍可通过 **Use an API key** 使用 `XAI_API_KEY`

### Radius

Radius 是一个动态 `pi-messages` 网关。`/login radius` 将 OAuth 令牌存入 `auth.json`；网关目录会独立刷新，并缓存在 `models-store.json` 中。可以在 `models.json` 中使用 `"oauth": "radius"` 和网关 `baseUrl` 声明自定义 Radius 网关。

## API 密钥

### 环境变量或身份验证文件

在交互模式中使用 `/login` 并选择提供商，可将 API 密钥存入 `auth.json`；也可通过环境变量设置凭据：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| 提供商 | 环境变量 | `auth.json` 键 |
|----------|----------------------|------------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic` |
| Ant Ling | `ANT_LING_API_KEY` | `ant-ling` |
| Azure OpenAI Responses | `AZURE_OPENAI_API_KEY` | `azure-openai-responses` |
| OpenAI | `OPENAI_API_KEY` | `openai` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek` |
| NVIDIA NIM | `NVIDIA_API_KEY` | `nvidia` |
| Google Gemini | `GEMINI_API_KEY` | `google` |
| Amazon Bedrock | `AWS_BEARER_TOKEN_BEDROCK` | `amazon-bedrock` |
| Mistral | `MISTRAL_API_KEY` | `mistral` |
| Groq | `GROQ_API_KEY` | `groq` |
| Cerebras | `CEREBRAS_API_KEY` | `cerebras` |
| Cloudflare AI Gateway | `CLOUDFLARE_API_KEY`（另需 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_GATEWAY_ID`） | `cloudflare-ai-gateway` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY`（另需 `CLOUDFLARE_ACCOUNT_ID`） | `cloudflare-workers-ai` |
| xAI | `XAI_API_KEY` | `xai` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `vercel-ai-gateway` |
| ZAI Coding Plan（全球） | `ZAI_API_KEY` | `zai` |
| ZAI Coding Plan（中国） | `ZAI_CODING_CN_API_KEY` | `zai-coding-cn` |
| OpenCode Zen | `OPENCODE_API_KEY` | `opencode` |
| OpenCode Go | `OPENCODE_API_KEY` | `opencode-go` |
| Radius | `RADIUS_API_KEY` | `radius` |
| Hugging Face | `HF_TOKEN` | `huggingface` |
| Fireworks | `FIREWORKS_API_KEY` | `fireworks` |
| Together AI | `TOGETHER_API_KEY` | `together` |
| Kimi For Coding | `KIMI_API_KEY` | `kimi-coding` |
| MiniMax | `MINIMAX_API_KEY` | `minimax` |
| MiniMax（中国） | `MINIMAX_CN_API_KEY` | `minimax-cn` |
| Xiaomi MiMo | `XIAOMI_API_KEY` | `xiaomi` |
| Xiaomi MiMo Token Plan（中国） | `XIAOMI_TOKEN_PLAN_CN_API_KEY` | `xiaomi-token-plan-cn` |
| Xiaomi MiMo Token Plan（阿姆斯特丹） | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` | `xiaomi-token-plan-ams` |
| Xiaomi MiMo Token Plan（新加坡） | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` | `xiaomi-token-plan-sgp` |

环境变量和 `auth.json` 键的参考：[`packages/ai/src/env-api-keys.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/env-api-keys.ts) 中的 [`const envMap`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/env-api-keys.ts)。

#### 身份验证文件

将凭据存储在 `~/.pi/agent/auth.json`：

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "ant-ling": { "type": "api_key", "key": "..." },
  "openai": { "type": "api_key", "key": "sk-..." },
  "deepseek": { "type": "api_key", "key": "sk-..." },
  "nvidia": { "type": "api_key", "key": "nvapi-..." },
  "google": { "type": "api_key", "key": "..." },
  "opencode": { "type": "api_key", "key": "..." },
  "opencode-go": { "type": "api_key", "key": "..." },
  "together": { "type": "api_key", "key": "..." },
  "xiaomi": { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-cn":  { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-ams": { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-sgp": { "type": "api_key", "key": "..." }
}
```

该文件以 `0600` 权限创建（仅用户可读写）。身份验证文件中的凭据优先于环境变量。

API 密钥凭据还可包含提供商范围内的环境值。在解析凭据密钥、提供商/模型标头，以及 Cloudflare 账户 ID、Azure OpenAI 设置、Vertex 项目/位置、Bedrock 设置、`PI_CACHE_RETENTION` 和 `HTTP_PROXY`/`HTTPS_PROXY` 等提供商配置时，这些值优先于进程环境变量使用。

```json
{
  "cloudflare-ai-gateway": {
    "type": "api_key",
    "key": "$CLOUDFLARE_API_KEY",
    "env": {
      "CLOUDFLARE_API_KEY": "...",
      "CLOUDFLARE_ACCOUNT_ID": "account-id",
      "CLOUDFLARE_GATEWAY_ID": "gateway-id"
    }
  }
}
```

当 pi 应使用不同于项目 shell 环境的提供商设置时，请使用这种方式。

### 密钥解析

`key` 字段支持执行命令、环境变量插值和字面值：

- **Shell 命令：** 值以 `"!command"` 开头时，会将完整值作为命令执行，并使用 stdout（在进程生命周期内缓存）。
  ```json
  { "type": "api_key", "key": "!security find-generic-password -ws 'anthropic'" }
  { "type": "api_key", "key": "!op read 'op://vault/item/credential'" }
  ```
- **环境变量插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 使用指定变量的值。较长的字面值内部也可使用插值。
  ```json
  { "type": "api_key", "key": "$MY_ANTHROPIC_KEY" }
  { "type": "api_key", "key": "${KEY_PREFIX}_${KEY_SUFFIX}" }
  ```
  `$FOO_BAR` 表示变量 `FOO_BAR`；当 `BAR` 是字面文本时应使用 `${FOO}_BAR`。缺少环境变量会导致该值无法解析。
- **转义：** `"$$"` 输出字面量 `"$"`；`"$!"` 输出字面量 `"!"`，且不会触发命令执行。
  ```json
  { "type": "api_key", "key": "$$literal-dollar-prefix" }
  { "type": "api_key", "key": "$!literal-bang-prefix" }
  ```
- **字面值：** 直接使用。`MY_API_KEY` 等纯大写字符串是字面值；环境变量请使用 `$MY_API_KEY`。
  ```json
  { "type": "api_key", "key": "sk-ant-..." }
  { "type": "api_key", "key": "public" }
  ```

通过 `/login` 登录后，OAuth 凭据也会存储在此文件中并自动管理。

## 云提供商

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# also supported: https://your-resource.cognitiveservices.azure.com
# also supported: https://your-resource.openai.azure.com
# root endpoints are auto-normalized to /openai/v1
# or use resource name instead of base URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# Optional
export AZURE_OPENAI_API_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

使用 `/login amazon-bedrock` 存储 Bedrock API 密钥，或配置下列任一环境 AWS 凭据来源：

```bash
# Option 1: AWS Profile
export AWS_PROFILE=your-profile

# Option 2: IAM Keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# Option 3: Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# Optional region (defaults to us-east-1)
export AWS_REGION=us-west-2
```

还支持 ECS 任务角色（`AWS_CONTAINER_CREDENTIALS_*`）和 IRSA（`AWS_WEB_IDENTITY_TOKEN_FILE`）。

```bash
pi --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

对于 ID 中含有可识别模型名称的 Claude 模型（基础模型和系统定义的推理配置文件），会自动启用提示词缓存。对于应用程序推理配置文件（其 ARN 不含模型名称），请设置 `AWS_BEDROCK_FORCE_CACHE=1` 启用缓存点：

```bash
export AWS_BEDROCK_FORCE_CACHE=1
pi --provider amazon-bedrock --model arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123
```

如果连接到 Bedrock API 代理，可使用以下环境变量：

```bash
# Set the URL for the Bedrock proxy (standard AWS SDK env var)
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# Set if your proxy does not require authentication
export AWS_BEDROCK_SKIP_AUTH=1

# Set if your proxy only supports HTTP/1.1
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Cloudflare AI Gateway

可通过 `/login` 设置 `CLOUDFLARE_API_KEY`。账户 ID 和网关 slug 可通过环境变量设置，也可写入 `auth.json` 中 API 密钥凭据的 `env` 对象。

```bash
export CLOUDFLARE_API_KEY=...           # or use /login
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...        # create at dash.cloudflare.com → AI → AI Gateway
pi --provider cloudflare-ai-gateway --model "claude-sonnet-4-5"
```

它通过 Cloudflare AI Gateway 将请求路由到 OpenAI、Anthropic 和 Workers AI。Workers AI 使用统一 API（`/compat`）和带前缀的模型 ID（`workers-ai/@cf/...`）。OpenAI 使用 OpenAI 透传路由（`/openai`）以及 `gpt-5.1` 等原生 OpenAI 模型 ID。Anthropic 使用 Anthropic 透传路由（`/anthropic`）以及 `claude-sonnet-4-5` 等原生 Anthropic 模型 ID。

AI Gateway 身份验证将 `CLOUDFLARE_API_KEY` 用作 `cf-aig-authorization`。上游身份验证可以采用以下任一方式：

| 模式 | 请求身份验证 | 上游身份验证 |
|------|--------------|---------------|
| Workers AI | 仅 Cloudflare 令牌 | Cloudflare 原生 |
| 统一计费 | 仅 Cloudflare 令牌 | Cloudflare 处理上游身份验证并扣除额度 |
| 存储式 BYOK | 仅 Cloudflare 令牌 | Cloudflare 注入存储在 AI Gateway 控制面板中的提供商密钥 |
| 内联 BYOK | Cloudflare 令牌加上游 `Authorization` 标头 | 请求提供上游提供商密钥 |

对于正常的 pi 使用，建议采用统一计费或存储式 BYOK。内联 BYOK 需要为 Cloudflare AI Gateway 提供商配置额外的上游 `Authorization` 标头，例如通过 `models.json` 的提供商/模型覆盖进行配置。

### Cloudflare Workers AI

可通过 `/login` 设置 `CLOUDFLARE_API_KEY`。`CLOUDFLARE_ACCOUNT_ID` 可通过环境变量设置，也可写入 `auth.json` 中 API 密钥凭据的 `env` 对象。

```bash
export CLOUDFLARE_API_KEY=...           # or use /login
export CLOUDFLARE_ACCOUNT_ID=...
pi --provider cloudflare-workers-ai --model "@cf/moonshotai/kimi-k2.6"
```

Pi 会自动设置 `x-session-affinity`，以获得[前缀缓存](https://developers.cloudflare.com/workers-ai/features/prompt-caching/)优惠。

### Google Vertex AI

使用应用程序默认凭据：

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

也可以将 `GOOGLE_APPLICATION_CREDENTIALS` 设为服务账户密钥文件。

## 自定义提供商

**通过 models.json：** 添加 Ollama、LM Studio、vLLM，或任何采用受支持 API（OpenAI Completions、OpenAI Responses、Anthropic Messages、Google Generative AI）的提供商。参阅 [models.md](models.md)。

**通过扩展：** 对于需要自定义 API 实现或 OAuth 流程的提供商，请创建扩展。参阅 [custom-provider.md](custom-provider.md) 和 [examples/extensions/custom-provider-gitlab-duo](../examples/extensions/custom-provider-gitlab-duo/)。

## 解析顺序

解析提供商凭据时，优先级如下：

1. CLI `--api-key` 标志
2. `auth.json` 条目（API 密钥或 OAuth 令牌）
3. 环境变量
4. `models.json` 中的自定义提供商密钥
