# 云端同步契约

## 权威输入与白名单

只接受以下上游输入：

| 上游路径 | 中文仓库目标 |
|---|---|
| `packages/coding-agent/package.json` | `content/source.json` 的版本字段 |
| `packages/coding-agent/docs/docs.json` | `content/navigation.json` |
| `packages/coding-agent/docs/*.md` | `content/docs/*.md`、`content/source-structure.json` |
| `packages/coding-agent/docs/images/**` | `public/docs-images/**` |

附带更新 `content/changelog.json`、`content/source.json` 及确有必要的已生成站内搜索数据。其他上游路径不得触发翻译或正文写入。

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

## 日志与状态

`content/changelog.json` 沿用 `date`、`version`、`commit`、`summary`、`added`、`changed`、`removed`。同一目标 SHA 不得重复记录。记录只来自本次 compare 事实。

若基线不同但只有无关代码变化，可只更新 `content/source.json.commit` 与同步日期；仍需通过所有云端验证并自动合并。若没有任何变化，不创建提交、分支或 PR。

## 失败原子性

任何预写入失败都不得修改 GitHub。写入后但合并前失败时，`main` 必须保持不变。合并后回读不一致属于严重失败：立即发送失败邮件，报告合并 commit，不再追加修复提交或强制回滚。

禁止：全站枚举作为回退、全站/全文重译、浮动读取 `raw/main`、直接写 `main`、force push、绕过分支保护、忽略失败检查、静默降低验证要求。
