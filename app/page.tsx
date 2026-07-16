"use client";
import {useEffect,useMemo,useState} from "react";

type S={title:string;text?:string;list?:string[];code?:string;note?:string};
type Doc={title:string;intro:string;sections:S[]};
const mk=(title:string,intro:string,...sections:S[]):Doc=>({title,intro,sections});
const install="npm install -g --ignore-scripts @earendil-works/pi-coding-agent";
const nav:[string,[string,string][]][]=[
["从这里开始",[["overview","概览"],["quickstart","快速开始"],["usage","使用 Pi"],["providers","提供商"],["security","安全"],["container","容器化"],["settings","设置"],["keybindings","快捷键"],["sessions","会话"],["compaction","上下文压缩"]]],
["自定义",[["extensions","扩展"],["skills","技能"],["prompts","提示词模板"],["themes","主题"],["packages","Pi 包"],["models","自定义模型"],["custom-providers","自定义提供商"]]],
["参考",[["session-format","会话格式"]]],
["编程式使用",[["sdk","SDK"],["rpc","RPC 模式"],["json","JSON 事件流模式"],["tui","TUI 组件"]]],
["平台设置",[["windows","Windows"],["termux","Android 上的 Termux"],["tmux","tmux"],["terminal","终端设置"],["aliases","Shell 别名"]]],
["开发",[["development","开发指南"]]]];

const docs:Record<string,Doc>={
overview:mk("Pi 文档","Pi 是一个极简的终端编码智能体框架。它的核心保持小巧，并通过 TypeScript 扩展、技能、提示词模板、主题和 Pi 包进行扩展。",
{title:"快速开始",text:"使用 npm 安装 Pi：",code:install,note:"--ignore-scripts 会禁用依赖生命周期脚本。Pi 的常规 npm 安装不需要安装脚本。"},
{title:"运行 Pi",text:"进入项目目录后运行 pi。使用 /login 登录订阅提供商，或在启动前设置 API 密钥。",code:"cd /path/to/project\npi"},
{title:"从这里开始",list:["快速开始 — 安装、认证并完成第一次会话","使用 Pi — 交互模式、命令与上下文文件","提供商 — 订阅服务与 API 密钥配置","安全 — 项目信任与沙箱边界","设置 — 全局和项目级配置"]},
{title:"自定义",list:["扩展 — 添加工具、命令、事件和自定义界面","技能 — 可按需加载的可复用能力","提示词模板 — 通过斜杠命令展开","主题 — 内置及自定义终端主题","Pi 包 — 打包并分享资源"]},
{title:"编程式使用",list:["SDK — 在 Node.js 应用中嵌入 Pi","RPC — 通过 stdin/stdout JSONL 集成","JSON 事件流 — 输出结构化事件","TUI 组件 — 构建终端界面"]}),
quickstart:mk("快速开始","从安装开始，完成一次真正有用的 Pi 会话。",
{title:"安装",text:"Pi 以 npm 包形式发布。",code:install,note:"卸载 Pi 不会删除 ~/.pi/agent/ 中的设置、凭据、会话和 Pi 包。"},
{title:"认证",text:"运行 /login，选择 ChatGPT Plus/Pro（Codex）、Claude Pro/Max 或 GitHub Copilot。也可使用 API 密钥。",code:"export ANTHROPIC_API_KEY=sk-ant-...\npi"},
{title:"第一次会话",text:"Pi 默认向模型提供 read、write、edit 和 bash 四种工具。",code:"cd /path/to/project\npi\n\n> 总结这个代码库，并告诉我如何运行检查。"},
{title:"项目指令",text:"在项目中加入 AGENTS.md，记录规范、检查命令和安全要求。修改后运行 /reload。",code:"# 项目指令\n- 修改后运行 npm run check。\n- 不要执行生产迁移。"},
{title:"常用操作",list:["输入 @ 搜索项目文件","!command 执行并发送输出；!!command 不发送","/model 或 Ctrl+L 切换模型","pi -c 继续最近会话","pi -p 运行一次性任务"]}),
usage:mk("使用 Pi","日常使用 Pi 时最常用的交互方式、命令、会话和命令行选项。",
{title:"交互界面",list:["启动区：快捷键、上下文文件、模板、技能和扩展","消息区：对话、工具调用、通知与错误","编辑器：输入请求；边框颜色代表思考强度","页脚：目录、会话名、令牌、费用和模型"]},
{title:"编辑器",list:["@ 搜索文件；Tab 补全路径","Shift+Enter 多行输入","Ctrl+X 复制最近回复","Ctrl+G 打开外部编辑器","Windows 用 Alt+V 粘贴图片或文本"]},
{title:"斜杠命令",list:["/login、/logout：认证","/model、/settings：模型与设置","/resume、/new：恢复或新建","/tree、/fork、/clone：浏览与分支","/compact：压缩上下文","/export、/share：导出或分享","/reload：重新加载资源"]},
{title:"消息队列",text:"Enter 排入引导消息，Alt+Enter 排入后续消息，Escape 中止，Alt+Up 取回排队消息。"},
{title:"运行模式",code:"pi                         # 交互模式\npi -p \"总结代码库\"          # 打印后退出\npi --mode json             # JSONL 事件流\npi --mode rpc              # RPC\npi --tools read,grep,find  # 限制工具"},
{title:"设计原则",text:"Pi 保持核心小巧，把特定工作流交给扩展、技能、提示词模板和包。"}),
providers:mk("提供商","Pi 支持 OAuth 订阅服务，也支持环境变量或认证文件中的 API 密钥。",
{title:"订阅服务",text:"运行 /login。令牌保存在 ~/.pi/agent/auth.json 并自动刷新。",list:["ChatGPT Plus/Pro（Codex）","Claude Pro/Max","GitHub Copilot","Radius"]},
{title:"API 密钥",code:"ANTHROPIC_API_KEY=...\nOPENAI_API_KEY=...\nGEMINI_API_KEY=...\nDEEPSEEK_API_KEY=...\nOPENROUTER_API_KEY=..."},
{title:"认证文件",text:"auth.json 中的凭据优先于环境变量。",code:"{\n  \"anthropic\": { \"type\": \"api_key\", \"key\": \"$ANTHROPIC_API_KEY\" },\n  \"openai\": { \"type\": \"api_key\", \"key\": \"sk-...\" }\n}"},
{title:"云提供商",list:["Azure OpenAI：配置密钥与资源地址","Amazon Bedrock：支持 Profile、IAM、Bearer Token、ECS 和 IRSA","Google Vertex AI：使用应用默认凭据","Cloudflare AI Gateway / Workers AI：配置账户与令牌"]},
{title:"解析顺序",list:["命令行 --api-key","auth.json","环境变量","models.json 中的自定义密钥"]}),
security:mk("安全","Pi 能读写文件并执行命令。运行前应理解项目信任和隔离边界。",
{title:"项目信任",text:"首次在包含项目设置或资源的目录启动时，Pi 会询问是否信任。未信任前不会加载项目扩展、包或设置。",note:"仓库中的指令和扩展都应视为代码。在信任前先审查来源。"},
{title:"隔离",text:"Pi 本身不是沙箱，会继承当前用户权限。处理不受信任仓库时，请使用容器、虚拟机、Gondolin 或 OpenShell。"},
{title:"凭据",list:["不要提交 auth.json","使用最小权限令牌","不要把密钥写入提示词或分享会话","定期撤销 OAuth 授权"]}),
settings:mk("设置","Pi 支持全局和项目设置。交互模式可通过 /settings 修改常用选项。",
{title:"设置文件",list:["全局：~/.pi/agent/settings.json","项目：.pi/settings.json（信任后加载）"]},
{title:"示例",code:"{\n  \"theme\": \"dark\",\n  \"defaultProvider\": \"anthropic\",\n  \"thinkingLevel\": \"medium\",\n  \"defaultProjectTrust\": \"ask\"\n}"},
{title:"优先级",text:"命令行参数优先于项目设置，项目设置优先于全局设置。"}),
sessions:mk("会话","会话以树结构 JSONL 保存，支持在同一文件中分支和导航。",
{title:"管理",code:"pi -c                  # 继续最近会话\npi -r                  # 浏览历史\npi --no-session        # 不保存\npi --name \"我的任务\"   # 设置名称\npi --session <path|id> # 指定会话"},
{title:"分支",text:"/tree 跳到任意历史节点；/fork 从先前消息新建会话；/clone 复制当前活动分支。"},
{title:"导出",text:"使用 /export 导出 HTML 或 JSONL，使用 /share 创建私有 GitHub Gist。"}),
extensions:mk("扩展","TypeScript 扩展可添加工具、命令、事件处理和自定义终端界面。",
{title:"位置",list:["全局：~/.pi/agent/extensions/","项目：.pi/extensions/","临时：pi -e ./my-extension.ts"]},
{title:"最小扩展",code:"export default function (pi) {\n  pi.registerCommand(\"hello\", {\n    description: \"打个招呼\",\n    handler: async (_args, ctx) => ctx.ui.notify(\"你好！\")\n  });\n}"},
{title:"能力",list:["注册模型工具","注册命令和快捷键","监听会话、消息和工具事件","添加状态栏与覆盖层","实现自定义提供商与 OAuth"]},
{title:"安全",note:"扩展与 Pi 拥有相同权限。只加载你信任的扩展。"}),
models:mk("自定义模型","通过 ~/.pi/agent/models.json 添加兼容 OpenAI、Anthropic 或 Google API 的模型与提供商。",
{title:"示例",code:"{\n  \"providers\": {\n    \"local\": {\n      \"baseUrl\": \"http://localhost:11434/v1\",\n      \"api\": \"openai-completions\",\n      \"apiKey\": \"local\",\n      \"models\": [{ \"id\": \"qwen3-coder\" }]\n    }\n  }\n}"},
{title:"用途",list:["连接 Ollama、LM Studio 或 vLLM","覆盖上下文窗口与定价","增加企业请求头","使用自托管兼容 API"]}),
sdk:mk("SDK","将 Pi 的智能体循环嵌入 Node.js 应用，以代码控制模型、工具、会话和界面。",
{title:"安装",code:"npm install @earendil-works/pi-coding-agent"},
{title:"创建会话",code:"import { createAgentSession } from \"@earendil-works/pi-coding-agent\";\n\nconst session = await createAgentSession({ cwd: process.cwd() });\nawait session.prompt(\"总结这个项目\");"},
{title:"控制范围",list:["提供商、模型与思考强度","内置与自定义工具","会话存储与分支","扩展、技能与提示词","流式事件与界面"]}),
windows:mk("Windows","Pi 可在 Windows Terminal、PowerShell 和常见开发 Shell 中运行。",
{title:"安装",code:install},
{title:"输入与剪贴板",list:["Ctrl+Enter 多行输入","Alt+V 粘贴图片或文本","Ctrl+G 打开外部编辑器"]},
{title:"终端配置",text:"Windows Terminal 默认把 Alt+Enter 用作全屏。若要排入后续消息，请解除该绑定。"}),
};

const brief:Record<string,[string,string,string[],string?]>={
container:["容器化","在受限环境中运行 Pi。",["只挂载任务所需目录","默认禁用网络，按需放行","不要挂载 Docker Socket 或 SSH 目录","使用非 root 用户"]],
keybindings:["快捷键","用 /hotkeys 查看完整列表。",["Ctrl+C 清空；连续两次退出","Escape 取消；连续两次打开会话树","Ctrl+L 选择模型","Shift+Tab 切换思考强度","Ctrl+X 复制回复"]],
compaction:["上下文压缩","用摘要替换较早内容并保留最近对话。",["接近上下文上限时自动触发","/compact 手动压缩","摘要保存为会话条目","原始 JSONL 历史仍保留"]],
skills:["技能","将专门知识和工作流打包为按需能力。",["全局目录 ~/.pi/agent/skills","项目目录 .pi/skills 或 .agents/skills","模型自动选择，也可用 /skill:name"],"my-skill/\n├── SKILL.md\n├── scripts/\n├── references/\n└── assets/"],
prompts:["提示词模板","可通过斜杠命令展开的 Markdown 提示词。",["全局目录 ~/.pi/agent/prompts","项目目录 .pi/prompts","文件名成为命令","$ARGUMENTS 接收参数"]],
themes:["主题","内置主题和 JSON 自定义主题。",["在 /settings 中选择","放在 ~/.pi/agent/themes 或 .pi/themes","确保终端对比度"]],
packages:["Pi 包","通过 npm 或 Git 分发资源。",["pi install <source>","pi install <source> -l","pi update --all","pi list 与 pi config"]],
"custom-providers":["自定义提供商","用扩展实现自定义 API 或 OAuth。",["私有认证签名","自定义 OAuth","非标准流协议","动态模型目录","格式转换"]],
"session-format":["会话格式","每行一个 JSON 条目，通过 id 与 parentId 组成树。",["session：会话头","message：用户、助手和工具消息","compaction：压缩摘要","branch_summary：分支摘要","label：书签"]],
rpc:["RPC 模式","通过标准输入输出交换 JSONL。",["每行一个 JSON 对象","控制端发送命令，Pi 返回事件","日志不要写入 stdout"],"pi --mode rpc"],
json:["JSON 事件流模式","将一次运行的所有事件以 JSONL 输出。",["助手文本增量","工具调用与结果","用量、费用与停止原因","错误与通知"],"pi --mode json \"分析这个代码库\""],
tui:["TUI 组件","为扩展构建终端界面。",["文本、边框和滚动列表","键盘焦点与快捷键","模态覆盖层","自定义页脚和状态栏"]],
termux:["Android 上的 Termux","在移动设备上运行 Pi。",["授权后访问共享存储","配置 Ctrl、Alt 和 Escape","剪贴板行为可能不同"],"pkg install nodejs git\nnpm install -g --ignore-scripts @earendil-works/pi-coding-agent"],
tmux:["tmux","让 Pi 在 SSH 断开后继续运行。",["每个任务使用独立窗口","启用真彩色","检查 Escape 延迟","避免同时操作同一会话"]],
terminal:["终端设置","确保快捷键、颜色和 Unicode 正常。",["使用 UTF-8 与真彩色","确保 TERM 正确","配置 Alt+Enter 与 Ctrl+Enter","使用含中文的等宽字体"]],
aliases:["Shell 别名","快速启动常用模式。",["pc：继续会话","pr：只读模式","pp：一次性模式"],"function pc { pi -c @args }\nfunction pr { pi --tools read,grep,find,ls @args }"],
development:["开发指南","从源码运行 Pi。",["packages/coding-agent：编码智能体","packages/ai：提供商与模型","packages/tui：终端组件","packages/coding-agent/docs：文档"],"git clone https://github.com/earendil-works/pi.git\ncd pi\nnpm install\nnpm run build"]};
Object.entries(brief).forEach(([id,[title,intro,list,code]])=>{if(!docs[id])docs[id]=mk(title,intro,{title:"概览",text:intro},{title:"要点",list},{title:"示例",code})});
const slug=(s:string)=>s.replace(/[\s（）()、，。！？：；]/g,"-").replace(/-+/g,"-");

export default function Home(){
const[page,setPage]=useState("overview"),[dark,setDark]=useState(false),[search,setSearch]=useState(false),[query,setQuery]=useState(""),[menu,setMenu]=useState(false),[copied,setCopied]=useState("");
useEffect(()=>{const p=new URLSearchParams(location.search).get("page");if(p&&docs[p])setPage(p);setDark(localStorage.getItem("pi-theme")==="dark")},[]);
useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";localStorage.setItem("pi-theme",dark?"dark":"light")},[dark]);
useEffect(()=>{const f=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearch(true)}if(e.key==="Escape")setSearch(false)};addEventListener("keydown",f);return()=>removeEventListener("keydown",f)},[]);
const results=useMemo(()=>Object.entries(docs).filter(([,d])=>(d.title+d.intro+d.sections.map(s=>s.title).join("")).toLowerCase().includes(query.toLowerCase())).slice(0,9),[query]);
const go=(id:string)=>{setPage(id);setMenu(false);setSearch(false);history.pushState({},"",id==="overview"?location.pathname:location.pathname+"?page="+id);scrollTo({top:0,behavior:"smooth"})};const cur=docs[page]||docs.overview;
return <div><header className="topbar"><button className="mobile" onClick={()=>setMenu(!menu)}>☰</button><button className="brand" onClick={()=>go("overview")}><i>π</i>Pi</button><nav><a href="https://pi.dev">首页</a><button>文档</button><a href="https://pi.dev/news">动态</a><a href="https://pi.dev/packages">包</a><a href="https://pi.dev/models">模型</a></nav><div className="actions"><button className="searchButton" onClick={()=>setSearch(true)}><span>搜索文档</span><kbd>Ctrl K</kbd></button><a href="https://github.com/earendil-works/pi">↗</a><button onClick={()=>setDark(!dark)}>{dark?"☾":"☼"}</button></div></header>
<aside className={"sidebar "+(menu?"open":"")}><strong>文档</strong>{nav.map(([n,x])=><div className="navGroup" key={n}><label>{n}</label>{x.map(([id,t])=><button className={page===id?"selected":""} key={id} onClick={()=>go(id)}>{t}</button>)}</div>)}</aside>
<main><div className="eyebrow">文档 <b>·</b> 最新版本</div><h1>{cur.title}</h1><p className="lead">{cur.intro}</p>{cur.sections.map((s,i)=><section id={slug(s.title)} key={i}><h2><a href={"#"+slug(s.title)}>{s.title}<em>#</em></a></h2>{s.text&&<p>{s.text}</p>}{s.list&&<ul>{s.list.map((x,j)=><li key={j}>{x}</li>)}</ul>}{s.code&&<div className="code"><div><span>代码</span><button onClick={async()=>{await navigator.clipboard.writeText(s.code||"");setCopied(String(i));setTimeout(()=>setCopied(""),1200)}}>{copied===String(i)?"已复制":"复制"}</button></div><pre>{s.code}</pre></div>}{s.note&&<aside className="note"><b>i</b><p>{s.note}</p></aside>}</section>)}<div className="pager"><button onClick={()=>{const x=Object.keys(docs);go(x[Math.max(0,x.indexOf(page)-1)])}}>← 上一篇</button><button onClick={()=>{const x=Object.keys(docs);go(x[Math.min(x.length-1,x.indexOf(page)+1)])}}>下一篇 →</button></div><footer>Earendil Inc. 与贡献者　·　MIT 许可证　·　非官方中文复刻</footer></main>
<aside className="toc"><strong>本页目录</strong>{cur.sections.map((s,i)=><a href={"#"+slug(s.title)} key={i}>{s.title}</a>)}</aside>
{search&&<div className="overlay" onMouseDown={()=>setSearch(false)}><div className="searchPanel" onMouseDown={e=>e.stopPropagation()}><div className="searchInput"><b>⌕</b><input autoFocus placeholder="搜索文档……" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>ESC</kbd></div><div className="results">{results.map(([id,d])=><button key={id} onClick={()=>go(id)}><span><strong>{d.title}</strong><small>{d.intro}</small></span><i>↵</i></button>)}{!results.length&&<p>没有找到相关文档</p>}</div></div></div>}{menu&&<button className="backdrop" onClick={()=>setMenu(false)}/>}</div>}
