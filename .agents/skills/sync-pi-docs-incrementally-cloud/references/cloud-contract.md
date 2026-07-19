# 云端同步契约

## 权威输入与白名单

只接受以下上游输入：

| 上游路径 | 中文仓库目标 |
|---|---|
| `packages/coding-agent/package.json` | `content/source.json` 的版本字段 |
| `packages/coding-agent/docs/docs.json` | `content/navigation.json` |
| `packages/coding-agent/docs/*.md` | `content/docs/*.md`、`content/source-structure.json` |
| `packages/coding-agent/docs/images/**` | `public/docs-images/**` |

附带更新 `content/changelog.json`、`content/source.json` 及确有必要的已生成站内搜索数据。新增 Markdown 若已被上游 `index.md` 以相对链接引用但尚未出现在 `docs.json`，允许派生最小 `content/navigation.json` 条目，使其进入生成页面、站内搜索和站内导航；该派生必须记录在变更日志中。其他上游路径不得触发翻译或正文写入。

## 增量合并

在代码围栏外按 H1–H4 ATX 标题划分块，第一个标题前内容作为前言块。规范化换行并只忽略块边界尾随空白后计算内容等价性。

修改页面必须同时读取：

1. 基线 SHA 的旧英文页面；
2. 目标 SHA 的新英文页面；
3. 中文仓库当前 `main` 的中文页面；
4. `content/source-structure.json` 中对应结构。

按完整内容匹配尚未使用的旧块。匹配成功时逐字复用对应中文块；移动块同样复用。只翻译未匹配的新块。删除块不进入新页面。映射不唯一时停止，不得降级为全文翻译。

## 候选内容与提交

先在内存中形成完整候选集，再执行任何写入。候选集必须包含：

- 所有新增、修改、删除或重命名文件；
- 更新后的导航、结构、日志和基线；
- 每个候选文件的来源状态和验证结果。

使用 GitHub Git Data 工具构造 blobs、基于当次 `main` tree 创建新 tree、创建单一 commit，再把临时分支更新到该 commit。不得对 `main` 使用强制 ref 更新。

创建普通 PR 后，确认 base 为 `main`、head 为预期分支、head SHA 未漂移、文件列表与候选集完全一致，然后立即自动合并。非强制检查不阻塞；必需检查尚在运行时优先启用 GitHub 自动合并，明确失败时才停止。

合并不是成功终点。合并后必须完成两套发布：

1. GitHub Pages：等待 `Deploy GitHub Pages` 对该合并 commit 完成，并验证线上版本与目标版本一致。
2. ChatGPT Site：读取 `.openai/hosting.json`，保存来源为该合并 commit 的新版本，部署到生产并验证终态为 `succeeded`。

任一站点未发布或无法验证时，本次任务状态为失败；邮件必须说明 `main` 已经改变及未完成的发布阶段。

## 日志与状态

`content/changelog.json` 沿用 `date`、`version`、`commit`、`summary`、`added`、`changed`、`removed`。同一目标 SHA 不得重复记录。记录只来自本次 compare 事实。数组必须按日期倒排，最新记录位于最上方；本次同步条目必须前插到索引 `0`，不得追加到尾部或重排既有的同日历史记录。写入后必须验证日期序列单调不增且第一项是本次新条目。

若基线不同但只有无关代码变化，可只更新 `content/source.json.commit` 与同步日期；仍需通过所有云端验证、自动合并并发布两套站点。若没有任何变化，不创建提交、分支、PR 或新 Site 版本。

## 失败原子性

任何预写入失败都不得修改 GitHub。写入后但合并前失败时，`main` 必须保持不变。合并后回读不一致属于严重失败：立即发送失败邮件，报告合并 commit，不再追加修复提交或强制回滚。

禁止：全站枚举作为回退、全站/全文重译、浮动读取 `raw/main`、直接写 `main`、force push、绕过分支保护、忽略失败检查、复用旧 Site 版本冒充本次发布、仅合并未发布却报告成功、静默降低验证要求。
