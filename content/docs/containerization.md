# 容器化

Pi 默认以全部权限运行，但在某些情况下，你会希望更精确地控制 Pi 可以写入哪些目录以及它拥有何种访问权限。

通常有两种选择。你可以：
1. 在隔离环境中运行整个 `pi` 进程，或者
2. 在主机上运行 `pi`，并将工具执行路由到隔离环境中。

## 选择一种模式

| 模式 | 隔离对象 | 最适合 | 说明 |
| --- | --- | --- | --- |
| Gondolin 扩展 | 内置工具和 `!` 命令 | 将身份验证保留在主机上的同时，实现本地微型虚拟机隔离 | 参阅 [`examples/extensions/gondolin/`](../examples/extensions/gondolin/)。 |
| 普通 Docker | 本地容器中的整个 `pi` 进程 | 简单的本地隔离 | 提供商 API 密钥会进入容器。 |
| OpenShell | 策略控制沙箱中的整个 `pi` 进程 | 本地或远程托管沙箱 | 需要 OpenShell 网关 |

扩展会在 `pi` 进程所在之处运行。如果在主机上运行 `pi` 并使用工具路由扩展，其他自定义扩展工具仍会在主机上运行，除非它们也委派其操作。

## Gondolin

[Gondolin](https://github.com/earendil-works/gondolin) 是一个本地 Linux 微型虚拟机。当你希望 `pi` 在主机上运行，而所有内置工具都路由到虚拟机时，请使用[示例扩展](../examples/extensions/gondolin)。

设置：

```bash
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

从希望挂载的项目中运行：

```bash
cd /path/to/project
pi -e ~/.pi/agent/extensions/gondolin
```

该扩展将主机当前工作目录挂载到虚拟机中的 `/workspace`，并覆盖 `read`、`write`、`edit`、`bash`、`grep`、`find` 和 `ls`。用户的 `!` 命令也会路由到虚拟机。在 `/workspace` 下进行的文件更改会直接写入主机。

要求：`@earendil-works/gondolin` 需要 Node.js >= 23.6.0，并且需要 QEMU（需通过你的包管理器安装）。

## 普通 Docker

如果希望获得最简单的本地容器边界，请在 Docker 中运行整个 `pi` 进程。

`Dockerfile.pi`：

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /workspace
ENTRYPOINT ["pi"]
```

构建并运行：

```bash
docker build -t pi-sandbox -f Dockerfile.pi .

docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

`-v "$PWD:/workspace"` 会把当前目录挂载到容器内的 /workspace，因此 Docker 内对 `/workspace` 的读写会直接影响主机文件，与 Gondolin 示例相同。

如果希望使用容器本地的设置和会话，请为 `/root/.pi/agent` 使用命名卷。挂载主机的 `~/.pi/agent` 会将主机身份验证和会话文件暴露给容器。

## OpenShell

如果希望使用具备文件系统、进程、网络、凭据和推理控制的策略控制沙箱，请使用 [NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview)。OpenShell 可以通过由 Docker、Podman 或虚拟机运行时支持的本地网关运行沙箱，也可以通过远程 Kubernetes 网关运行。

每个沙箱都需要一个活动网关。创建沙箱前，请先注册并选择一个网关：

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

在 OpenShell 沙箱内启动 `pi`：

```bash
openshell sandbox create --name pi-sandbox --from pi -- pi
```

在此模式中，整个 `pi` 进程都在沙箱内运行。内置工具、`!` 命令和扩展工具均在 OpenShell 边界内执行。

如果网关位于远程，项目文件不会从主机绑定挂载，这意味着沙箱内的写入不会反映到你的计算机上。请在沙箱内克隆仓库，或使用 OpenShell 文件传输命令：

```bash
openshell sandbox upload pi-sandbox ./repo /workspace
openshell sandbox download pi-sandbox /workspace/repo ./repo-out
```

OpenShell 提供商可将原始模型 API 密钥保留在沙箱之外。配置推理路由后，沙箱内的代码可以调用 `https://inference.local`，网关会向上游注入已配置的提供商凭据。如果希望模型流量使用这条路径，请配置 Pi 使用相应的 OpenAI 兼容或 Anthropic 兼容端点。
